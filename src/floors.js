import {
  MAP_WIDTH,
  MAP_HEIGHT,
  MAX_DEPTH,
  BOSS_INTERVAL,
  INTERMISSION_HEAL_BASE,
  STAR_WEIGHT_TABLE,
  TYPE_WEIGHT_TABLE,
  TB_PARAMS,
} from './config.js';

const FLOOR_TYPE_LABELS = {
  combat: '戦闘',
  chest: '宝箱',
  trap: '罠',
  elite: 'エリート',
};

const FLOOR_TYPE_TAGS = {
  combat: 'バランス型',
  chest: '報酬寄り',
  trap: '危険地帯',
  elite: '高難易度',
};

const ENEMY_ARCHETYPES = {
  melee: {
    cost: 1.0,
    hpBase: 22,
    atkBase: 10,
    speed: 2.35,
    aggroRange: 7.4,
    attackRange: 1.25,
    attackCooldown: 1.2,
    behavior: 'melee',
  },
  ranged: {
    cost: 1.2,
    hpBase: 18,
    atkBase: 9,
    speed: 2.5,
    aggroRange: 9.2,
    attackRange: 5.8,
    attackCooldown: 1.6,
    behavior: 'ranged',
    minRange: 2.2,
  },
};

const BOSS_BASE = {
  5: { hpBase: 320, atkBase: 16, defBase: 7, speed: 2.9, name: 'Boss: Champion' },
  10: { hpBase: 480, atkBase: 15, defBase: 5, speed: 2.8, name: 'Boss: Sniper' },
  15: { hpBase: 680, atkBase: 15, defBase: 6, speed: 3.0, name: 'Boss: Vanguard' },
  20: { hpBase: 920, atkBase: 12, defBase: 9, speed: 2.7, name: 'Boss: Dominator' },
};

