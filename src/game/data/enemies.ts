import type { EliteModifierId, EnemyArchetypeId } from '../types';

export interface EnemyArchetypeDef {
  id: EnemyArchetypeId;
  name: string;
  role: string;
  minFloor: number;
  baseHp: number;
  baseDamage: number;
  speed: number;
  radius: number;
  xpValue: number;
  goldValue: number;
  color: string;
  accent: string;
  behavior:
    | 'flanker'
    | 'melee_lunge'
    | 'kiter_ranged'
    | 'artillery_mage'
    | 'bomber'
    | 'heavy_stomp'
    | 'teleporter'
    | 'healer'
    | 'summoner'
    | 'charger';
  lore: string;
}

export const ENEMY_ARCHETYPES: Record<EnemyArchetypeId, EnemyArchetypeDef> = {
  goblin: {
    id: 'goblin',
    name: 'Goblin Saqueador',
    role: 'Flanqueador Veloz',
    minFloor: 1,
    baseHp: 62,
    baseDamage: 14,
    speed: 162,
    radius: 15,
    xpValue: 15,
    goldValue: 6,
    color: '#4d7c3f',
    accent: '#a3e635',
    behavior: 'flanker',
    lore: 'Ataca em movimentos diagonais rápidos tentando cercar e pressionar alvos isolados.',
  },
  skeleton: {
    id: 'skeleton',
    name: 'Esqueleto Guerreiro',
    role: 'Linha de Frente',
    minFloor: 1,
    baseHp: 98,
    baseDamage: 19,
    speed: 116,
    radius: 17,
    xpValue: 19,
    goldValue: 8,
    color: '#cbd5e1',
    accent: '#94a3b8',
    behavior: 'melee_lunge',
    lore: 'Avança com escudo erguido e executa estocadas curtas com preparação visível.',
  },
  archer: {
    id: 'archer',
    name: 'Arqueiro Sombrio',
    role: 'Atirador à Distância',
    minFloor: 1,
    baseHp: 68,
    baseDamage: 19,
    speed: 122,
    radius: 15,
    xpValue: 22,
    goldValue: 10,
    color: '#3f6212',
    accent: '#f59e0b',
    behavior: 'kiter_ranged',
    lore: 'Mantém distância segura, recua quando encurralado e marca a linha de tiro antes de disparar.',
  },
  bomber: {
    id: 'bomber',
    name: 'Incendiário Instável',
    role: 'Explosivo',
    minFloor: 3,
    baseHp: 66,
    baseDamage: 34,
    speed: 168,
    radius: 16,
    xpValue: 25,
    goldValue: 11,
    color: '#991b1b',
    accent: '#fb923c',
    behavior: 'bomber',
    lore: 'Corre em direção ao herói carregando um barril flamejante prestes a detonar.',
  },
  mage: {
    id: 'mage',
    name: 'Mago Cultista',
    role: 'Artilharia Arcana',
    minFloor: 3,
    baseHp: 82,
    baseDamage: 24,
    speed: 106,
    radius: 17,
    xpValue: 29,
    goldValue: 13,
    color: '#581c87',
    accent: '#c084fc',
    behavior: 'artillery_mage',
    lore: 'Canaliza círculos arcanos sob os pés do jogador e dispara leques de energia.',
  },
  golem: {
    id: 'golem',
    name: 'Golem de Basalto',
    role: 'Colosso Blindado',
    minFloor: 4,
    baseHp: 235,
    baseDamage: 31,
    speed: 82,
    radius: 25,
    xpValue: 44,
    goldValue: 19,
    color: '#475569',
    accent: '#f97316',
    behavior: 'heavy_stomp',
    lore: 'Possui alta resistência física e esmaga o solo com ondas de choque telegrafadas.',
  },
  healer: {
    id: 'healer',
    name: 'Acólito Restaurador',
    role: 'Suporte Curandeiro',
    minFloor: 5,
    baseHp: 96,
    baseDamage: 16,
    speed: 110,
    radius: 17,
    xpValue: 35,
    goldValue: 15,
    color: '#115e59',
    accent: '#34d399',
    behavior: 'healer',
    lore: 'Mantém-se na retaguarda canalizando pulsos restauradores para aliados feridos.',
  },
  shadow_assassin: {
    id: 'shadow_assassin',
    name: 'Assassino Umbral',
    role: 'Teleporte Furtivo',
    minFloor: 6,
    baseHp: 92,
    baseDamage: 28,
    speed: 172,
    radius: 16,
    xpValue: 38,
    goldValue: 16,
    color: '#1e1b4b',
    accent: '#a855f7',
    behavior: 'teleporter',
    lore: 'Desaparece em névoa sombria e surge atrás do alvo com um corte rápido.',
  },
  stalker: {
    id: 'stalker',
    name: 'Predador Carniceiro',
    role: 'Investida Implacável',
    minFloor: 7,
    baseHp: 146,
    baseDamage: 32,
    speed: 144,
    radius: 20,
    xpValue: 42,
    goldValue: 18,
    color: '#7f1d1d',
    accent: '#f43f5e',
    behavior: 'charger',
    lore: 'Trava mira em linha reta e dispara em investida brutal através da sala.',
  },
  summoner: {
    id: 'summoner',
    name: 'Invocador Abissal',
    role: 'Necromante Inimigo',
    minFloor: 8,
    baseHp: 118,
    baseDamage: 21,
    speed: 100,
    radius: 18,
    xpValue: 48,
    goldValue: 21,
    color: '#3b0764',
    accent: '#e879f9',
    behavior: 'summoner',
    lore: 'Conjura espectros menores continuamente enquanto evita confronto direto.',
  },
};

export const ENEMY_LIST: EnemyArchetypeDef[] = Object.values(ENEMY_ARCHETYPES);

export interface EliteModifierDef {
  id: EliteModifierId;
  name: string;
  color: string;
  hpMult: number;
  damageMult: number;
  speedMult: number;
  desc: string;
}

export const ELITE_MODIFIERS: Record<EliteModifierId, EliteModifierDef> = {
  vampiric: {
    id: 'vampiric',
    name: 'Vampírico',
    color: '#e11d48',
    hpMult: 2.1,
    damageMult: 1.35,
    speedMult: 1.08,
    desc: 'Recupera vida ao acertar ataques.',
  },
  swift: {
    id: 'swift',
    name: 'Veloz',
    color: '#38bdf8',
    hpMult: 1.85,
    damageMult: 1.25,
    speedMult: 1.38,
    desc: 'Movimento e cadência acelerados.',
  },
  armored: {
    id: 'armored',
    name: 'Blindado',
    color: '#94a3b8',
    hpMult: 2.8,
    damageMult: 1.2,
    speedMult: 0.92,
    desc: 'Carapaça reforçada que mitiga dano.',
  },
  fiery: {
    id: 'fiery',
    name: 'Ígneo',
    color: '#f97316',
    hpMult: 2.1,
    damageMult: 1.45,
    speedMult: 1.05,
    desc: 'Libera explosão de brasas ao morrer.',
  },
  frost: {
    id: 'frost',
    name: 'Glacial',
    color: '#22d3ee',
    hpMult: 2.2,
    damageMult: 1.3,
    speedMult: 1.0,
    desc: 'Golpes reduzem temporariamente sua velocidade.',
  },
  berserker: {
    id: 'berserker',
    name: 'Berserker',
    color: '#dc2626',
    hpMult: 2.0,
    damageMult: 1.5,
    speedMult: 1.18,
    desc: 'Fica ainda mais rápido quando ferido.',
  },
};

export const ELITE_MODIFIER_LIST = Object.values(ELITE_MODIFIERS);
