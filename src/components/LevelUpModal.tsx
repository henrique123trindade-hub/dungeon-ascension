import { useEffect } from 'react';
import { SKILLS } from '../game/data/skills';
import { RARITY_META } from '../game/systems/balance';
import type { UpgradeOption } from '../game/types';
import { SkillIcon } from './Icons';

interface LevelUpModalProps {
  level: number;
  luck: number;
  options: UpgradeOption[];
  onChoose: (option: UpgradeOption) => void;
}

export function LevelUpModal({ level, luck, options, onChoose }: LevelUpModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Digit1' && options[0]) onChoose(options[0]);
      if (e.code === 'Digit2' && options[1]) onChoose(options[1]);
      if (e.code === 'Digit3' && options[2]) onChoose(options[2]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [options, onChoose]);

  const hasMythicOrLegendary = options.some((o) => o.rarity === 'mythic' || o.rarity === 'legendary');

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/82 p-4 sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Subiu de Nível"
        className="w-full max-w-4xl flex flex-col items-center animate-modal-enter"
      >
        <div className="text-center mb-6">
          <div className="font-mono-num text-xs tracking-[0.25em] uppercase text-[#d4a64a]">
            Nível {level} Alcançado · Sorte {luck}
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#faf5eb] mt-1 tracking-wide">
            Escolha sua Ascensão
          </h2>
          {hasMythicOrLegendary && (
            <p className="text-xs font-semibold text-[#f59e0b] mt-1.5 tracking-wide">
              Relíquia de raridade superior manifestada nesta evolução
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
          {options.map((opt, idx) => {
            const meta = RARITY_META[opt.rarity];
            const isSpecial = opt.rarity === 'legendary' || opt.rarity === 'mythic';
            const skillDef = opt.skillId ? SKILLS[opt.skillId] : null;

            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onChoose(opt)}
                className="group relative text-left p-5 flex flex-col justify-between transition-transform duration-150 hover:-translate-y-1 cursor-pointer animate-rarity-burst"
                style={{
                  backgroundColor: meta.bg,
                  border: `${isSpecial ? '2px' : '1px'} solid ${meta.border}`,
                  boxShadow: isSpecial
                    ? `0 18px 42px rgba(0,0,0,0.85), 0 0 28px ${meta.color}40`
                    : '0 14px 30px rgba(0,0,0,0.75)',
                  animationDelay: `${idx * 70}ms`,
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
                          <path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.9L12 16.5 6.8 19.2l1-5.9-4.3-4.1 5.9-.9L12 3z" fill="currentColor" fillOpacity="0.25" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.9">
                          <path d="M12 19V5m0 0l-5 5m5-5l5 5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-display font-bold text-base text-[#faf5eb] leading-snug">
                        {opt.title}
                      </div>
                      <div className="text-xs text-[#b8afa1] mt-0.5">{opt.subtitle}</div>
                    </div>
                  </div>

                  <p className="mt-4 text-sm text-[#ddd6c9] leading-relaxed">{opt.description}</p>

                  {opt.synergyHint && (
                    <div className="mt-3 pt-2.5 border-t border-white/10 text-xs font-semibold text-[#e9d5ff]">
                      {opt.synergyHint}
                    </div>
                  )}
                </div>

                <div
                  className="mt-5 pt-3 border-t border-white/10 text-xs font-display font-bold tracking-wider uppercase text-center group-hover:text-white transition-colors"
                  style={{ color: meta.color }}
                >
                  Selecionar Melhoria
                </div>
              </button>
            );
          })}
        </div>

        <p className="mt-4 text-xs text-[#9c9487]">
          Clique em uma carta ou pressione 1, 2 ou 3 para escolher imediatamente.
        </p>
      </div>
    </div>
  );
}
