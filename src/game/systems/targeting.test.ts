import test from 'node:test';
import assert from 'node:assert/strict';
import { computePlayerStats, createEmptyModifiers } from './balance';
import { createDefaultPermanentUpgrades, createDefaultSettings } from './saveManager';
import {
  computeBasicAttackSpec,
  computeDashGeometrySpec,
  computeSkillGeometrySpec,
  evaluateSkillCast,
  findConeTargets,
  raycastObstacles,
  resolveCastMode,
  selectAutoAttackTarget,
  type ObstaclePillar,
  type TargetableEnemy,
} from './targeting';

function makeStats(classId: 'warrior' | 'mage' | 'archer' | 'assassin' | 'necromancer', rangePct = 0, extraProj = 0) {
  const mods = createEmptyModifiers();
  mods.rangePct = rangePct;
  mods.extraProjectiles = extraProj;
  const stats = computePlayerStats({
    classId,
    level: 5,
    mods,
    equipped: {},
    permanent: createDefaultPermanentUpgrades(),
    ascensionLevel: 0,
    activeSynergies: [],
    skills: {},
    furyActive: false,
  });
  return { stats, mods };
}

test('raycastObstacles stops accurately at pillars and room perimeter walls', () => {
  const pillars: ObstaclePillar[] = [{ x: 500, y: 300, w: 64, h: 64 }];
  // Aim right straight into the pillar from x=300, y=300
  const pillarHit = raycastObstacles(300, 300, 0, 600, 1280, 960, pillars);
  assert.equal(pillarHit.blocked, true);
  assert.equal(pillarHit.blockerKind, 'pillar');
  assert.equal(pillarHit.blockerPillarIndex, 0);
  assert.ok(Math.abs(pillarHit.endX - 468) < 0.01, `expected pillar west edge 468, got ${pillarHit.endX}`);

  // Aim up straight into north room wall (margin 56)
  const wallHit = raycastObstacles(300, 300, -Math.PI / 2, 600, 1280, 960, pillars);
  assert.equal(wallHit.blocked, true);
  assert.equal(wallHit.blockerKind, 'wall');
  assert.ok(Math.abs(wallHit.endY - 56) < 0.01, `expected north wall margin 56, got ${wallHit.endY}`);
});

test('auto-attack prioritizes cursor direction, respects range/alive checks, falls back to nearest, and applies hysteresis', () => {
  const { stats } = makeStats('mage');
  const spec = computeBasicAttackSpec('mage', stats, {}, false);
  const origin = { x: 400, y: 400 };
  const enemies: TargetableEnemy[] = [
    { id: 1, x: 520, y: 400, radius: 18, maxHp: 100, hp: 100, dying: false, isBoss: false, isElite: false }, // East (in range)
    { id: 2, x: 400, y: 260, radius: 18, maxHp: 100, hp: 100, dying: false, isBoss: false, isElite: false }, // North (in range)
    { id: 3, x: 950, y: 400, radius: 18, maxHp: 100, hp: 100, dying: false, isBoss: false, isElite: false }, // Far East (out of range)
    { id: 4, x: 450, y: 400, radius: 18, maxHp: 100, hp: 0, dying: true, isBoss: false, isElite: false }, // Dead
  ];

  // Aiming North selects enemy #2 even though #1 is slightly closer
  const northPick = selectAutoAttackTarget(origin, { x: 400, y: 200 }, spec, enemies, null, true, 1280, 960, []);
  assert.equal(northPick.targetId, 2);
  assert.ok(!northPick.inRangeIds.includes(3), 'out-of-range enemy must not be eligible');
  assert.ok(!northPick.inRangeIds.includes(4), 'dying enemy must not be eligible');

  // Aiming South (no enemy in cursor cone) falls back to nearest eligible in-range enemy (#1 at dist 120 vs #2 at 140)
  const fallbackPick = selectAutoAttackTarget(origin, { x: 400, y: 650 }, spec, enemies, null, true, 1280, 960, []);
  assert.equal(fallbackPick.targetId, 1);

  // Hysteresis prevents flickering: if prevTargetId is #2 (dist 140 vs #1 at 120), #2 stays locked when aiming South
  const stickyPick = selectAutoAttackTarget(origin, { x: 400, y: 650 }, spec, enemies, 2, true, 1280, 960, []);
  assert.equal(stickyPick.targetId, 2);

  // Disabled auto-attack selects null unless hovering directly over a valid in-range enemy
  const manualNoHover = selectAutoAttackTarget(origin, { x: 400, y: 650 }, spec, enemies, 1, false, 1280, 960, []);
  assert.equal(manualNoHover.targetId, null);
  const manualHover = selectAutoAttackTarget(origin, { x: 520, y: 400 }, spec, enemies, null, false, 1280, 960, []);
  assert.equal(manualHover.targetId, 1);
  assert.equal(manualHover.hoveredInRange, true);

  // Hovering an out-of-range enemy flags hoveredInRange = false and does NOT lock it
  const outHover = selectAutoAttackTarget(origin, { x: 950, y: 400 }, spec, enemies, null, false, 1280, 960, []);
  assert.equal(outHover.hoveredId, 3);
  assert.equal(outHover.hoveredInRange, false);
  assert.equal(outHover.targetId, null);
});

