/**
 * Pure, deterministic chat, markdown, validation, profile customization,
 * friend list state filtering, channel categorization, slash command parsing,
 * YouTube video ID extraction, role permissions, and founder badge detection
 * decoupled from React DOM components for fast unit testing.
 */

export interface MarkdownSegment {
  type: 'text' | 'bold' | 'italic' | 'code' | 'emoji' | 'link' | 'mention';
  value: string;
  emojiUrl?: string;
}

export interface MentionCandidate {
  id: string;
  username: string;
  email?: string;
  uniqueTag?: string;
  avatarUrl?: string;
  status?: PresenceStatus;
  roleColor?: string;
  customStatusEmoji?: string;
  customStatusText?: string;
}

export interface ActiveMentionTrigger {
  active: boolean;
  query: string;
  startIndex: number;
  endIndex: number;
}

export interface ChannelItem {
  id: string;
  serverId: string;
  name: string;
  type: 'text' | 'voice';
  category: string;
  topic: string;
}

export type PresenceStatus = 'online' | 'idle' | 'dnd' | 'offline';

export type FriendRelationshipStatus =
  | 'pending_incoming'
  | 'pending_outgoing'
  | 'accepted'
  | 'blocked';

export type FriendsTabType = 'online' | 'all' | 'pending' | 'blocked' | 'add';

export type RolePermissionKey =
  | 'ADMINISTRATOR'
  | 'MANAGE_CHANNELS'
  | 'MANAGE_ROLES'
  | 'MANAGE_EMOJIS'
  | 'KICK_MEMBERS'
  | 'SEND_MESSAGES'
  | 'DELETE_MESSAGES';

export interface ServerRolePermissions {
  ADMINISTRATOR: boolean;
  MANAGE_CHANNELS: boolean;
  MANAGE_ROLES: boolean;
  MANAGE_EMOJIS: boolean;
  KICK_MEMBERS: boolean;
  SEND_MESSAGES: boolean;
  DELETE_MESSAGES: boolean;
}

export interface ServerRole {
  id: string;
  name: string;
  color: string;
  position: number;
  permissions: ServerRolePermissions;
}

export interface RichPresenceActivity {
  name: string;
  details: string;
  state: string;
  assetUrl: string;
  startedAt: number | null;
  isShowing: boolean;
}

export interface RichPresenceAssetPreset {
  id: string;
  label: string;
  defaultActivityName: string;
  defaultDetails: string;
  defaultState: string;
  assetUrl: string;
}

export interface WapperProfile {
  id: string;
  username: string;
  discriminator: string;
  uniqueTag: string;
  email?: string;
  avatarUrl: string;
  bannerUrl: string;
  bannerColor: string;
  bio: string;
  customStatusText: string;
  customStatusEmoji: string;
  profileThemeColor: string;
  status: PresenceStatus;
  isMuted?: boolean;
  isDeafened?: boolean;
  activeVoiceChannelId?: string | null;
  isLive?: boolean;
  liveStreamUrl?: string;
  liveStreamTitle?: string;
  richPresence?: RichPresenceActivity;
  createdAt: string;
  updatedAt: string;
}

export interface FriendRelationshipItem {
  id: string;
  userId: string;
  friendId: string;
  status: FriendRelationshipStatus;
  createdAt: string;
  updatedAt: string;
}

export interface HydratedFriendItem {
  relationshipId: string;
  userId: string;
  friendId: string;
  relationshipStatus: FriendRelationshipStatus;
  profile: WapperProfile;
  updatedAt: string;
}

export interface MessageReplyMetadata {
  messageId: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  contentPreview: string;
}

export interface BotEmbedPayload {
  embedType:
    | 'youtube'
    | 'live'
    | 'poll'
    | '8ball'
    | 'roll'
    | 'youtube_live_alert'
    | 'youtube_upload_alert';
  botName: string;
  botBadgeText: string;
  title: string;
  description?: string;
  youtubeVideoId?: string;
  streamUrl?: string;
  streamerName?: string;
  channelName?: string;
  youtubeChannelId?: string;
  alertHeader?: '🔴 GO LIVE ALERT' | '🆕 NEW VIDEO UPLOAD';
  isLiveStream?: boolean;
  publishedAt?: string;
  pollQuestion?: string;
  pollOptions?: string[];
  accentColor?: string;
}

export interface YouTubeBotConfig {
  enabled: boolean;
  channelId: string;
  channelName: string;
  targetChannelId: string;
  targetChannelName: string;
  feedUrl: string;
  hubUrl: string;
  connectedByEmail: string;
  lastSyncedVideoId?: string;
  updatedAt: string;
}

export interface YouTubePubSubEntry {
  videoId: string;
  channelId: string;
  channelName: string;
  title: string;
  videoUrl: string;
  publishedAt: string;
  isLiveStream: boolean;
}

export interface SlashCommandDefinition {
  command: string;
  usage: string;
  botName: string;
  description: string;
  sample: string;
}

export const SLASH_COMMANDS: SlashCommandDefinition[] = [
  {
    command: '/youtube',
    usage: '/youtube [url or search]',
    botName: 'YouTube Music Bot',
    description:
      'Embed a playable YouTube video/music player in chat & pin to Watch Together mini-player.',
    sample: '/youtube https://www.youtube.com/watch?v=jfKfPfyJRdk',
  },
  {
    command: '/live',
    usage: '/live [youtube/twitch url] [stream title]',
    botName: 'Wapper Streamer Bot',
    description:
      'Post a glowing 🔴 LIVE NOW announcement card with an embedded stream player & set your LIVE badge.',
    sample: '/live https://www.youtube.com/watch?v=jfKfPfyJRdk Building Wapper v3 Live!',
  },
  {
    command: '/poll',
    usage: '/poll [question] | [option1] | [option2]',
    botName: 'Wapper Poll Bot',
    description:
      'Create a real-time interactive voting card with auto-reactions (1️⃣, 2️⃣, 3️⃣, 4️⃣).',
    sample: '/poll Best P2P Feature? | Watch Together YouTube | Live Streamer Mode',
  },
  {
    command: '/8ball',
    usage: '/8ball [question]',
    botName: 'Wapper Bot',
    description: 'Ask the mystic 8-Ball a question for an instant server prediction.',
    sample: '/8ball Will our squad win tonight?',
  },
  {
    command: '/roll',
    usage: '/roll [max]',
    botName: 'Wapper Bot',
    description: 'Roll a 100-sided die (or custom max) for the channel.',
    sample: '/roll 100',
  },
];

export const DEFAULT_SERVER_ROLES: ServerRole[] = [
  {
    id: 'role_founder_admin',
    name: 'Admin & Architect',
    color: '#F59E0B',
    position: 100,
    permissions: {
      ADMINISTRATOR: true,
      MANAGE_CHANNELS: true,
      MANAGE_ROLES: true,
      MANAGE_EMOJIS: true,
      KICK_MEMBERS: true,
      SEND_MESSAGES: true,
      DELETE_MESSAGES: true,
    },
  },
  {
    id: 'role_moderator',
    name: 'Moderator',
    color: '#10B981',
    position: 60,
    permissions: {
      ADMINISTRATOR: false,
      MANAGE_CHANNELS: true,
      MANAGE_ROLES: false,
      MANAGE_EMOJIS: true,
      KICK_MEMBERS: true,
      SEND_MESSAGES: true,
      DELETE_MESSAGES: true,
    },
  },
  {
    id: 'role_streamer',
    name: 'Verified Streamer',
    color: '#EC4899',
    position: 40,
    permissions: {
      ADMINISTRATOR: false,
      MANAGE_CHANNELS: false,
      MANAGE_ROLES: false,
      MANAGE_EMOJIS: true,
      KICK_MEMBERS: false,
      SEND_MESSAGES: true,
      DELETE_MESSAGES: false,
    },
  },
  {
    id: 'role_member',
    name: 'Community Member',
    color: '#5865F2',
    position: 10,
    permissions: {
      ADMINISTRATOR: false,
      MANAGE_CHANNELS: false,
      MANAGE_ROLES: false,
      MANAGE_EMOJIS: false,
      KICK_MEMBERS: false,
      SEND_MESSAGES: true,
      DELETE_MESSAGES: false,
    },
  },
];

