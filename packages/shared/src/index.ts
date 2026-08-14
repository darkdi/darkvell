export const TICK_RATE = 20;
export const TICK_MS = 1000 / TICK_RATE;
export const MAX_PLAYERS_PER_WORLD = 3000;
export const MAX_WEAPON_ENCHANT_LEVEL = 20;
export const MAX_ARMOR_ENCHANT_LEVEL = 10;
export const CHARACTER_FACE_VARIANTS_PER_GENDER = 96;
export const CHARACTER_FACE_VARIANT_COUNT = CHARACTER_FACE_VARIANTS_PER_GENDER * 2;

export function xpForNextLevel(level: number): number {
  const tier = Math.max(0, level - 1);
  return Math.round(240 + tier * 135 + tier * tier * 38);
}

export const WORLD_BOUNDS = {
  width: 48000,
  height: 32000,
  safeRadius: 1150,
  town: { x: 1500, y: 2800 }
} as const;

export type CharacterClass = "warrior" | "assassin" | "mage" | "archer" | "tank";
export type CharacterRace = "human" | "elf" | "darkelf" | "orc";
export type CharacterGender = "male" | "female";

export function characterGenderFromFace(face?: number): CharacterGender {
  const normalized = Math.max(1, Math.min(CHARACTER_FACE_VARIANT_COUNT, Math.trunc(face ?? 1)));
  return normalized > CHARACTER_FACE_VARIANTS_PER_GENDER ? "female" : "male";
}

export function characterFaceStyleVariant(face?: number): number {
  const normalized = Math.max(1, Math.min(CHARACTER_FACE_VARIANT_COUNT, Math.trunc(face ?? 1)));
  return ((normalized - 1) % CHARACTER_FACE_VARIANTS_PER_GENDER) + 1;
}
export type ZoneKind = "safe" | "pvp" | "boss" | "dungeon";
export type CurrencyCode = "gold" | "crystal" | "token";
export type ChatChannel = "local" | "zone" | "dungeon" | "world" | "clan" | "system";
export type ClanRole = "leader" | "member";
export type ClanEmblem = "crown" | "sword" | "shield" | "star" | "moon" | "flame";
export type MonsterArchetype =
  | "wolf"
  | "boar"
  | "spider"
  | "bat"
  | "skeleton"
  | "bandit"
  | "archer"
  | "mage"
  | "golem"
  | "wraith"
  | "drake"
  | "eye"
  | "witch"
  | "dragon"
  | "sentinel"
  | "miniboss"
  | "dungeonboss"
  | "venomplant"
  | "bonewarrior"
  | "firespirit"
  | "boss";
export type MonsterSpritePackId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;
export type MonsterAttackStyle =
  | "claw"
  | "weapon"
  | "arrow"
  | "power-arrow"
  | "magic-bolt"
  | "lightning"
  | "shadow"
  | "arcane"
  | "flame"
  | "slam";
export type ItemGrade = "common" | "rare" | "epic" | "legendary" | "mythic" | "relic";
export type DisplayItemGrade = "No Grade" | "D" | "C" | "B" | "A" | "S";
export const ITEM_GRADE_LABELS: Record<ItemGrade, DisplayItemGrade> = {
  common: "No Grade",
  rare: "D",
  epic: "C",
  legendary: "B",
  mythic: "A",
  relic: "S"
};

export function itemGradeLabel(grade?: ItemGrade): DisplayItemGrade {
  return grade ? ITEM_GRADE_LABELS[grade] : "No Grade";
}

export function itemGradeText(grade?: ItemGrade): string {
  const label = itemGradeLabel(grade);
  return label === "No Grade" ? label : `${label}-grade`;
}

export function enchantScrollIdForGrade(kind: "weapon" | "armor", grade?: ItemGrade): string {
  return `${kind}-enchant-scroll-${grade ?? "common"}`;
}

export function enchantScrollIdsForGrade(kind: "weapon" | "armor", grade?: ItemGrade): string[] {
  const normalizedGrade = grade ?? "common";
  const legacyLabelIds: Record<ItemGrade, string> = {
    common: "d",
    rare: "c",
    epic: "b",
    legendary: "a",
    mythic: "s",
    relic: "s"
  };
  const ids = [enchantScrollIdForGrade(kind, normalizedGrade), `${kind}-enchant-scroll-${legacyLabelIds[normalizedGrade]}`];
  if (normalizedGrade === "common") {
    ids.push(`${kind}-enchant-scroll`);
  }
  return [...new Set(ids)];
}

export type EquipmentSlot =
  | "weapon"
  | "shield"
  | "helmet"
  | "chest"
  | "gloves"
  | "boots"
  | "necklace"
  | "earringLeft"
  | "earringRight"
  | "ringLeft"
  | "ringRight"
  | "glasses"
  | "mask"
  | "headAccessory";

export interface ItemStats {
  hp?: number;
  mp?: number;
  attack?: number;
  magic?: number;
  defense?: number;
  speed?: number;
  str?: number;
  dex?: number;
  crit?: number;
  attackSpeed?: number;
  castSpeed?: number;
}

export interface DerivedStats {
  hp: number;
  cp: number;
  mp: number;
  attack: number;
  magic: number;
  defense: number;
  speed: number;
  str: number;
  dex: number;
  crit: number;
  attackSpeed: number;
  castSpeed: number;
}

export type WorldBiomeKind = "grass" | "forest" | "darkForest" | "desert" | "snow" | "swamp" | "coast" | "fire" | "void" | "mountain";
export type WorldLandmarkKind = "arena" | "dungeon" | "cave" | "graveyard" | "harbor" | "ship" | "ruins" | "camp" | "tower" | "boss";

export interface WorldMapRegion {
  id: string;
  label: string;
  kind: WorldBiomeKind;
  position: Vector2;
  width: number;
  height: number;
  recommendedLevel: number;
  density?: number;
}

export interface WorldCityDefinition {
  id: string;
  label: string;
  position: Vector2;
  recommendedLevel: number;
  safeRadius: number;
  kind?: "capital" | "village" | "harbor" | "outpost" | "fortress" | "sanctum";
}

export interface WorldRouteDefinition {
  id: string;
  label: string;
  points: Vector2[];
  width?: number;
}

export interface WorldLakeDefinition {
  id: string;
  label: string;
  position: Vector2;
  width: number;
  height: number;
}

export interface WorldWaterfallDefinition {
  id: string;
  label: string;
  riverId: string;
  position: Vector2;
  width: number;
  height: number;
  rotation: number;
}

export type WorldScenicDetailKind = "flowers" | "reeds" | "stones" | "lilies" | "moss" | "shells" | "ice" | "crystals" | "mushrooms" | "runes" | "embers";

export interface WorldScenicDetailDefinition {
  id: string;
  kind: WorldScenicDetailKind;
  position: Vector2;
  radius: number;
  density: number;
}

export interface WorldMountainDefinition {
  id: string;
  position: Vector2;
  size: number;
}

export type WorldObstacleKind = "fence" | "ruin" | "boulder" | "treeLine" | "arenaWall";

export interface WorldObstacleDefinition {
  id: string;
  kind: WorldObstacleKind;
  position: Vector2;
  radiusX: number;
  radiusY: number;
  rotation?: number;
}

export type WorldHazardKind = "laserGate" | "orbStream" | "riftCrack";

export interface WorldHazardDefinition {
  id: string;
  label: string;
  kind: WorldHazardKind;
  position: Vector2;
  width: number;
  height: number;
  rotation?: number;
  recommendedLevel: number;
  cycleMs: number;
  activeMs: number;
  warningMs: number;
  damage: number;
  knockback?: number;
}

export interface WorldLandmarkDefinition {
  id: string;
  label: string;
  kind: WorldLandmarkKind;
  position: Vector2;
  radius: number;
  recommendedLevel: number;
  zone?: ZoneKind;
}

export interface WorldHuntingGroundDefinition {
  id: string;
  label: string;
  level: number;
  position: Vector2;
  radius: number;
  archetypes: readonly MonsterArchetype[];
}

export interface WorldDungeonInteriorDefinition {
  id: string;
  landmarkId: string;
  label: string;
  recommendedLevel: number;
  position: Vector2;
  start: Vector2;
  end: Vector2;
  width: number;
  height: number;
  archetypes: readonly MonsterArchetype[];
}

export const WORLD_STARTER_ARENA = {
  id: "starter-arena",
  label: "Blood Ring Arena",
  center: { x: 4300, y: 3600 },
  radius: 1380,
  innerRadius: 900,
  recommendedLevel: 3
} as const;

export const WORLD_STARTER_ARENA_WALL_RADIUS = WORLD_STARTER_ARENA.radius + 180;
export const WORLD_STARTER_ARENA_GATE_HALF_ANGLE = 0.52;
export const WORLD_STARTER_ARENA_GATES = [
  { id: "north", label: "North Gate", angle: -Math.PI / 2 },
  { id: "brook", label: "Brook Gate", angle: -2.5 },
  { id: "road", label: "Road Gate", angle: -0.78 },
  { id: "east", label: "East Gate", angle: 0 },
  { id: "harbor", label: "Harbor Gate", angle: 2.33 },
  { id: "south", label: "South Gate", angle: Math.PI / 2 },
  { id: "west", label: "West Gate", angle: Math.PI }
] as const;

const expandMapRegionZone = (region: WorldMapRegion): WorldMapRegion => {
  const widthScale = region.kind === "coast" ? 1.14 : 1.1;
  const heightScale = region.kind === "coast" ? 1.12 : 1.08;
  return {
    ...region,
    width: Math.round(region.width * widthScale),
    height: Math.round(region.height * heightScale)
  };
};

export const WORLD_MAP_REGIONS: readonly WorldMapRegion[] = ([
  { id: "highspring-meadow", label: "Highspring Meadow", kind: "grass", position: { x: 3000, y: 1160 }, width: 5600, height: 1700, recommendedLevel: 1, density: 68 },
  { id: "elderglen-fields", label: "Elderglen Fields", kind: "grass", position: { x: 2700, y: 3150 }, width: 5600, height: 3900, recommendedLevel: 1, density: 82 },
  { id: "wolfpine-forest", label: "Wolfpine Forest", kind: "forest", position: { x: 5600, y: 2550 }, width: 4700, height: 3000, recommendedLevel: 2, density: 156 },
  { id: "bonefall-cemetery", label: "Bonefall Cemetery", kind: "darkForest", position: { x: 7600, y: 3050 }, width: 3600, height: 2400, recommendedLevel: 5, density: 88 },
  { id: "sunspire-desert", label: "Sunspire Dunes", kind: "desert", position: { x: 9200, y: 5000 }, width: 6400, height: 4200, recommendedLevel: 8, density: 92 },
  { id: "stormharbor-coast", label: "Stormharbor Coast", kind: "coast", position: { x: 3800, y: 6600 }, width: 4200, height: 2400, recommendedLevel: 12, density: 70 },
  { id: "moonfen-marsh", label: "Moonfen Marsh", kind: "swamp", position: { x: 7600, y: 9850 }, width: 4600, height: 3000, recommendedLevel: 16, density: 120 },
  { id: "frosthold-pass", label: "Frosthold Pass", kind: "snow", position: { x: 9800, y: 1700 }, width: 5200, height: 2500, recommendedLevel: 18, density: 70 },
  { id: "deepgate-caverns", label: "Deep Gate Caverns", kind: "mountain", position: { x: 11200, y: 900 }, width: 3600, height: 1800, recommendedLevel: 22, density: 40 },
  { id: "riftwatch-vale", label: "Riftwatch Vale", kind: "void", position: { x: 14500, y: 8200 }, width: 5000, height: 3300, recommendedLevel: 30, density: 80 },
  { id: "ironmarch-barrens", label: "Ironmarch Barrens", kind: "desert", position: { x: 15200, y: 3600 }, width: 4400, height: 2600, recommendedLevel: 40, density: 84 },
  { id: "emberfall-crags", label: "Emberfall Crags", kind: "fire", position: { x: 15400, y: 10300 }, width: 4500, height: 3200, recommendedLevel: 48, density: 120 },
  { id: "southreach-fields", label: "Southreach Fields", kind: "grass", position: { x: 12200, y: 15100 }, width: 7000, height: 4200, recommendedLevel: 28, density: 112 },
  { id: "blackroot-woods", label: "Blackroot Woods", kind: "darkForest", position: { x: 17600, y: 12800 }, width: 6200, height: 3800, recommendedLevel: 45, density: 170 },
  { id: "mistwood", label: "Mistwood", kind: "forest", position: { x: 20500, y: 6200 }, width: 5600, height: 3900, recommendedLevel: 55, density: 180 },
  { id: "crownspire-heartland", label: "Crownspire Heartland", kind: "grass", position: { x: 23800, y: 9000 }, width: 7600, height: 4100, recommendedLevel: 42, density: 130 },
  { id: "sapphire-coast", label: "Sapphire Coast", kind: "coast", position: { x: 23800, y: 13200 }, width: 6000, height: 4300, recommendedLevel: 60, density: 86 },
  { id: "mirrorfen-lakes", label: "Mirrorfen Lakes", kind: "swamp", position: { x: 22200, y: 19800 }, width: 6800, height: 4600, recommendedLevel: 58, density: 140 },
  { id: "northguard-snowline", label: "Northguard Snowline", kind: "snow", position: { x: 27600, y: 2700 }, width: 7600, height: 3300, recommendedLevel: 65, density: 76 },
  { id: "skyreach-peaks", label: "Skyreach Peaks", kind: "mountain", position: { x: 33000, y: 5200 }, width: 4900, height: 3200, recommendedLevel: 72, density: 60 },
  { id: "ravenwood", label: "Ravenwood", kind: "darkForest", position: { x: 31800, y: 9600 }, width: 5800, height: 3900, recommendedLevel: 68, density: 156 },
  { id: "ashenforge", label: "Ashen Forge", kind: "fire", position: { x: 36500, y: 18600 }, width: 6600, height: 4800, recommendedLevel: 78, density: 130 },
  { id: "starfall-mere", label: "Starfall Mere", kind: "void", position: { x: 28500, y: 25800 }, width: 6000, height: 4100, recommendedLevel: 86, density: 110 },
  { id: "obsidian-gate", label: "Obsidian Gate", kind: "void", position: { x: 41000, y: 27000 }, width: 6000, height: 4200, recommendedLevel: 90, density: 120 },
  { id: "elderspine", label: "Elderspine", kind: "darkForest", position: { x: 44000, y: 7600 }, width: 5600, height: 3900, recommendedLevel: 95, density: 110 }
] as const).map(expandMapRegionZone);

