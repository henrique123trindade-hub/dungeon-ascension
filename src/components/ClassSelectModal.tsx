import { CLASS_LIST, CLASSES } from '../game/data/classes';
import { SKILLS } from '../game/data/skills';
import type { ClassId } from '../game/types';
import { ClassIcon, SkillIcon } from './Icons';

interface ClassSelectModalProps {
  selectedClass: ClassId;
  onSelectClass: (id: ClassId) => void;
  onStartWithClass: (id: ClassId) => void;
  onClose: () => void;
}

export function ClassSelectModal({
  selectedClass,
  onSelectClass,
  onStartWithClass,
  onClose,
}: ClassSelectModalProps) {
  const active = CLASSES[selectedClass];

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4 sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Seleção de Classe"
        className="dark-panel animate-modal-enter w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#d4a64a]/20">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#f3e3be] tracking-wider">
              Escolha sua Classe
            </h2>
            <p className="text-xs text-[#9c9487] mt-0.5">
              Cada classe possui estilo de combate próprio, habilidades iniciais e evoluções nos níveis 25, 50 e 100.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar seleção de classe"
            className="px-3 py-1.5 text-sm text-[#b8afa1] hover:text-white border border-white/15 hover:border-white/35 transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scroll p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Class selector column */}
          <div className="lg:col-span-5 flex flex-col gap-2.5">
            {CLASS_LIST.map((cls) => {
              const isSelected = cls.id === selectedClass;
              return (
                <button
                  key={cls.id}
                  type="button"
                  onClick={() => onSelectClass(cls.id)}
                  className={`w-full text-left p-4 border transition-colors cursor-pointer flex items-center gap-4 ${
                    isSelected
                      ? 'bg-[#211c2b] border-[#d4a64a]/80'
                      : 'bg-[#131118] border-white/10 hover:border-white/25'
                  }`}
                >
                  <div
                    className="w-11 h-11 flex items-center justify-center border border-white/15 bg-[#0c0b10] shrink-0"
                    style={{ color: cls.accentColor }}
                  >
                    <ClassIcon classId={cls.id} className="w-6 h-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-display font-bold text-base text-[#f4efe6]">{cls.name}</span>
                      <span className="text-xs text-[#9c9487] truncate">{cls.weaponName}</span>
                    </div>
                    <p className="text-xs text-[#9c9487] mt-0.5">{cls.archetype}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Class detailed sheet */}
          <div className="lg:col-span-7 flex flex-col justify-between bg-[#110f16] border border-white/10 p-6">
            <div>
              <div className="flex items-center gap-4 pb-4 border-b border-white/10">
                <div
                  className="w-14 h-14 flex items-center justify-center border border-[#d4a64a]/40 bg-[#181520]"
                  style={{ color: active.accentColor }}
                >
                  <ClassIcon classId={active.id} className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="font-display text-2xl font-bold text-[#f8e3a8]">{active.name}</h3>
                  <p className="text-xs text-[#b8afa1] mt-0.5">
                    {active.archetype} · Arma Inicial: {active.weaponName}
                  </p>
                </div>
              </div>

              <p className="text-sm text-[#d6cfc2] leading-relaxed mt-4">{active.description}</p>

              {/* Base Attributes */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
                <StatBox label="Vida Base" value={`${active.baseStats.maxHp}`} />
                <StatBox label="Dano Base" value={`${active.baseStats.damage}`} />
                <StatBox label="Vel. Ataque" value={`${active.baseStats.attackSpeed.toFixed(2)}/s`} />
                <StatBox label="Crítico" value={`${Math.round(active.baseStats.critChance * 100)}%`} />
                <StatBox label="Dano Crítico" value={`${Math.round(active.baseStats.critDamage * 100)}%`} />
                <StatBox label="Armadura" value={`${active.baseStats.armor}`} />
                <StatBox label="Esquiva" value={`${Math.round(active.baseStats.dodge * 100)}%`} />
                <StatBox label="Velocidade" value={`${active.baseStats.moveSpeed}`} />
              </div>

              {/* Starting Skills */}
              <div className="mt-5">
                <h4 className="text-xs font-semibold text-[#9c9487] tracking-wider uppercase mb-2.5">
                  Habilidades Iniciais
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {active.startingSkills.map((sid) => {
                    const sk = SKILLS[sid];
                    return (
                      <div key={sid} className="p-3 bg-[#17151f] border border-white/10 flex items-start gap-3">
                        <span className="mt-0.5 shrink-0" style={{ color: sk.color }}>
                          <SkillIcon skillId={sid} className="w-5 h-5" />
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-[#f4efe6]">{sk.name}</div>
                          <div className="text-xs text-[#9c9487] mt-0.5">{sk.description}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Class Evolution Path */}
              <div className="mt-5">
                <h4 className="text-xs font-semibold text-[#9c9487] tracking-wider uppercase mb-2.5">
                  Evoluções de Classe
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {active.evolutions.map((evo) => (
                    <div key={evo.level} className="p-3 bg-[#17151f] border border-[#d4a64a]/20">
                      <div className="text-xs font-mono-num text-[#d4a64a]">Nível {evo.level}</div>
                      <div className="font-display text-sm font-bold text-[#f4efe6] mt-0.5">{evo.title}</div>
                      <div className="text-xs text-[#9c9487] mt-1">{evo.bonusDesc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-sm text-[#c7bfb2] hover:text-white border border-white/15 cursor-pointer"
              >
                Confirmar e Voltar
              </button>
              <button
                type="button"
                onClick={() => onStartWithClass(active.id)}
                className="px-6 py-2.5 bg-[#b83232] hover:bg-[#cf3a3a] text-[#faf6ef] font-display font-bold text-sm tracking-wider uppercase border border-[#e3b55c]/50 transition-colors cursor-pointer whitespace-nowrap"
              >
                Jogar como {active.name}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2.5 bg-[#17151f] border border-white/10">
      <div className="text-[11px] text-[#9c9487]">{label}</div>
      <div className="font-mono-num text-sm font-semibold text-[#f4efe6] mt-0.5">{value}</div>
    </div>
  );
}