export const BLUEPRINT_LIMITS = {
  ID_MAX_LEN: 128,
  ID_REGEX: /^[a-zA-Z0-9_-]+$/,
  USERNAME_MIN_LEN: 2,
  USERNAME_MAX_LEN: 32,
  DISCRIMINATOR_REGEX: /^[0-9]{4}$/,
  BIO_MAX_LEN: 300,
  CUSTOM_STATUS_TEXT_MAX_LEN: 128,
  CUSTOM_STATUS_EMOJI_MAX_LEN: 32,
  HEX_COLOR_REGEX: /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/,
  SERVER_NAME_MAX_LEN: 80,
  CHANNEL_NAME_MAX_LEN: 64,
  MESSAGE_CONTENT_MAX_LEN: 4000,
  EMOJI_NAME_MIN_LEN: 2,
  EMOJI_NAME_MAX_LEN: 32,
  EMOJI_NAME_REGEX: /^[a-zA-Z0-9_]+$/,
};

export function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, BLUEPRINT_LIMITS.ID_MAX_LEN);
  return cleaned || `id_${Date.now()}`;
}

export function normalizeHexColor(raw: string, fallback = '#5865F2'): string {
  const trimmed = (raw || '').trim();
  if (BLUEPRINT_LIMITS.HEX_COLOR_REGEX.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  return fallback;
}

export function formatUniqueTag(username: string, discriminator: string): string {
  const cleanName = username.trim().slice(0, BLUEPRINT_LIMITS.USERNAME_MAX_LEN) || 'WapperUser';
  const cleanDisc = BLUEPRINT_LIMITS.DISCRIMINATOR_REGEX.test(discriminator)
    ? discriminator
    : '0001';
  return `${cleanName}#${cleanDisc}`;
}

export const FOUNDER_WHITELISTED_EMAILS = [
  'mayankraj.mfp23@gmail.com',
  'mayankraj.mfp26@gmail.com',
  'mayankraj.mfp29@gmail.com',
] as const;

/**
 * Checks whether an email matches any of the three whitelisted founder/developer addresses.
 */
export function isFounderEmail(email?: string | null): boolean {
  if (!email || typeof email !== 'string') return false;
  const normalized = email.trim().toLowerCase();
  return (
    normalized === 'mayankraj.mfp23@gmail.com' ||
    normalized === 'mayankraj.mfp26@gmail.com' ||
    normalized === 'mayankraj.mfp29@gmail.com'
  );
}

/**
 * Strict email-based verification for Founder & Developer status.
 * CRITICAL SECURITY FIX: All username/display name string checks have been completely removed.
 * A user is recognized as a Founder/Developer ONLY if their authenticated email
 * strictly matches one of the three whitelisted addresses:
 * - mayankraj.mfp23@gmail.com
 * - mayankraj.mfp26@gmail.com
 * - mayankraj.mfp29@gmail.com
 *
 * If someone creates an account named "Mayank raj" with a different email,
 * they will NOT receive the badge or any privileges.
 */
export function isFounderUser(user?: {
  email?: string | null;
  username?: string | null;
  id?: string | null;
} | null): boolean {
  if (!user) return false;
  return isFounderEmail(user.email);
}

/**
 * Extracts an 11-character YouTube Video ID from standard watch URLs, short `youtu.be/`
 * links, `/live/` URLs, `/embed/` URLs, `/shorts/` URLs, or maps search keywords
 * to a curated playable YouTube stream ID so `/youtube [search]` works immediately.
 */
export function extractYouTubeVideoId(rawInput: string): {
  videoId: string;
  canonicalUrl: string;
  isSearchFallback: boolean;
} {
  const trimmed = (rawInput || '').trim();

  // Direct 11-char video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return {
      videoId: trimmed,
      canonicalUrl: `https://www.youtube.com/watch?v=${trimmed}`,
      isSearchFallback: false,
    };
  }

  // Regex for youtube.com/watch?v=, youtu.be/, youtube.com/live/, youtube.com/embed/, youtube.com/shorts/
  const patterns = [
    /(?:youtube\.com\/watch\?[^\s]*v=)([a-zA-Z0-9_-]{11})/i,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/i,
    /(?:youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/i,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/i,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/i,
  ];

  for (const regex of patterns) {
    const match = trimmed.match(regex);
    if (match && match[1]) {
      return {
        videoId: match[1],
        canonicalUrl: `https://www.youtube.com/watch?v=${match[1]}`,
        isSearchFallback: false,
      };
    }
  }

  // Keyword-based playable YouTube Music / Stream catalog for search queries
  const q = trimmed.toLowerCase();
  if (q.includes('synth') || q.includes('cyber') || q.includes('retro')) {
    return {
      videoId: '4xDzrJKXOOY',
      canonicalUrl: 'https://www.youtube.com/watch?v=4xDzrJKXOOY',
      isSearchFallback: true,
    };
  }
  if (q.includes('jazz') || q.includes('coffee') || q.includes('piano')) {
    return {
      videoId: 'Dx5qFachd3A',
      canonicalUrl: 'https://www.youtube.com/watch?v=Dx5qFachd3A',
      isSearchFallback: true,
    };
  }
  if (q.includes('rock') || q.includes('rick') || q.includes('pop')) {
    return {
      videoId: 'dQw4w9WgXcQ',
      canonicalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      isSearchFallback: true,
    };
  }

  // Default to Lofi Girl 24/7 radio stream for general music/search queries
  return {
    videoId: 'jfKfPfyJRdk',
    canonicalUrl: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
    isSearchFallback: true,
  };
}

/**
 * Filters built-in slash commands when the user types `/` in the chat composer.
 */
export function filterSlashCommands(rawInput: string): SlashCommandDefinition[] {
  if (!rawInput.startsWith('/')) return [];
  const token = rawInput.split(/\s+/)[0].toLowerCase();
  return SLASH_COMMANDS.filter((item) => item.command.startsWith(token));
}

const EIGHT_BALL_ANSWERS = [
  'It is certain — 100% confirmed!',
  'Without a doubt, ship it to production!',
  'Yes — the P2P mesh aligns in your favor.',
  'Most likely! All signs point to yes.',
  'Outlook good — zero latency ahead.',
  'Ask again after one more commit.',
  'Cannot predict now, compiling shaders...',
  'Don’t count on it — merge conflict detected.',
];

/**
 * Parses and executes a built-in Wapper Slash Command (`/youtube`, `/live`, `/poll`, `/8ball`, `/roll`).
 * Returns null if the input is a regular chat message.
 */
