import { useEffect, useRef, useState } from 'react';
import { CLASSES } from '../game/data/classes';
import { phaserBridge } from '../game/phaser/PhaserBridge';
import type { NarrativeOverlayPayload, RunHUDSnapshot, SettingsData } from '../game/types';
import { ClassIcon, CrystalIcon, GoldCoinIcon, SkillIcon } from './Icons';

interface GameHUDProps {
  hud: RunHUDSnapshot;
  settings: SettingsData;
  narrativeOverlay?: NarrativeOverlayPayload | null;
  onOpenCharacterTab: (tab: 'inventory' | 'skills' | 'stats') => void;
  onToggleMute: () => void;
  onOpenPause: () => void;
}

export function GameHUD({
  hud,
  settings,
  narrativeOverlay = null,
  onOpenCharacterTab,
  onToggleMute,
  onOpenPause,
}: GameHUDProps) {
  const [ghostHpPct, setGhostHpPct] = useState(100);
  const [bossGhostPct, setBossGhostPct] = useState(100);
  const [hitFlash, setHitFlash] = useState(false);
  const prevDamageAtRef = useRef(0);

  const hpPct = Math.max(0, Math.min(100, (hud.hp / Math.max(1, hud.maxHp)) * 100));
  const xpPct = Math.max(0, Math.min(100, (hud.xp / Math.max(1, hud.xpToNext)) * 100));
  const shieldPct = Math.max(0, Math.min(100, (hud.shield / Math.max(1, hud.maxHp)) * 100));
  const bossHpPct = hud.boss ? Math.max(0, Math.min(100, (hud.boss.hp / Math.max(1, hud.boss.maxHp)) * 100)) : 0;

  // Delayed trailing damage ghost bar (player)
  useEffect(() => {
    const id = window.setTimeout(() => {
      setGhostHpPct(hpPct);
    }, 220);
    return () => window.clearTimeout(id);
  }, [hpPct]);

  // Delayed trailing damage ghost bar (boss)
  useEffect(() => {
    if (!hud.boss) {
      setBossGhostPct(100);
      return;
    }
    const id = window.setTimeout(() => {
      setBossGhostPct(bossHpPct);
    }, 240);
    return () => window.clearTimeout(id);
  }, [bossHpPct, hud.boss?.name]);

  // Brief crimson peripheral pulse whenever the player takes damage
  useEffect(() => {
    if (hud.lastDamagedAt > 0 && hud.lastDamagedAt !== prevDamageAtRef.current) {
      prevDamageAtRef.current = hud.lastDamagedAt;
      setHitFlash(true);
      const id = window.setTimeout(() => setHitFlash(false), 230);
      return () => window.clearTimeout(id);
    }
  }, [hud.lastDamagedAt]);

  const cls = CLASSES[hud.classId];
  const lowHpCritical = hpPct > 0 && hpPct <= 28;
  const isTouchEnv =
    settings.mobileControls === 'on' ||
    (settings.mobileControls === 'auto' &&
      typeof window !== 'undefined' &&
      ('ontouchstart' in window || navigator.maxTouchPoints > 0));

  const mmW = 112;
  const mmH = 84;

  return (
    <div className="fixed inset-0 z-20 pointer-events-none select-none overflow-hidden">
      {/* Subtle critical low-HP or fresh-hit peripheral crimson vignette */}
      {(lowHpCritical || hitFlash) && (
        <div
          className={`fixed inset-0 pointer-events-none transition-opacity duration-200 ${lowHpCritical && !hitFlash ? 'animate-low-hp' : ''}`}
          style={{
            boxShadow: hitFlash
              ? 'inset 0 0 130px rgba(220, 38, 38, 0.68)'
              : 'inset 0 0 95px rgba(185, 28, 28, 0.5)',
          }}
        />
      )}

      {/* TOP-LEFT CLUSTER: Vitality, XP, Level, Class Evolution, Active Multipliers */}
      <div className="fixed top-3.5 left-4 flex flex-col gap-2 w-[274px] sm:w-[304px]">
        <div className="relative hud-iron-frame px-2.5 py-2 flex items-center gap-3">
          <CornerNotches />

          {/* Class Crest Medallion + Integrated Level Plate */}
          <div className="relative shrink-0">
            <div
              className="w-12 h-12 bg-[#0c0a11] border border-[#d4a64a]/60 flex flex-col items-center justify-center shadow-inner"
              style={{
                color: cls.accentColor,
                boxShadow: `inset 0 0 14px ${cls.accentColor}24`,
              }}
            >
              <ClassIcon classId={hud.classId} className="w-5 h-5" />
              <span className="font-mono-num text-[10px] font-bold text-[#f8e3a8] leading-none mt-1 tracking-tight">
                NV.{hud.level}
              </span>
            </div>
            <span
              className="absolute -bottom-0.5 inset-x-1.5 h-[2px]"
              style={{ backgroundColor: cls.accentColor }}
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-2 hud-text-shadow">
              <span className="font-display text-xs sm:text-[13px] font-bold text-[#f4efe6] tracking-wide truncate">
                {hud.evolutionTitle}
              </span>
              <span className="font-mono-num text-[11px] font-semibold text-[#f1ece2] shrink-0">
                {hud.hp}
                <span className="text-[#9c9487]">/{hud.maxHp}</span>
                {hud.shield > 0 ? <span className="text-[#facc15]"> +{hud.shield}</span> : null}
              </span>
            </div>

            {/* Segmented Metallic HP Bar with trailing damage ghost + Shield */}
            <div
              className={`relative h-3.5 mt-1.5 bg-[#09080c] border overflow-hidden ${
                lowHpCritical ? 'border-[#ef4444]/85' : 'border-[#d4a64a]/45'
              }`}
            >
              <div
                className="absolute inset-y-0 left-0 bg-[#f59e0b]/75 transition-[width] duration-300"
                style={{ width: `${Math.max(hpPct, ghostHpPct)}%` }}
              />
              <div
                className="absolute inset-y-0 left-0 bg-[#b83232] hud-bar-sheen transition-[width] duration-100"
                style={{ width: `${hpPct}%` }}
              />
              {shieldPct > 0 && (
                <div
                  className="absolute inset-y-0 left-0 bg-[#facc15]/55 border-r border-[#fef08a] hud-bar-sheen"
                  style={{ width: `${Math.min(100, shieldPct)}%` }}
                />
              )}
              {/* Tactical 25% HP readability notches */}
              <div className="absolute inset-y-0 left-1/4 w-px bg-black/45 pointer-events-none" />
              <div className="absolute inset-y-0 left-1/2 w-px bg-black/45 pointer-events-none" />
              <div className="absolute inset-y-0 left-3/4 w-px bg-black/45 pointer-events-none" />
            </div>

            {/* Crystalline XP Bar */}
            <div className="flex items-center gap-2 mt-1.5">
              <div className="relative flex-1 h-1.5 bg-[#09080c] border border-white/15 overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-[#38bdf8] hud-bar-sheen transition-[width] duration-200"
                  style={{ width: `${xpPct}%` }}
                />
              </div>
              <span className="font-mono-num text-[9px] text-[#94a3b8] tracking-wider shrink-0">
                EXP {Math.round(xpPct)}%
              </span>
            </div>
          </div>
        </div>

        {/* Active Multipliers & Buffs (crisp unboxed telemetry) */}
        {(hud.activeMultipliers.length > 0 || hud.activeBuffs.length > 0) && (
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] font-mono-num hud-text-shadow pl-1">
            {hud.activeMultipliers.map((m) => (
              <span key={m.label} className="text-[#f8e3a8]">
                {m.label} {m.value}
              </span>
            ))}
            {hud.activeBuffs.map((b) => (
              <span key={b.label} style={{ color: b.color }}>
                {b.label} {b.remainingSec.toFixed(1)}s
              </span>
            ))}
          </div>
        )}

        {/* Temporary Combo Multiplier Indicator */}
        {hud.combo && (() => {
          const mult = hud.combo.multiplier;
          const accent =
            mult >= 2.0
              ? '#facc15'
              : mult >= 1.75
                ? '#f43f5e'
                : mult >= 1.5
                  ? '#fb923c'
                  : mult >= 1.25
                    ? '#f59e0b'
                    : '#f8e3a8';
          const timerPct = Math.max(
            0,
            Math.min(100, (hud.combo.remainingSec / Math.max(0.1, hud.combo.maxWindowSec)) * 100)
          );
          const multLabel = `×${mult.toFixed(2).replace(/0$/, '')}`;

          return (
            <div
              data-testid="hud-combo-indicator"
              className="pl-2.5 pr-3 py-1.5 w-fit min-w-[168px] border-l-2 hud-text-shadow"
              style={{
                borderLeftColor: accent,
                background:
                  'linear-gradient(to right, rgba(14, 12, 19, 0.86) 0%, rgba(14, 12, 19, 0.45) 72%, rgba(14, 12, 19, 0) 100%)',
              }}
            >
              <div className="flex items-baseline justify-between gap-3">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-display text-[10px] font-bold tracking-[0.18em] text-[#c7bfb2] uppercase">
                    Combo
                  </span>
                  <span
                    key={hud.combo.hits}
                    className="font-mono-num text-lg font-extrabold leading-none tracking-tight animate-combo-pop"
                    style={{ color: accent }}
                  >
                    {multLabel}
                  </span>
                </div>
                <span className="font-mono-num text-[11px] font-semibold text-[#e8e3d9]">
                  {hud.combo.hits} golpes
                </span>
              </div>
              <div className="mt-1.5 h-[2px] w-full bg-white/15 overflow-hidden">
                <div
                  className="h-full transition-[width] duration-75"
                  style={{ width: `${timerPct}%`, backgroundColor: accent }}
                />
              </div>
            </div>
          );
        })()}
      </div>

      {/* TOP-CENTER: Boss Health Banner OR Timed Challenge OR Floor Notice */}
      <div className="fixed top-3.5 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 w-[90vw] max-w-[472px]">
        {hud.boss && (
          <div className="relative w-full hud-iron-frame border-[#d4a64a]/70 px-4 py-2.5">
            <CornerNotches gold />
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex items-baseline gap-2">
                <span className="font-display text-sm sm:text-base font-bold text-[#f8e3a8] tracking-wider truncate">
                  {hud.boss.name}
                </span>
                <span className="text-[11px] text-[#b8afa1] hidden sm:inline truncate">
                  {hud.boss.title}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* Phase diamond indicators */}
                <div className="flex items-center gap-1" aria-label={`Fase ${hud.boss.phase} de ${hud.boss.maxPhases}`}>
                  {Array.from({ length: hud.boss.maxPhases }).map((_, pIdx) => {
                    const active = pIdx + 1 <= hud.boss!.phase;
                    return (
                      <span
                        key={pIdx}
                        className={`w-2 h-2 rotate-45 border ${
                          active
                            ? 'bg-[#f59e0b] border-[#fef08a]'
                            : 'bg-[#1a1522] border-[#d4a64a]/40'
                        }`}
                      />
                    );
                  })}
                </div>
                <span className="font-mono-num text-[11px] font-semibold text-[#fca5a5]">
                  {hud.boss.hp}/{hud.boss.maxHp}
                </span>
              </div>
            </div>

            <div className="relative h-4 mt-1.5 bg-[#09080c] border border-[#dc2626]/65 overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-[#f59e0b]/80 transition-[width] duration-300"
                style={{ width: `${Math.max(bossHpPct, bossGhostPct)}%` }}
              />
              <div
                className="absolute inset-y-0 left-0 bg-[#c92a2a] hud-bar-sheen transition-[width] duration-100"
                style={{ width: `${bossHpPct}%` }}
              />
              {/* Phase transition markers */}
              {hud.boss.maxPhases === 3 ? (
                <>
                  <div className="absolute inset-y-0 left-[35%] w-0.5 bg-[#fef08a]/85" />
                  <div className="absolute inset-y-0 left-[70%] w-0.5 bg-[#fef08a]/85" />
                </>
              ) : (
                <div className="absolute inset-y-0 left-[50%] w-0.5 bg-[#fef08a]/85" />
              )}
            </div>
          </div>
        )}

        {hud.timedChallenge && (
          <div className="hud-iron-frame px-3.5 py-1 text-xs font-mono-num text-[#f8e3a8]">
            Desafio Contra o Tempo · {hud.timedChallenge.remainingSec.toFixed(1)}s
          </div>
        )}

        {hud.recentNotice && (
          <div
            key={hud.recentNotice.id}
            className="relative px-4 py-1.5 bg-[#121018]/94 border-y border-x text-xs font-medium tracking-wide hud-text-shadow animate-modal-enter"
            style={{
              borderColor:
                hud.recentNotice.tone === 'crimson'
                  ? 'rgba(220,38,38,0.68)'
                  : hud.recentNotice.tone === 'violet'
                    ? 'rgba(192,132,252,0.68)'
                    : hud.recentNotice.tone === 'emerald'
                      ? 'rgba(52,211,153,0.68)'
                      : 'rgba(212,166,74,0.68)',
              color:
                hud.recentNotice.tone === 'crimson'
                  ? '#fca5a5'
                  : hud.recentNotice.tone === 'violet'
                    ? '#e9d5ff'
                    : hud.recentNotice.tone === 'emerald'
                      ? '#a7f3d0'
                      : '#f8e3a8',
            }}
          >
            {hud.recentNotice.text}
          </div>
        )}
      </div>

      {/* TOP-RIGHT CLUSTER: Floor, Biome, Remaining Enemies, Currencies, Minimap & Utility Icons */}
      <div className="fixed top-3.5 right-4 z-30 flex flex-col items-end">
        <div
          data-hud-surface="true"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          className="pointer-events-auto cursor-default flex items-start gap-2.5"
        >
          <div className="hud-iron-frame px-3 py-2 text-right">
            <div className="font-display text-xs sm:text-sm font-bold text-[#f8e3a8] tracking-wide leading-tight">
              Andar {hud.floor} <span className="text-[#d4a64a]/60 mx-0.5">·</span> {hud.biomeName}
            </div>
            <div className="text-[11px] text-[#c7bfb2] font-mono-num mt-1 flex items-center justify-end gap-2">
              <span>
                {hud.portalOpen ? (
                  <span className="text-[#4ade80] font-semibold">Portal Aberto</span>
                ) : (
                  <>
                    {hud.waveTotal > 1 ? (
                      <span className="text-[#f8e3a8] mr-1.5">
                        Onda {hud.waveIndex}/{hud.waveTotal} ·
                      </span>
                    ) : null}
                    Inimigos {hud.enemiesRemaining}
                  </>
                )}
              </span>
              <span className="text-white/25" aria-hidden="true">|</span>
              <span className="inline-flex items-center gap-1 text-[#facc15]">
                <GoldCoinIcon className="w-3.5 h-3.5" />
                {hud.gold}
              </span>
              <span className="inline-flex items-center gap-1 text-[#c084fc]">
                <CrystalIcon className="w-3.5 h-3.5" />
                {hud.crystalsRun}
              </span>
            </div>
            {hud.floorModifier && (
              <div className="text-[11px] text-[#fca5a5] mt-1 font-medium">{hud.floorModifier}</div>
            )}
            {hud.chaosModifier && (
              <div className="text-[11px] text-[#22d3ee] mt-1 font-medium">{hud.chaosModifier}</div>
            )}
          </div>

          {/* Real-geometry Framed Corner Minimap */}
          <div className="relative hidden sm:block hud-iron-frame p-1">
            <CornerNotches />
            <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-1 bg-[#0e0c13] font-mono-num text-[8px] font-bold text-[#d4a64a] leading-none">
              N
            </span>
            <svg width={mmW} height={mmH} viewBox={`0 0 ${hud.minimap.roomWidth} ${hud.minimap.roomHeight}`}>
              <rect
                x="0"
                y="0"
                width={hud.minimap.roomWidth}
                height={hud.minimap.roomHeight}
                fill="#14111c"
              />
              <rect
                x="24"
                y="24"
                width={hud.minimap.roomWidth - 48}
                height={hud.minimap.roomHeight - 48}
                fill="none"
                stroke="#2c2638"
                strokeWidth="22"
              />
              {hud.minimap.pillars.map((p, i) => (
                <rect
                  key={i}
                  x={p.x - p.w / 2}
                  y={p.y - p.h / 2}
                  width={p.w}
                  height={p.h}
                  fill="#433d52"
                />
              ))}
              {hud.minimap.interactables.map((it, i) => (
                <circle key={i} cx={it.x} cy={it.y} r="30" fill="#f59e0b" />
              ))}
              {hud.minimap.portal && (
                <circle cx={hud.minimap.portal.x} cy={hud.minimap.portal.y} r="44" fill="#a855f7" />
              )}
              {hud.minimap.enemies.map((e, i) => (
                <circle
                  key={i}
                  cx={e.x}
                  cy={e.y}
                  r={e.isBoss ? 50 : e.isElite ? 32 : 21}
                  fill={e.isBoss ? '#facc15' : e.isElite ? '#fb923c' : '#ef4444'}
                />
              ))}
              <circle cx={hud.minimap.player.x} cy={hud.minimap.player.y} r="34" fill="#38bdf8" stroke="#f8fafc" strokeWidth="10" />
            </svg>
          </div>
        </div>

        {/* Utility square buttons dock (forged-iron dark-fantasy bar below minimap) */}
        <div
          data-hud-surface="true"
          data-testid="hud-utility-bar"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          className="relative z-30 mt-2.5 sm:mt-3 pointer-events-auto cursor-default hud-iron-frame p-2 flex items-center gap-2.5 sm:gap-3"
        >
          <CornerNotches />
          <UtilityBtn
            label="Inventário (I)"
            tooltipTitle="Inventário"
            tooltipDesc="Gerencie equipamentos, relíquias e itens coletados na incursão."
            tooltipMobileAlign="left"
            hotkey="I"
            badge={hud.inventory.length > 0 ? hud.inventory.length : undefined}
            onClick={() => onOpenCharacterTab('inventory')}
          >
            <svg viewBox="0 0 24 24" className="w-6 h-6 sm:w-[27px] sm:h-[27px]" fill="none" stroke="currentColor" strokeWidth="1.85">
              <path d="M5 8h14l-1 12H6L5 8zm4 0V6a3 3 0 016 0v2" />
            </svg>
          </UtilityBtn>
          <UtilityBtn
            label="Habilidades e Sinergias (K)"
            tooltipTitle="Habilidades e Sinergias"
            tooltipDesc="Visualize níveis de habilidades, evoluções e sinergias ativas."
            hotkey="K"
            onClick={() => onOpenCharacterTab('skills')}
          >
            <svg viewBox="0 0 24 24" className="w-6 h-6 sm:w-[27px] sm:h-[27px]" fill="none" stroke="currentColor" strokeWidth="1.85">
              <path d="M13 2L4.5 13.5H11L10 22l9.5-11.5H13V2z" />
            </svg>
          </UtilityBtn>
          <UtilityBtn
            label="Atributos (C)"
            tooltipTitle="Atributos"
            tooltipDesc="Consulte atributos de combate, resistências e bônus do herói."
            hotkey="C"
            onClick={() => onOpenCharacterTab('stats')}
          >
            <svg viewBox="0 0 24 24" className="w-6 h-6 sm:w-[27px] sm:h-[27px]" fill="none" stroke="currentColor" strokeWidth="1.85">
              <path d="M12 12a4 4 0 100-8 4 4 0 000 8zm-7 8a7 7 0 0114 0" />
            </svg>
          </UtilityBtn>
          <UtilityBtn
            label={settings.muted ? 'Ativar som (M)' : 'Silenciar som (M)'}
            tooltipTitle={settings.muted ? 'Ativar som' : 'Silenciar som'}
            tooltipDesc={
              settings.muted
                ? 'Reativa os efeitos sonoros e a trilha da masmorra.'
                : 'Silencia os efeitos sonoros e a trilha da masmorra.'
            }
            hotkey="M"
            onClick={onToggleMute}
          >
            {settings.muted ? (
              <svg viewBox="0 0 24 24" className="w-6 h-6 sm:w-[27px] sm:h-[27px]" fill="none" stroke="currentColor" strokeWidth="1.85">
                <path d="M11 5L6 9H3v6h3l5 4V5zm5 4l5 6m0-6l-5 6" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="w-6 h-6 sm:w-[27px] sm:h-[27px]" fill="none" stroke="currentColor" strokeWidth="1.85">
                <path d="M11 5L6 9H3v6h3l5 4V5zm4.5 3.5a5 5 0 010 7m3-9.5a8.5 8.5 0 010 12" />
              </svg>
            )}
          </UtilityBtn>
          <UtilityBtn
            label="Pausar (Esc)"
            tooltipTitle="Pausar jogo"
            tooltipDesc="Interrompe o combate e abre o menu de pausa e opções."
            hotkey="Esc"
            onClick={onOpenPause}
          >
            <svg viewBox="0 0 24 24" className="w-6 h-6 sm:w-[27px] sm:h-[27px]" fill="none" stroke="currentColor" strokeWidth="1.85">
              <path d="M8 5h3v14H8zm5 0h3v14h-3z" />
            </svg>
          </UtilityBtn>
        </div>
      </div>

      {/* BOTTOM-LEFT: Discreet Non-Blocking Narrative Ribbon (Boss Dialogue / Tower Whisper / Memory Fragment) */}
      {narrativeOverlay && (
        <div
          key={narrativeOverlay.id}
          data-testid="hud-narrative-overlay"
          className="fixed bottom-24 sm:bottom-5 left-4 sm:left-5 z-30 pointer-events-none w-[min(90vw,390px)] px-4 py-2.5 bg-[#0e0c14]/94 border border-white/12 border-l-2 shadow-[0_10px_28px_rgba(0,0,0,0.75)] animate-modal-enter"
          style={{
            borderLeftColor:
              narrativeOverlay.accentColor ??
              (narrativeOverlay.kind === 'tower_whisper'
                ? '#a855f7'
                : narrativeOverlay.kind === 'fragment'
                  ? '#d4a64a'
                  : '#ef4444'),
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <span
              className="font-display text-[10px] font-bold uppercase tracking-[0.2em]"
              style={{
                color:
                  narrativeOverlay.accentColor ??
                  (narrativeOverlay.kind === 'tower_whisper'
                    ? '#c084fc'
                    : narrativeOverlay.kind === 'fragment'
                      ? '#f8e3a8'
                      : '#fca5a5'),
              }}
            >
              {narrativeOverlay.kind === 'tower_whisper'
                ? narrativeOverlay.speaker.toLowerCase().includes('torre')
                  ? narrativeOverlay.speaker
                  : `Sussurro da Torre · ${narrativeOverlay.speaker}`
                : narrativeOverlay.kind === 'fragment'
                  ? `Fragmento de Memória · ${narrativeOverlay.speaker}`
                  : narrativeOverlay.speaker}
            </span>
            {narrativeOverlay.kind === 'fragment' && (
              <span className="font-mono-num text-[9px] uppercase tracking-wider text-[#9c9487] shrink-0">
                Arquivo
              </span>
            )}
          </div>
          <p
            className={`mt-1 text-xs sm:text-[13px] leading-snug ${
              narrativeOverlay.kind === 'fragment'
                ? 'text-[#e8e3d9]'
                : 'italic text-[#f4efe6]'
            }`}
          >
            {narrativeOverlay.kind === 'fragment'
              ? narrativeOverlay.text
              : `“${narrativeOverlay.text}”`}
          </p>
        </div>
      )}

      {/* BOTTOM-CENTER: Interaction Prompt + Passive Strip + Forged-Iron Skill Hotbar */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
        {hud.nearbyPrompt && (
          <button
            type="button"
            tabIndex={-1}
            data-hud-surface="true"
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              e.currentTarget.blur();
              phaserBridge.getController()?.triggerInteract();
            }}
            className="pointer-events-auto relative hud-iron-frame border-[#d4a64a]/80 px-4 py-1.5 text-xs font-semibold text-[#f8e3a8] tracking-wide hover:bg-[#241d31] transition-colors cursor-pointer"
          >
            {hud.nearbyPrompt}
          </button>
        )}

        {(hud.activeSynergies.length > 0 ||
          Object.entries(hud.skills).some(
            ([sid, lv]) => lv > 0 && !hud.activeSlots.some((s) => s.skillId === sid)
          )) && (
          <div className="flex items-center gap-1.5 text-[11px] font-mono-num hud-text-shadow">
            {Object.entries(hud.skills)
              .filter(([sid, lv]) => lv > 0 && !hud.activeSlots.some((s) => s.skillId === sid))
              .slice(0, 6)
              .map(([sid, lv]) => (
                <span key={sid} className="inline-flex items-center gap-1 text-[#d6cfc2] bg-[#110f17]/90 border border-[#d4a64a]/25 px-1.5 py-0.5">
                  <SkillIcon skillId={sid as keyof typeof hud.skills} className="w-3.5 h-3.5 text-[#d4a64a]" />
                  <span>Nv.{lv}</span>
                </span>
              ))}
            {hud.activeSynergies.length > 0 && (
              <span className="text-[#e9d5ff] bg-[#1d132b]/92 border border-[#c084fc]/55 px-2 py-0.5">
                {hud.activeSynergies.length} Sinergia{hud.activeSynergies.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}

        <div
          data-hud-surface="true"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          className="pointer-events-auto cursor-default relative hud-iron-frame px-3 py-2 flex items-center gap-2"
        >
          <CornerNotches gold />

          {/* Q E R F Active Skills */}
          {hud.activeSlots.map((slot, idx) => {
            const cdRatio =
              slot.skillId && slot.cooldownTotal > 0
                ? Math.min(1, slot.cooldownRemaining / slot.cooldownTotal)
                : 0;
            const ready = Boolean(slot.skillId && slot.cooldownRemaining <= 0.05);
            const isAiming = hud.activeCastSlot === idx;
            return (
              <button
                key={slot.key}
                type="button"
                tabIndex={-1}
                disabled={!slot.skillId}
                onClick={(e) => {
                  e.currentTarget.blur();
                  phaserBridge.getController()?.castSkillSlot(idx);
                }}
                title={slot.skillId ? `${slot.name} (Nv.${slot.level})` : `Espaço ${slot.key} vazio`}
                aria-label={slot.skillId ? `Usar ${slot.name} (${slot.key})` : `Espaço ${slot.key} vazio`}
                className={`relative w-12 h-12 sm:w-[54px] sm:h-[54px] border flex flex-col items-center justify-center transition-colors overflow-hidden ${
                  slot.skillId
                    ? isAiming
                      ? 'bg-[#262033] border-[#4ade80] cursor-pointer'
                      : ready
                        ? 'bg-[#191623] border-[#d4a64a]/65 hover:border-[#f8e3a8] cursor-pointer'
                        : 'bg-[#100e16] border-white/15 cursor-default'
                    : 'bg-[#0b0a0f] border-white/10 opacity-45 cursor-default'
                }`}
                style={
                  isAiming && slot.skillId
                    ? { boxShadow: `inset 0 0 14px rgba(74,222,128,0.28), 0 0 10px rgba(74,222,128,0.25)` }
                    : ready && slot.skillId
                      ? { boxShadow: `inset 0 -3px 0 ${slot.color}cc, inset 0 0 12px ${slot.color}1e` }
                      : undefined
                }
              >
                {slot.skillId && (
                  <span style={{ color: ready ? slot.color : '#64748b' }}>
                    <SkillIcon skillId={slot.skillId} className="w-5 h-5" />
                  </span>
                )}
                {cdRatio > 0 && (
                  <div
                    className="absolute inset-x-0 bottom-0 bg-[#07060a]/82 border-t border-[#f8e3a8]/35 flex items-center justify-center font-mono-num text-[11px] font-bold text-[#f8e3a8]"
                    style={{ height: `${cdRatio * 100}%` }}
                  >
                    {slot.cooldownRemaining.toFixed(1)}
                  </div>
                )}
                <span className="absolute top-0.5 left-1 font-mono-num text-[10px] text-[#c7bfb2] font-bold leading-none">
                  {slot.key}
                </span>
                {slot.level > 0 && (
                  <span className="absolute bottom-1 right-1 font-mono-num text-[9px] font-bold text-[#f8e3a8] leading-none">
                    {slot.level}
                  </span>
                )}
              </button>
            );
          })}

          <div className="w-px h-9 bg-[#d4a64a]/25 mx-0.5" />

          {/* Space Dash Slot */}
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              phaserBridge.getController()?.triggerDash();
            }}
            aria-label="Esquiva (Espaço)"
            className={`relative w-12 h-12 sm:w-[54px] sm:h-[54px] border flex flex-col items-center justify-center cursor-pointer overflow-hidden ${
              hud.activeCastSlot === -1
                ? 'bg-[#262033] border-[#4ade80]'
                : 'bg-[#191623] border-[#c084fc]/55 hover:border-[#e9d5ff]'
            }`}
            style={
              hud.activeCastSlot === -1
                ? { boxShadow: 'inset 0 0 14px rgba(74,222,128,0.28), 0 0 10px rgba(74,222,128,0.25)' }
                : hud.dashCooldown <= 0.05
                  ? { boxShadow: 'inset 0 -3px 0 rgba(192,132,252,0.8), inset 0 0 12px rgba(192,132,252,0.14)' }
                  : undefined
            }
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#c084fc]" fill="none" stroke="currentColor" strokeWidth="1.9">
              <path d="M4 12h13m-4-5l5 5-5 5M4 7h6M4 17h6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {hud.dashCooldown > 0.05 && (
              <div
                className="absolute inset-x-0 bottom-0 bg-[#07060a]/82 border-t border-[#e9d5ff]/35 flex items-center justify-center font-mono-num text-[11px] font-bold text-[#e9d5ff]"
                style={{ height: `${Math.min(100, (hud.dashCooldown / hud.dashCooldownMax) * 100)}%` }}
              >
                {hud.dashCooldown.toFixed(1)}
              </div>
            )}
            <span className="absolute top-0.5 left-1 font-mono-num text-[9px] text-[#c7bfb2] font-bold leading-none">
              ESP
            </span>
          </button>
        </div>
      </div>

      {/* Optional / Auto-Detected Mobile Touch Virtual Controls */}
      {isTouchEnv && <MobileTouchControls />}
    </div>
  );
}

function CornerNotches({ gold = false }: { gold?: boolean }) {
  const c = gold ? 'border-[#f8e3a8]/80' : 'border-[#d4a64a]/65';
  return (
    <>
      <span className={`pointer-events-none absolute -top-px -left-px w-2 h-2 border-t-2 border-l-2 ${c}`} />
      <span className={`pointer-events-none absolute -top-px -right-px w-2 h-2 border-t-2 border-r-2 ${c}`} />
      <span className={`pointer-events-none absolute -bottom-px -left-px w-2 h-2 border-b-2 border-l-2 ${c}`} />
      <span className={`pointer-events-none absolute -bottom-px -right-px w-2 h-2 border-b-2 border-r-2 ${c}`} />
    </>
  );
}

function UtilityBtn({
  label,
  tooltipTitle,
  tooltipDesc,
  tooltipMobileAlign = 'right',
  hotkey,
  badge,
  onClick,
  children,
}: {
  label: string;
  tooltipTitle: string;
  tooltipDesc: string;
  tooltipMobileAlign?: 'right' | 'left';
  hotkey: string;
  badge?: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const displayKey = hotkey === 'Esc' ? 'ESC' : hotkey;
  const alignClass =
    tooltipMobileAlign === 'left' ? 'left-0 sm:left-auto sm:right-0' : 'right-0';

  return (
    <div className="group relative">
      <button
        type="button"
        tabIndex={-1}
        data-hud-surface="true"
        aria-label={label}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          e.currentTarget.blur();
          onClick();
        }}
        className="relative w-14 h-14 sm:w-[62px] sm:h-[62px] bg-[#161320]/96 border border-[#d4a64a]/45 hover:border-[#f8e3a8] hover:bg-[#231d31] hover:-translate-y-0.5 active:translate-y-0 text-[#e8e3d9] hover:text-[#faf5eb] shadow-[0_6px_14px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(248,227,168,0.14),inset_0_-2px_0_rgba(0,0,0,0.55)] hover:shadow-[0_8px_18px_rgba(0,0,0,0.78),inset_0_0_14px_rgba(212,166,74,0.2)] flex items-center justify-center transition-all duration-150 cursor-pointer pointer-events-auto"
      >
        <span className="pointer-events-none flex items-center justify-center -translate-y-1.5 transition-transform duration-150 group-hover:scale-105">
          {children}
        </span>
        <span className="pointer-events-none absolute bottom-1.5 right-1.5 px-1.5 py-[2px] bg-[#09080c]/94 border border-[#d4a64a]/40 group-hover:border-[#f8e3a8]/75 font-mono-num text-[11px] font-bold text-[#e7d8b5] group-hover:text-[#faf5eb] leading-none tracking-tight transition-colors">
          {displayKey}
        </span>
        {badge !== undefined && (
          <span className="pointer-events-none absolute -top-1.5 -right-1.5 min-w-[20px] h-[20px] px-1 bg-[#b83232] border border-[#f8e3a8]/65 text-[11px] font-mono-num font-bold text-white flex items-center justify-center shadow-sm">
            {badge}
          </span>
        )}
      </button>

      {/* Dark-fantasy informative hover tooltip */}
      <div
        role="tooltip"
        className={`pointer-events-none absolute ${alignClass} top-full mt-3 z-40 w-[224px] opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:translate-y-0 transition-all duration-150 hud-iron-frame px-3 py-2.5 text-left`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-display text-xs font-bold text-[#f8e3a8] tracking-wide leading-tight">
            {tooltipTitle}
          </span>
          <span className="shrink-0 font-mono-num text-[10px] font-bold text-[#f8e3a8] bg-[#09080c] border border-[#d4a64a]/50 px-1.5 py-0.5 leading-none">
            {displayKey}
          </span>
        </div>
        <div className="h-px bg-[#d4a64a]/22 my-1.5" />
        <p className="text-[11px] leading-snug text-[#d6cfc2] whitespace-normal">
          {tooltipDesc}
        </p>
      </div>
    </div>
  );
}

function MobileTouchControls() {
  const padRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef({ mx: 0, my: 0, firing: false });

  const sync = () => {
    const s = stateRef.current;
    phaserBridge.getController()?.setMobileInput(s.mx, s.my, s.mx, s.my, s.firing);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const rect = padRef.current?.getBoundingClientRect();
    const touch = e.touches[0];
    if (!rect || !touch) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (touch.clientX - cx) / (rect.width / 2);
    const dy = (touch.clientY - cy) / (rect.height / 2);
    const mag = Math.min(1, Math.hypot(dx, dy));
    const ang = Math.atan2(dy, dx);
    stateRef.current.mx = Math.cos(ang) * mag;
    stateRef.current.my = Math.sin(ang) * mag;
    sync();
  };

  const handleTouchEnd = () => {
    stateRef.current.mx = 0;
    stateRef.current.my = 0;
    sync();
  };

  return (
    <div className="fixed inset-x-4 bottom-20 flex items-end justify-between pointer-events-none">
      <div
        ref={padRef}
        onTouchStart={handleTouchMove}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="pointer-events-auto w-28 h-28 rounded-full bg-[#121018]/75 border border-[#d4a64a]/45 flex items-center justify-center touch-none"
      >
        <div className="w-10 h-10 rounded-full bg-[#d4a64a]/35 border border-[#f8e3a8]/60" />
      </div>

      <button
        type="button"
        onTouchStart={() => {
          stateRef.current.firing = true;
          sync();
        }}
        onTouchEnd={() => {
          stateRef.current.firing = false;
          sync();
        }}
        className="pointer-events-auto w-20 h-20 rounded-full bg-[#b83232]/85 border-2 border-[#f8e3a8]/65 font-display text-xs font-bold text-white touch-none"
      >
        ATACAR
      </button>
    </div>
  );
}
