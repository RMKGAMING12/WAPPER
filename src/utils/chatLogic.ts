/**
 * Pure, deterministic chat, markdown, validation, profile customization,
 * friend list state filtering, channel categorization, slash command parsing,
 * YouTube video ID extraction, role permissions, and founder badge detection
 * decoupled from React DOM components for fast unit testing.
 */

export interface MarkdownSegment {
  type: 'text' | 'bold' | 'italic' | 'code' | 'emoji' | 'link';
  value: string;
  emojiUrl?: string;
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
  embedType: 'youtube' | 'live' | 'poll' | '8ball' | 'roll';
  botName: string;
  botBadgeText: string;
  title: string;
  description?: string;
  youtubeVideoId?: string;
  streamUrl?: string;
  streamerName?: string;
  pollQuestion?: string;
  pollOptions?: string[];
  accentColor?: string;
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

/**
 * Detects whether a user is the Wapper Founder & Creator ("Mayank raj" case-insensitive
 * or email "mayankraj.mfp23@gmail.com").
 */
export function isFounderUser(user?: {
  username?: string | null;
  email?: string | null;
  id?: string | null;
} | null): boolean {
  if (!user) return false;
  const cleanName = (user.username || '').trim().toLowerCase();
  const cleanEmail = (user.email || '').trim().toLowerCase();
  const cleanId = (user.id || '').trim().toLowerCase();

  if (cleanEmail === 'mayankraj.mfp23@gmail.com' || cleanEmail === 'mayank.raj@google.com') {
    return true;
  }
  if (cleanName === 'mayank raj' || cleanName.startsWith('mayank raj#')) {
    return true;
  }
  if (cleanId.includes('mayank_raj') || cleanId.includes('mayankraj_mfp23')) {
    return true;
  }
  return false;
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

export function sanitizeProfileUpdate(input: {
  username?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  bannerColor?: string;
  bio?: string;
  customStatusText?: string;
  customStatusEmoji?: string;
  profileThemeColor?: string;
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
  };
} {
  const sanitized: Record<string, string> = {};

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
      .replace(/[^a-z0-9-_ ]/g, '')
      .replace(/\s+/g, '-');
  }
  return trimmed;
}

/**
 * Parses a line of chat text into inline tokens supporting:
 * - `**bold**`
 * - `*italic*`
 * - `` `inline code` ``
 * - `:custom_emoji:`
 * - `https://...` links
 */
export function parseInlineMarkdown(
  input: string,
  emojiLookup: Record<string, string> = {}
): MarkdownSegment[] {
  if (!input) return [];

  const segments: MarkdownSegment[] = [];
  const tokenRegex =
    /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`\n]+`|:([a-zA-Z0-9_]{2,32}):|https?:\/\/[^\s<]+)/g;

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
