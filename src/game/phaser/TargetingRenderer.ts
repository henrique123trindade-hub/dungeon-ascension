import Phaser from 'phaser';
import type {
  AutoTargetResult,
  BasicAttackSpec,
  CastEvaluation,
  ObstaclePillar,
  TargetableEnemy,
  Vec2,
} from '../systems/targeting';

export interface TargetingRenderContext {
  elapsedSec: number;
  playerPos: Vec2;
  cursorScreen: Vec2;
  cursorWorld: Vec2;
  cameraZoom: number;
  showReticle: boolean;
  showAttackRange: boolean;
  autoAttackEnabled: boolean;
  basicSpec: BasicAttackSpec;
  autoTarget: AutoTargetResult;
  activeCast: CastEvaluation | null;
  enemies: TargetableEnemy[];
  pillars: ObstaclePillar[];
  passiveAuras: Array<{ radius: number; color: number }>;
  recoilKick: number; // 0..1 brief attack kick
}

const COLOR_GOLD = 0xe3b55c;
const COLOR_GOLD_BRIGHT = 0xf8e3a8;
const COLOR_VALID = 0x4ade80;
const COLOR_INVALID = 0xef4444;
const COLOR_OBSTACLE = 0xf97316;
const COLOR_DARK = 0x09080c;

/**
 * Reusable Zero-GC Dark-Fantasy Targeting & Cast-Preview Renderer.
 * Allocates exactly 2 Phaser Graphics objects and 1 Text label for the entire scene lifetime.
 */
