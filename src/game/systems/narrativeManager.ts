import {
  CHAPTERS,
  CINEMATICS,
  MEMORY_FRAGMENTS,
  TOWER_WHISPERS,
  type FragmentSource,
  type MemoryFragmentDef,
  type TowerWhisperDef,
} from '../data/lore';
import { BOSSES } from '../data/bosses';
import type { NarrativeProgress, SaveData } from '../types';

export function createDefaultNarrativeProgress(): NarrativeProgress {
  return {
    introSeen: false,
    discoveredChapters: [0],
    reachedBiomes: [0],
    collectedFragments: [],
    discoveredBosses: [],
    defeatedBosses: [],
    unlockedCinematics: [],
    unlockedRevelations: [],
    triggeredWhispers: [],
    infiniteAscensionUnlocked: false,
  };
}

const VALID_BOSS_IDS = new Set(BOSSES.map((b) => b.id));
const VALID_FRAGMENT_IDS = new Set(MEMORY_FRAGMENTS.map((f) => f.id));
const VALID_CINEMATIC_IDS = new Set<string>(Object.keys(CINEMATICS));
const VALID_WHISPER_IDS = new Set<string>(Object.keys(TOWER_WHISPERS));

function sanitizeIntList(raw: unknown, min: number, max: number, limit: number): number[] {
  if (!Array.isArray(raw)) return [];
  const out = new Set<number>();
  for (const item of raw) {
    if (typeof item === 'number' && Number.isFinite(item)) {
      const n = Math.floor(item);
      if (n >= min && n <= max) out.add(n);
    }
    if (out.size >= limit) break;
  }
  return Array.from(out).sort((a, b) => a - b);
}

function sanitizeStringList(raw: unknown, allowed: Set<string>, limit: number): string[] {
  if (!Array.isArray(raw)) return [];
  const out = new Set<string>();
  for (const item of raw) {
    if (typeof item === 'string' && allowed.has(item)) {
      out.add(item);
    }
    if (out.size >= limit) break;
  }
  return Array.from(out);
}

/**
 * Validates and reconciles NarrativeProgress, automatically deriving chapter/boss
 * discoveries from legacy bestFloor and bestiaryKills for backwards compatibility.
 */
export function validateNarrativeProgress(
  raw: unknown,
  legacyContext?: {
    bestFloor?: number;
    bestiaryKills?: Record<string, number>;
    totalRuns?: number;
  }
): NarrativeProgress {
  const def = createDefaultNarrativeProgress();
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};

  const discoveredChapters = new Set<number>(sanitizeIntList(obj.discoveredChapters, 0, 9, 10));
  const reachedBiomes = new Set<number>(sanitizeIntList(obj.reachedBiomes, 0, 9, 10));
  const collectedFragments = new Set<string>(sanitizeStringList(obj.collectedFragments, VALID_FRAGMENT_IDS, 32));
  const discoveredBosses = new Set<string>(sanitizeStringList(obj.discoveredBosses, VALID_BOSS_IDS, 16));
  const defeatedBosses = new Set<string>(sanitizeStringList(obj.defeatedBosses, VALID_BOSS_IDS, 16));
  const unlockedCinematics = new Set<string>(sanitizeStringList(obj.unlockedCinematics, VALID_CINEMATIC_IDS, 8));
  const unlockedRevelations = new Set<number>(sanitizeIntList(obj.unlockedRevelations, 0, 9, 10));
  const triggeredWhispers = new Set<string>(sanitizeStringList(obj.triggeredWhispers, VALID_WHISPER_IDS, 16));

  discoveredChapters.add(0);
  reachedBiomes.add(0);

  let introSeen = typeof obj.introSeen === 'boolean' ? obj.introSeen : def.introSeen;
  let infiniteAscensionUnlocked =
    typeof obj.infiniteAscensionUnlocked === 'boolean' ? obj.infiniteAscensionUnlocked : false;

  // Backwards-compatible derivation for existing accounts/saves
  if (legacyContext) {
    const bestFloor = Math.max(0, Math.floor(legacyContext.bestFloor ?? 0));
    if (bestFloor >= 1) {
      const maxChapter = Math.min(9, Math.floor((bestFloor - 1) / 10));
      for (let i = 0; i <= maxChapter; i++) {
        discoveredChapters.add(i);
        reachedBiomes.add(i);
      }
    }
    if (legacyContext.bestiaryKills) {
      for (const b of BOSSES) {
        if ((legacyContext.bestiaryKills[b.id] ?? 0) > 0) {
          discoveredBosses.add(b.id);
          defeatedBosses.add(b.id);
          const chIdx = Math.max(0, Math.min(9, Math.floor(b.floorMilestone / 10) - 1));
          unlockedRevelations.add(chIdx);
          if (b.id === 'dungeon_god') {
            infiniteAscensionUnlocked = true;
            unlockedCinematics.add('floor100_ascension');
          }
        }
      }
    }
    if (bestFloor > 100) {
      infiniteAscensionUnlocked = true;
      unlockedCinematics.add('floor100_ascension');
    }
    if (introSeen) {
      unlockedCinematics.add('intro');
    }
  } else if (introSeen) {
    unlockedCinematics.add('intro');
  }

  return {
    introSeen,
    discoveredChapters: Array.from(discoveredChapters).sort((a, b) => a - b),
    reachedBiomes: Array.from(reachedBiomes).sort((a, b) => a - b),
    collectedFragments: Array.from(collectedFragments),
    discoveredBosses: Array.from(discoveredBosses),
    defeatedBosses: Array.from(defeatedBosses),
    unlockedCinematics: Array.from(unlockedCinematics),
    unlockedRevelations: Array.from(unlockedRevelations).sort((a, b) => a - b),
    triggeredWhispers: Array.from(triggeredWhispers),
    infiniteAscensionUnlocked,
  };
}

