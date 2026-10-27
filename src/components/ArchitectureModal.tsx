import React, { useEffect, useState } from 'react';
import { Database, FileCode, Radio, X, Copy, Check, ShieldCheck, Lock } from 'lucide-react';
import { RTC_CONFIGURATION } from '../useWebRTC';
import { isFounderEmail } from '../utils/chatLogic';
import { auth } from '../firebase';

interface ArchitectureModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserEmail?: string | null;
}

const FALLBACK_SCHEMA_SQL = `-- =============================================================================
-- WAPPER — COMPLETE SECURE POSTGRESQL DATABASE SCHEMA (schema.sql)
-- Multi-Tenant Real-Time Architecture: Profiles, Friends Graph, Servers,
-- Granular Roles & Permissions, Channels, Messages & Custom Server Emojis
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. PROFILES (Extends Authenticated Google Accounts)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY,
  username VARCHAR(32) NOT NULL CHECK (char_length(trim(username)) >= 2),
  discriminator VARCHAR(4) NOT NULL DEFAULT '0001' CHECK (discriminator ~ '^[0-9]{4}$'),
  unique_tag VARCHAR(40) GENERATED ALWAYS AS (username || '#' || discriminator) STORED,
  email VARCHAR(255) UNIQUE,
  avatar_url TEXT NOT NULL DEFAULT '',
  banner_url TEXT NOT NULL DEFAULT '',
  banner_color VARCHAR(9) NOT NULL DEFAULT '#5865F2',
  bio TEXT NOT NULL DEFAULT '' CHECK (char_length(bio) <= 300),
  custom_status_text VARCHAR(128) NOT NULL DEFAULT '',
  custom_status_emoji VARCHAR(32) NOT NULL DEFAULT '',
  profile_theme_color VARCHAR(9) NOT NULL DEFAULT '#5865F2',
  status VARCHAR(16) NOT NULL DEFAULT 'online' CHECK (status IN ('online', 'idle', 'dnd', 'offline')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_profiles_username_discriminator UNIQUE (username, discriminator)
);

-- 2. SERVERS & COMMUNITIES
CREATE TABLE IF NOT EXISTS public.servers (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  description VARCHAR(300) NOT NULL DEFAULT '',
  icon_url TEXT NOT NULL DEFAULT '',
  invite_code VARCHAR(64) NOT NULL UNIQUE,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. SERVER ROLES & PERMISSIONS
CREATE TABLE IF NOT EXISTS public.server_roles (
  id VARCHAR(64) PRIMARY KEY,
  server_id VARCHAR(64) NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  name VARCHAR(40) NOT NULL,
  color VARCHAR(9) NOT NULL DEFAULT '#99AAB5',
  position INT NOT NULL DEFAULT 0,
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_hoisted BOOLEAN NOT NULL DEFAULT FALSE,
  is_mentionable BOOLEAN NOT NULL DEFAULT FALSE
);

-- 4. CHANNELS (TEXT & WEBRTC P2P VOICE)
CREATE TABLE IF NOT EXISTS public.channels (
  id VARCHAR(64) PRIMARY KEY,
  server_id VARCHAR(64) NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  name VARCHAR(64) NOT NULL,
  type VARCHAR(16) NOT NULL CHECK (type IN ('text', 'voice')),
  category VARCHAR(40) NOT NULL DEFAULT 'COMMUNITY CHANNELS',
  topic VARCHAR(256) NOT NULL DEFAULT '',
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. MESSAGES & DIRECT MESSAGES
CREATE TABLE IF NOT EXISTS public.messages (
  id VARCHAR(64) PRIMARY KEY,
  channel_id VARCHAR(64) NOT NULL,
  server_id VARCHAR(64) NOT NULL,
  conversation_id VARCHAR(128),
  sender_id UUID NOT NULL,
  receiver_id UUID,
  author_id UUID NOT NULL,
  author_name VARCHAR(64) NOT NULL,
  author_avatar TEXT NOT NULL DEFAULT '',
  author_email VARCHAR(255),
  author_role_color VARCHAR(9) NOT NULL DEFAULT '#5865F2',
  content TEXT NOT NULL DEFAULT '',
  gif_url TEXT,
  attachment_url TEXT,
  reply_to JSONB,
  reactions JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_bot BOOLEAN NOT NULL DEFAULT FALSE,
  bot_name VARCHAR(64),
  bot_embed JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. SOCIAL GRAPH & RELATIONSHIPS
CREATE TABLE IF NOT EXISTS public.friends (
  id VARCHAR(64) PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending_outgoing', 'pending_incoming', 'accepted', 'blocked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_friend_relationship UNIQUE (user_id, friend_id)
);`;

