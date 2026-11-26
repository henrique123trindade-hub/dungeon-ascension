import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createLevelUpGuard,
  extractUpgradeHighlights,
  isLevelUpUnlocked,
  LEVEL_UP_LOCK_MS,
  LEVEL_UP_RESUME_TRANSITION_MS,
  onGuardCardPointerDown,
  onGuardCardPointerUp,
  onGuardGlobalPointerDown,
  onGuardGlobalPointerUp,
  onGuardKeyDown,
  onGuardKeyUp,
  onGuardPointerButtonsObserved,
} from './levelUpGuard';
import type { UpgradeOption } from '../types';

const SAMPLE_OPTIONS: UpgradeOption[] = [
  {
    id: 'opt_1',
    kind: 'stat',
    rarity: 'rare',
    title: 'Lâmina Afiada',
    subtitle: 'Aprimoramento de Atributo',
    description: '+15% de dano em todos os ataques.',
    statDelta: { damagePct: 0.15 },
  },
  {
    id: 'opt_2',
    kind: 'skill',
    rarity: 'epic',
    title: 'Chamas Infernais',
    subtitle: 'Evolução de Habilidade · Nv.4',
    description: 'Bola de Fogo evolui para Chamas Infernais.',
    skillId: 'fireball',
    nextSkillLevel: 4,
    evolvedName: 'Chamas Infernais',
  },
  {
    id: 'opt_3',
    kind: 'multiplier',
    rarity: 'legendary',
    title: 'Despertar do Soberano (Dano ×1.75)',
    subtitle: 'Multiplicador Lendário',
    description: 'Eleva todo o dano em 1,75x.',
    multDelta: { field: 'damageMult', factor: 1.75 },
  },
];

test('blocks all clicks during initial 800ms lock window and unlocks cleanly after', () => {
  assert.equal(LEVEL_UP_LOCK_MS, 800);
  assert.equal(LEVEL_UP_RESUME_TRANSITION_MS, 300);

  let guard = createLevelUpGuard(1000, false);
  assert.equal(isLevelUpUnlocked(guard, 1000), false);
  assert.equal(isLevelUpUnlocked(guard, 1799), false);
  assert.equal(isLevelUpUnlocked(guard, 1800), true);

  // Click during lock must be rejected
  guard = onGuardCardPointerDown(guard, 'opt_1', 1, 1400);
  const earlyUp = onGuardCardPointerUp(guard, 'opt_1', 1, 1450);
  assert.equal(earlyUp.accepted, false);
  guard = earlyUp.next;

  // Fresh intentional click AFTER 800ms succeeds in a single click
  guard = onGuardCardPointerDown(guard, 'opt_1', 2, 1820);
  const validUp = onGuardCardPointerUp(guard, 'opt_1', 2, 1860);
  assert.equal(validUp.accepted, true);
  assert.equal(validUp.next.chosenOptionId, 'opt_1');

  // Rapid second click / spam after choice is ignored
  const spamDown = onGuardCardPointerDown(validUp.next, 'opt_2', 3, 1890);
  const spamUp = onGuardCardPointerUp(spamDown, 'opt_2', 3, 1910);
  assert.equal(spamUp.accepted, false);
});

test('requires releasing a mouse button held before level-up even after 800ms elapse', () => {
  let guard = createLevelUpGuard(1000, true);
  assert.equal(isLevelUpUnlocked(guard, 1900), false, 'Still locked while LMB remains held past 800ms');

  // Releasing LMB directly over a card at 1950ms must NOT select it
  const releaseOverCard = onGuardCardPointerUp(guard, 'opt_1', 1, 1950);
  assert.equal(releaseOverCard.accepted, false);
  guard = releaseOverCard.next;

  // Now unlocked and ready for a fresh intentional click
  assert.equal(isLevelUpUnlocked(guard, 1960), true);
  guard = onGuardCardPointerDown(guard, 'opt_2', 2, 1980);
  const commit = onGuardCardPointerUp(guard, 'opt_2', 2, 2020);
  assert.equal(commit.accepted, true);
  assert.equal(commit.next.chosenOptionId, 'opt_2');
});

