import { useState } from 'react';
import { getPermanentUpgradeCost, PERMANENT_UPGRADES } from '../game/data/achievements';
import { getAscensionMultiplier } from '../game/systems/balance';
import { canPerformAscension, getAscensionRequirementFloor } from '../game/systems/saveManager';
import type { PermanentUpgrades, SaveData } from '../game/types';
import { CrystalIcon } from './Icons';

interface SanctuaryModalProps {
  save: SaveData;
  onBuyUpgrade: (key: keyof PermanentUpgrades) => void;
  onAscend: () => void;
  onClose: () => void;
}

export function SanctuaryModal({ save, onBuyUpgrade, onAscend, onClose }: SanctuaryModalProps) {
  const [confirmAscend, setConfirmAscend] = useState(false);
  const reqFloor = getAscensionRequirementFloor(save.ascensionLevel);
  const canAscend = canPerformAscension(save);
  const curAscBonus = getAscensionMultiplier(save.ascensionLevel);
  const nextAscBonus = getAscensionMultiplier(save.ascensionLevel + 1);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/84 p-4 sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Santuário de Progressão Permanente"
        className="relative dark-panel animate-modal-enter w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Atmospheric Sanctuary Header Banner */}
        <div className="relative h-28 sm:h-32 shrink-0 overflow-hidden border-b border-[#c084fc]/30">
          <img
            src="/src/assets/images/sanctuary_bg_1795609213765.jpg"
            alt="Altar de cristais do Santuário"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover object-center"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, rgba(11,10,14,0.45) 0%, rgba(11,10,14,0.88) 100%)',
            }}
          />
          <div className="absolute inset-0 px-6 py-3.5 flex items-end justify-between gap-4">
            <div>
              <div className="text-xs font-mono-num text-[#c084fc] uppercase tracking-widest">
                Progressão Permanente · Ascensão {save.ascensionLevel}
              </div>
              <h2 className="font-display text-2xl font-bold text-[#faf5eb] mt-0.5">
                Santuário dos Cristais
              </h2>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right font-mono-num">
                <div className="text-[11px] text-[#b8afa1]">Cristais Disponíveis</div>
                <div className="text-lg font-bold text-[#d8b4fe] inline-flex items-center gap-1.5">
                  <CrystalIcon className="w-4 h-4" />
                  {save.crystals}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-sm text-[#e8e3d9] bg-[#121018]/90 hover:bg-[#221d2d] border border-white/20 cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>

        {/* Upgrades + Ascension Body */}
        <div className="flex-1 overflow-y-auto custom-scroll p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {PERMANENT_UPGRADES.map((upg) => {
              const lv = save.permanentUpgrades[upg.key];
              const isMax = lv >= upg.maxLevel;
              const cost = getPermanentUpgradeCost(upg, lv);
              const canAfford = save.crystals >= cost && !isMax;

              return (
                <div
                  key={upg.key}
                  className="p-4 bg-[#121018] border border-white/12 flex flex-col justify-between gap-3"
                >
                  <div>
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="font-display font-bold text-base text-[#f8e3a8]">{upg.name}</h3>
                      <span className="font-mono-num text-xs text-[#c084fc]">
                        Nv.{lv}/{upg.maxLevel}
                      </span>
                    </div>
                    <p className="text-xs text-[#b8afa1] mt-1 leading-relaxed">{upg.description}</p>
                    <div className="text-xs font-mono-num text-[#4ade80] mt-2">{upg.bonusPerLevelLabel}</div>
                  </div>

                  <button
                    type="button"
                    disabled={!canAfford}
                    onClick={() => onBuyUpgrade(upg.key)}
                    className="w-full py-2 px-3 text-xs font-mono-num font-semibold border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed bg-[#1e172b] hover:bg-[#2c2042] text-[#e9d5ff] border-[#c084fc]/45"
                  >
                    {isMax ? 'Nível Máximo' : `Aprimorar · ${cost} Cristais`}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Ascension (Rebirth) Panel */}
          <div className="p-5 bg-[#191124] border border-[#d4a64a]/45 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="max-w-2xl">
              <div className="text-xs font-mono-num text-[#d4a64a] uppercase tracking-wider">
                Sistema de Renascimento · Ascensão Atual: {save.ascensionLevel}
              </div>
              <h3 className="font-display text-xl font-bold text-[#faf5eb] mt-1">
                Ritual de Ascensão
              </h3>
              <p className="text-sm text-[#c7bfb2] mt-1 leading-relaxed">
                Reinicia os níveis de melhoria do Santuário em troca de um salto permanente de poder global, sorte mítica e ganho de cristais.
                Bônus atual: <span className="font-mono-num text-[#f8e3a8]">×{curAscBonus.powerMult.toFixed(1)} Poder</span> ·{' '}
                <span className="font-mono-num text-[#c084fc]">×{curAscBonus.crystalXpMult.toFixed(1)} EXP/Cristais</span>.
                Próximo nível: <span className="font-mono-num text-[#4ade80]">×{nextAscBonus.powerMult.toFixed(1)} Poder</span> e{' '}
                <span className="font-mono-num text-[#4ade80]">+{120 + save.ascensionLevel * 80} Cristais imediatos</span>.
              </p>
              {!canAscend && (
                <p className="text-xs font-mono-num text-[#fca5a5] mt-2">
                  Requisito: alcançar o Andar {reqFloor} (Melhor atual: Andar {save.bestFloor}).
                </p>
              )}
            </div>

            <div className="shrink-0">
              {!confirmAscend ? (
                <button
                  type="button"
                  disabled={!canAscend}
                  onClick={() => setConfirmAscend(true)}
                  className="px-5 py-3 bg-[#d4a64a] hover:bg-[#e5ba62] disabled:opacity-35 disabled:cursor-not-allowed text-[#0b0a0e] font-display font-bold text-sm uppercase tracking-wider cursor-pointer whitespace-nowrap"
                >
                  Realizar Ascensão
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmAscend(false)}
                    className="px-3 py-2.5 text-xs text-[#c7bfb2] border border-white/20 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmAscend(false);
                      onAscend();
                    }}
                    className="px-4 py-2.5 bg-[#b83232] hover:bg-[#cf3a3a] text-white font-display font-bold text-xs uppercase tracking-wider border border-[#f8e3a8]/50 cursor-pointer"
                  >
                    Confirmar Ascensão
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
