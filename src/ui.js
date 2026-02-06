import { GRID_SIZE, CHIP_DEFS, PALETTE_SECTIONS, DIRS, AI_TICK, MAX_STEPS } from './config.js';
import { createCell } from './state.js';
import { audioState, ensureAudio, updateAudioVolumes, syncAudioToMode } from './audio.js';

const ICON_PATHS = {
  start: `
    <polygon points="12,9 24,16 12,23" fill="#f6e3c5"/>
    <rect x="7" y="9" width="3" height="14" fill="#f0c04a"/>
  `,
  nop: `
    <rect x="8" y="15" width="4" height="4" fill="#f6e3c5"/>
    <rect x="14" y="15" width="4" height="4" fill="#f6e3c5"/>
    <rect x="20" y="15" width="4" height="4" fill="#f6e3c5"/>
  `,
  enemy: `
    <rect x="10" y="8" width="12" height="12" fill="#f6e3c5"/>
    <rect x="12" y="12" width="3" height="3" fill="#2b1b0d"/>
    <rect x="17" y="12" width="3" height="3" fill="#2b1b0d"/>
    <rect x="13" y="20" width="6" height="4" fill="#f6e3c5"/>
    <rect x="14" y="22" width="4" height="2" fill="#2b1b0d"/>
  `,
  chest: `
    <rect x="8" y="13" width="16" height="12" fill="#f6e3c5"/>
    <rect x="8" y="11" width="16" height="4" fill="#dba569"/>
    <rect x="14" y="13" width="4" height="12" fill="#2b1b0d"/>
    <rect x="15" y="17" width="2" height="3" fill="#f0c04a"/>
  `,
  exit: `
    <rect x="9" y="21" width="14" height="4" fill="#f6e3c5"/>
    <rect x="9" y="17" width="10" height="4" fill="#f6e3c5"/>
    <rect x="9" y="13" width="6" height="4" fill="#f6e3c5"/>
    <rect x="20" y="11" width="3" height="14" fill="#f0c04a"/>
  `,
  hazard: `
    <polygon points="16,7 27,26 5,26" fill="#f0c04a"/>
    <rect x="15" y="13" width="2" height="8" fill="#2b1b0d"/>
    <rect x="15" y="23" width="2" height="2" fill="#2b1b0d"/>
  `,
  move: `
    <rect x="10" y="9" width="10" height="10" fill="#f6e3c5"/>
    <rect x="9" y="19" width="14" height="4" fill="#dba569"/>
    <rect x="8" y="23" width="16" height="3" fill="#f6e3c5"/>
    <rect x="22" y="9" width="2" height="14" fill="#f0c04a"/>
  `,
  evade: `
    <rect x="7" y="18" width="18" height="4" fill="#f6e3c5"/>
    <rect x="10" y="12" width="12" height="4" fill="#dba569"/>
    <rect x="12" y="8" width="8" height="3" fill="#f6e3c5"/>
    <rect x="24" y="12" width="2" height="10" fill="#f0c04a"/>
  `,
  wait: `
    <rect x="12" y="7" width="8" height="4" fill="#f6e3c5"/>
    <rect x="11" y="11" width="10" height="6" fill="#dba569"/>
    <rect x="12" y="17" width="8" height="8" fill="#f6e3c5"/>
    <rect x="14" y="13" width="4" height="2" fill="#2b1b0d"/>
  `,
  hp: `
    <rect x="9" y="12" width="4" height="4" fill="#f6e3c5"/>
    <rect x="19" y="12" width="4" height="4" fill="#f6e3c5"/>
    <rect x="11" y="10" width="10" height="4" fill="#f6e3c5"/>
    <rect x="11" y="16" width="10" height="6" fill="#f6e3c5"/>
    <rect x="12" y="22" width="8" height="2" fill="#dba569"/>
  `,
  attack: `
    <polygon points="6,20 16,6 26,20" fill="#f6e3c5"/>
    <rect x="14" y="12" width="4" height="12" fill="#dba569"/>
  `,
};

const DIR_ORDER = ['up', 'right', 'down', 'left'];

function svgWrap(paths, size) {
  return `<svg viewBox="0 0 32 32" width="${size}" height="${size}" aria-hidden="true">${paths}</svg>`;
}

function createIconNode(type, size, className, assets) {
  const container = document.createElement('div');
  container.className = className;
  const asset = assets?.chips?.[type];
  if (asset && asset.complete) {
    const img = document.createElement('img');
    img.src = asset.src;
    img.alt = '';
    img.width = size;
    img.height = size;
    img.className = 'chip-img';
    container.appendChild(img);
    return container;
  }
  container.innerHTML = svgWrap(ICON_PATHS[getIconKey(type)] || ICON_PATHS.nop, size);
  return container;
}