/**
 * Union-merges two NarrativeProgress snapshots so permanent discoveries are never lost or duplicated.
 */
export function mergeNarrativeProgress(a: NarrativeProgress, b: NarrativeProgress): NarrativeProgress {
  return validateNarrativeProgress({
    introSeen: a.introSeen || b.introSeen,
    discoveredChapters: [...a.discoveredChapters, ...b.discoveredChapters],
    reachedBiomes: [...a.reachedBiomes, ...b.reachedBiomes],
    collectedFragments: [...a.collectedFragments, ...b.collectedFragments],
    discoveredBosses: [...a.discoveredBosses, ...b.discoveredBosses],
    defeatedBosses: [...a.defeatedBosses, ...b.defeatedBosses],
    unlockedCinematics: [...a.unlockedCinematics, ...b.unlockedCinematics],
    unlockedRevelations: [...a.unlockedRevelations, ...b.unlockedRevelations],
    triggeredWhispers: [...a.triggeredWhispers, ...b.triggeredWhispers],
    infiniteAscensionUnlocked: a.infiniteAscensionUnlocked || b.infiniteAscensionUnlocked,
  });
}

export interface LoreCompletionSummary {
  percent: number;
  discoveredTotal: number;
  possibleTotal: number;
  chapters: { unlocked: number; total: number };
  fragments: { unlocked: number; total: number };
  bosses: { unlocked: number; total: number };
  revelations: { unlocked: number; total: number };
  anomalies: { unlocked: number; total: number };
  cinematics: { unlocked: number; total: number };
}

export function computeLoreCompletion(save: SaveData): LoreCompletionSummary {
  const n = save.narrative;
  const chapters = { unlocked: n.discoveredChapters.length, total: CHAPTERS.length };
  const fragments = { unlocked: n.collectedFragments.length, total: MEMORY_FRAGMENTS.length };
  const bosses = { unlocked: n.defeatedBosses.length, total: BOSSES.length };
  const revelations = { unlocked: n.unlockedRevelations.length, total: CHAPTERS.length };
  const anomalies = { unlocked: save.unlockedSecretClasses.length, total: 3 };
  const cinematics = { unlocked: n.unlockedCinematics.length, total: Object.keys(CINEMATICS).length };

  const discoveredTotal =
    chapters.unlocked +
    fragments.unlocked +
    bosses.unlocked +
    revelations.unlocked +
    anomalies.unlocked +
    cinematics.unlocked;
  const possibleTotal =
    chapters.total +
    fragments.total +
    bosses.total +
    revelations.total +
    anomalies.total +
    cinematics.total;

  const percent = possibleTotal > 0 ? Math.min(100, Math.round((discoveredTotal / possibleTotal) * 100)) : 0;

  return {
    percent,
    discoveredTotal,
    possibleTotal,
    chapters,
    fragments,
    bosses,
    revelations,
    anomalies,
    cinematics,
  };
}

