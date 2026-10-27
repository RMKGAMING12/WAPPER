import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Hash,
  Send,
  Smile,
  Film,
  Upload,
  Search,
  Users,
  Wand2,
  X,
  AtSign,
  Check,
  Menu,
} from 'lucide-react';
import {
  parseInlineMarkdown,
  validateEmojiName,
  BLUEPRINT_LIMITS,
} from '../utils/chatLogic';
import { uploadCustomEmojiAsset } from '../supabaseClient';

export interface ChatMessageItem {
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

export interface CustomEmojiItem {
  id: string;
  serverId: string;
  name: string;
  imageUrl: string;
  creatorId: string;
  createdAt: string;
}

interface GifSearchResult {
  id: string;
  title: string;
  url: string;
  previewUrl: string;
}

interface ChatAreaProps {
  channelId: string;
  channelName: string;
  channelTopic: string;
  isDMMode: boolean;
  serverId: string;
  messages: ChatMessageItem[];
  customEmojis: CustomEmojiItem[];
  typingUsers: string[];
  showMemberSidebar: boolean;
  onToggleMemberSidebar: () => void;
  onSendMessage: (payload: {
    content: string;
    gifUrl?: string;
    attachmentUrl?: string;
    attachmentAnalysis?: string;
  }) => void;
  onTypingSignal: (isTyping: boolean) => void;
  onCreateCustomEmoji: (name: string, imageUrl: string) => void;
  onOpenAIStudioModal: () => void;
  onInspectAuthorProfile: (authorId: string, fallbackName: string, fallbackAvatar: string, fallbackColor?: string) => void;
  onOpenMobileNav?: () => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  channelId,
  channelName,
  channelTopic,
  isDMMode,
  serverId,
  messages,
  customEmojis,
  typingUsers,
  showMemberSidebar,
  onToggleMemberSidebar,
  onSendMessage,
  onTypingSignal,
  onCreateCustomEmoji,
  onOpenAIStudioModal,
  onInspectAuthorProfile,
  onOpenMobileNav,
}) => {
  const [inputText, setInputText] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifQuery, setGifQuery] = useState('');
  const [gifResults, setGifResults] = useState<GifSearchResult[]>([]);
  const [loadingGifs, setLoadingGifs] = useState(false);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [newEmojiName, setNewEmojiName] = useState('');
  const [emojiUploadError, setEmojiUploadError] = useState('');
  const [uploadingEmoji, setUploadingEmoji] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const emojiFileInputRef = useRef<HTMLInputElement | null>(null);

  // Build lookup dictionary of `:emoji_name:` -> `imageUrl`
  const emojiLookup = useMemo(() => {
    const map: Record<string, string> = {};
    for (const item of customEmojis) {
      map[item.name] = item.imageUrl;
    }
    return map;
  }, [customEmojis]);

  // Scroll-lock to bottom when messages arrive in active channel
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, channelId]);

  // Fetch live GIFs when GIF Picker opens or query updates
  useEffect(() => {
    if (!showGifPicker) return;
    let cancelled = false;
    setLoadingGifs(true);

    fetch(`/api/gifs?q=${encodeURIComponent(gifQuery)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data.gifs)) {
          setGifResults(data.gifs);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingGifs(false);
      });

    return () => {
      cancelled = true;
    };
  }, [showGifPicker, gifQuery]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.slice(0, BLUEPRINT_LIMITS.MESSAGE_CONTENT_MAX_LEN);
    setInputText(val);

    onTypingSignal(val.trim().length > 0);
    if (typingTimeoutRef.current !== null) {
      window.clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = window.setTimeout(() => {
      onTypingSignal(false);
    }, 2000);
  };

  const handleSendSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed) return;
    onSendMessage({ content: trimmed });
    setInputText('');
    onTypingSignal(false);
  };

  const handleSelectGif = (gif: GifSearchResult) => {
    onSendMessage({
      content: inputText.trim(),
      gifUrl: gif.url,
    });
    setInputText('');
    setShowGifPicker(false);
  };

  const handleInsertEmojiToken = (emojiName: string) => {
    setInputText((prev) => `${prev}${prev.endsWith(' ') || !prev ? '' : ' '}:${emojiName}: `);
    setShowEmojiPicker(false);
  };

  const handleCustomEmojiFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const candidateName =
      newEmojiName.trim() ||
      file.name
        .replace(/\.[^.]+$/, '')
        .replace(/[^a-zA-Z0-9_]/g, '_')
        .slice(0, 24);

    const validation = validateEmojiName(candidateName);
    if (!validation.valid) {
      setEmojiUploadError(validation.error || 'Invalid emoji name.');
      return;
    }

    setUploadingEmoji(true);
    setEmojiUploadError('');
    try {
      const uploaded = await uploadCustomEmojiAsset(serverId, validation.normalized, file);
      onCreateCustomEmoji(uploaded.name, uploaded.imageUrl);
      setNewEmojiName('');
      if (emojiFileInputRef.current) {
        emojiFileInputRef.current.value = '';
      }
    } catch (err: unknown) {
      setEmojiUploadError(err instanceof Error ? err.message : 'Failed to upload custom emoji.');
    } finally {
      setUploadingEmoji(false);
    }
  };

  const filteredMessages = useMemo(() => {
    const q = searchFilter.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter(
      (m) =>
        m.content.toLowerCase().includes(q) || m.authorName.toLowerCase().includes(q)
    );
  }, [messages, searchFilter]);

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
          const tokens = parseInlineMarkdown(line, emojiLookup);
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
                return <React.Fragment key={idx}>{seg.value}</React.Fragment>;
              })}
            </p>
          );
        })}
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
              <p className="text-xs text-slate-400 truncate hidden sm:block">{channelTopic}</p>
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
            aria-label={showMemberSidebar ? 'Hide Member List' : 'Show Member List'}
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

      {/* Scroll-Locked Real-Time Message Feed */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* Channel Welcome Banner */}
        <div className="pb-4 border-b border-slate-800/70">
          <div className="w-11 h-11 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-3">
            {isDMMode ? <AtSign className="w-6 h-6" /> : <Hash className="w-6 h-6" />}
          </div>
          <h3 className="text-lg font-bold text-white">
            {isDMMode ? `Direct Message with ${channelName}` : `Welcome to #${channelName}`}
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            {channelTopic ||
              'Real-time Socket.io message history. Click any user avatar or name to inspect their customized profile card.'}
          </p>
        </div>

        {filteredMessages.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-slate-400">
              {searchFilter
                ? `No messages matching "${searchFilter}".`
                : 'No messages in this channel yet. Send the first message below!'}
            </p>
          </div>
        ) : (
          filteredMessages.map((msg) => {
            const initials = msg.authorName
              .split(/\s+/)
              .map((w) => w[0])
              .join('')
              .slice(0, 2)
              .toUpperCase();
            const formattedTime = new Date(msg.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <article
                key={msg.id}
                className="group flex items-start gap-3.5 py-1 px-2 -mx-2 rounded-xl hover:bg-slate-900/40 transition-colors"
              >
                {/* Clickable Author Avatar -> Opens Customized Profile Card Overlay */}
                <button
                  type="button"
                  onClick={() =>
                    onInspectAuthorProfile(
                      msg.authorId,
                      msg.authorName,
                      msg.authorAvatar,
                      msg.authorRoleColor
                    )
                  }
                  aria-label={`View profile of ${msg.authorName}`}
                  title={`Click to view ${msg.authorName}'s profile card`}
                  className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5 shadow-sm cursor-pointer ring-offset-2 ring-offset-[#0E131F] hover:ring-2 hover:ring-indigo-400 transition-all"
                  style={{ backgroundColor: msg.authorRoleColor || '#5865F2' }}
                >
                  {msg.authorAvatar ? (
                    <img
                      src={msg.authorAvatar}
                      alt={msg.authorName}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{initials}</span>
                  )}
                </button>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-baseline gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onInspectAuthorProfile(
                          msg.authorId,
                          msg.authorName,
                          msg.authorAvatar,
                          msg.authorRoleColor
                        )
                      }
                      className="text-xs font-semibold hover:underline cursor-pointer"
                      style={{ color: msg.authorRoleColor || '#F8FAFC' }}
                    >
                      {msg.authorName}
                    </button>
                    <time className="text-[11px] font-mono tabular-nums text-slate-400">
                      {formattedTime}
                    </time>
                  </div>

                  {renderFormattedMarkdown(msg.content)}

                  {/* Embedded Live GIF */}
                  {msg.gifUrl && (
                    <div className="pt-1.5">
                      <img
                        src={msg.gifUrl}
                        alt="Chat GIF attachment"
                        referrerPolicy="no-referrer"
                        className="max-w-xs max-h-60 rounded-xl border border-slate-800 object-cover bg-slate-900"
                      />
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
                            Gemini Image Analysis (gemini-4-argon)
                          </div>
                          <p className="whitespace-pre-line">{msg.attachmentAnalysis}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Popover: Live GIF Picker */}
      {showGifPicker && (
        <div
          role="dialog"
          aria-label="GIF Picker"
          className="absolute bottom-20 right-5 w-80 sm:w-96 rounded-2xl bg-[#0B0F19] border border-slate-800 shadow-2xl p-3.5 z-30"
        >
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-semibold text-white">
              Tenor / Giphy Free GIF Picker
            </span>
            <button
              type="button"
              onClick={() => setShowGifPicker(false)}
              aria-label="Close GIF Picker"
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="relative mb-3">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={gifQuery}
              onChange={(e) => setGifQuery(e.target.value)}
              placeholder="Search GIFs (e.g. code, rocket, party)..."
              aria-label="Search GIFs"
              className="w-full rounded-lg bg-slate-950 border border-slate-800 pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {loadingGifs ? (
            <div className="grid grid-cols-2 gap-2 h-52 overflow-y-auto">
              {[0, 1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="h-24 rounded-lg bg-slate-900 animate-pulse border border-slate-800"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
              {gifResults.map((gif) => (
                <button
                  key={gif.id}
                  type="button"
                  onClick={() => handleSelectGif(gif)}
                  className="group relative h-24 rounded-lg overflow-hidden bg-slate-900 border border-slate-800 hover:border-indigo-500 transition-colors cursor-pointer"
                >
                  <img
                    src={gif.previewUrl}
                    alt={gif.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 text-[10px] text-white truncate">
                    {gif.title}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Popover: Custom Emoji Picker & Uploader */}
      {showEmojiPicker && (
        <div
          role="dialog"
          aria-label="Custom Emoji Picker"
          className="absolute bottom-20 right-5 w-80 sm:w-96 rounded-2xl bg-[#0B0F19] border border-slate-800 shadow-2xl p-4 z-30 space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white">
              Server Custom Emojis ({customEmojis.length})
            </span>
            <button
              type="button"
              onClick={() => setShowEmojiPicker(false)}
              aria-label="Close Custom Emoji Picker"
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {customEmojis.length === 0 ? (
            <p className="text-xs text-slate-400 py-2">
              No custom emojis uploaded yet. Upload one below!
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto">
              {customEmojis.map((emj) => (
                <button
                  key={emj.id}
                  type="button"
                  onClick={() => handleInsertEmojiToken(emj.name)}
                  title={`Insert :${emj.name}:`}
                  className="flex flex-col items-center gap-1 p-2 rounded-lg bg-slate-900/90 hover:bg-indigo-600/20 border border-slate-800 hover:border-indigo-500/40 transition-colors cursor-pointer"
                >
                  <img
                    src={emj.imageUrl}
                    alt={emj.name}
                    referrerPolicy="no-referrer"
                    className="w-7 h-7 object-contain"
                  />
                  <span className="text-[10px] font-mono text-slate-300 truncate w-full text-center">
                    :{emj.name}:
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Upload New Custom Emoji (Base64 / Supabase Storage) */}
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <div className="text-[11px] font-medium text-slate-300">
              Upload Custom Emoji (PNG, GIF, SVG)
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newEmojiName}
                onChange={(e) => {
                  setNewEmojiName(e.target.value);
                  if (emojiUploadError) setEmojiUploadError('');
                }}
                placeholder="emote_name"
                aria-label="Custom emoji name"
                maxLength={32}
                className="flex-1 rounded-lg bg-slate-950 border border-slate-800 px-2.5 py-1.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <input
                ref={emojiFileInputRef}
                type="file"
                accept="image/*"
                onChange={handleCustomEmojiFileChange}
                className="hidden"
              />
              <button
                type="button"
                disabled={uploadingEmoji}
                onClick={() => emojiFileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {uploadingEmoji ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                <span>{uploadingEmoji ? 'Saving...' : 'Upload'}</span>
              </button>
            </div>
            {emojiUploadError && (
              <p role="alert" className="text-[11px] text-rose-400">
                {emojiUploadError}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Real-Time Typing Indicator */}
      {typingUsers.length > 0 && (
        <div className="px-6 py-1 text-[11px] text-indigo-300 font-medium">
          {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
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
            title="Create/Edit Images (gemini-nano-banana-2.1) or Analyze Photos (gemini-4-argon)"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">AI Media</span>
          </button>

          <input
            type="text"
            value={inputText}
            onChange={handleInputChange}
            aria-label={`Message ${isDMMode ? `@${channelName}` : `#${channelName}`}`}
            placeholder={`Message ${
              isDMMode ? `@${channelName}` : `#${channelName}`
            } (Markdown **bold**, *italic*, ` + '`code`' + `)`}
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-400 focus:outline-none min-w-0"
          />

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => {
                setShowEmojiPicker(false);
                setShowGifPicker((prev) => !prev);
              }}
              aria-label="Open GIF Picker"
              title="Pick a GIF"
              className={`px-2 py-1 rounded-lg text-xs font-mono font-semibold transition-colors cursor-pointer ${
                showGifPicker
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
                setShowGifPicker(false);
                setShowEmojiPicker((prev) => !prev);
              }}
              aria-label="Open Custom Emoji Picker"
              title="Custom Emojis"
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                showEmojiPicker
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
