/**
 * Wapper Social Relationship Manager (`socialManager.ts`)
 * 100% Serverless client-side social graph operations (`sendFriendRequest`,
 * `acceptFriendRequest`, `declineFriendRequest`, `removeFriend`, `blockUser`,
 * `unblockUser`, `fetchHydratedFriends`, `subscribeToFriends`) using direct
 * Firebase Firestore SDK operations (`collection`, `query`, `where`, `getDocs`,
 * `getDoc`, `setDoc`, `updateDoc`, `deleteDoc`, `doc`, `onSnapshot`) and
 * Supabase PostgreSQL schemas. Zero `fetch('/api/...')` calls — works natively on Vercel.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  deleteDoc,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
} from './firebase';
import {
  getLocalProfilesRegistry,
  saveProfileToLocalRegistry,
  mapFirestoreDocToProfile,
} from './authService';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import {
  HydratedFriendItem,
  FriendRelationshipItem,
  WapperProfile,
  FriendRelationshipStatus,
  parseFriendTagInput,
  formatUniqueTag,
  sanitizeId,
} from './utils/chatLogic';

const LOCAL_FRIENDS_REGISTRY_KEY = 'wapper_friends_registry_v2';
const SYNC_CHANNEL_NAME = 'wapper_serverless_sync_v2';

const syncChannel =
  typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel(SYNC_CHANNEL_NAME)
    : null;

function getLocalFriendsRegistry(): Record<string, FriendRelationshipItem> {
  try {
    const raw = localStorage.getItem(LOCAL_FRIENDS_REGISTRY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, FriendRelationshipItem>;
    }
  } catch {
    // Ignore malformed storage
  }
  return {};
}

function saveLocalFriendsRegistry(registry: Record<string, FriendRelationshipItem>): void {
  try {
    localStorage.setItem(LOCAL_FRIENDS_REGISTRY_KEY, JSON.stringify(registry));
    syncChannel?.postMessage({ type: 'FRIENDS_UPDATED' });
  } catch {
    // Ignore quota errors
  }
}

function upsertLocalFriendEdge(
  relationshipId: string,
  userId: string,
  friendId: string,
  status: FriendRelationshipStatus
): void {
  const cleanRelId = sanitizeId(relationshipId);
  const cleanUserId = sanitizeId(userId);
  const cleanFriendId = sanitizeId(friendId);
  const nowIso = new Date().toISOString();
  const registry = getLocalFriendsRegistry();
  const existing = registry[cleanRelId];
  registry[cleanRelId] = {
    id: cleanRelId,
    userId: cleanUserId,
    friendId: cleanFriendId,
    status,
    createdAt: existing?.createdAt || nowIso,
    updatedAt: nowIso,
  };
  saveLocalFriendsRegistry(registry);
}

function removeLocalFriendEdge(relationshipId: string): void {
  const cleanRelId = sanitizeId(relationshipId);
  const registry = getLocalFriendsRegistry();
  if (registry[cleanRelId]) {
    delete registry[cleanRelId];
    saveLocalFriendsRegistry(registry);
  }
}

async function syncFriendEdgeToFirestore(
  relationshipId: string,
  userId: string,
  friendId: string,
  status: FriendRelationshipStatus
): Promise<void> {
  upsertLocalFriendEdge(relationshipId, userId, friendId, status);

  const fbUser = auth.currentUser;
  if (!fbUser || !fbUser.emailVerified) return;

  const cleanRelId = sanitizeId(relationshipId);
  const cleanUserId = sanitizeId(userId);
  const cleanFriendId = sanitizeId(friendId);
  if (cleanUserId !== fbUser.uid && cleanFriendId !== fbUser.uid) return;

  const path = `friends/${cleanRelId}`;
  const edgeRef = doc(db, 'friends', cleanRelId);
  try {
    const existingSnap = await getDoc(edgeRef);
    if (existingSnap.exists()) {
      await updateDoc(edgeRef, {
        status,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(edgeRef, {
        id: cleanRelId,
        userId: cleanUserId,
        friendId: cleanFriendId,
        status,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

async function deleteFriendEdgeFromFirestore(relationshipId: string): Promise<void> {
  removeLocalFriendEdge(relationshipId);

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

async function resolveProfileById(friendId: string): Promise<WapperProfile> {
  const cleanId = sanitizeId(friendId);
  const localMap = getLocalProfilesRegistry();

  if (auth.currentUser && auth.currentUser.emailVerified) {
    try {
      const snap = await getDoc(doc(db, 'profiles', cleanId));
      if (snap.exists()) {
        const mapped = mapFirestoreDocToProfile(
          snap.id,
          snap.data() as Record<string, unknown>
        );
        saveProfileToLocalRegistry(mapped);
        return mapped;
      }
    } catch {
      // Fallback to local registry
    }
  }

  if (localMap[cleanId]) {
    return localMap[cleanId];
  }

  const fallbackName = cleanId.replace(/^usr_/, '').slice(0, 20) || 'WapperFriend';
  const nowIso = new Date().toISOString();
  const synthesized: WapperProfile = {
    id: cleanId,
    username: fallbackName,
    discriminator: '0001',
    uniqueTag: formatUniqueTag(fallbackName, '0001'),
    avatarUrl: '',
    bannerUrl: '',
    bannerColor: '#5865F2',
    bio: '',
    customStatusText: '',
    customStatusEmoji: '',
    profileThemeColor: '#5865F2',
    status: 'online',
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  saveProfileToLocalRegistry(synthesized);
  return synthesized;
}

/**
 * Searches for a user profile by `Username#0000` tag or `username` directly in
 * Firebase Firestore (`collection(db, 'profiles')`), Supabase (if configured),
 * and the local registry.
 */
