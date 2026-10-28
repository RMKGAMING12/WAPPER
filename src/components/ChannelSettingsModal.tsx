import React, { useEffect, useState } from 'react';
import {
  Hash,
  Volume2,
  X,
  Trash2,
  Save,
  AlertTriangle,
  Crown,
} from 'lucide-react';
import {
  collection,
  doc,
  getDocs,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import {
  ChannelItem,
  WapperProfile,
  sanitizeChannelName,
  sanitizeId,
} from '../utils/chatLogic';

export const FOUNDER_EMAIL_WHITELIST: readonly string[] = [
  'mayankraj.mfp23@gmail.com',
  'mayankraj.mfp26@gmail.com',
  'mayankraj.mfp29@gmail.com',
];

export const CHANNEL_CATEGORY_OPTIONS = [
  'Text Channels',
  'System & Stream Alerts',
  'Voice & Video P2P',
  'Engineering & Dev',
] as const;

interface ChannelSettingsModalProps {
  isOpen: boolean;
  channel: ChannelItem | null;
  currentUser: WapperProfile;
  serverOwnerId?: string;
  onClose: () => void;
  onUpdateChannel: (
    channelId: string,
    updates: { name: string; topic: string; category: string }
  ) => void;
  onDeleteChannel: (channelId: string) => void;
}

export const ChannelSettingsModal: React.FC<ChannelSettingsModalProps> = ({
  isOpen,
  channel,
  currentUser,
  serverOwnerId,
  onClose,
  onUpdateChannel,
  onDeleteChannel,
}) => {
  const authEmail = (auth.currentUser?.email || currentUser.email || '')
    .trim()
    .toLowerCase();
  const isFounder = FOUNDER_EMAIL_WHITELIST.includes(authEmail);
  const isServerOwner = Boolean(
    serverOwnerId &&
      (currentUser.id === serverOwnerId ||
        auth.currentUser?.uid === serverOwnerId)
  );
  const canManage = isServerOwner || isFounder;

  const [channelName, setChannelName] = useState('');
  const [channelCategory, setChannelCategory] = useState('Text Channels');
  const [channelTopic, setChannelTopic] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (channel) {
      setChannelName(channel.name);
      setChannelCategory(
        channel.category ||
          (channel.type === 'voice' ? 'Voice & Video P2P' : 'Text Channels')
      );
      setChannelTopic(channel.topic || '');
      setErrorMsg('');
      setShowDeleteConfirm(false);
    }
  }, [channel, isOpen]);

  if (!isOpen || !channel || !canManage) {
    return null;
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetChannel = channel;
    if (!targetChannel) return;

    const cleanName = sanitizeChannelName(
      channelName.trim(),
      targetChannel.type
    );
    if (!cleanName || cleanName.length < 2) {
      setErrorMsg('Channel name must be at least 2 characters long.');
      return;
    }

    const cleanCategory =
      channelCategory.trim().slice(0, 48) ||
      (targetChannel.type === 'voice' ? 'Voice & Video P2P' : 'Text Channels');
    const cleanTopic = channelTopic.trim().slice(0, 300);

    setIsSaving(true);
    setErrorMsg('');

    try {
      const currentServerId = sanitizeId(targetChannel.serverId);
      const channelId = sanitizeId(targetChannel.id);

      if (auth.currentUser && auth.currentUser.emailVerified) {
        const chanRef = doc(
          db,
          'servers',
          currentServerId,
          'channels',
          channelId
        );
        await updateDoc(chanRef, {
          name: cleanName,
          category: cleanCategory,
          topic: cleanTopic,
        });
      }

      onUpdateChannel(targetChannel.id, {
        name: cleanName,
        category: cleanCategory,
        topic: cleanTopic,
      });
      onClose();
    } catch (err) {
      console.error('Failed to update channel in Firestore:', err);
      onUpdateChannel(targetChannel.id, {
        name: cleanName,
        category: cleanCategory,
        topic: cleanTopic,
      });
      onClose();
      try {
        handleFirestoreError(
          err,
          OperationType.WRITE,
          `servers/${targetChannel.serverId}/channels/${targetChannel.id}`
        );
      } catch {
        // Structured Firestore error logged
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    const targetChannel = channel;
    if (!targetChannel || !canManage) return;

    setIsDeleting(true);
    setErrorMsg('');

    try {
      const currentServerId = sanitizeId(targetChannel.serverId);
      const channelId = sanitizeId(targetChannel.id);

      if (auth.currentUser && auth.currentUser.emailVerified) {
        // Delete any messages in the channel's messages subcollection first
        const messagesColRef = collection(
          db,
          'servers',
          currentServerId,
          'channels',
          channelId,
          'messages'
        );
        const messagesSnap = await getDocs(messagesColRef).catch(() => null);
        if (messagesSnap && !messagesSnap.empty) {
          for (const msgDoc of messagesSnap.docs) {
            await deleteDoc(
              doc(
                db,
                'servers',
                currentServerId,
                'channels',
                channelId,
                'messages',
                msgDoc.id
              )
            ).catch(() => {});
          }
        }

        // Direct Firestore channel document delete call
        await deleteDoc(
          doc(db, 'servers', currentServerId, 'channels', channelId)
        );
      }

      onDeleteChannel(targetChannel.id);
      onClose();
    } catch (err) {
      console.error('Failed to delete channel from Firestore:', err);
      onDeleteChannel(targetChannel.id);
      onClose();
      try {
        handleFirestoreError(
          err,
          OperationType.DELETE,
          `servers/${targetChannel.serverId}/channels/${targetChannel.id}`
        );
      } catch {
        // Structured Firestore error logged
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="channel-settings-title"
    >
      <div className="w-full max-w-lg rounded-2xl bg-[#0F172A] border border-slate-800 shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-[#090D16] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
              {channel.type === 'voice' ? (
                <Volume2 className="w-4 h-4" />
              ) : (
                <Hash className="w-4 h-4" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2
                  id="channel-settings-title"
                  className="text-sm font-bold text-white truncate"
                >
                  Channel Settings — {channel.type === 'text' ? '#' : ''}
                  {channel.name}
                </h2>
                {isFounder && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-[9px] font-bold text-amber-300">
                    <Crown className="w-2.5 h-2.5 text-amber-400" />
                    <span>👑 Founder &amp; Dev</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                {channelCategory} ·{' '}
                {channel.type === 'voice' ? 'Voice Channel' : 'Text Channel'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Channel Settings"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSave} className="p-6 space-y-5">
          {errorMsg && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Channel Name Field */}
          <div>
            <label
              htmlFor="edit-channel-name"
              className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider"
            >
              Channel Name
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3 text-slate-500 text-sm font-semibold select-none">
                {channel.type === 'text' ? '#' : '🔊'}
              </span>
              <input
                id="edit-channel-name"
                type="text"
                value={channelName}
                onChange={(e) => {
                  setChannelName(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                maxLength={64}
                required
                className="w-full rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 pl-8 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none"
                placeholder={channel.type === 'text' ? 'general' : 'Voice Lounge'}
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              {channel.type === 'text'
                ? 'Text channel names are automatically formatted with lowercase letters, hyphens, and numbers.'
                : 'Voice channel names support spaces and alphanumeric titles.'}
            </p>
          </div>

          {/* Channel Category / Metadata State Dropdown */}
          <div>
            <label
              htmlFor="edit-channel-category"
              className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider"
            >
              Channel Metadata Category
            </label>
            <select
              id="edit-channel-category"
              value={channelCategory}
              onChange={(e) => setChannelCategory(e.target.value)}
              className="w-full rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 px-3.5 py-2.5 text-xs text-white focus:outline-none cursor-pointer"
            >
              {CHANNEL_CATEGORY_OPTIONS.map((catOption) => (
                <option key={catOption} value={catOption}>
                  {catOption}
                </option>
              ))}
              {!CHANNEL_CATEGORY_OPTIONS.includes(
                channelCategory as (typeof CHANNEL_CATEGORY_OPTIONS)[number]
              ) && (
                <option value={channelCategory}>{channelCategory}</option>
              )}
            </select>
            <p className="mt-1 text-[11px] text-slate-500">
              Switch the channel section metadata synchronized across all connected clients.
            </p>
          </div>

          {/* Channel Topic Field */}
          <div>
            <label
              htmlFor="edit-channel-topic"
              className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider"
            >
              Channel Topic
            </label>
            <textarea
              id="edit-channel-topic"
              value={channelTopic}
              onChange={(e) => setChannelTopic(e.target.value)}
              maxLength={300}
              rows={3}
              placeholder="Let everyone know the purpose of this channel..."
              className="w-full rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none resize-none leading-relaxed"
            />
            <div className="flex justify-between text-[11px] text-slate-500 mt-1">
              <span>Shown at the top of the chat area.</span>
              <span>{channelTopic.length}/300</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
            {/* Danger Zone: Delete Channel */}
            {!showDeleteConfirm ? (
              <button
                type="button"
                data-testid="delete-channel-button"
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:text-white hover:bg-rose-500/20 border border-rose-500/30 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Channel</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-testid="confirm-delete-channel-button"
                  disabled={isDeleting}
                  onClick={handleDelete}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isDeleting ? 'Deleting...' : 'Confirm Delete'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Save / Cancel */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChannelSettingsModal;
