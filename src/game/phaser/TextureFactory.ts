import Phaser from 'phaser';
import { BIOMES } from '../data/biomes';
import { BOSSES } from '../data/bosses';
import { CLASS_LIST } from '../data/classes';
import { ENEMY_LIST } from '../data/enemies';

function makeCanvas(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
) {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return;
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, w, h);
  draw(ctx, w, h);
  tex.refresh();
}

export function generateAllGameTextures(scene: Phaser.Scene) {
  generateBiomeTiles(scene);
  generateHeroSprites(scene);
  generateEnemySprites(scene);
  generateBossSprites(scene);
  generateProjectilesAndEffects(scene);
  generatePropsAndPickups(scene);
}

function generateBiomeTiles(scene: Phaser.Scene) {
  for (const b of BIOMES) {
    // 3 handcrafted flagstone variations per biome to eliminate grid repetition
    for (let v = 0; v < 3; v++) {
      makeCanvas(scene, `floor_${b.index}_${v}`, 64, 64, (ctx, w, h) => {
        ctx.fillStyle = b.floorSecondary;
        ctx.fillRect(0, 0, w, h);

        const layouts = [
          [
            [2, 2, 28, 28],
            [34, 2, 28, 28],
            [2, 34, 38, 28],
            [44, 34, 18, 28],
          ],
          [
            [2, 2, 40, 26],
            [46, 2, 16, 26],
            [2, 32, 24, 30],
            [30, 32, 32, 30],
          ],
          [
            [2, 2, 24, 36],
            [30, 2, 32, 20],
            [30, 26, 32, 36],
            [2, 42, 24, 20],
          ],
        ];
        const stones = layouts[v];
        for (let si = 0; si < stones.length; si++) {
          const [x, y, sw, sh] = stones[si];
          ctx.fillStyle = b.floorPrimary;
          ctx.fillRect(x, y, sw, sh);
          // Subtle tonal variation per slab
          if ((si + v) % 2 === 0) {
            ctx.fillStyle = 'rgba(0,0,0,0.12)';
            ctx.fillRect(x, y, sw, sh);
          }
          ctx.fillStyle = 'rgba(255,255,255,0.035)';
          ctx.fillRect(x, y, sw, 2);
          ctx.fillRect(x, y, 2, sh);
          ctx.fillStyle = 'rgba(0,0,0,0.24)';
          ctx.fillRect(x, y + sh - 2, sw, 2);
          ctx.fillRect(x + sw - 2, y, 2, sh);
        }

        // Organic cracks & pebbles
        ctx.strokeStyle = b.floorCrack;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        if (v === 0) {
          ctx.moveTo(10, 12);
          ctx.lineTo(18, 17);
          ctx.lineTo(24, 14);
        } else if (v === 1) {
          ctx.moveTo(36, 40);
          ctx.lineTo(48, 49);
          ctx.lineTo(54, 46);
        } else {
          ctx.moveTo(8, 48);
          ctx.lineTo(16, 54);
          ctx.moveTo(42, 10);
          ctx.lineTo(52, 18);
        }
        ctx.stroke();

        // Biome-specific ground detail (moss/ember/frost/runes)
        if (v === 2) {
          ctx.fillStyle = b.accentGlow;
          ctx.globalAlpha = b.index === 0 ? 0.14 : 0.24;
          ctx.fillRect(14, 16, 4, 3);
          ctx.fillRect(46, 46, 3, 4);
          ctx.globalAlpha = 1;
        }
      });
    }

    // Wall / pillar block (64x64)
    makeCanvas(scene, `wall_${b.index}`, 64, 64, (ctx, w, h) => {
      ctx.fillStyle = '#0c0b10';
      ctx.fillRect(0, 0, w, h);

      // Top cap of stone block
      ctx.fillStyle = b.wallPrimary;
      ctx.fillRect(2, 2, w - 4, h - 14);
      // Front face (depth illusion)
      ctx.fillStyle = b.floorSecondary;
      ctx.fillRect(2, h - 12, w - 4, 10);

      // Carved stone bevel & trim
      ctx.strokeStyle = b.wallHighlight;
      ctx.lineWidth = 2;
      ctx.strokeRect(4, 4, w - 8, h - 18);

      // Carved inner rune notch
      ctx.strokeStyle = b.accentGlow;
      ctx.globalAlpha = 0.32;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(16, 14, w - 32, h - 38);
      ctx.globalAlpha = 1;
    });
  }
}

