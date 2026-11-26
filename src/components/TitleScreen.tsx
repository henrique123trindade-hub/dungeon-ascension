import { useEffect } from 'react';
import { CLASSES } from '../game/data/classes';
import type { SaveData } from '../game/types';
import { ClassIcon, CrystalIcon, DungeonTitleCrest, SecretKeyIcon } from './Icons';

interface TitleScreenProps {
  save: SaveData;
  onStartRun: () => void;
  onOpenClassSelect: () => void;
  onOpenSanctuary: () => void;
  onOpenCodex: () => void;
  onOpenRedeemCode: () => void;
  onOpenSettings: () => void;
  hasModalOpen: boolean;
}

export function TitleScreen({
  save,
  onStartRun,
  onOpenClassSelect,
  onOpenSanctuary,
  onOpenCodex,
  onOpenRedeemCode,
  onOpenSettings,
  hasModalOpen,
}: TitleScreenProps) {
  const selectedClass = CLASSES[save.selectedClass];

  // Start-handshake: Enter or Space launches the game directly when no sub-modal is open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (hasModalOpen) return;
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        onStartRun();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hasModalOpen, onStartRun]);

  return (
    <main className="fixed inset-0 z-20 flex flex-col justify-between bg-[#0b0a0e] overflow-hidden">
      {/* Illustrated Dark Fantasy Key-Art Backdrop */}
      <div className="absolute inset-0">
        <img
          src="/src/assets/images/title_bg_1795609213837.jpg"
          alt="Arco monumental da masmorra subterrânea"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover object-center"
        />
        {/* Measured atmospheric scrim keeping left 40% calm for crisp legibility */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, rgba(9,8,12,0.92) 0%, rgba(9,8,12,0.78) 38%, rgba(9,8,12,0.28) 72%, rgba(9,8,12,0.45) 100%)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(180deg, rgba(9,8,12,0.45) 0%, transparent 25%, rgba(9,8,12,0.88) 100%)',
          }}
        />
      </div>

      {/* Top safe margin: quiet meta summary (zero pills, unboxed typography) */}
      <div className="relative z-10 flex items-center justify-between px-6 sm:px-12 pt-6 text-xs text-[#b8afa1]">
        <div className="flex items-center gap-3 font-mono-num">
          <span className="flex items-center gap-1.5 text-[#c084fc]">
            <CrystalIcon className="w-3.5 h-3.5" />
            <span>{save.crystals} Cristais</span>
          </span>
          <span aria-hidden="true">·</span>
          <span>Melhor Andar: {save.bestFloor > 0 ? save.bestFloor : '—'}</span>
          {save.ascensionLevel > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-[#d4a64a]">Ascensão {save.ascensionLevel}</span>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Configurações"
          className="px-3 py-1.5 text-xs font-medium text-[#d6cfc2] hover:text-[#f8e3a8] transition-colors cursor-pointer"
        >
          Configurações
        </button>
      </div>

      {/* Left-third negative space composition: Title Crest + Primary Action */}
      <div className="relative z-10 flex-1 flex items-center px-6 sm:px-12 lg:px-16">
        <div className="w-full max-w-[440px] flex flex-col items-start">
          <DungeonTitleCrest />

          {/* Active class summary line (clean inline text + selector button) */}
          <div className="mt-5 flex items-center gap-3 text-sm text-[#c7bfb2]">
            <span style={{ color: selectedClass.accentColor }}>
              <ClassIcon classId={selectedClass.id} className="w-5 h-5" />
            </span>
            <span className="font-medium text-[#e8e3d9]">{selectedClass.name}</span>
            <span aria-hidden="true" className="text-[#6d655b]">
              ·
            </span>
            <span className="text-[#9c9487]">{selectedClass.archetype}</span>
          </div>

          {/* Primary Start CTA + 3 Secondary Game Actions */}
          <div className="mt-7 w-full max-w-[330px] flex flex-col gap-3">
            <button
              type="button"
              data-start="true"
              onClick={onStartRun}
              className="w-full py-3.5 px-6 bg-[#b83232] hover:bg-[#cf3a3a] active:scale-[0.99] text-[#faf6ef] font-display font-bold text-base tracking-[0.14em] uppercase border border-[#e3b55c]/50 shadow-[0_10px_30px_rgba(184,50,50,0.45)] transition-all duration-150 cursor-pointer whitespace-nowrap"
            >
              Entrar na Masmorra
            </button>

            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={onOpenClassSelect}
                className="py-2.5 px-3 bg-[#15131c]/90 hover:bg-[#211d2b] text-[#e8e3d9] text-sm font-medium border border-[#d4a64a]/30 hover:border-[#d4a64a]/65 transition-colors cursor-pointer whitespace-nowrap"
              >
                Classes
              </button>
              <button
                type="button"
                onClick={onOpenSanctuary}
                className="py-2.5 px-3 bg-[#15131c]/90 hover:bg-[#211d2b] text-[#e8e3d9] text-sm font-medium border border-[#c084fc]/30 hover:border-[#c084fc]/65 transition-colors cursor-pointer whitespace-nowrap"
              >
                Santuário
              </button>
              <button
                type="button"
                onClick={onOpenCodex}
                className="py-2.5 px-3 bg-[#15131c]/90 hover:bg-[#211d2b] text-[#e8e3d9] text-sm font-medium border border-[#9c9487]/30 hover:border-[#d4a64a]/55 transition-colors cursor-pointer whitespace-nowrap"
              >
                Códice
              </button>
            </div>

            <button
              type="button"
              data-testid="menu-redeem-code"
              onClick={onOpenRedeemCode}
              className="w-full py-2.5 px-4 bg-[#14111a]/92 hover:bg-[#1f1a28] text-[#e8d5a8] hover:text-[#fef08a] text-xs font-medium tracking-wider uppercase border border-[#d4a64a]/30 hover:border-[#f59e0b]/65 transition-colors cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <SecretKeyIcon className="w-4 h-4 text-[#f59e0b]" />
              <span>Resgatar código</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom safe margin: Single flat borderless control-hint line */}
      <footer className="relative z-10 px-6 sm:px-12 pb-6">
        <p className="text-xs text-[#9c9487] tracking-wide">
          WASD Mover · Mouse Atacar · Espaço Esquiva · Q E R F Habilidades · I Inventário · Esc Pausa
        </p>
      </footer>
    </main>
  );
}
