import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAttackDamage,
  COMBO_MIN_HITS,
  COMBO_WINDOW_SEC,
  computeComboMultiplier,
  computePlayerStats,
  createEmptyModifiers,
  createStarterWeapon,
  generateDungeonLayout,
  generateEquipmentItem,
  generateLevelUpOptions,
  getEliteChance,
  getEnemyScaling,
  getEquipmentUpgradeCost,
  getFloorWavePlan,
  getRarityWeights,
  RARITY_META,
  RARITY_ORDER,
  rollRarity,
  xpForLevel,
} from './balance';
import { BALANCE_CONFIG } from '../data/balanceConfig';
import { getClassEvolution } from '../data/classes';
import { computeActiveSynergies, getSkillEvolutionTier } from '../data/skills';
import { getBiomeForFloor, getInfiniteModifierForFloor } from '../data/biomes';
import { getBossForFloor, isBossFloor, isMegaBossFloor } from '../data/bosses';
import {
  canPerformAscension,
  createDefaultPermanentUpgrades,
  createDefaultSave,
  performAscension,
  purchasePermanentUpgrade,
  validateAndMigrateSave,
} from './saveManager';

test('rarity weights at luck 0 match exact canonical probabilities', () => {
  const w = getRarityWeights(0);
  assert.ok(Math.abs(w.common - 50) < 0.01);
  assert.ok(Math.abs(w.uncommon - 25) < 0.01);
  assert.ok(Math.abs(w.rare - 15) < 0.01);
  assert.ok(Math.abs(w.epic - 7) < 0.01);
  assert.ok(Math.abs(w.legendary - 2.5) < 0.01);
  assert.ok(Math.abs(w.mythic - 0.5) < 0.01);

  const boosted = getRarityWeights(150);
  assert.ok(boosted.legendary > w.legendary);
  assert.ok(boosted.mythic > w.mythic);
  assert.ok(boosted.common < w.common);
});

test('rollRarity honors minimum rarity floor', () => {
  for (let i = 0; i < 50; i++) {
    const r = rollRarity(0, 'rare', () => i / 50);
    assert.ok(RARITY_ORDER.indexOf(r) >= RARITY_ORDER.indexOf('rare'));
  }
});

test('XP curve scales smoothly and level 100 stats vastly surpass level 1', () => {
  assert.ok(xpForLevel(2) > xpForLevel(1));
  assert.ok(xpForLevel(50) > xpForLevel(20));

  const mods = createEmptyModifiers();
  const perm = createDefaultPermanentUpgrades();
  const lv1 = computePlayerStats({
    classId: 'warrior',
    level: 1,
    mods,
    equipped: {},
    permanent: perm,
    ascensionLevel: 0,
    activeSynergies: [],
    skills: {},
  });
  const lv100 = computePlayerStats({
    classId: 'warrior',
    level: 100,
    mods,
    equipped: {},
    permanent: perm,
    ascensionLevel: 0,
    activeSynergies: [],
    skills: {},
  });

  assert.ok(lv100.damage > lv1.damage * 15, 'Lv 100 warrior should feel exponentially stronger than Lv 1');
  assert.ok(lv100.maxHp > lv1.maxHp * 10);
});

test('class evolutions trigger at levels 25, 50, and 100', () => {
  assert.equal(getClassEvolution('mage', 24), null);
  assert.equal(getClassEvolution('mage', 25)?.title, 'Arquimago Elemental');
  assert.equal(getClassEvolution('mage', 50)?.title, 'Sábio da Ruptura');
  assert.equal(getClassEvolution('mage', 100)?.title, 'Arconte Astral');
});

test('skill evolutions and secret synergies unlock accurately', () => {
  assert.equal(getSkillEvolutionTier('fireball', 1).name, 'Bola de Fogo');
  assert.equal(getSkillEvolutionTier('fireball', 4).name, 'Chamas Infernais');
  assert.equal(getSkillEvolutionTier('fireball', 7).name, 'Meteoro Apocalíptico');

  const syn = computeActiveSynergies({ fireball: 2, orbital_blades: 1, black_hole: 1 });
  assert.ok(syn.includes('fire_tornado'));
  assert.ok(syn.includes('supernova'));
  assert.ok(!syn.includes('glacial_storm'));
});

