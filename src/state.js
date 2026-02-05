import { AI_TICK, GRID_SIZE, MAX_STEPS } from './config.js';
import { FLOOR_CONFIGS, getFloorConfig, TOTAL_DEPTH } from './floors.js';
import { playSfx, syncAudioToMode } from './audio.js';

export function createCell(type = 'empty') {
  return {
    type,
    trueDir: null,
    falseDir: null,
    negate: false,
  };
}

export function createDefaultGrid() {
  const g = Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => createCell())
  );
  g[0][0] = createCell('start');
  g[0][0].trueDir = 'right';

  g[0][1] = createCell('enemy_exists');
  g[0][1].trueDir = 'right';
  g[0][1].falseDir = 'down';

  g[0][2] = createCell('move_to_enemy');
  g[0][2].trueDir = 'right';

  g[0][3] = createCell('attack');
  g[0][3].trueDir = 'up';

  g[1][1] = createCell('treasure_exists');
  g[1][1].trueDir = 'right';
  g[1][1].falseDir = 'down';

  g[1][2] = createCell('move_to_treasure');
  g[1][2].trueDir = 'left';

  g[2][1] = createCell('move_to_exit');
  g[2][1].trueDir = 'down';
  return g;
}

export function createInitialState() {
  return {
    mode: 'idle',
    time: 0,
    floorIndex: 0,
    floorDepth: 1,
    totalDepth: TOTAL_DEPTH,
    floorName: FLOOR_CONFIGS[0]?.name || 'F1',
    branchOptions: [],
    player: null,
    enemy: null,
    exit: null,
    traps: [],
    treasures: [],
    ai: {
      pc: { x: 0, y: 0 },
      tickTimer: 0,
      currentAction: null,
      stepCounter: 0,
    },
  };
}

export function resetRun(state) {
  state.player = {
    x: 2,
    y: 6,
    hp: 100,
    speed: 3.0,
    radius: 0.35,
    attackRange: 1.2,
    attackDamage: 10,
    attackDuration: 0.4,
    gold: 0,
  };
  state.mode = 'idle';
  state.time = 0;
  state.ai.pc = { x: 0, y: 0 };
  state.ai.tickTimer = 0;
  state.ai.currentAction = null;
  loadFloor(state, 0);
}

export function loadFloor(state, index) {
  const config = getFloorConfig(index);
  if (!config) return;
  state.floorIndex = index;
  state.floorDepth = config.depth;
  state.totalDepth = TOTAL_DEPTH;
  state.floorName = config.name;
  state.branchOptions = [];
  state.player.x = config.spawn.x;
  state.player.y = config.spawn.y;
  state.enemy = {
    x: config.enemy.x,
    y: config.enemy.y,
    hp: config.enemy.hp,
    radius: 0.4,
    alive: true,
    speed: config.enemy.speed,
    aggroRange: config.enemy.aggroRange,
    attackRange: config.enemy.attackRange,
    attackDamage: config.enemy.attackDamage,
    attackCooldown: config.enemy.attackCooldown,
    cooldownLeft: 0,
    state: 'idle',
  };
  state.exit = {
    x: config.exit.x,
    y: config.exit.y,
    active: false,
  };
  state.traps = config.traps.map((trap) => ({
    x: trap.x,
    y: trap.y,
    damage: trap.damage,
    active: true,
  }));
  state.treasures = config.treasures.map((treasure) => ({
    x: treasure.x,
    y: treasure.y,
    opened: false,
    gold: treasure.gold,
  }));
  state.ai.pc = { x: 0, y: 0 };
  state.ai.tickTimer = 0;
  state.ai.currentAction = null;
  state.exit.active = false;
}

export function resolveNextCell(grid, x, y, dir, dirs) {
  if (!dir || !dirs[dir]) {
    return { x: 0, y: 0 };
  }
  const nx = x + dirs[dir].x;
  const ny = y + dirs[dir].y;
  if (nx < 0 || ny < 0 || nx >= GRID_SIZE || ny >= GRID_SIZE) {
    return { x: 0, y: 0 };
  }
  const nextCell = grid[ny][nx];
  if (!nextCell || nextCell.type === 'empty') {
    return { x: 0, y: 0 };
  }
  return { x: nx, y: ny };
}

export function round2(value) {
  return Math.round(value * 100) / 100;
}

export function serializeState(state) {
  return {
    mode: state.mode,
    note: 'origin top-left, +x right, +y down, units=tiles',
    pc: { x: state.ai.pc.x, y: state.ai.pc.y },
    player: { x: round2(state.player.x), y: round2(state.player.y), hp: state.player.hp },
    enemy: state.enemy.alive
      ? { x: round2(state.enemy.x), y: round2(state.enemy.y), hp: state.enemy.hp }
      : null,
    exit: state.exit.active ? { x: state.exit.x, y: state.exit.y } : null,
    floor: state.floorDepth,
    totalFloors: state.totalDepth,
    floorName: state.floorName,
    traps: state.traps.filter((trap) => trap.active).map((trap) => ({ x: trap.x, y: trap.y })),
    treasures: state.treasures.filter((treasure) => !treasure.opened).map((treasure) => ({ x: treasure.x, y: treasure.y })),
    gold: state.player.gold,
    branchOptions: state.mode === 'branch' ? state.branchOptions : [],
    enemyState: state.enemy.alive
      ? { state: state.enemy.state, cooldown: round2(state.enemy.cooldownLeft) }
      : null,
    action: state.ai.currentAction
      ? { type: state.ai.currentAction.type, remaining: round2(state.ai.currentAction.remaining) }
      : null,
  };
}

export function onModeChange(state, newMode, updateStatus, updateOverlay) {
  if (state.mode === newMode) return;
  state.mode = newMode;
  updateStatus?.();
  updateOverlay?.();
  syncAudioToMode(state.mode);
  if (state.mode === 'clear') {
    playSfx('clear');
  }
  if (state.mode === 'gameover') {
    playSfx('gameover');
  }
}

export { AI_TICK, MAX_STEPS };
