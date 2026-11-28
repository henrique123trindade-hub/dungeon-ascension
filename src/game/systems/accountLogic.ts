import { matchesSecretCodeEntry, SECRET_CODES } from '../data/secretCodes';
import type { AvatarId, ClassId, PermanentUpgrades, RunRecord, SaveData } from '../types';
import { createDefaultSave, syncAchievements, validateAndMigrateSave } from './saveManager';
import { mergeNarrativeProgress } from './narrativeManager';

export interface UsernameValidationResult {
  valid: boolean;
  username: string;
  usernameLower: string;
  error?: string;
}

const RESERVED_USERNAMES = new Set([
  'admin',
  'administrator',
  'administrador',
  'root',
  'system',
  'sistema',
  'moderator',
  'moderador',
  'support',
  'suporte',
  'staff',
  'gm',
  'null',
  'undefined',
]);

export function validateUsername(raw: string): UsernameValidationResult {
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();

  if (trimmed.length < 3) {
    return {
      valid: false,
      username: trimmed,
      usernameLower: lower,
      error: 'O nome de usuário deve ter pelo menos 3 caracteres.',
    };
  }
  if (trimmed.length > 20) {
    return {
      valid: false,
      username: trimmed,
      usernameLower: lower,
      error: 'O nome de usuário deve ter no máximo 20 caracteres.',
    };
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return {
      valid: false,
      username: trimmed,
      usernameLower: lower,
      error: 'Use apenas letras, números, hífen (-) ou sublinhado (_), sem espaços.',
    };
  }
  if (RESERVED_USERNAMES.has(lower)) {
    return {
      valid: false,
      username: trimmed,
      usernameLower: lower,
      error: 'Este nome de usuário é reservado. Escolha outro.',
    };
  }

  return {
    valid: true,
    username: trimmed,
    usernameLower: lower,
  };
}

export function validateEmail(raw: string): { valid: boolean; email: string; error?: string } {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) {
    return { valid: false, email: trimmed, error: 'Informe um endereço de e-mail.' };
  }
  if (trimmed.length > 160) {
    return { valid: false, email: trimmed, error: 'Endereço de e-mail muito longo.' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) {
    return { valid: false, email: trimmed, error: 'Informe um endereço de e-mail válido.' };
  }
  return { valid: true, email: trimmed };
}

export interface PasswordStrengthResult {
  score: 0 | 1 | 2 | 3 | 4;
  label: 'Muito fraca' | 'Fraca' | 'Razoável' | 'Boa' | 'Forte';
  meetsMinimum: boolean;
  checks: {
    minLength: boolean;
    hasLower: boolean;
    hasUpper: boolean;
    hasNumber: boolean;
    hasSymbol: boolean;
  };
}