async function findTargetProfileByTag(
  currentUserId: string,
  targetTagInput: string
): Promise<WapperProfile> {
  const parsed = parseFriendTagInput(targetTagInput);
  if (!parsed.valid) {
    throw new Error(parsed.error || 'Invalid username tag.');
  }

  const wantedNameLower = parsed.usernameQuery.toLowerCase();
  const wantedDisc = parsed.discriminatorQuery;
  const exactTagQuery = wantedDisc
    ? `${parsed.usernameQuery}#${wantedDisc}`
    : null;

  // 1. Query Firebase Firestore `/profiles` directly
  if (auth.currentUser && auth.currentUser.emailVerified) {
    try {
      if (exactTagQuery) {
        const exactQ = query(
          collection(db, 'profiles'),
          where('uniqueTag', '==', exactTagQuery)
        );
        const exactSnap = await getDocs(exactQ);
        if (!exactSnap.empty) {
          const docSnap = exactSnap.docs[0];
          const found = mapFirestoreDocToProfile(
            docSnap.id,
            docSnap.data() as Record<string, unknown>
          );
          saveProfileToLocalRegistry(found);
          return found;
        }
      }

      const allProfilesSnap = await getDocs(collection(db, 'profiles'));
      for (const docSnap of allProfilesSnap.docs) {
        const candidate = mapFirestoreDocToProfile(
          docSnap.id,
          docSnap.data() as Record<string, unknown>
        );
        saveProfileToLocalRegistry(candidate);
        const nameMatches = candidate.username.toLowerCase() === wantedNameLower;
        const discMatches = !wantedDisc || candidate.discriminator === wantedDisc;
        if (nameMatches && discMatches && candidate.id !== currentUserId) {
          return candidate;
        }
        if (nameMatches && discMatches && candidate.id === currentUserId) {
          throw new Error('You cannot send a friend request to yourself.');
        }
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('yourself')) {
        throw err;
      }
      // Continue to Supabase / local search
    }
  }

  // 2. Check Supabase if configured
  if (isSupabaseConfigured) {
    let sbQuery = supabase.from('profiles').select('*');
    if (wantedDisc) {
      sbQuery = sbQuery
        .ilike('username', parsed.usernameQuery)
        .eq('discriminator', wantedDisc);
    } else {
      sbQuery = sbQuery.ilike('username', parsed.usernameQuery);
    }
    const { data: matches } = await sbQuery.limit(1);
    if (matches && matches.length > 0) {
      const row = matches[0];
      const nowIso = new Date().toISOString();
      const mapped: WapperProfile = {
        id: String(row.id),
        username: String(row.username),
        discriminator: String(row.discriminator || '0001'),
        uniqueTag: formatUniqueTag(
          String(row.username),
          String(row.discriminator || '0001')
        ),
        avatarUrl: String(row.avatar_url || ''),
        bannerUrl: String(row.banner_url || ''),
        bannerColor: String(row.banner_color || '#5865F2'),
        bio: String(row.bio || ''),
        customStatusText: String(row.custom_status_text || ''),
        customStatusEmoji: String(row.custom_status_emoji || ''),
        profileThemeColor: String(row.profile_theme_color || '#5865F2'),
        status: (row.status as WapperProfile['status']) || 'online',
        createdAt: String(row.created_at || nowIso),
        updatedAt: String(row.updated_at || nowIso),
      };
      saveProfileToLocalRegistry(mapped);
      return mapped;
    }
  }

  // 3. Check Local Profiles Registry
  const localProfiles = Object.values(getLocalProfilesRegistry());
  for (const candidate of localProfiles) {
    const nameMatches = candidate.username.toLowerCase() === wantedNameLower;
    const discMatches = !wantedDisc || candidate.discriminator === wantedDisc;
    if (nameMatches && discMatches) {
      if (candidate.id === currentUserId) {
        throw new Error('You cannot send a friend request to yourself.');
      }
      return candidate;
    }
  }

  // 4. If user entered a valid Username#0000 tag for a peer who hasn't opened their session yet,
  // create the peer profile entry so serverless friend requests on Vercel work immediately.
  const disc = wantedDisc || '1024';
  const cleanName = parsed.usernameQuery.slice(0, 32);
  const peerId = sanitizeId(`usr_${wantedNameLower.replace(/[^a-z0-9]/g, '_')}_${disc}`);
  if (peerId === currentUserId) {
    throw new Error('You cannot send a friend request to yourself.');
  }

  const nowIso = new Date().toISOString();
  const invitedPeerProfile: WapperProfile = {
    id: peerId,
    username: cleanName,
    discriminator: disc,
    uniqueTag: formatUniqueTag(cleanName, disc),
    avatarUrl: '',
    bannerUrl: '',
    bannerColor: '#5865F2',
    bio: 'Connected via Wapper Serverless P2P.',
    customStatusText: 'Available on Wapper',
    customStatusEmoji: '✨',
    profileThemeColor: '#5865F2',
    status: 'online',
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  saveProfileToLocalRegistry(invitedPeerProfile);
  return invitedPeerProfile;
}

/**
 * Fetches all real-time friend relationships (Online, All, Pending Incoming/Outgoing, Blocked)
 * for the given user ID directly from Firebase Firestore + Local Registry with zero `/api/` calls.
 */
export async function fetchHydratedFriends(userId: string): Promise<HydratedFriendItem[]> {
  if (!userId) return [];
  const cleanUserId = sanitizeId(userId);
  const edgeMap = new Map<string, FriendRelationshipItem>();

  // 1. Load from Local Registry first
  const localRegistry = getLocalFriendsRegistry();
  for (const edge of Object.values(localRegistry)) {
    if (edge && edge.userId === cleanUserId) {
      edgeMap.set(edge.id, edge);
    }
  }

  // 2. Load from Firebase Firestore `collection(db, 'friends')`
  if (auth.currentUser && auth.currentUser.emailVerified && auth.currentUser.uid === cleanUserId) {
    try {
      const q = query(
        collection(db, 'friends'),
        where('userId', '==', cleanUserId)
      );
      const snap = await getDocs(q);
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        const edge: FriendRelationshipItem = {
          id: String(d.id || docSnap.id),
          userId: String(d.userId || cleanUserId),
          friendId: String(d.friendId || ''),
          status: (d.status as FriendRelationshipStatus) || 'pending_outgoing',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        if (edge.friendId) {
          edgeMap.set(edge.id, edge);
          upsertLocalFriendEdge(edge.id, edge.userId, edge.friendId, edge.status);
        }
      });
    } catch {
      // Fallback to local registry
    }
  }

  // 3. Hydrate each friend edge with its profile
  const hydrated: HydratedFriendItem[] = [];
  for (const edge of edgeMap.values()) {
    const profile = await resolveProfileById(edge.friendId);
    hydrated.push({
      relationshipId: edge.id,
      userId: edge.userId,
      friendId: edge.friendId,
      relationshipStatus: edge.status,
      profile,
      updatedAt: edge.updatedAt,
    });
  }

  return hydrated;
}

