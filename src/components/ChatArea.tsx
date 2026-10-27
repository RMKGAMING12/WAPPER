import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
  QuerySnapshot,
  DocumentData,
} from 'firebase/firestore';
import {
  Hash,
  Send,
  Smile,
  SmilePlus,
  Film,
  Search,
  Users,
  Wand2,
  X,
  AtSign,
  Check,
  Menu,
  CornerUpLeft,
  Pencil,
  Trash2,
  Star,
  Bot,
  Music,
  Radio,
  Crown,
  ExternalLink,
  Terminal,
} from 'lucide-react';
import { auth, db } from '../firebase';
import {
  parseInlineMarkdown,
  filterSlashCommands,
  isFounderUser,
  buildDMConversationId,
  isMessageInDMConversation,
  sortMessagesByCreatedAtAsc,
  extractMentionQuery,
  filterMentionCandidates,
  injectMentionIntoInput,
  doesMessageMentionUser,
  sanitizeId,
  MentionCandidate,
  MessageReplyMetadata,
  BotEmbedPayload,
  SlashCommandDefinition,
  BLUEPRINT_LIMITS,
} from '../utils/chatLogic';
import { playNotificationPing } from '../utils/soundNotification';
import { getLocalProfilesRegistry } from '../authService';
import {
  readLocalDirectMessagesForPair,
  subscribeToLocalMessageRealtimeBus,
} from '../supabaseClient';
import {
  GifEmojiPicker,
  GifMediaItem,
  MediaPickerTab,
} from './GifEmojiPicker';

export interface ChatMessageItem {
  id: string;
  channelId: string;
  serverId: string;
  conversationId?: string;
  senderId?: string;
  receiverId?: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
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
  createdAt: string;
}

export interface CustomEmojiItem {
  id: string;
  serverId: string;
  name: string;
  imageUrl: string;
  creatorId: string;
  createdAt: string;
}

export interface SharedMiniPlayerState {
  videoId: string;
  title: string;
  streamUrl: string;
  startedBy: string;
  isLive?: boolean;
}

interface ChatAreaProps {
  channelId: string;
  channelName: string;
  channelTopic: string;
  isDMMode: boolean;
  dmPeerId?: string | null;
  serverId: string;
  currentUserId: string;
  currentUsername: string;
  serverMembers?: MentionCandidate[];
  canDeleteMessages?: boolean;
  canManageEmojis?: boolean;
  messages: ChatMessageItem[];
  customEmojis: CustomEmojiItem[];
  favoriteGifs: GifMediaItem[];
  typingUsers: string[];
  showMemberSidebar: boolean;
  sharedMiniPlayer: SharedMiniPlayerState | null;
  onUpdateSharedMiniPlayer: (player: SharedMiniPlayerState | null) => void;
  onToggleMemberSidebar: () => void;
  onSendMessage: (payload: {
    content: string;
    gifUrl?: string;
    attachmentUrl?: string;
    attachmentAnalysis?: string;
    replyTo?: MessageReplyMetadata;
  }) => void;
  onToggleReaction: (messageId: string, reactionKey: string) => void;
  onEditMessage: (messageId: string, newContent: string) => void;
  onDeleteMessage: (messageId: string) => void;
  onRealtimeMessagesSync?: (
    targetChannelId: string,
    syncedMessages: ChatMessageItem[]
  ) => void;
  onToggleFavoriteGif: (gif: GifMediaItem) => void;
  onTypingSignal: (isTyping: boolean) => void;
  onCreateCustomEmoji: (name: string, imageUrl: string) => void;
  onOpenAIStudioModal: () => void;
  onInspectAuthorProfile: (
    authorId: string,
    fallbackName: string,
    fallbackAvatar: string,
    fallbackColor?: string
  ) => void;
  onOpenMobileNav?: () => void;
}

const QUICK_HOVER_REACTIONS = ['❤️', '😂', '🔥', '👍'];
const POLL_NUMBER_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];

