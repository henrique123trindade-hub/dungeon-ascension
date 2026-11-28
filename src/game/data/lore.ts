import type { ClassId } from '../types';

export interface ChapterDef {
  index: number; // 0..9 matching BIOMES[index]
  roman: string;
  title: string;
  region: string;
  floorRange: [number, number];
  bossId: string;
  bossName: string;
  transitionQuote: string;
  environmentSummary: string;
  mechanicName: string;
  mechanicDescription: string;
  revelation: string;
  accentColor: string;
  /** Atmospheric visual motif used by room generator & renderer */
  motif:
    | 'ruins'
    | 'caverns'
    | 'forest'
    | 'fortress'
    | 'frozen'
    | 'abyss'
    | 'temple'
    | 'shadow'
    | 'chaos'
    | 'celestial';
}

export interface BossDialogueDef {
  bossId: string;
  intro: string;
  midPhase: string;
  defeat: string;
  chronicleTitle: string;
  chronicle: string;
}

export type FragmentSource =
  | 'boss'
  | 'chest'
  | 'altar'
  | 'event'
  | 'secret_room'
  | 'exploration'
  | 'achievement';

export interface MemoryFragmentDef {
  id: string;
  order: number;
  title: string;
  era: string;
  chapterIndex: number; // 0..9
  minFloor: number;
  source: FragmentSource;
  sourceHint: string;
  bossId?: string;
  excerpt: string;
  body: string;
}

export interface TowerWhisperDef {
  id:
    | 'first_run'
    | 'first_death'
    | 'first_boss'
    | 'first_mythic'
    | 'floor_50'
    | 'floor_100'
    | 'floor_150';
  title: string;
  message: string;
}

export interface LoreChronicleEntry {
  id: string;
  title: string;
  subtitle: string;
  unlockRequirementText: string;
  minChapterUnlocked?: number;
  requiresRevelation?: number;
  requiresInfiniteAscension?: boolean;
  paragraphs: string[];
}

export interface ClassLoreEntry {
  classId: ClassId;
  epithet: string;
  isAnomaly: boolean;
  origin: string;
  lore: string;
}

export interface CinematicSceneLine {
  text: string;
  durationSec: number;
  emphasis?: 'normal' | 'accent' | 'final';
}

export interface CinematicSceneDef {
  id: string;
  theme: 'aetherion' | 'ritual' | 'tower_birth' | 'fallen' | 'awakening' | 'celestial_truth' | 'infinite';
  accentColor: string;
  secondaryColor: string;
  lines: CinematicSceneLine[];
}

export interface CinematicDef {
  id: 'intro' | 'floor100_ascension';
  title: string;
  subtitle: string;
  unlockHint: string;
  scenes: CinematicSceneDef[];
}

