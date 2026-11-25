import { ACHIEVEMENTS, getPermanentUpgradeCost, PERMANENT_UPGRADES } from '../data/achievements';
import { SKILLS } from '../data/skills';
import type {
  CastMode,
  ClassId,
  PermanentUpgrades,
  RunRecord,
  SaveData,
  SettingsData,
  SkillId,
  SynergyId,
} from '../types';

export const SAVE_STORAGE_KEY = 'dungeon_ascension_save_v1';
export const SAVE_VERSION = 1;

export function createDefaultSettings(): SettingsData {
  return {
    masterVolume: 0.7,
    sfxVolume: 0.85,
    muted: false,
    graphicsQuality: 'high',
    screenShake: true,
    damageNumbers: true,
    mobileControls: 'auto',
    autoAttack: true,
    showAttackRange: true,
    defaultCastMode: 'quick_indicator',
    dashCastMode: 'quick_indicator',
    skillCastModes: {},
  };
}

export function createDefaultPermanentUpgrades(): PermanentUpgrades {
  return {
    startingDamage: 0,
    startingHp: 0,
    luck: 0,
    xpGain: 0,
    goldGain: 0,
    resistance: 0,
    rareLootChance: 0,
  };
}

export function createDefaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    crystals: 25, // Small starting gift so player can explore Sanctuary quickly
    totalCrystalsEarned: 25,
    ascensionLevel: 0,
    selectedClass: 'warrior',
    permanentUpgrades: createDefaultPermanentUpgrades(),
    bestFloor: 0,
    bestLevel: 1,
    totalKills: 0,
    totalBossKills: 0,
    totalRuns: 0,
    bestiaryKills: {},
    discoveredSynergies: [],
    unlockedAchievements: [],
    claimedAchievements: [],
    records: [],
    settings: createDefaultSettings(),
  };
}

const VALID_CLASSES: ClassId[] = ['warrior', 'assassin', 'mage', 'necromancer', 'archer'];

export function validateAndMigrateSave(raw: unknown): SaveData {
  const def = createDefaultSave();
  if (!raw || typeof raw !== 'object') return def;
  const obj = raw as Record<string, unknown>;

  const num = (v: unknown, fallback: number, min = 0) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.max(min, v) : fallback;

  const permRaw = (obj.permanentUpgrades && typeof obj.permanentUpgrades === 'object'
    ? obj.permanentUpgrades
    : {}) as Record<string, unknown>;

  const permanentUpgrades: PermanentUpgrades = {
    startingDamage: Math.min(25, Math.floor(num(permRaw.startingDamage, 0))),
    startingHp: Math.min(25, Math.floor(num(permRaw.startingHp, 0))),
    luck: Math.min(20, Math.floor(num(permRaw.luck, 0))),
    xpGain: Math.min(20, Math.floor(num(permRaw.xpGain, 0))),
    goldGain: Math.min(20, Math.floor(num(permRaw.goldGain, 0))),
    resistance: Math.min(20, Math.floor(num(permRaw.resistance, 0))),
    rareLootChance: Math.min(15, Math.floor(num(permRaw.rareLootChance, 0))),
  };

  const setRaw = (obj.settings && typeof obj.settings === 'object'
    ? obj.settings
    : {}) as Record<string, unknown>;
  const isCastMode = (v: unknown): v is CastMode =>
    v === 'normal' || v === 'quick' || v === 'quick_indicator';

  const skillCastModes: Partial<Record<SkillId, CastMode>> = {};
  if (setRaw.skillCastModes && typeof setRaw.skillCastModes === 'object') {
    for (const [k, v] of Object.entries(setRaw.skillCastModes as Record<string, unknown>)) {
      if (k in SKILLS && isCastMode(v)) {
        skillCastModes[k as SkillId] = v;
      }
    }
  }

  const settings: SettingsData = {
    masterVolume: Math.min(1, num(setRaw.masterVolume, 0.7)),
    sfxVolume: Math.min(1, num(setRaw.sfxVolume, 0.85)),
    muted: typeof setRaw.muted === 'boolean' ? setRaw.muted : false,
    graphicsQuality:
      setRaw.graphicsQuality === 'low' || setRaw.graphicsQuality === 'medium' || setRaw.graphicsQuality === 'high'
        ? setRaw.graphicsQuality
        : 'high',
    screenShake: typeof setRaw.screenShake === 'boolean' ? setRaw.screenShake : true,
    damageNumbers: typeof setRaw.damageNumbers === 'boolean' ? setRaw.damageNumbers : true,
    mobileControls:
      setRaw.mobileControls === 'on' || setRaw.mobileControls === 'off' || setRaw.mobileControls === 'auto'
        ? setRaw.mobileControls
        : 'auto',
    autoAttack: typeof setRaw.autoAttack === 'boolean' ? setRaw.autoAttack : true,
    showAttackRange: typeof setRaw.showAttackRange === 'boolean' ? setRaw.showAttackRange : true,
    defaultCastMode: isCastMode(setRaw.defaultCastMode) ? setRaw.defaultCastMode : 'quick_indicator',
    dashCastMode: isCastMode(setRaw.dashCastMode) ? setRaw.dashCastMode : 'quick_indicator',
    skillCastModes,
  };

  const selectedClass = VALID_CLASSES.includes(obj.selectedClass as ClassId)
    ? (obj.selectedClass as ClassId)
    : 'warrior';

  const bestiaryKills: Record<string, number> = {};
  if (obj.bestiaryKills && typeof obj.bestiaryKills === 'object') {
    for (const [k, v] of Object.entries(obj.bestiaryKills as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
        bestiaryKills[k] = Math.floor(v);
      }
    }
  }

  const discoveredSynergies = Array.isArray(obj.discoveredSynergies)
    ? (obj.discoveredSynergies.filter((s) => typeof s === 'string') as SynergyId[])
    : [];

  const unlockedAchievements = Array.isArray(obj.unlockedAchievements)
    ? obj.unlockedAchievements.filter((s): s is string => typeof s === 'string')
    : [];

  const claimedAchievements = Array.isArray(obj.claimedAchievements)
    ? obj.claimedAchievements.filter((s): s is string => typeof s === 'string')
    : [];

  const records = Array.isArray(obj.records)
    ? (obj.records.filter((r) => r && typeof r === 'object') as RunRecord[]).slice(0, 20)
    : [];

  return {
    version: SAVE_VERSION,
    crystals: Math.floor(num(obj.crystals, def.crystals)),
    totalCrystalsEarned: Math.floor(num(obj.totalCrystalsEarned, def.totalCrystalsEarned)),
    ascensionLevel: Math.floor(num(obj.ascensionLevel, 0)),
    selectedClass,
    permanentUpgrades,
    bestFloor: Math.floor(num(obj.bestFloor, 0)),
    bestLevel: Math.floor(num(obj.bestLevel, 1, 1)),
    totalKills: Math.floor(num(obj.totalKills, 0)),
    totalBossKills: Math.floor(num(obj.totalBossKills, 0)),
    totalRuns: Math.floor(num(obj.totalRuns, 0)),
    bestiaryKills,
    discoveredSynergies: Array.from(new Set(discoveredSynergies)),
    unlockedAchievements: Array.from(new Set(unlockedAchievements)),
    claimedAchievements: Array.from(new Set(claimedAchievements)),
    records,
    settings,
  };
}

