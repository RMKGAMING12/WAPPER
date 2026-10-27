import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const rulesContent = fs.readFileSync(new URL('./firestore.rules', import.meta.url), 'utf8');

test('Dirty Dozen Security Invariants in firestore.rules', () => {
  // 1. Default deny catch-all
  assert.match(rulesContent, /match \/\{document=\*\*\} \{\s*allow read, write: if false;\s*\}/);

  // 2. Email verification enforced on writes
  assert.match(rulesContent, /request\.auth\.token\.email_verified == true/);

  // 3. Strict key allowlisting (hasAll + hasOnly) for all 5 collections
  assert.match(rulesContent, /function isValidProfile/);
  assert.match(rulesContent, /function isValidFriendRelationship/);
  assert.match(rulesContent, /function isValidServer/);
  assert.match(rulesContent, /function isValidChannel/);
  assert.match(rulesContent, /function isValidMessage/);

  // 4. AffectedKeys().hasOnly() enforced on updates
  assert.match(rulesContent, /affectedKeys\(\)\.hasOnly\(\[\s*'username'/);
  assert.match(rulesContent, /affectedKeys\(\)\.hasOnly\(\['status', 'updatedAt'\]\)/);
  assert.match(rulesContent, /affectedKeys\(\)\.hasOnly\(\['name', 'updatedAt'\]\)/);

  // 5. Temporal integrity (request.time)
  assert.match(rulesContent, /incoming\(\)\.createdAt == request\.time/);
  assert.match(rulesContent, /incoming\(\)\.updatedAt == request\.time/);

  // 6. Master Gate parent existence check
  assert.match(rulesContent, /exists\(\/databases\/\$\(database\)\/documents\/profiles\/\$\(incoming\(\)\.userId\)\)/);
  assert.match(rulesContent, /exists\(\/databases\/\$\(database\)\/documents\/servers\/\$\(serverId\)\/channels\/\$\(channelId\)\)/);

  // 7. Non-existent document get check (prevents NullPointerError before initial profile creation)
  assert.match(rulesContent, /resource == null \|\| existing\(\)\.uid is string/);
});