export const WORLD_CITIES: readonly WorldCityDefinition[] = [
  { id: "greenhill", label: "Elderglen", position: { x: 1500, y: 2800 }, recommendedLevel: 1, safeRadius: 1700, kind: "capital" },
  { id: "market", label: "Trade Zone", position: { x: 2550, y: 5200 }, recommendedLevel: 1, safeRadius: 620, kind: "village" },
  { id: "oldmill", label: "Old Mill Camp", position: { x: 1800, y: 6600 }, recommendedLevel: 4, safeRadius: 380, kind: "outpost" },
  { id: "sunspire", label: "Sunspire Oasis", position: { x: 9000, y: 4700 }, recommendedLevel: 8, safeRadius: 620, kind: "village" },
  { id: "riverbend", label: "Riverbend Camp", position: { x: 11750, y: 6250 }, recommendedLevel: 10, safeRadius: 340, kind: "outpost" },
  { id: "stormharbor", label: "Storm Harbor", position: { x: 3700, y: 6500 }, recommendedLevel: 12, safeRadius: 600, kind: "harbor" },
  { id: "harborwatch", label: "Harbor Watch", position: { x: 3600, y: 9500 }, recommendedLevel: 14, safeRadius: 330, kind: "outpost" },
  { id: "frosthold", label: "Frosthold", position: { x: 9400, y: 1700 }, recommendedLevel: 18, safeRadius: 520, kind: "fortress" },
  { id: "deepgate", label: "Deep Gate", position: { x: 11000, y: 950 }, recommendedLevel: 22, safeRadius: 400, kind: "outpost" },
  { id: "riftwatch", label: "Riftwatch", position: { x: 14500, y: 8200 }, recommendedLevel: 30, safeRadius: 390, kind: "outpost" },
  { id: "moonfen", label: "Moonfen", position: { x: 7200, y: 9800 }, recommendedLevel: 16, safeRadius: 470, kind: "village" },
  { id: "ironmarch", label: "Ironmarch", position: { x: 15200, y: 3550 }, recommendedLevel: 40, safeRadius: 480, kind: "fortress" },
  { id: "emberfall", label: "Emberfall", position: { x: 15400, y: 10300 }, recommendedLevel: 48, safeRadius: 430, kind: "outpost" },
  { id: "mistford", label: "Mistford Camp", position: { x: 18300, y: 7800 }, recommendedLevel: 45, safeRadius: 380, kind: "outpost" },
  { id: "mistwood", label: "Mistwood", position: { x: 20500, y: 6200 }, recommendedLevel: 55, safeRadius: 480, kind: "village" },
  { id: "crownspire", label: "Crownspire", position: { x: 23800, y: 9000 }, recommendedLevel: 42, safeRadius: 1180, kind: "capital" },
  { id: "sapphirecoast", label: "Sapphire Coast", position: { x: 23800, y: 13200 }, recommendedLevel: 60, safeRadius: 560, kind: "harbor" },
  { id: "mirrorfen", label: "Mirrorfen Refuge", position: { x: 22200, y: 19800 }, recommendedLevel: 58, safeRadius: 430, kind: "outpost" },
  { id: "northguard", label: "Northguard", position: { x: 26800, y: 2800 }, recommendedLevel: 65, safeRadius: 500, kind: "fortress" },
  { id: "skyreach", label: "Skyreach", position: { x: 33000, y: 5200 }, recommendedLevel: 72, safeRadius: 440, kind: "sanctum" },
  { id: "ashenforge", label: "Ashen Forge", position: { x: 36500, y: 18600 }, recommendedLevel: 78, safeRadius: 460, kind: "fortress" },
  { id: "starfall", label: "Starfall", position: { x: 28500, y: 25800 }, recommendedLevel: 86, safeRadius: 450, kind: "sanctum" },
  { id: "obsidiangate", label: "Obsidian Gate", position: { x: 41000, y: 27000 }, recommendedLevel: 90, safeRadius: 420, kind: "fortress" },
  { id: "elderspine", label: "Elderspine", position: { x: 44000, y: 7600 }, recommendedLevel: 95, safeRadius: 390, kind: "outpost" }
] as const;

export const CITY_DEFINITIONS = WORLD_CITIES;

const cityServicePoint = (city: WorldCityDefinition, side: -1 | 1): Vector2 => ({
  x: Math.round(city.position.x + side * Math.max(92, city.safeRadius * 0.23)),
  y: Math.round(city.position.y + Math.max(78, city.safeRadius * 0.15))
});

export const CITY_MERCHANTS = CITY_DEFINITIONS.map((city) => ({
  id: `${city.id}-merchant`,
  cityId: city.id,
  label: `${city.label} Merchant`,
  position: cityServicePoint(city, -1),
  radius: city.id === "greenhill" ? 240 : 205
}));

export const CITY_TELEPORTERS = CITY_DEFINITIONS.map((city) => ({
  id: `${city.id}-teleporter`,
  cityId: city.id,
  label: `${city.label} Gate`,
  position: cityServicePoint(city, 1),
  radius: city.id === "greenhill" ? 290 : 250
}));

export const WORLD_ROADS: readonly WorldRouteDefinition[] = [
  { id: "kings-road", label: "King's Road", width: 76, points: [{ x: 1500, y: 2800 }, { x: 2750, y: 2600 }, { x: 4300, y: 2850 }, { x: 6500, y: 3800 }, { x: 9000, y: 4700 }, { x: 10200, y: 3500 }, { x: 9400, y: 1700 }, { x: 11000, y: 950 }] },
  { id: "harbor-road", label: "Harbor Road", width: 70, points: [{ x: 1500, y: 2800 }, { x: 2050, y: 4000 }, { x: 2900, y: 6000 }, { x: 3700, y: 6500 }, { x: 3600, y: 9500 }, { x: 7200, y: 9800 }] },
  { id: "brook-trail", label: "Brook Trail", width: 50, points: [{ x: 1500, y: 2800 }, { x: 1900, y: 4200 }, { x: 1800, y: 6600 }, { x: 2800, y: 6750 }, { x: 3700, y: 6500 }] },
  { id: "rift-road", label: "Rift Road", width: 66, points: [{ x: 9000, y: 4700 }, { x: 10300, y: 5300 }, { x: 11750, y: 6250 }, { x: 13200, y: 7100 }, { x: 14500, y: 8200 }, { x: 15400, y: 10300 }] },
  { id: "iron-road", label: "Iron Road", width: 74, points: [{ x: 9400, y: 1700 }, { x: 12100, y: 2520 }, { x: 15200, y: 3550 }, { x: 18100, y: 5120 }, { x: 20500, y: 6200 }, { x: 23800, y: 13200 }] },
  { id: "crown-road", label: "Crown Road", width: 86, points: [{ x: 20500, y: 6200 }, { x: 22400, y: 7600 }, { x: 23800, y: 9000 }, { x: 23800, y: 13200 }] },
  { id: "north-road", label: "Northguard Road", width: 68, points: [{ x: 9400, y: 1700 }, { x: 15000, y: 1320 }, { x: 21000, y: 2100 }, { x: 26800, y: 2800 }, { x: 33000, y: 5200 }, { x: 44000, y: 7600 }] },
  { id: "ash-road", label: "Ash Road", width: 78, points: [{ x: 23800, y: 13200 }, { x: 27800, y: 14300 }, { x: 32200, y: 16400 }, { x: 36500, y: 18600 }, { x: 39000, y: 22600 }, { x: 41000, y: 27000 }] },
  { id: "star-road", label: "Starfall Road", width: 70, points: [{ x: 23800, y: 13200 }, { x: 25300, y: 17600 }, { x: 26800, y: 22000 }, { x: 28500, y: 25800 }, { x: 33000, y: 26600 }, { x: 41000, y: 27000 }] },
  { id: "blackroot-road", label: "Blackroot Road", width: 66, points: [{ x: 15400, y: 10300 }, { x: 17600, y: 12800 }, { x: 22200, y: 19800 }, { x: 28500, y: 25800 }] },
  { id: "mist-road", label: "Mistwood Trail", width: 62, points: [{ x: 15400, y: 10300 }, { x: 17600, y: 9000 }, { x: 20500, y: 6200 }, { x: 24200, y: 4700 }, { x: 26800, y: 2800 }] }
] as const;

export const WORLD_RIVERS: readonly WorldRouteDefinition[] = [
  { id: "greenhill-brook", label: "Greenhill Brook", width: 54, points: [{ x: 1580, y: -1550 }, { x: 1880, y: 420 }, { x: 2150, y: 820 }, { x: 2360, y: 1480 }, { x: 2050, y: 2350 }, { x: 1760, y: 3400 }, { x: 2550, y: 5000 }, { x: 2680, y: 5600 }, { x: 3180, y: 6400 }, { x: 3460, y: 7040 }, { x: 2780, y: 7240 }, { x: 1880, y: 7640 }, { x: -900, y: 8020 }] },
  { id: "elder-river", label: "Elder River", width: 88, points: [{ x: 5480, y: -1680 }, { x: 6040, y: 40 }, { x: 6200, y: 120 }, { x: 7350, y: 1450 }, { x: 6880, y: 2550 }, { x: 6250, y: 3800 }, { x: 4980, y: 5450 }, { x: 4700, y: 6660 }, { x: 6070, y: 8060 }, { x: 7350, y: 9820 }, { x: 9000, y: 11080 }, { x: 11300, y: 12540 }, { x: 13400, y: 14420 }, { x: 16000, y: 16200 }, { x: 18200, y: 18000 }, { x: 19840, y: 18920 }, { x: 22200, y: 19900 }] },
  { id: "sapphire-river", label: "Sapphire Run", width: 108, points: [{ x: 21500, y: 10500 }, { x: 22600, y: 11840 }, { x: 23800, y: 13200 }, { x: 25280, y: 14540 }, { x: 27800, y: 15360 }, { x: 30400, y: 15880 }, { x: 32600, y: 16700 }, { x: 34700, y: 18800 }, { x: 37000, y: 21900 }, { x: 41000, y: 27000 }, { x: 49000, y: 26700 }] },
  { id: "crown-run", label: "Crown Run", width: 82, points: [{ x: 22600, y: 6400 }, { x: 23400, y: 7900 }, { x: 22300, y: 9800 }, { x: 20200, y: 12200 }, { x: 17800, y: 13400 }, { x: 14800, y: 15100 }, { x: 16000, y: 16200 }] },
  { id: "north-melt", label: "North Melt", width: 72, points: [{ x: 30100, y: -1500 }, { x: 29600, y: 40 }, { x: 29600, y: 800 }, { x: 28700, y: 1800 }, { x: 27600, y: 3050 }, { x: 25800, y: 4500 }, { x: 23800, y: 6400 }, { x: 22600, y: 8800 }, { x: 22300, y: 9800 }] }
] as const;