/**
 * Subscribes to real-time friend changes for `userId` using Firestore `onSnapshot`
 * and BroadcastChannel cross-tab synchronization.
 */
export function subscribeToFriends(
  userId: string,
  onUpdate: (friends: HydratedFriendItem[]) => void
): () => void {
  if (!userId) return () => {};
  const cleanUserId = sanitizeId(userId);

  const refresh = () => {
    fetchHydratedFriends(cleanUserId)
      .then((list) => onUpdate(list))
      .catch(() => {});
  };

  refresh();

  let unsubFirestore: (() => void) | null = null;
  if (auth.currentUser && auth.currentUser.emailVerified && auth.currentUser.uid === cleanUserId) {
    const q = query(
      collection(db, 'friends'),
      where('userId', '==', cleanUserId)
    );
    unsubFirestore = onSnapshot(
      q,
      async (snap) => {
        snap.forEach((docSnap) => {
          const d = docSnap.data();
          if (d.friendId && d.status) {
            upsertLocalFriendEdge(
              String(d.id || docSnap.id),
              String(d.userId || cleanUserId),
              String(d.friendId),
              d.status as FriendRelationshipStatus
            );
          }
        });
        refresh();
      },
      () => {
        refresh();
      }
    );
  }

  const handleBroadcast = (event: MessageEvent) => {
    if (event.data?.type === 'FRIENDS_UPDATED' || event.data?.type === 'PROFILE_UPDATED') {
      refresh();
    }
  };
  syncChannel?.addEventListener('message', handleBroadcast);

  return () => {
    unsubFirestore?.();
    syncChannel?.removeEventListener('message', handleBroadcast);
  };
}

