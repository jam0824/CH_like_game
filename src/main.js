import { MAP_HEIGHT, MAP_WIDTH, TILE_SIZE, FIXED_DT, AI_TICK } from './config.js';
import { assets, loadAssets } from './assets.js';
import { createDefaultGrid, createInitialState, resetRun, loadFloor, serializeState, onModeChange } from './state.js';
import { runAI, applyAction } from './ai.js';
import { updateEnemies } from './enemy.js';
import { renderGame } from './render.js';
import { createUI } from './ui.js';
import { playSfx, ensureAudio } from './audio.js';
import { generateBranchOptions, generateRewardOptions, isBranchDepth } from './floors.js';

const grid = createDefaultGrid();
const state = createInitialState();
state.mapWidth = MAP_WIDTH;
state.mapHeight = MAP_HEIGHT;

let accumulator = 0;
let lastFrame = performance.now();

const ui = createUI({
  state,
  grid,
  assets,
  onStart: startRun,
  onPause: togglePause,
  onReset: resetAll,
  onChooseBranch: chooseBranch,
  onChooseReward: chooseReward,
  onContinueIntermission: continueFromIntermission,
  onToggleFullscreen: toggleFullscreen,
});

const { canvas, ctx } = ui;

function pointSegmentDistance(px, py, x1, y1, x2, y2) {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const wx = px - x1;
  const wy = py - y1;
  const vv = vx * vx + vy * vy;
  if (vv < 1e-6) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / vv));
  const sx = x1 + vx * t;
  const sy = y1 + vy * t;
  return Math.hypot(px - sx, py - sy);
}

function isPointInsideHazard(x, y, hazard) {
  if (hazard.shape === 'circle') {
    return Math.hypot(x - hazard.x, y - hazard.y) <= (hazard.radius || 0);
  }
  if (hazard.shape === 'line') {
    return pointSegmentDistance(x, y, hazard.x1, hazard.y1, hazard.x2, hazard.y2) <= (hazard.width || 0.8) * 0.5;
  }
  if (hazard.shape === 'cone') {
    const dx = x - hazard.x;
    const dy = y - hazard.y;
    const len = Math.hypot(dx, dy);
    if (len > (hazard.radius || 0)) return false;
    if (len < 1e-6) return true;
    const dirLen = Math.hypot(hazard.dirX || 0, hazard.dirY || 0) || 1;
    const nx = (hazard.dirX || 0) / dirLen;
    const ny = (hazard.dirY || 0) / dirLen;
    const dot = (dx / len) * nx + (dy / len) * ny;
    const angle = Math.acos(Math.max(-1, Math.min(1, dot))) * (180 / Math.PI);
    return angle <= (hazard.angleDeg || 120) * 0.5;
  }
  return false;
}

function pushHazard(hazard) {
  state.hazardSeq = (state.hazardSeq || 0) + 1;
  state.hazards.push({
    id: `hz-${state.hazardSeq}`,
    phase: 'telegraph',
    remaining: hazard.telegraph,
    activeDuration: hazard.activeDuration ?? 0.14,
    damage: hazard.damage ?? 0,
    source: hazard.source || 'trap',
    ownerId: hazard.ownerId || null,
    shape: hazard.shape || 'circle',
    x: hazard.x ?? null,
    y: hazard.y ?? null,
    radius: hazard.radius ?? 0,
    angleDeg: hazard.angleDeg ?? 0,
    dirX: hazard.dirX ?? 0,
    dirY: hazard.dirY ?? 0,
    x1: hazard.x1 ?? null,
    y1: hazard.y1 ?? null,
    x2: hazard.x2 ?? null,
    y2: hazard.y2 ?? null,
    width: hazard.width ?? 0,
    onActivate: hazard.onActivate || null,
    hitDone: false,
  });
}

function updateTrapEmitters(dt) {
  state.traps.forEach((trap) => {
    if (!trap.active) return;
    trap.timer -= dt;
    if (trap.timer > 0) return;
    pushHazard({
      source: 'trap',
      shape: 'circle',
      telegraph: trap.telegraph,
      activeDuration: trap.activeDuration,
      x: trap.x,
      y: trap.y,
      radius: 0.9,
      damage: trap.damage,
    });
    trap.timer += trap.cooldown;
  });
}

function updateHazards(dt) {
  for (let i = state.hazards.length - 1; i >= 0; i -= 1) {
    const hazard = state.hazards[i];
    hazard.remaining -= dt;
    if (hazard.phase === 'telegraph' && hazard.remaining <= 0) {
      hazard.phase = 'active';
      hazard.remaining = hazard.activeDuration;
      if (hazard.onActivate?.moveOwnerTo) {
        const move = hazard.onActivate.moveOwnerTo;
        const owner = state.enemies.find((enemy) => enemy.id === move.id && enemy.alive);
        if (owner) {
          owner.x = move.x;
          owner.y = move.y;
        }
      }
      if (!hazard.hitDone && isPointInsideHazard(state.player.x, state.player.y, hazard)) {
        state.player.hp = Math.max(0, state.player.hp - hazard.damage);
        playSfx(hazard.source === 'trap' ? 'trap' : 'enemy');
        hazard.hitDone = true;
      }
      continue;
    }
    if (hazard.phase === 'active' && hazard.remaining <= 0) {
      state.hazards.splice(i, 1);
    }
  }
}

function applyReward(option) {
  if (!option) return;
  if (option.type === 'heal') {
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + option.amount);
  }
  if (option.type === 'attack') {
    state.run.buffs.attack += option.amount;
    state.player.attackDamage = state.player.baseAttackDamage + state.run.buffs.attack;
  }
  if (option.type === 'speed') {
    state.run.buffs.speedSteps += 1;
    state.player.speed = state.player.baseSpeed * (1 + 0.05 * state.run.buffs.speedSteps);
  }
}