export const WORLD_WATERFALLS: readonly WorldWaterfallDefinition[] = [
  { id: "greenhill-spring", label: "Greenhill Spring", riverId: "greenhill-brook", position: { x: 2150, y: 820 }, width: 260, height: 380, rotation: 1.26 },
  { id: "highspring-fall", label: "Highspring Fall", riverId: "elder-river", position: { x: 6200, y: 120 }, width: 340, height: 470, rotation: 1.1 },
  { id: "elderfall-cascades", label: "Elderfall Cascades", riverId: "elder-river", position: { x: 6880, y: 2550 }, width: 420, height: 620, rotation: 1.9 },
  { id: "moonfen-veil", label: "Moonfen Veil", riverId: "elder-river", position: { x: 6070, y: 8060 }, width: 360, height: 520, rotation: 0.86 },
  { id: "sapphire-steps", label: "Sapphire Steps", riverId: "sapphire-river", position: { x: 25280, y: 14540 }, width: 520, height: 560, rotation: 0.74 },
  { id: "northguard-fall", label: "Northguard Fall", riverId: "north-melt", position: { x: 27600, y: 3050 }, width: 340, height: 520, rotation: 2.25 },
  { id: "mistwood-drop", label: "Mistwood Drop", riverId: "north-melt", position: { x: 22600, y: 8800 }, width: 320, height: 470, rotation: 1.02 }
] as const;

export const WORLD_LAKES: readonly WorldLakeDefinition[] = [
  { id: "greenhill-pond", label: "Greenhill Pond", position: { x: 2250, y: 3650 }, width: 900, height: 470 },
  { id: "crownmirror-lake", label: "Crownmirror Lake", position: { x: 22300, y: 9800 }, width: 2600, height: 1200 },
  { id: "blackroot-mere", label: "Blackroot Mere", position: { x: 17800, y: 13400 }, width: 2200, height: 1450 },
  { id: "sapphire-lake", label: "Sapphire Lake", position: { x: 23600, y: 13700 }, width: 2600, height: 1300 },
  { id: "mirrorfen-lake", label: "Mirrorfen Lake", position: { x: 22200, y: 19900 }, width: 3200, height: 1800 },
  { id: "starfall-lake", label: "Starfall Mere", position: { x: 29200, y: 26200 }, width: 2300, height: 1600 },
  { id: "spine-lake", label: "Elderspine Lake", position: { x: 42700, y: 9300 }, width: 2800, height: 1100 }
] as const;

export const WORLD_SCENIC_DETAILS: readonly WorldScenicDetailDefinition[] = [
  { id: "highspring-meadow", kind: "flowers", position: { x: 3000, y: 1240 }, radius: 980, density: 48 },
  { id: "elderglen-meadow", kind: "flowers", position: { x: 3050, y: 2550 }, radius: 1220, density: 54 },
  { id: "brookside-meadow", kind: "flowers", position: { x: 3300, y: 4200 }, radius: 1120, density: 46 },
  { id: "oldmill-brook-reeds", kind: "reeds", position: { x: 2820, y: 6480 }, radius: 820, density: 34 },
  { id: "arena-south-grass", kind: "moss", position: { x: 4680, y: 5480 }, radius: 980, density: 34 },
  { id: "greenhill-lilies", kind: "lilies", position: { x: 2250, y: 3650 }, radius: 560, density: 36 },
  { id: "wolfpine-mushrooms", kind: "mushrooms", position: { x: 6100, y: 2280 }, radius: 660, density: 24 },
  { id: "oldmill-mushrooms", kind: "mushrooms", position: { x: 2300, y: 7020 }, radius: 420, density: 10 },
  { id: "elderfall-reeds", kind: "reeds", position: { x: 6750, y: 2380 }, radius: 820, density: 32 },
  { id: "grotto-runes", kind: "runes", position: { x: 6620, y: 3720 }, radius: 680, density: 22 },
  { id: "suntrail-flowers", kind: "flowers", position: { x: 7050, y: 5050 }, radius: 1120, density: 34 },
  { id: "wayfarer-stones", kind: "stones", position: { x: 8350, y: 6150 }, radius: 1040, density: 32 },
  { id: "riverbend-flowers", kind: "flowers", position: { x: 11750, y: 6250 }, radius: 980, density: 36 },
  { id: "riverbend-copse", kind: "moss", position: { x: 10400, y: 8350 }, radius: 1180, density: 34 },
  { id: "rift-road-stones", kind: "stones", position: { x: 12600, y: 6800 }, radius: 1060, density: 34 },
  { id: "suntrail-ambush-stones", kind: "stones", position: { x: 5600, y: 4450 }, radius: 760, density: 24 },
  { id: "rift-spark-runes", kind: "runes", position: { x: 12900, y: 7600 }, radius: 780, density: 26 },
  { id: "stormharbor-stones", kind: "stones", position: { x: 4700, y: 6660 }, radius: 880, density: 28 },
  { id: "harbor-road-shells", kind: "shells", position: { x: 4050, y: 7920 }, radius: 980, density: 34 },
  { id: "harbor-reef-shells", kind: "shells", position: { x: 4300, y: 8500 }, radius: 820, density: 28 },
  { id: "moonfen-lilies", kind: "lilies", position: { x: 7200, y: 9800 }, radius: 1050, density: 38 },
  { id: "moonfen-west-moss", kind: "moss", position: { x: 5900, y: 9150 }, radius: 980, density: 38 },
  { id: "moonfen-fog-mushrooms", kind: "mushrooms", position: { x: 6200, y: 11200 }, radius: 820, density: 28 },
  { id: "ironroad-stones", kind: "stones", position: { x: 12800, y: 3020 }, radius: 960, density: 32 },
  { id: "iron-switchback-crystals", kind: "crystals", position: { x: 16600, y: 4700 }, radius: 820, density: 24 },
  { id: "mistford-moss", kind: "moss", position: { x: 17750, y: 7900 }, radius: 980, density: 36 },
  { id: "mistwood-moss", kind: "moss", position: { x: 20500, y: 6200 }, radius: 1280, density: 44 },
  { id: "mistroad-shadow-mushrooms", kind: "mushrooms", position: { x: 19100, y: 6500 }, radius: 840, density: 32 },
  { id: "northroad-ice", kind: "ice", position: { x: 23800, y: 3250 }, radius: 1120, density: 34 },
  { id: "northguard-snow-ice", kind: "ice", position: { x: 24000, y: 2200 }, radius: 840, density: 30 },
  { id: "crownspire-flowers", kind: "flowers", position: { x: 23800, y: 9000 }, radius: 1640, density: 70 },
  { id: "crown-patrol-runes", kind: "runes", position: { x: 21600, y: 7800 }, radius: 760, density: 24 },
  { id: "crownmirror-reeds", kind: "reeds", position: { x: 22300, y: 9800 }, radius: 1280, density: 42 },
  { id: "blackroot-mushrooms", kind: "mushrooms", position: { x: 17600, y: 12800 }, radius: 1500, density: 54 },
  { id: "blackroot-mere-lilies", kind: "lilies", position: { x: 17800, y: 13400 }, radius: 1180, density: 38 },
  { id: "southreach-flowers", kind: "flowers", position: { x: 12200, y: 15100 }, radius: 1600, density: 56 },
  { id: "southreach-orchard", kind: "flowers", position: { x: 10150, y: 12950 }, radius: 1340, density: 42 },
  { id: "crownroad-meadow", kind: "flowers", position: { x: 19900, y: 11100 }, radius: 1380, density: 40 },
  { id: "mirrorway-reeds", kind: "reeds", position: { x: 19050, y: 16450 }, radius: 1280, density: 36 },
  { id: "sapphire-reeds", kind: "reeds", position: { x: 22800, y: 11680 }, radius: 940, density: 30 },
  { id: "sapphire-shells", kind: "shells", position: { x: 23800, y: 13200 }, radius: 1140, density: 34 },
  { id: "sapphire-cliff-crystals", kind: "crystals", position: { x: 25200, y: 12100 }, radius: 820, density: 24 },
  { id: "mirrorfen-lilies", kind: "lilies", position: { x: 22200, y: 19900 }, radius: 1550, density: 50 },
  { id: "ravenwood-mushrooms", kind: "mushrooms", position: { x: 31800, y: 9600 }, radius: 1320, density: 40 },
  { id: "northguard-ice", kind: "ice", position: { x: 27600, y: 3050 }, radius: 980, density: 30 },
  { id: "emberfall-embers", kind: "embers", position: { x: 15400, y: 10300 }, radius: 1280, density: 42 },
  { id: "ash-road-embers", kind: "embers", position: { x: 32100, y: 16350 }, radius: 1080, density: 36 },
  { id: "ashroad-cinders", kind: "embers", position: { x: 35000, y: 21000 }, radius: 880, density: 30 },
  { id: "embervault-embers", kind: "embers", position: { x: 35000, y: 17400 }, radius: 980, density: 34 },
  { id: "star-road-crystals", kind: "crystals", position: { x: 27000, y: 21800 }, radius: 1020, density: 34 },
  { id: "starfall-orb-runes", kind: "runes", position: { x: 33000, y: 25800 }, radius: 820, density: 24 },
  { id: "starfall-crystals", kind: "crystals", position: { x: 29200, y: 26200 }, radius: 1160, density: 30 }
] as const;

export const WORLD_MOUNTAINS: readonly WorldMountainDefinition[] = [
  { id: "north-coast-1", position: { x: 4200, y: 560 }, size: 24 },
  { id: "north-coast-2", position: { x: 6600, y: 620 }, size: 28 },
  { id: "north-coast-3", position: { x: 8200, y: 780 }, size: 22 },
  { id: "north-1", position: { x: 10200, y: 650 }, size: 34 },
  { id: "north-2", position: { x: 13200, y: 820 }, size: 26 },
  { id: "north-3", position: { x: 27300, y: 720 }, size: 38 },
  { id: "north-4", position: { x: 32200, y: 1180 }, size: 32 },
  { id: "crown-1", position: { x: 24900, y: 7300 }, size: 24 },
  { id: "blackroot-1", position: { x: 16600, y: 12300 }, size: 27 },
  { id: "mirrorfen-1", position: { x: 20500, y: 21600 }, size: 25 },
  { id: "east-1", position: { x: 45600, y: 7300 }, size: 34 },
  { id: "east-2", position: { x: 46800, y: 11200 }, size: 29 },
  { id: "east-3", position: { x: 45200, y: 19100 }, size: 38 },
  { id: "south-1", position: { x: 27500, y: 30200 }, size: 34 },
  { id: "south-2", position: { x: 36500, y: 29200 }, size: 40 },
  { id: "west-1", position: { x: 1300, y: 4500 }, size: 30 },
  { id: "west-2", position: { x: 2100, y: 20600 }, size: 36 }
] as const;

const normalizeWorldAngle = (angle: number): number => {
  let result = angle;
  while (result <= -Math.PI) {
    result += Math.PI * 2;
  }
  while (result > Math.PI) {
    result -= Math.PI * 2;
  }
  return result;
};

const worldAngleDistance = (a: number, b: number): number => Math.abs(normalizeWorldAngle(a - b));

const isStarterArenaGateAngle = (angle: number): boolean =>
  WORLD_STARTER_ARENA_GATES.some((gate) => worldAngleDistance(angle, gate.angle) <= WORLD_STARTER_ARENA_GATE_HALF_ANGLE);

const STARTER_ARENA_WALL_OBSTACLES: WorldObstacleDefinition[] = Array.from({ length: 56 }, (_, index) => {
  const angle = (index / 56) * Math.PI * 2;
  return {
    id: `blood-ring-wall-${index}`,
    kind: "arenaWall" as const,
    position: {
      x: Math.round(WORLD_STARTER_ARENA.center.x + Math.cos(angle) * WORLD_STARTER_ARENA_WALL_RADIUS),
      y: Math.round(WORLD_STARTER_ARENA.center.y + Math.sin(angle) * WORLD_STARTER_ARENA_WALL_RADIUS)
    },
    radiusX: 62,
    radiusY: 50,
    rotation: angle + Math.PI / 2
  };
}).filter((obstacle) => !isStarterArenaGateAngle(Math.atan2(obstacle.position.y - WORLD_STARTER_ARENA.center.y, obstacle.position.x - WORLD_STARTER_ARENA.center.x)));

