# Wapper Firestore Security Specification

## 1. Data Invariants
1. **Default Deny**: Any path not explicitly matched is unconditionally denied (`allow read, write: if false;`).
2. **Verified Authentication**: All mutations (`create`, `update`, `delete`) require an authenticated user with `request.auth != null && request.auth.token.email_verified == true`.
3. **PII Isolation**: `/users_public/{userId}` stores only public display fields (`uid`, `username`, `avatarUrl`, `status`, `customStatus`, `createdAt`, `updatedAt`). No `email`, `phone`, or `address` fields are permitted.
4. **Master Gate & Relational Integrity**:
   - A `Channel` under `/servers/{serverId}/channels/{channelId}` can only be created if `/servers/{serverId}` exists (`exists(/databases/$(database)/documents/servers/$(serverId))`) and `incoming().serverId == serverId`.
   - A `Message` under `/servers/{serverId}/channels/{channelId}/messages/{messageId}` can only be created if `/servers/{serverId}/channels/{channelId}` exists and `incoming().authorId == request.auth.uid`.
   - A `CustomEmoji` under `/servers/{serverId}/emojis/{emojiId}` can only be created if `/servers/{serverId}` exists and `incoming().creatorId == request.auth.uid`.
5. **Temporal Integrity**: `createdAt` must equal `request.time` on `create` and remain immutable on `update`. `updatedAt` must equal `request.time` on `update`.
6. **Strict Key & Volumetric Boundaries**: Every entity enforces `hasAll` and `hasOnly` on `create`, `affectedKeys().hasOnly(...)` on `update`, and explicit `.size()` and regex bounds on all strings and IDs.

## 2. The "Dirty Dozen" Payloads
1. **Unverified Email Write**: Attempting to create a server with `email_verified: false`.
2. **Identity Spoofing on Server Create**: Setting `ownerId` to another user's UID.
3. **Shadow Field Injection on User Profile**: Adding `isAdmin: true` to `/users_public/{userId}`.
4. **ID Poisoning**: Creating a document with a 500-character or special-character ID (`id: "../../../etc/passwd"`).
5. **Orphaned Channel Creation**: Creating a channel under a non-existent `serverId`.
6. **Message Author Spoofing**: Creating a message where `authorId != request.auth.uid`.
7. **Timestamp Forgery**: Providing a past or future client timestamp where `createdAt != request.time`.
8. **Immutable Field Mutation**: Attempting to change `ownerId` or `createdAt` during a server update.
9. **Value Poisoning on Update**: Updating `status` on `/users_public/{userId}` to `"super_hacker"` (outside allowed enum).
10. **Oversized Content DoS**: Posting a message with `content.size() > 4000`.
11. **Unauthorized Message Deletion**: User B attempting to delete User A's message when User B is neither author nor server owner.
12. **PII Leak Attempt**: Injecting `email` into `/users_public/{userId}` (blocked by `hasOnly`).
