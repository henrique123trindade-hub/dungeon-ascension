import { useCallback, useEffect, useRef, useState } from 'react';
import { SKILLS } from '../game/data/skills';
import type { LevelUpOfferPayload } from '../game/phaser/PhaserBridge';
import { audioEngine } from '../game/systems/audioEngine';
import { RARITY_META } from '../game/systems/balance';
import {
  createLevelUpGuard,
  extractUpgradeHighlights,
  getLevelUpLockRemainingMs,
  isLevelUpTimerReady,
  isLevelUpUnlocked,
  LEVEL_UP_LOCK_MS,
  LEVEL_UP_NEXT_OFFER_DELAY_MS,
  LEVEL_UP_RESUME_TRANSITION_MS,
  onGuardCardPointerDown,
  onGuardCardPointerUp,
  onGuardGlobalPointerDown,
  onGuardGlobalPointerUp,
  onGuardKeyDown,
  onGuardKeyUp,
  onGuardPointerButtonsObserved,
  type LevelUpGuardState,
} from '../game/systems/levelUpGuard';
import type { UpgradeOption } from '../game/types';
import { SkillIcon } from './Icons';

interface LevelUpModalProps {
  offer: LevelUpOfferPayload;
  luck: number;
  initialPointerHeld: boolean;
  initialHeldKeys: string[];
  onCommitChoice: (option: UpgradeOption) => { hasMorePending: boolean };
  onTransitionComplete: (hasMorePending: boolean) => void;
}

