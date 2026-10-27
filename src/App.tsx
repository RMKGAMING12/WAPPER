/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { MicOff, VolumeX, Radio, X, Layers, ShieldCheck, Globe } from 'lucide-react';
import { InstallPrompt } from './components/InstallPrompt';
import { Sidebar, ServerItem } from './components/Sidebar';
import { ChannelList, VoiceChannelOccupant } from './components/ChannelList';
import { ChatArea, ChatMessageItem, CustomEmojiItem } from './components/ChatArea';
import { VoiceVideoGrid } from './components/VoiceVideoGrid';
import { FriendsDashboard } from './components/FriendsDashboard';
import { ProfileSettingsModal } from './components/ProfileSettingsModal';
import { UserProfilePopover } from './components/UserProfilePopover';
import { AIStudioModal } from './components/AIStudioModal';
import { ArchitectureModal } from './components/ArchitectureModal';
import { useWebRTC } from './useWebRTC';
import {
  ChannelItem,
  WapperProfile,
  HydratedFriendItem,
  filterHydratedFriendsByTab,
} from './utils/chatLogic';
import {
  listenToAuthChanges,
  signInWithGoogle,
  signInWithGoogleIdentity,
  signOut,
  updateUserProfile,
} from './authService';
import {
  fetchHydratedFriends,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  blockUser,
  unblockUser,
} from './socialManager';
import { persistMessageRecord } from './supabaseClient';

const STATUS_DOT_COLOR: Record<WapperProfile['status'], string> = {
  online: 'bg-emerald-500',
  idle: 'bg-amber-400',
  dnd: 'bg-rose-500',
  offline: 'bg-slate-500',
};