export const WORLD_OBSTACLES: readonly WorldObstacleDefinition[] = [
  ...STARTER_ARENA_WALL_OBSTACLES,
  { id: "highspring-old-log", kind: "treeLine", position: { x: 3300, y: 1420 }, radiusX: 230, radiusY: 48, rotation: -0.18 },
  { id: "wolfpine-fallen-tree", kind: "treeLine", position: { x: 6120, y: 2920 }, radiusX: 260, radiusY: 54, rotation: 0.28 },
  { id: "bonefall-ruin-wall", kind: "ruin", position: { x: 7200, y: 3240 }, radiusX: 280, radiusY: 70, rotation: -0.36 },
  { id: "harbor-breakwater", kind: "ruin", position: { x: 3040, y: 7290 }, radiusX: 210, radiusY: 54, rotation: 0.18 },
  { id: "crownspire-old-wall", kind: "ruin", position: { x: 24600, y: 9280 }, radiusX: 340, radiusY: 78, rotation: 0.1 },
  { id: "blackroot-fallen-giant", kind: "treeLine", position: { x: 17100, y: 13100 }, radiusX: 360, radiusY: 82, rotation: -0.36 },
  { id: "mirrorfen-rotten-bridge", kind: "treeLine", position: { x: 21700, y: 20600 }, radiusX: 300, radiusY: 70, rotation: 0.52 },
  { id: "ravenwood-ruin-wall", kind: "ruin", position: { x: 31800, y: 9600 }, radiusX: 330, radiusY: 74, rotation: -0.2 }
] as const;

export const WORLD_HAZARDS: readonly WorldHazardDefinition[] = [] as const;

export const BESTIARY_CAVERN_LANDMARK_ID = "bestiary-cavern";
export const BESTIARY_CAVERN_DUNGEON_ID = "bestiary-cavern-depths";

export const WORLD_LANDMARKS: readonly WorldLandmarkDefinition[] = [
  { id: "blood-ring", label: "Blood Ring Arena", kind: "arena", position: WORLD_STARTER_ARENA.center, radius: WORLD_STARTER_ARENA.radius, recommendedLevel: 3, zone: "pvp" },
  { id: "highspring-camp", label: "Highspring Camp", kind: "camp", position: { x: 3200, y: 1280 }, radius: 380, recommendedLevel: 2, zone: "pvp" },
  { id: BESTIARY_CAVERN_LANDMARK_ID, label: "Bestiary Cavern", kind: "cave", position: { x: 2320, y: 920 }, radius: 430, recommendedLevel: 1, zone: "dungeon" },
  { id: "bonefall-cemetery", label: "Bonefall Cemetery", kind: "graveyard", position: { x: 7520, y: 3180 }, radius: 760, recommendedLevel: 5, zone: "pvp" },
  { id: "wolfpine-cave", label: "Wolfpine Cave", kind: "cave", position: { x: 6500, y: 2620 }, radius: 470, recommendedLevel: 6, zone: "dungeon" },
  { id: "elderfall-grotto", label: "Elderfall Grotto", kind: "dungeon", position: { x: 6620, y: 3720 }, radius: 560, recommendedLevel: 9, zone: "dungeon" },
  { id: "suntrail-camp", label: "Suntrail Camp", kind: "camp", position: { x: 7050, y: 5050 }, radius: 460, recommendedLevel: 6, zone: "pvp" },
  { id: "wayfarer-stones", label: "Wayfarer Stones", kind: "ruins", position: { x: 8350, y: 6150 }, radius: 520, recommendedLevel: 8, zone: "pvp" },
  { id: "stormharbor-docks", label: "Stormharbor Docks", kind: "harbor", position: { x: 3460, y: 7040 }, radius: 520, recommendedLevel: 12, zone: "safe" },
  { id: "tidebound-cave", label: "Tidebound Cave", kind: "cave", position: { x: 5050, y: 6250 }, radius: 540, recommendedLevel: 14, zone: "dungeon" },
  { id: "riverbend-watch", label: "Riverbend Watch", kind: "tower", position: { x: 10400, y: 8350 }, radius: 560, recommendedLevel: 12, zone: "pvp" },
  { id: "deepgate-cavern", label: "Deep Gate Dungeon", kind: "dungeon", position: { x: 11000, y: 950 }, radius: 680, recommendedLevel: 22, zone: "dungeon" },
  { id: "riftwatch-core", label: "Riftwatch Core", kind: "boss", position: { x: 14850, y: 8500 }, radius: 900, recommendedLevel: 30, zone: "boss" },
  { id: "moonfen-ruins", label: "Moonfen Ruins", kind: "ruins", position: { x: 8300, y: 10500 }, radius: 620, recommendedLevel: 18, zone: "pvp" },
  { id: "southreach-tower", label: "Southreach Watch", kind: "tower", position: { x: 12400, y: 15000 }, radius: 620, recommendedLevel: 28, zone: "pvp" },
  { id: "southreach-orchard", label: "Southreach Orchard", kind: "camp", position: { x: 10150, y: 12950 }, radius: 560, recommendedLevel: 24, zone: "pvp" },
  { id: "blackroot-grove", label: "Blackroot Grove", kind: "cave", position: { x: 17600, y: 12800 }, radius: 720, recommendedLevel: 45, zone: "dungeon" },
  { id: "crownroad-camp", label: "Crownroad Camp", kind: "camp", position: { x: 19900, y: 11100 }, radius: 560, recommendedLevel: 40, zone: "pvp" },
  { id: "rootcoil-den", label: "Rootcoil Den", kind: "dungeon", position: { x: 19850, y: 5800 }, radius: 640, recommendedLevel: 52, zone: "dungeon" },
  { id: "mistwood-hollow", label: "Mistwood Hollow", kind: "cave", position: { x: 21400, y: 7000 }, radius: 650, recommendedLevel: 55, zone: "dungeon" },
  { id: "crownspire-citadel", label: "Crownspire Citadel", kind: "tower", position: { x: 23800, y: 9000 }, radius: 850, recommendedLevel: 42, zone: "safe" },
  { id: "crownmirror-ruins", label: "Crownmirror Ruins", kind: "ruins", position: { x: 22300, y: 9800 }, radius: 640, recommendedLevel: 44, zone: "pvp" },
  { id: "sapphire-pier", label: "Sapphire Pier", kind: "ship", position: { x: 23150, y: 14450 }, radius: 520, recommendedLevel: 60, zone: "safe" },
  { id: "mirrorfen-stones", label: "Mirrorfen Stones", kind: "ruins", position: { x: 22200, y: 19900 }, radius: 720, recommendedLevel: 58, zone: "pvp" },
  { id: "mirrorway-shrine", label: "Mirrorway Shrine", kind: "ruins", position: { x: 19050, y: 16450 }, radius: 580, recommendedLevel: 50, zone: "pvp" },
  { id: "frostglass-crypt", label: "Frostglass Crypt", kind: "dungeon", position: { x: 28750, y: 3600 }, radius: 620, recommendedLevel: 66, zone: "dungeon" },
  { id: "ravenwood-roost", label: "Ravenwood Roost", kind: "tower", position: { x: 31800, y: 9600 }, radius: 680, recommendedLevel: 68, zone: "pvp" },
  { id: "embervault", label: "Embervault", kind: "dungeon", position: { x: 35000, y: 17400 }, radius: 720, recommendedLevel: 76, zone: "dungeon" },
  { id: "ashen-wyrm-pit", label: "Ashen Wyrm Pit", kind: "boss", position: { x: 37150, y: 19150 }, radius: 980, recommendedLevel: 78, zone: "boss" },
  { id: "starfall-sanctum", label: "Starfall Sanctum", kind: "dungeon", position: { x: 30000, y: 25200 }, radius: 780, recommendedLevel: 86, zone: "dungeon" },
  { id: "obsidian-throne", label: "Obsidian Throne", kind: "boss", position: { x: 41850, y: 27850 }, radius: 1100, recommendedLevel: 90, zone: "boss" }
] as const;

export const WORLD_MAP_LABELS = [
  { id: "greenlands", label: "Elderglen Wilds", x: 4200, y: 4850 },
  { id: "desert", label: "Sunspire Dunes", x: 9200, y: 5000 },
  { id: "harbor", label: "Storm Harbor", x: 3500, y: 7200 },
  { id: "moonfen", label: "Moonfen Marsh", x: 7600, y: 9950 },
  { id: "frost", label: "Frosthold Pass", x: 9800, y: 1700 },
  { id: "rift", label: "Riftwatch Vale", x: 14500, y: 8200 },
  { id: "southreach", label: "Southreach Fields", x: 12200, y: 15100 },
  { id: "blackroot", label: "Blackroot Woods", x: 17600, y: 12800 },
  { id: "mistwood", label: "Mistwood", x: 20500, y: 6200 },
  { id: "crownspire", label: "Crownspire", x: 23800, y: 9000 },
  { id: "sapphire", label: "Sapphire Coast", x: 23800, y: 13200 },
  { id: "mirrorfen", label: "Mirrorfen Lakes", x: 22200, y: 19800 },
  { id: "north", label: "Northguard", x: 28600, y: 3000 },
  { id: "sky", label: "Skyreach Peaks", x: 33000, y: 5200 },
  { id: "ravenwood", label: "Ravenwood", x: 31800, y: 9600 },
  { id: "ash", label: "Ashen Forge", x: 36500, y: 18600 },
  { id: "star", label: "Starfall Mere", x: 28500, y: 25800 },
  { id: "void", label: "Obsidian Gate", x: 41000, y: 27000 },
  { id: "spine", label: "Elderspine", x: 44000, y: 7600 }
] as const;

const expandHuntingGroundZone = (ground: WorldHuntingGroundDefinition): WorldHuntingGroundDefinition => ({
  ...ground,
  radius: Math.round(ground.radius * (ground.level <= 10 ? 1.12 : 1.18))
});