function formatNumber(value, digits = 1) {
  return Number.isInteger(value) ? String(value) : value.toFixed(digits);
}

function tagClass(tag) {
  const t = tag.toLowerCase();
  if (t === 'yield') return 'yield';
  if (t === 'running') return 'running';
  return 'instant';
}

function cloneParams(def) {
  const params = {};
  if (!def?.params) return params;
  Object.entries(def.params).forEach(([key, meta]) => {
    params[key] = meta.default;
  });
  return params;
}

function getParamBadge(type, params) {
  if (type === 'hazard_on_self') return '—';
  if (['enemy_exists', 'treasure_exists', 'exit_exists', 'hazard_in_range'].includes(type)) {
    return `R(ダンジョン)=${params.r ?? '?'}`;
  }
  if (type === 'wait') {
    return `t=${formatNumber(params.t ?? 0.5)}s`;
  }
  if (type === 'self_hp') {
    const op = params.op ?? '<';
    const val = params.value ?? 50;
    return `${op}${val}%`;
  }
  return '';
}

function getChipSub(cell) {
  if (!cell) return '';
  const type = cell.type;
  if (['enemy_exists', 'treasure_exists', 'exit_exists', 'hazard_in_range'].includes(type)) {
    return `R(ダンジョン)=${cell.params?.r ?? ''}`;
  }
  if (type === 'self_hp') {
    const op = cell.params?.op ?? '<';
    const val = cell.params?.value ?? 50;
    return `${op}${val}%`;
  }
  if (type === 'wait') {
    return `${formatNumber(cell.params?.t ?? 0.5)}s`;
  }
  if (type === 'move_to_enemy') return 'ATK';
  if (type === 'move_to_treasure') return 'Chest';
  if (type === 'move_to_exit') return 'Exit';
  if (type === 'attack') return 'ATK';
  return '';
}

function getIconKey(type) {
  if (type === 'enemy_exists') return 'enemy';
  if (type === 'attack') return 'attack';
  if (type === 'treasure_exists' || type === 'move_to_treasure') return 'chest';
  if (type === 'exit_exists' || type === 'move_to_exit') return 'exit';
  if (type === 'hazard_on_self' || type === 'hazard_in_range') return 'hazard';
  if (type === 'evade_hazard') return 'evade';
  if (type === 'wait') return 'wait';
  if (type === 'self_hp') return 'hp';
  if (type === 'move_to_enemy' || type === 'move_to_treasure' || type === 'move_to_exit') return 'move';
  return CHIP_DEFS[type]?.icon || 'nop';
}

function coordLabel(x, y) {
  const col = String.fromCharCode(65 + x);
  return `${col}${y + 1}`;
}

