import { BALANCE_CONFIG } from '../data/balanceConfig';
import { CLASSES, getClassEvolution } from '../data/classes';
import { getInfiniteModifierForFloor } from '../data/biomes';
import { getSkillEvolutionTier, SKILL_LIST, SKILLS, SYNERGIES } from '../data/skills';
import type {
  BiomeDecorProp,
  BiomeEnvZone,
  BiomeEnvZoneKind,
  ClassId,
  ComputedPlayerStats,
  EquipmentItem,
  EquipmentSlot,
  EquipmentStats,
  PermanentUpgrades,
  Rarity,
  SkillId,
  StatModifiers,
  SynergyId,
  UpgradeOption,
} from '../types';

export const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

export const COMBO_WINDOW_SEC = 2.8;
export const COMBO_MIN_HITS = 3;

export function computeComboMultiplier(hits: number): number {
  if (hits < COMBO_MIN_HITS) return 1;
  if (hits < 6) return 1.1;
  if (hits < 10) return 1.25;
  if (hits < 15) return 1.5;
  if (hits < 25) return 1.75;
  return 2.0;
}

export const RARITY_META: Record<
  Rarity,
  {
    label: string;
    color: string;
    border: string;
    bg: string;
    baseWeight: number;
    statMult: number;
  }
> = {
  common: {
    label: 'Comum',
    color: '#cbd5e1',
    border: 'rgba(148, 163, 184, 0.35)',
    bg: 'rgba(30, 32, 42, 0.92)',
    baseWeight: 50,
    statMult: BALANCE_CONFIG.rarityStatMult.common,
  },
  uncommon: {
    label: 'Incomum',
    color: '#4ade80',
    border: 'rgba(74, 222, 128, 0.45)',
    bg: 'rgba(18, 36, 28, 0.94)',
    baseWeight: 25,
    statMult: BALANCE_CONFIG.rarityStatMult.uncommon,
  },
  rare: {
    label: 'Raro',
    color: '#38bdf8',
    border: 'rgba(56, 189, 248, 0.55)',
    bg: 'rgba(16, 30, 46, 0.95)',
    baseWeight: 15,
    statMult: BALANCE_CONFIG.rarityStatMult.rare,
  },
  epic: {
    label: 'Épico',
    color: '#c084fc',
    border: 'rgba(192, 132, 252, 0.65)',
    bg: 'rgba(34, 18, 48, 0.96)',
    baseWeight: 7,
    statMult: BALANCE_CONFIG.rarityStatMult.epic,
  },
  legendary: {
    label: 'Lendário',
    color: '#f59e0b',
    border: 'rgba(245, 158, 11, 0.8)',
    bg: 'rgba(44, 28, 12, 0.97)',
    baseWeight: 2.5,
    statMult: BALANCE_CONFIG.rarityStatMult.legendary,
  },
  mythic: {
    label: 'Mítico',
    color: '#f43f5e',
    border: 'rgba(244, 63, 94, 0.9)',
    bg: 'rgba(48, 12, 26, 0.98)',
    baseWeight: 0.5,
    statMult: BALANCE_CONFIG.rarityStatMult.mythic,
  },
};

export function createEmptyModifiers(): StatModifiers {
  return {
    damagePct: 0,
    attackSpeedPct: 0,
    critChance: 0,
    critDamage: 0,
    moveSpeedPct: 0,
    maxHpPct: 0,
    lifeSteal: 0,
    dodge: 0,
    xpGainPct: 0,
    goldGainPct: 0,
    rangePct: 0,
    cooldownReduction: 0,
    extraProjectiles: 0,
    piercing: 0,
    armorFlat: 0,
    luck: 0,
    damageMult: 1,
    attackSpeedMult: 1,
    xpMult: 1,
    goldMult: 1,
    bossDamageMult: 1,
  };
}

/**
 * Exact base rarity probabilities (50%, 25%, 15%, 7%, 2.5%, 0.5%) shifted smoothly by luck.
 * At luck === 0, returns the exact canonical percentages.
 */
export function getRarityWeights(luck: number): Record<Rarity, number> {
  const safeLuck = Math.max(0, luck);
  // Each 100 luck boosts higher rarities meaningfully without collapsing lower tiers instantly
  const l = safeLuck / 100;
  const raw: Record<Rarity, number> = {
    common: Math.max(12, 50 * Math.pow(0.76, l)),
    uncommon: 25 * Math.pow(0.92, l),
    rare: 15 * (1 + l * 0.45),
    epic: 7 * (1 + l * 0.85),
    legendary: 2.5 * (1 + l * 1.35),
    mythic: 0.5 * (1 + l * 2.0),
  };
  const total = Object.values(raw).reduce((a, b) => a + b, 0);
  const normalized = {} as Record<Rarity, number>;
  for (const r of RARITY_ORDER) {
    normalized[r] = (raw[r] / total) * 100;
  }
  return normalized;
}

export function rollRarity(luck: number, minRarity?: Rarity, rng: () => number = Math.random): Rarity {
  const weights = getRarityWeights(luck);
  const minIdx = minRarity ? RARITY_ORDER.indexOf(minRarity) : 0;
  const eligible = RARITY_ORDER.slice(minIdx);
  const total = eligible.reduce((sum, r) => sum + weights[r], 0);
  let cursor = rng() * total;
  for (const r of eligible) {
    cursor -= weights[r];
    if (cursor <= 0) return r;
  }
  return eligible[eligible.length - 1];
}

/**
 * Smooth escalating XP curve that demands real combat effort on early floors
 * while supporting level 100+ endgame scaling.
 */
export function xpForLevel(level: number): number {
  const lv = Math.max(1, Math.floor(level));
  const c = BALANCE_CONFIG.xp;
  return Math.round(c.baseXp + c.linearPerLevel * (lv - 1) + c.curveCoef * Math.pow(lv - 1, c.curveExp));
}

export interface FloorWavePlan {
  waves: Array<{
    count: number;
    eliteChanceBonus: number;
    guaranteedElites: number;
    rangedRatio: number;
    label: string;
  }>;
  totalEnemies: number;
}

export function getFloorEnemyCount(floor: number, isBoss: boolean): number {
  if (isBoss) return 1;
  const f = Math.max(1, floor);
  const block = Math.floor((f - 1) / 10);
  return Math.min(44, Math.round(9 + (f - 1) * 1.15 + block * 2.5));
}

/**
 * Splits every standard floor into escalating waves:
 * - Opening skirmish (lighter pressure so the player reads the room)
 * - Escalation / Ambush wave (ranged + flankers + higher elite chance)
 * - Climax Vanguard wave on Floor 4+ (guaranteed elite champion to cap the floor)
 */