export const WORLD_HUNTING_GROUNDS: readonly WorldHuntingGroundDefinition[] = ([
  { id: "highspring-meadow", label: "Highspring Meadow", level: 1, position: { x: 3000, y: 1280 }, radius: 780, archetypes: ["boar", "wolf"] },
  { id: "wolfpine-1", label: "Wolfpine Edge", level: 1, position: { x: 3300, y: 1850 }, radius: 820, archetypes: ["wolf", "boar"] },
  { id: "wolfpine-2", label: "Wolfpine Deepwood", level: 3, position: { x: 6200, y: 2350 }, radius: 920, archetypes: ["wolf", "spider", "bat"] },
  { id: "oldmill-brook", label: "Old Mill Brook", level: 4, position: { x: 3050, y: 6650 }, radius: 760, archetypes: ["boar", "wolf", "bandit", "archer"] },
  { id: "bonefall", label: "Bonefall Cemetery", level: 5, position: { x: 6900, y: 3300 }, radius: 940, archetypes: ["skeleton", "bonewarrior", "bandit", "archer"] },
  { id: "suntrail-camp", label: "Suntrail Camp", level: 6, position: { x: 7050, y: 5050 }, radius: 700, archetypes: ["boar", "wolf", "bandit"] },
  { id: "wayfarer-stones", label: "Wayfarer Stones", level: 8, position: { x: 8350, y: 6150 }, radius: 740, archetypes: ["bandit", "archer", "spider", "bat"] },
  { id: "sunspire", label: "Sunspire Dunes", level: 8, position: { x: 9600, y: 4550 }, radius: 1080, archetypes: ["spider", "bandit", "archer"] },
  { id: "riverbend-road", label: "Riverbend Road", level: 10, position: { x: 11350, y: 6500 }, radius: 900, archetypes: ["bandit", "archer", "spider", "bat"] },
  { id: "riverbend-copse", label: "Riverbend Copse", level: 12, position: { x: 10400, y: 8350 }, radius: 760, archetypes: ["wolf", "boar", "bat"] },
  { id: "deepgate", label: "Deep Gate Mouth", level: 11, position: { x: 10600, y: 1380 }, radius: 860, archetypes: ["bat", "wraith", "eye"] },
  { id: "harbor-marsh", label: "Harbor Marsh", level: 13, position: { x: 5100, y: 7900 }, radius: 780, archetypes: ["spider", "bat"] },
  { id: "moonfen", label: "Moonfen Marsh", level: 15, position: { x: 7800, y: 9900 }, radius: 980, archetypes: ["spider", "venomplant", "wraith", "witch", "mage"] },
  { id: "ironmarch", label: "Ironmarch Barrens", level: 20, position: { x: 14400, y: 3900 }, radius: 1060, archetypes: ["golem", "skeleton", "bonewarrior", "archer"] },
  { id: "rift-south-road", label: "Rift South Road", level: 24, position: { x: 13900, y: 8500 }, radius: 1040, archetypes: ["wraith", "eye", "mage", "bat"] },
  { id: "southreach-orchard", label: "Southreach Orchard", level: 24, position: { x: 10150, y: 12950 }, radius: 920, archetypes: ["boar", "wolf", "bandit"] },
  { id: "southreach", label: "Southreach Fields", level: 27, position: { x: 12200, y: 15100 }, radius: 1180, archetypes: ["boar", "bandit", "archer", "wolf"] },
  { id: "emberfall", label: "Emberfall Crags", level: 27, position: { x: 16000, y: 10800 }, radius: 1120, archetypes: ["drake", "firespirit", "dragon", "bat"] },
  { id: "mistford-road", label: "Mistford Road", level: 28, position: { x: 17800, y: 7900 }, radius: 900, archetypes: ["wolf", "wraith", "bat"] },
  { id: "blackroot-edge", label: "Blackroot Edge", level: 32, position: { x: 16800, y: 12300 }, radius: 1160, archetypes: ["wolf", "venomplant", "wraith", "witch", "mage"] },
  { id: "mistwood", label: "Mistwood Hollow", level: 34, position: { x: 21200, y: 7100 }, radius: 1180, archetypes: ["wolf", "wraith", "bat"] },
  { id: "mistwatch-road", label: "Mistwatch Road", level: 37, position: { x: 19800, y: 4700 }, radius: 960, archetypes: ["wolf", "golem", "sentinel"] },
  { id: "crownspire-gates", label: "Crownspire Gates", level: 42, position: { x: 23800, y: 9300 }, radius: 1320, archetypes: ["bandit", "archer", "sentinel", "golem"] },
  { id: "crownroad-camp", label: "Crownroad Camp", level: 42, position: { x: 19900, y: 11100 }, radius: 900, archetypes: ["bandit", "archer", "wolf", "sentinel"] },
  { id: "crownmirror", label: "Crownmirror Ruins", level: 44, position: { x: 22300, y: 9800 }, radius: 1180, archetypes: ["wraith", "witch", "mage", "eye"] },
  { id: "northguard", label: "Northguard Snowline", level: 42, position: { x: 26300, y: 3100 }, radius: 1200, archetypes: ["sentinel", "skeleton", "archer"] },
  { id: "sapphire-approach", label: "Sapphire Approach", level: 46, position: { x: 22400, y: 11000 }, radius: 1020, archetypes: ["drake", "wolf", "bat"] },
  { id: "skyreach", label: "Skyreach Peaks", level: 50, position: { x: 33000, y: 5200 }, radius: 1260, archetypes: ["sentinel", "golem"] },
  { id: "blackroot-deep", label: "Blackroot Deep", level: 52, position: { x: 18200, y: 13800 }, radius: 1220, archetypes: ["wraith", "witch", "mage", "eye"] },
  { id: "sapphire-delta", label: "Sapphire Delta", level: 54, position: { x: 26000, y: 14200 }, radius: 1100, archetypes: ["drake", "skeleton", "bat"] },
  { id: "mirrorway-shrine", label: "Mirrorway Shrine", level: 54, position: { x: 19050, y: 16450 }, radius: 980, archetypes: ["wraith", "witch", "spider"] },
  { id: "mirrorfen", label: "Mirrorfen Lakes", level: 58, position: { x: 22200, y: 19900 }, radius: 1320, archetypes: ["spider", "wraith", "witch", "mage"] },
  { id: "ashenforge", label: "Ashen Forge", level: 60, position: { x: 34000, y: 14800 }, radius: 1320, archetypes: ["drake", "firespirit", "dragon", "skeleton"] },
  { id: "ravenwood", label: "Ravenwood", level: 66, position: { x: 31800, y: 9600 }, radius: 1280, archetypes: ["wraith", "witch", "mage", "eye"] },
  { id: "star-road", label: "Star Road", level: 66, position: { x: 27000, y: 20600 }, radius: 1120, archetypes: ["wraith", "witch", "mage", "eye"] },
  { id: "starfall", label: "Starfall Mere", level: 70, position: { x: 28800, y: 24800 }, radius: 1360, archetypes: ["wraith", "witch", "mage", "eye"] },
  { id: "ash-road-watch", label: "Ash Road Watch", level: 74, position: { x: 31200, y: 17000 }, radius: 1040, archetypes: ["drake", "golem", "skeleton"] },
  { id: "obsidian", label: "Obsidian Gate", level: 78, position: { x: 40700, y: 26600 }, radius: 1440, archetypes: ["sentinel", "wraith"] },
  { id: "elderspine", label: "Elderspine", level: 88, position: { x: 44000, y: 7600 }, radius: 1400, archetypes: ["golem", "sentinel"] }
] as const).map(expandHuntingGroundZone);

const dungeonInterior = (
  id: string,
  landmarkId: string,
  label: string,
  recommendedLevel: number,
  position: Vector2,
  archetypes: readonly MonsterArchetype[]
): WorldDungeonInteriorDefinition => ({
  id,
  landmarkId,
  label,
  recommendedLevel,
  position,
  start: { x: position.x - 780, y: position.y + 520 },
  end: { x: position.x + 780, y: position.y - 520 },
  width: 2050,
  height: 1480,
  archetypes
});

export const WORLD_DUNGEON_INTERIORS: readonly WorldDungeonInteriorDefinition[] = [
  dungeonInterior(
    BESTIARY_CAVERN_DUNGEON_ID,
    BESTIARY_CAVERN_LANDMARK_ID,
    "Bestiary Cavern",
    1,
    { x: 2600, y: 22600 },
    ["wraith", "sentinel", "bat", "dragon", "eye", "boar", "golem", "drake", "spider", "dungeonboss"]
  ),
  dungeonInterior("wolfpine-cave-depths", "wolfpine-cave", "Wolfpine Cave Depths", 6, { x: 5200, y: 22600 }, ["bat", "spider", "skeleton", "archer"]),
  dungeonInterior("elderfall-grotto-depths", "elderfall-grotto", "Elderfall Grotto Depths", 9, { x: 7800, y: 22600 }, ["bat", "wraith", "eye"]),
  dungeonInterior("tidebound-cave-depths", "tidebound-cave", "Tidebound Undertide", 14, { x: 10400, y: 22600 }, ["spider", "bat", "wraith"]),
  dungeonInterior("deepgate-dungeon-depths", "deepgate-cavern", "Deep Gate Underhall", 22, { x: 13000, y: 22600 }, ["wraith", "eye", "golem"]),
  dungeonInterior("blackroot-grove-depths", "blackroot-grove", "Blackroot Burrow", 45, { x: 15600, y: 22600 }, ["wraith", "witch", "mage", "eye"]),
  dungeonInterior("rootcoil-den-depths", "rootcoil-den", "Rootcoil Den", 52, { x: 18200, y: 22600 }, ["wraith", "witch", "mage", "spider"]),
  dungeonInterior("mistwood-hollow-depths", "mistwood-hollow", "Mistwood Hollow", 55, { x: 20800, y: 22600 }, ["wraith", "bat", "witch", "mage"]),
  dungeonInterior("frostglass-crypt-depths", "frostglass-crypt", "Frostglass Crypt", 66, { x: 24600, y: 22600 }, ["skeleton", "archer", "sentinel", "wraith"]),
  dungeonInterior("embervault-depths", "embervault", "Embervault Depths", 76, { x: 34200, y: 22600 }, ["drake", "dragon", "golem"]),
  dungeonInterior("starfall-sanctum-depths", "starfall-sanctum", "Starfall Inner Sanctum", 86, { x: 30400, y: 28800 }, ["eye", "witch", "mage", "sentinel"])
] as const;

const TELEPORT_LANDMARK_KINDS: readonly WorldLandmarkKind[] = ["arena", "boss", "dungeon", "cave"];

export const TELEPORT_DEFINITIONS = [
  ...CITY_DEFINITIONS.flatMap((source) => {
    const teleporter = CITY_TELEPORTERS.find((candidate) => candidate.cityId === source.id) ?? CITY_TELEPORTERS[0];
    const cityDestinations = CITY_DEFINITIONS.filter((destination) => destination.id !== source.id).map((destination) => ({
      id: `${source.id}-to-${destination.id}`,
      label: destination.label,
      sourceCityId: source.id,
      destinationCityId: destination.id,
      position: teleporter.position,
      destination: destination.position,
      radius: teleporter.radius,
      requiredLevel: destination.recommendedLevel
    }));

    const landmarkDestinations = WORLD_LANDMARKS.filter((landmark) => TELEPORT_LANDMARK_KINDS.includes(landmark.kind)).map((landmark) => ({
      id: `${source.id}-to-${landmark.id}`,
      label: landmark.label,
      sourceCityId: source.id,
      destinationLandmarkId: landmark.id,
      destinationKind: landmark.kind,
      position: teleporter.position,
      destination: landmark.position,
      radius: teleporter.radius,
      requiredLevel: landmark.recommendedLevel
    }));

    return [...cityDestinations, ...landmarkDestinations];
  })
] as const;

export type TeleportId = (typeof TELEPORT_DEFINITIONS)[number]["id"];

export interface Vector2 {
  x: number;
  y: number;
}

export interface PlayerInput {
  movement: Vector2;
  aim: Vector2;
  dash: boolean;
  jump?: boolean;
  boost?: boolean;
  sprint?: boolean;
  block: boolean;
  combo: boolean;
  seq: number;
  sentAt: number;
}

export interface PlayerSingingState {
  trackId: number;
  startedAt: number;
}

export type ClientGraphicsPreset = "desktop" | "full60" | "highFullPlus" | "highFull" | "mediumFull" | "smooth" | "balanced" | "cool" | "minimal";

export interface ClientPerformanceProfile {
  mobile?: boolean;
  lowPower?: boolean;
  viewportWidth?: number;
  viewportHeight?: number;
  devicePixelRatio?: number;
  graphicsPreset?: ClientGraphicsPreset;
  fpsLimit?: number;
  worldDecorations?: boolean;
  worldRange?: "mobile" | "wide" | "widePlus";
  combatEffects?: boolean;
  floatingText?: boolean;
  playerLabels?: boolean;
}

export interface SkillDefinition {
  id: string;
  label: string;
  classId: CharacterClass;
  key: string;
  requiredLevel?: number;
  range: number;
  damage: number;
  heal?: number;
  manaCost: number;
  cooldownMs: number;
  stunMs?: number;
  dashDistance?: number;
  areaRadius?: number;
  pierce?: boolean;
  maxPierceTargets?: number;
  selfCentered?: boolean;
}

export interface ClassDefinition {
  id: CharacterClass;
  label: string;
  maxHp: number;
  maxMp: number;
  speed: number;
  attackRange: number;
  attackDamage: number;
  attackCooldownMs: number;
  blockReduction: number;
  skills: SkillDefinition[];
  passives: string[];
}

export interface InventoryItem {
  id: string;
  label: string;
  quantity: number;
  stackable: boolean;
  slot?: EquipmentSlot;
  grade?: ItemGrade;
  requiredLevel?: number;
  classId?: CharacterClass;
  appearance?: string;
  stats?: ItemStats;
  enchantLevel?: number;
  enchantable?: boolean;
  consumable?: {
    hp?: number;
    mp?: number;
  };
}

export type EquipmentState = Partial<Record<EquipmentSlot, InventoryItem>>;

export interface ShopItemDefinition {
  id: string;
  priceGold: number;
  priceItemId?: string;
  priceItemQuantity?: number;
  grantGold?: number;
  item: InventoryItem;
  description: string;
}

const weaponGrades: Array<{ grade: ItemGrade; level: number; prefix: string; power: number; price: number }> = [
  { grade: "common", level: 1, prefix: "Militia", power: 1, price: 220 },
  { grade: "rare", level: 5, prefix: "Azure", power: 1.85, price: 720 },
  { grade: "epic", level: 15, prefix: "Violet", power: 3.2, price: 2450 },
  { grade: "legendary", level: 30, prefix: "Golden", power: 5.1, price: 8400 },
  { grade: "mythic", level: 50, prefix: "Dragon", power: 7.4, price: 24000 },
  { grade: "relic", level: 75, prefix: "Eclipse", power: 10.8, price: 72000 }
];

const armorGrades: Array<{ grade: ItemGrade; level: number; prefix: string; power: number; price: number }> = [
  { grade: "common", level: 1, prefix: "Worn", power: 1, price: 130 },
  { grade: "rare", level: 8, prefix: "Azure", power: 1.7, price: 520 },
  { grade: "epic", level: 18, prefix: "Violet", power: 3, price: 1850 },
  { grade: "legendary", level: 32, prefix: "Golden", power: 4.7, price: 5600 },
  { grade: "mythic", level: 52, prefix: "Dragonforged", power: 6.9, price: 18000 },
  { grade: "relic", level: 76, prefix: "Eclipse", power: 9.8, price: 54000 }
];

const enchantScrollGrades: Array<{ grade: ItemGrade; level: number; weaponPrice: number; armorPrice: number }> = [
  { grade: "common", level: 1, weaponPrice: 180, armorPrice: 140 },
  { grade: "rare", level: 8, weaponPrice: 560, armorPrice: 420 },
  { grade: "epic", level: 18, weaponPrice: 1800, armorPrice: 1300 },
  { grade: "legendary", level: 32, weaponPrice: 5800, armorPrice: 4200 },
  { grade: "mythic", level: 52, weaponPrice: 16800, armorPrice: 12200 },
  { grade: "relic", level: 76, weaponPrice: 52000, armorPrice: 38000 }
];