export const CHAPTERS: ReadonlyArray<ChapterDef> = [
  {
    index: 0,
    roman: 'CAPÍTULO I',
    title: 'Ecos de Aetherion',
    region: 'Ruínas Abandonadas',
    floorRange: [1, 10],
    bossId: 'goblin_king',
    bossName: 'Rei dos Goblins',
    transitionQuote: 'Entre pedras partidas e brasas antigas, ainda ecoam os nomes de um reino esquecido.',
    environmentSummary: 'Salões de pedra em ruínas, estandartes reais corroídos, velas fúnebres e armadilhas mecânicas.',
    mechanicName: 'Armadilhas Antigas',
    mechanicDescription: 'Placas de pressão no piso disparam lâminas antigas após um breve aviso luminoso.',
    revelation: 'As ruínas não foram erguidas por monstros: pertenciam a Aetherion, uma civilização destruída pelo Núcleo.',
    accentColor: '#d97706',
    motif: 'ruins',
  },
  {
    index: 1,
    roman: 'CAPÍTULO II',
    title: 'A Corrupção',
    region: 'Cavernas Corrompidas',
    floorRange: [11, 20],
    bossId: 'corrupted_knight',
    bossName: 'Cavaleiro Corrompido',
    transitionQuote: 'Quanto mais próximo do Núcleo, menos humana se torna a realidade.',
    environmentSummary: 'Grutas profundas rasgadas por fendas roxas e aglomerados de cristais pulsantes.',
    mechanicName: 'Cristais Instáveis',
    mechanicDescription: 'Cristais carregados detonam em área quando perturbados, ferindo inimigos e aventureiros desatentos.',
    revelation: 'O Núcleo da Ascensão nunca criou poder do nada — ele se alimenta diretamente da ambição humana.',
    accentColor: '#9333ea',
    motif: 'caverns',
  },
  {
    index: 2,
    roman: 'CAPÍTULO III',
    title: 'A Natureza Esquecida',
    region: 'Floresta Sombria',
    floorRange: [21, 30],
    bossId: 'forest_guardian',
    bossName: 'Guardião da Floresta',
    transitionQuote: 'Nem mesmo a mata viva escapou da fome silenciosa da Torre.',
    environmentSummary: 'Claras de pedra cobertas de musgo, árvores retorcidas, lampiões solitários e raízes vivas.',
    mechanicName: 'Raízes Enredantes',
    mechanicDescription: 'Manchas de raízes corrompidas desaceleram quem atravessa seu terreno.',
    revelation: 'A Torre do Abismo é capaz de arrancar e aprisionar regiões inteiras do mundo dentro de seus andares.',
    accentColor: '#10b981',
    motif: 'forest',
  },
  {
    index: 3,
    roman: 'CAPÍTULO IV',
    title: 'O Pecado dos Soberanos',
    region: 'Fortaleza Infernal',
    floorRange: [31, 40],
    bossId: 'magma_demon',
    bossName: 'Demônio de Magma',
    transitionQuote: 'Abaixo das correntes de ferro, o fogo ainda lembra o juramento quebrado dos sete.',
    environmentSummary: 'Bastiões de basalto cercados por rios de lava, grades de prisão e sigilos flamejantes.',
    mechanicName: 'Fendas de Lava',
    mechanicDescription: 'Poças e fendas vulcânicas incandescentes causam dano contínuo a quem permanecer sobre o magma.',
    revelation: 'Sete antigos soberanos conduziram um ritual proibido em busca da imortalidade — e condenaram todo o reino.',
    accentColor: '#ef4444',
    motif: 'fortress',
  },
  {
    index: 4,
    roman: 'CAPÍTULO V',
    title: 'Memórias Congeladas',
    region: 'Reino Congelado',
    floorRange: [41, 50],
    bossId: 'glacial_dragon',
    bossName: 'Dragão Glacial',
    transitionQuote: 'Aqui o tempo parou no instante exato em que a esperança congelou.',
    environmentSummary: 'Muralhas cobertas de neve, lajes de gelo espelhado, estátuas imóveis e braseiros solitários.',
    mechanicName: 'Superfícies Congeladas',
    mechanicDescription: 'Placas de gelo reduzem o atrito dos passos, criando deslizamento controlado ao mudar de direção.',
    revelation: 'A Torre preserva como relíquias vivas as memórias de todas as civilizações que consumiu.',
    accentColor: '#38bdf8',
    motif: 'frozen',
  },
  {
    index: 5,
    roman: 'CAPÍTULO VI',
    title: 'Além da Realidade',
    region: 'Abismo',
    floorRange: [51, 60],
    bossId: 'abyss_devourer',
    bossName: 'Devorador do Abismo',
    transitionQuote: 'Onde as paredes terminam, o vazio observa de volta.',
    environmentSummary: 'Plataformas suspensas sobre o éter violeta, relâmpagos dimensionais e obeliscos flutuantes.',
    mechanicName: 'Zonas Dimensionais',
    mechanicDescription: 'Fendas de energia puxam suavemente quem se aproxima, mas amplificam a cadência de ataque em sua borda.',
    revelation: 'A Torre do Abismo não pertence inteiramente à realidade conhecida — suas raízes atravessam o vazio.',
    accentColor: '#c026d3',
    motif: 'abyss',
  },
  {
    index: 6,
    roman: 'CAPÍTULO VII',
    title: 'Os Que Nunca Descansam',
    region: 'Templo dos Mortos',
    floorRange: [61, 70],
    bossId: 'king_of_dead',
    bossName: 'Rei dos Mortos',
    transitionQuote: 'Morrer aqui não é um fim. É apenas uma nova forma de servir.',
    environmentSummary: 'Criptas monumentais, sarcófagos violados, símbolos funerários e chamas espectrais verde-azuladas.',
    mechanicName: 'Almas Inquietas',
    mechanicDescription: 'Inimigos derrotados podem deixar espíritos que tentam se reerguer após um aviso espectral.',
    revelation: 'As almas de todos os Ascendentes derrotados permanecem ligadas ao Núcleo, realimentando o ciclo eterno.',
    accentColor: '#14b8a6',
    motif: 'temple',
  },
  {
    index: 7,
    roman: 'CAPÍTULO VIII',
    title: 'O Reflexo da Ambição',
    region: 'Reino das Sombras',
    floorRange: [71, 80],
    bossId: 'shadow_monarch',
    bossName: 'Monarca das Sombras',
    transitionQuote: 'Cada golpe que você aprende, as sombras observam e aperfeiçoam.',
    environmentSummary: 'Salões de obsidiana espelhada, névoa anil e pilares de eclipse que engolem a luz.',
    mechanicName: 'Véu Umbral',
    mechanicDescription: 'Criaturas das sombras alternam brevemente para camuflagem espectral com contorno cintilante.',
    revelation: 'A Torre não apenas reage: ela observa, estuda e aprende com cada Ascendente que cruza seus portões.',
    accentColor: '#6366f1',
    motif: 'shadow',
  },
  {
    index: 8,
    roman: 'CAPÍTULO IX',
    title: 'A Ruptura',
    region: 'Dimensão Caótica',
    floorRange: [81, 90],
    bossId: 'chaos_lord',
    bossName: 'Senhor do Caos',
    transitionQuote: 'Mundos colidem onde a vontade do Núcleo dobra o espaço.',
    environmentSummary: 'Fragmentos de ruínas, gelo e magma fundidos em geometria impossível sobre relâmpagos carmesim.',
    mechanicName: 'Ruptura Instável',
    mechanicDescription: 'A cada poucos segundos a sala alterna um modificador caótico que acelera o ritmo do combate.',
    revelation: 'A Torre do Abismo está conectada a incontáveis realidades — por isso Anomalias de outros mundos surgem aqui.',
    accentColor: '#f43f5e',
    motif: 'chaos',
  },
  {
    index: 9,
    roman: 'CAPÍTULO X',
    title: 'O Verdadeiro Propósito',
    region: 'Domínio Celestial',
    floorRange: [91, 100],
    bossId: 'dungeon_god',
    bossName: 'Deus da Masmorra',
    transitionQuote: 'No topo da eternidade, apenas um mortal pode suportar o peso da coroa.',
    environmentSummary: 'Templos de mármore dourado, geometria sagrada incandescente e pilares de luz ancestral.',
    mechanicName: 'Julgamento Radiante',
    mechanicDescription: 'Feixes celestiais anunciam sua área em ouro antes de descerem sobre a arena.',
    revelation: 'A Torre nunca foi uma prisão para monstros. Ela foi erguida para forjar e escolher o sucessor do Núcleo da Ascensão.',
    accentColor: '#eab308',
    motif: 'celestial',
  },
];

