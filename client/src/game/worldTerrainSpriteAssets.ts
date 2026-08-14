import type Phaser from "phaser";

export const WORLD_TERRAIN_SPRITE_KEYS = {
  grass: "tile-grass",
  earth: "tile-earth",
  water: "tile-water",
  forest: "tile-forest-sprite",
  sand: "tile-sand-sprite",
  snow: "tile-snow-sprite",
  swamp: "tile-swamp-sprite"
} as const;

const WORLD_TERRAIN_SPRITE_URLS = {
  grass: "/assets/world/terrain-sprites-v1/grass-lite2.png?v=20260814-clean1",
  earth: "/assets/world/terrain-sprites-v1/earth.png?v=20260813-lite1",
  water: "/assets/world/terrain-sprites-v1/water.png?v=20260813-lite1",
  forest: "/assets/world/terrain-sprites-v1/forest.png?v=20260813-lite1",
  sand: "/assets/world/terrain-sprites-v1/sand.png?v=20260813-lite1",
  snow: "/assets/world/terrain-sprites-v1/snow.png?v=20260813-lite1",
  swamp: "/assets/world/terrain-sprites-v1/swamp.png?v=20260813-lite1"
} as const;

export function preloadWorldTerrainSpriteAssets(scene: Phaser.Scene): void {
  (Object.keys(WORLD_TERRAIN_SPRITE_KEYS) as Array<keyof typeof WORLD_TERRAIN_SPRITE_KEYS>).forEach((kind) => {
    const key = WORLD_TERRAIN_SPRITE_KEYS[kind];
    if (!scene.textures.exists(key)) {
      scene.load.image(key, WORLD_TERRAIN_SPRITE_URLS[kind]);
    }
  });
}