const weaponTemplates: Record<CharacterClass, { noun: string; appearance: string; baseStats: ItemStats; description: string }> = {
  warrior: {
    noun: "Greatsword",
    appearance: "blade",
    baseStats: { attack: 9, str: 2 },
    description: "Warrior blade: balanced attack and STR."
  },
  assassin: {
    noun: "Twin Dagger",
    appearance: "dagger",
    baseStats: { attack: 7, speed: 10, dex: 3, crit: 5, attackSpeed: 4 },
    description: "Assassin dagger: faster hits, DEX and crit."
  },
  mage: {
    noun: "Staff",
    appearance: "staff",
    baseStats: { magic: 14, mp: 28, castSpeed: 5 },
    description: "Mage staff: magic power, mana and cast speed."
  },
  archer: {
    noun: "Longbow",
    appearance: "bow",
    baseStats: { attack: 8, dex: 4, crit: 7, attackSpeed: 3 },
    description: "Archer bow: attack, DEX and crit."
  },
  tank: {
    noun: "War Mace",
    appearance: "mace",
    baseStats: { attack: 5, defense: 7, hp: 24, str: 1 },
    description: "Tank mace: defense, HP and steady attack."
  }
};

const armorTemplates: Record<
  CharacterClass,
  {
    set: string;
    appearance: string;
    slots: Record<Extract<EquipmentSlot, "helmet" | "chest" | "gloves" | "boots">, { noun: string; stats: ItemStats }>;
  }
> = {
  warrior: {
    set: "Lion",
    appearance: "steel",
    slots: {
      helmet: { noun: "Barbute", stats: { defense: 5, hp: 10, str: 1 } },
      chest: { noun: "Brigandine", stats: { defense: 10, hp: 26 } },
      gloves: { noun: "Gauntlets", stats: { defense: 4, attack: 2 } },
      boots: { noun: "Greaves", stats: { defense: 4, speed: 5 } }
    }
  },
  assassin: {
    set: "Night",
    appearance: "shadow",
    slots: {
      helmet: { noun: "Mask", stats: { defense: 3, dex: 1, crit: 2 } },
      chest: { noun: "Leather", stats: { defense: 7, speed: 9 } },
      gloves: { noun: "Grips", stats: { attack: 2, dex: 2, attackSpeed: 2 } },
      boots: { noun: "Treads", stats: { speed: 14, dex: 1 } }
    }
  },
  mage: {
    set: "Arcane",
    appearance: "arcane",
    slots: {
      helmet: { noun: "Horns", stats: { magic: 4, mp: 16, castSpeed: 1 } },
      chest: { noun: "Robe", stats: { magic: 8, mp: 34, defense: 2 } },
      gloves: { noun: "Wraps", stats: { magic: 3, castSpeed: 3 } },
      boots: { noun: "Sandals", stats: { speed: 7, mp: 12 } }
    }
  },
  archer: {
    set: "Hawk",
    appearance: "hunter",
    slots: {
      helmet: { noun: "Hood", stats: { defense: 3, dex: 2, crit: 2 } },
      chest: { noun: "Jerkin", stats: { defense: 7, hp: 12, dex: 1 } },
      gloves: { noun: "Bracers", stats: { attack: 2, crit: 3, attackSpeed: 2 } },
      boots: { noun: "Boots", stats: { speed: 11, dex: 1 } }
    }
  },
  tank: {
    set: "Bulwark",
    appearance: "guardian",
    slots: {
      helmet: { noun: "Horned Helm", stats: { defense: 8, hp: 18 } },
      chest: { noun: "Plate", stats: { defense: 15, hp: 42, speed: -4 } },
      gloves: { noun: "Fists", stats: { defense: 6, str: 1 } },
      boots: { noun: "Sabatons", stats: { defense: 7, hp: 14 } }
    }
  }
};
const classLabels: Record<CharacterClass, string> = {
  warrior: "Warrior",
  assassin: "Assassin",
  mage: "Mage",
  archer: "Archer",
  tank: "Tank"
};

function scaledStats(stats: ItemStats, power: number): ItemStats {
  return Object.fromEntries(Object.entries(stats).map(([key, value]) => [key, Math.round((value ?? 0) * power)])) as ItemStats;
}

function weaponOffer(classId: CharacterClass, tier: (typeof weaponGrades)[number]): ShopItemDefinition {
  const template = weaponTemplates[classId];
  return {
    id: `${classId}-${tier.grade}-${template.appearance}`,
    priceGold: tier.price,
    item: {
      id: `${classId}-${tier.grade}-${template.appearance}`,
      label: `${tier.prefix} ${template.noun}`,
      quantity: 1,
      stackable: false,
      slot: "weapon",
      grade: tier.grade,
      requiredLevel: tier.level,
      classId,
      appearance: template.appearance,
      enchantable: true,
      stats: scaledStats(template.baseStats, tier.power)
    },
    description: `${template.description} Lv.${tier.level}+ ${itemGradeText(tier.grade)}.`
  };
}

function armorOffer(classId: CharacterClass, slot: Extract<EquipmentSlot, "helmet" | "chest" | "gloves" | "boots">, tier: (typeof armorGrades)[number]): ShopItemDefinition {
  const template = armorTemplates[classId];
  const piece = template.slots[slot];
  return {
    id: `${classId}-${tier.grade}-${template.appearance}-${slot}`,
    priceGold: Math.round(tier.price * (slot === "chest" ? 1.35 : 0.72)),
    item: {
      id: `${classId}-${tier.grade}-${template.appearance}-${slot}`,
      label: `${tier.prefix} ${template.set} ${piece.noun}`,
      quantity: 1,
      stackable: false,
      slot,
      grade: tier.grade,
      requiredLevel: tier.level,
      classId,
      appearance: template.appearance,
      stats: scaledStats(piece.stats, tier.power)
    },
    description: `${classLabels[classId]} ${slot} armor. Lv.${tier.level}+ ${itemGradeText(tier.grade)}.`
  };
}

function shieldOffer(tier: (typeof armorGrades)[number]): ShopItemDefinition {
  const id = `shield-${tier.grade}-bulwark`;
  return {
    id,
    priceGold: Math.round(tier.price * 0.9),
    item: {
      id,
      label: `${tier.prefix} Bulwark Shield`,
      quantity: 1,
      stackable: false,
      slot: "shield",
      grade: tier.grade,
      requiredLevel: tier.level,
      appearance: tier.grade === "common" ? "wood" : tier.grade === "rare" ? "steel" : "guardian",
      stats: scaledStats({ defense: 7, hp: 22, speed: -2 }, tier.power)
    },
    description: `Shield bought with gold. Lv.${tier.level}+ ${itemGradeText(tier.grade)}.`
  };
}

const townShieldOffers: ShopItemDefinition[] = armorGrades.map((tier) => shieldOffer(tier));

type JewelrySlot = Extract<EquipmentSlot, "necklace" | "earringLeft" | "ringLeft">;

const jewelrySlotDescription: Record<JewelrySlot, string> = {
  necklace: "Fits the necklace slot.",
  earringLeft: "Fits either earring slot.",
  ringLeft: "Fits either ring slot."
};

function accessoryOffer(definition: {
  id: string;
  label: string;
  priceGold: number;
  priceItemId?: string;
  priceItemQuantity?: number;
  slot: JewelrySlot;
  grade: ItemGrade;
  requiredLevel: number;
  appearance: string;
  stats: ItemStats;
  description: string;
}): ShopItemDefinition {
  return {
    id: definition.id,
    priceGold: definition.priceGold,
    priceItemId: definition.priceItemId,
    priceItemQuantity: definition.priceItemQuantity,
    item: {
      id: definition.id,
      label: definition.label,
      quantity: 1,
      stackable: false,
      slot: definition.slot,
      grade: definition.grade,
      requiredLevel: definition.requiredLevel,
      appearance: definition.appearance,
      stats: { ...definition.stats }
    },
    description: `${definition.description} ${jewelrySlotDescription[definition.slot]}`
  };
}

const townAccessoryOffers: ShopItemDefinition[] = [
  accessoryOffer({
    id: "copper-ring",
    label: "Copper Ring",
    priceGold: 90,
    slot: "ringLeft",
    grade: "common",
    requiredLevel: 1,
    appearance: "copper",
    stats: { hp: 18, attack: 1, magic: 1 },
    description: "Starter ring bought with gold."
  }),
  accessoryOffer({
    id: "keen-ring",
    label: "Keen Ring",
    priceGold: 360,
    slot: "ringLeft",
    grade: "rare",
    requiredLevel: 6,
    appearance: "silver",
    stats: { attack: 4, dex: 2, crit: 2 },
    description: "Damage ring bought with gold."
  }),
  accessoryOffer({
    id: "tin-earring",
    label: "Tin Earring",
    priceGold: 90,
    slot: "earringLeft",
    grade: "common",
    requiredLevel: 1,
    appearance: "tin",
    stats: { mp: 18, magic: 2 },
    description: "Starter earring bought with gold."
  }),
  accessoryOffer({
    id: "focus-earring",
    label: "Focus Earring",
    priceGold: 360,
    slot: "earringLeft",
    grade: "rare",
    requiredLevel: 6,
    appearance: "silver",
    stats: { mp: 35, magic: 4, castSpeed: 3 },
    description: "Caster earring bought with gold."
  }),
  accessoryOffer({
    id: "brass-necklace",
    label: "Brass Necklace",
    priceGold: 140,
    slot: "necklace",
    grade: "common",
    requiredLevel: 1,
    appearance: "copper",
    stats: { hp: 24, defense: 2 },
    description: "Starter necklace bought with gold."
  }),
  accessoryOffer({
    id: "silver-necklace",
    label: "Silver Necklace",
    priceGold: 520,
    slot: "necklace",
    grade: "rare",
    requiredLevel: 6,
    appearance: "silver",
    stats: { hp: 45, defense: 4, attack: 2, magic: 2 },
    description: "Balanced necklace bought with gold."
  })
];

const arenaAccessoryOffers: ShopItemDefinition[] = [
  accessoryOffer({
    id: "arena-signet",
    label: "Arena Signet",
    priceGold: 0,
    priceItemId: "pvp-coin",
    priceItemQuantity: 18,
    slot: "ringLeft",
    grade: "epic",
    requiredLevel: 5,
    appearance: "arena",
    stats: { hp: 52, attack: 7, magic: 7, crit: 5 },
    description: "C-grade arena ring bought with PvP Coin."
  }),
  accessoryOffer({
    id: "arena-earring",
    label: "Arena Earring",
    priceGold: 0,
    priceItemId: "pvp-coin",
    priceItemQuantity: 18,
    slot: "earringLeft",
    grade: "epic",
    requiredLevel: 5,
    appearance: "arena",
    stats: { mp: 42, magic: 7, castSpeed: 5, crit: 4 },
    description: "C-grade arena earring bought with PvP Coin."
  }),
  accessoryOffer({
    id: "arena-necklace",
    label: "Arena Necklace",
    priceGold: 0,
    priceItemId: "pvp-coin",
    priceItemQuantity: 22,
    slot: "necklace",
    grade: "epic",
    requiredLevel: 5,
    appearance: "arena",
    stats: { hp: 72, defense: 7, attack: 5, magic: 5 },
    description: "C-grade arena necklace bought with PvP Coin."
  }),
  accessoryOffer({
    id: "blood-ring",
    label: "Blood Ring",
    priceGold: 0,
    priceItemId: "pvp-coin",
    priceItemQuantity: 26,
    slot: "ringLeft",
    grade: "legendary",
    requiredLevel: 8,
    appearance: "arena",
    stats: { hp: 82, attack: 10, magic: 10, crit: 7 },
    description: "B-grade arena ring bought with PvP Coin."
  }),
  accessoryOffer({
    id: "blood-earring",
    label: "Blood Earring",
    priceGold: 0,
    priceItemId: "pvp-coin",
    priceItemQuantity: 26,
    slot: "earringLeft",
    grade: "legendary",
    requiredLevel: 8,
    appearance: "arena",
    stats: { mp: 48, magic: 10, castSpeed: 8, crit: 6 },
    description: "B-grade arena earring bought with PvP Coin."
  }),
  accessoryOffer({
    id: "blood-necklace",
    label: "Blood Necklace",
    priceGold: 0,
    priceItemId: "pvp-coin",
    priceItemQuantity: 32,
    slot: "necklace",
    grade: "legendary",
    requiredLevel: 8,
    appearance: "arena",
    stats: { hp: 102, defense: 10, attack: 7, magic: 7 },
    description: "B-grade arena necklace bought with PvP Coin."
  }),
  accessoryOffer({
    id: "champion-ring",
    label: "Champion Ring",
    priceGold: 0,
    priceItemId: "pvp-coin",
    priceItemQuantity: 42,
    slot: "ringLeft",
    grade: "mythic",
    requiredLevel: 12,
    appearance: "arena",
    stats: { hp: 116, attack: 14, magic: 14, crit: 10 },
    description: "A-grade arena ring bought with PvP Coin."
  }),
  accessoryOffer({
    id: "champion-earring",
    label: "Champion Earring",
    priceGold: 0,
    priceItemId: "pvp-coin",
    priceItemQuantity: 42,
    slot: "earringLeft",
    grade: "mythic",
    requiredLevel: 12,
    appearance: "arena",
    stats: { mp: 96, magic: 16, castSpeed: 12, crit: 9 },
    description: "A-grade arena earring bought with PvP Coin."
  }),
  accessoryOffer({
    id: "champion-necklace",
    label: "Champion Necklace",
    priceGold: 0,
    priceItemId: "pvp-coin",
    priceItemQuantity: 46,
    slot: "necklace",
    grade: "mythic",
    requiredLevel: 12,
    appearance: "arena",
    stats: { hp: 110, defense: 12, attack: 9, magic: 9 },
    description: "A-grade arena necklace bought with PvP Coin."
  })
];