function getDirectMessageChannelId(userA: string, userB: string): string {
  return `dm_${[userA, userB].sort().join('_')}`;
}

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [currentUser, setCurrentUser] = useState<WapperProfile | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string>('');
  const [showIframeGoogleForm, setShowIframeGoogleForm] = useState<boolean>(false);
  const [googleEmailInput, setGoogleEmailInput] = useState<string>('');
  const [googleNameInput, setGoogleNameInput] = useState<string>('');

  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);

  // Core Real-Time Entities (Strictly Zero Hardcoded Dummy Data)
  const [servers, setServers] = useState<ServerItem[]>([]);
  const [channels, setChannels] = useState<ChannelItem[]>([]);
  const [profiles, setProfiles] = useState<WapperProfile[]>([]);
  const [friends, setFriends] = useState<HydratedFriendItem[]>([]);
  const [customEmojis, setCustomEmojis] = useState<CustomEmojiItem[]>([]);
  const [messagesByChannel, setMessagesByChannel] = useState<Record<string, ChatMessageItem[]>>({});
  const [voiceOccupantsByChannel, setVoiceOccupantsByChannel] = useState<
    Record<string, VoiceChannelOccupant[]>
  >({});

  // Navigation State
  const [activeServerId, setActiveServerId] = useState<string>('srv_wapper_community');
  const [activeChannelId, setActiveChannelId] = useState<string>('chan_general');
  const [isDMMode, setIsDMMode] = useState<boolean>(true);
  const [isFriendsDashboardActive, setIsFriendsDashboardActive] = useState<boolean>(true);
  const [activeDMPeerId, setActiveDMPeerId] = useState<string | null>(null);
  const [showMemberSidebar, setShowMemberSidebar] = useState<boolean>(true);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState<boolean>(false);

  // Modals & Popovers
  const [showProfileSettingsModal, setShowProfileSettingsModal] = useState<boolean>(false);
  const [inspectedProfile, setInspectedProfile] = useState<WapperProfile | null>(null);
  const [showAIStudioModal, setShowAIStudioModal] = useState<boolean>(false);
  const [showArchitectureModal, setShowArchitectureModal] = useState<boolean>(false);

  // Typing Indicators per Channel
  const [typingByChannel, setTypingByChannel] = useState<Record<string, string[]>>({});

  // Subscribe to real-time authentication state
  useEffect(() => {
    const unsubscribe = listenToAuthChanges((profile) => {
      setCurrentUser(profile);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Load initial server state & connect Socket.io once authenticated
  useEffect(() => {
    if (!currentUser) return;

    fetch('/api/bootstrap')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.servers)) {
          setServers(data.servers);
          if (data.servers.length > 0 && !data.servers.some((s: ServerItem) => s.id === activeServerId)) {
            setActiveServerId(data.servers[0].id);
          }
        }
        if (Array.isArray(data.channels)) setChannels(data.channels);
        if (Array.isArray(data.profiles)) setProfiles(data.profiles);
        if (Array.isArray(data.customEmojis)) setCustomEmojis(data.customEmojis);
        if (data.messagesByChannel) setMessagesByChannel(data.messagesByChannel);
        if (data.activeVoicePeers) setVoiceOccupantsByChannel(data.activeVoicePeers);
      })
      .catch((err) => {
        console.error('Bootstrap fetch error:', err);
      });

    fetchHydratedFriends(currentUser.id)
      .then((list) => setFriends(list))
      .catch((err) => console.warn('Initial friends fetch warning:', err));

    const newSocket = io(window.location.origin, {
      transports: ['websocket', 'polling'],
    });
    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [currentUser?.id]);

  // WebRTC P2P Hook
  const {
    activeVoiceChannelId,
    localStream,
    remotePeers,
    hasVideo,
    isScreenSharing,
    isSpeaking,
    mediaNotice,
    joinVoiceChannel,
    leaveVoiceChannel,
    toggleCamera,
    toggleScreenShare,
  } = useWebRTC({
    socket,
    currentUser: {
      id: currentUser?.id || 'unauthenticated',
      username: currentUser?.username || 'User',
      avatarUrl: currentUser?.avatarUrl || '',
    },
    isMuted,
    isDeafened,
  });

  // Register user and bind Socket.io real-time events
  useEffect(() => {
    if (!socket || !currentUser) return;

    socket.emit('register-user', {
      ...currentUser,
      isMuted,
      isDeafened,
    });

    const handleProfilesUpdated = (updatedProfiles: WapperProfile[]) => {
      setProfiles(updatedProfiles);
      const selfUpdated = updatedProfiles.find((p) => p.id === currentUser.id);
      if (selfUpdated) {
        setCurrentUser((prev) => (prev ? { ...prev, ...selfUpdated } : selfUpdated));
      }
      setInspectedProfile((prev) => {
        if (!prev) return null;
        return updatedProfiles.find((p) => p.id === prev.id) || prev;
      });
    };

    const handleFriendsUpdated = () => {
      fetchHydratedFriends(currentUser.id)
        .then((list) => setFriends(list))
        .catch(() => {});
    };

    const handleChannelHistory = (payload: {
      channelId: string;
      messages: ChatMessageItem[];
    }) => {
      setMessagesByChannel((prev) => ({
        ...prev,
        [payload.channelId]: payload.messages,
      }));
    };

    const handleNewMessage = (msg: ChatMessageItem) => {
      setMessagesByChannel((prev) => {
        const existing = prev[msg.channelId] || [];
        if (existing.some((m) => m.id === msg.id)) return prev;
        return {
          ...prev,
          [msg.channelId]: [...existing, msg],
        };
      });
    };

    const handleTypingSignal = (payload: {
      channelId: string;
      userId: string;
      username: string;
      isTyping: boolean;
    }) => {
      if (payload.userId === currentUser.id) return;
      setTypingByChannel((prev) => {
        const currentList = new Set(prev[payload.channelId] || []);
        if (payload.isTyping) {
          currentList.add(payload.username);
        } else {
          currentList.delete(payload.username);
        }
        return {
          ...prev,
          [payload.channelId]: Array.from(currentList),
        };
      });
    };

    const handleServersUpdated = (payload: {
      servers: ServerItem[];
      channels: ChannelItem[];
    }) => {
      setServers(payload.servers);
      setChannels(payload.channels);
    };

    const handleChannelsUpdated = (updatedChannels: ChannelItem[]) => {
      setChannels(updatedChannels);
    };

    const handleEmojisUpdated = (updatedEmojis: CustomEmojiItem[]) => {
      setCustomEmojis(updatedEmojis);
    };

    const handleVoiceRoomsOverview = (
      overview: Record<string, VoiceChannelOccupant[]>
    ) => {
      setVoiceOccupantsByChannel(overview);
    };

    socket.on('profiles-updated', handleProfilesUpdated);
    socket.on('friends-updated', handleFriendsUpdated);
    socket.on('channel-history', handleChannelHistory);
    socket.on('new-message', handleNewMessage);
    socket.on('typing-signal', handleTypingSignal);
    socket.on('servers-updated', handleServersUpdated);
    socket.on('channels-updated', handleChannelsUpdated);
    socket.on('emojis-updated', handleEmojisUpdated);
    socket.on('voice-rooms-overview', handleVoiceRoomsOverview);

    return () => {
      socket.off('profiles-updated', handleProfilesUpdated);
      socket.off('friends-updated', handleFriendsUpdated);
      socket.off('channel-history', handleChannelHistory);
      socket.off('new-message', handleNewMessage);
      socket.off('typing-signal', handleTypingSignal);
      socket.off('servers-updated', handleServersUpdated);
      socket.off('channels-updated', handleChannelsUpdated);
      socket.off('emojis-updated', handleEmojisUpdated);
      socket.off('voice-rooms-overview', handleVoiceRoomsOverview);
    };
  }, [socket, currentUser, isMuted, isDeafened]);

  // Compute Effective Active Channel or DM Room
  const effectiveChannelId = useMemo(() => {
    if (isDMMode && !isFriendsDashboardActive && activeDMPeerId && currentUser) {
      return getDirectMessageChannelId(currentUser.id, activeDMPeerId);
    }
    return activeChannelId;
  }, [isDMMode, isFriendsDashboardActive, activeDMPeerId, activeChannelId, currentUser]);

  // Emit `join-channel` when switching channels
  useEffect(() => {
    if (!socket || !effectiveChannelId || !currentUser) return;
    socket.emit('join-channel', {
      channelId: effectiveChannelId,
      userId: currentUser.id,
    });
  }, [socket, effectiveChannelId, currentUser?.id]);

  const activeServer = useMemo(
    () => servers.find((s) => s.id === activeServerId) || servers[0],
    [servers, activeServerId]
  );

  const activeChannel = useMemo(
    () => channels.find((c) => c.id === activeChannelId),
    [channels, activeChannelId]
  );

  // Real Accepted Friends as DM Peers
  const dmPeers: WapperProfile[] = useMemo(() => {
    const accepted = filterHydratedFriendsByTab(friends, 'all').map((f) => f.profile);
    if (activeDMPeerId && !accepted.some((p) => p.id === activeDMPeerId)) {
      const found = profiles.find((p) => p.id === activeDMPeerId);
      if (found) return [found, ...accepted];
    }
    return accepted;
  }, [friends, activeDMPeerId, profiles]);

  const activeDMPeer = useMemo(
    () =>
      dmPeers.find((p) => p.id === activeDMPeerId) ||
      profiles.find((p) => p.id === activeDMPeerId) ||
      null,
    [dmPeers, profiles, activeDMPeerId]
  );

  const pendingFriendCount = useMemo(
    () =>
      friends.filter((f) => f.relationshipStatus === 'pending_incoming').length,
    [friends]
  );

  // Navigation Handlers
  const handleSelectHomeFriends = useCallback(() => {
    setIsDMMode(true);
    setIsFriendsDashboardActive(true);
    setIsMobileNavOpen(false);
  }, []);

  const handleSelectServer = useCallback(
    (serverId: string) => {
      setIsDMMode(false);
      setIsFriendsDashboardActive(false);
      setActiveServerId(serverId);
      const firstChannel = channels.find((c) => c.serverId === serverId && c.type === 'text');
      if (firstChannel) {
        setActiveChannelId(firstChannel.id);
      }
    },
    [channels]
  );

  const handleSelectDM = useCallback((peerId: string) => {
    setIsDMMode(true);
    setIsFriendsDashboardActive(false);
    setActiveDMPeerId(peerId);
    setIsMobileNavOpen(false);
  }, []);

  const handleOpenDirectMessageWithProfile = useCallback((peerProfile: WapperProfile) => {
    setIsDMMode(true);
    setIsFriendsDashboardActive(false);
    setActiveDMPeerId(peerProfile.id);
    setIsMobileNavOpen(false);
  }, []);

  const handleSelectChannel = useCallback(
    (channel: ChannelItem) => {
      setIsDMMode(false);
      setIsFriendsDashboardActive(false);
      setActiveChannelId(channel.id);
      setIsMobileNavOpen(false);
      if (channel.type === 'voice' && activeVoiceChannelId !== channel.id) {
        joinVoiceChannel(channel.id);
      }
    },
    [activeVoiceChannelId, joinVoiceChannel]
  );

  const handleCreateServer = useCallback(
    (name: string, description: string) => {
      if (!currentUser) return;
      const serverId = `srv_${Date.now()}`;
      const textChanId = `chan_${Date.now()}_general`;
      const voiceChanId = `chan_${Date.now()}_voice`;

      const newServer: ServerItem = {
        id: serverId,
        name,
        description: description || 'Community server on Wapper PWA.',
        iconUrl: '',
        inviteCode: name.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20),
        ownerId: currentUser.id,
      };

      const initialChannels: ChannelItem[] = [
        {
          id: textChanId,
          serverId,
          name: 'general',
          type: 'text',
          category: 'Text Channels',
          topic: `Welcome to ${name}!`,
        },
        {
          id: voiceChanId,
          serverId,
          name: 'General Voice',
          type: 'voice',
          category: 'Voice & Video P2P',
          topic: 'Direct browser-to-browser P2P voice & screen sharing.',
        },
      ];

      setServers((prev) => [...prev, newServer]);
      setChannels((prev) => [...prev, ...initialChannels]);
      setIsDMMode(false);
      setIsFriendsDashboardActive(false);
      setActiveServerId(serverId);
      setActiveChannelId(textChanId);

      socket?.emit('create-server', { server: newServer, initialChannels });
    },
    [currentUser, socket]
  );

  const handleCreateChannel = useCallback(
    (name: string, type: 'text' | 'voice', category: string) => {
      const newChan: ChannelItem = {
        id: `chan_${Date.now()}`,
        serverId: activeServerId,
        name,
        type,
        category,
        topic:
          type === 'text'
            ? `Real-time #${name} channel`
            : `P2P WebRTC voice & video room for ${name}`,
      };
      setChannels((prev) => [...prev, newChan]);
      setIsDMMode(false);
      setIsFriendsDashboardActive(false);
      setActiveChannelId(newChan.id);
      setIsMobileNavOpen(false);
      socket?.emit('create-channel', newChan);
      if (type === 'voice') {
        joinVoiceChannel(newChan.id);
      }
    },
    [activeServerId, socket, joinVoiceChannel]
  );

  const handleSendMessage = useCallback(
    (payload: {
      content: string;
      gifUrl?: string;
      attachmentUrl?: string;
      attachmentAnalysis?: string;
    }) => {
      if (!currentUser) return;
      const newMsg: ChatMessageItem = {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        channelId: effectiveChannelId,
        serverId: isDMMode ? 'srv_dm' : activeServerId,
        authorId: currentUser.id,
        authorName: currentUser.username,
        authorAvatar: currentUser.avatarUrl,
        authorRoleColor: currentUser.profileThemeColor || '#5865F2',
        content: payload.content,
        gifUrl: payload.gifUrl,
        attachmentUrl: payload.attachmentUrl,
        attachmentAnalysis: payload.attachmentAnalysis,
        createdAt: new Date().toISOString(),
      };

      setMessagesByChannel((prev) => {
        const list = prev[effectiveChannelId] || [];
        if (list.some((m) => m.id === newMsg.id)) return prev;
        return {
          ...prev,
          [effectiveChannelId]: [...list, newMsg],
        };
      });

      socket?.emit('send-message', newMsg);

      persistMessageRecord({
        id: newMsg.id,
        channelId: newMsg.channelId,
        serverId: newMsg.serverId,
        authorId: newMsg.authorId,
        authorName: newMsg.authorName,
        authorAvatar: newMsg.authorAvatar,
        content: newMsg.content,
        gifUrl: newMsg.gifUrl,
        attachmentUrl: newMsg.attachmentUrl,
        attachmentAnalysis: newMsg.attachmentAnalysis,
      }).catch((err) => {
        console.warn('Cloud persistence skipped or failed:', err);
      });
    },
    [effectiveChannelId, isDMMode, activeServerId, currentUser, socket]
  );

  const handleTypingSignal = useCallback(
    (isTyping: boolean) => {
      if (!currentUser) return;
      socket?.emit('typing-signal', {
        channelId: effectiveChannelId,
        userId: currentUser.id,
        username: currentUser.username,
        isTyping,
      });
    },
    [socket, effectiveChannelId, currentUser]
  );

  const handleCreateCustomEmoji = useCallback(
    (name: string, imageUrl: string) => {
      if (!currentUser) return;
      const emoji: CustomEmojiItem = {
        id: `emj_${Date.now()}`,
        serverId: activeServerId,
        name,
        imageUrl,
        creatorId: currentUser.id,
        createdAt: new Date().toISOString(),
      };
      setCustomEmojis((prev) => [...prev, emoji]);
      socket?.emit('create-emoji', emoji);
    },
    [activeServerId, currentUser, socket]
  );

  const handleToggleMute = useCallback(() => {
    if (!currentUser) return;
    setIsMuted((prev) => {
      const next = !prev;
      socket?.emit('user-status-change', {
        userId: currentUser.id,
        isMuted: next,
      });
      return next;
    });
  }, [socket, currentUser]);

  const handleToggleDeafen = useCallback(() => {
    if (!currentUser) return;
    setIsDeafened((prev) => {
      const next = !prev;
      if (next) setIsMuted(true);
      socket?.emit('user-status-change', {
        userId: currentUser.id,
        isDeafened: next,
        ...(next ? { isMuted: true } : {}),
      });
      return next;
    });
  }, [socket, currentUser]);

  const handleChangeStatus = useCallback(
    (status: WapperProfile['status']) => {
      if (!currentUser) return;
      setCurrentUser((prev) => (prev ? { ...prev, status } : null));
      socket?.emit('user-status-change', {
        userId: currentUser.id,
        status,
      });
    },
    [socket, currentUser]
  );

  const handleSaveProfileCustomization = useCallback(
    async (updates: {
      username: string;
      avatarUrl: string;
      bannerUrl: string;
      bannerColor: string;
      bio: string;
      customStatusText: string;
      customStatusEmoji: string;
      profileThemeColor: string;
    }) => {
      if (!currentUser) return;
      const updated = await updateUserProfile(currentUser, updates);
      setCurrentUser(updated);
      socket?.emit('register-user', {
        ...updated,
        isMuted,
        isDeafened,
      });
    },
    [currentUser, socket, isMuted, isDeafened]
  );

  // Social Graph Handlers
  const handleSendFriendRequest = useCallback(
    async (targetTag: string): Promise<string> => {
      if (!currentUser) throw new Error('Please sign in first.');
      const res = await sendFriendRequest(currentUser.id, targetTag);
      setFriends(res.friends);
      return res.message;
    },
    [currentUser]
  );

  const handleAcceptFriendRequest = useCallback(
    async (friendId: string) => {
      if (!currentUser) return;
      const nextFriends = await acceptFriendRequest(currentUser.id, friendId);
      setFriends(nextFriends);
    },
    [currentUser]
  );

  const handleDeclineFriendRequest = useCallback(
    async (friendId: string) => {
      if (!currentUser) return;
      const nextFriends = await declineFriendRequest(currentUser.id, friendId);
      setFriends(nextFriends);
    },
    [currentUser]
  );

  const handleRemoveFriend = useCallback(
    async (friendId: string) => {
      if (!currentUser) return;
      const nextFriends = await removeFriend(currentUser.id, friendId);
      setFriends(nextFriends);
    },
    [currentUser]
  );

  const handleBlockUser = useCallback(
    async (targetIdOrTag: string) => {
      if (!currentUser) return;
      const nextFriends = await blockUser(currentUser.id, targetIdOrTag);
      setFriends(nextFriends);
    },
    [currentUser]
  );

  const handleUnblockUser = useCallback(
    async (targetId: string) => {
      if (!currentUser) return;
      const nextFriends = await unblockUser(currentUser.id, targetId);
      setFriends(nextFriends);
    },
    [currentUser]
  );

  const handleInspectAuthorProfile = useCallback(
    (
      authorId: string,
      fallbackName: string,
      fallbackAvatar: string,
      fallbackColor?: string
    ) => {
      if (currentUser && authorId === currentUser.id) {
        setInspectedProfile(currentUser);
        return;
      }
      const existing = profiles.find((p) => p.id === authorId);
      if (existing) {
        setInspectedProfile(existing);
        return;
      }
      setInspectedProfile({
        id: authorId,
        username: fallbackName,
        discriminator: '0001',
        uniqueTag: `${fallbackName}#0001`,
        avatarUrl: fallbackAvatar || '',
        bannerUrl: '',
        bannerColor: fallbackColor || '#5865F2',
        bio: '',
        customStatusText: '',
        customStatusEmoji: '',
        profileThemeColor: fallbackColor || '#5865F2',
        status: 'online',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    },
    [currentUser, profiles]
  );

  // Merge currentUser into real-time server members directory
  const allServerMembers = useMemo(() => {
    const map = new Map<string, WapperProfile>();
    for (const p of profiles) {
      map.set(p.id, p);
    }
    if (currentUser) {
      map.set(currentUser.id, {
        ...currentUser,
        isMuted,
        isDeafened,
        activeVoiceChannelId,
      });
    }
    return Array.from(map.values());
  }, [profiles, currentUser, isMuted, isDeafened, activeVoiceChannelId]);

  const onlineMembers = allServerMembers.filter((m) => m.status !== 'offline');
  const offlineMembers = allServerMembers.filter((m) => m.status === 'offline');

  const isViewingVoiceChannel =
    !isDMMode && !isFriendsDashboardActive && activeChannel?.type === 'voice';
  const isViewingFriendsDashboard = isDMMode && isFriendsDashboardActive;

  // --- AUTHENTIC GOOGLE OAUTH LOGIN VIEW ---
  if (!currentUser) {
    return (
      <div className="min-h-screen w-screen bg-[#070A10] text-slate-100 flex flex-col">
        <InstallPrompt />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md rounded-2xl bg-[#0E1320] border border-slate-800/90 p-8 shadow-2xl space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-950/60">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">Wapper</h1>
                <p className="text-xs text-slate-400">
                  100% Free Open-Source P2P Voice, Video &amp; Chat PWA
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-base font-semibold text-white">
                Sign in with your Google Account
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Authenticate via Supabase &amp; Firebase Google OAuth to unlock your unique{' '}
                <code className="font-mono text-indigo-300">Username#0000</code> tag, custom profile
                banner &amp; theme, Friends list, and P2P WebRTC rooms.
              </p>
            </div>

            {authError && (
              <div
                role="alert"
                className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-300"
              >
                {authError}
              </div>
            )}

            <div className="space-y-3">
              <button
                type="button"
                disabled={authLoading}
                onClick={async () => {
                  setAuthError('');
                  try {
                    await signInWithGoogle();
                  } catch (err: unknown) {
                    setShowIframeGoogleForm(true);
                    setAuthError(
                      err instanceof Error && !err.message.includes('popup')
                        ? err.message
                        : 'Browser blocked the external OAuth popup inside the preview frame. Continue with your Google identity below:'
                    );
                  }
                }}
                className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 text-sm font-semibold transition-colors cursor-pointer shadow-md"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"
                  />
                </svg>
                <span>Continue with Google OAuth</span>
              </button>

              {!showIframeGoogleForm ? (
                <button
                  type="button"
                  onClick={() => setShowIframeGoogleForm(true)}
                  className="w-full py-2 text-xs text-slate-400 hover:text-indigo-300 transition-colors cursor-pointer"
                >
                  Popup blocked in preview iframe? Sign in with your Google Email directly
                </button>
              ) : (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!googleEmailInput.trim() || !googleNameInput.trim()) {
                      setAuthError('Please enter your Google display name and email.');
                      return;
                    }
                    await signInWithGoogleIdentity({
                      email: googleEmailInput.trim(),
                      displayName: googleNameInput.trim(),
                    });
                  }}
                  className="pt-3 border-t border-slate-800 space-y-3"
                >
                  <div>
                    <label
                      htmlFor="google-name-input"
                      className="block text-xs font-medium text-slate-300 mb-1"
                    >
                      Google Display Name
                    </label>
                    <input
                      id="google-name-input"
                      type="text"
                      value={googleNameInput}
                      onChange={(e) => setGoogleNameInput(e.target.value)}
                      placeholder="e.g. Mayank Raj"
                      maxLength={32}
                      className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="google-email-input"
                      className="block text-xs font-medium text-slate-300 mb-1"
                    >
                      Google Account Email
                    </label>
                    <input
                      id="google-email-input"
                      type="email"
                      value={googleEmailInput}
                      onChange={(e) => setGoogleEmailInput(e.target.value)}
                      placeholder="you@gmail.com"
                      className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors cursor-pointer"
                  >
                    Authenticate Google Session
                  </button>
                </form>
              )}
            </div>

            <div className="pt-4 border-t border-slate-800/80 grid grid-cols-2 gap-3 text-[11px] text-slate-400">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Zero Mock Users</span>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>Direct WebRTC P2P</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-[#0B0F17] text-slate-100">
      {/* Top PWA Standalone Installation Banner */}
      <InstallPrompt />

      {/* Main 4-Column Discord-Style Responsive Workspace */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Mobile Backdrop Overlay */}
        {isMobileNavOpen && (
          <div
            onClick={() => setIsMobileNavOpen(false)}
            className="fixed inset-0 z-30 bg-black/70 backdrop-blur-xs md:hidden"
          />
        )}

        {/* Responsive Navigation Container: Slide-over Drawer on Mobile, Static Columns on Desktop */}
        <div
          className={`${
            isMobileNavOpen
              ? 'fixed inset-y-0 left-0 z-40 flex shadow-2xl'
              : 'hidden md:flex'
          } h-full shrink-0`}
        >
          {/* 1. Leftmost Server Rail */}
          <Sidebar
            servers={servers}
            activeServerId={activeServerId}
            isDMMode={isDMMode}
            isFriendsDashboardActive={isFriendsDashboardActive}
            pendingFriendCount={pendingFriendCount}
            dmPeers={dmPeers}
            activeDMPeerId={activeDMPeer?.id || null}
            onSelectHomeFriends={handleSelectHomeFriends}
            onSelectServer={handleSelectServer}
            onSelectDM={handleSelectDM}
            onCreateServer={handleCreateServer}
            onOpenArchitectureModal={() => setShowArchitectureModal(true)}
          />

          {/* 2. Secondary Channel, Friends & User Profile Sidebar */}
          <ChannelList
            serverName={activeServer?.name || 'Wapper Community'}
            serverDescription={activeServer?.description || ''}
            serverId={activeServerId}
            isDMMode={isDMMode}
            isFriendsDashboardActive={isFriendsDashboardActive}
            pendingFriendCount={pendingFriendCount}
            dmPeers={dmPeers}
            activeDMPeerId={activeDMPeer?.id || null}
            onSelectFriendsDashboard={handleSelectHomeFriends}
            onSelectDM={handleSelectDM}
            channels={channels}
            activeChannelId={activeChannelId}
            activeVoiceChannelId={activeVoiceChannelId}
            voiceOccupantsByChannel={voiceOccupantsByChannel}
            currentUser={currentUser}
            isMuted={isMuted}
            isDeafened={isDeafened}
            hasVideo={hasVideo}
            isScreenSharing={isScreenSharing}
            isSpeaking={isSpeaking}
            onSelectChannel={handleSelectChannel}
            onCreateChannel={handleCreateChannel}
            onToggleMute={handleToggleMute}
            onToggleDeafen={handleToggleDeafen}
            onChangeStatus={handleChangeStatus}
            onOpenProfileSettings={() => setShowProfileSettingsModal(true)}
            onLeaveVoice={leaveVoiceChannel}
            onToggleCamera={toggleCamera}
            onToggleScreenShare={toggleScreenShare}
            onGoogleSignOut={() => {
              signOut().catch(() => {});
            }}
          />

          {/* Mobile Drawer Close Button */}
          {isMobileNavOpen && (
            <button
              type="button"
              onClick={() => setIsMobileNavOpen(false)}
              aria-label="Close Navigation Menu"
              className="md:hidden self-start m-2 p-2 rounded-full bg-slate-900 border border-slate-700 text-slate-200 shadow-lg"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* 3. Central Viewport: Friends Social Dashboard OR P2P Voice/Video Grid OR Real-Time Chat Area */}
        {isViewingFriendsDashboard ? (
          <FriendsDashboard
            currentUser={currentUser}
            friends={friends}
            onlineDirectoryUsers={allServerMembers}
            onSendFriendRequest={handleSendFriendRequest}
            onAcceptFriendRequest={handleAcceptFriendRequest}
            onDeclineFriendRequest={handleDeclineFriendRequest}
            onRemoveFriend={handleRemoveFriend}
            onBlockUser={handleBlockUser}
            onUnblockUser={handleUnblockUser}
            onOpenDirectMessage={handleOpenDirectMessageWithProfile}
            onInspectProfile={(profile) => setInspectedProfile(profile)}
            onOpenMobileNav={() => setIsMobileNavOpen(true)}
          />
        ) : isViewingVoiceChannel && activeChannel ? (
          <VoiceVideoGrid
            channelName={activeChannel.name}
            channelTopic={activeChannel.topic}
            isJoined={activeVoiceChannelId === activeChannel.id}
            localUser={{
              id: currentUser.id,
              username: currentUser.username,
              avatarUrl: currentUser.avatarUrl,
            }}
            localStream={localStream}
            remotePeers={remotePeers}
            roomOccupants={voiceOccupantsByChannel[activeChannel.id] || []}
            isMuted={isMuted}
            isDeafened={isDeafened}
            hasVideo={hasVideo}
            isScreenSharing={isScreenSharing}
            isSpeaking={isSpeaking}
            mediaNotice={mediaNotice}
            onJoinVoice={() => joinVoiceChannel(activeChannel.id)}
            onLeaveVoice={leaveVoiceChannel}
            onToggleMute={handleToggleMute}
            onToggleDeafen={handleToggleDeafen}
            onToggleCamera={toggleCamera}
            onToggleScreenShare={toggleScreenShare}
            onOpenMobileNav={() => setIsMobileNavOpen(true)}
          />
        ) : (
          <ChatArea
            channelId={effectiveChannelId}
            channelName={
              isDMMode
                ? activeDMPeer?.username || 'Direct Message'
                : activeChannel?.name || 'general'
            }
            channelTopic={
              isDMMode
                ? activeDMPeer
                  ? `${activeDMPeer.uniqueTag} · ${
                      activeDMPeer.customStatusEmoji || activeDMPeer.customStatusText
                        ? `${activeDMPeer.customStatusEmoji} ${activeDMPeer.customStatusText}`.trim()
                        : 'Direct P2P Conversation'
                    }`
                  : 'Direct P2P Conversation'
                : activeChannel?.topic || ''
            }
            isDMMode={isDMMode}
            serverId={activeServerId}
            messages={messagesByChannel[effectiveChannelId] || []}
            customEmojis={customEmojis}
            typingUsers={typingByChannel[effectiveChannelId] || []}
            showMemberSidebar={showMemberSidebar}
            onToggleMemberSidebar={() => setShowMemberSidebar((prev) => !prev)}
            onSendMessage={handleSendMessage}
            onTypingSignal={handleTypingSignal}
            onCreateCustomEmoji={handleCreateCustomEmoji}
            onOpenAIStudioModal={() => setShowAIStudioModal(true)}
            onInspectAuthorProfile={handleInspectAuthorProfile}
            onOpenMobileNav={() => setIsMobileNavOpen(true)}
          />
        )}

        {/* 4. Right Server Member List & Presence Directory */}
        {showMemberSidebar && !isViewingVoiceChannel && !isViewingFriendsDashboard && (
          <aside
            aria-label="Server Members"
            className="hidden lg:flex w-60 bg-[#0B0F19] border-l border-slate-800/80 flex-col py-4 px-3 overflow-y-auto select-none shrink-0 space-y-5"
          >
            <div>
              <div className="px-2 mb-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase font-mono tabular-nums">
                Online — {onlineMembers.length}
              </div>
              <div className="space-y-1">
                {onlineMembers.map((member) => {
                  const initials = member.username
                    .split(/\s+/)
                    .map((w) => w[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase();
                  const statusTicker =
                    member.customStatusEmoji || member.customStatusText
                      ? `${member.customStatusEmoji} ${member.customStatusText}`.trim()
                      : `#${member.discriminator}`;

                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => setInspectedProfile(member)}
                      className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-800/60 transition-colors cursor-pointer text-left"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="relative w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden"
                          style={{
                            backgroundColor: member.profileThemeColor || '#5865F2',
                          }}
                        >
                          {member.avatarUrl ? (
                            <img
                              src={member.avatarUrl}
                              alt={member.username}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span>{initials}</span>
                          )}
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-[#0B0F19] ${
                              STATUS_DOT_COLOR[member.status]
                            }`}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="text-xs font-semibold truncate"
                              style={{
                                color: member.profileThemeColor || '#F8FAFC',
                              }}
                            >
                              {member.username}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">
                            {statusTicker}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 text-slate-400 shrink-0">
                        {member.activeVoiceChannelId && (
                          <Radio
                            className="w-3.5 h-3.5 text-emerald-400"
                            title="In P2P Voice Channel"
                          />
                        )}
                        {member.isMuted && <MicOff className="w-3.5 h-3.5 text-rose-400" />}
                        {member.isDeafened && <VolumeX className="w-3.5 h-3.5 text-rose-400" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {offlineMembers.length > 0 && (
              <div>
                <div className="px-2 mb-2 text-[11px] font-semibold tracking-wider text-slate-500 uppercase font-mono tabular-nums">
                  Offline — {offlineMembers.length}
                </div>
                <div className="space-y-1 opacity-60">
                  {offlineMembers.map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => setInspectedProfile(member)}
                      className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-800/40 text-left cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300 shrink-0">
                        {member.username.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-slate-300 truncate">
                          {member.username}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono truncate">
                          #{member.discriminator}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* Profile & Theme Customization Modal */}
      <ProfileSettingsModal
        isOpen={showProfileSettingsModal}
        profile={currentUser}
        onClose={() => setShowProfileSettingsModal(false)}
        onSaveProfile={handleSaveProfileCustomization}
      />

      {/* Interactive Customized Profile Card Overlay (on clicking any author avatar) */}
      <UserProfilePopover
        profile={inspectedProfile}
        currentUserId={currentUser.id}
        isAlreadyFriend={Boolean(
          inspectedProfile &&
            friends.some(
              (f) =>
                f.friendId === inspectedProfile.id && f.relationshipStatus === 'accepted'
            )
        )}
        isBlocked={Boolean(
          inspectedProfile &&
            friends.some(
              (f) =>
                f.friendId === inspectedProfile.id && f.relationshipStatus === 'blocked'
            )
        )}
        onClose={() => setInspectedProfile(null)}
        onOpenEditProfile={() => setShowProfileSettingsModal(true)}
        onSendMessage={handleOpenDirectMessageWithProfile}
        onSendFriendRequest={(uniqueTag) => {
          handleSendFriendRequest(uniqueTag).catch(() => {});
        }}
        onBlockUser={(userId) => {
          handleBlockUser(userId).catch(() => {});
        }}
      />

      {/* Gemini Image Generation/Edit + Photo Understanding Modal */}
      <AIStudioModal
        isOpen={showAIStudioModal}
        channelName={
          isDMMode
            ? activeDMPeer?.username || 'Direct Message'
            : activeChannel?.name || 'general'
        }
        onClose={() => setShowAIStudioModal(false)}
        onPostToChannel={handleSendMessage}
      />

      {/* SQL Schema, PWA Manifest & WebRTC Mesh Inspector Modal */}
      <ArchitectureModal
        isOpen={showArchitectureModal}
        onClose={() => setShowArchitectureModal(false)}
      />
    </div>
  );
}
