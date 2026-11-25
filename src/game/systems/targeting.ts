import { CLASSES } from '../data/classes';
import { SKILLS } from '../data/skills';
import type {
  CastMode,
  ClassId,
  ComputedPlayerStats,
  SettingsData,
  SkillId,
  StatModifiers,
  SynergyId,
} from '../types';

export interface Vec2 {
  x: number;
  y: number;
}

export interface ObstaclePillar {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TargetableEnemy {
  id: number;
  x: number;
  y: number;
  radius: number;
  maxHp: number;
  hp: number;
  dying: boolean;
  isBoss: boolean;
  isElite: boolean;
  name?: string;
}

export interface RaycastHit {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  distance: number;
  maxDistance: number;
  blocked: boolean;
  blockerKind: 'wall' | 'pillar' | null;
  blockerPillarIndex: number;
}

export type IndicatorShape =
  | 'cone'
  | 'line'
  | 'projectile'
  | 'circle'
  | 'targeted'
  | 'aura'
  | 'dash'
  | 'chain';

export interface BasicAttackSpec {
  style: 'melee_cleave' | 'twin_dagger' | 'arcane_bolt' | 'soul_orb' | 'multi_arrow';
  shape: 'cone' | 'projectile';
  range: number;
  halfAngle: number; // radians (for cone)
  closeRadius: number; // guaranteed point-blank hit radius (for cone)
  projCount: number;
  spread: number; // total fan angle in radians
  speed: number;
  life: number;
  spawnOffset: number;
  hitHalfWidth: number;
  pierce: number;
  explosiveRadius: number;
  bonusShockwave: boolean;
  accentColor: number;
}

export interface SkillGeometrySpec {
  kind: 'skill' | 'dash';
  skillId: SkillId | null;
  shape: IndicatorShape;
  color: number;
  // Linear / Projectile / Cone / Dash
  range: number;
  halfWidth: number;
  halfAngle: number;
  closeRadius: number;
  rayAngles: number[]; // relative offsets from aim angle
  speed: number;
  life: number;
  spawnOffset: number;
  pierce: number;
  explosiveRadius: number;
  // Circle / Aura / Targeted
  castRange: number;
  radius: number;
  subRadius: number;
  secondaryAuraRadius: number;
  count: number;
  // Chain
  jumpRange: number;
  maxJumps: number;
  // Dash physics
  dashDuration: number;
  dashSpeed: number;
  bodyPadding: number;
}

export interface RayEvaluation {
  angle: number;
  raycast: RaycastHit;
  stopX: number;
  stopY: number;
  stoppedByEnemyId: number | null;
  hitEnemyIds: number[];
  explosionAffectedIds: number[];
}

export interface CastEvaluation {
  spec: SkillGeometrySpec;
  origin: Vec2;
  cursor: Vec2;
  aimAngle: number;
  targetPoint: Vec2;
  cursorDistance: number;
  outOfRange: boolean;
  onCooldown: boolean;
  cooldownRemaining: number;
  valid: boolean;
  invalidReason: 'ready' | 'cooldown' | 'out_of_range' | 'no_target';
  rays: RayEvaluation[];
  chainPath: Array<{ id: number; x: number; y: number; radius: number }>;
  directedTargets: Array<{ id: number; x: number; y: number; radius: number }>;
  affectedEnemyIds: number[];
  blockedPillarIndices: number[];
}

export interface AutoTargetResult {
  targetId: number | null;
  target: TargetableEnemy | null;
  hoveredId: number | null;
  hoveredEnemy: TargetableEnemy | null;
  hoveredInRange: boolean;
  inRangeIds: number[];
  aimAngle: number;
  effectiveRange: number;
}

export const PROJECTILE_WALL_MARGIN = 56;
export const PROJECTILE_HIT_RADIUS = 14;
export const PROJECTILE_SPAWN_OFFSET = 20;
export const HERO_BODY_PADDING = 15;
export const DASH_DURATION_SEC = 0.17;
export const DASH_SPEED_MULT = 3.1;
export const MELEE_CONE_HALF_ANGLE = 1.25;
export const MELEE_CLOSE_RADIUS = 44;

export function wrapAngle(rad: number): number {
  let a = rad;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function hexToInt(hex: string): number {
  const clean = hex.startsWith('#') ? hex.slice(1) : hex;
  const parsed = Number.parseInt(clean, 16);
  return Number.isFinite(parsed) ? parsed : 0xd4a64a;
}

export function resolveCastMode(
  settings: SettingsData,
  kind: 'skill' | 'dash',
  skillId: SkillId | null
): CastMode {
  if (kind === 'dash') {
    return settings.dashCastMode ?? settings.defaultCastMode ?? 'quick_indicator';
  }
  if (skillId && settings.skillCastModes?.[skillId]) {
    return settings.skillCastModes[skillId]!;
  }
  return settings.defaultCastMode ?? 'quick_indicator';
}

/**
 * Computes exact ray intersection against room perimeter walls and internal gothic pillars.
 * Matches DungeonScene.updateProjectiles() wall/pillar collision bounds identically.
 */
export function raycastObstacles(
  x0: number,
  y0: number,
  angle: number,
  maxDist: number,
  roomWidth: number,
  roomHeight: number,
  pillars: ObstaclePillar[],
  padding = 0,
  wallMargin = PROJECTILE_WALL_MARGIN
): RaycastHit {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let bestT = Math.max(0, maxDist);
  let blocked = false;
  let blockerKind: 'wall' | 'pillar' | null = null;
  let blockerPillarIndex = -1;

  const minX = wallMargin + padding;
  const maxX = Math.max(minX, roomWidth - wallMargin - padding);
  const minY = wallMargin + padding;
  const maxY = Math.max(minY, roomHeight - wallMargin - padding);

  // Room boundary planes
  if (Math.abs(dx) > 1e-6) {
    const tx = dx > 0 ? (maxX - x0) / dx : (minX - x0) / dx;
    if (tx >= 0 && tx < bestT) {
      bestT = tx;
      blocked = true;
      blockerKind = 'wall';
      blockerPillarIndex = -1;
    }
  }
  if (Math.abs(dy) > 1e-6) {
    const ty = dy > 0 ? (maxY - y0) / dy : (minY - y0) / dy;
    if (ty >= 0 && ty < bestT) {
      bestT = ty;
      blocked = true;
      blockerKind = 'wall';
      blockerPillarIndex = -1;
    }
  }

  // Pillar AABB slab intersection
  for (let i = 0; i < pillars.length; i++) {
    const p = pillars[i];
    const rxMin = p.x - p.w * 0.5 - padding;
    const rxMax = p.x + p.w * 0.5 + padding;
    const ryMin = p.y - p.h * 0.5 - padding;
    const ryMax = p.y + p.h * 0.5 + padding;

    let tMin = 0;
    let tMax = bestT;

    if (Math.abs(dx) < 1e-6) {
      if (x0 < rxMin || x0 > rxMax) continue;
    } else {
      const invD = 1 / dx;
      let t1 = (rxMin - x0) * invD;
      let t2 = (rxMax - x0) * invD;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      tMin = Math.max(tMin, t1);
      tMax = Math.min(tMax, t2);
      if (tMin > tMax) continue;
    }

    if (Math.abs(dy) < 1e-6) {
      if (y0 < ryMin || y0 > ryMax) continue;
    } else {
      const invD = 1 / dy;
      let t1 = (ryMin - y0) * invD;
      let t2 = (ryMax - y0) * invD;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      tMin = Math.max(tMin, t1);
      tMax = Math.min(tMax, t2);
      if (tMin > tMax) continue;
    }

    if (tMin >= 0 && tMin < bestT) {
      bestT = tMin;
      blocked = true;
      blockerKind = 'pillar';
      blockerPillarIndex = i;
    }
  }

  return {
    startX: x0,
    startY: y0,
    endX: x0 + dx * bestT,
    endY: y0 + dy * bestT,
    distance: bestT,
    maxDistance: maxDist,
    blocked,
    blockerKind,
    blockerPillarIndex,
  };
}

/**
 * Exact ray-vs-circle intersection distance along segment [0, maxDist].
 * Returns entry distance t in [0, maxDist] or null if no hit.
 */
export function rayCircleIntersectDist(
  x0: number,
  y0: number,
  dx: number,
  dy: number,
  maxDist: number,
  cx: number,
  cy: number,
  radius: number
): number | null {
  const fx = x0 - cx;
  const fy = y0 - cy;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - radius * radius;
  if (c <= 0) return 0; // Origin already inside circle
  const disc = b * b - 4 * c;
  if (disc < 0) return null;
  const sqrtD = Math.sqrt(disc);
  const t1 = (-b - sqrtD) * 0.5;
  if (t1 >= 0 && t1 <= maxDist) return t1;
  const t2 = (-b + sqrtD) * 0.5;
  if (t2 >= 0 && t2 <= maxDist) return t2;
  return null;
}

/**
 * Unified Basic Attack geometry used identically by combat execution,
 * range indicator, auto-attack eligibility, and hit detection.
 */
export function computeBasicAttackSpec(
  classId: ClassId,
  stats: ComputedPlayerStats,
  skills: Partial<Record<SkillId, number>>,
  furyActive: boolean
): BasicAttackSpec {
  const cls = CLASSES[classId];
  const projCount = Math.max(1, stats.projectiles);
  const accentColor = hexToInt(cls.accentColor);

  if (cls.attackStyle === 'melee_cleave') {
    return {
      style: 'melee_cleave',
      shape: 'cone',
      range: stats.range,
      halfAngle: MELEE_CONE_HALF_ANGLE,
      closeRadius: MELEE_CLOSE_RADIUS,
      projCount,
      spread: 0,
      speed: 0,
      life: 0,
      spawnOffset: 0,
      hitHalfWidth: PROJECTILE_HIT_RADIUS,
      pierce: 0,
      explosiveRadius: 0,
      bonusShockwave: projCount > 1 || (furyActive && (skills.demonic_fury ?? 0) >= 7),
      accentColor,
    };
  }

  const speed =
    cls.attackStyle === 'multi_arrow'
      ? 660
      : cls.attackStyle === 'twin_dagger'
        ? 590
        : 510;
  const life = Math.max(0.32, stats.range / speed);
  const effectiveRange = PROJECTILE_SPAWN_OFFSET + speed * life;
  const spread = projCount === 1 ? 0 : Math.min(0.45, 0.13 * (projCount - 1));

  return {
    style: cls.attackStyle,
    shape: 'projectile',
    range: effectiveRange,
    halfAngle: 0,
    closeRadius: 0,
    projCount,
    spread,
    speed,
    life,
    spawnOffset: PROJECTILE_SPAWN_OFFSET,
    hitHalfWidth: PROJECTILE_HIT_RADIUS,
    pierce: stats.piercing,
    explosiveRadius: cls.attackStyle === 'arcane_bolt' ? 38 : 0,
    bonusShockwave: false,
    accentColor,
  };
}

/**
 * Computes exact Dash geometry from real player movement speed & dash duration.
 */
export function computeDashGeometrySpec(stats: ComputedPlayerStats): SkillGeometrySpec {
  const dashSpeed = stats.moveSpeed * DASH_SPEED_MULT;
  const dashDistance = dashSpeed * DASH_DURATION_SEC;
  return {
    kind: 'dash',
    skillId: null,
    shape: 'dash',
    color: 0xc084fc,
    range: dashDistance,
    halfWidth: 16,
    halfAngle: 0,
    closeRadius: 0,
    rayAngles: [0],
    speed: dashSpeed,
    life: DASH_DURATION_SEC,
    spawnOffset: 0,
    pierce: 0,
    explosiveRadius: 0,
    castRange: dashDistance,
    radius: 18,
    subRadius: 0,
    secondaryAuraRadius: 0,
    count: 1,
    jumpRange: 0,
    maxJumps: 0,
    dashDuration: DASH_DURATION_SEC,
    dashSpeed,
    bodyPadding: HERO_BODY_PADDING,
  };
}

/**
 * Unified Skill Geometry Spec — SINGLE SOURCE OF TRUTH for both
 * DungeonScene skill execution and TargetingRenderer indicators.
 * Automatically updates with skill level evolutions, rangePct, and synergies.
 */
export function computeSkillGeometrySpec(
  skillId: SkillId,
  level: number,
  stats: ComputedPlayerStats,
  mods: StatModifiers,
  activeSynergies: SynergyId[]
): SkillGeometrySpec {
  const def = SKILLS[skillId];
  const color = hexToInt(def.color);
  const rangeScale = 1 + Math.max(0, mods.rangePct);
  const lv = Math.max(1, level);

  const base: SkillGeometrySpec = {
    kind: 'skill',
    skillId,
    shape: 'aura',
    color,
    range: 0,
    halfWidth: PROJECTILE_HIT_RADIUS,
    halfAngle: 0,
    closeRadius: 0,
    rayAngles: [0],
    speed: 0,
    life: 0,
    spawnOffset: PROJECTILE_SPAWN_OFFSET,
    pierce: 0,
    explosiveRadius: 0,
    castRange: 0,
    radius: 0,
    subRadius: 0,
    secondaryAuraRadius: 0,
    count: 1,
    jumpRange: 0,
    maxJumps: 0,
    dashDuration: 0,
    dashSpeed: 0,
    bodyPadding: 0,
  };

  switch (skillId) {
    case 'fireball': {
      const count = lv >= 4 ? 3 : 1;
      const spread = count === 1 ? 0 : 0.28;
      const rayAngles: number[] = [];
      for (let i = 0; i < count; i++) {
        rayAngles.push(count === 1 ? 0 : -spread / 2 + (spread / (count - 1)) * i);
      }
      const speed = 460;
      const life = 1.4 * (1 + Math.max(0, mods.rangePct) * 0.25);
      const explosiveRadius = Math.round(
        (lv >= 7 ? 115 : lv >= 4 ? 90 : 70) * (1 + Math.max(0, mods.rangePct) * 0.15)
      );
      return {
        ...base,
        shape: 'projectile',
        speed,
        life,
        range: PROJECTILE_SPAWN_OFFSET + speed * life,
        rayAngles,
        count,
        pierce: 0,
        explosiveRadius,
      };
    }

    case 'shadow_slash': {
      const waves = lv >= 4 ? 2 : 1;
      const rayAngles = waves === 2 ? [-0.16, 0.16] : [0];
      const speed = 540;
      const life = 0.55 * (1 + Math.max(0, mods.rangePct) * 0.35);
      return {
        ...base,
        shape: 'line',
        speed,
        life,
        range: PROJECTILE_SPAWN_OFFSET + speed * life,
        halfWidth: 16,
        rayAngles,
        count: waves,
        pierce: 5,
        secondaryAuraRadius: activeSynergies.includes('vampiric_aura') ? 130 : 0,
      };
    }

    case 'meteor_shower': {
      const count = lv >= 7 ? 8 : lv >= 4 ? 5 : 3;
      const castRange = Math.round(380 * (1 + Math.max(0, mods.rangePct) * 0.25));
      const zoneRadius = Math.round(
        (lv >= 7 ? 210 : lv >= 4 ? 180 : 150) * (1 + Math.max(0, mods.rangePct) * 0.15)
      );
      const subRadius = lv >= 4 ? 86 : 68;
      return {
        ...base,
        shape: 'circle',
        castRange,
        radius: zoneRadius,
        subRadius,
        count,
      };
    }

    case 'black_hole': {
      const castRange = Math.round(300 * (1 + Math.max(0, mods.rangePct) * 0.25));
      const radius = Math.round(
        (lv >= 7 ? 195 : lv >= 4 ? 155 : 125) * (1 + Math.max(0, mods.rangePct) * 0.2)
      );
      return {
        ...base,
        shape: 'circle',
        castRange,
        radius,
        subRadius: 26,
        count: 1,
      };
    }

    case 'chain_lightning': {
      const maxJumps = lv >= 7 ? 11 : lv >= 4 ? 7 : 4;
      const castRange = Math.round(340 * (1 + Math.max(0, mods.rangePct) * 0.25));
      const jumpRange = Math.round(300 * (1 + Math.max(0, mods.rangePct) * 0.2));
      return {
        ...base,
        shape: 'chain',
        castRange,
        jumpRange,
        maxJumps,
        count: maxJumps,
        color: activeSynergies.includes('glacial_storm') ? 0x38bdf8 : color,
      };
    }

    case 'celestial_bolt': {
      const strikes = lv >= 7 ? 5 : lv >= 4 ? 3 : 1;
      const castRange = Math.round(460 * (1 + Math.max(0, mods.rangePct) * 0.25));
      return {
        ...base,
        shape: 'targeted',
        castRange,
        radius: 76,
        subRadius: 76,
        count: strikes,
      };
    }

    case 'arcane_blast': {
      const radius = Math.round((lv >= 7 ? 210 : lv >= 4 ? 175 : 145) * (1 + Math.max(0, mods.rangePct) * 0.5));
      return {
        ...base,
        shape: 'aura',
        radius,
        castRange: radius,
      };
    }

    case 'time_freeze': {
      const radius = Math.round((lv >= 7 ? 420 : 250) * (1 + Math.max(0, mods.rangePct) * 0.2));
      return {
        ...base,
        shape: 'aura',
        radius,
        castRange: radius,
      };
    }

    case 'shadow_summon': {
      const count = lv >= 7 ? 6 : lv >= 4 ? 4 : 2;
      return {
        ...base,
        shape: 'aura',
        radius: 120,
        subRadius: 44,
        castRange: 120,
        count,
      };
    }

    case 'demonic_fury': {
      return {
        ...base,
        shape: 'aura',
        radius: Math.round(92 * Math.min(1.3, 0.9 + rangeScale * 0.1)),
        castRange: 92,
      };
    }

    case 'electric_aura': {
      const radius = lv >= 4 ? 140 : 104;
      return {
        ...base,
        shape: 'aura',
        radius,
        castRange: radius,
      };
    }

    case 'orbital_blades': {
      const radius = lv >= 4 ? 86 : 68;
      return {
        ...base,
        shape: 'aura',
        radius,
        castRange: radius,
        count: lv >= 7 ? 6 : lv >= 4 ? 4 : 2,
      };
    }

    default: {
      return {
        ...base,
        shape: 'aura',
        radius: Math.round(stats.range),
        castRange: Math.round(stats.range),
      };
    }
  }
}

/**
 * Detects which living enemy (if any) is directly underneath the world cursor.
 */
export function findHoveredEnemy(
  cursorX: number,
  cursorY: number,
  enemies: TargetableEnemy[]
): TargetableEnemy | null {
  let best: TargetableEnemy | null = null;
  let bestDist = Infinity;
  for (const e of enemies) {
    if (e.dying) continue;
    const hitR = e.radius + 12;
    const d = Math.hypot(e.x - cursorX, e.y - cursorY);
    if (d <= hitR && d < bestDist) {
      bestDist = d;
      best = e;
    }
  }
  return best;
}

/**
 * Predicts exact melee cone targets — matches DungeonScene.performBasicAttack() melee hit loop.
 */
export function findConeTargets(
  origin: Vec2,
  aimAngle: number,
  range: number,
  halfAngle: number,
  closeRadius: number,
  enemies: TargetableEnemy[]
): TargetableEnemy[] {
  const hits: TargetableEnemy[] = [];
  for (const e of enemies) {
    if (e.dying) continue;
    const dist = Math.hypot(e.x - origin.x, e.y - origin.y);
    if (dist <= range + e.radius) {
      const angTo = Math.atan2(e.y - origin.y, e.x - origin.x);
      const diff = Math.abs(wrapAngle(angTo - aimAngle));
      if (diff <= halfAngle || dist < closeRadius) {
        hits.push(e);
      }
    }
  }
  return hits;
}

/**
 * Evaluates a single projectile or linear wave lane with exact obstacle raycast
 * and exact enemy hit prediction (piercing or stop-on-first + explosion splash).
 */
export function evaluateRayLane(
  origin: Vec2,
  angle: number,
  spawnOffset: number,
  totalRange: number,
  hitHalfWidth: number,
  pierce: number,
  explosiveRadius: number,
  enemies: TargetableEnemy[],
  roomWidth: number,
  roomHeight: number,
  pillars: ObstaclePillar[]
): RayEvaluation {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const sx = origin.x + dx * spawnOffset;
  const sy = origin.y + dy * spawnOffset;
  const travelMax = Math.max(0, totalRange - spawnOffset);

  const raycast = raycastObstacles(sx, sy, angle, travelMax, roomWidth, roomHeight, pillars, 0, PROJECTILE_WALL_MARGIN);

  const candidates: Array<{ enemy: TargetableEnemy; t: number }> = [];
  for (const e of enemies) {
    if (e.dying) continue;
    const t = rayCircleIntersectDist(sx, sy, dx, dy, raycast.distance, e.x, e.y, e.radius + hitHalfWidth);
    if (t !== null) {
      candidates.push({ enemy: e, t });
    }
  }
  candidates.sort((a, b) => a.t - b.t);

  const maxHits = pierce + 1;
  const hitEnemyIds: number[] = [];
  const explosionAffectedIds = new Set<number>();
  let stopX = raycast.endX;
  let stopY = raycast.endY;
  let stoppedByEnemyId: number | null = null;

  for (let i = 0; i < candidates.length && i < maxHits; i++) {
    const c = candidates[i];
    hitEnemyIds.push(c.enemy.id);
    const ix = sx + dx * c.t;
    const iy = sy + dy * c.t;

    if (explosiveRadius > 0) {
      for (const e of enemies) {
        if (e.dying) continue;
        if (Math.hypot(e.x - ix, e.y - iy) <= explosiveRadius + e.radius) {
          explosionAffectedIds.add(e.id);
        }
      }
    }

    if (i === maxHits - 1) {
      stopX = ix;
      stopY = iy;
      stoppedByEnemyId = c.enemy.id;
    }
  }

  // If explosive projectile hits a wall/pillar or expires without hitting an enemy,
  // still compute impact coordinates cleanly (DungeonScene explodes on enemy hit, sparks on wall).
  return {
    angle,
    raycast,
    stopX,
    stopY,
    stoppedByEnemyId,
    hitEnemyIds,
    explosionAffectedIds: Array.from(explosionAffectedIds),
  };
}

/**
 * Unified Chain Lightning target sequence — used identically by preview AND execution.
 */
export function computeChainTargets(
  origin: Vec2,
  cursor: Vec2,
  castRange: number,
  jumpRange: number,
  maxJumps: number,
  enemies: TargetableEnemy[]
): Array<{ id: number; x: number; y: number; radius: number }> {
  const living = enemies.filter((e) => !e.dying);
  if (living.length === 0 || maxJumps <= 0) return [];

  // Step 1: Pick initial enemy inside castRange closest to cursor (prioritizing hovered enemy)
  let first: TargetableEnemy | null = null;
  let bestScore = Infinity;
  for (const e of living) {
    const dPlayer = Math.hypot(e.x - origin.x, e.y - origin.y);
    if (dPlayer > castRange + e.radius) continue;
    const dCursor = Math.hypot(e.x - cursor.x, e.y - cursor.y);
    const hoverBonus = dCursor <= e.radius + 14 ? -1000 : 0;
    const score = dCursor + dPlayer * 0.18 + hoverBonus;
    if (score < bestScore) {
      bestScore = score;
      first = e;
    }
  }
  if (!first) return [];

  const path: Array<{ id: number; x: number; y: number; radius: number }> = [
    { id: first.id, x: first.x, y: first.y, radius: first.radius },
  ];
  const hitSet = new Set<number>([first.id]);
  let curX = first.x;
  let curY = first.y;

  for (let j = 1; j < maxJumps; j++) {
    let best: TargetableEnemy | null = null;
    let bestD = jumpRange;
    for (const e of living) {
      if (hitSet.has(e.id)) continue;
      const d = Math.hypot(e.x - curX, e.y - curY);
      if (d <= bestD) {
        bestD = d;
        best = e;
      }
    }
    if (!best) break;
    hitSet.add(best.id);
    path.push({ id: best.id, x: best.x, y: best.y, radius: best.radius });
    curX = best.x;
    curY = best.y;
  }

  return path;
}

/**
 * Unified Directed Single/Multi-Target lock (Celestial Bolt).
 * Prioritizes enemy closest to cursor within castRange, then strongest remaining targets in range.
 */
export function computeDirectedTargets(
  origin: Vec2,
  cursor: Vec2,
  castRange: number,
  strikes: number,
  enemies: TargetableEnemy[]
): Array<{ id: number; x: number; y: number; radius: number }> {
  const inRange = enemies.filter(
    (e) => !e.dying && Math.hypot(e.x - origin.x, e.y - origin.y) <= castRange + e.radius
  );
  if (inRange.length === 0 || strikes <= 0) return [];

  // Primary target = closest to cursor (strong preference for directly hovered foe)
  const sortedPrimary = [...inRange].sort((a, b) => {
    const da = Math.hypot(a.x - cursor.x, a.y - cursor.y);
    const db = Math.hypot(b.x - cursor.x, b.y - cursor.y);
    return da - db;
  });

  const primary = sortedPrimary[0];
  const others = inRange
    .filter((e) => e.id !== primary.id)
    .sort((a, b) => (b.isBoss ? 1 : 0) - (a.isBoss ? 1 : 0) || b.maxHp - a.maxHp);

  const ordered = [primary, ...others];
  const result: Array<{ id: number; x: number; y: number; radius: number }> = [];
  for (let i = 0; i < strikes; i++) {
    const t = ordered[i % ordered.length];
    result.push({ id: t.id, x: t.x, y: t.y, radius: t.radius });
  }
  return result;
}

/**
 * Smart Auto-Attack Target Selection with Cursor-Direction Priority & Anti-Jitter Hysteresis.
 * - Never selects dead or out-of-range enemies.
 * - Strongly prioritizes hovered valid enemy & enemies aligned with cursor direction.
 * - Falls back to nearest eligible in-range enemy when autoAttack is ON.
 * - Applies hysteresis stickiness to prevTargetId so target lock does not flicker rapidly.
 */
export function selectAutoAttackTarget(
  origin: Vec2,
  cursorWorld: Vec2,
  basicSpec: BasicAttackSpec,
  enemies: TargetableEnemy[],
  prevTargetId: number | null,
  autoAttackEnabled: boolean,
  roomWidth: number,
  roomHeight: number,
  pillars: ObstaclePillar[]
): AutoTargetResult {
  const cursorAngle = Math.atan2(cursorWorld.y - origin.y, cursorWorld.x - origin.x);
  const hoveredEnemy = findHoveredEnemy(cursorWorld.x, cursorWorld.y, enemies);
  const effectiveRange = basicSpec.range;

  const inRangeEnemies: TargetableEnemy[] = [];
  const inRangeIds: number[] = [];

  for (const e of enemies) {
    if (e.dying) continue;
    const dist = Math.hypot(e.x - origin.x, e.y - origin.y);
    if (dist <= effectiveRange + e.radius) {
      inRangeEnemies.push(e);
      inRangeIds.push(e.id);
    }
  }

  const hoveredInRange = Boolean(
    hoveredEnemy && Math.hypot(hoveredEnemy.x - origin.x, hoveredEnemy.y - origin.y) <= effectiveRange + hoveredEnemy.radius
  );

  // If hovering a valid in-range enemy, immediately honor cursor intent
  if (hoveredEnemy && hoveredInRange) {
    return {
      targetId: hoveredEnemy.id,
      target: hoveredEnemy,
      hoveredId: hoveredEnemy.id,
      hoveredEnemy,
      hoveredInRange: true,
      inRangeIds,
      aimAngle: Math.atan2(hoveredEnemy.y - origin.y, hoveredEnemy.x - origin.x),
      effectiveRange,
    };
  }

  if (!autoAttackEnabled || inRangeEnemies.length === 0) {
    return {
      targetId: null,
      target: null,
      hoveredId: hoveredEnemy?.id ?? null,
      hoveredEnemy,
      hoveredInRange,
      inRangeIds,
      aimAngle: cursorAngle,
      effectiveRange,
    };
  }

  const isRanged = basicSpec.shape === 'projectile';
  const cursorConeRad = 0.85; // ~48 degrees around cursor aim line

  // Check line-of-sight cleanly for ranged classes so auto-attack prefers unobstructed foes
  const hasLineOfSight = (e: TargetableEnemy): boolean => {
    if (!isRanged) return true;
    const ang = Math.atan2(e.y - origin.y, e.x - origin.x);
    const dist = Math.hypot(e.x - origin.x, e.y - origin.y);
    const hit = raycastObstacles(
      origin.x + Math.cos(ang) * basicSpec.spawnOffset,
      origin.y + Math.sin(ang) * basicSpec.spawnOffset,
      ang,
      Math.max(0, dist - basicSpec.spawnOffset),
      roomWidth,
      roomHeight,
      pillars
    );
    return !hit.blocked;
  };

  // Bucket 1: Enemies aligned with cursor direction
  const directionalCandidates: Array<{ e: TargetableEnemy; score: number }> = [];
  const fallbackCandidates: Array<{ e: TargetableEnemy; score: number }> = [];

  for (const e of inRangeEnemies) {
    const dist = Math.hypot(e.x - origin.x, e.y - origin.y);
    const ang = Math.atan2(e.y - origin.y, e.x - origin.x);
    const angDiff = Math.abs(wrapAngle(ang - cursorAngle));
    const distToCursor = Math.hypot(e.x - cursorWorld.x, e.y - cursorWorld.y);
    const clearLos = hasLineOfSight(e);
    const losPenalty = clearLos ? 0 : 220;
    const hysteresisBonus = prevTargetId === e.id ? -58 : 0;

    if (angDiff <= cursorConeRad || distToCursor <= 115) {
      const score = angDiff * 140 + distToCursor * 0.35 + dist * 0.25 + losPenalty + hysteresisBonus;
      directionalCandidates.push({ e, score });
    }
    const fallbackScore = dist + losPenalty + hysteresisBonus;
    fallbackCandidates.push({ e, score: fallbackScore });
  }

  let chosen: TargetableEnemy | null = null;
  if (directionalCandidates.length > 0) {
    directionalCandidates.sort((a, b) => a.score - b.score);
    chosen = directionalCandidates[0].e;
  } else if (fallbackCandidates.length > 0) {
    fallbackCandidates.sort((a, b) => a.score - b.score);
    chosen = fallbackCandidates[0].e;
  }

  return {
    targetId: chosen?.id ?? null,
    target: chosen,
    hoveredId: hoveredEnemy?.id ?? null,
    hoveredEnemy,
    hoveredInRange,
    inRangeIds,
    aimAngle: chosen ? Math.atan2(chosen.y - origin.y, chosen.x - origin.x) : cursorAngle,
    effectiveRange,
  };
}

/**
 * Evaluates a skill or dash preview/execution using the unified SkillGeometrySpec.
 * Computes exact obstacle intersections, target locks, chain paths, affected enemies, and validity.
 */
export function evaluateSkillCast(
  spec: SkillGeometrySpec,
  origin: Vec2,
  cursor: Vec2,
  enemies: TargetableEnemy[],
  roomWidth: number,
  roomHeight: number,
  pillars: ObstaclePillar[],
  cooldownRemaining: number
): CastEvaluation {
  const aimAngle = Math.atan2(cursor.y - origin.y, cursor.x - origin.x);
  const cursorDistance = Math.hypot(cursor.x - origin.x, cursor.y - origin.y);
  const onCooldown = cooldownRemaining > 0.02;

  const affectedSet = new Set<number>();
  const blockedPillarSet = new Set<number>();
  const rays: RayEvaluation[] = [];
  let chainPath: Array<{ id: number; x: number; y: number; radius: number }> = [];
  let directedTargets: Array<{ id: number; x: number; y: number; radius: number }> = [];
  let targetPoint: Vec2 = { x: cursor.x, y: cursor.y };
  let outOfRange = false;
  let noTarget = false;

  switch (spec.shape) {
    case 'cone': {
      const hits = findConeTargets(origin, aimAngle, spec.range, spec.halfAngle, spec.closeRadius, enemies);
      for (const h of hits) affectedSet.add(h.id);
      targetPoint = {
        x: origin.x + Math.cos(aimAngle) * spec.range,
        y: origin.y + Math.sin(aimAngle) * spec.range,
      };
      break;
    }

    case 'line':
    case 'projectile': {
      for (const offset of spec.rayAngles) {
        const rayEval = evaluateRayLane(
          origin,
          aimAngle + offset,
          spec.spawnOffset,
          spec.range,
          spec.halfWidth,
          spec.pierce,
          spec.explosiveRadius,
          enemies,
          roomWidth,
          roomHeight,
          pillars
        );
        rays.push(rayEval);
        for (const id of rayEval.hitEnemyIds) affectedSet.add(id);
        for (const id of rayEval.explosionAffectedIds) affectedSet.add(id);
        if (rayEval.raycast.blockerKind === 'pillar' && rayEval.raycast.blockerPillarIndex >= 0) {
          blockedPillarSet.add(rayEval.raycast.blockerPillarIndex);
        }
      }
      if (spec.secondaryAuraRadius > 0) {
        for (const e of enemies) {
          if (e.dying) continue;
          if (Math.hypot(e.x - origin.x, e.y - origin.y) <= spec.secondaryAuraRadius + e.radius) {
            affectedSet.add(e.id);
          }
        }
      }
      if (rays.length > 0) {
        targetPoint = { x: rays[0].stopX, y: rays[0].stopY };
      }
      break;
    }

    case 'circle': {
      const clampedDist = Math.min(spec.castRange, Number.isFinite(cursorDistance) ? cursorDistance : spec.castRange * 0.5);
      outOfRange = cursorDistance > spec.castRange + 14;
      targetPoint = {
        x: origin.x + Math.cos(aimAngle) * clampedDist,
        y: origin.y + Math.sin(aimAngle) * clampedDist,
      };
      for (const e of enemies) {
        if (e.dying) continue;
        if (Math.hypot(e.x - targetPoint.x, e.y - targetPoint.y) <= spec.radius + e.radius) {
          affectedSet.add(e.id);
        }
      }
      break;
    }

    case 'aura': {
      targetPoint = { x: origin.x, y: origin.y };
      if (spec.skillId === 'arcane_blast' || spec.skillId === 'time_freeze' || spec.skillId === 'electric_aura') {
        for (const e of enemies) {
          if (e.dying) continue;
          if (Math.hypot(e.x - origin.x, e.y - origin.y) <= spec.radius + e.radius) {
            affectedSet.add(e.id);
          }
        }
      }
      break;
    }

    case 'targeted': {
      directedTargets = computeDirectedTargets(origin, cursor, spec.castRange, spec.count, enemies);
      if (directedTargets.length === 0) {
        noTarget = true;
        outOfRange = cursorDistance > spec.castRange;
      } else {
        targetPoint = { x: directedTargets[0].x, y: directedTargets[0].y };
        for (const dt of directedTargets) {
          affectedSet.add(dt.id);
          for (const e of enemies) {
            if (e.dying) continue;
            if (Math.hypot(e.x - dt.x, e.y - dt.y) <= spec.radius + e.radius) {
              affectedSet.add(e.id);
            }
          }
        }
      }
      break;
    }

    case 'chain': {
      chainPath = computeChainTargets(origin, cursor, spec.castRange, spec.jumpRange, spec.maxJumps, enemies);
      if (chainPath.length === 0) {
        noTarget = true;
        outOfRange = cursorDistance > spec.castRange;
      } else {
        targetPoint = { x: chainPath[0].x, y: chainPath[0].y };
        for (const node of chainPath) affectedSet.add(node.id);
      }
      break;
    }

    case 'dash': {
      const hit = raycastObstacles(
        origin.x,
        origin.y,
        aimAngle,
        spec.range,
        roomWidth,
        roomHeight,
        pillars,
        spec.bodyPadding,
        64
      );
      rays.push({
        angle: aimAngle,
        raycast: hit,
        stopX: hit.endX,
        stopY: hit.endY,
        stoppedByEnemyId: null,
        hitEnemyIds: [],
        explosionAffectedIds: [],
      });
      if (hit.blockerKind === 'pillar' && hit.blockerPillarIndex >= 0) {
        blockedPillarSet.add(hit.blockerPillarIndex);
      }
      targetPoint = { x: hit.endX, y: hit.endY };
      break;
    }
  }

  let invalidReason: CastEvaluation['invalidReason'] = 'ready';
  if (onCooldown) invalidReason = 'cooldown';
  else if (noTarget) invalidReason = 'no_target';
  else if (outOfRange) invalidReason = 'out_of_range';

  const valid = !onCooldown && !noTarget;

  return {
    spec,
    origin,
    cursor,
    aimAngle,
    targetPoint,
    cursorDistance,
    outOfRange,
    onCooldown,
    cooldownRemaining,
    valid,
    invalidReason,
    rays,
    chainPath,
    directedTargets,
    affectedEnemyIds: Array.from(affectedSet),
    blockedPillarIndices: Array.from(blockedPillarSet),
  };
}
