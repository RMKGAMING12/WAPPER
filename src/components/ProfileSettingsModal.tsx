import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Upload,
  Palette,
  User,
  Sparkles,
  Check,
  Trash2,
  Image as ImageIcon,
} from 'lucide-react';
import {
  WapperProfile,
  BLUEPRINT_LIMITS,
  normalizeHexColor,
  formatUniqueTag,
} from '../utils/chatLogic';
import { uploadProfileMediaAsset } from '../authService';

interface ProfileSettingsModalProps {
  isOpen: boolean;
  profile: WapperProfile;
  onClose: () => void;
  onSaveProfile: (updates: {
    username: string;
    avatarUrl: string;
    bannerUrl: string;
    bannerColor: string;
    bio: string;
    customStatusText: string;
    customStatusEmoji: string;
    profileThemeColor: string;
  }) => Promise<void>;
}

const BANNER_COLOR_PRESETS = [
  '#5865F2',
  '#10B981',
  '#0EA5E9',
  '#F43F5E',
  '#F59E0B',
  '#8B5CF6',
  '#EC4899',
  '#14B8A6',
];

const THEME_ACCENT_PRESETS = [
  '#5865F2',
  '#38BDF8',
  '#34D399',
  '#F472B6',
  '#FBBF24',
  '#A78BFA',
  '#FB7185',
  '#2DD4BF',
];

const QUICK_STATUS_EMOJIS = ['🚀', '💻', '🎧', '🎮', '⚡', '🔥', '☕', '🌙'];

const STATUS_DOT: Record<WapperProfile['status'], string> = {
  online: 'bg-emerald-500',
  idle: 'bg-amber-400',
  dnd: 'bg-rose-500',
  offline: 'bg-slate-500',
};

