export type ClassId = 'warrior' | 'assassin' | 'mage' | 'necromancer' | 'archer' | 'slatt';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

export type GameStateMode = 'title' | 'playing' | 'paused' | 'gameover';

export type ActiveModalType =
  | null
  | 'classSelect'
  | 'sanctuary'
  | 'codex'
  | 'settings'
  | 'redeemCode'
  | 'levelUp'
  | 'character'
  | 'event';

export type SkillId =
  | 'fireball'
  | 'shadow_slash'
  | 'meteor_shower'
  | 'electric_aura'
  | 'chain_lightning'
  | 'orbital_blades'
  | 'regeneration'
  | 'divine_shield'
  | 'shadow_summon'
  | 'arcane_blast'
  | 'time_freeze'
  | 'black_hole'
  | 'life_drain'
  | 'celestial_bolt'
  | 'demonic_fury'
  | 'banana_bomb'
  | 'banana_peel'
  | 'primate_fury'
  | 'banana_rain'
  | 'primate_instinct';

export type SynergyId =
  | 'fire_tornado'
  | 'glacial_storm'
  | 'vampiric_aura'
  | 'supernova'
  | 'assassin_legion';

export type EquipmentSlot =
  | 'weapon'
  | 'armor'
  | 'helmet'
  | 'boots'
  | 'ring'
  | 'amulet'
  | 'artifact';

export type EnemyArchetypeId =
  | 'goblin'
  | 'skeleton'
  | 'archer'
  | 'mage'
  | 'bomber'
  | 'golem'
  | 'shadow_assassin'
  | 'healer'
  | 'summoner'
  | 'stalker';

export type EliteModifierId =
  | 'vampiric'
  | 'swift'
  | 'armored'
  | 'fiery'
  | 'frost'
  | 'berserker';

export interface ClassEvolutionDef {
  level: number;
  title: string;
  bonusDesc: string;
  damageMult: number;
  hpMult: number;
  speedBonus: number;
  critChanceBonus: number;
  attackSpeedBonus: number;
}

export interface ClassDef {
  id: ClassId;
  name: string;
  archetype: string;
  description: string;
  weaponName: string;
  attackStyle: 'melee_cleave' | 'twin_dagger' | 'arcane_bolt' | 'soul_orb' | 'multi_arrow' | 'banana_toss';
  accentColor: string;
  secret?: boolean;
  baseStats: {
    maxHp: number;
    damage: number;
    attackSpeed: number; // attacks per second
    moveSpeed: number; // px/sec
    critChance: number; // 0..1
    critDamage: number; // multiplier e.g. 1.75
    armor: number; // damage reduction rating
    dodge: number; // 0..1
    range: number; // px
    projectiles: number;
  };
  startingSkills: SkillId[];
  evolutions: ClassEvolutionDef[];
}

export interface BiomeDef {
  index: number; // 0..9
  name: string;
  floorRange: [number, number];
  floorPrimary: string;
  floorSecondary: string;
  floorCrack: string;
  wallPrimary: string;
  wallHighlight: string;
  accentGlow: string;
  ambientTint: number;
  particleColor: number;
  bossId: string;
}

export interface BossDef {
  id: string;
  floorMilestone: number; // 10, 20, ..., 100
  name: string;
  title: string;
  isMegaBoss: boolean; // every 50 floors
  primaryColor: string;
  accentColor: string;
  hpMultiplier: number;
  damageMultiplier: number;
  speed: number;
  radius: number;
  patterns: Array<
    | 'cone_slam'
    | 'ring_nova'
    | 'charge_dash'
    | 'meteor_rain'
    | 'summon_minions'
    | 'void_pull'
    | 'spiral_barrage'
    | 'frost_lance'
  >;
  lore: string;
}

export interface SkillEvolutionTier {
  minLevel: number;
  name: string;
  description: string;
}

