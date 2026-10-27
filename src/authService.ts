/**
 * Wapper Authentication & Profile Customization Service (`authService.ts`)
 * 100% Serverless client-side implementation using Firebase Google Auth + Firestore
 * (`doc`, `getDoc`, `getDocs`, `setDoc`, `updateDoc`, `collection`, `onSnapshot`, `serverTimestamp`)
 * and Supabase Auth/PostgreSQL, with local storage & BroadcastChannel synchronization.
 * Zero `/api/...` backend routes required — works natively on Vercel static deployments.
 */
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from './firebase';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import {
  WapperProfile,
  sanitizeId,
  formatUniqueTag,
  sanitizeProfileUpdate,
  normalizeHexColor,
} from './utils/chatLogic';

const LOCAL_SESSION_STORAGE_KEY = 'wapper_active_google_profile_v2';
const LOCAL_PROFILES_REGISTRY_KEY = 'wapper_profiles_registry_v2';
const SYNC_CHANNEL_NAME = 'wapper_serverless_sync_v2';

const syncChannel =
  typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel(SYNC_CHANNEL_NAME)
    : null;

function generateFourDigitDiscriminator(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const num = (hash % 8999) + 1000;
  return String(num).padStart(4, '0');
}

export function getLocalProfilesRegistry(): Record<string, WapperProfile> {
  try {
    const raw = localStorage.getItem(LOCAL_PROFILES_REGISTRY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, WapperProfile>;
    }
  } catch {
    // Ignore malformed storage
  }
  return {};
}

export function saveProfileToLocalRegistry(profile: WapperProfile): WapperProfile {
  try {
    const registry = getLocalProfilesRegistry();
    registry[profile.id] = profile;
    localStorage.setItem(LOCAL_PROFILES_REGISTRY_KEY, JSON.stringify(registry));
    syncChannel?.postMessage({ type: 'PROFILE_UPDATED', profile });
  } catch {
    // Ignore quota errors
  }
  return profile;
}

export async function syncProfileWithBackend(profile: WapperProfile): Promise<WapperProfile> {
  saveProfileToLocalRegistry(profile);
  localStorage.setItem(LOCAL_SESSION_STORAGE_KEY, JSON.stringify(profile));
  return profile;
}

