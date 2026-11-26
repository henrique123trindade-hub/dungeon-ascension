import { useState } from 'react';
import { BALANCE_CONFIG } from '../game/data/balanceConfig';
import { CLASSES } from '../game/data/classes';
import { getSkillEvolutionTier, SKILL_LIST, SKILLS, SYNERGIES } from '../game/data/skills';
import { phaserBridge } from '../game/phaser/PhaserBridge';
import {
  EQUIPMENT_SLOT_LABELS,
  EQUIPMENT_SLOTS,
  getEquipmentPowerScore,
  getEquipmentUpgradeCost,
  RARITY_META,
} from '../game/systems/balance';
import type { EquipmentItem, EquipmentSlot, RunHUDSnapshot, SkillId } from '../game/types';
import { EquipmentSlotIcon, GoldCoinIcon, SkillIcon } from './Icons';

interface CharacterOverlayProps {
  hud: RunHUDSnapshot;
  initialTab: 'inventory' | 'skills' | 'stats';
  onClose: () => void;
}

export function CharacterOverlay({ hud, initialTab, onClose }: CharacterOverlayProps) {
  const [tab, setTab] = useState<'inventory' | 'skills' | 'stats'>(initialTab);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(hud.inventory[0]?.id ?? null);

  const selectedItem: EquipmentItem | null =
    hud.inventory.find((i) => i.id === selectedItemId) ??
    Object.values(hud.equipped).find((i) => i?.id === selectedItemId) ??
    hud.inventory[0] ??
    Object.values(hud.equipped)[0] ??
    null;

  const isSelectedEquipped = Boolean(
    selectedItem && hud.equipped[selectedItem.slot]?.id === selectedItem.id
  );
  const compareEquipped =
    selectedItem && !isSelectedEquipped ? hud.equipped[selectedItem.slot] ?? null : null;

  const ctrl = phaserBridge.getController();

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4 sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Painel do Personagem"
        className="dark-panel animate-modal-enter w-full max-w-5xl h-[86vh] flex flex-col overflow-hidden"
      >
        {/* Header + Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-[#d4a64a]/20">
          <div className="flex items-center gap-2">
            <TabBtn active={tab === 'inventory'} onClick={() => setTab('inventory')}>
              Inventário ({hud.inventory.length}/32)
            </TabBtn>
            <TabBtn active={tab === 'skills'} onClick={() => setTab('skills')}>
              Habilidades e Sinergias
            </TabBtn>
            <TabBtn active={tab === 'stats'} onClick={() => setTab('stats')}>
              Atributos e Estatísticas
            </TabBtn>
          </div>

          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 font-mono-num text-sm text-[#facc15]">
              <GoldCoinIcon className="w-4 h-4" />
              {hud.gold} Ouro
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-sm text-[#c7bfb2] hover:text-white border border-white/15 hover:border-white/40 cursor-pointer"
            >
              Retomar Combate
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto custom-scroll p-6">
          {tab === 'inventory' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Equipped Slots */}
              <div className="lg:col-span-4 flex flex-col gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#9c9487] mb-1">
                  Equipados ({CLASSES[hud.classId].name} · Nv.{hud.level})
                </h3>
                {EQUIPMENT_SLOTS.map((slot) => {
                  const eq = hud.equipped[slot];
                  const meta = eq ? RARITY_META[eq.rarity] : null;
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => eq && setSelectedItemId(eq.id)}
                      className={`w-full text-left p-3 border flex items-center gap-3 transition-colors cursor-pointer ${
                        eq && selectedItem?.id === eq.id
                          ? 'bg-[#221d2d] border-[#d4a64a]'
                          : 'bg-[#121018] border-white/10 hover:border-white/25'
                      }`}
                    >
                      <div
                        className="w-9 h-9 bg-[#0b0a0e] border border-white/15 flex items-center justify-center shrink-0"
                        style={{ color: meta ? meta.color : '#52525b' }}
                      >
                        <EquipmentSlotIcon slot={slot} className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] text-[#9c9487]">{EQUIPMENT_SLOT_LABELS[slot]}</div>
                        {eq ? (
                          <div className="text-sm font-medium truncate" style={{ color: meta!.color }}>
                            {eq.name} {eq.upgradeLevel > 0 ? `+${eq.upgradeLevel}` : ''}
                          </div>
                        ) : (
                          <div className="text-xs text-[#605950]">Vazio</div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Backpack Grid */}
              <div className="lg:col-span-4 flex flex-col">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#9c9487] mb-3">
                  Mochila
                </h3>
                {hud.inventory.length === 0 ? (
                  <div className="p-6 bg-[#110f16] border border-white/10 text-sm text-[#9c9487]">
                    Nenhum item na mochila. Derrote inimigos, elites, chefes ou abra baús para obter equipamentos.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {hud.inventory.map((item) => {
                      const meta = RARITY_META[item.rarity];
                      const active = selectedItem?.id === item.id;
                      const eqCurrent = hud.equipped[item.slot];
                      const delta = eqCurrent
                        ? getEquipmentPowerScore(item) - getEquipmentPowerScore(eqCurrent)
                        : getEquipmentPowerScore(item);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setSelectedItemId(item.id)}
                          className={`p-3 text-left border transition-colors cursor-pointer ${
                            active ? 'bg-[#221d2d]' : 'bg-[#121018] hover:bg-[#191622]'
                          }`}
                          style={{ borderColor: active ? '#f8e3a8' : meta.border }}
                        >
                          <div className="flex items-center justify-between gap-1 text-[11px]">
                            <span className="text-[#9c9487]">{EQUIPMENT_SLOT_LABELS[item.slot]}</span>
                            <span
                              className={`font-mono-num ${
                                delta > 0 ? 'text-[#4ade80]' : delta < 0 ? 'text-[#f87171]' : 'text-[#9c9487]'
                              }`}
                            >
                              {delta > 0 ? `+${delta}` : delta}
                            </span>
                          </div>
                          <div className="text-xs font-semibold truncate mt-1" style={{ color: meta.color }}>
                            {item.name}
                          </div>
                          <div className="text-[11px] font-mono-num text-[#9c9487] mt-1">
                            Nv.{item.requiredLevel} · {item.sellValue}g
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Inspector & Comparison */}
              <div className="lg:col-span-4 bg-[#110f16] border border-white/10 p-5 flex flex-col justify-between">
                {selectedItem ? (
                  <>
                    <div>
                      <div className="flex items-baseline justify-between gap-2">
                        <span
                          className="text-xs font-mono-num font-bold uppercase tracking-wider"
                          style={{ color: RARITY_META[selectedItem.rarity].color }}
                        >
                          {RARITY_META[selectedItem.rarity].label} · {EQUIPMENT_SLOT_LABELS[selectedItem.slot]}
                        </span>
                        <span className="font-mono-num text-xs text-[#9c9487]">
                          Poder {getEquipmentPowerScore(selectedItem)}
                        </span>
                      </div>
                      <h4
                        className="font-display text-lg font-bold mt-1"
                        style={{ color: RARITY_META[selectedItem.rarity].color }}
                      >
                        {selectedItem.name} {selectedItem.upgradeLevel > 0 ? `+${selectedItem.upgradeLevel}` : ''}
                      </h4>
                      <div className="text-xs text-[#9c9487] mt-1 font-mono-num">
                        Nível necessário: {selectedItem.requiredLevel}{' '}
                        {hud.level < selectedItem.requiredLevel && (
                          <span className="text-[#f87171]">(Bloqueado)</span>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-white/10 space-y-1.5 text-sm font-mono-num">
                        {formatItemStats(selectedItem).map((line) => (
                          <div key={line} className="text-[#e8e3d9]">
                            {line}
                          </div>
                        ))}
                      </div>

                      {selectedItem.specialEffect && (
                        <div className="mt-3 p-2.5 bg-[#1b1526] border border-[#c084fc]/35 text-xs text-[#e9d5ff]">
                          {selectedItem.specialEffect.label}
                        </div>
                      )}

                      {compareEquipped && (
                        <div className="mt-4 pt-3 border-t border-white/10">
                          <div className="text-[11px] uppercase tracking-wider text-[#9c9487]">
                            Comparação com Equipado ({compareEquipped.name})
                          </div>
                          <div className="text-xs font-mono-num mt-1">
                            Diferença de Poder:{' '}
                            <span
                              className={
                                getEquipmentPowerScore(selectedItem) >= getEquipmentPowerScore(compareEquipped)
                                  ? 'text-[#4ade80]'
                                  : 'text-[#f87171]'
                              }
                            >
                              {getEquipmentPowerScore(selectedItem) - getEquipmentPowerScore(compareEquipped) >= 0
                                ? '+'
                                : ''}
                              {getEquipmentPowerScore(selectedItem) - getEquipmentPowerScore(compareEquipped)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-5 pt-4 border-t border-white/10 flex flex-col gap-2">
                      {isSelectedEquipped ? (
                        <button
                          type="button"
                          onClick={() => ctrl?.unequipSlot(selectedItem.slot)}
                          className="w-full py-2 px-3 bg-[#1d1926] hover:bg-[#2a2438] text-sm font-medium border border-white/20 cursor-pointer"
                        >
                          Desequipar
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={hud.level < selectedItem.requiredLevel}
                          onClick={() => ctrl?.equipItem(selectedItem.id)}
                          className="w-full py-2 px-3 bg-[#b83232] hover:bg-[#cf3a3a] disabled:opacity-40 text-sm font-semibold text-white border border-[#e3b55c]/40 cursor-pointer"
                        >
                          Equipar
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={hud.gold < getEquipmentUpgradeCost(selectedItem) || selectedItem.upgradeLevel >= 15}
                        onClick={() => ctrl?.upgradeItem(selectedItem.id)}
                        className="w-full py-2 px-3 bg-[#1b1724] hover:bg-[#282136] disabled:opacity-40 text-sm font-medium text-[#f8e3a8] border border-[#d4a64a]/40 cursor-pointer font-mono-num"
                      >
                        {selectedItem.upgradeLevel >= 15
                          ? 'Aprimoramento Máximo'
                          : `Aprimorar (+${Math.round(BALANCE_CONFIG.player.equipUpgradeStep * 100)}%) · ${getEquipmentUpgradeCost(selectedItem)} Ouro`}
                      </button>

                      {!isSelectedEquipped && (
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => ctrl?.sellItem(selectedItem.id)}
                            className="py-2 px-3 bg-[#16141d] hover:bg-[#221d2d] text-xs font-medium text-[#facc15] border border-[#facc15]/30 cursor-pointer font-mono-num"
                          >
                            Vender (+{selectedItem.sellValue}g)
                          </button>
                          <button
                            type="button"
                            onClick={() => ctrl?.discardItem(selectedItem.id)}
                            className="py-2 px-3 bg-[#16141d] hover:bg-[#2b151a] text-xs font-medium text-[#f87171] border border-[#f87171]/30 cursor-pointer"
                          >
                            Descartar
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-[#9c9487]">Selecione um equipamento para inspecionar.</div>
                )}
              </div>
            </div>
          )}

          {tab === 'skills' && (
            <div className="space-y-6">
              {/* Active Slot Mapping */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#9c9487] mb-3">
                  Barra de Habilidades Ativas (Q · E · R · F)
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {hud.activeSlots.map((slot) => (
                    <div key={slot.key} className="p-3 bg-[#121018] border border-[#d4a64a]/30 flex items-center gap-3">
                      <span className="font-mono-num text-sm font-bold text-[#d4a64a] w-6">[{slot.key}]</span>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[#f4efe6] truncate">{slot.name}</div>
                        <div className="text-xs text-[#9c9487]">
                          {slot.skillId ? `Nível ${slot.level}` : 'Espaço livre'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* All 15 Skills Grid */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#9c9487] mb-3">
                  Árvore e Evoluções de Habilidades
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {SKILL_LIST.filter(
                    (sk) => !sk.exclusiveToClass || sk.exclusiveToClass === hud.classId
                  ).map((sk) => {
                    const lv = hud.skills[sk.id] ?? 0;
                    const tier = getSkillEvolutionTier(sk.id, Math.max(1, lv));
                    return (
                      <div
                        key={sk.id}
                        className={`p-4 border ${
                          lv > 0 ? 'bg-[#161320] border-[#d4a64a]/40' : 'bg-[#100e15] border-white/10 opacity-65'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <span style={{ color: sk.color }}>
                              <SkillIcon skillId={sk.id} className="w-5 h-5" />
                            </span>
                            <div>
                              <div className="text-sm font-bold text-[#f4efe6]">{tier.name}</div>
                              <div className="text-[11px] text-[#9c9487]">
                                {sk.type === 'active' ? 'Ativa' : 'Passiva'} · {lv > 0 ? `Nível ${lv}/${sk.maxLevel}` : 'Bloqueada'}
                              </div>
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-[#c7bfb2] mt-2 leading-relaxed">{sk.description}</p>
                        <div className="mt-2.5 text-[11px] text-[#9c9487]">
                          Evoluções: {sk.evolutions.map((e) => e.name).join(' → ')}
                        </div>
                        {lv > 0 && sk.type === 'active' && (
                          <div className="mt-3 flex items-center gap-1.5">
                            <span className="text-[11px] text-[#9c9487] mr-1">Equipar:</span>
                            {(['Q', 'E', 'R', 'F'] as const).map((k, idx) => (
                              <button
                                key={k}
                                type="button"
                                onClick={() => ctrl?.assignSkillToSlot(sk.id as SkillId, idx)}
                                className={`px-2 py-0.5 text-[11px] font-mono-num border cursor-pointer ${
                                  hud.activeSlots[idx]?.skillId === sk.id
                                    ? 'bg-[#d4a64a] text-[#0b0a0e] border-[#f8e3a8] font-bold'
                                    : 'bg-[#0b0a0e] text-[#c7bfb2] border-white/20 hover:border-[#d4a64a]'
                                }`}
                              >
                                {k}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Secret Synergies */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#9c9487] mb-3">
                  Combinações Secretas ({hud.activeSynergies.length}/{SYNERGIES.length} Ativas)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {SYNERGIES.map((syn) => {
                    const active = hud.activeSynergies.includes(syn.id);
                    return (
                      <div
                        key={syn.id}
                        className={`p-4 border ${
                          active ? 'bg-[#1c1428] border-[#c084fc]/65' : 'bg-[#100e15] border-white/10'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-display font-bold text-sm" style={{ color: active ? syn.color : '#9c9487' }}>
                            {active ? syn.name : 'Combinação Desconhecida'}
                          </span>
                          <span className="text-[11px] font-mono-num text-[#b8afa1]">
                            {active ? 'ATIVA' : 'Inativa'}
                          </span>
                        </div>
                        <p className="text-xs text-[#c7bfb2] mt-1.5">
                          {active
                            ? syn.bonusText
                            : `Combine ${syn.requiresSkills.map((s) => SKILLS[s].name).join(' + ')} para despertar.`}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {tab === 'stats' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-[#110f16] border border-white/10 p-5">
                <h3 className="font-display text-base font-bold text-[#f8e3a8] pb-3 border-b border-white/10">
                  Atributos de Combate
                </h3>
                <div className="mt-3 space-y-2 text-sm font-mono-num">
                  <AttrRow label="Dano de Ataque" value={`${hud.computedStats.damage}`} />
                  <AttrRow label="Vida Máxima" value={`${hud.computedStats.maxHp}`} />
                  <AttrRow label="Velocidade de Ataque" value={`${hud.computedStats.attackSpeed.toFixed(2)}/s`} />
                  <AttrRow label="Chance Crítica" value={`${Math.round(hud.computedStats.critChance * 100)}%`} />
                  <AttrRow label="Dano Crítico" value={`${Math.round(hud.computedStats.critDamage * 100)}%`} />
                  <AttrRow
                    label="Armadura / Mitigação"
                    value={`${hud.computedStats.armor} (${Math.round(hud.computedStats.damageReduction * 100)}%)`}
                  />
                  <AttrRow label="Esquiva" value={`${Math.round(hud.computedStats.dodge * 100)}%`} />
                  <AttrRow label="Roubo de Vida" value={`${Math.round(hud.computedStats.lifeSteal * 100)}%`} />
                  <AttrRow label="Velocidade de Movimento" value={`${Math.round(hud.computedStats.moveSpeed)}`} />
                  <AttrRow label="Redução de Recarga" value={`${Math.round(hud.computedStats.cooldownReduction * 100)}%`} />
                  <AttrRow label="Projéteis / Perfuração" value={`${hud.computedStats.projectiles} / +${hud.computedStats.piercing}`} />
                  <AttrRow label="Sorte" value={`${hud.computedStats.luck}`} />
                </div>
              </div>

              <div className="bg-[#110f16] border border-white/10 p-5">
                <h3 className="font-display text-base font-bold text-[#f8e3a8] pb-3 border-b border-white/10">
                  Estatísticas da Expedição
                </h3>
                <div className="mt-3 space-y-2 text-sm font-mono-num">
                  <AttrRow label="Classe / Título" value={hud.evolutionTitle} />
                  <AttrRow label="Andar Atual" value={`${hud.floor} (${hud.biomeName})`} />
                  <AttrRow label="Nível do Herói" value={`${hud.level}`} />
                  <AttrRow label="Inimigos Abatidos" value={`${hud.kills}`} />
                  <AttrRow label="Chefes Derrotados" value={`${hud.bossesKilled}`} />
                  <AttrRow label="Tempo Decorrido" value={`${Math.floor(hud.elapsedSec / 60)}m ${hud.elapsedSec % 60}s`} />
                  <AttrRow label="Multiplicador de Dano" value={`×${hud.computedStats.damageMult.toFixed(2)}`} />
                  <AttrRow label="Multiplicador vs Chefes" value={`×${hud.computedStats.bossDamageMult.toFixed(2)}`} />
                  <AttrRow label="Multiplicador de EXP" value={`×${hud.computedStats.xpMultiplier.toFixed(2)}`} />
                  <AttrRow label="Multiplicador de Ouro" value={`×${hud.computedStats.goldMultiplier.toFixed(2)}`} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
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

function AttrRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-white/5">
      <span className="text-[#9c9487] font-sans">{label}</span>
      <span className="text-[#f4efe6] font-semibold">{value}</span>
    </div>
  );
}

function formatItemStats(item: EquipmentItem): string[] {
  const upg = 1 + item.upgradeLevel * BALANCE_CONFIG.player.equipUpgradeStep;
  const s = item.stats;
  const lines: string[] = [];
  if (s.damage) lines.push(`+${Math.round(s.damage * upg)} Dano Base`);
  if (s.damagePct) lines.push(`+${Math.round(s.damagePct * upg * 100)}% Dano`);
  if (s.maxHp) lines.push(`+${Math.round(s.maxHp * upg)} Vida Máxima`);
  if (s.armor) lines.push(`+${Math.round(s.armor * upg)} Armadura`);
  if (s.attackSpeedPct) lines.push(`+${Math.round(s.attackSpeedPct * upg * 100)}% Vel. Ataque`);
  if (s.critChance) lines.push(`+${Math.round(s.critChance * 100)}% Chance Crítica`);
  if (s.critDamage) lines.push(`+${Math.round(s.critDamage * 100)}% Dano Crítico`);
  if (s.moveSpeedPct) lines.push(`+${Math.round(s.moveSpeedPct * 100)}% Velocidade`);
  if (s.lifeSteal) lines.push(`+${Math.round(s.lifeSteal * 100)}% Roubo de Vida`);
  if (s.dodge) lines.push(`+${Math.round(s.dodge * 100)}% Esquiva`);
  if (s.luck) lines.push(`+${Math.round(s.luck * upg)} Sorte`);
  if (s.cooldownReduction) lines.push(`-${Math.round(s.cooldownReduction * 100)}% Recarga`);
  if (s.xpGainPct) lines.push(`+${Math.round(s.xpGainPct * 100)}% Experiência`);
  return lines;
}
