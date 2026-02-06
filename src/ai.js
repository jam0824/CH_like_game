import { AI_TICK, CHIP_DEFS, DIRS, MAX_STEPS, GRID_SIZE } from './config.js';
import { resolveNextCell } from './state.js';
import { playSfx } from './audio.js';

const NEIGHBORS = [
  { dx: -1, dy: -1 },
  { dx: 0, dy: -1 },
  { dx: 1, dy: -1 },
  { dx: -1, dy: 0 },
  { dx: 1, dy: 0 },
  { dx: -1, dy: 1 },
  { dx: 0, dy: 1 },
  { dx: 1, dy: 1 },
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toTile(pos) {
  return { x: Math.round(pos.x), y: Math.round(pos.y) };
}

function manhattan(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function inRange(a, b, r) {
  return manhattan(toTile(a), toTile(b)) <= r + 1e-6;
}

function compare(op, left, right) {
  switch (op) {
    case '<':
      return left < right;
    case '<=':
      return left <= right;
    case '==':
      return left === right;
    case '!=':
      return left !== right;
    case '>=':
      return left >= right;
    case '>':
      return left > right;
    default:
      return false;
  }
}

function getStartPositions(grid) {
  const starts = [];
  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      if (grid[y][x]?.type === 'start') {
        starts.push({ x, y });
      }
    }
  }
  return starts;
}

function findNearest(targets, origin) {
  if (!targets.length) return null;
  const originTile = toTile(origin);
  let best = targets[0];
  let bestTile = toTile(best);
  let bestDist = manhattan(originTile, bestTile);
  for (let i = 1; i < targets.length; i += 1) {
    const targetTile = toTile(targets[i]);
    const dist = manhattan(originTile, targetTile);
    if (dist < bestDist) {
      bestDist = dist;
      best = targets[i];
      bestTile = targetTile;
    }
  }
  return { pos: best, tile: bestTile, dist: bestDist };
}

function computeSnapshot(state) {
  const playerPos = { x: state.player.x, y: state.player.y };
  const playerTile = toTile(playerPos);
  const traps = state.traps.filter((trap) => trap.active).map((trap) => ({ x: trap.x, y: trap.y }));
  const dynamicHazards = (state.hazards || [])
    .filter((hazard) => hazard.phase === 'telegraph' || hazard.phase === 'active')
    .map((hazard) => ({
      x: hazard.x ?? (hazard.x1 + hazard.x2) * 0.5,
      y: hazard.y ?? (hazard.y1 + hazard.y2) * 0.5,
    }));
  const hazards = traps.concat(dynamicHazards);
  const treasures = state.treasures.filter((treasure) => !treasure.opened).map((treasure) => ({ x: treasure.x, y: treasure.y }));
  const enemies = state.enemies.filter((enemy) => enemy.alive).map((enemy) => ({
    id: enemy.id,
    x: enemy.x,
    y: enemy.y,
  }));
  return {
    playerPos,
    playerTile,
    enemies,
    exitActive: state.exit.active,
    exitPos: { x: state.exit.x, y: state.exit.y },
    traps,
    hazards,
    treasures,
  };
}

function findNearestEnemy(snapshot, origin) {
  const nearest = findNearest(snapshot.enemies, origin);
  if (!nearest) return null;
  return { enemy: nearest.pos, tile: nearest.tile, dist: nearest.dist };
}

function chooseEvadeTarget(state, snapshot) {
  const origin = snapshot.playerPos;
  const intent = state.ai.intent;
  let best = null;
  let bestScore = -Infinity;

  NEIGHBORS.forEach(({ dx, dy }) => {
    const candidate = {
      x: clamp(origin.x + dx, 0.5, state.mapWidth - 0.5),
      y: clamp(origin.y + dy, 0.5, state.mapHeight - 0.5),
    };
    const candidateTile = { x: Math.round(candidate.x), y: Math.round(candidate.y) };
    const hazard = snapshot.hazards.some((trap) => inRange(candidateTile, trap, 0));
    const nearestHazard = findNearest(snapshot.hazards, candidateTile);
    const hazardDist = nearestHazard ? nearestHazard.dist : GRID_SIZE;
    let score = 0;
    if (!hazard) score += 100;
    score += hazardDist * 10;
    if (intent) {
      score -= manhattan(candidateTile, intent);
    }
    if (state.ai.prevPos && candidateTile.x === state.ai.prevPos.x && candidateTile.y === state.ai.prevPos.y) {
      score -= 5;
    }
    if (score > bestScore) {
      bestScore = score;
      best = candidateTile;
    }
  });

  return best || { x: snapshot.playerTile.x, y: snapshot.playerTile.y };
}