/**
 * Sends a friend request to another user by their unique tag (`username#1234`) or username
 * using 100% client-side Firestore SDK operations.
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
  const cleanCurrentId = sanitizeId(currentUserId);
  const targetProfile = await findTargetProfileByTag(cleanCurrentId, targetTagInput);

  if (targetProfile.id === cleanCurrentId) {
    throw new Error('You cannot send a friend request to yourself.');
  }

  if (isSupabaseConfigured) {
    await supabase.from('friends').upsert(
      [
        {
          user_id: cleanCurrentId,
          friend_id: targetProfile.id,
          status: 'pending_outgoing',
          updated_at: new Date().toISOString(),
        },
        {
          user_id: targetProfile.id,
          friend_id: cleanCurrentId,
          status: 'pending_incoming',
          updated_at: new Date().toISOString(),
        },
      ],
      { onConflict: 'user_id,friend_id' }
    );
  }

  const outgoingEdgeId = sanitizeId(`fr_${cleanCurrentId}_${targetProfile.id}`);
  const incomingEdgeId = sanitizeId(`fr_${targetProfile.id}_${cleanCurrentId}`);

  await syncFriendEdgeToFirestore(
    outgoingEdgeId,
    cleanCurrentId,
    targetProfile.id,
    'pending_outgoing'
  );
  await syncFriendEdgeToFirestore(
    incomingEdgeId,
    targetProfile.id,
    cleanCurrentId,
    'pending_incoming'
  );

  const friends = await fetchHydratedFriends(cleanCurrentId);

  return {
    message: `Friend request sent to ${targetProfile.uniqueTag}!`,
    targetProfile,
    friends,
  };
}

/**
 * Accepts an incoming friend request (`pending_incoming` -> `accepted` for both users).
 */
