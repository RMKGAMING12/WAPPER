import React, { useEffect, useRef, useState } from 'react';
import {
  Film,
  Star,
  Smile,
  Search,
  Upload,
  Link2,
  X,
  Check,
  Trash2,
  Sparkles,
} from 'lucide-react';
import { validateEmojiName } from '../utils/chatLogic';
import { uploadCustomEmojiAsset } from '../supabaseClient';
import type { CustomEmojiItem } from './ChatArea';

export interface GifMediaItem {
  id: string;
  title: string;
  url: string;
  previewUrl: string;
}

export type MediaPickerTab = 'trending' | 'favorites' | 'emojis';

interface GifEmojiPickerProps {
  isOpen: boolean;
  initialTab?: MediaPickerTab;
  mode?: 'composer' | 'reaction';
  serverId: string;
  customEmojis: CustomEmojiItem[];
  favoriteGifs: GifMediaItem[];
  canManageEmojis?: boolean;
  onClose: () => void;
  onSelectGif: (gif: GifMediaItem) => void;
  onToggleFavoriteGif: (gif: GifMediaItem) => void;
  onSelectStandardEmoji: (emojiChar: string) => void;
  onSelectCustomEmoji: (shortcode: string, emoji: CustomEmojiItem) => void;
  onCreateCustomEmoji: (name: string, imageUrl: string) => void;
}

const GIF_CATEGORIES = [
  { id: '', label: 'Trending 🔥' },
  { id: 'Funny', label: 'Funny' },
  { id: 'Gaming', label: 'Gaming' },
  { id: 'Reactions', label: 'Reactions' },
  { id: 'Memes', label: 'Memes' },
  { id: 'Anime', label: 'Anime' },
];

const STANDARD_QUICK_EMOJIS = [
  '❤️',
  '😂',
  '🔥',
  '👍',
  '🎉',
  '🚀',
  '👑',
  '💯',
  '🎵',
  '🔴',
  '⚡',
  '✨',
  '🙌',
  '😎',
  '🥳',
  '🤝',
];

export const CURATED_SERVERLESS_GIFS: GifMediaItem[] = [
  {
    id: 'gif_rocket_launch',
    title: 'Rocket Launch Ship It Funny',
    url: 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif',
  },
  {
    id: 'gif_coding_fast',
    title: 'Coding Fast Hacker Gaming Memes',
    url: 'https://media.giphy.com/media/LmNwrBhejkK9EFP504/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/LmNwrBhejkK9EFP504/giphy.gif',
  },
  {
    id: 'gif_high_five',
    title: 'Team High Five Celebrate Reactions',
    url: 'https://media.giphy.com/media/3oEjHV0z8S7WM4MwnK/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/3oEjHV0z8S7WM4MwnK/giphy.gif',
  },
  {
    id: 'gif_mind_blown',
    title: 'Mind Blown Galaxy Reactions Memes',
    url: 'https://media.giphy.com/media/xT0xeJpnrWC4XWblEk/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/xT0xeJpnrWC4XWblEk/giphy.gif',
  },
  {
    id: 'gif_thumbs_up',
    title: 'Approved Thumbs Up Reactions Funny',
    url: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif',
  },
  {
    id: 'gif_party_vibe',
    title: 'Party Vibe Celebration Anime Gaming',
    url: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
  },
];

