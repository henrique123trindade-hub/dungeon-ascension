import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rulesContent = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');
const blueprint = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), 'firebase-blueprint.json'), 'utf8')
) as {
  entities: Record<string, unknown>;
  firestore: Record<string, unknown>;
};

test('firestore.rules enforces default-deny safety net and rules_version 2', () => {
  assert.match(rulesContent, /rules_version\s*=\s*'2';/);
  assert.match(rulesContent, /match\s+\/\{document=\*\*\}\s*\{\s*allow\s+read,\s*write:\s*if\s+false;/);
});

test('Dirty Dozen #1-#3: PII isolated in private/account, verified email required for all writes', () => {
  assert.match(rulesContent, /function isVerifiedUser\(\)\s*\{\s*return isSignedIn\(\) && request\.auth\.token\.email_verified == true;/);
  assert.match(rulesContent, /match \/private\/account\s*\{[\s\S]*?allow get:\s*if isValidId\(uid\) && isOwner\(uid\);/);
  assert.match(rulesContent, /match \/private\/save\s*\{[\s\S]*?allow get:\s*if isValidId\(uid\) && isOwner\(uid\);/);
});

test('Dirty Dozen #4-#5: role locked to player and strict keys hasAll/hasOnly prevent shadow fields', () => {
  assert.match(rulesContent, /data\.role == 'player'/);
  assert.match(rulesContent, /incoming\(\)\.role == existing\(\)\.role/);
  assert.match(rulesContent, /affectedKeys\(\)\.hasOnly\(/);
});

test('Dirty Dozen #6-#7: atomic username ownership proof via getAfter and immutable username reservations', () => {
  assert.match(rulesContent, /match \/usernames\/\{usernameLower\}/);
  assert.match(rulesContent, /allow list:\s*if false;/);
  assert.match(rulesContent, /allow update:\s*if false;/);
  assert.match(
    rulesContent,
    /getAfter\(\/databases\/\$\(database\)\/documents\/usernames\/\$\(incoming\(\)\.usernameLower\)\)\.data\.uid == request\.auth\.uid/
  );
});

test('Dirty Dozen #8-#12: versioned anti-overwrite saves, monotonic stats, immutable redemptions/runs, and server timestamps', () => {
  assert.match(rulesContent, /incoming\(\)\.saveVersion >= existing\(\)\.saveVersion/);
  assert.match(rulesContent, /incoming\(\)\.bestFloor >= existing\(\)\.bestFloor/);
  assert.match(rulesContent, /incoming\(\)\.redeemedCodes\.hasAll\(existing\(\)\.redeemedCodes\)/);
  assert.match(rulesContent, /incoming\(\)\.unlockedSecretClasses\.hasAll\(existing\(\)\.unlockedSecretClasses\)/);
  assert.match(rulesContent, /match \/redemptions\/\{codeId\}[\s\S]*?allow update, delete:\s*if false;/);
  assert.match(rulesContent, /match \/runs\/\{runId\}[\s\S]*?allow update, delete:\s*if false;/);
  assert.match(rulesContent, /== request\.time/);
});

test('Every Firestore collection in firebase-blueprint.json is secured in firestore.rules', () => {
  const paths = Object.keys(blueprint.firestore);
  assert.equal(paths.length, 6);
  assert.ok(rulesContent.includes('match /players/{uid}'));
  assert.ok(rulesContent.includes('match /private/account'));
  assert.ok(rulesContent.includes('match /private/save'));
  assert.ok(rulesContent.includes('match /redemptions/{codeId}'));
  assert.ok(rulesContent.includes('match /runs/{runId}'));
  assert.ok(rulesContent.includes('match /usernames/{usernameLower}'));
});

test('Narrative progression schema is strictly validated in firestore.rules and present in blueprint', () => {
  assert.match(rulesContent, /function isValidNarrativeProgress\(n\)/);
  assert.match(rulesContent, /isValidNarrativeProgress\(data\.narrative\)/);
  assert.ok(rulesContent.includes("'skipRepeatedTransitions'"));
  const saveEntity = blueprint.entities['PlayerCloudSave'] as { properties?: Record<string, unknown> } | undefined;
  assert.ok(saveEntity?.properties && 'narrative' in saveEntity.properties);
});
