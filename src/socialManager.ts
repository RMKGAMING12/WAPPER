/**
 * Wapper Social Relationship Manager (`socialManager.ts`)
 * Production-ready social graph operations (`sendFriendRequest`, `acceptFriendRequest`,
 * `declineFriendRequest`, `removeFriend`, `blockUser`, `unblockUser`) interacting
 * directly with Supabase PostgreSQL schemas (`friends` & `profiles`), Firebase Firestore,
 * and the real-time Express + Socket.io signaling server.
 */
import {
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
} from './firebase';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import {
  HydratedFriendItem,
  WapperProfile,
  FriendRelationshipStatus,
  parseFriendTagInput,
  sanitizeId,
} from './utils/chatLogic';

async function syncFriendEdgeToFirestore(
  relationshipId: string,
  userId: string,
  friendId: string,
  status: FriendRelationshipStatus
): Promise<void> {
  const fbUser = auth.currentUser;
  if (!fbUser || !fbUser.emailVerified) return;

  const cleanRelId = sanitizeId(relationshipId);
  const cleanUserId = sanitizeId(userId);
  const cleanFriendId = sanitizeId(friendId);
  if (cleanUserId !== fbUser.uid && cleanFriendId !== fbUser.uid) return;

  const path = `friends/${cleanRelId}`;
  try {
    await setDoc(doc(db, 'friends', cleanRelId), {
      id: cleanRelId,
      userId: cleanUserId,
      friendId: cleanFriendId,
      status,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

async function deleteFriendEdgeFromFirestore(relationshipId: string): Promise<void> {
  const fbUser = auth.currentUser;
  if (!fbUser || !fbUser.emailVerified) return;

  const cleanRelId = sanitizeId(relationshipId);
  const path = `friends/${cleanRelId}`;
  try {
    await deleteDoc(doc(db, 'friends', cleanRelId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

/**
 * Fetches all real-time friend relationships (Online, All, Pending Incoming/Outgoing, Blocked)
 * for the given user ID with zero mock entries.
 */
export async function fetchHydratedFriends(userId: string): Promise<HydratedFriendItem[]> {
  if (!userId) return [];

  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('friends')
      .select(
        `
        id,
        user_id,
        friend_id,
        status,
        updated_at,
        friend_profile:profiles!friends_friend_id_fkey (
          id,
          username,
          discriminator,
          unique_tag,
          avatar_url,
          banner_url,
          banner_color,
          bio,
          custom_status_text,
          custom_status_emoji,
          profile_theme_color,
          status,
          created_at,
          updated_at
        )
      `
      )
      .eq('user_id', userId);

    if (!error && Array.isArray(data)) {
      return data
        .map((row: Record<string, unknown>) => {
          const fp = row.friend_profile as Record<string, unknown> | undefined;
          if (!fp) return null;
          const profile: WapperProfile = {
            id: String(fp.id || ''),
            username: String(fp.username || ''),
            discriminator: String(fp.discriminator || '0001'),
            uniqueTag: String(fp.unique_tag || `${fp.username}#${fp.discriminator}`),
            avatarUrl: String(fp.avatar_url || ''),
            bannerUrl: String(fp.banner_url || ''),
            bannerColor: String(fp.banner_color || '#5865F2'),
            bio: String(fp.bio || ''),
            customStatusText: String(fp.custom_status_text || ''),
            customStatusEmoji: String(fp.custom_status_emoji || ''),
            profileThemeColor: String(fp.profile_theme_color || '#5865F2'),
            status: (fp.status as WapperProfile['status']) || 'offline',
            createdAt: String(fp.created_at || new Date().toISOString()),
            updatedAt: String(fp.updated_at || new Date().toISOString()),
          };
          return {
            relationshipId: String(row.id),
            userId: String(row.user_id),
            friendId: String(row.friend_id),
            relationshipStatus: row.status as FriendRelationshipStatus,
            profile,
            updatedAt: String(row.updated_at || new Date().toISOString()),
          };
        })
        .filter((x): x is HydratedFriendItem => Boolean(x));
    }
  }

  const res = await fetch(`/api/friends/${encodeURIComponent(userId)}`);
  if (!res.ok) {
    throw new Error('Failed to load friends list.');
  }
  const payload = await res.json();
  return Array.isArray(payload.friends) ? (payload.friends as HydratedFriendItem[]) : [];
}

/**
 * Sends a friend request to another user by their unique tag (`username#1234`) or username.
 * Creates `pending_outgoing` for the sender and `pending_incoming` for the recipient.
 */
export async function sendFriendRequest(
  currentUserId: string,
  targetTagInput: string
): Promise<{
  message: string;
  targetProfile: WapperProfile;
  friends: HydratedFriendItem[];
}> {
  const parsed = parseFriendTagInput(targetTagInput);
  if (!parsed.valid) {
    throw new Error(parsed.error || 'Invalid username tag.');
  }

  if (isSupabaseConfigured) {
    let query = supabase.from('profiles').select('*');
    if (parsed.discriminatorQuery) {
      query = query
        .ilike('username', parsed.usernameQuery)
        .eq('discriminator', parsed.discriminatorQuery);
    } else {
      query = query.ilike('username', parsed.usernameQuery);
    }
    const { data: matches, error: findErr } = await query.limit(1);
    if (findErr || !matches || matches.length === 0) {
      throw new Error(
        `No registered user found matching "${targetTagInput.trim()}". Share your unique tag with a friend or open another session to connect!`
      );
    }
    const targetRow = matches[0];
    if (targetRow.id === currentUserId) {
      throw new Error('You cannot send a friend request to yourself.');
    }

    await supabase.from('friends').upsert(
      [
        {
          user_id: currentUserId,
          friend_id: targetRow.id,
          status: 'pending_outgoing',
          updated_at: new Date().toISOString(),
        },
        {
          user_id: targetRow.id,
          friend_id: currentUserId,
          status: 'pending_incoming',
          updated_at: new Date().toISOString(),
        },
      ],
      { onConflict: 'user_id,friend_id' }
    );
  }

  const response = await fetch('/api/friends/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: currentUserId,
      targetTag: targetTagInput.trim(),
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Could not send friend request.');
  }

  if (data.targetProfile?.id) {
    await syncFriendEdgeToFirestore(
      `fr_${currentUserId}_${data.targetProfile.id}`,
      currentUserId,
      data.targetProfile.id,
      'pending_outgoing'
    );
  }

  return {
    message: data.message || `Friend request sent to ${data.targetProfile?.uniqueTag}!`,
    targetProfile: data.targetProfile as WapperProfile,
    friends: (data.friends || []) as HydratedFriendItem[],
  };
}

/**
 * Accepts an incoming friend request (`pending_incoming` -> `accepted` for both users).
 */
export async function acceptFriendRequest(
  currentUserId: string,
  friendId: string
): Promise<HydratedFriendItem[]> {
  if (isSupabaseConfigured) {
    const nowIso = new Date().toISOString();
    await supabase
      .from('friends')
      .update({ status: 'accepted', updated_at: nowIso })
      .match({ user_id: currentUserId, friend_id: friendId });
    await supabase
      .from('friends')
      .update({ status: 'accepted', updated_at: nowIso })
      .match({ user_id: friendId, friend_id: currentUserId });
  }

  const response = await fetch('/api/friends/accept', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: currentUserId, friendId }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to accept friend request.');
  }

  await syncFriendEdgeToFirestore(
    `fr_${currentUserId}_${friendId}`,
    currentUserId,
    friendId,
    'accepted'
  );

  return (data.friends || []) as HydratedFriendItem[];
}

/**
 * Declines an incoming friend request or cancels an outgoing request.
 */
export async function declineFriendRequest(
  currentUserId: string,
  friendId: string
): Promise<HydratedFriendItem[]> {
  return await removeFriend(currentUserId, friendId);
}

/**
 * Removes an existing friend or pending friend request from both users' relationship lists.
 */
export async function removeFriend(
  currentUserId: string,
  friendId: string
): Promise<HydratedFriendItem[]> {
  if (isSupabaseConfigured) {
    await supabase
      .from('friends')
      .delete()
      .or(
        `and(user_id.eq.${currentUserId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${currentUserId})`
      );
  }

  const response = await fetch('/api/friends/remove', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: currentUserId, friendId }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to remove friend.');
  }

  await deleteFriendEdgeFromFirestore(`fr_${currentUserId}_${friendId}`);
  return (data.friends || []) as HydratedFriendItem[];
}

/**
 * Blocks a user by ID or unique tag (`status: 'blocked'`), severing any existing friendship.
 */
export async function blockUser(
  currentUserId: string,
  targetUserIdOrTag: string
): Promise<HydratedFriendItem[]> {
  if (isSupabaseConfigured && !targetUserIdOrTag.includes('#')) {
    await supabase.from('friends').upsert(
      {
        user_id: currentUserId,
        friend_id: targetUserIdOrTag,
        status: 'blocked',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,friend_id' }
    );
    await supabase
      .from('friends')
      .delete()
      .match({ user_id: targetUserIdOrTag, friend_id: currentUserId });
  }

  const response = await fetch('/api/friends/block', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: currentUserId,
      targetUserIdOrTag: targetUserIdOrTag.trim(),
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to block user.');
  }

  if (data.blockedUserId) {
    await syncFriendEdgeToFirestore(
      `fr_${currentUserId}_${data.blockedUserId}`,
      currentUserId,
      data.blockedUserId,
      'blocked'
    );
  }

  return (data.friends || []) as HydratedFriendItem[];
}

/**
 * Unblocks a previously blocked user.
 */
export async function unblockUser(
  currentUserId: string,
  targetUserId: string
): Promise<HydratedFriendItem[]> {
  return await removeFriend(currentUserId, targetUserId);
}
