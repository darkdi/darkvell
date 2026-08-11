import type Phaser from "phaser";
import type { MonsterArchetype } from "@mmo/shared";

const ASSET_ROOT = "/assets/darkvell-original/v1";
const FRAME_WIDTH = 384;
const FRAME_HEIGHT = 512;

export const DARKVELL_CITY_ATLAS_KEY = "darkvell-city-architecture-v1";

export type DarkVellMonsterMotion = "idle" | "walkA" | "walkB" | "attack";

export interface DarkVellMonsterArt {
  frame: number;
  idleTexture: string;
  walkATexture: string;
  walkBTexture: string;
  attackTexture: string;
  flying: boolean;
  widthScale: number;
  heightScale: number;
  originY: number;
}

const archetypeTextures = {
  idle: "darkvell-monster-archetypes-idle-v1",
  walkA: "darkvell-monster-archetypes-walk-a-v1",
  walkB: "darkvell-monster-archetypes-walk-b-v1",
  attack: "darkvell-monster-archetypes-attack-v1"
} as const;

const specialistTextures = {
  idle: "darkvell-monster-specialists-idle-v1",
  walkA: "darkvell-monster-specialists-walk-a-v1",
  walkB: "darkvell-monster-specialists-walk-b-v1",
  attack: "darkvell-monster-specialists-attack-v1"
} as const;

const art = (
  textures: typeof archetypeTextures | typeof specialistTextures,
  frame: number,
  options: Partial<Pick<DarkVellMonsterArt, "flying" | "widthScale" | "heightScale" | "originY">> = {}
): DarkVellMonsterArt => ({
  frame,
  idleTexture: textures.idle,
  walkATexture: textures.walkA,
  walkBTexture: textures.walkB,
  attackTexture: textures.attack,
  flying: options.flying ?? false,
  widthScale: options.widthScale ?? 1.52,
  heightScale: options.heightScale ?? 1.46,
  originY: options.originY ?? 0.82
});

const monsterArt: Record<MonsterArchetype, DarkVellMonsterArt> = {
  bat: art(archetypeTextures, 0, { flying: true, widthScale: 1.72, heightScale: 1.56, originY: 0.72 }),
  boar: art(archetypeTextures, 1, { widthScale: 1.62, heightScale: 1.5, originY: 0.8 }),
  wolf: art(archetypeTextures, 2, { widthScale: 1.64, heightScale: 1.5, originY: 0.8 }),
  spider: art(archetypeTextures, 3, { widthScale: 1.58, heightScale: 1.42, originY: 0.78 }),
  skeleton: art(archetypeTextures, 4, { widthScale: 1.5, heightScale: 1.45, originY: 0.84 }),
  venomplant: art(archetypeTextures, 5, { widthScale: 1.5, heightScale: 1.42, originY: 0.82 }),
  golem: art(archetypeTextures, 6, { widthScale: 1.5, heightScale: 1.46, originY: 0.84 }),
  drake: art(archetypeTextures, 7, { widthScale: 1.56, heightScale: 1.46, originY: 0.8 }),
  dragon: art(archetypeTextures, 7, { flying: true, widthScale: 1.58, heightScale: 1.5, originY: 0.78 }),
  bonewarrior: art(archetypeTextures, 4, { widthScale: 1.5, heightScale: 1.45, originY: 0.84 }),
  bandit: art(specialistTextures, 0, { widthScale: 1.5, heightScale: 1.45, originY: 0.84 }),
  archer: art(specialistTextures, 1, { widthScale: 1.54, heightScale: 1.46, originY: 0.84 }),
  witch: art(specialistTextures, 2, { widthScale: 1.54, heightScale: 1.46, originY: 0.84 }),
  mage: art(specialistTextures, 3, { widthScale: 1.54, heightScale: 1.46, originY: 0.84 }),
  wraith: art(specialistTextures, 4, { flying: true, widthScale: 1.58, heightScale: 1.5, originY: 0.78 }),
  eye: art(specialistTextures, 5, { flying: true, widthScale: 1.58, heightScale: 1.48, originY: 0.72 }),
  firespirit: art(specialistTextures, 6, { widthScale: 1.5, heightScale: 1.46, originY: 0.84 }),
  sentinel: art(specialistTextures, 7, { widthScale: 1.52, heightScale: 1.46, originY: 0.84 }),
  miniboss: art(specialistTextures, 6, { widthScale: 1.52, heightScale: 1.46, originY: 0.84 }),
  dungeonboss: art(specialistTextures, 7, { widthScale: 1.54, heightScale: 1.48, originY: 0.84 }),
  boss: art(archetypeTextures, 6, { widthScale: 1.54, heightScale: 1.48, originY: 0.84 })
};

const queueSheet = (scene: Phaser.Scene, key: string, file: string): void => {
  scene.load.spritesheet(key, `${ASSET_ROOT}/${file}`, {
    frameWidth: FRAME_WIDTH,
    frameHeight: FRAME_HEIGHT
  });
};

export function preloadDarkVellOriginalAssets(scene: Phaser.Scene): void {
  queueSheet(scene, DARKVELL_CITY_ATLAS_KEY, "city-architecture.png");
  queueSheet(scene, archetypeTextures.idle, "monster-archetypes-idle.png");
  queueSheet(scene, archetypeTextures.walkA, "monster-archetypes-walk-a.png");
  queueSheet(scene, archetypeTextures.walkB, "monster-archetypes-walk-b.png");
  queueSheet(scene, archetypeTextures.attack, "monster-archetypes-attack.png");
  queueSheet(scene, specialistTextures.idle, "monster-specialists-idle.png");
  queueSheet(scene, specialistTextures.walkA, "monster-specialists-walk-a.png");
  queueSheet(scene, specialistTextures.walkB, "monster-specialists-walk-b.png");
  queueSheet(scene, specialistTextures.attack, "monster-specialists-attack.png");
}

export function darkVellMonsterArtFor(archetype: MonsterArchetype): DarkVellMonsterArt {
  return monsterArt[archetype];
}

export function darkVellMonsterTexture(artwork: DarkVellMonsterArt, motion: DarkVellMonsterMotion): string {
  if (motion === "walkA") {
    return artwork.walkATexture;
  }
  if (motion === "walkB") {
    return artwork.walkBTexture;
  }
  if (motion === "attack") {
    return artwork.attackTexture;
  }
  return artwork.idleTexture;
}