function parseSnapshotDocToChatMessage(
  docId: string,
  d: DocumentData,
  fallbackChannelId: string,
  fallbackServerId: string
): ChatMessageItem {
  let createdIso = new Date().toISOString();
  if (d.createdAt) {
    if (typeof d.createdAt.toDate === 'function') {
      createdIso = d.createdAt.toDate().toISOString();
    } else if (typeof d.createdAt === 'string') {
      createdIso = d.createdAt;
    } else if (typeof d.createdAt.seconds === 'number') {
      createdIso = new Date(d.createdAt.seconds * 1000).toISOString();
    }
  }

  return {
    id: String(d.id || docId),
    channelId: String(d.channelId || d.conversationId || fallbackChannelId),
    serverId: String(d.serverId || fallbackServerId),
    conversationId: d.conversationId ? String(d.conversationId) : undefined,
    senderId: d.senderId
      ? String(d.senderId)
      : d.authorId
      ? String(d.authorId)
      : undefined,
    receiverId: d.receiverId ? String(d.receiverId) : undefined,
    authorId: String(d.authorId || d.senderId || ''),
    authorName: String(d.authorName || 'WapperUser'),
    authorAvatar: String(d.authorAvatar || ''),
    authorEmail: d.authorEmail ? String(d.authorEmail) : undefined,
    authorRoleColor: String(d.authorRoleColor || '#5865F2'),
    authorIsLive: Boolean(d.authorIsLive),
    content: String(d.content || ''),
    gifUrl: d.gifUrl ? String(d.gifUrl) : undefined,
    attachmentUrl: d.attachmentUrl ? String(d.attachmentUrl) : undefined,
    attachmentAnalysis: d.attachmentAnalysis
      ? String(d.attachmentAnalysis)
      : undefined,
    replyTo: d.replyTo ? (d.replyTo as MessageReplyMetadata) : undefined,
    reactions: d.reactions
      ? (d.reactions as Record<string, string[]>)
      : undefined,
    isBot: Boolean(d.isBot),
    botName: d.botName ? String(d.botName) : undefined,
    botEmbed: d.botEmbed ? (d.botEmbed as BotEmbedPayload) : undefined,
    isEdited: Boolean(d.isEdited),
    createdAt: createdIso,
  };
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  channelId,
  channelName,
  channelTopic,
  isDMMode,
  dmPeerId = null,
  serverId,
  currentUserId,
  currentUsername,
  serverMembers = [],
  canDeleteMessages = false,
  canManageEmojis = true,
  messages,
  customEmojis,
  favoriteGifs,
  typingUsers,
  showMemberSidebar,
  sharedMiniPlayer,
  onUpdateSharedMiniPlayer,
  onToggleMemberSidebar,
  onSendMessage,
  onToggleReaction,
  onEditMessage,
  onDeleteMessage,
  onRealtimeMessagesSync,
  onToggleFavoriteGif,
  onTypingSignal,
  onCreateCustomEmoji,
  onOpenAIStudioModal,
  onInspectAuthorProfile,
  onOpenMobileNav,
}) => {
  const [inputText, setInputText] = useState('');
  const [cursorIndex, setCursorIndex] = useState<number>(0);
  const [selectedMentionIdx, setSelectedMentionIdx] = useState<number>(0);
  const [firestoreMembers, setFirestoreMembers] = useState<MentionCandidate[]>(
    () => Object.values(getLocalProfilesRegistry())
  );
  const [searchFilter, setSearchFilter] = useState('');
  const [slashErrorNotice, setSlashErrorNotice] = useState<string | null>(null);

  // Real-Time Synchronized Stream State (Firestore `onSnapshot` + Cross-Tab BroadcastChannel)
  const [realtimeMessages, setRealtimeMessages] = useState<ChatMessageItem[]>([]);
  const [deletedMessageIds, setDeletedMessageIds] = useState<Set<string>>(
    () => new Set()
  );

  // Unified Media Picker State
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState<MediaPickerTab>('trending');
  const [reactionTargetMessageId, setReactionTargetMessageId] = useState<
    string | null
  >(null);

  // Reply & Inline Edit State
  const [replyingTo, setReplyingTo] = useState<MessageReplyMetadata | null>(
    null
  );
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const composerInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const onRealtimeMessagesSyncRef = useRef(onRealtimeMessagesSync);
  const seenMessageIdsRef = useRef<Set<string>>(new Set());
  const initialChannelLoadRef = useRef<string>('');

  useEffect(() => {
    onRealtimeMessagesSyncRef.current = onRealtimeMessagesSync;
  }, [onRealtimeMessagesSync]);

  // Build lookup dictionary of `:emoji_name:` -> `imageUrl`
  const emojiLookup = useMemo(() => {
    const map: Record<string, string> = {};
    for (const item of customEmojis) {
      map[item.name] = item.imageUrl;
    }
    return map;
  }, [customEmojis]);

  // Client-side Firestore `profiles` listener so active server members are always available for `@` mentions
  useEffect(() => {
    setFirestoreMembers(Object.values(getLocalProfilesRegistry()));

    if (!auth.currentUser || !auth.currentUser.emailVerified) {
      return;
    }

    const unsubProfiles = onSnapshot(
      collection(db, 'profiles'),
      (snap) => {
        const remoteList: MentionCandidate[] = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data();
          if (d && d.username) {
            remoteList.push({
              id: String(d.id || docSnap.id),
              username: String(d.username),
              uniqueTag: d.uniqueTag ? String(d.uniqueTag) : undefined,
              avatarUrl: d.avatarUrl ? String(d.avatarUrl) : '',
              status: (d.status as MentionCandidate['status']) || 'online',
              roleColor: d.profileThemeColor
                ? String(d.profileThemeColor)
                : '#5865F2',
              customStatusEmoji: d.customStatusEmoji
                ? String(d.customStatusEmoji)
                : '',
              customStatusText: d.customStatusText
                ? String(d.customStatusText)
                : '',
            });
          }
        });
        const mergedMap = new Map<string, MentionCandidate>();
        for (const localP of Object.values(getLocalProfilesRegistry())) {
          mergedMap.set(localP.id, localP);
        }
        for (const remP of remoteList) {
          mergedMap.set(remP.id, remP);
        }
        setFirestoreMembers(Array.from(mergedMap.values()));
      },
      () => {}
    );

    return () => unsubProfiles();
  }, [currentUserId]);

  // Consolidated active server member directory for `@` mention autocomplete & markdown highlighting
  const activeMemberCandidates = useMemo(() => {
    const map = new Map<string, MentionCandidate>();

    if (currentUserId && currentUsername) {
      map.set(currentUserId, {
        id: currentUserId,
        username: currentUsername,
        status: 'online',
        roleColor: '#5865F2',
      });
    }

    for (const m of firestoreMembers) {
      if (m && m.username) {
        map.set(m.id || m.username, m);
      }
    }

    for (const m of serverMembers) {
      if (m && m.username) {
        map.set(m.id || m.username, m);
      }
    }

    for (const msg of [...messages, ...realtimeMessages]) {
      if (msg.authorId && msg.authorName && !msg.isBot) {
        if (!map.has(msg.authorId)) {
          map.set(msg.authorId, {
            id: msg.authorId,
            username: msg.authorName,
            avatarUrl: msg.authorAvatar,
            status: 'online',
            roleColor: msg.authorRoleColor || '#5865F2',
          });
        }
      }
    }

    return Array.from(map.values());
  }, [
    currentUserId,
    currentUsername,
    firestoreMembers,
    serverMembers,
    messages,
    realtimeMessages,
  ]);

  const knownMemberNames = useMemo(
    () => activeMemberCandidates.map((m) => m.username),
    [activeMemberCandidates]
  );

  // Slash command autocomplete suggestions when input starts with `/`
  const matchingSlashCommands = useMemo(() => {
    return filterSlashCommands(inputText);
  }, [inputText]);

  // `@` Mention detection & autocomplete candidates when user types `@`
  const mentionTrigger = useMemo(() => {
    return extractMentionQuery(inputText, cursorIndex);
  }, [inputText, cursorIndex]);

  const matchingMentionMembers = useMemo(() => {
    if (!mentionTrigger.active) return [];
    return filterMentionCandidates(
      activeMemberCandidates,
      mentionTrigger.query,
      8
    );
  }, [mentionTrigger, activeMemberCandidates]);

  useEffect(() => {
    setSelectedMentionIdx(0);
  }, [mentionTrigger.query, mentionTrigger.active]);

  /**
   * REAL-TIME SYNCHRONIZATION ENGINE FOR DIRECT MESSAGES (DMs) & SERVER CHANNELS:
   * - Uses Firebase Firestore's `onSnapshot` (never one-off `getDocs`) to listen in real time.
   * - In DM mode (`isDMMode && currentUserId && dmPeerId`), attaches single-field `where`
   *   listeners on `direct_messages` (`senderId == currentUserId` and `receiverId == currentUserId`)
   *   and filters in-memory where `(senderId, receiverId)` match the current conversation pair.
   * - Avoids multi-field `where` + `orderBy` composite queries so Vercel deployments NEVER
   *   require a manually configured Firestore Composite Index or throw console index errors.
   * - Orders all messages by `createdAt` ascending (`sortMessagesByCreatedAtAsc`) and updates
   *   state immediately when either participant sends, reacts to, edits, or deletes a message.
   */
  useEffect(() => {
    if (!currentUserId || !channelId) {
      setRealtimeMessages([]);
      return;
    }

    const cleanCurrentUserId = sanitizeId(currentUserId);
    const cleanPeerId = dmPeerId ? sanitizeId(dmPeerId) : '';
    const effectiveConvId =
      isDMMode && cleanPeerId
        ? buildDMConversationId(cleanCurrentUserId, cleanPeerId)
        : sanitizeId(channelId);
    const cleanServerId = sanitizeId(isDMMode ? 'srv_dm' : serverId);

    // 1. Seed initial DM state from local registry if in DM mode
    let localCacheMap = new Map<string, ChatMessageItem>();
    if (isDMMode && cleanPeerId) {
      const localDMs = readLocalDirectMessagesForPair(
        cleanCurrentUserId,
        cleanPeerId
      );
      for (const item of localDMs) {
        localCacheMap.set(item.id, {
          ...item,
          authorAvatar: item.authorAvatar || '',
        });
      }
      if (localCacheMap.size > 0) {
        const initialSorted = sortMessagesByCreatedAtAsc(
          Array.from(localCacheMap.values())
        );
        setRealtimeMessages(initialSorted);
        onRealtimeMessagesSyncRef.current?.(channelId, initialSorted);
      } else {
        setRealtimeMessages([]);
      }
    } else {
      setRealtimeMessages([]);
    }

    // Track live snapshot maps from each Firestore listener
    const outgoingDocsMap = new Map<string, ChatMessageItem>();
    const incomingDocsMap = new Map<string, ChatMessageItem>();
    const subcollectionDocsMap = new Map<string, ChatMessageItem>();

    const recomputeAndPublish = () => {
      const mergedMap = new Map<string, ChatMessageItem>();
      localCacheMap.forEach((val, key) => mergedMap.set(key, val));
      subcollectionDocsMap.forEach((val, key) => mergedMap.set(key, val));
      outgoingDocsMap.forEach((val, key) => mergedMap.set(key, val));
      incomingDocsMap.forEach((val, key) => mergedMap.set(key, val));

      const sortedAscending = sortMessagesByCreatedAtAsc(
        Array.from(mergedMap.values())
      );
      setRealtimeMessages(sortedAscending);
      onRealtimeMessagesSyncRef.current?.(channelId, sortedAscending);
    };

    // 2. Subscribe to Cross-Tab BroadcastChannel + Storage Realtime Bus
    const unsubscribeLocalBus = subscribeToLocalMessageRealtimeBus((event) => {
      if (event.type === 'UPSERT_MESSAGE') {
        const m = event.message;
        const belongsToCurrentView =
          isDMMode && cleanPeerId
            ? isMessageInDMConversation(m, cleanCurrentUserId, cleanPeerId)
            : sanitizeId(m.channelId) === effectiveConvId;

        if (!belongsToCurrentView) return;

        localCacheMap.set(m.id, {
          ...m,
          authorAvatar: m.authorAvatar || '',
        });
        recomputeAndPublish();
      } else if (event.type === 'UPDATE_REACTIONS') {
        const existing =
          localCacheMap.get(event.messageId) ||
          outgoingDocsMap.get(event.messageId) ||
          incomingDocsMap.get(event.messageId) ||
          subcollectionDocsMap.get(event.messageId);
        if (existing) {
          localCacheMap.set(event.messageId, {
            ...existing,
            reactions: event.reactions,
          });
          recomputeAndPublish();
        }
      } else if (event.type === 'EDIT_MESSAGE') {
        const existing =
          localCacheMap.get(event.messageId) ||
          outgoingDocsMap.get(event.messageId) ||
          incomingDocsMap.get(event.messageId) ||
          subcollectionDocsMap.get(event.messageId);
        if (existing) {
          localCacheMap.set(event.messageId, {
            ...existing,
            content: event.content,
            isEdited: true,
          });
          recomputeAndPublish();
        }
      } else if (event.type === 'DELETE_MESSAGE') {
        localCacheMap.delete(event.messageId);
        outgoingDocsMap.delete(event.messageId);
        incomingDocsMap.delete(event.messageId);
        subcollectionDocsMap.delete(event.messageId);
        setDeletedMessageIds((prev) => {
          const next = new Set(prev);
          next.add(event.messageId);
          return next;
        });
        recomputeAndPublish();
      }
    });

    // 3. Subscribe to Firebase Firestore `onSnapshot` Real-Time Listeners
    const unsubscribers: Array<() => void> = [];

    if (auth.currentUser && auth.currentUser.emailVerified) {
      const authUid = sanitizeId(auth.currentUser.uid);

      if (isDMMode && cleanPeerId) {
        // Single-field equality query 1: Direct messages sent by the current user
        // Uses automatic single-field index (zero composite index required on Vercel)
        const outgoingQuery = query(
          collection(db, 'direct_messages'),
          where('senderId', '==', authUid)
        );

        // Single-field equality query 2: Direct messages received by the current user
        // Uses automatic single-field index (zero composite index required on Vercel)
        const incomingQuery = query(
          collection(db, 'direct_messages'),
          where('receiverId', '==', authUid)
        );

        const handleDMSnapshot = (
          snap: QuerySnapshot<DocumentData>,
          targetBucket: Map<string, ChatMessageItem>
        ) => {
          targetBucket.clear();
          snap.forEach((docSnap) => {
            const d = docSnap.data();
            const parsed = parseSnapshotDocToChatMessage(
              docSnap.id,
              d,
              channelId,
              'srv_dm'
            );
            if (isMessageInDMConversation(parsed, authUid, cleanPeerId)) {
              targetBucket.set(parsed.id, parsed);
            }
          });
          recomputeAndPublish();
        };

        unsubscribers.push(
          onSnapshot(
            outgoingQuery,
            (snap) => handleDMSnapshot(snap, outgoingDocsMap),
            () => {}
          )
        );

        unsubscribers.push(
          onSnapshot(
            incomingQuery,
            (snap) => handleDMSnapshot(snap, incomingDocsMap),
            () => {}
          )
        );
      }

      // Also listen to the channel/DM subcollection `/servers/{serverId}/channels/{channelId}/messages`
      // without composite filters, sorting in memory by `createdAt` ascending.
      const subcollectionRef = collection(
        db,
        'servers',
        cleanServerId,
        'channels',
        effectiveConvId,
        'messages'
      );

      unsubscribers.push(
        onSnapshot(
          subcollectionRef,
          (snap) => {
            subcollectionDocsMap.clear();
            snap.forEach((docSnap) => {
              const parsed = parseSnapshotDocToChatMessage(
                docSnap.id,
                docSnap.data(),
                channelId,
                cleanServerId
              );
              subcollectionDocsMap.set(parsed.id, parsed);
            });
            recomputeAndPublish();
          },
          () => {}
        )
      );
    }

    return () => {
      unsubscribeLocalBus();
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [channelId, isDMMode, dmPeerId, serverId, currentUserId]);

  // Merge prop messages + real-time `onSnapshot` messages, ordered by `createdAt` ascending
  const orderedMessages = useMemo(() => {
    const combined = [...messages, ...realtimeMessages].filter(
      (m) => !deletedMessageIds.has(m.id)
    );
    return sortMessagesByCreatedAtAsc(combined);
  }, [messages, realtimeMessages, deletedMessageIds]);

  // Sound Ping Notification Engine:
  // Triggers a soft Web Audio chime locally whenever:
  // 1. A newly arrived message mentions `@CurrentUsername` in a text channel, or
  // 2. A new Direct Message (DM) arrives while the user is looking at a different tab (`document.hidden`).
  useEffect(() => {
    if (initialChannelLoadRef.current !== channelId) {
      initialChannelLoadRef.current = channelId;
      seenMessageIdsRef.current = new Set(orderedMessages.map((m) => m.id));
      return;
    }

    for (const msg of orderedMessages) {
      if (seenMessageIdsRef.current.has(msg.id)) continue;
      seenMessageIdsRef.current.add(msg.id);

      const isMentioned =
        !msg.isBot && doesMessageMentionUser(msg.content, currentUsername);
      const isIncomingDMOnHiddenTab =
        isDMMode &&
        msg.authorId !== currentUserId &&
        typeof document !== 'undefined' &&
        document.hidden;

      if (isMentioned) {
        playNotificationPing('mention');
      } else if (isIncomingDMOnHiddenTab) {
        playNotificationPing('dm');
      }
    }
  }, [orderedMessages, channelId, currentUsername, currentUserId, isDMMode]);

  // Scroll-lock to bottom when messages arrive in active channel or DM
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [orderedMessages.length, channelId]);

  // Clear reply/edit state on channel switch
  useEffect(() => {
    setReplyingTo(null);
    setEditingMessageId(null);
    setSlashErrorNotice(null);
  }, [channelId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.slice(0, BLUEPRINT_LIMITS.MESSAGE_CONTENT_MAX_LEN);
    const nextCursor =
      typeof e.target.selectionStart === 'number'
        ? e.target.selectionStart
        : val.length;
    setInputText(val);
    setCursorIndex(nextCursor);
    if (slashErrorNotice) setSlashErrorNotice(null);

    onTypingSignal(val.trim().length > 0);
    if (typingTimeoutRef.current !== null) {
      window.clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = window.setTimeout(() => {
      onTypingSignal(false);
    }, 2000);
  };

  const handleSelectMentionCandidate = (candidate: MentionCandidate) => {
    if (!mentionTrigger.active) return;
    const { text, nextCursorIndex } = injectMentionIntoInput(
      inputText,
      candidate.username,
      mentionTrigger.startIndex,
      mentionTrigger.endIndex
    );
    setInputText(text);
    setCursorIndex(nextCursorIndex);

    window.requestAnimationFrame(() => {
      if (composerInputRef.current) {
        composerInputRef.current.focus();
        try {
          composerInputRef.current.setSelectionRange(
            nextCursorIndex,
            nextCursorIndex
          );
        } catch {
          // Ignore selection range errors on unsupported inputs
        }
      }
    });
  };

  const handleComposerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (mentionTrigger.active && matchingMentionMembers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMentionIdx(
          (prev) => (prev + 1) % matchingMentionMembers.length
        );
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMentionIdx(
          (prev) =>
            (prev - 1 + matchingMentionMembers.length) %
            matchingMentionMembers.length
        );
        return;
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        const chosen =
          matchingMentionMembers[selectedMentionIdx] ||
          matchingMentionMembers[0];
        if (chosen) {
          e.preventDefault();
          handleSelectMentionCandidate(chosen);
          return;
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setCursorIndex(-1);
        return;
      }
    }
  };

  const handleSelectSlashCommandSuggestion = (cmd: SlashCommandDefinition) => {
    setInputText(cmd.sample);
    setCursorIndex(cmd.sample.length);
    composerInputRef.current?.focus();
  };

  const handleSendSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed) return;

    onSendMessage({
      content: trimmed,
      replyTo: replyingTo || undefined,
    });
    setInputText('');
    setCursorIndex(0);
    setReplyingTo(null);
    onTypingSignal(false);
  };

  const handleStartReply = (msg: ChatMessageItem) => {
    const preview =
      msg.content.trim().slice(0, 100) ||
      (msg.gifUrl ? '[GIF]' : msg.attachmentUrl ? '[Attachment]' : 'Message');
    setReplyingTo({
      messageId: msg.id,
      authorId: msg.authorId,
      authorName: msg.isBot && msg.botName ? msg.botName : msg.authorName,
      authorAvatar: msg.authorAvatar,
      contentPreview: preview,
    });
    composerInputRef.current?.focus();
  };

  const handleStartEdit = (msg: ChatMessageItem) => {
    setEditingMessageId(msg.id);
    setEditingContent(msg.content);
  };

  const handleSaveEdit = (messageId: string) => {
    const trimmed = editingContent.trim();
    if (!trimmed) return;
    onEditMessage(messageId, trimmed);
    setEditingMessageId(null);
    setEditingContent('');
  };

  const handleLocalDeleteMessage = (messageId: string) => {
    setDeletedMessageIds((prev) => {
      const next = new Set(prev);
      next.add(messageId);
      return next;
    });
    setRealtimeMessages((prev) => prev.filter((m) => m.id !== messageId));
    onDeleteMessage(messageId);
  };

  const handleScrollToMessage = (messageId: string) => {
    const el = document.getElementById(`chat-msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-indigo-500/70');
      window.setTimeout(() => {
        el.classList.remove('ring-2', 'ring-indigo-500/70');
      }, 1600);
    }
  };

  const isGifStarred = (url: string) =>
    favoriteGifs.some((fav) => fav.url === url);

  const filteredMessages = useMemo(() => {
    const q = searchFilter.trim().toLowerCase();
    if (!q) return orderedMessages;
    return orderedMessages.filter(
      (m) =>
        m.content.toLowerCase().includes(q) ||
        m.authorName.toLowerCase().includes(q) ||
        (m.botName && m.botName.toLowerCase().includes(q))
    );
  }, [orderedMessages, searchFilter]);

  const renderReactionToken = (reactionKey: string) => {
    if (reactionKey.startsWith(':') && reactionKey.endsWith(':')) {
      const cleanName = reactionKey.slice(1, -1);
      const customUrl = emojiLookup[cleanName];
      if (customUrl) {
        return (
          <img
            src={customUrl}
            alt={reactionKey}
            title={reactionKey}
            referrerPolicy="no-referrer"
            className="w-4 h-4 object-contain inline-block"
          />
        );
      }
    }
    return <span>{reactionKey}</span>;
  };

  const renderFormattedMarkdown = (content: string) => {
    if (!content) return null;
    const lines = content.split('\n');
    return (
      <div className="space-y-1 text-sm text-slate-200 leading-relaxed break-words">
        {lines.map((line, lineIdx) => {
          if (line.startsWith('### ')) {
            return (
              <h4 key={lineIdx} className="text-sm font-bold text-white pt-1">
                {line.slice(4)}
              </h4>
            );
          }
          const tokens = parseInlineMarkdown(
            line,
            emojiLookup,
            knownMemberNames
          );
          return (
            <p key={lineIdx} className="min-h-[1.25rem]">
              {tokens.map((seg, idx) => {
                if (seg.type === 'bold') {
                  return (
                    <strong key={idx} className="font-semibold text-white">
                      {seg.value}
                    </strong>
                  );
                }
                if (seg.type === 'italic') {
                  return (
                    <em key={idx} className="italic text-slate-300">
                      {seg.value}
                    </em>
                  );
                }
                if (seg.type === 'code') {
                  return (
                    <code
                      key={idx}
                      className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 font-mono text-xs text-indigo-300"
                    >
                      {seg.value}
                    </code>
                  );
                }
                if (seg.type === 'emoji' && seg.emojiUrl) {
                  return (
                    <img
                      key={idx}
                      src={seg.emojiUrl}
                      alt={`:${seg.value}:`}
                      title={`:${seg.value}:`}
                      referrerPolicy="no-referrer"
                      className="inline-block w-6 h-6 align-middle mx-0.5 object-contain rounded"
                    />
                  );
                }
                if (seg.type === 'link') {
                  return (
                    <a
                      key={idx}
                      href={seg.value}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-400 hover:underline"
                    >
                      {seg.value}
                    </a>
                  );
                }
                if (seg.type === 'mention') {
                  const isSelfMention = doesMessageMentionUser(
                    seg.value,
                    currentUsername
                  );
                  return (
                    <span
                      key={idx}
                      className={`inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded font-semibold text-xs transition-colors ${
                        isSelfMention
                          ? 'bg-[#5865F2] text-white shadow-xs'
                          : 'bg-[#5865F2]/25 text-indigo-200 hover:bg-[#5865F2] hover:text-white'
                      }`}
                    >
                      {seg.value}
                    </span>
                  );
                }
                return <React.Fragment key={idx}>{seg.value}</React.Fragment>;
              })}
            </p>
          );
        })}
      </div>
    );
  };

  const renderBotEmbedCard = (msg: ChatMessageItem, embed: BotEmbedPayload) => {
    const borderColor = embed.accentColor || '#5865F2';

    return (
      <div
        className="mt-2 max-w-xl rounded-xl bg-[#090D16] border border-slate-800/90 overflow-hidden shadow-lg"
        style={{ borderLeftWidth: '4px', borderLeftColor: borderColor }}
      >
        <div className="p-3.5 space-y-2.5">
          {/* Header Row */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              {embed.embedType === 'live' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/20 border border-rose-500/50 text-rose-300 text-[10px] font-bold animate-pulse">
                  <Radio className="w-3 h-3 text-rose-400" />
                  <span>🔴 LIVE NOW</span>
                </span>
              ) : embed.embedType === 'youtube' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/20 border border-red-500/40 text-red-300 text-[10px] font-bold">
                  <Music className="w-3 h-3 text-red-400" />
                  <span>YOUTUBE WATCH TOGETHER</span>
                </span>
              ) : null}
              <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                {embed.title}
              </h4>
            </div>

            {embed.streamUrl && (
              <a
                href={embed.streamUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:underline shrink-0"
              >
                <span>Open Source</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          {embed.description && (
            <p className="text-xs text-slate-300 leading-relaxed">
              {embed.description}
            </p>
          )}

          {/* Responsive YouTube Embed Player for /youtube and /live */}
          {embed.youtubeVideoId && (
            <div className="space-y-2">
              <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black border border-slate-800">
                <iframe
                  src={`https://www.youtube.com/embed/${embed.youtubeVideoId}?rel=0`}
                  title={embed.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="w-full h-full border-0"
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSharedMiniPlayer({
                      videoId: embed.youtubeVideoId!,
                      title: embed.title,
                      streamUrl:
                        embed.streamUrl ||
                        `https://www.youtube.com/watch?v=${embed.youtubeVideoId}`,
                      startedBy: embed.streamerName || msg.authorName,
                      isLive: embed.embedType === 'live',
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors cursor-pointer shadow-sm"
                >
                  <Music className="w-3.5 h-3.5" />
                  <span>🎵 Open in Shared Mini-Player</span>
                </button>

                {embed.streamerName && (
                  <span className="text-[11px] text-slate-400">
                    Queued by{' '}
                    <strong className="text-slate-200">
                      {embed.streamerName}
                    </strong>
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Interactive Poll Options Card for /poll */}
          {embed.embedType === 'poll' && Array.isArray(embed.pollOptions) && (
            <div className="space-y-2 pt-1">
              {embed.pollOptions.map((opt, idx) => {
                const emojiKey = POLL_NUMBER_EMOJIS[idx] || '👍';
                const voters = msg.reactions?.[emojiKey] || [];
                const totalVotes = POLL_NUMBER_EMOJIS.reduce(
                  (acc, k) => acc + (msg.reactions?.[k]?.length || 0),
                  0
                );
                const pct =
                  totalVotes > 0
                    ? Math.round((voters.length / totalVotes) * 100)
                    : 0;
                const hasVoted = voters.includes(currentUserId);

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onToggleReaction(msg.id, emojiKey)}
                    className={`w-full relative overflow-hidden rounded-xl border p-2.5 text-left transition-colors cursor-pointer ${
                      hasVoted
                        ? 'bg-[#5865F2]/20 border-[#5865F2] text-white'
                        : 'bg-slate-950/90 border-slate-800 hover:border-slate-700 text-slate-200'
                    }`}
                  >
                    <div
                      className="absolute inset-y-0 left-0 bg-[#5865F2]/20 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                    <div className="relative flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold flex items-center gap-2">
                        <span>{emojiKey}</span>
                        <span>{opt}</span>
                      </span>
                      <span className="font-mono text-[11px] text-indigo-300">
                        {voters.length} {voters.length === 1 ? 'vote' : 'votes'}{' '}
                        ({pct}%)
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <main
      aria-label={`Chat Channel ${channelName}`}
      className="flex-1 bg-[#0E131F] flex flex-col min-w-0 overflow-hidden relative"
    >
      {/* Top Channel Header Bar */}
      <header className="h-14 px-4 sm:px-5 border-b border-slate-800/80 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          {onOpenMobileNav && (
            <button
              type="button"
              onClick={onOpenMobileNav}
              aria-label="Open Server and Channel Menu"
              className="md:hidden p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          {isDMMode ? (
            <AtSign className="w-5 h-5 text-indigo-400 shrink-0" />
          ) : (
            <Hash className="w-5 h-5 text-slate-400 shrink-0" />
          )}
          <h2 className="text-sm font-semibold text-white whitespace-nowrap shrink-0">
            {channelName}
          </h2>
          {channelTopic && (
            <>
              <span className="text-slate-600 hidden sm:inline">·</span>
              <p className="text-xs text-slate-400 truncate hidden sm:block">
                {channelTopic}
              </p>
            </>
          )}
        </div>

        {/* Right Header Controls: Message Search & Member List Toggle */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="relative hidden md:block">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              aria-label="Filter channel messages"
              placeholder="Filter messages..."
              className="w-44 focus:w-56 transition-all rounded-lg bg-slate-950/90 border border-slate-800 pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <button
            type="button"
            onClick={onToggleMemberSidebar}
            aria-label={
              showMemberSidebar ? 'Hide Member List' : 'Show Member List'
            }
            title="Toggle Member List"
            className={`p-2 rounded-lg transition-colors cursor-pointer ${
              showMemberSidebar
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Pinned Synchronized Watch Together Shared Mini-Player Bar */}
      {sharedMiniPlayer && (
        <div
          role="region"
          aria-label="Shared Watch Together Mini-Player"
          className="bg-[#090D16] border-b border-indigo-500/30 px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 shadow-md"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-36 h-20 rounded-lg overflow-hidden bg-black border border-slate-800 shrink-0">
              <iframe
                src={`https://www.youtube.com/embed/${sharedMiniPlayer.videoId}?autoplay=1&rel=0`}
                title={sharedMiniPlayer.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full border-0"
              />
            </div>
            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                {sharedMiniPlayer.isLive ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/50 text-rose-300 text-[10px] font-bold animate-pulse">
                    🔴 LIVE STREAM
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-[10px] font-bold">
                    🎵 WATCH TOGETHER MINI-PLAYER
                  </span>
                )}
                <span className="text-[11px] text-slate-400">
                  Pinned by{' '}
                  <strong className="text-slate-200">
                    {sharedMiniPlayer.startedBy}
                  </strong>
                </span>
              </div>
              <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                {sharedMiniPlayer.title}
              </h4>
              <a
                href={sharedMiniPlayer.streamUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:underline"
              >
                <span>Open on YouTube</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onUpdateSharedMiniPlayer(null)}
            aria-label="Close Shared Mini-Player"
            className="self-end sm:self-center flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 text-xs font-semibold transition-colors cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
            <span>Close Player</span>
          </button>
        </div>
      )}

      {/* Scroll-Locked Real-Time Message Feed */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {/* Channel Welcome Banner */}
        <div className="pb-4 border-b border-slate-800/70">
          <div className="w-11 h-11 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-3">
            {isDMMode ? (
              <AtSign className="w-6 h-6" />
            ) : (
              <Hash className="w-6 h-6" />
            )}
          </div>
          <h3 className="text-lg font-bold text-white">
            {isDMMode
              ? `Direct Message with ${channelName}`
              : `Welcome to #${channelName}`}
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            {channelTopic ||
              'Type `/` for built-in YouTube Music & Streamer Bots (`/youtube`, `/live`, `/poll`, `/8ball`, `/roll`). Hover any message to Reply or React!'}
          </p>
        </div>

        {filteredMessages.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-slate-400">
              {searchFilter
                ? `No messages matching "${searchFilter}".`
                : 'No messages in this channel yet. Send a message or try `/youtube lofi` below!'}
            </p>
          </div>
        ) : (
          filteredMessages.map((msg) => {
            const displayAuthorName =
              msg.isBot && msg.botName ? msg.botName : msg.authorName;
            const initials = displayAuthorName
              .split(/\s+/)
              .map((w) => w[0])
              .join('')
              .slice(0, 2)
              .toUpperCase();
            const formattedTime = new Date(msg.createdAt).toLocaleTimeString(
              [],
              {
                hour: '2-digit',
                minute: '2-digit',
              }
            );
            const isAuthorSelf = msg.authorId === currentUserId;
            const canEditThisMessage = isAuthorSelf && !msg.isBot;
            const canDeleteThisMessage = isAuthorSelf || canDeleteMessages;
            const authorIsFounder =
              !msg.isBot &&
              isFounderUser({
                username: msg.authorName,
                email: msg.authorEmail,
                id: msg.authorId,
              });
            const reactionEntries = Object.entries(msg.reactions || {}).filter(
              ([_k, uids]) => Array.isArray(uids) && uids.length > 0
            );
            const isMentioningCurrentUser = doesMessageMentionUser(
              msg.content,
              currentUsername
            );

            return (
              <article
                id={`chat-msg-${msg.id}`}
                key={msg.id}
                data-mentioned={isMentioningCurrentUser ? 'true' : 'false'}
                className={`group relative flex flex-col py-1.5 px-2.5 -mx-2.5 rounded-xl transition-all ${
                  isMentioningCurrentUser
                    ? 'bg-amber-500/10 hover:bg-amber-500/15 border-l-4 border-[#5865F2] pl-3 shadow-[inset_0_0_24px_rgba(245,158,11,0.08)]'
                    : 'hover:bg-slate-900/50'
                }`}
              >
                {/* Floating Message Hover Quick-Action Bar (Top-Right) */}
                <div
                  role="toolbar"
                  aria-label="Message Actions"
                  className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity absolute -top-3 right-3 z-20 flex items-center gap-0.5 rounded-xl bg-[#0B0F19] border border-slate-700/90 px-1.5 py-1 shadow-xl"
                >
                  {QUICK_HOVER_REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => onToggleReaction(msg.id, emoji)}
                      title={`React with ${emoji}`}
                      aria-label={`React with ${emoji}`}
                      className="w-7 h-7 rounded-lg hover:bg-slate-800 flex items-center justify-center text-sm transition-colors cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}

                  {/* Add Custom / Standard Reaction Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setReactionTargetMessageId(msg.id);
                      setPickerTab('emojis');
                      setPickerOpen(true);
                    }}
                    title="Add Reaction"
                    aria-label="Add Reaction"
                    className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <SmilePlus className="w-4 h-4" />
                  </button>

                  {/* Reply Button */}
                  <button
                    type="button"
                    onClick={() => handleStartReply(msg)}
                    title="Reply to Message"
                    aria-label="Reply to Message"
                    className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <CornerUpLeft className="w-4 h-4" />
                  </button>

                  {/* Edit Button (if author) */}
                  {canEditThisMessage && (
                    <button
                      type="button"
                      onClick={() => handleStartEdit(msg)}
                      title="Edit Message"
                      aria-label="Edit Message"
                      className="p-1.5 rounded-lg text-slate-300 hover:text-indigo-300 hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Delete Button (if author or has DELETE_MESSAGES) */}
                  {canDeleteThisMessage && (
                    <button
                      type="button"
                      onClick={() => handleLocalDeleteMessage(msg.id)}
                      title="Delete Message"
                      aria-label="Delete Message"
                      className="p-1.5 rounded-lg text-slate-300 hover:text-rose-400 hover:bg-rose-500/15 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Discord Curved Reply Connector Line (`╭──`) if this message is a Reply */}
                {msg.replyTo && (
                  <button
                    type="button"
                    onClick={() =>
                      handleScrollToMessage(msg.replyTo!.messageId)
                    }
                    className="flex items-center gap-1.5 pl-4 pb-1 text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer text-left truncate"
                  >
                    <span className="font-mono text-slate-500 select-none">
                      ╭──
                    </span>
                    <span className="w-4 h-4 rounded-full bg-indigo-600/40 flex items-center justify-center text-[9px] font-bold text-white shrink-0 overflow-hidden">
                      {msg.replyTo.authorAvatar ? (
                        <img
                          src={msg.replyTo.authorAvatar}
                          alt={msg.replyTo.authorName}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        msg.replyTo.authorName.slice(0, 1).toUpperCase()
                      )}
                    </span>
                    <span className="font-semibold text-indigo-300 shrink-0">
                      @{msg.replyTo.authorName}
                    </span>
                    <span className="truncate text-slate-400">
                      {msg.replyTo.contentPreview}
                    </span>
                  </button>
                )}

                <div className="flex items-start gap-3.5">
                  {/* Clickable Author Avatar */}
                  <button
                    type="button"
                    onClick={() =>
                      onInspectAuthorProfile(
                        msg.authorId,
                        displayAuthorName,
                        msg.authorAvatar,
                        msg.authorRoleColor
                      )
                    }
                    aria-label={`View profile of ${displayAuthorName}`}
                    className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5 shadow-sm cursor-pointer ring-offset-2 ring-offset-[#0E131F] hover:ring-2 hover:ring-indigo-400 transition-all"
                    style={{
                      backgroundColor: msg.isBot
                        ? msg.botEmbed?.accentColor || '#5865F2'
                        : msg.authorRoleColor || '#5865F2',
                    }}
                  >
                    {msg.isBot ? (
                      <Bot className="w-5 h-5 text-white" />
                    ) : msg.authorAvatar ? (
                      <img
                        src={msg.authorAvatar}
                        alt={displayAuthorName}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>{initials}</span>
                    )}
                  </button>

                  <div className="min-w-0 flex-1 space-y-1">
                    {/* Author Name + Verified ✓ BOT Badge / 👑 Founder Badge / 🔴 LIVE Badge + Timestamp */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() =>
                          onInspectAuthorProfile(
                            msg.authorId,
                            displayAuthorName,
                            msg.authorAvatar,
                            msg.authorRoleColor
                          )
                        }
                        className="text-xs font-bold hover:underline cursor-pointer"
                        style={{
                          color: msg.isBot
                            ? '#FFFFFF'
                            : msg.authorRoleColor || '#F8FAFC',
                        }}
                      >
                        {displayAuthorName}
                      </button>

                      {/* Official Verified ✓ BOT Badge */}
                      {msg.isBot && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#5865F2] text-white text-[10px] font-bold tracking-wide">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                          <span>BOT</span>
                        </span>
                      )}

                      {/* Glowing Golden Crown Founder Badge for Mayank Raj */}
                      {authorIsFounder && (
                        <span
                          title="Wapper Creator & Principal Architect"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gradient-to-r from-amber-500/25 to-yellow-500/20 border border-amber-400/60 text-amber-300 text-[10px] font-bold shadow-xs"
                        >
                          <Crown className="w-3 h-3 text-amber-400" />
                          <span>👑 Founder &amp; Dev</span>
                        </span>
                      )}

                      {/* Live Streamer Badge */}
                      {msg.authorIsLive && !msg.isBot && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-500/20 border border-rose-500/50 text-rose-300 text-[10px] font-bold animate-pulse">
                          <span>🔴 LIVE</span>
                        </span>
                      )}

                      <time className="text-[11px] font-mono tabular-nums text-slate-400">
                        {formattedTime}
                      </time>

                      {msg.isEdited && (
                        <span className="text-[10px] text-slate-500 italic">
                          (edited)
                        </span>
                      )}
                    </div>

                    {/* Inline Message Editor or Formatted Markdown Content */}
                    {editingMessageId === msg.id ? (
                      <div className="space-y-2 pt-1 max-w-xl">
                        <input
                          type="text"
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveEdit(msg.id);
                            } else if (e.key === 'Escape') {
                              setEditingMessageId(null);
                            }
                          }}
                          aria-label="Edit message content"
                          className="w-full rounded-lg bg-slate-950 border border-indigo-500 px-3 py-1.5 text-sm text-white focus:outline-none"
                        />
                        <div className="flex items-center gap-2 text-[11px]">
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(msg.id)}
                            className="px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-semibold cursor-pointer"
                          >
                            Save Changes
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingMessageId(null)}
                            className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      renderFormattedMarkdown(msg.content)
                    )}

                    {/* Rich Interactive Bot Embed Card (/youtube, /live, /poll, /8ball, /roll) */}
                    {msg.botEmbed && renderBotEmbedCard(msg, msg.botEmbed)}

                    {/* Embedded Live GIF with 1-Click "⭐ Star" to Favorites Button */}
                    {msg.gifUrl && (
                      <div className="pt-1.5 relative inline-block group/gif">
                        <img
                          src={msg.gifUrl}
                          alt="Chat GIF attachment"
                          referrerPolicy="no-referrer"
                          className="max-w-xs max-h-60 rounded-xl border border-slate-800 object-cover bg-slate-900"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            onToggleFavoriteGif({
                              id: `fav_${msg.id}`,
                              title: msg.content || 'Starred Chat GIF',
                              url: msg.gifUrl!,
                              previewUrl: msg.gifUrl!,
                            })
                          }
                          aria-label={
                            isGifStarred(msg.gifUrl)
                              ? 'Remove GIF from Favorites'
                              : 'Star GIF to Favorites'
                          }
                          title={
                            isGifStarred(msg.gifUrl)
                              ? 'Saved in My Custom GIFs ⭐'
                              : 'Star GIF to My Custom GIFs ⭐'
                          }
                          className={`absolute top-3 right-2 flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer shadow-md ${
                            isGifStarred(msg.gifUrl)
                              ? 'bg-amber-500 text-slate-950 opacity-100'
                              : 'bg-black/75 text-amber-300 hover:bg-amber-500 hover:text-slate-950 opacity-0 group-hover/gif:opacity-100'
                          }`}
                        >
                          <Star className="w-3.5 h-3.5 fill-current" />
                          <span>
                            {isGifStarred(msg.gifUrl)
                              ? 'Starred ⭐'
                              : '⭐ Star'}
                          </span>
                        </button>
                      </div>
                    )}

                    {/* Embedded AI Image / Uploaded Photo */}
                    {msg.attachmentUrl && (
                      <div className="pt-1.5 space-y-2 max-w-md">
                        <img
                          src={msg.attachmentUrl}
                          alt="Uploaded or generated media"
                          referrerPolicy="no-referrer"
                          className="max-h-72 rounded-xl border border-slate-800 object-contain bg-slate-950"
                        />
                        {msg.attachmentAnalysis && (
                          <div className="rounded-lg bg-slate-900/90 border border-slate-800 p-3 text-xs text-slate-300 leading-relaxed">
                            <div className="font-semibold text-indigo-300 mb-1">
                              Gemini Image Analysis
                            </div>
                            <p className="whitespace-pre-line">
                              {msg.attachmentAnalysis}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Real-Time Interactive Reaction Pills Below Message */}
                    {reactionEntries.length > 0 && (
                      <div className="pt-1.5 flex items-center gap-1.5 flex-wrap">
                        {reactionEntries.map(([reactionKey, userIds]) => {
                          const hasReacted = userIds.includes(currentUserId);
                          return (
                            <button
                              key={reactionKey}
                              type="button"
                              onClick={() =>
                                onToggleReaction(msg.id, reactionKey)
                              }
                              aria-label={`Reaction ${reactionKey}, count ${userIds.length}`}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                                hasReacted
                                  ? 'bg-[#5865F2]/25 border-[#5865F2] text-white shadow-xs'
                                  : 'bg-slate-900/90 border-slate-800 hover:border-slate-700 text-slate-300'
                              }`}
                            >
                              {renderReactionToken(reactionKey)}
                              <span className="font-mono text-[11px] tabular-nums">
                                {userIds.length}
                              </span>
                            </button>
                          );
                        })}

                        <button
                          type="button"
                          onClick={() => {
                            setReactionTargetMessageId(msg.id);
                            setPickerTab('emojis');
                            setPickerOpen(true);
                          }}
                          aria-label="Add another reaction"
                          title="Add Reaction"
                          className="p-1 rounded-lg bg-slate-900/70 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                        >
                          <SmilePlus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Unified Tabbed GIF & Custom Emoji Picker */}
      <GifEmojiPicker
        isOpen={pickerOpen}
        initialTab={pickerTab}
        mode={reactionTargetMessageId ? 'reaction' : 'composer'}
        serverId={serverId}
        customEmojis={customEmojis}
        favoriteGifs={favoriteGifs}
        canManageEmojis={canManageEmojis}
        onClose={() => {
          setPickerOpen(false);
          setReactionTargetMessageId(null);
        }}
        onSelectGif={(gif) => {
          onSendMessage({
            content: inputText.trim(),
            gifUrl: gif.url,
            replyTo: replyingTo || undefined,
          });
          setInputText('');
          setReplyingTo(null);
          setPickerOpen(false);
        }}
        onToggleFavoriteGif={onToggleFavoriteGif}
        onSelectStandardEmoji={(emojiChar) => {
          if (reactionTargetMessageId) {
            onToggleReaction(reactionTargetMessageId, emojiChar);
            setReactionTargetMessageId(null);
            setPickerOpen(false);
          } else {
            setInputText((prev) => `${prev}${emojiChar}`);
            setPickerOpen(false);
            composerInputRef.current?.focus();
          }
        }}
        onSelectCustomEmoji={(shortcode) => {
          if (reactionTargetMessageId) {
            onToggleReaction(reactionTargetMessageId, shortcode);
            setReactionTargetMessageId(null);
            setPickerOpen(false);
          } else {
            setInputText(
              (prev) =>
                `${prev}${prev.endsWith(' ') || !prev ? '' : ' '}${shortcode} `
            );
            setPickerOpen(false);
            composerInputRef.current?.focus();
          }
        }}
        onCreateCustomEmoji={onCreateCustomEmoji}
      />

      {/* User Mention Autocomplete Popup (when typing `@` in composer) */}
      {mentionTrigger.active && matchingMentionMembers.length > 0 && (
        <div
          role="listbox"
          aria-label="User Mention Autocomplete"
          className="mx-5 mb-2 rounded-2xl bg-[#0B0F19] border border-[#5865F2]/50 shadow-2xl overflow-hidden z-30"
        >
          <div className="px-3.5 py-2 bg-[#5865F2]/15 border-b border-slate-800 flex items-center justify-between text-[11px] font-semibold text-indigo-200">
            <span className="flex items-center gap-1.5">
              <AtSign className="w-3.5 h-3.5 text-[#5865F2]" />
              <span>
                Members matching{' '}
                <code className="font-mono text-white">
                  @{mentionTrigger.query || '...'}
                </code>
              </span>
            </span>
            <span className="font-mono text-[10px] text-slate-400">
              Click or press Enter to mention
            </span>
          </div>
          <div className="divide-y divide-slate-800/60 max-h-56 overflow-y-auto">
            {matchingMentionMembers.map((member, idx) => {
              const memberInitials = member.username
                .split(/\s+/)
                .map((w) => w[0])
                .join('')
                .slice(0, 2)
                .toUpperCase();
              const isSelected = idx === selectedMentionIdx;
              const statusDotClass =
                member.status === 'online'
                  ? 'bg-emerald-500'
                  : member.status === 'idle'
                  ? 'bg-amber-400'
                  : member.status === 'dnd'
                  ? 'bg-rose-500'
                  : 'bg-slate-500';

              return (
                <button
                  key={member.id || member.username}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelectMentionCandidate(member)}
                  className={`w-full px-3.5 py-2 flex items-center justify-between gap-3 transition-colors text-left cursor-pointer ${
                    isSelected
                      ? 'bg-[#5865F2]/25 text-white'
                      : 'hover:bg-slate-800/70 text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative shrink-0">
                      <div
                        className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center text-[10px] font-bold text-white"
                        style={{
                          backgroundColor: member.roleColor || '#5865F2',
                        }}
                      >
                        {member.avatarUrl ? (
                          <img
                            src={member.avatarUrl}
                            alt={member.username}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span>{memberInitials}</span>
                        )}
                      </div>
                      <span
                        className={`w-2.5 h-2.5 rounded-full border-2 border-[#0B0F19] absolute -bottom-0.5 -right-0.5 ${statusDotClass}`}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-white truncate">
                          {member.username}
                        </span>
                        {member.id === currentUserId && (
                          <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 border border-indigo-500/40 text-[9px] font-semibold text-indigo-300">
                            YOU
                          </span>
                        )}
                      </div>
                      {(member.customStatusText || member.customStatusEmoji) && (
                        <p className="text-[10px] text-slate-400 truncate">
                          {member.customStatusEmoji} {member.customStatusText}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="font-mono text-[11px] text-slate-400 shrink-0">
                    {member.uniqueTag || `@${member.username}`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Slash Command Autocomplete Popup (when typing `/` in composer) */}
      {matchingSlashCommands.length > 0 && (
        <div
          role="listbox"
          aria-label="Slash Command Autocomplete"
          className="mx-5 mb-2 rounded-2xl bg-[#0B0F19] border border-indigo-500/40 shadow-2xl overflow-hidden z-30"
        >
          <div className="px-3.5 py-2 bg-indigo-950/50 border-b border-slate-800 flex items-center justify-between text-[11px] font-semibold text-indigo-300">
            <span className="flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5" />
              <span>Wapper Built-in Bot Slash Commands</span>
            </span>
            <span className="font-mono text-[10px] text-slate-400">
              Click a command to autofill
            </span>
          </div>
          <div className="divide-y divide-slate-800/70 max-h-56 overflow-y-auto">
            {matchingSlashCommands.map((cmd) => (
              <button
                key={cmd.command}
                type="button"
                role="option"
                onClick={() => handleSelectSlashCommandSuggestion(cmd)}
                className="w-full px-3.5 py-2.5 flex items-center justify-between gap-3 hover:bg-indigo-600/15 transition-colors text-left cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-indigo-300">
                      {cmd.usage}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-[#5865F2] text-white text-[9px] font-bold">
                      ✓ {cmd.botName}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">
                    {cmd.description}
                  </p>
                </div>
                <span className="text-[10px] font-mono text-slate-500 shrink-0 hidden sm:inline">
                  {cmd.command}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Real-Time Typing Indicator */}
      {typingUsers.length > 0 && (
        <div className="px-6 py-1 text-[11px] text-indigo-300 font-medium">
          {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'}{' '}
          typing...
        </div>
      )}

      {/* Replying to @Username Banner above Chat Composer */}
      {replyingTo && (
        <div className="mx-5 mb-1.5 px-3.5 py-2 rounded-xl bg-slate-900/95 border border-indigo-500/40 flex items-center justify-between gap-2 text-xs text-slate-300">
          <div className="flex items-center gap-2 min-w-0">
            <CornerUpLeft className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span className="truncate">
              Replying to{' '}
              <strong className="text-indigo-300">
                @{replyingTo.authorName}
              </strong>
              : <span className="text-slate-400">{replyingTo.contentPreview}</span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => setReplyingTo(null)}
            aria-label="Cancel Reply"
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Bottom Message Composer Bar */}
      <form onSubmit={handleSendSubmit} className="px-5 pb-4 pt-1 shrink-0">
        <div className="flex items-center gap-2 rounded-xl bg-[#151C2C] border border-slate-800 focus-within:border-indigo-500/70 px-3 py-2 shadow-inner">
          {/* AI Image Studio & Photo Analyzer Button */}
          <button
            type="button"
            onClick={onOpenAIStudioModal}
            aria-label="Open Gemini Image Studio and Photo Analyzer"
            title="Create/Edit Images or Analyze Photos"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">AI Media</span>
          </button>

          <input
            ref={composerInputRef}
            type="text"
            value={inputText}
            onChange={handleInputChange}
            onKeyDown={handleComposerKeyDown}
            onClick={(e) => {
              const target = e.currentTarget;
              if (typeof target.selectionStart === 'number') {
                setCursorIndex(target.selectionStart);
              }
            }}
            aria-label={`Message ${
              isDMMode ? `@${channelName}` : `#${channelName}`
            }`}
            placeholder={`Message ${
              isDMMode ? `@${channelName}` : `#${channelName}`
            } (Type @ to mention, / for Bots, **bold**, :emoji:)`}
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-400 focus:outline-none min-w-0"
          />

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => {
                setReactionTargetMessageId(null);
                if (pickerOpen && pickerTab === 'trending') {
                  setPickerOpen(false);
                } else {
                  setPickerTab('trending');
                  setPickerOpen(true);
                }
              }}
              aria-label="Open GIF Picker"
              title="Trending & Custom GIFs"
              className={`px-2 py-1 rounded-lg text-xs font-mono font-semibold transition-colors cursor-pointer ${
                pickerOpen &&
                (pickerTab === 'trending' || pickerTab === 'favorites')
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <span className="flex items-center gap-1">
                <Film className="w-3.5 h-3.5" />
                <span>GIF</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setReactionTargetMessageId(null);
                if (pickerOpen && pickerTab === 'emojis') {
                  setPickerOpen(false);
                } else {
                  setPickerTab('emojis');
                  setPickerOpen(true);
                }
              }}
              aria-label="Open Custom Emoji Picker"
              title="Server Emojis & Reactions"
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                pickerOpen && pickerTab === 'emojis'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Smile className="w-4 h-4" />
            </button>

            <button
              type="submit"
              disabled={!inputText.trim()}
              aria-label="Send Message"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Send</span>
            </button>
          </div>
        </div>
      </form>
    </main>
  );
};

export default ChatArea;
