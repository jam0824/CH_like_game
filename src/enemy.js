import { MAP_WIDTH, MAP_HEIGHT } from './config.js';
import { moveEntityToward } from './ai.js';
import { playSfx } from './audio.js';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalize(dx, dy) {
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

function pickWanderTarget(enemy) {
  const radius = enemy.role === 'boss' ? 2.2 : 3.5;
  const angle = Math.random() * Math.PI * 2;
  const dist = Math.random() * radius;
  const tx = clamp(enemy.x + Math.cos(angle) * dist, 0.5, MAP_WIDTH - 0.5);
  const ty = clamp(enemy.y + Math.sin(angle) * dist, 0.5, MAP_HEIGHT - 0.5);
  return { x: tx, y: ty };
}

function pushHazard(state, payload) {
  state.hazardSeq = (state.hazardSeq || 0) + 1;
  state.hazards.push({
    id: `hz-${state.hazardSeq}`,
    source: payload.source || 'enemy',
    ownerId: payload.ownerId || null,
    shape: payload.shape || 'circle',
    phase: 'telegraph',
    remaining: payload.telegraph,
    activeDuration: payload.activeDuration ?? 0.16,
    damage: payload.damage ?? 0,
    x: payload.x,
    y: payload.y,
    radius: payload.radius ?? 0,
    angleDeg: payload.angleDeg ?? 0,
    dirX: payload.dirX ?? 0,
    dirY: payload.dirY ?? 0,
    x1: payload.x1 ?? null,
    y1: payload.y1 ?? null,
    x2: payload.x2 ?? null,
    y2: payload.y2 ?? null,
    width: payload.width ?? 0,
    onActivate: payload.onActivate || null,
  });
}

function hasBossHazard(state, enemyId) {
  return state.hazards.some(
    (hazard) =>
      hazard.ownerId === enemyId &&
      hazard.source === 'boss' &&
      (hazard.phase === 'telegraph' || hazard.phase === 'active')
  );
}

function bossBasicAttack(state, enemy) {
  enemy.state = 'boss_basic';
  enemy.cooldownLeft = Math.max(0.75, enemy.attackCooldown);
  const damage = Math.max(1, Math.round(enemy.attackDamage * 0.75));
  state.player.hp = Math.max(0, state.player.hp - damage);
  playSfx('enemy');
  enemy.bossFlags.requireBasicAfterBig = false;
}

function castBossSweep(state, enemy, playerDir) {
  const damage = Math.max(1, Math.round(enemy.attackDamage * 2.0));
  pushHazard(state, {
    source: 'boss',
    ownerId: enemy.id,
    shape: 'cone',
    telegraph: 0.95,
    activeDuration: 0.18,
    x: enemy.x,
    y: enemy.y,
    dirX: playerDir.x,
    dirY: playerDir.y,
    radius: 3.2,
    angleDeg: 170,
    damage,
  });
  enemy.skillCooldowns.sweep = 4.5;
  enemy.cast = { type: 'recover', remaining: 0.9 };
  enemy.state = 'boss_sweep';
  enemy.bossFlags.requireBasicAfterBig = true;
  enemy.bossFlags.lastBigSkill = 'sweep';
}

function castBossStomp(state, enemy) {
  const damage = Math.max(1, Math.round(enemy.attackDamage * 1.8));
  pushHazard(state, {
    source: 'boss',
    ownerId: enemy.id,
    shape: 'circle',
    telegraph: 1.05,
    activeDuration: 0.2,
    x: enemy.x,
    y: enemy.y,
    radius: 2.3,
    damage,
  });
  enemy.skillCooldowns.stomp = 6.0;
  enemy.cast = { type: 'recover', remaining: 1.0 };
  enemy.state = 'boss_stomp';
  enemy.bossFlags.requireBasicAfterBig = true;
  enemy.bossFlags.lastBigSkill = 'stomp';
}

function castBossDash(state, enemy, dir, targetDist) {
  const reach = clamp(targetDist, 2.8, 4.5);
  const tx = clamp(enemy.x + dir.x * reach, 0.5, MAP_WIDTH - 0.5);
  const ty = clamp(enemy.y + dir.y * reach, 0.5, MAP_HEIGHT - 0.5);
  const damage = Math.max(1, Math.round(enemy.attackDamage * 0.9));
  pushHazard(state, {
    source: 'boss',
    ownerId: enemy.id,
    shape: 'line',
    telegraph: 0.6,
    activeDuration: 0.16,
    x1: enemy.x,
    y1: enemy.y,
    x2: tx,
    y2: ty,
    width: 1.1,
    damage,
    onActivate: {
      moveOwnerTo: {
        id: enemy.id,
        x: tx,
        y: ty,
      },
    },
  });
  enemy.skillCooldowns.dash = 5.0;
  enemy.cast = { type: 'recover', remaining: 0.6 };
  enemy.state = 'boss_dash';
}

function updateBossChampion(state, enemy, dt) {
  if (!enemy.alive) return false;

  if (enemy.cooldownLeft > 0) {
    enemy.cooldownLeft = Math.max(0, enemy.cooldownLeft - dt);
  }
  Object.keys(enemy.skillCooldowns).forEach((key) => {
    enemy.skillCooldowns[key] = Math.max(0, enemy.skillCooldowns[key] - dt);
  });

  if (enemy.cast) {
    enemy.cast.remaining -= dt;
    if (enemy.cast.remaining <= 0) {
      enemy.cast = null;
    } else {
      return false;
    }
  }

  const dx = state.player.x - enemy.x;
  const dy = state.player.y - enemy.y;
  const dist = Math.hypot(dx, dy);
  const dir = normalize(dx, dy);
  const hazardBusy = hasBossHazard(state, enemy.id);

  if (dist <= enemy.attackRange + 0.1 && enemy.cooldownLeft <= 0) {
    const canBig = !hazardBusy && !enemy.bossFlags.requireBasicAfterBig;
    if (canBig && dist <= 1.3 && enemy.skillCooldowns.stomp <= 0) {
      castBossStomp(state, enemy);
      return false;
    }
    if (canBig && dist <= 1.9 && enemy.skillCooldowns.sweep <= 0) {
      castBossSweep(state, enemy, dir);
      return false;
    }
    bossBasicAttack(state, enemy);
    return state.player.hp <= 0;
  }

  if (!hazardBusy && dist >= 3.0 && enemy.skillCooldowns.dash <= 0) {
    castBossDash(state, enemy, dir, dist);
    return false;
  }

  if (dist <= enemy.aggroRange) {
    moveEntityToward(
      enemy,
      state.player,
      enemy.speed,
      dt,
      { minX: 0.5, maxX: MAP_WIDTH - 0.5, minY: 0.5, maxY: MAP_HEIGHT - 0.5 }
    );
    enemy.state = enemy.cooldownLeft > 0 ? 'boss_cooldown' : 'boss_chase';
    enemy.wanderTimer = 0;
    enemy.wanderTarget = null;
    return false;
  }

  enemy.wanderTimer -= dt;
  if (!enemy.wanderTarget || enemy.wanderTimer <= 0 || Math.hypot(enemy.x - enemy.wanderTarget.x, enemy.y - enemy.wanderTarget.y) < 0.45) {
    enemy.wanderTarget = pickWanderTarget(enemy);
    enemy.wanderTimer = 1.0 + Math.random() * 1.2;
  }
  moveEntityToward(
    enemy,
    enemy.wanderTarget,
    enemy.speed * 0.55,
    dt,
    { minX: 0.5, maxX: MAP_WIDTH - 0.5, minY: 0.5, maxY: MAP_HEIGHT - 0.5 }
  );
  enemy.state = 'boss_idle';
  return false;
}

function updateRangedEnemy(state, enemy, dt) {
  const dist = Math.hypot(state.player.x - enemy.x, state.player.y - enemy.y);
  if (dist <= enemy.attackRange && dist >= enemy.minRange && enemy.cooldownLeft <= 0) {
    enemy.state = 'attacking';
    enemy.cooldownLeft = enemy.attackCooldown;
    state.player.hp = Math.max(0, state.player.hp - enemy.attackDamage);
    playSfx('enemy');
    return state.player.hp <= 0;
  }

  if (dist < enemy.minRange) {
    const away = {
      x: clamp(enemy.x - (state.player.x - enemy.x), 0.5, MAP_WIDTH - 0.5),
      y: clamp(enemy.y - (state.player.y - enemy.y), 0.5, MAP_HEIGHT - 0.5),
    };
    moveEntityToward(
      enemy,
      away,
      enemy.speed * 0.8,
      dt,
      { minX: 0.5, maxX: MAP_WIDTH - 0.5, minY: 0.5, maxY: MAP_HEIGHT - 0.5 }
    );
    enemy.state = 'kite';
    return false;
  }

  if (dist <= enemy.aggroRange) {
    const approachDist = dist - enemy.attackRange * 0.8;
    if (approachDist > 0.15) {
      moveEntityToward(
        enemy,
        state.player,
        enemy.speed * 0.75,
        dt,
        { minX: 0.5, maxX: MAP_WIDTH - 0.5, minY: 0.5, maxY: MAP_HEIGHT - 0.5 }
      );
    }
    enemy.state = enemy.cooldownLeft > 0 ? 'cooldown' : 'aim';
    enemy.wanderTimer = 0;
    enemy.wanderTarget = null;
    return false;
  }
  return false;
}

export function updateEnemies(state, dt) {
  let playerDead = false;
  state.enemies.forEach((enemy) => {
    if (!enemy.alive) return;
    if (enemy.cooldownLeft > 0) {
      enemy.cooldownLeft = Math.max(0, enemy.cooldownLeft - dt);
    }

    if (enemy.role === 'boss') {
      if (updateBossChampion(state, enemy, dt)) {
        playerDead = true;
      }
      return;
    }

    if (enemy.behavior === 'ranged') {
      if (updateRangedEnemy(state, enemy, dt)) {
        playerDead = true;
        return;
      }
      const dist = Math.hypot(state.player.x - enemy.x, state.player.y - enemy.y);
      if (dist <= enemy.aggroRange) return;
    }

    const distToPlayer = Math.hypot(state.player.x - enemy.x, state.player.y - enemy.y);
    if (distToPlayer <= enemy.attackRange && enemy.cooldownLeft <= 0) {
      enemy.state = 'attacking';
      enemy.cooldownLeft = enemy.attackCooldown;
      state.player.hp = Math.max(0, state.player.hp - enemy.attackDamage);
      playSfx('enemy');
      if (state.player.hp <= 0) {
        playerDead = true;
      }
      return;
    }

    if (distToPlayer <= enemy.aggroRange) {
      moveEntityToward(
        enemy,
        state.player,
        enemy.speed,
        dt,
        { minX: 0.5, maxX: MAP_WIDTH - 0.5, minY: 0.5, maxY: MAP_HEIGHT - 0.5 }
      );
      enemy.state = enemy.cooldownLeft > 0 ? 'cooldown' : 'chase';
      enemy.wanderTimer = 0;
      enemy.wanderTarget = null;
      return;
    }

    enemy.wanderTimer -= dt;
    if (!enemy.wanderTarget || enemy.wanderTimer <= 0 || Math.hypot(enemy.x - enemy.wanderTarget.x, enemy.y - enemy.wanderTarget.y) < 0.4) {
      enemy.wanderTarget = pickWanderTarget(enemy);
      enemy.wanderTimer = 1.5 + Math.random() * 2.5;
    }

    if (enemy.wanderTarget) {
      moveEntityToward(
        enemy,
        enemy.wanderTarget,
        enemy.speed * 0.6,
        dt,
        { minX: 0.5, maxX: MAP_WIDTH - 0.5, minY: 0.5, maxY: MAP_HEIGHT - 0.5 }
      );
    }
    enemy.state = enemy.cooldownLeft > 0 ? 'cooldown' : 'wander';
  });

  return playerDead;
}
