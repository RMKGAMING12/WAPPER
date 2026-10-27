import React, { useState } from 'react';
import {
  Users,
  Plus,
  Compass,
  X,
  Database,
} from 'lucide-react';
import { WapperProfile } from '../utils/chatLogic';

export interface ServerItem {
  id: string;
  name: string;
  description: string;
  iconUrl: string;
  inviteCode: string;
  ownerId: string;
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
  onOpenArchitectureModal,
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newServerName, setNewServerName] = useState('');
  const [newServerDesc, setNewServerDesc] = useState('');
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
    setShowCreateModal(false);
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

          {/* Create Server Button */}
          <button
            type="button"
            onClick={() => {
              setFormError('');
              setShowCreateModal(true);
            }}
            aria-label="Create Server"
            title="Create a New Wapper Server"
            className="w-12 h-12 rounded-3xl hover:rounded-2xl bg-slate-900 hover:bg-emerald-600/20 border border-slate-800 hover:border-emerald-500/50 text-emerald-400 flex items-center justify-center transition-colors cursor-pointer"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        <div className="w-8 h-[1px] bg-slate-800 my-1" />

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

      {/* Create Server Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-server-modal-title"
        >
          <div className="w-full max-w-md rounded-xl bg-[#0F172A] border border-slate-800 p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Compass className="w-5 h-5 text-indigo-400" />
                <h2 id="create-server-modal-title" className="text-base font-semibold text-white">
                  Create a Wapper Server
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                aria-label="Close Create Server Modal"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="mt-2 text-xs text-slate-400">
              Your server is provisioned with #general text chat and a P2P WebRTC voice room at $0 server cost.
            </p>

            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4">
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

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
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
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
