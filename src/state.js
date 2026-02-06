import { AI_TICK, GRID_SIZE, MAX_STEPS, CHIP_DEFS, MAX_DEPTH, INTERMISSION_HEAL_BASE } from './config.js';
import { generateFloor } from './floors.js';
import { playSfx, syncAudioToMode } from './audio.js';

function cloneParams(def) {
  const params = {};
  if (!def?.params) return params;
  Object.entries(def.params).forEach(([key, meta]) => {
    params[key] = meta.default;
  });
  return params;
}

function randomSeed() {
  return Math.floor(Math.random() * 1_000_000_000);
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
  g[5][0].falseDir = 'up';
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
    floorDepth: 1,
    totalDepth: MAX_DEPTH,
    floorName: 'Depth 1',
    floorKind: 'normal',
    floorType: 'combat',
    floorStar: 1,
    floorTag: '',
    floorElapsed: 0,
    branchOptions: [],
    rewardOptions: [],
    intermission: {
      healRate: INTERMISSION_HEAL_BASE,
      healed: false,
      healAmount: 0,
    },
    run: {
      seed: randomSeed(),
      depth: 1,
      maxDepth: MAX_DEPTH,
      pendingBranch: null,
      pendingReward: null,
      buffs: {
        attack: 0,
        speedSteps: 0,
      },
    },
    player: null,
    enemies: [],
    exit: null,
    traps: [],
    treasures: [],
    hazards: [],
    hazardSeq: 0,
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
  state.run.seed = randomSeed();
  state.run.depth = 1;
  state.run.maxDepth = MAX_DEPTH;
  state.run.pendingBranch = null;
  state.run.pendingReward = null;
  state.run.buffs.attack = 0;
  state.run.buffs.speedSteps = 0;

  state.player = {
    x: 2,
    y: 6,
    hp: 220,
    maxHp: 220,
    baseSpeed: 3.2,
    speed: 3.2,
    radius: 0.35,
    attackRange: 1.4,
    baseAttackDamage: 20,
    attackDamage: 20,
    attackDuration: 0.4,
    gold: 0,
  };
  state.mode = 'idle';
  state.time = 0;
  state.branchOptions = [];
  state.rewardOptions = [];
  state.hazards = [];
  state.hazardSeq = 0;
  loadFloor(state, 1, null);
}

function mapEnemy(enemy, idx) {
  return {
    id: idx + 1,
    type: enemy.type || 'melee',
    bossProfile: enemy.bossProfile || null,
    role: enemy.role || 'normal',
    behavior: enemy.behavior || 'melee',
    x: enemy.x,
    y: enemy.y,
    hp: enemy.hp,
    maxHp: enemy.maxHp ?? enemy.hp,
    def: enemy.def || 0,
    radius: enemy.radius || (enemy.role === 'boss' ? 0.6 : 0.4),
    alive: true,
    speed: enemy.speed,
    aggroRange: enemy.aggroRange,
    attackRange: enemy.attackRange,
    attackDamage: enemy.attackDamage,
    attackCooldown: enemy.attackCooldown,
    cooldownLeft: enemy.cooldownLeft || 0,
    minRange: enemy.minRange || 0,
    state: enemy.state || 'idle',
    wanderTimer: enemy.wanderTimer || 0,
    wanderTarget: enemy.wanderTarget || null,
    skillCooldowns: enemy.skillCooldowns || {
      sweep: 0,
      stomp: 0,
      dash: 0,
    },
    bossFlags: enemy.bossFlags || {
      requireBasicAfterBig: false,
      lastBigSkill: null,
      phase: 1,
      transitionDone: false,
    },
    cast: null,
  };
}

export function loadFloor(state, depth, branchChoice = null) {
  const config = generateFloor(depth, state.run.seed, branchChoice);
  state.run.depth = config.depth;
  state.floorDepth = config.depth;
  state.totalDepth = state.run.maxDepth;
  state.floorName = config.name;
  state.floorKind = config.floorKind;
  state.floorType = config.floorType;
  state.floorStar = config.star || 0;
  state.floorTag = config.tag || '';
  state.floorElapsed = 0;

  state.branchOptions = [];
  state.rewardOptions = [];
  state.intermission = {
    healRate: config.intermission?.healRate ?? INTERMISSION_HEAL_BASE,
    healed: false,
    healAmount: 0,
  };

  state.player.x = config.spawn.x;
  state.player.y = config.spawn.y;

  state.enemies = (config.enemies || []).map((enemy, idx) => mapEnemy(enemy, idx));
  state.exit = {
    x: config.exit.x,
    y: config.exit.y,
    active: Boolean(config.exitActiveStart),
  };
  state.traps = (config.traps || []).map((trap, idx) => ({
    id: idx + 1,
    type: trap.type || 'bomb_rune',
    x: trap.x,
    y: trap.y,
    damage: trap.damage,
    active: true,
    telegraph: trap.telegraph ?? 0.8,
    activeDuration: trap.activeDuration ?? 0.14,
    cooldown: trap.cooldown ?? 4.0,
    timer: trap.timer ?? 1.2,
  }));
  state.treasures = (config.treasures || []).map((treasure, idx) => ({
    id: idx + 1,
    x: treasure.x,
    y: treasure.y,
    opened: false,
    gold: treasure.gold,
  }));
  state.hazards = [];
  state.hazardSeq = 0;

  state.ai.pc = { x: 0, y: 0 };
  state.ai.tickTimer = 0;
  state.ai.currentAction = null;
  state.ai.stepCounter = 0;
  state.ai.intent = null;
  state.ai.prevPos = null;
  state.ai.pendingAdvance = null;
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
    player: {
      x: round2(state.player.x),
      y: round2(state.player.y),
      hp: state.player.hp,
      maxHp: state.player.maxHp,
      atk: round2(state.player.attackDamage),
      speed: round2(state.player.speed),
    },
    enemies: state.enemies.filter((enemy) => enemy.alive).map((enemy) => ({
      id: enemy.id,
      type: enemy.type,
      role: enemy.role,
      x: round2(enemy.x),
      y: round2(enemy.y),
      hp: enemy.hp,
    })),
    exit: state.exit.active ? { x: state.exit.x, y: state.exit.y } : null,
    depth: state.floorDepth,
    totalDepth: state.totalDepth,
    floorName: state.floorName,
    floorKind: state.floorKind,
    floorType: state.floorType,
    star: state.floorStar,
    tag: state.floorTag,
    traps: state.traps.filter((trap) => trap.active).map((trap) => ({ x: trap.x, y: trap.y })),
    treasures: state.treasures.filter((treasure) => !treasure.opened).map((treasure) => ({ x: treasure.x, y: treasure.y })),
    hazards: state.hazards.map((hazard) => ({
      id: hazard.id,
      source: hazard.source,
      shape: hazard.shape,
      phase: hazard.phase,
      x: round2(hazard.x ?? (hazard.x1 + hazard.x2) * 0.5),
      y: round2(hazard.y ?? (hazard.y1 + hazard.y2) * 0.5),
      r: round2(hazard.radius || 0),
      remaining: round2(hazard.remaining),
    })),
    gold: state.player.gold,
    branchOptions: state.mode === 'branch' ? state.branchOptions : [],
    rewardOptions: state.mode === 'reward' ? state.rewardOptions : [],
    intermission: state.mode === 'intermission' ? state.intermission : null,
    buffs: { ...state.run.buffs },
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
