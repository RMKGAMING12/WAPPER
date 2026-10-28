/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  collection,
  doc,
  deleteDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import {
  MicOff,
  VolumeX,
  Radio,
  X,
  Layers,
  ShieldCheck,
  Globe,
  CheckCircle2,
  Crown,
} from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { InstallPrompt } from './components/InstallPrompt';
import { Sidebar, ServerItem } from './components/Sidebar';
import { ChannelList, VoiceChannelOccupant } from './components/ChannelList';
import {
  ChatArea,
  ChatMessageItem,
  CustomEmojiItem,
  SharedMiniPlayerState,
} from './components/ChatArea';
import { GifMediaItem } from './components/GifEmojiPicker';
import { ServerSettingsModal } from './components/ServerSettingsModal';
import { ChangelogModal } from './components/ChangelogModal';
import { VoiceVideoGrid } from './components/VoiceVideoGrid';
import { FriendsDashboard } from './components/FriendsDashboard';
import { ProfileSettingsModal } from './components/ProfileSettingsModal';
import { UserProfilePopover } from './components/UserProfilePopover';
import { InviteModal } from './components/InviteModal';
import { AIStudioModal } from './components/AIStudioModal';
import { ArchitectureModal } from './components/ArchitectureModal';
import { RichPresenceCard } from './components/RichPresenceCard';
import { useWebRTC } from './useWebRTC';
import {
  ChannelItem,
  WapperProfile,
  RichPresenceActivity,
  HydratedFriendItem,
  ServerRole,
  MessageReplyMetadata,
  BotEmbedPayload,
  YouTubeBotConfig,
  DEFAULT_SERVER_ROLES,
  filterHydratedFriendsByTab,
  parseInviteInput,
  sanitizeId,
  executeSlashCommand,
  getUserHighestRole,
  hasServerPermission,
  isFounderEmail,
  buildDMConversationId,
  sortMessagesByCreatedAtAsc,
  doesMessageMentionUser,
  parseYouTubePubSubXml,
  buildYouTubePubSubXmlSample,
  buildYouTubeWebhookBotMessage,
} from './utils/chatLogic';
import { playNotificationPing } from './utils/soundNotification';
import {
  listenToAuthChanges,
  signInWithGoogle,
  signInWithGoogleIdentity,
  signOut,
  updateUserProfile,
  subscribeToProfilesDirectory,
} from './authService';
import {
  subscribeToFriends,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  blockUser,
  unblockUser,
} from './socialManager';
import {
  persistMessageRecord,
  updateMessageReactionsInCloud,
  updateMessageContentInCloud,
  deleteMessageFromCloud,
  subscribeToLocalMessageRealtimeBus,
} from './supabaseClient';

const STATUS_DOT_COLOR: Record<WapperProfile['status'], string> = {
  online: 'bg-emerald-500',
  idle: 'bg-amber-400',
  dnd: 'bg-rose-500',
  offline: 'bg-slate-500',
};

const LOCAL_SERVERS_KEY = 'wapper_servers_v2';
const LOCAL_CHANNELS_KEY = 'wapper_channels_v2';
const LOCAL_EMOJIS_KEY = 'wapper_emojis_v2';
const LOCAL_FAVORITE_GIFS_KEY = 'wapper_favorite_gifs_v2';
const LOCAL_MESSAGES_KEY = 'wapper_messages_v2';
const PENDING_INVITE_SESSION_KEY = 'wapper_pending_invite_target';

const DEFAULT_COMMUNITY_SERVER: ServerItem = {
  id: 'srv_wapper_community',
  name: 'Wapper Community',
  description: 'Open-source 100% free P2P WebRTC & Real-Time Chat HQ',
  iconUrl: '',
  inviteCode: 'wapper-hq',
  ownerId: 'system_wapper',
  memberIds: [],
  roles: DEFAULT_SERVER_ROLES,
  memberRoles: {},
  customEmojis: [],
};

const DEFAULT_COMMUNITY_CHANNELS: ChannelItem[] = [
  {
    id: 'chan_announcements',
    serverId: 'srv_wapper_community',
    name: '📢-announcements',
    type: 'text',
    category: 'System & Stream Alerts',
    topic: 'Automatic YouTube Upload & Live Stream Notification Bot (Google PubSubHubbub RSS)',
  },
  {
    id: 'chan_stream_alerts',
    serverId: 'srv_wapper_community',
    name: '🚀-stream-alerts',
    type: 'text',
    category: 'System & Stream Alerts',
    topic: 'Real-time 🔴 GO LIVE ALERT & 🆕 NEW VIDEO UPLOAD notifications from Wapper Bot',
  },
  {
    id: 'chan_general',
    serverId: 'srv_wapper_community',
    name: 'general',
    type: 'text',
    category: 'Text Channels',
    topic: 'General community discussion, /youtube & /live bots, custom emojis & GIFs',
  },
  {
    id: 'chan_webrtc_dev',
    serverId: 'srv_wapper_community',
    name: 'webrtc-engineering',
    type: 'text',
    category: 'Text Channels',
    topic: 'Zero-cost P2P mesh architecture, Google STUN & PWA updates',
  },
  {
    id: 'chan_voice_lounge',
    serverId: 'srv_wapper_community',
    name: 'General Voice Lounge',
    type: 'voice',
    category: 'Voice & Video P2P',
    topic: 'Direct browser-to-browser P2P audio, HD camera & screen share',
  },
];

function getDirectMessageChannelId(userA: string, userB: string): string {
  return buildDMConversationId(userA, userB);
}

function loadInitialServers(): ServerItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_SERVERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ServerItem[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((s) => ({
          ...s,
          roles:
            Array.isArray(s.roles) && s.roles.length > 0
              ? s.roles
              : DEFAULT_SERVER_ROLES,
          memberRoles:
            s.memberRoles && typeof s.memberRoles === 'object' ? s.memberRoles : {},
        }));
      }
    }
  } catch {
    // Ignore storage parse error
  }
  return [DEFAULT_COMMUNITY_SERVER];
}

function loadInitialChannels(): ChannelItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_CHANNELS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ChannelItem[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // Ignore storage parse error
  }
  return DEFAULT_COMMUNITY_CHANNELS;
}

function loadInitialMessages(): Record<string, ChatMessageItem[]> {
  try {
    const raw = localStorage.getItem(LOCAL_MESSAGES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, ChatMessageItem[]>;
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    }
  } catch {
    // Ignore storage parse error
  }
  return {};
}

function loadInitialEmojis(): CustomEmojiItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_EMOJIS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CustomEmojiItem[];
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {
    // Ignore storage parse error
  }
  return [];
}

