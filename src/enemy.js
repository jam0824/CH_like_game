import { MAP_WIDTH, MAP_HEIGHT } from './config.js';
import { moveEntityToward } from './ai.js';
import { playSfx } from './audio.js';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function pickWanderTarget(enemy) {
  const radius = 3.5;
  const angle = Math.random() * Math.PI * 2;
  const dist = Math.random() * radius;
  const tx = clamp(enemy.x + Math.cos(angle) * dist, 0.5, MAP_WIDTH - 0.5);
  const ty = clamp(enemy.y + Math.sin(angle) * dist, 0.5, MAP_HEIGHT - 0.5);
  return { x: tx, y: ty };
}

export function updateEnemies(state, dt) {
  let playerDead = false;
  state.enemies.forEach((enemy) => {
    if (!enemy.alive) return;
    if (enemy.cooldownLeft > 0) {
      enemy.cooldownLeft = Math.max(0, enemy.cooldownLeft - dt);
    }

    const dist = Math.hypot(state.player.x - enemy.x, state.player.y - enemy.y);
    if (dist <= enemy.attackRange && enemy.cooldownLeft <= 0) {
      enemy.state = 'attacking';
      enemy.cooldownLeft = enemy.attackCooldown;
      state.player.hp = Math.max(0, state.player.hp - enemy.attackDamage);
      playSfx('enemy');
      if (state.player.hp <= 0) {
        playerDead = true;
      }
      return;
    }

    if (dist <= enemy.aggroRange) {
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
