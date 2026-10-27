import React, { useState } from 'react';
import {
  Hash,
  Volume2,
  Mic,
  MicOff,
  Headphones,
  VolumeX,
  Plus,
  PhoneOff,
  Video,
  MonitorUp,
  ChevronDown,
  LogOut,
  X,
  Radio,
  Users,
  UserPlus,
  Settings,
  Crown,
} from 'lucide-react';
import {
  ChannelItem,
  WapperProfile,
  groupChannelsByType,
  sanitizeChannelName,
  isFounderUser,
} from '../utils/chatLogic';

export interface VoiceChannelOccupant {
  socketId: string;
  userId: string;
  username: string;
  avatarUrl: string;
  channelId: string;
  isMuted: boolean;
  isDeafened: boolean;
  hasVideo: boolean;
  isScreenSharing: boolean;
}

interface ChannelListProps {
  serverName: string;
  serverDescription: string;
  serverId: string;
  isDMMode: boolean;
  isFriendsDashboardActive: boolean;
  pendingFriendCount: number;
  dmPeers: WapperProfile[];
  activeDMPeerId: string | null;
  onSelectFriendsDashboard: () => void;
  onSelectDM: (peerId: string) => void;
  channels: ChannelItem[];
  activeChannelId: string;
  activeVoiceChannelId: string | null;
  voiceOccupantsByChannel: Record<string, VoiceChannelOccupant[]>;
  currentUser: WapperProfile;
  canManageChannels?: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  hasVideo: boolean;
  isScreenSharing: boolean;
  isSpeaking: boolean;
  onSelectChannel: (channel: ChannelItem) => void;
  onCreateChannel: (name: string, type: 'text' | 'voice', category: string) => void;
  onOpenInviteModal: () => void;
  onOpenServerSettings: () => void;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onChangeStatus: (status: WapperProfile['status']) => void;
  onOpenProfileSettings: () => void;
  onLeaveVoice: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onGoogleSignOut: () => void;
}

const STATUS_META: Record<
  WapperProfile['status'],
  { label: string; colorClass: string }
> = {
  online: { label: 'Online', colorClass: 'bg-emerald-500' },
  idle: { label: 'Idle', colorClass: 'bg-amber-400' },
  dnd: { label: 'Do Not Disturb', colorClass: 'bg-rose-500' },
  offline: { label: 'Invisible / Offline', colorClass: 'bg-slate-500' },
};