export const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({
  isOpen,
  profile,
  onClose,
  onSaveProfile,
}) => {
  const [username, setUsername] = useState(profile.username);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl);
  const [bannerUrl, setBannerUrl] = useState(profile.bannerUrl);
  const [bannerColor, setBannerColor] = useState(profile.bannerColor || '#5865F2');
  const [bio, setBio] = useState(profile.bio || '');
  const [customStatusText, setCustomStatusText] = useState(profile.customStatusText || '');
  const [customStatusEmoji, setCustomStatusEmoji] = useState(profile.customStatusEmoji || '');
  const [profileThemeColor, setProfileThemeColor] = useState(
    profile.profileThemeColor || '#5865F2'
  );

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [savedNotice, setSavedNotice] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setUsername(profile.username);
      setAvatarUrl(profile.avatarUrl || '');
      setBannerUrl(profile.bannerUrl || '');
      setBannerColor(profile.bannerColor || '#5865F2');
      setBio(profile.bio || '');
      setCustomStatusText(profile.customStatusText || '');
      setCustomStatusEmoji(profile.customStatusEmoji || '');
      setProfileThemeColor(profile.profileThemeColor || '#5865F2');
      setErrorMsg('');
      setSavedNotice(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    setErrorMsg('');
    try {
      const uploadedUrl = await uploadProfileMediaAsset(profile.id, 'avatar', file);
      setAvatarUrl(uploadedUrl);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to upload avatar.');
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBanner(true);
    setErrorMsg('');
    try {
      const uploadedUrl = await uploadProfileMediaAsset(profile.id, 'banner', file);
      setBannerUrl(uploadedUrl);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to upload banner.');
    } finally {
      setUploadingBanner(false);
      if (bannerInputRef.current) bannerInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = username.trim();
    if (cleanName.length < BLUEPRINT_LIMITS.USERNAME_MIN_LEN) {
      setErrorMsg('Username must be at least 2 characters.');
      return;
    }

    setSaving(true);
    setErrorMsg('');
    try {
      await onSaveProfile({
        username: cleanName,
        avatarUrl,
        bannerUrl,
        bannerColor: normalizeHexColor(bannerColor, '#5865F2'),
        bio,
        customStatusText,
        customStatusEmoji,
        profileThemeColor: normalizeHexColor(profileThemeColor, '#5865F2'),
      });
      setSavedNotice(true);
      window.setTimeout(() => {
        onClose();
      }, 450);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save profile settings.');
    } finally {
      setSaving(false);
    }
  };

  const previewInitials = (username || 'WU')
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const resolvedThemeHex = normalizeHexColor(profileThemeColor, '#5865F2');
  const resolvedBannerHex = normalizeHexColor(bannerColor, '#5865F2');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-settings-modal-title"
    >
      <div className="w-full max-w-4xl rounded-2xl bg-[#0B0F19] border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800/90 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 id="profile-settings-modal-title" className="text-base font-bold text-white">
                User Profile &amp; Theme Customization
              </h2>
              <p className="text-xs text-slate-400">
                100% Free Custom Avatar, Banner, Bio, Status Ticker &amp; Accent Theme
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Profile Settings Modal"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body: Side-by-Side Controls + Live Preview Card */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8"
        >
          {/* Left Column: Customization Controls (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* 1. Display Name */}
            <div>
              <label
                htmlFor="profile-username-input"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2"
              >
                Display Username
              </label>
              <div className="flex items-center rounded-xl bg-slate-950 border border-slate-800 focus-within:border-indigo-500 overflow-hidden">
                <input
                  id="profile-username-input"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  maxLength={32}
                  className="flex-1 bg-transparent px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none"
                  placeholder="Your username"
                />
                <span className="px-3.5 py-2.5 text-xs font-mono text-slate-400 bg-slate-900 border-l border-slate-800">
                  #{profile.discriminator}
                </span>
              </div>
            </div>

            {/* 2. Custom Avatar Upload & URL */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Custom Avatar</span>
                </span>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => setAvatarUrl('')}
                    className="inline-flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Remove Avatar</span>
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={uploadingAvatar}
                  onClick={() => avatarInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploadingAvatar ? 'Uploading...' : 'Upload Avatar Image'}</span>
                </button>

                <input
                  type="url"
                  value={avatarUrl.startsWith('data:') ? '' : avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="Or paste image URL (https://...)"
                  aria-label="Avatar Image URL"
                  className="flex-1 min-w-[180px] rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* 3. Custom Profile Banner (Image Upload OR Hex Color Picker) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Profile Banner (Image or Hex Color)</span>
                </span>
                {bannerUrl && (
                  <button
                    type="button"
                    onClick={() => setBannerUrl('')}
                    className="inline-flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear Banner Image</span>
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <input
                  ref={bannerInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleBannerUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={uploadingBanner}
                  onClick={() => bannerInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-white transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploadingBanner ? 'Processing...' : 'Upload Banner Image'}</span>
                </button>

                {/* Hex Color Picker + Swatches */}
                <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5">
                  <input
                    type="color"
                    value={resolvedBannerHex.slice(0, 7)}
                    onChange={(e) => setBannerColor(e.target.value.toUpperCase())}
                    aria-label="Pick Banner Hex Color"
                    className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                  />
                  <input
                    type="text"
                    value={bannerColor}
                    onChange={(e) => setBannerColor(e.target.value)}
                    aria-label="Banner Hex Code"
                    maxLength={7}
                    className="w-20 bg-transparent text-xs font-mono text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {BANNER_COLOR_PRESETS.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => setBannerColor(hex)}
                    aria-label={`Set banner color ${hex}`}
                    className={`w-6 h-6 rounded-full border transition-transform cursor-pointer ${
                      resolvedBannerHex === hex
                        ? 'scale-110 border-white ring-2 ring-white/30'
                        : 'border-white/20 hover:scale-105'
                    }`}
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>
            </div>

            {/* 4. Custom Status Emoji + Status Text */}
            <div className="space-y-2">
              <label
                htmlFor="custom-status-text-input"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-300"
              >
                Custom Status (Emoji + Text)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={customStatusEmoji}
                  onChange={(e) => setCustomStatusEmoji(e.target.value)}
                  aria-label="Custom Status Emoji"
                  placeholder="🚀"
                  maxLength={8}
                  className="w-14 text-center rounded-xl bg-slate-950 border border-slate-800 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
                <input
                  id="custom-status-text-input"
                  type="text"
                  value={customStatusText}
                  onChange={(e) => setCustomStatusText(e.target.value)}
                  placeholder="What are you working on or playing?"
                  maxLength={128}
                  className="flex-1 rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                {QUICK_STATUS_EMOJIS.map((emj) => (
                  <button
                    key={emj}
                    type="button"
                    onClick={() => setCustomStatusEmoji(emj)}
                    className={`px-2 py-1 rounded-lg text-xs transition-colors cursor-pointer border ${
                      customStatusEmoji === emj
                        ? 'bg-indigo-600/25 border-indigo-500/50 text-white'
                        : 'bg-slate-900 border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    {emj}
                  </button>
                ))}
              </div>
            </div>

            {/* 5. About Me Bio Section */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="profile-bio-textarea"
                  className="text-xs font-semibold uppercase tracking-wider text-slate-300"
                >
                  About Me Bio
                </label>
                <span className="text-[11px] font-mono tabular-nums text-slate-400">
                  {bio.length}/{BLUEPRINT_LIMITS.BIO_MAX_LEN}
                </span>
              </div>
              <textarea
                id="profile-bio-textarea"
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, BLUEPRINT_LIMITS.BIO_MAX_LEN))}
                placeholder="Share your projects, stack, links, or favorite games..."
                className="w-full rounded-xl bg-slate-950 border border-slate-800 p-3.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none leading-relaxed"
              />
            </div>

            {/* 6. Profile Theme Accent Color */}
            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-indigo-400" />
                <span>Profile Accent Theme Color</span>
              </span>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5">
                  <input
                    type="color"
                    value={resolvedThemeHex.slice(0, 7)}
                    onChange={(e) => setProfileThemeColor(e.target.value.toUpperCase())}
                    aria-label="Pick Profile Theme Accent Color"
                    className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                  />
                  <input
                    type="text"
                    value={profileThemeColor}
                    onChange={(e) => setProfileThemeColor(e.target.value)}
                    aria-label="Profile Theme Accent Hex"
                    maxLength={7}
                    className="w-20 bg-transparent text-xs font-mono text-white focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {THEME_ACCENT_PRESETS.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setProfileThemeColor(hex)}
                      aria-label={`Set theme accent color ${hex}`}
                      className={`w-6 h-6 rounded-full border transition-transform cursor-pointer ${
                        resolvedThemeHex === hex
                          ? 'scale-110 border-white ring-2 ring-white/30'
                          : 'border-white/20 hover:scale-105'
                      }`}
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {errorMsg && (
              <p role="alert" className="text-xs font-medium text-rose-400">
                {errorMsg}
              </p>
            )}
          </div>

          {/* Right Column: Real-Time Live Preview Card (5 cols) */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Live Interactive Profile Preview
              </div>

              {/* Custom Themed Profile Card */}
              <div
                data-testid="live-profile-preview-card"
                className="rounded-2xl overflow-hidden bg-[#0E1320] shadow-2xl transition-all"
                style={{
                  borderWidth: '2px',
                  borderStyle: 'solid',
                  borderColor: resolvedThemeHex,
                }}
              >
                {/* Banner Area */}
                <div
                  className="h-28 w-full relative overflow-hidden"
                  style={{ backgroundColor: resolvedBannerHex }}
                >
                  {bannerUrl && (
                    <img
                      src={bannerUrl}
                      alt="Custom profile banner preview"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>

                {/* Avatar & Status Bubble */}
                <div className="px-5 pb-5 relative">
                  <div className="flex items-end justify-between -mt-10 mb-3">
                    <div className="relative w-20 h-20 rounded-full ring-4 ring-[#0E1320] bg-slate-900 overflow-hidden shrink-0">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt={username}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div
                          className="w-full h-full flex items-center justify-center text-xl font-bold text-white"
                          style={{ backgroundColor: resolvedThemeHex }}
                        >
                          {previewInitials}
                        </div>
                      )}
                      <span
                        className={`absolute bottom-1 right-1 w-4 h-4 rounded-full ring-2 ring-[#0E1320] ${
                          STATUS_DOT[profile.status]
                        }`}
                      />
                    </div>

                    <span
                      className="text-[11px] font-mono px-2.5 py-1 rounded-lg text-white font-semibold"
                      style={{ backgroundColor: `${resolvedThemeHex}33`, border: `1px solid ${resolvedThemeHex}66` }}
                    >
                      Wapper Free Pro
                    </span>
                  </div>

                  {/* Custom Status Thought Bubble */}
                  {(customStatusEmoji || customStatusText) && (
                    <div className="mb-3 rounded-xl bg-slate-900/90 border border-slate-800 px-3 py-2 text-xs text-slate-200 flex items-center gap-2">
                      {customStatusEmoji && <span className="text-sm">{customStatusEmoji}</span>}
                      <span className="truncate">{customStatusText}</span>
                    </div>
                  )}

                  {/* Identity & Bio Card Body */}
                  <div className="rounded-xl bg-[#090D16] border border-slate-800/90 p-3.5 space-y-3">
                    <div>
                      <h3 className="text-base font-bold text-white truncate">
                        {username.trim() || 'WapperUser'}
                      </h3>
                      <p className="text-xs font-mono text-slate-400">
                        {formatUniqueTag(username.trim() || 'WapperUser', profile.discriminator)}
                      </p>
                    </div>

                    <div className="border-t border-slate-800/80 pt-2.5 space-y-1">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        About Me
                      </div>
                      <p className="text-xs text-slate-300 whitespace-pre-line leading-relaxed break-words">
                        {bio.trim() || 'No bio added yet. Write something about yourself on the left!'}
                      </p>
                    </div>

                    <div className="border-t border-slate-800/80 pt-2.5 flex items-center justify-between text-[11px] text-slate-400 font-mono tabular-nums">
                      <span>Accent Theme</span>
                      <span className="flex items-center gap-1.5 text-slate-200">
                        <span
                          className="w-3 h-3 rounded-full inline-block"
                          style={{ backgroundColor: resolvedThemeHex }}
                        />
                        {resolvedThemeHex}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Save / Cancel Actions */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-semibold text-white transition-colors cursor-pointer shadow-lg"
                style={{ backgroundColor: resolvedThemeHex }}
              >
                {savedNotice ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Saved!</span>
                  </>
                ) : (
                  <span>{saving ? 'Saving Profile...' : 'Save Changes'}</span>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfileSettingsModal;
