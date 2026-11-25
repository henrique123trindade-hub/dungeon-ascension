import type { Rarity } from '../types';

/**
 * Centralized gameplay & difficulty balance configuration for Dungeon Ascension.
 * Adjust these values to fine-tune early pressure, mid-game pacing, boss spikes,
 * healing sustain, and rarity scaling without hunting through scene logic.
 */
export const BALANCE_CONFIG = {
  player: {
    /** Base dash cooldown in seconds (before CDR) */
    dashCooldownSec: 1.65,
    /** Dash invulnerability window in seconds */
    dashInvulnSec: 0.2,
    /** Post-hit invulnerability window in seconds */
    hitInvulnSec: 0.34,
    /** Fraction of max HP restored when leveling up */
    levelUpHealPct: 0.14,
    /** Hard cap for life steal (prevents immortal face-tanking early/mid) */
    maxLifeSteal: 0.22,
    /** Hard cap for dodge chance */
    maxDodge: 0.52,
    /** Hard cap for armor damage reduction */
    maxDamageReduction: 0.68,
    /** Armor formula denominator: reduction = armor / (armor + armorSoftCap) */
    armorSoftCap: 130,
    /** Natural per-level damage scaling */
    levelDamageLinear: 0.062,
    levelDamageCurveExp: 1.24,
    levelDamageCurveCoef: 0.0095,
    /** Natural flat HP gained per level */
    levelHpPerLevel: 10,
    /** Equipment upgrade bonus per +1 forge level */
    equipUpgradeStep: 0.11,
    /** Healing potion drop chance & heal amount */
    potionDropChance: 0.055,
    potionHealPct: 0.2,
    /** Permanent sanctuary upgrade scaling */
    permDamagePerRank: 0.06,
    permHpPerRank: 0.075,
    permArmorPerRank: 4,
    permLuckPerRank: 6,
    permXpPerRank: 0.085,
    permGoldPerRank: 0.1,
  },

  xp: {
    baseXp: 68,
    linearPerLevel: 34,
    curveCoef: 9.2,
    curveExp: 1.56,
    floorClearBase: 26,
    floorClearPerFloor: 11,
  },

  /**
   * Canonical probabilities remain 50 / 25 / 15 / 7 / 2.5 / 0.5 at 0 Luck.
   * statMult separates common upgrades (modest) from high rarities (build-defining).
   */
  rarityStatMult: {
    common: 0.8,
    uncommon: 1.12,
    rare: 1.52,
    epic: 2.05,
    legendary: 2.85,
    mythic: 3.9,
  } as Record<Rarity, number>,

  /**
   * Minimum player level gates for special multiplicative cards so builds
   * don't snowball out of control on Floors 1–3.
   */
  multiplierGates: {
    utilityMinLevel: 4, // EXP x2, Gold x2
    combatMinorMinLevel: 7, // Damage x1.35, Attack Speed x1.35, Boss x1.75
    combatMajorMinLevel: 13, // Damage x1.75 (Legendary)
  },

  enemies: {
    /** Concurrent windup attack tokens (scales up with floor depth) */
    baseAttackTokens: 6,
    midFloorAttackTokens: 8,
    midFloorThreshold: 16,
    /** HP scaling formula: (base + (f-1)*linear + (f-1)^exp * curve) * (1 + block * blockStep) */
    hpBase: 1.28,
    hpLinear: 0.31,
    hpCurveExp: 1.47,
    hpCurveCoef: 0.058,
    hpBiomeBlockStep: 0.18,
    /** Damage scaling formula */
    dmgBase: 1.22,
    dmgLinear: 0.175,
    dmgCurveExp: 1.28,
    dmgCurveCoef: 0.03,
    dmgBiomeBlockStep: 0.14,
    /** Movement speed scaling */
    speedBase: 1.06,
    speedPerFloor: 0.011,
    speedBiomeBlockStep: 0.032,
    speedCap: 1.92,
    /** Resistance starts at floor 3 */
    resistanceStartFloor: 3,
    resistancePerFloor: 0.0052,
    resistanceCap: 0.48,
    /** Elite probability escalation */
    eliteBaseChance: 0.1,
    elitePerFloor: 0.012,
    elitePerBiomeBlock: 0.045,
    eliteCap: 0.46,
    /** Reinforcement wave telegraph warning duration (seconds) */
    waveTelegraphSec: 0.8,
  },

  bosses: {
    baseHpAnchor: 145,
    baseDamageAnchor: 20,
    baseResistanceBonus: 0.14,
    phase2SpeedBoost: 0.24,
    phase3SpeedBoost: 0.44,
    /** Enraged cooldown reduction per phase */
    phaseCooldownStep: 0.28,
    /** Boss minion summon cap */
    maxBossAdds: 4,
  },

  skills: {
    /** Per-level power scaling for skills (Lv 1 stays balanced, Lv 4/7 evolutions shine) */
    perLevelScaling: 0.2,
    /** Regeneration passive: % maxHP/sec base + per level */
    regenBasePct: 0.0075,
    regenPerLevelPct: 0.0035,
    /** Divine Shield passive: % maxHP cap base + per level */
    shieldBasePct: 0.14,
    shieldPerLevelPct: 0.03,
    /** Life Drain passive: fraction of damage converted to HP */
    lifeDrainHealRatio: 0.11,
  },
} as const;
