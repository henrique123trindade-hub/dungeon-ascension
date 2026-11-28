import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FastForward, SkipForward } from 'lucide-react';
import { CINEMATICS, type CinematicDef, type CinematicSceneDef } from '../game/data/lore';
import { audioEngine } from '../game/systems/audioEngine';

interface CinematicSequenceProps {
  cinematicId: CinematicDef['id'];
  onComplete: () => void;
}

interface TimelineEntry {
  sceneIndex: number;
  lineIndex: number;
  scene: CinematicSceneDef;
  text: string;
  emphasis?: 'normal' | 'accent' | 'final';
  startSec: number;
  endSec: number;
}

function drawSceneArtwork(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  theme: CinematicSceneDef['theme'],
  t: number,
  sceneProgress: number,
  accentColor: string,
  secondaryColor: string
) {
  ctx.clearRect(0, 0, w, h);

  // Deep atmospheric sky/void gradient
  const bg = ctx.createRadialGradient(w * 0.5, h * 0.44, 40, w * 0.5, h * 0.46, Math.max(w, h) * 0.72);
  if (theme === 'aetherion') {
    bg.addColorStop(0, '#2a2117');
    bg.addColorStop(0.55, '#131018');
    bg.addColorStop(1, '#060509');
  } else if (theme === 'ritual') {
    bg.addColorStop(0, '#2d0c16');
    bg.addColorStop(0.5, '#170a1c');
    bg.addColorStop(1, '#050408');
  } else if (theme === 'tower_birth') {
    bg.addColorStop(0, '#1e1033');
    bg.addColorStop(0.55, '#0e0a18');
    bg.addColorStop(1, '#050408');
  } else if (theme === 'fallen') {
    bg.addColorStop(0, '#171b26');
    bg.addColorStop(0.55, '#0c0d14');
    bg.addColorStop(1, '#050508');
  } else if (theme === 'celestial_truth') {
    bg.addColorStop(0, '#332710');
    bg.addColorStop(0.55, '#17111a');
    bg.addColorStop(1, '#060508');
  } else if (theme === 'infinite') {
    bg.addColorStop(0, '#2a1038');
    bg.addColorStop(0.5, '#130b1c');
    bg.addColorStop(1, '#050408');
  } else {
    bg.addColorStop(0, '#231518');
    bg.addColorStop(0.55, '#0f0b12');
    bg.addColorStop(1, '#050407');
  }
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Subtle Ken Burns camera drift
  ctx.save();
  const zoom = 1 + sceneProgress * 0.08;
  const panX = Math.sin(t * 0.25) * 14;
  const panY = -sceneProgress * 12;
  ctx.translate(w * 0.5 + panX, h * 0.45 + panY);
  ctx.scale(zoom, zoom);
  ctx.translate(-w * 0.5, -h * 0.45);

  const cx = w * 0.5;
  const cy = h * 0.44;

  // Theme-specific illustrated dark-fantasy centerpiece
  if (theme === 'aetherion') {
    // Distant silhouetted golden citadel spires + Floating Núcleo da Ascensão crystal
    ctx.fillStyle = 'rgba(12, 10, 16, 0.92)';
    const spires = [
      [-310, 150, 48, 170],
      [-230, 130, 60, 210],
      [-140, 100, 52, 240],
      [90, 105, 54, 235],
      [185, 135, 62, 200],
      [265, 155, 48, 165],
    ];
    for (const [ox, oy, sw, sh] of spires) {
      ctx.beginPath();
      ctx.moveTo(cx + ox, cy + oy + sh);
      ctx.lineTo(cx + ox + sw * 0.18, cy + oy);
      ctx.lineTo(cx + ox + sw * 0.5, cy + oy - 48);
      ctx.lineTo(cx + ox + sw * 0.82, cy + oy);
      ctx.lineTo(cx + ox + sw, cy + oy + sh);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(227, 181, 92, 0.22)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    // Radiance behind crystal
    const glow = ctx.createRadialGradient(cx, cy - 28, 6, cx, cy - 28, 190);
    glow.addColorStop(0, 'rgba(248, 227, 168, 0.55)');
    glow.addColorStop(0.45, 'rgba(147, 51, 234, 0.24)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy - 28, 190, 0, Math.PI * 2);
    ctx.fill();

    // Faceted Núcleo da Ascensão hovering
    const bob = Math.sin(t * 1.8) * 7;
    ctx.save();
    ctx.translate(cx, cy - 30 + bob);
    ctx.beginPath();
    ctx.moveTo(0, -68);
    ctx.lineTo(38, -8);
    ctx.lineTo(0, 68);
    ctx.lineTo(-38, -8);
    ctx.closePath();
    const cg = ctx.createLinearGradient(-32, -60, 32, 60);
    cg.addColorStop(0, '#fef3c7');
    cg.addColorStop(0.5, '#c084fc');
    cg.addColorStop(1, '#4c1d95');
    ctx.fillStyle = cg;
    ctx.fill();
    ctx.strokeStyle = '#f8e3a8';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, -68);
    ctx.lineTo(0, 68);
    ctx.moveTo(-38, -8);
    ctx.lineTo(38, -8);
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  } else if (theme === 'ritual') {
    // Seven Sovereign sigil rings fracturing in crimson & violet
    ctx.save();
    ctx.translate(cx, cy - 10);
    for (let ring = 0; ring < 3; ring++) {
      ctx.save();
      ctx.rotate(t * (ring % 2 === 0 ? 0.16 : -0.12) + ring);
      ctx.strokeStyle = ring === 0 ? 'rgba(220,38,38,0.55)' : 'rgba(168,85,247,0.42)';
      ctx.lineWidth = ring === 0 ? 2.2 : 1.4;
      ctx.beginPath();
      ctx.arc(0, 0, 95 + ring * 44, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    // 7 kneeling sovereign monoliths / crowns around the ritual circle
    for (let i = 0; i < 7; i++) {
      const ang = (Math.PI * 2 * i) / 7 - Math.PI / 2;
      const sx = Math.cos(ang) * 145;
      const sy = Math.sin(ang) * 95;
      ctx.fillStyle = '#0c0910';
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.55)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sx, sy - 26);
      ctx.lineTo(sx + 14, sy + 20);
      ctx.lineTo(sx - 14, sy + 20);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Crimson beam into central core
      ctx.strokeStyle = `rgba(239, 68, 68, ${0.22 + 0.18 * Math.sin(t * 4 + i)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx, sy - 8);
      ctx.lineTo(0, 0);
      ctx.stroke();
    }
    // Shattering shockwave cracks
    const crackAlpha = Math.min(1, 0.35 + sceneProgress * 0.65);
    ctx.strokeStyle = `rgba(250, 204, 21, ${crackAlpha * 0.7})`;
    ctx.lineWidth = 1.8;
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.2;
      const len = 40 + sceneProgress * 170;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * len * 0.5 + Math.sin(a) * 14, Math.sin(a) * len * 0.5);
      ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
      ctx.stroke();
    }
    ctx.restore();
  } else if (theme === 'fallen') {
    // Misty graveyard of blades, broken shields & ghostly silhouettes
    const horizon = cy + 95;
    const mist = ctx.createLinearGradient(0, horizon - 110, 0, horizon + 120);
    mist.addColorStop(0, 'rgba(148,163,184,0)');
    mist.addColorStop(0.5, 'rgba(99,102,241,0.16)');
    mist.addColorStop(1, 'rgba(6,6,12,0.95)');
    ctx.fillStyle = mist;
    ctx.fillRect(0, horizon - 110, w, 240);

    // Planted swords across the ridge
    const blades = [-260, -180, -95, -20, 65, 145, 230];
    blades.forEach((bx, idx) => {
      const tilt = ((idx % 3) - 1) * 0.16;
      const by = horizon + (idx % 2) * 18;
      ctx.save();
      ctx.translate(cx + bx, by);
      ctx.rotate(tilt);
      ctx.fillStyle = idx === 3 ? '#cbd5e1' : '#334155';
      ctx.fillRect(-3, -72, 6, 72);
      ctx.fillRect(-16, -54, 32, 5);
      ctx.beginPath();
      ctx.arc(0, -76, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Floating soul wisps rising from fallen weapons
    for (let i = 0; i < 18; i++) {
      const px = cx + ((i * 89) % 620) - 310 + Math.sin(t + i) * 12;
      const py = horizon - ((t * 28 + i * 31) % 240);
      ctx.fillStyle = `rgba(165, 180, 252, ${0.15 + 0.3 * Math.sin(t * 2 + i)})`;
      ctx.beginPath();
      ctx.arc(px, py, 2.5 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (theme === 'tower_birth') {
    // Monolithic endless Torre do Abismo tearing upward into the void
    const towerW = 148;
    const tg = ctx.createLinearGradient(cx - towerW, 0, cx + towerW, 0);
    tg.addColorStop(0, '#09070d');
    tg.addColorStop(0.5, '#1f1630');
    tg.addColorStop(1, '#09070d');
    ctx.fillStyle = tg;
    ctx.fillRect(cx - towerW * 0.5, 20, towerW, h);
    ctx.strokeStyle = 'rgba(192, 132, 252, 0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(cx - towerW * 0.5, 20, towerW, h);

    // Repeating floor slit windows ascending infinitely
    for (let row = 0; row < 12; row++) {
      const ry = ((row * 58 - t * 24) % (h + 60)) - 20;
      const lit = (row + Math.floor(t * 2)) % 3 === 0;
      ctx.fillStyle = lit ? 'rgba(245, 158, 11, 0.65)' : 'rgba(168, 85, 247, 0.32)';
      ctx.fillRect(cx - 28, ry, 12, 22);
      ctx.fillRect(cx + 16, ry, 12, 22);
    }

    // Glowing archway gate at base
    const gateGlow = ctx.createRadialGradient(cx, cy + 120, 6, cx, cy + 120, 120);
    gateGlow.addColorStop(0, 'rgba(245, 158, 11, 0.72)');
    gateGlow.addColorStop(0.5, 'rgba(168, 85, 247, 0.32)');
    gateGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gateGlow;
    ctx.beginPath();
    ctx.arc(cx, cy + 120, 120, 0, Math.PI * 2);
    ctx.fill();
  } else if (theme === 'celestial_truth' || theme === 'infinite') {
    // Sacred golden geometry & infinite ascending vortex
    ctx.save();
    ctx.translate(cx, cy - 16);
    for (let i = 0; i < 6; i++) {
      ctx.save();
      ctx.rotate(t * 0.14 * (i % 2 === 0 ? 1 : -1) + i * 0.5);
      ctx.strokeStyle = i % 2 === 0 ? 'rgba(250, 204, 21, 0.42)' : 'rgba(232, 121, 249, 0.35)';
      ctx.lineWidth = 1.6;
      const r = 56 + i * 32;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
    const core = ctx.createRadialGradient(0, 0, 4, 0, 0, 110);
    core.addColorStop(0, '#fef9c3');
    core.addColorStop(0.35, accentColor);
    core.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(0, 0, 110, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else {
    // Awakening: radiant crest halo behind Dungeon Ascension logo
    const halo = ctx.createRadialGradient(cx, cy - 20, 10, cx, cy - 20, 240);
    halo.addColorStop(0, 'rgba(248, 227, 168, 0.38)');
    halo.addColorStop(0.42, 'rgba(184, 50, 50, 0.22)');
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy - 20, 240, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(227, 181, 92, 0.32)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy - 20, 118 + Math.sin(t * 2) * 5, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();

  // Floating embers / dust particles across the entire frame
  for (let i = 0; i < 42; i++) {
    const seed = i * 73.17;
    const x = ((seed * 19.3 + Math.sin(t * 0.6 + i) * 35) % w + w) % w;
    const y = ((h - ((t * (18 + (i % 5) * 7) + seed * 11) % (h + 40))) + h) % (h + 40) - 20;
    const alpha = 0.16 + 0.36 * (0.5 + 0.5 * Math.sin(t * 2.2 + i));
    ctx.fillStyle = i % 3 === 0 ? secondaryColor : accentColor;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(x, y, 1.2 + (i % 3) * 0.85, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Cinematic letterbox vignette
  const vig = ctx.createRadialGradient(w * 0.5, h * 0.5, Math.min(w, h) * 0.28, w * 0.5, h * 0.5, Math.max(w, h) * 0.72);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(4,4,7,0.88)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
}

export const CinematicSequence: React.FC<CinematicSequenceProps> = ({ cinematicId, onComplete }) => {
  const def = CINEMATICS[cinematicId];

  const { timeline, totalDuration } = useMemo(() => {
    const entries: TimelineEntry[] = [];
    let cursor = 0;
    def.scenes.forEach((scene, sceneIndex) => {
      scene.lines.forEach((line, lineIndex) => {
        entries.push({
          sceneIndex,
          lineIndex,
          scene,
          text: line.text,
          emphasis: line.emphasis,
          startSec: cursor,
          endSec: cursor + line.durationSec,
        });
        cursor += line.durationSec;
      });
    });
    return { timeline: entries, totalDuration: cursor };
  }, [def]);

  const [elapsedSec, setElapsedSec] = useState(0);
  const [fadingOut, setFadingOut] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const completedRef = useRef(false);
  const lastSceneRef = useRef(-1);

  const finish = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    setFadingOut(true);
    audioEngine.stopAmbience();
    window.setTimeout(() => {
      onComplete();
    }, 360);
  };

  // Current active timeline entry
  const activeEntry = useMemo(() => {
    for (const entry of timeline) {
      if (elapsedSec < entry.endSec) return entry;
    }
    return timeline[timeline.length - 1];
  }, [timeline, elapsedSec]);

  useEffect(() => {
    audioEngine.startCinematicAmbience();
    audioEngine.playCinematicPulse();
    return () => {
      audioEngine.stopAmbience();
    };
  }, [cinematicId]);

  useEffect(() => {
    if (activeEntry.sceneIndex !== lastSceneRef.current) {
      lastSceneRef.current = activeEntry.sceneIndex;
      audioEngine.playCinematicPulse();
    }
  }, [activeEntry.sceneIndex]);

  useEffect(() => {
    let raf = 0;
    const startMs = performance.now();

    const tick = (now: number) => {
      const sec = (now - startMs) / 1000;
      setElapsedSec(sec);

      const canvas = canvasRef.current;
      if (canvas) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const targetW = Math.max(320, Math.floor(canvas.clientWidth * dpr));
        const targetH = Math.max(240, Math.floor(canvas.clientHeight * dpr));
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
        }
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const entry = timeline.find((e) => sec < e.endSec) ?? timeline[timeline.length - 1];
          const sceneEntries = timeline.filter((e) => e.sceneIndex === entry.sceneIndex);
          const sStart = sceneEntries[0]?.startSec ?? 0;
          const sEnd = sceneEntries[sceneEntries.length - 1]?.endSec ?? totalDuration;
          const sceneProgress = Math.max(0, Math.min(1, (sec - sStart) / Math.max(0.1, sEnd - sStart)));
          drawSceneArtwork(
            ctx,
            canvas.width,
            canvas.height,
            entry.scene.theme,
            sec,
            sceneProgress,
            entry.scene.accentColor,
            entry.scene.secondaryColor
          );
        }
      }

      if (sec >= totalDuration + 0.5) {
        finish();
        return;
      }
      raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [timeline, totalDuration]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        finish();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const lineElapsed = Math.max(0, elapsedSec - activeEntry.startSec);
  const lineDuration = Math.max(0.1, activeEntry.endSec - activeEntry.startSec);
  const lineFade =
    lineElapsed < 0.45
      ? lineElapsed / 0.45
      : lineDuration - lineElapsed < 0.35
        ? Math.max(0, (lineDuration - lineElapsed) / 0.35)
        : 1;

  const progressPct = Math.min(100, (elapsedSec / Math.max(1, totalDuration)) * 100);
  const showCrest = activeEntry.emphasis === 'final';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={def.title}
      data-testid="cinematic-sequence"
      className={`fixed inset-0 z-50 flex flex-col justify-between bg-[#050408] select-none transition-opacity duration-300 ${
        fadingOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Animated Atmospheric Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Top Cinema Letterbox Bar */}
      <div className="relative z-10 flex items-center justify-between px-6 sm:px-10 py-5 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex flex-col">
          <span className="text-[11px] uppercase tracking-[0.28em] text-[#b89b63] font-medium">
            {def.subtitle}
          </span>
          <span className="font-display text-sm sm:text-base tracking-[0.14em] text-[#f3e6cc] uppercase mt-0.5">
            {def.title}
          </span>
        </div>

        <button
          type="button"
          onClick={finish}
          className="flex items-center gap-2 px-4 py-2 bg-[#14111b]/80 hover:bg-[#231c30] border border-[#b89b63]/35 hover:border-[#e3b55c]/70 text-[#e8dcc2] text-xs uppercase tracking-[0.18em] transition-colors cursor-pointer"
        >
          <SkipForward className="w-3.5 h-3.5 text-[#e3b55c]" />
          <span>Pular</span>
        </button>
      </div>

      {/* Center Emblem Reveal on Final Line */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center pointer-events-none">
        {showCrest && (
          <div className="mb-6 flex flex-col items-center animate-fade-in">
            <img
              src="/assets/aistudio/Emblema_da_Masmorra_com_Espada_e_Cristal_8fabb493.png"
              alt="Dungeon Ascension"
              className="w-24 h-24 sm:w-28 sm:h-28 object-contain drop-shadow-[0_0_28px_rgba(227,181,92,0.45)] mb-4"
            />
            <h2 className="font-display text-3xl sm:text-5xl tracking-[0.18em] uppercase text-[#f7e7c4]">
              {cinematicId === 'floor100_ascension' ? 'Ascensão Infinita' : 'Dungeon Ascension'}
            </h2>
            <div className="w-40 h-px bg-gradient-to-r from-transparent via-[#e3b55c] to-transparent mt-3" />
          </div>
        )}
      </div>

      {/* Bottom Narration Subtitle & Cinema Progress Hairline */}
      <div className="relative z-10 px-6 sm:px-14 pb-9 pt-12 bg-gradient-to-t from-black via-black/85 to-transparent flex flex-col items-center">
        <div
          className="max-w-3xl min-h-[76px] flex items-center justify-center text-center transition-opacity duration-200"
          style={{ opacity: Math.max(0, Math.min(1, lineFade)) }}
        >
          <p
            className={
              activeEntry.emphasis === 'final'
                ? 'font-display text-xl sm:text-3xl tracking-[0.1em] text-[#f8e3a8] leading-snug'
                : activeEntry.emphasis === 'accent'
                  ? 'font-display text-lg sm:text-2xl tracking-[0.06em] text-[#f4d799] leading-relaxed'
                  : 'text-base sm:text-xl text-[#ece6da] tracking-[0.02em] leading-relaxed font-light'
            }
          >
            {activeEntry.text}
          </p>
        </div>

        <div className="w-full max-w-2xl mt-5 flex items-center gap-4">
          <div className="flex-1 h-[2px] bg-white/15 overflow-hidden">
            <div
              className="h-full transition-[width] duration-100"
              style={{ width: `${progressPct}%`, backgroundColor: activeEntry.scene.accentColor }}
            />
          </div>
          <span className="text-[11px] uppercase tracking-[0.2em] text-[#9b90a8] flex items-center gap-1.5">
            <FastForward className="w-3 h-3" />
            Esc / Espaço
          </span>
        </div>
      </div>
    </div>
  );
};
