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

function drawSpriteScaled(ctx, img, x, y, size, scale) {
  drawSprite(ctx, img, x, y, size * scale);
}

function drawHazardCircle(ctx, hazard) {
  const px = hazard.x * TILE_SIZE;
  const py = hazard.y * TILE_SIZE;
  const radius = (hazard.radius || 0.8) * TILE_SIZE;
  const telegraph = hazard.phase === 'telegraph';
  ctx.beginPath();
  ctx.arc(px, py, radius, 0, Math.PI * 2);
  ctx.fillStyle = telegraph ? 'rgba(224,90,79,0.28)' : 'rgba(224,90,79,0.52)';
  ctx.strokeStyle = telegraph ? 'rgba(240,192,74,0.9)' : 'rgba(255,120,120,0.98)';
  ctx.lineWidth = telegraph ? 2 : 3;
  ctx.fill();
  ctx.stroke();
}

function drawHazardLine(ctx, hazard) {
  const x1 = hazard.x1 * TILE_SIZE;
  const y1 = hazard.y1 * TILE_SIZE;
  const x2 = hazard.x2 * TILE_SIZE;
  const y2 = hazard.y2 * TILE_SIZE;
  const width = (hazard.width || 1.0) * TILE_SIZE;
  const telegraph = hazard.phase === 'telegraph';
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = telegraph ? 'rgba(240,192,74,0.86)' : 'rgba(255,90,90,0.98)';
  ctx.lineWidth = telegraph ? Math.max(2, width * 0.38) : Math.max(3, width * 0.52);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

function drawHazardCone(ctx, hazard) {
  const telegraph = hazard.phase === 'telegraph';
  const px = hazard.x * TILE_SIZE;
  const py = hazard.y * TILE_SIZE;
  const radius = (hazard.radius || 2.2) * TILE_SIZE;
  const baseAngle = Math.atan2(hazard.dirY || 0, hazard.dirX || 1);
  const half = ((hazard.angleDeg || 120) * 0.5 * Math.PI) / 180;
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.arc(px, py, radius, baseAngle - half, baseAngle + half);
  ctx.closePath();
  ctx.fillStyle = telegraph ? 'rgba(224,90,79,0.24)' : 'rgba(224,90,79,0.5)';
  ctx.strokeStyle = telegraph ? 'rgba(240,192,74,0.85)' : 'rgba(255,120,120,0.95)';
  ctx.lineWidth = telegraph ? 2 : 3;
  ctx.fill();
  ctx.stroke();
}

function drawHazards(ctx, state) {
  state.hazards.forEach((hazard) => {
    if (hazard.shape === 'line') {
      drawHazardLine(ctx, hazard);
      return;
    }
    if (hazard.shape === 'cone') {
      drawHazardCone(ctx, hazard);
      return;
    }
    drawHazardCircle(ctx, hazard);
  });
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
    drawSpriteScaled(ctx, assets.exit, state.exit.x, state.exit.y, TILE_SIZE, 0.6);
  }

  state.traps.forEach((trap) => {
    if (!trap.active) return;
    if (assets.trap) {
      drawSpriteScaled(ctx, assets.trap, trap.x, trap.y, TILE_SIZE, 0.5);
    } else {
      ctx.fillStyle = '#d9534f';
      ctx.fillRect(trap.x * TILE_SIZE - 12, trap.y * TILE_SIZE - 12, 24, 24);
    }
  });

  state.treasures.forEach((treasure) => {
    if (treasure.opened) return;
    if (assets.treasure) {
      drawSpriteScaled(ctx, assets.treasure, treasure.x, treasure.y, TILE_SIZE, 0.6);
    } else {
      ctx.fillStyle = '#f0c419';
      ctx.fillRect(treasure.x * TILE_SIZE - 12, treasure.y * TILE_SIZE - 12, 24, 24);
    }
  });

  drawHazards(ctx, state);

  state.enemies.forEach((enemy) => {
    if (!enemy.alive) return;
    const scale = enemy.role === 'boss' ? 1.28 : 1.0;
    drawSprite(ctx, assets.enemy, enemy.x, enemy.y, TILE_SIZE * scale);
  });

  drawSprite(ctx, assets.player, state.player.x, state.player.y, TILE_SIZE);
}