export function getFloorWavePlan(floor: number, isBoss: boolean): FloorWavePlan {
  if (isBoss) {
    return {
      waves: [{ count: 1, eliteChanceBonus: 0, guaranteedElites: 0, rangedRatio: 0, label: 'Chefe' }],
      totalEnemies: 1,
    };
  }
  const f = Math.max(1, floor);
  const total = getFloorEnemyCount(f, false);
  const block = Math.floor((f - 1) / 10);

  if (f <= 3) {
    const w1 = Math.max(4, Math.round(total * 0.52));
    const w2 = Math.max(4, total - w1);
    return {
      waves: [
        { count: w1, eliteChanceBonus: 0, guaranteedElites: 0, rangedRatio: 0.25, label: 'Vanguarda' },
        {
          count: w2,
          eliteChanceBonus: 0.14,
          guaranteedElites: f >= 2 ? 1 : 0,
          rangedRatio: 0.36,
          label: 'Emboscada Final',
        },
      ],
      totalEnemies: w1 + w2,
    };
  }

  const w1 = Math.max(5, Math.round(total * 0.34));
  const w2 = Math.max(5, Math.round(total * 0.34));
  const w3 = Math.max(5, total - w1 - w2);
  const finalElites = Math.min(3, 1 + Math.floor(block / 2) + (f % 10 >= 7 ? 1 : 0));

  return {
    waves: [
      { count: w1, eliteChanceBonus: 0, guaranteedElites: 0, rangedRatio: 0.28, label: 'Exploração' },
      {
        count: w2,
        eliteChanceBonus: 0.1,
        guaranteedElites: f >= 7 ? 1 : 0,
        rangedRatio: 0.36,
        label: 'Pressão Crescente',
      },
      {
        count: w3,
        eliteChanceBonus: 0.2,
        guaranteedElites: finalElites,
        rangedRatio: 0.4,
        label: 'Assalto Final',
      },
    ],
    totalEnemies: w1 + w2 + w3,
  };
}

export function getEliteChance(floor: number, hasChaosSeal = false): number {
  const f = Math.max(1, floor);
  const block = Math.floor((f - 1) / 10);
  const e = BALANCE_CONFIG.enemies;
  return Math.min(
    e.eliteCap,
    e.eliteBaseChance + (f - 1) * e.elitePerFloor + block * e.elitePerBiomeBlock + (hasChaosSeal ? 0.14 : 0)
  );
}

export function getEnemyScaling(floor: number, ascensionLevel: number) {
  const f = Math.max(1, floor);
  const asc = Math.max(0, ascensionLevel);
  const block = Math.floor((f - 1) / 10);
  const mod = getInfiniteModifierForFloor(f);
  const e = BALANCE_CONFIG.enemies;
  const post100Boost = f > 100 ? Math.pow(1.036, f - 100) : 1;

  const hpScale =
    (e.hpBase + (f - 1) * e.hpLinear + Math.pow(f - 1, e.hpCurveExp) * e.hpCurveCoef) *
    (1 + block * e.hpBiomeBlockStep) *
    post100Boost *
    (1 + asc * 0.26) *
    (mod ? mod.enemyHpMult : 1);

  const damageScale =
    (e.dmgBase + (f - 1) * e.dmgLinear + Math.pow(f - 1, e.dmgCurveExp) * e.dmgCurveCoef) *
    (1 + block * e.dmgBiomeBlockStep) *
    (f > 100 ? Math.pow(1.024, f - 100) : 1) *
    (1 + asc * 0.18) *
    (mod ? mod.enemyDamageMult : 1);

  const speedScale = Math.min(
    e.speedCap,
    (e.speedBase + (f - 1) * e.speedPerFloor + block * e.speedBiomeBlockStep) * (mod ? mod.enemySpeedMult : 1)
  );
  const resistance = Math.min(
    e.resistanceCap,
    Math.max(0, (f - e.resistanceStartFloor) * e.resistancePerFloor)
  );
  const rewardScale = (1 + (f - 1) * 0.17 + block * 0.08) * (1 + asc * 0.4) * (mod ? mod.rewardMult : 1);

  return {
    hpScale,
    damageScale,
    speedScale,
    resistance,
    rewardScale,
  };
}

export function getAscensionMultiplier(ascensionLevel: number) {
  const asc = Math.max(0, ascensionLevel);
  return {
    powerMult: 1 + asc * 0.5,
    crystalXpMult: 1 + asc * 0.4,
    luckBonus: asc * 22,
  };
}

/**
 * Balanced low-HP damage scaling for Baldasso's "Sangue Colorado" passive.
 * Smoothly scales as hpRatio drops from 100% down to 15%, strictly capped for balance.
 */
export function computeSangueColoradoBonus(hpRatio: number, level: number): {
  damagePct: number;
  critBonus: number;
} {
  if (level <= 0) return { damagePct: 0, critBonus: 0 };
  const clampedRatio = Math.max(0.15, Math.min(1, Number.isFinite(hpRatio) ? hpRatio : 1));
  const missingFraction = (1 - clampedRatio) / 0.85; // 0 at full HP -> 1 at <=15% HP
  const maxBonus = Math.min(0.55, 0.32 + (level - 1) * 0.035);
  const damagePct = Number((missingFraction * maxBonus).toFixed(3));
  const critBonus = level >= 7 && clampedRatio <= 0.5 ? 0.08 : 0;
  return { damagePct, critBonus };
}

