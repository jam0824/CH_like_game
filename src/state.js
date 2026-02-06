import { AI_TICK, GRID_SIZE, MAX_STEPS, CHIP_DEFS } from './config.js';
import { FLOOR_CONFIGS, getFloorConfig, TOTAL_DEPTH } from './floors.js';
import { playSfx, syncAudioToMode } from './audio.js';

function cloneParams(def) {
  const params = {};
  if (!def?.params) return params;
  Object.entries(def.params).forEach(([key, meta]) => {
    params[key] = meta.default;
  });
  return params;
}

export function createCell(type = 'empty') {
  const def = CHIP_DEFS[type];
  return {
    type,
    trueDir: null,
    falseDir: null,
    negate: false,
    params: cloneParams(def),
  };
}

export function createDefaultGrid() {
  const g = Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => createCell())
  );
  g[0][0] = createCell('start');
  g[0][0].trueDir = 'down';

  g[1][0] = createCell('nop');
  g[1][0].trueDir = 'down';

  g[2][0] = createCell('hazard_in_range');
  g[2][0].trueDir = 'right';
  g[2][0].falseDir = 'down';

  g[2][1] = createCell('evade_hazard');
  g[2][1].trueDir = 'left';

  g[3][0] = createCell('enemy_exists');
  g[3][0].trueDir = 'right';
  g[3][0].falseDir = 'down';
  g[3][0].params.r = 12;

  g[3][1] = createCell('move_to_enemy');
  g[3][1].trueDir = 'right';

  g[3][2] = createCell('attack');
  g[3][2].trueDir = 'left';

  g[4][0] = createCell('treasure_exists');
  g[4][0].trueDir = 'right';
  g[4][0].falseDir = 'down';
  g[4][0].params.r = 7;

  g[4][1] = createCell('move_to_treasure');
  g[4][1].trueDir = 'left';

  g[5][0] = createCell('exit_exists');
  g[5][0].trueDir = 'right';
  g[5][0].falseDir = 'down';
  g[5][0].params.r = 30;

  g[5][1] = createCell('move_to_exit');
  g[5][1].trueDir = 'left';

  g[6][0] = createCell('wait');
  g[6][0].trueDir = 'up';

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
    enemies: [],
    exit: null,
    traps: [],
    treasures: [],
    ai: {
      pc: { x: 0, y: 0 },
      tickTimer: 0,
      currentAction: null,
      stepCounter: 0,
      intent: null,
      prevPos: null,
      pendingAdvance: null,
      invalidStart: false,
      startPos: { x: 0, y: 0 },
    },
  };
}

export function resetRun(state) {
  state.player = {
    x: 2,
    y: 6,
    hp: 100,
    maxHp: 100,
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
  state.ai.stepCounter = 0;
  state.ai.intent = null;
  state.ai.prevPos = null;
  state.ai.pendingAdvance = null;
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
  const enemies = config.enemies || (config.enemy ? [config.enemy] : []);
  state.enemies = enemies.map((enemy, idx) => ({
    id: idx + 1,
    x: enemy.x,
    y: enemy.y,
    hp: enemy.hp,
    maxHp: enemy.hp,
    radius: 0.4,
    alive: true,
    speed: enemy.speed,
    aggroRange: enemy.aggroRange,
    attackRange: enemy.attackRange,
    attackDamage: enemy.attackDamage,
    attackCooldown: enemy.attackCooldown,
    cooldownLeft: 0,
    state: 'idle',
    wanderTimer: 0,
    wanderTarget: null,
  }));
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
  state.ai.stepCounter = 0;
  state.ai.intent = null;
  state.ai.prevPos = null;
  state.ai.pendingAdvance = null;
  state.exit.active = false;
}

export function resolveNextCell(grid, x, y, dir, dirs, startPos = { x: 0, y: 0 }) {
  if (!dir || !dirs[dir]) {
    return { ...startPos };
  }
  const nx = x + dirs[dir].x;
  const ny = y + dirs[dir].y;
  if (nx < 0 || ny < 0 || nx >= GRID_SIZE || ny >= GRID_SIZE) {
    return { ...startPos };
  }
  const nextCell = grid[ny][nx];
  if (!nextCell || nextCell.type === 'empty') {
    return { ...startPos };
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
    enemies: state.enemies.filter((enemy) => enemy.alive).map((enemy) => ({
      id: enemy.id,
      x: round2(enemy.x),
      y: round2(enemy.y),
      hp: enemy.hp,
    })),
    exit: state.exit.active ? { x: state.exit.x, y: state.exit.y } : null,
    floor: state.floorDepth,
    totalFloors: state.totalDepth,
    floorName: state.floorName,
    traps: state.traps.filter((trap) => trap.active).map((trap) => ({ x: trap.x, y: trap.y })),
    treasures: state.treasures.filter((treasure) => !treasure.opened).map((treasure) => ({ x: treasure.x, y: treasure.y })),
    gold: state.player.gold,
    branchOptions: state.mode === 'branch' ? state.branchOptions : [],
    enemyState: state.enemies.filter((enemy) => enemy.alive).map((enemy) => ({
      id: enemy.id,
      state: enemy.state,
      cooldown: round2(enemy.cooldownLeft),
    })),
    action: state.ai.currentAction
      ? { type: state.ai.currentAction.type, remaining: round2(state.ai.currentAction.remaining) }
      : null,
    stepCounter: state.ai.stepCounter,
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