export function executeSlashCommand(
  rawInput: string,
  caller: { id: string; username: string },
  deterministicSeed?: number
): {
  isSlashCommand: boolean;
  error?: string;
  botName?: string;
  botAvatar?: string;
  botRoleColor?: string;
  content?: string;
  botEmbed?: BotEmbedPayload;
  initialReactions?: Record<string, string[]>;
  liveStatusUpdate?: {
    isLive: boolean;
    liveStreamUrl: string;
    liveStreamTitle: string;
  };
} {
  const trimmed = (rawInput || '').trim();
  if (!trimmed.startsWith('/')) {
    return { isSlashCommand: false };
  }

  const spaceIdx = trimmed.indexOf(' ');
  const cmd = (spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx)).toLowerCase();
  const args = spaceIdx === -1 ? '' : trimmed.slice(spaceIdx + 1).trim();

  if (cmd === '/youtube' || cmd === '/yt') {
    if (!args) {
      return {
        isSlashCommand: true,
        error: 'Usage: /youtube [YouTube URL or search query]',
      };
    }
    const extracted = extractYouTubeVideoId(args);
    const title = extracted.isSearchFallback
      ? `YouTube Music Stream: "${args.slice(0, 80)}"`
      : `YouTube Watch Together (${extracted.videoId})`;

    return {
      isSlashCommand: true,
      botName: 'YouTube Music Bot',
      botAvatar: '',
      botRoleColor: '#FF0000',
      content: `🎵 **${caller.username}** summoned **YouTube Music Bot** — *${title}*`,
      botEmbed: {
        embedType: 'youtube',
        botName: 'YouTube Music Bot',
        botBadgeText: '✓ BOT',
        title,
        description:
          'Play directly inside chat or pin to the Shared Watch Together Mini-Player above the channel.',
        youtubeVideoId: extracted.videoId,
        streamUrl: extracted.canonicalUrl,
        streamerName: caller.username,
        accentColor: '#EF4444',
      },
      initialReactions: {
        '🎵': [caller.id],
        '🔥': [caller.id],
      },
    };
  }

  if (cmd === '/live') {
    if (!args) {
      return {
        isSlashCommand: true,
        error: 'Usage: /live [youtube/twitch url] [stream title]',
      };
    }
    const parts = args.split(/\s+/);
    const firstToken = parts[0] || '';
    const isUrlToken =
      firstToken.startsWith('http://') ||
      firstToken.startsWith('https://') ||
      firstToken.includes('youtube.com') ||
      firstToken.includes('youtu.be') ||
      firstToken.includes('twitch.tv');

    const streamUrlInput = isUrlToken
      ? firstToken
      : 'https://www.youtube.com/watch?v=jfKfPfyJRdk';
    const streamTitle =
      (isUrlToken ? parts.slice(1).join(' ') : args).trim() ||
      `${caller.username}'s Live Broadcast`;

    const extracted = extractYouTubeVideoId(streamUrlInput);

    return {
      isSlashCommand: true,
      botName: 'Wapper Streamer Bot',
      botAvatar: '',
      botRoleColor: '#F43F5E',
      content: `🔴 **LIVE NOW** — **${caller.username}** is streaming: **${streamTitle}**!`,
      botEmbed: {
        embedType: 'live',
        botName: 'Wapper Streamer Bot',
        botBadgeText: '✓ BOT',
        title: streamTitle.slice(0, 120),
        description: `${caller.username} went live! Watch the stream right here or pop out the Shared Mini-Player.`,
        youtubeVideoId: extracted.videoId,
        streamUrl: streamUrlInput,
        streamerName: caller.username,
        accentColor: '#F43F5E',
      },
      initialReactions: {
        '🔴': [caller.id],
        '🔥': [caller.id],
      },
      liveStatusUpdate: {
        isLive: true,
        liveStreamUrl: streamUrlInput,
        liveStreamTitle: streamTitle.slice(0, 120),
      },
    };
  }

  if (cmd === '/poll') {
    if (!args) {
      return {
        isSlashCommand: true,
        error: 'Usage: /poll [question] | [option1] | [option2]',
      };
    }
    const segments = args
      .split('|')
      .map((s) => s.trim())
      .filter(Boolean);

    const question = segments[0] || 'Server Community Poll';
    const options =
      segments.length >= 3
        ? segments.slice(1, 5)
        : ['Yes / Approve', 'No / Pass'];

    const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];
    const initialReactions: Record<string, string[]> = {};
    options.forEach((_opt, idx) => {
      const emoji = numberEmojis[idx];
      if (emoji) {
        initialReactions[emoji] = [caller.id];
      }
    });

    return {
      isSlashCommand: true,
      botName: 'Wapper Poll Bot',
      botAvatar: '',
      botRoleColor: '#5865F2',
      content: `📊 **Community Poll by ${caller.username}**: **${question}**`,
      botEmbed: {
        embedType: 'poll',
        botName: 'Wapper Poll Bot',
        botBadgeText: '✓ BOT',
        title: question.slice(0, 160),
        description: 'Click a numbered reaction below to cast your real-time vote!',
        pollQuestion: question.slice(0, 160),
        pollOptions: options.map((o) => o.slice(0, 100)),
        accentColor: '#5865F2',
      },
      initialReactions,
    };
  }

  if (cmd === '/8ball') {
    const question = args || 'Will our code compile on the first try?';
    const seed =
      deterministicSeed !== undefined
        ? deterministicSeed
        : question.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const answer = EIGHT_BALL_ANSWERS[Math.abs(seed) % EIGHT_BALL_ANSWERS.length];

    return {
      isSlashCommand: true,
      botName: 'Wapper Bot',
      botAvatar: '',
      botRoleColor: '#8B5CF6',
      content: `🎱 **${caller.username}** asked: *"${question}"*\n**Magic 8-Ball says:** **${answer}**`,
      botEmbed: {
        embedType: '8ball',
        botName: 'Wapper Bot',
        botBadgeText: '✓ BOT',
        title: `🎱 ${answer}`,
        description: `Question from @${caller.username}: "${question}"`,
        accentColor: '#8B5CF6',
      },
      initialReactions: {
        '🎱': [caller.id],
      },
    };
  }

  if (cmd === '/roll') {
    const parsedMax = parseInt(args, 10);
    const max = Number.isFinite(parsedMax) && parsedMax > 1 ? Math.min(parsedMax, 1000000) : 100;
    const rolled =
      deterministicSeed !== undefined
        ? (Math.abs(deterministicSeed) % max) + 1
        : Math.floor(Math.random() * max) + 1;

    return {
      isSlashCommand: true,
      botName: 'Wapper Bot',
      botAvatar: '',
      botRoleColor: '#10B981',
      content: `🎲 **${caller.username}** rolled a **${rolled}** (1–${max})!`,
      botEmbed: {
        embedType: 'roll',
        botName: 'Wapper Bot',
        botBadgeText: '✓ BOT',
        title: `🎲 Rolled ${rolled} / ${max}`,
        description: `${caller.username} rolled a ${max}-sided die.`,
        accentColor: '#10B981',
      },
      initialReactions: {
        '🎲': [caller.id],
      },
    };
  }

  return {
    isSlashCommand: false,
  };
}

/**
 * Returns the highest-positioned role assigned to a member, or null if none.
 */
export function getUserHighestRole(
  roles: ServerRole[] = [],
  memberRoleIds: string[] = []
): ServerRole | null {
  if (!roles.length || !memberRoleIds.length) return null;
  const idSet = new Set(memberRoleIds);
  const matching = roles.filter((r) => idSet.has(r.id));
  if (matching.length === 0) return null;
  return matching.sort((a, b) => b.position - a.position)[0];
}