export const BOSS_DIALOGUES: Record<string, BossDialogueDef> = {
  goblin_king: {
    bossId: 'goblin_king',
    intro: 'Ouro, ossos e coroas... tudo o que restou de Aetherion agora pertence a mim!',
    midPhase: 'Guardas! Não deixem esse Ascendente levar o meu tesouro!',
    defeat: 'Até os reis de sucata... caem diante da fome do cristal...',
    chronicleTitle: 'O Usurpador das Ruínas',
    chronicle:
      'Quando Aetherion ruiu, saqueadores tomaram os salões superiores. Aquele que empunhou a coroa partida dos antigos nobres teve sua mente dilatada pelos resquícios do Núcleo, tornando-se o primeiro filtro dos novos Ascendentes.',
  },
  corrupted_knight: {
    bossId: 'corrupted_knight',
    intro: 'Eu também acreditei que poderia dominar esse poder.',
    midPhase: 'Sinta o peso da ambição que corrompeu minha armadura!',
    defeat: 'Siga adiante, Ascendente... mas lembre-se do preço de cada vitória.',
    chronicleTitle: 'O Juramento Partido',
    chronicle:
      'Capitão da Guarda Real de Aetherion, desceu às cavernas tentando selar o Núcleo com as próprias mãos. O cristal respondeu ao seu orgulho transformando sua devoção em fúria violeta.',
  },
  forest_guardian: {
    bossId: 'forest_guardian',
    intro: 'As raízes lembram o céu que a Torre roubou de nós.',
    midPhase: 'A floresta não se curvará a mais um invasor faminto!',
    defeat: 'Talvez... nas cinzas do Núcleo... novas folhas voltem a ver o sol.',
    chronicleTitle: 'A Sentinela Aprisionada',
    chronicle:
      'Espírito protetor do Bosque Esmeralda que cercava Aetherion. Quando a Torre expandiu suas muralhas para fora do reino, arrancou a floresta inteira do mundo físico e a fundiu em pedra viva.',
  },
  magma_demon: {
    bossId: 'magma_demon',
    intro: 'Os sete soberanos acenderam esta fornalha. Agora ela queima eternamente!',
    midPhase: 'Que sua ambição derreta nas chamas do ritual proibido!',
    defeat: 'O fogo recua... mas o pecado dos sete jamais esfriará...',
    chronicleTitle: 'A Ira da Fornalha',
    chronicle:
      'Forjado da agonia dos prisioneiros e da ganância dos sete soberanos durante o ritual de imortalidade. Cada corrente em sua fortaleza guarda um elo do pacto que partiu o reino.',
  },
  glacial_dragon: {
    bossId: 'glacial_dragon',
    intro: 'Cinquenta andares... e ainda assim ousa despertar o inverno eterno?',
    midPhase: 'Contemple os séculos congelados sob minhas asas!',
    defeat: 'O gelo racha... a Torre realmente escolheu um novo candidato.',
    chronicleTitle: 'O Guardião das Eras',
    chronicle:
      'Antigo protetor das fronteiras do norte, absorvido junto com todo um império glacial. Sua respiração preserva intactas as memórias das eras anteriores à queda de Aetherion.',
  },
  abyss_devourer: {
    bossId: 'abyss_devourer',
    intro: 'Entre um andar e outro existe o nada. E o nada tem fome.',
    midPhase: 'Sua forma mortal não pertence a este lado do véu!',
    defeat: 'Você atravessou o vazio... mas o vazio ainda caminha em você.',
    chronicleTitle: 'A Fenda Consciente',
    chronicle:
      'Não nasceu em Aetherion nem em nenhum reino conhecido. Surgiu nas rachaduras abertas quando o Núcleo perfurou a barreira entre dimensões para construir andares infinitos.',
  },
  king_of_dead: {
    bossId: 'king_of_dead',
    intro: 'Milhares de Ascendentes caíram antes de você. Todos ainda respondem ao meu chamado.',
    midPhase: 'Erguam-se, ecos de uma ambição que nunca descansou!',
    defeat: 'Finalmente... o silêncio alcança meu trono de cinzas...',
    chronicleTitle: 'O Pastor das Almas Presas',
    chronicle:
      'Um dos sete soberanos originais. Recusando-se a aceitar o fim, amarrou sua própria alma ao fluxo de retorno dos Ascendentes, governando os ecos daqueles que falharam antes do topo.',
  },
  shadow_monarch: {
    bossId: 'shadow_monarch',
    intro: 'Cada vez que você morre, a Torre aprende algo novo sobre você.',
    midPhase: 'Eu sou o reflexo de todos que chegaram quase até o fim!',
    defeat: 'Impressionante... nem mesmo sua própria sombra conseguiu detê-lo.',
    chronicleTitle: 'O Espelho dos Ascendentes',
    chronicle:
      'Criado pela própria Torre a partir das técnicas, vitórias e medos de milhares de aventureiros. Ele é a prova viva de que a masmorra estuda cada passo dado em seus corredores.',
  },
  chaos_lord: {
    bossId: 'chaos_lord',
    intro: 'A realidade aqui é apenas um rascunho mal costurado pelo Núcleo!',
    midPhase: 'Deixe que mil mundos despedaçados desabem sobre você!',
    defeat: 'Os fios do caos se abrem... suba e encare o que sempre o esperou.',
    chronicleTitle: 'O Arauto da Ruptura',
    chronicle:
      'Um feiticeiro que tentou quebrar a Torre por dentro usando fendas dimensionais. Em vez de escapar, fundiu-se à convergência de realidades que hoje permite até seres de outros universos cruzarem o Abismo.',
  },
  dungeon_god: {
    bossId: 'dungeon_god',
    intro: 'Finalmente, alguém digno de ocupar o meu lugar.',
    midPhase: 'Mostre que sua alma suporta o peso inteiro do Núcleo da Ascensão!',
    defeat: 'A provação terminou... mas a Ascensão verdadeira apenas começou.',
    chronicleTitle: 'O Primeiro Sucessor',
    chronicle:
      'Há milênios, o único sobrevivente capaz de conter o Núcleo após o colapso de Aetherion fundiu sua consciência à Torre. Desde então, testa cada geração de Ascendentes até encontrar quem possa superá-lo.',
  },
};