function manhattan(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function rotateDirection(currentDir, reverse = false) {
  const baseDir = DIR_ORDER.includes(currentDir) ? currentDir : 'up';
  const idx = DIR_ORDER.indexOf(baseDir);
  const delta = reverse ? -1 : 1;
  return DIR_ORDER[(idx + delta + DIR_ORDER.length) % DIR_ORDER.length];
}

export function createUI({ state, grid, assets, onStart, onPause, onReset, onChooseBranch, onToggleFullscreen }) {
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const statusEl = document.getElementById('status');
  const hudEl = document.getElementById('hud');
  const gridEl = document.getElementById('grid');
  const paletteSectionsEl = document.getElementById('paletteSections');
  const paletteSearchEl = document.getElementById('palette-search');
  const paletteCountEl = document.getElementById('palette-count');
  const startBtn = document.getElementById('start-btn');
  const pauseBtn = document.getElementById('pause-btn');
  const resetBtn = document.getElementById('reset-btn');
  const negateBtn = document.getElementById('negate-btn');
  const overlayEl = document.getElementById('overlay');
  const branchPanelEl = document.getElementById('branch-panel');
  const branchOptionsEl = document.getElementById('branch-options');
  const gameoverPanelEl = document.getElementById('gameover-panel');
  const runPillEl = document.getElementById('run-pill');
  const stepPillEl = document.getElementById('step-pill');
  const warningPillEl = document.getElementById('warning-pill');
  const pcPillEl = document.getElementById('pc-pill');
  const tickPillEl = document.getElementById('tick-pill');
  const gridSizePillEl = document.getElementById('grid-size-pill');
  const editorLayoutEl = document.getElementById('editor-layout');
  const boardEditorEl = document.getElementById('board-editor');
  const boardTestEl = document.getElementById('board-test');
  const topTabs = Array.from(document.querySelectorAll('.tab'));
  const filterButtons = Array.from(document.querySelectorAll('.seg'));
  const rtabButtons = Array.from(document.querySelectorAll('.rtab'));
  const rtabGroups = Array.from(document.querySelectorAll('.rgroup'));
  const inspectorChipEl = document.getElementById('inspector-chip');
  const inspectorPosEl = document.getElementById('inspector-pos');
  const inspectorTagEl = document.getElementById('inspector-tag');
  const overviewReachableEl = document.getElementById('overview-reachable');
  const overviewWarningEl = document.getElementById('overview-warning');
  const overviewHintEl = document.getElementById('overview-hint');
  const paramEditorEl = document.getElementById('param-editor');
  const copyBtn = document.getElementById('btn-copy');
  const pasteBtn = document.getElementById('btn-paste');
  const deleteBtn = document.getElementById('btn-delete');
  const replaceBtn = document.getElementById('btn-replace');
  const duplicateBtn = document.getElementById('btn-duplicate');
  const arrowPads = Array.from(document.querySelectorAll('.arrowpad'));
  const bgmToggle = document.getElementById('bgm-toggle');
  const bgmVolume = document.getElementById('bgm-volume');
  const sfxToggle = document.getElementById('sfx-toggle');
  const sfxVolume = document.getElementById('sfx-volume');

  ctx.imageSmoothingEnabled = false;

  const cellEls = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
  let selectedCell = { x: 0, y: 0 };
  let selectedChipType = 'nop';
  let stampMode = false;
  let stampParams = null;
  let filterMode = 'starter';
  let query = '';
  let gridReady = false;
  let needsInspectorRefresh = true;
  let clipboard = null;
  const recentTypes = [];
  const favoriteTypes = new Set();

  const history = [];
  let historyIndex = -1;

  function snapshotGrid() {
    return grid.map((row) =>
      row.map((cell) => ({
        type: cell.type,
        trueDir: cell.trueDir,
        falseDir: cell.falseDir,
        negate: cell.negate,
        params: { ...cell.params },
      }))
    );
  }

  function applySnapshot(snapshot) {
    for (let y = 0; y < GRID_SIZE; y += 1) {
      for (let x = 0; x < GRID_SIZE; x += 1) {
        const cell = snapshot[y][x];
        grid[y][x] = {
          type: cell.type,
          trueDir: cell.trueDir,
          falseDir: cell.falseDir,
          negate: cell.negate,
          params: { ...cell.params },
        };
      }
    }
  }

  function pushHistory() {
    const snap = snapshotGrid();
    history.splice(historyIndex + 1);
    history.push(snap);
    historyIndex = history.length - 1;
  }

  function undo() {
    if (historyIndex <= 0) return;
    historyIndex -= 1;
    applySnapshot(history[historyIndex]);
    needsInspectorRefresh = true;
    updateGridUI();
  }

  function redo() {
    if (historyIndex >= history.length - 1) return;
    historyIndex += 1;
    applySnapshot(history[historyIndex]);
    needsInspectorRefresh = true;
    updateGridUI();
  }

  function initGridUI() {
    gridEl.innerHTML = '';
    gridEl.style.gridTemplateColumns = `repeat(${GRID_SIZE}, var(--cell))`;
    gridEl.style.gridTemplateRows = `repeat(${GRID_SIZE}, var(--cell))`;
    gridSizePillEl.textContent = `${GRID_SIZE}×${GRID_SIZE}`;
    for (let y = 0; y < GRID_SIZE; y += 1) {
      for (let x = 0; x < GRID_SIZE; x += 1) {
        const cellEl = document.createElement('div');
        cellEl.className = 'cell';
        cellEl.dataset.x = x;
        cellEl.dataset.y = y;
        gridEl.appendChild(cellEl);
        cellEls[y][x] = cellEl;
      }
    }
    if (!gridEl.dataset.bound) {
      gridEl.addEventListener('click', (event) => {
        const triEl = event.target.closest('.tri');
        if (triEl) {
          const cellEl = triEl.closest('.cell');
          if (!cellEl) return;
          const x = Number(cellEl.dataset.x);
          const y = Number(cellEl.dataset.y);
          const mode = triEl.dataset.mode === 'false' ? 'false' : 'true';
          const handled = rotateArrowAt(x, y, mode, {
            reverse: event.shiftKey,
            syncConditional: event.altKey,
          });
          if (handled) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
        }
        const cellEl = event.target.closest('.cell');
        if (!cellEl) return;
        const x = Number(cellEl.dataset.x);
        const y = Number(cellEl.dataset.y);
        handleCellClick(x, y);
      });
      gridEl.addEventListener('dblclick', (event) => {
        event.preventDefault();
        if (event.target.closest('.tri')) return;
        const cellEl = event.target.closest('.cell');
        if (!cellEl) return;
        const x = Number(cellEl.dataset.x);
        const y = Number(cellEl.dataset.y);
        handleCellPlace(x, y);
      });
      gridEl.dataset.bound = '1';
    }
    gridReady = true;
    pushHistory();
    updateGridUI();
  }

  function selectPalette(type, params = null) {
    selectedChipType = type;
    stampMode = true;
    stampParams = params ? { ...params } : null;
    renderPalette();
  }

  function toggleFavorite(type) {
    if (favoriteTypes.has(type)) {
      favoriteTypes.delete(type);
    } else {
      favoriteTypes.add(type);
    }
    renderPalette();
  }

  function buildPaletteSections() {
    if (filterMode === 'recent') {
      return [
        {
          title: '最近',
          open: true,
          chips: recentTypes.length ? [...new Set(recentTypes)] : [],
        },
      ];
    }
    if (filterMode === 'fav') {
      return [
        {
          title: 'お気に入り',
          open: true,
          chips: Array.from(favoriteTypes),
        },
      ];
    }
    if (filterMode === 'starter') {
      return [PALETTE_SECTIONS[0]];
    }
    return PALETTE_SECTIONS;
  }

  function renderPalette() {
    paletteSectionsEl.innerHTML = '';
    const sections = buildPaletteSections();
    paletteCountEl.textContent =
      filterMode === 'starter'
        ? 'スターター'
        : filterMode === 'all'
          ? 'すべて'
          : filterMode === 'recent'
            ? '最近'
            : 'お気に入り';

    sections.forEach((section) => {
      const chips = section.chips
        .map((type) => ({ type, def: CHIP_DEFS[type] }))
        .filter((item) => item.def);

      const filtered = query
        ? chips.filter((item) =>
            `${item.def.label} ${item.def.desc || ''}`.toLowerCase().includes(query)
          )
        : chips;

      if (!filtered.length) return;

      const details = document.createElement('details');
      if (section.open) details.setAttribute('open', '');

      const summary = document.createElement('summary');
      const left = document.createElement('div');
      left.className = 'sum-left';
      left.innerHTML = `<span class="caret"></span><span>${section.title}</span>`;
      const count = document.createElement('div');
      count.className = 'count';
      count.textContent = filtered.length;
      summary.appendChild(left);
      summary.appendChild(count);

      const gridEl = document.createElement('div');
      gridEl.className = 'tilegrid';
      filtered.forEach(({ type, def }) => {
        const tile = document.createElement('div');
        tile.className = `ctile${type === selectedChipType ? ' selected' : ''}`;
        tile.title = def.desc ? `${def.label} — ${def.desc}` : def.label;

        if (favoriteTypes.has(type)) {
          tile.classList.add('fav');
        }

        const icon = createIconNode(type, 22, 'i', assets);

        const text = document.createElement('div');
        text.className = 't';

        const name = document.createElement('div');
        name.className = 'name';
        name.textContent = def.label;

        const meta = document.createElement('div');
        meta.className = 'meta';

        const badgeText = getParamBadge(type, cloneParams(def));
        if (badgeText) {
          const badge = document.createElement('span');
          badge.className = 'badge' + (badgeText.includes('?') ? ' req' : '');
          badge.textContent = badgeText.trim();
          meta.appendChild(badge);
        }

        const tag = document.createElement('span');
        tag.className = `tag ${tagClass(def.tag || 'Instant')}`;
        tag.textContent = def.tag || 'Instant';
        meta.appendChild(tag);

        text.appendChild(name);
        text.appendChild(meta);

        tile.appendChild(icon);
        tile.appendChild(text);

        tile.addEventListener('click', (event) => {
          if (event.altKey) {
            toggleFavorite(type);
            return;
          }
          selectPalette(type, null);
        });

        gridEl.appendChild(tile);
      });

      details.appendChild(summary);
      details.appendChild(gridEl);
      paletteSectionsEl.appendChild(details);
    });
  }

  function handleCellClick(x, y) {
    selectedCell = { x, y };
    if (stampMode && selectedChipType === 'nop') {
      placeSelectedChipAt(x, y);
    }
    needsInspectorRefresh = true;
    updateGridUI();
  }

  function handleCellPlace(x, y) {
    selectedCell = { x, y };
    if (stampMode && selectedChipType && selectedChipType !== 'nop') {
      placeSelectedChipAt(x, y);
    }
    needsInspectorRefresh = true;
    updateGridUI();
  }

  function placeSelectedChipAt(x, y) {
    if (!stampMode || !selectedChipType) return false;
    if (selectedChipType === 'empty') {
      grid[y][x] = createCell('empty');
    } else {
      const existing = grid[y][x];
      const newCell = createCell(selectedChipType);
      newCell.trueDir = existing.trueDir;
      newCell.falseDir = existing.falseDir;
      newCell.negate = existing.negate;
      if (stampParams) {
        newCell.params = { ...stampParams };
      }
      grid[y][x] = newCell;
    }
    if (selectedChipType !== 'empty') {
      recentTypes.unshift(selectedChipType);
      if (recentTypes.length > 8) recentTypes.pop();
    }
    pushHistory();
    return true;
  }

  function rotateArrowAt(x, y, mode, { reverse = false, syncConditional = false } = {}) {
    const cell = grid[y][x];
    if (!cell || cell.type === 'empty') return false;
    const def = CHIP_DEFS[cell.type];
    const isConditional = Boolean(def?.conditional);
    if (mode === 'false' && !isConditional) return false;

    const key = mode === 'false' ? 'falseDir' : 'trueDir';
    const nextDir = rotateDirection(cell[key], reverse);
    if (syncConditional && isConditional) {
      cell.trueDir = nextDir;
      cell.falseDir = nextDir;
    } else {
      cell[key] = nextDir;
    }
    selectedCell = { x, y };
    pushHistory();
    needsInspectorRefresh = true;
    updateGridUI();
    return true;
  }

  function setArrow(dir, mode) {
    const { x, y } = selectedCell;
    const cell = grid[y][x];
    if (!cell || cell.type === 'empty') return;
    const isConditional = CHIP_DEFS[cell.type]?.conditional;
    if (mode === 'false' && !isConditional) return;
    if (mode === 'false') {
      cell.falseDir = dir;
    } else {
      cell.trueDir = dir;
    }
    pushHistory();
    needsInspectorRefresh = true;
    updateGridUI();
  }

  function toggleNegate() {
    const cell = grid[selectedCell.y][selectedCell.x];
    if (!CHIP_DEFS[cell.type]?.conditional) return;
    cell.negate = !cell.negate;
    pushHistory();
    needsInspectorRefresh = true;
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
    topTabs.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    if (tab === 'test') {
      boardEditorEl.classList.remove('active');
      boardTestEl.classList.add('active');
      editorLayoutEl.classList.add('test-mode');
    } else {
      boardEditorEl.classList.add('active');
      boardTestEl.classList.remove('active');
      editorLayoutEl.classList.remove('test-mode');
    }
  }

  function updateHUD() {
    const alive = state.enemies.filter((enemy) => enemy.alive);
    const enemyStatus = alive.length ? `Enemy: ${alive.length} / ${state.enemies.length}` : 'Enemy defeated';
    const exitStatus = state.exit.active ? 'Exit: Active' : 'Exit: Hidden';
    const trapCount = state.traps.filter((trap) => trap.active).length;
    const chestCount = state.treasures.filter((treasure) => !treasure.opened).length;
    hudEl.textContent = `Floor: ${state.floorDepth}/${state.totalDepth} ${state.floorName} | HP: ${state.player.hp} | Gold: ${state.player.gold} | Traps: ${trapCount} | Chests: ${chestCount} | ${enemyStatus} | ${exitStatus}`;
  }

  function getNextPos(x, y, dir) {
    if (!dir || !DIRS[dir]) return null;
    const nx = x + DIRS[dir].x;
    const ny = y + DIRS[dir].y;
    if (nx < 0 || ny < 0 || nx >= GRID_SIZE || ny >= GRID_SIZE) return null;
    if (!grid[ny][nx] || grid[ny][nx].type === 'empty') return null;
    return { x: nx, y: ny };
  }

  function computeReachable(startPos) {
    if (!startPos) return new Set();
    const key = (pos) => `${pos.x},${pos.y}`;
    const visited = new Set([key(startPos)]);
    const queue = [startPos];
    while (queue.length) {
      const current = queue.shift();
      const cell = grid[current.y][current.x];
      if (!cell || cell.type === 'empty') continue;
      const def = CHIP_DEFS[cell.type];
      const neighbors = [];
      if (cell.trueDir) {
        const next = getNextPos(current.x, current.y, cell.trueDir);
        if (next) neighbors.push(next);
      }
      if (def?.conditional && cell.falseDir) {
        const next = getNextPos(current.x, current.y, cell.falseDir);
        if (next) neighbors.push(next);
      }
      neighbors.forEach((pos) => {
        const k = key(pos);
        if (!visited.has(k)) {
          visited.add(k);
          queue.push(pos);
        }
      });
    }
    return visited;
  }

  function updateArrowPads(cell) {
    arrowPads.forEach((pad) => {
      const mode = pad.dataset.mode;
      const buttons = Array.from(pad.querySelectorAll('.k'));
      buttons.forEach((btn) => {
        if (!btn.dataset.dir) return;
        btn.classList.remove('on');
        if (mode === 'true' && cell.trueDir === btn.dataset.dir) btn.classList.add('on');
        if (mode === 'false' && cell.falseDir === btn.dataset.dir) btn.classList.add('on');
      });
      if (mode === 'false') {
        const enabled = CHIP_DEFS[cell.type]?.conditional;
        buttons.forEach((btn) => {
          if (!btn.dataset.dir) return;
          btn.disabled = !enabled;
        });
      }
    });
  }

  function renderParams(cell) {
    paramEditorEl.innerHTML = '';
    const def = CHIP_DEFS[cell.type];
    if (!def || !def.params || !Object.keys(def.params).length) {
      const hint = document.createElement('div');
      hint.className = 'hint';
      hint.textContent = 'パラメータなし';
      paramEditorEl.appendChild(hint);
      return;
    }

    Object.entries(def.params).forEach(([key, meta]) => {
      const row = document.createElement('div');
      row.className = 'param-row';

      const label = document.createElement('div');
      label.className = 'k';
      label.textContent = meta.label;
      row.appendChild(label);

      if (meta.type === 'select') {
        const select = document.createElement('select');
        meta.options.forEach((opt) => {
          const option = document.createElement('option');
          option.value = opt;
          option.textContent = opt;
          select.appendChild(option);
        });
        select.value = cell.params[key] ?? meta.default;
        select.addEventListener('change', () => {
          cell.params[key] = select.value;
          pushHistory();
          needsInspectorRefresh = true;
          updateGridUI();
        });
        row.appendChild(select);
      }

      if (meta.type === 'range') {
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.textContent = formatNumber(cell.params[key] ?? meta.default);

        const sliderWrap = document.createElement('div');
        sliderWrap.className = 'slider';
        const fill = document.createElement('div');
        fill.className = 'fill';
        sliderWrap.appendChild(fill);

        const input = document.createElement('input');
        input.type = 'range';
        input.min = meta.min;
        input.max = meta.max;
        input.step = meta.step;
        input.value = cell.params[key] ?? meta.default;

        const updateVisual = () => {
          const value = Number(input.value);
          badge.textContent = formatNumber(value);
          const ratio = ((value - meta.min) / (meta.max - meta.min)) * 100;
          fill.style.width = `${ratio}%`;
        };

        updateVisual();

        input.addEventListener('input', () => {
          cell.params[key] = Number(input.value);
          updateVisual();
          updateGridUI();
        });

        input.addEventListener('change', () => {
          pushHistory();
          needsInspectorRefresh = true;
          updateGridUI();
        });

        row.appendChild(badge);
        row.appendChild(sliderWrap);
        row.appendChild(input);

        if (meta.presets) {
          const presetLabel = document.createElement('div');
          presetLabel.className = 'k';
          presetLabel.textContent = 'プリセット';
          const preset = document.createElement('div');
          preset.className = 'preset';
          meta.presets.forEach((presetValue) => {
            const span = document.createElement('span');
            span.className = 'p';
            const resolved = presetValue === 'max' ? meta.max : presetValue;
            span.textContent = presetValue === 'max' ? 'MAX' : String(presetValue);
            if (Number(input.value) === resolved) span.classList.add('active');
            span.addEventListener('click', () => {
              input.value = resolved;
              cell.params[key] = Number(resolved);
              updateVisual();
              pushHistory();
              needsInspectorRefresh = true;
              updateGridUI();
            });
            preset.appendChild(span);
          });
          row.appendChild(presetLabel);
          row.appendChild(preset);
        }
      }

      paramEditorEl.appendChild(row);
    });
  }

  function refreshInspector() {
    const cell = grid[selectedCell.y][selectedCell.x];
    const def = CHIP_DEFS[cell.type];
    inspectorChipEl.textContent = def ? `条件：${def.label}` : '条件：-';
    inspectorPosEl.textContent = `座標：${coordLabel(selectedCell.x, selectedCell.y)}`;
    inspectorTagEl.textContent = def?.tag || 'Instant';
    negateBtn.textContent = cell.negate ? 'ON' : 'OFF';
    negateBtn.disabled = !def?.conditional;
    renderParams(cell);
    updateArrowPads(cell);
  }

  function updateGridUI() {
    if (!gridReady) return;

    const warnings = [];
    const startPositions = [];
    for (let y = 0; y < GRID_SIZE; y += 1) {
      for (let x = 0; x < GRID_SIZE; x += 1) {
        if (grid[y][x]?.type === 'start') startPositions.push({ x, y });
      }
    }
    if (startPositions.length !== 1) {
      warnings.push(`STARTが${startPositions.length}個です`);
    }

    const destTrue = getNextPos(selectedCell.x, selectedCell.y, grid[selectedCell.y][selectedCell.x]?.trueDir);
    const destFalse = getNextPos(selectedCell.x, selectedCell.y, grid[selectedCell.y][selectedCell.x]?.falseDir);

    const rangeSet = new Set();
    const selected = grid[selectedCell.y][selectedCell.x];
    const selectedDef = CHIP_DEFS[selected?.type];
    if (selectedDef?.params?.r) {
      const r = selected.params?.r ?? selectedDef.params.r.default;
      for (let y = 0; y < GRID_SIZE; y += 1) {
        for (let x = 0; x < GRID_SIZE; x += 1) {
          if (manhattan({ x, y }, selectedCell) <= r) {
            rangeSet.add(`${x},${y}`);
          }
        }
      }
    }

    for (let y = 0; y < GRID_SIZE; y += 1) {
      for (let x = 0; x < GRID_SIZE; x += 1) {
        const cell = grid[y][x];
        const cellEl = cellEls[y][x];
        cellEl.className = 'cell';
        if (!cell || cell.type === 'empty') {
          cellEl.classList.add('empty');
        }
        if (selectedCell.x === x && selectedCell.y === y) {
          cellEl.classList.add('selected');
        }
        if (state.ai.pc.x === x && state.ai.pc.y === y) {
          cellEl.classList.add('pc');
        }
        if (destTrue && destTrue.x === x && destTrue.y === y) {
          cellEl.classList.add('dest-true');
        }
        if (destFalse && destFalse.x === x && destFalse.y === y) {
          cellEl.classList.add('dest-false');
        }
        if (rangeSet.has(`${x},${y}`)) {
          cellEl.classList.add('inrange');
        }

        cellEl.innerHTML = '';

        if (!cell || cell.type === 'empty') continue;

        const def = CHIP_DEFS[cell.type];
        const chip = document.createElement('div');
        chip.className = 'chip';
        if (cell.type === 'start') chip.classList.add('startchip');

        const icon = createIconNode(cell.type, 30, 'ico-big', assets);
        chip.appendChild(icon);

        const sub = getChipSub(cell);
        if (sub) {
          const subEl = document.createElement('div');
          subEl.className = 'sub';
          subEl.textContent = sub;
          chip.appendChild(subEl);
        }

        if (cell.negate && def?.conditional) {
          const badge = document.createElement('div');
          badge.className = 'badge';
          badge.textContent = '!';
          chip.appendChild(badge);
        }

        cellEl.appendChild(chip);

        const isConditional = Boolean(def?.conditional);
        const isSelectedCell = selectedCell.x === x && selectedCell.y === y;
        const showTrue = Boolean(cell.trueDir) || isSelectedCell;
        const showFalse = isConditional && (Boolean(cell.falseDir) || isSelectedCell);
        const trueDir = cell.trueDir || 'up';
        const falseDir = cell.falseDir || 'up';
        const trueOffset = showFalse ? 'off1' : '';
        const falseOffset = showFalse ? 'off2' : '';

        if (showTrue) {
          const tri = document.createElement('div');
          tri.className = `tri ${isConditional ? 'red' : 'green'} ${trueDir[0]} ${trueOffset}`.trim();
          if (!cell.trueDir) tri.classList.add('placeholder');
          tri.dataset.mode = 'true';
          tri.dataset.dir = trueDir;
          cellEl.appendChild(tri);

          if (cell.trueDir && !getNextPos(x, y, cell.trueDir)) {
            warnings.push(`${coordLabel(x, y)} Trueが壁`);
            const warn = document.createElement('div');
            warn.className = `warn ${cell.trueDir[0]}`;
            warn.textContent = '⚠';
            cellEl.appendChild(warn);
          }
        }

        if (showFalse) {
          const tri = document.createElement('div');
          tri.className = `tri green ${falseDir[0]} ${falseOffset}`.trim();
          if (!cell.falseDir) tri.classList.add('placeholder');
          tri.dataset.mode = 'false';
          tri.dataset.dir = falseDir;
          cellEl.appendChild(tri);

          if (cell.falseDir && !getNextPos(x, y, cell.falseDir)) {
            warnings.push(`${coordLabel(x, y)} Falseが壁`);
            const warn = document.createElement('div');
            warn.className = `warn ${cell.falseDir[0]}`;
            warn.textContent = '⚠';
            cellEl.appendChild(warn);
          }
        }
      }
    }

    const reachable = startPositions.length === 1 ? computeReachable(startPositions[0]) : new Set();
    const reachableCount = reachable.size;
    overviewReachableEl.textContent = `${reachableCount} / ${GRID_SIZE * GRID_SIZE}`;
    overviewWarningEl.textContent = String(warnings.length);
    overviewHintEl.textContent = warnings[0] ? `⚠ ${warnings[0]}` : '警告はありません';

    warningPillEl.textContent = `Warning: ${warnings.length}`;
    stepPillEl.textContent = `Step: ${state.ai.stepCounter} / ${MAX_STEPS}`;
    pcPillEl.textContent = `PC: (${state.ai.pc.x},${state.ai.pc.y})`;
    tickPillEl.textContent = `Tick: ${AI_TICK.toFixed(1)}s`;

    if (needsInspectorRefresh) {
      refreshInspector();
      needsInspectorRefresh = false;
    }
  }

  function initAudioControls() {
    audioState.bgmEnabled = bgmToggle.checked;
    audioState.sfxEnabled = sfxToggle.checked;
    audioState.bgmVolume = parseFloat(bgmVolume.value);
    audioState.sfxVolume = parseFloat(sfxVolume.value);
    updateAudioVolumes();
  }

  function bindEvents() {
    arrowPads.forEach((pad) => {
      pad.addEventListener('click', (event) => {
        const btn = event.target.closest('.k');
        if (!btn || !btn.dataset.dir) return;
        const mode = pad.dataset.mode;
        setArrow(btn.dataset.dir, mode);
      });
    });

    negateBtn.addEventListener('click', toggleNegate);

    topTabs.forEach((btn) => {
      btn.addEventListener('click', () => {
        if (['editor', 'test'].includes(btn.dataset.tab)) {
          switchTab(btn.dataset.tab);
        }
      });
    });

    rtabButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.rtab;
        rtabButtons.forEach((b) => b.classList.toggle('active', b === btn));
        rtabGroups.forEach((group) => {
          group.classList.toggle('active', group.dataset.rtab === key);
        });
      });
    });

    filterButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        filterMode = btn.dataset.filter;
        filterButtons.forEach((b) => b.classList.toggle('active', b === btn));
        renderPalette();
      });
    });

    paletteSearchEl.addEventListener('input', () => {
      query = paletteSearchEl.value.trim().toLowerCase();
      renderPalette();
    });

    runPillEl.addEventListener('click', () => {
      switchTab('test');
      onStart?.();
    });

    deleteBtn.addEventListener('click', () => {
      grid[selectedCell.y][selectedCell.x] = createCell('empty');
      pushHistory();
      needsInspectorRefresh = true;
      updateGridUI();
    });

    replaceBtn.addEventListener('click', () => {
      if (!selectedChipType || selectedChipType === 'empty') return;
      const existing = grid[selectedCell.y][selectedCell.x];
      const newCell = createCell(selectedChipType);
      newCell.trueDir = existing.trueDir;
      newCell.falseDir = existing.falseDir;
      newCell.negate = existing.negate;
      if (stampParams) newCell.params = { ...stampParams };
      grid[selectedCell.y][selectedCell.x] = newCell;
      pushHistory();
      needsInspectorRefresh = true;
      updateGridUI();
    });

    duplicateBtn.addEventListener('click', () => {
      const cell = grid[selectedCell.y][selectedCell.x];
      if (!cell || cell.type === 'empty') return;
      selectPalette(cell.type, cell.params);
    });

    copyBtn.addEventListener('click', () => {
      const cell = grid[selectedCell.y][selectedCell.x];
      if (!cell || cell.type === 'empty') return;
      clipboard = { type: cell.type, params: { ...cell.params } };
    });

    pasteBtn.addEventListener('click', () => {
      if (!clipboard) return;
      const cell = grid[selectedCell.y][selectedCell.x];
      if (!cell || cell.type !== clipboard.type) return;
      cell.params = { ...clipboard.params };
      pushHistory();
      needsInspectorRefresh = true;
      updateGridUI();
    });

    startBtn.addEventListener('click', () => {
      switchTab('test');
      onStart?.();
    });
    pauseBtn.addEventListener('click', () => {
      switchTab('test');
      onPause?.();
    });
    resetBtn.addEventListener('click', () => {
      onReset?.();
      switchTab('editor');
    });

    window.addEventListener('keydown', (event) => {
      if (event.code === 'Space') {
        event.preventDefault();
        onPause?.();
      }
      if (event.key.toLowerCase() === 'f') {
        onToggleFullscreen?.();
      }
      if (event.key === 'Escape') {
        stampMode = false;
      }
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
      if (mod && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redo();
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        grid[selectedCell.y][selectedCell.x] = createCell('empty');
        pushHistory();
        needsInspectorRefresh = true;
        updateGridUI();
      }
      if (event.key === '!') {
        toggleNegate();
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
    renderPalette();
    initAudioControls();
    bindEvents();
    switchTab('editor');
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
