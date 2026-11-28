import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  computeFavoriteClass,
  evaluatePasswordStrength,
  formatPlayTime,
  getUnlockedTitles,
  hasMeaningfulLocalProgress,
  mergeLocalAndCloudSave,
  reconcileSameAccountSave,
  validateEmail,
  validateUsername,
} from './accountLogic';
import { createDefaultSave } from './saveManager';
import {
  SlidingWindowRateLimiter,
  validateSecretCodeOnServer,
} from '../../server/secretCodeRegistry';

test('validateUsername enforces format, bounds, and reserved names', () => {
  assert.equal(validateUsername('ab').valid, false);
  assert.equal(validateUsername('a'.repeat(21)).valid, false);
  assert.equal(validateUsername('invalid space').valid, false);
  assert.equal(validateUsername('admin').valid, false);
  assert.equal(validateUsername('Moderador').valid, false);

  const ok = validateUsername('  Cavaleiro_99  ');
  assert.equal(ok.valid, true);
  assert.equal(ok.username, 'Cavaleiro_99');
  assert.equal(ok.usernameLower, 'cavaleiro_99');
});

test('validateEmail accepts valid emails and rejects malformed ones', () => {
  assert.equal(validateEmail('').valid, false);
  assert.equal(validateEmail('not-an-email').valid, false);
  assert.equal(validateEmail('hero@dungeon').valid, false);
  const ok = validateEmail('  Hero@DungeonAscension.com ');
  assert.equal(ok.valid, true);
  assert.equal(ok.email, 'hero@dungeonascension.com');
});

test('evaluatePasswordStrength scores weak, medium, and strong passwords accurately', () => {
  const empty = evaluatePasswordStrength('');
  assert.equal(empty.score, 0);
  assert.equal(empty.meetsMinimum, false);

  const weak = evaluatePasswordStrength('abc');
  assert.equal(weak.meetsMinimum, false);
  assert.ok(weak.score <= 1);

  const medium = evaluatePasswordStrength('dungeon12');
  assert.equal(medium.meetsMinimum, true);
  assert.ok(medium.score >= 2);

  const strong = evaluatePasswordStrength('Masmorra!2026#Asc');
  assert.equal(strong.meetsMinimum, true);
  assert.equal(strong.score, 4);
  assert.equal(strong.label, 'Forte');
});

test('hasMeaningfulLocalProgress ignores fresh default save and detects real progress', () => {
  const fresh = createDefaultSave();
  assert.equal(hasMeaningfulLocalProgress(fresh), false);

  assert.equal(hasMeaningfulLocalProgress({ ...fresh, bestFloor: 3 }), true);
  assert.equal(hasMeaningfulLocalProgress({ ...fresh, unlockedSecretClasses: ['slatt'] }), true);
  assert.equal(hasMeaningfulLocalProgress({ ...fresh, crystals: 60 }), true);
});

test('mergeLocalAndCloudSave merges without duplicating crystals, codes, or run records', () => {
  const local = {
    ...createDefaultSave(),
    saveVersion: 3,
    crystals: 140,
    totalCrystalsEarned: 220,
    bestFloor: 18,
    bestLevel: 21,
    totalKills: 450,
    totalBossKills: 3,
    totalRuns: 5,
    totalPlayTimeSec: 1200,
    redeemedCodes: ['monkeyslatt', 'farid1903'],
    unlockedSecretClasses: ['slatt', 'farid'] as ('slatt' | 'farid')[],
    claimedAchievements: ['first_blood'],
    records: [
      {
        id: 'run_shared',
        date: '2026-11-27T00:00:00.000Z',
        classId: 'farid' as const,
        floor: 18,
        level: 21,
        kills: 150,
        bossesKilled: 1,
        durationSec: 400,
        crystalsEarned: 45,
        ascensionLevel: 0,
      },
    ],
  };

  const cloud = {
    ...createDefaultSave(),
    saveVersion: 2,
    crystals: 80,
    totalCrystalsEarned: 110,
    bestFloor: 12,
    bestLevel: 14,
    totalKills: 200,
    totalBossKills: 1,
    totalRuns: 3,
    totalPlayTimeSec: 600,
    redeemedCodes: ['secret_farid_1903'],
    unlockedSecretClasses: ['farid'] as ('farid')[],
    claimedAchievements: ['first_blood'],
    records: [
      {
        id: 'run_shared',
        date: '2026-11-27T00:00:00.000Z',
        classId: 'farid' as const,
        floor: 18,
        level: 21,
        kills: 150,
        bossesKilled: 1,
        durationSec: 400,
        crystalsEarned: 45,
        ascensionLevel: 0,
      },
    ],
  };

  const merged = mergeLocalAndCloudSave(local, cloud);

  // Non-duplicating crystals (uses max instead of summing 140 + 80)
  assert.equal(merged.crystals, 140);
  assert.equal(merged.bestFloor, 18);
  assert.equal(merged.totalPlayTimeSec, 1200);
  assert.equal(merged.saveVersion, 4);
  // Farid code wasn't duplicated between legacy 'farid1903' and 'secret_farid_1903'
  assert.equal(merged.redeemedCodes.length, 2);
  assert.ok(merged.unlockedSecretClasses.includes('slatt'));
  assert.ok(merged.unlockedSecretClasses.includes('farid'));
  // Run record deduplicated by id
  assert.equal(merged.records.length, 1);
  assert.deepEqual(merged.claimedAchievements, ['first_blood']);
});