export const MEMORY_FRAGMENTS: ReadonlyArray<MemoryFragmentDef> = [
  {
    id: 'frag_01_aetherion_dawn',
    order: 1,
    title: 'A Era Dourada de Aetherion',
    era: 'Antes da Ruptura',
    chapterIndex: 0,
    minFloor: 1,
    source: 'exploration',
    sourceHint: 'Encontrado ao explorar as Ruínas Abandonadas (Andares 1–10).',
    excerpt: 'Nossas torres tocavam as nuvens graças à luz calma do cristal.',
    body: 'Registros gravados em pedra branca descrevem Aetherion como um reino sem inverno nem fome. No centro da cidadela repousava o Núcleo da Ascensão, um cristal ancestral cuja luz fortalecia lâminas, colheitas e mentes — até que os homens passaram a desejar mais do que precisavam.',
  },
  {
    id: 'frag_02_goblin_crown',
    order: 2,
    title: 'A Coroa Partida',
    era: 'Queda de Aetherion',
    chapterIndex: 0,
    minFloor: 10,
    source: 'boss',
    bossId: 'goblin_king',
    sourceHint: 'Obtido ao derrotar o Rei dos Goblins (Andar 10).',
    excerpt: 'Mesmo o ouro derretido ainda carrega o selo da casa real.',
    body: 'Entre os fragmentos da coroa do Rei dos Goblins há inscrições em alto aetheriano: "Nenhuma coroa sobrevive à ganância de quem a veste." As criaturas das ruínas vestem retalhos dos antigos cidadãos de Aetherion, presos em um eco deformado do reino perdido.',
  },
  {
    id: 'frag_03_three_shards',
    order: 3,
    title: 'A Lei dos Três Fragmentos',
    era: 'Tratado dos Ascendentes',
    chapterIndex: 0,
    minFloor: 2,
    source: 'chest',
    sourceHint: 'Encontrado em baús especiais na masmorra.',
    excerpt: 'Três caminhos se abrem; apenas um pode ser absorvido sem rasgar a alma.',
    body: 'Um manuscrito dobrado explica o fenômeno que os Ascendentes sentem ao subir de nível: o Núcleo oferece três ecos de poder de uma só vez. Tentar absorver todos destruiria o corpo mortal; escolher um molda não apenas a força do guerreiro, mas quem ele se tornará.',
  },
  {
    id: 'frag_04_purple_veins',
    order: 4,
    title: 'Veios de Ambição',
    era: 'Crônicas da Corrupção',
    chapterIndex: 1,
    minFloor: 11,
    source: 'exploration',
    sourceHint: 'Encontrado ao explorar as Cavernas Corrompidas (Andares 11–20).',
    excerpt: 'O cristal não brilha por si só. Ele responde ao desejo de quem o encara.',
    body: 'Os primeiros mineradores notaram que os cristais roxos pulsavam mais forte quando generais e nobres discutiam por perto. Quanto maior a sede de domínio, mais densa se tornava a energia extraída — e mais irreversível a deformação daqueles que a tocavam.',
  },
  {
    id: 'frag_05_paladin_oath',
    order: 5,
    title: 'Carta do Capitão Valerius',
    era: 'Queda de Aetherion',
    chapterIndex: 1,
    minFloor: 20,
    source: 'boss',
    bossId: 'corrupted_knight',
    sourceHint: 'Obtido ao derrotar o Cavaleiro Corrompido (Andar 20).',
    excerpt: 'Se você encontrar minha lâmina antes de mim, quebre-a.',
    body: 'A carta manchada de fuligem violeta pertenceu ao homem que se tornaria o Cavaleiro Corrompido. Ele desceu às galerias jurando proteger o povo dos sete soberanos, convencido de que sua própria vontade era incorruptível. Foi exatamente essa certeza que o Núcleo devorou.',
  },
  {
    id: 'frag_06_altar_blood',
    order: 6,
    title: 'Sussurro dos Altares',
    era: 'Ritos Proibidos',
    chapterIndex: 1,
    minFloor: 3,
    source: 'altar',
    sourceHint: 'Descoberto ao interagir com Altares de Sangue.',
    excerpt: 'A Torre oferece barganhas justas apenas para quem aceita sangrar.',
    body: 'Os altares carmesim espalhados pelos andares são extensões da vontade do Núcleo. Eles testam até onde um Ascendente está disposto a sacrificar a própria vitalidade em troca de poder imediato — a mesma tentação que derrubou os soberanos antigos.',
  },
  {
    id: 'frag_07_stolen_woods',
    order: 7,
    title: 'O Bosque Sem Céu',
    era: 'Expansão da Torre',
    chapterIndex: 2,
    minFloor: 21,
    source: 'exploration',
    sourceHint: 'Encontrado na Floresta Sombria (Andares 21–30).',
    excerpt: 'Em uma única noite, o horizonte virou parede de pedra.',
    body: 'Folhas prensadas dentro de um medalhão de bronze guardam o testemunho de druidas que viviam a quilômetros da capital. A Torre não cresceu apenas para cima ou para baixo: ela engoliu bosques, vales e santuários inteiros para alimentar seus andares intermináveis.',
  },
  {
    id: 'frag_08_ancient_root',
    order: 8,
    title: 'Coração da Raiz Ancestral',
    era: 'Expansão da Torre',
    chapterIndex: 2,
    minFloor: 30,
    source: 'boss',
    bossId: 'forest_guardian',
    sourceHint: 'Obtido ao derrotar o Guardião da Floresta (Andar 30).',
    excerpt: 'Mesmo aprisionada, a vida insiste em crescer através das rachaduras.',
    body: 'O Guardião lutou por séculos contra a expansão da pedra viva, até que suas próprias raízes se entrelaçaram às veias do Núcleo. Ao derrotá-lo, um sussurro de alívio percorre a copa escura da floresta.',
  },
  {
    id: 'frag_09_seven_crowns',
    order: 9,
    title: 'O Pacto dos Sete Soberanos',
    era: 'Noite do Ritual',
    chapterIndex: 3,
    minFloor: 31,
    source: 'exploration',
    sourceHint: 'Encontrado na Fortaleza Infernal (Andares 31–40).',
    excerpt: 'Sete tronos se ajoelharam diante do cristal, exigindo não poder, mas eternidade.',
    body: 'A placa de ferro carbonizado lista os sete monarcas que uniram seus selos ao redor do Núcleo da Ascensão. Temendo a velhice e a perda de seus impérios, iniciaram o Ritual da Imortalidade. O cristal aceitou o sacrifício — e transformou o reino inteiro na Torre do Abismo.',
  },
  {
    id: 'frag_10_magma_chains',
    order: 10,
    title: 'As Correntes da Forja',
    era: 'Noite do Ritual',
    chapterIndex: 3,
    minFloor: 40,
    source: 'boss',
    bossId: 'magma_demon',
    sourceHint: 'Obtido ao derrotar o Demônio de Magma (Andar 40).',
    excerpt: 'As correntes não prendiam o demônio. Elas prendiam a culpa dos soberanos.',
    body: 'Quando o ritual saiu de controle, os soberanos tentaram aprisionar a fenda incandescente sob uma fortaleza de ferro negro. O calor derreteu muros, guardas e coroas em uma única criatura de magma que ainda vigia o local do crime.',
  },
  {
    id: 'frag_11_frozen_chronicle',
    order: 11,
    title: 'Estátuas de Tempo Parado',
    era: 'Memórias Presas',
    chapterIndex: 4,
    minFloor: 41,
    source: 'exploration',
    sourceHint: 'Encontrado no Reino Congelado (Andares 41–50).',
    excerpt: 'Olhe de perto para os olhos de gelo: eles ainda se lembram do sol.',
    body: 'No Reino Congelado, a neve nunca derrete porque não é água comum — é memória cristalizada. A Torre congela civilizações inteiras que consumiu no passado, guardando suas técnicas de guerra e arquitetura como se fossem páginas de um arquivo vivo.',
  },
  {
    id: 'frag_12_wyrm_scale',
    order: 12,
    title: 'Escama da Geada Eterna',
    era: 'Memórias Presas',
    chapterIndex: 4,
    minFloor: 50,
    source: 'boss',
    bossId: 'glacial_dragon',
    sourceHint: 'Obtido ao derrotar o Dragão Glacial (Andar 50).',
    excerpt: 'Cinquenta degraus separam os curiosos daqueles que a Torre observa de verdade.',
    body: 'Gravada na escama translúcida do Dragão Glacial existe uma marca antiga: o selo da metade da provação. Apenas quem atravessa o inverno eterno desperta o interesse direto da consciência que habita o topo.',
  },
  {
    id: 'frag_13_void_edge',
    order: 13,
    title: 'Anotações Sobre o Vazio',
    era: 'Além do Véu',
    chapterIndex: 5,
    minFloor: 51,
    source: 'event',
    sourceHint: 'Encontrado em Fendas Dimensionais ou no Abismo (Andares 51–60).',
    excerpt: 'Os andares não estão empilhados no espaço. Estão dobrados sobre o abismo.',
    body: 'Um estudioso desaparecido calculou que a altura da Torre excede o próprio céu do mundo mortal. Ele concluiu que, a partir do quinquagésimo primeiro andar, o aventureiro não está mais sob a terra nem acima dela — está caminhando sobre dobras da realidade.',
  },
  {
    id: 'frag_14_abyss_hunger',
    order: 14,
    title: 'O Olho Sem Pálpebras',
    era: 'Além do Véu',
    chapterIndex: 5,
    minFloor: 60,
    source: 'boss',
    bossId: 'abyss_devourer',
    sourceHint: 'Obtido ao derrotar o Devorador do Abismo (Andar 60).',
    excerpt: 'A Torre respira através das fendas que rasga.',
    body: 'Os restos etéreos do Devorador revelam que a Torre precisa de energia de outros planos para sustentar seus andares infinitos. Cada fenda dimensional é uma válvula pela qual o Núcleo bebe a substância de mundos distantes.',
  },
  {
    id: 'frag_15_eternal_return',
    order: 15,
    title: 'O Ciclo do Retorno',
    era: 'Catacumbas do Núcleo',
    chapterIndex: 6,
    minFloor: 61,
    source: 'exploration',
    sourceHint: 'Encontrado no Templo dos Mortos (Andares 61–70).',
    excerpt: 'Por que você sempre acorda diante do primeiro portão?',
    body: 'Nas inscrições funerárias do Templo dos Mortos está a resposta para a ressurreição dos Ascendentes: ao tocar o primeiro fragmento de poder, sua alma fica ancorada ao Núcleo. Quando seu corpo cai, a Torre o puxa de volta ao início, preservando parte do poder para que tente novamente — mais forte.',
  },
  {
    id: 'frag_16_dead_king_seal',
    order: 16,
    title: 'Selo do Quarto Soberano',
    era: 'Catacumbas do Núcleo',
    chapterIndex: 6,
    minFloor: 70,
    source: 'boss',
    bossId: 'king_of_dead',
    sourceHint: 'Obtido ao derrotar o Rei dos Mortos (Andar 70).',
    excerpt: 'Conquistamos a imortalidade que pedimos... mas não a liberdade.',
    body: 'O anel quebrado do Rei dos Mortos comprova sua verdadeira identidade: um dos sete soberanos do ritual proibido. Ele sobreviveu à morte, mas acorrentado para sempre às catacumbas como vigia das almas que nunca conseguiram ascender.',
  },
  {
    id: 'frag_17_tower_learning',
    order: 17,
    title: 'Espelhos da Ambição',
    era: 'O Observador',
    chapterIndex: 7,
    minFloor: 71,
    source: 'exploration',
    sourceHint: 'Encontrado no Reino das Sombras (Andares 71–80).',
    excerpt: 'A cada derrota, os corredores se lembram do seu jeito de lutar.',
    body: 'Os espelhos escuros do Reino das Sombras não refletem rostos, mas padrões de combate. A Torre memoriza esquivas, sinergias e fraquezas dos Ascendentes, moldando novos desafios e guardiões para polir sua criação definitiva.',
  },
  {
    id: 'frag_18_monarch_echo',
    order: 18,
    title: 'Diário de Um Ascendente Sem Nome',
    era: 'O Observador',
    chapterIndex: 7,
    minFloor: 80,
    source: 'boss',
    bossId: 'shadow_monarch',
    sourceHint: 'Obtido ao derrotar o Monarca das Sombras (Andar 80).',
    excerpt: 'Cheguei ao oitogésimo andar e percebi que o inimigo conhecia meus pensamentos.',
    body: 'O Monarca das Sombras carrega fragmentos de centenas de heróis quase vencedores. Sua derrota prova que você não está apenas repetindo o passado — está superando todos os ecos que o precederam.',
  },
  {
    id: 'frag_19_broken_realities',
    order: 19,
    title: 'Convergência das Anomalias',
    era: 'A Ruptura',
    chapterIndex: 8,
    minFloor: 81,
    source: 'boss',
    bossId: 'chaos_lord',
    sourceHint: 'Obtido ao derrotar o Senhor do Caos (Andar 90) ou em Fendas Caóticas.',
    excerpt: 'De outros mundos caem figuras impossíveis que nem o Núcleo previu.',
    body: 'Quando a Dimensão Caótica se abre, fragmentos de realidades distantes colidem com a Torre. É através dessas rachaduras que surgem as Anomalias Dimensionais — seres cujas leis próprias desafiam até mesmo a arquitetura do Abismo.',
  },
  {
    id: 'frag_20_true_successor',
    order: 20,
    title: 'O Testamento do Núcleo',
    era: 'O Verdadeiro Propósito',
    chapterIndex: 9,
    minFloor: 100,
    source: 'boss',
    bossId: 'dungeon_god',
    sourceHint: 'Obtido ao derrotar o Deus da Masmorra (Andar 100).',
    excerpt: 'A Torre não é uma prisão. É um cadinho.',
    body: 'No coração dourado do Domínio Celestial repousa a verdade final: o Núcleo da Ascensão não pode permanecer sem um portador eterno. Cada andar, cada chefe, cada morte e cada renascimento foram arquitetados para forjar um único sucessor capaz de suportar o infinito.',
  },
];

