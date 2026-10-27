/**
 * Wapper Supabase + Cloud Persistence Client (`supabaseClient.ts`)
 * Initializes the official `@supabase/supabase-js` client for authentication,
 * PostgreSQL tables (`users`, `servers`, `channels`, `server_members`, `roles`,
 * `messages`, `custom_emojis`), and custom emoji storage buckets (`emojis`),
 * while seamlessly syncing with Firebase Firestore and local base64 storage
 * when running in zero-config free-tier mode.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://xyzcompany.supabase.co';
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.wapper-free-tier-anon-key';

export const isSupabaseConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
);

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

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
 * Persists a message to Supabase PostgreSQL (if configured) and Firebase Firestore
 * (when user is signed in with verified Google Auth).
 */
export async function persistMessageRecord(message: {
  id: string;
  channelId: string;
  serverId: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  gifUrl?: string;
  attachmentUrl?: string;
  attachmentAnalysis?: string;
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
    const validServerId = message.serverId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128);
    const validChannelId = message.channelId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128);
    const validMsgId = message.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128);
    const validAuthorId = currentUser.uid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128);
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
      if (message.authorAvatar) payload.authorAvatar = message.authorAvatar.slice(0, 2048);
      if (message.gifUrl) payload.gifUrl = message.gifUrl.slice(0, 2048);
      if (message.attachmentUrl) payload.attachmentUrl = message.attachmentUrl.slice(0, 600000);
      if (message.attachmentAnalysis)
        payload.attachmentAnalysis = message.attachmentAnalysis.slice(0, 4000);

      await setDoc(
        doc(db, 'servers', validServerId, 'channels', validChannelId, 'messages', validMsgId),
        payload
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }
}
