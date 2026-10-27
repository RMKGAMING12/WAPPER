import React, { useState } from 'react';
import {
  Users,
  Plus,
  Compass,
  Link2,
  X,
  Database,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { ServerRole, WapperProfile, parseInviteInput } from '../utils/chatLogic';
import type { CustomEmojiItem } from './ChatArea';

export interface ServerItem {
  id: string;
  name: string;
  description: string;
  iconUrl: string;
  inviteCode: string;
  ownerId: string;
  memberIds?: string[];
  roles?: ServerRole[];
  memberRoles?: Record<string, string[]>;
  customEmojis?: CustomEmojiItem[];
}

interface SidebarProps {
  servers: ServerItem[];
  activeServerId: string;
  isDMMode: boolean;
  isFriendsDashboardActive: boolean;
  pendingFriendCount: number;
  dmPeers: WapperProfile[];
  activeDMPeerId: string | null;
  onSelectHomeFriends: () => void;
  onSelectServer: (serverId: string) => void;
  onSelectDM: (peerId: string) => void;
  onCreateServer: (name: string, description: string) => void;
  onJoinServerByInvite: (inviteLinkOrCode: string) => Promise<{
    joined: boolean;
    serverName?: string;
    error?: string;
  }>;
  onOpenChangelogModal: () => void;
  onOpenArchitectureModal: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  servers,
  activeServerId,
  isDMMode,
  isFriendsDashboardActive,
  pendingFriendCount,
  dmPeers,
  activeDMPeerId,
  onSelectHomeFriends,
  onSelectServer,
  onSelectDM,
  onCreateServer,
  onJoinServerByInvite,
  onOpenChangelogModal,
  onOpenArchitectureModal,
}) => {
  const [showServerModal, setShowServerModal] = useState(false);
  const [modalTab, setModalTab] = useState<'create' | 'join'>('create');
  const [newServerName, setNewServerName] = useState('');
  const [newServerDesc, setNewServerDesc] = useState('');
  const [inviteInput, setInviteInput] = useState('');
  const [joiningBusy, setJoiningBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newServerName.trim();
    if (trimmedName.length < 2) {
      setFormError('Server name must be at least 2 characters.');
      return;
    }
    onCreateServer(trimmedName.slice(0, 80), newServerDesc.trim().slice(0, 300));
    setNewServerName('');
    setNewServerDesc('');
    setFormError('');
    setShowServerModal(false);
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInviteInput(inviteInput);
    if (!parsed.valid) {
      setFormError(
        parsed.error || 'Please enter a valid invite link or Server ID.'
      );
      return;
    }

    setJoiningBusy(true);
    setFormError('');
    try {
      const result = await onJoinServerByInvite(parsed.inviteTarget);
      if (!result.joined) {
        setFormError(
          result.error || 'Could not find a server matching that invite link or ID.'
        );
      } else {
        setInviteInput('');
        setFormError('');
        setShowServerModal(false);
      }
    } catch (err: unknown) {
      setFormError(
        err instanceof Error ? err.message : 'Failed to join server.'
      );
    } finally {
      setJoiningBusy(false);
    }
  };

  const renderServerEmblem = (server: ServerItem, index: number) => {
    const initials = server.name
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
    const colors = [
      'text-indigo-300',
      'text-emerald-300',
      'text-sky-300',
      'text-amber-300',
      'text-violet-300',
    ];
    return (
      <span className={`text-xs font-bold tracking-tight ${colors[index % colors.length]}`}>
        {initials || 'SV'}
      </span>
    );
  };

  return (
    <>
      <nav
        aria-label="Servers and Direct Messages"
        className="w-[72px] bg-[#070A10] border-r border-slate-800/80 flex flex-col items-center py-3 gap-2 select-none shrink-0 z-20"
      >
        {/* Home / Friends & Direct Messages Button */}
        <div className="relative group flex items-center justify-center w-full">
          <span
            className={`absolute left-0 w-1 rounded-r-full bg-indigo-400 transition-transform duration-150 ${
              isDMMode && isFriendsDashboardActive
                ? 'h-9 scale-y-100'
                : 'h-4 scale-y-0 group-hover:scale-y-100'
            }`}
          />
          <button
            type="button"
            onClick={onSelectHomeFriends}
            aria-label="Friends and Direct Messages Home"
            title="Friends & Direct Messages"
            className={`relative w-12 h-12 flex items-center justify-center transition-colors cursor-pointer ${
              isDMMode && isFriendsDashboardActive
                ? 'rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-950/60'
                : 'rounded-3xl hover:rounded-2xl bg-slate-900 hover:bg-indigo-600/90 text-slate-300 hover:text-white border border-slate-800'
            }`}
          >
            <Users className="w-5 h-5" />
            {pendingFriendCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-emerald-600 ring-2 ring-[#070A10] text-[10px] font-mono font-bold text-white flex items-center justify-center">
                {pendingFriendCount}
              </span>
            )}
          </button>
        </div>

        {/* Real Accepted Friends / Direct Message Shortcut Avatars */}
        {dmPeers.length > 0 && (
          <div className="flex flex-col items-center gap-1.5 w-full">
            {dmPeers.slice(0, 3).map((peer) => {
              const isActiveDM =
                isDMMode && !isFriendsDashboardActive && activeDMPeerId === peer.id;
              const initials = peer.username
                .split(/\s+/)
                .map((n) => n[0])
                .join('')
                .slice(0, 2)
                .toUpperCase();
              return (
                <div
                  key={peer.id}
                  className="relative group flex items-center justify-center w-full"
                >
                  <span
                    className={`absolute left-0 w-1 rounded-r-full bg-sky-400 transition-transform duration-150 ${
                      isActiveDM ? 'h-7 scale-y-100' : 'h-3 scale-y-0 group-hover:scale-y-100'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => onSelectDM(peer.id)}
                    aria-label={`Direct Message ${peer.username}`}
                    title={`DM: ${peer.username} (${peer.uniqueTag})`}
                    className={`w-10 h-10 rounded-2xl overflow-hidden flex items-center justify-center text-xs font-semibold transition-colors cursor-pointer border ${
                      isActiveDM
                        ? 'bg-slate-800 border-sky-400/60 text-white'
                        : 'bg-slate-900/90 border-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    {peer.avatarUrl ? (
                      <img
                        src={peer.avatarUrl}
                        alt={peer.username}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>{initials}</span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="w-8 h-[1px] bg-slate-800 my-1" />

        {/* Server Icons List */}
        <div className="flex-1 w-full overflow-y-auto flex flex-col items-center gap-2.5 no-scrollbar">
          {servers.map((server, idx) => {
            const isSelected = !isDMMode && server.id === activeServerId;
            return (
              <div
                key={server.id}
                className="relative group flex items-center justify-center w-full"
              >
                <span
                  className={`absolute left-0 w-1 rounded-r-full bg-indigo-400 transition-transform duration-150 ${
                    isSelected ? 'h-9 scale-y-100' : 'h-4 scale-y-0 group-hover:scale-y-100'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => onSelectServer(server.id)}
                  aria-label={`Server ${server.name}`}
                  title={server.name}
                  className={`w-12 h-12 flex items-center justify-center transition-colors cursor-pointer border ${
                    isSelected
                      ? 'rounded-2xl bg-indigo-600/25 border-indigo-500/60 text-white shadow-md'
                      : 'rounded-3xl hover:rounded-2xl bg-slate-900/90 border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white'
                  }`}
                >
                  {renderServerEmblem(server, idx)}
                </button>
              </div>
            );
          })}

          {/* Create or Join Server Button ("+") */}
          <button
            type="button"
            onClick={() => {
              setFormError('');
              setModalTab('create');
              setShowServerModal(true);
            }}
            aria-label="Create or Join Server"
            title="Create or Join a Wapper Server"
            className="w-12 h-12 rounded-3xl hover:rounded-2xl bg-slate-900 hover:bg-emerald-600/20 border border-slate-800 hover:border-emerald-500/50 text-emerald-400 flex items-center justify-center transition-colors cursor-pointer"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        <div className="w-8 h-[1px] bg-slate-800 my-1" />

        {/* What's New Changelog Modal Button */}
        <button
          type="button"
          onClick={onOpenChangelogModal}
          aria-label="What's New Changelog"
          title="What's New in Wapper v3.0 (By Mayank Raj)"
          className="w-11 h-11 rounded-2xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/40 text-amber-300 flex items-center justify-center transition-colors cursor-pointer"
        >
          <Sparkles className="w-4 h-4" />
        </button>

        {/* Inspect SQL Schema & PWA Specs Button */}
        <button
          type="button"
          onClick={onOpenArchitectureModal}
          aria-label="Inspect SQL Schema and PWA Architecture"
          title="Inspect schema.sql, manifest.json & P2P Specs"
          className="w-11 h-11 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-indigo-300 flex items-center justify-center transition-colors cursor-pointer"
        >
          <Database className="w-4 h-4" />
        </button>
      </nav>

      {/* Create or Join Server Modal */}
      {showServerModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="server-modal-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-[#0F172A] border border-slate-800 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Compass className="w-5 h-5 text-indigo-400" />
                <h2 id="server-modal-title" className="text-base font-semibold text-white">
                  {modalTab === 'create' ? 'Create a Wapper Server' : 'Join a Server by Invite'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowServerModal(false)}
                aria-label="Close Server Modal"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mode Switcher: Create a Server OR Join a Server */}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-950 border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setModalTab('create');
                  setFormError('');
                }}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  modalTab === 'create'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create a Server</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setModalTab('join');
                  setFormError('');
                }}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  modalTab === 'join'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>Join a Server</span>
              </button>
            </div>

            {modalTab === 'create' ? (
              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <p className="text-xs text-slate-400">
                  Your server is provisioned with #general text chat, a P2P WebRTC voice room, custom roles, and a shareable invite link.
                </p>

                <div>
                  <label
                    htmlFor="server-name-input"
                    className="block text-xs font-medium text-slate-300 mb-1.5"
                  >
                    Server Name
                  </label>
                  <input
                    id="server-name-input"
                    type="text"
                    value={newServerName}
                    onChange={(e) => {
                      setNewServerName(e.target.value);
                      if (formError) setFormError('');
                    }}
                    placeholder="e.g. Indie Game Collective"
                    maxLength={80}
                    className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="server-desc-input"
                    className="block text-xs font-medium text-slate-300 mb-1.5"
                  >
                    Community Description
                  </label>
                  <input
                    id="server-desc-input"
                    type="text"
                    value={newServerDesc}
                    onChange={(e) => setNewServerDesc(e.target.value)}
                    placeholder="Open-source collaboration, P2P voice & code reviews"
                    maxLength={300}
                    className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {formError && (
                  <p role="alert" className="text-xs text-rose-400 font-medium">
                    {formError}
                  </p>
                )}

                <div className="flex items-center justify-between gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setModalTab('join');
                      setFormError('');
                    }}
                    className="text-xs text-emerald-400 hover:underline cursor-pointer"
                  >
                    Have an invite link? Join instead
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowServerModal(false)}
                      className="px-4 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors cursor-pointer"
                    >
                      Create Server
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <form onSubmit={handleJoinSubmit} className="space-y-4">
                <p className="text-xs text-slate-400">
                  Enter an invite link or Server ID below to join an existing Wapper server.
                </p>

                <div>
                  <label
                    htmlFor="invite-code-or-link-input"
                    className="block text-xs font-medium text-slate-300 mb-1.5"
                  >
                    Invite Link or Server ID
                  </label>
                  <input
                    id="invite-code-or-link-input"
                    type="text"
                    value={inviteInput}
                    onChange={(e) => {
                      setInviteInput(e.target.value);
                      if (formError) setFormError('');
                    }}
                    placeholder="https://.../?invite=srv_wapper_community or srv_12345"
                    className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3.5 py-2.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    Examples: <code className="font-mono text-slate-300">srv_wapper_community</code>,{' '}
                    <code className="font-mono text-slate-300">wapper-hq</code>, or{' '}
                    <code className="font-mono text-slate-300">
                      {typeof window !== 'undefined' ? window.location.origin : 'https://wapper.app'}
                      /?invite=srv_...
                    </code>
                  </p>
                </div>

                {formError && (
                  <p role="alert" className="text-xs text-rose-400 font-medium">
                    {formError}
                  </p>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowServerModal(false)}
                    className="px-4 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={joiningBusy}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-semibold text-white transition-colors cursor-pointer"
                  >
                    <span>{joiningBusy ? 'Joining...' : 'Join Server'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
