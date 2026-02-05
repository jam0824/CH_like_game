import { GRID_SIZE, CHIP_PALETTE, CHIP_TYPES, DIRS } from './config.js';
import { createCell } from './state.js';
import { audioState, ensureAudio, updateAudioVolumes, syncAudioToMode } from './audio.js';

export function createUI({ state, grid, assets, onStart, onPause, onReset, onChooseBranch, onToggleFullscreen }) {
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const statusEl = document.getElementById('status');
  const hudEl = document.getElementById('hud');
  const gridEl = document.getElementById('grid');
  const paletteEl = document.getElementById('palette');
  const startBtn = document.getElementById('start-btn');
  const pauseBtn = document.getElementById('pause-btn');
  const resetBtn = document.getElementById('reset-btn');
  const negateBtn = document.getElementById('negate-btn');
  const arrowModeButtons = Array.from(document.querySelectorAll('.arrow-mode-btn'));
  const arrowButtons = Array.from(document.querySelectorAll('.arrow-btn'));
  const overlayEl = document.getElementById('overlay');
  const branchPanelEl = document.getElementById('branch-panel');
  const branchOptionsEl = document.getElementById('branch-options');
  const gameoverPanelEl = document.getElementById('gameover-panel');
  const tabButtons = Array.from(document.querySelectorAll('.tab-btn'));
  const tabPanels = {
    editor: document.getElementById('tab-editor'),
    game: document.getElementById('tab-game'),
  };
  const bgmToggle = document.getElementById('bgm-toggle');
  const bgmVolume = document.getElementById('bgm-volume');
  const sfxToggle = document.getElementById('sfx-toggle');
  const sfxVolume = document.getElementById('sfx-volume');

  ctx.imageSmoothingEnabled = false;

  const cellEls = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
  let selectedCell = { x: 0, y: 0 };
  let selectedChipType = 'nop';
  let arrowMode = 'true';
  let gridReady = false;

  function initGridUI() {
    gridEl.innerHTML = '';
    for (let y = 0; y < GRID_SIZE; y += 1) {
      for (let x = 0; x < GRID_SIZE; x += 1) {
        const cellEl = document.createElement('div');
        cellEl.className = 'cell';
        cellEl.dataset.x = x;
        cellEl.dataset.y = y;
        const img = document.createElement('img');
        img.alt = '';
        cellEl.appendChild(img);
        cellEl.addEventListener('click', () => handleCellClick(x, y));
        gridEl.appendChild(cellEl);
        cellEls[y][x] = { root: cellEl, img };
      }
    }
    gridReady = true;
    updateGridUI();
  }

  function initPalette() {
    paletteEl.innerHTML = '';
    CHIP_PALETTE.forEach((item) => {
      const btn = document.createElement('button');
      btn.dataset.type = item.type;
      btn.dataset.chip = item.type;
      const label = document.createElement('div');
      label.textContent = item.label;
      btn.appendChild(label);
      if (item.type !== 'empty' && assets.chips[item.type]) {
        const img = document.createElement('img');
        img.src = assets.chips[item.type].src;
        img.alt = item.label;
        btn.appendChild(img);
      }
      btn.addEventListener('click', () => selectPalette(item.type));
      paletteEl.appendChild(btn);
    });
    selectPalette(selectedChipType);
  }

  function selectPalette(type) {
    selectedChipType = type;
    const buttons = paletteEl.querySelectorAll('button');
    buttons.forEach((btn) => {
      btn.classList.toggle('selected', btn.dataset.type === type);
    });
  }

  function handleCellClick(x, y) {
    selectedCell = { x, y };
    if (selectedChipType && !(x === 0 && y === 0)) {
      if (selectedChipType === 'empty') {
        grid[y][x] = createCell('empty');
      } else {
        const existing = grid[y][x];
        const newCell = createCell(selectedChipType);
        newCell.trueDir = existing.trueDir;
        newCell.falseDir = existing.falseDir;
        newCell.negate = existing.negate;
        grid[y][x] = newCell;
      }
    }
    updateGridUI();
  }

  function updateGridUI() {
    if (!gridReady) return;
    for (let y = 0; y < GRID_SIZE; y += 1) {
      for (let x = 0; x < GRID_SIZE; x += 1) {
        updateCellUI(x, y);
      }
    }
    updateArrowModeButtons();
  }

  function updateCellUI(x, y) {
    const cell = grid[y][x];
    const cellEl = cellEls[y][x];
    if (!cellEl) return;
    const imgEl = cellEl.img;
    cellEl.root.classList.toggle('selected', selectedCell.x === x && selectedCell.y === y);
    cellEl.root.classList.toggle('pc', state.ai.pc.x === x && state.ai.pc.y === y);
    cellEl.root.dataset.chip = cell.type;
    if (cell.type === 'start' && assets.chips.start) {
      imgEl.src = assets.chips.start.src;
      imgEl.style.display = 'block';
    } else if (assets.chips[cell.type]) {
      imgEl.src = assets.chips[cell.type].src;
      imgEl.style.display = 'block';
    } else {
      imgEl.removeAttribute('src');
      imgEl.style.display = 'none';
    }

    cellEl.root.querySelectorAll('.arrow').forEach((arrow) => arrow.remove());
    cellEl.root.querySelectorAll('.negate').forEach((negate) => negate.remove());

    if (cell.trueDir) {
      const arrow = document.createElement('div');
      arrow.className = `arrow true dir-${cell.trueDir}`;
      arrow.textContent = DIRS[cell.trueDir]?.symbol || '';
      cellEl.root.appendChild(arrow);
    }
    if (cell.falseDir && CHIP_TYPES[cell.type]?.conditional) {
      const arrow = document.createElement('div');
      arrow.className = `arrow false dir-${cell.falseDir}`;
      arrow.textContent = DIRS[cell.falseDir]?.symbol || '';
      cellEl.root.appendChild(arrow);
    }
    if (cell.negate && CHIP_TYPES[cell.type]?.conditional) {
      const negate = document.createElement('div');
      negate.className = 'negate';
      negate.textContent = '!';
      cellEl.root.appendChild(negate);
    }
  }

  function updateArrowModeButtons() {
    arrowModeButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === arrowMode);
    });
    const cell = grid[selectedCell.y][selectedCell.x];
    const isConditional = CHIP_TYPES[cell.type]?.conditional;
    arrowModeButtons.forEach((btn) => {
      if (btn.dataset.mode === 'false') {
        btn.disabled = !isConditional;
      }
    });
    negateBtn.disabled = !isConditional;
  }

  function setArrow(dir) {
    const { x, y } = selectedCell;
    const cell = grid[y][x];
    if (!cell || cell.type === 'empty') return;
    const isConditional = CHIP_TYPES[cell.type]?.conditional;
    if (isConditional && arrowMode === 'false') {
      cell.falseDir = dir;
    } else {
      cell.trueDir = dir;
    }
    updateGridUI();
  }

  function toggleNegate() {
    const cell = grid[selectedCell.y][selectedCell.x];
    if (!CHIP_TYPES[cell.type]?.conditional) return;
    cell.negate = !cell.negate;
    updateGridUI();
  }

  function updateStatus() {
    statusEl.textContent = `Mode: ${state.mode}`;
  }

  function renderBranchOptions() {
    branchOptionsEl.innerHTML = '';
    state.branchOptions.forEach((option) => {
      const btn = document.createElement('button');
      btn.className = 'branch-option';
      btn.textContent = option.label;
      btn.addEventListener('click', () => onChooseBranch?.(option.id));
      branchOptionsEl.appendChild(btn);
    });
  }

  function updateOverlay() {
    if (state.mode === 'branch') {
      overlayEl.classList.remove('hidden');
      branchPanelEl.classList.remove('hidden');
      gameoverPanelEl.classList.add('hidden');
      renderBranchOptions();
    } else if (state.mode === 'gameover') {
      overlayEl.classList.remove('hidden');
      branchPanelEl.classList.add('hidden');
      gameoverPanelEl.classList.remove('hidden');
    } else {
      overlayEl.classList.add('hidden');
      branchPanelEl.classList.add('hidden');
      gameoverPanelEl.classList.add('hidden');
    }
  }

  function switchTab(tab) {
    tabButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    Object.entries(tabPanels).forEach(([key, panel]) => {
      if (!panel) return;
      panel.classList.toggle('active', key === tab);
    });
  }

  function updateHUD() {
    const enemyStatus = state.enemy.alive ? `Enemy HP: ${state.enemy.hp}` : 'Enemy defeated';
    const exitStatus = state.exit.active ? 'Exit: Active' : 'Exit: Hidden';
    const trapCount = state.traps.filter((trap) => trap.active).length;
    const chestCount = state.treasures.filter((treasure) => !treasure.opened).length;
    hudEl.textContent = `Floor: ${state.floorDepth}/${state.totalDepth} ${state.floorName} | HP: ${state.player.hp} | Gold: ${state.player.gold} | Traps: ${trapCount} | Chests: ${chestCount} | ${enemyStatus} | ${exitStatus}`;
  }

  function initAudioControls() {
    audioState.bgmEnabled = bgmToggle.checked;
    audioState.sfxEnabled = sfxToggle.checked;
    audioState.bgmVolume = parseFloat(bgmVolume.value);
    audioState.sfxVolume = parseFloat(sfxVolume.value);
    updateAudioVolumes();
  }

  function bindEvents() {
    arrowModeButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        arrowMode = btn.dataset.mode;
        updateArrowModeButtons();
      });
    });

    arrowButtons.forEach((btn) => {
      btn.addEventListener('click', () => setArrow(btn.dataset.dir));
    });

    negateBtn.addEventListener('click', toggleNegate);

    tabButtons.forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    startBtn.addEventListener('click', () => onStart?.());
    pauseBtn.addEventListener('click', () => onPause?.());
    resetBtn.addEventListener('click', () => onReset?.());

    window.addEventListener('keydown', (event) => {
      if (event.code === 'Space') {
        event.preventDefault();
        onPause?.();
      }
      if (event.key.toLowerCase() === 'f') {
        onToggleFullscreen?.();
      }
    });

    bgmToggle.addEventListener('change', () => {
      audioState.bgmEnabled = bgmToggle.checked;
      ensureAudio();
      updateAudioVolumes();
      syncAudioToMode(state.mode);
    });

    bgmVolume.addEventListener('input', () => {
      audioState.bgmVolume = parseFloat(bgmVolume.value);
      updateAudioVolumes();
    });

    sfxToggle.addEventListener('change', () => {
      audioState.sfxEnabled = sfxToggle.checked;
      ensureAudio();
      updateAudioVolumes();
    });

    sfxVolume.addEventListener('input', () => {
      audioState.sfxVolume = parseFloat(sfxVolume.value);
      updateAudioVolumes();
    });
  }

  function init() {
    initGridUI();
    initPalette();
    initAudioControls();
    bindEvents();
  }

  return {
    canvas,
    ctx,
    init,
    updateGridUI,
    updateStatus,
    updateOverlay,
    updateHUD,
    switchTab,
  };
}
