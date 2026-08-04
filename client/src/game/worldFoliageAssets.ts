import type Phaser from "phaser";
import type { WorldBiomeKind } from "@mmo/shared";

export const WORLD_FOLIAGE_ATLAS_KEY = "world-foliage-v1";
const WORLD_FOLIAGE_ASSET_ROOT = "/assets/world/foliage-v1";

export type WorldFoliageForm = "tree" | "sapling" | "ground" | "bush";

export interface WorldFoliagePalette {
  treeFrames: readonly string[];
  bushFrames: readonly string[];
  densityScale: number;
  treeShare: number;
}

const frames = (family: string, numbers: readonly number[]) => numbers.map((number) => `tree/${family}/${number}`);
const bushes = (families: readonly number[]) => families.flatMap((family) => [1, 2, 3, 4].map((size) => `bush/${family}/${size}`));

const birch = frames("birch", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
const fir = frames("fir", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
const jungle = frames("jungle", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
const middle = frames("middle", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
const winterConifer = frames("winter-conifer", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
const winterBare = frames("winter-bare", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

const damagedBirch = frames("birch", [7, 8, 9, 10, 11, 12]);
const damagedFir = frames("fir", [6, 7, 8, 9, 10, 11]);
const damagedJungle = frames("jungle", [5, 6, 7, 9, 10, 11, 12, 13, 14]);
const damagedMiddle = frames("middle", [1, 7, 8, 9, 10, 11]);
const livingJungle = frames("jungle", [1, 2, 3, 4, 8, 10]);

const BIOME_PALETTES: Record<WorldBiomeKind, WorldFoliagePalette> = {
  grass: {
    treeFrames: [...birch, ...middle],
    bushFrames: bushes([1, 2, 3, 7, 8, 9, 10]),
    densityScale: 0.84,
    treeShare: 0.54
  },
  forest: {
    treeFrames: [...birch, ...fir, ...middle],
    bushFrames: bushes([1, 2, 3, 7, 8, 9, 10]),
    densityScale: 1.12,
    treeShare: 0.7
  },
  darkForest: {
    treeFrames: [...jungle, ...damagedBirch, ...damagedFir, ...damagedMiddle],
    bushFrames: bushes([4, 5, 8, 9]),
    densityScale: 1.08,
    treeShare: 0.66
  },
  swamp: {
    treeFrames: jungle,
    bushFrames: bushes([4, 5, 8, 9]),
    densityScale: 0.86,
    treeShare: 0.54
  },
  snow: {
    treeFrames: [...winterConifer, ...winterBare],
    bushFrames: bushes([4, 6]),
    densityScale: 0.78,
    treeShare: 0.72
  },
  mountain: {
    treeFrames: [...fir, ...winterConifer, ...winterBare],
    bushFrames: bushes([3, 4, 6]),
    densityScale: 0.4,
    treeShare: 0.7
  },
  coast: {
    treeFrames: [...birch, ...middle, ...livingJungle],
    bushFrames: bushes([1, 2, 3, 7, 8, 10]),
    densityScale: 0.5,
    treeShare: 0.42
  },
  desert: {
    treeFrames: [...damagedJungle, ...damagedFir],
    bushFrames: bushes([3, 4]),
    densityScale: 0.28,
    treeShare: 0.38
  },
  fire: {
    treeFrames: [...damagedJungle, ...damagedFir],
    bushFrames: bushes([4, 7]),
    densityScale: 0.24,
    treeShare: 0.45
  },
  void: {
    treeFrames: [...damagedJungle, ...damagedFir, ...damagedMiddle],
    bushFrames: bushes([4, 8, 9]),
    densityScale: 0.3,
    treeShare: 0.42
  }
};

const GROUND_FRAMES = new Set([
  ...frames("birch", [8, 9, 12]),
  ...frames("fir", [8, 9, 11]),
  ...frames("jungle", [10, 11, 12, 13, 14]),
  ...frames("middle", [1, 8, 9]),
  ...frames("winter-conifer", [10, 12]),
  ...frames("winter-bare", [1, 3, 4, 10])
]);

const SAPLING_FRAMES = new Set([
  ...frames("birch", [7, 10, 11]),
  ...frames("fir", [6, 7, 10]),
  ...frames("jungle", [8, 9]),
  ...frames("middle", [7, 10, 11]),
  ...frames("winter-conifer", [6, 7, 8, 9, 11]),
  ...frames("winter-bare", [2, 5, 6])
]);

export function preloadWorldFoliageAssets(scene: Phaser.Scene): void {
  if (scene.textures.exists(WORLD_FOLIAGE_ATLAS_KEY)) {
    return;
  }
  scene.load.multiatlas(
    WORLD_FOLIAGE_ATLAS_KEY,
    `${WORLD_FOLIAGE_ASSET_ROOT}/foliage.json`,
    `${WORLD_FOLIAGE_ASSET_ROOT}/`
  );
}

export function worldFoliagePaletteFor(biome: WorldBiomeKind): WorldFoliagePalette {
  return BIOME_PALETTES[biome];
}

export function worldFoliageFormForFrame(frame: string): WorldFoliageForm {
  if (frame.startsWith("bush/")) {
    return "bush";
  }
  if (GROUND_FRAMES.has(frame)) {
    return "ground";
  }
  if (SAPLING_FRAMES.has(frame)) {
    return "sapling";
  }
  return "tree";
}
