import { MAP_WIDTH, MAP_HEIGHT } from './config.js';
import { moveEntityToward } from './ai.js';
import { playSfx } from './audio.js';

export function updateEnemy(state, dt) {
  if (!state.enemy.alive) return false;
  const enemy = state.enemy;
  if (enemy.cooldownLeft > 0) {
    enemy.cooldownLeft = Math.max(0, enemy.cooldownLeft - dt);
  }
  const dist = Math.hypot(state.player.x - enemy.x, state.player.y - enemy.y);
  if (dist <= enemy.attackRange && enemy.cooldownLeft <= 0) {
    enemy.state = 'attacking';
    enemy.cooldownLeft = enemy.attackCooldown;
    state.player.hp = Math.max(0, state.player.hp - enemy.attackDamage);
    playSfx('enemy');
    return state.player.hp <= 0;
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
  } else {
    enemy.state = enemy.cooldownLeft > 0 ? 'cooldown' : 'idle';
  }
  return false;
}
