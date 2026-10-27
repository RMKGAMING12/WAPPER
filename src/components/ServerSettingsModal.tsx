import React, { useMemo, useRef, useState } from 'react';
import {
  Shield,
  Users,
  Smile,
  Plus,
  Trash2,
  Check,
  X,
  Crown,
  Upload,
  UserX,
  Radio,
} from 'lucide-react';
import {
  ServerRole,
  RolePermissionKey,
  WapperProfile,
  isFounderUser,
  getUserHighestRole,
  validateEmojiName,
  normalizeHexColor,
} from '../utils/chatLogic';
import { uploadCustomEmojiAsset } from '../supabaseClient';
import type { CustomEmojiItem } from './ChatArea';
import type { ServerItem } from './Sidebar';

export type ServerSettingsTab = 'roles' | 'members' | 'emojis';

interface ServerSettingsModalProps {
  isOpen: boolean;
  initialTab?: ServerSettingsTab;
  server: ServerItem;
  currentUser: WapperProfile;
  roles: ServerRole[];
  memberRoles: Record<string, string[]>;
  members: WapperProfile[];
  customEmojis: CustomEmojiItem[];
  canManageRoles: boolean;
  canManageEmojis: boolean;
  canKickMembers: boolean;
  onClose: () => void;
  onUpdateRoles: (nextRoles: ServerRole[]) => void;
  onUpdateMemberRoles: (userId: string, nextRoleIds: string[]) => void;
  onKickMember: (userId: string) => void;
  onCreateCustomEmoji: (name: string, imageUrl: string) => void;
  onDeleteCustomEmoji: (emojiId: string) => void;
}

const PERMISSION_METADATA: Array<{
  key: RolePermissionKey;
  label: string;
  description: string;
}> = [
  {
    key: 'ADMINISTRATOR',
    label: 'Administrator',
    description: 'Grants all server permissions and bypasses channel/role restrictions.',
  },
  {
    key: 'MANAGE_CHANNELS',
    label: 'Manage Channels',
    description: 'Allows creating and configuring text and P2P voice channels.',
  },
  {
    key: 'MANAGE_ROLES',
    label: 'Manage Roles',
    description: 'Allows creating, editing, and assigning custom server roles.',
  },
  {
    key: 'MANAGE_EMOJIS',
    label: 'Manage Emojis & GIFs',
    description: 'Allows uploading and removing custom `:shortcode:` server emojis.',
  },
  {
    key: 'KICK_MEMBERS',
    label: 'Kick Members',
    description: 'Allows removing disruptive members from the server.',
  },
  {
    key: 'SEND_MESSAGES',
    label: 'Send Messages & Slash Commands',
    description: 'Allows posting chat messages and triggering `/youtube`, `/live`, and `/poll` bots.',
  },
  {
    key: 'DELETE_MESSAGES',
    label: 'Delete & Moderate Messages',
    description: 'Allows deleting any message in server channels.',
  },
];

const ROLE_COLOR_SWATCHES = [
  '#F59E0B',
  '#10B981',
  '#5865F2',
  '#EC4899',
  '#EF4444',
  '#06B6D4',
  '#8B5CF6',
  '#84CC16',
];