test('rejects clicks started at 790ms and released at 830ms across unlock boundary', () => {
  let guard = createLevelUpGuard(1000, false);

  // Spam click begins 10ms before unlock and ends 30ms after unlock
  guard = onGuardCardPointerDown(guard, 'opt_1', 1, 1790);
  assert.equal(guard.armedOptionId, null);
  assert.equal(guard.requirePointerRelease, true);

  const releaseAfterBoundary = onGuardCardPointerUp(guard, 'opt_1', 1, 1830);
  assert.equal(releaseAfterBoundary.accepted, false);
  guard = releaseAfterBoundary.next;

  // Subsequent intentional click works immediately
  assert.equal(isLevelUpUnlocked(guard, 1840), true);
  guard = onGuardCardPointerDown(guard, 'opt_3', 2, 1850);
  const commit = onGuardCardPointerUp(guard, 'opt_3', 2, 1890);
  assert.equal(commit.accepted, true);
  assert.equal(commit.next.chosenOptionId, 'opt_3');
});

test('global pointerdown during lock or observed buttons mask prevents accidental selection', () => {
  let guard = createLevelUpGuard(2000, false);
  guard = onGuardPointerButtonsObserved(guard, 1, 2100);
  assert.equal(guard.requirePointerRelease, true);
  assert.equal(isLevelUpUnlocked(guard, 3000), false);

  guard = onGuardGlobalPointerUp(guard);
  assert.equal(isLevelUpUnlocked(guard, 3000), true);

  // Pressing down on card 1 and dragging to release on card 2 must not select card 2
  guard = onGuardGlobalPointerDown(guard, 3010);
  guard = onGuardCardPointerDown(guard, 'opt_1', 5, 3010);
  const mismatched = onGuardCardPointerUp(guard, 'opt_2', 5, 3060);
  assert.equal(mismatched.accepted, false);
});

test('keyboard 1/2/3 respects 800ms lock, held pointer, and pre-held keys', () => {
  let guard = createLevelUpGuard(1000, true, ['Digit1']);

  // Blocked during lock
  const r1 = onGuardKeyDown(guard, 'Digit2', false, SAMPLE_OPTIONS, 1500);
  assert.equal(r1.chosenOption, null);
  guard = r1.next;

  // Still blocked at 1900ms while pointer is held
  const r2 = onGuardKeyDown(guard, 'Digit3', false, SAMPLE_OPTIONS, 1900);
  assert.equal(r2.chosenOption, null);
  guard = r2.next;

  // Release pointer, but Digit1 was held before unlock -> still blocked until Digit1 is released
  guard = onGuardGlobalPointerUp(guard);
  const r3 = onGuardKeyDown(guard, 'Digit1', false, SAMPLE_OPTIONS, 1950);
  assert.equal(r3.chosenOption, null);
  guard = r3.next;

  // Release Digit1 -> now Digit1 selects immediately
  guard = onGuardKeyUp(guard, 'Digit1');
  const r4 = onGuardKeyDown(guard, 'Digit1', false, SAMPLE_OPTIONS, 2000);
  assert.equal(r4.chosenOption?.id, 'opt_1');

  // Repeating key or second key after commit does nothing
  const r5 = onGuardKeyDown(r4.next, 'Digit2', false, SAMPLE_OPTIONS, 2020);
  assert.equal(r5.chosenOption, null);
});

test('extractUpgradeHighlights produces concise benefit tags for stats, skills, and multipliers', () => {
  assert.deepEqual(extractUpgradeHighlights(SAMPLE_OPTIONS[0]), ['+15% Dano']);
  assert.deepEqual(extractUpgradeHighlights(SAMPLE_OPTIONS[1]), ['Evolução: Chamas Infernais', 'Nível 4']);
  assert.deepEqual(extractUpgradeHighlights(SAMPLE_OPTIONS[2]), [
    'Dano Total ×1.75',
    'Multiplicador da Expedição',
  ]);
});
