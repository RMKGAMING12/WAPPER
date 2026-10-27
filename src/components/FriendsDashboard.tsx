import React, { useMemo, useState } from 'react';
import {
  Users,
  UserPlus,
  UserCheck,
  UserX,
  ShieldBan,
  MessageSquare,
  Check,
  X,
  Search,
  Copy,
  Menu,
  ArrowUpRight,
  ArrowDownLeft,
  Crown,
} from 'lucide-react';
import {
  FriendsTabType,
  HydratedFriendItem,
  WapperProfile,
  filterHydratedFriendsByTab,
  isFounderEmail,
} from '../utils/chatLogic';

interface FriendsDashboardProps {
  currentUser: WapperProfile;
  friends: HydratedFriendItem[];
  onlineDirectoryUsers: WapperProfile[];
  onSendFriendRequest: (targetTag: string) => Promise<string>;
  onAcceptFriendRequest: (friendId: string) => Promise<void>;
  onDeclineFriendRequest: (friendId: string) => Promise<void>;
  onRemoveFriend: (friendId: string) => Promise<void>;
  onBlockUser: (targetIdOrTag: string) => Promise<void>;
  onUnblockUser: (targetId: string) => Promise<void>;
  onOpenDirectMessage: (friendProfile: WapperProfile) => void;
  onInspectProfile: (profile: WapperProfile, anchorRect?: DOMRect) => void;
  onOpenMobileNav?: () => void;
}

const STATUS_DOT: Record<WapperProfile['status'], string> = {
  online: 'bg-emerald-500',
  idle: 'bg-amber-400',
  dnd: 'bg-rose-500',
  offline: 'bg-slate-500',
};

const STATUS_TEXT: Record<WapperProfile['status'], string> = {
  online: 'Online',
  idle: 'Idle',
  dnd: 'Do Not Disturb',
  offline: 'Offline',
};