test('reconcileSameAccountSave never overwrites newer cloud save with older local cache', () => {
  const olderLocal = {
    ...createDefaultSave(),
    saveVersion: 2,
    bestFloor: 5,
    crystals: 40,
  };
  const newerCloud = {
    ...createDefaultSave(),
    saveVersion: 7,
    bestFloor: 32,
    crystals: 410,
  };

  const res = reconcileSameAccountSave(olderLocal, newerCloud);
  assert.equal(res.resolved.bestFloor, 32);
  assert.equal(res.resolved.crystals, 410);
  assert.equal(res.resolved.saveVersion, 7);
  assert.equal(res.shouldPushToCloud, false);

  // Offline progress on local (higher saveVersion) merges forward and triggers cloud push
  const offlineLocal = {
    ...newerCloud,
    saveVersion: 9,
    bestFloor: 36,
    crystals: 500,
  };
  const resOffline = reconcileSameAccountSave(offlineLocal, newerCloud);
  assert.equal(resOffline.resolved.bestFloor, 36);
  assert.equal(resOffline.shouldPushToCloud, true);
  assert.ok(resOffline.resolved.saveVersion >= 10);
});

test('titles, favorite class, and playtime formatting work accurately', () => {
  const save = {
    ...createDefaultSave(),
    bestFloor: 26,
    totalKills: 300,
    totalBossKills: 5,
    unlockedSecretClasses: ['farid'] as ('farid')[],
    records: [
      {
        id: 'r1',
        date: '2026-11-27T00:00:00.000Z',
        classId: 'farid' as const,
        floor: 26,
        level: 28,
        kills: 200,
        bossesKilled: 3,
        durationSec: 600,
        crystalsEarned: 90,
        ascensionLevel: 0,
      },
    ],
  };

  const titles = getUnlockedTitles(save).map((t) => t.id);
  assert.ok(titles.includes('novato_masmorra'));
  assert.ok(titles.includes('cacador_sombras'));
  assert.ok(titles.includes('carrasco_chefes'));
  assert.ok(titles.includes('desbravador_profundo'));
  assert.ok(titles.includes('guardiao_secreto'));
  assert.equal(computeFavoriteClass(save), 'farid');
  assert.equal(formatPlayTime(3665), '1h 1m');
  assert.equal(formatPlayTime(125), '2m 5s');
});

test('server-side secret code registry validates codes and enforces sliding-window rate limit', () => {
  assert.equal(validateSecretCodeOnServer('MONKEYSLATT')?.id, 'secret_slatt_monkeyslatt');
  assert.equal(validateSecretCodeOnServer('  farid1903 ')?.id, 'secret_farid_1903');
  assert.equal(validateSecretCodeOnServer('Baldasso1909')?.id, 'secret_baldasso_1909');
  assert.equal(validateSecretCodeOnServer('invalido'), null);

  const limiter = new SlidingWindowRateLimiter(3, 60_000);
  const t0 = 1_000_000;
  assert.equal(limiter.check('127.0.0.1', t0).allowed, true);
  assert.equal(limiter.check('127.0.0.1', t0 + 100).allowed, true);
  assert.equal(limiter.check('127.0.0.1', t0 + 200).allowed, true);
  const blocked = limiter.check('127.0.0.1', t0 + 300);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSec >= 1);
  // After window passes, allowed again
  assert.equal(limiter.check('127.0.0.1', t0 + 61_000).allowed, true);
});

test('client secretCodes.ts does not embed plaintext secret code strings', () => {
  const clientSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/game/data/secretCodes.ts'),
    'utf8'
  );
  assert.equal(clientSource.includes("'monkeyslatt'"), false);
  assert.equal(clientSource.includes("'farid1903'"), false);
  assert.equal(clientSource.includes("'baldasso1909'"), false);
});
