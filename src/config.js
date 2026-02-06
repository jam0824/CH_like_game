export const GRID_SIZE = 12;
export const MAP_WIDTH = 20;
export const MAP_HEIGHT = 12;
export const MAX_DUNGEON_RANGE = (MAP_WIDTH - 1) + (MAP_HEIGHT - 1);
export const TILE_SIZE = 64;
export const FIXED_DT = 1 / 60;
export const AI_TICK = 0.1;
export const MAX_STEPS = 36;
export const MAX_DEPTH = 20;
export const BOSS_INTERVAL = 5;
export const INTERMISSION_HEAL_BASE = 0.35;

export const R_PRESETS = [1, 2, 3, 4, 6, 8, 'max'];
export const TIME_PRESETS = [0.1, 0.3, 0.5, 1.0, 2.0, 3.0, 5.0];
export const PCT_PRESETS = [20, 30, 50, 70];

export const RUN_BUFF_DEFS = {
  heal: {
    type: 'heal',
    label: '緊急修復',
    desc: 'HPを25回復',
    amount: 25,
  },
  attack: {
    type: 'attack',
    label: '強打回路',
    desc: '攻撃力 +1（ラン中）',
    amount: 1,
  },
  speed: {
    type: 'speed',
    label: '機動制御',
    desc: '移動速度 +5%（ラン中）',
    amount: 0.05,
  },
};

export const STAR_WEIGHT_TABLE = [
  { minDepth: 1, maxDepth: 3, weights: { 1: 50, 2: 35, 3: 15 } },
  { minDepth: 6, maxDepth: 8, weights: { 1: 15, 2: 45, 3: 30, 4: 10 } },
  { minDepth: 11, maxDepth: 13, weights: { 2: 35, 3: 35, 4: 20, 5: 10 } },
  { minDepth: 16, maxDepth: 18, weights: { 2: 15, 3: 35, 4: 30, 5: 20 } },
];

export const TYPE_WEIGHT_TABLE = [
  { minDepth: 1, maxDepth: 3, weights: { combat: 55, chest: 25, trap: 20, elite: 0 } },
  { minDepth: 6, maxDepth: 8, weights: { combat: 45, chest: 25, trap: 20, elite: 10 } },
  { minDepth: 11, maxDepth: 13, weights: { combat: 40, chest: 20, trap: 20, elite: 20 } },
  { minDepth: 16, maxDepth: 18, weights: { combat: 35, chest: 15, trap: 20, elite: 30 } },
];

export const TB_PARAMS = {
  base: 12,
  perDepth: 0.24,
  starMultiplier: {
    1: 0.85,
    2: 1.0,
    3: 1.1,
    4: 1.25,
    5: 1.4,
  },
  typeMultiplier: {
    combat: 1.0,
    chest: 0.85,
    trap: 0.8,
    elite: 1.0,
  },
};

