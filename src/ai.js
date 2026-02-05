import { AI_TICK, CHIP_TYPES, DIRS, MAX_STEPS } from './config.js';
import { resolveNextCell } from './state.js';
import { playSfx } from './audio.js';

export function runAI(state, grid) {
  if (state.ai.currentAction) return;
  const snapshot = {
    enemyAlive: state.enemy.alive,
    enemyPos: { x: state.enemy.x, y: state.enemy.y },
    exitActive: state.exit.active,
    exitPos: { x: state.exit.x, y: state.exit.y },
    treasure: state.treasures.find((treasure) => !treasure.opened) || null,
  };
  let steps = 0;
  while (steps < MAX_STEPS) {
    steps += 1;
    const { x, y } = state.ai.pc;
    const cell = grid[y][x];
    if (!cell || cell.type === 'empty') {
      state.ai.pc = { x: 0, y: 0 };
      continue;
    }
    if (cell.type === 'start' || cell.type === 'nop') {
      state.ai.pc = resolveNextCell(grid, x, y, cell.trueDir, DIRS);
      continue;
    }
    if (cell.type === 'enemy_exists') {
      const exists = snapshot.enemyAlive;
      const cond = cell.negate ? !exists : exists;
      const dir = cond ? cell.trueDir : cell.falseDir;
      state.ai.pc = resolveNextCell(grid, x, y, dir, DIRS);
      continue;
    }
    if (cell.type === 'treasure_exists') {
      const exists = Boolean(snapshot.treasure);
      const cond = cell.negate ? !exists : exists;
      const dir = cond ? cell.trueDir : cell.falseDir;
      state.ai.pc = resolveNextCell(grid, x, y, dir, DIRS);
      continue;
    }
    if (cell.type === 'move_to_enemy') {
      if (!snapshot.enemyAlive) {
        state.ai.pc = resolveNextCell(grid, x, y, cell.trueDir, DIRS);
        continue;
      }
      state.ai.currentAction = {
        type: 'move_to_enemy',
        remaining: AI_TICK,
        target: snapshot.enemyPos,
      };
      state.ai.pc = resolveNextCell(grid, x, y, cell.trueDir, DIRS);
      return;
    }
    if (cell.type === 'move_to_treasure') {
      if (!snapshot.treasure) {
        state.ai.pc = resolveNextCell(grid, x, y, cell.trueDir, DIRS);
        continue;
      }
      state.ai.currentAction = {
        type: 'move_to_treasure',
        remaining: AI_TICK,
        target: { x: snapshot.treasure.x, y: snapshot.treasure.y },
      };
      state.ai.pc = resolveNextCell(grid, x, y, cell.trueDir, DIRS);
      return;
    }
    if (cell.type === 'move_to_exit') {
      if (!snapshot.exitActive) {
        state.ai.pc = resolveNextCell(grid, x, y, cell.trueDir, DIRS);
        continue;
      }
      state.ai.currentAction = {
        type: 'move_to_exit',
        remaining: AI_TICK,
        target: snapshot.exitPos,
      };
      state.ai.pc = resolveNextCell(grid, x, y, cell.trueDir, DIRS);
      return;
    }
    if (cell.type === 'attack') {
      if (!snapshot.enemyAlive) {
        state.ai.pc = resolveNextCell(grid, x, y, cell.trueDir, DIRS);
        continue;
      }
      const dist = Math.hypot(state.player.x - snapshot.enemyPos.x, state.player.y - snapshot.enemyPos.y);
      if (dist > state.player.attackRange) {
        state.ai.pc = resolveNextCell(grid, x, y, cell.trueDir, DIRS);
        continue;
      }
      playSfx('attack');
      state.ai.currentAction = {
        type: 'attack',
        remaining: state.player.attackDuration,
        target: snapshot.enemyPos,
      };
      return;
    }

    state.ai.pc = { x: 0, y: 0 };
  }
}

export function applyAction(state, dt) {
  const action = state.ai.currentAction;
  if (!action) return;
  action.remaining -= dt;
  if (action.type === 'move_to_enemy' || action.type === 'move_to_exit') {
    moveToward(state, action.target, dt);
  }
  if (action.type === 'move_to_treasure') {
    moveToward(state, action.target, dt);
  }
  if (action.remaining <= 0) {
    if (action.type === 'attack') {
      const dist = Math.hypot(state.player.x - state.enemy.x, state.player.y - state.enemy.y);
      if (state.enemy.alive && dist <= state.player.attackRange + 0.1) {
        state.enemy.hp = Math.max(0, state.enemy.hp - state.player.attackDamage);
        playSfx('hit');
        if (state.enemy.hp <= 0) {
          state.enemy.alive = false;
          state.exit.active = true;
          playSfx('defeat');
          playSfx('exit');
        }
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
