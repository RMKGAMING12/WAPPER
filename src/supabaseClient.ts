/**
 * Wapper Supabase + Cloud Persistence Client (`supabaseClient.ts`)
 * Initializes the official `@supabase/supabase-js` client for authentication,
 * PostgreSQL tables, and custom emoji storage buckets, while syncing 100%
 * serverless with Firebase Firestore (`doc`, `setDoc`, `updateDoc`, `deleteDoc`, `serverTimestamp`)
 * and local base64 storage.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import {
  MessageReplyMetadata,
  BotEmbedPayload,
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
 * Persists a message (including replies, reactions, and bot embeds) to Firebase Firestore
 * when the user is signed in with verified Google Auth.
 */
export async function persistMessageRecord(message: {
  id: string;
  channelId: string;
  serverId: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  authorRoleColor?: string;
  content: string;
  gifUrl?: string;
  attachmentUrl?: string;
  attachmentAnalysis?: string;
  replyTo?: MessageReplyMetadata;
  reactions?: Record<string, string[]>;
  isBot?: boolean;
  botName?: string;
  botEmbed?: BotEmbedPayload;
}): Promise<void> {
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
  if (currentUser && currentUser.emailVerified) {
    const validServerId = sanitizeId(message.serverId);
    const validChannelId = sanitizeId(message.channelId);
    const validMsgId = sanitizeId(message.id);
    const validAuthorId = sanitizeId(currentUser.uid);
    const path = `servers/${validServerId}/channels/${validChannelId}/messages/${validMsgId}`;

    try {
      // Ensure parent server & channel documents exist for Master Gate rule validation
      await setDoc(
        doc(db, 'servers', validServerId),
        {
          id: validServerId,
          name: 'Wapper Community Server',
          ownerId: validAuthorId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      await setDoc(
        doc(db, 'servers', validServerId, 'channels', validChannelId),
        {
          id: validChannelId,
          serverId: validServerId,
          name: 'general',
          type: 'text',
          category: 'Text Channels',
          ownerId: validAuthorId,
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

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
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }
}

/**
 * Updates the `reactions` map on a message in Firestore when any user toggles a reaction.
 */
export async function updateMessageReactionsInCloud(params: {
  serverId: string;
  channelId: string;
  messageId: string;
  reactions: Record<string, string[]>;
}): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) return;

  const validServerId = sanitizeId(params.serverId);
  const validChannelId = sanitizeId(params.channelId);
  const validMsgId = sanitizeId(params.messageId);
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
 * Updates the `content` and `isEdited` fields on a message in Firestore.
 */
export async function updateMessageContentInCloud(params: {
  serverId: string;
  channelId: string;
  messageId: string;
  content: string;
}): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) return;

  const validServerId = sanitizeId(params.serverId);
  const validChannelId = sanitizeId(params.channelId);
  const validMsgId = sanitizeId(params.messageId);
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
 * Deletes a message document from Firestore.
 */
export async function deleteMessageFromCloud(params: {
  serverId: string;
  channelId: string;
  messageId: string;
}): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) return;

  const validServerId = sanitizeId(params.serverId);
  const validChannelId = sanitizeId(params.channelId);
  const validMsgId = sanitizeId(params.messageId);
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
