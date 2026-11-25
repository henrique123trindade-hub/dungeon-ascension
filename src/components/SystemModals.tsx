import { useState } from 'react';
import { CLASSES } from '../game/data/classes';
import { SYNERGIES } from '../game/data/skills';
import type { RunSummarySnapshot, SettingsData } from '../game/types';
import { CrystalIcon } from './Icons';

interface PauseModalProps {
  floor: number;
  biomeName: string;
  level: number;
  kills: number;
  onResume: () => void;
  onRestart: () => void;
  onOpenSettings: () => void;
  onReturnTitle: () => void;
}

export function PauseModal({
  floor,
  biomeName,
  level,
  kills,
  onResume,
  onRestart,
  onOpenSettings,
  onReturnTitle,
}: PauseModalProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Jogo Pausado"
        className="dark-panel animate-modal-enter w-full max-w-md p-6"
      >
        <div className="text-xs font-mono-num uppercase tracking-widest text-[#d4a64a]">
          Expedição Pausada
        </div>
        <h2 className="font-display text-2xl font-bold text-[#faf5eb] mt-1">Pausa</h2>
        <p className="text-xs text-[#9c9487] mt-1">
          Andar {floor} · {biomeName}
        </p>

        <div className="grid grid-cols-3 gap-2.5 mt-5">
          <MiniStat label="Andar" value={`${floor}`} />
          <MiniStat label="Nível" value={`${level}`} />
          <MiniStat label="Abates" value={`${kills}`} />
        </div>

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="w-full py-3 px-4 bg-[#b83232] hover:bg-[#cf3a3a] text-white font-display font-bold text-sm uppercase tracking-wider border border-[#e3b55c]/50 cursor-pointer"
          >
            Continuar
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="w-full py-2.5 px-4 bg-[#181522] hover:bg-[#231f30] text-[#f4efe6] text-sm font-medium border border-white/15 cursor-pointer"
          >
            Reiniciar Expedição
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="w-full py-2.5 px-4 bg-[#181522] hover:bg-[#231f30] text-[#f4efe6] text-sm font-medium border border-white/15 cursor-pointer"
          >
            Configurações
          </button>
          <button
            type="button"
            onClick={onReturnTitle}
            className="w-full py-2.5 px-4 bg-[#121018] hover:bg-[#1e1a28] text-[#b8afa1] hover:text-white text-sm border border-white/10 cursor-pointer"
          >
            Menu Principal
          </button>
        </div>
      </div>
    </div>
  );
}

interface GameOverModalProps {
  summary: RunSummarySnapshot;
  bestFloor: number;
  onRetry: () => void;
  onOpenSanctuary: () => void;
  onReturnTitle: () => void;
}