export const CHIP_DEFS = {
  start: {
    label: 'START',
    icon: 'start',
    tag: 'Instant',
    kind: 'basic',
    conditional: false,
    params: {},
    desc: '開始チップ（PCの初期位置/戻り先）',
  },
  nop: {
    label: 'NOP',
    icon: 'nop',
    tag: 'Instant',
    kind: 'basic',
    conditional: false,
    params: {},
    desc: '道（処理なし）',
  },
  enemy_exists: {
    label: 'EnemyExists',
    icon: 'enemy',
    tag: 'Instant',
    kind: 'cond',
    conditional: true,
    params: {
      r: { label: 'R（ダンジョンタイル）', type: 'range', default: 4, min: 1, max: MAX_DUNGEON_RANGE, step: 1, presets: R_PRESETS },
    },
    desc: 'R以内に敵が存在する',
  },
  treasure_exists: {
    label: 'TreasureExists',
    icon: 'chest',
    tag: 'Instant',
    kind: 'cond',
    conditional: true,
    params: {
      r: { label: 'R（ダンジョンタイル）', type: 'range', default: 4, min: 1, max: MAX_DUNGEON_RANGE, step: 1, presets: R_PRESETS },
    },
    desc: 'R以内に宝箱が存在する',
  },
  exit_exists: {
    label: 'ExitExists',
    icon: 'exit',
    tag: 'Instant',
    kind: 'cond',
    conditional: true,
    params: {
      r: { label: 'R（ダンジョンタイル）', type: 'range', default: 6, min: 1, max: MAX_DUNGEON_RANGE, step: 1, presets: R_PRESETS },
    },
    desc: 'R以内に出口が存在する',
  },
  hazard_on_self: {
    label: 'HazardOnSelf',
    icon: 'hazard',
    tag: 'Instant',
    kind: 'cond',
    conditional: true,
    params: {},
    desc: '自分の足元が危険か',
  },
  hazard_in_range: {
    label: 'HazardInRange',
    icon: 'hazard',
    tag: 'Instant',
    kind: 'cond',
    conditional: true,
    params: {
      r: { label: 'R（ダンジョンタイル）', type: 'range', default: 2, min: 1, max: MAX_DUNGEON_RANGE, step: 1, presets: R_PRESETS },
    },
    desc: 'R以内に危険が存在する',
  },
  move_to_enemy: {
    label: 'MoveToEnemy',
    icon: 'move',
    tag: 'Yield',
    kind: 'act',
    conditional: false,
    params: {},
    desc: '敵へ移動（0.1s）',
  },
  move_to_treasure: {
    label: 'MoveToTreasure',
    icon: 'move',
    tag: 'Yield',
    kind: 'act',
    conditional: false,
    params: {},
    desc: '宝箱へ移動（0.1s）',
  },
  move_to_exit: {
    label: 'MoveToExit',
    icon: 'move',
    tag: 'Yield',
    kind: 'act',
    conditional: false,
    params: {},
    desc: '出口へ移動（0.1s）',
  },
  evade_hazard: {
    label: 'EvadeHazard',
    icon: 'evade',
    tag: 'Yield',
    kind: 'act',
    conditional: false,
    params: {},
    desc: '危険回避（1手）',
  },
  wait: {
    label: 'Wait',
    icon: 'wait',
    tag: 'Running',
    kind: 'act',
    conditional: false,
    params: {
      t: { label: 't（秒）', type: 'range', default: 0.5, min: 0.1, max: 5, step: 0.1, presets: TIME_PRESETS },
    },
    desc: '指定時間だけ思考停止',
  },
  self_hp: {
    label: 'SelfHP',
    icon: 'hp',
    tag: 'Instant',
    kind: 'cond',
    conditional: true,
    params: {
      op: { label: '比較', type: 'select', default: '<', options: ['<', '<=', '==', '!=', '>=', '>'] },
      value: { label: 'HP%', type: 'range', default: 50, min: 0, max: 100, step: 1, presets: PCT_PRESETS },
    },
    desc: 'HP%を比較',
  },
  attack: {
    label: 'Attack',
    icon: 'attack',
    tag: 'Running',
    kind: 'act',
    conditional: false,
    params: {},
    desc: '攻撃',
  },
};

export const PALETTE_SECTIONS = [
  {
    title: 'スターター',
    open: true,
    chips: [
      'start',
      'nop',
      'enemy_exists',
      'treasure_exists',
      'exit_exists',
      'hazard_on_self',
      'hazard_in_range',
      'move_to_treasure',
      'move_to_exit',
      'evade_hazard',
      'wait',
      'self_hp',
    ],
  },
  {
    title: '基本',
    open: false,
    chips: ['start', 'nop'],
  },
  {
    title: '行動（ACT）',
    open: false,
    chips: ['move_to_treasure', 'move_to_exit', 'evade_hazard', 'move_to_enemy', 'attack', 'wait'],
  },
  {
    title: '条件：世界センサー',
    open: false,
    chips: ['enemy_exists', 'treasure_exists', 'exit_exists', 'hazard_on_self', 'hazard_in_range'],
  },
  {
    title: '条件：自機状態',
    open: false,
    chips: ['self_hp'],
  },
  {
    title: 'Advanced / Coming Soon',
    open: false,
    chips: ['attack'],
  },
];

export const ASSET_PATHS = {
  floor: 'assets/tiles/floor.png',
  exit: 'assets/tiles/exit.png',
  trap: 'assets/tiles/trap.png',
  treasure: 'assets/tiles/treasure.png',
  player: 'assets/sprites/player.png',
  enemy: 'assets/sprites/enemy.png',
  chips: {
    start: 'assets/chips/start.png',
    nop: 'assets/chips/nop.png',
    enemy_exists: 'assets/chips/enemy_exists.png',
    treasure_exists: 'assets/chips/treasure_exists.png',
    move_to_enemy: 'assets/chips/move_to_enemy.png',
    move_to_treasure: 'assets/chips/move_to_treasure.png',
    attack: 'assets/chips/attack.png',
    move_to_exit: 'assets/chips/move_to_exit.png',
  },
};

export const DIRS = {
  up: { x: 0, y: -1, symbol: '↑' },
  right: { x: 1, y: 0, symbol: '→' },
  down: { x: 0, y: 1, symbol: '↓' },
  left: { x: -1, y: 0, symbol: '←' },
};