/**
 * Evaluates whether a user has a specific permission in the server.
 * Server owners, Founder accounts, and users with ADMINISTRATOR always return true.
 */
export function hasServerPermission(params: {
  serverOwnerId: string;
  user?: { id: string; username?: string; email?: string } | null;
  roles?: ServerRole[];
  memberRoleIds?: string[];
  permission: RolePermissionKey;
}): boolean {
  const { serverOwnerId, user, roles = [], memberRoleIds = [], permission } = params;
  if (!user) return false;
  if (user.id === serverOwnerId || isFounderUser(user)) return true;

  const assignedSet = new Set(memberRoleIds);
  for (const role of roles) {
    if (!assignedSet.has(role.id)) continue;
    if (role.permissions.ADMINISTRATOR || role.permissions[permission]) {
      return true;
    }
  }
  return false;
}

export function parseFriendTagInput(rawInput: string): {
  valid: boolean;
  usernameQuery: string;
  discriminatorQuery: string | null;
  error?: string;
} {
  const trimmed = (rawInput || '').trim().replace(/^@/, '');
  if (!trimmed) {
    return {
      valid: false,
      usernameQuery: '',
      discriminatorQuery: null,
      error: 'Please enter a username or unique tag (e.g. username#1234).',
    };
  }

  if (trimmed.includes('#')) {
    const parts = trimmed.split('#');
    if (parts.length !== 2) {
      return {
        valid: false,
        usernameQuery: '',
        discriminatorQuery: null,
        error: 'Use the format username#1234.',
      };
    }
    const [namePart, discPart] = parts.map((p) => p.trim());
    if (namePart.length < BLUEPRINT_LIMITS.USERNAME_MIN_LEN) {
      return {
        valid: false,
        usernameQuery: namePart,
        discriminatorQuery: discPart,
        error: 'Username before # must be at least 2 characters.',
      };
    }
    if (!BLUEPRINT_LIMITS.DISCRIMINATOR_REGEX.test(discPart)) {
      return {
        valid: false,
        usernameQuery: namePart,
        discriminatorQuery: discPart,
        error: 'Tag after # must be a 4-digit number (e.g. #0104).',
      };
    }
    return {
      valid: true,
      usernameQuery: namePart,
      discriminatorQuery: discPart,
    };
  }

  if (trimmed.length < BLUEPRINT_LIMITS.USERNAME_MIN_LEN) {
    return {
      valid: false,
      usernameQuery: trimmed,
      discriminatorQuery: null,
      error: 'Username must be at least 2 characters.',
    };
  }

  return {
    valid: true,
    usernameQuery: trimmed,
    discriminatorQuery: null,
  };
}

export const RICH_PRESENCE_ASSET_PRESETS: RichPresenceAssetPreset[] = [
  {
    id: 'valorant',
    label: 'Valorant (Tactical FPS)',
    defaultActivityName: 'Playing Valorant',
    defaultDetails: 'Competitive Match',
    defaultState: 'In a Lobby (3 of 5)',
    assetUrl:
      "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23FF4655'/%3E%3Cpath d='M14 18v15l14 17h10L14 18zm36 0L34 38h10l6-7V18z' fill='%23FFFFFF'/%3E%3C/svg%3E",
  },
  {
    id: 'vscode',
    label: 'Visual Studio Code',
    defaultActivityName: 'Coding in VS Code',
    defaultDetails: 'Editing App.tsx',
    defaultState: 'Workspace: Wapper v3',
    assetUrl:
      "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23007ACC'/%3E%3Cpath d='M44 12L24 30l-9-7-5 3v12l5 3 9-7 20 18 10-5V17l-10-5zm0 29L31 32l13-9v18z' fill='%23FFFFFF'/%3E%3C/svg%3E",
  },
  {
    id: 'minecraft',
    label: 'Minecraft (Survival)',
    defaultActivityName: 'Playing Minecraft',
    defaultDetails: 'Survival Multiplayer',
    defaultState: 'Exploring the End Dimension',
    assetUrl:
      "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%2310B981'/%3E%3Crect x='14' y='18' width='12' height='12' fill='%23064E3B'/%3E%3Crect x='38' y='18' width='12' height='12' fill='%23064E3B'/%3E%3Crect x='26' y='30' width='12' height='10' fill='%23064E3B'/%3E%3Crect x='20' y='36' width='24' height='12' fill='%23064E3B'/%3E%3C/svg%3E",
  },
  {
    id: 'spotify',
    label: 'Spotify Music',
    defaultActivityName: 'Listening to Spotify',
    defaultDetails: 'Synthwave & Lo-Fi Beats',
    defaultState: 'In a Jam Session',
    assetUrl:
      "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%231DB954'/%3E%3Cpath d='M16 24c11-3 23-2 32 3M19 33c9-2 19-1 26 3M21 42c7-2 14-1 20 2' stroke='%230B0F19' stroke-width='4.5' stroke-linecap='round' fill='none'/%3E%3C/svg%3E",
  },
  {
    id: 'cs2',
    label: 'Counter-Strike 2',
    defaultActivityName: 'Playing Counter-Strike 2',
    defaultDetails: 'Premier Competitive',
    defaultState: 'Mirage · Score 11-8',
    assetUrl:
      "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23F59E0B'/%3E%3Ccircle cx='32' cy='32' r='16' stroke='%230B0F19' stroke-width='4' fill='none'/%3E%3Cpath d='M32 10v10M32 44v10M10 32h10M44 32h10' stroke='%230B0F19' stroke-width='4' stroke-linecap='round'/%3E%3C/svg%3E",
  },
];

export function sanitizeRichPresence(
  input?: Partial<RichPresenceActivity> | null
): RichPresenceActivity {
  const defaultAsset = RICH_PRESENCE_ASSET_PRESETS[0].assetUrl;
  if (!input || typeof input !== 'object') {
    return {
      name: '',
      details: '',
      state: '',
      assetUrl: defaultAsset,
      startedAt: null,
      isShowing: false,
    };
  }

  const name = typeof input.name === 'string' ? input.name.trim().slice(0, 80) : '';
  const details =
    typeof input.details === 'string' ? input.details.trim().slice(0, 128) : '';
  const state =
    typeof input.state === 'string' ? input.state.trim().slice(0, 128) : '';
  const rawAsset =
    typeof input.assetUrl === 'string' ? input.assetUrl.trim().slice(0, 50000) : '';
  const assetUrl = rawAsset || defaultAsset;

  const rawStartedAt = input.startedAt;
  const startedAt =
    typeof rawStartedAt === 'number' && Number.isFinite(rawStartedAt) && rawStartedAt > 0
      ? Math.floor(rawStartedAt)
      : null;

  const isShowing = Boolean(input.isShowing) && name.length > 0;

  return {
    name,
    details,
    state,
    assetUrl,
    startedAt,
    isShowing,
  };
}

export function isRichPresenceActive(
  richPresence?: RichPresenceActivity | null
): boolean {
  return Boolean(
    richPresence &&
      richPresence.isShowing &&
      typeof richPresence.name === 'string' &&
      richPresence.name.trim().length > 0
  );
}

/**
 * Formats the elapsed duration between `startedAt` and `nowMs` into a Discord-style
 * live timer string such as `"05:14 elapsed"` or `"01:05:14 elapsed"`.
 */
