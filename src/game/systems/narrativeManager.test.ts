import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHAPTERS,
  CINEMATICS,
  MEMORY_FRAGMENTS,
  TOWER_WHISPERS,
  getBossDialogue,
  getChapterForFloor,
} from '../data/lore';
import {
  computeLoreCompletion,
  createDefaultNarrativeProgress,
  evaluateTowerWhisper,
  mergeNarrativeProgress,
  pickMemoryFragmentForEvent,
  shouldShowChapterTransition,
  validateNarrativeProgress,
} from './narrativeManager';
import { createDefaultSave, validateAndMigrateSave } from './saveManager';

test('All 10 chapters, 10 boss dialogues, 20 memory fragments, and 7 Tower whispers are registered cleanly', () => {
  assert.equal(CHAPTERS.length, 10);
  assert.equal(MEMORY_FRAGMENTS.length, 20);
  assert.equal(Object.keys(TOWER_WHISPERS).length, 7);
  assert.ok(CINEMATICS.intro.scenes.length >= 4);
  assert.ok(CINEMATICS.floor100_ascension.scenes.length >= 2);

  for (const ch of CHAPTERS) {
    const dlg = getBossDialogue(ch.bossId);
    assert.ok(dlg, `Missing dialogue for boss ${ch.bossId}`);
    assert.ok(dlg.intro.length > 5);
    assert.ok(dlg.defeat.length > 5);
  }

  assert.equal(getChapterForFloor(1).index, 0);
  assert.equal(getChapterForFloor(11).index, 1);
  assert.equal(getChapterForFloor(50).index, 4);
  assert.equal(getChapterForFloor(100).index, 9);
  assert.equal(getChapterForFloor(101).index, 0);
});

test('validateNarrativeProgress derives legacy discoveries safely for existing accounts', () => {
  const migrated = validateNarrativeProgress(undefined, {
    bestFloor: 34,
    bestiaryKills: { goblin_king: 2, corrupted_knight: 1, forest_guardian: 1 },
  });

  assert.deepEqual(migrated.discoveredChapters, [0, 1, 2, 3]);
  assert.deepEqual(migrated.reachedBiomes, [0, 1, 2, 3]);
  assert.ok(migrated.defeatedBosses.includes('goblin_king'));
  assert.ok(migrated.defeatedBosses.includes('corrupted_knight'));
  assert.ok(migrated.unlockedRevelations.includes(0));
  assert.ok(migrated.unlockedRevelations.includes(2));
  assert.equal(migrated.infiniteAscensionUnlocked, false);
});

test('mergeNarrativeProgress unions permanent discoveries without duplicating or losing progress', () => {
  const a = validateNarrativeProgress({
    introSeen: true,
    discoveredChapters: [0, 1],
    collectedFragments: ['frag_01_aetherion_dawn', 'frag_02_goblin_crown'],
    defeatedBosses: ['goblin_king'],
    triggeredWhispers: ['first_run'],
  });
  const b = validateNarrativeProgress({
    introSeen: false,
    discoveredChapters: [0, 1, 2],
    collectedFragments: ['frag_02_goblin_crown', 'frag_03_three_shards'],
    defeatedBosses: ['goblin_king', 'corrupted_knight'],
    triggeredWhispers: ['first_run', 'first_death'],
    infiniteAscensionUnlocked: true,
  });

  const merged = mergeNarrativeProgress(a, b);
  assert.equal(merged.introSeen, true);
  assert.equal(merged.infiniteAscensionUnlocked, true);
  assert.deepEqual(merged.discoveredChapters, [0, 1, 2]);
  assert.deepEqual(
    merged.collectedFragments.sort(),
    ['frag_01_aetherion_dawn', 'frag_02_goblin_crown', 'frag_03_three_shards'].sort()
  );
  assert.equal(merged.defeatedBosses.length, 2);
  assert.equal(merged.triggeredWhispers.length, 2);
});

test('pickMemoryFragmentForEvent awards unique fragments by boss/source and prevents duplicates', () => {
  const firstBossFrag = pickMemoryFragmentForEvent({
    collectedIds: [],
    source: 'boss',
    floor: 10,
    bossId: 'goblin_king',
  });
  assert.equal(firstBossFrag?.id, 'frag_02_goblin_crown');

  const duplicateBossFrag = pickMemoryFragmentForEvent({
    collectedIds: ['frag_02_goblin_crown'],
    source: 'boss',
    floor: 10,
    bossId: 'goblin_king',
  });
  assert.equal(duplicateBossFrag, null);

  const altarFrag = pickMemoryFragmentForEvent({
    collectedIds: [],
    source: 'altar',
    floor: 4,
  });
  assert.equal(altarFrag?.id, 'frag_06_altar_blood');
});

test('evaluateTowerWhisper fires once per milestone and shouldShowChapterTransition respects skipRepeatedTransitions', () => {
  const w1 = evaluateTowerWhisper([], 'first_run');
  assert.equal(w1?.message, 'Mais uma alma em busca de poder.');
  const w2 = evaluateTowerWhisper(['first_run'], 'first_run');
  assert.equal(w2, null);

  // First discovery always shows even if skipRepeatedTransitions is true
  const firstEnter = shouldShowChapterTransition({
    floor: 11,
    previousFloor: 10,
    discoveredChapters: [0],
    skipRepeatedTransitions: true,
  });
  assert.equal(firstEnter.show, true);
  assert.equal(firstEnter.isFirstDiscovery, true);

  // Repeat visit suppressed when skipRepeatedTransitions is true
  const repeatEnter = shouldShowChapterTransition({
    floor: 11,
    previousFloor: 10,
    discoveredChapters: [0, 1],
    skipRepeatedTransitions: true,
  });
  assert.equal(repeatEnter.show, false);
});

test('computeLoreCompletion computes accurate percentage and save migration preserves narrative cleanly', () => {
  const base = createDefaultSave();
  const initialSummary = computeLoreCompletion(base);
  assert.ok(initialSummary.percent >= 0 && initialSummary.percent < 15);
  assert.equal(initialSummary.chapters.unlocked, 1);

  const migrated = validateAndMigrateSave({
    ...base,
    narrative: {
      ...createDefaultNarrativeProgress(),
      introSeen: true,
      discoveredChapters: [0, 1, 2],
      collectedFragments: ['frag_01_aetherion_dawn', 'frag_03_three_shards'],
    },
  });
  assert.equal(migrated.narrative.introSeen, true);
  assert.equal(migrated.narrative.collectedFragments.length, 2);
});