export const LORE_CHRONICLES: ReadonlyArray<LoreChronicleEntry> = [
  {
    id: 'chronicle_aetherion',
    title: 'O Reino de Aetherion',
    subtitle: 'A Origem do Núcleo da Ascensão',
    unlockRequirementText: 'Disponível desde o início da jornada.',
    paragraphs: [
      'Há milhares de anos, o reino de Aetherion prosperava graças a uma fonte de energia conhecida como Núcleo da Ascensão — um cristal ancestral capaz de conceder poderes inimagináveis aos mortais.',
      'Reis, guerreiros e feiticeiros disputavam seu controle, sem compreender sua verdadeira natureza. O cristal nunca criava poder do vazio: ele se alimentava da ambição daqueles que o procuravam.',
    ],
  },
  {
    id: 'chronicle_ritual',
    title: 'O Ritual dos Sete Soberanos',
    subtitle: 'O Nascimento da Torre do Abismo',
    unlockRequirementText: 'Desbloqueado ao alcançar o Capítulo II ou descobrir a revelação do Capítulo IV.',
    minChapterUnlocked: 1,
    paragraphs: [
      'Em uma tentativa desesperada de alcançar a imortalidade, sete antigos soberanos realizaram um ritual proibido em torno do Núcleo da Ascensão.',
      'O ritual despedaçou Aetherion, corrompeu seus habitantes e ergueu uma estrutura impossível cujos andares se multiplicam sem fim: a Torre do Abismo.',
      'Desde aquele dia, a Torre tornou-se uma entidade viva — capaz de reconstruir seus corredores, moldar monstros e adaptar suas defesas à medida que os aventureiros se fortalecem.',
    ],
  },
  {
    id: 'chronicle_ascendants',
    title: 'Os Ascendentes e os Três Fragmentos',
    subtitle: 'Derrote. Evolua. Morra. Renasça.',
    unlockRequirementText: 'Desbloqueado ao iniciar sua primeira expedição.',
    minChapterUnlocked: 0,
    paragraphs: [
      'Aqueles que conseguem absorver fragmentos de poder das criaturas da Torre são chamados de Ascendentes.',
      'Cada Level Up é a manifestação de três fragmentos oferecidos pelo Núcleo — dos quais apenas um pode ser absorvido por vez. Quando um Ascendente tomba, sua alma retorna ao início da Torre preservando parte de sua essência.',
      'Os guardiões encontrados a cada dez andares são antigos heróis, guerreiros e soberanos que sucumbiram à própria ambição antes de alcançar o topo.',
    ],
  },
  {
    id: 'chronicle_true_purpose',
    title: 'O Segredo do Centésimo Andar',
    subtitle: 'A Verdadeira Natureza da Torre',
    unlockRequirementText: 'Selado até derrotar o Deus da Masmorra no Andar 100.',
    requiresInfiniteAscension: true,
    paragraphs: [
      'A Torre do Abismo jamais foi criada para aprisionar monstros. Os primeiros cem andares sempre foram uma provação meticulosamente construída.',
      'Desde o primeiro passo nas Ruínas Abandonadas, a Torre testou sua vontade, estudou seus golpes e fortaleceu sua alma com um único propósito: encontrar um sucessor digno de suportar todos os poderes do Núcleo da Ascensão.',
      'Além do centésimo andar começa a Ascensão Infinita — onde não existem mais limites impostos pelos antigos soberanos.',
    ],
  },
];