export const GifEmojiPicker: React.FC<GifEmojiPickerProps> = ({
  isOpen,
  initialTab = 'trending',
  mode = 'composer',
  serverId,
  customEmojis,
  favoriteGifs,
  canManageEmojis = true,
  onClose,
  onSelectGif,
  onToggleFavoriteGif,
  onSelectStandardEmoji,
  onSelectCustomEmoji,
  onCreateCustomEmoji,
}) => {
  const [activeTab, setActiveTab] = useState<MediaPickerTab>(initialTab);
  const [gifQuery, setGifQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [gifResults, setGifResults] = useState<GifMediaItem[]>(CURATED_SERVERLESS_GIFS);
  const [loadingGifs, setLoadingGifs] = useState(false);

  // Custom GIF Upload / Direct URL state
  const [customGifUrlInput, setCustomGifUrlInput] = useState('');
  const [customGifTitleInput, setCustomGifTitleInput] = useState('');
  const [customGifError, setCustomGifError] = useState('');
  const gifFileInputRef = useRef<HTMLInputElement | null>(null);

  // Custom Server Emoji Upload state
  const [newEmojiName, setNewEmojiName] = useState('');
  const [emojiUploadError, setEmojiUploadError] = useState('');
  const [uploadingEmoji, setUploadingEmoji] = useState(false);
  const emojiFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Fetch live GIFs from Tenor's free public API (`https://g.tenor.com/v1/search?key=LIVDSRZULELA`)
  useEffect(() => {
    if (!isOpen || activeTab !== 'trending') return;
    let cancelled = false;
    setLoadingGifs(true);

    const effectiveQuery = (gifQuery.trim() || selectedCategory).trim();
    const tenorEndpoint = effectiveQuery
      ? `https://g.tenor.com/v1/search?q=${encodeURIComponent(effectiveQuery)}&key=LIVDSRZULELA&limit=16`
      : `https://g.tenor.com/v1/trending?key=LIVDSRZULELA&limit=16`;

    fetch(tenorEndpoint)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Tenor fallback'))))
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data?.results) && data.results.length > 0) {
          const mapped: GifMediaItem[] = data.results
            .map((item: Record<string, unknown>, idx: number) => {
              const mediaArr = item.media as Array<Record<string, { url?: string }>> | undefined;
              const mediaObj = mediaArr && mediaArr[0];
              const fullUrl = mediaObj?.gif?.url || mediaObj?.tinygif?.url || '';
              const previewUrl = mediaObj?.tinygif?.url || fullUrl;
              if (!fullUrl) return null;
              return {
                id: String(item.id || `tenor_${idx}`),
                title: String(item.content_description || item.title || effectiveQuery || 'GIF'),
                url: fullUrl,
                previewUrl,
              };
            })
            .filter((x: GifMediaItem | null): x is GifMediaItem => Boolean(x));
          if (mapped.length > 0) {
            setGifResults(mapped);
            return;
          }
        }
        const filteredFallback = effectiveQuery
          ? CURATED_SERVERLESS_GIFS.filter((g) =>
              g.title.toLowerCase().includes(effectiveQuery.toLowerCase())
            )
          : CURATED_SERVERLESS_GIFS;
        setGifResults(
          filteredFallback.length > 0 ? filteredFallback : CURATED_SERVERLESS_GIFS
        );
      })
      .catch(() => {
        if (cancelled) return;
        const filteredFallback = effectiveQuery
          ? CURATED_SERVERLESS_GIFS.filter((g) =>
              g.title.toLowerCase().includes(effectiveQuery.toLowerCase())
            )
          : CURATED_SERVERLESS_GIFS;
        setGifResults(
          filteredFallback.length > 0 ? filteredFallback : CURATED_SERVERLESS_GIFS
        );
      })
      .finally(() => {
        if (!cancelled) setLoadingGifs(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, activeTab, gifQuery, selectedCategory]);

  if (!isOpen) return null;

  const isGifStarred = (url: string) =>
    favoriteGifs.some((fav) => fav.url === url);

  const handleAddCustomGifByUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUrl = customGifUrlInput.trim();
    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://') && !trimmedUrl.startsWith('data:image/')) {
      setCustomGifError('Please enter a valid https:// GIF URL.');
      return;
    }
    const newFav: GifMediaItem = {
      id: `custom_gif_${Date.now()}`,
      title: customGifTitleInput.trim() || 'Custom Saved GIF',
      url: trimmedUrl,
      previewUrl: trimmedUrl,
    };
    onToggleFavoriteGif(newFav);
    setCustomGifUrlInput('');
    setCustomGifTitleInput('');
    setCustomGifError('');
  };

  const handleCustomGifFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      if (dataUrl) {
        const newFav: GifMediaItem = {
          id: `upload_gif_${Date.now()}`,
          title: customGifTitleInput.trim() || file.name.replace(/\.[^.]+$/, '') || 'Uploaded GIF',
          url: dataUrl.slice(0, 490000),
          previewUrl: dataUrl.slice(0, 490000),
        };
        onToggleFavoriteGif(newFav);
        setCustomGifTitleInput('');
        setCustomGifError('');
      }
    };
    reader.readAsDataURL(file);
    if (gifFileInputRef.current) {
      gifFileInputRef.current.value = '';
    }
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
      setEmojiUploadError(
        err instanceof Error ? err.message : 'Failed to upload custom emoji.'
      );
    } finally {
      setUploadingEmoji(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-label="Unified GIF and Custom Emoji Picker"
      className="absolute bottom-20 right-4 sm:right-5 w-[340px] sm:w-[420px] rounded-2xl bg-[#0B0F19] border border-slate-800 shadow-2xl p-3.5 z-40 space-y-3"
    >
      {/* Top Tab Bar: Trending GIFs | My Custom GIFs ⭐ | Server Emojis */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800">
        <div className="flex items-center gap-1 flex-wrap">
          {mode !== 'reaction' && (
            <>
              <button
                type="button"
                onClick={() => setActiveTab('trending')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  activeTab === 'trending'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
                }`}
              >
                <Film className="w-3.5 h-3.5" />
                <span>Trending GIFs</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('favorites')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  activeTab === 'favorites'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
                }`}
              >
                <Star className="w-3.5 h-3.5 text-amber-400" />
                <span>My Custom GIFs ⭐ ({favoriteGifs.length})</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('emojis')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'emojis'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
            }`}
          >
            <Smile className="w-3.5 h-3.5" />
            <span>Server Emojis</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close Media Picker"
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* TAB 1: TRENDING GIFS */}
      {activeTab === 'trending' && (
        <div className="space-y-2.5">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={gifQuery}
              onChange={(e) => setGifQuery(e.target.value)}
              placeholder="Search Tenor GIFs (e.g. hype, gaming, anime)..."
              aria-label="Search GIFs"
              className="w-full rounded-lg bg-slate-950 border border-slate-800 pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Quick Category Filter Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {GIF_CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id && !gifQuery.trim();
              return (
                <button
                  key={cat.label}
                  type="button"
                  onClick={() => {
                    setGifQuery('');
                    setSelectedCategory(cat.id);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                    isSelected
                      ? 'bg-indigo-600/25 text-indigo-300 border border-indigo-500/40'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* GIF Grid */}
          {loadingGifs ? (
            <div className="grid grid-cols-2 gap-2 h-56 overflow-y-auto">
              {[0, 1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="h-24 rounded-lg bg-slate-900 animate-pulse border border-slate-800"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
              {gifResults.map((gif) => {
                const starred = isGifStarred(gif.url);
                return (
                  <div
                    key={gif.id}
                    className="group relative h-24 rounded-lg overflow-hidden bg-slate-900 border border-slate-800 hover:border-indigo-500 transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => onSelectGif(gif)}
                      className="w-full h-full block cursor-pointer"
                    >
                      <img
                        src={gif.previewUrl}
                        alt={gif.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-1.5 text-[10px] text-white truncate text-left">
                        {gif.title}
                      </div>
                    </button>

                    {/* Star / Favorite Toggle Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavoriteGif(gif);
                      }}
                      aria-label={starred ? 'Remove GIF from Favorites' : 'Star GIF to Favorites'}
                      title={starred ? 'Saved in My Custom GIFs ⭐' : 'Star to My Custom GIFs ⭐'}
                      className={`absolute top-1.5 right-1.5 p-1 rounded-md transition-colors cursor-pointer ${
                        starred
                          ? 'bg-amber-500 text-slate-950 shadow'
                          : 'bg-black/65 text-slate-200 hover:bg-amber-500 hover:text-slate-950'
                      }`}
                    >
                      <Star className="w-3.5 h-3.5 fill-current" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MY CUSTOM GIFS ⭐ */}
      {activeTab === 'favorites' && (
        <div className="space-y-3">
          {/* Upload .gif file or Paste Direct .gif URL */}
          <form
            onSubmit={handleAddCustomGifByUrl}
            className="rounded-xl bg-slate-950/90 border border-slate-800 p-2.5 space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-amber-300 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Add Custom GIF (URL or Upload .GIF)</span>
              </span>
              <input
                ref={gifFileInputRef}
                type="file"
                accept="image/gif,image/webp,image/*"
                onChange={handleCustomGifFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => gifFileInputRef.current?.click()}
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-indigo-600/20 hover:bg-indigo-600/35 border border-indigo-500/30 text-indigo-300 text-[10px] font-semibold transition-colors cursor-pointer"
              >
                <Upload className="w-3 h-3" />
                <span>Upload .GIF</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <Link2 className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="url"
                  value={customGifUrlInput}
                  onChange={(e) => {
                    setCustomGifUrlInput(e.target.value);
                    if (customGifError) setCustomGifError('');
                  }}
                  placeholder="Paste direct https://.../.gif URL"
                  aria-label="Paste custom GIF URL"
                  className="w-full rounded-lg bg-slate-900 border border-slate-800 pl-8 pr-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>
              <button
                type="submit"
                className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors cursor-pointer shrink-0"
              >
                Save ⭐
              </button>
            </div>

            {customGifError && (
              <p role="alert" className="text-[11px] text-rose-400">
                {customGifError}
              </p>
            )}
          </form>

          {/* Starred / Custom GIFs Collection */}
          {favoriteGifs.length === 0 ? (
            <div className="py-8 text-center space-y-1.5">
              <Star className="w-6 h-6 text-amber-400/60 mx-auto" />
              <p className="text-xs font-medium text-slate-300">
                No custom or starred GIFs yet
              </p>
              <p className="text-[11px] text-slate-400">
                Click the ⭐ Star button on any GIF in chat or Trending GIFs, or upload your own above!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
              {favoriteGifs.map((gif) => (
                <div
                  key={gif.id}
                  className="group relative h-24 rounded-lg overflow-hidden bg-slate-900 border border-amber-500/30 hover:border-amber-400 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => onSelectGif(gif)}
                    className="w-full h-full block cursor-pointer"
                  >
                    <img
                      src={gif.previewUrl || gif.url}
                      alt={gif.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-1.5 text-[10px] text-white truncate text-left">
                      {gif.title}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavoriteGif(gif);
                    }}
                    aria-label="Remove from Custom GIFs"
                    title="Remove from Favorites"
                    className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/70 hover:bg-rose-600 text-slate-200 hover:text-white transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SERVER EMOJIS (STANDARD + CUSTOM STATIC/ANIMATED GIF EMOJIS) */}
      {activeTab === 'emojis' && (
        <div className="space-y-3">
          {/* Quick Standard Emojis */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Quick Reactions &amp; Standard Emojis
            </div>
            <div className="grid grid-cols-8 gap-1">
              {STANDARD_QUICK_EMOJIS.map((emj) => (
                <button
                  key={emj}
                  type="button"
                  onClick={() => onSelectStandardEmoji(emj)}
                  className="h-8 rounded-lg bg-slate-900/90 hover:bg-indigo-600/25 border border-slate-800 hover:border-indigo-500/40 flex items-center justify-center text-base transition-colors cursor-pointer"
                >
                  {emj}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Server Emojis (:shortcode:) */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Custom Server Emojis ({customEmojis.length})
            </div>
            {customEmojis.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">
                No custom server emojis uploaded yet. Upload a static PNG or animated GIF emoji below!
              </p>
            ) : (
              <div className="grid grid-cols-4 gap-2 max-h-36 overflow-y-auto pr-1">
                {customEmojis.map((emj) => (
                  <button
                    key={emj.id}
                    type="button"
                    onClick={() => onSelectCustomEmoji(`:${emj.name}:`, emj)}
                    title={`:${emj.name}:`}
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
          </div>

          {/* Upload New Custom Server Emoji */}
          {canManageEmojis && (
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <div className="text-[11px] font-medium text-slate-300">
                Upload Custom Server Emoji (PNG, JPG, Animated GIF)
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newEmojiName}
                  onChange={(e) => {
                    setNewEmojiName(e.target.value);
                    if (emojiUploadError) setEmojiUploadError('');
                  }}
                  placeholder="shortcode_name"
                  aria-label="Custom emoji shortcode"
                  maxLength={32}
                  className="flex-1 rounded-lg bg-slate-950 border border-slate-800 px-2.5 py-1.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <input
                  ref={emojiFileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                  onChange={handleCustomEmojiFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={uploadingEmoji}
                  onClick={() => emojiFileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
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
          )}
        </div>
      )}
    </div>
  );
};

export default GifEmojiPicker;