export function computePlayerStats(params: {
  classId: ClassId;
  level: number;
  mods: StatModifiers;
  equipped: Partial<Record<EquipmentSlot, EquipmentItem>>;
  permanent: PermanentUpgrades;
  ascensionLevel: number;
  activeSynergies: SynergyId[];
  skills: Partial<Record<SkillId, number>>;
  furyActive?: boolean;
  primateFuryActive?: boolean;
  immortalSpiritActive?: boolean;
  muralhaColoradaActive?: boolean;
  furiaBeiraRioActive?: boolean;
  hpRatio?: number;
}): ComputedPlayerStats {
  const cls = CLASSES[params.classId];
  const base = cls.baseStats;
  const lv = Math.max(1, params.level);
  const evo = getClassEvolution(params.classId, lv);
  const asc = getAscensionMultiplier(params.ascensionLevel);

  // Sum equipment contributions
  let eqDamageFlat = 0;
  let eqDamagePct = 0;
  let eqHpFlat = 0;
  let eqArmor = 0;
  let eqAttackSpeedPct = 0;
  let eqCritChance = 0;
  let eqCritDamage = 0;
  let eqMoveSpeedPct = 0;
  let eqLifeSteal = 0;
  let eqDodge = 0;
  let eqLuck = 0;
  let eqCdr = 0;
  let eqXpPct = 0;

  for (const item of Object.values(params.equipped)) {
    if (!item) continue;
    const upgMult = 1 + item.upgradeLevel * BALANCE_CONFIG.player.equipUpgradeStep;
    const s = item.stats;
    if (s.damage) eqDamageFlat += s.damage * upgMult;
    if (s.damagePct) eqDamagePct += s.damagePct * upgMult;
    if (s.maxHp) eqHpFlat += s.maxHp * upgMult;
    if (s.armor) eqArmor += s.armor * upgMult;
    if (s.attackSpeedPct) eqAttackSpeedPct += s.attackSpeedPct * upgMult;
    if (s.critChance) eqCritChance += s.critChance;
    if (s.critDamage) eqCritDamage += s.critDamage;
    if (s.moveSpeedPct) eqMoveSpeedPct += s.moveSpeedPct;
    if (s.lifeSteal) eqLifeSteal += s.lifeSteal;
    if (s.dodge) eqDodge += s.dodge;
    if (s.luck) eqLuck += s.luck * upgMult;
    if (s.cooldownReduction) eqCdr += s.cooldownReduction;
    if (s.xpGainPct) eqXpPct += s.xpGainPct;
  }

  const pb = BALANCE_CONFIG.player;
  // Natural level scaling so Lv 1 -> Lv 100 feels transcendent without trivializing Floors 1-10
  const levelDamageScale =
    1 + (lv - 1) * pb.levelDamageLinear + Math.pow(Math.max(0, lv - 1), pb.levelDamageCurveExp) * pb.levelDamageCurveCoef;
  const levelHpFlat = (lv - 1) * pb.levelHpPerLevel;

  const permDamagePct = params.permanent.startingDamage * pb.permDamagePerRank;
  const permHpPct = params.permanent.startingHp * pb.permHpPerRank;
  const permArmor = params.permanent.resistance * pb.permArmorPerRank;
  const permLuck = params.permanent.luck * pb.permLuckPerRank;
  const permXpPct = params.permanent.xpGain * pb.permXpPerRank;
  const permGoldPct = params.permanent.goldGain * pb.permGoldPerRank;

  const evoDamageMult = evo ? evo.damageMult : 1;
  const evoHpMult = evo ? evo.hpMult : 1;
  const evoSpeedBonus = evo ? evo.speedBonus : 0;
  const evoCritBonus = evo ? evo.critChanceBonus : 0;
  const evoAspdBonus = evo ? evo.attackSpeedBonus : 0;

  const vampiricBonus = params.activeSynergies.includes('vampiric_aura') ? 0.05 : 0;
  const lifeDrainLv = params.skills.life_drain ?? 0;
  const lifeDrainPassive = lifeDrainLv >= 4 ? 0.03 : 0;

  const furyLv = params.skills.demonic_fury ?? 0;
  const furyDamageMult = params.furyActive ? (furyLv >= 7 ? 1.85 : furyLv >= 4 ? 1.55 : 1.35) : 1;
  const furyAspdBonus = params.furyActive ? (furyLv >= 7 ? 0.6 : furyLv >= 4 ? 0.42 : 0.28) : 0;
  const furyCritBonus = params.furyActive && furyLv >= 4 ? 0.12 : 0;

  const primateLv = params.skills.primate_fury ?? 0;
  const primateAspdBonus = params.primateFuryActive ? (primateLv >= 7 ? 0.75 : primateLv >= 4 ? 0.55 : 0.38) : 0;
  const primateMoveBonus = params.primateFuryActive ? (primateLv >= 7 ? 0.44 : primateLv >= 4 ? 0.34 : 0.24) : 0;
  const primateCritBonus = params.primateFuryActive && primateLv >= 7 ? 0.1 : 0;

  // Farid Passive: Espírito Imortal (<25% HP temporary surge of damage & resistance)
  const espLv = params.skills.espirito_imortal ?? 0;
  const immortalSpiritDamageMult = params.immortalSpiritActive
    ? espLv >= 7
      ? 1.5
      : espLv >= 4
        ? 1.38
        : 1.28
    : 1;
  const immortalSpiritDrBonus = params.immortalSpiritActive
    ? espLv >= 7
      ? 0.4
      : espLv >= 4
        ? 0.32
        : 0.24
    : 0;

  // Baldasso Active: Muralha Colorada (red damage reduction barrier)
  const muralhaLv = params.skills.muralha_colorada ?? 0;
  const muralhaDrBonus = params.muralhaColoradaActive
    ? muralhaLv >= 7
      ? 0.56
      : muralhaLv >= 4
        ? 0.46
        : 0.36
    : 0;

  // Baldasso Active: Fúria do Beira-Rio (damage + attack speed buff)
  const beiraLv = params.skills.furia_beira_rio ?? 0;
  const beiraDamageMult = params.furiaBeiraRioActive
    ? beiraLv >= 7
      ? 1.68
      : beiraLv >= 4
        ? 1.48
        : 1.3
    : 1;
  const beiraAspdBonus = params.furiaBeiraRioActive
    ? beiraLv >= 7
      ? 0.65
      : beiraLv >= 4
        ? 0.48
        : 0.32
    : 0;
  const beiraCritBonus = params.furiaBeiraRioActive && beiraLv >= 7 ? 0.12 : 0;

  // Baldasso Passive: Sangue Colorado (capped low-HP damage scaling)
  const sangueLv = params.skills.sangue_colorado ?? 0;
  const sangueBonus = computeSangueColoradoBonus(params.hpRatio ?? 1, sangueLv);

  const maxHp = Math.max(
    40,
    Math.round(
      (base.maxHp + levelHpFlat + eqHpFlat) *
        (1 + params.mods.maxHpPct + permHpPct) *
        evoHpMult *
        (1 + params.ascensionLevel * 0.25)
    )
  );

  const damage = Math.max(
    5,
    Math.round(
      (base.damage + eqDamageFlat) *
        levelDamageScale *
        (1 + params.mods.damagePct + eqDamagePct + permDamagePct + sangueBonus.damagePct) *
        params.mods.damageMult *
        evoDamageMult *
        asc.powerMult *
        furyDamageMult *
        immortalSpiritDamageMult *
        beiraDamageMult
    )
  );

  const attackSpeed = Math.min(
    8.5,
    base.attackSpeed *
      (1 +
        params.mods.attackSpeedPct +
        eqAttackSpeedPct +
        evoAspdBonus +
        furyAspdBonus +
        primateAspdBonus +
        beiraAspdBonus) *
      params.mods.attackSpeedMult
  );

  const moveSpeed = Math.min(
    480,
    (base.moveSpeed + evoSpeedBonus) * (1 + params.mods.moveSpeedPct + eqMoveSpeedPct + primateMoveBonus)
  );

  const critChance = Math.min(
    0.92,
    base.critChance +
      params.mods.critChance +
      eqCritChance +
      evoCritBonus +
      furyCritBonus +
      primateCritBonus +
      beiraCritBonus +
      sangueBonus.critBonus
  );

  const critDamage = base.critDamage + params.mods.critDamage + eqCritDamage;
  const armor = Math.round(base.armor + params.mods.armorFlat + eqArmor + permArmor);
  const armorDr = Math.min(pb.maxDamageReduction, armor / (armor + pb.armorSoftCap));
  const combinedDr = 1 - (1 - armorDr) * (1 - immortalSpiritDrBonus) * (1 - muralhaDrBonus);
  const damageReduction = Math.min(0.84, combinedDr);
  const dodge = Math.min(pb.maxDodge, base.dodge + params.mods.dodge + eqDodge);
  const lifeSteal = Math.min(pb.maxLifeSteal, params.mods.lifeSteal + eqLifeSteal + vampiricBonus + lifeDrainPassive);
  const range = Math.round(base.range * (1 + params.mods.rangePct));
  const cooldownReduction = Math.min(0.55, params.mods.cooldownReduction + eqCdr);
  const projectiles = Math.min(10, base.projectiles + params.mods.extraProjectiles);
  const piercing = params.mods.piercing;
  const luck = Math.round(params.mods.luck + eqLuck + permLuck + asc.luckBonus);
  const xpMultiplier = (1 + params.mods.xpGainPct + eqXpPct + permXpPct) * params.mods.xpMult * asc.crystalXpMult;
  const goldMultiplier = (1 + params.mods.goldGainPct + permGoldPct) * params.mods.goldMult;

  return {
    maxHp,
    damage,
    attackSpeed,
    moveSpeed,
    critChance,
    critDamage,
    armor,
    damageReduction,
    dodge,
    lifeSteal,
    range,
    cooldownReduction,
    projectiles,
    piercing,
    luck,
    xpMultiplier,
    goldMultiplier,
    bossDamageMult: params.mods.bossDamageMult,
    damageMult: params.mods.damageMult,
    attackSpeedMult: params.mods.attackSpeedMult,
  };
}