/**
 * Picks an uncollected Memory Fragment matching the given discovery source and current floor/boss.
 * Never returns duplicates.
 */
export function pickMemoryFragmentForEvent(params: {
  collectedIds: string[];
  source: FragmentSource;
  floor: number;
  bossId?: string;
}): MemoryFragmentDef | null {
  const collected = new Set(params.collectedIds);
  const chapterIndex = Math.floor((Math.max(1, params.floor) - 1) / 10) % CHAPTERS.length;

  // 1. Exact boss-bound fragment on boss defeat
  if (params.source === 'boss' && params.bossId) {
    const exact = MEMORY_FRAGMENTS.find((f) => f.bossId === params.bossId && !collected.has(f.id));
    if (exact) return exact;
  }

  // 2. Exact source + current chapter match
  const chapterSourceMatch = MEMORY_FRAGMENTS.find(
    (f) =>
      !collected.has(f.id) &&
      f.source === params.source &&
      f.chapterIndex === chapterIndex &&
      params.floor >= f.minFloor
  );
  if (chapterSourceMatch) return chapterSourceMatch;

  // 3. Any eligible uncollected fragment matching source & floor
  const sourceMatch = MEMORY_FRAGMENTS.find(
    (f) => !collected.has(f.id) && f.source === params.source && params.floor >= f.minFloor
  );
  if (sourceMatch) return sourceMatch;

  // 4. Exploration fallback: allow picking an uncollected exploration fragment from current/earlier chapters
  if (params.source === 'exploration' || params.source === 'chest' || params.source === 'secret_room') {
    const fallback = MEMORY_FRAGMENTS.find(
      (f) =>
        !collected.has(f.id) &&
        !f.bossId &&
        f.chapterIndex <= chapterIndex &&
        params.floor >= f.minFloor
    );
    if (fallback) return fallback;
  }

  return null;
}

/**
 * Returns the Tower Whisper definition if it hasn't been triggered yet on this account.
 */
export function evaluateTowerWhisper(
  triggeredWhispers: string[],
  triggerId: TowerWhisperDef['id']
): TowerWhisperDef | null {
  if (triggeredWhispers.includes(triggerId)) return null;
  return TOWER_WHISPERS[triggerId] ?? null;
}

/**
 * Determines whether a chapter transition banner should appear for a given floor entry.
 */
export function shouldShowChapterTransition(params: {
  floor: number;
  previousFloor: number;
  discoveredChapters: number[];
  skipRepeatedTransitions: boolean;
}): { show: boolean; chapterIndex: number; isFirstDiscovery: boolean } {
  const safeFloor = Math.max(1, Math.floor(params.floor));
  const chapterIndex = Math.floor((safeFloor - 1) / 10) % CHAPTERS.length;
  const prevChapterIndex =
    params.previousFloor > 0 ? Math.floor((params.previousFloor - 1) / 10) % CHAPTERS.length : -1;

  const isEnteringNewRegion =
    params.previousFloor <= 0 ? safeFloor === 1 : chapterIndex !== prevChapterIndex;
  if (!isEnteringNewRegion) {
    return { show: false, chapterIndex, isFirstDiscovery: false };
  }

  const isFirstDiscovery = !params.discoveredChapters.includes(chapterIndex);
  if (params.skipRepeatedTransitions && !isFirstDiscovery) {
    return { show: false, chapterIndex, isFirstDiscovery: false };
  }

  // On floor 1, avoid showing a chapter banner immediately after the intro unless the player wants chapter banners on repeat runs;
  // show on floor 1 first entry or every biome boundary (11, 21, 31, ..., 91).
  return { show: true, chapterIndex, isFirstDiscovery };
}