function enchantScrollOffer(kind: "weapon" | "armor", tier: (typeof enchantScrollGrades)[number]): ShopItemDefinition {
  const gradeLabel = itemGradeText(tier.grade);
  const id = enchantScrollIdForGrade(kind, tier.grade);
  const target = kind === "weapon" ? "weapon" : "armor, jewelry or shield";
  return {
    id,
    priceGold: kind === "weapon" ? tier.weaponPrice : tier.armorPrice,
    item: {
      id,
      label: `${gradeLabel} Scroll: Enchant ${kind === "weapon" ? "Weapon" : "Armor"}`,
      quantity: 1,
      stackable: true,
      grade: tier.grade,
      requiredLevel: tier.level
    },
    description: `Raises ${gradeLabel} ${target} enchant by +1 ${kind === "weapon" ? "up to +20" : "up to +10"}.`
  };
}

const enchantScrollOffers: ShopItemDefinition[] = [
  ...enchantScrollGrades.map((tier) => enchantScrollOffer("weapon", tier)),
  ...enchantScrollGrades.map((tier) => enchantScrollOffer("armor", tier))
];

export const SHOP_CATALOG: ShopItemDefinition[] = [
  ...enchantScrollOffers,
  {
    id: "pvp-coin-adena",
    priceGold: 0,
    priceItemId: "pvp-coin",
    priceItemQuantity: 1,
    grantGold: 420,
    item: {
      id: "pvp-adena-pouch",
      label: "Adena Exchange",
      quantity: 1,
      stackable: true,
      grade: "common",
      appearance: "pvp"
    },
    description: "Exchange 1 PvP Coin for 420 gold."
  },
  {
    id: "lesser-hp-potion",
    priceGold: 35,
    item: {
      id: "lesser-hp-potion",
      label: "Lesser HP Potion",
      quantity: 1,
      stackable: true,
      consumable: { hp: 90 }
    },
    description: "Restores 90 HP."
  },
  {
    id: "greater-hp-potion",
    priceGold: 95,
    item: {
      id: "greater-hp-potion",
      label: "Greater HP Potion",
      quantity: 1,
      stackable: true,
      consumable: { hp: 220 }
    },
    description: "Restores 220 HP."
  },
  ...townShieldOffers,
  ...townAccessoryOffers,
  ...arenaAccessoryOffers,
  ...weaponGrades.flatMap((tier) => (["warrior", "assassin", "mage", "archer"] as CharacterClass[]).map((classId) => weaponOffer(classId, tier))),
  ...armorGrades.flatMap((tier) =>
    (["warrior", "assassin", "mage", "archer"] as CharacterClass[]).flatMap((classId) =>
      (["helmet", "chest", "gloves", "boots"] as const).map((slot) => armorOffer(classId, slot, tier))
    )
  )
];

export interface WalletState {
  mode: "telegram-ton" | "bitcoin-lightning";
  address?: string;
  connected: boolean;
  pendingToken: number;
}

export interface ClanMemberInfo {
  characterId: string;
  playerId?: string;
  name: string;
  classId?: CharacterClass;
  level: number;
  role: ClanRole;
  online: boolean;
}

export interface ClanPublicInfo {
  id: string;
  name: string;
  tag: string;
  emblem: ClanEmblem;
  leaderCharacterId: string;
  leaderName: string;
  memberCount: number;
  onlineCount: number;
  members: ClanMemberInfo[];
}

export interface PlayerPublicState {
  id: string;
  name: string;
  classId: CharacterClass;
  race?: CharacterRace;
  face?: number;
  customHeadUrl?: string;
  position: Vector2;
  velocity: Vector2;
  facing: Vector2;
  movementSpeed?: number;
  dashStartedAt?: number;
  dashUntil?: number;
  dashDirection?: Vector2;
  weaponEnchantLevel?: number;
  equipmentVisual?: {
    weapon?: string;
    weaponGrade?: ItemGrade;
    chest?: string;
    chestGrade?: ItemGrade;
    helmet?: string;
    helmetGrade?: ItemGrade;
    gloves?: string;
    glovesGrade?: ItemGrade;
    boots?: string;
    bootsGrade?: ItemGrade;
    armorEnchantLevel?: number;
  };
  hp: number;
  maxHp: number;
  cp: number;
  maxCp: number;
  mp: number;
  maxMp: number;
  level: number;
  xp: number;
  gold: number;
  premium?: boolean;
  premiumUntil?: number;
  karma: number;
  pkCount: number;
  pvpCount: number;
  monsterKills?: Partial<Record<MonsterArchetype, number>>;
  arenaRating?: number;
  arenaWins?: number;
  arenaLosses?: number;
  arenaStreak?: number;
  singing?: PlayerSingingState;
  sitting?: boolean;
  marketVendor?: MarketVendorState;
  pvpFlagUntil?: number;
  partyId?: string;
  duelOpponentId?: string;
  skillPoints?: number;
  clanId?: string;
  clanName?: string;
  clanTag?: string;
  clanEmblem?: ClanEmblem;
  clanRole?: ClanRole;
  blocking: boolean;
  stunnedUntil: number;
  downed?: boolean;
  revivableUntil?: number;
  zone: ZoneKind;
  comboStage: number;
  lastProcessedSeq: number;
}

export interface MonsterState {
  id: string;
  archetype: MonsterArchetype;
  spritePackId?: MonsterSpritePackId;
  position: Vector2;
  velocity?: Vector2;
  hp: number;
  maxHp: number;
  level: number;
  targetId?: string;
  respawnsAt?: number;
}

export interface WorldResource {
  id: string;
  kind: "ore" | "herb" | "wood" | "chest";
  position: Vector2;
  remaining: number;
  respawnsAt?: number;
}

export interface GroundItem {
  id: string;
  kind: "gold" | "coin" | "item";
  label: string;
  position: Vector2;
  quantity: number;
  item?: InventoryItem;
  rare?: boolean;
  ownerId?: string;
  sourceId?: string;
  expiresAt: number;
}

export interface CombatEvent {
  id: string;
  at: number;
  sourceId: string;
  targetId: string;
  amount: number;
  kind: "attack" | "skill" | "monster" | "death" | "loot" | "claim" | "revive" | "heal";
  skillId?: string;
  attackStyle?: MonsterAttackStyle;
  message: string;
}

export interface ChatMessage {
  id: string;
  at: number;
  playerId: string;
  playerName: string;
  channel: ChatChannel;
  recipientId?: string;
  position?: Vector2;
  zone?: ZoneKind;
  clanId?: string;
  text: string;
}

export interface SocialInvite {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  expiresAt: number;
}

export interface MarketListingItem {
  listingId: string;
  sellerId: string;
  sellerName: string;
  item: InventoryItem;
  quantity: number;
  priceGold: number;
  source: "player" | "bot";
}

export interface MarketVendorState {
  title: string;
  items: MarketListingItem[];
  sinceAt?: number;
  expiresAt?: number;
  playerOwned?: boolean;
}

export interface TradeOfferItem {
  tradeItemId: string;
  inventoryIndex: number;
  item: InventoryItem;
  quantity: number;
}

export interface TradeOfferState {
  playerId: string;
  playerName: string;
  gold: number;
  items: TradeOfferItem[];
  ready: boolean;
}

export interface TradeSessionState {
  id: string;
  createdAt: number;
  expiresAt: number;
  left: TradeOfferState;
  right: TradeOfferState;
}

export interface ClanInvite extends SocialInvite {
  clanId: string;
  clanName: string;
  clanTag: string;
  clanEmblem: ClanEmblem;
}

export interface ArenaStanding {
  playerId: string;
  playerName: string;
  rating: number;
  wins: number;
  losses: number;
  streak: number;
  seasonPoints: number;
}

export interface ArenaSeasonState {
  id: string;
  label: string;
  endsAt: number;
  top: ArenaStanding[];
}

export type AdminActionType =
  | "kick"
  | "clearKarma"
  | "muteChat"
  | "unmuteChat"
  | "ban"
  | "heal"
  | "revive"
  | "summon"
  | "teleportTo"
  | "summonSingers"
  | "hideSingers";

export interface AdminPlayerInfo {
  id: string;
  characterId: string;
  name: string;
  bot?: boolean;
  classId: CharacterClass;
  level: number;
  zone: ZoneKind;
  hp: number;
  maxHp: number;
  cp: number;
  maxCp: number;
  mp: number;
  maxMp: number;
  gold: number;
  karma: number;
  position: Vector2;
  mutedUntil?: number;
}

export interface FeedbackReport {
  id: string;
  createdAt: number;
  playerId: string;
  characterId: string;
  playerName: string;
  level: number;
  zone: ZoneKind;
  position: Vector2;
  text: string;
  context?: string;
}

export interface AdminState {
  updatedAt: number;
  totalOnline: number;
  realOnline: number;
  botOnline: number;
  singerOnline: number;
  singersHidden: boolean;
  players: AdminPlayerInfo[];
  feedbackReports: FeedbackReport[];
  message?: string;
}

export interface GameSnapshot {
  serverTime: number;
  tick: number;
  onlineCount: number;
  players: PlayerPublicState[];
  monsters: MonsterState[];
  resources: WorldResource[];
  groundItems: GroundItem[];
  events: CombatEvent[];
  partyInvites: SocialInvite[];
  duelInvites: SocialInvite[];
  tradeInvites: SocialInvite[];
  activeTrade?: TradeSessionState;
  clanInvites: ClanInvite[];
  clans: ClanPublicInfo[];
  arenaSeason: ArenaSeasonState;
}

export interface AttackCommand {
  aim: Vector2;
  targetId?: string;
  charge?: number;
  forcePk?: boolean;
}

export interface SkillCommand extends AttackCommand {
  skillId: string;
}

export type VoiceChannel = "nearby" | "party";

export interface VoiceIceCandidate {
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
}

export type VoiceSignal =
  | {
      kind: "offer" | "answer";
      sdp: string;
    }
  | {
      kind: "ice";
      candidate: VoiceIceCandidate;
    }
  | {
      kind: "leave";
    };

export interface VoicePeer {
  playerId: string;
  name: string;
  channel: VoiceChannel;
  distance?: number;
}

