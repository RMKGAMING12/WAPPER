import React from 'react';
import {
  Sparkles,
  Crown,
  Bot,
  CornerUpLeft,
  Film,
  Shield,
  Radio,
  X,
  CheckCircle2,
} from 'lucide-react';

interface ChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const RELEASE_FEATURES = [
  {
    icon: Bot,
    badge: 'NEW BOTS & SLASH COMMANDS',
    accent: 'text-indigo-400 bg-indigo-500/15 border-indigo-500/30',
    title: 'Built-in Wapper Bots & Watch Together Mini-Player',
    items: [
      'Type `/` in any channel to open the Slash Command Autocomplete Popup.',
      '`/youtube [url or search]` summons YouTube Music Bot (✓ BOT) with an interactive YouTube player & a "🎵 Open in Shared Mini-Player" bar.',
      '`/live [url] [title]` summons Wapper Streamer Bot to post a glowing 🔴 LIVE NOW broadcast card and sets your profile badge to 🔴 LIVE.',
      '`/poll [question] | [option1] | [option2]`, `/8ball`, and `/roll` for interactive community voting and mini-games.',
    ],
  },
  {
    icon: CornerUpLeft,
    badge: 'REPLIES & REACTIONS',
    accent: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30',
    title: 'Discord-Style Message Replies (╭──) & Real-Time Reactions',
    items: [
      'Hover over any message to access Quick Reactions (❤️, 😂, 🔥, 👍), Add Reaction, Reply, Edit, and Delete.',
      'Replied messages display Discord’s signature curved connector line (╭──) with the original author’s mini avatar and clickable preview.',
      'Interactive reaction pills highlight in #5865F2 and sync in real time via Firebase Firestore.',
    ],
  },
  {
    icon: Film,
    badge: 'MEDIA & EMOJIS',
    accent: 'text-amber-300 bg-amber-500/15 border-amber-500/30',
    title: 'Enhanced Tenor GIFs, My Custom GIFs ⭐ & Server Emojis',
    items: [
      'Unified 3-tab picker: "Trending GIFs" (with Funny, Gaming, Reactions, Memes, Anime filters), "My Custom GIFs ⭐", and "Server Emojis".',
      'Click "⭐ Star" on any GIF in chat or the picker, or upload/paste custom .gif URLs directly into your Favorites.',
      'Upload static PNG/JPG or animated GIF custom server emojis with `:shortcode:` support in both chat and reactions.',
    ],
  },
  {
    icon: Shield,
    badge: 'ROLES & FOUNDER BADGE',
    accent: 'text-rose-300 bg-rose-500/15 border-rose-500/30',
    title: 'Server Role Manager, Permissions & Founder Crown Badge',
    items: [
      'Server Settings modal with custom Role creation, role colors, and granular permissions (ADMINISTRATOR, MANAGE_CHANNELS, MANAGE_ROLES, DELETE_MESSAGES, etc.).',
      'Global 👑 Founder & Dev golden crown badge automatically awarded to Wapper Creator & Architect Mayank Raj.',
      '100% Serverless Firebase Firestore operations — zero `/api/` backend dependencies for instant Vercel reliability.',
    ],
  },
];

export const ChangelogModal: React.FC<ChangelogModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="changelog-modal-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[88vh] rounded-2xl bg-[#0E1320] border border-slate-800 shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Top Banner Header */}
        <div className="relative px-6 py-5 bg-gradient-to-r from-indigo-950/90 via-[#111827] to-amber-950/40 border-b border-slate-800 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shadow-lg shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2
                  id="changelog-modal-title"
                  className="text-base font-bold text-white"
                >
                  What&apos;s New in Wapper v3.0
                </h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-400/50 text-amber-300 text-[10px] font-bold">
                  <Crown className="w-3 h-3 text-amber-400" />
                  <span>By Mayank Raj · Founder &amp; Dev</span>
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Built-in YouTube &amp; Streamer Bots, Message Replies &amp; Reactions, Custom GIFs ⭐, and Server Roles
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close What's New Changelog Modal"
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Feature Cards */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {RELEASE_FEATURES.map((section) => {
            const IconComponent = section.icon;
            return (
              <section
                key={section.title}
                className="rounded-2xl bg-[#090D16] border border-slate-800/90 p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-8 h-8 rounded-xl border flex items-center justify-center ${section.accent}`}
                    >
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-bold text-white">{section.title}</h3>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-md border text-[10px] font-mono font-bold ${section.accent}`}
                  >
                    {section.badge}
                  </span>
                </div>

                <ul className="space-y-1.5 pl-1">
                  {section.items.map((item, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 text-xs text-slate-300 leading-relaxed"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-[#090D16] border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Radio className="w-3.5 h-3.5 text-emerald-400" />
            <span>100% Free &amp; Open-Source · Serverless Firestore + P2P WebRTC</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors cursor-pointer"
          >
            Got It, Let&apos;s Chat!
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChangelogModal;
