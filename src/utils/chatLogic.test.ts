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
  extractYouTubeVideoId,
  filterSlashCommands,
  executeSlashCommand,
  isFounderUser,
  isFounderEmail,
  getUserHighestRole,
  hasServerPermission,
  buildDMConversationId,
  isMessageInDMConversation,
  parseMessageTimestampMs,
  sortMessagesByCreatedAtAsc,
  extractMentionQuery,
  filterMentionCandidates,
  injectMentionIntoInput,
  doesMessageMentionUser,
  normalizeYouTubeChannelId,
  parseYouTubePubSubXml,
  buildYouTubePubSubXmlSample,
  buildYouTubeWebhookBotMessage,
  DEFAULT_SERVER_ROLES,
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

test('sanitizeChannelName normalizes text channels to kebab-case, preserves emojis, and preserves voice channel casing', () => {
  assert.equal(sanitizeChannelName('  General Discussion!! ', 'text'), 'general-discussion');
  assert.equal(sanitizeChannelName('📢-announcements', 'text'), '📢-announcements');
  assert.equal(sanitizeChannelName('🚀-stream-alerts', 'text'), '🚀-stream-alerts');
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

test('extractYouTubeVideoId supports watch?v=, youtu.be/, /live/, and search queries', () => {
  assert.equal(
    extractYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ').videoId,
    'dQw4w9WgXcQ'
  );
  assert.equal(
    extractYouTubeVideoId('https://youtu.be/jfKfPfyJRdk').videoId,
    'jfKfPfyJRdk'
  );
  assert.equal(
    extractYouTubeVideoId('https://www.youtube.com/live/4xDzrJKXOOY?feature=share').videoId,
    '4xDzrJKXOOY'
  );
  const searchRes = extractYouTubeVideoId('synthwave coding radio');
  assert.equal(searchRes.isSearchFallback, true);
  assert.equal(searchRes.videoId.length, 11);
});

test('filterSlashCommands and executeSlashCommand handle /youtube, /live, /poll, /8ball, and /roll', () => {
  assert.equal(filterSlashCommands('/yo').length, 1);
  assert.equal(filterSlashCommands('/yo')[0].command, '/youtube');

  const caller = { id: 'usr_1', username: 'Mayank Raj' };

  const ytCmd = executeSlashCommand('/youtube https://youtu.be/dQw4w9WgXcQ', caller);
  assert.equal(ytCmd.isSlashCommand, true);
  assert.equal(ytCmd.botName, 'YouTube Music Bot');
  assert.equal(ytCmd.botEmbed?.youtubeVideoId, 'dQw4w9WgXcQ');

  const liveCmd = executeSlashCommand(
    '/live https://www.youtube.com/watch?v=jfKfPfyJRdk Shipping Wapper Live',
    caller
  );
  assert.equal(liveCmd.isSlashCommand, true);
  assert.equal(liveCmd.botName, 'Wapper Streamer Bot');
  assert.equal(liveCmd.liveStatusUpdate?.isLive, true);
  assert.equal(liveCmd.liveStatusUpdate?.liveStreamTitle, 'Shipping Wapper Live');

  const pollCmd = executeSlashCommand(
    '/poll Best feature? | YouTube Bot | Live Streamer | Server Roles',
    caller
  );
  assert.equal(pollCmd.isSlashCommand, true);
  assert.equal(pollCmd.botEmbed?.pollOptions?.length, 3);
  assert.deepEqual(Object.keys(pollCmd.initialReactions || {}), ['1️⃣', '2️⃣', '3️⃣']);

  const rollCmd = executeSlashCommand('/roll 20', caller, 14);
  assert.equal(rollCmd.isSlashCommand, true);
  assert.equal(rollCmd.botEmbed?.embedType, 'roll');
});

test('isFounderUser and role permission helpers enforce strict email verification and evaluate role hierarchy', () => {
  // All three whitelisted emails must be recognized
  assert.equal(isFounderUser({ email: 'mayankraj.mfp23@gmail.com' }), true);
  assert.equal(isFounderUser({ email: 'mayankraj.mfp26@gmail.com' }), true);
  assert.equal(isFounderUser({ email: 'mayankraj.mfp29@gmail.com' }), true);

  // Case-insensitivity support for emails
  assert.equal(isFounderUser({ email: 'MAYANKRAJ.MFP23@GMAIL.COM' }), true);

  // CRITICAL SECURITY CHECK: Name match alone ("Mayank raj") with non-matching or missing email MUST return false
  assert.equal(isFounderUser({ username: 'Mayank raj' }), false);
  assert.equal(isFounderUser({ username: 'Mayank raj', email: 'impostor@gmail.com' }), false);
  assert.equal(isFounderUser({ username: 'Mayank Raj', email: 'mayankraj.mfp99@gmail.com' }), false);
  assert.equal(isFounderUser({ username: 'RandomUser', email: 'user@example.com' }), false);

  assert.equal(isFounderEmail('mayankraj.mfp23@gmail.com'), true);
  assert.equal(isFounderEmail('other@gmail.com'), false);
  assert.equal(isFounderEmail(undefined), false);

  const highest = getUserHighestRole(DEFAULT_SERVER_ROLES, ['role_member', 'role_moderator']);
  assert.equal(highest?.id, 'role_moderator');

  assert.equal(
    hasServerPermission({
      serverOwnerId: 'owner_1',
      user: { id: 'u2', username: 'ModUser' },
      roles: DEFAULT_SERVER_ROLES,
      memberRoleIds: ['role_moderator'],
      permission: 'DELETE_MESSAGES',
    }),
    true
  );
});

test('buildDMConversationId, isMessageInDMConversation, and sortMessagesByCreatedAtAsc handle bidirectional DMs and ascending order', () => {
  const convAB = buildDMConversationId('usr_bob', 'usr_alice');
  const convBA = buildDMConversationId('usr_alice', 'usr_bob');
  assert.equal(convAB, convBA);
  assert.equal(convAB, 'dm_usr_alice_usr_bob');

  assert.equal(
    isMessageInDMConversation(
      { senderId: 'usr_alice', receiverId: 'usr_bob' },
      'usr_bob',
      'usr_alice'
    ),
    true
  );
  assert.equal(
    isMessageInDMConversation(
      { senderId: 'usr_bob', receiverId: 'usr_alice' },
      'usr_bob',
      'usr_alice'
    ),
    true
  );
  assert.equal(
    isMessageInDMConversation(
      { senderId: 'usr_alice', receiverId: 'usr_charlie' },
      'usr_bob',
      'usr_alice'
    ),
    false
  );

  assert.equal(
    parseMessageTimestampMs({ seconds: 1700000000, nanoseconds: 500000000 }),
    1700000000500
  );

  const unsorted = [
    { id: 'm3', createdAt: '2026-10-27T12:00:05.000Z', content: 'Third' },
    { id: 'm1', createdAt: '2026-10-27T12:00:01.000Z', content: 'First' },
    { id: 'm2', createdAt: '2026-10-27T12:00:03.000Z', content: 'Second' },
    { id: 'm1', createdAt: '2026-10-27T12:00:01.000Z', content: 'First (edited)' },
  ];
  const sorted = sortMessagesByCreatedAtAsc(unsorted);
  assert.equal(sorted.length, 3);
  assert.deepEqual(
    sorted.map((m) => m.id),
    ['m1', 'm2', 'm3']
  );
  assert.equal(sorted[0].content, 'First (edited)');
});

test('extractMentionQuery, filterMentionCandidates, injectMentionIntoInput, and doesMessageMentionUser handle Discord-style @mentions', () => {
  const triggerAtStart = extractMentionQuery('@');
  assert.equal(triggerAtStart.active, true);
  assert.equal(triggerAtStart.query, '');
  assert.equal(triggerAtStart.startIndex, 0);

  const triggerMidSentence = extractMentionQuery('Hey @May');
  assert.equal(triggerMidSentence.active, true);
  assert.equal(triggerMidSentence.query, 'May');
  assert.equal(triggerMidSentence.startIndex, 4);

  // Completed mention with trailing space should close popup
  const completedMention = extractMentionQuery('Hey @Mayank Raj ');
  assert.equal(completedMention.active, false);

  // Email addresses should not trigger mention autocomplete
  const emailText = extractMentionQuery('Reach me at user@gmail.com');
  assert.equal(emailText.active, false);

  const members = [
    { id: 'u1', username: 'Mayank Raj', uniqueTag: 'Mayank Raj#5603', status: 'online' as const },
    { id: 'u2', username: 'Alex Mercer', uniqueTag: 'Alex Mercer#1024', status: 'online' as const },
    { id: 'u3', username: 'Maya Lin', uniqueTag: 'Maya Lin#8811', status: 'offline' as const },
  ];

  const filtered = filterMentionCandidates(members, 'may');
  assert.equal(filtered.length, 2);
  assert.equal(filtered[0].username, 'Mayank Raj'); // Online ranked before offline
  assert.equal(filtered[1].username, 'Maya Lin');

  const injected = injectMentionIntoInput(
    'Hey @May',
    'Mayank Raj',
    triggerMidSentence.startIndex,
    triggerMidSentence.endIndex
  );
  assert.equal(injected.text, 'Hey @Mayank Raj ');

  // Mention highlight detection
  assert.equal(
    doesMessageMentionUser('Hey @Mayank Raj check out this build!', 'Mayank Raj'),
    true
  );
  assert.equal(
    doesMessageMentionUser('@Alex Mercer!', 'Alex Mercer'),
    true
  );
  assert.equal(
    doesMessageMentionUser('Just a normal message without mentions', 'Mayank Raj'),
    false
  );
  assert.equal(
    doesMessageMentionUser('Mentioning @Alex Mercer only', 'Mayank Raj'),
    false
  );

  // Inline markdown @mention tokenizing
  const segments = parseInlineMarkdown(
    'Hello @Mayank Raj and @Alex_Mercer!',
    {},
    ['Mayank Raj', 'Alex_Mercer']
  );
  assert.equal(
    segments.some((s) => s.type === 'mention' && s.value === '@Mayank Raj'),
    true
  );
  assert.equal(
    segments.some((s) => s.type === 'mention' && s.value === '@Alex_Mercer'),
    true
  );
});

test('infrastructure and architecture panel access is strictly restricted to whitelisted founder accounts', () => {
  // Whitelisted founder emails must have authorization
  assert.equal(isFounderEmail('mayankraj.mfp23@gmail.com'), true);
  assert.equal(isFounderEmail('mayankraj.mfp26@gmail.com'), true);
  assert.equal(isFounderEmail('mayankraj.mfp29@gmail.com'), true);
  assert.equal(isFounderEmail('MAYANKRAJ.MFP23@GMAIL.COM'), true);

  // Non-whitelisted accounts, guests, and impostors must be completely rejected
  assert.equal(isFounderEmail(''), false);
  assert.equal(isFounderEmail(undefined), false);
  assert.equal(isFounderEmail(null), false);
  assert.equal(isFounderEmail('guest@example.com'), false);
  assert.equal(isFounderEmail('public_user@gmail.com'), false);
  assert.equal(isFounderEmail('impostor@gmail.com'), false);
  assert.equal(isFounderEmail('mayankraj.mfp99@gmail.com'), false);
});

test('normalizeYouTubeChannelId, parseYouTubePubSubXml, and buildYouTubeWebhookBotMessage handle PubSubHubbub RSS notifications', () => {
  const validId = normalizeYouTubeChannelId('UC_x5XG1OV2P6uZZ5FSM9Ttw');
  assert.equal(validId.valid, true);
  assert.equal(validId.channelId, 'UC_x5XG1OV2P6uZZ5FSM9Ttw');
  assert.equal(
    validId.feedUrl,
    'https://www.youtube.com/xml/feeds/videos.xml?channel_id=UC_x5XG1OV2P6uZZ5FSM9Ttw'
  );

  const validUrl = normalizeYouTubeChannelId(
    'https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw/videos'
  );
  assert.equal(validUrl.valid, true);
  assert.equal(validUrl.channelId, 'UC_x5XG1OV2P6uZZ5FSM9Ttw');

  // 1. Live Stream XML Payload -> 🔴 GO LIVE ALERT
  const liveXml = buildYouTubePubSubXmlSample({
    videoId: 'jfKfPfyJRdk',
    channelId: 'UC_x5XG1OV2P6uZZ5FSM9Ttw',
    channelName: 'Mayank Raj Official',
    title: 'Building Wapper v2 LIVE Stream',
    isLiveStream: true,
  });
  const parsedLive = parseYouTubePubSubXml(liveXml);
  assert.ok(parsedLive);
  assert.equal(parsedLive.videoId, 'jfKfPfyJRdk');
  assert.equal(parsedLive.channelId, 'UC_x5XG1OV2P6uZZ5FSM9Ttw');
  assert.equal(parsedLive.channelName, 'Mayank Raj Official');
  assert.equal(parsedLive.isLiveStream, true);

  const liveBotMsg = buildYouTubeWebhookBotMessage(parsedLive, {
    serverId: 'srv_wapper_community',
    channelId: 'chan_announcements',
    authorId: 'usr_founder',
  });
  assert.equal(liveBotMsg.isBot, true);
  assert.equal(liveBotMsg.botName, 'Wapper Bot');
  assert.equal(liveBotMsg.botEmbed.embedType, 'youtube_live_alert');
  assert.equal(liveBotMsg.botEmbed.alertHeader, '🔴 GO LIVE ALERT');
  assert.equal(liveBotMsg.botEmbed.isLiveStream, true);
  assert.equal(liveBotMsg.botEmbed.youtubeVideoId, 'jfKfPfyJRdk');

  // 2. Standard Video Upload XML Payload -> 🆕 NEW VIDEO UPLOAD
  const uploadXml = buildYouTubePubSubXmlSample({
    videoId: 'dQw4w9WgXcQ',
    channelId: 'UC_x5XG1OV2P6uZZ5FSM9Ttw',
    channelName: 'Mayank Raj Official',
    title: 'Wapper Architecture Deep Dive Tutorial',
    isLiveStream: false,
  });
  const parsedUpload = parseYouTubePubSubXml(uploadXml);
  assert.ok(parsedUpload);
  assert.equal(parsedUpload.isLiveStream, false);

  const uploadBotMsg = buildYouTubeWebhookBotMessage(parsedUpload, {
    serverId: 'srv_wapper_community',
    channelId: 'chan_announcements',
    authorId: 'usr_founder',
  });
  assert.equal(uploadBotMsg.botEmbed.embedType, 'youtube_upload_alert');
  assert.equal(uploadBotMsg.botEmbed.alertHeader, '🆕 NEW VIDEO UPLOAD');
  assert.equal(uploadBotMsg.botEmbed.isLiveStream, false);
});
