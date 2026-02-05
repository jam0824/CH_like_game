import { MAP_HEIGHT, MAP_WIDTH, TILE_SIZE } from './config.js';

function drawSprite(ctx, img, x, y, size) {
  const px = x * TILE_SIZE - size / 2;
  const py = y * TILE_SIZE - size / 2;
  if (img && img.complete) {
    ctx.drawImage(img, px, py, size, size);
  } else {
    ctx.fillStyle = '#f4b860';
    ctx.fillRect(px, py, size, size);
  }
}

export function renderGame(ctx, canvas, assets, state) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (assets.floor && assets.floor.complete) {
    for (let y = 0; y < MAP_HEIGHT; y += 1) {
      for (let x = 0; x < MAP_WIDTH; x += 1) {
        ctx.drawImage(assets.floor, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }
  } else {
    ctx.fillStyle = '#2a2f3b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  if (state.exit.active) {
    drawSprite(ctx, assets.exit, state.exit.x, state.exit.y, TILE_SIZE);
  }
  state.traps.forEach((trap) => {
    if (!trap.active) return;
    if (assets.trap) {
      drawSprite(ctx, assets.trap, trap.x, trap.y, TILE_SIZE);
    } else {
      ctx.fillStyle = '#d9534f';
      ctx.fillRect(trap.x * TILE_SIZE - 10, trap.y * TILE_SIZE - 10, 20, 20);
    }
  });
  state.treasures.forEach((treasure) => {
    if (treasure.opened) return;
    if (assets.treasure) {
      drawSprite(ctx, assets.treasure, treasure.x, treasure.y, TILE_SIZE);
    } else {
      ctx.fillStyle = '#f0c419';
      ctx.fillRect(treasure.x * TILE_SIZE - 10, treasure.y * TILE_SIZE - 10, 20, 20);
    }
  });
  if (state.enemy.alive) {
    drawSprite(ctx, assets.enemy, state.enemy.x, state.enemy.y, TILE_SIZE);
  }
  drawSprite(ctx, assets.player, state.player.x, state.player.y, TILE_SIZE);
}