export function runAI(state, grid) {
  if (state.ai.currentAction) return;

  const starts = getStartPositions(grid);
  state.ai.invalidStart = starts.length !== 1;
  if (state.ai.invalidStart) {
    state.ai.stepCounter = 0;
    return;
  }
  const startPos = starts[0];
  state.ai.startPos = startPos;

  if (state.ai.pendingAdvance) {
    state.ai.pc = resolveNextCell(grid, state.ai.pc.x, state.ai.pc.y, state.ai.pendingAdvance.dir, DIRS, startPos);
    state.ai.pendingAdvance = null;
  }

  const snapshot = computeSnapshot(state);
  let steps = 0;

  const finish = () => {
    state.ai.stepCounter = steps;
  };

  while (steps < MAX_STEPS) {
    steps += 1;
    const { x, y } = state.ai.pc;
    const cell = grid[y]?.[x];
    if (!cell || cell.type === 'empty') {
      state.ai.pc = { ...startPos };
      continue;
    }

    if (cell.type === 'start' || cell.type === 'nop') {
      state.ai.pc = resolveNextCell(grid, x, y, cell.trueDir, DIRS, startPos);
      continue;
    }

    if (cell.type === 'enemy_exists') {
      const range = cell.params?.r ?? CHIP_DEFS.enemy_exists.params.r.default;
      const nearest = findNearestEnemy(snapshot, snapshot.playerTile);
      const exists = Boolean(nearest && nearest.dist <= range);
      const cond = cell.negate ? !exists : exists;
      const dir = cond ? cell.trueDir : cell.falseDir;
      state.ai.pc = resolveNextCell(grid, x, y, dir, DIRS, startPos);
      continue;
    }

    if (cell.type === 'treasure_exists') {
      const range = cell.params?.r ?? CHIP_DEFS.treasure_exists.params.r.default;
      const nearest = findNearest(snapshot.treasures, snapshot.playerTile);
      const exists = Boolean(nearest && nearest.dist <= range);
      const cond = cell.negate ? !exists : exists;
      const dir = cond ? cell.trueDir : cell.falseDir;
      state.ai.pc = resolveNextCell(grid, x, y, dir, DIRS, startPos);
      continue;
    }

    if (cell.type === 'exit_exists') {
      const range = cell.params?.r ?? CHIP_DEFS.exit_exists.params.r.default;
      const exists = snapshot.exitActive && inRange(snapshot.exitPos, snapshot.playerTile, range);
      const cond = cell.negate ? !exists : exists;
      const dir = cond ? cell.trueDir : cell.falseDir;
      state.ai.pc = resolveNextCell(grid, x, y, dir, DIRS, startPos);
      continue;
    }

    if (cell.type === 'hazard_on_self') {
      const onHazard = snapshot.hazards.some((trap) => inRange(snapshot.playerTile, trap, 0));
      const cond = cell.negate ? !onHazard : onHazard;
      const dir = cond ? cell.trueDir : cell.falseDir;
      state.ai.pc = resolveNextCell(grid, x, y, dir, DIRS, startPos);
      continue;
    }

    if (cell.type === 'hazard_in_range') {
      const range = cell.params?.r ?? CHIP_DEFS.hazard_in_range.params.r.default;
      const hazard = snapshot.hazards.some((trap) => inRange(snapshot.playerTile, trap, range));
      const cond = cell.negate ? !hazard : hazard;
      const dir = cond ? cell.trueDir : cell.falseDir;
      state.ai.pc = resolveNextCell(grid, x, y, dir, DIRS, startPos);
      continue;
    }

    if (cell.type === 'self_hp') {
      const op = cell.params?.op ?? CHIP_DEFS.self_hp.params.op.default;
      const value = cell.params?.value ?? CHIP_DEFS.self_hp.params.value.default;
      const ratio = (state.player.hp / state.player.maxHp) * 100;
      const cond = compare(op, ratio, value);
      const finalCond = cell.negate ? !cond : cond;
      const dir = finalCond ? cell.trueDir : cell.falseDir;
      state.ai.pc = resolveNextCell(grid, x, y, dir, DIRS, startPos);
      continue;
    }

    if (cell.type === 'move_to_enemy') {
      const nearest = findNearestEnemy(snapshot, snapshot.playerTile);
      if (!nearest) {
        state.ai.pc = { ...startPos };
        continue;
      }
      state.ai.intent = { x: nearest.tile.x, y: nearest.tile.y };
      state.ai.currentAction = {
        type: 'move_to_enemy',
        remaining: AI_TICK,
        target: { x: nearest.enemy.x, y: nearest.enemy.y },
        targetId: nearest.enemy.id,
      };
      state.ai.pc = resolveNextCell(grid, x, y, cell.trueDir, DIRS, startPos);
      finish();
      return;
    }

    if (cell.type === 'move_to_treasure') {
      const nearest = findNearest(snapshot.treasures, snapshot.playerTile);
      if (!nearest) {
        state.ai.pc = resolveNextCell(grid, x, y, cell.trueDir, DIRS, startPos);
        continue;
      }
      state.ai.intent = { x: nearest.tile.x, y: nearest.tile.y };
      state.ai.currentAction = {
        type: 'move_to_treasure',
        remaining: AI_TICK,
        target: nearest.pos,
      };
      state.ai.pc = resolveNextCell(grid, x, y, cell.trueDir, DIRS, startPos);
      finish();
      return;
    }

    if (cell.type === 'move_to_exit') {
      if (!snapshot.exitActive) {
        state.ai.pc = resolveNextCell(grid, x, y, cell.trueDir, DIRS, startPos);
        continue;
      }
      state.ai.intent = toTile(snapshot.exitPos);
      state.ai.currentAction = {
        type: 'move_to_exit',
        remaining: AI_TICK,
        target: snapshot.exitPos,
      };
      state.ai.pc = resolveNextCell(grid, x, y, cell.trueDir, DIRS, startPos);
      finish();
      return;
    }

    if (cell.type === 'evade_hazard') {
      const targetTile = chooseEvadeTarget(state, snapshot);
      state.ai.prevPos = { x: snapshot.playerTile.x, y: snapshot.playerTile.y };
      state.ai.currentAction = {
        type: 'evade_hazard',
        remaining: AI_TICK,
        target: targetTile,
      };
      state.ai.pc = resolveNextCell(grid, x, y, cell.trueDir, DIRS, startPos);
      finish();
      return;
    }

    if (cell.type === 'wait') {
      state.ai.currentAction = {
        type: 'wait',
        remaining: cell.params?.t ?? CHIP_DEFS.wait.params.t.default,
        nextDir: cell.trueDir,
      };
      finish();
      return;
    }

    if (cell.type === 'attack') {
      const nearest = findNearestEnemy(snapshot, snapshot.playerTile);
      if (!nearest) {
        state.ai.pc = { ...startPos };
        continue;
      }
      const dist = Math.hypot(state.player.x - nearest.enemy.x, state.player.y - nearest.enemy.y);
      if (dist > state.player.attackRange) {
        state.ai.pc = { ...startPos };
        continue;
      }
      playSfx('attack');
      state.ai.currentAction = {
        type: 'attack',
        remaining: state.player.attackDuration,
        targetId: nearest.enemy.id,
        nextDir: cell.trueDir,
      };
      finish();
      return;
    }

    state.ai.pc = { ...startPos };
  }
  // Prevent permanent PC loops in condition-only subgraphs.
  state.ai.pc = { ...startPos };
  finish();
}