function applyIntermissionHeal() {
  if (state.intermission.healed) return;
  const heal = Math.round(state.player.maxHp * state.intermission.healRate);
  state.player.hp = Math.min(state.player.maxHp, state.player.hp + heal);
  state.intermission.healAmount = heal;
  state.intermission.healed = true;
}

function enterFloorMode() {
  if (state.floorKind === 'intermission') {
    applyIntermissionHeal();
    onModeChange(state, 'intermission', ui.updateStatus, ui.updateOverlay);
    return;
  }
  onModeChange(state, 'running', ui.updateStatus, ui.updateOverlay);
}

function moveToNextDepth(branchChoice = null) {
  const nextDepth = state.floorDepth + 1;
  if (nextDepth > state.totalDepth) {
    onModeChange(state, 'clear', ui.updateStatus, ui.updateOverlay);
    return;
  }
  loadFloor(state, nextDepth, branchChoice);
  enterFloorMode();
}

function startRun() {
  resetRun(state);
  enterFloorMode();
  ensureAudio();
  ui.switchTab('test');
}

function resetAll() {
  resetRun(state);
  onModeChange(state, 'idle', ui.updateStatus, ui.updateOverlay);
  ui.updateGridUI();
  ui.switchTab('editor');
}

function togglePause() {
  if (state.mode === 'running') {
    onModeChange(state, 'paused', ui.updateStatus, ui.updateOverlay);
  } else if (state.mode === 'paused') {
    onModeChange(state, 'running', ui.updateStatus, ui.updateOverlay);
  } else if (state.mode === 'idle') {
    startRun();
  }
  ui.switchTab('test');
}

function chooseBranch(id) {
  const option = state.branchOptions.find((item) => item.id === id);
  if (!option) return;
  state.branchOptions = [];
  moveToNextDepth(option);
}

function chooseReward(id) {
  const option = state.rewardOptions.find((item) => item.id === id);
  if (!option) return;
  applyReward(option);
  state.rewardOptions = [];
  const nextDepth = state.floorDepth + 1;
  if (nextDepth > state.totalDepth) {
    onModeChange(state, 'clear', ui.updateStatus, ui.updateOverlay);
    return;
  }
  if (isBranchDepth(nextDepth)) {
    state.branchOptions = generateBranchOptions(nextDepth, state.run.seed);
    onModeChange(state, 'branch', ui.updateStatus, ui.updateOverlay);
    return;
  }
  moveToNextDepth(null);
}

function continueFromIntermission() {
  if (state.mode !== 'intermission') return;
  moveToNextDepth(null);
}

function toggleFullscreen() {
  const wrap = document.querySelector('.canvas-wrap');
  if (!document.fullscreenElement) {
    wrap?.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
}

function openRewardFlow() {
  if (state.floorDepth >= state.totalDepth && state.floorKind === 'boss') {
    onModeChange(state, 'clear', ui.updateStatus, ui.updateOverlay);
    return;
  }
  state.rewardOptions = generateRewardOptions(state.floorDepth, state.run.seed);
  onModeChange(state, 'reward', ui.updateStatus, ui.updateOverlay);
}

function update(dt) {
  if (state.mode !== 'running') return;
  state.time += dt;
  state.floorElapsed += dt;

  applyAction(state, dt);
  if (!state.ai.currentAction) {
    state.ai.tickTimer += dt;
    while (state.ai.tickTimer >= AI_TICK) {
      state.ai.tickTimer -= AI_TICK;
      runAI(state, grid);
      if (state.ai.currentAction) break;
    }
  }

  const playerDeadFromEnemy = updateEnemies(state, dt);
  updateTrapEmitters(dt);
  updateHazards(dt);

  if (playerDeadFromEnemy || state.player.hp <= 0) {
    onModeChange(state, 'gameover', ui.updateStatus, ui.updateOverlay);
    return;
  }

  if (!state.exit.active && state.floorKind !== 'intermission' && state.enemies.length && state.enemies.every((enemy) => !enemy.alive)) {
    state.exit.active = true;
    playSfx('exit');
  }

  if (state.exit.active) {
    const exitDist = Math.hypot(state.player.x - state.exit.x, state.player.y - state.exit.y);
    if (exitDist < 0.6) {
      openRewardFlow();
      return;
    }
  }

  state.treasures.forEach((treasure) => {
    if (treasure.opened) return;
    const d = Math.hypot(state.player.x - treasure.x, state.player.y - treasure.y);
    if (d < 0.5) {
      treasure.opened = true;
      state.player.gold += treasure.gold;
      playSfx('chest');
    }
  });
}

function render() {
  renderGame(ctx, canvas, assets, state);
  ui.updateHUD();
  ui.updateGridUI();
}

function step(dt) {
  update(dt);
}

function tick(now) {
  const delta = (now - lastFrame) / 1000;
  lastFrame = now;
  accumulator += Math.min(delta, 0.05);
  while (accumulator >= FIXED_DT) {
    step(FIXED_DT);
    accumulator -= FIXED_DT;
  }
  render();
  requestAnimationFrame(tick);
}

window.render_game_to_text = () => JSON.stringify(serializeState(state));

window.advanceTime = (ms) => {
  const steps = Math.max(1, Math.round(ms / (1000 / 60)));
  for (let i = 0; i < steps; i += 1) {
    step(FIXED_DT);
  }
  render();
};

async function init() {
  resetRun(state);
  canvas.width = MAP_WIDTH * TILE_SIZE;
  canvas.height = MAP_HEIGHT * TILE_SIZE;
  await loadAssets();
  ui.init();
  ui.updateStatus();
  ui.updateOverlay();
  ui.switchTab('editor');
  requestAnimationFrame(tick);
}

init();