export interface SkillDef {
  id: SkillId;
  name: string;
  type: 'active' | 'passive';
  element: 'fire' | 'shadow' | 'lightning' | 'arcane' | 'ice' | 'divine' | 'gravity' | 'blood' | 'primate';
  exclusiveToClass?: ClassId;
  description: string;
  cooldown: number; // seconds (0 for pure passive or tick interval)
  basePower: number; // multiplier of player damage or flat scaling
  maxLevel: number;
  color: string;
  evolutions: [SkillEvolutionTier, SkillEvolutionTier, SkillEvolutionTier];
}

export interface SynergyDef {
  id: SynergyId;
  name: string;
  description: string;
  requiresSkills: SkillId[];
  requiresStatHint?: string;
  color: string;
  bonusText: string;
}

export interface StatModifiers {
  damagePct: number;
  attackSpeedPct: number;
  critChance: number;
  critDamage: number;
  moveSpeedPct: number;
  maxHpPct: number;
  lifeSteal: number;
  dodge: number;
  xpGainPct: number;
  goldGainPct: number;
  rangePct: number;
  cooldownReduction: number;
  extraProjectiles: number;
  piercing: number;
  armorFlat: number;
  luck: number;
  // Special Multiplicative Modifiers
  damageMult: number;
  attackSpeedMult: number;
  xpMult: number;
  goldMult: number;
  bossDamageMult: number;
}

export interface UpgradeOption {
  id: string;
  kind: 'stat' | 'skill' | 'multiplier';
  rarity: Rarity;
  title: string;
  subtitle: string;
  description: string;
  skillId?: SkillId;
  nextSkillLevel?: number;
  evolvedName?: string;
  synergyHint?: string;
  statDelta?: Partial<StatModifiers>;
  multDelta?: {
    field: 'damageMult' | 'attackSpeedMult' | 'xpMult' | 'goldMult' | 'bossDamageMult';
    factor: number;
  };
}

export interface EquipmentStats {
  damage?: number;
  damagePct?: number;
  maxHp?: number;
  armor?: number;
  attackSpeedPct?: number;
  critChance?: number;
  critDamage?: number;
  moveSpeedPct?: number;
  lifeSteal?: number;
  dodge?: number;
  luck?: number;
  cooldownReduction?: number;
  xpGainPct?: number;
}

export interface EquipmentItem {
  id: string;
  name: string;
  slot: EquipmentSlot;
  rarity: Rarity;
  requiredLevel: number;
  upgradeLevel: number;
  stats: EquipmentStats;
  specialEffect?: {
    id: string;
    label: string;
    value: number;
  };
  sellValue: number;
}

export interface PermanentUpgrades {
  startingDamage: number;
  startingHp: number;
  luck: number;
  xpGain: number;
  goldGain: number;
  resistance: number;
  rareLootChance: number;
}

export type CastMode = 'normal' | 'quick' | 'quick_indicator';

export interface SettingsData {
  masterVolume: number;
  sfxVolume: number;
  muted: boolean;
  graphicsQuality: 'low' | 'medium' | 'high';
  screenShake: boolean;
  damageNumbers: boolean;
  mobileControls: 'auto' | 'on' | 'off';
  autoAttack: boolean;
  showAttackRange: boolean;
  defaultCastMode: CastMode;
  dashCastMode: CastMode;
  skillCastModes: Partial<Record<SkillId, CastMode>>;
}

export interface RunRecord {
  id: string;
  date: string;
  classId: ClassId;
  floor: number;
  level: number;
  kills: number;
  bossesKilled: number;
  durationSec: number;
  crystalsEarned: number;
  ascensionLevel: number;
}

export interface SaveData {
  version: number;
  crystals: number;
  totalCrystalsEarned: number;
  ascensionLevel: number;
  selectedClass: ClassId;
  permanentUpgrades: PermanentUpgrades;
  bestFloor: number;
  bestLevel: number;
  totalKills: number;
  totalBossKills: number;
  totalRuns: number;
  bestiaryKills: Record<string, number>;
  discoveredSynergies: SynergyId[];
  unlockedAchievements: string[];
  claimedAchievements: string[];
  redeemedCodes: string[];
  unlockedSecretClasses: ClassId[];
  records: RunRecord[];
  settings: SettingsData;
}