const FALLBACK_MANIFEST_JSON = `{
  "id": "/",
  "name": "Wapper — Open-Source P2P Voice, Video & Chat",
  "short_name": "Wapper",
  "description": "100% free, open-source Discord alternative with Peer-to-Peer WebRTC voice/video, real-time channels, custom emojis, and live GIFs.",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "any",
  "background_color": "#0B0F17",
  "theme_color": "#0F172A",
  "categories": ["social", "communication", "productivity"],
  "icons": [
    {
      "src": "/icon.svg",
      "sizes": "any",
      "type": "image/svg+xml",
      "purpose": "any"
    },
    {
      "src": "/pwa-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/pwa-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/pwa-maskable-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}`;

export const ArchitectureModal: React.FC<ArchitectureModalProps> = ({
  isOpen,
  onClose,
  currentUserEmail,
}) => {
  // CRITICAL STRUCTURAL SECURITY CHECK:
  // Must ONLY render if user email strictly matches one of the 3 whitelisted founder accounts.
  // For any other session, guest, or unauthorized user, returns null and NEVER injects DOM nodes.
  const effectiveEmail = currentUserEmail || auth.currentUser?.email;
  const isAuthorized = isFounderEmail(effectiveEmail);

  const [activeTab, setActiveTab] = useState<'sql' | 'manifest' | 'webrtc'>('sql');
  const [schemaSql, setSchemaSql] = useState<string>(FALLBACK_SCHEMA_SQL);
  const [manifestJson, setManifestJson] = useState<string>(FALLBACK_MANIFEST_JSON);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen || !isAuthorized) return;
    fetch('/api/architecture-files')
      .then((res) => {
        if (!res.ok) throw new Error('API unavailable');
        return res.json();
      })
      .then((data) => {
        if (data.schemaSql) setSchemaSql(data.schemaSql);
        if (data.manifestJson) setManifestJson(data.manifestJson);
      })
      .catch(() => {
        // Retain verified fallback constants when serverless on Vercel
      });
  }, [isOpen, isAuthorized]);

  if (!isOpen || !isAuthorized) {
    return null;
  }

  const activeCode =
    activeTab === 'sql'
      ? schemaSql
      : activeTab === 'manifest'
      ? manifestJson
      : JSON.stringify(RTC_CONFIGURATION, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(activeCode).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 select-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="arch-modal-title"
    >
      <div className="w-full max-w-3xl rounded-2xl bg-[#090D16] border border-amber-500/40 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Secure Founder-Only Encapsulated Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-gradient-to-r from-amber-500/10 via-[#0E1320] to-[#090D16] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 id="arch-modal-title" className="text-sm font-bold text-white truncate">
                  Founder &amp; Developer Infrastructure Console
                </h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-400/50 text-amber-300 text-[10px] font-bold">
                  <Lock className="w-2.5 h-2.5" />
                  <span>Whitelisted Access Only</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate mt-0.5">
                Encapsulated Database DDL, Schema Definitions &amp; PWA Manifest (Restricted to Founders)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Developer Console"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher & Code Copy Control */}
        <div className="px-6 pt-3 flex items-center justify-between border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('sql')}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                activeTab === 'sql'
                  ? 'border-amber-400 text-amber-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>schema.sql (PostgreSQL)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('manifest')}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                activeTab === 'manifest'
                  ? 'border-amber-400 text-amber-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>manifest.json (PWA)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('webrtc')}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                activeTab === 'webrtc'
                  ? 'border-amber-400 text-amber-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>WebRTC STUN Mesh</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className="mb-1.5 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors cursor-pointer border border-slate-700"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-amber-400" />}
            <span>{copied ? 'Copied' : 'Copy Code'}</span>
          </button>
        </div>

        {/* Encapsulated Code Block Content */}
        <div className="p-5 overflow-y-auto flex-1 bg-[#05070D]">
          <pre className="text-xs font-mono text-slate-300 leading-relaxed overflow-x-auto select-text">
            <code>{activeCode}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};

export default ArchitectureModal;