export function LevelUpModal({
  offer,
  luck,
  initialPointerHeld,
  initialHeldKeys,
  onCommitChoice,
  onTransitionComplete,
}: LevelUpModalProps) {
  const [nowMs, setNowMs] = useState<number>(() => performance.now());
  const [phase, setPhase] = useState<'active' | 'selecting_next' | 'exiting'>('active');

  const guardRef = useRef<LevelUpGuardState>(
    createLevelUpGuard(performance.now(), initialPointerHeld || offer.pointerWasDown, initialHeldKeys)
  );
  const [guardSnapshot, setGuardSnapshot] = useState<LevelUpGuardState>(guardRef.current);
  const transitionTimerRef = useRef<number | null>(null);

  const commitRef = useRef(onCommitChoice);
  commitRef.current = onCommitChoice;
  const completeRef = useRef(onTransitionComplete);
  completeRef.current = onTransitionComplete;

  const syncGuard = useCallback((next: LevelUpGuardState) => {
    guardRef.current = next;
    setGuardSnapshot(next);
  }, []);

  // Reset guard cleanly whenever a new consecutive level-up offer arrives
  useEffect(() => {
    if (transitionTimerRef.current !== null) {
      window.clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
    const openedAt = performance.now();
    const fresh = createLevelUpGuard(openedAt, initialPointerHeld || offer.pointerWasDown, initialHeldKeys);
    guardRef.current = fresh;
    setGuardSnapshot(fresh);
    setNowMs(openedAt);
    setPhase('active');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offer.offerId]);

  // Clear pending timeout on unmount
  useEffect(() => {
    return () => {
      if (transitionTimerRef.current !== null) {
        window.clearTimeout(transitionTimerRef.current);
        transitionTimerRef.current = null;
      }
    };
  }, []);

  // Smooth lock timer tick until 800ms elapse, then stop RAF
  useEffect(() => {
    if (phase !== 'active') return;
    let rafId = 0;
    const tick = () => {
      const t = performance.now();
      setNowMs(t);
      if (!isLevelUpTimerReady(guardRef.current, t)) {
        rafId = window.requestAnimationFrame(tick);
      }
    };
    if (!isLevelUpTimerReady(guardRef.current, performance.now())) {
      rafId = window.requestAnimationFrame(tick);
    }
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [offer.offerId, phase]);

  const finalizeSelection = useCallback((option: UpgradeOption) => {
    audioEngine.playUpgradeSelect(option.rarity);
    const { hasMorePending } = commitRef.current(option);
    setPhase(hasMorePending ? 'selecting_next' : 'exiting');
    const delay = hasMorePending ? LEVEL_UP_NEXT_OFFER_DELAY_MS : LEVEL_UP_RESUME_TRANSITION_MS;
    transitionTimerRef.current = window.setTimeout(() => {
      transitionTimerRef.current = null;
      completeRef.current(hasMorePending);
    }, delay);
  }, []);

  // Global window pointer & keyboard listeners (bubble phase so card handlers run first)
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const t = performance.now();
      setNowMs(t);
      syncGuard(onGuardGlobalPointerDown(guardRef.current, t));
    };

    const handlePointerUp = () => {
      const t = performance.now();
      setNowMs(t);
      syncGuard(onGuardGlobalPointerUp(guardRef.current));
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Digit1' && e.code !== 'Digit2' && e.code !== 'Digit3') return;
      const t = performance.now();
      setNowMs(t);
      const { next, chosenOption } = onGuardKeyDown(guardRef.current, e.code, e.repeat, offer.options, t);
      syncGuard(next);
      if (chosenOption) {
        e.preventDefault();
        finalizeSelection(chosenOption);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Digit1' && e.code !== 'Digit2' && e.code !== 'Digit3') return;
      syncGuard(onGuardKeyUp(guardRef.current, e.code));
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    window.addEventListener('blur', handlePointerUp);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      window.removeEventListener('blur', handlePointerUp);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [finalizeSelection, offer.options, syncGuard]);

  const handleBackdropPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const t = performance.now();
    const next = onGuardPointerButtonsObserved(guardRef.current, e.buttons, t);
    if (next !== guardRef.current) {
      setNowMs(t);
      syncGuard(next);
    }
  };

  const handleCardPointerDown = (e: React.PointerEvent<HTMLButtonElement>, opt: UpgradeOption) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const t = performance.now();
    setNowMs(t);
    syncGuard(onGuardCardPointerDown(guardRef.current, opt.id, e.pointerId, t));
  };

  const handleCardPointerUp = (e: React.PointerEvent<HTMLButtonElement>, opt: UpgradeOption) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const t = performance.now();
    setNowMs(t);
    const { next, accepted } = onGuardCardPointerUp(guardRef.current, opt.id, e.pointerId, t);
    syncGuard(next);
    if (accepted) {
      finalizeSelection(opt);
    }
  };

  const timerReady = isLevelUpTimerReady(guardSnapshot, nowMs);
  const unlocked = phase === 'active' && isLevelUpUnlocked(guardSnapshot, nowMs);
  const remainingMs = getLevelUpLockRemainingMs(guardSnapshot, nowMs);
  const lockProgressPct = Math.min(100, Math.max(0, ((LEVEL_UP_LOCK_MS - remainingMs) / LEVEL_UP_LOCK_MS) * 100));
  const waitingRelease = timerReady && (guardSnapshot.requirePointerRelease || guardSnapshot.pointerHeld);
  const hasMythicOrLegendary = offer.options.some((o) => o.rarity === 'mythic' || o.rarity === 'legendary');

  const statusText =
    phase === 'exiting'
      ? 'Retornando ao combate...'
      : phase === 'selecting_next'
        ? 'Carregando próxima ascensão...'
        : !timerReady
          ? 'Preparando opções...'
          : waitingRelease
            ? 'Solte o botão do mouse para escolher'
            : 'Clique em uma carta ou pressione 1, 2 ou 3 para escolher imediatamente.';

  return (
    <div
      data-testid="levelup-modal"
      data-locked={unlocked ? 'false' : 'true'}
      onPointerMove={handleBackdropPointerMove}
      onContextMenu={(e) => e.preventDefault()}
      className={`fixed inset-0 z-40 flex items-center justify-center bg-black/82 p-4 sm:p-6 select-none ${
        phase === 'exiting' ? 'animate-modal-exit pointer-events-none' : ''
      }`}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Subiu de Nível"
        className="w-full max-w-4xl flex flex-col items-center animate-modal-enter"
      >
        <div className="text-center mb-5 w-full max-w-md">
          <div className="font-mono-num text-xs tracking-[0.25em] uppercase text-[#d4a64a] flex items-center justify-center gap-2">
            <span>
              Nível {offer.level} Alcançado · Sorte {luck}
            </span>
            {offer.pendingCount > 0 && (
              <span className="px-1.5 py-0.5 bg-[#d4a64a]/15 border border-[#d4a64a]/45 text-[#f6d98c] text-[10px] tracking-wider">
                +{offer.pendingCount} pendente{offer.pendingCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#faf5eb] mt-1 tracking-wide">
            Escolha sua Ascensão
          </h2>
          {hasMythicOrLegendary && (
            <p className="text-xs font-semibold text-[#f59e0b] mt-1.5 tracking-wide">
              Relíquia de raridade superior manifestada nesta evolução
            </p>
          )}
          <div className="mt-3 h-0.5 w-full bg-white/10 overflow-hidden">
            <div
              className="h-full transition-[background-color] duration-200"
              style={{
                width: `${lockProgressPct}%`,
                backgroundColor: unlocked ? '#d4a64a' : waitingRelease ? '#f59e0b' : 'rgba(212,166,74,0.5)',
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
          {offer.options.map((opt, idx) => {
            const meta = RARITY_META[opt.rarity];
            const isSpecial = opt.rarity === 'legendary' || opt.rarity === 'mythic';
            const skillDef = opt.skillId ? SKILLS[opt.skillId] : null;
            const isChosen = guardSnapshot.chosenOptionId === opt.id;
            const isOtherChosen = guardSnapshot.chosenOptionId !== null && !isChosen;
            const highlights = extractUpgradeHighlights(opt);

            return (
              <button
                key={`${offer.offerId}_${opt.id}`}
                type="button"
                data-testid={`levelup-card-${idx}`}
                data-locked={unlocked ? 'false' : 'true'}
                data-chosen={isChosen ? 'true' : 'false'}
                onPointerDown={(e) => handleCardPointerDown(e, opt)}
                onPointerUp={(e) => handleCardPointerUp(e, opt)}
                className={`group relative text-left p-5 flex flex-col justify-between transition-all duration-200 animate-levelup-card-in ${
                  isChosen
                    ? 'animate-card-chosen z-10'
                    : isOtherChosen
                      ? 'opacity-30 scale-[0.98]'
                      : unlocked
                        ? 'opacity-100 hover:-translate-y-1 cursor-pointer'
                        : 'opacity-55 saturate-75 cursor-default'
                }`}
                style={{
                  backgroundColor: meta.bg,
                  border: `${isSpecial || isChosen ? '2px' : '1px'} solid ${isChosen ? '#faf5eb' : meta.border}`,
                  boxShadow: isChosen
                    ? `0 20px 44px rgba(0,0,0,0.9), 0 0 30px ${meta.color}70`
                    : isSpecial
                      ? `0 18px 42px rgba(0,0,0,0.85), 0 0 28px ${meta.color}40`
                      : '0 14px 30px rgba(0,0,0,0.75)',
                  animationDelay: `${idx * 55}ms`,
                }}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs font-mono-num">
                    <span className="font-bold uppercase tracking-wider" style={{ color: meta.color }}>
                      {meta.label}
                    </span>
                    <span className="text-[#9c9487]">[{idx + 1}]</span>
                  </div>

                  <div className="mt-4 flex items-center gap-3">
                    <div
                      className="w-11 h-11 bg-[#0b0a0e]/85 border flex items-center justify-center shrink-0"
                      style={{ borderColor: meta.border, color: skillDef ? skillDef.color : meta.color }}
                    >
                      {opt.skillId ? (
                        <SkillIcon skillId={opt.skillId} className="w-6 h-6" />
                      ) : opt.kind === 'multiplier' ? (
                        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.9">
                          <path
                            d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.9L12 16.5 6.8 19.2l1-5.9-4.3-4.1 5.9-.9L12 3z"
                            fill="currentColor"
                            fillOpacity="0.25"
                          />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.9">
                          <path d="M12 19V5m0 0l-5 5m5-5l5 5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-display font-bold text-base text-[#faf5eb] leading-snug">{opt.title}</div>
                      <div className="text-xs text-[#b8afa1] mt-0.5">{opt.subtitle}</div>
                    </div>
                  </div>

                  <p className="mt-4 text-sm text-[#ddd6c9] leading-relaxed">{opt.description}</p>

                  {highlights.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {highlights.map((tag) => (
                        <span
                          key={tag}
                          className="text-[11px] font-mono-num px-2 py-0.5 bg-[#0b0a0e]/75 border border-white/10 text-[#e8e3d9] transition-colors group-hover:border-white/30 group-hover:text-white"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {opt.synergyHint && !highlights.includes(opt.synergyHint) && (
                    <div className="mt-3 pt-2.5 border-t border-white/10 text-xs font-semibold text-[#e9d5ff]">
                      {opt.synergyHint}
                    </div>
                  )}
                </div>

                <div
                  className={`mt-5 pt-3 border-t border-white/10 text-xs font-display font-bold tracking-wider uppercase text-center transition-colors ${
                    unlocked ? 'group-hover:text-white' : 'opacity-60'
                  }`}
                  style={{ color: isChosen ? '#faf5eb' : meta.color }}
                >
                  {isChosen ? 'Melhoria Aplicada' : unlocked ? 'Selecionar Melhoria' : 'Aguarde...'}
                </div>
              </button>
            );
          })}
        </div>

        <p
          data-testid="levelup-status"
          className={`mt-4 text-xs transition-colors ${
            waitingRelease ? 'text-[#f59e0b] font-medium' : 'text-[#9c9487]'
          }`}
        >
          {statusText}
        </p>
      </div>
    </div>
  );
}