export function calculateAttackDamage(
  rawDamage: number,
  stats: Pick<ComputedPlayerStats, 'critChance' | 'critDamage' | 'bossDamageMult'>,
  targetIsBoss: boolean,
  targetResistance: number,
  bonusCritChance = 0,
  rng: () => number = Math.random
): { damage: number; isCrit: boolean } {
  const isCrit = rng() < Math.min(0.98, stats.critChance + bonusCritChance);
  let dmg = rawDamage;
  if (isCrit) dmg *= stats.critDamage;
  if (targetIsBoss) dmg *= stats.bossDamageMult;
  dmg *= 1 - Math.min(0.65, Math.max(0, targetResistance));
  return { damage: Math.max(1, Math.round(dmg)), isCrit };
}

interface StatUpgradeTemplate {
  key: string;
  title: string;
  unit: string;
  baseValue: number;
  apply: (scaled: number) => { delta: Partial<StatModifiers>; desc: string };
}

const STAT_TEMPLATES: StatUpgradeTemplate[] = [
  {
    key: 'dmg',
    title: 'Lâmina Afiada',
    unit: '%',
    baseValue: 10,
    apply: (v) => ({
      delta: { damagePct: v / 100 },
      desc: `+${Math.round(v)}% de dano em todos os ataques e habilidades.`,
    }),
  },
  {
    key: 'aspd',
    title: 'Cadência Frenética',
    unit: '%',
    baseValue: 12,
    apply: (v) => ({
      delta: { attackSpeedPct: v / 100 },
      desc: `+${Math.round(v)}% de velocidade de ataque.`,
    }),
  },
  {
    key: 'crit',
    title: 'Golpe Preciso',
    unit: '%',
    baseValue: 6,
    apply: (v) => ({
      delta: { critChance: Math.min(0.24, v / 100) },
      desc: `+${Math.min(24, Math.round(v))}% de chance de acerto crítico.`,
    }),
  },
  {
    key: 'critDmg',
    title: 'Execução Brutal',
    unit: '%',
    baseValue: 16,
    apply: (v) => ({
      delta: { critDamage: v / 100 },
      desc: `+${Math.round(v)}% de dano crítico.`,
    }),
  },
  {
    key: 'mspd',
    title: 'Passos das Sombras',
    unit: '%',
    baseValue: 10,
    apply: (v) => ({
      delta: { moveSpeedPct: Math.min(0.28, v / 100) },
      desc: `+${Math.min(28, Math.round(v))}% de velocidade de movimento.`,
    }),
  },
  {
    key: 'hp',
    title: 'Sangue Titânico',
    unit: '%',
    baseValue: 14,
    apply: (v) => ({
      delta: { maxHpPct: v / 100 },
      desc: `+${Math.round(v)}% de vida máxima e leve cura imediata.`,
    }),
  },
  {
    key: 'lifesteal',
    title: 'Sede Carmesim',
    unit: '%',
    baseValue: 2.5,
    apply: (v) => {
      const capped = Math.min(8, Math.max(2, Math.round(v)));
      return {
        delta: { lifeSteal: capped / 100 },
        desc: `+${capped}% de roubo de vida ao causar dano.`,
      };
    },
  },
  {
    key: 'dodge',
    title: 'Reflexo Espectral',
    unit: '%',
    baseValue: 5,
    apply: (v) => ({
      delta: { dodge: Math.min(0.16, v / 100) },
      desc: `+${Math.min(16, Math.round(v))}% de chance de esquiva.`,
    }),
  },
  {
    key: 'xp',
    title: 'Mente Iluminada',
    unit: '%',
    baseValue: 18,
    apply: (v) => ({
      delta: { xpGainPct: v / 100 },
      desc: `+${Math.round(v)}% de experiência adquirida.`,
    }),
  },
  {
    key: 'range',
    title: 'Alcance Expandido',
    unit: '%',
    baseValue: 14,
    apply: (v) => ({
      delta: { rangePct: v / 100 },
      desc: `+${Math.round(v)}% de alcance de ataque e área.`,
    }),
  },
  {
    key: 'cdr',
    title: 'Fluxo Arcano',
    unit: '%',
    baseValue: 7,
    apply: (v) => ({
      delta: { cooldownReduction: Math.min(0.18, v / 100) },
      desc: `-${Math.min(18, Math.round(v))}% no tempo de recarga das habilidades.`,
    }),
  },
  {
    key: 'luck',
    title: 'Bênção da Fortuna',
    unit: '',
    baseValue: 16,
    apply: (v) => ({
      delta: { luck: Math.round(v) },
      desc: `+${Math.round(v)} de Sorte para raridades de melhorias e itens.`,
    }),
  },
  {
    key: 'proj',
    title: 'Rajada Adicional',
    unit: '',
    baseValue: 1,
    apply: (v) => {
      const count = v >= 3.2 ? 2 : 1;
      return {
        delta: { extraProjectiles: count },
        desc: `+${count} projétil adicional em ataques básicos.`,
      };
    },
  },
  {
    key: 'pierce',
    title: 'Ataques Perfurantes',
    unit: '',
    baseValue: 1,
    apply: (v) => {
      const count = v >= 2.8 ? 2 : 1;
      return {
        delta: { piercing: count },
        desc: `Seus ataques perfuram +${count} inimigo(s) adicional(is).`,
      };
    },
  },
];