function loadInitialFavoriteGifs(): GifMediaItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_FAVORITE_GIFS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as GifMediaItem[];
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {
    // Ignore storage parse error
  }
  return [];
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

  // Core Real-Time Entities (Persisted in Firestore + LocalStorage)
  const [servers, setServers] = useState<ServerItem[]>(loadInitialServers);
  const [channels, setChannels] = useState<ChannelItem[]>(loadInitialChannels);
  const [profiles, setProfiles] = useState<WapperProfile[]>([]);
  const [friends, setFriends] = useState<HydratedFriendItem[]>([]);
  const [customEmojis, setCustomEmojis] = useState<CustomEmojiItem[]>(loadInitialEmojis);
  const [favoriteGifs, setFavoriteGifs] = useState<GifMediaItem[]>(
    loadInitialFavoriteGifs
  );
  const [messagesByChannel, setMessagesByChannel] =
    useState<Record<string, ChatMessageItem[]>>(loadInitialMessages);
  const [voiceOccupantsByChannel, setVoiceOccupantsByChannel] = useState<
    Record<string, VoiceChannelOccupant[]>
  >({});

  // Shared Watch Together Mini-Player State
  const [sharedMiniPlayer, setSharedMiniPlayer] =
    useState<SharedMiniPlayerState | null>(null);

  // Navigation State
  const [activeServerId, setActiveServerId] = useState<string>('srv_wapper_community');
  const [activeChannelId, setActiveChannelId] = useState<string>('chan_general');
  const [isDMMode, setIsDMMode] = useState<boolean>(true);
  const [isFriendsDashboardActive, setIsFriendsDashboardActive] = useState<boolean>(true);
  const [activeDMPeerId, setActiveDMPeerId] = useState<string | null>(null);
  const [showMemberSidebar, setShowMemberSidebar] = useState<boolean>(true);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState<boolean>(false);

  // Modals, Popovers & Notifications
  const [showProfileSettingsModal, setShowProfileSettingsModal] = useState<boolean>(false);
  const [showInviteModal, setShowInviteModal] = useState<boolean>(false);
  const [showServerSettingsModal, setShowServerSettingsModal] = useState<boolean>(false);
  const [showChangelogModal, setShowChangelogModal] = useState<boolean>(false);
  const [inspectedProfile, setInspectedProfile] = useState<WapperProfile | null>(null);
  const [showAIStudioModal, setShowAIStudioModal] = useState<boolean>(false);
  const [showArchitectureModal, setShowArchitectureModal] = useState<boolean>(false);
  const [inviteJoinNotice, setInviteJoinNotice] = useState<string | null>(null);

  // Typing Indicators per Channel
  const [typingByChannel, setTypingByChannel] = useState<Record<string, string[]>>({});

  const serversRef = useRef<ServerItem[]>(servers);
  const channelsRef = useRef<ChannelItem[]>(channels);

  useEffect(() => {
    serversRef.current = servers;
    try {
      localStorage.setItem(LOCAL_SERVERS_KEY, JSON.stringify(servers));
    } catch {
      // Ignore quota errors
    }
  }, [servers]);

  useEffect(() => {
    channelsRef.current = channels;
    try {
      localStorage.setItem(LOCAL_CHANNELS_KEY, JSON.stringify(channels));
    } catch {
      // Ignore quota errors
    }
  }, [channels]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_MESSAGES_KEY, JSON.stringify(messagesByChannel));
    } catch {
      // Ignore quota errors
    }
  }, [messagesByChannel]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_EMOJIS_KEY, JSON.stringify(customEmojis));
    } catch {
      // Ignore quota errors
    }
  }, [customEmojis]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_FAVORITE_GIFS_KEY, JSON.stringify(favoriteGifs));
    } catch {
      // Ignore quota errors
    }
  }, [favoriteGifs]);

  // Capture `?invite=SERVER_ID` from URL on initial page load (even before login)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rawInvite = params.get('invite');
    if (rawInvite && rawInvite.trim()) {
      sessionStorage.setItem(PENDING_INVITE_SESSION_KEY, rawInvite.trim());
    }
  }, []);

  // Subscribe to real-time authentication state
  useEffect(() => {
    const unsubscribe = listenToAuthChanges((profile) => {
      setCurrentUser(profile);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Helper to persist a server, its roles/emojis, its channels, and membership to Firestore when signed in
  const syncServerAndMembershipToFirestore = useCallback(
    async (
      server: ServerItem,
      serverChannels: ChannelItem[],
      memberProfile: WapperProfile
    ) => {
      const fbUser = auth.currentUser;
      if (!fbUser || !fbUser.emailVerified) return;

      const cleanServerId = sanitizeId(server.id);
      const serverRef = doc(db, 'servers', cleanServerId);

      try {
        const snap = await getDoc(serverRef);
        if (!snap.exists()) {
          await setDoc(serverRef, {
            id: cleanServerId,
            name: server.name.slice(0, 80),
            description: (
              server.description || 'Community server on Wapper PWA.'
            ).slice(0, 300),
            iconUrl: (server.iconUrl || '').slice(0, 500000),
            inviteCode: (server.inviteCode || cleanServerId).slice(0, 64),
            ownerId: fbUser.uid,
            roles: (server.roles || DEFAULT_SERVER_ROLES).slice(0, 30),
            memberRoles: server.memberRoles || {},
            customEmojis: (server.customEmojis || []).slice(0, 100),
            ...(server.youtubeBotConfig
              ? { youtubeBotConfig: server.youtubeBotConfig }
              : {}),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else if (snap.data()?.ownerId === fbUser.uid) {
          await updateDoc(serverRef, {
            name: server.name.slice(0, 80),
            description: (
              server.description || 'Community server on Wapper PWA.'
            ).slice(0, 300),
            iconUrl: (server.iconUrl || '').slice(0, 500000),
            inviteCode: (server.inviteCode || cleanServerId).slice(0, 64),
            roles: (server.roles || DEFAULT_SERVER_ROLES).slice(0, 30),
            memberRoles: server.memberRoles || {},
            customEmojis: (server.customEmojis || []).slice(0, 100),
            ...(server.youtubeBotConfig
              ? { youtubeBotConfig: server.youtubeBotConfig }
              : {}),
            updatedAt: serverTimestamp(),
          });
        }

        // Record membership in `/servers/{serverId}/members/{userId}`
        const memberRef = doc(db, 'servers', cleanServerId, 'members', fbUser.uid);
        const memberSnap = await getDoc(memberRef);
        if (!memberSnap.exists()) {
          await setDoc(memberRef, {
            id: fbUser.uid,
            serverId: cleanServerId,
            userId: fbUser.uid,
            username: memberProfile.username.slice(0, 32),
            avatarUrl: (memberProfile.avatarUrl || '').slice(0, 500000),
            joinedAt: serverTimestamp(),
          });
        }

        // Ensure default/initial channels exist in `/servers/{serverId}/channels/{channelId}`
        for (const ch of serverChannels) {
          if (ch.serverId !== server.id) continue;
          const cleanChanId = sanitizeId(ch.id);
          const chanRef = doc(db, 'servers', cleanServerId, 'channels', cleanChanId);
          const chanSnap = await getDoc(chanRef);
          if (!chanSnap.exists()) {
            await setDoc(chanRef, {
              id: cleanChanId,
              serverId: cleanServerId,
              name: ch.name.slice(0, 64),
              type: ch.type,
              category: ch.category.slice(0, 48),
              topic: (ch.topic || '').slice(0, 300),
              ownerId: fbUser.uid,
              createdAt: serverTimestamp(),
            });
          }
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `servers/${cleanServerId}`);
      }
    },
    []
  );

  /**
   * Joins a server by invite link, Server ID, or short invite code (`?invite=SERVER_ID` or manual modal),
   * adds the logged-in user to its members list, and switches the active view to that server.
   */
  const handleJoinServerByInvite = useCallback(
    async (
      rawInviteLinkOrCode: string
    ): Promise<{ joined: boolean; serverName?: string; error?: string }> => {
      if (!currentUser) {
        return { joined: false, error: 'Please sign in first to join a server.' };
      }

      const parsed = parseInviteInput(rawInviteLinkOrCode);
      if (!parsed.valid) {
        return { joined: false, error: parsed.error || 'Invalid invite link or code.' };
      }

      const targetKey = parsed.inviteTarget;
      const targetLower = targetKey.toLowerCase();

      // 1. Check currently loaded servers by ID or inviteCode
      let matchedServer = serversRef.current.find(
        (s) =>
          s.id.toLowerCase() === targetLower ||
          (s.inviteCode && s.inviteCode.toLowerCase() === targetLower)
      );

      let matchedChannels: ChannelItem[] = [];

      // 2. If not found locally, query Firestore `/servers` directly by doc ID or `inviteCode`
      if (!matchedServer && auth.currentUser && auth.currentUser.emailVerified) {
        try {
          const directSnap = await getDoc(doc(db, 'servers', sanitizeId(targetKey)));
          if (directSnap.exists()) {
            const d = directSnap.data();
            matchedServer = {
              id: String(d.id || directSnap.id),
              name: String(d.name || 'Invited Wapper Server'),
              description: String(
                d.description || 'Joined via Wapper Server Invite Link'
              ),
              iconUrl: String(d.iconUrl || ''),
              inviteCode: String(d.inviteCode || directSnap.id),
              ownerId: String(d.ownerId || currentUser.id),
              memberIds: [currentUser.id],
              roles: Array.isArray(d.roles) ? (d.roles as ServerRole[]) : DEFAULT_SERVER_ROLES,
              memberRoles:
                d.memberRoles && typeof d.memberRoles === 'object'
                  ? (d.memberRoles as Record<string, string[]>)
                  : {},
            };
          } else {
            const byCodeQ = query(
              collection(db, 'servers'),
              where('inviteCode', '==', targetLower)
            );
            const codeSnap = await getDocs(byCodeQ);
            if (!codeSnap.empty) {
              const docSnap = codeSnap.docs[0];
              const d = docSnap.data();
              matchedServer = {
                id: String(d.id || docSnap.id),
                name: String(d.name || 'Invited Wapper Server'),
                description: String(
                  d.description || 'Joined via Wapper Server Invite Link'
                ),
                iconUrl: String(d.iconUrl || ''),
                inviteCode: String(d.inviteCode || docSnap.id),
                ownerId: String(d.ownerId || currentUser.id),
                memberIds: [currentUser.id],
                roles: Array.isArray(d.roles) ? (d.roles as ServerRole[]) : DEFAULT_SERVER_ROLES,
                memberRoles:
                  d.memberRoles && typeof d.memberRoles === 'object'
                    ? (d.memberRoles as Record<string, string[]>)
                    : {},
              };
            }
          }

          if (matchedServer) {
            const chanSnap = await getDocs(
              collection(db, 'servers', matchedServer.id, 'channels')
            );
            chanSnap.forEach((cDoc) => {
              const cd = cDoc.data();
              matchedChannels.push({
                id: String(cd.id || cDoc.id),
                serverId: matchedServer!.id,
                name: String(cd.name || 'general'),
                type: cd.type === 'voice' ? 'voice' : 'text',
                category: String(cd.category || 'Text Channels'),
                topic: String(cd.topic || ''),
              });
            });
          }
        } catch {
          // Continue to step 3 fallback
        }
      }

      // 3. Hydrate invited server with default #general and General Voice channels if new
      if (!matchedServer) {
        const cleanServerId = sanitizeId(
          targetKey.startsWith('srv_') ? targetKey : `srv_${targetKey}`
        );
        const readableName = targetKey
          .replace(/^srv_/, '')
          .replace(/[-_]+/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase())
          .slice(0, 50);

        matchedServer = {
          id: cleanServerId,
          name: readableName || 'Invited Community Server',
          description: 'Joined via Wapper Shareable Invite Link',
          iconUrl: '',
          inviteCode: targetLower.slice(0, 32),
          ownerId: currentUser.id,
          memberIds: [currentUser.id],
          roles: DEFAULT_SERVER_ROLES,
          memberRoles: {},
        };
      }

      const existingServerChannels = channelsRef.current.filter(
        (c) => c.serverId === matchedServer!.id
      );

      if (existingServerChannels.length === 0 && matchedChannels.length === 0) {
        matchedChannels = [
          {
            id: sanitizeId(`chan_${matchedServer.id}_general`),
            serverId: matchedServer.id,
            name: 'general',
            type: 'text',
            category: 'Text Channels',
            topic: `Welcome to ${matchedServer.name}!`,
          },
          {
            id: sanitizeId(`chan_${matchedServer.id}_voice`),
            serverId: matchedServer.id,
            name: 'General Voice',
            type: 'voice',
            category: 'Voice & Video P2P',
            topic: 'Direct browser-to-browser P2P voice & screen sharing.',
          },
        ];
      }

      const updatedServer: ServerItem = {
        ...matchedServer,
        roles: matchedServer.roles || DEFAULT_SERVER_ROLES,
        memberRoles: matchedServer.memberRoles || {},
        memberIds: Array.from(
          new Set([...(matchedServer.memberIds || []), currentUser.id])
        ),
      };

      setServers((prev) => {
        const exists = prev.some((s) => s.id === updatedServer.id);
        if (exists) {
          return prev.map((s) => (s.id === updatedServer.id ? updatedServer : s));
        }
        return [...prev, updatedServer];
      });

      if (matchedChannels.length > 0) {
        setChannels((prev) => {
          const existingIds = new Set(prev.map((c) => c.id));
          const toAdd = matchedChannels.filter((c) => !existingIds.has(c.id));
          return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
        });
      }

      const allServerChannels = [
        ...existingServerChannels,
        ...matchedChannels,
      ];
      const firstTextChannel =
        allServerChannels.find((c) => c.type === 'text') || allServerChannels[0];

      // Switch active view to the joined server
      setIsDMMode(false);
      setIsFriendsDashboardActive(false);
      setActiveServerId(updatedServer.id);
      if (firstTextChannel) {
        setActiveChannelId(firstTextChannel.id);
      }
      setIsMobileNavOpen(false);
      setInviteJoinNotice(`Joined "${updatedServer.name}" via server invite!`);

      // Sync server & membership to Firestore
      await syncServerAndMembershipToFirestore(
        updatedServer,
        allServerChannels,
        currentUser
      );

      return { joined: true, serverName: updatedServer.name };
    },
    [currentUser, syncServerAndMembershipToFirestore]
  );

  // Auto-Join via `?invite=SERVER_ID` URL Parameter on page load and after login
  useEffect(() => {
    if (!currentUser) return;

    const params = new URLSearchParams(window.location.search);
    const urlInvite = params.get('invite');
    const pendingInvite =
      urlInvite || sessionStorage.getItem(PENDING_INVITE_SESSION_KEY);

    if (!pendingInvite) return;

    sessionStorage.removeItem(PENDING_INVITE_SESSION_KEY);

    // Clean URL using window.history.replaceState (preserving any non-invite path)
    params.delete('invite');
    const remainingSearch = params.toString();
    const cleanUrl = `${window.location.pathname}${
      remainingSearch ? `?${remainingSearch}` : ''
    }${window.location.hash || ''}`;
    window.history.replaceState({}, document.title, cleanUrl);

    handleJoinServerByInvite(pendingInvite).catch((err) => {
      console.warn('Auto-join invite warning:', err);
    });
  }, [currentUser, handleJoinServerByInvite]);

  // Serverless Firestore + Real-Time Subscriptions once authenticated
  useEffect(() => {
    if (!currentUser) return;

    // 1. Subscribe to registered user profiles directory (Firestore + Local Registry)
    const unsubProfiles = subscribeToProfilesDirectory((updatedProfiles) => {
      setProfiles(updatedProfiles);
    });

    // 2. Subscribe to real-time Friends Social Graph (Firestore + Local Registry)
    const unsubFriends = subscribeToFriends(currentUser.id, (updatedFriends) => {
      setFriends(updatedFriends);
    });

    // 3. Sync default/existing servers with Firestore when signed in
    let unsubServers: (() => void) | null = null;
    if (auth.currentUser && auth.currentUser.emailVerified) {
      for (const srv of serversRef.current) {
        const srvChans = channelsRef.current.filter((c) => c.serverId === srv.id);
        syncServerAndMembershipToFirestore(srv, srvChans, currentUser).catch(() => {});
      }

      unsubServers = onSnapshot(
        collection(db, 'servers'),
        (snap) => {
          const remoteServers: ServerItem[] = [];
          snap.forEach((docSnap) => {
            const d = docSnap.data();
            remoteServers.push({
              id: String(d.id || docSnap.id),
              name: String(d.name || 'Wapper Server'),
              description: String(d.description || ''),
              iconUrl: String(d.iconUrl || ''),
              inviteCode: String(d.inviteCode || docSnap.id),
              ownerId: String(d.ownerId || ''),
              roles: Array.isArray(d.roles) ? (d.roles as ServerRole[]) : DEFAULT_SERVER_ROLES,
              memberRoles:
                d.memberRoles && typeof d.memberRoles === 'object'
                  ? (d.memberRoles as Record<string, string[]>)
                  : {},
              ...(d.youtubeBotConfig && typeof d.youtubeBotConfig === 'object'
                ? { youtubeBotConfig: d.youtubeBotConfig as YouTubeBotConfig }
                : {}),
            });
          });
          if (remoteServers.length > 0) {
            setServers((prev) => {
              const map = new Map<string, ServerItem>();
              for (const s of prev) map.set(s.id, s);
              for (const rs of remoteServers) {
                const existing = map.get(rs.id);
                map.set(rs.id, existing ? { ...existing, ...rs } : rs);
              }
              return Array.from(map.values());
            });
          }
        },
        () => {}
      );
    }

    // 4. Optional Socket.io signaling for P2P WebRTC when running with a signaling server
    const newSocket = io(window.location.origin, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 3,
    });
    setSocket(newSocket);

    return () => {
      unsubProfiles();
      unsubFriends();
      unsubServers?.();
      newSocket.disconnect();
    };
  }, [currentUser?.id, syncServerAndMembershipToFirestore]);

  // Real-Time Channels Listener for the active server
  useEffect(() => {
    if (
      !activeServerId ||
      isDMMode ||
      !auth.currentUser ||
      !auth.currentUser.emailVerified
    ) {
      return;
    }
    const cleanServerId = sanitizeId(activeServerId);
    const channelsColRef = collection(db, 'servers', cleanServerId, 'channels');
    const unsubChannels = onSnapshot(
      channelsColRef,
      (snap) => {
        if (snap.empty) return;
        const remoteChannels: ChannelItem[] = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data();
          remoteChannels.push({
            id: String(d.id || docSnap.id),
            serverId: cleanServerId,
            name: String(d.name || 'channel'),
            type: d.type === 'voice' ? 'voice' : 'text',
            category: String(d.category || 'Text Channels'),
            topic: d.topic ? String(d.topic) : '',
          });
        });

        setChannels((prev) => {
          const otherServerChannels = prev.filter(
            (c) => c.serverId !== cleanServerId
          );
          return [...otherServerChannels, ...remoteChannels];
        });
      },
      (err) => {
        console.warn('[App] Realtime channels snapshot notice:', err);
      }
    );

    return () => unsubChannels();
  }, [activeServerId, isDMMode]);

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
      setProfiles((prev) => {
        const map = new Map<string, WapperProfile>();
        for (const p of prev) map.set(p.id, p);
        for (const up of updatedProfiles) map.set(up.id, up);
        return Array.from(map.values());
      });
    };

    const handleChannelHistory = (payload: {
      channelId: string;
      messages: ChatMessageItem[];
    }) => {
      if (!Array.isArray(payload.messages) || payload.messages.length === 0) return;
      setMessagesByChannel((prev) => {
        const existing = prev[payload.channelId] || [];
        const map = new Map<string, ChatMessageItem>();
        for (const m of existing) map.set(m.id, m);
        for (const m of payload.messages) map.set(m.id, m);
        return {
          ...prev,
          [payload.channelId]: Array.from(map.values()),
        };
      });
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

    const handleVoiceRoomsOverview = (
      overview: Record<string, VoiceChannelOccupant[]>
    ) => {
      setVoiceOccupantsByChannel(overview);
    };

    socket.on('profiles-updated', handleProfilesUpdated);
    socket.on('channel-history', handleChannelHistory);
    socket.on('new-message', handleNewMessage);
    socket.on('typing-signal', handleTypingSignal);
    socket.on('voice-rooms-overview', handleVoiceRoomsOverview);

    return () => {
      socket.off('profiles-updated', handleProfilesUpdated);
      socket.off('channel-history', handleChannelHistory);
      socket.off('new-message', handleNewMessage);
      socket.off('typing-signal', handleTypingSignal);
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

  // Notify Socket.io when switching active channel or DM room
  useEffect(() => {
    if (!currentUser || !effectiveChannelId) return;
    socket?.emit('join-channel', {
      channelId: effectiveChannelId,
      userId: currentUser.id,
    });
  }, [socket, effectiveChannelId, currentUser?.id]);

  // Global Real-Time Notification Sound Listener for DMs & Mentions when viewing a different tab or view
  useEffect(() => {
    if (!currentUser) return;
    const seenGlobalIds = new Set<string>();
    let initializedFirestoreDMs = false;

    const unsubscribeBus = subscribeToLocalMessageRealtimeBus((event) => {
      if (event.type !== 'UPSERT_MESSAGE') return;
      const m = event.message;
      if (seenGlobalIds.has(m.id)) return;
      seenGlobalIds.add(m.id);

      const isMention = doesMessageMentionUser(
        m.content,
        currentUser.username,
        currentUser.uniqueTag
      );
      const isIncomingDM =
        Boolean(m.receiverId && sanitizeId(m.receiverId) === sanitizeId(currentUser.id)) &&
        sanitizeId(m.authorId) !== sanitizeId(currentUser.id);
      const isLookingAtDifferentTab =
        (typeof document !== 'undefined' && document.hidden) ||
        isFriendsDashboardActive ||
        sanitizeId(m.channelId) !== sanitizeId(effectiveChannelId);

      if (isMention) {
        playNotificationPing('mention');
      } else if (isIncomingDM && isLookingAtDifferentTab) {
        playNotificationPing('dm');
      }
    });

    let unsubFirestoreIncomingDMs: (() => void) | null = null;
    if (auth.currentUser && auth.currentUser.emailVerified) {
      const authUid = sanitizeId(auth.currentUser.uid);
      const incomingDMQuery = query(
        collection(db, 'direct_messages'),
        where('receiverId', '==', authUid)
      );
      unsubFirestoreIncomingDMs = onSnapshot(
        incomingDMQuery,
        (snap) => {
          if (!initializedFirestoreDMs) {
            snap.forEach((d) => seenGlobalIds.add(d.id));
            initializedFirestoreDMs = true;
            return;
          }
          snap.docChanges().forEach((change) => {
            if (change.type !== 'added') return;
            const docId = change.doc.id;
            if (seenGlobalIds.has(docId)) return;
            seenGlobalIds.add(docId);

            const data = change.doc.data();
            const senderId = String(data.senderId || data.authorId || '');
            if (sanitizeId(senderId) === authUid) return;

            const content = String(data.content || '');
            const channelOrConvId = String(
              data.conversationId || data.channelId || ''
            );
            const isLookingAtDifferentTab =
              (typeof document !== 'undefined' && document.hidden) ||
              isFriendsDashboardActive ||
              sanitizeId(channelOrConvId) !== sanitizeId(effectiveChannelId);

            if (
              doesMessageMentionUser(
                content,
                currentUser.username,
                currentUser.uniqueTag
              )
            ) {
              playNotificationPing('mention');
            } else if (isLookingAtDifferentTab) {
              playNotificationPing('dm');
            }
          });
        },
        () => {}
      );
    }

    return () => {
      unsubscribeBus();
      if (unsubFirestoreIncomingDMs) unsubFirestoreIncomingDMs();
    };
  }, [currentUser, effectiveChannelId, isFriendsDashboardActive]);

  // Synchronize real-time messages streamed by ChatArea's Firestore `onSnapshot` listeners
  const handleRealtimeMessagesSync = useCallback(
    (targetChannelId: string, syncedMessages: ChatMessageItem[]) => {
      setMessagesByChannel((prev) => {
        const existing = prev[targetChannelId] || [];
        const merged = sortMessagesByCreatedAtAsc([
          ...existing,
          ...syncedMessages,
        ]);
        if (
          existing.length === merged.length &&
          existing.every(
            (m, idx) =>
              m.id === merged[idx]?.id &&
              m.content === merged[idx]?.content &&
              JSON.stringify(m.reactions || {}) ===
                JSON.stringify(merged[idx]?.reactions || {})
          )
        ) {
          return prev;
        }
        return {
          ...prev,
          [targetChannelId]: merged,
        };
      });
    },
    []
  );

  const activeServer = useMemo(
    () => servers.find((s) => s.id === activeServerId) || servers[0],
    [servers, activeServerId]
  );

  const activeServerRoles = useMemo(
    () => activeServer?.roles || DEFAULT_SERVER_ROLES,
    [activeServer]
  );

  const activeServerMemberRoles = useMemo(
    () => activeServer?.memberRoles || {},
    [activeServer]
  );

  const activeChannel = useMemo(
    () => channels.find((c) => c.id === activeChannelId),
    [channels, activeChannelId]
  );

  // Evaluate Current User Permissions on the Active Server
  const currentUserRoleIds = useMemo(
    () => (currentUser ? activeServerMemberRoles[currentUser.id] || [] : []),
    [currentUser, activeServerMemberRoles]
  );

  const currentUserHighestRole = useMemo(
    () => getUserHighestRole(activeServerRoles, currentUserRoleIds),
    [activeServerRoles, currentUserRoleIds]
  );

  const canManageChannels = useMemo(
    () =>
      hasServerPermission({
        serverOwnerId: activeServer?.ownerId || 'system_wapper',
        user: currentUser,
        roles: activeServerRoles,
        memberRoleIds: currentUserRoleIds,
        permission: 'MANAGE_CHANNELS',
      }) || activeServer?.ownerId === 'system_wapper',
    [activeServer, currentUser, activeServerRoles, currentUserRoleIds]
  );

  const canManageRoles = useMemo(
    () =>
      hasServerPermission({
        serverOwnerId: activeServer?.ownerId || 'system_wapper',
        user: currentUser,
        roles: activeServerRoles,
        memberRoleIds: currentUserRoleIds,
        permission: 'MANAGE_ROLES',
      }) || activeServer?.ownerId === 'system_wapper',
    [activeServer, currentUser, activeServerRoles, currentUserRoleIds]
  );

  const canManageEmojis = useMemo(
    () =>
      hasServerPermission({
        serverOwnerId: activeServer?.ownerId || 'system_wapper',
        user: currentUser,
        roles: activeServerRoles,
        memberRoleIds: currentUserRoleIds,
        permission: 'MANAGE_EMOJIS',
      }) || activeServer?.ownerId === 'system_wapper',
    [activeServer, currentUser, activeServerRoles, currentUserRoleIds]
  );

  const canDeleteMessages = useMemo(
    () =>
      hasServerPermission({
        serverOwnerId: activeServer?.ownerId || 'system_wapper',
        user: currentUser,
        roles: activeServerRoles,
        memberRoleIds: currentUserRoleIds,
        permission: 'DELETE_MESSAGES',
      }) || activeServer?.ownerId === 'system_wapper',
    [activeServer, currentUser, activeServerRoles, currentUserRoleIds]
  );

  const canKickMembers = useMemo(
    () =>
      hasServerPermission({
        serverOwnerId: activeServer?.ownerId || 'system_wapper',
        user: currentUser,
        roles: activeServerRoles,
        memberRoleIds: currentUserRoleIds,
        permission: 'KICK_MEMBERS',
      }) || activeServer?.ownerId === 'system_wapper',
    [activeServer, currentUser, activeServerRoles, currentUserRoleIds]
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
      const firstChannel = channels.find(
        (c) => c.serverId === serverId && c.type === 'text'
      );
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

  const handleOpenDirectMessageWithProfile = useCallback(
    (peerProfile: WapperProfile) => {
      setIsDMMode(true);
      setIsFriendsDashboardActive(false);
      setActiveDMPeerId(peerProfile.id);
      setIsMobileNavOpen(false);
    },
    []
  );

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
        inviteCode:
          name
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 20) || serverId,
        ownerId: currentUser.id,
        memberIds: [currentUser.id],
        roles: DEFAULT_SERVER_ROLES,
        memberRoles: {
          [currentUser.id]: ['role_founder_admin'],
        },
        customEmojis: [],
      };

      const announcementsChanId = `chan_${Date.now()}_announcements`;
      const initialChannels: ChannelItem[] = [
        {
          id: announcementsChanId,
          serverId,
          name: '📢-announcements',
          type: 'text',
          category: 'System & Stream Alerts',
          topic: 'Automatic YouTube Upload & Live Stream Notification Bot (Google PubSubHubbub RSS)',
        },
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
      syncServerAndMembershipToFirestore(
        newServer,
        initialChannels,
        currentUser
      ).catch(() => {});
    },
    [currentUser, socket, syncServerAndMembershipToFirestore]
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

      if (currentUser && activeServer) {
        syncServerAndMembershipToFirestore(
          activeServer,
          [newChan],
          currentUser
        ).catch(() => {});
      }

      if (type === 'voice') {
        joinVoiceChannel(newChan.id);
      }
    },
    [
      activeServerId,
      activeServer,
      currentUser,
      socket,
      joinVoiceChannel,
      syncServerAndMembershipToFirestore,
    ]
  );

  const handleUpdateChannel = useCallback(
    async (
      channelId: string,
      updates: { name: string; topic: string; category?: string }
    ) => {
      setChannels((prev) =>
        prev.map((c) =>
          c.id === channelId
            ? {
                ...c,
                name: updates.name,
                topic: updates.topic,
                category: updates.category || c.category,
              }
            : c
        )
      );
      if (
        activeServer &&
        currentUser &&
        auth.currentUser &&
        auth.currentUser.emailVerified
      ) {
        try {
          const cleanServerId = sanitizeId(activeServerId);
          const cleanChanId = sanitizeId(channelId);
          await updateDoc(
            doc(db, 'servers', cleanServerId, 'channels', cleanChanId),
            {
              name: updates.name.slice(0, 64),
              topic: (updates.topic || '').slice(0, 300),
              ...(updates.category
                ? { category: updates.category.slice(0, 48) }
                : {}),
            }
          );
        } catch (err) {
          console.error('[App] Failed to update channel in Firestore:', err);
        }
      }
    },
    [activeServer, activeServerId, currentUser]
  );

  const handleDeleteChannel = useCallback(
    async (channelId: string) => {
      setChannels((prev) => prev.filter((c) => c.id !== channelId));
      setMessagesByChannel((prev) => {
        const next = { ...prev };
        delete next[channelId];
        return next;
      });
      if (activeChannelId === channelId) {
        const remaining = channelsRef.current.filter(
          (c) => c.serverId === activeServerId && c.id !== channelId
        );
        if (remaining[0]) {
          setActiveChannelId(remaining[0].id);
        }
      }
      if (
        activeServer &&
        currentUser &&
        auth.currentUser &&
        auth.currentUser.emailVerified
      ) {
        try {
          const cleanServerId = sanitizeId(activeServerId);
          const cleanChanId = sanitizeId(channelId);
          await deleteDoc(
            doc(db, 'servers', cleanServerId, 'channels', cleanChanId)
          );
        } catch (err) {
          console.error('[App] Failed to delete channel from Firestore:', err);
        }
      }
    },
    [activeChannelId, activeServer, activeServerId, currentUser]
  );

  const handleDeleteServer = useCallback(
    async (serverId: string) => {
      const removedChannelIds = new Set(
        channelsRef.current
          .filter((c) => c.serverId === serverId)
          .map((c) => c.id)
      );

      setServers((prev) => prev.filter((s) => s.id !== serverId));
      setChannels((prev) => prev.filter((c) => c.serverId !== serverId));
      setMessagesByChannel((prev) => {
        const next = { ...prev };
        for (const chId of Array.from(removedChannelIds)) {
          delete next[chId];
        }
        return next;
      });

      if (activeServerId === serverId) {
        const remainingServers = serversRef.current.filter(
          (s) => s.id !== serverId
        );
        if (remainingServers.length > 0) {
          const next = remainingServers[0];
          setActiveServerId(next.id);
          const srvChans = channelsRef.current.filter(
            (c) => c.serverId === next.id
          );
          if (srvChans[0]) {
            setActiveChannelId(srvChans[0].id);
          }
          setIsDMMode(false);
          setIsFriendsDashboardActive(false);
        } else {
          setIsDMMode(true);
          setIsFriendsDashboardActive(true);
        }
      }

      if (auth.currentUser && auth.currentUser.emailVerified) {
        try {
          const cleanServerId = sanitizeId(serverId);
          await deleteDoc(doc(db, 'servers', cleanServerId));
        } catch (err) {
          console.error('[App] Failed to delete server from Firestore:', err);
        }
      }
    },
    [activeServerId]
  );

  // Send Message OR Execute Built-in Wapper Slash Command (`/youtube`, `/live`, `/poll`, `/8ball`, `/roll`)
  const handleSendMessage = useCallback(
    (payload: {
      content: string;
      gifUrl?: string;
      attachmentUrl?: string;
      attachmentAnalysis?: string;
      replyTo?: MessageReplyMetadata;
    }) => {
      if (!currentUser) return;

      const slashOutcome = executeSlashCommand(payload.content, {
        id: currentUser.id,
        username: currentUser.username,
      });

      const effectiveRoleColor =
        currentUserHighestRole?.color ||
        currentUser.profileThemeColor ||
        '#5865F2';

      const dmReceiverId =
        isDMMode && activeDMPeerId ? activeDMPeerId : undefined;
      const dmConversationId =
        isDMMode && dmReceiverId
          ? buildDMConversationId(currentUser.id, dmReceiverId)
          : undefined;

      if (slashOutcome.isSlashCommand && !slashOutcome.error && slashOutcome.botEmbed) {
        const botMsg: ChatMessageItem = {
          id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          channelId: effectiveChannelId,
          serverId: isDMMode ? 'srv_dm' : activeServerId,
          conversationId: dmConversationId,
          senderId: currentUser.id,
          receiverId: dmReceiverId,
          authorId: currentUser.id,
          authorName: slashOutcome.botName || 'Wapper Bot',
          authorAvatar: '',
          authorRoleColor: slashOutcome.botRoleColor || '#5865F2',
          content: slashOutcome.content || payload.content,
          replyTo: payload.replyTo,
          reactions: slashOutcome.initialReactions || {},
          isBot: true,
          botName: slashOutcome.botName || 'Wapper Bot',
          botEmbed: slashOutcome.botEmbed,
          createdAt: new Date().toISOString(),
        };

        setMessagesByChannel((prev) => {
          const list = prev[effectiveChannelId] || [];
          return {
            ...prev,
            [effectiveChannelId]: sortMessagesByCreatedAtAsc([...list, botMsg]),
          };
        });

        socket?.emit('send-message', botMsg);

        persistMessageRecord({
          id: botMsg.id,
          channelId: botMsg.channelId,
          serverId: botMsg.serverId,
          conversationId: botMsg.conversationId,
          senderId: botMsg.senderId,
          receiverId: botMsg.receiverId,
          authorId: botMsg.authorId,
          authorName: botMsg.authorName,
          authorRoleColor: botMsg.authorRoleColor,
          content: botMsg.content,
          replyTo: botMsg.replyTo,
          reactions: botMsg.reactions,
          isBot: true,
          botName: botMsg.botName,
          botEmbed: botMsg.botEmbed,
          createdAt: botMsg.createdAt,
        }).catch(() => {});

        // If `/live` was triggered, update the user's status badge to `🔴 LIVE`
        if (slashOutcome.liveStatusUpdate) {
          updateUserProfile(currentUser, {
            isLive: true,
            liveStreamUrl: slashOutcome.liveStatusUpdate.liveStreamUrl,
            liveStreamTitle: slashOutcome.liveStatusUpdate.liveStreamTitle,
          })
            .then((updated) => setCurrentUser(updated))
            .catch(() => {});
        }
        return;
      }

      const newMsg: ChatMessageItem = {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        channelId: effectiveChannelId,
        serverId: isDMMode ? 'srv_dm' : activeServerId,
        conversationId: dmConversationId,
        senderId: currentUser.id,
        receiverId: dmReceiverId,
        authorId: currentUser.id,
        authorName: currentUser.username,
        authorAvatar: currentUser.avatarUrl,
        authorEmail: currentUser.email,
        authorRoleColor: effectiveRoleColor,
        authorIsLive: currentUser.isLive,
        content: payload.content,
        gifUrl: payload.gifUrl,
        attachmentUrl: payload.attachmentUrl,
        attachmentAnalysis: payload.attachmentAnalysis,
        replyTo: payload.replyTo,
        reactions: {},
        createdAt: new Date().toISOString(),
      };

      setMessagesByChannel((prev) => {
        const list = prev[effectiveChannelId] || [];
        if (list.some((m) => m.id === newMsg.id)) return prev;
        return {
          ...prev,
          [effectiveChannelId]: sortMessagesByCreatedAtAsc([...list, newMsg]),
        };
      });

      socket?.emit('send-message', newMsg);

      persistMessageRecord({
        id: newMsg.id,
        channelId: newMsg.channelId,
        serverId: newMsg.serverId,
        conversationId: newMsg.conversationId,
        senderId: newMsg.senderId,
        receiverId: newMsg.receiverId,
        authorId: newMsg.authorId,
        authorName: newMsg.authorName,
        authorAvatar: newMsg.authorAvatar,
        authorEmail: newMsg.authorEmail,
        authorRoleColor: newMsg.authorRoleColor,
        authorIsLive: newMsg.authorIsLive,
        content: newMsg.content,
        gifUrl: newMsg.gifUrl,
        attachmentUrl: newMsg.attachmentUrl,
        attachmentAnalysis: newMsg.attachmentAnalysis,
        replyTo: newMsg.replyTo,
        createdAt: newMsg.createdAt,
      }).catch(() => {});
    },
    [
      effectiveChannelId,
      isDMMode,
      activeDMPeerId,
      activeServerId,
      currentUser,
      currentUserHighestRole,
      socket,
    ]
  );

  // Toggle Real-Time Reaction on a Message
  const handleToggleReaction = useCallback(
    (messageId: string, reactionKey: string) => {
      if (!currentUser) return;

      let updatedReactionsForCloud: Record<string, string[]> | null = null;

      setMessagesByChannel((prev) => {
        const list = prev[effectiveChannelId] || [];
        const nextList = list.map((msg) => {
          if (msg.id !== messageId) return msg;
          const currentMap = { ...(msg.reactions || {}) };
          const currentUsers = currentMap[reactionKey] || [];
          const hasReacted = currentUsers.includes(currentUser.id);
          const nextUsers = hasReacted
            ? currentUsers.filter((uid) => uid !== currentUser.id)
            : [...currentUsers, currentUser.id];

          if (nextUsers.length === 0) {
            delete currentMap[reactionKey];
          } else {
            currentMap[reactionKey] = nextUsers;
          }
          updatedReactionsForCloud = currentMap;
          return {
            ...msg,
            reactions: currentMap,
          };
        });
        return {
          ...prev,
          [effectiveChannelId]: nextList,
        };
      });

      if (updatedReactionsForCloud) {
        updateMessageReactionsInCloud({
          serverId: isDMMode ? 'srv_dm' : activeServerId,
          channelId: effectiveChannelId,
          messageId,
          reactions: updatedReactionsForCloud,
          isDMMode,
        }).catch(() => {});
      }
    },
    [currentUser, effectiveChannelId, isDMMode, activeServerId]
  );

  // Edit Message Content
  const handleEditMessage = useCallback(
    (messageId: string, newContent: string) => {
      if (!currentUser) return;
      setMessagesByChannel((prev) => {
        const list = prev[effectiveChannelId] || [];
        return {
          ...prev,
          [effectiveChannelId]: list.map((m) =>
            m.id === messageId
              ? { ...m, content: newContent.slice(0, 4000), isEdited: true }
              : m
          ),
        };
      });

      updateMessageContentInCloud({
        serverId: isDMMode ? 'srv_dm' : activeServerId,
        channelId: effectiveChannelId,
        messageId,
        content: newContent,
        isDMMode,
      }).catch(() => {});
    },
    [currentUser, effectiveChannelId, isDMMode, activeServerId]
  );

  // Delete Message
  const handleDeleteMessage = useCallback(
    (messageId: string) => {
      if (!currentUser) return;
      setMessagesByChannel((prev) => {
        const list = prev[effectiveChannelId] || [];
        return {
          ...prev,
          [effectiveChannelId]: list.filter((m) => m.id !== messageId),
        };
      });

      deleteMessageFromCloud({
        serverId: isDMMode ? 'srv_dm' : activeServerId,
        channelId: effectiveChannelId,
        messageId,
        isDMMode,
      }).catch(() => {});
    },
    [currentUser, effectiveChannelId, isDMMode, activeServerId]
  );

  // Toggle Starred / Favorite GIF
  const handleToggleFavoriteGif = useCallback((gif: GifMediaItem) => {
    setFavoriteGifs((prev) => {
      const exists = prev.some((item) => item.url === gif.url);
      if (exists) {
        return prev.filter((item) => item.url !== gif.url);
      }
      return [gif, ...prev];
    });
  }, []);

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

  const handleDeleteCustomEmoji = useCallback((emojiId: string) => {
    setCustomEmojis((prev) => prev.filter((e) => e.id !== emojiId));
  }, []);

  // Server Roles & Member Roles Management Handlers
  const handleUpdateServerRoles = useCallback(
    (nextRoles: ServerRole[]) => {
      if (!activeServer || !currentUser) return;
      const updatedServer: ServerItem = {
        ...activeServer,
        roles: nextRoles,
      };
      setServers((prev) =>
        prev.map((s) => (s.id === updatedServer.id ? updatedServer : s))
      );
      const srvChans = channelsRef.current.filter(
        (c) => c.serverId === updatedServer.id
      );
      syncServerAndMembershipToFirestore(
        updatedServer,
        srvChans,
        currentUser
      ).catch(() => {});
    },
    [activeServer, currentUser, syncServerAndMembershipToFirestore]
  );

  const handleUpdateMemberRoles = useCallback(
    (userId: string, nextRoleIds: string[]) => {
      if (!activeServer || !currentUser) return;
      const nextMemberRoles = {
        ...(activeServer.memberRoles || {}),
        [userId]: nextRoleIds,
      };
      const updatedServer: ServerItem = {
        ...activeServer,
        memberRoles: nextMemberRoles,
      };
      setServers((prev) =>
        prev.map((s) => (s.id === updatedServer.id ? updatedServer : s))
      );
      const srvChans = channelsRef.current.filter(
        (c) => c.serverId === updatedServer.id
      );
      syncServerAndMembershipToFirestore(
        updatedServer,
        srvChans,
        currentUser
      ).catch(() => {});
    },
    [activeServer, currentUser, syncServerAndMembershipToFirestore]
  );

  const handleKickServerMember = useCallback(
    (targetUserId: string) => {
      if (!activeServer) return;
      setProfiles((prev) => prev.filter((p) => p.id !== targetUserId));
      setServers((prev) =>
        prev.map((s) =>
          s.id === activeServer.id
            ? {
                ...s,
                memberIds: (s.memberIds || []).filter((id) => id !== targetUserId),
              }
            : s
        )
      );
    },
    [activeServer]
  );

  // Connect YouTube Upload & Live Stream Notification Bot (Google PubSubHubbub RSS Webhook)
  const handleConnectYouTubeBot = useCallback(
    async (
      config: YouTubeBotConfig,
      alertType: 'live' | 'upload' = 'live',
      customXmlPayload?: string
    ) => {
      if (!activeServer || !currentUser) return;

      const updatedServer: ServerItem = {
        ...activeServer,
        youtubeBotConfig: config,
      };

      setServers((prev) =>
        prev.map((s) => (s.id === updatedServer.id ? updatedServer : s))
      );

      const srvChans = channelsRef.current.filter(
        (c) => c.serverId === updatedServer.id
      );
      await syncServerAndMembershipToFirestore(
        updatedServer,
        srvChans,
        currentUser
      ).catch(() => {});

      // Parse incoming PubSubHubbub Atom XML payload or build a sample entry
      const xmlToParse =
        customXmlPayload ||
        buildYouTubePubSubXmlSample({
          videoId: 'jfKfPfyJRdk',
          channelId: config.channelId,
          channelName: config.channelName,
          title:
            alertType === 'live'
              ? `${config.channelName} is LIVE on Wapper!`
              : `New Video Upload from ${config.channelName}`,
          isLiveStream: alertType === 'live',
        });

      const parsedEntry = parseYouTubePubSubXml(xmlToParse) || {
        videoId: 'jfKfPfyJRdk',
        channelId: config.channelId,
        channelName: config.channelName,
        title:
          alertType === 'live'
            ? `${config.channelName} is LIVE on Wapper!`
            : `New Video Upload from ${config.channelName}`,
        videoUrl: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
        publishedAt: new Date().toISOString(),
        isLiveStream: alertType === 'live',
      };

      const targetChannelId = config.targetChannelId || 'chan_announcements';
      const botPayload = buildYouTubeWebhookBotMessage(parsedEntry, {
        serverId: updatedServer.id,
        channelId: targetChannelId,
        authorId: currentUser.id,
      });

      const botMsg: ChatMessageItem = {
        ...botPayload,
        reactions: {},
      };

      setMessagesByChannel((prev) => {
        const list = prev[targetChannelId] || [];
        return {
          ...prev,
          [targetChannelId]: sortMessagesByCreatedAtAsc([...list, botMsg]),
        };
      });

      socket?.emit('send-message', botMsg);

      // Also notify the backend PubSubHubbub webhook listener endpoint
      fetch('/api/webhooks/youtube-pubsub', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/atom+xml; charset=utf-8',
          'x-wapper-server-id': updatedServer.id,
          'x-wapper-channel-id': targetChannelId,
        },
        body: xmlToParse,
      }).catch(() => {});

      persistMessageRecord({
        id: botMsg.id,
        channelId: botMsg.channelId,
        serverId: botMsg.serverId,
        authorId: botMsg.authorId,
        authorName: botMsg.authorName,
        authorRoleColor: botMsg.authorRoleColor,
        content: botMsg.content,
        isBot: true,
        botName: botMsg.botName,
        botEmbed: botMsg.botEmbed,
        createdAt: botMsg.createdAt,
      }).catch(() => {});

      // Switch to the target announcements channel so the rich embed alert is visible immediately
      setIsDMMode(false);
      setIsFriendsDashboardActive(false);
      setActiveChannelId(targetChannelId);
    },
    [activeServer, currentUser, socket, syncServerAndMembershipToFirestore]
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
      updateUserProfile(currentUser, { status })
        .then((updated) => setCurrentUser(updated))
        .catch(() => {
          setCurrentUser((prev) => (prev ? { ...prev, status } : null));
        });
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
      richPresence?: RichPresenceActivity;
    }) => {
      if (!currentUser) return;
      const updated = await updateUserProfile(currentUser, updates);
      setCurrentUser(updated);
      setInspectedProfile((prev) =>
        prev && prev.id === updated.id ? updated : prev
      );
      socket?.emit('register-user', {
        ...updated,
        isMuted,
        isDeafened,
      });
    },
    [currentUser, socket, isMuted, isDeafened]
  );

  // Social Graph Handlers (100% Serverless Firestore + Local Registry)
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
      fallbackColor?: string,
      fallbackEmail?: string
    ) => {
      if (currentUser && authorId === currentUser.id) {
        setInspectedProfile(currentUser);
        return;
      }
      const existing = profiles.find((p) => p.id === authorId);
      if (existing) {
        setInspectedProfile({
          ...existing,
          email: existing.email || fallbackEmail,
        });
        return;
      }
      setInspectedProfile({
        id: authorId,
        username: fallbackName,
        discriminator: '0001',
        uniqueTag: `${fallbackName}#0001`,
        email: fallbackEmail,
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

  const isCurrentUserFounder = useMemo(() => {
    return isFounderEmail(currentUser?.email || auth.currentUser?.email);
  }, [currentUser?.email]);

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
                <span>Serverless Firestore Sync</span>
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

      {/* Server Invite Joined Notification Banner */}
      {inviteJoinNotice && (
        <div
          role="status"
          className="bg-emerald-950/90 border-b border-emerald-500/30 px-4 py-2 flex items-center justify-between gap-3 text-xs text-emerald-200 shrink-0"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{inviteJoinNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setInviteJoinNotice(null)}
            aria-label="Dismiss Invite Notice"
            className="p-1 rounded hover:bg-emerald-900/60 text-emerald-300 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

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
            onJoinServerByInvite={handleJoinServerByInvite}
            isFounder={isCurrentUserFounder}
            onOpenChangelogModal={() => setShowChangelogModal(true)}
            onOpenArchitectureModal={() => setShowArchitectureModal(true)}
          />

          {/* 2. Secondary Channel, Friends & User Profile Sidebar */}
          <ChannelList
            serverName={activeServer?.name || 'Wapper Community'}
            serverDescription={activeServer?.description || ''}
            serverId={activeServerId}
            serverOwnerId={activeServer?.ownerId}
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
            canManageChannels={canManageChannels}
            isMuted={isMuted}
            isDeafened={isDeafened}
            hasVideo={hasVideo}
            isScreenSharing={isScreenSharing}
            isSpeaking={isSpeaking}
            onSelectChannel={handleSelectChannel}
            onCreateChannel={handleCreateChannel}
            onUpdateChannel={handleUpdateChannel}
            onDeleteChannel={handleDeleteChannel}
            onOpenInviteModal={() => setShowInviteModal(true)}
            onOpenServerSettings={() => setShowServerSettingsModal(true)}
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
            dmPeerId={activeDMPeer?.id || activeDMPeerId}
            serverId={activeServerId}
            currentUserId={currentUser.id}
            currentUsername={currentUser.username}
            serverMembers={allServerMembers}
            canDeleteMessages={canDeleteMessages}
            canManageEmojis={canManageEmojis}
            messages={messagesByChannel[effectiveChannelId] || []}
            customEmojis={customEmojis}
            favoriteGifs={favoriteGifs}
            typingUsers={typingByChannel[effectiveChannelId] || []}
            showMemberSidebar={showMemberSidebar}
            sharedMiniPlayer={sharedMiniPlayer}
            onUpdateSharedMiniPlayer={setSharedMiniPlayer}
            onToggleMemberSidebar={() => setShowMemberSidebar((prev) => !prev)}
            onSendMessage={handleSendMessage}
            onToggleReaction={handleToggleReaction}
            onEditMessage={handleEditMessage}
            onDeleteMessage={handleDeleteMessage}
            onRealtimeMessagesSync={handleRealtimeMessagesSync}
            onToggleFavoriteGif={handleToggleFavoriteGif}
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
                  const memberRoleIds = activeServerMemberRoles[member.id] || [];
                  const highestRole = getUserHighestRole(
                    activeServerRoles,
                    memberRoleIds
                  );
                  const memberIsFounder = isFounderEmail(member.email);
                  const nameColor =
                    highestRole?.color || member.profileThemeColor || '#F8FAFC';
                  const statusTicker =
                    member.customStatusEmoji || member.customStatusText
                      ? `${member.customStatusEmoji} ${member.customStatusText}`.trim()
                      : highestRole
                      ? highestRole.name
                      : `#${member.discriminator}`;

                  return (
                    <button
                      key={member.id}
                      type="button"
                      data-testid={`member-sidebar-row-${member.id}`}
                      onClick={() => setInspectedProfile(member)}
                      className="w-full flex flex-col gap-1 px-2 py-1.5 rounded-lg hover:bg-slate-800/60 transition-colors cursor-pointer text-left"
                    >
                      <div className="w-full flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className="relative w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden"
                            style={{
                              backgroundColor: nameColor,
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
                            <div className="flex items-center gap-1 flex-wrap">
                              <span
                                className="text-xs font-semibold truncate"
                                style={{ color: nameColor }}
                              >
                                {member.username}
                              </span>
                              {memberIsFounder && (
                                <span title="👑 Founder & Dev" className="inline-flex">
                                  <Crown className="w-3 h-3 text-amber-400 shrink-0" />
                                </span>
                              )}
                              {member.isLive && (
                                <span className="px-1 py-0.2 rounded bg-rose-500/20 border border-rose-500/50 text-rose-300 text-[9px] font-bold animate-pulse">
                                  🔴 LIVE
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate">
                              {statusTicker}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 text-slate-400 shrink-0">
                          {member.activeVoiceChannelId && (
                            <span title="In P2P Voice Channel" className="inline-flex">
                              <Radio className="w-3.5 h-3.5 text-emerald-400" />
                            </span>
                          )}
                          {member.isMuted && <MicOff className="w-3.5 h-3.5 text-rose-400" />}
                          {member.isDeafened && <VolumeX className="w-3.5 h-3.5 text-rose-400" />}
                        </div>
                      </div>

                      <RichPresenceCard
                        richPresence={member.richPresence}
                        variant="sidebar"
                        accentColor={nameColor}
                      />
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

      {/* Server Invite Link & Sharing Modal */}
      <InviteModal
        isOpen={showInviteModal}
        server={activeServer}
        onClose={() => setShowInviteModal(false)}
      />

      {/* Server Roles, Permissions, Member Assignments & Custom Emojis Modal */}
      <ServerSettingsModal
        isOpen={showServerSettingsModal}
        server={activeServer}
        currentUser={currentUser}
        roles={activeServerRoles}
        memberRoles={activeServerMemberRoles}
        members={allServerMembers}
        customEmojis={customEmojis}
        channels={channels.filter((c) => c.serverId === activeServerId)}
        canManageRoles={canManageRoles}
        canManageEmojis={canManageEmojis}
        canKickMembers={canKickMembers}
        onClose={() => setShowServerSettingsModal(false)}
        onUpdateRoles={handleUpdateServerRoles}
        onUpdateMemberRoles={handleUpdateMemberRoles}
        onKickMember={handleKickServerMember}
        onCreateCustomEmoji={handleCreateCustomEmoji}
        onDeleteCustomEmoji={handleDeleteCustomEmoji}
        onDeleteServer={handleDeleteServer}
        onConnectYouTubeBot={handleConnectYouTubeBot}
      />

      {/* What's New Changelog Modal (By Founder & Dev Mayank Raj) */}
      <ChangelogModal
        isOpen={showChangelogModal}
        onClose={() => setShowChangelogModal(false)}
      />

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

      {/* Strictly Founder-Only Database, SQL Schema, PWA Manifest & Infrastructure Inspector */}
      {isCurrentUserFounder && (
        <ArchitectureModal
          isOpen={showArchitectureModal}
          currentUserEmail={currentUser?.email || auth.currentUser?.email}
          onClose={() => setShowArchitectureModal(false)}
        />
      )}
    </div>
  );
}
