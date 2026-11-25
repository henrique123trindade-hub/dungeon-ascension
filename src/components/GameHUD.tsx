import { useEffect, useRef, useState } from 'react';
import { CLASSES } from '../game/data/classes';
import { phaserBridge } from '../game/phaser/PhaserBridge';
import type { RunHUDSnapshot, SettingsData } from '../game/types';
import { ClassIcon, CrystalIcon, GoldCoinIcon, SkillIcon } from './Icons';

interface GameHUDProps {
  hud: RunHUDSnapshot;
  settings: SettingsData;
  onOpenCharacterTab: (tab: 'inventory' | 'skills' | 'stats') => void;
  onToggleMute: () => void;
  onOpenPause: () => void;
}

export function GameHUD({
  hud,
  settings,
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
          className="fixed inset-0 pointer-events-none transition-opacity duration-200"
          style={{
            boxShadow: hitFlash
              ? 'inset 0 0 120px rgba(220, 38, 38, 0.65)'
              : 'inset 0 0 95px rgba(185, 28, 28, 0.5)',
          }}
        />
      )}

      {/* TOP-LEFT CLUSTER: Vitality, XP, Level, Class Evolution, Active Multipliers */}
      <div className="fixed top-3.5 left-4 flex flex-col gap-2 w-[264px] sm:w-[292px]">
        <div className="flex items-center gap-3">
          {/* Level & Class Crest */}
          <div
            className="w-11 h-11 bg-[#121018]/92 border border-[#d4a64a]/55 flex flex-col items-center justify-center shrink-0 shadow-lg"
            style={{ color: cls.accentColor }}
          >
            <ClassIcon classId={hud.classId} className="w-5 h-5" />
            <span className="font-mono-num text-[10px] font-bold text-[#f8e3a8] leading-none mt-0.5">
              Nv.{hud.level}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-2 hud-text-shadow">
              <span className="font-display text-xs sm:text-sm font-bold text-[#f4efe6] truncate">
                {hud.evolutionTitle}
              </span>
              <span className="font-mono-num text-xs text-[#e8e3d9]">
                {hud.hp}/{hud.maxHp}
                {hud.shield > 0 ? <span className="text-[#facc15]"> +{hud.shield}</span> : null}
              </span>
            </div>

            {/* HP Bar with delayed damage ghost trail + Shield */}
            <div className="relative h-3.5 mt-1 bg-[#0b0a0e]/95 border border-[#d4a64a]/35 overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-[#f59e0b]/70 transition-[width] duration-300"
                style={{ width: `${Math.max(hpPct, ghostHpPct)}%` }}
              />
              <div
                className="absolute inset-y-0 left-0 bg-[#b83232]"
                style={{ width: `${hpPct}%` }}
              />
              {shieldPct > 0 && (
                <div
                  className="absolute inset-y-0 left-0 bg-[#facc15]/55 border-r border-[#fef08a]"
                  style={{ width: `${Math.min(100, shieldPct)}%` }}
                />
              )}
            </div>

            {/* XP Bar */}
            <div className="relative h-1.5 mt-1 bg-[#0b0a0e]/95 border border-white/15 overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-[#38bdf8]"
                style={{ width: `${xpPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Active Multipliers & Buffs (unboxed crisp metadata) */}
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
      </div>

      {/* TOP-CENTER: Boss Health Bar OR Timed Challenge OR Floor Notice */}
      <div className="fixed top-3.5 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 w-[90vw] max-w-[460px]">
        {hud.boss && (
          <div className="w-full bg-[#110e16]/95 border border-[#d4a64a]/65 px-4 py-2.5 shadow-2xl">
            <div className="flex items-baseline justify-between gap-2">
              <div className="min-w-0">
                <span className="font-display text-sm sm:text-base font-bold text-[#f8e3a8] tracking-wide">
                  {hud.boss.name}
                </span>
                <span className="text-[11px] text-[#b8afa1] ml-2 hidden sm:inline">
                  {hud.boss.title}
                </span>
              </div>
              <span className="font-mono-num text-xs text-[#fca5a5] shrink-0">
                Fase {hud.boss.phase}/{hud.boss.maxPhases} · {hud.boss.hp}/{hud.boss.maxHp}
              </span>
            </div>
            <div className="relative h-3.5 mt-1.5 bg-[#09080c] border border-[#dc2626]/60 overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-[#f59e0b]/75 transition-[width] duration-300"
                style={{ width: `${Math.max(bossHpPct, bossGhostPct)}%` }}
              />
              <div
                className="absolute inset-y-0 left-0 bg-[#dc2626] transition-[width] duration-100"
                style={{ width: `${bossHpPct}%` }}
              />
              {/* Phase transition markers */}
              {hud.boss.maxPhases === 3 ? (
                <>
                  <div className="absolute inset-y-0 left-[35%] w-px bg-[#f8e3a8]/75" />
                  <div className="absolute inset-y-0 left-[70%] w-px bg-[#f8e3a8]/75" />
                </>
              ) : (
                <div className="absolute inset-y-0 left-[50%] w-px bg-[#f8e3a8]/75" />
              )}
            </div>
          </div>
        )}

        {hud.timedChallenge && (
          <div className="bg-[#14111a]/92 border border-[#d4a64a]/50 px-3.5 py-1 text-xs font-mono-num text-[#f8e3a8]">
            Desafio Contra o Tempo · {hud.timedChallenge.remainingSec.toFixed(1)}s
          </div>
        )}

        {hud.recentNotice && (
          <div
            key={hud.recentNotice.id}
            className="px-3.5 py-1.5 bg-[#121018]/92 border text-xs font-medium tracking-wide hud-text-shadow animate-modal-enter"
            style={{
              borderColor:
                hud.recentNotice.tone === 'crimson'
                  ? 'rgba(220,38,38,0.65)'
                  : hud.recentNotice.tone === 'violet'
                    ? 'rgba(192,132,252,0.65)'
                    : hud.recentNotice.tone === 'emerald'
                      ? 'rgba(52,211,153,0.65)'
                      : 'rgba(212,166,74,0.65)',
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
      <div className="fixed top-3.5 right-4 flex flex-col items-end gap-2">
        <div className="flex items-start gap-3">
          <div className="text-right hud-text-shadow">
            <div className="font-display text-sm sm:text-base font-bold text-[#f8e3a8] leading-tight">
              Andar {hud.floor} · {hud.biomeName}
            </div>
            <div className="text-xs text-[#c7bfb2] font-mono-num mt-0.5 flex items-center justify-end gap-2.5">
              <span>
                {hud.portalOpen ? (
                  <span className="text-[#4ade80]">Portal Aberto</span>
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
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 text-[#facc15]">
                <GoldCoinIcon className="w-3.5 h-3.5" />
                {hud.gold}
              </span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 text-[#c084fc]">
                <CrystalIcon className="w-3.5 h-3.5" />
                {hud.crystalsRun}
              </span>
            </div>
            {hud.floorModifier && (
              <div className="text-[11px] text-[#fca5a5] mt-0.5">{hud.floorModifier}</div>
            )}
          </div>

          {/* Real-geometry Corner Minimap */}
          <div className="hidden sm:block bg-[#0c0a11]/90 border border-[#d4a64a]/35 p-1 shadow-lg">
            <svg width={mmW} height={mmH} viewBox={`0 0 ${hud.minimap.roomWidth} ${hud.minimap.roomHeight}`}>
              <rect
                x="0"
                y="0"
                width={hud.minimap.roomWidth}
                height={hud.minimap.roomHeight}
                fill="#15121d"
              />
              {hud.minimap.pillars.map((p, i) => (
                <rect
                  key={i}
                  x={p.x - p.w / 2}
                  y={p.y - p.h / 2}
                  width={p.w}
                  height={p.h}
                  fill="#3b3648"
                />
              ))}
              {hud.minimap.interactables.map((it, i) => (
                <circle key={i} cx={it.x} cy={it.y} r="28" fill="#f59e0b" />
              ))}
              {hud.minimap.portal && (
                <circle cx={hud.minimap.portal.x} cy={hud.minimap.portal.y} r="42" fill="#a855f7" />
              )}
              {hud.minimap.enemies.map((e, i) => (
                <circle
                  key={i}
                  cx={e.x}
                  cy={e.y}
                  r={e.isBoss ? 48 : e.isElite ? 30 : 20}
                  fill={e.isBoss ? '#facc15' : e.isElite ? '#fb923c' : '#ef4444'}
                />
              ))}
              <circle cx={hud.minimap.player.x} cy={hud.minimap.player.y} r="32" fill="#38bdf8" />
            </svg>
          </div>
        </div>

        {/* Utility square buttons */}
        <div className="pointer-events-auto flex items-center gap-1.5">
          <UtilityBtn
            label="Inventário (I)"
            hotkey="I"
            badge={hud.inventory.length > 0 ? hud.inventory.length : undefined}
            onClick={() => onOpenCharacterTab('inventory')}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M5 8h14l-1 12H6L5 8zm4 0V6a3 3 0 016 0v2" />
            </svg>
          </UtilityBtn>
          <UtilityBtn label="Habilidades e Sinergias (K)" hotkey="K" onClick={() => onOpenCharacterTab('skills')}>
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M13 2L4.5 13.5H11L10 22l9.5-11.5H13V2z" />
            </svg>
          </UtilityBtn>
          <UtilityBtn label="Atributos (C)" hotkey="C" onClick={() => onOpenCharacterTab('stats')}>
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 12a4 4 0 100-8 4 4 0 000 8zm-7 8a7 7 0 0114 0" />
            </svg>
          </UtilityBtn>
          <UtilityBtn
            label={settings.muted ? 'Ativar som (M)' : 'Silenciar som (M)'}
            hotkey="M"
            onClick={onToggleMute}
          >
            {settings.muted ? (
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M11 5L6 9H3v6h3l5 4V5zm5 4l5 6m0-6l-5 6" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M11 5L6 9H3v6h3l5 4V5zm4.5 3.5a5 5 0 010 7m3-9.5a8.5 8.5 0 010 12" />
              </svg>
            )}
          </UtilityBtn>
          <UtilityBtn label="Pausar (Esc)" hotkey="Esc" onClick={onOpenPause}>
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M8 5h3v14H8zm5 0h3v14h-3z" />
            </svg>
          </UtilityBtn>
        </div>
      </div>

      {/* BOTTOM-CENTER: Interaction Prompt + Passive Strip + Forged-Iron Skill Bar */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
        {hud.nearbyPrompt && (
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              phaserBridge.getController()?.triggerInteract();
            }}
            className="pointer-events-auto px-4 py-1.5 bg-[#1a1523]/95 border border-[#d4a64a]/75 text-xs font-semibold text-[#f8e3a8] tracking-wide hover:bg-[#272034] transition-colors cursor-pointer"
          >
            {hud.nearbyPrompt}
          </button>
        )}

        {(hud.activeSynergies.length > 0 ||
          Object.entries(hud.skills).some(
            ([sid, lv]) => lv > 0 && !hud.activeSlots.some((s) => s.skillId === sid)
          )) && (
          <div className="flex items-center gap-2 text-[11px] font-mono-num hud-text-shadow">
            {Object.entries(hud.skills)
              .filter(([sid, lv]) => lv > 0 && !hud.activeSlots.some((s) => s.skillId === sid))
              .slice(0, 6)
              .map(([sid, lv]) => (
                <span key={sid} className="inline-flex items-center gap-1 text-[#d6cfc2] bg-[#110f17]/85 border border-white/15 px-1.5 py-0.5">
                  <SkillIcon skillId={sid as keyof typeof hud.skills} className="w-3.5 h-3.5 text-[#d4a64a]" />
                  <span>Nv.{lv}</span>
                </span>
              ))}
            {hud.activeSynergies.length > 0 && (
              <span className="text-[#e9d5ff] bg-[#1d132b]/90 border border-[#c084fc]/45 px-2 py-0.5">
                {hud.activeSynergies.length} Sinergia{hud.activeSynergies.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}

        <div className="pointer-events-auto flex items-center gap-2 bg-[#110f17]/94 border border-[#d4a64a]/35 px-2.5 py-2 shadow-2xl">
          {/* Q E R F Active Skills */}
          {hud.activeSlots.map((slot, idx) => {
            const cdRatio =
              slot.skillId && slot.cooldownTotal > 0
                ? Math.min(1, slot.cooldownRemaining / slot.cooldownTotal)
                : 0;
            const ready = Boolean(slot.skillId && slot.cooldownRemaining <= 0.05);
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
                className={`relative w-12 h-12 sm:w-13 sm:h-13 border flex flex-col items-center justify-center transition-colors ${
                  slot.skillId
                    ? ready
                      ? 'bg-[#1a1724] border-[#d4a64a]/60 hover:border-[#f8e3a8] cursor-pointer'
                      : 'bg-[#121018] border-white/15 cursor-default'
                    : 'bg-[#0c0b10] border-white/10 opacity-45 cursor-default'
                }`}
              >
                {slot.skillId && (
                  <span style={{ color: slot.color }}>
                    <SkillIcon skillId={slot.skillId} className="w-5 h-5" />
                  </span>
                )}
                {cdRatio > 0 && (
                  <div
                    className="absolute inset-x-0 bottom-0 bg-black/75 flex items-center justify-center font-mono-num text-[11px] font-bold text-[#f8e3a8]"
                    style={{ height: `${cdRatio * 100}%` }}
                  >
                    {slot.cooldownRemaining.toFixed(1)}
                  </div>
                )}
                <span className="absolute top-0.5 left-1 font-mono-num text-[10px] text-[#b8afa1] font-bold">
                  {slot.key}
                </span>
                {slot.level > 0 && (
                  <span className="absolute bottom-0.5 right-1 font-mono-num text-[9px] text-[#d4a64a]">
                    {slot.level}
                  </span>
                )}
              </button>
            );
          })}

          <div className="w-px h-8 bg-white/15 mx-0.5" />

          {/* Space Dash Slot */}
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              phaserBridge.getController()?.triggerDash();
            }}
            aria-label="Esquiva (Espaço)"
            className="relative w-12 h-12 sm:w-13 sm:h-13 bg-[#1a1724] border border-[#c084fc]/50 hover:border-[#e9d5ff] flex flex-col items-center justify-center cursor-pointer"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#c084fc]" fill="none" stroke="currentColor" strokeWidth="1.9">
              <path d="M4 12h13m-4-5l5 5-5 5M4 7h6M4 17h6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {hud.dashCooldown > 0.05 && (
              <div
                className="absolute inset-x-0 bottom-0 bg-black/75 flex items-center justify-center font-mono-num text-[11px] font-bold text-[#e9d5ff]"
                style={{ height: `${Math.min(100, (hud.dashCooldown / hud.dashCooldownMax) * 100)}%` }}
              >
                {hud.dashCooldown.toFixed(1)}
              </div>
            )}
            <span className="absolute top-0.5 left-1 font-mono-num text-[9px] text-[#b8afa1] font-bold">
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

function UtilityBtn({
  label,
  hotkey,
  badge,
  onClick,
  children,
}: {
  label: string;
  hotkey: string;
  badge?: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.currentTarget.blur();
        onClick();
      }}
      className="relative w-9 h-9 bg-[#121018]/92 border border-[#d4a64a]/35 hover:border-[#f8e3a8] text-[#e8e3d9] flex items-center justify-center transition-colors cursor-pointer"
    >
      {children}
      <span className="sr-only">{hotkey}</span>
      {badge !== undefined && (
        <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-[#b83232] text-[10px] font-mono-num font-bold text-white flex items-center justify-center">
          {badge}
        </span>
      )}
    </button>
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
