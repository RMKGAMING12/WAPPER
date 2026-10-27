/**
 * Pure, deterministic chat, markdown, validation, profile customization,
 * friend list state filtering, and channel categorization logic
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
        : new URL(trimmed.startsWith('?') ? `http://localhost/${trimmed}` : `http://localhost/?${trimmed}`);
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