export function formatRichPresenceElapsed(
  startedAt?: number | null,
  nowMs: number = Date.now()
): string {
  if (
    typeof startedAt !== 'number' ||
    !Number.isFinite(startedAt) ||
    startedAt <= 0
  ) {
    return '';
  }

  const totalSeconds = Math.max(0, Math.floor((nowMs - startedAt) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');

  if (hours > 0) {
    const hh = String(hours).padStart(2, '0');
    return `${hh}:${mm}:${ss} elapsed`;
  }

  return `${mm}:${ss} elapsed`;
}

export function sanitizeProfileUpdate(input: {
  username?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  bannerColor?: string;
  bio?: string;
  customStatusText?: string;
  customStatusEmoji?: string;
  profileThemeColor?: string;
  richPresence?: Partial<RichPresenceActivity> | null;
}): {
  valid: boolean;
  error?: string;
  sanitized: {
    username?: string;
    avatarUrl?: string;
    bannerUrl?: string;
    bannerColor?: string;
    bio?: string;
    customStatusText?: string;
    customStatusEmoji?: string;
    profileThemeColor?: string;
    richPresence?: RichPresenceActivity;
  };
} {
  const sanitized: {
    username?: string;
    avatarUrl?: string;
    bannerUrl?: string;
    bannerColor?: string;
    bio?: string;
    customStatusText?: string;
    customStatusEmoji?: string;
    profileThemeColor?: string;
    richPresence?: RichPresenceActivity;
  } = {};

  if (input.username !== undefined) {
    const cleanName = input.username
      .trim()
      .replace(/#/g, '')
      .slice(0, BLUEPRINT_LIMITS.USERNAME_MAX_LEN);
    if (cleanName.length < BLUEPRINT_LIMITS.USERNAME_MIN_LEN) {
      return {
        valid: false,
        error: 'Username must be between 2 and 32 characters.',
        sanitized: {},
      };
    }
    sanitized.username = cleanName;
  }

  if (input.avatarUrl !== undefined) {
    sanitized.avatarUrl = input.avatarUrl.trim().slice(0, 500000);
  }
  if (input.bannerUrl !== undefined) {
    sanitized.bannerUrl = input.bannerUrl.trim().slice(0, 500000);
  }
  if (input.bannerColor !== undefined) {
    sanitized.bannerColor = normalizeHexColor(input.bannerColor, '#5865F2');
  }
  if (input.bio !== undefined) {
    sanitized.bio = input.bio.slice(0, BLUEPRINT_LIMITS.BIO_MAX_LEN);
  }
  if (input.customStatusText !== undefined) {
    sanitized.customStatusText = input.customStatusText
      .trim()
      .slice(0, BLUEPRINT_LIMITS.CUSTOM_STATUS_TEXT_MAX_LEN);
  }
  if (input.customStatusEmoji !== undefined) {
    sanitized.customStatusEmoji = input.customStatusEmoji
      .trim()
      .slice(0, BLUEPRINT_LIMITS.CUSTOM_STATUS_EMOJI_MAX_LEN);
  }
  if (input.profileThemeColor !== undefined) {
    sanitized.profileThemeColor = normalizeHexColor(input.profileThemeColor, '#5865F2');
  }
  if (input.richPresence !== undefined) {
    sanitized.richPresence = sanitizeRichPresence(input.richPresence);
  }

  return { valid: true, sanitized };
}

export function filterHydratedFriendsByTab(
  items: HydratedFriendItem[],
  tab: Exclude<FriendsTabType, 'add'>,
  searchQuery = ''
): HydratedFriendItem[] {
  const q = searchQuery.trim().toLowerCase();

  return items.filter((item) => {
    if (q) {
      const matchesName = item.profile.username.toLowerCase().includes(q);
      const matchesTag = item.profile.uniqueTag.toLowerCase().includes(q);
      const matchesBio = item.profile.bio.toLowerCase().includes(q);
      if (!matchesName && !matchesTag && !matchesBio) return false;
    }

    switch (tab) {
      case 'online':
        return (
          item.relationshipStatus === 'accepted' &&
          item.profile.status !== 'offline'
        );
      case 'all':
        return item.relationshipStatus === 'accepted';
      case 'pending':
        return (
          item.relationshipStatus === 'pending_incoming' ||
          item.relationshipStatus === 'pending_outgoing'
        );
      case 'blocked':
        return item.relationshipStatus === 'blocked';
      default:
        return false;
    }
  });
}

export function validateEmojiName(raw: string): {
  valid: boolean;
  normalized: string;
  error?: string;
} {
  const normalized = raw.trim().replace(/^:|:$/g, '').replace(/\s+/g, '_');
  if (normalized.length < BLUEPRINT_LIMITS.EMOJI_NAME_MIN_LEN) {
    return { valid: false, normalized, error: 'Emoji name must be at least 2 characters.' };
  }
  if (normalized.length > BLUEPRINT_LIMITS.EMOJI_NAME_MAX_LEN) {
    return { valid: false, normalized, error: 'Emoji name must be 32 characters or fewer.' };
  }
  if (!BLUEPRINT_LIMITS.EMOJI_NAME_REGEX.test(normalized)) {
    return {
      valid: false,
      normalized,
      error: 'Emoji name can only contain letters, numbers, and underscores.',
    };
  }
  return { valid: true, normalized };
}

export function sanitizeChannelName(raw: string, type: 'text' | 'voice'): string {
  const trimmed = raw.trim().slice(0, BLUEPRINT_LIMITS.CHANNEL_NAME_MAX_LEN);
  if (type === 'text') {
    return trimmed
      .toLowerCase()
      .replace(/[^a-z0-9-_ \p{Extended_Pictographic}]/gu, '')
      .replace(/\s+/g, '-');
  }
  return trimmed;
}

function escapeRegexChars(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Parses a line of chat text into inline tokens supporting:
 * - `**bold**`
 * - `*italic*`
 * - `` `inline code` ``
 * - `:custom_emoji:`
 * - `https://...` links
 * - `@Username` mentions
 */
export function parseInlineMarkdown(
  input: string,
  emojiLookup: Record<string, string> = {},
  mentionNames: string[] = []
): MarkdownSegment[] {
  if (!input) return [];

  const cleanedMentions = Array.from(
    new Set(
      mentionNames
        .map((n) => (n || '').trim())
        .filter((n) => n.length > 0)
    )
  ).sort((a, b) => b.length - a.length);

  const mentionAlternation =
    cleanedMentions.length > 0
      ? `|@(?:${cleanedMentions.map(escapeRegexChars).join('|')})(?=$|[\\s.,!?:;)\\]"'])`
      : '';

  const segments: MarkdownSegment[] = [];
  const tokenRegex = new RegExp(
    `(\\*\\*[^*]+\\*\\*|\\*[^*\\n]+\\*|\`[^\`\\n]+\`|:([a-zA-Z0-9_]{2,32}):|https?:\\/\\/[^\\s<]+${mentionAlternation}|@[a-zA-Z0-9_.\\-]+(?:#\\d{4})?)`,
    'g'
  );

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(input)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        value: input.slice(lastIndex, match.index),
      });
    }

    const fullToken = match[0];
    const emojiKey = match[2];

    if (fullToken.startsWith('**') && fullToken.endsWith('**')) {
      segments.push({
        type: 'bold',
        value: fullToken.slice(2, -2),
      });
    } else if (fullToken.startsWith('*') && fullToken.endsWith('*')) {
      segments.push({
        type: 'italic',
        value: fullToken.slice(1, -1),
      });
    } else if (fullToken.startsWith('`') && fullToken.endsWith('`')) {
      segments.push({
        type: 'code',
        value: fullToken.slice(1, -1),
      });
    } else if (emojiKey && emojiLookup[emojiKey]) {
      segments.push({
        type: 'emoji',
        value: emojiKey,
        emojiUrl: emojiLookup[emojiKey],
      });
    } else if (fullToken.startsWith('http://') || fullToken.startsWith('https://')) {
      segments.push({
        type: 'link',
        value: fullToken,
      });
    } else if (fullToken.startsWith('@') && fullToken.length > 1) {
      const prevChar = match.index > 0 ? input[match.index - 1] : '';
      if (!prevChar || /[\s([{"']/.test(prevChar)) {
        segments.push({
          type: 'mention',
          value: fullToken,
        });
      } else {
        segments.push({
          type: 'text',
          value: fullToken,
        });
      }
    } else {
      segments.push({
        type: 'text',
        value: fullToken,
      });
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < input.length) {
    segments.push({
      type: 'text',
      value: input.slice(lastIndex),
    });
  }

  return segments;
}

export function groupChannelsByType(
  channels: ChannelItem[],
  serverId: string
): {
  textChannels: ChannelItem[];
  voiceChannels: ChannelItem[];
} {
  const serverChannels = channels.filter((c) => c.serverId === serverId);
  return {
    textChannels: serverChannels.filter((c) => c.type === 'text'),
    voiceChannels: serverChannels.filter((c) => c.type === 'voice'),
  };
}

/**
 * Builds a shareable Wapper server invite URL in the format:
 * `${origin}/?invite=${serverId}`
 */
export function buildServerInviteLink(origin: string, serverId: string): string {
  const cleanOrigin = (origin || 'http://localhost:3000').replace(/\/+$/, '');
  const cleanServerId = (serverId || '').trim();
  return `${cleanOrigin}/?invite=${encodeURIComponent(cleanServerId)}`;
}

/**
 * Parses a pasted server invite link (e.g. `https://wapper.app/?invite=srv_12345`)
 * or a raw server ID / short invite code (e.g. `srv_12345` or `wapper-hq`).
 */
export function parseInviteInput(rawInput: string): {
  valid: boolean;
  inviteTarget: string;
  error?: string;
} {
  const trimmed = (rawInput || '').trim();
  if (!trimmed) {
    return {
      valid: false,
      inviteTarget: '',
      error: 'Please paste an invite link or enter a Server ID / Invite Code.',
    };
  }

  // Check if input is a full URL or contains ?invite=
  if (trimmed.includes('invite=')) {
    try {
      const urlObj = trimmed.startsWith('http')
        ? new URL(trimmed)
        : new URL(
            trimmed.startsWith('?')
              ? `http://localhost/${trimmed}`
              : `http://localhost/?${trimmed}`
          );
      const inviteParam = (urlObj.searchParams.get('invite') || '').trim();
      if (inviteParam && BLUEPRINT_LIMITS.ID_REGEX.test(inviteParam)) {
        return {
          valid: true,
          inviteTarget: inviteParam.slice(0, BLUEPRINT_LIMITS.ID_MAX_LEN),
        };
      }
    } catch {
      const match = trimmed.match(/[?&]invite=([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        return {
          valid: true,
          inviteTarget: match[1].slice(0, BLUEPRINT_LIMITS.ID_MAX_LEN),
        };
      }
    }
    return {
      valid: false,
      inviteTarget: '',
      error: 'Invalid invite link format. Expected a link like https://.../?invite=SERVER_ID.',
    };
  }

  // Otherwise treat as direct Server ID or short invite code
  const cleanedCode = trimmed.replace(/^#/, '').trim();
  if (cleanedCode.length < 2 || cleanedCode.length > BLUEPRINT_LIMITS.ID_MAX_LEN) {
    return {
      valid: false,
      inviteTarget: cleanedCode,
      error: 'Invite code or Server ID must be between 2 and 128 characters.',
    };
  }
  if (!BLUEPRINT_LIMITS.ID_REGEX.test(cleanedCode)) {
    return {
      valid: false,
      inviteTarget: cleanedCode,
      error: 'Invite code or Server ID can only contain letters, numbers, hyphens, and underscores.',
    };
  }

  return {
    valid: true,
    inviteTarget: cleanedCode,
  };
}

/**
 * Generates a deterministic Direct Message conversation ID for any pair of user IDs.
 * Ensures User A -> User B and User B -> User A always resolve to the exact same ID.
 */
export function buildDMConversationId(userA: string, userB: string): string {
  const cleanA = sanitizeId((userA || '').trim());
  const cleanB = sanitizeId((userB || '').trim());
  return `dm_${[cleanA, cleanB].sort().join('_')}`;
}

/**
 * Checks whether a message document belongs to the active DM conversation pair
 * between `userA` and `userB`. Matches explicit `(senderId, receiverId)` pairs
 * in either direction as well as deterministic `conversationId` / `channelId`.
 */
export function isMessageInDMConversation(
  msg: {
    senderId?: string | null;
    receiverId?: string | null;
    authorId?: string | null;
    conversationId?: string | null;
    channelId?: string | null;
  },
  userA: string,
  userB: string
): boolean {
  const cleanA = sanitizeId((userA || '').trim());
  const cleanB = sanitizeId((userB || '').trim());
  if (!cleanA || !cleanB) return false;

  const sender = sanitizeId((msg.senderId || msg.authorId || '').trim());
  const receiver = msg.receiverId ? sanitizeId(msg.receiverId.trim()) : '';

  if (sender && receiver) {
    if (
      (sender === cleanA && receiver === cleanB) ||
      (sender === cleanB && receiver === cleanA)
    ) {
      return true;
    }
  }

  const expectedConvId = buildDMConversationId(cleanA, cleanB);
  if (msg.conversationId && sanitizeId(msg.conversationId) === expectedConvId) {
    return true;
  }
  if (msg.channelId && sanitizeId(msg.channelId) === expectedConvId) {
    return true;
  }

  return false;
}

/**
 * Safely converts a Firestore Timestamp, ISO date string, numeric epoch, or
 * `{ seconds, nanoseconds }` object into epoch milliseconds for deterministic sorting.
 */
export function parseMessageTimestampMs(value: unknown, fallbackMs = 0): number {
  if (!value) return fallbackMs;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : fallbackMs;
  }
  if (typeof value === 'object') {
    const maybeTimestamp = value as {
      toMillis?: () => number;
      toDate?: () => Date;
      seconds?: number;
      nanoseconds?: number;
    };
    if (typeof maybeTimestamp.toMillis === 'function') {
      return maybeTimestamp.toMillis();
    }
    if (typeof maybeTimestamp.toDate === 'function') {
      return maybeTimestamp.toDate().getTime();
    }
    if (typeof maybeTimestamp.seconds === 'number') {
      const nanos =
        typeof maybeTimestamp.nanoseconds === 'number'
          ? maybeTimestamp.nanoseconds
          : 0;
      return maybeTimestamp.seconds * 1000 + Math.floor(nanos / 1_000_000);
    }
  }
  return fallbackMs;
}

/**
 * Deduplicates messages by `id` and sorts them in strict ascending order by `createdAt`
 * in memory so Firestore queries never require a complex multi-field Composite Index.
 */
export function sortMessagesByCreatedAtAsc<
  T extends { id: string; createdAt: string | number }
>(messages: T[]): T[] {
  const byId = new Map<string, T>();
  for (const item of messages) {
    if (!item || !item.id) continue;
    const existing = byId.get(item.id);
    if (!existing) {
      byId.set(item.id, item);
    } else {
      // Merge reactions/edits from latest snapshot
      byId.set(item.id, { ...existing, ...item });
    }
  }

  return Array.from(byId.values()).sort((a, b) => {
    const timeA = parseMessageTimestampMs(a.createdAt, 0);
    const timeB = parseMessageTimestampMs(b.createdAt, 0);
    if (timeA !== timeB) {
      return timeA - timeB;
    }
    return a.id.localeCompare(b.id);
  });
}

/**
 * Detects whether the user is currently typing an `@` mention token in the chat composer.
 * Triggers when `@` is at the start of the input or preceded by whitespace, and the user
 * has not yet completed the mention with a trailing space.
 */
export function extractMentionQuery(
  inputText: string,
  cursorIndex?: number
): ActiveMentionTrigger {
  const inactive: ActiveMentionTrigger = {
    active: false,
    query: '',
    startIndex: -1,
    endIndex: -1,
  };

  if (typeof inputText !== 'string' || inputText.length === 0) {
    return inactive;
  }

  // Do not trigger mention popup when typing a slash command at the very start
  if (inputText.startsWith('/') && !inputText.includes(' @')) {
    return inactive;
  }

  const effectiveCursor =
    typeof cursorIndex === 'number' && cursorIndex >= 0
      ? Math.min(cursorIndex, inputText.length)
      : inputText.length;

  const textUpToCursor = inputText.slice(0, effectiveCursor);
  const atIndex = textUpToCursor.lastIndexOf('@');
  if (atIndex === -1) {
    return inactive;
  }

  // `@` must be at the start of the message or preceded by whitespace / opening paren
  if (atIndex > 0) {
    const prevChar = textUpToCursor[atIndex - 1];
    if (!/[\s(]/.test(prevChar)) {
      return inactive;
    }
  }

  const rawQuery = textUpToCursor.slice(atIndex + 1);

  // If the user has already finished the mention with a trailing space (e.g. `@Username `), close popup
  if (rawQuery.endsWith(' ') || rawQuery.includes('\n')) {
    return inactive;
  }

  // Allow empty query (`@`), single word (`@Mayank`), or two-part display name (`@Mayank R`)
  if (!/^[a-zA-Z0-9_.\-]{0,32}(?:\s[a-zA-Z0-9_.\-]{1,32})?$/.test(rawQuery)) {
    return inactive;
  }

  return {
    active: true,
    query: rawQuery,
    startIndex: atIndex,
    endIndex: effectiveCursor,
  };
}

/**
 * Filters and ranks active server members for the `@` mention autocomplete popup.
 */
export function filterMentionCandidates<T extends MentionCandidate>(
  members: T[],
  query: string,
  limit = 8
): T[] {
  if (!Array.isArray(members) || members.length === 0) return [];

  const normalizedQuery = (query || '').trim().toLowerCase();
  const byKey = new Map<string, T>();

  for (const m of members) {
    if (!m || !m.username || !m.username.trim()) continue;
    const key = m.id || m.username.trim().toLowerCase();
    if (!byKey.has(key)) {
      byKey.set(key, m);
    }
  }

  const matches = Array.from(byKey.values()).filter((member) => {
    if (!normalizedQuery) return true;
    const nameMatch = member.username.toLowerCase().includes(normalizedQuery);
    const tagMatch = member.uniqueTag
      ? member.uniqueTag.toLowerCase().includes(normalizedQuery)
      : false;
    return nameMatch || tagMatch;
  });

  return matches
    .sort((a, b) => {
      const aOnline = a.status !== 'offline' ? 0 : 1;
      const bOnline = b.status !== 'offline' ? 0 : 1;
      if (aOnline !== bOnline) return aOnline - bOnline;

      if (normalizedQuery) {
        const aStarts = a.username.toLowerCase().startsWith(normalizedQuery)
          ? 0
          : 1;
        const bStarts = b.username.toLowerCase().startsWith(normalizedQuery)
          ? 0
          : 1;
        if (aStarts !== bStarts) return aStarts - bStarts;
      }

      return a.username.localeCompare(b.username);
    })
    .slice(0, Math.max(1, limit));
}

/**
 * Injects `@Username ` into the chat composer input at the active `@` mention range.
 */
export function injectMentionIntoInput(
  inputText: string,
  username: string,
  startIndex: number,
  endIndex: number
): { text: string; nextCursorIndex: number } {
  const cleanUsername = (username || '').trim();
  if (!cleanUsername || startIndex < 0 || startIndex > inputText.length) {
    return {
      text: inputText,
      nextCursorIndex: inputText.length,
    };
  }

  const safeEnd = Math.max(startIndex, Math.min(endIndex, inputText.length));
  const before = inputText.slice(0, startIndex);
  const after = inputText.slice(safeEnd);
  const needsTrailingSpace = !after.startsWith(' ');
  const mentionToken = `@${cleanUsername}${needsTrailingSpace ? ' ' : ''}`;
  const nextText = `${before}${mentionToken}${after}`.slice(
    0,
    BLUEPRINT_LIMITS.MESSAGE_CONTENT_MAX_LEN
  );
  const nextCursorIndex = Math.min(
    before.length + mentionToken.length,
    nextText.length
  );

  return {
    text: nextText,
    nextCursorIndex,
  };
}

/**
 * Checks whether a chat message text contains `@` followed by the current logged-in user's
 * display name (or uniqueTag, or `@everyone` / `@here`), matching Discord's mention rules.
 */
export function doesMessageMentionUser(
  content: string,
  currentUsername: string,
  currentUniqueTag?: string
): boolean {
  if (!content || !content.includes('@')) return false;

  const cleanUsername = (currentUsername || '').trim();
  if (!cleanUsername) return false;

  const candidates: string[] = [cleanUsername];
  if (currentUniqueTag && currentUniqueTag.trim()) {
    candidates.push(currentUniqueTag.trim());
  }

  for (const target of candidates) {
    const escaped = escapeRegexChars(target);
    const pattern = new RegExp(
      `(?:^|[\\s([{"'])@${escaped}(?=$|[\\s.,!?:;)\\]}"'])`,
      'i'
    );
    if (pattern.test(content)) {
      return true;
    }
  }

  // Also support @everyone and @here channel-wide mentions
  if (/(?:^|[\s([{"'])@(?:everyone|here)(?=$|[\s.,!?:;)\]}"'])/i.test(content)) {
    return true;
  }

  return false;
}

/**
 * Validates and normalizes a YouTube Channel ID, URL, or handle into a canonical
 * YouTube Channel ID and official Google PubSubHubbub RSS feed URL:
 * `https://www.youtube.com/xml/feeds/videos.xml?channel_id=CHANNEL_ID`
 */
export function normalizeYouTubeChannelId(rawInput: string): {
  valid: boolean;
  channelId: string;
  feedUrl: string;
  error?: string;
} {
  const trimmed = (rawInput || '').trim();
  if (!trimmed) {
    return {
      valid: false,
      channelId: '',
      feedUrl: '',
      error: 'Please enter a YouTube Channel ID (e.g. UC_x5XG1OV2P6uZZ5FSM9Ttw).',
    };
  }

  // Extract from full URL like https://www.youtube.com/channel/UC... or ?channel_id=UC...
  const urlMatch =
    trimmed.match(/youtube\.com\/channel\/([a-zA-Z0-9_-]{10,48})/i) ||
    trimmed.match(/[?&]channel_id=([a-zA-Z0-9_-]{10,48})/i);
  if (urlMatch && urlMatch[1]) {
    const cid = urlMatch[1];
    return {
      valid: true,
      channelId: cid,
      feedUrl: `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${encodeURIComponent(cid)}`,
    };
  }

  const handleMatch = trimmed.match(/youtube\.com\/@([a-zA-Z0-9_.\-]{2,40})/i);
  if (handleMatch && handleMatch[1]) {
    const cid = `UC_${handleMatch[1].replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    return {
      valid: true,
      channelId: cid,
      feedUrl: `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${encodeURIComponent(cid)}`,
    };
  }

  const cleanToken = trimmed.replace(/^@/, '').trim();
  if (cleanToken.length < 3 || cleanToken.length > 64 || !/^[a-zA-Z0-9_.\-]+$/.test(cleanToken)) {
    return {
      valid: false,
      channelId: cleanToken,
      feedUrl: '',
      error: 'Invalid YouTube Channel ID. Paste a valid ID (e.g. UC_x5XG1OV2P6uZZ5FSM9Ttw) or channel URL.',
    };
  }

  return {
    valid: true,
    channelId: cleanToken,
    feedUrl: `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${encodeURIComponent(cleanToken)}`,
  };
}

/**
 * Generates a realistic Google PubSubHubbub Atom XML notification payload
 * matching YouTube's official `https://www.youtube.com/xml/feeds/videos.xml` schema.
 */
export function buildYouTubePubSubXmlSample(params: {
  videoId: string;
  channelId: string;
  channelName: string;
  title: string;
  isLiveStream: boolean;
  publishedAt?: string;
}): string {
  const published = params.publishedAt || new Date().toISOString();
  const liveTag = params.isLiveStream ? 'live' : 'none';
  const extracted = extractYouTubeVideoId(params.videoId);
  const safeVideoId = extracted.videoId || 'jfKfPfyJRdk';

  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns="http://www.w3.org/2005/Atom">
  <link rel="hub" href="https://pubsubhubbub.appspot.com"/>
  <link rel="self" href="https://www.youtube.com/xml/feeds/videos.xml?channel_id=${params.channelId}"/>
  <title>YouTube video feed</title>
  <updated>${published}</updated>
  <entry>
    <id>yt:video:${safeVideoId}</id>
    <yt:videoId>${safeVideoId}</yt:videoId>
    <yt:channelId>${params.channelId}</yt:channelId>
    <yt:liveBroadcastContent>${liveTag}</yt:liveBroadcastContent>
    <title>${params.title}</title>
    <link rel="alternate" href="https://www.youtube.com/watch?v=${safeVideoId}"/>
    <author>
      <name>${params.channelName}</name>
      <uri>https://www.youtube.com/channel/${params.channelId}</uri>
    </author>
    <published>${published}</published>
    <updated>${published}</updated>
  </entry>
</feed>`;
}

/**
 * Parses an incoming Google PubSubHubbub Atom XML notification from YouTube's RSS feed.
 */
export function parseYouTubePubSubXml(xmlPayload: string): YouTubePubSubEntry | null {
  if (!xmlPayload || typeof xmlPayload !== 'string' || !xmlPayload.includes('<entry')) {
    return null;
  }

  const entryBlock = xmlPayload.match(/<entry[\s\S]*?<\/entry>/i)?.[0] || xmlPayload;
  const extractTag = (block: string, tag: string): string => {
    const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
    return m?.[1]?.trim() || '';
  };

  const rawVideoId =
    extractTag(entryBlock, 'yt:videoId') ||
    entryBlock.match(/yt:video:([a-zA-Z0-9_-]{11})/)?.[1] ||
    '';
  const extracted = extractYouTubeVideoId(rawVideoId || 'jfKfPfyJRdk');
  const videoId = extracted.videoId;

  const channelId =
    extractTag(entryBlock, 'yt:channelId') || 'UC_x5XG1OV2P6uZZ5FSM9Ttw';
  const title = extractTag(entryBlock, 'title') || 'New YouTube Broadcast';
  const authorBlock = extractTag(entryBlock, 'author');
  const channelName =
    extractTag(authorBlock, 'name') ||
    extractTag(xmlPayload, 'name') ||
    'YouTube Creator';
  const publishedAt =
    extractTag(entryBlock, 'published') ||
    extractTag(entryBlock, 'updated') ||
    new Date().toISOString();

  const liveBroadcastContent = extractTag(
    entryBlock,
    'yt:liveBroadcastContent'
  ).toLowerCase();
  const isLiveStream =
    liveBroadcastContent === 'live' ||
    liveBroadcastContent === 'upcoming' ||
    /\b(live|streaming|broadcast)\b/i.test(title);

  return {
    videoId,
    channelId,
    channelName,
    title,
    videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
    publishedAt,
    isLiveStream,
  };
}

/**
 * Builds a complete Wapper Bot message object with a Dynamic Rich Media Embed Card
 * (`🔴 GO LIVE ALERT` or `🆕 NEW VIDEO UPLOAD`) from a parsed YouTube PubSubHubbub entry.
 */
export function buildYouTubeWebhookBotMessage(
  entry: YouTubePubSubEntry,
  params: {
    serverId: string;
    channelId: string;
    authorId: string;
  }
): {
  id: string;
  channelId: string;
  serverId: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  authorRoleColor: string;
  content: string;
  isBot: true;
  botName: string;
  botEmbed: BotEmbedPayload;
  createdAt: string;
} {
  const alertHeader: '🔴 GO LIVE ALERT' | '🆕 NEW VIDEO UPLOAD' = entry.isLiveStream
    ? '🔴 GO LIVE ALERT'
    : '🆕 NEW VIDEO UPLOAD';
  const embedType = entry.isLiveStream
    ? 'youtube_live_alert'
    : 'youtube_upload_alert';

  return {
    id: `msg_ytbot_${sanitizeId(entry.videoId)}_${entry.isLiveStream ? 'live' : 'upload'}`,
    channelId: params.channelId,
    serverId: params.serverId,
    authorId: params.authorId,
    authorName: 'Wapper Bot',
    authorAvatar: '',
    authorRoleColor: entry.isLiveStream ? '#EF4444' : '#5865F2',
    content: `${alertHeader} — **${entry.channelName}** ${
      entry.isLiveStream ? 'is streaming live right now' : 'just uploaded a new video'
    }: **${entry.title}**`,
    isBot: true,
    botName: 'Wapper Bot',
    botEmbed: {
      embedType,
      botName: 'Wapper Bot',
      botBadgeText: '✓ BOT',
      title: entry.title.slice(0, 140),
      description: entry.isLiveStream
        ? `${entry.channelName} is live on YouTube! Watch or listen directly inside Wapper below.`
        : `${entry.channelName} uploaded a new YouTube video! Watch directly inside Wapper below.`,
      youtubeVideoId: entry.videoId,
      streamUrl: entry.videoUrl,
      streamerName: entry.channelName,
      channelName: entry.channelName,
      youtubeChannelId: entry.channelId,
      alertHeader,
      isLiveStream: entry.isLiveStream,
      publishedAt: entry.publishedAt,
      accentColor: entry.isLiveStream ? '#EF4444' : '#5865F2',
    },
    createdAt: new Date().toISOString(),
  };
}