export interface ComputedPlayerStats {
  maxHp: number;
  damage: number;
  attackSpeed: number;
  moveSpeed: number;
  critChance: number;
  critDamage: number;
  armor: number;
  damageReduction: number; // 0..0.75
  dodge: number; // 0..0.65
  lifeSteal: number;
  range: number;
  cooldownReduction: number; // 0..0.6
  projectiles: number;
  piercing: number;
  luck: number;
  xpMultiplier: number;
  goldMultiplier: number;
  bossDamageMult: number;
  damageMult: number;
  attackSpeedMult: number;
}

export interface ActiveSkillSlotHUD {
  key: 'Q' | 'E' | 'R' | 'F';
  skillId: SkillId | null;
  name: string;
  level: number;
  cooldownRemaining: number;
  cooldownTotal: number;
  color: string;
}

export interface ActiveEventPayload {
  id: string;
  kind: 'chest' | 'altar' | 'merchant' | 'dimension_portal' | 'cursed' | 'timed_challenge';
  title: string;
  description: string;
  choices: Array<{
    id: string;
    label: string;
    detail: string;
    costGold?: number;
    riskText?: string;
    rewardText?: string;
    disabled?: boolean;
  }>;
}

export interface MinimapSnapshot {
  roomWidth: number;
  roomHeight: number;
  player: { x: number; y: number };
  enemies: Array<{ x: number; y: number; isElite: boolean; isBoss: boolean }>;
  portal: { x: number; y: number; active: boolean } | null;
  interactables: Array<{ x: number; y: number; kind: string }>;
  pillars: Array<{ x: number; y: number; w: number; h: number }>;
}

export interface RunHUDSnapshot {
  classId: ClassId;
  evolutionTitle: string;
  level: number;
  xp: number;
  xpToNext: number;
  hp: number;
  maxHp: number;
  shield: number;
  floor: number;
  biomeName: string;
  floorModifier: string | null;
  enemiesRemaining: number;
  enemiesTotal: number;
  waveIndex: number;
  waveTotal: number;
  lastDamagedAt: number;
  portalOpen: boolean;
  gold: number;
  crystalsRun: number;
  kills: number;
  bossesKilled: number;
  elapsedSec: number;
  dashCooldown: number;
  dashCooldownMax: number;
  activeSlots: ActiveSkillSlotHUD[];
  skills: Record<SkillId, number>;
  activeSynergies: SynergyId[];
  activeMultipliers: Array<{ label: string; value: string }>;
  activeBuffs: Array<{ label: string; remainingSec: number; color: string }>;
  boss: {
    name: string;
    title: string;
    hp: number;
    maxHp: number;
    phase: number;
    maxPhases: number;
    isMegaBoss: boolean;
  } | null;
  timedChallenge: {
    remainingSec: number;
    totalSec: number;
  } | null;
  nearbyPrompt: string | null;
  computedStats: ComputedPlayerStats;
  equipped: Partial<Record<EquipmentSlot, EquipmentItem>>;
  inventory: EquipmentItem[];
  minimap: MinimapSnapshot;
  recentNotice: { text: string; tone: 'gold' | 'crimson' | 'violet' | 'emerald'; id: number } | null;
  combo: {
    hits: number;
    multiplier: number;
    remainingSec: number;
    maxWindowSec: number;
  } | null;
  activeCastSlot: number | null; // 0..3 for Q/E/R/F, -1 for Dash, null when idle
  autoAttackEnabled: boolean;
}

export interface RunSummarySnapshot {
  classId: ClassId;
  evolutionTitle: string;
  floor: number;
  biomeName: string;
  level: number;
  kills: number;
  bossesKilled: number;
  durationSec: number;
  crystalsEarned: number;
  goldCollected: number;
  isNewFloorRecord: boolean;
  activeSynergies: SynergyId[];
  bossRemainingPct: number | null;
}