function drawGroundShadow(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, alpha = 0.5) {
  const g = ctx.createRadialGradient(cx, cy, rx * 0.15, cx, cy, rx);
  g.addColorStop(0, `rgba(0,0,0,${alpha})`);
  g.addColorStop(0.75, `rgba(0,0,0,${alpha * 0.55})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawGlowingEyes(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  w: number,
  h: number,
  color: string
) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 6;
  ctx.fillStyle = color;
  ctx.fillRect(x1, y1, w, h);
  ctx.fillRect(x2, y2, w, h);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x1 + w * 0.25, y1 + h * 0.2, w * 0.45, h * 0.45);
  ctx.fillRect(x2 + w * 0.25, y2 + h * 0.2, w * 0.45, h * 0.45);
  ctx.restore();
}

function generateHeroSprites(scene: Phaser.Scene) {
  for (const cls of CLASS_LIST) {
    // 96x96 supersampled canvas rendered at ~0.62 scale for razor-sharp dark-fantasy detail
    makeCanvas(scene, `hero_${cls.id}`, 96, 96, (ctx) => {
      const cx = 48;
      const cy = 50;

      // Ground shadow + subtle hero-contrast underglow
      drawGroundShadow(ctx, cx, cy + 20, 26, 13, 0.58);
      const rim = ctx.createRadialGradient(cx, cy + 16, 4, cx, cy + 16, 28);
      rim.addColorStop(0, `${cls.accentColor}44`);
      rim.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rim;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 16, 28, 15, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      if (cls.id === 'warrior') {
        // Flowing crimson battle-cape behind shoulders
        ctx.fillStyle = '#7f1d1d';
        ctx.strokeStyle = '#09080c';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx - 20, cy - 8);
        ctx.lineTo(cx - 29, cy + 24);
        ctx.lineTo(cx - 10, cy + 20);
        ctx.lineTo(cx, cy + 27);
        ctx.lineTo(cx + 12, cy + 21);
        ctx.lineTo(cx + 27, cy + 24);
        ctx.lineTo(cx + 20, cy - 8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Cape highlight fold
        ctx.fillStyle = 'rgba(239,68,68,0.28)';
        ctx.beginPath();
        ctx.moveTo(cx - 12, cy - 2);
        ctx.lineTo(cx - 18, cy + 19);
        ctx.lineTo(cx - 4, cy + 22);
        ctx.closePath();
        ctx.fill();

        // Armored steel breastplate & warbelt
        const plateGrad = ctx.createLinearGradient(cx - 22, cy - 12, cx + 22, cy + 16);
        plateGrad.addColorStop(0, '#64748b');
        plateGrad.addColorStop(0.45, '#334155');
        plateGrad.addColorStop(1, '#1e293b');
        ctx.fillStyle = plateGrad;
        ctx.beginPath();
        ctx.roundRect(cx - 21, cy - 12, 42, 29, 9);
        ctx.fill();
        ctx.stroke();

        // Crimson surcoat tabard & gold belt buckle
        ctx.fillStyle = '#b91c1c';
        ctx.fillRect(cx - 7, cy - 8, 14, 24);
        ctx.fillStyle = '#d4a64a';
        ctx.fillRect(cx - 20, cy + 6, 40, 5);
        ctx.strokeRect(cx - 20, cy + 6, 40, 5);
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(cx - 5, cy + 5, 10, 7);

        // Heavy layered pauldrons (left & right)
        for (const side of [-1, 1]) {
          ctx.fillStyle = '#475569';
          ctx.beginPath();
          ctx.ellipse(cx + side * 21, cy - 6, 10, 12, side * 0.25, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.strokeStyle = '#d4a64a';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cx + side * 21, cy - 6, 7, side > 0 ? -0.9 : 2.1, side > 0 ? 1.0 : 4.0);
          ctx.stroke();
          ctx.strokeStyle = '#09080c';
          ctx.lineWidth = 3;
        }

        // Visored Steel Greathelm with bronze plume crest
        const helmGrad = ctx.createRadialGradient(cx - 4, cy - 19, 3, cx, cy - 14, 17);
        helmGrad.addColorStop(0, '#e2e8f0');
        helmGrad.addColorStop(0.55, '#64748b');
        helmGrad.addColorStop(1, '#1e293b');
        ctx.fillStyle = helmGrad;
        ctx.beginPath();
        ctx.arc(cx, cy - 14, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Central bronze ridge & dark T-visor
        ctx.fillStyle = '#d4a64a';
        ctx.fillRect(cx - 3, cy - 29, 6, 13);
        ctx.strokeRect(cx - 3, cy - 29, 6, 13);
        ctx.fillStyle = '#09080c';
        ctx.fillRect(cx - 10, cy - 16, 20, 5);
        ctx.fillRect(cx - 2, cy - 16, 4, 11);
        drawGlowingEyes(ctx, cx - 7, cy - 15, cx + 3, cy - 15, 4, 3, '#facc15');

        // Obsidian Runic Greatsword held ready on right
        ctx.save();
        ctx.translate(cx + 27, cy - 2);
        ctx.rotate(0.18);
        const bladeG = ctx.createLinearGradient(-5, -36, 5, 14);
        bladeG.addColorStop(0, '#f8fafc');
        bladeG.addColorStop(0.5, '#94a3b8');
        bladeG.addColorStop(1, '#334155');
        ctx.fillStyle = bladeG;
        ctx.strokeStyle = '#09080c';
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(0, -38);
        ctx.lineTo(6, -26);
        ctx.lineTo(5, 12);
        ctx.lineTo(-5, 12);
        ctx.lineTo(-6, -26);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Glowing ember rune line down blade fuller
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(0, -28);
        ctx.lineTo(0, 6);
        ctx.stroke();
        // Ornate gilded crossguard & pommel
        ctx.fillStyle = '#d4a64a';
        ctx.strokeStyle = '#09080c';
        ctx.lineWidth = 2.2;
        ctx.fillRect(-12, 10, 24, 5);
        ctx.strokeRect(-12, 10, 24, 5);
        ctx.fillStyle = '#7f1d1d';
        ctx.fillRect(-3, 15, 6, 9);
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(0, 25, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      } else if (cls.id === 'assassin') {
        // Split shadow-violet tattered cloak
        ctx.fillStyle = '#1e1033';
        ctx.strokeStyle = '#09080c';
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.moveTo(cx - 17, cy - 8);
        ctx.lineTo(cx - 28, cy + 23);
        ctx.lineTo(cx - 6, cy + 16);
        ctx.lineTo(cx, cy + 25);
        ctx.lineTo(cx + 8, cy + 15);
        ctx.lineTo(cx + 28, cy + 23);
        ctx.lineTo(cx + 17, cy - 8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Slim dark-leather torso + cross-belts
        ctx.fillStyle = '#2d1c45';
        ctx.beginPath();
        ctx.roundRect(cx - 16, cy - 10, 32, 26, 8);
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(cx - 14, cy - 7);
        ctx.lineTo(cx + 14, cy + 12);
        ctx.moveTo(cx + 14, cy - 7);
        ctx.lineTo(cx - 14, cy + 12);
        ctx.stroke();

        // Crimson neck scarf trailing left
        ctx.fillStyle = '#be123c';
        ctx.strokeStyle = '#09080c';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.ellipse(cx, cy - 5, 16, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - 14, cy - 4);
        ctx.lineTo(cx - 27, cy + 7);
        ctx.lineTo(cx - 18, cy + 13);
        ctx.lineTo(cx - 8, cy);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Pointed shadow cowl / hood
        ctx.fillStyle = '#171226';
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 31);
        ctx.quadraticCurveTo(cx + 17, cy - 22, cx + 14, cy - 6);
        ctx.lineTo(cx - 14, cy - 6);
        ctx.quadraticCurveTo(cx - 17, cy - 22, cx, cy - 31);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Shadowed face mask + piercing violet eyes
        ctx.fillStyle = '#09080c';
        ctx.beginPath();
        ctx.ellipse(cx, cy - 13, 10, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        drawGlowingEyes(ctx, cx - 7, cy - 15, cx + 3, cy - 15, 4, 3, '#e879f9');

        // Dual Curved Eclipse Daggers
        for (const side of [-1, 1]) {
          ctx.save();
          ctx.translate(cx + side * 23, cy + 2);
          ctx.rotate(side * 0.32);
          ctx.fillStyle = '#e2e8f0';
          ctx.strokeStyle = '#09080c';
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.moveTo(0, -24);
          ctx.quadraticCurveTo(side * 9, -8, side * 4, 10);
          ctx.lineTo(-side * 3, 10);
          ctx.quadraticCurveTo(side * 2, -6, 0, -24);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          // Violet venom edge glow
          ctx.strokeStyle = '#c084fc';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(0, -22);
          ctx.quadraticCurveTo(side * 7, -8, side * 3, 7);
          ctx.stroke();
          ctx.restore();
        }
      } else if (cls.id === 'mage') {
        // Ornate archmage mantle & flowing dark-ember cloak
        ctx.fillStyle = '#3b1512';
        ctx.strokeStyle = '#09080c';
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.moveTo(cx - 18, cy - 9);
        ctx.lineTo(cx - 27, cy + 26);
        ctx.lineTo(cx + 27, cy + 26);
        ctx.lineTo(cx + 18, cy - 9);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Layered gilded mantle & rune stole
        ctx.fillStyle = '#9a3412';
        ctx.beginPath();
        ctx.roundRect(cx - 19, cy - 10, 38, 22, 9);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#d4a64a';
        ctx.fillRect(cx - 5, cy - 6, 10, 30);
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 1.4;
        ctx.strokeRect(cx - 3, cy - 2, 6, 22);

        // Tall peaked wizard hood with gold trim
        ctx.fillStyle = '#7c2d12';
        ctx.strokeStyle = '#09080c';
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.moveTo(cx - 2, cy - 34);
        ctx.quadraticCurveTo(cx + 18, cy - 22, cx + 15, cy - 5);
        ctx.lineTo(cx - 15, cy - 5);
        ctx.quadraticCurveTo(cx - 18, cy - 22, cx - 2, cy - 34);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - 13, cy - 7);
        ctx.quadraticCurveTo(cx, cy - 24, cx + 13, cy - 7);
        ctx.stroke();

        ctx.fillStyle = '#09080c';
        ctx.beginPath();
        ctx.ellipse(cx, cy - 12, 10, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        drawGlowingEyes(ctx, cx - 7, cy - 14, cx + 3, cy - 14, 4, 3, '#fb923c');

        // Gnarled Ash Staff with floating Solar Ember Orb
        ctx.save();
        ctx.translate(cx + 26, cy);
        ctx.strokeStyle = '#09080c';
        ctx.lineWidth = 2.4;
        ctx.fillStyle = '#78350f';
        ctx.fillRect(-3, -24, 6, 48);
        ctx.strokeRect(-3, -24, 6, 48);
        // Gold crescent prongs holding ember orb
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.arc(0, -29, 9, 0.25, Math.PI - 0.25);
        ctx.stroke();
        const orbG = ctx.createRadialGradient(0, -31, 1, 0, -31, 11);
        orbG.addColorStop(0, '#fef9c3');
        orbG.addColorStop(0.45, '#f97316');
        orbG.addColorStop(1, 'rgba(249,115,22,0)');
        ctx.fillStyle = orbG;
        ctx.beginPath();
        ctx.arc(0, -31, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (cls.id === 'necromancer') {
        // Tattered abyssal-teal spectral robe
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#09080c';
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.moveTo(cx - 18, cy - 10);
        ctx.lineTo(cx - 28, cy + 26);
        ctx.lineTo(cx - 12, cy + 20);
        ctx.lineTo(cx, cy + 28);
        ctx.lineTo(cx + 12, cy + 20);
        ctx.lineTo(cx + 28, cy + 26);
        ctx.lineTo(cx + 18, cy - 10);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Bone-ribbed shoulder mantle
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.roundRect(cx - 20, cy - 10, 40, 22, 8);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 2.6;
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(cx + side * 6, cy - 4);
          ctx.lineTo(cx + side * 20, cy - 8);
          ctx.moveTo(cx + side * 6, cy + 3);
          ctx.lineTo(cx + side * 18, cy + 1);
          ctx.stroke();
        }
        // Cyan soul crystal chest brooch
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.moveTo(cx, cy - 5);
        ctx.lineTo(cx + 5, cy + 2);
        ctx.lineTo(cx, cy + 9);
        ctx.lineTo(cx - 5, cy + 2);
        ctx.closePath();
        ctx.fill();

        // Horned Lich Hood
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#09080c';
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.arc(cx, cy - 14, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Curved bone horns
        ctx.fillStyle = '#e2e8f0';
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(cx + side * 11, cy - 18);
          ctx.quadraticCurveTo(cx + side * 22, cy - 26, cx + side * 16, cy - 34);
          ctx.quadraticCurveTo(cx + side * 14, cy - 24, cx + side * 6, cy - 23);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        ctx.fillStyle = '#020617';
        ctx.beginPath();
        ctx.ellipse(cx, cy - 13, 10, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        drawGlowingEyes(ctx, cx - 7, cy - 15, cx + 3, cy - 15, 4, 3, '#38bdf8');

        // Bone Soul-Scythe Staff on right
        ctx.save();
        ctx.translate(cx + 26, cy);
        ctx.strokeStyle = '#09080c';
        ctx.lineWidth = 2.4;
        ctx.fillStyle = '#475569';
        ctx.fillRect(-2.5, -26, 5, 50);
        ctx.strokeRect(-2.5, -26, 5, 50);
        // Spectral cyan scythe blade
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.moveTo(0, -28);
        ctx.quadraticCurveTo(16, -34, 18, -14);
        ctx.quadraticCurveTo(9, -22, 0, -20);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      } else {
        // Archer: Forest-shadow hooded ranger with quiver & recurve ebony longbow
        ctx.fillStyle = '#14332a';
        ctx.strokeStyle = '#09080c';
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.moveTo(cx - 18, cy - 9);
        ctx.lineTo(cx - 25, cy + 23);
        ctx.lineTo(cx + 22, cy + 23);
        ctx.lineTo(cx + 18, cy - 9);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Arrow Quiver strapped diagonally on left back
        ctx.save();
        ctx.translate(cx - 16, cy - 12);
        ctx.rotate(-0.45);
        ctx.fillStyle = '#78350f';
        ctx.fillRect(-5, -12, 10, 24);
        ctx.strokeRect(-5, -12, 10, 24);
        // Fletched arrow feathers poking out
        ctx.fillStyle = '#34d399';
        ctx.fillRect(-4, -18, 3, 7);
        ctx.fillRect(0, -19, 3, 8);
        ctx.fillRect(3, -17, 3, 6);
        ctx.restore();

        // Leather ranger brigandine + gold clasp
        ctx.fillStyle = '#1e4638';
        ctx.beginPath();
        ctx.roundRect(cx - 17, cy - 10, 34, 26, 8);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(cx - 14, cy - 7);
        ctx.lineTo(cx + 14, cy + 12);
        ctx.stroke();

        // Ranger hood
        ctx.fillStyle = '#0f2922';
        ctx.strokeStyle = '#09080c';
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 30);
        ctx.quadraticCurveTo(cx + 17, cy - 20, cx + 14, cy - 5);
        ctx.lineTo(cx - 14, cy - 5);
        ctx.quadraticCurveTo(cx - 17, cy - 20, cx, cy - 30);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#09080c';
        ctx.beginPath();
        ctx.ellipse(cx, cy - 12, 10, 6.5, 0, 0, Math.PI * 2);
        ctx.fill();
        drawGlowingEyes(ctx, cx - 7, cy - 14, cx + 3, cy - 14, 4, 3, '#34d399');

        // Recurve Ebony Longbow with nocked emerald arrow
        ctx.save();
        ctx.translate(cx + 16, cy - 1);
        // Bowstring
        ctx.strokeStyle = 'rgba(226,232,240,0.75)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(4, -22);
        ctx.lineTo(-2, 0);
        ctx.lineTo(4, 22);
        ctx.stroke();
        // Bow limbs
        ctx.strokeStyle = '#09080c';
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.arc(0, 0, 22, -Math.PI * 0.44, Math.PI * 0.44);
        ctx.stroke();
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 3.8;
        ctx.beginPath();
        ctx.arc(0, 0, 22, -Math.PI * 0.44, Math.PI * 0.44);
        ctx.stroke();
        // Nocked arrow with luminous emerald tip
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(-2, 0);
        ctx.lineTo(24, 0);
        ctx.stroke();
        ctx.fillStyle = '#34d399';
        ctx.beginPath();
        ctx.moveTo(29, 0);
        ctx.lineTo(20, -4.5);
        ctx.lineTo(20, 4.5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    });
  }
}

function generateEnemySprites(scene: Phaser.Scene) {
  for (const e of ENEMY_LIST) {
    // Supersampled 2x canvases so every single monster archetype has bespoke anatomy & silhouette
    const size = e.id === 'golem' ? 116 : e.id === 'stalker' ? 96 : 86;
    makeCanvas(scene, `enemy_${e.id}`, size, size, (ctx, w, h) => {
      const cx = w / 2;
      const cy = h / 2 + 2;

      drawGroundShadow(ctx, cx, cy + size * 0.22, size * 0.27, size * 0.13, 0.52);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#09080c';
      ctx.lineWidth = 2.8;

      switch (e.id) {
        case 'goblin': {
          // Small feral scavenger: hunched dark-leather body, huge jagged ears, curved scimitar & buckler
          // Tattered leather tunic
          ctx.fillStyle = '#4a3525';
          ctx.beginPath();
          ctx.roundRect(cx - 14, cy - 4, 28, 20, 6);
          ctx.fill();
          ctx.stroke();
          // Buckler on left arm
          ctx.fillStyle = '#78350f';
          ctx.beginPath();
          ctx.arc(cx - 18, cy + 4, 9, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#94a3b8';
          ctx.beginPath();
          ctx.arc(cx - 18, cy + 4, 3, 0, Math.PI * 2);
          ctx.fill();
          // Jagged goblin ears
          ctx.fillStyle = '#4d7c3f';
          for (const side of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo(cx + side * 9, cy - 11);
            ctx.lineTo(cx + side * 27, cy - 20);
            ctx.lineTo(cx + side * 19, cy - 6);
            ctx.lineTo(cx + side * 10, cy - 4);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          }
          // Goblin head & snout
          ctx.fillStyle = '#5c914b';
          ctx.beginPath();
          ctx.ellipse(cx, cy - 10, 12, 11, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          drawGlowingEyes(ctx, cx - 7, cy - 12, cx + 3, cy - 12, 4, 3, '#bef264');
          // Curved rusty scimitar
          ctx.fillStyle = '#cbd5e1';
          ctx.beginPath();
          ctx.moveTo(cx + 16, cy + 8);
          ctx.quadraticCurveTo(cx + 30, cy - 4, cx + 22, cy - 22);
          ctx.quadraticCurveTo(cx + 21, cy - 5, cx + 12, cy + 5);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          break;
        }
        case 'skeleton': {
          // Undead vanguard: tattered iron armor, visible ribcage, iron shield & broadsword
          ctx.fillStyle = '#272c38';
          ctx.beginPath();
          ctx.roundRect(cx - 17, cy - 7, 34, 24, 6);
          ctx.fill();
          ctx.stroke();
          // Exposed ivory ribs
          ctx.strokeStyle = '#e2e8f0';
          ctx.lineWidth = 2.4;
          for (let r = 0; r < 3; r++) {
            ctx.beginPath();
            ctx.moveTo(cx - 9, cy - 1 + r * 5);
            ctx.lineTo(cx + 9, cy - 1 + r * 5);
            ctx.stroke();
          }
          // Iron pauldrons
          ctx.strokeStyle = '#09080c';
          ctx.lineWidth = 2.6;
          ctx.fillStyle = '#475569';
          ctx.beginPath();
          ctx.ellipse(cx - 17, cy - 4, 8, 9, 0, 0, Math.PI * 2);
          ctx.ellipse(cx + 17, cy - 4, 8, 9, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          // Skull cranium + jaw
          ctx.fillStyle = '#e2e8f0';
          ctx.beginPath();
          ctx.arc(cx, cy - 13, 12, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(cx - 7, cy - 15, 5, 4);
          ctx.fillRect(cx + 2, cy - 15, 5, 4);
          drawGlowingEyes(ctx, cx - 6, cy - 14, cx + 3, cy - 14, 3, 2, '#f87171');
          // Heavy riveted heater shield (left)
          ctx.fillStyle = '#64748b';
          ctx.beginPath();
          ctx.moveTo(cx - 29, cy - 10);
          ctx.lineTo(cx - 14, cy - 10);
          ctx.lineTo(cx - 14, cy + 8);
          ctx.lineTo(cx - 21.5, cy + 16);
          ctx.lineTo(cx - 29, cy + 8);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          // Notched broadsword (right)
          ctx.fillStyle = '#cbd5e1';
          ctx.beginPath();
          ctx.moveTo(cx + 22, cy - 28);
          ctx.lineTo(cx + 26, cy - 20);
          ctx.lineTo(cx + 25, cy + 8);
          ctx.lineTo(cx + 19, cy + 8);
          ctx.lineTo(cx + 18, cy - 20);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          break;
        }
        case 'archer': {
          // Fragile ranged dark-woodland sniper with bone mask, quiver, drawn bow & glowing amber arrow
          ctx.fillStyle = '#1f2d16';
          ctx.beginPath();
          ctx.moveTo(cx - 14, cy - 8);
          ctx.lineTo(cx - 20, cy + 20);
          ctx.lineTo(cx + 18, cy + 20);
          ctx.lineTo(cx + 14, cy - 8);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          // Back quiver
          ctx.fillStyle = '#713f12';
          ctx.fillRect(cx - 19, cy - 14, 7, 18);
          ctx.strokeRect(cx - 19, cy - 14, 7, 18);
          // Pointed hood + bone mask
          ctx.fillStyle = '#2d441e';
          ctx.beginPath();
          ctx.moveTo(cx, cy - 28);
          ctx.lineTo(cx + 13, cy - 6);
          ctx.lineTo(cx - 13, cy - 6);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#d6d3d1';
          ctx.beginPath();
          ctx.ellipse(cx, cy - 12, 8, 6, 0, 0, Math.PI * 2);
          ctx.fill();
          drawGlowingEyes(ctx, cx - 5, cy - 13, cx + 2, cy - 13, 3, 2.5, '#f59e0b');
          // Drawn dark bow & bright amber arrow
          ctx.strokeStyle = '#a16207';
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.arc(cx + 12, cy, 18, -1.25, 1.25);
          ctx.stroke();
          ctx.strokeStyle = '#f8fafc';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(cx + 17, cy - 17);
          ctx.lineTo(cx + 11, cy);
          ctx.lineTo(cx + 17, cy + 17);
          ctx.stroke();
          ctx.fillStyle = '#f59e0b';
          ctx.fillRect(cx + 11, cy - 1.5, 22, 3);
          break;
        }
        case 'bomber': {
          // Hunched charred fanatic clutching an iron-banded volatile magma keg with burning fuse!
          // Charred imp shoulders & legs
          ctx.fillStyle = '#3f1515';
          ctx.beginPath();
          ctx.roundRect(cx - 16, cy - 2, 32, 22, 7);
          ctx.fill();
          ctx.stroke();
          // Giant iron-banded explosive keg on chest/back
          ctx.fillStyle = '#451a03';
          ctx.beginPath();
          ctx.ellipse(cx, cy + 2, 16, 14, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          // Iron barrel hoops
          ctx.strokeStyle = '#71717a';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(cx - 15, cy - 2);
          ctx.lineTo(cx + 15, cy - 2);
          ctx.moveTo(cx - 14, cy + 7);
          ctx.lineTo(cx + 14, cy + 7);
          ctx.stroke();
          // Glowing volatile magma cracks on barrel
          ctx.strokeStyle = '#fb923c';
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.moveTo(cx - 6, cy - 7);
          ctx.lineTo(cx + 2, cy + 2);
          ctx.lineTo(cx - 3, cy + 10);
          ctx.stroke();
          // Manic horned head peeking above keg
          ctx.strokeStyle = '#09080c';
          ctx.lineWidth = 2.6;
          ctx.fillStyle = '#7f1d1d';
          ctx.beginPath();
          ctx.arc(cx, cy - 14, 10, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          drawGlowingEyes(ctx, cx - 6, cy - 16, cx + 2, cy - 16, 4, 3, '#fef08a');
          // Burning fuse & bright spark flare
          ctx.strokeStyle = '#d6d3d1';
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.moveTo(cx + 8, cy - 12);
          ctx.quadraticCurveTo(cx + 18, cy - 24, cx + 14, cy - 30);
          ctx.stroke();
          const spark = ctx.createRadialGradient(cx + 14, cy - 30, 1, cx + 14, cy - 30, 10);
          spark.addColorStop(0, '#ffffff');
          spark.addColorStop(0.4, '#facc15');
          spark.addColorStop(1, 'rgba(249,115,22,0)');
          ctx.fillStyle = spark;
          ctx.beginPath();
          ctx.arc(cx + 14, cy - 30, 10, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'mage': {
          // Cultist Artillery Mage: tall violet-crimson ritual robe, gold mantle, pointed hood & floating arcane orb
          ctx.fillStyle = '#3b0764';
          ctx.beginPath();
          ctx.moveTo(cx, cy - 28);
          ctx.lineTo(cx + 22, cy + 24);
          ctx.lineTo(cx - 22, cy + 24);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          // Crimson occult mantle with gold edge
          ctx.fillStyle = '#701a75';
          ctx.beginPath();
          ctx.roundRect(cx - 18, cy - 7, 36, 14, 5);
          ctx.fill();
          ctx.stroke();
          ctx.strokeStyle = '#d4a64a';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(cx, cy - 5);
          ctx.lineTo(cx, cy + 22);
          ctx.stroke();
          // Deep shadowed hood face
          ctx.fillStyle = '#09080c';
          ctx.beginPath();
          ctx.ellipse(cx, cy - 13, 9, 7, 0, 0, Math.PI * 2);
          ctx.fill();
          drawGlowingEyes(ctx, cx - 6, cy - 14, cx + 2, cy - 14, 3.5, 3, '#e879f9');
          // Gnarled cultist staff & violet orb
          ctx.strokeStyle = '#09080c';
          ctx.lineWidth = 2.4;
          ctx.fillStyle = '#4c1d95';
          ctx.fillRect(cx + 18, cy - 18, 5, 38);
          ctx.strokeRect(cx + 18, cy - 18, 5, 38);
          const orb = ctx.createRadialGradient(cx + 20.5, cy - 22, 1, cx + 20.5, cy - 22, 10);
          orb.addColorStop(0, '#ffffff');
          orb.addColorStop(0.5, '#c084fc');
          orb.addColorStop(1, 'rgba(192,132,252,0)');
          ctx.fillStyle = orb;
          ctx.beginPath();
          ctx.arc(cx + 20.5, cy - 22, 10, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'golem': {
          // Massive armored basalt colossus with faceted rock plates, giant fists & molten lava fissures
          // Colossal basalt fists
          ctx.fillStyle = '#334155';
          for (const side of [-1, 1]) {
            ctx.beginPath();
            ctx.roundRect(cx + side * 34 - 11, cy - 4, 22, 26, 6);
            ctx.fill();
            ctx.stroke();
          }
          // Broad monolithic rocky torso
          const gGrad = ctx.createLinearGradient(cx - 32, cy - 28, cx + 32, cy + 24);
          gGrad.addColorStop(0, '#64748b');
          gGrad.addColorStop(0.5, '#334155');
          gGrad.addColorStop(1, '#1e293b');
          ctx.fillStyle = gGrad;
          ctx.beginPath();
          ctx.moveTo(cx - 34, cy - 10);
          ctx.lineTo(cx - 22, cy - 32);
          ctx.lineTo(cx + 22, cy - 32);
          ctx.lineTo(cx + 34, cy - 10);
          ctx.lineTo(cx + 26, cy + 24);
          ctx.lineTo(cx - 26, cy + 24);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          // Glowing magma core fissures across stone chest
          ctx.strokeStyle = '#f97316';
          ctx.lineWidth = 3.2;
          ctx.beginPath();
          ctx.moveTo(cx, cy - 16);
          ctx.lineTo(cx - 14, cy + 2);
          ctx.moveTo(cx, cy - 16);
          ctx.lineTo(cx + 15, cy + 4);
          ctx.moveTo(cx, cy - 4);
          ctx.lineTo(cx, cy + 16);
          ctx.stroke();
          ctx.fillStyle = '#fef08a';
          ctx.beginPath();
          ctx.arc(cx, cy - 2, 7, 0, Math.PI * 2);
          ctx.fill();
          // Sunken stone head & furnace eye slit
          ctx.strokeStyle = '#09080c';
          ctx.lineWidth = 2.8;
          ctx.fillStyle = '#1e293b';
          ctx.beginPath();
          ctx.roundRect(cx - 15, cy - 34, 30, 17, 4);
          ctx.fill();
          ctx.stroke();
          drawGlowingEyes(ctx, cx - 10, cy - 27, cx + 4, cy - 27, 6, 4, '#fb923c');
          break;
        }
        case 'healer': {
          // Teal priestly robes, golden crescent reliquary halo, emerald healing staff
          ctx.fillStyle = '#115e59';
          ctx.beginPath();
          ctx.moveTo(cx, cy - 24);
          ctx.lineTo(cx + 20, cy + 22);
          ctx.lineTo(cx - 20, cy + 22);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          // Ivory & gold stole
          ctx.fillStyle = '#e2e8f0';
          ctx.fillRect(cx - 5, cy - 6, 10, 27);
          // Golden reliquary halo behind head
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 2.8;
          ctx.beginPath();
          ctx.arc(cx, cy - 15, 16, Math.PI * 0.9, Math.PI * 2.1);
          ctx.stroke();
          // Hooded head
          ctx.strokeStyle = '#09080c';
          ctx.lineWidth = 2.6;
          ctx.fillStyle = '#0f766e';
          ctx.beginPath();
          ctx.arc(cx, cy - 13, 11, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          drawGlowingEyes(ctx, cx - 6, cy - 14, cx + 2, cy - 14, 3.5, 2.5, '#6ee7b7');
          // Emerald lantern staff
          ctx.fillStyle = '#d4a64a';
          ctx.fillRect(cx + 17, cy - 20, 4, 38);
          ctx.fillStyle = '#34d399';
          ctx.beginPath();
          ctx.arc(cx + 19, cy - 22, 6.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          break;
        }
        case 'shadow_assassin': {
          // Smoky wraith cloak, horned obsidian mask, dual phantom blades
          ctx.fillStyle = '#1e1b4b';
          ctx.beginPath();
          ctx.moveTo(cx - 15, cy - 10);
          ctx.lineTo(cx - 24, cy + 20);
          ctx.lineTo(cx - 10, cy + 12);
          ctx.lineTo(cx, cy + 24);
          ctx.lineTo(cx + 10, cy + 12);
          ctx.lineTo(cx + 24, cy + 20);
          ctx.lineTo(cx + 15, cy - 10);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          // Horned obsidian mask
          ctx.fillStyle = '#0f0d1f';
          ctx.beginPath();
          ctx.moveTo(cx - 12, cy - 16);
          ctx.lineTo(cx - 18, cy - 28);
          ctx.lineTo(cx - 5, cy - 22);
          ctx.lineTo(cx + 5, cy - 22);
          ctx.lineTo(cx + 18, cy - 28);
          ctx.lineTo(cx + 12, cy - 16);
          ctx.lineTo(cx, cy - 3);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          drawGlowingEyes(ctx, cx - 7, cy - 15, cx + 3, cy - 15, 4, 2.5, '#c084fc');
          // Dual glowing phantom blades
          for (const side of [-1, 1]) {
            ctx.fillStyle = '#a855f7';
            ctx.beginPath();
            ctx.moveTo(cx + side * 14, cy + 2);
            ctx.lineTo(cx + side * 31, cy - 14);
            ctx.lineTo(cx + side * 24, cy + 6);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          }
          break;
        }
        case 'stalker': {
          // Broad feral crimson-black predator beast with spiked spine, horned skull & claws
          ctx.fillStyle = '#450a0a';
          ctx.beginPath();
          ctx.ellipse(cx, cy + 2, 23, 20, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          // Spiky bone dorsal ridge
          ctx.fillStyle = '#cbd5e1';
          for (let s = -1; s <= 1; s++) {
            ctx.beginPath();
            ctx.moveTo(cx - 4, cy + s * 9);
            ctx.lineTo(cx, cy - 5 + s * 9);
            ctx.lineTo(cx + 4, cy + s * 9);
            ctx.closePath();
            ctx.fill();
          }
          // Muscular clawed forelimbs
          ctx.fillStyle = '#7f1d1d';
          for (const side of [-1, 1]) {
            ctx.beginPath();
            ctx.ellipse(cx + side * 24, cy - 8, 9, 14, side * 0.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.strokeStyle = '#f8fafc';
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            ctx.moveTo(cx + side * 24, cy - 18);
            ctx.lineTo(cx + side * 28, cy - 27);
            ctx.moveTo(cx + side * 20, cy - 19);
            ctx.lineTo(cx + side * 22, cy - 28);
            ctx.stroke();
            ctx.strokeStyle = '#09080c';
            ctx.lineWidth = 2.8;
          }
          // Horned beast head
          ctx.fillStyle = '#991b1b';
          ctx.beginPath();
          ctx.ellipse(cx, cy - 15, 14, 11, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#e2e8f0';
          for (const side of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo(cx + side * 11, cy - 18);
            ctx.lineTo(cx + side * 21, cy - 30);
            ctx.lineTo(cx + side * 6, cy - 23);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          }
          drawGlowingEyes(ctx, cx - 8, cy - 17, cx + 3, cy - 17, 4.5, 3, '#fb7185');
          break;
        }
        case 'summoner': {
          // Floating void warlock with horned skull crown, bone scepter & twin orbiting purple wisps
          ctx.fillStyle = '#2e1065';
          ctx.beginPath();
          ctx.moveTo(cx, cy - 26);
          ctx.lineTo(cx + 22, cy + 24);
          ctx.lineTo(cx + 9, cy + 16);
          ctx.lineTo(cx, cy + 26);
          ctx.lineTo(cx - 9, cy + 16);
          ctx.lineTo(cx - 22, cy + 24);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          // Floating skull-crown
          ctx.fillStyle = '#e2e8f0';
          ctx.beginPath();
          ctx.moveTo(cx - 12, cy - 18);
          ctx.lineTo(cx - 15, cy - 30);
          ctx.lineTo(cx - 5, cy - 23);
          ctx.lineTo(cx, cy - 32);
          ctx.lineTo(cx + 5, cy - 23);
          ctx.lineTo(cx + 15, cy - 30);
          ctx.lineTo(cx + 12, cy - 18);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#09080c';
          ctx.beginPath();
          ctx.ellipse(cx, cy - 12, 10, 7, 0, 0, Math.PI * 2);
          ctx.fill();
          drawGlowingEyes(ctx, cx - 6, cy - 13, cx + 2, cy - 13, 3.5, 3, '#f0abfc');
          // Orbiting soul wisps
          for (const side of [-1, 1]) {
            const wg = ctx.createRadialGradient(cx + side * 24, cy - 4, 1, cx + side * 24, cy - 4, 8);
            wg.addColorStop(0, '#ffffff');
            wg.addColorStop(0.5, '#e879f9');
            wg.addColorStop(1, 'rgba(232,121,249,0)');
            ctx.fillStyle = wg;
            ctx.beginPath();
            ctx.arc(cx + side * 24, cy - 4, 8, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        }
      }
    });
  }
}

function generateBossSprites(scene: Phaser.Scene) {
  for (const boss of BOSSES) {
    // Imposing supersampled 164x164–196x196 boss sprites with unique anatomy per boss
    const size = boss.isMegaBoss ? 196 : 164;
    makeCanvas(scene, `boss_${boss.id}`, size, size, (ctx, w, h) => {
      const cx = w / 2;
      const cy = h / 2 + 4;
      const r = boss.isMegaBoss ? 66 : 54;

      // Ominous runic ground aura + deep drop shadow
      const aura = ctx.createRadialGradient(cx, cy, r * 0.25, cx, cy, r * 1.3);
      aura.addColorStop(0, 'rgba(0,0,0,0.72)');
      aura.addColorStop(0.62, `${boss.accentColor}40`);
      aura.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.3, 0, Math.PI * 2);
      ctx.fill();
      drawGroundShadow(ctx, cx, cy + r * 0.45, r * 0.88, r * 0.42, 0.65);

      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#08070b';
      ctx.lineWidth = 3.6;

      if (boss.id === 'glacial_dragon') {
        // MEGA-BOSS: Winged Top-Down Frost Wyrm
        // Spiked ice tail curling bottom
        ctx.fillStyle = '#0369a1';
        ctx.beginPath();
        ctx.moveTo(cx - 12, cy + 28);
        ctx.quadraticCurveTo(cx + 18, cy + 56, cx - 14, cy + 74);
        ctx.quadraticCurveTo(cx + 4, cy + 54, cx + 10, cy + 28);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Huge crystalline frost wings
        for (const side of [-1, 1]) {
          const wg = ctx.createLinearGradient(cx, cy, cx + side * 86, cy - 34);
          wg.addColorStop(0, '#0284c7');
          wg.addColorStop(0.6, '#38bdf8');
          wg.addColorStop(1, '#e0f2fe');
          ctx.fillStyle = wg;
          ctx.beginPath();
          ctx.moveTo(cx + side * 14, cy - 8);
          ctx.lineTo(cx + side * 88, cy - 42);
          ctx.lineTo(cx + side * 74, cy + 4);
          ctx.lineTo(cx + side * 52, cy - 6);
          ctx.lineTo(cx + side * 62, cy + 26);
          ctx.lineTo(cx + side * 16, cy + 16);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        // Armored sapphire body & ice dorsal plates
        ctx.fillStyle = '#075985';
        ctx.beginPath();
        ctx.ellipse(cx, cy + 4, 28, 36, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#bae6fd';
        for (let k = -2; k <= 2; k++) {
          ctx.beginPath();
          ctx.moveTo(cx, cy + k * 12 - 8);
          ctx.lineTo(cx + 8, cy + k * 12);
          ctx.lineTo(cx, cy + k * 12 + 8);
          ctx.lineTo(cx - 8, cy + k * 12);
          ctx.closePath();
          ctx.fill();
        }
        // Horned Draconic Skull & Frost Maw
        ctx.fillStyle = '#0284c7';
        ctx.beginPath();
        ctx.moveTo(cx, cy - 58);
        ctx.lineTo(cx + 22, cy - 30);
        ctx.lineTo(cx + 16, cy - 12);
        ctx.lineTo(cx - 16, cy - 12);
        ctx.lineTo(cx - 22, cy - 30);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Swept crystalline horns
        ctx.fillStyle = '#e0f2fe';
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(cx + side * 14, cy - 28);
          ctx.lineTo(cx + side * 38, cy - 58);
          ctx.lineTo(cx + side * 20, cy - 18);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        drawGlowingEyes(ctx, cx - 12, cy - 36, cx + 6, cy - 36, 6, 5, '#e0f2fe');
      } else if (boss.id === 'dungeon_god') {
        // MEGA-BOSS: Primordial Six-Winged Celestial Deity
        // Sacred geometry solar halo
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy - 14, 58, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(cx, cy - 14, 48, 0, Math.PI * 2);
        ctx.stroke();
        // 6 Radiant Seraphim Wings
        ctx.strokeStyle = '#08070b';
        ctx.lineWidth = 3;
        for (const side of [-1, 1]) {
          for (let wIdx = 0; wIdx < 3; wIdx++) {
            const yOff = -22 + wIdx * 20;
            ctx.fillStyle = wIdx === 1 ? '#facc15' : '#ca8a04';
            ctx.beginPath();
            ctx.moveTo(cx + side * 18, cy + yOff);
            ctx.lineTo(cx + side * (86 - wIdx * 8), cy + yOff - 28 + wIdx * 10);
            ctx.lineTo(cx + side * (66 - wIdx * 8), cy + yOff + 10 + wIdx * 4);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          }
        }
        // Obsidian-and-gold armored deity torso
        ctx.fillStyle = '#1c1917';
        ctx.beginPath();
        ctx.roundRect(cx - 32, cy - 24, 64, 58, 14);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#eab308';
        ctx.beginPath();
        ctx.moveTo(cx, cy - 16);
        ctx.lineTo(cx + 18, cy + 6);
        ctx.lineTo(cx, cy + 28);
        ctx.lineTo(cx - 18, cy + 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Triple-ringed radiant crown & featureless glowing mask
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.moveTo(cx - 24, cy - 36);
        ctx.lineTo(cx - 30, cy - 66);
        ctx.lineTo(cx - 10, cy - 48);
        ctx.lineTo(cx, cy - 74);
        ctx.lineTo(cx + 10, cy - 48);
        ctx.lineTo(cx + 30, cy - 66);
        ctx.lineTo(cx + 24, cy - 36);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#09080c';
        ctx.beginPath();
        ctx.arc(cx, cy - 26, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        drawGlowingEyes(ctx, cx - 12, cy - 29, cx + 4, cy - 29, 8, 5, '#fef08a');
      } else if (boss.id === 'abyss_devourer') {
        // Eldritch void horror with mandibles, tentacles & multi-eyed event-horizon core
        ctx.fillStyle = '#4a044e';
        for (let t = 0; t < 8; t++) {
          const a = (Math.PI * 2 * t) / 8;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * 20, cy + Math.sin(a) * 20);
          ctx.lineTo(cx + Math.cos(a + 0.18) * 66, cy + Math.sin(a + 0.18) * 66);
          ctx.lineTo(cx + Math.cos(a - 0.18) * 44, cy + Math.sin(a - 0.18) * 44);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        ctx.fillStyle = '#2e1065';
        ctx.beginPath();
        ctx.arc(cx, cy, 42, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Swirling maw
        const maw = ctx.createRadialGradient(cx, cy, 4, cx, cy, 26);
        maw.addColorStop(0, '#09080c');
        maw.addColorStop(0.65, '#a21caf');
        maw.addColorStop(1, '#f0abfc');
        ctx.fillStyle = maw;
        ctx.beginPath();
        ctx.arc(cx, cy, 24, 0, Math.PI * 2);
        ctx.fill();
        // Multi-eyes ring
        for (let k = 0; k < 6; k++) {
          const a = (Math.PI * 2 * k) / 6;
          ctx.fillStyle = '#f0abfc';
          ctx.beginPath();
          ctx.arc(cx + Math.cos(a) * 32, cy + Math.sin(a) * 32, 4.5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (boss.id === 'forest_guardian') {
        // Ancient Treant Colossus with stag-antler branch crown & glowing emerald heartwood
        ctx.fillStyle = '#2c221a';
        ctx.beginPath();
        ctx.moveTo(cx - 46, cy - 12);
        ctx.lineTo(cx - 32, cy - 36);
        ctx.lineTo(cx + 32, cy - 36);
        ctx.lineTo(cx + 46, cy - 12);
        ctx.lineTo(cx + 38, cy + 36);
        ctx.lineTo(cx - 38, cy + 36);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Mossy bark plates & knotted root fists
        ctx.fillStyle = '#166534';
        ctx.beginPath();
        ctx.ellipse(cx - 44, cy + 6, 15, 22, 0.2, 0, Math.PI * 2);
        ctx.ellipse(cx + 44, cy + 6, 15, 22, -0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Glowing emerald heart core
        const core = ctx.createRadialGradient(cx, cy + 6, 2, cx, cy + 6, 20);
        core.addColorStop(0, '#dcfce7');
        core.addColorStop(0.5, '#4ade80');
        core.addColorStop(1, 'rgba(74,222,128,0)');
        ctx.fillStyle = core;
        ctx.beginPath();
        ctx.arc(cx, cy + 6, 20, 0, Math.PI * 2);
        ctx.fill();
        // Stag-antler branch crown
        ctx.strokeStyle = '#5c4033';
        ctx.lineWidth = 6;
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(cx + side * 14, cy - 32);
          ctx.lineTo(cx + side * 38, cy - 60);
          ctx.moveTo(cx + side * 26, cy - 46);
          ctx.lineTo(cx + side * 46, cy - 42);
          ctx.moveTo(cx + side * 24, cy - 44);
          ctx.lineTo(cx + side * 20, cy - 66);
          ctx.stroke();
        }
        drawGlowingEyes(ctx, cx - 14, cy - 22, cx + 6, cy - 22, 8, 5, '#4ade80');
      } else {
        // Sovereign Warlord / Knight / Demon / Lich / Monarch / Chaos Lord — custom weapons, wings, capes & crowns
        const hasWings = boss.id === 'magma_demon' || boss.id === 'chaos_lord' || boss.id === 'shadow_monarch';
        if (hasWings) {
          for (const side of [-1, 1]) {
            ctx.fillStyle = boss.primaryColor;
            ctx.beginPath();
            ctx.moveTo(cx + side * 16, cy - 6);
            ctx.lineTo(cx + side * 76, cy - 46);
            ctx.lineTo(cx + side * 66, cy + 16);
            ctx.lineTo(cx + side * 44, cy + 4);
            ctx.lineTo(cx + side * 52, cy + 32);
            ctx.lineTo(cx + side * 18, cy + 18);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          }
        } else {
          // Royal tattered war-cape
          ctx.fillStyle = boss.id === 'goblin_king' ? '#7f1d1d' : '#1e1b2e';
          ctx.beginPath();
          ctx.moveTo(cx - 34, cy - 16);
          ctx.lineTo(cx - 52, cy + 46);
          ctx.lineTo(cx, cy + 38);
          ctx.lineTo(cx + 52, cy + 46);
          ctx.lineTo(cx + 34, cy - 16);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }

        // Broad armored warlord torso
        ctx.fillStyle = boss.primaryColor;
        ctx.beginPath();
        ctx.roundRect(cx - 38, cy - 24, 76, 56, 14);
        ctx.fill();
        ctx.stroke();

        // Spiked shoulder pauldrons
        for (const side of [-1, 1]) {
          ctx.fillStyle = '#1f1d28';
          ctx.beginPath();
          ctx.ellipse(cx + side * 38, cy - 12, 16, 18, side * 0.25, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          // Shoulder spike or trophy skull
          ctx.fillStyle = boss.id === 'goblin_king' || boss.id === 'king_of_dead' ? '#e2e8f0' : boss.accentColor;
          ctx.beginPath();
          ctx.moveTo(cx + side * 38, cy - 22);
          ctx.lineTo(cx + side * 56, cy - 36);
          ctx.lineTo(cx + side * 48, cy - 12);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }

        // Chest emblem / core
        ctx.fillStyle = boss.accentColor;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 12);
        ctx.lineTo(cx + 16, cy + 6);
        ctx.lineTo(cx, cy + 24);
        ctx.lineTo(cx - 16, cy + 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Head / Helmet
        ctx.fillStyle = boss.id === 'goblin_king' ? '#4d7c3f' : '#181622';
        ctx.beginPath();
        ctx.arc(cx, cy - 22, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Signature Crown or Sweeping Horns
        ctx.fillStyle = boss.accentColor;
        if (boss.id === 'magma_demon' || boss.id === 'corrupted_knight') {
          for (const side of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo(cx + side * 14, cy - 30);
            ctx.quadraticCurveTo(cx + side * 42, cy - 42, cx + side * 30, cy - 68);
            ctx.quadraticCurveTo(cx + side * 24, cy - 46, cx + side * 8, cy - 38);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          }
        } else {
          ctx.beginPath();
          ctx.moveTo(cx - 22, cy - 34);
          ctx.lineTo(cx - 30, cy - 60);
          ctx.lineTo(cx - 10, cy - 44);
          ctx.lineTo(cx, cy - 66);
          ctx.lineTo(cx + 10, cy - 44);
          ctx.lineTo(cx + 30, cy - 60);
          ctx.lineTo(cx + 22, cy - 34);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }

        // Boss signature colossal weapon on right side
        ctx.save();
        ctx.translate(cx + 50, cy - 4);
        ctx.rotate(0.2);
        ctx.fillStyle = boss.id === 'goblin_king' ? '#94a3b8' : '#e2e8f0';
        ctx.beginPath();
        ctx.moveTo(0, -52);
        ctx.lineTo(12, -32);
        ctx.lineTo(9, 24);
        ctx.lineTo(-9, 24);
        ctx.lineTo(-10, -34);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = boss.accentColor;
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(0, -40);
        ctx.lineTo(0, 14);
        ctx.stroke();
        ctx.restore();

        drawGlowingEyes(ctx, cx - 12, cy - 25, cx + 4, cy - 25, 8, 5, boss.accentColor);
      }
    });
  }
}

function generateProjectilesAndEffects(scene: Phaser.Scene) {
  // Arrow
  makeCanvas(scene, 'proj_arrow', 32, 12, (ctx) => {
    ctx.fillStyle = '#34d399';
    ctx.fillRect(1, 3, 6, 2);
    ctx.fillRect(1, 7, 6, 2);
    ctx.fillStyle = '#d97706';
    ctx.fillRect(4, 5, 19, 2);
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(31, 6);
    ctx.lineTo(20, 1);
    ctx.lineTo(22, 6);
    ctx.lineTo(20, 11);
    ctx.closePath();
    ctx.fill();
  });

  // Twin dagger
  makeCanvas(scene, 'proj_dagger', 28, 14, (ctx) => {
    ctx.fillStyle = '#e879f9';
    ctx.strokeStyle = '#1e1b26';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(27, 7);
    ctx.lineTo(8, 2);
    ctx.lineTo(2, 7);
    ctx.lineTo(8, 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(10, 6, 11, 2);
  });

  // Arcane bolt
  makeCanvas(scene, 'proj_arcane', 24, 24, (ctx) => {
    const g = ctx.createRadialGradient(12, 12, 2, 12, 12, 12);
    g.addColorStop(0, '#fff7ed');
    g.addColorStop(0.45, '#fb923c');
    g.addColorStop(1, 'rgba(249,115,22,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(12, 12, 12, 0, Math.PI * 2);
    ctx.fill();
  });

  // Soul orb
  makeCanvas(scene, 'proj_soul', 24, 24, (ctx) => {
    const g = ctx.createRadialGradient(12, 12, 2, 12, 12, 12);
    g.addColorStop(0, '#e0f2fe');
    g.addColorStop(0.5, '#38bdf8');
    g.addColorStop(1, 'rgba(56,189,248,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(12, 12, 12, 0, Math.PI * 2);
    ctx.fill();
  });

  // Fireball
  makeCanvas(scene, 'proj_fireball', 36, 36, (ctx) => {
    const g = ctx.createRadialGradient(18, 18, 3, 18, 18, 18);
    g.addColorStop(0, '#fef08a');
    g.addColorStop(0.45, '#f97316');
    g.addColorStop(0.8, '#b91c1c');
    g.addColorStop(1, 'rgba(185,28,28,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(18, 18, 18, 0, Math.PI * 2);
    ctx.fill();
  });

  // Shadow slash crescent
  makeCanvas(scene, 'proj_shadow_wave', 42, 56, (ctx) => {
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(10, 28, 24, -Math.PI * 0.44, Math.PI * 0.44);
    ctx.stroke();
    ctx.strokeStyle = '#faf5ff';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(13, 28, 22, -Math.PI * 0.38, Math.PI * 0.38);
    ctx.stroke();
  });

  // Orbital blade
  makeCanvas(scene, 'proj_orbital', 30, 14, (ctx) => {
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(29, 7);
    ctx.lineTo(11, 2);
    ctx.lineTo(1, 7);
    ctx.lineTo(11, 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });

  // Enemy projectiles — sharper silhouette + dark rim for instant high-contrast readability
  makeCanvas(scene, 'proj_enemy_bolt', 24, 14, (ctx) => {
    const g = ctx.createRadialGradient(13, 7, 2, 13, 7, 10);
    g.addColorStop(0, '#fff1f2');
    g.addColorStop(0.5, '#f43f5e');
    g.addColorStop(1, 'rgba(244,63,94,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(13, 7, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffe4e6';
    ctx.strokeStyle = '#881337';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(23, 7);
    ctx.lineTo(9, 3);
    ctx.lineTo(3, 7);
    ctx.lineTo(9, 11);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });

  makeCanvas(scene, 'proj_boss_orb', 28, 28, (ctx) => {
    const g = ctx.createRadialGradient(14, 14, 3, 14, 14, 14);
    g.addColorStop(0, '#fef9c3');
    g.addColorStop(0.42, '#ef4444');
    g.addColorStop(0.75, '#7f1d1d');
    g.addColorStop(1, 'rgba(127,29,29,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(14, 14, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(14, 14, 7, 0, Math.PI * 2);
    ctx.stroke();
  });

  // Shadow summon minion — spectral horned warrior wisp
  makeCanvas(scene, 'minion_shadow', 42, 42, (ctx) => {
    const g = ctx.createRadialGradient(21, 21, 4, 21, 21, 18);
    g.addColorStop(0, 'rgba(129,140,248,0.5)');
    g.addColorStop(1, 'rgba(79,70,229,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(21, 21, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1e1b4b';
    ctx.strokeStyle = '#a5b4fc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(21, 5);
    ctx.lineTo(32, 26);
    ctx.lineTo(25, 34);
    ctx.lineTo(21, 28);
    ctx.lineTo(17, 34);
    ctx.lineTo(10, 26);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    drawGlowingEyes(ctx, 15, 16, 23, 16, 3.5, 2.5, '#38bdf8');
  });

  // Soft radial light glow
  makeCanvas(scene, 'fx_glow', 128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.18)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  });

  // Crisp particle spark
  makeCanvas(scene, 'fx_spark', 10, 10, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(5, 5, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  // Heavy layered melee cleave slash arc
  makeCanvas(scene, 'fx_slash', 120, 120, (ctx) => {
    ctx.strokeStyle = 'rgba(249, 115, 22, 0.55)';
    ctx.lineWidth = 18;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(40, 60, 50, -Math.PI * 0.46, Math.PI * 0.46);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.96)';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.arc(44, 60, 48, -Math.PI * 0.42, Math.PI * 0.42);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.85)';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(49, 60, 42, -Math.PI * 0.35, Math.PI * 0.35);
    ctx.stroke();
  });
}

function generatePropsAndPickups(scene: Phaser.Scene) {
  // Iron Brazier
  makeCanvas(scene, 'prop_brazier', 32, 32, (ctx) => {
    ctx.fillStyle = '#27272a';
    ctx.strokeStyle = '#09090b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(16, 16, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.arc(16, 16, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(16, 16, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  // Dungeon Portal
  makeCanvas(scene, 'prop_portal', 76, 76, (ctx) => {
    const g = ctx.createRadialGradient(38, 38, 6, 38, 38, 36);
    g.addColorStop(0, '#faf5ff');
    g.addColorStop(0.35, '#a855f7');
    g.addColorStop(0.75, '#4c1d95');
    g.addColorStop(1, 'rgba(76,29,149,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(38, 38, 36, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#d4a64a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(38, 38, 28, 0, Math.PI * 2);
    ctx.stroke();
  });

  // Treasure Chest
  makeCanvas(scene, 'prop_chest', 40, 34, (ctx) => {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(4, 24, 32, 8);
    ctx.fillStyle = '#78350f';
    ctx.strokeStyle = '#09080c';
    ctx.lineWidth = 2;
    ctx.fillRect(5, 8, 30, 20);
    ctx.strokeRect(5, 8, 30, 20);
    ctx.fillStyle = '#d4a64a';
    ctx.fillRect(5, 14, 30, 4);
    ctx.fillRect(17, 12, 6, 8);
  });

  // Blood / Upgrade Altar
  makeCanvas(scene, 'prop_altar', 46, 46, (ctx) => {
    ctx.fillStyle = '#272330';
    ctx.strokeStyle = '#09080c';
    ctx.lineWidth = 2;
    ctx.fillRect(6, 10, 34, 28);
    ctx.strokeRect(6, 10, 34, 28);
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.moveTo(23, 6);
    ctx.lineTo(31, 20);
    ctx.lineTo(23, 30);
    ctx.lineTo(15, 20);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });

  // Mysterious Merchant (hooded relic peddler with warm lantern & carpet)
  makeCanvas(scene, 'prop_merchant', 52, 52, (ctx) => {
    // Crimson/gold merchant rug
    ctx.fillStyle = '#451a24';
    ctx.strokeStyle = '#d4a64a';
    ctx.lineWidth = 1.5;
    ctx.fillRect(6, 26, 40, 20);
    ctx.strokeRect(6, 26, 40, 20);
    // Ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(26, 36, 14, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    // Cloaked torso & hood
    ctx.fillStyle = '#1e1b2e';
    ctx.strokeStyle = '#09080c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(26, 6);
    ctx.lineTo(39, 34);
    ctx.lineTo(13, 34);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Gold cloak trim
    ctx.strokeStyle = '#d4a64a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(26, 10);
    ctx.lineTo(26, 33);
    ctx.stroke();
    // Glowing amber eyes under hood
    ctx.fillStyle = '#facc15';
    ctx.fillRect(21, 16, 3, 2.5);
    ctx.fillRect(28, 16, 3, 2.5);
    // Warm hanging lantern
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.arc(41, 22, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(41, 22, 2, 0, Math.PI * 2);
    ctx.fill();
  });

  // Pickups
  makeCanvas(scene, 'pick_xp', 14, 14, (ctx) => {
    ctx.fillStyle = '#38bdf8';
    ctx.strokeStyle = '#0c4a6e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(7, 1);
    ctx.lineTo(13, 7);
    ctx.lineTo(7, 13);
    ctx.lineTo(1, 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });

  makeCanvas(scene, 'pick_gold', 14, 14, (ctx) => {
    ctx.fillStyle = '#facc15';
    ctx.strokeStyle = '#854d0e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(7, 7, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  makeCanvas(scene, 'pick_crystal', 18, 22, (ctx) => {
    ctx.fillStyle = '#c084fc';
    ctx.strokeStyle = '#3b0764';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(9, 1);
    ctx.lineTo(16, 9);
    ctx.lineTo(12, 20);
    ctx.lineTo(6, 20);
    ctx.lineTo(2, 9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });

  makeCanvas(scene, 'pick_potion', 16, 18, (ctx) => {
    ctx.fillStyle = '#ef4444';
    ctx.strokeStyle = '#450a0a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(8, 11, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(6, 2, 4, 4);
  });

  makeCanvas(scene, 'pick_gear', 22, 22, (ctx) => {
    const g = ctx.createRadialGradient(11, 11, 2, 11, 11, 11);
    g.addColorStop(0, '#fef08a');
    g.addColorStop(0.6, '#f59e0b');
    g.addColorStop(1, 'rgba(245,158,11,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(11, 11, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(9, 5, 4, 12);
    ctx.fillRect(6, 9, 10, 4);
  });
}