test('biomes, bosses, mega-bosses, and infinite post-100 scaling work past floor 100', () => {
  assert.equal(getBiomeForFloor(1).name, 'Ruínas Abandonadas');
  assert.equal(getBiomeForFloor(45).name, 'Reino Congelado');
  assert.equal(getBiomeForFloor(100).name, 'Domínio Celestial');
  assert.equal(getBiomeForFloor(105).name, 'Ruínas Abandonadas');

  assert.equal(isBossFloor(9), false);
  assert.equal(isBossFloor(10), true);
  assert.equal(getBossForFloor(10)?.name, 'Rei dos Goblins');
  assert.equal(isMegaBossFloor(50), true);
  assert.equal(getBossForFloor(50)?.name, 'Dragão Glacial');
  assert.equal(getBossForFloor(100)?.name, 'Deus da Masmorra');
  assert.ok(getBossForFloor(110)?.name.includes('Ascendido'));
  assert.equal(getInfiniteModifierForFloor(100), null);
  assert.ok(getInfiniteModifierForFloor(101) !== null);

  const s10 = getEnemyScaling(10, 0);
  const s110 = getEnemyScaling(110, 0);
  assert.ok(s110.hpScale > s10.hpScale * 10);
});

test('level up generator always produces 3 distinct options', () => {
  const opts = generateLevelUpOptions({ luck: 20, currentSkills: { fireball: 1 } });
  assert.equal(opts.length, 3);
  const ids = new Set(opts.map((o) => o.id));
  assert.equal(ids.size, 3);
});

test('equipment generation, upgrade cost, and attack damage crit/boss math work', () => {
  const eq = generateEquipmentItem({ floor: 12, luck: 30, slot: 'weapon', minRarity: 'epic' });
  assert.equal(eq.slot, 'weapon');
  assert.ok((eq.stats.damage ?? 0) > 0);
  assert.ok(getEquipmentUpgradeCost(eq) > 0);

  const critHit = calculateAttackDamage(
    100,
    { critChance: 1, critDamage: 2.0, bossDamageMult: 2.0 },
    true,
    0,
    0,
    () => 0
  );
  assert.equal(critHit.isCrit, true);
  assert.equal(critHit.damage, 400);
});

test('dungeon layout guarantees safe player spawn clearance from walls, pillars, and enemies', () => {
  const layout = generateDungeonLayout(5, false, 12, () => 0.42);
  assert.ok(layout.playerSpawn.x >= layout.tileSize * 2);
  assert.ok(layout.playerSpawn.y <= layout.roomHeight - layout.tileSize * 2);

  for (const p of layout.pillars) {
    const dist = Math.hypot(p.x - layout.playerSpawn.x, p.y - layout.playerSpawn.y);
    assert.ok(dist >= 160, 'Pillar must not block player spawn');
  }
  for (const e of layout.enemySpawns) {
    const dist = Math.hypot(e.x - layout.playerSpawn.x, e.y - layout.playerSpawn.y);
    assert.ok(dist >= 270, 'Enemies must not spawn on top of player');
  }
});

test('save validation, permanent upgrades, and Ascension rebirth preserve integrity', () => {
  const migrated = validateAndMigrateSave({ crystals: -50, selectedClass: 'invalid_class' });
  assert.equal(migrated.crystals, 0);
  assert.equal(migrated.selectedClass, 'warrior');

  const save = createDefaultSave();
  save.crystals = 100;
  const bought = purchasePermanentUpgrade(save, 'startingDamage');
  assert.ok(bought !== null);
  assert.equal(bought.permanentUpgrades.startingDamage, 1);
  assert.ok(bought.crystals < 100);

  assert.equal(canPerformAscension(bought), false);
  bought.bestFloor = 25;
  assert.equal(canPerformAscension(bought), true);
  const ascended = performAscension(bought);
  assert.ok(ascended !== null);
  assert.equal(ascended.ascensionLevel, 1);
  assert.equal(ascended.permanentUpgrades.startingDamage, 0);
  assert.ok(ascended.crystals > bought.crystals);
});