export const ServerSettingsModal: React.FC<ServerSettingsModalProps> = ({
  isOpen,
  initialTab = 'roles',
  server,
  currentUser,
  roles,
  memberRoles,
  members,
  customEmojis,
  canManageRoles,
  canManageEmojis,
  canKickMembers,
  onClose,
  onUpdateRoles,
  onUpdateMemberRoles,
  onKickMember,
  onCreateCustomEmoji,
  onDeleteCustomEmoji,
}) => {
  const [activeTab, setActiveTab] = useState<ServerSettingsTab>(initialTab);
  const [selectedRoleId, setSelectedRoleId] = useState<string>(
    roles[0]?.id || 'role_founder_admin'
  );
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleColor, setNewRoleColor] = useState('#5865F2');

  // Custom Emoji Upload State
  const [newEmojiName, setNewEmojiName] = useState('');
  const [emojiUploadError, setEmojiUploadError] = useState('');
  const [uploadingEmoji, setUploadingEmoji] = useState(false);
  const emojiFileInputRef = useRef<HTMLInputElement | null>(null);

  const sortedRoles = useMemo(
    () => [...roles].sort((a, b) => b.position - a.position),
    [roles]
  );

  const selectedRole = useMemo(
    () => sortedRoles.find((r) => r.id === selectedRoleId) || sortedRoles[0] || null,
    [sortedRoles, selectedRoleId]
  );

  if (!isOpen) return null;

  const handleCreateRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageRoles) return;
    const trimmed = newRoleName.trim() || 'New Server Role';
    const nextRole: ServerRole = {
      id: `role_${Date.now()}`,
      name: trimmed.slice(0, 32),
      color: normalizeHexColor(newRoleColor, '#5865F2'),
      position: Math.max(15, sortedRoles.length * 10 + 5),
      permissions: {
        ADMINISTRATOR: false,
        MANAGE_CHANNELS: false,
        MANAGE_ROLES: false,
        MANAGE_EMOJIS: true,
        KICK_MEMBERS: false,
        SEND_MESSAGES: true,
        DELETE_MESSAGES: false,
      },
    };
    const nextRoles = [...roles, nextRole];
    onUpdateRoles(nextRoles);
    setSelectedRoleId(nextRole.id);
    setNewRoleName('');
  };

  const handleUpdateSelectedRole = (patch: Partial<ServerRole>) => {
    if (!selectedRole || !canManageRoles) return;
    const nextRoles = roles.map((r) =>
      r.id === selectedRole.id ? { ...r, ...patch } : r
    );
    onUpdateRoles(nextRoles);
  };

  const handleTogglePermission = (permKey: RolePermissionKey) => {
    if (!selectedRole || !canManageRoles) return;
    const updatedPerms = {
      ...selectedRole.permissions,
      [permKey]: !selectedRole.permissions[permKey],
    };
    handleUpdateSelectedRole({ permissions: updatedPerms });
  };

  const handleDeleteRole = (roleId: string) => {
    if (!canManageRoles || roles.length <= 1) return;
    const nextRoles = roles.filter((r) => r.id !== roleId);
    onUpdateRoles(nextRoles);
    if (selectedRoleId === roleId && nextRoles[0]) {
      setSelectedRoleId(nextRoles[0].id);
    }
  };

  const handleToggleMemberRole = (userId: string, roleId: string) => {
    if (!canManageRoles) return;
    const currentAssigned = memberRoles[userId] || [];
    const exists = currentAssigned.includes(roleId);
    const nextAssigned = exists
      ? currentAssigned.filter((id) => id !== roleId)
      : [...currentAssigned, roleId];
    onUpdateMemberRoles(userId, nextAssigned);
  };

  const handleEmojiFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const candidateName =
      newEmojiName.trim() ||
      file.name
        .replace(/\.[^.]+$/, '')
        .replace(/[^a-zA-Z0-9_]/g, '_')
        .slice(0, 24);

    const validation = validateEmojiName(candidateName);
    if (!validation.valid) {
      setEmojiUploadError(validation.error || 'Invalid emoji shortcode.');
      return;
    }

    setUploadingEmoji(true);
    setEmojiUploadError('');
    try {
      const uploaded = await uploadCustomEmojiAsset(
        server.id,
        validation.normalized,
        file
      );
      onCreateCustomEmoji(uploaded.name, uploaded.imageUrl);
      setNewEmojiName('');
      if (emojiFileInputRef.current) {
        emojiFileInputRef.current.value = '';
      }
    } catch (err: unknown) {
      setEmojiUploadError(
        err instanceof Error ? err.message : 'Failed to upload custom emoji.'
      );
    } finally {
      setUploadingEmoji(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="server-settings-modal-title"
    >
      <div className="w-full max-w-4xl max-h-[90vh] rounded-2xl bg-[#0E1320] border border-slate-800 shadow-2xl flex flex-col overflow-hidden">
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="server-settings-modal-title"
                className="text-base font-bold text-white truncate"
              >
                {server.name} — Server Roles, Permissions &amp; Emojis
              </h2>
              <p className="text-xs text-slate-400 truncate">
                Configure custom roles, role colors, granular permissions, member assignments &amp; custom `:shortcode:` emojis
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Server Settings Modal"
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 py-2.5 bg-[#090D16] border-b border-slate-800 flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('roles')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'roles'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Roles ({roles.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('members')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'members'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Members ({members.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('emojis')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'emojis'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
            }`}
          >
            <Smile className="w-3.5 h-3.5" />
            <span>Emojis ({customEmojis.length})</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* TAB 1: ROLES & PERMISSIONS */}
          {activeTab === 'roles' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Left Column: Role List & Create Role Form */}
              <div className="md:col-span-5 space-y-4">
                {canManageRoles && (
                  <form
                    onSubmit={handleCreateRole}
                    className="rounded-xl bg-[#090D16] border border-slate-800 p-3.5 space-y-3"
                  >
                    <div className="text-xs font-semibold text-white">
                      Create Custom Server Role
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={newRoleColor}
                        onChange={(e) => setNewRoleColor(e.target.value)}
                        aria-label="New role color"
                        className="w-8 h-8 rounded-lg bg-transparent border border-slate-700 cursor-pointer shrink-0"
                      />
                      <input
                        type="text"
                        value={newRoleName}
                        onChange={(e) => setNewRoleName(e.target.value)}
                        placeholder="e.g. Core Maintainer"
                        aria-label="New role name"
                        maxLength={32}
                        className="flex-1 rounded-lg bg-slate-950 border border-slate-800 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        type="submit"
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors cursor-pointer shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add</span>
                      </button>
                    </div>
                  </form>
                )}

                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-1">
                    Server Roles Hierarchy
                  </div>
                  {sortedRoles.map((role) => {
                    const isSelected = selectedRole?.id === role.id;
                    return (
                      <div
                        key={role.id}
                        className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border transition-colors ${
                          isSelected
                            ? 'bg-indigo-600/20 border-indigo-500/50 text-white'
                            : 'bg-[#090D16] border-slate-800/80 text-slate-300 hover:bg-slate-800/60'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedRoleId(role.id)}
                          className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
                        >
                          <span
                            className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/20"
                            style={{ backgroundColor: role.color }}
                          />
                          <span
                            className="text-xs font-semibold truncate"
                            style={{ color: role.color }}
                          >
                            {role.name}
                          </span>
                        </button>

                        {canManageRoles && roles.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleDeleteRole(role.id)}
                            aria-label={`Delete role ${role.name}`}
                            title="Delete Role"
                            className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Selected Role Editor & Permissions */}
              <div className="md:col-span-7">
                {selectedRole ? (
                  <div className="rounded-2xl bg-[#090D16] border border-slate-800 p-5 space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                      <div className="space-y-1 flex-1">
                        <label
                          htmlFor="edit-role-name-input"
                          className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400"
                        >
                          Role Display Name
                        </label>
                        <input
                          id="edit-role-name-input"
                          type="text"
                          disabled={!canManageRoles}
                          value={selectedRole.name}
                          onChange={(e) =>
                            handleUpdateSelectedRole({
                              name: e.target.value.slice(0, 32),
                            })
                          }
                          className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2 text-sm font-semibold text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                          Role Color
                        </span>
                        <div className="flex items-center gap-1.5">
                          {ROLE_COLOR_SWATCHES.map((hex) => (
                            <button
                              key={hex}
                              type="button"
                              disabled={!canManageRoles}
                              onClick={() => handleUpdateSelectedRole({ color: hex })}
                              aria-label={`Select role color ${hex}`}
                              className={`w-6 h-6 rounded-full border transition-transform cursor-pointer ${
                                selectedRole.color.toUpperCase() === hex
                                  ? 'scale-110 ring-2 ring-white border-white'
                                  : 'border-white/20 hover:scale-105'
                              }`}
                              style={{ backgroundColor: hex }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Granular Permissions Toggles */}
                    <div className="space-y-2.5">
                      <div className="text-xs font-semibold text-white">
                        Role Permissions Checklist
                      </div>
                      <div className="divide-y divide-slate-800/80 rounded-xl border border-slate-800 overflow-hidden">
                        {PERMISSION_METADATA.map((perm) => {
                          const enabled = Boolean(selectedRole.permissions[perm.key]);
                          return (
                            <div
                              key={perm.key}
                              className="flex items-center justify-between gap-4 px-4 py-3 bg-slate-950/60"
                            >
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-white">
                                  {perm.label}
                                </div>
                                <p className="text-[11px] text-slate-400">
                                  {perm.description}
                                </p>
                              </div>

                              <button
                                type="button"
                                role="switch"
                                aria-checked={enabled}
                                aria-label={`Toggle ${perm.label}`}
                                disabled={!canManageRoles}
                                onClick={() => handleTogglePermission(perm.key)}
                                className={`w-10 h-6 rounded-full transition-colors p-0.5 cursor-pointer shrink-0 ${
                                  enabled ? 'bg-emerald-500' : 'bg-slate-800'
                                }`}
                              >
                                <span
                                  className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${
                                    enabled ? 'translate-x-4' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {/* TAB 2: MEMBERS & ROLE ASSIGNMENT */}
          {activeTab === 'members' && (
            <div className="space-y-4">
              <div className="text-xs text-slate-400">
                Assign custom roles to members below. Members render with the color of their highest-positioned role in chat and the sidebar.
              </div>

              <div className="divide-y divide-slate-800 rounded-2xl bg-[#090D16] border border-slate-800 overflow-hidden">
                {members.map((member) => {
                  const assignedIds = memberRoles[member.id] || [];
                  const highestRole = getUserHighestRole(roles, assignedIds);
                  const memberIsFounder = isFounderUser(member);
                  const nameColor =
                    highestRole?.color || member.profileThemeColor || '#F8FAFC';

                  return (
                    <div
                      key={member.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 hover:bg-slate-900/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden"
                          style={{ backgroundColor: nameColor }}
                        >
                          {member.avatarUrl ? (
                            <img
                              src={member.avatarUrl}
                              alt={member.username}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span>{member.username.slice(0, 2).toUpperCase()}</span>
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className="text-sm font-bold truncate"
                              style={{ color: nameColor }}
                            >
                              {member.username}
                            </span>
                            <span className="text-xs font-mono text-slate-400">
                              #{member.discriminator}
                            </span>

                            {memberIsFounder && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-400/50 text-amber-300 text-[10px] font-bold shadow-xs">
                                <Crown className="w-3 h-3 text-amber-400" />
                                <span>👑 Founder &amp; Dev</span>
                              </span>
                            )}

                            {member.isLive && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/20 border border-rose-500/50 text-rose-300 text-[10px] font-bold animate-pulse">
                                <Radio className="w-3 h-3 text-rose-400" />
                                <span>🔴 LIVE</span>
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Highest Role:{' '}
                            <span className="font-semibold text-slate-200">
                              {highestRole ? highestRole.name : 'Community Member'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Role Assignment Pills + Kick Button */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {sortedRoles.map((role) => {
                          const hasRole = assignedIds.includes(role.id);
                          return (
                            <button
                              key={role.id}
                              type="button"
                              disabled={!canManageRoles}
                              onClick={() => handleToggleMemberRole(member.id, role.id)}
                              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                                hasRole
                                  ? 'bg-indigo-600/25 border-indigo-400/60 text-white'
                                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                              }`}
                            >
                              <span
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: role.color }}
                              />
                              <span>{role.name}</span>
                              {hasRole && <Check className="w-3 h-3 text-emerald-400" />}
                            </button>
                          );
                        })}

                        {canKickMembers &&
                          member.id !== currentUser.id &&
                          member.id !== server.ownerId && (
                            <button
                              type="button"
                              onClick={() => onKickMember(member.id)}
                              title={`Kick ${member.username}`}
                              aria-label={`Kick ${member.username}`}
                              className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-400 transition-colors cursor-pointer"
                            >
                              <UserX className="w-4 h-4" />
                            </button>
                          )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: CUSTOM SERVER EMOJIS */}
          {activeTab === 'emojis' && (
            <div className="space-y-5">
              {canManageEmojis && (
                <div className="rounded-2xl bg-[#090D16] border border-slate-800 p-4 space-y-3">
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Upload Custom Server Emoji (Static PNG/JPG or Animated GIF)
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Custom emojis can be used inline in chat via <code className="font-mono text-indigo-300">:shortcode:</code> and as message reactions.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                    <input
                      type="text"
                      value={newEmojiName}
                      onChange={(e) => {
                        setNewEmojiName(e.target.value);
                        if (emojiUploadError) setEmojiUploadError('');
                      }}
                      placeholder="shortcode_name (e.g. party_parrot)"
                      aria-label="New server emoji shortcode"
                      maxLength={32}
                      className="flex-1 rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                    <input
                      ref={emojiFileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                      onChange={handleEmojiFileUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={uploadingEmoji}
                      onClick={() => emojiFileInputRef.current?.click()}
                      className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors cursor-pointer shrink-0"
                    >
                      <Upload className="w-4 h-4" />
                      <span>{uploadingEmoji ? 'Uploading...' : 'Select Image / GIF'}</span>
                    </button>
                  </div>

                  {emojiUploadError && (
                    <p role="alert" className="text-xs text-rose-400">
                      {emojiUploadError}
                    </p>
                  )}
                </div>
              )}

              {customEmojis.length === 0 ? (
                <div className="rounded-2xl bg-[#090D16] border border-slate-800 p-8 text-center text-xs text-slate-400">
                  No custom emojis in this server yet. Upload one above!
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {customEmojis.map((emj) => (
                    <div
                      key={emj.id}
                      className="flex items-center justify-between gap-2 p-3 rounded-xl bg-[#090D16] border border-slate-800"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={emj.imageUrl}
                          alt={emj.name}
                          referrerPolicy="no-referrer"
                          className="w-8 h-8 object-contain shrink-0"
                        />
                        <span className="text-xs font-mono text-slate-200 truncate">
                          :{emj.name}:
                        </span>
                      </div>
                      {canManageEmojis && (
                        <button
                          type="button"
                          onClick={() => onDeleteCustomEmoji(emj.id)}
                          aria-label={`Delete emoji ${emj.name}`}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ServerSettingsModal;