export function loadSaveData(): SaveData {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return createDefaultSave();
    const raw = window.localStorage.getItem(SAVE_STORAGE_KEY);
    if (!raw) return createDefaultSave();
    return validateAndMigrateSave(JSON.parse(raw));
  } catch {
    return createDefaultSave();
  }
}

export function persistSaveData(save: SaveData): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(save));
  } catch {
    // Ignore quota errors gracefully
  }
}

export function syncAchievements(save: SaveData): { save: SaveData; newlyUnlocked: string[] } {
  const unlocked = new Set(save.unlockedAchievements);
  const newlyUnlocked: string[] = [];
  for (const ach of ACHIEVEMENTS) {
    if (!unlocked.has(ach.id) && ach.check(save).done) {
      unlocked.add(ach.id);
      newlyUnlocked.push(ach.id);
    }
  }
  if (newlyUnlocked.length === 0) return { save, newlyUnlocked };
  return {
    save: { ...save, unlockedAchievements: Array.from(unlocked) },
    newlyUnlocked,
  };
}

export function purchasePermanentUpgrade(save: SaveData, key: keyof PermanentUpgrades): SaveData | null {
  const def = PERMANENT_UPGRADES.find((u) => u.key === key);
  if (!def) return null;
  const curLv = save.permanentUpgrades[key];
  if (curLv >= def.maxLevel) return null;
  const cost = getPermanentUpgradeCost(def, curLv);
  if (save.crystals < cost) return null;

  return {
    ...save,
    crystals: save.crystals - cost,
    permanentUpgrades: {
      ...save.permanentUpgrades,
      [key]: curLv + 1,
    },
  };
}

export function getAscensionRequirementFloor(ascensionLevel: number): number {
  return 20 + ascensionLevel * 15;
}

export function canPerformAscension(save: SaveData): boolean {
  return save.bestFloor >= getAscensionRequirementFloor(save.ascensionLevel);
}

export function performAscension(save: SaveData): SaveData | null {
  if (!canPerformAscension(save)) return null;
  const bonusCrystals = 120 + save.ascensionLevel * 80;
  const next: SaveData = {
    ...save,
    ascensionLevel: save.ascensionLevel + 1,
    crystals: save.crystals + bonusCrystals,
    totalCrystalsEarned: save.totalCrystalsEarned + bonusCrystals,
    permanentUpgrades: createDefaultPermanentUpgrades(),
  };
  return syncAchievements(next).save;
}