const SPECIAL_MULTIPLIERS: Array<{
  id: string;
  minRarity: Rarity;
  minPlayerLevel: number;
  title: string;
  subtitle: string;
  desc: string;
  field: 'damageMult' | 'attackSpeedMult' | 'xpMult' | 'goldMult' | 'bossDamageMult';
  factor: number;
}> = [
  {
    id: 'mult_dmg_15',
    minRarity: 'epic',
    minPlayerLevel: BALANCE_CONFIG.multiplierGates.combatMinorMinLevel,
    title: 'Decreto de Poder (Dano ×1.35)',
    subtitle: 'Multiplicador Especial',
    desc: 'Multiplica permanentemente seu dano total desta expedição por 1,35x.',
    field: 'damageMult',
    factor: 1.35,
  },
  {
    id: 'mult_aspd_15',
    minRarity: 'epic',
    minPlayerLevel: BALANCE_CONFIG.multiplierGates.combatMinorMinLevel,
    title: 'Frenesi Temporal (Vel. Ataque ×1.35)',
    subtitle: 'Multiplicador Especial',
    desc: 'Multiplica permanentemente sua velocidade de ataque por 1,35x.',
    field: 'attackSpeedMult',
    factor: 1.35,
  },
  {
    id: 'mult_xp_2',
    minRarity: 'rare',
    minPlayerLevel: BALANCE_CONFIG.multiplierGates.utilityMinLevel,
    title: 'Grimório da Ascensão (EXP ×1.75)',
    subtitle: 'Multiplicador Especial',
    desc: 'Multiplica toda a experiência ganha até o fim da expedição por 1,75x.',
    field: 'xpMult',
    factor: 1.75,
  },
  {
    id: 'mult_gold_2',
    minRarity: 'rare',
    minPlayerLevel: BALANCE_CONFIG.multiplierGates.utilityMinLevel,
    title: 'Coroa da Cobiça (Ouro ×1.85)',
    subtitle: 'Multiplicador Especial',
    desc: 'Multiplica todo o ouro obtido em monstros, chefes e baús por 1,85x.',
    field: 'goldMult',
    factor: 1.85,
  },
  {
    id: 'mult_boss_2',
    minRarity: 'epic',
    minPlayerLevel: BALANCE_CONFIG.multiplierGates.combatMinorMinLevel,
    title: 'Selo Matador de Chefes (×1.75 vs Chefes)',
    subtitle: 'Multiplicador Especial',
    desc: 'Multiplica todo o dano causado contra Mini-Bosses e Chefes Ancestrais por 1,75x.',
    field: 'bossDamageMult',
    factor: 1.75,
  },
  {
    id: 'mult_dmg_2',
    minRarity: 'legendary',
    minPlayerLevel: BALANCE_CONFIG.multiplierGates.combatMajorMinLevel,
    title: 'Despertar do Soberano (Dano ×1.75)',
    subtitle: 'Multiplicador Lendário',
    desc: 'Eleva exponencialmente todo o dano do personagem nesta expedição em 1,75x.',
    field: 'damageMult',
    factor: 1.75,
  },
];

export function generateLevelUpOptions(params: {
  luck: number;
  currentSkills: Partial<Record<SkillId, number>>;
  playerLevel?: number;
  classId?: ClassId;
  rng?: () => number;
}): UpgradeOption[] {
  const rng = params.rng ?? Math.random;
  const playerLevel = params.playerLevel ?? 1;
  const options: UpgradeOption[] = [];
  const usedIds = new Set<string>();

  const eligibleSkills = SKILL_LIST.filter(
    (s) =>
      (!s.exclusiveToClass || s.exclusiveToClass === params.classId) &&
      (params.currentSkills[s.id] ?? 0) < s.maxLevel
  );

  // Build 3 varied choices: guarantee at least 1 skill option if eligible
  for (let i = 0; i < 3; i++) {
    const rarity = rollRarity(params.luck, undefined, rng);
    const rarityMult = RARITY_META[rarity].statMult;

    const wantSkill =
      eligibleSkills.length > 0 && (i === 0 || (i === 1 && rng() < 0.42) || (i === 2 && rng() < 0.22));
    const wantMultiplier =
      !wantSkill &&
      (rarity === 'mythic' ||
        rarity === 'legendary' ||
        (rarity === 'epic' && rng() < 0.36) ||
        (rarity === 'rare' && rng() < 0.18));

    if (wantMultiplier) {
      const rarityIdx = RARITY_ORDER.indexOf(rarity);
      const candidates = SPECIAL_MULTIPLIERS.filter(
        (m) =>
          RARITY_ORDER.indexOf(m.minRarity) <= rarityIdx &&
          playerLevel >= m.minPlayerLevel &&
          !usedIds.has(m.id)
      );
      if (candidates.length > 0) {
        const pick = candidates[Math.floor(rng() * candidates.length)];
        usedIds.add(pick.id);
        const boostedFactor = rarity === 'mythic' ? Number((pick.factor * 1.18).toFixed(2)) : pick.factor;
        options.push({
          id: `${pick.id}_${i}`,
          kind: 'multiplier',
          rarity,
          title: rarity === 'mythic' ? `${pick.title.replace(/×[\d.]+/, `×${boostedFactor}`)}` : pick.title,
          subtitle: pick.subtitle,
          description: pick.desc,
          multDelta: { field: pick.field, factor: boostedFactor },
        });
        continue;
      }
    }

    if (wantSkill) {
      const pool = eligibleSkills.filter((s) => !usedIds.has(`skill_${s.id}`));
      if (pool.length > 0) {
        // Favor upgrading owned skills slightly so players reach Tier 2/3 evolutions & synergies
        const owned = pool.filter((s) => (params.currentSkills[s.id] ?? 0) > 0);
        const pickFrom = owned.length > 0 && rng() < 0.55 ? owned : pool;
        const skill = pickFrom[Math.floor(rng() * pickFrom.length)];
        usedIds.add(`skill_${skill.id}`);

        const curLv = params.currentSkills[skill.id] ?? 0;
        const levelGain = rarity === 'mythic' ? 3 : rarity === 'legendary' ? 2 : 1;
        const nextLv = Math.min(skill.maxLevel, curLv + levelGain);
        const nextTier = getSkillEvolutionTier(skill.id, nextLv);
        const prevTier = curLv > 0 ? getSkillEvolutionTier(skill.id, curLv) : null;
        const isEvolution = prevTier !== null && nextTier.name !== prevTier.name;

        // Check if picking this unlocks a secret synergy
        let synergyHint: string | undefined;
        if (curLv === 0) {
          for (const syn of SYNERGIES) {
            if (
              syn.requiresSkills.includes(skill.id) &&
              syn.requiresSkills.every((req) => req === skill.id || (params.currentSkills[req] ?? 0) >= 1)
            ) {
              synergyHint = `Sinergia Secreta: ${syn.name}`;
              break;
            }
          }
        }

        options.push({
          id: `skill_${skill.id}_${i}`,
          kind: 'skill',
          rarity,
          title: isEvolution ? nextTier.name : curLv === 0 ? skill.name : `${nextTier.name} Nv.${nextLv}`,
          subtitle:
            curLv === 0
              ? `Nova Habilidade (${skill.type === 'active' ? 'Ativa' : 'Passiva'})`
              : isEvolution
                ? `Evolução de Habilidade · Nv.${nextLv}`
                : `Aprimorar Nv.${curLv} → Nv.${nextLv}`,
          description: isEvolution ? nextTier.description : skill.description,
          skillId: skill.id,
          nextSkillLevel: nextLv,
          evolvedName: isEvolution ? nextTier.name : undefined,
          synergyHint,
        });
        continue;
      }
    }

    // Stat upgrade
    const statPool = STAT_TEMPLATES.filter((t) => !usedIds.has(`stat_${t.key}`));
    const tpl = statPool[Math.floor(rng() * statPool.length)] ?? STAT_TEMPLATES[0];
    usedIds.add(`stat_${tpl.key}`);
    const scaled = tpl.baseValue * rarityMult;
    const applied = tpl.apply(scaled);
    options.push({
      id: `stat_${tpl.key}_${i}`,
      kind: 'stat',
      rarity,
      title: tpl.title,
      subtitle: 'Aprimoramento de Atributo',
      description: applied.desc,
      statDelta: applied.delta,
    });
  }

  return options;
}

export const EQUIPMENT_SLOT_LABELS: Record<EquipmentSlot, string> = {
  weapon: 'Arma',
  armor: 'Armadura',
  helmet: 'Capacete',
  boots: 'Botas',
  ring: 'Anel',
  amulet: 'Amuleto',
  artifact: 'Artefato',
};

