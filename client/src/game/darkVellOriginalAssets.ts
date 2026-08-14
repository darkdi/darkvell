import type Phaser from "phaser";
import type { MonsterArchetype } from "@mmo/shared";

const ASSET_ROOT = "/assets/darkvell-original/v1";
const FRAME_WIDTH = 192;
const FRAME_HEIGHT = 256;

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

const archetypeTexture = "darkvell-dungeon-cartoon-archetypes-v1";
const specialistTexture = "darkvell-dungeon-cartoon-specialists-v1";

const art = (
  texture: string,
  frame: number,
  options: Partial<Pick<DarkVellMonsterArt, "flying" | "widthScale" | "heightScale" | "originY">> = {}
): DarkVellMonsterArt => ({
  frame,
  idleTexture: texture,
  walkATexture: texture,
  walkBTexture: texture,
  attackTexture: texture,
  flying: options.flying ?? false,
  widthScale: options.widthScale ?? 1.52,
  heightScale: options.heightScale ?? 1.46,
  originY: options.originY ?? 0.82
});

const monsterArt: Record<MonsterArchetype, DarkVellMonsterArt> = {
  bat: art(archetypeTexture, 0, { flying: true, widthScale: 1.72, heightScale: 1.56, originY: 0.72 }),
  boar: art(archetypeTexture, 1, { widthScale: 1.62, heightScale: 1.5, originY: 0.8 }),
  wolf: art(archetypeTexture, 2, { widthScale: 1.64, heightScale: 1.5, originY: 0.8 }),
  spider: art(archetypeTexture, 3, { widthScale: 1.58, heightScale: 1.42, originY: 0.78 }),
  skeleton: art(archetypeTexture, 4, { widthScale: 1.5, heightScale: 1.45, originY: 0.84 }),
  venomplant: art(archetypeTexture, 5, { widthScale: 1.5, heightScale: 1.42, originY: 0.82 }),
  golem: art(archetypeTexture, 6, { widthScale: 1.5, heightScale: 1.46, originY: 0.84 }),
  drake: art(archetypeTexture, 7, { widthScale: 1.56, heightScale: 1.46, originY: 0.8 }),
  dragon: art(archetypeTexture, 7, { flying: true, widthScale: 1.58, heightScale: 1.5, originY: 0.78 }),
  bonewarrior: art(archetypeTexture, 4, { widthScale: 1.5, heightScale: 1.45, originY: 0.84 }),
  bandit: art(specialistTexture, 0, { widthScale: 1.5, heightScale: 1.45, originY: 0.84 }),
  archer: art(specialistTexture, 1, { widthScale: 1.54, heightScale: 1.46, originY: 0.84 }),
  witch: art(specialistTexture, 2, { widthScale: 1.54, heightScale: 1.46, originY: 0.84 }),
  mage: art(specialistTexture, 3, { widthScale: 1.54, heightScale: 1.46, originY: 0.84 }),
  wraith: art(specialistTexture, 4, { flying: true, widthScale: 1.58, heightScale: 1.5, originY: 0.78 }),
  eye: art(specialistTexture, 5, { flying: true, widthScale: 1.58, heightScale: 1.48, originY: 0.72 }),
  firespirit: art(specialistTexture, 6, { widthScale: 1.5, heightScale: 1.46, originY: 0.84 }),
  sentinel: art(specialistTexture, 7, { widthScale: 1.52, heightScale: 1.46, originY: 0.84 }),
  miniboss: art(specialistTexture, 6, { widthScale: 1.52, heightScale: 1.46, originY: 0.84 }),
  dungeonboss: art(specialistTexture, 7, { widthScale: 1.54, heightScale: 1.48, originY: 0.84 }),
  boss: art(archetypeTexture, 6, { widthScale: 1.54, heightScale: 1.48, originY: 0.84 })
};

const queueSheet = (scene: Phaser.Scene, key: string, file: string): void => {
  scene.load.spritesheet(key, `${ASSET_ROOT}/${file}?v=20260813-lite1`, {
    frameWidth: FRAME_WIDTH,
    frameHeight: FRAME_HEIGHT
  });
};

export function preloadDarkVellOriginalAssets(scene: Phaser.Scene): void {
  queueSheet(scene, archetypeTexture, "monster-dungeon-cartoon-archetypes.png");
  queueSheet(scene, specialistTexture, "monster-dungeon-cartoon-specialists.png");
}

export function darkVellMonsterArtFor(archetype: MonsterArchetype): DarkVellMonsterArt {
  return monsterArt[archetype];
}

export function darkVellMonsterTexture(artwork: DarkVellMonsterArt, motion: DarkVellMonsterMotion): string {
  void motion;
  return artwork.idleTexture;
}
