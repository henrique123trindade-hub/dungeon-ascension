import { useState } from 'react';
import { ACHIEVEMENTS } from '../game/data/achievements';
import { BOSSES } from '../game/data/bosses';
import { CLASSES } from '../game/data/classes';
import { ENEMY_LIST } from '../game/data/enemies';
import type { SaveData } from '../game/types';
import { CrystalIcon } from './Icons';

interface CodexModalProps {
  save: SaveData;
  onClaimAchievement: (achievementId: string) => void;
  onClose: () => void;
}

export function CodexModal({ save, onClaimAchievement, onClose }: CodexModalProps) {
  const [tab, setTab] = useState<'bestiary' | 'achievements' | 'records'>('bestiary');

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/82 p-4 sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Códice da Masmorra"
        className="dark-panel animate-modal-enter w-full max-w-5xl h-[86vh] flex flex-col overflow-hidden"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-[#d4a64a]/20">
          <div className="flex items-center gap-2">
            <CodexTab active={tab === 'bestiary'} onClick={() => setTab('bestiary')}>
              Bestiário
            </CodexTab>
            <CodexTab active={tab === 'achievements'} onClick={() => setTab('achievements')}>
              Conquistas ({save.unlockedAchievements.length}/{ACHIEVEMENTS.length})
            </CodexTab>
            <CodexTab active={tab === 'records'} onClick={() => setTab('records')}>
              Histórico de Recordes
            </CodexTab>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-sm text-[#c7bfb2] hover:text-white border border-white/15 cursor-pointer"
          >
            Fechar
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scroll p-6">
          {tab === 'bestiary' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#9c9487] mb-3">
                  Criaturas da Masmorra
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {ENEMY_LIST.map((en) => {
                    const kills = save.bestiaryKills[en.id] ?? 0;
                    return (
                      <div key={en.id} className="p-4 bg-[#121018] border border-white/10">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-display font-bold text-base text-[#f4efe6]">{en.name}</span>
                          <span className="font-mono-num text-xs text-[#d4a64a]">Abates: {kills}</span>
                        </div>
                        <div className="text-xs text-[#9c9487] mt-0.5">
                          {en.role} · A partir do Andar {en.minFloor}
                        </div>
                        <p className="text-xs text-[#c7bfb2] mt-2 leading-relaxed">{en.lore}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#9c9487] mb-3">
                  Chefes e Senhores Ancestrais
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {BOSSES.map((b) => {
                    const kills = save.bestiaryKills[b.id] ?? 0;
                    return (
                      <div
                        key={b.id}
                        className={`p-4 border ${
                          b.isMegaBoss ? 'bg-[#1b1224] border-[#d4a64a]/50' : 'bg-[#121018] border-white/12'
                        }`}
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-display font-bold text-base text-[#f8e3a8]">
                            {b.name} {b.isMegaBoss ? '· Ancestral' : ''}
                          </span>
                          <span className="font-mono-num text-xs text-[#c084fc]">
                            Andar {b.floorMilestone} · Abates: {kills}
                          </span>
                        </div>
                        <div className="text-xs text-[#9c9487] mt-0.5">{b.title}</div>
                        <p className="text-xs text-[#c7bfb2] mt-2 leading-relaxed">{b.lore}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {tab === 'achievements' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {ACHIEVEMENTS.map((ach) => {
                const st = ach.check(save);
                const claimed = save.claimedAchievements.includes(ach.id);
                const canClaim = st.done && !claimed;

                return (
                  <div
                    key={ach.id}
                    className={`p-4 border flex flex-col justify-between gap-3 ${
                      claimed
                        ? 'bg-[#111512] border-[#4ade80]/30'
                        : st.done
                          ? 'bg-[#1d1726] border-[#d4a64a]/70'
                          : 'bg-[#121018] border-white/10'
                    }`}
                  >
                    <div>
                      <div className="flex items-baseline justify-between gap-2">
                        <h4 className="font-display font-bold text-sm text-[#f4efe6]">{ach.name}</h4>
                        <span className="font-mono-num text-xs text-[#c084fc] inline-flex items-center gap-1">
                          <CrystalIcon className="w-3.5 h-3.5" />+{ach.rewardCrystals}
                        </span>
                      </div>
                      <p className="text-xs text-[#b8afa1] mt-1">{ach.description}</p>
                      <div className="mt-2.5 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-[#09080c] overflow-hidden">
                          <div
                            className="h-full bg-[#d4a64a]"
                            style={{ width: `${Math.min(100, (st.progress / Math.max(1, st.target)) * 100)}%` }}
                          />
                        </div>
                        <span className="font-mono-num text-[11px] text-[#9c9487]">
                          {st.progress}/{st.target}
                        </span>
                      </div>
                    </div>

                    {canClaim ? (
                      <button
                        type="button"
                        onClick={() => onClaimAchievement(ach.id)}
                        className="w-full py-1.5 px-3 bg-[#d4a64a] hover:bg-[#e5ba62] text-[#0b0a0e] font-semibold text-xs uppercase tracking-wider cursor-pointer"
                      >
                        Resgatar {ach.rewardCrystals} Cristais
                      </button>
                    ) : (
                      <div className="text-[11px] font-mono-num text-[#9c9487]">
                        {claimed ? 'Recompensa resgatada' : 'Em andamento'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'records' && (
            <div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <RecordSummary label="Melhor Andar" value={save.bestFloor > 0 ? `Andar ${save.bestFloor}` : '—'} />
                <RecordSummary label="Maior Nível" value={`Nível ${save.bestLevel}`} />
                <RecordSummary label="Total de Abates" value={`${save.totalKills}`} />
                <RecordSummary label="Chefes Derrotados" value={`${save.totalBossKills}`} />
              </div>

              {save.records.length === 0 ? (
                <div className="p-8 bg-[#121018] border border-white/10 text-center text-sm text-[#9c9487]">
                  Nenhuma expedição concluída ainda. Entre na masmorra para registrar seu primeiro recorde.
                </div>
              ) : (
                <div className="overflow-x-auto border border-white/10">
                  <table className="w-full text-left text-xs font-mono-num">
                    <thead className="bg-[#17141f] text-[#9c9487] uppercase">
                      <tr>
                        <th className="py-2.5 px-3 font-sans">Classe</th>
                        <th className="py-2.5 px-3">Andar</th>
                        <th className="py-2.5 px-3">Nível</th>
                        <th className="py-2.5 px-3">Abates</th>
                        <th className="py-2.5 px-3">Chefes</th>
                        <th className="py-2.5 px-3">Cristais</th>
                        <th className="py-2.5 px-3">Tempo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 bg-[#110f16]">
                      {save.records.map((rec) => (
                        <tr key={rec.id} className="hover:bg-[#191622]">
                          <td className="py-2.5 px-3 font-sans font-medium text-[#f4efe6]">
                            {CLASSES[rec.classId]?.name ?? rec.classId}
                          </td>
                          <td className="py-2.5 px-3 text-[#f8e3a8]">{rec.floor}</td>
                          <td className="py-2.5 px-3">{rec.level}</td>
                          <td className="py-2.5 px-3">{rec.kills}</td>
                          <td className="py-2.5 px-3">{rec.bossesKilled}</td>
                          <td className="py-2.5 px-3 text-[#c084fc]">+{rec.crystalsEarned}</td>
                          <td className="py-2.5 px-3 text-[#9c9487]">
                            {Math.floor(rec.durationSec / 60)}m {rec.durationSec % 60}s
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CodexTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3.5 py-2 text-xs sm:text-sm font-medium border transition-colors cursor-pointer whitespace-nowrap ${
        active
          ? 'bg-[#221c2d] text-[#f8e3a8] border-[#d4a64a]/70'
          : 'bg-[#110f16] text-[#9c9487] border-white/10 hover:text-[#e8e3d9]'
      }`}
    >
      {children}
    </button>
  );
}

function RecordSummary({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3.5 bg-[#121018] border border-white/10">
      <div className="text-xs text-[#9c9487]">{label}</div>
      <div className="font-mono-num text-lg font-bold text-[#f8e3a8] mt-1">{value}</div>
    </div>
  );
}