export const EQUIPMENT_SLOTS: EquipmentSlot[] = [
  'weapon',
  'armor',
  'helmet',
  'boots',
  'ring',
  'amulet',
  'artifact',
];

const SLOT_BASE_NAMES: Record<EquipmentSlot, string[]> = {
  weapon: ['Espada Runada', 'Machado de Obsidiana', 'Lâmina Carmesim', 'Cajado Abissal', 'Arco Sombrio', 'Foice Espectral'],
  armor: ['Couraça de Basalto', 'Manto do Eclipse', 'Armadura de Placas', 'Túnica Arcana', 'Veste Sombria'],
  helmet: ['Elmo Chifrudo', 'Coroa Quebrada', 'Capuz do Caçador', 'Diadema Astral', 'Máscara de Ferro'],
  boots: ['Grevas Velozes', 'Botas da Névoa', 'Passos de Cinza', 'Coturnos de Guerra'],
  ring: ['Anel de Sangue', 'Sinete da Fortuna', 'Aliança do Vazio', 'Anel Solar'],
  amulet: ['Amuleto de Ossos', 'Talismã Arcano', 'Pingente Carmesim', 'Relicário de Prata'],
  artifact: ['Coração do Abismo', 'Orbe Estelar', 'Fragmento do Trono', 'Grimório Proibido', 'Estilhaço Divino'],
};

const RARITY_PREFIX: Record<Rarity, string[]> = {
  common: ['Gasto', 'Simples', 'Antigo'],
  uncommon: ['Reforçado', 'Temperado', 'Sólido'],
  rare: ['Rúnico', 'Sombrio', 'Venerado'],
  epic: ['Abissal', 'Dracônico', 'Soberano'],
  legendary: ['Imortal', 'Celestial', 'Apocalíptico'],
  mythic: ['Primordial', 'Transcendente', 'Divino'],
};

const SPECIAL_EFFECTS = [
  { id: 'execute', label: 'Execução: +18% dano contra alvos abaixo de 35% HP', value: 0.18 },
  { id: 'thorns', label: 'Espinhos: reflete 25% do dano sofrido aos atacantes', value: 0.25 },
  { id: 'swift_kill', label: 'Ímpeto: +15% velocidade por 2s ao eliminar inimigo', value: 0.15 },
  { id: 'mana_surge', label: 'Fluxo: reduz recargas em 0.4s a cada acerto crítico', value: 0.4 },
  { id: 'boss_bane', label: 'Ruína dos Reis: +22% dano adicional contra chefes', value: 0.22 },
];

let equipUidCounter = 1;

export function generateEquipmentItem(params: {
  floor: number;
  luck: number;
  minRarity?: Rarity;
  slot?: EquipmentSlot;
  rng?: () => number;
}): EquipmentItem {
  const rng = params.rng ?? Math.random;
  const rarity = rollRarity(params.luck, params.minRarity, rng);
  const slot = params.slot ?? EQUIPMENT_SLOTS[Math.floor(rng() * EQUIPMENT_SLOTS.length)];
  const rm = RARITY_META[rarity].statMult;
  const floorScale = 1 + (Math.max(1, params.floor) - 1) * 0.16;

  const baseNames = SLOT_BASE_NAMES[slot];
  const prefixes = RARITY_PREFIX[rarity];
  const name = `${baseNames[Math.floor(rng() * baseNames.length)]} ${prefixes[Math.floor(rng() * prefixes.length)]}`;

  const stats: EquipmentStats = {};
  switch (slot) {
    case 'weapon':
      stats.damage = Math.round((7 + rng() * 5) * rm * floorScale);
      stats.damagePct = Number(((0.04 + rng() * 0.04) * rm).toFixed(3));
      if (rng() < 0.65) stats.critChance = Number(((0.02 + rng() * 0.03) * rm).toFixed(3));
      if (rng() < 0.5) stats.attackSpeedPct = Number(((0.04 + rng() * 0.04) * rm).toFixed(3));
      break;
    case 'armor':
      stats.maxHp = Math.round((26 + rng() * 14) * rm * floorScale);
      stats.armor = Math.round((5 + rng() * 4) * rm * (1 + params.floor * 0.06));
      if (rng() < 0.45) stats.lifeSteal = Number(((0.01 + rng() * 0.015) * rm).toFixed(3));
      break;
    case 'helmet':
      stats.maxHp = Math.round((16 + rng() * 10) * rm * floorScale);
      stats.armor = Math.round((3 + rng() * 3) * rm * (1 + params.floor * 0.05));
      stats.critDamage = Number(((0.06 + rng() * 0.06) * rm).toFixed(3));
      break;
    case 'boots':
      stats.moveSpeedPct = Number(Math.min(0.28, (0.04 + rng() * 0.03) * rm).toFixed(3));
      stats.dodge = Number(Math.min(0.18, (0.02 + rng() * 0.025) * rm).toFixed(3));
      stats.armor = Math.round((2 + rng() * 2) * rm);
      break;
    case 'ring':
      stats.critChance = Number(Math.min(0.24, (0.025 + rng() * 0.025) * rm).toFixed(3));
      stats.attackSpeedPct = Number(((0.04 + rng() * 0.04) * rm).toFixed(3));
      if (rng() < 0.6) stats.luck = Math.round((6 + rng() * 6) * rm);
      break;
    case 'amulet':
      stats.lifeSteal = Number(Math.min(0.12, (0.015 + rng() * 0.015) * rm).toFixed(3));
      stats.cooldownReduction = Number(Math.min(0.18, (0.025 + rng() * 0.02) * rm).toFixed(3));
      stats.xpGainPct = Number(((0.05 + rng() * 0.05) * rm).toFixed(3));
      break;
    case 'artifact':
      stats.damagePct = Number(((0.06 + rng() * 0.05) * rm).toFixed(3));
      stats.luck = Math.round((8 + rng() * 8) * rm);
      stats.critDamage = Number(((0.08 + rng() * 0.08) * rm).toFixed(3));
      break;
  }

  const rarityIdx = RARITY_ORDER.indexOf(rarity);
  const specialEffect =
    rarityIdx >= 3 ? SPECIAL_EFFECTS[Math.floor(rng() * SPECIAL_EFFECTS.length)] : undefined;

  const sellValue = Math.round((18 + params.floor * 4) * Math.pow(rm, 1.35));

  return {
    id: `eq_${Date.now().toString(36)}_${equipUidCounter++}_${Math.floor(rng() * 9999)}`,
    name,
    slot,
    rarity,
    requiredLevel: Math.max(1, Math.floor(params.floor * 0.65)),
    upgradeLevel: 0,
    stats,
    specialEffect,
    sellValue,
  };
}

export function createStarterWeapon(classId: ClassId): EquipmentItem {
  const cls = CLASSES[classId];
  return {
    id: `starter_${classId}`,
    name: cls.weaponName,
    slot: 'weapon',
    rarity: 'common',
    requiredLevel: 1,
    upgradeLevel: 0,
    stats: {
      damage: 4,
      damagePct: 0.03,
      critChance:
        classId === 'assassin' || classId === 'archer' || classId === 'slatt' || classId === 'baldasso'
          ? 0.02
          : undefined,
      armor: classId === 'farid' ? 2 : undefined,
    },
    sellValue: 12,
  };
}

