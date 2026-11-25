import { BALANCE_CONFIG } from './balanceConfig';
import type { PermanentUpgrades, SaveData } from '../types';

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  rewardCrystals: number;
  check: (save: SaveData) => { done: boolean; progress: number; target: number };
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first_blood',
    name: 'Primeiro Sangue',
    description: 'Elimine 25 inimigos na masmorra.',
    rewardCrystals: 20,
    check: (s) => ({ done: s.totalKills >= 25, progress: Math.min(25, s.totalKills), target: 25 }),
  },
  {
    id: 'slayer_250',
    name: 'Ceifador da Profundeza',
    description: 'Elimine 250 inimigos no total.',
    rewardCrystals: 60,
    check: (s) => ({ done: s.totalKills >= 250, progress: Math.min(250, s.totalKills), target: 250 }),
  },
  {
    id: 'slayer_1500',
    name: 'Pesadelo dos Monstros',
    description: 'Elimine 1.500 inimigos no total.',
    rewardCrystals: 180,
    check: (s) => ({ done: s.totalKills >= 1500, progress: Math.min(1500, s.totalKills), target: 1500 }),
  },
  {
    id: 'floor_10',
    name: 'Queda do Rei Goblin',
    description: 'Alcance o Andar 10 e enfrente o primeiro chefe.',
    rewardCrystals: 45,
    check: (s) => ({ done: s.bestFloor >= 10, progress: Math.min(10, s.bestFloor), target: 10 }),
  },
  {
    id: 'boss_hunter',
    name: 'Caçador de Chefes',
    description: 'Derrote 5 chefes de masmorra.',
    rewardCrystals: 90,
    check: (s) => ({ done: s.totalBossKills >= 5, progress: Math.min(5, s.totalBossKills), target: 5 }),
  },
  {
    id: 'floor_25',
    name: 'Desbravador das Sombras',
    description: 'Alcance o Andar 25 da masmorra.',
    rewardCrystals: 110,
    check: (s) => ({ done: s.bestFloor >= 25, progress: Math.min(25, s.bestFloor), target: 25 }),
  },
  {
    id: 'floor_50',
    name: 'Desafio do Dragão Glacial',
    description: 'Alcance o Andar 50 e o primeiro Chefe Ancestral.',
    rewardCrystals: 260,
    check: (s) => ({ done: s.bestFloor >= 50, progress: Math.min(50, s.bestFloor), target: 50 }),
  },
  {
    id: 'floor_100',
    name: 'Diante do Deus da Masmorra',
    description: 'Alcance o lendário Andar 100.',
    rewardCrystals: 600,
    check: (s) => ({ done: s.bestFloor >= 100, progress: Math.min(100, s.bestFloor), target: 100 }),
  },
  {
    id: 'level_15',
    name: 'Despertar do Poder',
    description: 'Atinja o Nível 15 em uma única expedição.',
    rewardCrystals: 50,
    check: (s) => ({ done: s.bestLevel >= 15, progress: Math.min(15, s.bestLevel), target: 15 }),
  },
  {
    id: 'level_25_evo',
    name: 'Primeira Evolução de Classe',
    description: 'Atinja o Nível 25 e desperte sua evolução de classe.',
    rewardCrystals: 120,
    check: (s) => ({ done: s.bestLevel >= 25, progress: Math.min(25, s.bestLevel), target: 25 }),
  },
  {
    id: 'synergy_1',
    name: 'Alquimista de Combos',
    description: 'Descubra sua primeira combinação secreta de habilidades.',
    rewardCrystals: 80,
    check: (s) => ({
      done: s.discoveredSynergies.length >= 1,
      progress: Math.min(1, s.discoveredSynergies.length),
      target: 1,
    }),
  },
  {
    id: 'synergy_all',
    name: 'Mestre das Sinergias',
    description: 'Descubra todas as 5 combinações secretas.',
    rewardCrystals: 320,
    check: (s) => ({
      done: s.discoveredSynergies.length >= 5,
      progress: Math.min(5, s.discoveredSynergies.length),
      target: 5,
    }),
  },
  {
    id: 'ascension_1',
    name: 'Renascer nas Cinzas',
    description: 'Realize sua primeira Ascensão no Santuário.',
    rewardCrystals: 200,
    check: (s) => ({ done: s.ascensionLevel >= 1, progress: Math.min(1, s.ascensionLevel), target: 1 }),
  },
  {
    id: 'veteran_runs',
    name: 'Vontade Inabalável',
    description: 'Complete 10 expedições na masmorra.',
    rewardCrystals: 75,
    check: (s) => ({ done: s.totalRuns >= 10, progress: Math.min(10, s.totalRuns), target: 10 }),
  },
];

