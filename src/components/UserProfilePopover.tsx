import React from 'react';
import {
  X,
  MessageSquare,
  UserPlus,
  ShieldBan,
  Settings,
  Calendar,
  Crown,
  Radio,
  ExternalLink,
} from 'lucide-react';
import {
  WapperProfile,
  normalizeHexColor,
  isFounderUser,
} from '../utils/chatLogic';

interface UserProfilePopoverProps {
  profile: WapperProfile | null;
  currentUserId: string;
  isAlreadyFriend: boolean;
  isBlocked: boolean;
  onClose: () => void;
  onOpenEditProfile: () => void;
  onSendMessage: (profile: WapperProfile) => void;
  onSendFriendRequest: (uniqueTag: string) => void;
  onBlockUser: (userId: string) => void;
}

const STATUS_DOT: Record<WapperProfile['status'], string> = {
  online: 'bg-emerald-500',
  idle: 'bg-amber-400',
  dnd: 'bg-rose-500',
  offline: 'bg-slate-500',
};

const STATUS_LABEL: Record<WapperProfile['status'], string> = {
  online: 'Online',
  idle: 'Idle',
  dnd: 'Do Not Disturb',
  offline: 'Offline',
};

export const UserProfilePopover: React.FC<UserProfilePopoverProps> = ({
  profile,
  currentUserId,
  isAlreadyFriend,
  isBlocked,
  onClose,
  onOpenEditProfile,
  onSendMessage,
  onSendFriendRequest,
  onBlockUser,
}) => {
  if (!profile) return null;

  const isSelf = profile.id === currentUserId;
  const profileIsFounder = isFounderUser(profile);
  const themeHex = normalizeHexColor(profile.profileThemeColor, '#5865F2');
  const bannerHex = normalizeHexColor(profile.bannerColor, '#5865F2');
  const initials = profile.username
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const formattedJoinDate = profile.createdAt
    ? new Date(profile.createdAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Recently';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${profile.username} Profile Card`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl overflow-hidden bg-[#0E1320] shadow-2xl relative"
        style={{
          borderWidth: '2px',
          borderStyle: 'solid',
          borderColor: themeHex,
        }}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Profile Card"
          className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-black/55 hover:bg-black/80 text-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Custom Banner (Image or Hex Color) */}
        <div
          className="h-28 w-full relative overflow-hidden"
          style={{ backgroundColor: bannerHex }}
        >
          {profile.bannerUrl && (
            <img
              src={profile.bannerUrl}
              alt={`${profile.username} banner`}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          )}
        </div>

        {/* Profile Avatar & Quick Actions */}
        <div className="px-5 pb-5 relative">
          <div className="flex items-end justify-between -mt-10 mb-3">
            <div className="relative w-20 h-20 rounded-full ring-4 ring-[#0E1320] bg-slate-900 overflow-hidden shrink-0">
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.username}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-xl font-bold text-white"
                  style={{ backgroundColor: themeHex }}
                >
                  {initials || 'WU'}
                </div>
              )}
              <span
                className={`absolute bottom-1 right-1 w-4 h-4 rounded-full ring-2 ring-[#0E1320] ${
                  STATUS_DOT[profile.status]
                }`}
              />
            </div>

            {isSelf ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenEditProfile();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white transition-colors cursor-pointer"
                style={{ backgroundColor: themeHex }}
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Edit Profile</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onSendMessage(profile);
                  }}
                  aria-label={`Message ${profile.username}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white transition-colors cursor-pointer"
                  style={{ backgroundColor: themeHex }}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Message</span>
                </button>

                {!isAlreadyFriend && !isBlocked && (
                  <button
                    type="button"
                    onClick={() => {
                      onSendFriendRequest(profile.uniqueTag);
                      onClose();
                    }}
                    aria-label={`Add Friend ${profile.username}`}
                    title="Send Friend Request"
                    className="p-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" />
                  </button>
                )}

                {!isBlocked && (
                  <button
                    type="button"
                    onClick={() => {
                      onBlockUser(profile.id);
                      onClose();
                    }}
                    aria-label={`Block ${profile.username}`}
                    title="Block User"
                    className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 transition-colors cursor-pointer"
                  >
                    <ShieldBan className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Custom Status Ticker Bubble */}
          {(profile.customStatusEmoji || profile.customStatusText) && (
            <div className="mb-3 rounded-xl bg-slate-900/90 border border-slate-800 px-3 py-2 text-xs text-slate-200 flex items-center gap-2">
              {profile.customStatusEmoji && (
                <span className="text-sm">{profile.customStatusEmoji}</span>
              )}
              <span className="truncate">{profile.customStatusText}</span>
            </div>
          )}

          {/* Profile Info Body */}
          <div className="rounded-xl bg-[#090D16] border border-slate-800/90 p-3.5 space-y-3">
            <div>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 min-w-0">
                  <h3 className="text-base font-bold text-white truncate">
                    {profile.username}
                  </h3>
                  {profileIsFounder && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-400/50 text-amber-300 text-[10px] font-bold">
                      <Crown className="w-3 h-3 text-amber-400" />
                      <span>👑 Founder &amp; Dev</span>
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-slate-400">{STATUS_LABEL[profile.status]}</span>
              </div>
              <p className="text-xs font-mono text-slate-400">{profile.uniqueTag}</p>
            </div>

            {/* Live Broadcast Status Card */}
            {profile.isLive && (
              <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-2.5 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-300 animate-pulse">
                    <Radio className="w-3.5 h-3.5 text-rose-400" />
                    <span>🔴 LIVE STREAMING NOW</span>
                  </span>
                  {profile.liveStreamUrl && (
                    <a
                      href={profile.liveStreamUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:underline"
                    >
                      <span>Watch</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                {profile.liveStreamTitle && (
                  <p className="text-xs font-semibold text-white truncate">
                    {profile.liveStreamTitle}
                  </p>
                )}
              </div>
            )}

            <div className="border-t border-slate-800/80 pt-2.5 space-y-1">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                About Me
              </div>
              <p className="text-xs text-slate-300 whitespace-pre-line leading-relaxed break-words">
                {profile.bio || 'No bio set yet.'}
              </p>
            </div>

            <div className="border-t border-slate-800/80 pt-2.5 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>Wapper Member Since</span>
              </span>
              <span className="font-mono tabular-nums text-slate-300">{formattedJoinDate}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfilePopover;