export const CLASS_LORE: Record<ClassId, ClassLoreEntry> = {
  warrior: {
    classId: 'warrior',
    epithet: 'Bastião das Ruínas',
    isAnomaly: false,
    origin: 'Ordem dos Escudos Partidos',
    lore: 'Descendente dos soldados que guardavam as muralhas exteriores de Aetherion. Avança contra a escuridão confiando em aço temperado e resistência inabalável.',
  },
  assassin: {
    classId: 'assassin',
    epithet: 'Lâmina do Eclipse',
    isAnomaly: false,
    origin: 'Irmandade Silenciosa',
    lore: 'Treinado nas passagens subterrâneas que sobreviveram à queda do reino. Transforma velocidade e precisão cirúrgica em sobrevivência diante de hordas implacáveis.',
  },
  mage: {
    classId: 'mage',
    epithet: 'Estudioso do Núcleo',
    isAnomaly: false,
    origin: 'Torre Arcana de Aetherion',
    lore: 'Herdeiro dos antigos arquimagos que tentaram decifrar o cristal ancestral. Canaliza fogo, raio e força arcana pura diretamente das correntes da Torre.',
  },
  necromancer: {
    classId: 'necromancer',
    epithet: 'Voz dos Caídos',
    isAnomaly: false,
    origin: 'Criptas do Retorno',
    lore: 'Compreendeu que a morte na Torre é apenas um ciclo interrompido. Invoca ecos sombrios e drena essência vital para virar a própria maldição do Núcleo contra seus guardiões.',
  },
  archer: {
    classId: 'archer',
    epithet: 'Vigia do Horizonte Perdido',
    isAnomaly: false,
    origin: 'Patrulha do Bosque Esmeralda',
    lore: 'Caçador das fronteiras que foram engolidas pela Floresta Sombria. Suas flechas perfurantes cortam a distância antes que a corrupção possa alcançá-lo.',
  },
  slatt: {
    classId: 'slatt',
    epithet: 'O Primata do Caos',
    isAnomaly: true,
    origin: 'Anomalia Dimensional · Fenda Selvagem',
    lore: 'Uma criatura de outra dimensão, cujas bananas carregam uma energia que desafia as regras da Torre. Onde o Núcleo tenta impor ordem e provação, Slatt responde com caos explosivo e instinto imprevisível.',
  },
  farid: {
    classId: 'farid',
    epithet: 'O Arauto Imortal',
    isAnomaly: true,
    origin: 'Anomalia Dimensional · Realidade Tricolor',
    lore: 'Um guerreiro de uma realidade onde a devoção gera poder sobrenatural. Sua energia tricolor e sua voz ecoam pelos corredores da masmorra, recusando-se a cair mesmo à beira da derrota.',
  },
  baldasso: {
    classId: 'baldasso',
    epithet: 'A Fúria Escarlate',
    isAnomaly: true,
    origin: 'Anomalia Dimensional · Realidade Colorada',
    lore: 'Um guerreiro cuja energia vermelha é alimentada pela paixão e rivalidade, tornando-se mais poderoso quanto mais próximo está da derrota. Suas chamas escarlates desafiam a frieza ancestral da Torre.',
  },
};

