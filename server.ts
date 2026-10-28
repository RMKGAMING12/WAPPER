import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;

export type PresenceStatus = 'online' | 'idle' | 'dnd' | 'offline';
export type FriendRelationshipStatus =
  | 'pending_incoming'
  | 'pending_outgoing'
  | 'accepted'
  | 'blocked';

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

export interface FriendRelationshipRecord {
  id: string;
  userId: string;
  friendId: string;
  status: FriendRelationshipStatus;
  createdAt: string;
  updatedAt: string;
}

export interface HydratedFriendRecord {
  relationshipId: string;
  userId: string;
  friendId: string;
  relationshipStatus: FriendRelationshipStatus;
  profile: WapperProfile;
  updatedAt: string;
}

export interface WapperChannel {
  id: string;
  serverId: string;
  name: string;
  type: 'text' | 'voice';
  category: string;
  topic: string;
}

export interface WapperServer {
  id: string;
  name: string;
  description: string;
  iconUrl: string;
  inviteCode: string;
  ownerId: string;
}

export interface WapperMessage {
  id: string;
  channelId: string;
  serverId: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  authorRoleColor?: string;
  content: string;
  gifUrl?: string;
  attachmentUrl?: string;
  attachmentAnalysis?: string;
  createdAt: string;
}

export interface WapperCustomEmoji {
  id: string;
  serverId: string;
  name: string;
  imageUrl: string;
  creatorId: string;
  createdAt: string;
}

export interface VoicePeerState {
  socketId: string;
  userId: string;
  username: string;
  avatarUrl: string;
  channelId: string;
  isMuted: boolean;
  isDeafened: boolean;
  hasVideo: boolean;
  isScreenSharing: boolean;
}

// =============================================================================
// REAL-TIME STATE STORES (Strictly Zero Dummy Users / Zero Mock Entries)
// =============================================================================
const profilesMap = new Map<string, WapperProfile>();
// userId -> Map<friendId, FriendRelationshipRecord>
const friendshipsByUser = new Map<string, Map<string, FriendRelationshipRecord>>();
const servers: WapperServer[] = [
  {
    id: 'srv_wapper_community',
    name: 'Wapper Community',
    description: 'Open-source P2P voice, video & real-time chat workspace.',
    iconUrl: '',
    inviteCode: 'wapper',
    ownerId: 'system',
  },
];
const channels: WapperChannel[] = [
  {
    id: 'chan_announcements',
    serverId: 'srv_wapper_community',
    name: '📢-announcements',
    type: 'text',
    category: 'System & Stream Alerts',
    topic: 'Automatic YouTube Upload & Live Stream Notification Bot (Google PubSubHubbub RSS)',
  },
  {
    id: 'chan_stream_alerts',
    serverId: 'srv_wapper_community',
    name: '🚀-stream-alerts',
    type: 'text',
    category: 'System & Stream Alerts',
    topic: 'Real-time 🔴 GO LIVE ALERT & 🆕 NEW VIDEO UPLOAD notifications from Wapper Bot',
  },
  {
    id: 'chan_general',
    serverId: 'srv_wapper_community',
    name: 'general',
    type: 'text',
    category: 'Text Channels',
    topic: 'Real-time Socket.io discussion, markdown formatting, live GIFs, and custom emotes.',
  },
  {
    id: 'chan_voice_lounge',
    serverId: 'srv_wapper_community',
    name: 'General Voice',
    type: 'voice',
    category: 'Voice & Video P2P',
    topic: 'Direct browser-to-browser WebRTC P2P voice, video, and screen sharing.',
  },
];
const customEmojis: WapperCustomEmoji[] = [];
const messagesByChannel = new Map<string, WapperMessage[]>();
const voiceRooms = new Map<string, Map<string, VoicePeerState>>();
const socketToUser = new Map<string, string>();

// Curated free GIF fallback when container blocks outbound requests to Tenor
const FALLBACK_FREE_GIFS = [
  {
    id: 'gif_1',
    title: 'High Five Wave',
    url: 'https://media.giphy.com/media/hvRJCLFzcasrR4ia7z/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/hvRJCLFzcasrR4ia7z/giphy.gif',
    tags: ['hello', 'wave', 'hi', 'welcome'],
  },
  {
    id: 'gif_2',
    title: 'Galaxy Mind Blown',
    url: 'https://media.giphy.com/media/xT0xeJpnrWC4XWblEk/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/xT0xeJpnrWC4XWblEk/giphy.gif',
    tags: ['wow', 'epic', 'space'],
  },
  {
    id: 'gif_3',
    title: 'Fast Coding',
    url: 'https://media.giphy.com/media/LmNwrBhejkK9EFP504/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/LmNwrBhejkK9EFP504/giphy.gif',
    tags: ['code', 'dev', 'ship', 'typing'],
  },
  {
    id: 'gif_4',
    title: 'Approve Thumbs Up',
    url: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif',
    tags: ['yes', 'approve', 'lgtm'],
  },
];

