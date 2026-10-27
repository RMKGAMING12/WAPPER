/**
 * Wapper Supabase + Cloud Persistence Client (`supabaseClient.ts`)
 * Initializes the official `@supabase/supabase-js` client for authentication,
 * PostgreSQL tables, and custom emoji storage buckets, while syncing 100%
 * serverless with Firebase Firestore (`doc`, `getDoc`, `setDoc`, `updateDoc`, `deleteDoc`, `serverTimestamp`)
 * and cross-tab BroadcastChannel real-time streams.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import {
  MessageReplyMetadata,
  BotEmbedPayload,
  buildDMConversationId,
  isMessageInDMConversation,
  sortMessagesByCreatedAtAsc,
  sanitizeId,
} from './utils/chatLogic';

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://xyzcompany.supabase.co';
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.wapper-free-tier-anon-key';

export const isSupabaseConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
);

export const supabase: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

export interface CustomEmojiUploadResult {
  name: string;
  imageUrl: string;
  storageProvider: 'supabase-storage' | 'base64-inline';
}

export interface PersistedMessagePayload {
  id: string;
  channelId: string;
  serverId: string;
  conversationId?: string;
  senderId?: string;
  receiverId?: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  authorEmail?: string;
  authorRoleColor?: string;
  authorIsLive?: boolean;
  content: string;
  gifUrl?: string;
  attachmentUrl?: string;
  attachmentAnalysis?: string;
  replyTo?: MessageReplyMetadata;
  reactions?: Record<string, string[]>;
  isBot?: boolean;
  botName?: string;
  botEmbed?: BotEmbedPayload;
  isEdited?: boolean;
  createdAt?: string;
}

export type RealtimeMessageBusEvent =
  | {
      type: 'UPSERT_MESSAGE';
      message: PersistedMessagePayload & { createdAt: string };
    }
  | {
      type: 'UPDATE_REACTIONS';
      serverId: string;
      channelId: string;
      messageId: string;
      reactions: Record<string, string[]>;
    }
  | {
      type: 'EDIT_MESSAGE';
      serverId: string;
      channelId: string;
      messageId: string;
      content: string;
    }
  | {
      type: 'DELETE_MESSAGE';
      serverId: string;
      channelId: string;
      messageId: string;
    };

const LOCAL_DM_REGISTRY_KEY = 'wapper_dm_messages_registry_v3';
const REALTIME_MESSAGE_BUS_CHANNEL = 'wapper_realtime_messages_v3';

const messageBus: BroadcastChannel | null =
  typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel(REALTIME_MESSAGE_BUS_CHANNEL)
    : null;

function readAllLocalDMMessages(): Array<PersistedMessagePayload & { createdAt: string }> {
  try {
    const raw = localStorage.getItem(LOCAL_DM_REGISTRY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAllLocalDMMessages(
  items: Array<PersistedMessagePayload & { createdAt: string }>
): void {
  try {
    localStorage.setItem(LOCAL_DM_REGISTRY_KEY, JSON.stringify(items.slice(-500)));
  } catch {
    // Ignore storage quota errors
  }
}

const localBusListeners = new Set<(event: RealtimeMessageBusEvent) => void>();

function broadcastRealtimeMessageEvent(event: RealtimeMessageBusEvent): void {
  localBusListeners.forEach((listener) => {
    try {
      listener(event);
    } catch {
      // Ignore listener errors
    }
  });
  try {
    messageBus?.postMessage(event);
  } catch {
    // Ignore BroadcastChannel errors
  }
}

/**
 * Reads persisted Direct Messages for a specific `(userA, userB)` conversation pair
 * from the local registry, ordered by `createdAt` ascending.
 */
export function readLocalDirectMessagesForPair(
  userA: string,
  userB: string
): Array<PersistedMessagePayload & { createdAt: string }> {
  if (!userA || !userB) return [];
  const all = readAllLocalDMMessages();
  const matching = all.filter((m) => isMessageInDMConversation(m, userA, userB));
  return sortMessagesByCreatedAtAsc(matching);
}

/**
 * Subscribes to instant cross-tab BroadcastChannel + storage events so Direct Messages
 * and channel messages synchronize in real time across browser tabs alongside Firestore `onSnapshot`.
 */