export function getEquipmentUpgradeCost(item: EquipmentItem): number {
  const rm = RARITY_META[item.rarity].statMult;
  return Math.round((28 + item.requiredLevel * 6) * rm * Math.pow(1.42, item.upgradeLevel));
}

export function getEquipmentPowerScore(item: EquipmentItem): number {
  const upg = 1 + item.upgradeLevel * BALANCE_CONFIG.player.equipUpgradeStep;
  const s = item.stats;
  let score = 0;
  if (s.damage) score += s.damage * upg * 3.2;
  if (s.damagePct) score += s.damagePct * upg * 220;
  if (s.maxHp) score += s.maxHp * upg * 0.7;
  if (s.armor) score += s.armor * upg * 2.4;
  if (s.attackSpeedPct) score += s.attackSpeedPct * upg * 190;
  if (s.critChance) score += s.critChance * 260;
  if (s.critDamage) score += s.critDamage * 110;
  if (s.moveSpeedPct) score += s.moveSpeedPct * 140;
  if (s.lifeSteal) score += s.lifeSteal * 320;
  if (s.dodge) score += s.dodge * 240;
  if (s.luck) score += s.luck * upg * 1.6;
  if (s.cooldownReduction) score += s.cooldownReduction * 250;
  if (s.xpGainPct) score += s.xpGainPct * 90;
  if (item.specialEffect) score += 45;
  return Math.round(score);
}

export interface DungeonLayout {
  roomWidth: number;
  roomHeight: number;
  tileSize: number;
  biomeIndex: number;
  playerSpawn: { x: number; y: number };
  portalPos: { x: number; y: number };
  pillars: Array<{ x: number; y: number; w: number; h: number }>;
  braziers: Array<{ x: number; y: number }>;
  enemySpawns: Array<{ x: number; y: number }>;
  decorProps: BiomeDecorProp[];
  envZones: BiomeEnvZone[];
}

const BIOME_ZONE_KIND: BiomeEnvZoneKind[] = [
  'ruins_trap',
  'cavern_crystal',
  'forest_roots',
  'fortress_lava',
  'frozen_ice',
  'abyss_rift',
  'temple_gravestone',
  'shadow_veil',
  'chaos_nexus',
  'celestial_sigil',
];

/**
 * Generates a balanced procedural dungeon arena tailored to each biome where
 * the player always spawns in a clear open lane (>= 2 tiles wide) far from
 * immediate enemy hits and hazards.
 */