export const TOWER_WHISPERS: Record<TowerWhisperDef['id'], TowerWhisperDef> = {
  first_run: {
    id: 'first_run',
    title: 'A Torre Sussurra',
    message: 'Mais uma alma em busca de poder.',
  },
  first_death: {
    id: 'first_death',
    title: 'Eco do Retorno',
    message: 'Você retornará. Todos retornam.',
  },
  first_boss: {
    id: 'first_boss',
    title: 'A Torre Observa',
    message: 'Interessante... talvez você seja diferente.',
  },
  first_mythic: {
    id: 'first_mythic',
    title: 'Ressonância Proibida',
    message: 'Esse poder nunca deveria pertencer a um mortal.',
  },
  floor_50: {
    id: 'floor_50',
    title: 'Meio da Provação',
    message: 'Você já não é quem costumava ser.',
  },
  floor_100: {
    id: 'floor_100',
    title: 'O Trono do Núcleo',
    message: 'Bem-vindo, meu sucessor.',
  },
  floor_150: {
    id: 'floor_150',
    title: 'Ascensão Infinita',
    message: 'Até onde pretende ir?',
  },
};

export const CINEMATICS: Record<CinematicDef['id'], CinematicDef> = {
  intro: {
    id: 'intro',
    title: 'A Queda de Aetherion',
    subtitle: 'Prólogo Cinematográfico',
    unlockHint: 'Desbloqueada ao iniciar sua primeira partida.',
    scenes: [
      {
        id: 'scene_aetherion',
        theme: 'aetherion',
        accentColor: '#e3b55c',
        secondaryColor: '#9333ea',
        lines: [
          { text: 'Há séculos, uma civilização tentou alcançar o poder absoluto.', durationSec: 3.4 },
          { text: 'Em troca, perdeu tudo.', durationSec: 2.4, emphasis: 'accent' },
        ],
      },
      {
        id: 'scene_ritual',
        theme: 'ritual',
        accentColor: '#dc2626',
        secondaryColor: '#a855f7',
        lines: [
          {
            text: 'Das cinzas de seu reino nasceu uma Torre sem fim, alimentada pela ambição daqueles que ousam entrar.',
            durationSec: 4.5,
          },
        ],
      },
      {
        id: 'scene_fallen',
        theme: 'fallen',
        accentColor: '#94a3b8',
        secondaryColor: '#6366f1',
        lines: [
          { text: 'Milhares tentaram conquistá-la.', durationSec: 2.5 },
          { text: 'Nenhum retornou da mesma forma.', durationSec: 2.8, emphasis: 'accent' },
        ],
      },
      {
        id: 'scene_call',
        theme: 'tower_birth',
        accentColor: '#c084fc',
        secondaryColor: '#f59e0b',
        lines: [
          { text: 'Agora, a Torre chama por você.', durationSec: 2.7 },
          { text: 'Derrote. Evolua. Morra. Renasça.', durationSec: 3.0, emphasis: 'accent' },
        ],
      },
      {
        id: 'scene_awakening',
        theme: 'awakening',
        accentColor: '#f8e3a8',
        secondaryColor: '#b83232',
        lines: [
          { text: 'Ultrapasse os limites da própria existência.', durationSec: 2.8 },
          { text: 'A ascensão começa agora.', durationSec: 3.0, emphasis: 'final' },
        ],
      },
    ],
  },
  floor100_ascension: {
    id: 'floor100_ascension',
    title: 'O Verdadeiro Propósito',
    subtitle: 'Revelação do Andar 100 · Ascensão Infinita',
    unlockHint: 'Desbloqueada ao derrotar o Deus da Masmorra no Andar 100.',
    scenes: [
      {
        id: 'f100_shatter',
        theme: 'celestial_truth',
        accentColor: '#facc15',
        secondaryColor: '#c084fc',
        lines: [
          { text: 'O guardião do Domínio Celestial se desfaz em luz dourada.', durationSec: 3.2 },
          { text: 'O Núcleo da Ascensão enfim revela sua verdadeira voz.', durationSec: 3.2 },
        ],
      },
      {
        id: 'f100_revelation',
        theme: 'awakening',
        accentColor: '#f8e3a8',
        secondaryColor: '#9333ea',
        lines: [
          {
            text: 'Você acreditava estar conquistando a Torre. Mas, desde o primeiro andar, era ela quem estava preparando você.',
            durationSec: 5.2,
            emphasis: 'accent',
          },
        ],
      },
      {
        id: 'f100_infinite',
        theme: 'infinite',
        accentColor: '#e879f9',
        secondaryColor: '#eab308',
        lines: [
          { text: 'Os primeiros cem andares eram apenas a provação.', durationSec: 3.0 },
          { text: 'Ascensão Infinita Desbloqueada.', durationSec: 3.2, emphasis: 'final' },
        ],
      },
    ],
  },
};

export function getChapterForFloor(floor: number): ChapterDef {
  const safeFloor = Math.max(1, Math.floor(floor));
  const idx = Math.floor((safeFloor - 1) / 10) % CHAPTERS.length;
  return CHAPTERS[idx];
}

export function getChapterByIndex(index: number): ChapterDef {
  const safeIdx = Math.max(0, Math.min(CHAPTERS.length - 1, Math.floor(index)));
  return CHAPTERS[safeIdx];
}

export function getBossDialogue(bossId: string): BossDialogueDef | null {
  return BOSS_DIALOGUES[bossId] ?? null;
}

export function getMemoryFragmentById(id: string): MemoryFragmentDef | undefined {
  return MEMORY_FRAGMENTS.find((f) => f.id === id);
}