export function applyAction(state, dt) {
  const action = state.ai.currentAction;
  if (!action) return;
  action.remaining -= dt;
  if (action.type === 'move_to_enemy' || action.type === 'move_to_exit' || action.type === 'move_to_treasure') {
    moveToward(state, action.target, dt);
  }
  if (action.type === 'evade_hazard') {
    moveToward(state, action.target, dt);
  }
  if (action.remaining <= 0) {
    if (action.type === 'attack') {
      const target = state.enemies.find((enemy) => enemy.id === action.targetId && enemy.alive);
      if (target) {
        const dist = Math.hypot(state.player.x - target.x, state.player.y - target.y);
        if (dist <= state.player.attackRange + 0.1) {
          target.hp = Math.max(0, target.hp - state.player.attackDamage);
          playSfx('hit');
          if (target.hp <= 0) {
            target.alive = false;
            playSfx('defeat');
            if (state.enemies.every((enemy) => !enemy.alive)) {
              state.exit.active = true;
              playSfx('exit');
            }
          }
        }
      }
    }
    if (action.type === 'wait' || action.type === 'attack') {
      if (action.nextDir) {
        state.ai.pendingAdvance = { dir: action.nextDir };
      }
    }
    state.ai.currentAction = null;
  }
}

export function moveEntityToward(entity, target, speed, dt, bounds) {
  const dx = target.x - entity.x;
  const dy = target.y - entity.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.001) return;
  const step = speed * dt;
  if (step >= dist) {
    entity.x = target.x;
    entity.y = target.y;
  } else {
    entity.x += (dx / dist) * step;
    entity.y += (dy / dist) * step;
  }
  if (bounds) {
    entity.x = Math.max(bounds.minX, Math.min(bounds.maxX, entity.x));
    entity.y = Math.max(bounds.minY, Math.min(bounds.maxY, entity.y));
  }
}

export function moveToward(state, target, dt) {
  moveEntityToward(
    state.player,
    target,
    state.player.speed,
    dt,
    { minX: 0.5, maxX: state.mapWidth - 0.5, minY: 0.5, maxY: state.mapHeight - 0.5 }
  );
}