export function subscribeToLocalMessageRealtimeBus(
  onEvent: (event: RealtimeMessageBusEvent) => void
): () => void {
  localBusListeners.add(onEvent);

  const handleBroadcast = (ev: MessageEvent<RealtimeMessageBusEvent>) => {
    if (ev?.data && ev.data.type) {
      onEvent(ev.data);
    }
  };

  const handleStorage = (ev: StorageEvent) => {
    if (ev.key === LOCAL_DM_REGISTRY_KEY && ev.newValue) {
      try {
        const items = JSON.parse(ev.newValue) as Array<
          PersistedMessagePayload & { createdAt: string }
        >;
        if (Array.isArray(items)) {
          for (const msg of items) {
            if (msg && msg.id) {
              onEvent({ type: 'UPSERT_MESSAGE', message: msg });
            }
          }
        }
      } catch {
        // Ignore malformed JSON
      }
    }
  };

  messageBus?.addEventListener('message', handleBroadcast);
  window.addEventListener('storage', handleStorage);

  return () => {
    localBusListeners.delete(onEvent);
    messageBus?.removeEventListener('message', handleBroadcast);
    window.removeEventListener('storage', handleStorage);
  };
}

/**
 * Converts a File (PNG, JPG, GIF, WebP, SVG) to a compact Data URL or uploads
 * to the free Supabase `custom-emojis` storage bucket if configured.
 */
export async function uploadCustomEmojiAsset(
  serverId: string,
  emojiName: string,
  file: File
): Promise<CustomEmojiUploadResult> {
  const sanitizedName = emojiName.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 32);

  if (isSupabaseConfigured) {
    const ext = file.name.split('.').pop() || 'png';
    const filePath = `${serverId}/${sanitizedName}_${Date.now()}.${ext}`;
    const { data, error } = await supabase.storage
      .from('custom-emojis')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (!error && data) {
      const { data: publicUrlData } = supabase.storage
        .from('custom-emojis')
        .getPublicUrl(data.path);
      return {
        name: sanitizedName,
        imageUrl: publicUrlData.publicUrl,
        storageProvider: 'supabase-storage',
      };
    }
  }

  // Zero-cost base64 conversion fallback
  const base64Url = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read emoji file'));
    reader.readAsDataURL(file);
  });

  return {
    name: sanitizedName,
    imageUrl: base64Url.slice(0, 490000),
    storageProvider: 'base64-inline',
  };
}

/**
 * Persists a message (including Direct Messages with `senderId`/`receiverId` in `direct_messages`,
 * or server channel messages in `servers/{serverId}/channels/{channelId}/messages`)
 * to Firebase Firestore and broadcasts to active listeners.
 */