function getGeminiClient(): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function getHydratedFriendsForUser(userId: string): HydratedFriendRecord[] {
  const userEdges = friendshipsByUser.get(userId);
  if (!userEdges) return [];

  const result: HydratedFriendRecord[] = [];
  userEdges.forEach((edge) => {
    const friendProfile = profilesMap.get(edge.friendId);
    if (friendProfile) {
      result.push({
        relationshipId: edge.id,
        userId: edge.userId,
        friendId: edge.friendId,
        relationshipStatus: edge.status,
        profile: friendProfile,
        updatedAt: edge.updatedAt,
      });
    }
  });
  return result.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

function setFriendEdge(
  userId: string,
  friendId: string,
  status: FriendRelationshipStatus
): FriendRelationshipRecord {
  if (!friendshipsByUser.has(userId)) {
    friendshipsByUser.set(userId, new Map());
  }
  const userEdges = friendshipsByUser.get(userId)!;
  const nowIso = new Date().toISOString();
  const existing = userEdges.get(friendId);
  const record: FriendRelationshipRecord = {
    id: existing?.id || `fr_${userId}_${friendId}`,
    userId,
    friendId,
    status,
    createdAt: existing?.createdAt || nowIso,
    updatedAt: nowIso,
  };
  userEdges.set(friendId, record);
  return record;
}

function removeFriendEdge(userId: string, friendId: string): void {
  const userEdges = friendshipsByUser.get(userId);
  if (userEdges) {
    userEdges.delete(friendId);
  }
}

function findProfileByTagOrUsername(rawTag: string): WapperProfile | undefined {
  const trimmed = (rawTag || '').trim().replace(/^@/, '');
  if (!trimmed) return undefined;

  const lower = trimmed.toLowerCase();
  const allProfiles = Array.from(profilesMap.values());

  // 1. Exact uniqueTag match (case-insensitive, e.g. "mayank#4092")
  const exactTagMatch = allProfiles.find(
    (p) => p.uniqueTag.toLowerCase() === lower
  );
  if (exactTagMatch) return exactTagMatch;

  // 2. If input has '#', match username + discriminator
  if (lower.includes('#')) {
    const [uPart, dPart] = lower.split('#').map((s) => s.trim());
    return allProfiles.find(
      (p) =>
        p.username.toLowerCase() === uPart &&
        p.discriminator.toLowerCase() === dPart
    );
  }

  // 3. Exact username match (case-insensitive)
  const exactUsername = allProfiles.find(
    (p) => p.username.toLowerCase() === lower
  );
  if (exactUsername) return exactUsername;

  // 4. Exact userId match
  return profilesMap.get(trimmed);
}

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    maxHttpBufferSize: 5e6,
  });

  app.use(express.json({ limit: '10mb' }));
  app.use(
    express.text({
      type: ['application/atom+xml', 'application/xml', 'text/xml', 'text/plain'],
      limit: '2mb',
    })
  );

  // Explicitly serve PWA Service Worker and Manifest with strict MIME types
  app.get('/sw.js', (_req, res) => {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Service-Worker-Allowed', '/');
    const distSw = path.resolve(process.cwd(), 'dist/sw.js');
    const publicSw = path.resolve(process.cwd(), 'public/sw.js');
    res.sendFile(fs.existsSync(distSw) ? distSw : publicSw);
  });

  app.get('/manifest.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    const distManifest = path.resolve(process.cwd(), 'dist/manifest.json');
    const publicManifest = path.resolve(process.cwd(), 'public/manifest.json');
    res.sendFile(fs.existsSync(distManifest) ? distManifest : publicManifest);
  });

  // --- REST API ENDPOINTS ---

  // 1. Bootstrap Initial State
  app.get('/api/bootstrap', (_req, res) => {
    const allMessages: Record<string, WapperMessage[]> = {};
    messagesByChannel.forEach((list, chanId) => {
      allMessages[chanId] = list;
    });

    const activeVoicePeers: Record<string, VoicePeerState[]> = {};
    voiceRooms.forEach((peerMap, chanId) => {
      activeVoicePeers[chanId] = Array.from(peerMap.values());
    });

    res.json({
      servers,
      channels,
      profiles: Array.from(profilesMap.values()),
      customEmojis,
      messagesByChannel: allMessages,
      activeVoicePeers,
    });
  });

  // 2. Profile Registration & Customization Sync
  app.get('/api/profiles/:id', (req, res) => {
    const profile = profilesMap.get(req.params.id) || null;
    return res.json({ profile });
  });

  app.post('/api/profiles/sync', (req, res) => {
    const incoming = req.body as Partial<WapperProfile>;
    if (!incoming || !incoming.id || !incoming.username) {
      return res.status(400).json({ error: 'Valid profile id and username are required.' });
    }

    const existing = profilesMap.get(incoming.id);
    const nowIso = new Date().toISOString();
    const cleanName = String(incoming.username).trim().slice(0, 32) || 'WapperUser';
    const cleanDisc =
      incoming.discriminator && /^[0-9]{4}$/.test(incoming.discriminator)
        ? incoming.discriminator
        : existing?.discriminator || '0001';

    const merged: WapperProfile = {
      id: incoming.id,
      username: cleanName,
      discriminator: cleanDisc,
      uniqueTag: `${cleanName}#${cleanDisc}`,
      email: incoming.email ?? existing?.email,
      avatarUrl: incoming.avatarUrl !== undefined ? incoming.avatarUrl : existing?.avatarUrl || '',
      bannerUrl: incoming.bannerUrl !== undefined ? incoming.bannerUrl : existing?.bannerUrl || '',
      bannerColor:
        incoming.bannerColor !== undefined ? incoming.bannerColor : existing?.bannerColor || '#5865F2',
      bio: incoming.bio !== undefined ? incoming.bio : existing?.bio || '',
      customStatusText:
        incoming.customStatusText !== undefined
          ? incoming.customStatusText
          : existing?.customStatusText || '',
      customStatusEmoji:
        incoming.customStatusEmoji !== undefined
          ? incoming.customStatusEmoji
          : existing?.customStatusEmoji || '',
      profileThemeColor:
        incoming.profileThemeColor !== undefined
          ? incoming.profileThemeColor
          : existing?.profileThemeColor || '#5865F2',
      status: incoming.status || existing?.status || 'online',
      isMuted: incoming.isMuted ?? existing?.isMuted ?? false,
      isDeafened: incoming.isDeafened ?? existing?.isDeafened ?? false,
      activeVoiceChannelId:
        incoming.activeVoiceChannelId !== undefined
          ? incoming.activeVoiceChannelId
          : existing?.activeVoiceChannelId || null,
      createdAt: existing?.createdAt || incoming.createdAt || nowIso,
      updatedAt: nowIso,
    };

    profilesMap.set(merged.id, merged);
    io.emit('profiles-updated', Array.from(profilesMap.values()));
    io.emit('friends-updated', { affectedUserId: merged.id });

    return res.json({ profile: merged });
  });

  // 3. Social Friends Graph Endpoints
  app.get('/api/friends/:userId', (req, res) => {
    const { userId } = req.params;
    return res.json({
      friends: getHydratedFriendsForUser(userId),
    });
  });

  app.post('/api/friends/request', (req, res) => {
    const { userId, targetTag } = req.body || {};
    if (!userId || !targetTag) {
      return res.status(400).json({ error: 'userId and targetTag are required.' });
    }

    const senderProfile = profilesMap.get(userId);
    if (!senderProfile) {
      return res.status(404).json({ error: 'Sender profile is not registered.' });
    }

    const targetProfile = findProfileByTagOrUsername(String(targetTag));
    if (!targetProfile) {
      return res.status(404).json({
        error: `No registered Wapper user found matching "${targetTag}". Ask your friend for their exact Username#0000 tag!`,
      });
    }

    if (targetProfile.id === userId) {
      return res.status(400).json({ error: 'You cannot send a friend request to yourself.' });
    }

    // Check if blocked
    const targetEdges = friendshipsByUser.get(targetProfile.id);
    if (targetEdges?.get(userId)?.status === 'blocked') {
      return res.status(403).json({ error: 'Unable to send friend request to this user.' });
    }

    const senderEdges = friendshipsByUser.get(userId);
    const existingEdge = senderEdges?.get(targetProfile.id);
    if (existingEdge?.status === 'accepted') {
      return res.status(400).json({
        error: `You are already friends with ${targetProfile.uniqueTag}!`,
      });
    }

    // If the target already sent us a request, auto-accept both!
    if (existingEdge?.status === 'pending_incoming') {
      setFriendEdge(userId, targetProfile.id, 'accepted');
      setFriendEdge(targetProfile.id, userId, 'accepted');
      io.emit('friends-updated', {
        affectedUserIds: [userId, targetProfile.id],
      });
      return res.json({
        message: `Accepted incoming request from ${targetProfile.uniqueTag} — you are now friends!`,
        targetProfile,
        friends: getHydratedFriendsForUser(userId),
      });
    }

    setFriendEdge(userId, targetProfile.id, 'pending_outgoing');
    setFriendEdge(targetProfile.id, userId, 'pending_incoming');

    io.emit('friends-updated', {
      affectedUserIds: [userId, targetProfile.id],
    });

    return res.json({
      message: `Friend request sent to ${targetProfile.uniqueTag}!`,
      targetProfile,
      friends: getHydratedFriendsForUser(userId),
    });
  });

  app.post('/api/friends/accept', (req, res) => {
    const { userId, friendId } = req.body || {};
    if (!userId || !friendId) {
      return res.status(400).json({ error: 'userId and friendId are required.' });
    }

    setFriendEdge(userId, friendId, 'accepted');
    setFriendEdge(friendId, userId, 'accepted');

    io.emit('friends-updated', {
      affectedUserIds: [userId, friendId],
    });

    return res.json({
      friends: getHydratedFriendsForUser(userId),
    });
  });

  app.post('/api/friends/remove', (req, res) => {
    const { userId, friendId } = req.body || {};
    if (!userId || !friendId) {
      return res.status(400).json({ error: 'userId and friendId are required.' });
    }

    removeFriendEdge(userId, friendId);
    // Also remove reciprocal non-blocked edge
    const otherEdges = friendshipsByUser.get(friendId);
    if (otherEdges && otherEdges.get(userId)?.status !== 'blocked') {
      otherEdges.delete(userId);
    }

    io.emit('friends-updated', {
      affectedUserIds: [userId, friendId],
    });

    return res.json({
      friends: getHydratedFriendsForUser(userId),
    });
  });

  app.post('/api/friends/block', (req, res) => {
    const { userId, targetUserIdOrTag } = req.body || {};
    if (!userId || !targetUserIdOrTag) {
      return res.status(400).json({ error: 'userId and targetUserIdOrTag are required.' });
    }

    const targetProfile =
      profilesMap.get(String(targetUserIdOrTag)) ||
      findProfileByTagOrUsername(String(targetUserIdOrTag));

    if (!targetProfile) {
      return res.status(404).json({
        error: `User "${targetUserIdOrTag}" was not found.`,
      });
    }

    if (targetProfile.id === userId) {
      return res.status(400).json({ error: 'You cannot block yourself.' });
    }

    setFriendEdge(userId, targetProfile.id, 'blocked');
    removeFriendEdge(targetProfile.id, userId);

    io.emit('friends-updated', {
      affectedUserIds: [userId, targetProfile.id],
    });

    return res.json({
      blockedUserId: targetProfile.id,
      friends: getHydratedFriendsForUser(userId),
    });
  });

  // 4. Expose schema.sql and PWA artifacts for inspection
  app.get('/api/architecture-files', (_req, res) => {
    try {
      const schemaSql = fs.existsSync(path.resolve('schema.sql'))
        ? fs.readFileSync(path.resolve('schema.sql'), 'utf8')
        : '';
      const manifestJson = fs.existsSync(path.resolve('public/manifest.json'))
        ? fs.readFileSync(path.resolve('public/manifest.json'), 'utf8')
        : '';
      res.json({ schemaSql, manifestJson });
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to read files' });
    }
  });

  // 4b. Google PubSubHubbub RSS Webhook Listener for YouTube Uploads & Live Streams
  // Official feed topic format: https://www.youtube.com/xml/feeds/videos.xml?channel_id=CHANNEL_ID
  app.get('/api/webhooks/youtube-pubsub', (req, res) => {
    const challenge = req.query['hub.challenge'];
    if (challenge && typeof challenge === 'string') {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(200).send(challenge);
    }
    return res.status(200).json({
      status: 'active',
      service: 'Wapper YouTube PubSubHubbub RSS Webhook Listener',
      feedBaseUrl: 'https://www.youtube.com/xml/feeds/videos.xml',
    });
  });

  app.post('/api/webhooks/youtube-pubsub', (req, res) => {
    try {
      const rawXml =
        typeof req.body === 'string'
          ? req.body
          : typeof req.body?.xml === 'string'
          ? req.body.xml
          : '';

      if (!rawXml || !rawXml.includes('<entry')) {
        return res.status(204).end();
      }

      const entryBlock = rawXml.match(/<entry[\s\S]*?<\/entry>/i)?.[0] || rawXml;
      const extractTag = (block: string, tag: string): string => {
        const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
        return m?.[1]?.trim() || '';
      };

      const videoId =
        extractTag(entryBlock, 'yt:videoId') || 'jfKfPfyJRdk';
      const channelId =
        extractTag(entryBlock, 'yt:channelId') || 'UC_x5XG1OV2P6uZZ5FSM9Ttw';
      const title =
        extractTag(entryBlock, 'title') || 'New YouTube Broadcast';
      const authorBlock = extractTag(entryBlock, 'author');
      const channelName =
        extractTag(authorBlock, 'name') ||
        extractTag(rawXml, 'name') ||
        'YouTube Creator';
      const liveBroadcastTag = extractTag(
        entryBlock,
        'yt:liveBroadcastContent'
      ).toLowerCase();
      const isLiveStream =
        liveBroadcastTag === 'live' ||
        liveBroadcastTag === 'upcoming' ||
        /\b(live|streaming|broadcast)\b/i.test(title);
      const alertHeader = isLiveStream
        ? '🔴 GO LIVE ALERT'
        : '🆕 NEW VIDEO UPLOAD';

      const targetChannelId =
        String(req.headers['x-wapper-channel-id'] || '').trim() ||
        'chan_announcements';
      const targetServerId =
        String(req.headers['x-wapper-server-id'] || '').trim() ||
        'srv_wapper_community';

      const deterministicMsgId = `msg_ytbot_${videoId.replace(/[^a-zA-Z0-9_-]/g, '_')}_${
        isLiveStream ? 'live' : 'upload'
      }`;

      const botMessage = {
        id: deterministicMsgId,
        channelId: targetChannelId,
        serverId: targetServerId,
        authorId: 'system_wapper_bot',
        authorName: 'Wapper Bot',
        authorAvatar: '',
        authorRoleColor: isLiveStream ? '#EF4444' : '#5865F2',
        content: `${alertHeader} — **${channelName}** ${
          isLiveStream ? 'is streaming live right now' : 'just uploaded a new video'
        }: **${title}**`,
        isBot: true,
        botName: 'Wapper Bot',
        botEmbed: {
          embedType: isLiveStream
            ? 'youtube_live_alert'
            : 'youtube_upload_alert',
          botName: 'Wapper Bot',
          botBadgeText: '✓ BOT',
          title,
          description: isLiveStream
            ? `${channelName} is live on YouTube! Watch or listen directly inside Wapper below.`
            : `${channelName} uploaded a new YouTube video! Watch directly inside Wapper below.`,
          youtubeVideoId: videoId,
          streamUrl: `https://www.youtube.com/watch?v=${videoId}`,
          streamerName: channelName,
          channelName,
          youtubeChannelId: channelId,
          alertHeader,
          isLiveStream,
          publishedAt: new Date().toISOString(),
          accentColor: isLiveStream ? '#EF4444' : '#5865F2',
        },
        createdAt: new Date().toISOString(),
      };

      const existingList = messagesByChannel.get(targetChannelId) || [];
      const filteredList = existingList.filter((m) => m.id !== deterministicMsgId);
      filteredList.push(botMessage);
      messagesByChannel.set(targetChannelId, filteredList);

      io.to(targetChannelId).emit('new-message', botMessage);
      return res.status(200).json({ received: true, message: botMessage });
    } catch (err: unknown) {
      console.error('YouTube PubSubHubbub webhook error:', err);
      return res.status(500).json({ error: 'Failed to process PubSubHubbub payload' });
    }
  });

  // 5. Free Tenor / Giphy Public API Proxy
  app.get('/api/gifs', async (req, res) => {
    const query = String(req.query.q || '').trim().toLowerCase();
    try {
      const tenorUrl = query
        ? `https://g.tenor.com/v1/search?q=${encodeURIComponent(query)}&key=LIVDSRZULELA&limit=12`
        : `https://g.tenor.com/v1/trending?key=LIVDSRZULELA&limit=12`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      const response = await fetch(tenorUrl, { signal: controller.signal });
      clearTimeout(timeout);

      if (response.ok) {
        const data = (await response.json()) as {
          results?: Array<{
            id: string;
            title?: string;
            content_description?: string;
            media?: Array<{
              gif?: { url?: string };
              tinygif?: { url?: string };
            }>;
          }>;
        };
        if (data.results && data.results.length > 0) {
          const mapped = data.results
            .map((item) => {
              const gifUrl = item.media?.[0]?.gif?.url || item.media?.[0]?.tinygif?.url;
              const previewUrl = item.media?.[0]?.tinygif?.url || gifUrl;
              if (!gifUrl) return null;
              return {
                id: item.id,
                title: item.content_description || item.title || 'GIF',
                url: gifUrl,
                previewUrl: previewUrl || gifUrl,
              };
            })
            .filter(Boolean);

          if (mapped.length > 0) {
            return res.json({ gifs: mapped, source: 'tenor-live' });
          }
        }
      }
    } catch {
      // Fallback if container blocks external Tenor host
    }

    const filtered = query
      ? FALLBACK_FREE_GIFS.filter(
          (g) =>
            g.title.toLowerCase().includes(query) ||
            g.tags.some((t) => t.includes(query))
        )
      : FALLBACK_FREE_GIFS;

    return res.json({
      gifs: filtered.length > 0 ? filtered : FALLBACK_FREE_GIFS,
      source: 'curated-free',
    });
  });

  // 6. Gemini Image Generation & Editing (`gemini-nano-banana-2.1`)
  app.post('/api/gemini/generate-image', async (req, res) => {
    try {
      const { prompt, aspectRatio = '1:1', imageSize = '1K', base64Image, mimeType } = req.body || {};
      if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ error: 'A text prompt is required.' });
      }

      const ai = getGeminiClient();
      const parts: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }> = [];

      if (base64Image && typeof base64Image === 'string') {
        const cleanBase64 = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
        parts.push({
          inlineData: {
            data: cleanBase64,
            mimeType: mimeType || 'image/png',
          },
        });
      }
      parts.push({ text: prompt });

      const response = await ai.models.generateContent({
        model: 'gemini-nano-banana-2.1',
        contents: { parts },
        config: {
          imageConfig: {
            aspectRatio,
            imageSize,
          },
        },
      });

      let generatedImageUrl: string | null = null;
      let textOutput = '';

      const candidateParts = response.candidates?.[0]?.content?.parts || [];
      for (const part of candidateParts) {
        if (part.inlineData?.data) {
          const outMime = part.inlineData.mimeType || 'image/png';
          generatedImageUrl = `data:${outMime};base64,${part.inlineData.data}`;
        } else if (part.text) {
          textOutput += part.text;
        }
      }

      if (!generatedImageUrl) {
        return res.status(502).json({
          error: textOutput || 'No image was returned by gemini-nano-banana-2.1.',
        });
      }

      return res.json({
        imageUrl: generatedImageUrl,
        caption: textOutput,
        model: 'gemini-nano-banana-2.1',
      });
    } catch (error: unknown) {
      console.error('Gemini image generation error:', error);
      const message = error instanceof Error ? error.message : 'Failed to generate image with Gemini.';
      return res.status(500).json({ error: message });
    }
  });

  // 7. Gemini Photo Analysis (`gemini-4-argon`)
  app.post('/api/gemini/analyze-image', async (req, res) => {
    try {
      const {
        base64Image,
        mimeType = 'image/png',
        prompt = 'Analyze this image in detail and summarize key visual elements, text, or technical insights.',
      } = req.body || {};
      if (!base64Image || typeof base64Image !== 'string') {
        return res.status(400).json({ error: 'An uploaded image is required for analysis.' });
      }

      const cleanBase64 = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
      const ai = getGeminiClient();

      const response = await ai.models.generateContent({
        model: 'gemini-4-argon',
        contents: {
          parts: [
            {
              inlineData: {
                data: cleanBase64,
                mimeType,
              },
            },
            {
              text: prompt,
            },
          ],
        },
      });

      return res.json({
        analysis: response.text || 'No analysis generated.',
        model: 'gemini-4-argon',
      });
    } catch (error: unknown) {
      console.error('Gemini image analysis error:', error);
      const message = error instanceof Error ? error.message : 'Failed to analyze image with gemini-4-argon.';
      return res.status(500).json({ error: message });
    }
  });

  // --- SOCKET.IO REAL-TIME ROOMS & WEBRTC SIGNALING ---

  io.on('connection', (socket) => {
    // Register authenticated user session
    socket.on('register-user', (profile: WapperProfile) => {
      if (!profile || !profile.id) return;
      socketToUser.set(socket.id, profile.id);
      const existing = profilesMap.get(profile.id);
      profilesMap.set(profile.id, {
        ...(existing || {}),
        ...profile,
        status: profile.status || 'online',
        updatedAt: new Date().toISOString(),
      });
      io.emit('profiles-updated', Array.from(profilesMap.values()));
    });

    // 1. Join a Text or Voice Channel Room
    socket.on('join-channel', (payload: { channelId: string; userId?: string }) => {
      if (!payload?.channelId) return;
      socket.join(payload.channelId);
      const history = messagesByChannel.get(payload.channelId) || [];
      socket.emit('channel-history', {
        channelId: payload.channelId,
        messages: history,
      });
    });

    // 2. Send Real-Time Message (Idempotent)
    socket.on('send-message', (message: WapperMessage) => {
      if (!message || !message.channelId || !message.id) return;
      const list = messagesByChannel.get(message.channelId) || [];
      if (list.some((m) => m.id === message.id)) {
        return;
      }
      const enriched: WapperMessage = {
        ...message,
        createdAt: message.createdAt || new Date().toISOString(),
      };
      list.push(enriched);
      messagesByChannel.set(message.channelId, list);
      io.to(message.channelId).emit('new-message', enriched);
    });

    // 3. Typing Indicator Signal
    socket.on(
      'typing-signal',
      (payload: { channelId: string; userId: string; username: string; isTyping: boolean }) => {
        if (!payload?.channelId) return;
        socket.to(payload.channelId).emit('typing-signal', payload);
      }
    );

    // 4. Create Server
    socket.on('create-server', (payload: { server: WapperServer; initialChannels: WapperChannel[] }) => {
      if (!payload?.server?.id) return;
      if (!servers.some((s) => s.id === payload.server.id)) {
        servers.push(payload.server);
      }
      if (Array.isArray(payload.initialChannels)) {
        for (const ch of payload.initialChannels) {
          if (!channels.some((c) => c.id === ch.id)) {
            channels.push(ch);
            messagesByChannel.set(ch.id, []);
          }
        }
      }
      io.emit('servers-updated', { servers, channels });
    });

    // 5. Create Channel
    socket.on('create-channel', (channel: WapperChannel) => {
      if (!channel?.id || !channel.serverId) return;
      if (!channels.some((c) => c.id === channel.id)) {
        channels.push(channel);
        messagesByChannel.set(channel.id, []);
        io.emit('channels-updated', channels);
      }
    });

    // 6. Upload Custom Emoji
    socket.on('create-emoji', (emoji: WapperCustomEmoji) => {
      if (!emoji?.id || !emoji.name || !emoji.imageUrl) return;
      if (!customEmojis.some((e) => e.id === emoji.id)) {
        customEmojis.push(emoji);
        io.emit('emojis-updated', customEmojis);
      }
    });

    // 7. User Presence / Mute / Deafen Status Update
    socket.on(
      'user-status-change',
      (payload: {
        userId: string;
        status?: PresenceStatus;
        isMuted?: boolean;
        isDeafened?: boolean;
      }) => {
        const existing = profilesMap.get(payload.userId);
        if (existing) {
          profilesMap.set(payload.userId, {
            ...existing,
            ...(payload.status ? { status: payload.status } : {}),
            ...(payload.isMuted !== undefined ? { isMuted: payload.isMuted } : {}),
            ...(payload.isDeafened !== undefined ? { isDeafened: payload.isDeafened } : {}),
            updatedAt: new Date().toISOString(),
          });
          io.emit('profiles-updated', Array.from(profilesMap.values()));
          io.emit('friends-updated', { affectedUserIds: [payload.userId] });
        }
      }
    );

    // --- WEBRTC P2P VOICE & VIDEO SIGNALING ---

    socket.on(
      'join-voice-channel',
      (peer: Omit<VoicePeerState, 'socketId'>) => {
        if (!peer?.channelId || !peer.userId) return;

        voiceRooms.forEach((roomPeers, roomChanId) => {
          if (roomPeers.has(socket.id)) {
            roomPeers.delete(socket.id);
            socket.leave(`voice:${roomChanId}`);
            socket.to(`voice:${roomChanId}`).emit('voice-peer-left', {
              socketId: socket.id,
              userId: peer.userId,
              channelId: roomChanId,
            });
          }
        });

        const roomKey = `voice:${peer.channelId}`;
        socket.join(roomKey);

        if (!voiceRooms.has(peer.channelId)) {
          voiceRooms.set(peer.channelId, new Map());
        }
        const roomPeers = voiceRooms.get(peer.channelId)!;

        const existingPeers = Array.from(roomPeers.values());
        socket.emit('voice-room-peers', {
          channelId: peer.channelId,
          peers: existingPeers,
        });

        const newPeerState: VoicePeerState = {
          ...peer,
          socketId: socket.id,
        };
        roomPeers.set(socket.id, newPeerState);

        const userRecord = profilesMap.get(peer.userId);
        if (userRecord) {
          profilesMap.set(peer.userId, {
            ...userRecord,
            activeVoiceChannelId: peer.channelId,
            isMuted: peer.isMuted,
            isDeafened: peer.isDeafened,
          });
          io.emit('profiles-updated', Array.from(profilesMap.values()));
        }

        socket.to(roomKey).emit('voice-peer-joined', newPeerState);
        broadcastVoiceRoomState();
      }
    );

    socket.on('leave-voice-channel', (payload: { channelId: string; userId: string }) => {
      handleLeaveVoice(socket.id, payload?.userId);
    });

    socket.on('voice-media-state', (payload: Partial<VoicePeerState> & { channelId: string }) => {
      if (!payload?.channelId) return;
      const roomPeers = voiceRooms.get(payload.channelId);
      if (roomPeers && roomPeers.has(socket.id)) {
        const current = roomPeers.get(socket.id)!;
        const updated: VoicePeerState = {
          ...current,
          ...payload,
          socketId: socket.id,
        };
        roomPeers.set(socket.id, updated);
        io.to(`voice:${payload.channelId}`).emit('voice-peer-updated', updated);
        broadcastVoiceRoomState();
      }
    });

    socket.on(
      'webrtc-offer',
      (payload: {
        targetSocketId: string;
        sdp: RTCSessionDescriptionInit;
        channelId: string;
        fromUser: { userId: string; username: string; avatarUrl: string };
      }) => {
        if (!payload?.targetSocketId || !payload.sdp) return;
        io.to(payload.targetSocketId).emit('webrtc-offer', {
          fromSocketId: socket.id,
          sdp: payload.sdp,
          channelId: payload.channelId,
          fromUser: payload.fromUser,
        });
      }
    );

    socket.on(
      'webrtc-answer',
      (payload: {
        targetSocketId: string;
        sdp: RTCSessionDescriptionInit;
        channelId: string;
      }) => {
        if (!payload?.targetSocketId || !payload.sdp) return;
        io.to(payload.targetSocketId).emit('webrtc-answer', {
          fromSocketId: socket.id,
          sdp: payload.sdp,
          channelId: payload.channelId,
        });
      }
    );

    socket.on(
      'ice-candidate',
      (payload: {
        targetSocketId: string;
        candidate: RTCIceCandidateInit;
        channelId: string;
      }) => {
        if (!payload?.targetSocketId || !payload.candidate) return;
        io.to(payload.targetSocketId).emit('ice-candidate', {
          fromSocketId: socket.id,
          candidate: payload.candidate,
          channelId: payload.channelId,
        });
      }
    );

    socket.on('disconnect', () => {
      const userId = socketToUser.get(socket.id);
      handleLeaveVoice(socket.id, userId);
      socketToUser.delete(socket.id);
    });
  });

  function broadcastVoiceRoomState() {
    const activeVoicePeers: Record<string, VoicePeerState[]> = {};
    voiceRooms.forEach((peerMap, chanId) => {
      activeVoicePeers[chanId] = Array.from(peerMap.values());
    });
    io.emit('voice-rooms-overview', activeVoicePeers);
  }

  function handleLeaveVoice(socketId: string, userId?: string) {
    voiceRooms.forEach((roomPeers, chanId) => {
      if (roomPeers.has(socketId)) {
        const peer = roomPeers.get(socketId)!;
        roomPeers.delete(socketId);
        io.to(`voice:${chanId}`).emit('voice-peer-left', {
          socketId,
          userId: peer.userId,
          channelId: chanId,
        });
      }
    });

    if (userId && profilesMap.has(userId)) {
      const existing = profilesMap.get(userId)!;
      profilesMap.set(userId, {
        ...existing,
        activeVoiceChannelId: null,
      });
      io.emit('profiles-updated', Array.from(profilesMap.values()));
    }

    broadcastVoiceRoomState();
  }

  // --- VITE MIDDLEWARE OR PRODUCTION STATIC ASSETS ---
  const distPath = path.resolve(process.cwd(), 'dist');
  const distIndex = path.join(distPath, 'index.html');
  const isProdRuntime =
    process.env.NODE_ENV === 'production' ||
    process.env.npm_lifecycle_event === 'start';
  const useViteDevMiddleware =
    !isProdRuntime &&
    (process.env.npm_lifecycle_event === 'dev' || !fs.existsSync(distIndex));

  if (useViteDevMiddleware) {
    const { createServer: createViteServer } = await import('vite');
    const isHmrDisabled =
      process.env.DISABLE_HMR === 'true' ||
      Boolean(process.env.K_SERVICE) ||
      Boolean(process.env.CLOUD_RUN_JOB);

    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: isHmrDisabled ? false : { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(distIndex);
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[Wapper Server] Express + Socket.io P2P Signaling running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Wapper Server] Fatal startup error:', err);
  process.exit(1);
});