export const FriendsDashboard: React.FC<FriendsDashboardProps> = ({
  currentUser,
  friends,
  onlineDirectoryUsers,
  onSendFriendRequest,
  onAcceptFriendRequest,
  onDeclineFriendRequest,
  onRemoveFriend,
  onBlockUser,
  onUnblockUser,
  onOpenDirectMessage,
  onInspectProfile,
  onOpenMobileNav,
}) => {
  const [activeTab, setActiveTab] = useState<FriendsTabType>('online');
  const [searchFilter, setSearchFilter] = useState('');
  const [friendTagInput, setFriendTagInput] = useState('');
  const [blockTagInput, setBlockTagInput] = useState('');
  const [busyActionId, setBusyActionId] = useState<string | null>(null);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [copiedOwnTag, setCopiedOwnTag] = useState(false);

  const counts = useMemo(() => {
    return {
      online: filterHydratedFriendsByTab(friends, 'online').length,
      all: filterHydratedFriendsByTab(friends, 'all').length,
      pending: filterHydratedFriendsByTab(friends, 'pending').length,
      blocked: filterHydratedFriendsByTab(friends, 'blocked').length,
    };
  }, [friends]);

  const filteredList = useMemo(() => {
    if (activeTab === 'add') return [];
    return filterHydratedFriendsByTab(friends, activeTab, searchFilter);
  }, [friends, activeTab, searchFilter]);

  // Real authenticated users currently connected to the server who are not yet accepted/blocked
  const discoverableUsers = useMemo(() => {
    const existingIds = new Set(friends.map((f) => f.friendId));
    return onlineDirectoryUsers.filter(
      (u) => u.id !== currentUser.id && !existingIds.has(u.id)
    );
  }, [onlineDirectoryUsers, friends, currentUser.id]);

  const handleCopyMyTag = () => {
    navigator.clipboard?.writeText(currentUser.uniqueTag).catch(() => {});
    setCopiedOwnTag(true);
    window.setTimeout(() => setCopiedOwnTag(false), 2000);
  };

  const handleAddFriendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!friendTagInput.trim()) {
      setFeedbackBanner({
        type: 'error',
        text: 'Please enter a username tag (e.g. username#1234).',
      });
      return;
    }

    setBusyActionId('add-friend-submit');
    setFeedbackBanner(null);
    try {
      const msg = await onSendFriendRequest(friendTagInput.trim());
      setFeedbackBanner({ type: 'success', text: msg });
      setFriendTagInput('');
    } catch (err: unknown) {
      setFeedbackBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to send friend request.',
      });
    } finally {
      setBusyActionId(null);
    }
  };

  const handleBlockByTagSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockTagInput.trim()) return;
    setBusyActionId('block-by-tag');
    setFeedbackBanner(null);
    try {
      await onBlockUser(blockTagInput.trim());
      setFeedbackBanner({
        type: 'success',
        text: `Blocked "${blockTagInput.trim()}".`,
      });
      setBlockTagInput('');
    } catch (err: unknown) {
      setFeedbackBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Could not block user.',
      });
    } finally {
      setBusyActionId(null);
    }
  };

  const runRelationshipAction = async (
    key: string,
    fn: () => Promise<void>,
    successMsg?: string
  ) => {
    setBusyActionId(key);
    setFeedbackBanner(null);
    try {
      await fn();
      if (successMsg) {
        setFeedbackBanner({ type: 'success', text: successMsg });
      }
    } catch (err: unknown) {
      setFeedbackBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Action failed.',
      });
    } finally {
      setBusyActionId(null);
    }
  };

  const renderAvatar = (profile: WapperProfile) => {
    const initials = profile.username
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

    return (
      <div className="relative w-10 h-10 rounded-full shrink-0">
        {profile.avatarUrl ? (
          <img
            src={profile.avatarUrl}
            alt={profile.username}
            referrerPolicy="no-referrer"
            className="w-10 h-10 rounded-full object-cover border border-slate-700"
          />
        ) : (
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white border border-white/10"
            style={{ backgroundColor: profile.profileThemeColor || '#5865F2' }}
          >
            {initials || 'WU'}
          </div>
        )}
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-[#0E131F] ${
            STATUS_DOT[profile.status]
          }`}
        />
      </div>
    );
  };

  return (
    <main
      aria-label="Friends Social Dashboard"
      className="flex-1 bg-[#0E131F] flex flex-col min-w-0 overflow-hidden"
    >
      {/* Upper Top-Bar Menu */}
      <header className="min-h-14 px-4 sm:px-6 py-2 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {onOpenMobileNav && (
            <button
              type="button"
              onClick={onOpenMobileNav}
              aria-label="Open Navigation Drawer"
              className="md:hidden p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center gap-2 pr-3 border-r border-slate-800">
            <Users className="w-5 h-5 text-indigo-400 shrink-0" />
            <h2 className="text-sm font-bold text-white whitespace-nowrap">Friends</h2>
          </div>

          {/* Filter Tabs: Online | All | Pending | Blocked */}
          <nav aria-label="Friends Filter Tabs" className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setActiveTab('online');
                setFeedbackBanner(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'online'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              Online ({counts.online})
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('all');
                setFeedbackBanner(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'all'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              All ({counts.all})
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('pending');
                setFeedbackBanner(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                activeTab === 'pending'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <span>Pending</span>
              <span className="font-mono tabular-nums text-[11px] text-indigo-300">
                ({counts.pending})
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('blocked');
                setFeedbackBanner(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'blocked'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              Blocked ({counts.blocked})
            </button>

            {/* Bright Green Add Friend Button */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('add');
                setFeedbackBanner(null);
              }}
              className={`ml-1 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                activeTab === 'add'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add Friend</span>
            </button>
          </nav>
        </div>

        {/* Logged-In User's Shareable Unique Tag */}
        <div className="flex items-center gap-2 text-xs text-slate-400 shrink-0">
          <span className="hidden lg:inline">Your Tag:</span>
          <button
            type="button"
            onClick={handleCopyMyTag}
            title="Copy your unique Wapper username tag"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-mono text-xs transition-colors cursor-pointer"
          >
            <span>{currentUser.uniqueTag}</span>
            {copiedOwnTag ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-slate-400" />
            )}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-6 max-w-5xl w-full">
        {feedbackBanner && (
          <div
            role="status"
            className={`mb-5 rounded-xl px-4 py-3 text-xs font-medium flex items-center justify-between border ${
              feedbackBanner.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            <span>{feedbackBanner.text}</span>
            <button
              type="button"
              onClick={() => setFeedbackBanner(null)}
              aria-label="Dismiss notification"
              className="p-1 rounded hover:bg-white/10"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {activeTab === 'add' ? (
          <div className="space-y-8">
            {/* Add Friend By Unique Username Tag */}
            <section className="rounded-2xl bg-[#131A2A] border border-slate-800/90 p-6 space-y-4">
              <div>
                <h3 className="text-base font-bold text-white">Add Friend by Unique Tag</h3>
                <p className="mt-1 text-xs text-slate-400">
                  You can add friends with their Wapper username tag (e.g.{' '}
                  <code className="font-mono text-indigo-300">username#1234</code> or{' '}
                  <code className="font-mono text-indigo-300">username</code>).
                </p>
              </div>

              <form
                onSubmit={handleAddFriendSubmit}
                className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
              >
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={friendTagInput}
                    onChange={(e) => setFriendTagInput(e.target.value)}
                    aria-label="Enter a Username#0000"
                    placeholder="Enter a Username#0000"
                    maxLength={40}
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 focus:border-emerald-500 px-4 py-3 text-sm text-white placeholder-slate-500 font-mono focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busyActionId === 'add-friend-submit'}
                  className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-semibold text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  {busyActionId === 'add-friend-submit'
                    ? 'Sending Request...'
                    : 'Send Friend Request'}
                </button>
              </form>
            </section>

            {/* Real-Time Connected Users Directory (Strictly real authenticated sessions) */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono tabular-nums">
                  Active Registered Accounts on Server — {discoverableUsers.length}
                </h4>
              </div>

              {discoverableUsers.length === 0 ? (
                <div className="rounded-2xl bg-slate-900/40 border border-slate-800/80 p-6 text-center space-y-2">
                  <p className="text-sm font-medium text-slate-300">
                    No other unlinked accounts are currently signed in.
                  </p>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Share your unique tag{' '}
                    <span className="font-mono text-indigo-300">{currentUser.uniqueTag}</span> with
                    a friend or open Wapper in a second browser window to sign in and connect live!
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-800/70 rounded-2xl bg-[#131A2A] border border-slate-800/80 overflow-hidden">
                  {discoverableUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-slate-800/40 transition-colors"
                    >
                      <button
                        type="button"
                        onClick={(e) =>
                          onInspectProfile(user, e.currentTarget.getBoundingClientRect())
                        }
                        className="flex items-center gap-3 min-w-0 text-left cursor-pointer"
                      >
                        {renderAvatar(user)}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-semibold text-white truncate">
                              {user.username}
                            </span>
                            <span className="text-xs font-mono text-slate-400">
                              #{user.discriminator}
                            </span>
                            {isFounderEmail(user.email) && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/50 text-amber-300 text-[10px] font-bold">
                                <Crown className="w-3 h-3 text-amber-400" />
                                <span>👑 Founder &amp; Dev</span>
                              </span>
                            )}
                            {user.isLive && (
                              <span className="px-1.5 py-0.5 rounded bg-rose-500/20 border border-rose-500/50 text-rose-300 text-[10px] font-bold animate-pulse">
                                🔴 LIVE
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 truncate">
                            {user.customStatusEmoji || user.customStatusText
                              ? `${user.customStatusEmoji} ${user.customStatusText}`.trim()
                              : STATUS_TEXT[user.status]}
                          </div>
                        </div>
                      </button>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={busyActionId === `req_${user.id}`}
                          onClick={() =>
                            runRelationshipAction(
                              `req_${user.id}`,
                              async () => {
                                await onSendFriendRequest(user.uniqueTag);
                              },
                              `Friend request sent to ${user.uniqueTag}!`
                            )
                          }
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition-colors cursor-pointer"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Add Friend</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Search Filter Input & Optional Block-by-Tag Form on Blocked Tab */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  aria-label={`Search ${activeTab} friends`}
                  placeholder={`Search ${activeTab} list...`}
                  className="w-full rounded-xl bg-[#131A2A] border border-slate-800 pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {activeTab === 'blocked' && (
                <form onSubmit={handleBlockByTagSubmit} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={blockTagInput}
                    onChange={(e) => setBlockTagInput(e.target.value)}
                    placeholder="Block Username#0000"
                    aria-label="Block user by tag"
                    className="rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-rose-500"
                  />
                  <button
                    type="submit"
                    disabled={busyActionId === 'block-by-tag'}
                    className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Block User
                  </button>
                </form>
              )}
            </div>

            {/* Section Header Count */}
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono tabular-nums">
              {activeTab === 'online' && `Online Friends — ${filteredList.length}`}
              {activeTab === 'all' && `All Friends — ${filteredList.length}`}
              {activeTab === 'pending' && `Pending Friend Requests — ${filteredList.length}`}
              {activeTab === 'blocked' && `Blocked Accounts — ${filteredList.length}`}
            </div>

            {/* Dynamic Friends List or Authentic Empty State */}
            {filteredList.length === 0 ? (
              <div className="rounded-2xl bg-[#131A2A]/70 border border-slate-800/80 p-10 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700/70 flex items-center justify-center text-slate-400 mx-auto">
                  {activeTab === 'blocked' ? (
                    <ShieldBan className="w-6 h-6" />
                  ) : (
                    <Users className="w-6 h-6" />
                  )}
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-white">
                    {activeTab === 'online' && 'No friends are currently online'}
                    {activeTab === 'all' && 'Your friends list is empty'}
                    {activeTab === 'pending' && 'There are no pending friend requests'}
                    {activeTab === 'blocked' && 'You have not blocked any accounts'}
                  </h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    {activeTab === 'blocked'
                      ? 'Blocked accounts cannot send you direct messages or friend requests.'
                      : 'Send a friend request using a unique Wapper tag (Username#0000) to start chatting and jumping into P2P voice rooms.'}
                  </p>
                </div>
                {activeTab !== 'blocked' && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('add')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition-colors cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Add a Friend</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="divide-y divide-slate-800/70 rounded-2xl bg-[#131A2A] border border-slate-800/80 overflow-hidden">
                {filteredList.map((item) => {
                  const { profile, relationshipStatus } = item;
                  const statusSummary =
                    profile.customStatusEmoji || profile.customStatusText
                      ? `${profile.customStatusEmoji} ${profile.customStatusText}`.trim()
                      : STATUS_TEXT[profile.status];

                  return (
                    <div
                      key={item.relationshipId}
                      className="flex items-center justify-between gap-4 px-4 py-3.5 hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Clickable Author/Friend Avatar & Name opens Customized Profile Card */}
                      <button
                        type="button"
                        onClick={(e) =>
                          onInspectProfile(profile, e.currentTarget.getBoundingClientRect())
                        }
                        className="flex items-center gap-3.5 min-w-0 flex-1 text-left cursor-pointer"
                      >
                        {renderAvatar(profile)}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-semibold text-white truncate">
                              {profile.username}
                            </span>
                            <span className="text-xs font-mono text-slate-400">
                              #{profile.discriminator}
                            </span>
                            {isFounderEmail(profile.email) && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/50 text-amber-300 text-[10px] font-bold">
                                <Crown className="w-3 h-3 text-amber-400" />
                                <span>👑 Founder &amp; Dev</span>
                              </span>
                            )}
                            {profile.isLive && (
                              <span className="px-1.5 py-0.5 rounded bg-rose-500/20 border border-rose-500/50 text-rose-300 text-[10px] font-bold animate-pulse">
                                🔴 LIVE
                              </span>
                            )}
                            {relationshipStatus === 'pending_incoming' && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                                <ArrowDownLeft className="w-3 h-3" />
                                Incoming Friend Request
                              </span>
                            )}
                            {relationshipStatus === 'pending_outgoing' && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-300">
                                <ArrowUpRight className="w-3 h-3" />
                                Outgoing Friend Request
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 truncate mt-0.5">
                            {relationshipStatus === 'blocked' ? 'Blocked Account' : statusSummary}
                          </div>
                        </div>
                      </button>

                      {/* Action Buttons based on Relationship Status */}
                      <div className="flex items-center gap-2 shrink-0">
                        {relationshipStatus === 'accepted' && (
                          <>
                            <button
                              type="button"
                              onClick={() => onOpenDirectMessage(profile)}
                              aria-label={`Message ${profile.username}`}
                              title="Send Direct Message"
                              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Message</span>
                            </button>

                            <button
                              type="button"
                              disabled={busyActionId === `remove_${profile.id}`}
                              onClick={() =>
                                runRelationshipAction(
                                  `remove_${profile.id}`,
                                  () => onRemoveFriend(profile.id),
                                  `Removed ${profile.uniqueTag} from friends.`
                                )
                              }
                              aria-label={`Remove friend ${profile.username}`}
                              title="Remove Friend"
                              className="p-2 rounded-xl bg-slate-800/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 transition-colors cursor-pointer"
                            >
                              <UserX className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              disabled={busyActionId === `block_${profile.id}`}
                              onClick={() =>
                                runRelationshipAction(
                                  `block_${profile.id}`,
                                  () => onBlockUser(profile.id),
                                  `Blocked ${profile.uniqueTag}.`
                                )
                              }
                              aria-label={`Block ${profile.username}`}
                              title="Block Account"
                              className="p-2 rounded-xl bg-slate-800/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                            >
                              <ShieldBan className="w-4 h-4" />
                            </button>
                          </>
                        )}

                        {relationshipStatus === 'pending_incoming' && (
                          <>
                            <button
                              type="button"
                              disabled={busyActionId === `accept_${profile.id}`}
                              onClick={() =>
                                runRelationshipAction(
                                  `accept_${profile.id}`,
                                  () => onAcceptFriendRequest(profile.id),
                                  `You are now friends with ${profile.uniqueTag}!`
                                )
                              }
                              aria-label={`Accept friend request from ${profile.username}`}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition-colors cursor-pointer"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>Accept</span>
                            </button>

                            <button
                              type="button"
                              disabled={busyActionId === `decline_${profile.id}`}
                              onClick={() =>
                                runRelationshipAction(
                                  `decline_${profile.id}`,
                                  () => onDeclineFriendRequest(profile.id),
                                  `Declined friend request from ${profile.uniqueTag}.`
                                )
                              }
                              aria-label={`Decline friend request from ${profile.username}`}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-xs font-semibold text-slate-300 hover:text-rose-300 transition-colors cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Decline</span>
                            </button>
                          </>
                        )}

                        {relationshipStatus === 'pending_outgoing' && (
                          <button
                            type="button"
                            disabled={busyActionId === `cancel_${profile.id}`}
                            onClick={() =>
                              runRelationshipAction(
                                `cancel_${profile.id}`,
                                () => onDeclineFriendRequest(profile.id),
                                `Cancelled outgoing request to ${profile.uniqueTag}.`
                              )
                            }
                            aria-label={`Cancel friend request to ${profile.username}`}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-xs font-semibold text-slate-300 hover:text-rose-300 transition-colors cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Cancel Request</span>
                          </button>
                        )}

                        {relationshipStatus === 'blocked' && (
                          <button
                            type="button"
                            disabled={busyActionId === `unblock_${profile.id}`}
                            onClick={() =>
                              runRelationshipAction(
                                `unblock_${profile.id}`,
                                () => onUnblockUser(profile.id),
                                `Unblocked ${profile.uniqueTag}.`
                              )
                            }
                            aria-label={`Unblock ${profile.username}`}
                            className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-emerald-600/20 border border-slate-700 hover:border-emerald-500/40 text-xs font-semibold text-slate-200 hover:text-emerald-300 transition-colors cursor-pointer"
                          >
                            Unblock
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
};

export default FriendsDashboard;