test('all 8 indicator geometries match real skill parameters and scale dynamically with upgrades/evolutions', () => {
  const origin = { x: 400, y: 400 };
  const baseMage = makeStats('mage', 0);
  const upgradedMage = makeStats('mage', 0.4);

  // 1. Cone (Warrior melee cleave)
  const warrior = makeStats('warrior', 0.25);
  const basicMelee = computeBasicAttackSpec('warrior', warrior.stats, {}, false);
  assert.equal(basicMelee.shape, 'cone');
  const coneEnemies: TargetableEnemy[] = [
    { id: 10, x: 490, y: 400, radius: 18, maxHp: 100, hp: 100, dying: false, isBoss: false, isElite: false },
    { id: 11, x: 250, y: 400, radius: 18, maxHp: 100, hp: 100, dying: false, isBoss: false, isElite: false }, // behind
  ];
  const coneHits = findConeTargets(origin, 0, basicMelee.range, basicMelee.halfAngle, basicMelee.closeRadius, coneEnemies);
  assert.deepEqual(coneHits.map((e) => e.id), [10]);

  // 2. Linear (Shadow Slash Lv1 vs Lv4 + Vampiric Aura synergy)
  const slashLv1 = computeSkillGeometrySpec('shadow_slash', 1, baseMage.stats, baseMage.mods, []);
  const slashLv4 = computeSkillGeometrySpec('shadow_slash', 4, upgradedMage.stats, upgradedMage.mods, ['vampiric_aura']);
  assert.equal(slashLv1.shape, 'line');
  assert.equal(slashLv1.rayAngles.length, 1);
  assert.equal(slashLv4.rayAngles.length, 2);
  assert.ok(slashLv4.range > slashLv1.range, 'rangePct must extend linear slash preview');
  assert.equal(slashLv4.secondaryAuraRadius, 130);

  // 3. Projectile + Obstacle & Explosion (Fireball Lv1 vs Lv4 vs Lv7)
  const fbLv1 = computeSkillGeometrySpec('fireball', 1, baseMage.stats, baseMage.mods, []);
  const fbLv7 = computeSkillGeometrySpec('fireball', 7, upgradedMage.stats, upgradedMage.mods, []);
  assert.equal(fbLv1.shape, 'projectile');
  assert.equal(fbLv1.rayAngles.length, 1);
  assert.equal(fbLv7.rayAngles.length, 3);
  assert.ok(fbLv7.explosiveRadius > fbLv1.explosiveRadius);

  const splashTargets: TargetableEnemy[] = [
    { id: 20, x: 560, y: 400, radius: 16, maxHp: 100, hp: 100, dying: false, isBoss: false, isElite: false },
    { id: 21, x: 585, y: 445, radius: 16, maxHp: 100, hp: 100, dying: false, isBoss: false, isElite: false }, // inside 70px splash
  ];
  const fbEval = evaluateSkillCast(fbLv1, origin, { x: 650, y: 400 }, splashTargets, 1280, 960, [], 0);
  assert.ok(fbEval.affectedEnemyIds.includes(20) && fbEval.affectedEnemyIds.includes(21));

  // 4. Circle AoE (Black Hole clamps & flags outOfRange when cursor exceeds castRange)
  const bhSpec = computeSkillGeometrySpec('black_hole', 4, baseMage.stats, baseMage.mods, []);
  assert.equal(bhSpec.shape, 'circle');
  const bhOut = evaluateSkillCast(bhSpec, origin, { x: 950, y: 400 }, [], 1280, 960, [], 0);
  assert.equal(bhOut.outOfRange, true);
  assert.ok(Math.abs(bhOut.targetPoint.x - (origin.x + bhSpec.castRange)) < 0.5);

  // 5. Targeted (Celestial Bolt requires enemy in castRange, invalid when none)
  const cbSpec = computeSkillGeometrySpec('celestial_bolt', 1, baseMage.stats, baseMage.mods, []);
  assert.equal(cbSpec.shape, 'targeted');
  const cbNone = evaluateSkillCast(cbSpec, origin, { x: 500, y: 400 }, [], 1280, 960, [], 0);
  assert.equal(cbNone.valid, false);
  assert.equal(cbNone.invalidReason, 'no_target');
  const cbHit = evaluateSkillCast(cbSpec, origin, { x: 560, y: 400 }, splashTargets, 1280, 960, [], 0);
  assert.equal(cbHit.valid, true);
  assert.equal(cbHit.directedTargets[0].id, 20);

  // 6. Aura (Arcane Blast expands with rangePct & skill level)
  const abLv1 = computeSkillGeometrySpec('arcane_blast', 1, baseMage.stats, baseMage.mods, []);
  const abLv7 = computeSkillGeometrySpec('arcane_blast', 7, upgradedMage.stats, upgradedMage.mods, []);
  assert.equal(abLv1.shape, 'aura');
  assert.ok(abLv7.radius > abLv1.radius);

  // 7. Chain Lightning (predicts exact multi-hop sequence)
  const clSpec = computeSkillGeometrySpec('chain_lightning', 1, baseMage.stats, baseMage.mods, []);
  assert.equal(clSpec.shape, 'chain');
  const chainEnemies: TargetableEnemy[] = [
    { id: 30, x: 520, y: 400, radius: 16, maxHp: 100, hp: 100, dying: false, isBoss: false, isElite: false },
    { id: 31, x: 680, y: 430, radius: 16, maxHp: 100, hp: 100, dying: false, isBoss: false, isElite: false },
    { id: 32, x: 820, y: 410, radius: 16, maxHp: 100, hp: 100, dying: false, isBoss: false, isElite: false },
  ];
  const clEval = evaluateSkillCast(clSpec, origin, { x: 520, y: 400 }, chainEnemies, 1280, 960, [], 0);
  assert.equal(clEval.valid, true);
  assert.deepEqual(clEval.chainPath.map((n) => n.id), [30, 31, 32]);

  // 8. Dash (exact moveSpeed * 3.1 * 0.17 distance clipped by pillar)
  const dashSpec = computeDashGeometrySpec(baseMage.stats);
  assert.equal(dashSpec.shape, 'dash');
  const pillarBlock: ObstaclePillar[] = [{ x: 470, y: 400, w: 64, h: 64 }];
  const dashEval = evaluateSkillCast(dashSpec, origin, { x: 700, y: 400 }, [], 1280, 960, pillarBlock, 0);
  assert.equal(dashEval.rays[0].raycast.blocked, true);
  assert.ok(dashEval.targetPoint.x < 470 - 32, 'dash stop must respect pillar & hero body padding');

  // Cooldown check marks evaluation onCooldown and invalid
  const cdEval = evaluateSkillCast(abLv1, origin, { x: 450, y: 400 }, [], 1280, 960, [], 2.4);
  assert.equal(cdEval.onCooldown, true);
  assert.equal(cdEval.valid, false);
  assert.equal(cdEval.invalidReason, 'cooldown');
});

test('per-skill cast modes default to quick_indicator and respect individual overrides', () => {
  const settings = createDefaultSettings();
  assert.equal(settings.defaultCastMode, 'quick_indicator');
  assert.equal(resolveCastMode(settings, 'skill', 'fireball'), 'quick_indicator');
  assert.equal(resolveCastMode(settings, 'dash', null), 'quick_indicator');

  settings.skillCastModes = { fireball: 'normal', shadow_slash: 'quick' };
  settings.dashCastMode = 'quick';
  assert.equal(resolveCastMode(settings, 'skill', 'fireball'), 'normal');
  assert.equal(resolveCastMode(settings, 'skill', 'shadow_slash'), 'quick');
  assert.equal(resolveCastMode(settings, 'skill', 'black_hole'), 'quick_indicator');
  assert.equal(resolveCastMode(settings, 'dash', null), 'quick');
});
