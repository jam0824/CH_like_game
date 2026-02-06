import { MAP_HEIGHT, MAP_WIDTH, TILE_SIZE, FIXED_DT, AI_TICK } from './config.js';
import { assets, loadAssets } from './assets.js';
import { createDefaultGrid, createInitialState, resetRun, loadFloor, serializeState, onModeChange } from './state.js';
import { runAI, applyAction } from './ai.js';
import { updateEnemies } from './enemy.js';
import { renderGame } from './render.js';
import { createUI } from './ui.js';
import { playSfx, ensureAudio } from './audio.js';
import { FLOOR_CONFIGS, getFloorIndex } from './floors.js';

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
  onToggleFullscreen: toggleFullscreen,
});

const { canvas, ctx } = ui;

function startRun() {
  resetRun(state);
  onModeChange(state, 'running', ui.updateStatus, ui.updateOverlay);
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
  const index = getFloorIndex(id);
  if (index === undefined) return;
  loadFloor(state, index);
  onModeChange(state, 'running', ui.updateStatus, ui.updateOverlay);
}

function toggleFullscreen() {
  const wrap = document.querySelector('.canvas-wrap');
  if (!document.fullscreenElement) {
    wrap?.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
}

function update(dt) {
  if (state.mode !== 'running') return;
  state.time += dt;
  applyAction(state, dt);
  if (!state.ai.currentAction) {
    state.ai.tickTimer += dt;
    while (state.ai.tickTimer >= AI_TICK) {
      state.ai.tickTimer -= AI_TICK;
      runAI(state, grid);
      if (state.ai.currentAction) break;
    }
  }
  const playerDead = updateEnemies(state, dt);
  if (playerDead) {
    onModeChange(state, 'gameover', ui.updateStatus, ui.updateOverlay);
    return;
  }
  if (!state.exit.active && state.enemies.length && state.enemies.every((enemy) => !enemy.alive)) {
    state.exit.active = true;
    playSfx('exit');
  }
  if (state.exit.active) {
    const exitDist = Math.hypot(state.player.x - state.exit.x, state.player.y - state.exit.y);
    if (exitDist < 0.6) {
      const currentConfig = FLOOR_CONFIGS[state.floorIndex];
      if (currentConfig?.nextOptions?.length) {
        playSfx('exit');
        state.branchOptions = currentConfig.nextOptions;
        onModeChange(state, 'branch', ui.updateStatus, ui.updateOverlay);
        return;
      }
      if (state.floorDepth >= state.totalDepth) {
        onModeChange(state, 'clear', ui.updateStatus, ui.updateOverlay);
      } else if (state.floorIndex + 1 < FLOOR_CONFIGS.length) {
        playSfx('exit');
        loadFloor(state, state.floorIndex + 1);
      } else {
        onModeChange(state, 'clear', ui.updateStatus, ui.updateOverlay);
      }
    }
  }
  state.traps.forEach((trap) => {
    if (!trap.active) return;
    const dist = Math.hypot(state.player.x - trap.x, state.player.y - trap.y);
    if (dist < 0.45) {
      trap.active = false;
      state.player.hp = Math.max(0, state.player.hp - trap.damage);
      playSfx('trap');
      if (state.player.hp <= 0) {
        onModeChange(state, 'gameover', ui.updateStatus, ui.updateOverlay);
      }
    }
  });
  if (state.mode !== 'running') return;
  state.treasures.forEach((treasure) => {
    if (treasure.opened) return;
    const dist = Math.hypot(state.player.x - treasure.x, state.player.y - treasure.y);
    if (dist < 0.5) {
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