export class TargetingRenderer {
  private groundGfx: Phaser.GameObjects.Graphics;
  private reticleGfx: Phaser.GameObjects.Graphics;
  private statusLabel: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    // Ground-plane tactical geometry (above floor/seals, below sprites & particles)
    this.groundGfx = scene.add.graphics().setDepth(44);
    // World-anchored dark-fantasy dynamic crosshair at cursorWorld (1:1 aligned with OS cursor at any camera zoom)
    this.reticleGfx = scene.add.graphics().setDepth(200);
    this.statusLabel = scene.add
      .text(-999, -999, '', {
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#fca5a5',
        backgroundColor: '#0b0a0ecc',
        padding: { x: 5, y: 2 },
      })
      .setDepth(201)
      .setOrigin(0, 0.5)
      .setVisible(false);
  }

  public clear() {
    this.groundGfx.clear();
    this.reticleGfx.clear();
    this.statusLabel.setVisible(false);
  }

  public destroy() {
    this.groundGfx.destroy();
    this.reticleGfx.destroy();
    this.statusLabel.destroy();
  }

  public render(ctx: TargetingRenderContext) {
    const g = this.groundGfx;
    g.clear();
    this.reticleGfx.clear();

    const pulse = 0.5 + 0.5 * Math.sin(ctx.elapsedSec * 5.2);

    // 1. Subtle passive aura outlines (electric aura / orbital blades) — whisper-thin dark fantasy rings
    for (const aura of ctx.passiveAuras) {
      this.drawDashedCircle(g, ctx.playerPos.x, ctx.playerPos.y, aura.radius, 36, aura.color, 0.14, 1.1, ctx.elapsedSec * 0.25);
    }

    // 2. Basic attack reach indicator (real computed range + subtle forward aim chevron)
    if (ctx.showAttackRange) {
      this.drawBasicAttackReach(g, ctx, pulse);
    }

    // 3. Auto-attack locked target floor marker & hovered target differentiation
    this.drawEnemyTargetMarkers(g, ctx, pulse);

    // 4. Active skill / dash cast preview indicator (1:1 unified geometry)
    if (ctx.activeCast) {
      this.drawSkillCastPreview(g, ctx.activeCast, ctx.enemies, ctx.pillars, ctx.elapsedSec, pulse);
    }

    // 5. Screen-space Dark-Fantasy Dynamic Reticle + Cooldown / Range Feedback
    if (ctx.showReticle) {
      this.drawDynamicReticle(ctx, pulse);
    } else {
      this.statusLabel.setVisible(false);
    }
  }

  private drawBasicAttackReach(g: Phaser.GameObjects.Graphics, ctx: TargetingRenderContext, pulse: number) {
    const { playerPos, basicSpec, autoTarget } = ctx;
    const range = basicSpec.range;
    const hasTarget = autoTarget.target !== null;
    const ringAlpha = hasTarget ? 0.2 : 0.13;
    const ringCol = hasTarget ? COLOR_GOLD : 0xb8afa1;

    // Fine dashed perimeter marking exact real basic-attack reach
    this.drawDashedCircle(
      g,
      playerPos.x,
      playerPos.y,
      range,
      Math.max(24, Math.min(56, Math.round(range / 9))),
      ringCol,
      ringAlpha,
      1.15,
      ctx.elapsedSec * 0.08
    );

    // For melee cleave, show a whisper-subtle forward directional cleave arc along aim direction
    if (basicSpec.shape === 'cone' && !ctx.activeCast) {
      const aim = autoTarget.aimAngle;
      g.fillStyle(COLOR_GOLD, hasTarget ? 0.055 : 0.03);
      g.beginPath();
      g.moveTo(playerPos.x, playerPos.y);
      g.arc(playerPos.x, playerPos.y, range, aim - basicSpec.halfAngle, aim + basicSpec.halfAngle, false);
      g.closePath();
      g.fillPath();

      g.lineStyle(1.2, COLOR_GOLD_BRIGHT, hasTarget ? 0.34 : 0.18);
      g.beginPath();
      g.arc(playerPos.x, playerPos.y, range, aim - basicSpec.halfAngle, aim + basicSpec.halfAngle, false);
      g.strokePath();
    } else if (!ctx.activeCast) {
      // For ranged basic attacks, subtle directional compass tick on the range perimeter
      const aim = autoTarget.aimAngle;
      const tickX = playerPos.x + Math.cos(aim) * (range - 5);
      const tickY = playerPos.y + Math.sin(aim) * (range - 5);
      const tipX = playerPos.x + Math.cos(aim) * (range + 5);
      const tipY = playerPos.y + Math.sin(aim) * (range + 5);
      g.lineStyle(1.6, COLOR_GOLD_BRIGHT, 0.35 + pulse * 0.12);
      g.lineBetween(tickX, tickY, tipX, tipY);
    }
  }

  private drawEnemyTargetMarkers(g: Phaser.GameObjects.Graphics, ctx: TargetingRenderContext, pulse: number) {
    const { autoTarget, playerPos, autoAttackEnabled } = ctx;

    // Auto-attack locked target ground sigil (discreet, unmistakably legible under feet)
    if (autoTarget.target) {
      const t = autoTarget.target;
      const r = t.radius + 7;
      const col = autoTarget.hoveredId === t.id ? COLOR_VALID : COLOR_GOLD;

      // Thin grounded ellipse-style target ring + 4 forged corner brackets
      g.fillStyle(col, 0.07);
      g.fillCircle(t.x, t.y + 4, r);
      g.lineStyle(1.6, col, 0.68 + pulse * 0.14);
      g.strokeCircle(t.x, t.y + 4, r);

      // Four discreet inward chevron ticks around the target
      const rot = ctx.elapsedSec * 0.9;
      for (let i = 0; i < 4; i++) {
        const a = rot + (Math.PI / 2) * i;
        const inner = r - 3;
        const outer = r + 5;
        g.lineStyle(1.6, COLOR_GOLD_BRIGHT, 0.78);
        g.lineBetween(
          t.x + Math.cos(a) * inner,
          t.y + 4 + Math.sin(a) * inner,
          t.x + Math.cos(a) * outer,
          t.y + 4 + Math.sin(a) * outer
        );
      }

      // Ultra-subtle dashed tether from hero edge toward locked auto-attack target when auto-attack is active
      if (autoAttackEnabled && !ctx.activeCast) {
        const ang = Math.atan2(t.y - playerPos.y, t.x - playerPos.x);
        const dist = Math.hypot(t.x - playerPos.x, t.y - playerPos.y);
        if (dist > t.radius + 36) {
          this.drawDashedLine(
            g,
            playerPos.x + Math.cos(ang) * 26,
            playerPos.y + Math.sin(ang) * 26,
            t.x - Math.cos(ang) * (r + 3),
            t.y - Math.sin(ang) * (r + 3),
            col,
            0.22,
            1.1,
            8,
            10
          );
        }
      }
    }

    // Hovered enemy that is OUT OF BASIC-ATTACK RANGE -> subtle crimson ring so player sees range boundary immediately
    if (autoTarget.hoveredEnemy && !autoTarget.hoveredInRange) {
      const h = autoTarget.hoveredEnemy;
      const r = h.radius + 7;
      this.drawDashedCircle(g, h.x, h.y + 4, r, 16, COLOR_INVALID, 0.65, 1.5, -ctx.elapsedSec * 1.1);
    }
  }

  private drawSkillCastPreview(
    g: Phaser.GameObjects.Graphics,
    evalCast: CastEvaluation,
    enemies: TargetableEnemy[],
    pillars: ObstaclePillar[],
    elapsedSec: number,
    pulse: number
  ) {
    const { spec, origin, cursor, aimAngle, targetPoint, outOfRange, onCooldown, valid } = evalCast;
    const isInvalidVisual = onCooldown || !valid || outOfRange;
    const mainCol = isInvalidVisual ? COLOR_INVALID : valid ? COLOR_GOLD_BRIGHT : COLOR_VALID;
    const accentCol = isInvalidVisual ? COLOR_INVALID : spec.color;
    const fillAlpha = isInvalidVisual ? 0.08 : 0.1 + pulse * 0.025;
    const lineAlpha = isInvalidVisual ? 0.72 : 0.78;

    // Highlight every enemy that WILL be affected by this cast (discreet crisp tactical highlight)
    if (evalCast.affectedEnemyIds.length > 0) {
      const affectedSet = new Set(evalCast.affectedEnemyIds);
      const hiCol = isInvalidVisual ? COLOR_INVALID : COLOR_VALID;
      for (const e of enemies) {
        if (!affectedSet.has(e.id) || e.dying) continue;
        const r = e.radius + 6;
        g.fillStyle(hiCol, 0.13);
        g.fillCircle(e.x, e.y + 3, r);
        g.lineStyle(1.8, hiCol, 0.85);
        g.strokeCircle(e.x, e.y + 3, r);
        // Tiny top tactical diamond
        this.drawDiamond(g, e.x, e.y - e.radius - 15, 4.2, hiCol, 0.9);
      }
    }

    // Highlight pillars obstructing projectile / dash paths
    for (const pIdx of evalCast.blockedPillarIndices) {
      const pil = pillars[pIdx];
      if (!pil) continue;
      g.lineStyle(1.8, COLOR_OBSTACLE, 0.72);
      g.strokeRect(pil.x - pil.w * 0.5 - 2, pil.y - pil.h * 0.5 - 2, pil.w + 4, pil.h + 4);
    }

    switch (spec.shape) {
      case 'cone': {
        g.fillStyle(accentCol, fillAlpha);
        g.beginPath();
        g.moveTo(origin.x, origin.y);
        g.arc(origin.x, origin.y, spec.range, aimAngle - spec.halfAngle, aimAngle + spec.halfAngle, false);
        g.closePath();
        g.fillPath();

        g.lineStyle(1.7, mainCol, lineAlpha);
        g.beginPath();
        g.moveTo(origin.x, origin.y);
        g.arc(origin.x, origin.y, spec.range, aimAngle - spec.halfAngle, aimAngle + spec.halfAngle, false);
        g.closePath();
        g.strokePath();
        break;
      }

      case 'line':
      case 'projectile': {
        for (const ray of evalCast.rays) {
          const sx = ray.raycast.startX;
          const sy = ray.raycast.startY;
          const ex = ray.stopX;
          const ey = ray.stopY;
          const perpX = -Math.sin(ray.angle) * spec.halfWidth;
          const perpY = Math.cos(ray.angle) * spec.halfWidth;

          // Corridor polygon (exact collision width = halfWidth * 2)
          g.fillStyle(accentCol, fillAlpha * 0.9);
          g.beginPath();
          g.moveTo(sx + perpX, sy + perpY);
          g.lineTo(ex + perpX, ey + perpY);
          g.lineTo(ex - perpX, ey - perpY);
          g.lineTo(sx - perpX, sy - perpY);
          g.closePath();
          g.fillPath();

          // Refined dual borders + center aim hairline
          g.lineStyle(1.4, mainCol, lineAlpha);
          g.lineBetween(sx + perpX, sy + perpY, ex + perpX, ey + perpY);
          g.lineBetween(sx - perpX, sy - perpY, ex - perpX, ey - perpY);
          g.lineBetween(ex + perpX, ey + perpY, ex - perpX, ey - perpY);
          this.drawDashedLine(g, sx, sy, ex, ey, COLOR_GOLD_BRIGHT, 0.35, 1.0, 9, 8);

          // If blocked by wall or pillar BEFORE natural max range, draw crisp obstacle impact X & faint blocked tail
          if (ray.raycast.blocked && !ray.stoppedByEnemyId) {
            const fullEndX = sx + Math.cos(ray.angle) * ray.raycast.maxDistance;
            const fullEndY = sy + Math.sin(ray.angle) * ray.raycast.maxDistance;
            this.drawDashedLine(g, ex, ey, fullEndX, fullEndY, COLOR_INVALID, 0.22, 1.0, 4, 8);
            this.drawObstacleStopMarker(g, ex, ey, COLOR_OBSTACLE);
          }

          // Directional chevron arrowhead near corridor end
          const arrowLen = Math.min(24, Math.hypot(ex - sx, ey - sy) * 0.4);
          if (arrowLen > 8) {
            const tipX = ex;
            const tipY = ey;
            const backX = tipX - Math.cos(ray.angle) * 11;
            const backY = tipY - Math.sin(ray.angle) * 11;
            g.lineStyle(1.8, mainCol, 0.85);
            g.lineBetween(tipX, tipY, backX - Math.sin(ray.angle) * 7, backY + Math.cos(ray.angle) * 7);
            g.lineBetween(tipX, tipY, backX + Math.sin(ray.angle) * 7, backY - Math.cos(ray.angle) * 7);
          }

          // Real explosive AoE circle at exact impact point (Fireball)
          if (spec.explosiveRadius > 0) {
            g.fillStyle(accentCol, fillAlpha * 0.85);
            g.fillCircle(ex, ey, spec.explosiveRadius);
            g.lineStyle(1.5, mainCol, lineAlpha * 0.9);
            g.strokeCircle(ex, ey, spec.explosiveRadius);
            this.drawDashedCircle(g, ex, ey, spec.explosiveRadius * 0.65, 20, accentCol, 0.35, 1.0, elapsedSec);
          }
        }

        // Vampiric Aura synergy secondary pulse ring on Shadow Slash
        if (spec.secondaryAuraRadius > 0) {
          this.drawDashedCircle(g, origin.x, origin.y, spec.secondaryAuraRadius, 28, 0xe11d48, 0.55, 1.4, -elapsedSec);
        }
        break;
      }

      case 'circle': {
        // Outer cast-range perimeter ring around hero
        this.drawDashedCircle(
          g,
          origin.x,
          origin.y,
          spec.castRange,
          44,
          outOfRange || onCooldown ? COLOR_INVALID : COLOR_GOLD,
          outOfRange ? 0.55 : 0.28,
          1.25,
          elapsedSec * 0.2
        );

        // If cursor is outside cast range, draw dashed crimson overshoot line to cursor
        if (outOfRange) {
          this.drawDashedLine(g, targetPoint.x, targetPoint.y, cursor.x, cursor.y, COLOR_INVALID, 0.52, 1.3, 6, 6);
        }

        // Ground impact zone (exact real AoE radius)
        g.fillStyle(accentCol, fillAlpha);
        g.fillCircle(targetPoint.x, targetPoint.y, spec.radius);
        g.lineStyle(1.8, mainCol, lineAlpha);
        g.strokeCircle(targetPoint.x, targetPoint.y, spec.radius);

        // Inner runic ring & subtle crosshair center
        this.drawDashedCircle(g, targetPoint.x, targetPoint.y, spec.radius * 0.62, 24, mainCol, 0.35, 1.1, -elapsedSec * 0.65);
        if (spec.subRadius > 0 && spec.subRadius < spec.radius * 0.85) {
          g.lineStyle(1.2, accentCol, 0.45);
          g.strokeCircle(targetPoint.x, targetPoint.y, spec.subRadius);
        }
        this.drawDiamond(g, targetPoint.x, targetPoint.y, 5, mainCol, 0.85);
        break;
      }

      case 'aura': {
        g.fillStyle(accentCol, fillAlpha * 0.9);
        g.fillCircle(origin.x, origin.y, spec.radius);
        g.lineStyle(1.8, mainCol, lineAlpha);
        g.strokeCircle(origin.x, origin.y, spec.radius);
        this.drawDashedCircle(g, origin.x, origin.y, spec.radius * 0.78, 32, accentCol, 0.38, 1.15, elapsedSec * 0.7);

        // Cardinal rune ticks
        for (let i = 0; i < 4; i++) {
          const a = elapsedSec * 0.3 + (Math.PI / 2) * i;
          g.lineStyle(1.5, mainCol, 0.7);
          g.lineBetween(
            origin.x + Math.cos(a) * (spec.radius - 7),
            origin.y + Math.sin(a) * (spec.radius - 7),
            origin.x + Math.cos(a) * (spec.radius + 5),
            origin.y + Math.sin(a) * (spec.radius + 5)
          );
        }

        // Shadow Summon spawn points preview
        if (spec.skillId === 'shadow_summon' && spec.subRadius > 0) {
          for (let i = 0; i < spec.count; i++) {
            const ang = (Math.PI * 2 * i) / spec.count;
            const sx = origin.x + Math.cos(ang) * spec.subRadius;
            const sy = origin.y + Math.sin(ang) * spec.subRadius;
            this.drawDiamond(g, sx, sy, 5, mainCol, 0.85);
          }
        }
        break;
      }

      case 'targeted': {
        // Max cast range ring
        this.drawDashedCircle(
          g,
          origin.x,
          origin.y,
          spec.castRange,
          48,
          isInvalidVisual ? COLOR_INVALID : COLOR_GOLD,
          isInvalidVisual ? 0.52 : 0.3,
          1.25,
          elapsedSec * 0.25
        );

        // Draw directed pillar lock + real impact radius on each selected enemy
        const seen = new Set<number>();
        for (let i = 0; i < evalCast.directedTargets.length; i++) {
          const t = evalCast.directedTargets[i];
          if (seen.has(t.id)) continue;
          seen.add(t.id);
          const isPrimary = i === 0;
          g.fillStyle(accentCol, isPrimary ? fillAlpha * 1.1 : fillAlpha * 0.65);
          g.fillCircle(t.x, t.y, spec.radius);
          g.lineStyle(isPrimary ? 1.8 : 1.3, mainCol, isPrimary ? 0.86 : 0.58);
          g.strokeCircle(t.x, t.y, spec.radius);
          // Sky pillar vertical guide ray
          g.lineStyle(isPrimary ? 1.6 : 1.1, mainCol, isPrimary ? 0.55 : 0.35);
          g.lineBetween(t.x, t.y - 72, t.x, t.y - t.radius - 4);
          this.drawDiamond(g, t.x, t.y, 5.5, mainCol, 0.92);
        }
        break;
      }

      case 'chain': {
        // Initial cast range ring
        this.drawDashedCircle(
          g,
          origin.x,
          origin.y,
          spec.castRange,
          42,
          isInvalidVisual ? COLOR_INVALID : COLOR_GOLD,
          isInvalidVisual ? 0.5 : 0.3,
          1.25,
          elapsedSec * 0.3
        );

        if (evalCast.chainPath.length > 0) {
          let prevX = origin.x;
          let prevY = origin.y;
          for (let i = 0; i < evalCast.chainPath.length; i++) {
            const node = evalCast.chainPath[i];
            const alpha = Math.max(0.36, 0.9 - i * 0.07);
            // Jagged delicate preview lightning segment
            g.lineStyle(i === 0 ? 2.0 : 1.5, isInvalidVisual ? COLOR_INVALID : accentCol, alpha);
            this.drawJaggedPreviewArc(g, prevX, prevY, node.x, node.y, elapsedSec, i);
            // Jump node sigil
            g.lineStyle(1.6, mainCol, alpha);
            g.strokeCircle(node.x, node.y, node.radius + 9);
            this.drawDiamond(g, node.x, node.y, 4.5, mainCol, alpha);
            prevX = node.x;
            prevY = node.y;
          }
        }
        break;
      }

      case 'dash': {
        const ray = evalCast.rays[0];
        if (!ray) break;
        const ex = ray.stopX;
        const ey = ray.stopY;
        const col = onCooldown ? COLOR_INVALID : 0xc084fc;
        const perpX = -Math.sin(aimAngle) * 11;
        const perpY = Math.cos(aimAngle) * 11;

        // Tapered displacement corridor
        g.fillStyle(col, onCooldown ? 0.08 : 0.11);
        g.beginPath();
        g.moveTo(origin.x + perpX * 0.75, origin.y + perpY * 0.75);
        g.lineTo(ex + perpX, ey + perpY);
        g.lineTo(ex - perpX, ey - perpY);
        g.lineTo(origin.x - perpX * 0.75, origin.y - perpY * 0.75);
        g.closePath();
        g.fillPath();

        this.drawDashedLine(g, origin.x, origin.y, ex, ey, mainCol, 0.75, 1.5, 9, 7);

        // Landing ring silhouette
        g.fillStyle(col, 0.12);
        g.fillCircle(ex, ey, 16);
        g.lineStyle(1.8, mainCol, 0.88);
        g.strokeCircle(ex, ey, 16);

        // Forward chevron at landing spot
        const backX = ex - Math.cos(aimAngle) * 9;
        const backY = ey - Math.sin(aimAngle) * 9;
        g.lineStyle(1.8, mainCol, 0.9);
        g.lineBetween(ex + Math.cos(aimAngle) * 5, ey + Math.sin(aimAngle) * 5, backX - perpX * 0.65, backY - perpY * 0.65);
        g.lineBetween(ex + Math.cos(aimAngle) * 5, ey + Math.sin(aimAngle) * 5, backX + perpX * 0.65, backY + perpY * 0.65);

        if (ray.raycast.blocked) {
          this.drawObstacleStopMarker(g, ex, ey, COLOR_OBSTACLE);
        }
        break;
      }
    }
  }

  private drawDynamicReticle(ctx: TargetingRenderContext, pulse: number) {
    const g = this.reticleGfx;
    const wx = ctx.cursorWorld.x;
    const wy = ctx.cursorWorld.y;
    if (!Number.isFinite(wx) || !Number.isFinite(wy)) return;

    const invZoom = 1 / Math.max(0.25, ctx.cameraZoom || 1);
    g.setPosition(wx, wy);
    g.setScale(invZoom);
    const x = 0;
    const y = 0;

    const { autoTarget, activeCast, recoilKick, elapsedSec } = ctx;
    const hoverValid = Boolean(autoTarget.hoveredEnemy && autoTarget.hoveredInRange);
    const hoverOut = Boolean(autoTarget.hoveredEnemy && !autoTarget.hoveredInRange);

    let primaryCol = COLOR_GOLD_BRIGHT;
    let ringCol = COLOR_GOLD;
    let spread = 7.5 + recoilKick * 5;
    let bladeLen = 6.5;
    let showStatus = '';
    let statusColor = '#fca5a5';

    if (activeCast) {
      if (activeCast.onCooldown) {
        primaryCol = COLOR_INVALID;
        ringCol = COLOR_INVALID;
        spread = 10;
        showStatus = `${activeCast.cooldownRemaining.toFixed(1)}s`;
      } else if (!activeCast.valid) {
        primaryCol = COLOR_INVALID;
        ringCol = COLOR_INVALID;
        spread = 10.5;
        showStatus = activeCast.invalidReason === 'no_target' ? 'Sem alvo' : 'Fora de alcance';
      } else if (activeCast.outOfRange) {
        primaryCol = COLOR_INVALID;
        ringCol = COLOR_INVALID;
        spread = 10;
        showStatus = 'Alcance máx.';
      } else {
        primaryCol = COLOR_VALID;
        ringCol = COLOR_GOLD_BRIGHT;
        spread = 8.5;
      }
    } else if (hoverValid) {
      primaryCol = COLOR_VALID;
      ringCol = COLOR_VALID;
      spread = 5.5 + recoilKick * 4;
      bladeLen = 7.5;
    } else if (hoverOut) {
      primaryCol = COLOR_INVALID;
      ringCol = COLOR_INVALID;
      spread = 10.5 + recoilKick * 3;
      bladeLen = 5.5;
    }

    // Subtle dark outer halo for guaranteed readability on both dark flagstones and bright explosions
    g.lineStyle(3.2, COLOR_DARK, 0.72);
    g.strokeCircle(x, y, spread + 2.5);

    // Forged dark-fantasy runic ring
    g.lineStyle(1.35, ringCol, activeCast ? 0.88 : 0.65 + pulse * 0.15);
    g.strokeCircle(x, y, spread + 2.5);

    // Rotating subtle outer diamond ticks while aiming a skill or locked onto a valid enemy
    if (activeCast || hoverValid) {
      const rot = elapsedSec * (activeCast ? 2.4 : 1.4);
      const tickR = spread + 6.5;
      g.lineStyle(1.35, primaryCol, 0.82);
      for (let i = 0; i < 4; i++) {
        const a = rot + (Math.PI / 2) * i + Math.PI / 4;
        g.lineBetween(
          x + Math.cos(a) * (tickR - 2.5),
          y + Math.sin(a) * (tickR - 2.5),
          x + Math.cos(a) * (tickR + 2.5),
          y + Math.sin(a) * (tickR + 2.5)
        );
      }
    }

    // 4 forged cardinal dagger blades (dark outline + metallic blade core)
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    for (const [dx, dy] of dirs) {
      const x1 = x + dx * spread;
      const y1 = y + dy * spread;
      const x2 = x + dx * (spread + bladeLen);
      const y2 = y + dy * (spread + bladeLen);
      g.lineStyle(3.2, COLOR_DARK, 0.85);
      g.lineBetween(x1, y1, x2, y2);
      g.lineStyle(1.6, primaryCol, 0.96);
      g.lineBetween(x1, y1, x2, y2);
    }

    // Center precision pip
    g.fillStyle(COLOR_DARK, 0.95);
    g.fillCircle(x, y, 2.8);
    g.fillStyle(primaryCol, 0.98);
    g.fillCircle(x, y, 1.6);

    // Cooldown or invalid-cast compact label right beside reticle
    if (showStatus) {
      this.statusLabel
        .setText(showStatus)
        .setColor(statusColor)
        .setScale(invZoom)
        .setPosition(wx + 18 * invZoom, wy - 12 * invZoom)
        .setVisible(true);
    } else {
      this.statusLabel.setVisible(false);
    }
  }

  private drawDashedCircle(
    g: Phaser.GameObjects.Graphics,
    cx: number,
    cy: number,
    radius: number,
    segments: number,
    color: number,
    alpha: number,
    width: number,
    phase = 0
  ) {
    if (radius <= 2) return;
    g.lineStyle(width, color, alpha);
    const step = (Math.PI * 2) / segments;
    const dashSpan = step * 0.56;
    for (let i = 0; i < segments; i++) {
      const a0 = phase + i * step;
      g.beginPath();
      g.arc(cx, cy, radius, a0, a0 + dashSpan, false);
      g.strokePath();
    }
  }

  private drawDashedLine(
    g: Phaser.GameObjects.Graphics,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: number,
    alpha: number,
    width: number,
    dashLen: number,
    gapLen: number
  ) {
    const dist = Math.hypot(x2 - x1, y2 - y1);
    if (dist < 2) return;
    const dx = (x2 - x1) / dist;
    const dy = (y2 - y1) / dist;
    g.lineStyle(width, color, alpha);
    let d = 0;
    while (d < dist) {
      const end = Math.min(dist, d + dashLen);
      g.lineBetween(x1 + dx * d, y1 + dy * d, x1 + dx * end, y1 + dy * end);
      d += dashLen + gapLen;
    }
  }

  private drawDiamond(
    g: Phaser.GameObjects.Graphics,
    cx: number,
    cy: number,
    size: number,
    color: number,
    alpha: number
  ) {
    g.fillStyle(color, alpha * 0.4);
    g.lineStyle(1.4, color, alpha);
    g.beginPath();
    g.moveTo(cx, cy - size);
    g.lineTo(cx + size, cy);
    g.lineTo(cx, cy + size);
    g.lineTo(cx - size, cy);
    g.closePath();
    g.fillPath();
    g.strokePath();
  }

  private drawObstacleStopMarker(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number) {
    const s = 6;
    g.lineStyle(2.6, COLOR_DARK, 0.85);
    g.lineBetween(x - s, y - s, x + s, y + s);
    g.lineBetween(x + s, y - s, x - s, y + s);
    g.lineStyle(1.7, color, 0.95);
    g.lineBetween(x - s, y - s, x + s, y + s);
    g.lineBetween(x + s, y - s, x - s, y + s);
    g.lineStyle(1.2, color, 0.7);
    g.strokeCircle(x, y, 9);
  }

  private drawJaggedPreviewArc(
    g: Phaser.GameObjects.Graphics,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    elapsedSec: number,
    seed: number
  ) {
    const segs = 4;
    const perpX = -(y2 - y1);
    const perpY = x2 - x1;
    const len = Math.max(1, Math.hypot(perpX, perpY));
    const nx = perpX / len;
    const ny = perpY / len;
    g.beginPath();
    g.moveTo(x1, y1);
    for (let i = 1; i < segs; i++) {
      const t = i / segs;
      const jitter = Math.sin(elapsedSec * 14 + seed * 3.1 + i * 2.3) * 7;
      g.lineTo(x1 + (x2 - x1) * t + nx * jitter, y1 + (y2 - y1) * t + ny * jitter);
    }
    g.lineTo(x2, y2);
    g.strokePath();
  }
}