export interface PermanentUpgradeDef {
  key: keyof PermanentUpgrades;
  name: string;
  description: string;
  bonusPerLevelLabel: string;
  baseCost: number;
  costGrowth: number;
  maxLevel: number;
}

export const PERMANENT_UPGRADES: PermanentUpgradeDef[] = [
  {
    key: 'startingDamage',
    name: 'Força Ancestral',
    description: 'Aumenta permanentemente o dano base em todas as expedições.',
    bonusPerLevelLabel: `+${Math.round(BALANCE_CONFIG.player.permDamagePerRank * 100)}% Dano por nível`,
    baseCost: 15,
    costGrowth: 1.38,
    maxLevel: 25,
  },
  {
    key: 'startingHp',
    name: 'Vitalidade Eterna',
    description: 'Aumenta permanentemente a vida máxima inicial do personagem.',
    bonusPerLevelLabel: `+${Number((BALANCE_CONFIG.player.permHpPerRank * 100).toFixed(1))}% Vida Máxima por nível`,
    baseCost: 14,
    costGrowth: 1.36,
    maxLevel: 25,
  },
  {
    key: 'resistance',
    name: 'Égide de Basalto',
    description: 'Adiciona armadura fixa que reduz todo o dano sofrido.',
    bonusPerLevelLabel: `+${BALANCE_CONFIG.player.permArmorPerRank} Armadura por nível`,
    baseCost: 18,
    costGrowth: 1.4,
    maxLevel: 20,
  },
  {
    key: 'luck',
    name: 'Olhar da Fortuna',
    description: 'Eleva o atributo Sorte, aumentando chances de melhorias Épicas, Lendárias e Míticas.',
    bonusPerLevelLabel: `+${BALANCE_CONFIG.player.permLuckPerRank} Sorte por nível`,
    baseCost: 22,
    costGrowth: 1.44,
    maxLevel: 20,
  },
  {
    key: 'xpGain',
    name: 'Sabedoria das Profundezas',
    description: 'Multiplica a experiência recebida de inimigos e andares concluídos.',
    bonusPerLevelLabel: `+${Number((BALANCE_CONFIG.player.permXpPerRank * 100).toFixed(1))}% Experiência por nível`,
    baseCost: 16,
    costGrowth: 1.38,
    maxLevel: 20,
  },
  {
    key: 'goldGain',
    name: 'Cobiça do Soberano',
    description: 'Aumenta o ouro encontrado em inimigos, baús e salas de tesouro.',
    bonusPerLevelLabel: `+${Math.round(BALANCE_CONFIG.player.permGoldPerRank * 100)}% Ouro por nível`,
    baseCost: 15,
    costGrowth: 1.36,
    maxLevel: 20,
  },
  {
    key: 'rareLootChance',
    name: 'Relicário Oculto',
    description: 'Aumenta a chance de inimigos e chefes derrubarem equipamentos raros.',
    bonusPerLevelLabel: '+7% Chance de Itens Raros por nível',
    baseCost: 24,
    costGrowth: 1.45,
    maxLevel: 15,
  },
];

export function getPermanentUpgradeCost(def: PermanentUpgradeDef, currentLevel: number): number {
  return Math.round(def.baseCost * Math.pow(def.costGrowth, currentLevel));
}
