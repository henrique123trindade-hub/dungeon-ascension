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
    // 4 handcrafted organic weathered flagstone variations per biome (eliminates grid/crack repetition)
    for (let v = 0; v < 4; v++) {
      makeCanvas(scene, `floor_${b.index}_${v}`, 64, 64, (ctx, w, h) => {
        // Deep subtle mortar bed
        ctx.fillStyle = b.floorSecondary;
        ctx.fillRect(0, 0, w, h);

        const layouts = [
          [
            [1, 1, 30, 30],
            [33, 1, 30, 30],
            [1, 33, 40, 30],
            [43, 33, 20, 30],
          ],
          [
            [1, 1, 42, 27],
            [45, 1, 18, 27],
            [1, 30, 26, 33],
            [29, 30, 34, 33],
          ],
          [
            [1, 1, 25, 37],
            [28, 1, 35, 22],
            [28, 25, 35, 38],
            [1, 40, 25, 23],
          ],
          [
            [1, 1, 62, 30],
            [1, 33, 30, 30],
            [33, 33, 30, 30],
          ],
        ];
        const stones = layouts[v];
        for (let si = 0; si < stones.length; si++) {
          const [x, y, sw, sh] = stones[si];
          ctx.fillStyle = b.floorPrimary;
          ctx.fillRect(x, y, sw, sh);

          // Soft directional stone shading gradient (top-left lit, bottom-right shaded)
          const sg = ctx.createLinearGradient(x, y, x + sw, y + sh);
          if ((si + v) % 3 === 0) {
            sg.addColorStop(0, 'rgba(255,255,255,0.032)');
            sg.addColorStop(1, 'rgba(0,0,0,0.16)');
          } else if ((si + v) % 3 === 1) {
            sg.addColorStop(0, 'rgba(0,0,0,0.06)');
            sg.addColorStop(1, 'rgba(0,0,0,0.2)');
          } else {
            sg.addColorStop(0, 'rgba(255,255,255,0.018)');
            sg.addColorStop(1, 'rgba(0,0,0,0.11)');
          }
          ctx.fillStyle = sg;
          ctx.fillRect(x, y, sw, sh);

          // Subtle worn bevel edges
          ctx.fillStyle = 'rgba(255,255,255,0.038)';
          ctx.fillRect(x, y, sw, 1.5);
          ctx.fillRect(x, y, 1.5, sh);
          ctx.fillStyle = 'rgba(0,0,0,0.22)';
          ctx.fillRect(x, y + sh - 1.5, sw, 1.5);
          ctx.fillRect(x + sw - 1.5, y, 1.5, sh);
        }

        // Subtle deterministic stone grain / mineral speckles
        for (let p = 0; p < 10; p++) {
          const px = ((p * 23 + v * 17 + b.index * 7) % 58) + 3;
          const py = ((p * 37 + v * 11 + b.index * 13) % 58) + 3;
          ctx.fillStyle = p % 2 === 0 ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.03)';
          ctx.fillRect(px, py, 2, 2);
        }

        // Hairline organic fractures only on variants 1 and 3 (breaks monotony)
        if (v === 1 || v === 3) {
          ctx.strokeStyle = b.floorCrack;
          ctx.globalAlpha = 0.55;
          ctx.lineWidth = 1;
          ctx.beginPath();
          if (v === 1) {
            ctx.moveTo(38, 36);
            ctx.lineTo(44, 42);
            ctx.lineTo(50, 40);
            ctx.moveTo(44, 42);
            ctx.lineTo(46, 48);
          } else {
            ctx.moveTo(12, 14);
            ctx.lineTo(19, 19);
            ctx.lineTo(25, 17);
          }
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        // Atmospheric biome crevice detail (moss/ember/frost/runic dust) on variant 2
        if (v === 2) {
          ctx.fillStyle = b.accentGlow;
          ctx.globalAlpha = b.index === 0 ? 0.12 : 0.19;
          ctx.fillRect(26, 23, 3, 5);
          ctx.fillRect(27, 25, 4, 2);
          ctx.fillRect(10, 38, 5, 2);
          ctx.globalAlpha = 1;
        }
      });
    }

    // Perimeter Wall Masonry Block (64x64) — sculpted ashlar brickwork with top parapet & deep front plinth
    makeCanvas(scene, `wall_${b.index}`, 64, 64, (ctx, w, h) => {
      ctx.fillStyle = '#09080c';
      ctx.fillRect(0, 0, w, h);

      // Top stone parapet surface (44px)
      const topG = ctx.createLinearGradient(0, 0, 0, 46);
      topG.addColorStop(0, b.wallHighlight);
      topG.addColorStop(0.22, b.wallPrimary);
      topG.addColorStop(1, b.floorSecondary);
      ctx.fillStyle = topG;
      ctx.fillRect(1, 1, w - 2, 45);

      // Offset ashlar brick courses on parapet
      ctx.strokeStyle = 'rgba(8, 7, 12, 0.72)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(1, 16);
      ctx.lineTo(w - 1, 16);
      ctx.moveTo(1, 31);
      ctx.lineTo(w - 1, 31);
      ctx.moveTo(32, 1);
      ctx.lineTo(32, 16);
      ctx.moveTo(16, 16);
      ctx.lineTo(16, 31);
      ctx.moveTo(48, 16);
      ctx.lineTo(48, 31);
      ctx.moveTo(32, 31);
      ctx.lineTo(32, 46);
      ctx.stroke();

      // Subtle bevel highlights along brick upper edges
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(2, 2, w - 4, 2);
      ctx.fillRect(2, 17, w - 4, 1.5);
      ctx.fillRect(2, 32, w - 4, 1.5);

      // Front vertical wall drop face (gives clean 2.5D top-down depth)
      const frontG = ctx.createLinearGradient(0, 46, 0, h);
      frontG.addColorStop(0, b.wallPrimary);
      frontG.addColorStop(0.28, b.floorSecondary);
      frontG.addColorStop(1, '#08070b');
      ctx.fillStyle = frontG;
      ctx.fillRect(1, 46, w - 2, 17);

      // Vertical stone joint on front face + top rim cornice shadow
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(1, 45, w - 2, 2);
      ctx.fillRect(22, 47, 2, 15);
      ctx.fillRect(46, 47, 2, 15);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(2, 47, w - 4, 1.5);
    });

    // Dedicated Arena Gothic Pillar (64x64) — carved stepped stone column with iron clasps & subtle biome sigil
    makeCanvas(scene, `pillar_${b.index}`, 64, 64, (ctx, w, h) => {
      // Soft cast ground shadow beneath column
      const sh = ctx.createRadialGradient(32, 38, 10, 32, 38, 31);
      sh.addColorStop(0, 'rgba(0,0,0,0.62)');
      sh.addColorStop(0.75, 'rgba(0,0,0,0.34)');
      sh.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sh;
      ctx.fillRect(0, 0, w, h);

      // Stepped lower stone plinth
      ctx.fillStyle = b.floorSecondary;
      ctx.strokeStyle = '#09080c';
      ctx.lineWidth = 2;
      ctx.fillRect(4, 10, 56, 50);
      ctx.strokeRect(4, 10, 56, 50);

      // Front face of column shaft
      const shaftG = ctx.createLinearGradient(8, 38, 8, 58);
      shaftG.addColorStop(0, b.wallPrimary);
      shaftG.addColorStop(1, '#0c0a12');
      ctx.fillStyle = shaftG;
      ctx.fillRect(7, 42, 50, 16);

      // Carved top capital slab
      const capG = ctx.createLinearGradient(8, 5, 56, 46);
      capG.addColorStop(0, b.wallHighlight);
      capG.addColorStop(0.45, b.wallPrimary);
      capG.addColorStop(1, b.floorSecondary);
      ctx.fillStyle = capG;
      ctx.fillRect(7, 5, 50, 40);
      ctx.strokeStyle = '#0b0a0e';
      ctx.lineWidth = 2;
      ctx.strokeRect(7, 5, 50, 40);

      // Recessed inner stone frame on top cap
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(12, 10, 40, 30);

      // Corner wrought-iron clasps
      ctx.fillStyle = '#27272a';
      ctx.strokeStyle = '#09080c';
      ctx.lineWidth = 1;
      for (const [rx, ry] of [
        [7, 5],
        [49, 5],
        [7, 37],
        [49, 37],
      ]) {
        ctx.fillRect(rx, ry, 8, 8);
        ctx.strokeRect(rx, ry, 8, 8);
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(rx + 2, ry + 2, 2, 2);
        ctx.fillStyle = '#27272a';
      }

      // Subtle engraved biome rune diamond in crown center
      ctx.save();
      ctx.strokeStyle = b.accentGlow;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(32, 15);
      ctx.lineTo(41, 25);
      ctx.lineTo(32, 35);
      ctx.lineTo(23, 25);
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = b.accentGlow;
      ctx.globalAlpha = 0.25;
      ctx.fill();
      ctx.restore();
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
          // Dark-fantasy undead vanguard: tattered grave mantle, weathered aged-bone skull, cracked iron half-helm, rimmed shield & crossguard blade
          // Tattered dark-crimson grave cape behind torso
          ctx.fillStyle = '#3b151e';
          ctx.beginPath();
          ctx.moveTo(cx - 17, cy - 10);
          ctx.lineTo(cx - 21, cy + 20);
          ctx.lineTo(cx - 8, cy + 16);
          ctx.lineTo(cx, cy + 23);
          ctx.lineTo(cx + 9, cy + 17);
          ctx.lineTo(cx + 20, cy + 20);
          ctx.lineTo(cx + 16, cy - 10);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Dark forged breastplate / ribcage housing
          ctx.fillStyle = '#1f2430';
          ctx.beginPath();
          ctx.roundRect(cx - 16, cy - 7, 32, 23, 5);
          ctx.fill();
          ctx.stroke();

          // Weathered curved aged-bone ribs + spine
          ctx.strokeStyle = '#c4bba6';
          ctx.lineWidth = 2.3;
          for (let r = 0; r < 3; r++) {
            const ry = cy - 1 + r * 5;
            ctx.beginPath();
            ctx.moveTo(cx - 9, ry);
            ctx.quadraticCurveTo(cx, ry + 2.2, cx + 9, ry);
            ctx.stroke();
          }
          ctx.fillStyle = '#9e9582';
          ctx.fillRect(cx - 1.5, cy - 3, 3, 15);

          // Tarnished rusted iron pauldrons with bronze trim
          ctx.strokeStyle = '#09080c';
          ctx.lineWidth = 2.6;
          ctx.fillStyle = '#434b5c';
          ctx.beginPath();
          ctx.ellipse(cx - 17, cy - 4, 8.5, 9, -0.2, 0, Math.PI * 2);
          ctx.ellipse(cx + 17, cy - 4, 8.5, 9, 0.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.strokeStyle = '#927248';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(cx - 17, cy - 4, 5.5, -1.8, 0.4);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(cx + 17, cy - 4, 5.5, 2.7, 4.9);
          ctx.stroke();

          // Sculpted weathered skull (aged ivory gradient + angular jaw)
          ctx.strokeStyle = '#09080c';
          ctx.lineWidth = 2.6;
          const skullGrad = ctx.createRadialGradient(cx - 2, cy - 17, 2, cx, cy - 13, 13);
          skullGrad.addColorStop(0, '#ddd6c5');
          skullGrad.addColorStop(0.7, '#b8ae99');
          skullGrad.addColorStop(1, '#857d6c');
          ctx.fillStyle = skullGrad;
          ctx.beginPath();
          ctx.moveTo(cx - 10, cy - 11);
          ctx.quadraticCurveTo(cx - 12, cy - 24, cx, cy - 24);
          ctx.quadraticCurveTo(cx + 12, cy - 24, cx + 10, cy - 11);
          ctx.lineTo(cx + 6, cy - 3);
          ctx.lineTo(cx - 6, cy - 3);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Cracked iron skullcap & brow band
          ctx.fillStyle = '#333b4a';
          ctx.beginPath();
          ctx.arc(cx, cy - 16, 11.2, Math.PI * 1.05, Math.PI * 1.95);
          ctx.lineTo(cx + 10, cy - 16);
          ctx.lineTo(cx - 10, cy - 16);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          // Nasal ridge
          ctx.fillStyle = '#4b5568';
          ctx.fillRect(cx - 1.4, cy - 20, 2.8, 7);

          // Hollow dark sockets + sinister crimson ember pinpoints
          ctx.fillStyle = '#09090d';
          ctx.beginPath();
          ctx.ellipse(cx - 4.6, cy - 12.5, 3.2, 2.6, -0.15, 0, Math.PI * 2);
          ctx.ellipse(cx + 4.6, cy - 12.5, 3.2, 2.6, 0.15, 0, Math.PI * 2);
          ctx.fill();
          drawGlowingEyes(ctx, cx - 5.5, cy - 13.5, cx + 3.5, cy - 13.5, 2.2, 2.2, '#ef4444');
          // Subtle jaw teeth notch
          ctx.fillStyle = '#292524';
          ctx.fillRect(cx - 3.5, cy - 6.5, 1.5, 2.5);
          ctx.fillRect(cx - 0.8, cy - 6.5, 1.5, 2.5);
          ctx.fillRect(cx + 2, cy - 6.5, 1.5, 2.5);

          // Battle-scarred bronze-rimmed heater shield (left)
          ctx.fillStyle = '#333d4f';
          ctx.beginPath();
          ctx.moveTo(cx - 30, cy - 10);
          ctx.lineTo(cx - 14, cy - 10);
          ctx.lineTo(cx - 14, cy + 8);
          ctx.lineTo(cx - 22, cy + 17);
          ctx.lineTo(cx - 30, cy + 8);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          // Bronze rim & iron boss
          ctx.strokeStyle = '#927248';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(cx - 27.5, cy - 7.5);
          ctx.lineTo(cx - 16.5, cy - 7.5);
          ctx.lineTo(cx - 16.5, cy + 6.5);
          ctx.lineTo(cx - 22, cy + 13.5);
          ctx.lineTo(cx - 27.5, cy + 6.5);
          ctx.closePath();
          ctx.stroke();
          ctx.fillStyle = '#94a3b8';
          ctx.beginPath();
          ctx.arc(cx - 22, cy + 1, 2.8, 0, Math.PI * 2);
          ctx.fill();

          // Chipped broadsword with bronze crossguard & fuller (right)
          ctx.strokeStyle = '#09080c';
          ctx.lineWidth = 2.4;
          const bladeGrad = ctx.createLinearGradient(cx + 18, cy - 28, cx + 26, cy + 6);
          bladeGrad.addColorStop(0, '#e2e8f0');
          bladeGrad.addColorStop(0.55, '#94a3b8');
          bladeGrad.addColorStop(1, '#475569');
          ctx.fillStyle = bladeGrad;
          ctx.beginPath();
          ctx.moveTo(cx + 22, cy - 29);
          ctx.lineTo(cx + 26, cy - 21);
          ctx.lineTo(cx + 24.5, cy - 11);
          ctx.lineTo(cx + 26, cy - 8);
          ctx.lineTo(cx + 25, cy + 7);
          ctx.lineTo(cx + 19, cy + 7);
          ctx.lineTo(cx + 18.5, cy - 21);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          // Crossguard & pommel
          ctx.fillStyle = '#a16207';
          ctx.fillRect(cx + 15.5, cy + 6, 13, 3.6);
          ctx.strokeRect(cx + 15.5, cy + 6, 13, 3.6);
          ctx.fillStyle = '#451a03';
          ctx.fillRect(cx + 20.5, cy + 9.6, 3, 5.5);
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

  // Crisp particle spark (soft hot core)
  makeCanvas(scene, 'fx_spark', 12, 12, (ctx) => {
    const g = ctx.createRadialGradient(6, 6, 1, 6, 6, 6);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.55, 'rgba(255,255,255,0.85)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(6, 6, 6, 0, Math.PI * 2);
    ctx.fill();
  });

  // Directional kinetic hit spark streak (rotated along impact angle)
  makeCanvas(scene, 'fx_spark_streak', 22, 6, (ctx) => {
    const g = ctx.createLinearGradient(0, 3, 22, 3);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.85)');
    g.addColorStop(1, '#ffffff');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 3);
    ctx.lineTo(15, 0.8);
    ctx.lineTo(22, 3);
    ctx.lineTo(15, 5.2);
    ctx.closePath();
    ctx.fill();
  });

  // 4-point dark-fantasy critical hit flare star
  makeCanvas(scene, 'fx_crit_star', 56, 56, (ctx) => {
    const cx = 28;
    const cy = 28;
    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, 24);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.35, 'rgba(250,204,21,0.55)');
    g.addColorStop(1, 'rgba(250,204,21,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, 24, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fef9c3';
    ctx.beginPath();
    ctx.moveTo(cx, 2);
    ctx.lineTo(cx + 4.5, cy - 4.5);
    ctx.lineTo(54, cy);
    ctx.lineTo(cx + 4.5, cy + 4.5);
    ctx.lineTo(cx, 54);
    ctx.lineTo(cx - 4.5, cy + 4.5);
    ctx.lineTo(2, cy);
    ctx.lineTo(cx - 4.5, cy - 4.5);
    ctx.closePath();
    ctx.fill();
  });

  // Ground scorch / battle scar decal (fades cleanly after kills & explosions)
  makeCanvas(scene, 'fx_scorch', 56, 56, (ctx) => {
    const g = ctx.createRadialGradient(28, 28, 3, 28, 28, 26);
    g.addColorStop(0, 'rgba(12, 8, 12, 0.72)');
    g.addColorStop(0.5, 'rgba(30, 14, 18, 0.42)');
    g.addColorStop(1, 'rgba(12, 8, 12, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(28, 28, 25, 19, 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.arc(14, 22, 3, 0, Math.PI * 2);
    ctx.arc(41, 33, 2.5, 0, Math.PI * 2);
    ctx.arc(34, 15, 2, 0, Math.PI * 2);
    ctx.fill();
  });

  // Razor-sharp tapered crescent melee cleave arc (Hades / Dead Cells blade sweep)
  makeCanvas(scene, 'fx_slash', 144, 144, (ctx) => {
    const cx = 42;
    const cy = 72;

    // Outer fiery-steel motion aura (tapered crescent path)
    const auraG = ctx.createRadialGradient(cx + 30, cy, 18, cx + 30, cy, 68);
    auraG.addColorStop(0, 'rgba(249, 115, 22, 0)');
    auraG.addColorStop(0.65, 'rgba(249, 115, 22, 0.48)');
    auraG.addColorStop(0.92, 'rgba(253, 186, 116, 0.65)');
    auraG.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = auraG;
    ctx.beginPath();
    ctx.arc(cx, cy, 64, -Math.PI * 0.45, Math.PI * 0.45, false);
    ctx.arc(cx - 10, cy, 52, Math.PI * 0.42, -Math.PI * 0.42, true);
    ctx.closePath();
    ctx.fill();

    // Main razor-tapered white-hot steel crescent
    const bladeG = ctx.createLinearGradient(cx + 10, cy - 60, cx + 62, cy);
    bladeG.addColorStop(0, 'rgba(254, 240, 138, 0.15)');
    bladeG.addColorStop(0.5, 'rgba(248, 250, 252, 0.98)');
    bladeG.addColorStop(1, '#ffffff');
    ctx.fillStyle = bladeG;
    ctx.beginPath();
    ctx.arc(cx + 4, cy, 60, -Math.PI * 0.43, Math.PI * 0.43, false);
    ctx.arc(cx - 5, cy, 55, Math.PI * 0.41, -Math.PI * 0.41, true);
    ctx.closePath();
    ctx.fill();

    // Crisp leading cutting-edge glint
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(cx + 5, cy, 60, -Math.PI * 0.34, Math.PI * 0.34);
    ctx.stroke();

    // Trailing kinetic speed lines inside the arc
    ctx.strokeStyle = 'rgba(254, 215, 170, 0.68)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(cx - 2, cy, 46, -Math.PI * 0.28, Math.PI * 0.16);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.45)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(cx - 8, cy, 38, -Math.PI * 0.14, Math.PI * 0.28);
    ctx.stroke();
  });
}