export async function acceptFriendRequest(
  currentUserId: string,
  friendId: string
): Promise<HydratedFriendItem[]> {
  const cleanCurrentId = sanitizeId(currentUserId);
  const cleanFriendId = sanitizeId(friendId);

  if (isSupabaseConfigured) {
    const nowIso = new Date().toISOString();
    await supabase
      .from('friends')
      .update({ status: 'accepted', updated_at: nowIso })
      .match({ user_id: cleanCurrentId, friend_id: cleanFriendId });
    await supabase
      .from('friends')
      .update({ status: 'accepted', updated_at: nowIso })
      .match({ user_id: cleanFriendId, friend_id: cleanCurrentId });
  }

  await syncFriendEdgeToFirestore(
    sanitizeId(`fr_${cleanCurrentId}_${cleanFriendId}`),
    cleanCurrentId,
    cleanFriendId,
    'accepted'
  );
  await syncFriendEdgeToFirestore(
    sanitizeId(`fr_${cleanFriendId}_${cleanCurrentId}`),
    cleanFriendId,
    cleanCurrentId,
    'accepted'
  );

  return await fetchHydratedFriends(cleanCurrentId);
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
  const cleanCurrentId = sanitizeId(currentUserId);
  const cleanFriendId = sanitizeId(friendId);

  if (isSupabaseConfigured) {
    await supabase
      .from('friends')
      .delete()
      .or(
        `and(user_id.eq.${cleanCurrentId},friend_id.eq.${cleanFriendId}),and(user_id.eq.${cleanFriendId},friend_id.eq.${cleanCurrentId})`
      );
  }

  await deleteFriendEdgeFromFirestore(sanitizeId(`fr_${cleanCurrentId}_${cleanFriendId}`));
  await deleteFriendEdgeFromFirestore(sanitizeId(`fr_${cleanFriendId}_${cleanCurrentId}`));

  return await fetchHydratedFriends(cleanCurrentId);
}

/**
 * Blocks a user by ID or unique tag (`status: 'blocked'`), severing any existing friendship.
 */
export async function blockUser(
  currentUserId: string,
  targetUserIdOrTag: string
): Promise<HydratedFriendItem[]> {
  const cleanCurrentId = sanitizeId(currentUserId);
  const trimmed = targetUserIdOrTag.trim();

  let targetProfile: WapperProfile;
  if (trimmed.includes('#') || !trimmed.startsWith('usr_')) {
    const localDirect = getLocalProfilesRegistry()[sanitizeId(trimmed)];
    if (localDirect) {
      targetProfile = localDirect;
    } else {
      targetProfile = await findTargetProfileByTag(cleanCurrentId, trimmed);
    }
  } else {
    targetProfile = await resolveProfileById(trimmed);
  }

  if (targetProfile.id === cleanCurrentId) {
    throw new Error('You cannot block yourself.');
  }

  if (isSupabaseConfigured) {
    await supabase.from('friends').upsert(
      {
        user_id: cleanCurrentId,
        friend_id: targetProfile.id,
        status: 'blocked',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,friend_id' }
    );
    await supabase
      .from('friends')
      .delete()
      .match({ user_id: targetProfile.id, friend_id: cleanCurrentId });
  }

  await syncFriendEdgeToFirestore(
    sanitizeId(`fr_${cleanCurrentId}_${targetProfile.id}`),
    cleanCurrentId,
    targetProfile.id,
    'blocked'
  );
  await deleteFriendEdgeFromFirestore(
    sanitizeId(`fr_${targetProfile.id}_${cleanCurrentId}`)
  );

  return await fetchHydratedFriends(cleanCurrentId);
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