const NORMAL_COUNTS = {
  combat: { traps: 1, treasures: 1 },
  chest: { traps: 2, treasures: 3 },
  trap: { traps: 3, treasures: 1 },
  elite: { traps: 1, treasures: 1 },
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hashString(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function createRng(seed, depth, salt = '') {
  return mulberry32(hashString(`${seed}:${depth}:${salt}`));
}

function pickWeighted(rng, weights) {
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  if (!entries.length) return null;
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = rng() * total;
  for (const [key, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

function pickTableForDepth(table, depth) {
  const exact = table.find((item) => depth >= item.minDepth && depth <= item.maxDepth);
  if (exact) return exact.weights;
  const past = table.filter((item) => depth >= item.minDepth).pop();
  if (past) return past.weights;
  return table[0].weights;
}

function hpMultiplier(depth) {
  return 8 ** ((depth - 1) / (MAX_DEPTH - 1));
}

function atkMultiplier(depth) {
  return 5 ** ((depth - 1) / (MAX_DEPTH - 1));
}

function trapMultiplier(depth) {
  return 3 ** ((depth - 1) / (MAX_DEPTH - 1));
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function randomPoint(rng, minX, maxX, minY, maxY) {
  return {
    x: Math.round(minX + rng() * (maxX - minX)),
    y: Math.round(minY + rng() * (maxY - minY)),
  };
}

function pickPoi(rng, used, spawn, minDistance = 3.2, bounds = { minX: 5, maxX: MAP_WIDTH - 3, minY: 2, maxY: MAP_HEIGHT - 3 }) {
  for (let i = 0; i < 48; i += 1) {
    const point = randomPoint(rng, bounds.minX, bounds.maxX, bounds.minY, bounds.maxY);
    if (dist(point, spawn) < minDistance) continue;
    if (used.some((item) => dist(point, item) < 1.6)) continue;
    used.push(point);
    return point;
  }
  const fallback = { x: bounds.maxX, y: Math.round((bounds.minY + bounds.maxY) / 2) };
  used.push(fallback);
  return fallback;
}

function buildEnemy(kind, depth, x, y, bonus = { hpMul: 1, atkMul: 1, speedMul: 1 }) {
  const base = ENEMY_ARCHETYPES[kind];
  let hp = Math.max(10, Math.round(base.hpBase * hpMultiplier(depth) * bonus.hpMul));
  let atk = Math.max(2, Math.round(base.atkBase * atkMultiplier(depth) * bonus.atkMul));
  let aggroRange = base.aggroRange;
  let attackCooldown = base.attackCooldown;
  if (depth <= 5) {
    hp = Math.max(8, Math.round(hp * 0.55));
    atk = 1;
    aggroRange *= 0.7;
    attackCooldown += 0.8;
  }
  return {
    type: kind,
    role: 'normal',
    behavior: base.behavior,
    x,
    y,
    hp,
    maxHp: hp,
    speed: base.speed * bonus.speedMul,
    aggroRange,
    attackRange: base.attackRange,
    attackDamage: atk,
    attackCooldown,
    minRange: base.minRange || 0,
    cooldownLeft: 0,
    state: 'idle',
    wanderTimer: 0,
    wanderTarget: null,
  };
}

function floorTypeForDepth(rng, depth) {
  const weights = { ...pickTableForDepth(TYPE_WEIGHT_TABLE, depth) };
  return pickWeighted(rng, weights) || 'combat';
}

function starForDepth(rng, depth) {
  const weights = pickTableForDepth(STAR_WEIGHT_TABLE, depth);
  return Number(pickWeighted(rng, weights) || 2);
}

function makeClusterBudgets(total, clusterCount) {
  const shares = clusterCount === 3 ? [0.45, 0.35, 0.2] : [0.6, 0.4];
  return shares.map((share) => total * share);
}

function spawnEnemiesForBudget(rng, depth, clusterCenter, budget, allowKinds, spawnPos) {
  const list = [];
  let rest = budget;
  const used = [];
  const weighted = allowKinds.reduce((acc, kind) => {
    acc[kind] = 1;
    return acc;
  }, {});

  while (rest >= 0.95 && list.length < 12) {
    const kind = pickWeighted(rng, weighted);
    if (!kind) break;
    const cost = ENEMY_ARCHETYPES[kind].cost;
    if (cost > rest + 0.25) {
      weighted[kind] *= 0.6;
      if (Object.values(weighted).every((w) => w < 0.05)) break;
      continue;
    }
    const point = pickPoi(
      rng,
      used,
      spawnPos,
      3.2,
      {
        minX: clamp(clusterCenter.x - 2, 6, MAP_WIDTH - 3),
        maxX: clamp(clusterCenter.x + 2, 6, MAP_WIDTH - 3),
        minY: clamp(clusterCenter.y - 2, 2, MAP_HEIGHT - 3),
        maxY: clamp(clusterCenter.y + 2, 2, MAP_HEIGHT - 3),
      }
    );
    list.push(buildEnemy(kind, depth, point.x, point.y));
    rest -= cost;
  }
  if (!list.length) {
    list.push(buildEnemy('melee', depth, clusterCenter.x, clusterCenter.y));
  }
  return list;
}

function buildNormalFloor(depth, seed, selected) {
  const rng = createRng(seed, depth, `normal:${selected?.id || selected?.floorType || 'auto'}`);
  const spawn = { x: 2, y: 6 };
  if (depth === 1 && !selected) {
    return {
      id: 'D1_fixed',
      depth: 1,
      floorKind: 'normal',
      floorType: 'combat',
      star: 1,
      tag: FLOOR_TYPE_TAGS.combat,
      name: 'Depth 1: 戦闘 ★1',
      spawn,
      enemies: [
        buildEnemy('melee', depth, 14, 6),
        buildEnemy('ranged', depth, 16, 3),
      ],
      traps: [
        {
          type: 'bomb_rune',
          x: 8,
          y: 4,
          damage: 8,
          telegraph: 0.8,
          activeDuration: 0.14,
          cooldown: 4.0,
          timer: 1.6,
        },
      ],
      treasures: [
        { x: 6, y: 9, gold: 18 },
      ],
      exit: { x: MAP_WIDTH - 2, y: 6 },
      exitActiveStart: false,
    };
  }
  const floorType = selected?.floorType || (depth === 1 ? 'combat' : floorTypeForDepth(rng, depth));
  const star = selected?.star ?? (depth === 1 ? 1 : starForDepth(rng, depth));
  const tbBase = TB_PARAMS.base + TB_PARAMS.perDepth * (depth - 1);
  const tb = tbBase * (TB_PARAMS.starMultiplier[star] || 1) * (TB_PARAMS.typeMultiplier[floorType] || 1);
  const effectiveTb = Math.max(2.4, tb * 0.3);
  const allowKinds = depth <= 5 ? ['melee', 'ranged'] : ['melee', 'ranged'];
  const usedPoi = [];
  const enemies = [];

  if (floorType === 'elite' && depth >= 6) {
    const eliteSpot = pickPoi(rng, usedPoi, spawn, 5.4);
    const eliteHpFactor = star >= 5 ? 3.4 : star >= 4 ? 3.0 : 2.6;
    const eliteAtkFactor = star >= 5 ? 1.65 : star >= 4 ? 1.5 : 1.35;
    const elite = buildEnemy('melee', depth, eliteSpot.x, eliteSpot.y, {
      hpMul: eliteHpFactor,
      atkMul: eliteAtkFactor,
      speedMul: 1.05,
    });
    elite.role = 'elite';
    enemies.push(elite);

    const minionBudget = clamp(effectiveTb * 0.35, 2, 6);
    const cluster = pickPoi(rng, usedPoi, spawn, 4.8);
    enemies.push(...spawnEnemiesForBudget(rng, depth, cluster, minionBudget, allowKinds, spawn));
  } else {
    const clusterCount = star >= 4 ? 3 : 2;
    const centers = Array.from({ length: clusterCount }, () => pickPoi(rng, usedPoi, spawn, 4.4));
    const budgets = makeClusterBudgets(effectiveTb, clusterCount);
    for (let i = 0; i < centers.length; i += 1) {
      enemies.push(...spawnEnemiesForBudget(rng, depth, centers[i], budgets[i], allowKinds, spawn));
    }
  }
  if (depth <= 5 && enemies.length > 3) {
    enemies.length = 3;
  }
  if (depth <= 5 && floorType === 'trap' && enemies.length > 1) {
    enemies.length = 1;
  }

  const counts = NORMAL_COUNTS[floorType] || NORMAL_COUNTS.combat;
  const extraTrap = star >= 4 ? 1 : 0;
  let trapCount = Math.max(1, counts.traps + extraTrap - (depth <= 3 ? 1 : 0));
  if (depth <= 5 && floorType === 'trap') {
    trapCount = 1;
  }
  const treasureCount = counts.treasures + (floorType === 'chest' && star >= 4 ? 1 : 0);
  const trapDamage = Math.max(4, Math.round((4 + depth) * trapMultiplier(depth)));
  const traps = [];
  const treasures = [];

  for (let i = 0; i < trapCount; i += 1) {
    const point = pickPoi(rng, usedPoi, spawn, 3.5);
    traps.push({
      type: 'bomb_rune',
      x: point.x,
      y: point.y,
      damage: trapDamage,
      telegraph: 0.8,
      activeDuration: 0.14,
      cooldown: 4 + rng() * 1.8,
      timer: 0.4 + rng() * 1.8,
    });
  }

  for (let i = 0; i < treasureCount; i += 1) {
    const point = pickPoi(rng, usedPoi, spawn, 2.8);
    const gold = Math.round(12 + depth * 4 + star * 2 + (floorType === 'chest' ? 10 : 0));
    treasures.push({ x: point.x, y: point.y, gold });
  }

  const floorName = `Depth ${depth}: ${FLOOR_TYPE_LABELS[floorType] || floorType} ★${star}`;
  return {
    id: `D${depth}_${floorType}_${star}`,
    depth,
    floorKind: 'normal',
    floorType,
    star,
    tag: FLOOR_TYPE_TAGS[floorType] || '',
    name: floorName,
    spawn,
    enemies,
    traps,
    treasures,
    exit: { x: MAP_WIDTH - 2, y: 6 },
    exitActiveStart: false,
  };
}

function buildIntermissionFloor(depth) {
  return {
    id: `D${depth}_intermission`,
    depth,
    floorKind: 'intermission',
    floorType: 'intermission',
    star: 0,
    tag: '回復 + ショップ',
    name: `Depth ${depth}: Intermission`,
    spawn: { x: 2, y: 6 },
    enemies: [],
    traps: [],
    treasures: [],
    intermission: {
      healRate: INTERMISSION_HEAL_BASE,
    },
    exit: { x: MAP_WIDTH - 2, y: 6 },
    exitActiveStart: false,
  };
}

function buildBossFloor(depth) {
  const base = BOSS_BASE[depth] || BOSS_BASE[20];
  const hpScale = depth === 5 ? 0.55 : 0.65;
  const atkScale = depth === 5 ? 0.45 : 0.6;
  const hp = Math.round(base.hpBase * hpMultiplier(depth) * hpScale);
  const atk = Math.max(2, Math.round(base.atkBase * atkMultiplier(depth) * atkScale));
  const boss = {
    type: 'boss_champion',
    bossProfile: depth === 5 ? 'champion' : `boss_${depth}`,
    role: 'boss',
    behavior: 'boss',
    x: 14,
    y: 6,
    hp,
    maxHp: hp,
    def: base.defBase,
    speed: base.speed,
    aggroRange: 12,
    attackRange: 1.35,
    attackDamage: atk,
    attackCooldown: 0.8,
    cooldownLeft: 0,
    state: 'boss_idle',
    wanderTimer: 0,
    wanderTarget: null,
    skillCooldowns: {
      sweep: 0,
      stomp: 0,
      dash: 0,
    },
    bossFlags: {
      requireBasicAfterBig: false,
      lastBigSkill: null,
      phase: 1,
      transitionDone: false,
    },
  };
  return {
    id: `D${depth}_boss`,
    depth,
    floorKind: 'boss',
    floorType: 'boss',
    star: Math.min(5, 2 + Math.ceil(depth / BOSS_INTERVAL)),
    tag: 'ボス戦',
    name: `Depth ${depth}: ${base.name}`,
    spawn: { x: 2, y: 6 },
    enemies: [boss],
    traps: [],
    treasures: [],
    exit: { x: MAP_WIDTH - 2, y: 6 },
    exitActiveStart: false,
  };
}

export function getFloorKind(depth) {
  if (depth % BOSS_INTERVAL === 0) return 'boss';
  if (depth % BOSS_INTERVAL === BOSS_INTERVAL - 1) return 'intermission';
  return 'normal';
}

export function isBranchDepth(depth) {
  return getFloorKind(depth) === 'normal';
}

export function generateBranchOptions(depth, seed) {
  if (!isBranchDepth(depth)) return [];
  const rng = createRng(seed, depth, 'branch');
  const options = [];
  const typeWeights = { ...pickTableForDepth(TYPE_WEIGHT_TABLE, depth) };
  const starWeights = pickTableForDepth(STAR_WEIGHT_TABLE, depth);

  for (let i = 0; i < 2; i += 1) {
    const pickedType = pickWeighted(rng, typeWeights) || 'combat';
    typeWeights[pickedType] = 0;
    const pickedStar = Number(pickWeighted(rng, starWeights) || 2);
    options.push({
      id: `branch-${depth}-${pickedType}-${pickedStar}-${i}`,
      floorType: pickedType,
      star: pickedStar,
      rewardTag: FLOOR_TYPE_TAGS[pickedType] || '',
      label: `${FLOOR_TYPE_LABELS[pickedType] || pickedType} ★${pickedStar}`,
    });
  }
  const priority = { combat: 0, chest: 1, trap: 2, elite: 3 };
  options.sort((a, b) => {
    const pa = priority[a.floorType] ?? 99;
    const pb = priority[b.floorType] ?? 99;
    if (pa !== pb) return pa - pb;
    return a.star - b.star;
  });
  return options;
}

export function generateRewardOptions(depth, seed) {
  const rng = createRng(seed, depth, 'reward');
  const base = [
    { type: 'heal', amount: 25, label: '緊急修復', desc: 'HPを25回復' },
    { type: 'attack', amount: 1, label: '強打回路', desc: '攻撃力 +1（ラン中）' },
    { type: 'speed', amount: 0.05, label: '機動制御', desc: '移動速度 +5%（ラン中）' },
  ];
  for (let i = base.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [base[i], base[j]] = [base[j], base[i]];
  }
  return base.map((item, idx) => ({
    id: `reward-${depth}-${item.type}-${idx}`,
    ...item,
  }));
}

export function generateFloor(depth, seed, branchChoice = null) {
  const clampedDepth = clamp(depth, 1, MAX_DEPTH);
  const kind = getFloorKind(clampedDepth);
  if (kind === 'intermission') {
    return buildIntermissionFloor(clampedDepth);
  }
  if (kind === 'boss') {
    return buildBossFloor(clampedDepth);
  }
  return buildNormalFloor(clampedDepth, seed, branchChoice);
}