export async function persistMessageRecord(
  message: PersistedMessagePayload
): Promise<void> {
  const createdAtIso = message.createdAt || new Date().toISOString();
  const isDirectMessage =
    message.serverId === 'srv_dm' ||
    message.channelId.startsWith('dm_') ||
    Boolean(message.receiverId);

  const resolvedSenderId = sanitizeId(message.senderId || message.authorId);
  const resolvedReceiverId = message.receiverId
    ? sanitizeId(message.receiverId)
    : '';
  const resolvedConversationId =
    resolvedSenderId && resolvedReceiverId
      ? buildDMConversationId(resolvedSenderId, resolvedReceiverId)
      : sanitizeId(message.conversationId || message.channelId);

  // Sync with local DM registry & BroadcastChannel for instant multi-tab updates
  const localRecord: PersistedMessagePayload & { createdAt: string } = {
    ...message,
    senderId: resolvedSenderId,
    receiverId: resolvedReceiverId || undefined,
    conversationId: isDirectMessage ? resolvedConversationId : undefined,
    createdAt: createdAtIso,
  };

  if (isDirectMessage) {
    const currentDMs = readAllLocalDMMessages();
    const filtered = currentDMs.filter((m) => m.id !== localRecord.id);
    writeAllLocalDMMessages([...filtered, localRecord]);
  }
  broadcastRealtimeMessageEvent({
    type: 'UPSERT_MESSAGE',
    message: localRecord,
  });

  if (isSupabaseConfigured) {
    await supabase.from('messages').insert({
      id: message.id,
      channel_id: message.channelId,
      server_id: message.serverId,
      author_id: message.authorId,
      content: message.content,
      gif_url: message.gifUrl || null,
      attachment_url: message.attachmentUrl || null,
      attachment_analysis: message.attachmentAnalysis || null,
    });
  }

  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) {
    return;
  }

  const validServerId = sanitizeId(isDirectMessage ? 'srv_dm' : message.serverId);
  const validChannelId = sanitizeId(
    isDirectMessage ? resolvedConversationId : message.channelId
  );
  const validMsgId = sanitizeId(message.id);
  const validAuthorId = sanitizeId(currentUser.uid);

  const buildSharedPayload = (): Record<string, unknown> => {
    const payload: Record<string, unknown> = {
      id: validMsgId,
      channelId: validChannelId,
      serverId: validServerId,
      authorId: validAuthorId,
      authorName: message.authorName.slice(0, 64),
      content: message.content.slice(0, 4000),
      createdAt: serverTimestamp(),
    };
    if (message.authorAvatar) {
      payload.authorAvatar = message.authorAvatar.slice(0, 500000);
    }
    if (message.authorRoleColor) {
      payload.authorRoleColor = message.authorRoleColor.slice(0, 16);
    }
    if (message.gifUrl) {
      payload.gifUrl = message.gifUrl.slice(0, 500000);
    }
    if (message.attachmentUrl) {
      payload.attachmentUrl = message.attachmentUrl.slice(0, 600000);
    }
    if (message.attachmentAnalysis) {
      payload.attachmentAnalysis = message.attachmentAnalysis.slice(0, 4000);
    }
    if (message.replyTo) {
      payload.replyTo = {
        messageId: String(message.replyTo.messageId || '').slice(0, 128),
        authorId: String(message.replyTo.authorId || '').slice(0, 128),
        authorName: String(message.replyTo.authorName || '').slice(0, 64),
        authorAvatar: String(message.replyTo.authorAvatar || '').slice(0, 500000),
        contentPreview: String(message.replyTo.contentPreview || '').slice(0, 200),
      };
    }
    if (message.reactions) {
      payload.reactions = message.reactions;
    }
    if (message.isBot !== undefined) {
      payload.isBot = Boolean(message.isBot);
    }
    if (message.botName) {
      payload.botName = message.botName.slice(0, 64);
    }
    if (message.botEmbed) {
      payload.botEmbed = message.botEmbed;
    }
    return payload;
  };

  if (isDirectMessage && resolvedReceiverId) {
    const dmPath = `direct_messages/${validMsgId}`;
    try {
      const dmPayload: Record<string, unknown> = {
        ...buildSharedPayload(),
        conversationId: resolvedConversationId,
        senderId: validAuthorId,
        receiverId: resolvedReceiverId,
      };
      await setDoc(doc(db, 'direct_messages', validMsgId), dmPayload);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, dmPath);
    }
    return;
  }

  // Standard Server Channel Message
  const channelMsgPath = `servers/${validServerId}/channels/${validChannelId}/messages/${validMsgId}`;
  try {
    // Only create parent server/channel if they do not exist yet (prevents non-owner update errors)
    const serverRef = doc(db, 'servers', validServerId);
    const serverSnap = await getDoc(serverRef);
    if (!serverSnap.exists()) {
      await setDoc(serverRef, {
        id: validServerId,
        name: 'Wapper Community Server',
        ownerId: validAuthorId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const channelRef = doc(db, 'servers', validServerId, 'channels', validChannelId);
    const channelSnap = await getDoc(channelRef);
    if (!channelSnap.exists()) {
      await setDoc(channelRef, {
        id: validChannelId,
        serverId: validServerId,
        name: 'general',
        type: 'text',
        category: 'Text Channels',
        ownerId: validAuthorId,
        createdAt: serverTimestamp(),
      });
    }

    const payload = buildSharedPayload();
    await setDoc(
      doc(
        db,
        'servers',
        validServerId,
        'channels',
        validChannelId,
        'messages',
        validMsgId
      ),
      payload
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, channelMsgPath);
  }
}

/**
 * Updates the `reactions` map on a Direct Message or Server Channel Message in Firestore.
 */
export async function updateMessageReactionsInCloud(params: {
  serverId: string;
  channelId: string;
  messageId: string;
  reactions: Record<string, string[]>;
  isDMMode?: boolean;
}): Promise<void> {
  const isDM =
    Boolean(params.isDMMode) ||
    params.serverId === 'srv_dm' ||
    params.channelId.startsWith('dm_');

  if (isDM) {
    const currentDMs = readAllLocalDMMessages();
    const updatedDMs = currentDMs.map((m) =>
      m.id === params.messageId ? { ...m, reactions: params.reactions } : m
    );
    writeAllLocalDMMessages(updatedDMs);
  }

  broadcastRealtimeMessageEvent({
    type: 'UPDATE_REACTIONS',
    serverId: params.serverId,
    channelId: params.channelId,
    messageId: params.messageId,
    reactions: params.reactions,
  });

  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) return;

  const validMsgId = sanitizeId(params.messageId);

  if (isDM) {
    const dmPath = `direct_messages/${validMsgId}`;
    try {
      await updateDoc(doc(db, 'direct_messages', validMsgId), {
        reactions: params.reactions,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, dmPath);
    }
    return;
  }

  const validServerId = sanitizeId(params.serverId);
  const validChannelId = sanitizeId(params.channelId);
  const path = `servers/${validServerId}/channels/${validChannelId}/messages/${validMsgId}`;

  try {
    await updateDoc(
      doc(
        db,
        'servers',
        validServerId,
        'channels',
        validChannelId,
        'messages',
        validMsgId
      ),
      {
        reactions: params.reactions,
        updatedAt: serverTimestamp(),
      }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Updates the `content` and `isEdited` fields on a Direct Message or Server Channel Message in Firestore.
 */
export async function updateMessageContentInCloud(params: {
  serverId: string;
  channelId: string;
  messageId: string;
  content: string;
  isDMMode?: boolean;
}): Promise<void> {
  const isDM =
    Boolean(params.isDMMode) ||
    params.serverId === 'srv_dm' ||
    params.channelId.startsWith('dm_');

  if (isDM) {
    const currentDMs = readAllLocalDMMessages();
    const updatedDMs = currentDMs.map((m) =>
      m.id === params.messageId
        ? { ...m, content: params.content.slice(0, 4000), isEdited: true }
        : m
    );
    writeAllLocalDMMessages(updatedDMs);
  }

  broadcastRealtimeMessageEvent({
    type: 'EDIT_MESSAGE',
    serverId: params.serverId,
    channelId: params.channelId,
    messageId: params.messageId,
    content: params.content.slice(0, 4000),
  });

  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) return;

  const validMsgId = sanitizeId(params.messageId);

  if (isDM) {
    const dmPath = `direct_messages/${validMsgId}`;
    try {
      await updateDoc(doc(db, 'direct_messages', validMsgId), {
        content: params.content.slice(0, 4000),
        isEdited: true,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, dmPath);
    }
    return;
  }

  const validServerId = sanitizeId(params.serverId);
  const validChannelId = sanitizeId(params.channelId);
  const path = `servers/${validServerId}/channels/${validChannelId}/messages/${validMsgId}`;

  try {
    await updateDoc(
      doc(
        db,
        'servers',
        validServerId,
        'channels',
        validChannelId,
        'messages',
        validMsgId
      ),
      {
        content: params.content.slice(0, 4000),
        isEdited: true,
        updatedAt: serverTimestamp(),
      }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Deletes a Direct Message or Server Channel Message document from Firestore.
 */
export async function deleteMessageFromCloud(params: {
  serverId: string;
  channelId: string;
  messageId: string;
  isDMMode?: boolean;
}): Promise<void> {
  const isDM =
    Boolean(params.isDMMode) ||
    params.serverId === 'srv_dm' ||
    params.channelId.startsWith('dm_');

  if (isDM) {
    const currentDMs = readAllLocalDMMessages();
    writeAllLocalDMMessages(currentDMs.filter((m) => m.id !== params.messageId));
  }

  broadcastRealtimeMessageEvent({
    type: 'DELETE_MESSAGE',
    serverId: params.serverId,
    channelId: params.channelId,
    messageId: params.messageId,
  });

  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) return;

  const validMsgId = sanitizeId(params.messageId);

  if (isDM) {
    const dmPath = `direct_messages/${validMsgId}`;
    try {
      await deleteDoc(doc(db, 'direct_messages', validMsgId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, dmPath);
    }
    return;
  }

  const validServerId = sanitizeId(params.serverId);
  const validChannelId = sanitizeId(params.channelId);
  const path = `servers/${validServerId}/channels/${validChannelId}/messages/${validMsgId}`;

  try {
    await deleteDoc(
      doc(
        db,
        'servers',
        validServerId,
        'channels',
        validChannelId,
        'messages',
        validMsgId
      )
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