export function evaluatePasswordStrength(password: string): PasswordStrengthResult {
  const checks = {
    minLength: password.length >= 8,
    hasLower: /[a-z]/.test(password),
    hasUpper: /[A-Z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSymbol: /[^a-zA-Z0-9]/.test(password),
  };

  let rawPoints = 0;
  if (checks.minLength) rawPoints += 1;
  if (password.length >= 12) rawPoints += 1;
  if (checks.hasLower && checks.hasUpper) rawPoints += 1;
  if (checks.hasNumber) rawPoints += 1;
  if (checks.hasSymbol) rawPoints += 1;

  const score = (password.length === 0 ? 0 : Math.min(4, Math.max(1, rawPoints - (checks.minLength ? 0 : 1)))) as
    | 0
    | 1
    | 2
    | 3
    | 4;

  const labelMap: Record<0 | 1 | 2 | 3 | 4, PasswordStrengthResult['label']> = {
    0: 'Muito fraca',
    1: 'Fraca',
    2: 'Razoável',
    3: 'Boa',
    4: 'Forte',
  };

  const meetsMinimum = checks.minLength && (checks.hasLower || checks.hasUpper) && checks.hasNumber;

  return {
    score,
    label: labelMap[score],
    meetsMinimum,
    checks,
  };
}

export function suggestUsernameFromEmailOrName(displayName?: string | null, email?: string | null): string {
  const source = (displayName || email?.split('@')[0] || 'heroi').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const cleaned = source.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  const base = cleaned.length >= 3 ? cleaned.slice(0, 16) : `heroi_${cleaned || 'asc'}`;
  return base.slice(0, 20);
}

/**
 * Determines whether a guest SaveData contains real progress worth offering
 * to migrate into a newly created or linked cloud account.
 */
export function hasMeaningfulLocalProgress(save: SaveData): boolean {
  const permSum = Object.values(save.permanentUpgrades).reduce((acc, v) => acc + v, 0);
  return (
    save.totalRuns > 0 ||
    save.bestFloor > 0 ||
    save.totalKills > 0 ||
    save.totalBossKills > 0 ||
    save.ascensionLevel > 0 ||
    save.crystals > 25 ||
    save.totalCrystalsEarned > 25 ||
    save.redeemedCodes.length > 0 ||
    save.unlockedSecretClasses.length > 0 ||
    save.claimedAchievements.length > 0 ||
    save.narrative.collectedFragments.length > 0 ||
    save.narrative.discoveredChapters.length > 1 ||
    permSum > 0
  );
}

/**
 * Safely merges guest local progress into cloud progress without duplicating
 * starting crystals, achievements, secret codes, or run records.
 */
export function mergeLocalAndCloudSave(localRaw: SaveData, cloudRaw: SaveData): SaveData {
  const local = validateAndMigrateSave(localRaw);
  const cloud = validateAndMigrateSave(cloudRaw);

  const mergedUpgrades: PermanentUpgrades = {
    startingDamage: Math.max(local.permanentUpgrades.startingDamage, cloud.permanentUpgrades.startingDamage),
    startingHp: Math.max(local.permanentUpgrades.startingHp, cloud.permanentUpgrades.startingHp),
    luck: Math.max(local.permanentUpgrades.luck, cloud.permanentUpgrades.luck),
    xpGain: Math.max(local.permanentUpgrades.xpGain, cloud.permanentUpgrades.xpGain),
    goldGain: Math.max(local.permanentUpgrades.goldGain, cloud.permanentUpgrades.goldGain),
    resistance: Math.max(local.permanentUpgrades.resistance, cloud.permanentUpgrades.resistance),
    rareLootChance: Math.max(local.permanentUpgrades.rareLootChance, cloud.permanentUpgrades.rareLootChance),
  };

  const bestiaryKills: Record<string, number> = { ...cloud.bestiaryKills };
  for (const [enemyId, kills] of Object.entries(local.bestiaryKills)) {
    bestiaryKills[enemyId] = Math.max(bestiaryKills[enemyId] ?? 0, kills);
  }

  // Deduplicate redeemed codes so neither legacy codes nor opaque codeIds are duplicated
  const redeemedCodes: string[] = [...cloud.redeemedCodes];
  for (const localEntry of local.redeemedCodes) {
    const matchedDef = SECRET_CODES.find((def) => matchesSecretCodeEntry(localEntry, def));
    const alreadyPresent = matchedDef
      ? redeemedCodes.some((existing) => matchesSecretCodeEntry(existing, matchedDef))
      : redeemedCodes.includes(localEntry);
    if (!alreadyPresent) {
      redeemedCodes.push(matchedDef ? matchedDef.id : localEntry);
    }
  }

  const unlockedSecretClasses = Array.from(
    new Set([...cloud.unlockedSecretClasses, ...local.unlockedSecretClasses])
  );

  // Deduplicate run records by ID and keep top 20
  const recordMap = new Map<string, RunRecord>();
  for (const rec of [...cloud.records, ...local.records]) {
    if (!recordMap.has(rec.id)) {
      recordMap.set(rec.id, rec);
    }
  }
  const mergedRecords = Array.from(recordMap.values())
    .sort((a, b) => b.floor - a.floor || b.level - a.level)
    .slice(0, 20);

  // Non-duplicating currency merge: preserve higher balance instead of blindly adding starting gifts
  const mergedCrystals = Math.max(cloud.crystals, local.crystals);
  const mergedTotalCrystals = Math.max(cloud.totalCrystalsEarned, local.totalCrystalsEarned, mergedCrystals);

  const merged: SaveData = validateAndMigrateSave({
    ...cloud,
    saveVersion: Math.max(local.saveVersion, cloud.saveVersion) + 1,
    crystals: mergedCrystals,
    totalCrystalsEarned: mergedTotalCrystals,
    ascensionLevel: Math.max(cloud.ascensionLevel, local.ascensionLevel),
    selectedClass: unlockedSecretClasses.includes(local.selectedClass) || !['slatt', 'farid', 'baldasso'].includes(local.selectedClass)
      ? (cloud.totalRuns > local.totalRuns ? cloud.selectedClass : local.selectedClass)
      : cloud.selectedClass,
    permanentUpgrades: mergedUpgrades,
    bestFloor: Math.max(cloud.bestFloor, local.bestFloor),
    bestLevel: Math.max(cloud.bestLevel, local.bestLevel),
    totalKills: Math.max(cloud.totalKills, local.totalKills),
    totalBossKills: Math.max(cloud.totalBossKills, local.totalBossKills),
    totalRuns: Math.max(cloud.totalRuns, local.totalRuns),
    totalPlayTimeSec: Math.max(cloud.totalPlayTimeSec, local.totalPlayTimeSec),
    bestiaryKills,
    discoveredSynergies: Array.from(new Set([...cloud.discoveredSynergies, ...local.discoveredSynergies])),
    unlockedAchievements: Array.from(new Set([...cloud.unlockedAchievements, ...local.unlockedAchievements])),
    claimedAchievements: Array.from(new Set([...cloud.claimedAchievements, ...local.claimedAchievements])),
    redeemedCodes,
    unlockedSecretClasses,
    records: mergedRecords,
    settings: cloud.saveVersion >= local.saveVersion ? cloud.settings : local.settings,
    narrative: mergeNarrativeProgress(cloud.narrative, local.narrative),
  });

  return syncAchievements(merged).save;
}

/**
 * Reconciles a remote cloud save with a local cache for the SAME account,
 * ensuring an older saveVersion never overwrites newer progress.
 */
export function reconcileSameAccountSave(local: SaveData, cloud: SaveData): {
  resolved: SaveData;
  shouldPushToCloud: boolean;
} {
  if (cloud.saveVersion > local.saveVersion) {
    // Cloud is newer: adopt cloud, never regress secret class unlocks
    const preservedSecrets = Array.from(
      new Set([...cloud.unlockedSecretClasses, ...local.unlockedSecretClasses])
    );
    const preservedCodes = Array.from(new Set([...cloud.redeemedCodes, ...local.redeemedCodes]));
    const preservedNarrative = mergeNarrativeProgress(cloud.narrative, local.narrative);
    const narrativeAdvanced =
      preservedNarrative.collectedFragments.length > cloud.narrative.collectedFragments.length ||
      preservedNarrative.discoveredChapters.length > cloud.narrative.discoveredChapters.length ||
      preservedNarrative.defeatedBosses.length > cloud.narrative.defeatedBosses.length ||
      (preservedNarrative.introSeen && !cloud.narrative.introSeen);
    const needsSecretPush =
      preservedSecrets.length > cloud.unlockedSecretClasses.length ||
      preservedCodes.length > cloud.redeemedCodes.length ||
      narrativeAdvanced;
    const resolved = validateAndMigrateSave({
      ...cloud,
      unlockedSecretClasses: preservedSecrets,
      redeemedCodes: preservedCodes,
      narrative: preservedNarrative,
      saveVersion: needsSecretPush ? cloud.saveVersion + 1 : cloud.saveVersion,
    });
    return { resolved, shouldPushToCloud: needsSecretPush };
  }

  if (local.saveVersion > cloud.saveVersion) {
    // Local has unsynced offline progress: merge forward safely and push to cloud
    const resolved = mergeLocalAndCloudSave(local, cloud);
    return { resolved, shouldPushToCloud: true };
  }

  return { resolved: validateAndMigrateSave(cloud), shouldPushToCloud: false };
}

export interface PlayerAvatarOption {
  id: AvatarId;
  label: string;
  secretClassId?: ClassId;
}

export const PLAYER_AVATARS: ReadonlyArray<PlayerAvatarOption> = [
  { id: 'crest_emblem', label: 'Emblema da Masmorra' },
  { id: 'warrior', label: 'Guerreiro' },
  { id: 'assassin', label: 'Assassino' },
  { id: 'mage', label: 'Mago' },
  { id: 'necromancer', label: 'Necromante' },
  { id: 'archer', label: 'Arqueiro' },
  { id: 'slatt', label: 'Slatt', secretClassId: 'slatt' },
  { id: 'farid', label: 'Farid', secretClassId: 'farid' },
  { id: 'baldasso', label: 'Baldasso', secretClassId: 'baldasso' },
];

export interface PlayerTitleDef {
  id: string;
  label: string;
  requirement: string;
  isUnlocked: (save: SaveData) => boolean;
}

export const PLAYER_TITLES: ReadonlyArray<PlayerTitleDef> = [
  {
    id: 'novato_masmorra',
    label: 'Iniciante da Masmorra',
    requirement: 'Disponível desde o início',
    isUnlocked: () => true,
  },
  {
    id: 'cacador_sombras',
    label: 'Caçador das Sombras',
    requirement: 'Derrote 250 inimigos no total',
    isUnlocked: (s) => s.totalKills >= 250,
  },
  {
    id: 'carrasco_chefes',
    label: 'Carrasco de Chefes',
    requirement: 'Derrote 5 chefes de masmorra',
    isUnlocked: (s) => s.totalBossKills >= 5,
  },
  {
    id: 'desbravador_profundo',
    label: 'Desbravador das Profundezas',
    requirement: 'Alcance o Andar 25',
    isUnlocked: (s) => s.bestFloor >= 25,
  },
  {
    id: 'lenda_glacial',
    label: 'Lenda do Andar 50',
    requirement: 'Alcance o Andar 50',
    isUnlocked: (s) => s.bestFloor >= 50,
  },
  {
    id: 'ascendido',
    label: 'O Ascendido',
    requirement: 'Realize ao menos 1 Ascensão no Santuário',
    isUnlocked: (s) => s.ascensionLevel >= 1,
  },
  {
    id: 'mestre_sinergias',
    label: 'Mestre das Sinergias',
    requirement: 'Descubra todas as 5 sinergias secretas',
    isUnlocked: (s) => s.discoveredSynergies.length >= 5,
  },
  {
    id: 'guardiao_secreto',
    label: 'Guardião dos Segredos',
    requirement: 'Desbloqueie ao menos uma classe secreta',
    isUnlocked: (s) => s.unlockedSecretClasses.length >= 1,
  },
];

export function getUnlockedTitles(save: SaveData): PlayerTitleDef[] {
  return PLAYER_TITLES.filter((t) => t.isUnlocked(save));
}

export function getTitleLabel(titleId: string): string {
  return PLAYER_TITLES.find((t) => t.id === titleId)?.label ?? 'Iniciante da Masmorra';
}

export function computeFavoriteClass(save: SaveData): ClassId {
  if (save.records.length === 0) return save.selectedClass;
  const counts = new Map<ClassId, number>();
  for (const r of save.records) {
    counts.set(r.classId, (counts.get(r.classId) ?? 0) + 1);
  }
  let bestClass: ClassId = save.selectedClass;
  let bestCount = -1;
  for (const [cls, count] of counts.entries()) {
    if (count > bestCount) {
      bestCount = count;
      bestClass = cls;
    }
  }
  return bestClass;
}

export function formatPlayTime(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hours > 0) return `${hours}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

export function createResetSavePreservingSecrets(current: SaveData): SaveData {
  const fresh = createDefaultSave();
  return {
    ...fresh,
    saveVersion: current.saveVersion + 1,
    redeemedCodes: [...current.redeemedCodes],
    unlockedSecretClasses: [...current.unlockedSecretClasses],
    settings: { ...current.settings },
    narrative: {
      ...current.narrative,
      discoveredChapters: [...current.narrative.discoveredChapters],
      reachedBiomes: [...current.narrative.reachedBiomes],
      collectedFragments: [...current.narrative.collectedFragments],
      discoveredBosses: [...current.narrative.discoveredBosses],
      defeatedBosses: [...current.narrative.defeatedBosses],
      unlockedCinematics: [...current.narrative.unlockedCinematics],
      unlockedRevelations: [...current.narrative.unlockedRevelations],
      triggeredWhispers: [...current.narrative.triggeredWhispers],
    },
  };
}
