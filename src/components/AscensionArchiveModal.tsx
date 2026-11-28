import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Crown,
  Film,
  Lock,
  Map,
  ScrollText,
  Skull,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { BOSSES } from '../game/data/bosses';
import { CLASS_LIST } from '../game/data/classes';
import { ENEMY_LIST } from '../game/data/enemies';
import {
  BOSS_DIALOGUES,
  CHAPTERS,
  CINEMATICS,
  CLASS_LORE,
  LORE_CHRONICLES,
  MEMORY_FRAGMENTS,
  type CinematicDef,
} from '../game/data/lore';
import { computeLoreCompletion } from '../game/systems/narrativeManager';
import type { SaveData } from '../game/types';

type ArchiveTab = 'chronicles' | 'chapters' | 'fragments' | 'guardians' | 'ascendants' | 'cinematics';

interface AscensionArchiveModalProps {
  save: SaveData;
  onClose: () => void;
  onReplayCinematic: (cinematicId: CinematicDef['id']) => void;
}

export const AscensionArchiveModal: React.FC<AscensionArchiveModalProps> = ({
  save,
  onClose,
  onReplayCinematic,
}) => {
  const [activeTab, setActiveTab] = useState<ArchiveTab>('chronicles');
  const [selectedFragmentId, setSelectedFragmentId] = useState<string>(MEMORY_FRAGMENTS[0].id);
  const [selectedChapterIdx, setSelectedChapterIdx] = useState<number>(0);

  const completion = useMemo(() => computeLoreCompletion(save), [save]);
  const narrative = save.narrative;

  const discoveredChaptersSet = useMemo(() => new Set(narrative.discoveredChapters), [narrative.discoveredChapters]);
  const collectedFragmentsSet = useMemo(() => new Set(narrative.collectedFragments), [narrative.collectedFragments]);
  const defeatedBossesSet = useMemo(() => new Set(narrative.defeatedBosses), [narrative.defeatedBosses]);
  const unlockedRevSet = useMemo(() => new Set(narrative.unlockedRevelations), [narrative.unlockedRevelations]);
  const unlockedCinematicsSet = useMemo(() => new Set(narrative.unlockedCinematics), [narrative.unlockedCinematics]);

  const selectedFragment =
    MEMORY_FRAGMENTS.find((f) => f.id === selectedFragmentId) ?? MEMORY_FRAGMENTS[0];
  const selectedFragmentUnlocked = collectedFragmentsSet.has(selectedFragment.id);

  const selectedChapter = CHAPTERS[selectedChapterIdx] ?? CHAPTERS[0];
  const selectedChapterUnlocked = discoveredChaptersSet.has(selectedChapter.index);
  const selectedChapterRevelationUnlocked = unlockedRevSet.has(selectedChapter.index);

  const tabs: Array<{ id: ArchiveTab; label: string; icon: React.ReactNode }> = [
    { id: 'chronicles', label: 'Crônicas', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'chapters', label: 'Capítulos', icon: <Map className="w-4 h-4" /> },
    { id: 'fragments', label: 'Memórias', icon: <ScrollText className="w-4 h-4" /> },
    { id: 'guardians', label: 'Guardiões', icon: <Skull className="w-4 h-4" /> },
    { id: 'ascendants', label: 'Ascendentes', icon: <Users className="w-4 h-4" /> },
    { id: 'cinematics', label: 'Visões', icon: <Film className="w-4 h-4" /> },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Arquivo da Ascensão"
      data-testid="ascension-archive-modal"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/82 backdrop-blur-sm p-3 sm:p-6"
    >
      <div className="relative w-full max-w-5xl max-h-[90vh] flex flex-col bg-[#0e0c14] border border-[#b89b63]/35 shadow-[0_24px_80px_rgba(0,0,0,0.9)] overflow-hidden">
        {/* Top Grimoire Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5 border-b border-[#b89b63]/20 bg-[#14111d]">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-[#b89b63]">
              Grimório Oficial · Torre do Abismo
            </p>
            <h2 className="font-display text-2xl sm:text-3xl tracking-[0.12em] uppercase text-[#f6eedb] mt-0.5">
              Arquivo da Ascensão
            </h2>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-[0.2em] text-[#9f95ad]">
                Conhecimento da Torre
              </div>
              <div className="flex items-baseline justify-end gap-2 mt-0.5">
                <span className="font-display text-xl text-[#f3d185] tabular-nums">
                  {completion.percent}%
                </span>
                <span className="text-xs text-[#8f859d] tabular-nums">
                  ({completion.discoveredTotal}/{completion.possibleTotal})
                </span>
              </div>
              <div className="w-36 h-[3px] bg-white/10 mt-1.5 overflow-hidden">
                <div
                  className="h-full bg-[#e3b55c] transition-all duration-300"
                  style={{ width: `${completion.percent}%` }}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar Arquivo da Ascensão"
              className="p-2 border border-white/15 text-[#c7bdd3] hover:text-white hover:border-[#e3b55c]/60 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Grimoire Tab Strip */}
        <nav
          aria-label="Seções do Arquivo da Ascensão"
          className="flex items-center overflow-x-auto border-b border-white/10 bg-[#110e19] px-4"
        >
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3.5 text-xs uppercase tracking-[0.16em] whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
                  active
                    ? 'border-[#e3b55c] text-[#f8e7c2] bg-[#1a1626]/70'
                    : 'border-transparent text-[#9d93ab] hover:text-[#dfd6e8]'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7">
          {/* TAB 1: CRÔNICAS */}
          {activeTab === 'chronicles' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-b border-white/10 pb-5">
                <div className="bg-[#151220] border border-white/10 px-4 py-3">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[#8d849a]">Capítulos</div>
                  <div className="font-display text-lg text-[#f3e6cc] tabular-nums mt-1">
                    {completion.chapters.unlocked}/{completion.chapters.total}
                  </div>
                </div>
                <div className="bg-[#151220] border border-white/10 px-4 py-3">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[#8d849a]">Memórias</div>
                  <div className="font-display text-lg text-[#f3e6cc] tabular-nums mt-1">
                    {completion.fragments.unlocked}/{completion.fragments.total}
                  </div>
                </div>
                <div className="bg-[#151220] border border-white/10 px-4 py-3">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[#8d849a]">Guardiões</div>
                  <div className="font-display text-lg text-[#f3e6cc] tabular-nums mt-1">
                    {completion.bosses.unlocked}/{completion.bosses.total}
                  </div>
                </div>
                <div className="bg-[#151220] border border-white/10 px-4 py-3">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[#8d849a]">Anomalias</div>
                  <div className="font-display text-lg text-[#f3e6cc] tabular-nums mt-1">
                    {completion.anomalies.unlocked}/{completion.anomalies.total}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {LORE_CHRONICLES.map((entry) => {
                  const unlocked = entry.requiresInfiniteAscension
                    ? narrative.infiniteAscensionUnlocked
                    : entry.minChapterUnlocked !== undefined
                      ? discoveredChaptersSet.has(entry.minChapterUnlocked)
                      : true;

                  return (
                    <article
                      key={entry.id}
                      className={`p-5 border transition-colors ${
                        unlocked
                          ? 'bg-[#14111e] border-[#b89b63]/28'
                          : 'bg-[#0c0a12] border-white/8 opacity-75'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[11px] uppercase tracking-[0.2em] text-[#b89b63]">
                            {unlocked ? entry.subtitle : 'Registro Selado'}
                          </div>
                          <h3 className="font-display text-lg tracking-[0.06em] text-[#f5ecd9] mt-1">
                            {unlocked ? entry.title : 'Crônica Oculta'}
                          </h3>
                        </div>
                        {!unlocked && <Lock className="w-4 h-4 text-[#7c7388] shrink-0 mt-1" />}
                      </div>

                      {unlocked ? (
                        <div className="mt-3 space-y-2.5 text-sm text-[#d2c8b8] leading-relaxed">
                          {entry.paragraphs.map((p, idx) => (
                            <p key={idx}>{p}</p>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 text-xs italic text-[#8a8098] leading-relaxed">
                          {entry.unlockRequirementText}
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: CAPÍTULOS I-X */}
          {activeTab === 'chapters' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              <div className="md:col-span-5 space-y-1.5">
                {CHAPTERS.map((ch) => {
                  const unlocked = discoveredChaptersSet.has(ch.index);
                  const selected = selectedChapterIdx === ch.index;
                  return (
                    <button
                      key={ch.index}
                      type="button"
                      onClick={() => setSelectedChapterIdx(ch.index)}
                      className={`w-full flex items-center justify-between px-4 py-3 text-left border transition-colors cursor-pointer ${
                        selected
                          ? 'bg-[#1b1628] border-[#e3b55c]/60'
                          : 'bg-[#120f1a] border-white/8 hover:border-white/20'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-[0.22em] text-[#a599b2]">
                          {ch.roman} · Andares {ch.floorRange[0]}–{ch.floorRange[1]}
                        </div>
                        <div className="font-display text-sm tracking-[0.06em] text-[#f3ead6] truncate mt-0.5">
                          {unlocked ? ch.region : 'Região Desconhecida'}
                        </div>
                      </div>
                      {unlocked ? (
                        <span
                          className="w-2.5 h-2.5 shrink-0 ml-3"
                          style={{ backgroundColor: ch.accentColor }}
                        />
                      ) : (
                        <Lock className="w-3.5 h-3.5 text-[#6f667a] shrink-0 ml-3" />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="md:col-span-7 bg-[#14111e] border border-[#b89b63]/28 p-6 flex flex-col justify-between">
                {selectedChapterUnlocked ? (
                  <div>
                    <div
                      className="text-xs uppercase tracking-[0.24em] font-medium"
                      style={{ color: selectedChapter.accentColor }}
                    >
                      {selectedChapter.roman} · Andares {selectedChapter.floorRange[0]}–
                      {selectedChapter.floorRange[1]}
                    </div>
                    <h3 className="font-display text-2xl tracking-[0.1em] uppercase text-[#f6eedb] mt-1">
                      {selectedChapter.region}
                    </h3>
                    <p className="text-xs uppercase tracking-[0.18em] text-[#b4a790] mt-0.5">
                      {selectedChapter.title}
                    </p>

                    <blockquote className="mt-4 py-3 px-4 bg-[#0d0a14] border-y border-white/10 text-sm italic text-[#e4dac7]">
                      “{selectedChapter.transitionQuote}”
                    </blockquote>

                    <div className="mt-5 space-y-4 text-sm">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.18em] text-[#b89b63]">
                          Atmosfera e Arquitetura
                        </div>
                        <p className="text-[#cfc5b5] mt-1 leading-relaxed">
                          {selectedChapter.environmentSummary}
                        </p>
                      </div>

                      <div>
                        <div className="text-[11px] uppercase tracking-[0.18em] text-[#b89b63]">
                          Mecânica Ambiental · {selectedChapter.mechanicName}
                        </div>
                        <p className="text-[#cfc5b5] mt-1 leading-relaxed">
                          {selectedChapter.mechanicDescription}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-white/10">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-[#b89b63] flex items-center gap-2">
                          <Crown className="w-3.5 h-3.5" />
                          <span>Revelação do Capítulo</span>
                        </div>
                        {selectedChapterRevelationUnlocked ? (
                          <p className="text-[#f0e3c6] mt-1.5 leading-relaxed">
                            {selectedChapter.revelation}
                          </p>
                        ) : (
                          <p className="text-xs italic text-[#8a8098] mt-1.5">
                            Derrote o guardião deste capítulo ({selectedChapter.bossName}) para revelar este registro.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-center space-y-3">
                    <Lock className="w-8 h-8 text-[#6f667a] mx-auto" />
                    <div className="font-display text-lg uppercase tracking-[0.12em] text-[#bfb5cb]">
                      {selectedChapter.roman} · Selado
                    </div>
                    <p className="text-sm text-[#8b8199] max-w-md mx-auto">
                      Alcance o Andar {selectedChapter.floorRange[0]} na Torre do Abismo para registrar esta região no Arquivo da Ascensão.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: FRAGMENTOS DE MEMÓRIA */}
          {activeTab === 'fragments' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              <div className="md:col-span-5 space-y-1.5 max-h-[54vh] overflow-y-auto pr-1">
                {MEMORY_FRAGMENTS.map((frag) => {
                  const found = collectedFragmentsSet.has(frag.id);
                  const active = selectedFragmentId === frag.id;
                  return (
                    <button
                      key={frag.id}
                      type="button"
                      onClick={() => setSelectedFragmentId(frag.id)}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 text-left border transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#1c1629] border-[#e3b55c]/60'
                          : 'bg-[#120f1a] border-white/8 hover:border-white/20'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-[0.2em] text-[#8d849a] tabular-nums">
                          Fragmento #{String(frag.order).padStart(2, '0')}
                        </div>
                        <div className="text-sm text-[#f0e6d2] truncate mt-0.5">
                          {found ? frag.title : 'Fragmento Perdido'}
                        </div>
                      </div>
                      {found ? (
                        <Sparkles className="w-3.5 h-3.5 text-[#e3b55c] shrink-0 ml-2" />
                      ) : (
                        <Lock className="w-3.5 h-3.5 text-[#696075] shrink-0 ml-2" />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="md:col-span-7 bg-[#14111e] border border-[#b89b63]/28 p-6">
                <div className="text-[11px] uppercase tracking-[0.24em] text-[#b89b63] tabular-nums">
                  Fragmento de Memória #{String(selectedFragment.order).padStart(2, '0')} ·{' '}
                  {selectedFragmentUnlocked ? selectedFragment.era : 'Memória Não Recuperada'}
                </div>

                {selectedFragmentUnlocked ? (
                  <>
                    <h3 className="font-display text-2xl tracking-[0.06em] text-[#f6eedb] mt-1.5">
                      {selectedFragment.title}
                    </h3>
                    <p className="mt-4 py-3 px-4 bg-[#0d0a14] border-y border-[#b89b63]/20 text-sm italic text-[#e9d5a8]">
                      “{selectedFragment.excerpt}”
                    </p>
                    <p className="mt-5 text-sm text-[#d4cab9] leading-relaxed">
                      {selectedFragment.body}
                    </p>
                  </>
                ) : (
                  <div className="py-10 text-center space-y-3">
                    <Lock className="w-7 h-7 text-[#736980] mx-auto" />
                    <h3 className="font-display text-lg uppercase tracking-[0.1em] text-[#c7bdd3]">
                      Eco Adormecido
                    </h3>
                    <p className="text-sm text-[#958ba3] max-w-md mx-auto leading-relaxed">
                      {selectedFragment.sourceHint}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: GUARDIÕES & BESTIÁRIO */}
          {activeTab === 'guardians' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xs uppercase tracking-[0.24em] text-[#b89b63] mb-3">
                  Guardiões da Torre ({completion.bosses.unlocked}/{completion.bosses.total})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {BOSSES.map((boss) => {
                    const defeated = defeatedBossesSet.has(boss.id);
                    const kills = save.bestiaryKills[boss.id] ?? 0;
                    const dlg = BOSS_DIALOGUES[boss.id];
                    return (
                      <div
                        key={boss.id}
                        className={`p-4 border ${
                          defeated
                            ? 'bg-[#14111e] border-[#b89b63]/25'
                            : 'bg-[#0c0a12] border-white/8 opacity-70'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-[10px] uppercase tracking-[0.22em] text-[#9b90a8]">
                              Andar {boss.floorMilestone}
                              {boss.isMegaBoss ? ' · Mega Chefe' : ''}
                            </div>
                            <div className="font-display text-base tracking-[0.06em] text-[#f5ecd9] mt-0.5">
                              {defeated ? boss.name : 'Guardião Desconhecido'}
                            </div>
                            {defeated && (
                              <div className="text-xs text-[#b89b63]">{boss.title}</div>
                            )}
                          </div>
                          {defeated ? (
                            <span className="text-xs text-[#a59bb3] tabular-nums">
                              {kills} {kills === 1 ? 'vitória' : 'vitórias'}
                            </span>
                          ) : (
                            <Lock className="w-4 h-4 text-[#6d6479]" />
                          )}
                        </div>

                        {defeated && dlg ? (
                          <div className="mt-3 space-y-2">
                            <p className="text-xs italic text-[#e5d5b3]">“{dlg.intro}”</p>
                            <p className="text-xs text-[#c7bdb0] leading-relaxed">{dlg.chronicle}</p>
                          </div>
                        ) : (
                          <p className="mt-3 text-xs italic text-[#80768f]">
                            Derrote o guardião do Andar {boss.floorMilestone} para revelar sua história.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 border-t border-white/10">
                <h3 className="text-xs uppercase tracking-[0.24em] text-[#b89b63] mb-3">
                  Criaturas da Masmorra
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                  {ENEMY_LIST.map((en) => {
                    const kills = save.bestiaryKills[en.id] ?? 0;
                    const seen = kills > 0;
                    return (
                      <div
                        key={en.id}
                        className={`p-3 border ${
                          seen ? 'bg-[#14111e] border-white/12' : 'bg-[#0c0a12] border-white/6 opacity-60'
                        }`}
                      >
                        <div className="text-xs font-medium text-[#eee4d2] truncate">
                          {seen ? en.name : '???'}
                        </div>
                        <div className="text-[11px] text-[#958ba3] tabular-nums mt-1">
                          {seen ? `${kills} abatidos` : 'Não encontrado'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: ASCENDENTES & ANOMALIAS DIMENSIONAIS */}
          {activeTab === 'ascendants' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xs uppercase tracking-[0.24em] text-[#b89b63] mb-3">
                  Ordens dos Ascendentes
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {CLASS_LIST.filter((c) => !c.secret).map((cls) => {
                    const lore = CLASS_LORE[cls.id];
                    return (
                      <div key={cls.id} className="p-4 bg-[#14111e] border border-white/12">
                        <div className="flex items-center justify-between">
                          <h4 className="font-display text-lg text-[#f5ecd9]">{cls.name}</h4>
                          <span className="text-[11px] uppercase tracking-[0.16em]" style={{ color: cls.accentColor }}>
                            {lore.epithet}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#968ca4] mt-0.5">{lore.origin}</div>
                        <p className="text-xs text-[#d0c6b7] leading-relaxed mt-2.5">{lore.lore}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 border-t border-white/10">
                <h3 className="text-xs uppercase tracking-[0.24em] text-[#c084fc] mb-1">
                  Anomalias Dimensionais ({completion.anomalies.unlocked}/{completion.anomalies.total})
                </h3>
                <p className="text-xs text-[#9c92aa] mb-3.5">
                  Quando a Torre do Abismo rompe fronteiras entre mundos, entidades impossíveis atravessam a fenda.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {CLASS_LIST.filter((c) => c.secret).map((cls) => {
                    const unlocked = save.unlockedSecretClasses.includes(cls.id);
                    const lore = CLASS_LORE[cls.id];
                    return (
                      <div
                        key={cls.id}
                        className={`p-4 border ${
                          unlocked
                            ? 'bg-[#171124] border-[#c084fc]/35'
                            : 'bg-[#0c0a12] border-white/8 opacity-70'
                        }`}
                      >
                        {unlocked ? (
                          <>
                            <div
                              className="text-[10px] uppercase tracking-[0.2em]"
                              style={{ color: cls.accentColor }}
                            >
                              {lore.origin}
                            </div>
                            <h4 className="font-display text-lg text-[#f7eedb] mt-1">
                              {cls.name} — {lore.epithet}
                            </h4>
                            <p className="text-xs text-[#d2c8ba] leading-relaxed mt-2.5">{lore.lore}</p>
                          </>
                        ) : (
                          <div className="py-5 text-center space-y-2">
                            <Lock className="w-5 h-5 text-[#7a6f8a] mx-auto" />
                            <div className="font-display text-sm uppercase tracking-[0.14em] text-[#bfb5cb]">
                              Anomalia Selada
                            </div>
                            <p className="text-xs italic text-[#857b94]">
                              Uma fenda desconhecida aguarda ser despertada por um código antigo.
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: CINEMATOGRÁFICAS */}
          {activeTab === 'cinematics' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {Object.values(CINEMATICS).map((cin) => {
                const unlocked =
                  cin.id === 'intro'
                    ? narrative.introSeen || unlockedCinematicsSet.has('intro')
                    : narrative.infiniteAscensionUnlocked || unlockedCinematicsSet.has(cin.id);

                return (
                  <div
                    key={cin.id}
                    className={`p-5 border flex flex-col justify-between gap-4 ${
                      unlocked
                        ? 'bg-[#14111e] border-[#b89b63]/30'
                        : 'bg-[#0c0a12] border-white/8 opacity-75'
                    }`}
                  >
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.22em] text-[#b89b63]">
                        {cin.subtitle}
                      </div>
                      <h3 className="font-display text-xl text-[#f6eedb] mt-1">
                        {unlocked ? cin.title : 'Visão Selada'}
                      </h3>
                      <p className="text-xs text-[#a59bb3] mt-2 leading-relaxed">
                        {unlocked
                          ? 'Disponível para rever a qualquer momento sem alterar seu progresso.'
                          : cin.unlockHint}
                      </p>
                    </div>

                    <div>
                      {unlocked ? (
                        <button
                          type="button"
                          onClick={() => onReplayCinematic(cin.id)}
                          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#231b30] hover:bg-[#312543] border border-[#e3b55c]/50 text-[#f8e7c2] text-xs uppercase tracking-[0.18em] transition-colors cursor-pointer"
                        >
                          <Film className="w-3.5 h-3.5 text-[#e3b55c]" />
                          <span>Rever Cinematográfica</span>
                        </button>
                      ) : (
                        <div className="inline-flex items-center gap-2 text-xs text-[#7c738a]">
                          <Lock className="w-3.5 h-3.5" />
                          <span>Bloqueada</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