function generatePropsAndPickups(scene: Phaser.Scene) {
  // Cast-iron dungeon brazier (64x64 supersampled, rendered at 0.62 scale)
  makeCanvas(scene, 'prop_brazier', 64, 64, (ctx) => {
    const cx = 32;
    const cy = 34;
    drawGroundShadow(ctx, cx, cy + 12, 22, 12, 0.58);

    // 4 wrought-iron tripod/claw legs
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    for (const ang of [-2.4, -0.75, 0.75, 2.4]) {
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * 10, cy + Math.sin(ang) * 8);
      ctx.lineTo(cx + Math.cos(ang) * 20, cy + Math.sin(ang) * 15 + 4);
      ctx.stroke();
    }

    // Iron cauldron bowl
    const bowlG = ctx.createRadialGradient(cx - 4, cy - 4, 2, cx, cy, 18);
    bowlG.addColorStop(0, '#52525b');
    bowlG.addColorStop(0.65, '#27272a');
    bowlG.addColorStop(1, '#09090b');
    ctx.fillStyle = bowlG;
    ctx.strokeStyle = '#09080c';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(cx, cy, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Riveted brass rim
    ctx.strokeStyle = '#71717a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.stroke();

    // Glowing coal bed
    const coalG = ctx.createRadialGradient(cx, cy, 2, cx, cy, 12);
    coalG.addColorStop(0, '#f97316');
    coalG.addColorStop(0.7, '#991b1b');
    coalG.addColorStop(1, '#270909');
    ctx.fillStyle = coalG;
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI * 2);
    ctx.fill();

    // Layered sculpted flames
    ctx.fillStyle = '#ea580c';
    ctx.beginPath();
    ctx.moveTo(cx - 9, cy + 3);
    ctx.quadraticCurveTo(cx - 11, cy - 10, cx - 2, cy - 17);
    ctx.quadraticCurveTo(cx + 3, cy - 10, cx + 8, cy - 15);
    ctx.quadraticCurveTo(cx + 12, cy - 5, cx + 9, cy + 4);
    ctx.quadraticCurveTo(cx, cy + 8, cx - 9, cy + 3);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.moveTo(cx - 5, cy + 2);
    ctx.quadraticCurveTo(cx - 4, cy - 9, cx, cy - 13);
    ctx.quadraticCurveTo(cx + 5, cy - 7, cx + 5, cy + 2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#fefce8';
    ctx.beginPath();
    ctx.arc(cx, cy - 2, 3.2, 0, Math.PI * 2);
    ctx.fill();
  });

  // Ornate Runic Stone Dungeon Portal (112x112 supersampled, rendered at 0.72 scale)
  makeCanvas(scene, 'prop_portal', 112, 112, (ctx) => {
    const cx = 56;
    const cy = 56;

    // Outer arcane glow
    const halo = ctx.createRadialGradient(cx, cy, 12, cx, cy, 54);
    halo.addColorStop(0, 'rgba(250,245,255,0.95)');
    halo.addColorStop(0.32, 'rgba(168,85,247,0.85)');
    halo.addColorStop(0.68, 'rgba(76,29,149,0.52)');
    halo.addColorStop(1, 'rgba(76,29,149,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, 54, 0, Math.PI * 2);
    ctx.fill();

    // Carved dark stone outer ring
    ctx.strokeStyle = '#1e1b2e';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.arc(cx, cy, 40, 0, Math.PI * 2);
    ctx.stroke();

    // Gilded rune bezel
    ctx.strokeStyle = '#d4a64a';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(cx, cy, 44, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#f8e3a8';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(cx, cy, 36, 0, Math.PI * 2);
    ctx.stroke();

    // 8 carved rune nodes around the ring
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 * i) / 8;
      const rx = cx + Math.cos(a) * 40;
      const ry = cy + Math.sin(a) * 40;
      ctx.fillStyle = i % 2 === 0 ? '#f8e3a8' : '#e879f9';
      ctx.beginPath();
      ctx.arc(rx, ry, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Swirling vortex spiral arms
    for (let arm = 0; arm < 3; arm++) {
      const baseA = (Math.PI * 2 * arm) / 3;
      ctx.strokeStyle = arm === 0 ? 'rgba(250,245,255,0.85)' : 'rgba(216,180,254,0.65)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let t = 0; t <= 1; t += 0.08) {
        const a = baseA + t * 2.4;
        const r = 6 + t * 28;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        if (t === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Luminous rift core
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.fill();
  });

  // Iron-bound Dark Oak Treasure Chest (76x64 supersampled, rendered at 0.62 scale)
  makeCanvas(scene, 'prop_chest', 76, 64, (ctx) => {
    drawGroundShadow(ctx, 38, 49, 30, 12, 0.58);

    // Lower oak chest body
    const baseG = ctx.createLinearGradient(12, 28, 12, 52);
    baseG.addColorStop(0, '#78350f');
    baseG.addColorStop(1, '#3b1606');
    ctx.fillStyle = baseG;
    ctx.strokeStyle = '#09080c';
    ctx.lineWidth = 2.6;
    ctx.fillRect(10, 27, 56, 25);
    ctx.strokeRect(10, 27, 56, 25);

    // Arched vaulted oak lid
    const lidG = ctx.createLinearGradient(10, 10, 10, 29);
    lidG.addColorStop(0, '#b45309');
    lidG.addColorStop(0.45, '#92400e');
    lidG.addColorStop(1, '#451a03');
    ctx.fillStyle = lidG;
    ctx.beginPath();
    ctx.moveTo(10, 27);
    ctx.lineTo(13, 14);
    ctx.quadraticCurveTo(38, 8, 63, 14);
    ctx.lineTo(66, 27);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Subtle glowing gold treasure seam under lid
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(13, 26, 50, 2.5);

    // Heavy wrought-iron reinforcing bands with rivets
    ctx.fillStyle = '#3f3f46';
    ctx.strokeStyle = '#09080c';
    ctx.lineWidth = 1.6;
    for (const bx of [15, 53]) {
      ctx.fillRect(bx, 13, 8, 39);
      ctx.strokeRect(bx, 13, 8, 39);
      ctx.fillStyle = '#a1a1aa';
      ctx.fillRect(bx + 3, 17, 2, 2);
      ctx.fillRect(bx + 3, 33, 2, 2);
      ctx.fillRect(bx + 3, 45, 2, 2);
      ctx.fillStyle = '#3f3f46';
    }

    // Ornate gilded lock escutcheon
    ctx.fillStyle = '#eab308';
    ctx.strokeStyle = '#09080c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(31, 21);
    ctx.lineTo(45, 21);
    ctx.lineTo(45, 34);
    ctx.lineTo(38, 39);
    ctx.lineTo(31, 34);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Keyhole & highlight
    ctx.fillStyle = '#09080c';
    ctx.beginPath();
    ctx.arc(38, 28, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(37, 29, 2, 5);
    ctx.fillStyle = '#fef9c3';
    ctx.fillRect(33, 23, 10, 2);
  });

  // Carved Obsidian Blood Altar (84x84 supersampled, rendered at 0.62 scale)
  makeCanvas(scene, 'prop_altar', 84, 84, (ctx) => {
    const cx = 42;
    const cy = 44;
    drawGroundShadow(ctx, cx, cy + 16, 34, 16, 0.62);

    // Stepped octagonal obsidian dais
    ctx.fillStyle = '#1b1824';
    ctx.strokeStyle = '#09080c';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(16, 20);
    ctx.lineTo(68, 20);
    ctx.lineTo(74, 30);
    ctx.lineTo(74, 62);
    ctx.lineTo(66, 70);
    ctx.lineTo(18, 70);
    ctx.lineTo(10, 62);
    ctx.lineTo(10, 30);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Upper carved altar slab
    const slabG = ctx.createLinearGradient(16, 20, 68, 56);
    slabG.addColorStop(0, '#3f3a4f');
    slabG.addColorStop(0.5, '#272330');
    slabG.addColorStop(1, '#14111b');
    ctx.fillStyle = slabG;
    ctx.fillRect(16, 22, 52, 34);
    ctx.strokeRect(16, 22, 52, 34);

    // Recessed glowing blood basin
    const bloodG = ctx.createRadialGradient(cx, 38, 2, cx, 38, 18);
    bloodG.addColorStop(0, '#ef4444');
    bloodG.addColorStop(0.65, '#991b1b');
    bloodG.addColorStop(1, '#2a060a');
    ctx.fillStyle = bloodG;
    ctx.beginPath();
    ctx.ellipse(cx, 39, 17, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#d4a64a';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Floating faceted crimson blood crystal above the basin
    ctx.fillStyle = '#dc2626';
    ctx.strokeStyle = '#09080c';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(cx, 8);
    ctx.lineTo(cx + 10, 24);
    ctx.lineTo(cx, 38);
    ctx.lineTo(cx - 10, 24);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Crystal light facet
    ctx.fillStyle = '#fca5a5';
    ctx.beginPath();
    ctx.moveTo(cx, 11);
    ctx.lineTo(cx - 6, 24);
    ctx.lineTo(cx, 28);
    ctx.closePath();
    ctx.fill();

    // 4 lit ritual candles on the altar corners
    for (const [kx, ky] of [
      [19, 24],
      [65, 24],
      [19, 52],
      [65, 52],
    ]) {
      ctx.fillStyle = '#e7e5e4';
      ctx.fillRect(kx - 2, ky - 4, 4, 7);
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.arc(kx, ky - 6, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(kx, ky - 6, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // Mysterious Hooded Relic Merchant (88x88 supersampled, rendered at 0.64 scale)
  makeCanvas(scene, 'prop_merchant', 88, 88, (ctx) => {
    const cx = 44;

    // Ornate fringed crimson & gold merchant rug
    ctx.fillStyle = '#4c1322';
    ctx.strokeStyle = '#09080c';
    ctx.lineWidth = 2.2;
    ctx.fillRect(10, 44, 68, 34);
    ctx.strokeRect(10, 44, 68, 34);
    ctx.strokeStyle = '#d4a64a';
    ctx.lineWidth = 2;
    ctx.strokeRect(14, 48, 60, 26);

    // Small wooden relic crate & parchment scroll on rug
    ctx.fillStyle = '#78350f';
    ctx.strokeStyle = '#09080c';
    ctx.lineWidth = 1.6;
    ctx.fillRect(16, 56, 14, 12);
    ctx.strokeRect(16, 56, 14, 12);
    ctx.fillStyle = '#d4a64a';
    ctx.fillRect(16, 60, 14, 2.5);

    drawGroundShadow(ctx, cx, 58, 22, 10, 0.52);

    // Layered dark indigo hooded cloak
    const cloakG = ctx.createLinearGradient(cx, 12, cx, 62);
    cloakG.addColorStop(0, '#312e59');
    cloakG.addColorStop(0.5, '#1e1b33');
    cloakG.addColorStop(1, '#0f0d1c');
    ctx.fillStyle = cloakG;
    ctx.strokeStyle = '#09080c';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(cx, 10);
    ctx.quadraticCurveTo(cx + 20, 24, cx + 22, 58);
    ctx.lineTo(cx + 8, 63);
    ctx.lineTo(cx, 59);
    ctx.lineTo(cx - 8, 63);
    ctx.lineTo(cx - 22, 58);
    ctx.quadraticCurveTo(cx - 20, 24, cx, 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Gold embroidered mantle hem & shoulder trim
    ctx.strokeStyle = '#d4a64a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 12, 34);
    ctx.quadraticCurveTo(cx, 40, cx + 12, 34);
    ctx.moveTo(cx, 38);
    ctx.lineTo(cx, 59);
    ctx.stroke();

    // Deep shadowed cowl interior + glowing amber merchant eyes
    ctx.fillStyle = '#07060b';
    ctx.beginPath();
    ctx.ellipse(cx, 25, 10, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    drawGlowingEyes(ctx, cx - 6, 24, cx + 2, 24, 4, 3, '#facc15');

    // Wrought-iron lantern crook & glowing glass lantern
    ctx.strokeStyle = '#71717a';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(cx + 22, 60);
    ctx.lineTo(cx + 24, 24);
    ctx.quadraticCurveTo(cx + 26, 18, cx + 31, 22);
    ctx.stroke();

    const lg = ctx.createRadialGradient(cx + 31, 31, 2, cx + 31, 31, 14);
    lg.addColorStop(0, '#fef08a');
    lg.addColorStop(0.45, 'rgba(249,115,22,0.85)');
    lg.addColorStop(1, 'rgba(249,115,22,0)');
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.arc(cx + 31, 31, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fef9c3';
    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 1.6;
    ctx.fillRect(cx + 27, 26, 8, 10);
    ctx.strokeRect(cx + 27, 26, 8, 10);
  });

  // Supersampled Faceted Pickups (rendered at ~0.68 scale for crisp detail)
  makeCanvas(scene, 'pick_xp', 24, 24, (ctx) => {
    const g = ctx.createRadialGradient(12, 12, 2, 12, 12, 11);
    g.addColorStop(0, 'rgba(56,189,248,0.6)');
    g.addColorStop(1, 'rgba(56,189,248,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(12, 12, 11, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0284c7';
    ctx.strokeStyle = '#082f49';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(12, 2);
    ctx.lineTo(20, 12);
    ctx.lineTo(12, 22);
    ctx.lineTo(4, 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#7dd3fc';
    ctx.beginPath();
    ctx.moveTo(12, 4);
    ctx.lineTo(12, 12);
    ctx.lineTo(6, 12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f0f9ff';
    ctx.fillRect(10, 7, 2.5, 2.5);
  });

  makeCanvas(scene, 'pick_gold', 24, 24, (ctx) => {
    const g = ctx.createRadialGradient(9, 9, 2, 12, 12, 10);
    g.addColorStop(0, '#fef08a');
    g.addColorStop(0.55, '#eab308');
    g.addColorStop(1, '#a16207');
    ctx.fillStyle = g;
    ctx.strokeStyle = '#422006';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(12, 12, 8.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#fef9c3';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(12, 12, 5.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#713f12';
    ctx.fillRect(11, 8, 2, 8);
  });

  makeCanvas(scene, 'pick_crystal', 28, 34, (ctx) => {
    const glow = ctx.createRadialGradient(14, 17, 2, 14, 17, 14);
    glow.addColorStop(0, 'rgba(192,132,252,0.55)');
    glow.addColorStop(1, 'rgba(192,132,252,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(14, 17, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#9333ea';
    ctx.strokeStyle = '#2e1065';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(14, 2);
    ctx.lineTo(24, 13);
    ctx.lineTo(19, 31);
    ctx.lineTo(9, 31);
    ctx.lineTo(4, 13);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#e9d5ff';
    ctx.beginPath();
    ctx.moveTo(14, 4);
    ctx.lineTo(14, 29);
    ctx.lineTo(6, 14);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(11, 8, 2.5, 6);
  });

  makeCanvas(scene, 'pick_potion', 28, 32, (ctx) => {
    // Cork & glass neck
    ctx.fillStyle = '#b45309';
    ctx.strokeStyle = '#09080c';
    ctx.lineWidth = 1.8;
    ctx.fillRect(10, 2, 8, 5);
    ctx.strokeRect(10, 2, 8, 5);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(9, 7, 10, 4);
    ctx.strokeRect(9, 7, 10, 4);

    // Bulbous ruby flask
    const g = ctx.createRadialGradient(11, 17, 2, 14, 20, 10);
    g.addColorStop(0, '#fca5a5');
    g.addColorStop(0.45, '#dc2626');
    g.addColorStop(1, '#7f1d1d');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(14, 20, 9.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Crisp glass specular arc
    ctx.strokeStyle = 'rgba(255,255,255,0.82)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(14, 20, 6.5, Math.PI * 1.08, Math.PI * 1.48);
    ctx.stroke();
  });

  makeCanvas(scene, 'pick_gear', 36, 36, (ctx) => {
    const g = ctx.createRadialGradient(18, 18, 3, 18, 18, 18);
    g.addColorStop(0, 'rgba(254,249,195,0.95)');
    g.addColorStop(0.5, 'rgba(245,158,11,0.55)');
    g.addColorStop(1, 'rgba(245,158,11,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(18, 18, 18, 0, Math.PI * 2);
    ctx.fill();

    // Ornate diamond relic coffer emblem
    ctx.fillStyle = '#fef3c7';
    ctx.strokeStyle = '#1e1b24';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(18, 5);
    ctx.lineTo(30, 18);
    ctx.lineTo(18, 31);
    ctx.lineTo(6, 18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(18, 10);
    ctx.lineTo(24, 18);
    ctx.lineTo(18, 26);
    ctx.lineTo(12, 18);
    ctx.closePath();
    ctx.fill();
  });
}
