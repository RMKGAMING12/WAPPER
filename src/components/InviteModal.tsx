import React, { useMemo, useState } from 'react';
import {
  UserPlus,
  Copy,
  Check,
  Link2,
  Hash,
  X,
  Share2,
  ShieldCheck,
} from 'lucide-react';
import { buildServerInviteLink } from '../utils/chatLogic';
import { ServerItem } from './Sidebar';

interface InviteModalProps {
  isOpen: boolean;
  server: ServerItem | undefined;
  onClose: () => void;
}

export const InviteModal: React.FC<InviteModalProps> = ({
  isOpen,
  server,
  onClose,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const inviteLink = useMemo(() => {
    if (!server) return '';
    const origin =
      typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    return buildServerInviteLink(origin, server.id);
  }, [server]);

  const shortInviteCode = useMemo(() => {
    if (!server) return '';
    return server.inviteCode || server.id;
  }, [server]);

  if (!isOpen || !server) return null;

  const handleCopyInviteLink = () => {
    navigator.clipboard?.writeText(inviteLink).catch(() => {});
    setCopiedLink(true);
    window.setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopyShortCode = () => {
    navigator.clipboard?.writeText(shortInviteCode).catch(() => {});
    setCopiedCode(true);
    window.setTimeout(() => setCopiedCode(false), 2500);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-people-modal-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-[#0F172A] border border-slate-800 p-6 shadow-2xl space-y-5">
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
              <UserPlus className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="invite-people-modal-title"
                className="text-base font-bold text-white truncate"
              >
                Invite Friends to {server.name}
              </h2>
              <p className="text-xs text-slate-400 truncate">
                Share this link so anyone can join your server in 1 click
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Invite Modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Shareable Full URL (`${window.location.origin}/?invite=${currentServer.id}`) */}
        <div className="space-y-2">
          <label
            htmlFor="server-invite-link-input"
            className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-300"
          >
            <Link2 className="w-3.5 h-3.5 text-indigo-400" />
            <span>Shareable Server Invite Link</span>
          </label>

          <div className="flex items-center gap-2 rounded-xl bg-slate-950 border border-slate-800 p-1.5 pl-3">
            <input
              id="server-invite-link-input"
              type="text"
              readOnly
              value={inviteLink}
              onClick={(e) => e.currentTarget.select()}
              aria-label="Shareable Server Invite Link"
              className="flex-1 bg-transparent text-xs font-mono text-indigo-200 focus:outline-none min-w-0"
            />
            <button
              type="button"
              onClick={handleCopyInviteLink}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                copiedLink
                  ? 'bg-emerald-600 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white'
              }`}
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Link</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Short Invite Code & Server ID */}
        <div className="rounded-xl bg-slate-900/70 border border-slate-800/90 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <Hash className="w-3.5 h-3.5 text-emerald-400" />
                <span>Short Invite Code / Server ID</span>
              </div>
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                <code className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-300">
                  {shortInviteCode}
                </code>
                {shortInviteCode !== server.id && (
                  <code className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-400">
                    ID: {server.id}
                  </code>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleCopyShortCode}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors cursor-pointer shrink-0"
            >
              {copiedCode ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Copied Code</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>Copy Code</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer Info */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-3 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Invite link never expires · Serverless Firestore sync</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default InviteModal;
