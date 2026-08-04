import type Phaser from "phaser";
import type { MonsterSpritePackId } from "@mmo/shared";

export type MonsterSpriteState = "idle" | "move" | "attack" | "spawn" | "death";

export interface MonsterSpriteSkin {
  packId: MonsterSpritePackId;
  atlasKey: string;
  atlasFile: string;
  assetRoot: string;
  flying: boolean;
  aspectRatio: number;
  heightScale: number;
  preload: boolean;
  pixelArt: boolean;
  smoothDownscale: boolean;
  frameCounts?: Partial<Record<MonsterSpriteState, number>>;
  durationsMs?: Partial<Record<MonsterSpriteState, number>>;
}

const BESTIARY_ASSET_ROOT = "/assets/monsters/v1";
const PIXEL_ASSET_ROOT = "/assets/monsters/pixel-v1";
export const MONSTER_SPRITE_FRAME_COUNT = 18;
export const MONSTER_SPRITE_ATTACK_DURATION_MS = 600;
export const MONSTER_SPRITE_DEATH_DURATION_MS = 600;
export const MONSTER_SPRITE_SPAWN_DURATION_MS = 600;

const bestiaryPack = (
  packId: MonsterSpritePackId,
  flying: boolean,
  sourceWidth: number,
  sourceHeight: number,
  heightScale: number
): MonsterSpriteSkin => ({
  packId,
  atlasKey: `monster-pack-${packId}-v1`,
  atlasFile: `monster-${packId}.json`,
  assetRoot: BESTIARY_ASSET_ROOT,
  flying,
  aspectRatio: sourceWidth / sourceHeight,
  heightScale,
  preload: false,
  pixelArt: false,
  smoothDownscale: false
});

const pixelPack = (
  packId: MonsterSpritePackId,
  flying: boolean,
  heightScale: number,
  frameCounts: Record<MonsterSpriteState, number>,
  durationsMs: Record<MonsterSpriteState, number>,
  smoothDownscale = false
): MonsterSpriteSkin => ({
  packId,
  atlasKey: `pixel-monster-pack-${packId}-v1`,
  atlasFile: `pixel-monster-${packId}.json`,
  assetRoot: PIXEL_ASSET_ROOT,
  flying,
  aspectRatio: 1,
  heightScale,
  preload: true,
  pixelArt: true,
  smoothDownscale,
  frameCounts,
  durationsMs
});

const monsterSpriteSkins: Record<MonsterSpritePackId, MonsterSpriteSkin> = {
  1: bestiaryPack(1, true, 215, 146, 0.9),
  2: bestiaryPack(2, true, 274, 238, 0.95),
  3: bestiaryPack(3, true, 258, 138, 1),
  4: bestiaryPack(4, true, 245, 219, 1.05),
  5: bestiaryPack(5, true, 180, 169, 0.95),
  6: bestiaryPack(6, false, 249, 156, 1),
  7: bestiaryPack(7, false, 213, 146, 1),
  8: bestiaryPack(8, false, 256, 184, 1.05),
  9: bestiaryPack(9, false, 180, 97, 0.9),
  10: bestiaryPack(10, false, 194, 144, 1),
  11: pixelPack(
    11,
    false,
    1.35,
    { idle: 5, move: 9, attack: 6, spawn: 11, death: 2 },
    { idle: 700, move: 810, attack: 600, spawn: 880, death: 420 }
  ),
  12: pixelPack(
    12,
    false,
    1.35,
    { idle: 7, move: 8, attack: 7, spawn: 10, death: 3 },
    { idle: 840, move: 720, attack: 650, spawn: 850, death: 480 },
    true
  ),
  13: pixelPack(
    13,
    true,
    1.55,
    { idle: 6, move: 7, attack: 14, spawn: 11, death: 5 },
    { idle: 720, move: 630, attack: 800, spawn: 760, death: 500 }
  )
};

const requestedAtlasKeysByScene = new WeakMap<Phaser.Scene, Set<string>>();

const queueMonsterSpriteAsset = (scene: Phaser.Scene, skin: MonsterSpriteSkin): void => {
  const requestedAtlasKeys = requestedAtlasKeysByScene.get(scene) ?? new Set<string>();
  if (scene.textures.exists(skin.atlasKey) || requestedAtlasKeys.has(skin.atlasKey)) {
    return;
  }
  requestedAtlasKeysByScene.set(scene, requestedAtlasKeys);
  requestedAtlasKeys.add(skin.atlasKey);
  scene.load.multiatlas(skin.atlasKey, `${skin.assetRoot}/${skin.atlasFile}`, `${skin.assetRoot}/`);
};

export function preloadMonsterSpriteAssets(scene: Phaser.Scene): void {
  Object.values(monsterSpriteSkins)
    .filter((skin) => skin.preload)
    .forEach((skin) => queueMonsterSpriteAsset(scene, skin));
}

export function requestMonsterSpriteAsset(scene: Phaser.Scene, spritePackId?: MonsterSpritePackId): void {
  const skin = spritePackId === undefined ? undefined : monsterSpriteSkins[spritePackId];
  if (!skin || scene.textures.exists(skin.atlasKey)) {
    return;
  }
  queueMonsterSpriteAsset(scene, skin);
  if (!scene.load.isLoading()) {
    scene.load.start();
  }
}

export function monsterSpriteSkinFor(spritePackId?: MonsterSpritePackId): MonsterSpriteSkin | undefined {
  return spritePackId === undefined ? undefined : monsterSpriteSkins[spritePackId];
}

export function monsterSpriteSequence(skin: MonsterSpriteSkin, state: MonsterSpriteState): string {
  if (state === "move") {
    return skin.flying ? "fly" : "walking";
  }
  if (state === "spawn") {
    return skin.flying ? "fall" : "jump";
  }
  if (state === "death") {
    return "dying";
  }
  return state;
}

export function monsterSpriteFrameCount(skin: MonsterSpriteSkin, state: MonsterSpriteState): number {
  const configuredCount = skin.frameCounts?.[state];
  if (configuredCount !== undefined) {
    return configuredCount;
  }
  if (skin.packId === 7 && state === "death") {
    return 11;
  }
  if (skin.packId === 8 && state === "spawn") {
    return 8;
  }
  return MONSTER_SPRITE_FRAME_COUNT;
}

export function monsterSpriteFrameName(skin: MonsterSpriteSkin, state: MonsterSpriteState, frame: number): string {
  return `${monsterSpriteSequence(skin, state)}/${String(frame).padStart(2, "0")}`;
}

export function monsterSpriteStateDurationMs(state: MonsterSpriteState, skin?: MonsterSpriteSkin): number {
  const configuredDuration = skin?.durationsMs?.[state];
  if (configuredDuration !== undefined) {
    return configuredDuration;
  }
  if (state === "idle") {
    return 900;
  }
  if (state === "spawn") {
    return MONSTER_SPRITE_SPAWN_DURATION_MS;
  }
  if (state === "death") {
    return MONSTER_SPRITE_DEATH_DURATION_MS;
  }
  return MONSTER_SPRITE_ATTACK_DURATION_MS;
}
