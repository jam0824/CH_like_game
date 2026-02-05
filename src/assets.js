import { ASSET_PATHS } from './config.js';

export const assets = {
  floor: null,
  exit: null,
  trap: null,
  treasure: null,
  player: null,
  enemy: null,
  chips: {},
};

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function loadAssets() {
  const safeLoad = async (src) => {
    try {
      return await loadImage(src);
    } catch (error) {
      console.warn(`Failed to load asset: ${src}`, error);
      return null;
    }
  };
  assets.floor = await safeLoad(ASSET_PATHS.floor);
  assets.exit = await safeLoad(ASSET_PATHS.exit);
  assets.trap = await safeLoad(ASSET_PATHS.trap);
  assets.treasure = await safeLoad(ASSET_PATHS.treasure);
  assets.player = await safeLoad(ASSET_PATHS.player);
  assets.enemy = await safeLoad(ASSET_PATHS.enemy);
  for (const key of Object.keys(ASSET_PATHS.chips)) {
    assets.chips[key] = await safeLoad(ASSET_PATHS.chips[key]);
  }
}