export function generateDungeonLayout(
  floor: number,
  isBoss: boolean,
  enemyCount: number,
  rng: () => number = Math.random
): DungeonLayout {
  const tileSize = 64;
  const biomeIndex = Math.floor((Math.max(1, floor) - 1) / 10) % 10;
  const roomWidth = isBoss ? 1664 : 1536; // 26 or 24 tiles
  const roomHeight = isBoss ? 1152 : 1088; // 18 or 17 tiles
  const margin = tileSize * 2;

  const playerSpawn = { x: Math.round(roomWidth / 2), y: Math.round(roomHeight - tileSize * 2.5) };
  const portalPos = { x: Math.round(roomWidth / 2), y: Math.round(tileSize * 2.4) };

  const pillars: Array<{ x: number; y: number; w: number; h: number }> = [];

  const addPillar = (cx: number, cy: number) => {
    const w = tileSize;
    const h = tileSize;
    const rx = Math.round(cx);
    const ry = Math.round(cy);
    // Never overlap player spawn or portal (minimum 175px clearance)
    const dPlayer = Math.hypot(rx - playerSpawn.x, ry - playerSpawn.y);
    const dPortal = Math.hypot(rx - portalPos.x, ry - portalPos.y);
    if (dPlayer < 180 || dPortal < 180) return;
    // Keep pillars spaced apart so player/enemies never get trapped
    if (pillars.some((p) => Math.hypot(rx - p.x, ry - p.y) < 132)) return;
    pillars.push({ x: rx, y: ry, w, h });
  };

  // Biome-driven architectural pillar patterns (distinct silhouette per region)
  const variant = isBoss ? 0 : (floor + Math.floor(rng() * 2)) % 2;
  if (isBoss) {
    // Open heroic boss arena with 4 flanking thematic columns
    addPillar(roomWidth * 0.24, roomHeight * 0.34);
    addPillar(roomWidth * 0.76, roomHeight * 0.34);
    addPillar(roomWidth * 0.24, roomHeight * 0.68);
    addPillar(roomWidth * 0.76, roomHeight * 0.68);
  } else {
    switch (biomeIndex) {
      case 0: // Ruínas Abandonadas: broken nave colonnade
        if (variant === 0) {
          addPillar(roomWidth * 0.28, roomHeight * 0.34);
          addPillar(roomWidth * 0.72, roomHeight * 0.34);
          addPillar(roomWidth * 0.28, roomHeight * 0.66);
          addPillar(roomWidth * 0.72, roomHeight * 0.66);
        } else {
          addPillar(roomWidth * 0.3, roomHeight * 0.29);
          addPillar(roomWidth * 0.7, roomHeight * 0.29);
          addPillar(roomWidth * 0.3, roomHeight * 0.54);
          addPillar(roomWidth * 0.7, roomHeight * 0.54);
          addPillar(roomWidth * 0.3, roomHeight * 0.74);
        }
        break;
      case 1: // Cavernas Corrompidas: organic asymmetric crystal clusters
        addPillar(roomWidth * 0.24, roomHeight * 0.32);
        addPillar(roomWidth * 0.68, roomHeight * 0.28);
        addPillar(roomWidth * 0.5, roomHeight * 0.5);
        addPillar(roomWidth * 0.29, roomHeight * 0.68);
        addPillar(roomWidth * 0.77, roomHeight * 0.62);
        break;
      case 2: // Floresta Sombria: twisted grove clearing with flanking trees
        addPillar(roomWidth * 0.2, roomHeight * 0.3);
        addPillar(roomWidth * 0.8, roomHeight * 0.3);
        addPillar(roomWidth * 0.36, roomHeight * 0.44);
        addPillar(roomWidth * 0.64, roomHeight * 0.44);
        addPillar(roomWidth * 0.22, roomHeight * 0.7);
        addPillar(roomWidth * 0.78, roomHeight * 0.7);
        break;
      case 3: // Fortaleza Infernal: symmetrical iron bastion courtyard (matches lava fortress ref)
        addPillar(roomWidth * 0.33, roomHeight * 0.33);
        addPillar(roomWidth * 0.67, roomHeight * 0.33);
        addPillar(roomWidth * 0.33, roomHeight * 0.67);
        addPillar(roomWidth * 0.67, roomHeight * 0.67);
        addPillar(roomWidth * 0.18, roomHeight * 0.5);
        addPillar(roomWidth * 0.82, roomHeight * 0.5);
        break;
      case 4: // Reino Congelado: glacial bastion hall with wide central ice lane
        addPillar(roomWidth * 0.25, roomHeight * 0.3);
        addPillar(roomWidth * 0.75, roomHeight * 0.3);
        addPillar(roomWidth * 0.25, roomHeight * 0.55);
        addPillar(roomWidth * 0.75, roomHeight * 0.55);
        break;
      case 5: // Abismo: outer ring of levitating void obelisks around central rift
        addPillar(roomWidth * 0.34, roomHeight * 0.3);
        addPillar(roomWidth * 0.66, roomHeight * 0.3);
        addPillar(roomWidth * 0.2, roomHeight * 0.52);
        addPillar(roomWidth * 0.8, roomHeight * 0.52);
        addPillar(roomWidth * 0.34, roomHeight * 0.72);
        addPillar(roomWidth * 0.66, roomHeight * 0.72);
        break;
      case 6: // Templo dos Mortos: catacomb sarcophagus rows
        addPillar(roomWidth * 0.32, roomHeight * 0.32);
        addPillar(roomWidth * 0.68, roomHeight * 0.32);
        addPillar(roomWidth * 0.32, roomHeight * 0.54);
        addPillar(roomWidth * 0.68, roomHeight * 0.54);
        addPillar(roomWidth * 0.32, roomHeight * 0.74);
        addPillar(roomWidth * 0.68, roomHeight * 0.74);
        break;
      case 7: // Reino das Sombras: diamond eclipse sanctuaries
        addPillar(roomWidth * 0.5, roomHeight * 0.44);
        addPillar(roomWidth * 0.25, roomHeight * 0.5);
        addPillar(roomWidth * 0.75, roomHeight * 0.5);
        addPillar(roomWidth * 0.36, roomHeight * 0.7);
        addPillar(roomWidth * 0.64, roomHeight * 0.7);
        break;
      case 8: // Dimensão Caótica: fractured diagonal shards
        addPillar(roomWidth * 0.24, roomHeight * 0.34);
        addPillar(roomWidth * 0.58, roomHeight * 0.32);
        addPillar(roomWidth * 0.42, roomHeight * 0.56);
        addPillar(roomWidth * 0.76, roomHeight * 0.64);
        addPillar(roomWidth * 0.22, roomHeight * 0.72);
        break;
      default: // Domínio Celestial: grand royal temple peristyle
        addPillar(roomWidth * 0.24, roomHeight * 0.3);
        addPillar(roomWidth * 0.76, roomHeight * 0.3);
        addPillar(roomWidth * 0.24, roomHeight * 0.52);
        addPillar(roomWidth * 0.76, roomHeight * 0.52);
        addPillar(roomWidth * 0.24, roomHeight * 0.72);
        addPillar(roomWidth * 0.76, roomHeight * 0.72);
        break;
    }
  }

  const braziers: Array<{ x: number; y: number }> = [
    { x: margin, y: margin },
    { x: roomWidth - margin, y: margin },
    { x: margin, y: roomHeight - margin },
    { x: roomWidth - margin, y: roomHeight - margin },
    { x: roomWidth * 0.5 - 150, y: margin },
    { x: roomWidth * 0.5 + 150, y: margin },
  ];

  // Biome-specific environmental zones (fair, telegraphed, never overlapping spawn/portal/pillars)
  const envZones: BiomeEnvZone[] = [];
  const zoneKind = BIOME_ZONE_KIND[biomeIndex] ?? 'ruins_trap';
  const targetZoneCount = isBoss
    ? biomeIndex === 3 || biomeIndex === 4 || biomeIndex === 5 || biomeIndex === 9
      ? 2
      : 1
    : biomeIndex === 8
      ? 1
      : biomeIndex === 4
        ? 3
        : 4;

  const zoneRadiusByBiome = [46, 44, 68, 56, 86, 68, 48, 72, 64, 58];
  const baseRadius = zoneRadiusByBiome[biomeIndex] ?? 52;

  if (biomeIndex === 8) {
    // Chaos Dimension central rift nexus
    envZones.push({
      id: `env_${floor}_0`,
      kind: 'chaos_nexus',
      x: Math.round(roomWidth * 0.5),
      y: Math.round(roomHeight * 0.48),
      radius: 74,
    });
  } else {
    let zGuard = 0;
    while (envZones.length < targetZoneCount && zGuard < 160) {
      zGuard++;
      const zx = Math.round(margin + 96 + rng() * (roomWidth - (margin + 96) * 2));
      const zy = Math.round(margin + 96 + rng() * (roomHeight - (margin + 96) * 2));
      if (Math.hypot(zx - playerSpawn.x, zy - playerSpawn.y) < 220) continue;
      if (Math.hypot(zx - portalPos.x, zy - portalPos.y) < 190) continue;
      if (pillars.some((p) => Math.hypot(zx - p.x, zy - p.y) < baseRadius + 56)) continue;
      if (envZones.some((z) => Math.hypot(zx - z.x, zy - z.y) < baseRadius * 2.4)) continue;
      envZones.push({
        id: `env_${floor}_${envZones.length}`,
        kind: zoneKind,
        x: zx,
        y: zy,
        radius: baseRadius,
      });
    }
  }

  // Non-blocking atmospheric biome decor props (candles, crystal shards, lanterns, grates, snowdrifts, sigils)
  const decorProps: BiomeDecorProp[] = [];
  const decorCount = isBoss ? 8 : 11;
  let dGuard = 0;
  while (decorProps.length < decorCount && dGuard < 200) {
    dGuard++;
    const dx = Math.round(margin + 30 + rng() * (roomWidth - (margin + 30) * 2));
    const dy = Math.round(margin + 30 + rng() * (roomHeight - (margin + 30) * 2));
    if (Math.hypot(dx - playerSpawn.x, dy - playerSpawn.y) < 130) continue;
    if (Math.hypot(dx - portalPos.x, dy - portalPos.y) < 135) continue;
    if (pillars.some((p) => Math.hypot(dx - p.x, dy - p.y) < 76)) continue;
    if (decorProps.some((d) => Math.hypot(dx - d.x, dy - d.y) < 120)) continue;
    decorProps.push({
      x: dx,
      y: dy,
      variant: decorProps.length % 2,
      scale: 0.85 + rng() * 0.3,
      flipX: rng() > 0.5,
    });
  }

  const enemySpawns: Array<{ x: number; y: number }> = [];
  if (isBoss) {
    enemySpawns.push({ x: Math.round(roomWidth / 2), y: Math.round(roomHeight * 0.34) });
  } else {
    let guard = 0;
    while (enemySpawns.length < enemyCount && guard < 400) {
      guard++;
      const x = margin + 32 + rng() * (roomWidth - (margin + 32) * 2);
      const y = margin + 32 + rng() * (roomHeight - margin * 2 - 140);
      // Keep enemies safely away from player spawn so player survives initial seconds cleanly
      if (Math.hypot(x - playerSpawn.x, y - playerSpawn.y) < 280) continue;
      const hitsPillar = pillars.some(
        (p) => Math.abs(x - p.x) < p.w * 0.85 && Math.abs(y - p.y) < p.h * 0.85
      );
      if (hitsPillar) continue;
      enemySpawns.push({ x: Math.round(x), y: Math.round(y) });
    }
  }

  return {
    roomWidth,
    roomHeight,
    tileSize,
    biomeIndex,
    playerSpawn,
    portalPos,
    pillars,
    braziers,
    enemySpawns,
    decorProps,
    envZones,
  };
}