export type ClientMessage =
  | {
      type: "join";
      payload: {
        characterId?: string;
        token?: string;
        name: string;
        classId: CharacterClass;
        race?: CharacterRace;
        face?: number;
        customHeadUrl?: string;
        profile?: ClientPerformanceProfile;
      };
    }
  | {
      type: "profileUpdate";
      payload: {
        profile?: ClientPerformanceProfile;
      };
    }
  | {
      type: "customHead";
      payload: {
        customHeadUrl?: string;
      };
    }
  | {
      type: "input";
      payload: PlayerInput;
    }
  | {
      type: "attack";
      payload: AttackCommand;
    }
  | {
      type: "skill";
      payload: SkillCommand;
    }
	  | {
	      type: "sing";
	      payload: {
	        active: boolean;
	      };
	    }
  | {
      type: "voicePresence";
      payload: {
        active: boolean;
        channel: VoiceChannel;
      };
    }
  | {
      type: "voiceSignal";
      payload: {
        toPlayerId: string;
        channel: VoiceChannel;
        signal: VoiceSignal;
      };
    }
	  | {
	      type: "renameCharacter";
	      payload: {
	        name: string;
	      };
    }
  | {
      type: "claimReward";
      payload: {
        walletAddress?: string;
      };
    }
  | {
      type: "claimStoryQuestReward";
      payload: {
        questId: string;
      };
    }
  | {
      type: "chat";
      payload: {
        channel?: Exclude<ChatChannel, "system">;
        text: string;
      };
    }
  | {
      type: "feedbackReport";
      payload: {
        text: string;
        context?: string;
      };
    }
  | {
      type: "adminRequest";
      payload: Record<string, never>;
    }
  | {
      type: "adminAction";
      payload: {
        action: AdminActionType;
        targetId: string;
        durationMs?: number;
      };
    }
  | {
      type: "equipItem";
      payload: {
        itemId: string;
        slot?: EquipmentSlot;
      };
    }
  | {
      type: "unequipItem";
      payload: {
        slot: EquipmentSlot;
      };
    }
  | {
      type: "useItem";
      payload: {
        itemId: string;
      };
    }
  | {
      type: "sellItem";
      payload: {
        itemId: string;
      };
    }
  | {
      type: "openResource";
      payload: {
        resourceId: string;
      };
    }
  | {
      type: "pickupGroundItem";
      payload: {
        itemId: string;
      };
    }
  | {
      type: "enchantItem";
      payload: {
        itemId: string;
        slot?: EquipmentSlot;
      };
    }
	  | {
	      type: "buyShopItem";
	      payload: {
	        itemId: string;
	      };
	    }
	  | {
	      type: "marketListItem";
	      payload: {
	        inventoryIndex: number;
	        quantity: number;
	        priceGold: number;
	      };
	    }
	  | {
	      type: "marketCancelListing";
	      payload: {
	        listingId?: string;
	      };
	    }
	  | {
	      type: "buyMarketItem";
	      payload: {
	        sellerId: string;
	        listingId: string;
	      };
	    }
	  | {
	      type: "tradeInvite";
	      payload: {
	        targetId: string;
	      };
	    }
	  | {
	      type: "tradeAccept";
	      payload: {
	        fromId: string;
	      };
	    }
	  | {
	      type: "tradeDecline";
	      payload: {
	        fromId: string;
	      };
	    }
	  | {
	      type: "tradeCancel";
	      payload: Record<string, never>;
	    }
	  | {
	      type: "tradeOfferGold";
	      payload: {
	        gold: number;
	      };
	    }
	  | {
	      type: "tradeOfferItem";
	      payload: {
	        inventoryIndex: number;
	        quantity: number;
	      };
	    }
	  | {
	      type: "tradeRemoveItem";
	      payload: {
	        tradeItemId: string;
	      };
	    }
	  | {
	      type: "tradeReady";
	      payload: {
	        ready: boolean;
	      };
	    }
	  | {
	      type: "respawn";
	      payload: {
        mode: "lastSafe";
      };
    }
  | {
      type: "revive";
      payload: {
        targetId: string;
      };
    }
  | {
      type: "partyInvite";
      payload: {
        targetId: string;
      };
    }
  | {
      type: "partyAccept";
      payload: {
        fromId: string;
      };
    }
  | {
      type: "partyDecline";
      payload: {
        fromId: string;
      };
    }
  | {
      type: "duelInvite";
      payload: {
        targetId: string;
      };
    }
  | {
      type: "duelAccept";
      payload: {
        fromId: string;
      };
    }
  | {
      type: "duelDecline";
      payload: {
        fromId: string;
      };
    }
  | {
      type: "clanCreate";
      payload: {
        name: string;
        emblem: ClanEmblem;
      };
    }
  | {
      type: "clanInvite";
      payload: {
        targetId: string;
      };
    }
  | {
      type: "clanAccept";
      payload: {
        fromId: string;
        clanId: string;
      };
    }
  | {
      type: "clanDecline";
      payload: {
        fromId: string;
        clanId: string;
      };
    }
  | {
      type: "clanKick";
      payload: {
        characterId: string;
      };
    }
  | {
      type: "clanLeave";
      payload: Record<string, never>;
    }
  | {
      type: "teleport";
      payload: {
        teleportId: TeleportId;
      };
    }
  | {
      type: "dungeonTravel";
      payload:
        | {
            mode: "enter";
            landmarkId: string;
          }
        | {
            mode: "exit";
            dungeonId: string;
            exit: "start" | "end";
          };
    };

export type ServerMessage =
  | {
      type: "welcome";
      payload: {
        playerId: string;
        characterId: string;
        snapshot: GameSnapshot;
        inventory: InventoryItem[];
        equipment: EquipmentState;
        stats: DerivedStats;
        wallet: WalletState;
      };
    }
  | {
      type: "snapshot";
      payload: GameSnapshot;
    }
  | {
      type: "inventory";
      payload: {
        items: InventoryItem[];
        equipment: EquipmentState;
        stats: DerivedStats;
        gold: number;
        wallet: WalletState;
      };
    }
  | {
      type: "rewardClaimed";
      payload: {
        claimId: string;
        amount: number;
        currency: CurrencyCode;
        status: "queued" | "paid";
      };
    }
	  | {
	      type: "chat";
	      payload: ChatMessage;
	    }
  | {
      type: "voicePeers";
      payload: {
        active: boolean;
        channel: VoiceChannel;
        peers: VoicePeer[];
      };
    }
  | {
      type: "voiceSignal";
      payload: {
        fromPlayerId: string;
        fromName: string;
        channel: VoiceChannel;
        signal: VoiceSignal;
      };
    }
	  | {
	      type: "adminState";
	      payload: AdminState;
	    }
  | {
      type: "feedbackSaved";
      payload: {
        ok: boolean;
        message: string;
        report?: FeedbackReport;
      };
    }
  | {
      type: "error";
      payload: {
        code: string;
        message: string;
      };
    };

export const CLASS_DEFINITIONS: Record<CharacterClass, ClassDefinition> = {
  warrior: {
    id: "warrior",
    label: "Warrior",
    maxHp: 140,
    maxMp: 70,
    speed: 210,
    attackRange: 84,
    attackDamage: 22,
    attackCooldownMs: 460,
    blockReduction: 0.45,
    passives: ["Rage: combo attacks gain 10% damage per stage."],
    skills: [
      {
        id: "cleave",
        label: "Cleave",
        classId: "warrior",
        key: "1",
        requiredLevel: 5,
        range: 120,
        damage: 34,
        manaCost: 18,
        cooldownMs: 1200
      },
      {
        id: "whirlwind",
        label: "Whirlwind",
        classId: "warrior",
        key: "2",
        requiredLevel: 10,
        range: 136,
        damage: 28,
        manaCost: 30,
        cooldownMs: 3200,
        areaRadius: 126,
        selfCentered: true
      },
      {
        id: "rush-break",
        label: "Rush Break",
        classId: "warrior",
        key: "3",
        requiredLevel: 15,
        range: 150,
        damage: 36,
        manaCost: 28,
        cooldownMs: 2400,
        stunMs: 260,
        dashDistance: 118
      },
      {
        id: "earth-splitter",
        label: "Earth Splitter",
        classId: "warrior",
        key: "4",
        requiredLevel: 25,
        range: 180,
        damage: 46,
        manaCost: 42,
        cooldownMs: 5200,
        areaRadius: 145
      }
    ]
  },
  assassin: {
    id: "assassin",
    label: "Assassin",
    maxHp: 115,
    maxMp: 85,
    speed: 295,
    attackRange: 62,
    attackDamage: 17,
    attackCooldownMs: 260,
    blockReduction: 0.36,
    passives: ["Backstab: fastest melee class, short range, strong dash burst."],
    skills: [
      {
        id: "shadow-step",
        label: "Shadow Step",
        classId: "assassin",
        key: "1",
        requiredLevel: 5,
        range: 128,
        damage: 34,
        manaCost: 18,
        cooldownMs: 900,
        dashDistance: 130,
        stunMs: 120
      },
      {
        id: "twin-cut",
        label: "Twin Cut",
        classId: "assassin",
        key: "2",
        requiredLevel: 10,
        range: 82,
        damage: 34,
        manaCost: 22,
        cooldownMs: 1250
      },
      {
        id: "venom-fang",
        label: "Venom Fang",
        classId: "assassin",
        key: "3",
        requiredLevel: 15,
        range: 90,
        damage: 42,
        manaCost: 30,
        cooldownMs: 2600,
        stunMs: 220
      },
      {
        id: "smoke-dance",
        label: "Smoke Dance",
        classId: "assassin",
        key: "4",
        requiredLevel: 25,
        range: 96,
        damage: 28,
        manaCost: 44,
        cooldownMs: 4800,
        areaRadius: 94,
        selfCentered: true
      }
    ]
  },
  mage: {
    id: "mage",
    label: "Mage",
    maxHp: 82,
    maxMp: 160,
    speed: 198,
    attackRange: 285,
    attackDamage: 10,
    attackCooldownMs: 620,
    blockReduction: 0.25,
    passives: ["Focus: weak staff attack, high mana, long-range skill damage."],
    skills: [
      {
        id: "frost-bolt",
        label: "Frost Bolt",
        classId: "mage",
        key: "1",
        requiredLevel: 5,
        range: 340,
        damage: 38,
        manaCost: 26,
        cooldownMs: 1400,
        stunMs: 400
      },
      {
        id: "fire-nova",
        label: "Fire Nova",
        classId: "mage",
        key: "2",
        requiredLevel: 10,
        range: 260,
        damage: 34,
        manaCost: 34,
        cooldownMs: 2300,
        areaRadius: 96
      },
      {
        id: "arc-lightning",
        label: "Arc Lightning",
        classId: "mage",
        key: "3",
        requiredLevel: 15,
        range: 390,
        damage: 52,
        manaCost: 46,
        cooldownMs: 3400,
        stunMs: 180
      },
      {
        id: "meteor",
        label: "Meteor",
        classId: "mage",
        key: "4",
        requiredLevel: 25,
        range: 420,
        damage: 62,
        manaCost: 70,
        cooldownMs: 6200,
        areaRadius: 132
      },
      {
        id: "healing-light",
        label: "Healing Light",
        classId: "mage",
        key: "5",
        requiredLevel: 25,
        range: 0,
        damage: 0,
        heal: 72,
        manaCost: 48,
        cooldownMs: 9000
      }
    ]
  },
  archer: {
    id: "archer",
    label: "Archer",
    maxHp: 100,
    maxMp: 95,
    speed: 238,
    attackRange: 390,
    attackDamage: 18,
    attackCooldownMs: 540,
    blockReduction: 0.25,
    passives: ["Kite: longest basic range, medium speed, relies on spacing."],
    skills: [
      {
        id: "piercing-shot",
        label: "Piercing Shot",
        classId: "archer",
        key: "1",
        requiredLevel: 5,
        range: 500,
        damage: 40,
        manaCost: 20,
        cooldownMs: 1500,
        pierce: true,
        maxPierceTargets: 4
      },
      {
        id: "volley",
        label: "Volley",
        classId: "archer",
        key: "2",
        requiredLevel: 10,
        range: 440,
        damage: 32,
        manaCost: 28,
        cooldownMs: 2600,
        areaRadius: 108
      },
      {
        id: "pinning-shot",
        label: "Pinning Shot",
        classId: "archer",
        key: "3",
        requiredLevel: 15,
        range: 480,
        damage: 42,
        manaCost: 34,
        cooldownMs: 3300,
        stunMs: 420
      },
      {
        id: "rain-of-arrows",
        label: "Rain of Arrows",
        classId: "archer",
        key: "4",
        requiredLevel: 25,
        range: 520,
        damage: 64,
        manaCost: 58,
        cooldownMs: 6200,
        areaRadius: 180
      }
    ]
  },
  tank: {
    id: "tank",
    label: "Tank",
    maxHp: 180,
    maxMp: 60,
    speed: 168,
    attackRange: 66,
    attackDamage: 16,
    attackCooldownMs: 760,
    blockReduction: 0.72,
    passives: ["Fortress: slow close-range attacks, highest HP and block."],
    skills: [
      {
        id: "shield-bash",
        label: "Shield Bash",
        classId: "tank",
        key: "1",
        requiredLevel: 5,
        range: 90,
        damage: 24,
        manaCost: 16,
        cooldownMs: 1700,
        stunMs: 850
      },
      {
        id: "ground-slam",
        label: "Ground Slam",
        classId: "tank",
        key: "2",
        requiredLevel: 10,
        range: 98,
        damage: 26,
        manaCost: 24,
        cooldownMs: 2600,
        areaRadius: 108,
        selfCentered: true
      },
      {
        id: "guard-break",
        label: "Guard Break",
        classId: "tank",
        key: "3",
        requiredLevel: 15,
        range: 92,
        damage: 34,
        manaCost: 30,
        cooldownMs: 3100,
        stunMs: 520
      },
      {
        id: "iron-roar",
        label: "Iron Roar",
        classId: "tank",
        key: "4",
        requiredLevel: 25,
        range: 120,
        damage: 30,
        manaCost: 44,
        cooldownMs: 5600,
        areaRadius: 140,
        selfCentered: true
      }
    ]
  }
};

export function isCharacterClass(value: string): value is CharacterClass {
  return Object.prototype.hasOwnProperty.call(CLASS_DEFINITIONS, value);
}