export function GameOverModal({
  summary,
  bestFloor,
  onRetry,
  onOpenSanctuary,
  onReturnTitle,
}: GameOverModalProps) {
  const cls = CLASSES[summary.classId];

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/84 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Fim da Expedição"
        className="dark-panel animate-modal-enter w-full max-w-lg p-6 sm:p-7"
      >
        <div className="text-xs font-mono-num uppercase tracking-widest text-[#ef4444]">
          Você Tombou na Masmorra
        </div>
        <h2 className="font-display text-3xl font-bold text-[#faf5eb] mt-1">Fim da Expedição</h2>
        <p className="text-sm text-[#b8afa1] mt-1">
          {summary.evolutionTitle} ({cls.name}) · Andar {summary.floor} ({summary.biomeName})
        </p>

        {summary.isNewFloorRecord && (
          <div className="mt-3 px-3 py-1.5 bg-[#261c10] border border-[#d4a64a]/65 text-xs font-mono-num text-[#f8e3a8]">
            Novo Recorde Pessoal de Andar!
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-5">
          <MiniStat label="Andar Alcançado" value={`${summary.floor} / Rec. ${Math.max(bestFloor, summary.floor)}`} />
          <MiniStat label="Nível Final" value={`${summary.level}`} />
          <MiniStat label="Inimigos Abatidos" value={`${summary.kills}`} />
          <MiniStat label="Chefes Derrotados" value={`${summary.bossesKilled}`} />
          <MiniStat
            label="Duração"
            value={`${Math.floor(summary.durationSec / 60)}m ${summary.durationSec % 60}s`}
          />
          <div className="p-3 bg-[#1a1326] border border-[#c084fc]/40">
            <div className="text-[11px] text-[#c084fc]">Cristais Mantidos</div>
            <div className="font-mono-num text-base font-bold text-[#e9d5ff] mt-0.5 inline-flex items-center gap-1">
              <CrystalIcon className="w-4 h-4" />+{summary.crystalsEarned}
            </div>
          </div>
        </div>

        {summary.bossRemainingPct !== null && (
          <div className="mt-3 text-xs font-mono-num text-[#fca5a5]">
            Vida restante do Chefe ao cair: {summary.bossRemainingPct}%
          </div>
        )}

        {summary.activeSynergies.length > 0 && (
          <div className="mt-3 text-xs text-[#c7bfb2]">
            Sinergias ativas:{' '}
            <span className="text-[#e9d5ff]">
              {summary.activeSynergies
                .map((id) => SYNERGIES.find((s) => s.id === id)?.name ?? id)
                .join(' · ')}
            </span>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            data-start="true"
            onClick={onRetry}
            className="w-full py-3 px-4 bg-[#b83232] hover:bg-[#cf3a3a] text-white font-display font-bold text-sm uppercase tracking-wider border border-[#e3b55c]/55 cursor-pointer"
          >
            Tentar Novamente
          </button>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onOpenSanctuary}
              className="py-2.5 px-4 bg-[#1c1528] hover:bg-[#2a1f3d] text-[#e9d5ff] text-sm font-medium border border-[#c084fc]/40 cursor-pointer"
            >
              Santuário
            </button>
            <button
              type="button"
              onClick={onReturnTitle}
              className="py-2.5 px-4 bg-[#14121b] hover:bg-[#1f1c29] text-[#c7bfb2] hover:text-white text-sm font-medium border border-white/15 cursor-pointer"
            >
              Menu Principal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface SettingsModalProps {
  settings: SettingsData;
  onUpdate: (next: SettingsData) => void;
  onResetSave: () => void;
  onClose: () => void;
}

export function SettingsModal({ settings, onUpdate, onResetSave, onClose }: SettingsModalProps) {
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/82 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Configurações"
        className="dark-panel animate-modal-enter w-full max-w-lg p-6"
      >
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <h2 className="font-display text-xl font-bold text-[#f8e3a8]">Configurações</h2>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-[#c7bfb2] hover:text-white border border-white/15 cursor-pointer"
          >
            Fechar
          </button>
        </div>

        <div className="mt-5 space-y-4 text-sm">
          <div>
            <div className="flex justify-between text-xs text-[#c7bfb2] mb-1.5">
              <label htmlFor="vol-master">Volume Geral</label>
              <span className="font-mono-num">{Math.round(settings.masterVolume * 100)}%</span>
            </div>
            <input
              id="vol-master"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.masterVolume}
              onChange={(e) => onUpdate({ ...settings, masterVolume: Number(e.target.value) })}
              className="w-full accent-[#d4a64a]"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs text-[#c7bfb2] mb-1.5">
              <label htmlFor="vol-sfx">Efeitos Sonoros</label>
              <span className="font-mono-num">{Math.round(settings.sfxVolume * 100)}%</span>
            </div>
            <input
              id="vol-sfx"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.sfxVolume}
              onChange={(e) => onUpdate({ ...settings, sfxVolume: Number(e.target.value) })}
              className="w-full accent-[#d4a64a]"
            />
          </div>

          <div className="flex items-center justify-between py-2 border-t border-white/10">
            <span className="text-[#d6cfc2]">Qualidade Gráfica</span>
            <div className="flex gap-1.5">
              {(['low', 'medium', 'high'] as const).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => onUpdate({ ...settings, graphicsQuality: q })}
                  className={`px-3 py-1 text-xs border cursor-pointer ${
                    settings.graphicsQuality === q
                      ? 'bg-[#d4a64a] text-[#0b0a0e] border-[#f8e3a8] font-bold'
                      : 'bg-[#121018] text-[#b8afa1] border-white/15'
                  }`}
                >
                  {q === 'low' ? 'Baixo' : q === 'medium' ? 'Médio' : 'Alto'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between py-1">
            <span className="text-[#d6cfc2]">Controles Móveis na Tela</span>
            <div className="flex gap-1.5">
              {(['auto', 'on', 'off'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => onUpdate({ ...settings, mobileControls: m })}
                  className={`px-2.5 py-1 text-xs border cursor-pointer ${
                    settings.mobileControls === m
                      ? 'bg-[#d4a64a] text-[#0b0a0e] border-[#f8e3a8] font-bold'
                      : 'bg-[#121018] text-[#b8afa1] border-white/15'
                  }`}
                >
                  {m === 'auto' ? 'Auto' : m === 'on' ? 'Ativo' : 'Oculto'}
                </button>
              ))}
            </div>
          </div>

          <ToggleRow
            label="Silenciar Áudio"
            checked={settings.muted}
            onChange={(v) => onUpdate({ ...settings, muted: v })}
          />
          <ToggleRow
            label="Tremor de Câmera em Impactos"
            checked={settings.screenShake}
            onChange={(v) => onUpdate({ ...settings, screenShake: v })}
          />
          <ToggleRow
            label="Números de Dano Flutuantes"
            checked={settings.damageNumbers}
            onChange={(v) => onUpdate({ ...settings, damageNumbers: v })}
          />

          <div className="pt-4 border-t border-white/10 flex items-center justify-between">
            <span className="text-xs text-[#9c9487]">Dados salvos localmente no navegador</span>
            {!confirmReset ? (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="px-3 py-1.5 text-xs text-[#f87171] border border-[#f87171]/35 hover:bg-[#2a1317] cursor-pointer"
              >
                Apagar Progresso
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="px-2.5 py-1 text-xs text-[#b8afa1] border border-white/15 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmReset(false);
                    onResetSave();
                  }}
                  className="px-3 py-1 text-xs bg-[#b83232] text-white font-semibold cursor-pointer"
                >
                  Confirmar Exclusão
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[#d6cfc2]">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`px-3 py-1 text-xs font-mono-num border cursor-pointer ${
          checked
            ? 'bg-[#213325] text-[#4ade80] border-[#4ade80]/50'
            : 'bg-[#121018] text-[#9c9487] border-white/15'
        }`}
      >
        {checked ? 'ATIVO' : 'INATIVO'}
      </button>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 bg-[#121018] border border-white/10">
      <div className="text-[11px] text-[#9c9487]">{label}</div>
      <div className="font-mono-num text-base font-bold text-[#f8e3a8] mt-0.5">{value}</div>
    </div>
  );
}
