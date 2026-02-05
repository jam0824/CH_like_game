export const GRID_SIZE = 6;
export const MAP_WIDTH = 20;
export const MAP_HEIGHT = 12;
export const TILE_SIZE = 64;
export const FIXED_DT = 1 / 60;
export const AI_TICK = 0.1;
export const MAX_STEPS = 20;

export const CHIP_TYPES = {
  empty: { label: '空', palette: true },
  start: { label: 'START', palette: false },
  nop: { label: 'NOP', palette: true },
  enemy_exists: { label: 'Enemy?', palette: true, conditional: true },
  treasure_exists: { label: 'Treasure?', palette: true, conditional: true },
  move_to_enemy: { label: 'MoveToEnemy', palette: true },
  move_to_treasure: { label: 'MoveToTreasure', palette: true },
  attack: { label: 'Attack', palette: true },
  move_to_exit: { label: 'MoveToExit', palette: true },
};

export const CHIP_PALETTE = [
  { type: 'empty', label: 'Clear' },
  { type: 'nop', label: 'NOP' },
  { type: 'enemy_exists', label: 'Enemy?' },
  { type: 'treasure_exists', label: 'Treasure?' },
  { type: 'move_to_enemy', label: 'MoveTo' },
  { type: 'move_to_treasure', label: 'ToChest' },
  { type: 'attack', label: 'Attack' },
  { type: 'move_to_exit', label: 'Exit' },
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
