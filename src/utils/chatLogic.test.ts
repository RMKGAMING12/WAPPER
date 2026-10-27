import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseInlineMarkdown,
  validateEmojiName,
  sanitizeChannelName,
  groupChannelsByType,
  parseFriendTagInput,
  sanitizeProfileUpdate,
  filterHydratedFriendsByTab,
  buildServerInviteLink,
  parseInviteInput,
  HydratedFriendItem,
} from './chatLogic';

test('parseInlineMarkdown parses bold, italic, code, custom emojis, and links', () => {
  const emojis = { wapper_wave: 'https://example.com/wave.png' };
  const result = parseInlineMarkdown(
    'Hello **world** and *friends* with `code` :wapper_wave: at https://wapper.dev',
    emojis
  );

  assert.equal(result.some((s) => s.type === 'bold' && s.value === 'world'), true);
  assert.equal(result.some((s) => s.type === 'italic' && s.value === 'friends'), true);
  assert.equal(result.some((s) => s.type === 'code' && s.value === 'code'), true);
  assert.equal(
    result.some(
      (s) =>
        s.type === 'emoji' &&
        s.value === 'wapper_wave' &&
        s.emojiUrl === 'https://example.com/wave.png'
    ),
    true
  );
  assert.equal(result.some((s) => s.type === 'link' && s.value === 'https://wapper.dev'), true);
});

test('validateEmojiName enforces length and alphanumeric/underscore rules', () => {
  assert.equal(validateEmojiName('a').valid, false);
  assert.equal(validateEmojiName('bad-name!').valid, false);
  const validRes = validateEmojiName(':party_parrot_99:');
  assert.equal(validRes.valid, true);
  assert.equal(validRes.normalized, 'party_parrot_99');
});

test('sanitizeChannelName normalizes text channels to kebab-case and preserves voice channel casing', () => {
  assert.equal(sanitizeChannelName('  General Discussion!! ', 'text'), 'general-discussion');
  assert.equal(sanitizeChannelName('  Lobby Voice 1 ', 'voice'), 'Lobby Voice 1');
});

test('groupChannelsByType splits server channels into text and voice arrays', () => {
  const grouped = groupChannelsByType(
    [
      { id: '1', serverId: 's1', name: 'general', type: 'text', category: 'Text', topic: '' },
      { id: '2', serverId: 's1', name: 'Lounge', type: 'voice', category: 'Voice', topic: '' },
      { id: '3', serverId: 's2', name: 'other', type: 'text', category: 'Text', topic: '' },
    ],
    's1'
  );
  assert.equal(grouped.textChannels.length, 1);
  assert.equal(grouped.voiceChannels.length, 1);
});

test('parseFriendTagInput validates username and username#discriminator formats', () => {
  assert.equal(parseFriendTagInput('').valid, false);
  assert.equal(parseFriendTagInput('a').valid, false);
  assert.equal(parseFriendTagInput('user#abc').valid, false);

  const withTag = parseFriendTagInput('mayank#4092');
  assert.equal(withTag.valid, true);
  assert.equal(withTag.usernameQuery, 'mayank');
  assert.equal(withTag.discriminatorQuery, '4092');

  const nameOnly = parseFriendTagInput('mayank_dev');
  assert.equal(nameOnly.valid, true);
  assert.equal(nameOnly.usernameQuery, 'mayank_dev');
  assert.equal(nameOnly.discriminatorQuery, null);
});

test('sanitizeProfileUpdate validates username, hex colors, and bio lengths', () => {
  const invalid = sanitizeProfileUpdate({ username: 'x' });
  assert.equal(invalid.valid, false);

  const valid = sanitizeProfileUpdate({
    username: 'Mayank Raj',
    bannerColor: '#10b981',
    profileThemeColor: 'invalid-color',
    bio: 'Building real-time P2P systems.',
    customStatusEmoji: '🚀',
    customStatusText: 'Shipping Wapper v2',
  });
  assert.equal(valid.valid, true);
  assert.equal(valid.sanitized.username, 'Mayank Raj');
  assert.equal(valid.sanitized.bannerColor, '#10B981');
  assert.equal(valid.sanitized.profileThemeColor, '#5865F2');
});

test('filterHydratedFriendsByTab separates online, all, pending, and blocked friends', () => {
  const baseProfile = {
    discriminator: '1001',
    avatarUrl: '',
    bannerUrl: '',
    bannerColor: '#5865F2',
    bio: '',
    customStatusText: '',
    customStatusEmoji: '',
    profileThemeColor: '#5865F2',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const sample: HydratedFriendItem[] = [
    {
      relationshipId: 'r1',
      userId: 'u1',
      friendId: 'u2',
      relationshipStatus: 'accepted',
      updatedAt: new Date().toISOString(),
      profile: {
        ...baseProfile,
        id: 'u2',
        username: 'OnlineFriend',
        uniqueTag: 'OnlineFriend#1001',
        status: 'online',
      },
    },
    {
      relationshipId: 'r2',
      userId: 'u1',
      friendId: 'u3',
      relationshipStatus: 'accepted',
      updatedAt: new Date().toISOString(),
      profile: {
        ...baseProfile,
        id: 'u3',
        username: 'OfflineFriend',
        uniqueTag: 'OfflineFriend#1002',
        status: 'offline',
      },
    },
    {
      relationshipId: 'r3',
      userId: 'u1',
      friendId: 'u4',
      relationshipStatus: 'pending_incoming',
      updatedAt: new Date().toISOString(),
      profile: {
        ...baseProfile,
        id: 'u4',
        username: 'IncomingReq',
        uniqueTag: 'IncomingReq#1003',
        status: 'online',
      },
    },
    {
      relationshipId: 'r4',
      userId: 'u1',
      friendId: 'u5',
      relationshipStatus: 'blocked',
      updatedAt: new Date().toISOString(),
      profile: {
        ...baseProfile,
        id: 'u5',
        username: 'BlockedUser',
        uniqueTag: 'BlockedUser#1004',
        status: 'offline',
      },
    },
  ];

  assert.equal(filterHydratedFriendsByTab(sample, 'online').length, 1);
  assert.equal(filterHydratedFriendsByTab(sample, 'all').length, 2);
  assert.equal(filterHydratedFriendsByTab(sample, 'pending').length, 1);
  assert.equal(filterHydratedFriendsByTab(sample, 'blocked').length, 1);
});

test('buildServerInviteLink and parseInviteInput handle full URLs and short invite codes', () => {
  const link = buildServerInviteLink('https://wapper.vercel.app/', 'srv_wapper_community');
  assert.equal(link, 'https://wapper.vercel.app/?invite=srv_wapper_community');

  const parsedUrl = parseInviteInput(link);
  assert.equal(parsedUrl.valid, true);
  assert.equal(parsedUrl.inviteTarget, 'srv_wapper_community');

  const parsedCode = parseInviteInput('wapper-community');
  assert.equal(parsedCode.valid, true);
  assert.equal(parsedCode.inviteTarget, 'wapper-community');

  const parsedEmpty = parseInviteInput('   ');
  assert.equal(parsedEmpty.valid, false);
});

