import test from 'node:test';
import assert from 'node:assert/strict';
import { getVisibleClasses } from '../data/classes';
import { createDefaultSave, validateAndMigrateSave } from './saveManager';
import { redeemSecretCode } from './secretCodeManager';

test('Slatt stays completely hidden before redeeming monkeyslatt', () => {
  const save = createDefaultSave();
  const visible = getVisibleClasses(save.unlockedSecretClasses);
  assert.equal(visible.some((c) => c.id === 'slatt'), false);
  assert.equal(visible.length, 5);
});

test('handles empty and invalid secret codes cleanly without mutating save', () => {
  const save = createDefaultSave();

  const empty = redeemSecretCode(save, '   ');
  assert.equal(empty.status, 'empty');
  assert.deepEqual(empty.save, save);

  const invalid = redeemSecretCode(save, 'codigo_inexistente');
  assert.equal(invalid.status, 'invalid');
  assert.deepEqual(invalid.save, save);
  assert.equal(invalid.save.unlockedSecretClasses.length, 0);
});

test('redeems monkeyslatt case-insensitively, unlocks Slatt permanently, and blocks duplicates', () => {
  const save = createDefaultSave();

  const res = redeemSecretCode(save, '  MonkeySlatt  ');
  assert.equal(res.status, 'success');
  assert.equal(res.codeDef?.code, 'monkeyslatt');
  assert.ok(res.save.redeemedCodes.includes('monkeyslatt'));
  assert.ok(res.save.unlockedSecretClasses.includes('slatt'));

  const visibleAfter = getVisibleClasses(res.save.unlockedSecretClasses);
  assert.equal(visibleAfter.some((c) => c.id === 'slatt'), true);
  assert.equal(visibleAfter.length, 6);

  // Duplicate attempt must be rejected
  const dup = redeemSecretCode(res.save, 'monkeyslatt');
  assert.equal(dup.status, 'already_redeemed');
  assert.deepEqual(dup.save.redeemedCodes, ['monkeyslatt']);
  assert.deepEqual(dup.save.unlockedSecretClasses, ['slatt']);
});

test('migrates persisted save preserving redeemedCodes and guarding locked selectedClass', () => {
  const unlockedRaw = {
    selectedClass: 'slatt',
    redeemedCodes: ['monkeyslatt'],
    unlockedSecretClasses: ['slatt'],
  };
  const migratedUnlocked = validateAndMigrateSave(unlockedRaw);
  assert.equal(migratedUnlocked.selectedClass, 'slatt');
  assert.deepEqual(migratedUnlocked.redeemedCodes, ['monkeyslatt']);
  assert.deepEqual(migratedUnlocked.unlockedSecretClasses, ['slatt']);

  // Tampered save trying to select slatt without unlocking falls back safely to warrior
  const lockedRaw = {
    selectedClass: 'slatt',
    redeemedCodes: [],
    unlockedSecretClasses: [],
  };
  const migratedLocked = validateAndMigrateSave(lockedRaw);
  assert.equal(migratedLocked.selectedClass, 'warrior');
  assert.deepEqual(migratedLocked.unlockedSecretClasses, []);
});
