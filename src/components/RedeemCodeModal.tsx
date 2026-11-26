import { useEffect, useRef, useState } from 'react';
import { CLASSES } from '../game/data/classes';
import { SECRET_CODES, type SecretCodeDef } from '../game/data/secretCodes';
import { SKILLS } from '../game/data/skills';
import type { RedeemCodeResult } from '../game/systems/secretCodeManager';
import type { ClassId } from '../game/types';
import { ClassIcon, SecretKeyIcon, SkillIcon } from './Icons';

interface RedeemCodeModalProps {
  redeemedCodes: string[];
  onRedeem: (rawCode: string) => RedeemCodeResult;
  onPlayClass: (classId: ClassId) => void;
  onOpenClasses: (selectClassId?: ClassId) => void;
  onClose: () => void;
}

export function RedeemCodeModal({
  redeemedCodes,
  onRedeem,
  onPlayClass,
  onOpenClasses,
  onClose,
}: RedeemCodeModalProps) {
  const [codeInput, setCodeInput] = useState('');
  const [feedback, setFeedback] = useState<{
    status: RedeemCodeResult['status'];
    message: string;
  } | null>(null);
  const [unlockedDef, setUnlockedDef] = useState<SecretCodeDef | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = onRedeem(codeInput);
    setFeedback({ status: res.status, message: res.message });
    if (res.status === 'success' && res.codeDef) {
      setCodeInput('');
      setUnlockedDef(res.codeDef);
    }
  };

  const unlockedClass =
    unlockedDef?.reward.type === 'unlock_class' ? CLASSES[unlockedDef.reward.classId] : null;

  const slotKeys = ['Q', 'E', 'R', 'F'];

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/82 p-4 sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Resgatar código secreto"
        className="dark-panel animate-modal-enter w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#d4a64a]/25">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 flex items-center justify-center border border-[#d4a64a]/45 bg-[#191522] text-[#f59e0b]">
              <SecretKeyIcon className="w-5 h-5" />
            </span>
            <div>
              <h2 className="font-display text-lg sm:text-xl font-bold text-[#f3e3be] tracking-wider">
                Resgatar Código
              </h2>
              <p className="text-xs text-[#9c9487] mt-0.5">
                Insira um código secreto para desbloquear recompensas permanentes.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar resgate de código"
            className="px-3 py-1.5 text-xs text-[#b8afa1] hover:text-white border border-white/15 hover:border-white/35 transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scroll p-6 space-y-4">
          {/* Status Feedback (always immediately visible above reveal panel) */}
          {feedback && (
            <div
              data-testid="secret-code-feedback"
              data-status={feedback.status}
              role="status"
              className={`px-4 py-3 border text-xs leading-relaxed ${
                feedback.status === 'success'
                  ? 'bg-[#192014] border-[#84cc16]/55 text-[#d9f99d]'
                  : feedback.status === 'already_redeemed'
                    ? 'bg-[#211a12] border-[#f59e0b]/55 text-[#fde68a]'
                    : 'bg-[#241216] border-[#ef4444]/55 text-[#fecaca]'
              }`}
            >
              {feedback.message}
            </div>
          )}

          {/* Special Unlock Celebration Panel */}
          {unlockedDef && unlockedClass && (
            <div
              data-testid="secret-unlock-celebration"
              className="relative overflow-hidden border border-[#f59e0b]/70 bg-[#17131e] p-5 animate-secret-unlock"
            >
              {/* Radial forged-gold atmospheric glow */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    'radial-gradient(circle at 50% 18%, rgba(245,158,11,0.22) 0%, rgba(212,166,74,0.06) 44%, transparent 72%)',
                }}
              />

              <div className="relative z-10 flex flex-col items-center text-center">
                <div className="relative flex items-center justify-center">
                  <span
                    aria-hidden="true"
                    className="absolute w-16 h-16 border border-[#facc15]/80 animate-secret-ring"
                  />
                  <div
                    className="w-16 h-16 flex items-center justify-center border-2 border-[#f59e0b] bg-[#0e0c14] shadow-[0_0_24px_rgba(245,158,11,0.35)]"
                    style={{ color: unlockedClass.accentColor }}
                  >
                    <ClassIcon classId={unlockedClass.id} className="w-10 h-10" />
                  </div>
                </div>

                <div className="mt-3 text-[11px] font-mono-num uppercase tracking-[0.22em] text-[#f59e0b]">
                  {unlockedDef.subtitle}
                </div>
                <h3 className="font-display text-2xl font-bold text-[#fef08a] tracking-wider mt-1">
                  {unlockedClass.name}
                </h3>
                <p className="text-xs text-[#c7bfb2] mt-1">{unlockedClass.archetype}</p>
                <p className="text-xs text-[#b8afa1] leading-relaxed mt-3 max-w-md">
                  {unlockedDef.description}
                </p>

                {/* Skill preview grid */}
                <div className="w-full mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                  {unlockedClass.startingSkills.map((sid, idx) => {
                    const sk = SKILLS[sid];
                    const badge = sk.type === 'active' ? slotKeys[idx] ?? 'A' : 'Passiva';
                    return (
                      <div
                        key={sid}
                        className={`p-2.5 bg-[#100e16]/95 border border-[#d4a64a]/25 flex items-start gap-2.5 ${
                          sk.type === 'passive' ? 'sm:col-span-2' : ''
                        }`}
                      >
                        <span className="mt-0.5 shrink-0" style={{ color: sk.color }}>
                          <SkillIcon skillId={sid} className="w-4 h-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono-num font-bold uppercase text-[#f59e0b]">
                              [{badge}]
                            </span>
                            <span className="text-xs font-semibold text-[#f4efe6] truncate">
                              {sk.name}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#9c9487] mt-0.5 leading-snug">
                            {sk.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="w-full mt-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5">
                  <button
                    type="button"
                    data-testid="secret-play-unlocked"
                    onClick={() => onPlayClass(unlockedClass.id)}
                    className="px-5 py-2.5 bg-[#b83232] hover:bg-[#cf3a3a] text-[#faf6ef] font-display font-bold text-xs tracking-[0.14em] uppercase border border-[#e3b55c]/55 transition-colors cursor-pointer"
                  >
                    Jogar como {unlockedClass.name}
                  </button>
                  <button
                    type="button"
                    data-testid="secret-view-classes"
                    onClick={() => onOpenClasses(unlockedClass.id)}
                    className="px-4 py-2.5 bg-[#1b1726] hover:bg-[#262035] text-[#f3e3be] text-xs font-medium border border-[#d4a64a]/45 transition-colors cursor-pointer"
                  >
                    Ver em Classes
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Code Redemption Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <label
              htmlFor="secret-code-field"
              className="block text-xs font-semibold uppercase tracking-wider text-[#b8afa1]"
            >
              Código Secreto
            </label>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                ref={inputRef}
                id="secret-code-field"
                data-testid="secret-code-input"
                type="text"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                placeholder="Digite o código aqui..."
                autoComplete="off"
                spellCheck={false}
                maxLength={48}
                className="flex-1 px-3.5 py-2.5 bg-[#0e0c14] border border-[#d4a64a]/35 focus:border-[#f59e0b] focus:outline-none text-sm font-mono-num text-[#f8f3e8] placeholder:text-[#6f675d]"
              />
              <button
                type="submit"
                data-testid="secret-code-submit"
                className="px-5 py-2.5 bg-[#241c13] hover:bg-[#332719] text-[#f8e3a8] font-display font-bold text-xs tracking-[0.14em] uppercase border border-[#d4a64a]/65 transition-colors cursor-pointer whitespace-nowrap"
              >
                Resgatar
              </button>
            </div>
          </form>

          {/* Previously Redeemed Summary */}
          {redeemedCodes.length > 0 && (
            <div className="pt-3 border-t border-white/10">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#9c9487] mb-2">
                Códigos Resgatados ({redeemedCodes.length})
              </div>
              <div className="space-y-1.5">
                {redeemedCodes.map((code) => {
                  const def = SECRET_CODES.find((c) => c.code === code);
                  return (
                    <div
                      key={code}
                      className="flex items-center justify-between px-3 py-2 bg-[#121018] border border-white/10 text-xs"
                    >
                      <span className="font-mono-num text-[#f3e3be]">{code}</span>
                      <span className="text-[#9c9487]">
                        {def ? `${def.subtitle}: ${def.title}` : 'Recompensa resgatada'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