export const ChannelList: React.FC<ChannelListProps> = ({
  serverName,
  serverDescription,
  serverId,
  isDMMode,
  isFriendsDashboardActive,
  pendingFriendCount,
  dmPeers,
  activeDMPeerId,
  onSelectFriendsDashboard,
  onSelectDM,
  channels,
  activeChannelId,
  activeVoiceChannelId,
  voiceOccupantsByChannel,
  currentUser,
  canManageChannels = true,
  isMuted,
  isDeafened,
  hasVideo,
  isScreenSharing,
  isSpeaking,
  onSelectChannel,
  onCreateChannel,
  onOpenInviteModal,
  onOpenServerSettings,
  onToggleMute,
  onToggleDeafen,
  onChangeStatus,
  onOpenProfileSettings,
  onLeaveVoice,
  onToggleCamera,
  onToggleScreenShare,
  onGoogleSignOut,
}) => {
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [newChannelType, setNewChannelType] = useState<'text' | 'voice'>('text');
  const [newChannelName, setNewChannelName] = useState('');
  const [channelError, setChannelError] = useState('');
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  const { textChannels, voiceChannels } = groupChannelsByType(channels, serverId);
  const activeVoiceChannelObj = channels.find((c) => c.id === activeVoiceChannelId);

  const openCreateChannelModal = (type: 'text' | 'voice') => {
    setNewChannelType(type);
    setNewChannelName('');
    setChannelError('');
    setShowChannelModal(true);
  };

  const handleCreateChannelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formatted = sanitizeChannelName(newChannelName, newChannelType);
    if (formatted.length < 2) {
      setChannelError('Channel name must be at least 2 characters.');
      return;
    }
    onCreateChannel(
      formatted,
      newChannelType,
      newChannelType === 'text' ? 'Text Channels' : 'Voice & Video P2P'
    );
    setNewChannelName('');
    setShowChannelModal(false);
  };

  const userInitials = currentUser.username
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const currentUserIsFounder = isFounderUser(currentUser);

  const statusTickerText =
    currentUser.customStatusEmoji || currentUser.customStatusText
      ? `${currentUser.customStatusEmoji} ${currentUser.customStatusText}`.trim()
      : `${STATUS_META[currentUser.status].label} · #${currentUser.discriminator}`;

  return (
    <>
      <aside
        aria-label="Channel Navigation and User Controls"
        className="w-64 bg-[#0B0F19] border-r border-slate-800/80 flex flex-col select-none shrink-0"
      >
        {/* Top Server / Home Header */}
        <div className="h-14 px-3.5 border-b border-slate-800/80 flex items-center justify-between gap-1.5 shrink-0">
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-white truncate">
              {isDMMode ? 'Friends & Messages' : serverName}
            </h1>
            <p className="text-[11px] text-slate-400 truncate">
              {isDMMode ? 'Social Graph & Direct P2P Chat' : serverDescription}
            </p>
          </div>
          {!isDMMode && serverId && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={onOpenInviteModal}
                aria-label="Invite People"
                title="Invite People to Server"
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/35 border border-indigo-500/30 text-indigo-300 hover:text-white text-[11px] font-semibold transition-colors cursor-pointer shrink-0"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Invite</span>
              </button>
              <button
                type="button"
                onClick={onOpenServerSettings}
                aria-label="Server Roles and Settings"
                title="Server Roles, Permissions & Custom Emojis"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              >
                <Settings className="w-4 h-4" />
              </button>
              {canManageChannels && (
                <button
                  type="button"
                  onClick={() => openCreateChannelModal('text')}
                  aria-label="Add Channel"
                  title="Create Channel"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Scrollable Channel / DM List */}
        <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-5">
          {isDMMode ? (
            <div className="space-y-4">
              {/* Friends Social Dashboard Button */}
              <button
                type="button"
                onClick={onSelectFriendsDashboard}
                className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  isFriendsDashboardActive
                    ? 'bg-indigo-600/20 text-white border border-indigo-500/30'
                    : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Users className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>Friends</span>
                </div>
                {pendingFriendCount > 0 && (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white font-mono text-[10px] tabular-nums">
                    {pendingFriendCount}
                  </span>
                )}
              </button>

              {/* Direct Messages List */}
              <div>
                <div className="px-2 mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                    Direct Messages
                  </span>
                </div>

                {dmPeers.length === 0 ? (
                  <div className="px-2.5 py-4 rounded-xl bg-slate-900/40 border border-slate-800/60 text-[11px] text-slate-400 leading-relaxed">
                    No direct conversations yet. Add a friend by their unique tag in the{' '}
                    <span className="text-slate-200 font-semibold">Friends</span> tab to start chatting!
                  </div>
                ) : (
                  <div className="space-y-1">
                    {dmPeers.map((peer) => {
                      const selected =
                        !isFriendsDashboardActive && activeDMPeerId === peer.id;
                      const initials = peer.username
                        .split(/\s+/)
                        .map((p) => p[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase();
                      const peerIsFounder = isFounderUser(peer);
                      const peerTicker =
                        peer.customStatusEmoji || peer.customStatusText
                          ? `${peer.customStatusEmoji} ${peer.customStatusText}`.trim()
                          : STATUS_META[peer.status].label;

                      return (
                        <button
                          key={peer.id}
                          type="button"
                          onClick={() => onSelectDM(peer.id)}
                          className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                            selected
                              ? 'bg-indigo-600/20 text-white border border-indigo-500/30'
                              : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                          }`}
                        >
                          <div className="relative w-8 h-8 rounded-full shrink-0">
                            {peer.avatarUrl ? (
                              <img
                                src={peer.avatarUrl}
                                alt={peer.username}
                                referrerPolicy="no-referrer"
                                className="w-8 h-8 rounded-full object-cover border border-slate-700"
                              />
                            ) : (
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white"
                                style={{
                                  backgroundColor: peer.profileThemeColor || '#5865F2',
                                }}
                              >
                                {initials}
                              </div>
                            )}
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-[#0B0F19] ${
                                STATUS_META[peer.status].colorClass
                              }`}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-medium truncate">
                                {peer.username}
                              </span>
                              {peerIsFounder && (
                                <Crown
                                  className="w-3 h-3 text-amber-400 shrink-0"
                                  title="👑 Founder & Dev"
                                />
                              )}
                              {peer.isLive && (
                                <span className="px-1 py-0.2 rounded bg-rose-500/20 text-rose-300 text-[9px] font-bold">
                                  🔴
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate">
                              {peerTicker}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* TEXT CHANNELS CATEGORY */}
              <div>
                <div className="px-2 mb-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-1 text-[11px] font-semibold tracking-wider text-slate-400">
                    <ChevronDown className="w-3 h-3" />
                    <span>Text Channels</span>
                  </div>
                  {canManageChannels && (
                    <button
                      type="button"
                      onClick={() => openCreateChannelModal('text')}
                      aria-label="Create Text Channel"
                      title="Create Text Channel"
                      className="p-0.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="space-y-0.5">
                  {textChannels.map((channel) => {
                    const isSelected = channel.id === activeChannelId;
                    return (
                      <button
                        key={channel.id}
                        type="button"
                        onClick={() => onSelectChannel(channel)}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600/20 text-white border border-indigo-500/30'
                            : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                        }`}
                      >
                        <Hash className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="truncate">{channel.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* VOICE & VIDEO CHANNELS CATEGORY */}
              <div>
                <div className="px-2 mb-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-1 text-[11px] font-semibold tracking-wider text-slate-400">
                    <ChevronDown className="w-3 h-3" />
                    <span>Voice &amp; Video P2P</span>
                  </div>
                  {canManageChannels && (
                    <button
                      type="button"
                      onClick={() => openCreateChannelModal('voice')}
                      aria-label="Create Voice Channel"
                      title="Create Voice Channel"
                      className="p-0.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="space-y-1">
                  {voiceChannels.map((channel) => {
                    const isJoined = activeVoiceChannelId === channel.id;
                    const isViewing = activeChannelId === channel.id;
                    const occupants = voiceOccupantsByChannel[channel.id] || [];
                    return (
                      <div key={channel.id} className="space-y-1">
                        <button
                          type="button"
                          onClick={() => onSelectChannel(channel)}
                          className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                            isJoined
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                              : isViewing
                              ? 'bg-slate-800 text-white'
                              : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Volume2
                              className={`w-4 h-4 shrink-0 ${
                                isJoined ? 'text-emerald-400' : 'text-slate-400'
                              }`}
                            />
                            <span className="truncate">{channel.name}</span>
                          </div>
                          <span className="text-[10px] font-mono tabular-nums text-slate-400 shrink-0">
                            {occupants.length > 0 ? `${occupants.length} P2P` : '0'}
                          </span>
                        </button>

                        {/* Connected Voice Peers Under Channel */}
                        {occupants.length > 0 && (
                          <div className="pl-6 pr-2 py-0.5 space-y-1">
                            {occupants.map((occ) => (
                              <div
                                key={occ.socketId || occ.userId}
                                className="flex items-center justify-between gap-2 py-1 px-2 rounded-md bg-slate-900/60 text-[11px] text-slate-300"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-5 h-5 rounded-full bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center text-[10px] font-semibold text-indigo-200 shrink-0">
                                    {occ.username.slice(0, 1).toUpperCase()}
                                  </div>
                                  <span className="truncate">{occ.username}</span>
                                </div>
                                <div className="flex items-center gap-1 text-slate-400 shrink-0">
                                  {occ.isScreenSharing && (
                                    <span className="text-[9px] font-mono text-sky-400">LIVE</span>
                                  )}
                                  {occ.hasVideo && <Video className="w-3 h-3 text-indigo-400" />}
                                  {occ.isMuted && <MicOff className="w-3 h-3 text-rose-400" />}
                                  {occ.isDeafened && <VolumeX className="w-3 h-3 text-rose-400" />}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Active P2P Voice Connection Status Bar */}
        {activeVoiceChannelId && (
          <div className="bg-[#08121E] border-t border-emerald-500/20 px-3 py-2.5 space-y-2 shrink-0">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                  <Radio className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Voice Connected (P2P)</span>
                </div>
                <p className="text-[11px] text-slate-400 truncate">
                  {activeVoiceChannelObj?.name || 'Voice Lounge'} · Google STUN
                </p>
              </div>
              <button
                type="button"
                onClick={onLeaveVoice}
                aria-label="Disconnect Voice Channel"
                title="Disconnect from Voice"
                className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-400 transition-colors cursor-pointer shrink-0"
              >
                <PhoneOff className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={onToggleCamera}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  hasVideo
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200'
                }`}
              >
                <Video className="w-3.5 h-3.5" />
                <span>{hasVideo ? 'Camera On' : 'Video'}</span>
              </button>
              <button
                type="button"
                onClick={onToggleScreenShare}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  isScreenSharing
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200'
                }`}
              >
                <MonitorUp className="w-3.5 h-3.5" />
                <span>{isScreenSharing ? 'Sharing' : 'Screen'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Bottom User Profile & Audio Controls Card */}
        <div className="relative bg-[#070A10] border-t border-slate-800/90 px-2.5 py-2.5 flex items-center justify-between gap-1.5 shrink-0">
          {/* Status & Account Menu Popover */}
          {showStatusMenu && (
            <div
              role="menu"
              aria-label="Select User Status"
              className="absolute bottom-16 left-2.5 right-2.5 rounded-xl bg-[#0F172A] border border-slate-700/80 p-2 shadow-2xl z-30 space-y-1"
            >
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Set Presence Status
              </div>
              {(['online', 'idle', 'dnd', 'offline'] as const).map((statusKey) => (
                <button
                  key={statusKey}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onChangeStatus(statusKey);
                    setShowStatusMenu(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                    currentUser.status === statusKey
                      ? 'bg-indigo-600/25 text-white font-semibold'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span>{STATUS_META[statusKey].label}</span>
                  <span className="text-[10px] font-mono uppercase text-slate-400">
                    {statusKey}
                  </span>
                </button>
              ))}

              <div className="border-t border-slate-800 my-1 pt-1 space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowStatusMenu(false);
                    onOpenProfileSettings();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-indigo-300 hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Customize Profile &amp; Theme</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowStatusMenu(false);
                    onGoogleSignOut();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}

          {/* Logged-In User Avatar & Custom Status Ticker */}
          <button
            type="button"
            onClick={() => setShowStatusMenu((prev) => !prev)}
            aria-label={`User profile ${currentUser.username}, status ${STATUS_META[currentUser.status].label}`}
            title="Click to change status or customize profile"
            className="flex items-center gap-2 min-w-0 flex-1 p-1 rounded-lg hover:bg-slate-800/70 transition-colors text-left cursor-pointer"
          >
            <div
              className={`relative w-8 h-8 rounded-full shrink-0 ${
                isSpeaking ? 'ring-2 ring-emerald-400' : ''
              }`}
            >
              {currentUser.avatarUrl ? (
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.username}
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 rounded-full object-cover border border-slate-700"
                />
              ) : (
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ backgroundColor: currentUser.profileThemeColor || '#5865F2' }}
                >
                  {userInitials}
                </div>
              )}
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-[#070A10] ${
                  STATUS_META[currentUser.status].colorClass
                }`}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <span className="text-xs font-semibold text-white truncate">
                  {currentUser.username}
                </span>
                {currentUserIsFounder && (
                  <span
                    title="👑 Founder & Dev"
                    className="inline-flex items-center text-[10px] text-amber-300 font-bold shrink-0"
                  >
                    👑
                  </span>
                )}
                {currentUser.isLive && (
                  <span className="px-1 py-0.2 rounded bg-rose-500/20 border border-rose-500/50 text-rose-300 text-[9px] font-bold shrink-0 animate-pulse">
                    🔴 LIVE
                  </span>
                )}
              </div>
              <div className="text-[11px] font-mono tabular-nums text-slate-400 truncate">
                {statusTickerText}
              </div>
            </div>
          </button>

          {/* Mic Mute, Audio Deafen & Profile Customization Gear Buttons */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
              title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isMuted
                  ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={onToggleDeafen}
              aria-label={isDeafened ? 'Undeafen Audio' : 'Deafen Audio'}
              title={isDeafened ? 'Undeafen Audio' : 'Deafen Audio'}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isDeafened
                  ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {isDeafened ? <VolumeX className="w-4 h-4" /> : <Headphones className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={onOpenProfileSettings}
              aria-label="User Profile Settings"
              title="Customize Profile, Avatar, Banner & Theme"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Create Channel Modal */}
      {showChannelModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-channel-modal-title"
        >
          <div className="w-full max-w-md rounded-xl bg-[#0F172A] border border-slate-800 p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 id="create-channel-modal-title" className="text-base font-semibold text-white">
                Create {newChannelType === 'text' ? 'Text' : 'Voice & Video'} Channel
              </h2>
              <button
                type="button"
                onClick={() => setShowChannelModal(false)}
                aria-label="Close Create Channel Modal"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateChannelSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-900 rounded-lg border border-slate-800">
                <button
                  type="button"
                  onClick={() => setNewChannelType('text')}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    newChannelType === 'text'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Hash className="w-3.5 h-3.5" />
                  <span>Text Channel</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNewChannelType('voice')}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    newChannelType === 'voice'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Voice P2P</span>
                </button>
              </div>

              <div>
                <label
                  htmlFor="channel-name-input"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Channel Name
                </label>
                <input
                  id="channel-name-input"
                  type="text"
                  value={newChannelName}
                  onChange={(e) => {
                    setNewChannelName(e.target.value);
                    if (channelError) setChannelError('');
                  }}
                  placeholder={
                    newChannelType === 'text' ? 'e.g. release-notes' : 'e.g. Architecture Lounge'
                  }
                  maxLength={64}
                  className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {channelError && (
                <p role="alert" className="text-xs text-rose-400 font-medium">
                  {channelError}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowChannelModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors cursor-pointer"
                >
                  Create Channel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default ChannelList;