test('rebalance config enforces rarity separation, biome difficulty jumps, wave escalation, and early multiplier gates', () => {
  // Common upgrades are modest while high rarities scale strongly
  assert.ok(RARITY_META.common.statMult < 1);
  assert.ok(RARITY_META.legendary.statMult >= RARITY_META.common.statMult * 3);
  assert.ok(RARITY_META.mythic.statMult > RARITY_META.legendary.statMult);

  // Biome block jump (Floor 11 vs Floor 10) produces a noticeable step-up in enemy HP & damage
  const f1 = getEnemyScaling(1, 0);
  const f10 = getEnemyScaling(10, 0);
  const f11 = getEnemyScaling(11, 0);
  assert.ok(f1.hpScale >= 1.2 && f1.damageScale >= 1.2);
  assert.ok(f11.hpScale > f10.hpScale * 1.18, 'New biome block at Floor 11 should step up enemy HP');
  assert.ok(f11.damageScale > f10.damageScale * 1.12, 'New biome block at Floor 11 should step up enemy damage');
  assert.ok(getEliteChance(11) > getEliteChance(10));

  // Wave plans escalate from 2 waves early to 3 waves with guaranteed elite climax on Floor 4+
  const waveF1 = getFloorWavePlan(1, false);
  const waveF5 = getFloorWavePlan(5, false);
  const waveBoss = getFloorWavePlan(10, true);
  assert.equal(waveF1.waves.length, 2);
  assert.equal(waveF5.waves.length, 3);
  assert.ok(waveF5.waves[2].guaranteedElites >= 1, 'Climax wave on Floor 5 must guarantee an elite');
  assert.equal(waveBoss.waves.length, 1);
  assert.equal(waveBoss.totalEnemies, 1);

  // Early player level (Lv 1) should never receive major multiplicative snowball cards
  for (let i = 0; i < 40; i++) {
    const opts = generateLevelUpOptions({ luck: 0, currentSkills: {}, playerLevel: 1 });
    assert.equal(opts.length, 3);
    assert.ok(
      opts.every((o) => o.kind !== 'multiplier'),
      `Level 1 should be gated below utilityMinLevel (${BALANCE_CONFIG.multiplierGates.utilityMinLevel})`
    );
  }

  // Deterministic modest starter weapon
  const starter = createStarterWeapon('warrior');
  assert.equal(starter.rarity, 'common');
  assert.equal(starter.requiredLevel, 1);
  assert.equal(starter.stats.damage, 4);
});

test('Floor 10 Goblin King stays challenging without unfair 2-shot damage or bloated HP sponge', () => {
  const goblinKing = getBossForFloor(10)!;
  const glacialDragon = getBossForFloor(50)!;
  const f10 = getEnemyScaling(10, 0);
  const f50 = getEnemyScaling(50, 0);
  const bc = BALANCE_CONFIG.bosses;

  const gkHp = Math.round(bc.baseHpAnchor * goblinKing.hpMultiplier * f10.hpScale);
  const gkDmg = Math.round(bc.baseDamageAnchor * goblinKing.damageMultiplier * f10.damageScale);
  const gdHp = Math.round(bc.baseHpAnchor * glacialDragon.hpMultiplier * f50.hpScale);

  const lv10Warrior = computePlayerStats({
    classId: 'warrior',
    level: 10,
    mods: { ...createEmptyModifiers(), damagePct: 0.35, maxHpPct: 0.2 },
    equipped: { weapon: createStarterWeapon('warrior') },
    permanent: createDefaultPermanentUpgrades(),
    ascensionLevel: 0,
    activeSynergies: [],
    skills: { shadow_slash: 2 },
  });

  // Challenging HP band (~3,000 - 4,800 HP) and fair punishing hits (4-6 hits to kill hero, never 2-shot)
  assert.ok(gkHp >= 3000 && gkHp <= 4800, `Goblin King HP (${gkHp}) should sit in the fair milestone band`);
  const effectiveHit = gkDmg * (1 - lv10Warrior.damageReduction);
  const hitsToKillWarrior = lv10Warrior.maxHp / effectiveHit;
  assert.ok(
    hitsToKillWarrior >= 4.2 && hitsToKillWarrior <= 7.5,
    `Goblin King hits-to-kill Lv10 Warrior (${hitsToKillWarrior.toFixed(2)}) should punish mistakes without 2-shotting`
  );
  assert.ok(gdHp > gkHp * 20, 'Floor 50 Mega-Boss must scale steeply above Floor 10 mini-boss');
});

test('combo multiplier escalates across hit streak tiers and stays inactive below minimum threshold', () => {
  assert.ok(COMBO_WINDOW_SEC > 1.5 && COMBO_WINDOW_SEC <= 4);
  assert.equal(COMBO_MIN_HITS, 3);
  assert.equal(computeComboMultiplier(0), 1);
  assert.equal(computeComboMultiplier(2), 1);
  assert.equal(computeComboMultiplier(3), 1.1);
  assert.equal(computeComboMultiplier(5), 1.1);
  assert.equal(computeComboMultiplier(6), 1.25);
  assert.equal(computeComboMultiplier(9), 1.25);
  assert.equal(computeComboMultiplier(10), 1.5);
  assert.equal(computeComboMultiplier(15), 1.75);
  assert.equal(computeComboMultiplier(25), 2.0);
  assert.equal(computeComboMultiplier(80), 2.0);
});