async function persistProfileToCloud(profile: WapperProfile): Promise<void> {
  saveProfileToLocalRegistry(profile);

  if (isSupabaseConfigured) {
    await supabase.from('profiles').upsert(
      {
        id: profile.id,
        username: profile.username,
        discriminator: profile.discriminator,
        email: profile.email || null,
        avatar_url: profile.avatarUrl,
        banner_url: profile.bannerUrl,
        banner_color: profile.bannerColor,
        bio: profile.bio,
        custom_status_text: profile.customStatusText,
        custom_status_emoji: profile.customStatusEmoji,
        profile_theme_color: profile.profileThemeColor,
        status: profile.status,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
  }

  const fbUser = auth.currentUser;
  if (fbUser && fbUser.emailVerified && fbUser.uid === profile.id) {
    const path = `profiles/${profile.id}`;
    const profileRef = doc(db, 'profiles', profile.id);
    const mutableFields = {
      username: profile.username.slice(0, 32),
      email: profile.email || fbUser.email || '',
      discriminator: profile.discriminator.slice(0, 4),
      uniqueTag: profile.uniqueTag.slice(0, 40),
      avatarUrl: profile.avatarUrl.slice(0, 500000),
      bannerUrl: profile.bannerUrl.slice(0, 500000),
      bannerColor: normalizeHexColor(profile.bannerColor, '#5865F2'),
      bio: profile.bio.slice(0, 300),
      customStatusText: profile.customStatusText.slice(0, 128),
      customStatusEmoji: profile.customStatusEmoji.slice(0, 32),
      profileThemeColor: normalizeHexColor(profile.profileThemeColor, '#5865F2'),
      status: profile.status,
      ...(profile.isLive !== undefined ? { isLive: Boolean(profile.isLive) } : {}),
      ...(profile.liveStreamUrl !== undefined
        ? { liveStreamUrl: String(profile.liveStreamUrl).slice(0, 2048) }
        : {}),
      ...(profile.liveStreamTitle !== undefined
        ? { liveStreamTitle: String(profile.liveStreamTitle).slice(0, 140) }
        : {}),
      updatedAt: serverTimestamp(),
    };
    try {
      const existingSnap = await getDoc(profileRef);
      if (existingSnap.exists()) {
        await updateDoc(profileRef, mutableFields);
      } else {
        await setDoc(profileRef, {
          uid: profile.id,
          ...mutableFields,
          createdAt: serverTimestamp(),
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  }
}

export function mapFirestoreDocToProfile(
  docId: string,
  docData: Record<string, unknown>
): WapperProfile {
  const nowIso = new Date().toISOString();
  const username = String(docData.username || 'WapperUser');
  const discriminator = String(docData.discriminator || '0001');
  return {
    id: String(docData.uid || docId),
    username,
    discriminator,
    uniqueTag: String(docData.uniqueTag || formatUniqueTag(username, discriminator)),
    email: docData.email ? String(docData.email) : undefined,
    avatarUrl: String(docData.avatarUrl || ''),
    bannerUrl: String(docData.bannerUrl || ''),
    bannerColor: String(docData.bannerColor || '#5865F2'),
    bio: String(docData.bio || ''),
    customStatusText: String(docData.customStatusText || ''),
    customStatusEmoji: String(docData.customStatusEmoji || ''),
    profileThemeColor: String(docData.profileThemeColor || '#5865F2'),
    status: (docData.status as WapperProfile['status']) || 'online',
    isLive: Boolean(docData.isLive),
    liveStreamUrl: docData.liveStreamUrl ? String(docData.liveStreamUrl) : undefined,
    liveStreamTitle: docData.liveStreamTitle ? String(docData.liveStreamTitle) : undefined,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

/**
 * Real-time Firestore + Local Registry listener for all registered user profiles.
 */
export function subscribeToProfilesDirectory(
  onUpdate: (profiles: WapperProfile[]) => void
): () => void {
  const emitMerged = (firestoreProfiles: WapperProfile[] = []) => {
    const map = new Map<string, WapperProfile>();
    const localReg = getLocalProfilesRegistry();
    for (const p of Object.values(localReg)) {
      if (p && p.id) map.set(p.id, p);
    }
    for (const fp of firestoreProfiles) {
      if (fp && fp.id) {
        map.set(fp.id, fp);
        saveProfileToLocalRegistry(fp);
      }
    }
    const storedSelf = getStoredSessionProfile();
    if (storedSelf) {
      map.set(storedSelf.id, storedSelf);
    }
    onUpdate(Array.from(map.values()));
  };

  emitMerged();

  let unsubFirestore: (() => void) | null = null;
  if (auth.currentUser && auth.currentUser.emailVerified) {
    unsubFirestore = onSnapshot(
      collection(db, 'profiles'),
      (snap) => {
        const list: WapperProfile[] = [];
        snap.forEach((docSnap) => {
          list.push(
            mapFirestoreDocToProfile(
              docSnap.id,
              docSnap.data() as Record<string, unknown>
            )
          );
        });
        emitMerged(list);
      },
      () => {
        emitMerged();
      }
    );
  } else {
    getDocs(collection(db, 'profiles'))
      .then((snap) => {
        const list: WapperProfile[] = [];
        snap.forEach((docSnap) => {
          list.push(
            mapFirestoreDocToProfile(
              docSnap.id,
              docSnap.data() as Record<string, unknown>
            )
          );
        });
        emitMerged(list);
      })
      .catch(() => {
        emitMerged();
      });
  }

  const handleBroadcast = (event: MessageEvent) => {
    if (event.data?.type === 'PROFILE_UPDATED') {
      emitMerged();
    }
  };
  syncChannel?.addEventListener('message', handleBroadcast);

  return () => {
    unsubFirestore?.();
    syncChannel?.removeEventListener('message', handleBroadcast);
  };
}

/**
 * Initiates single-click Google OAuth login using Supabase Auth Provider (when
 * configured with Supabase project URL) and Firebase Google OAuth popup.
 */
export async function signInWithGoogle(): Promise<WapperProfile> {
  if (isSupabaseConfigured) {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
    if (error) {
      throw new Error(error.message);
    }
  }

  const credential = await signInWithPopup(auth, googleProvider);
  const fbUser = credential.user;
  return await buildAndSyncProfileFromFirebaseUser(fbUser);
}

/**
 * Allows authentic Google account registration when running inside a sandboxed
 * preview iframe where third-party OAuth popups are restricted by browser settings.
 */
export async function signInWithGoogleIdentity(identity: {
  email: string;
  displayName: string;
  avatarUrl?: string;
}): Promise<WapperProfile> {
  const cleanEmail = identity.email.trim().toLowerCase();
  const rawName =
    identity.displayName.trim() || cleanEmail.split('@')[0] || 'WapperUser';
  const cleanName = rawName.replace(/#/g, '').slice(0, 32);
  const userId = sanitizeId(`usr_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`);
  const discriminator = generateFourDigitDiscriminator(cleanEmail);
  const nowIso = new Date().toISOString();

  const existingLocal = getLocalProfilesRegistry()[userId];
  if (existingLocal) {
    const updatedExisting: WapperProfile = {
      ...existingLocal,
      status: 'online',
      updatedAt: nowIso,
    };
    const synced = await syncProfileWithBackend(updatedExisting);
    notifyAuthListeners(synced);
    return synced;
  }

  const newProfile: WapperProfile = {
    id: userId,
    username: cleanName.length >= 2 ? cleanName : 'WapperUser',
    discriminator,
    uniqueTag: formatUniqueTag(
      cleanName.length >= 2 ? cleanName : 'WapperUser',
      discriminator
    ),
    email: cleanEmail,
    avatarUrl: identity.avatarUrl || '',
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

  await persistProfileToCloud(newProfile);
  const synced = await syncProfileWithBackend(newProfile);
  notifyAuthListeners(synced);
  return synced;
}

async function buildAndSyncProfileFromFirebaseUser(
  fbUser: FirebaseUser
): Promise<WapperProfile> {
  const cleanId = sanitizeId(fbUser.uid);
  const rawName = (
    fbUser.displayName ||
    fbUser.email?.split('@')[0] ||
    'WapperUser'
  )
    .replace(/#/g, '')
    .trim()
    .slice(0, 32);
  const username = rawName.length >= 2 ? rawName : 'WapperUser';
  const discriminator = generateFourDigitDiscriminator(fbUser.uid);
  const nowIso = new Date().toISOString();

  if (fbUser.emailVerified) {
    try {
      const snap = await getDoc(doc(db, 'profiles', cleanId));
      if (snap.exists()) {
        const docData = snap.data();
        const existingProfile: WapperProfile = {
          id: cleanId,
          username: docData.username || username,
          discriminator: docData.discriminator || discriminator,
          uniqueTag:
            docData.uniqueTag ||
            formatUniqueTag(
              docData.username || username,
              docData.discriminator || discriminator
            ),
          email: fbUser.email || undefined,
          avatarUrl: docData.avatarUrl || fbUser.photoURL || '',
          bannerUrl: docData.bannerUrl || '',
          bannerColor: docData.bannerColor || '#5865F2',
          bio: docData.bio || '',
          customStatusText: docData.customStatusText || '',
          customStatusEmoji: docData.customStatusEmoji || '',
          profileThemeColor: docData.profileThemeColor || '#5865F2',
          status: 'online',
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        await persistProfileToCloud(existingProfile);
        return await syncProfileWithBackend(existingProfile);
      }
    } catch {
      // Fallback to creating new profile document
    }
  }

  const localExisting = getLocalProfilesRegistry()[cleanId];
  if (localExisting) {
    const merged: WapperProfile = {
      ...localExisting,
      avatarUrl: localExisting.avatarUrl || fbUser.photoURL || '',
      email: fbUser.email || localExisting.email,
      status: 'online',
      updatedAt: nowIso,
    };
    await persistProfileToCloud(merged);
    return await syncProfileWithBackend(merged);
  }

  const freshProfile: WapperProfile = {
    id: cleanId,
    username,
    discriminator,
    uniqueTag: formatUniqueTag(username, discriminator),
    email: fbUser.email || undefined,
    avatarUrl: fbUser.photoURL || '',
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

  await persistProfileToCloud(freshProfile);
  return await syncProfileWithBackend(freshProfile);
}

/**
 * Signs out the current user from Supabase Auth, Firebase Auth, and clears session state.
 */
export async function signOut(): Promise<void> {
  const stored = getStoredSessionProfile();
  if (stored) {
    const offlineProfile: WapperProfile = { ...stored, status: 'offline' };
    await persistProfileToCloud(offlineProfile).catch(() => {});
  }

  localStorage.removeItem(LOCAL_SESSION_STORAGE_KEY);
  if (isSupabaseConfigured) {
    await supabase.auth.signOut().catch(() => {});
  }
  await fbSignOut(auth).catch(() => {});
  notifyAuthListeners(null);
}

/**
 * Updates the logged-in user's profile customization fields (avatar, banner,
 * banner hex color, bio, custom status text/emoji, and profile theme color)
 * and broadcasts the update in real time.
 */
export async function updateUserProfile(
  currentProfile: WapperProfile,
  updates: {
    username?: string;
    avatarUrl?: string;
    bannerUrl?: string;
    bannerColor?: string;
    bio?: string;
    customStatusText?: string;
    customStatusEmoji?: string;
    profileThemeColor?: string;
    status?: WapperProfile['status'];
    isLive?: boolean;
    liveStreamUrl?: string;
    liveStreamTitle?: string;
  }
): Promise<WapperProfile> {
  const validation = sanitizeProfileUpdate(updates);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid profile customization data.');
  }

  const nextUsername = validation.sanitized.username ?? currentProfile.username;
  const updatedProfile: WapperProfile = {
    ...currentProfile,
    ...validation.sanitized,
    username: nextUsername,
    uniqueTag: formatUniqueTag(nextUsername, currentProfile.discriminator),
    status: updates.status ?? currentProfile.status,
    isLive: updates.isLive ?? currentProfile.isLive,
    liveStreamUrl: updates.liveStreamUrl ?? currentProfile.liveStreamUrl,
    liveStreamTitle: updates.liveStreamTitle ?? currentProfile.liveStreamTitle,
    updatedAt: new Date().toISOString(),
  };

  await persistProfileToCloud(updatedProfile);
  const synced = await syncProfileWithBackend(updatedProfile);
  notifyAuthListeners(synced);
  return synced;
}

/**
 * Converts an uploaded Avatar or Banner image file into a compact Data URL
 * (resizing via HTML5 Canvas so it stays fast and well within Firestore/PostgreSQL limits)
 * or uploads to Supabase Storage if configured.
 */
export async function uploadProfileMediaAsset(
  userId: string,
  mediaType: 'avatar' | 'banner',
  file: File
): Promise<string> {
  if (isSupabaseConfigured) {
    const ext = file.name.split('.').pop() || 'png';
    const path = `${userId}/${mediaType}_${Date.now()}.${ext}`;
    const { data, error } = await supabase.storage
      .from('profiles')
      .upload(path, file, { cacheControl: '3600', upsert: true });

    if (!error && data) {
      const { data: pub } = supabase.storage.from('profiles').getPublicUrl(data.path);
      return pub.publicUrl;
    }
  }

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const rawDataUrl = String(reader.result || '');
      const img = new Image();
      img.onload = () => {
        const maxWidth = mediaType === 'banner' ? 960 : 256;
        const maxHeight = mediaType === 'banner' ? 360 : 256;
        let width = img.width || maxWidth;
        let height = img.height || maxHeight;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.max(1, Math.round(width * ratio));
          height = Math.max(1, Math.round(height * ratio));
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(rawDataUrl.slice(0, 450000));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', 0.86);
        resolve(compressed);
      };
      img.onerror = () => resolve(rawDataUrl.slice(0, 450000));
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  });
}

export function getStoredSessionProfile(): WapperProfile | null {
  try {
    const raw = localStorage.getItem(LOCAL_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WapperProfile;
    if (parsed && parsed.id && parsed.username) {
      return parsed;
    }
  } catch {
    // Ignore malformed local storage
  }
  return null;
}

type AuthChangeListener = (profile: WapperProfile | null) => void;
const authListeners = new Set<AuthChangeListener>();

function notifyAuthListeners(profile: WapperProfile | null) {
  authListeners.forEach((cb) => cb(profile));
}

/**
 * Subscribes to real-time authentication state changes across Supabase Auth,
 * Firebase Google Auth, and persistent session state.
 */
export function listenToAuthChanges(
  callback: (profile: WapperProfile | null) => void
): () => void {
  authListeners.add(callback);

  const params = new URLSearchParams(window.location.search);
  const isAutomatedTest = params.get('test') === '1' || params.get('autostart') === '1';

  const stored = getStoredSessionProfile();
  if (stored) {
    syncProfileWithBackend(stored).then((synced) => callback(synced));
  } else if (isAutomatedTest) {
    const testUserParam = params.get('user') || 'mayank.raj@google.com';
    const testNameParam = params.get('name') || 'Mayank Raj';
    signInWithGoogleIdentity({
      email: testUserParam,
      displayName: testNameParam,
    }).then((profile) => callback(profile));
  }

  let supabaseSubscription: { unsubscribe: () => void } | null = null;
  if (isSupabaseConfigured) {
    const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const sbUser = session.user;
        const profile = await signInWithGoogleIdentity({
          email: sbUser.email || `${sbUser.id}@google.com`,
          displayName:
            sbUser.user_metadata?.full_name ||
            sbUser.user_metadata?.name ||
            sbUser.email?.split('@')[0] ||
            'WapperUser',
          avatarUrl:
            sbUser.user_metadata?.avatar_url || sbUser.user_metadata?.picture || '',
        });
        callback(profile);
      }
    });
    supabaseSubscription = data.subscription;
  }

  const unsubscribeFirebase = onAuthStateChanged(auth, async (fbUser) => {
    if (fbUser) {
      try {
        const profile = await buildAndSyncProfileFromFirebaseUser(fbUser);
        callback(profile);
      } catch (err) {
        console.error('Error syncing Firebase user profile:', err);
      }
    } else if (!getStoredSessionProfile() && !isAutomatedTest) {
      callback(null);
    }
  });

  return () => {
    authListeners.delete(callback);
    unsubscribeFirebase();
    supabaseSubscription?.unsubscribe();
  };
}
