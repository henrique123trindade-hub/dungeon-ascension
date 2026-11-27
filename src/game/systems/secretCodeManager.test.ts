import test from 'node:test';
import assert from 'node:assert/strict';
import { getVisibleClasses } from '../data/classes';
import {
  computePlayerStats,
  computeSangueColoradoBonus,
  createEmptyModifiers,
} from './balance';
import { createDefaultSave, validateAndMigrateSave } from './saveManager';
import { redeemSecretCode } from './secretCodeManager';

test('All secret classes (Slatt, Farid, Baldasso) stay completely hidden before redemption', () => {
  const save = createDefaultSave();
  const visible = getVisibleClasses(save.unlockedSecretClasses);
  assert.equal(visible.some((c) => c.id === 'slatt'), false);
  assert.equal(visible.some((c) => c.id === 'farid'), false);
  assert.equal(visible.some((c) => c.id === 'baldasso'), false);
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

test('redeems monkeyslatt, farid1903, and baldasso1909 case-insensitively with duplicate protection', () => {
  let save = createDefaultSave();

  const resSlatt = redeemSecretCode(save, '  MonkeySlatt  ');
  assert.equal(resSlatt.status, 'success');
  assert.equal(resSlatt.codeDef?.code, 'monkeyslatt');
  assert.equal(resSlatt.codeDef?.theme, 'gold');
  save = resSlatt.save;

  const resFarid = redeemSecretCode(save, 'FARID1903');
  assert.equal(resFarid.status, 'success');
  assert.equal(resFarid.codeDef?.code, 'farid1903');
  assert.equal(resFarid.codeDef?.theme, 'tricolor');
  assert.ok(resFarid.save.unlockedSecretClasses.includes('farid'));
  save = resFarid.save;

  const resBaldasso = redeemSecretCode(save, '  Baldasso1909 ');
  assert.equal(resBaldasso.status, 'success');
  assert.equal(resBaldasso.codeDef?.code, 'baldasso1909');
  assert.equal(resBaldasso.codeDef?.theme, 'colorado');
  assert.ok(resBaldasso.save.unlockedSecretClasses.includes('baldasso'));
  save = resBaldasso.save;

  const visibleAfter = getVisibleClasses(save.unlockedSecretClasses);
  assert.equal(visibleAfter.some((c) => c.id === 'slatt'), true);
  assert.equal(visibleAfter.some((c) => c.id === 'farid'), true);
  assert.equal(visibleAfter.some((c) => c.id === 'baldasso'), true);
  assert.equal(visibleAfter.length, 8);

  // Duplicate attempts must be rejected for all three
  for (const code of ['monkeyslatt', 'farid1903', 'baldasso1909']) {
    const dup = redeemSecretCode(save, code);
    assert.equal(dup.status, 'already_redeemed');
    assert.deepEqual(dup.save.redeemedCodes, save.redeemedCodes);
    assert.deepEqual(dup.save.unlockedSecretClasses, save.unlockedSecretClasses);
  }
});

test('migrates persisted save preserving all secret classes and guarding locked selectedClass', () => {
  const unlockedRaw = {
    selectedClass: 'farid',
    redeemedCodes: ['farid1903', 'baldasso1909'],
    unlockedSecretClasses: [],
  };
  const migratedUnlocked = validateAndMigrateSave(unlockedRaw);
  assert.equal(migratedUnlocked.selectedClass, 'farid');
  assert.deepEqual(migratedUnlocked.redeemedCodes, ['farid1903', 'baldasso1909']);
  assert.ok(migratedUnlocked.unlockedSecretClasses.includes('farid'));
  assert.ok(migratedUnlocked.unlockedSecretClasses.includes('baldasso'));

  // Tampered save trying to select baldasso without unlocking falls back safely to warrior
  const lockedRaw = {
    selectedClass: 'baldasso',
    redeemedCodes: [],
    unlockedSecretClasses: [],
  };
  const migratedLocked = validateAndMigrateSave(lockedRaw);
  assert.equal(migratedLocked.selectedClass, 'warrior');
  assert.deepEqual(migratedLocked.unlockedSecretClasses, []);
});

test('Sangue Colorado scales smoothly as HP drops and respects balanced cap', () => {
  const fullHp = computeSangueColoradoBonus(1.0, 1);
  assert.equal(fullHp.damagePct, 0);
  assert.equal(fullHp.critBonus, 0);

  const halfHp = computeSangueColoradoBonus(0.5, 1);
  assert.ok(halfHp.damagePct > 0.14 && halfHp.damagePct < 0.25);

  const lowHpLv1 = computeSangueColoradoBonus(0.05, 1);
  assert.ok(Math.abs(lowHpLv1.damagePct - 0.32) < 1e-6);

  const lowHpLv10 = computeSangueColoradoBonus(0.01, 10);
  assert.ok(lowHpLv10.damagePct <= 0.55 + 1e-6);
  assert.equal(lowHpLv10.critBonus, 0.08);
});

test('Farid Espírito Imortal and Baldasso Muralha/Fúria buffs apply cleanly in computePlayerStats', () => {
  const baseInput = {
    level: 1,
    mods: createEmptyModifiers(),
    equipped: {},
    permanent: createDefaultSave().permanentUpgrades,
    ascensionLevel: 0,
    activeSynergies: [] as never[],
  };

  const faridBase = computePlayerStats({
    ...baseInput,
    classId: 'farid',
    skills: { espirito_imortal: 1 },
    immortalSpiritActive: false,
  });
  const faridTriggered = computePlayerStats({
    ...baseInput,
    classId: 'farid',
    skills: { espirito_imortal: 1 },
    immortalSpiritActive: true,
  });
  assert.ok(faridTriggered.damage > faridBase.damage);
  assert.ok(faridTriggered.damageReduction > faridBase.damageReduction);

  const baldassoBase = computePlayerStats({
    ...baseInput,
    classId: 'baldasso',
    skills: { muralha_colorada: 1, furia_beira_rio: 1, sangue_colorado: 1 },
    hpRatio: 1.0,
  });
  const baldassoBuffed = computePlayerStats({
    ...baseInput,
    classId: 'baldasso',
    skills: { muralha_colorada: 1, furia_beira_rio: 1, sangue_colorado: 1 },
    muralhaColoradaActive: true,
    furiaBeiraRioActive: true,
    hpRatio: 0.35,
  });
  assert.ok(baldassoBuffed.damageReduction > baldassoBase.damageReduction);
  assert.ok(baldassoBuffed.damage > baldassoBase.damage);
  assert.ok(baldassoBuffed.attackSpeed > baldassoBase.attackSpeed);
});
