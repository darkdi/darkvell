import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { Injectable } from "@nestjs/common";
import {
  BESTIARY_CAVERN_DUNGEON_ID,
  CLASS_DEFINITIONS,
  CHARACTER_FACE_VARIANT_COUNT,
  CITY_DEFINITIONS,
  MAX_ARMOR_ENCHANT_LEVEL,
  MAX_PLAYERS_PER_WORLD,
  MAX_WEAPON_ENCHANT_LEVEL,
  SHOP_CATALOG,
  TELEPORT_DEFINITIONS,
  TICK_MS,
  WORLD_BOUNDS,
  WORLD_DUNGEON_INTERIORS,
  WORLD_HAZARDS,
  WORLD_HUNTING_GROUNDS,
  WORLD_LANDMARKS,
  WORLD_OBSTACLES,
  WORLD_ROADS,
  WORLD_STARTER_ARENA,
  WORLD_STARTER_ARENA_GATES,
  WORLD_STARTER_ARENA_WALL_RADIUS,
  enchantScrollIdForGrade,
  enchantScrollIdsForGrade,
  xpForNextLevel,
  type AdminActionType,
  type AdminState,
  type AttackCommand,
  type ChatChannel,
  type CharacterClass,
  type CharacterRace,
  type ChatMessage,
  type ClanEmblem,
  type ClanInvite,
  type ClanPublicInfo,
  type ClanRole,
  type CombatEvent,
  type DerivedStats,
  type EquipmentSlot,
  type EquipmentState,
  type FeedbackReport,
  type GameSnapshot,
	  type GroundItem,
	  type InventoryItem,
	  type MarketListingItem,
	  type MarketVendorState,
	  type MonsterArchetype,
	  type MonsterAttackStyle,
	  type MonsterSpritePackId,
	  type MonsterState,
	  type PlayerInput,
	  type PlayerPublicState,
	  type PlayerSingingState,
	  type SocialInvite,
		  type SkillCommand,
	  type TeleportId,
	  type TradeOfferItem,
	  type TradeSessionState,
		  type Vector2,
  type VoiceChannel,
  type VoicePeer,
	  type WalletState,
	  type WorldHazardDefinition,
	  type WorldResource
	} from "@mmo/shared";

interface PlayerPrivateState extends PlayerPublicState {
  characterId: string;
  input: PlayerInput;
  inventory: InventoryItem[];
  equipment: EquipmentState;
  stats: DerivedStats;
  wallet: WalletState;
  lastAttackAt: number;
  skillCooldowns: Map<string, number>;
  lastConsumableAt: number;
  lastSafePosition: Vector2;
  downed: boolean;
  revivableUntil?: number;
  deathReturnPosition?: Vector2;
  tokenDebt: number;
  pkCount: number;
  pvpCount: number;
  monsterKills: Partial<Record<MonsterArchetype, number>>;
  pvpFlagUntil?: number;
  arenaRating: number;
  arenaWins: number;
  arenaLosses: number;
  arenaStreak: number;
  arenaSeasonPoints: number;
  storyQuestRewards: string[];
  jumpUntil: number;
  lastJumpInput: boolean;
  singingNextTrackAt?: number;
  singingTrackCursor?: number;
  offlineMarketSeller?: boolean;
  pendingMarketNotices?: string[];
  activeSkillId?: string;
}

interface JoinResult {
  playerId: string;
  characterId: string;
  snapshot: GameSnapshot;
  inventory: InventoryItem[];
  equipment: EquipmentState;
  stats: DerivedStats;
  wallet: WalletState;
}

interface AdminActionResult {
  state?: AdminState;
  kickedPlayerId?: string;
  closeCode?: number;
  closeReason?: string;
  closeErrorCode?: string;
  closeMessage?: string;
}

export interface SnapshotOptions {
  mobile?: boolean;
  playerRadius?: number;
  monsterRadius?: number;
  resourceRadius?: number;
  groundItemRadius?: number;
  eventRadius?: number;
  eventLimit?: number;
  maxPlayers?: number;
  maxMonsters?: number;
  maxResources?: number;
  maxGroundItems?: number;
  includeSocialDistantPlayers?: boolean;
}

interface SocialInviteRecord {
  fromId: string;
  toId: string;
  expiresAt: number;
}

interface ClanInviteRecord extends SocialInviteRecord {
  clanId: string;
}

interface TradeOfferRecord {
  playerId: string;
  gold: number;
  items: TradeOfferItem[];
  ready: boolean;
}

interface TradeSessionRecord {
  id: string;
  playerIds: [string, string];
  createdAt: number;
  expiresAt: number;
  offers: Map<string, TradeOfferRecord>;
}

interface PersistedClan {
  id: string;
  name: string;
  tag: string;
  emblem: ClanEmblem;
  leaderCharacterId: string;
  leaderName: string;
  members: Array<{
    characterId: string;
    name: string;
    level: number;
    classId?: CharacterClass;
    role: ClanRole;
    joinedAt: number;
  }>;
  createdAt: number;
}

interface PersistedCharacter {
  characterId: string;
  name: string;
  classId: CharacterClass;
  race?: CharacterRace;
  face?: number;
  customHeadUrl?: string;
  level: number;
  xp: number;
  gold: number;
  karma?: number;
  pkCount?: number;
  pvpCount?: number;
  monsterKills?: Partial<Record<MonsterArchetype, number>>;
  clanId?: string;
  arenaRating?: number;
  arenaWins?: number;
  arenaLosses?: number;
  arenaStreak?: number;
  arenaSeasonPoints?: number;
  storyQuestRewards?: string[];
  hp?: number;
  cp?: number;
  mp?: number;
  downed?: boolean;
  revivableUntil?: number;
  deathReturnPosition?: Vector2;
  position?: Vector2;
  inventory: InventoryItem[];
  equipment?: EquipmentState;
  marketListings?: MarketListingItem[];
  marketVendorTitle?: string;
  marketVendorSinceAt?: number;
  marketNotices?: string[];
  wallet: WalletState;
}

interface PersistedModerationState {
  bannedCharacterIds?: string[];
  bannedNames?: string[];
  mutedCharacterUntil?: Array<[string, number]>;
  mutedNameUntil?: Array<[string, number]>;
}

interface ClassGrowth {
  hp: number;
  mp: number;
  attack: number;
  magicBase: number;
  magic: number;
  defenseBase: number;
  defense: number;
}

interface MonsterSpawn {
  origin: Vector2;
  radius: number;
}

interface MonsterWanderState {
  target?: Vector2;
  nextMoveAt: number;
  pauseUntil: number;
}

interface BotBrain {
  index: number;
  targetId?: string;
  roamTarget?: Vector2;
  nextClanFollowAt?: number;
  arenaMode?: "fight" | "watch";
  arenaAnchorAngle?: number;
  nextArenaShiftAt?: number;
  nextThinkAt: number;
  nextPkAt: number;
  pkModeUntil?: number;
  forcePkTargetId?: string;
  respawnAt?: number;
  chillUntil?: number;
  nextChillAt: number;
  nextChatAt: number;
  lastChatText?: string;
  recentChatTexts?: string[];
  queuedChats?: BotQueuedChat[];
  nextWorldMoveAt?: number;
  nextSkillAt: number;
  nextReviveAt: number;
  nextSessionAt: number;
  offlineUntil?: number;
  storedBot?: PlayerPrivateState;
  dashUntil?: number;
  nextDashAt: number;
  strafeDirection: 1 | -1;
  strafeUntil: number;
  lastMoveDirection?: Vector2;
  nextTownActionAt?: number;
  marketVendorUntil?: number;
  nextMarketRestockAt?: number;
  marketFarmingUntil?: number;
  arenaUntil?: number;
  nextArenaAt?: number;
  nextShopAt?: number;
  targetLockedUntil?: number;
  lastStuckCheckAt?: number;
  lastStuckPosition?: Vector2;
  stuckSince?: number;
  avoidUntil?: number;
  avoidDirection?: Vector2;
  generation: number;
  aggression: number;
  groundIndex: number;
  roamSeed: number;
}

interface SingerNpcBrain {
  playerId: string;
  name: string;
  routeIndex: number;
  routeDirection: 1 | -1;
  holdUntil?: number;
  holdCenter?: Vector2;
  holdDriftTarget?: Vector2;
  nextHoldDriftAt?: number;
}

type BotQueuedChat = {
  text: string;
  channel: Exclude<ChatChannel, "system">;
  force: boolean;
  at: number;
};

interface MonsterTuning {
  label: string;
  baseHp: number;
  hpPerLevel: number;
  baseDamage: number;
  damagePerLevel: number;
  speed: number;
  aggroRange: number;
  attackRange: number;
  attackCooldownMs: number;
  attackStyle?: MonsterAttackStyle;
  attackStyles?: readonly MonsterAttackStyle[];
  goldBase: number;
  goldPerLevel: number;
  xpBase: number;
  xpPerLevel: number;
  lootId: string;
}

type StoryQuestRewardRequirement =
  | { kind: "monster"; archetype: MonsterArchetype; count: number }
  | { kind: "level"; level: number }
  | { kind: "arenaWins"; count: number };

interface StoryQuestRewardDefinition {
  id: string;
  label: string;
  requirement: StoryQuestRewardRequirement;
  gold: number;
  items?: Array<{ id: string; quantity: number }>;
  classGear?: Array<{ grade: NonNullable<InventoryItem["grade"]>; slot: EquipmentSlot }>;
}

const MONSTER_TUNING: Record<MonsterArchetype, MonsterTuning> = {
  wolf: {
    label: "wolf",
    baseHp: 34,
    hpPerLevel: 13,
    baseDamage: 4,
    damagePerLevel: 1.3,
    speed: 108,
    aggroRange: 175,
    attackRange: 42,
    attackCooldownMs: 980,
    goldBase: 5,
    goldPerLevel: 4,
    xpBase: 8,
    xpPerLevel: 6,
    lootId: "wolf-hide"
  },
  boar: {
    label: "boar",
    baseHp: 52,
    hpPerLevel: 17,
    baseDamage: 5,
    damagePerLevel: 1.6,
    speed: 96,
    aggroRange: 170,
    attackRange: 46,
    attackCooldownMs: 1040,
    goldBase: 7,
    goldPerLevel: 4,
    xpBase: 11,
    xpPerLevel: 7,
    lootId: "boar-tusk"
  },
  spider: {
    label: "spider",
    baseHp: 44,
    hpPerLevel: 15,
    baseDamage: 5,
    damagePerLevel: 1.8,
    speed: 134,
    aggroRange: 220,
    attackRange: 48,
    attackCooldownMs: 860,
    goldBase: 8,
    goldPerLevel: 4,
    xpBase: 12,
    xpPerLevel: 7,
    lootId: "spider-silk"
  },
  bat: {
    label: "bat",
    baseHp: 38,
    hpPerLevel: 14,
    baseDamage: 7,
    damagePerLevel: 2.4,
    speed: 162,
    aggroRange: 360,
    attackRange: 48,
    attackCooldownMs: 620,
    goldBase: 10,
    goldPerLevel: 5,
    xpBase: 16,
    xpPerLevel: 8,
    lootId: "bat-wing"
  },
  skeleton: {
    label: "skeleton",
    baseHp: 72,
    hpPerLevel: 25,
    baseDamage: 9,
    damagePerLevel: 3.4,
    speed: 112,
    aggroRange: 420,
    attackRange: 58,
    attackCooldownMs: 780,
    goldBase: 14,
    goldPerLevel: 7,
    xpBase: 22,
    xpPerLevel: 10,
    lootId: "bone-shard"
  },
  bandit: {
    label: "bandit",
    baseHp: 66,
    hpPerLevel: 21,
    baseDamage: 10,
    damagePerLevel: 3.1,
    speed: 118,
    aggroRange: 410,
    attackRange: 54,
    attackCooldownMs: 690,
    goldBase: 12,
    goldPerLevel: 6,
    xpBase: 18,
    xpPerLevel: 9,
    lootId: "bandit-mark"
  },
  archer: {
    label: "archer",
    baseHp: 64,
    hpPerLevel: 20,
    baseDamage: 10,
    damagePerLevel: 3.2,
    speed: 106,
    aggroRange: 520,
    attackRange: 260,
    attackCooldownMs: 960,
    attackStyles: ["arrow", "arrow", "arrow", "power-arrow"],
    goldBase: 13,
    goldPerLevel: 7,
    xpBase: 20,
    xpPerLevel: 10,
    lootId: "bandit-mark"
  },
  mage: {
    label: "mage",
    baseHp: 92,
    hpPerLevel: 34,
    baseDamage: 16,
    damagePerLevel: 4.9,
    speed: 104,
    aggroRange: 620,
    attackRange: 315,
    attackCooldownMs: 1040,
    attackStyles: ["lightning", "magic-bolt", "lightning", "lightning"],
    goldBase: 25,
    goldPerLevel: 12,
    xpBase: 42,
    xpPerLevel: 17,
    lootId: "witch-charm"
  },
  golem: {
    label: "golem",
    baseHp: 88,
    hpPerLevel: 34,
    baseDamage: 12,
    damagePerLevel: 3.8,
    speed: 84,
    aggroRange: 390,
    attackRange: 52,
    attackCooldownMs: 840,
    goldBase: 16,
    goldPerLevel: 8,
    xpBase: 24,
    xpPerLevel: 11,
    lootId: "ore-fragment"
  },
  wraith: {
    label: "wraith",
    baseHp: 78,
    hpPerLevel: 32,
    baseDamage: 14,
    damagePerLevel: 4.4,
    speed: 128,
    aggroRange: 480,
    attackRange: 70,
    attackCooldownMs: 760,
    goldBase: 21,
    goldPerLevel: 10,
    xpBase: 34,
    xpPerLevel: 14,
    lootId: "wraith-ash"
  },
  drake: {
    label: "drake",
    baseHp: 150,
    hpPerLevel: 58,
    baseDamage: 18,
    damagePerLevel: 5.8,
    speed: 118,
    aggroRange: 540,
    attackRange: 76,
    attackCooldownMs: 820,
    goldBase: 30,
    goldPerLevel: 14,
    xpBase: 50,
    xpPerLevel: 20,
    lootId: "drake-scale"
  },
  eye: {
    label: "flying eye",
    baseHp: 92,
    hpPerLevel: 34,
    baseDamage: 15,
    damagePerLevel: 4.8,
    speed: 142,
    aggroRange: 560,
    attackRange: 92,
    attackCooldownMs: 720,
    goldBase: 24,
    goldPerLevel: 11,
    xpBase: 38,
    xpPerLevel: 15,
    lootId: "eye-lens"
  },
  witch: {
    label: "witch",
    baseHp: 118,
    hpPerLevel: 42,
    baseDamage: 18,
    damagePerLevel: 5.2,
    speed: 116,
    aggroRange: 590,
    attackRange: 118,
    attackCooldownMs: 760,
    goldBase: 28,
    goldPerLevel: 13,
    xpBase: 46,
    xpPerLevel: 18,
    lootId: "witch-charm"
  },
  dragon: {
    label: "dragon",
    baseHp: 360,
    hpPerLevel: 96,
    baseDamage: 28,
    damagePerLevel: 7.2,
    speed: 104,
    aggroRange: 680,
    attackRange: 185,
    attackCooldownMs: 1120,
    goldBase: 58,
    goldPerLevel: 20,
    xpBase: 92,
    xpPerLevel: 30,
    lootId: "dragon-ember"
  },
  sentinel: {
    label: "sentinel",
    baseHp: 220,
    hpPerLevel: 72,
    baseDamage: 20,
    damagePerLevel: 6.6,
    speed: 90,
    aggroRange: 500,
    attackRange: 68,
    attackCooldownMs: 900,
    goldBase: 34,
    goldPerLevel: 16,
    xpBase: 56,
    xpPerLevel: 22,
    lootId: "sentinel-core"
  },
  venomplant: {
    label: "venom plant",
    baseHp: 92,
    hpPerLevel: 32,
    baseDamage: 13,
    damagePerLevel: 4.1,
    speed: 78,
    aggroRange: 520,
    attackRange: 210,
    attackCooldownMs: 1100,
    attackStyles: ["magic-bolt", "shadow", "magic-bolt"],
    goldBase: 22,
    goldPerLevel: 10,
    xpBase: 35,
    xpPerLevel: 15,
    lootId: "witch-charm"
  },
  bonewarrior: {
    label: "bone warrior",
    baseHp: 86,
    hpPerLevel: 29,
    baseDamage: 11,
    damagePerLevel: 3.8,
    speed: 112,
    aggroRange: 460,
    attackRange: 58,
    attackCooldownMs: 800,
    attackStyle: "weapon",
    goldBase: 16,
    goldPerLevel: 8,
    xpBase: 25,
    xpPerLevel: 11,
    lootId: "bone-shard"
  },
  firespirit: {
    label: "fire spirit",
    baseHp: 84,
    hpPerLevel: 31,
    baseDamage: 15,
    damagePerLevel: 4.6,
    speed: 148,
    aggroRange: 560,
    attackRange: 170,
    attackCooldownMs: 880,
    attackStyles: ["flame", "magic-bolt", "flame"],
    goldBase: 26,
    goldPerLevel: 12,
    xpBase: 42,
    xpPerLevel: 17,
    lootId: "dragon-ember"
  },
  miniboss: {
    label: "mini boss",
    baseHp: 620,
    hpPerLevel: 132,
    baseDamage: 31,
    damagePerLevel: 8.8,
    speed: 108,
    aggroRange: 640,
    attackRange: 78,
    attackCooldownMs: 680,
    goldBase: 72,
    goldPerLevel: 20,
    xpBase: 110,
    xpPerLevel: 34,
    lootId: "mini-boss-relic"
  },
  dungeonboss: {
    label: "dungeon boss",
    baseHp: 900,
    hpPerLevel: 190,
    baseDamage: 38,
    damagePerLevel: 9.2,
    speed: 98,
    aggroRange: 760,
    attackRange: 116,
    attackCooldownMs: 720,
    attackStyles: ["slam", "arcane", "lightning", "slam"],
    goldBase: 96,
    goldPerLevel: 24,
    xpBase: 155,
    xpPerLevel: 40,
    lootId: "mini-boss-relic"
  },
  boss: {
    label: "boss",
    baseHp: 1200,
    hpPerLevel: 260,
    baseDamage: 45,
    damagePerLevel: 9.5,
    speed: 112,
    aggroRange: 720,
    attackRange: 86,
    attackCooldownMs: 640,
    goldBase: 120,
    goldPerLevel: 24,
    xpBase: 190,
    xpPerLevel: 42,
    lootId: "boss-relic"
  }
};
const STORY_QUEST_REWARDS: StoryQuestRewardDefinition[] = [
  {
    id: "wolfpine-first-blood",
    label: "Wolfpine First Blood",
    requirement: { kind: "monster", archetype: "wolf", count: 8 },
    gold: 120,
    items: [{ id: "lesser-hp-potion", quantity: 4 }]
  },
  {
    id: "suntrail-supplies",
    label: "Suntrail Supplies",
    requirement: { kind: "monster", archetype: "boar", count: 6 },
    gold: 180,
    items: [{ id: enchantScrollIdForGrade("weapon", "common"), quantity: 1 }]
  },
  {
    id: "wayfarer-brute",
    label: "Wayfarer Brute",
    requirement: { kind: "monster", archetype: "miniboss", count: 1 },
    gold: 280,
    items: [
      { id: enchantScrollIdForGrade("armor", "common"), quantity: 1 },
      { id: "arena-coin", quantity: 1 }
    ],
    classGear: [{ grade: "rare", slot: "weapon" }]
  },
  {
    id: "oldmill-brook-bandits",
    label: "Old Mill Trouble",
    requirement: { kind: "monster", archetype: "bandit", count: 10 },
    gold: 320,
    items: [
      { id: enchantScrollIdForGrade("armor", "common"), quantity: 1 },
      { id: "greater-hp-potion", quantity: 2 }
    ]
  },
  {
    id: "bonefall-skeletons",
    label: "Bonefall Cemetery",
    requirement: { kind: "monster", archetype: "skeleton", count: 12 },
    gold: 520,
    items: [
      { id: enchantScrollIdForGrade("weapon", "common"), quantity: 1 },
      { id: "arena-coin", quantity: 1 }
    ]
  },
  {
    id: "reach-level-8",
    label: "Gear Check",
    requirement: { kind: "level", level: 8 },
    gold: 650,
    classGear: [{ grade: "rare", slot: "chest" }]
  },
  {
    id: "sunspire-spiders",
    label: "Sunspire Stingers",
    requirement: { kind: "monster", archetype: "spider", count: 18 },
    gold: 900,
    items: [{ id: enchantScrollIdForGrade("weapon", "rare"), quantity: 1 }]
  },
  {
    id: "riverbend-stalker",
    label: "Riverbend Stalker",
    requirement: { kind: "monster", archetype: "miniboss", count: 2 },
    gold: 1100,
    items: [
      { id: enchantScrollIdForGrade("armor", "rare"), quantity: 1 },
      { id: "arena-coin", quantity: 2 }
    ]
  },
  {
    id: "blood-ring-first-win",
    label: "Blood Ring First Win",
    requirement: { kind: "arenaWins", count: 1 },
    gold: 700,
    items: [{ id: "pvp-coin", quantity: 1 }]
  },
  {
    id: "moonfen-wraiths",
    label: "Moonfen Shadows",
    requirement: { kind: "monster", archetype: "wraith", count: 18 },
    gold: 1600,
    items: [{ id: enchantScrollIdForGrade("armor", "rare"), quantity: 1 }],
    classGear: [{ grade: "epic", slot: "weapon" }]
  }
];
const MONSTER_DENSITY = 0.42;
const STARTER_WOLF_COUNT = 9;
const SOCIAL_INVITE_TTL_MS = 45_000;
const SOCIAL_INVITE_RANGE = 1400;
const DUEL_INVITE_RANGE = 1800;
const PVP_FLAG_MS = 35_000;
const PVP_FLAG_POST_KILL_MS = 16_000;
const PLAYER_COMBAT_MS = 120_000;
const MONSTER_WANDER_MIN_PAUSE_MS = 420;
const MONSTER_WANDER_MAX_PAUSE_MS = 1150;
const MONSTER_WANDER_MIN_MOVE_MS = 1300;
const MONSTER_WANDER_MAX_MOVE_MS = 3200;
const MONSTER_WANDER_SPEED_MULTIPLIER = 0.4;
const MONSTER_REMOTE_SLEEP_RANGE = 2600;
const MONSTER_REMOTE_SLEEP_TICKS = 5;
const MONSTER_TARGET_SCAN_TICKS = 3;
const MONSTER_SAFE_TARGET_BUFFER = 180;
const MONSTER_RETALIATE_SAFE_BUFFER = 42;
const MONSTER_SAFE_MOVE_BUFFER = 90;
const MONSTER_SAFE_IDLE_BUFFER = 260;
const DEFAULT_BOT_COUNT = 64;
const MAX_CONFIGURED_BOTS = 160;
const MARKET_CITY_ID = "market";
const MARKET_VENDOR_BOT_COUNT = 10;
const MARKET_VENDOR_RADIUS = 520;
const MARKET_PLAYER_LIST_RADIUS = 980;
const MARKET_BUY_RANGE = 430;
const MARKET_MAX_LISTINGS = 12;
const MARKET_MAX_PRICE_GOLD = 9_999_999;
const TRADE_INVITE_RANGE = 620;
const TRADE_SESSION_TTL_MS = 120_000;
const TRADE_MAX_ITEMS_PER_SIDE = 12;
const BOT_THINK_MIN_MS = 950;
const BOT_THINK_MAX_MS = 2400;
const BOT_COMBAT_THINK_MIN_MS = 140;
const BOT_COMBAT_THINK_MAX_MS = 340;
const BOT_RESPAWN_MIN_MS = 14000;
const BOT_RESPAWN_MAX_MS = 32000;
const BOT_MONSTER_SCAN_RANGE = 1280;
const BOT_PVP_SCAN_RANGE = 1150;
const BOT_ARENA_PVP_SCAN_RANGE = 1450;
const BOT_LOOT_SCAN_RANGE = 1800;
const BOT_REVIVE_SCAN_RANGE = 620;
const BOT_REVIVE_RANGE = 115;
const BOT_CHILL_MIN_MS = 6500;
const BOT_CHILL_MAX_MS = 32_000;
const BOT_CHAT_MIN_MS = 180_000;
const BOT_CHAT_MAX_MS = 540_000;
const BOT_CHAT_RETRY_MIN_MS = 45_000;
const BOT_CHAT_RETRY_MAX_MS = 120_000;
const BOT_CHAT_GLOBAL_MIN_MS = 8_500;
const BOT_IMPORTANT_CHAT_GLOBAL_MIN_MS = 4_500;
const BOT_WIDE_CHAT_GLOBAL_MIN_MS = 28_000;
const BOT_SESSION_MIN_MS = 52 * 60_000;
const BOT_SESSION_MAX_MS = 2.6 * 60 * 60_000;
const BOT_OFFLINE_MIN_MS = 4 * 60_000;
const BOT_OFFLINE_MAX_MS = 58 * 60_000;
const BOT_LOW_LEVEL_VISIBLE_COUNT = 6;
const BOT_XP_MULTIPLIER = 1;
const BOT_HARD_LEVEL_CAP = Number(process.env.GAME_BOT_HARD_LEVEL_CAP ?? 96);
const PVP_DAMAGE_MULTIPLIER = 0.88;
const PVP_SKILL_DAMAGE_MULTIPLIER = 0.94;
const PVP_ARENA_DAMAGE_MULTIPLIER = 1.18;
const PVP_ARENA_CP_ABSORB_REDUCTION = 0.08;
const PVP_MAGE_VS_TANK_DAMAGE_BONUS = 1.16;
const PVP_ARCHER_VS_MAGE_ATTACK_MULTIPLIER = 0.76;
const PVP_ARCHER_VS_MAGE_SKILL_MULTIPLIER = 0.82;
const PVP_ARCHER_VS_MAGE_CP_ABSORB_BONUS = 0.1;
const PVP_CP_REGEN_COMBAT_LOCK_MS = 12_000;
const PVP_XP_PAIR_COOLDOWN_MS = 15 * 60_000;
const PVP_XP_TARGET_LOCK_MS = 90_000;
const BOT_START_CHILL_MIN_MS = 2_500;
const BOT_START_CHILL_MAX_MS = 52_000;
const BOT_TARGET_CROWD_PENALTY = 520;
const BOT_PVP_TARGET_CROWD_PENALTY = 860;
const BOT_MELEE_SEPARATION_RADIUS = 176;
const BOT_RANGED_SEPARATION_RADIUS = 238;
const BOT_ARENA_ACTIVE_SOFT_CAP = Number(process.env.GAME_BOT_ARENA_SOFT_CAP ?? 16);
const BOT_ARENA_ACTIVE_HARD_CAP = Number(process.env.GAME_BOT_ARENA_HARD_CAP ?? 24);
const BOT_ARENA_MIN_ACTIVE = Number(process.env.GAME_BOT_ARENA_MIN_ACTIVE ?? 4);
const BOT_ARENA_TARGET_RATIO = Number(process.env.GAME_BOT_ARENA_TARGET_RATIO ?? 0.2);
const BOT_ARENA_FIGHT_RATIO = Math.max(0, Math.min(1, Number(process.env.GAME_BOT_ARENA_FIGHT_RATIO ?? 0.72)));
const BOT_ARENA_HUB_CITY_ID = "sunspire";
const BOT_ARENA_HUB_RADIUS = 1600;
const BOT_ARENA_HUB_MIN_BOTS = 0;
const BOT_ARENA_HUB_SOFT_CAP = 2;
const BOT_ARENA_HUB_HARD_CAP = 4;
const BOT_ARENA_BOT_TARGET_MELEE_CAP = 1;
const BOT_ARENA_BOT_TARGET_RANGED_CAP = 2;
const BOT_ARENA_HUMAN_TARGET_MELEE_CAP = 3;
const BOT_ARENA_HUMAN_TARGET_RANGED_CAP = 5;
const BOT_POPULATION_RECHECK_MS = 35_000;
const BOT_NORMAL_MOVE_PACE = 0.62;
const BOT_SPRINT_MOVE_PACE = 0.74;
const BOT_DASH_MOVE_PACE = 0.74;
const BOT_RANGED_MOVEMENT_SCALE = 0.86;
const BOT_MELEE_MOVEMENT_SCALE = 0.9;
const BOT_TANK_MOVEMENT_SCALE = 0.94;
const SNAPSHOT_PLAYER_RADIUS = Number(process.env.GAME_SNAPSHOT_PLAYER_RADIUS ?? 4200);
const SNAPSHOT_MONSTER_RADIUS = Number(process.env.GAME_SNAPSHOT_MONSTER_RADIUS ?? 1600);
const SNAPSHOT_RESOURCE_RADIUS = Number(process.env.GAME_SNAPSHOT_RESOURCE_RADIUS ?? 1300);
const SNAPSHOT_GROUND_ITEM_RADIUS = Number(process.env.GAME_SNAPSHOT_GROUND_ITEM_RADIUS ?? 1150);
// Keep loot pickup close to the character. The client requests at 120px; the
// small server margin absorbs snapshot/VPN jitter without allowing remote loot.
const GROUND_ITEM_PICKUP_RANGE = 140;
// Portal interaction must be measured from the visible portal, not from the
// landmark's much larger gameplay-zone radius.
const DUNGEON_PORTAL_USE_RANGE = 320;
const BOT_DUNGEON_PORTAL_USE_RANGE = 120;
const DUNGEON_ENTRANCE_Y_OFFSET = 56;
const GROUND_ITEM_TTL_MS = 2 * 60_000;
const RARE_GROUND_ITEM_TTL_MS = 3 * 60_000;
const PVP_GROUND_DROP_TTL_MS = 2 * 60_000;
const PVP_COIN_ITEM_ID = "pvp-coin";
const MAX_GROUND_ITEMS = Math.max(80, Math.min(600, Math.trunc(Number(process.env.GAME_MAX_GROUND_ITEMS ?? 180) || 180)));
const ARENA_SEASON_DAYS = 14;
const ROAD_CLEAR_RADIUS = 330;
const ROAD_PLAYER_SAFE_RADIUS = 440;
const CHEST_COUNT = 22;
const CHEST_RESPAWN_MIN_MS = 4 * 60_000;
const CHEST_RESPAWN_MAX_MS = 11 * 60_000;
const STARTER_ARENA = WORLD_STARTER_ARENA;
const ARENA_RESPAWN_CITY_ID = "oldmill";
const STARTER_ARENA_MONSTER_BUFFER = 260;
const STARTER_ARENA_MONSTER_SAFE_RADIUS = STARTER_ARENA.radius + STARTER_ARENA_MONSTER_BUFFER;
const PLAYER_OBSTACLE_RADIUS = 34;
const PLAYER_JUMP_HAZARD_MS = 430;
const HAZARD_DAMAGE_COOLDOWN_MS = 900;
const HAZARD_ORB_COUNT = 4;
type BotHuntingGround = (typeof WORLD_HUNTING_GROUNDS)[number] & {
  dungeonId?: string;
  landmarkId?: string;
  start?: Vector2;
  end?: Vector2;
  width?: number;
  height?: number;
};
const BESTIARY_CAVERN_ROSTER: readonly {
  packId: MonsterSpritePackId;
  archetype: MonsterArchetype;
  offset: Vector2;
  level: number;
}[] = [
  { packId: 1, archetype: "wraith", offset: { x: -50, y: 180 }, level: 1 },
  { packId: 2, archetype: "sentinel", offset: { x: -300, y: -160 }, level: 1 },
  { packId: 3, archetype: "bat", offset: { x: 200, y: 330 }, level: 2 },
  { packId: 4, archetype: "dragon", offset: { x: 0, y: -260 }, level: 2 },
  { packId: 5, archetype: "eye", offset: { x: 430, y: 270 }, level: 3 },
  { packId: 6, archetype: "boar", offset: { x: 260, y: -100 }, level: 3 },
  { packId: 7, archetype: "golem", offset: { x: 560, y: 100 }, level: 4 },
  { packId: 8, archetype: "drake", offset: { x: 470, y: -300 }, level: 4 },
  { packId: 9, archetype: "spider", offset: { x: 700, y: -40 }, level: 5 },
  { packId: 10, archetype: "dungeonboss", offset: { x: 780, y: -520 }, level: 6 }
];
const BOT_DUNGEON_HUNTING_GROUNDS: readonly BotHuntingGround[] = WORLD_DUNGEON_INTERIORS.filter(
  (dungeon) => dungeon.id !== BESTIARY_CAVERN_DUNGEON_ID
).map((dungeon) => ({
  id: `dungeon-${dungeon.id}`,
  label: dungeon.label,
  level: dungeon.recommendedLevel,
  position: dungeon.position,
  radius: Math.max(560, Math.round(Math.min(dungeon.width, dungeon.height) * 0.46)),
  archetypes: dungeon.archetypes,
  dungeonId: dungeon.id,
  landmarkId: dungeon.landmarkId,
  start: dungeon.start,
  end: dungeon.end,
  width: dungeon.width,
  height: dungeon.height
}));
const BOT_HUNTING_GROUNDS: readonly BotHuntingGround[] = [...WORLD_HUNTING_GROUNDS, ...BOT_DUNGEON_HUNTING_GROUNDS];
const STARTER_SAFE_SPAWN_POINTS: readonly Vector2[] = [
  { x: 1360, y: 2520 },
  { x: 1500, y: 2800 },
  { x: 1780, y: 3100 },
  { x: 2100, y: 3180 },
  { x: 2340, y: 2840 },
  { x: 1840, y: 2380 }
];

const BOT_CHAT_LINES = [
  "кто на волков? я рядом",
  "у меня пинг скачет, но жить можно",
  "ща хилку выбью и дальше",
  "не трогайте в городе, я мирный",
  "видел сундук у дороги, но меня отвлекли",
  "лута мало, но кач норм",
  "пойду до города, кто со мной?",
  "мобов тут быстро разбирают",
  "если кто в пати собирает, зовите",
  "я на минуту афк у костра",
  "нужен хил, но танк тоже сойдет",
  "криты сегодня какие-то злые",
  "фармлю до апа и в город",
  "тут живые есть?",
  "не бейте новичков, ну камон",
  "ладно, еще один заход",
  "щас ману добью и в город",
  "кто видел торговца у моста?",
  "у меня почти ап, не трогайте моба",
  "я тут просто квест делаю",
  "лагнуло немного, стою",
  "надо броню чинить, больно бьют",
  "пойду вокруг поля, тут тесно",
  "кто в пати на скелетов?",
  "тут респ нормальный, можно жить",
  "сек, сумку разбираю",
  "я без пк, если что",
  "что-то волки сегодня злые",
  "после апа в город и обратно",
  "не ведите мобов в толпу",
  "я на автоатаках не сижу, руками бью",
  "ща отойду от дороги",
  "вижу босса, но рано мне туда",
  "кому банки хп падали?",
  "лучник рядом норм дамажит",
  "мне бы еще один свиток",
  "на минуту афк, не сливайте",
  "пойду другой спот проверю",
  "мобы быстро кончаются",
  "осторожно, тут моб больно критует",
  "я пока без пати, но могу помочь",
  "у кого-нибудь есть лишняя банка?",
  "ща добью этого и отойду",
  "не могу таргет поймать, мелкие бегают",
  "в городе безопасно, но скучно",
  "я тут кругами не бегаю, просто спот ищу",
  "кто-нибудь ходил к големам?",
  "надо бы новый лук купить",
  "после рестарта стало бодрее",
  "я моба случайно увел, сорян",
  "держу этот угол, тут норм респ",
  "урон вроде вырос после апа",
  "все, передохну пару сек",
  "магам тут легко, завидую",
  "ассасины слишком быстрые, честно",
  "у меня сумка забита хламом",
  "кто мешает споту, того просим отойти",
  "не стойте в мобах, больно будет",
  "я на соседний пак перехожу",
  "тут кто-то фармил до меня",
  "ищу нормальный спот без толпы",
  "в чат писать опаснее чем мобов бить",
  "я не бот, я просто молча качался",
  "надо проверить другую дорогу",
  "на босса пока рано, не пойду",
  "мне бы еще пару уровней",
  "если что, я рядом с дорогой",
  "сейчас докачаюсь и сменю класс, шучу",
  "что-то сегодня много народу",
  "я случайно скилл прожал",
  "пока тихо, можно фармить",
  "видел сундук? или показалось",
  "пойду продам мусор позже",
  "в этой локе красиво, но мобы злые",
  "кто-нибудь рес умеет? на всякий",
  "у меня банки кончаются",
  "пойду чуть правее, тут толпа",
  "если что я не стилю, просто рядом стою",
  "сейчас бы нормальный дроп",
  "вижу лучника, лучше не мешать",
  "я после этого пака в город",
  "кто-нибудь тестил новый скилл?",
  "тут мобов будто меньше стало",
  "я на минуту чат читаю",
  "не агрите лишних, я тонкий",
  "народу сегодня много, странно",
  "мне нравится этот спот",
  "добью лвл и пойду спать",
  "вроде норм место для старта",
  "я случайно не туда побежал",
  "если упаду, ресните по-братски",
  "что-то критануло приятно",
  "тут кто-то рядом качается?",
  "я без злого умысла, просто фарм",
  "хD",
  "ахахах",
  "блин, опять промах",
  "аааааа, не туда нажал",
  "чисто стою думаю",
  "сек, чай",
  "я в город на минуту",
  "что за суета тут",
  "вроде норм, но странно",
  "сейчас бы без лагов",
  "нашел тихий угол",
  "тут лучше не спешить",
  "я пока без пати",
  "вроде дорога теперь спокойнее",
  "кто-то сундук забрал уже?",
  "мне бы пару банок купить",
  "не люблю пауков, мелкие противные",
  "сейчас поменяю спот",
  "ой, не туда прожал",
  "пару мобов и передышка",
  "хочу на арену, но страшно",
  "у костра кто-нибудь стоит?",
  "сегодня кач идет медленно",
  "с мобами аккуратнее, они цепляются",
  "я просто мимо проходил",
  "если что я на дороге",
  "надо шмот обновить",
  "пинг норм, можно жить",
  "на этом уровне больно",
  "сейчас зайду с другой стороны",
  "вроде никого не задел",
  "пойду по кругу проверю",
  "не собирайте весь пак",
  "на арене опять шум?",
  "дайте спокойно добить",
  "я пока банки экономлю",
  "пережду кулдаун и дальше",
  "этот моб жестче чем выглядит",
  "почти добил, не трогай",
  "сейчас сменю угол",
  "на следующем респе постою",
  "надо цель ближе брать",
  "после этого моба отойду",
  "что-то много промахов",
  "я не спешу, но кач идет",
  "тут лучше по одному бить",
  "стою на краю спота",
  "проверю респ выше",
  "мана просела, секунду",
  "хилка на кд, аккуратно",
  "сейчас доберу опыт и уйду",
  "вроде норм пачка",
  "не хочу лишних агрить",
  "тут респ живой",
  "пойду к следующему после этого",
  "еще пару ударов и готово",
  "ресурсы потом торговцу солью",
  "хлам в сумке копится быстро",
  "надо бы в город продать дроп",
  "после пачки проверю инвентарь",
  "не понял куда побежал, бывает",
  "тут лучше держать дистанцию",
  "я не стою афк, я думаю",
  "сейчас цель обновлю и дальше",
  "мне бы нормальный крит сейчас",
  "чуть-чуть до апа осталось",
  "кто рядом бегает, не мешайте",
  "на дороге спокойнее стало",
  "пойду через костер, заодно продам",
  "если сундук увидите, зовите",
  "сегодня спот какой-то шумный",
  "я пока без приключений",
  "мобы на меня странно смотрят",
  "держу ману, не спамлю",
  "после этого в город на минуту",
  "хочу пуху получше, эта слабая",
  "кто в данж позже?",
  "видел телепорт на босса, но рано",
  "ладно, еще круг по споту",
  "главное не умереть с полным инвентарем",
  "проверю соседний респ",
  "вроде тут стало посвободнее",
  "не хочу случайно флагнуться",
  "сейчас продам шкуры и вернусь",
  "мне бы банки на панель поставить",
  "с мобами лучше без толпы",
  "вижу игрока рядом, не мешаю",
  "если моб на тебе, добью аккуратно",
  "иду по краю, там меньше агра",
  "на миникарте движ какой-то",
  "перекину цель, эта уже занята",
  "лучше добивать по одному, чем собирать паровоз",
  "у дороги безопаснее отходить на реген",
  "сейчас проверю, не висит ли красный рядом",
  "не забывайте банки, тут больно влетает",
  "если кто упал рядом, попробую реснуть",
  "сначала хп подниму, потом дальше",
  "моб на лоу, не переключайтесь",
  "я к воде не полезу, там клинит иногда",
  "на мосту осторожнее, толпа мешает",
  "вижу чужой таргет, лучше возьму соседнего",
  "кто без пати, держитесь ближе к дороге",
  "если красный придет, пишите в чат",
  "проверяю спот по кругу",
  "мне нравится когда без суеты",
  "добью пак и сменю сторону",
  "в этот раз беру цель справа",
  "сейчас откайчу, не стойте в мобе",
  "похоже тут уже кто-то фармит",
  "не хочу уводить чужого моба",
  "держу дистанцию, я не танк",
  "пока все спокойно, можно качаться",
  "пойду через ближайший город закуплюсь",
  "если будет пк, отойду к стражам",
  "на этом уровне уже нужен норм шмот",
  "сейчас проверю следующий респ"
];

const BOT_LOW_HP_ACTIVITY_LINES = [
  "хп {hp}%, отхожу к {area}",
  "слишком больно вышло, беру дистанцию",
  "без банки дальше не полезу",
  "мне бы пару секунд отрегениться",
  "отвожу бой от дороги, хп мало",
  "хп {hp}%, не лезу глубже",
  "сначала реген, потом геройство",
  "банка на кд, лучше отступлю",
  "чуть не словил крит, ухожу к {area}",
  "если меня добьют, ресните рядом",
  "хп просело, не геройствую",
  "откатаюсь за камень и вернусь",
  "сейчас не время жадничать",
  "моб больно попал, беру паузу",
  "доживу до банки и продолжу",
  "лучше потерять моба, чем весь лут",
  "на красной полоске не дерусь",
  "хилку жму, секунду не трогайте"
];

const BOT_MONSTER_ACTIVITY_LINES = [
  "добиваю {monster} у {area}",
  "{monster} держит больно, но почти упал",
  "фармлю {monster}, не забирайте таргет",
  "если выпадет койн, заберу и уйду",
  "на этом споте {monster} быстро ресается",
  "{monster} на мне, помогайте если рядом",
  "беру {monster} сбоку, чтобы не тащить в толпу",
  "{monster} уже просел, не переключаюсь",
  "лучше бить {monster} по одному",
  "держу {monster}, но хп проверяйте",
  "{monster} зацепился, отвожу от дороги",
  "сейчас доберу {monster} и проверю дроп",
  "{monster} слишком бодрый для своего уровня",
  "не подрезайте, {monster} уже почти мой",
  "беру следующего {monster} после регена",
  "{monster} нормально дает опыт",
  "держу дистанцию от {monster}",
  "если {monster} реснется рядом, беру его"
];

const BOT_TRAVEL_ACTIVITY_LINES = [
  "иду через {area}, проверю следующий спот",
  "сдвигаюсь к {area}, тут стало тесно",
  "пробегаю мимо, не агрюсь",
  "пойду вдоль дороги, там спокойнее",
  "меняю спот, тут уже пусто",
  "иду к {area}, там вроде меньше людей",
  "обойду через дорогу, так безопаснее",
  "сначала закуп, потом обратно на фарм",
  "перехожу на соседний респ",
  "не телепорт, просто бегу долго",
  "обойду воду, там путь ровнее",
  "иду через низ карты, посмотрю сундуки",
  "срезаю к дороге, так меньше агра",
  "меняю маршрут, тут все выбито",
  "дойду до костра и решу куда дальше",
  "проверю, живой ли спот за мостом",
  "иду не за вами, просто маршрут совпал",
  "до города недалеко, заодно продам"
];

const BOT_ARENA_ACTIVITY_LINES = [
  "держу край арены, в центр пока рано",
  "вижу бой в центре, зайду сбоку",
  "после реса вернулся в круг",
  "на арене сейчас тесно, беру угол",
  "жду флагнутого у входа",
  "не влетаю в толпу, беру один таргет",
  "центр горячий, зайду через край",
  "если двое на одного, я отойду",
  "смотрю кд и только потом влетаю",
  "на арене без мобов сразу честнее",
  "держу вход, в центр пока не лезу",
  "беру цель без толпы, так честнее",
  "после банки попробую второй заход",
  "у края проще не потерять таргет",
  "сейчас зайду, только кд проверю",
  "если центр пустой, забираю позицию",
  "не догоняю, держу свой угол",
  "вижу флаг, но сначала дистанция"
];

const BOT_PVP_ACTIVITY_LINES = [
  "вижу {target}, беру дистанцию",
  "{target}, без обид, ты сам флагнутый",
  "перехожу на {target}, слишком близко подошел",
  "{target}, не прячься за мобами",
  "цель {target}, пробую зайти сбоку",
  "{target}, я тебя вижу, не кайти далеко",
  "держу {target}, не мешайте мобами",
  "{target} просел, но я без жадности",
  "сначала {target}, потом добью моба",
  "{target}, норм размен, продолжаем",
  "{target}, вижу кд, сейчас зайду",
  "{target}, не веди меня к стражам",
  "держу {target} на краю экрана",
  "{target}, хорошая попытка кайта",
  "{target}, от мобов отойдем и честно",
  "беру {target}, пока он флагнутый",
  "{target}, второй раунд?",
  "{target}, не стой в луже"
];

const BOT_TOWN_CHAT_LINES = [
  "хD",
  "ахахах",
  "блин",
  "аааааа",
  "чисто чилю",
  "сек, сумку смотрю",
  "кто у костра?",
  "я тут пару минут",
  "пойду на арену может",
  "город сегодня шумный",
  "продал мусор, живем",
  "ща банки куплю",
  "кто в пати после города?",
  "ахах, красиво залетел",
  "пинг отпустил вроде",
  "ну все, передохнул",
  "смотрю чат",
  "залип на месте",
  "ща вернусь",
  "кто прыгал тут?",
  "ну и суета",
  "я без дела стою",
  "может на арену сходить",
  "просто отдыхаю",
  "продаю мусор, секунду",
  "инвентарь забился опять",
  "у торговца цены так себе",
  "кто к телепорту?",
  "проверю шмот и выйду",
  "город норм, но скучно",
  "стою у костра, не дергайте",
  "ща чай допью",
  "вроде все продал",
  "надо банки докупить",
  "кто на арену после закупа?",
  "афк на полминуты",
  "зачем я это подобрал вообще",
  "ладно, сумка чистая",
  "сейчас закуплюсь и обратно на спот",
  "у кого телепорт открыт дальше?",
  "проверяю шмот перед выходом",
  "в городе тихо, зато безопасно",
  "пару банок взял, можно идти",
  "кто видел красного у ворот?",
  "сейчас разберу дроп и побегу",
  "у костра реально удобно афкать",
  "после города на соседний респ",
  "чуть передохнул, погнали дальше",
  "проверяю рынок, вдруг повезет",
  "сумку почистил, места снова ноль",
  "у костра чат быстрее читается",
  "кто на закуп, я у торговца",
  "пару минут стою, потом обратно",
  "нашел старый дроп в сумке",
  "город шумный, но зато без мобов",
  "сейчас шмот гляну и выйду"
];

const BOT_GEAR_CHAT_LINES = [
  "взял {weapon}, теперь можно жить",
  "точнул пуху до +{enchant}, смотрится норм",
  "{grade} шмот сел красиво",
  "обновил сет, теперь не стыдно выйти",
  "ну все, я красивый",
  "посмотрите на пуху, прям кайф",
  "купил новый сет, старый был совсем печальный",
  "шмот апнул, можно идти дальше",
  "плюсанул оружие, теперь проверим урон",
  "в городе закупился, погнали",
  "сет теперь выглядит дорого",
  "наконец-то норм броня",
  "кто сказал, что я без шмота?",
  "пуха светится, значит работает",
  "вот теперь персонаж похож на персонажа",
  "новая броня прям вайб",
  "заточка зашла, не зря копил",
  "с таким сетом уже можно на арену",
  "я не хвастаюсь, но {weapon} красивый",
  "ну как вам мой новый вид?",
  "старую пуху продам, эта лучше",
  "броня наконец не бумажная",
  "{weapon} выглядит дороже чем стоил",
  "плюс {enchant} держится, можно фармить",
  "после апгрейда мобы падают быстрее",
  "сет собрал криво, но работает",
  "сейчас проверю новый урон на споте",
  "шмот обновил, теперь главное не слиться"
];

const BOT_RED_ALERT_CHAT_LINES = [
  "{name} красный рядом с {area}",
  "вижу красного {name} у {area}",
  "осторожно, {name} красный возле {area}",
  "красный у {area}, не афкайте",
  "{name} с кармой рядом, смотрите",
  "пк рядом с {area}, держитесь кучнее",
  "у {area} красный, лучше не стоять афк",
  "красного вижу около {area}",
  "{name} рядом, не ведите мобов",
  "красный {name} двигается к {area}",
  "у {area} лучше держать дистанцию",
  "{name} с кармой, смотрите по сторонам",
  "пк замечен, банки на панель",
  "если видите {name}, не афкайте"
];

const BOT_PVP_CHAT_LINES = [
  "кто первый ударил?",
  "ну все, теперь деремся",
  "не убегай, дуэль так дуэль",
  "я запомнил этот ник",
  "красный рядом, аккуратнее",
  "пк режим, сорян",
  "сейчас проверим шмот",
  "нормально дерешься",
  "не лезь в мой моб",
  "я предупредил",
  "если красный, значит цель",
  "проверка реакции",
  "отошел бы от спота",
  "без обид, пвп зона",
  "ты сам начал",
  "ну давай один на один",
  "я не добиваю у города",
  "слишком близко подошел",
  "сейчас откачусь и вернусь",
  "не бей в спину, я видел",
  "это уже личное",
  "от моба отойди, потом деремся",
  "я не красный, но могу стать",
  "зря ты меня тронул",
  "если сольешь, сам виноват",
  "проверим твой урон",
  "пк включил, не подходи",
  "давай без толпы",
  "в город не убегай",
  "ты моба забрал, теперь отвечай",
  "я предупреждал про спот",
  "хватит кайтить",
  "неожиданно больно бьешь",
  "норм пвп, уважаю",
  "сейчас будет весело",
  "на банках не вывезешь",
  "я видел, кто начал",
  "ну давай без мобов хотя бы",
  "жестко залетел",
  "окей, принимаю бой",
  "только без толпы за спиной",
  "хороший урон, спору нет",
  "еще рано меня списывать",
  "сейчас перезайду по позиции",
  "я не убегаю, я кайчу",
  "на этом споте свои правила",
  "подожди, я цель поймал",
  "ты слишком близко подошел",
  "ну все, без обид",
  "вышел из мобов, теперь можно",
  "не дергайся, я вижу",
  "нормально нажимаешь",
  "сейчас кд пройдет",
  "зря ты сюда зашел",
  "на арене бы так",
  "я не хотел, но ладно",
  "вижу твой каст",
  "отхожу, не убегаю",
  "хороший заход",
  "давай без реса в спину",
  "не стой на месте",
  "сейчас будет второй раунд",
  "попал больно, признаю",
  "ты меня вынудил",
  "ладно, играем",
  "пвп так пвп",
  "цель поймал, теперь не отпущу",
  "сейчас посмотрим кто тоньше",
  "не прячься за мобами",
  "хорошо зашел, признаю",
  "второй раунд будет жестче",
  "у тебя кд или что?",
  "я банку прожал, живем",
  "больно, но терпимо",
  "давай без беготни по всей карте",
  "ты сам в круг зашел",
  "я не злой, просто флаг увидел",
  "держи дистанцию, если сможешь",
  "сейчас разменяемся нормально",
  "ну все, играю серьезно",
  "если сольешь, не обижайся",
  "не стой на линии удара",
  "я сейчас зайду сбоку",
  "вижу флаг, значит можно",
  "без паники, это просто размен",
  "ты хорошо держишь дистанцию",
  "сейчас попробую другой угол",
  "я кд отдал, твой ход",
  "на секунду потерял таргет",
  "ок, этот раунд за тобой",
  "не ожидал такой прокаст",
  "держу угол, не подходи бесплатно",
  "сейчас не дам сбросить флаг",
  "вижу банку, значит продолжаем",
  "ты хорошо вышел из мобов",
  "на дороге деремся аккуратнее",
  "я не жму все сразу, жду момент",
  "если кд вернется, будет больно",
  "переиграем без лишних свидетелей",
  "мне нравится этот размен",
  "сейчас попробую через рывок"
];

const BOT_ARENA_CHAT_LINES = [
  "иду на арену, посмотрим кто там живой",
  "кто на арене? залетайте",
  "сейчас в круге проверим урон",
  "на арене без обид",
  "пойду в центр, там веселее",
  "кто хочет 1х1, я в арене",
  "арена свободная или опять толпа?",
  "забор красивый, осталось не умереть",
  "сейчас пару раундов и назад кач",
  "держите центр, я подхожу",
  "на арене сегодня жарко",
  "го короткий бой без мобов",
  "проверю новый шмот в круге",
  "кто тут главный по арене?",
  "ладно, один бой и спать",
  "иду за фаном, не за кармой",
  "встал в левый круг, жду",
  "кто держит центр?",
  "после закупа сразу в арену",
  "тут хоть мобы не мешают",
  "давайте без толпы на одного",
  "я справа у забора",
  "сейчас будет короткий раунд",
  "арена норм получилась",
  "кто красный, заходи сюда",
  "проверю крит по живому",
  "если упаду, ресните потом",
  "один бой и обратно на кач",
  "в центре опасно, но весело",
  "жду соперника у костра",
  "давайте честно, без добива у выхода",
  "зайду через нижний вход",
  "в центре пусто, иду туда",
  "кто держит правую сторону?",
  "сейчас подтянусь к кругу",
  "поставлюсь ближе к центру",
  "посмотрим кто тут живой",
  "без толпы, но с движем",
  "я у внутреннего круга",
  "сейчас разогреюсь на одном бою",
  "арена проснулась, нормально",
  "беру правый край, там чище",
  "кто без пати, заходите по одному",
  "после этого боя вернусь на кач",
  "в центре много тел, зайду позже",
  "арена сегодня не пустует",
  "сейчас проверю блок на живом",
  "если упал, без токсичности",
  "вышел в круг, жду цель",
  "красивый бой, хочу еще",
  "подхожу снизу, не пугайтесь"
];

const BOT_ARENA_WATCH_CHAT_LINES = [
  "зайду на арену посмотреть",
  "пока просто смотрю бои",
  "встану у забора, понаблюдаю",
  "если будет равный, выйду в круг",
  "сначала посмотрю кто дерется",
  "я пока зритель",
  "тут движ, но я не лезу",
  "посмотрю пару раундов",
  "кто красиво дерется?",
  "если красный зайдет, тогда включусь",
  "стою сбоку, не бейте",
  "арена без мобов, хоть спокойно",
  "подожду норм соперника",
  "сейчас просто смотрю",
  "жду пока центр освободится",
  "если бой будет равный, зайду",
  "смотрю кто сильнее сегодня",
  "пока не лезу, но рядом",
  "сейчас просто оценю шмот у ребят",
  "не хочу мешать честному бою",
  "постою на краю, таргеты не трогаю",
  "жду победителя, потом зайду",
  "в центре красиво, но опасно",
  "смотрю, кто банками живет",
  "если будет толпа, уйду фармить",
  "пока зрительский режим"
];

const BOT_RETURN_CHAT_LINES = [
  "я вернулся",
  "так, что тут пропустил?",
  "снова в игре",
  "пинг вроде отпустил",
  "пошел качаться сначала",
  "перезашел, вроде норм",
  "меня выкинуло, бывает",
  "снова тут",
  "продолжаю кач",
  "вернулся на свой спот",
  "так, где мои мобы",
  "инет отпустил",
  "пару минут пропал",
  "пошел дальше",
  "ну что, продолжим",
  "пока меня не было, тут движ",
  "снова живой, уже неплохо",
  "надо аккуратнее теперь",
  "реснулся и обратно",
  "пойду по-тише, без геройства",
  "вернулся, сумка вроде на месте",
  "снова онлайн, кто где фармит?",
  "пока грузился, все уже убежали",
  "проверю старый спот еще раз",
  "после перезахода стало ровнее",
  "ладно, продолжаю маршрут",
  "сначала до города, потом обратно",
  "я снова тут, без паники"
];

const BOT_PK_DEATH_CHAT_LINES = [
  "{killer}, ну ты и пкшник",
  "да иди ты в жопу с таким пк",
  "серьезно? я даже не флагнут был",
  "ты дебил что ли, я моба бил",
  "крыса, конечно красиво подловил",
  "ну все, ник запомнил",
  "пкшники опять вылезли",
  "да чтоб тебя мобы догрызли",
  "я без флага был, герой нашелся",
  "ну спасибо, кач сбил",
  "иди дальше новичков бей",
  "я тебе это припомню",
  "вот это крысиный заход",
  "ладно, встретимся еще",
  "ну и зачем было добивать?",
  "ты прям гордишься этим?",
  "пк ради копеек, серьезно?",
  "фу, грязно сыграл",
  "давай-давай, карму собирай",
  "ну ты и душный",
  "{killer}, ты норм вообще?",
  "я моба бил, зачем влетать?",
  "ну красавец, нашел момент",
  "пк на лоу споте, сильно",
  "минус кач из-за тебя",
  "я даже не успел банку нажать",
  "все, теперь буду смотреть по сторонам",
  "ты прям охотник на афк",
  "приятно, да? по мобу добивать",
  "ладно, карма сама тебя найдет",
  "я это запомнил, серьезно",
  "давай потом без мобов попробуешь",
  "ну и подстава",
  "ты мне спот сломал",
  "у тебя совесть на кд?",
  "прям герой дороги",
  "я вернусь, не расслабляйся",
  "ну спасибо за минус опыт",
  "какой же душный заход",
  "пкшить новичков много ума не надо"
];

const BOT_PVP_DEATH_CHAT_LINES = [
  "норм файт",
  "хорошо дал, уважаю",
  "чуть-чуть не хватило",
  "еще увидимся",
  "окей, ты сильнее",
  "красава, честно",
  "надо было раньше банку жать",
  "я плохо зашел",
  "следующий раунд мой",
  "хороший бой",
  "не ожидал такой урон",
  "ладно, заслуженно",
  "я вернусь сильнее",
  "на этот раз твоя",
  "жестко, но честно",
  "с таким пингом не вывез",
  "почти забрал тебя",
  "увидимся на споте",
  "норм, я сам ошибся",
  "хорошо поймал тайминг",
  "надо было отходить раньше",
  "следующий раз без мобов",
  "ты по делу забрал",
  "я слишком рано нажал скилл",
  "ладно, бывает",
  "второй раунд будет интереснее",
  "честно, я просел",
  "неплохо разменял",
  "я переоценил урон",
  "хороший контроль",
  "надо было банку ждать",
  "ок, этот бой твой",
  "почти получилось",
  "я видел ошибку",
  "в следующий раз не подставлюсь",
  "справедливо",
  "без вопросов, красиво",
  "вернусь с полным хп"
];

const BOT_REVIVE_CHAT_LINES = [
  "поднимаю, лежи спокойно",
  "ресаю, прикройте",
  "держись, сейчас встанешь",
  "не отпускаю тебя в город",
  "сейчас подниму",
  "вижу лежачего, бегу",
  "ресну и отойду",
  "сек, поднимаю",
  "живи давай",
  "не умирай тут красиво"
];

const BOT_REVIVED_CHAT_LINES = [
  "спс",
  "спасибо",
  "пасиб",
  "спасибо за рес",
  "живой, спасибо",
  "выручил",
  "вовремя поднял",
  "спс, я уже думал в город",
  "норм, продолжаем",
  "спасибо, отыграюсь",
  "есть, подняли",
  "норм",
  "++",
  "живой",
  "от души"
];

const BOT_SOCIAL_CHAT_LINES = [
  "{name}, го вместе?",
  "{name}, я за тобой",
  "{name}, держись ближе",
  "{name}, я рядом если что",
  "{name}, не агри много",
  "{name}, пойдем через дорогу",
  "{name}, я прикрою",
  "{name}, вижу тебя",
  "{name}, после этого пака в город?",
  "{name}, норм идем",
  "{name}, если что я дамажу сзади",
  "{name}, держу дистанцию",
  "{name}, не теряйся",
  "{name}, у меня банки есть",
  "{name}, давай без толпы",
  "{name}, пошли к следующему споту",
  "{name}, я на хвосте",
  "{name}, не стой у забора, там клинит",
  "{name}, обойдем через вход",
  "{name}, го к воротам арены",
  "{name}, я возьму моба сбоку",
  "{name}, если просел, отходи к дороге",
  "{name}, цель держу, добиваем",
  "{name}, не тащи лишних, я помогу",
  "{name}, после этого пака закупимся?"
];

const BOT_HUMAN_ASSIST_CHAT_LINES = [
  "{name}, помогу с {monster}",
  "{name}, вижу моба на тебе, добиваю",
  "{name}, беру {monster}, отходи если хп мало",
  "{name}, держи дистанцию, я подключился",
  "{name}, не переживай, сейчас снимем моба",
  "{name}, добиваем {monster} вместе",
  "{name}, если банка на кд, отойди",
  "{name}, я рядом, забираю часть урона"
];

const BOT_PARTY_ACCEPT_CHAT_LINES = [
  "го, я с тобой",
  "принял, держусь рядом",
  "ок, пошли вместе",
  "пати принял",
  "я рядом, веди",
  "погнали, буду помогать",
  "принял инвайт",
  "иду за тобой",
  "ок, не отстаю",
  "держусь рядом",
  "принял, буду ассистить",
  "ок, таргеты добиваем вместе",
  "пати есть, уже веселее",
  "веди к споту, я рядом"
];

const BOT_NAMES = [
  "AdenBlade",
  "MoonRift",
  "NikaStorm",
  "FrostVlad",
  "KiraBow",
  "DarkMila",
  "OrcDeny",
  "LunaPK",
  "RiftFox",
  "SteelArtem",
  "SovaMage",
  "RedKeks",
  "MiraCrit",
  "WolfStep",
  "ZaraHex",
  "IronDan",
  "AquaShot",
  "Noctis",
  "BonyRaid",
  "Sable",
  "TeraWind",
  "KhanGuard",
  "VegaSoul",
  "AshRider",
  "NeonElf",
  "DuskTank",
  "Fenya",
  "Skylord",
  "Runa",
  "GhostRay",
  "ByteMage",
  "CritLord",
  "Astra",
  "BladeX",
  "Morfey",
  "VioletPK",
  "Mako",
  "RinShot",
  "Templar",
  "Wisp"
];

interface SingerDefinition {
  name: string;
  npcId: string;
  characterId: string;
  classId: CharacterClass;
  race: CharacterRace;
  trackIds: readonly [number, ...number[]];
  trackDurationsMs: Record<number, number>;
}

const SINGER_ROUTE_POINTS: readonly Vector2[] = [
  { x: 1000, y: 900 },
  { x: 1780, y: 980 },
  { x: 2380, y: 1040 },
  { x: 3700, y: 1200 },
  { x: 4420, y: 1720 },
  { x: 5200, y: 2600 }
];
const SINGER_ROUTE_TARGET_REACHED_DISTANCE = 64;
const SINGER_ROUTE_ARENA_BUFFER = 150;
const SINGER_NPC_SPEED = 72;
const SINGER_ROUTE_WAYPOINT_HOLD_MS = 30_000;
const SINGER_ROUTE_HOME_HOLD_MS = 24_000;
const SINGER_ROUTE_DESTINATION_HOLD_MS = 45_000;
const SINGER_ROUTE_HOLD_DRIFT_RADIUS = 42;
const SINGER_ROUTE_HOLD_TARGET_REACHED_DISTANCE = 10;
const SINGER_ROUTE_HOLD_DRIFT_SPEED_MULTIPLIER = 0.34;
const SINGER_ROUTE_HOLD_DRIFT_MIN_MS = 3_600;
const SINGER_ROUTE_HOLD_DRIFT_MAX_MS = 6_800;
const SINGER_DEFAULT_TRACK_DURATION_MS = 110_000;
const SINGER_DEFINITIONS: readonly SingerDefinition[] = [
  {
    name: "Kirs",
    npcId: "npc_singer_kirs",
    characterId: "npc_singer_kirs",
    classId: "assassin",
    race: "human",
    trackIds: [1, 2, 3, 4, 5, 6, 7],
    trackDurationsMs: {
      1: 104_542,
      2: 113_554,
      3: 150_936,
      4: 109_949,
      5: 104_620,
      6: 116_062,
      7: 115_749
    }
  }
];

const BOT_LEVEL_LADDER = [1, 2, 3, 5, 8, 11, 15, 20, 27, 34, 42, 50, 60, 70, 78, 88, 4, 7, 12, 18, 24, 30, 38, 48, 56, 66, 74, 82, 92];
const BOT_NEWCOMER_LEVEL_CHAIN = [1, 2, 3, 4, 5, 7, 9, 11, 14, 17];
const BOT_CLASS_SEQUENCE: readonly CharacterClass[] = ["warrior", "archer", "mage", "assassin", "warrior", "mage", "archer", "assassin"];
const BOT_RACE_SEQUENCE: readonly CharacterRace[] = ["human", "elf", "darkelf", "orc", "human", "elf", "darkelf", "human"];
const BOT_NEWCOMER_PREFIXES = ["Nova", "River", "Ash", "Silver", "Mist", "Rune", "Storm", "Vale", "North", "Ember"];
const BOT_NEWCOMER_SUFFIXES = ["Blade", "Bow", "Mage", "Guard", "Fox", "Wind", "Soul", "Step", "Crit", "Rift"];

const configuredTickMs = (): number => {
  const value = Number(process.env.GAME_TICK_MS ?? TICK_MS);
  if (!Number.isFinite(value)) {
    return TICK_MS;
  }
  return Math.min(100, Math.max(25, value));
};

const configuredBotCount = (): number => {
  const value = Number(process.env.GAME_BOT_COUNT ?? DEFAULT_BOT_COUNT);
  if (!Number.isFinite(value)) {
    return DEFAULT_BOT_COUNT;
  }
  return Math.min(MAX_CONFIGURED_BOTS, Math.max(0, Math.trunc(value)));
};

const configuredBotTargetOnline = (): number | null => {
  const rawValue = process.env.GAME_BOT_TARGET_ONLINE;
  if (!rawValue) {
    return null;
  }
  const value = Number(rawValue);
  if (!Number.isFinite(value)) {
    return null;
  }
  return Math.min(MAX_CONFIGURED_BOTS, Math.max(0, Math.trunc(value)));
};

@Injectable()
export class WorldService {
  readonly tickMs = configuredTickMs();
  readonly botCount = configuredBotCount();
  readonly botTargetOnline = configuredBotTargetOnline();

  private readonly players = new Map<string, PlayerPrivateState>();
  private readonly monsters = new Map<string, MonsterState>();
  private readonly monsterSpawns = new Map<string, MonsterSpawn>();
  private readonly monsterAttackReadyAt = new Map<string, number>();
  private readonly monsterWander = new Map<string, MonsterWanderState>();
  private readonly botBrains = new Map<string, BotBrain>();
  private readonly singerNpcs = new Map<string, SingerNpcBrain>();
  private readonly singerNpcIds = new Set<string>();
  private readonly singerNpcTrackCursors = new Map<string, number>();
  private singerNpcsHiddenByAdmin = false;
  private singerCycleIndex = 0;
  private readonly botTargetPressureCache = new Map<string, number>();
  private botTargetPressureTick = -1;
  private readonly resources = new Map<string, WorldResource>();
  private readonly groundItems = new Map<string, GroundItem>();
  private readonly recentEvents: CombatEvent[] = [];
  private readonly chatMessages: ChatMessage[] = [];
  private readonly pendingBroadcastChats: ChatMessage[] = [];
  private readonly mutedCharacterUntil = new Map<string, number>();
  private readonly mutedNameUntil = new Map<string, number>();
  private readonly bannedCharacterIds = new Set<string>();
  private readonly bannedNames = new Set<string>();
  private readonly parties = new Map<string, Set<string>>();
  private readonly partyByPlayer = new Map<string, string>();
  private readonly partyInvites = new Map<string, SocialInviteRecord>();
  private readonly duelInvites = new Map<string, SocialInviteRecord>();
  private readonly tradeInvites = new Map<string, SocialInviteRecord>();
  private readonly tradeSessions = new Map<string, TradeSessionRecord>();
  private readonly tradeByPlayer = new Map<string, string>();
  private readonly duelByPlayer = new Map<string, string>();
  private readonly clans = new Map<string, PersistedClan>();
  private readonly clanInvites = new Map<string, ClanInviteRecord>();
  private readonly playerHitRecords = new Map<string, number>();
  private readonly pvpXpPairRecords = new Map<string, number>();
  private readonly pvpXpTargetLocks = new Map<string, number>();
  private readonly hazardDamageReadyAt = new Map<string, number>();
  private readonly persistedCharacters = new Map<string, PersistedCharacter>();
  private readonly savePath = join(process.cwd(), "data", "characters.json");
  private readonly clansPath = join(process.cwd(), "data", "clans.json");
  private readonly moderationPath = join(process.cwd(), "data", "moderation.json");
  private readonly feedbackPath = join(process.cwd(), "data", "feedback.json");
  private readonly feedbackReports: FeedbackReport[] = [];
  private feedbackLoaded = false;
  private lastPositionSaveAt = 0;
  private lastBotPopulationUpdateAt = 0;
  private lastBotChatAt = 0;
  private lastBotWideChatAt = 0;
  private readonly botPopulationSeed = Math.random() * 1000;
  private tickTimer?: NodeJS.Timeout;
  private tick = 0;

  get playerCount(): number {
    return this.players.size;
  }

  get realPlayerCount(): number {
    return [...this.players.values()].filter((player) => !this.botBrains.has(player.id) && !player.offlineMarketSeller).length;
  }

  get currentTick(): number {
    return this.tick;
  }

  start(): void {
    if (this.tickTimer) {
      return;
    }

    this.loadCharacters();
    this.loadClans();
    this.loadModeration();
    this.seedWorld();
    this.updateBotPopulation(Date.now(), true);
    this.tickTimer = setInterval(() => this.step(), this.tickMs);
  }

  stop(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = undefined;
    }
  }

  canJoin(name: string, requestedCharacterId?: string): { ok: boolean; message?: string } {
    const characterId = this.sanitizeCharacterId(requestedCharacterId);
    const saved = characterId ? this.persistedCharacters.get(characterId) : undefined;
    const nameKey = this.nameKey(saved?.name ?? name);
    if ((characterId && this.bannedCharacterIds.has(characterId)) || this.bannedNames.has(nameKey)) {
      return { ok: false, message: "Character is banned." };
    }
    return { ok: true };
  }

  private playableClassId(classId?: CharacterClass): CharacterClass {
    return classId && classId !== "tank" && CLASS_DEFINITIONS[classId] ? classId : "warrior";
  }

  join(
    name: string,
    classId: CharacterClass,
    token?: string,
    requestedCharacterId?: string,
    race?: CharacterRace,
    face?: number,
    customHeadUrl?: string
  ): JoinResult {
    const id = this.createId("p");
    const characterId = this.sanitizeCharacterId(requestedCharacterId) ?? this.createId("char");
    const offlineSeller = this.findOfflineMarketSeller(characterId);
    if (offlineSeller) {
      this.saveCharacter(offlineSeller);
      this.players.delete(offlineSeller.id);
    }
    const saved = this.persistedCharacters.get(characterId);
    const effectiveClassId = this.playableClassId(saved?.classId ?? classId);
    const classDef = CLASS_DEFINITIONS[effectiveClassId] ?? CLASS_DEFINITIONS.warrior;
    const equipment = saved?.equipment ?? this.starterEquipment(classDef.id);
    delete equipment.glasses;
    delete equipment.mask;
    delete equipment.headAccessory;
    const rawInventory = saved?.inventory ?? this.starterInventory(classDef.id);
    const inventory = this.normalizeBagForEquipment(rawInventory.filter((item) => item.slot !== "glasses" && item.slot !== "mask" && item.slot !== "headAccessory"), equipment);
    const stats = this.deriveStats(classDef.id, saved?.level ?? 1, equipment);
    const savedDead = Boolean(saved?.downed || (saved?.hp ?? stats.hp) <= 0);
    const spawn = saved?.position ? this.clampPosition(saved.position) : this.nextSpawnPoint();
    const clanId = this.clanIdForCharacter(characterId) ?? (saved?.clanId && this.clans.has(saved.clanId) ? saved.clanId : undefined);

	    const player: PlayerPrivateState = {
      id,
      characterId,
      name: this.sanitizeName(saved?.name ?? name),
      classId: classDef.id,
      race: saved?.race ?? this.sanitizeRace(race),
      face: saved?.face ?? this.sanitizeFace(face),
      customHeadUrl: this.sanitizeCustomHeadUrl(saved?.customHeadUrl ?? customHeadUrl),
      position: spawn,
      velocity: { x: 0, y: 0 },
      facing: { x: 1, y: 0 },
      hp: savedDead ? 0 : stats.hp,
      maxHp: stats.hp,
      cp: savedDead ? Math.max(0, Math.min(stats.cp, saved?.cp ?? 0)) : stats.cp,
      maxCp: stats.cp,
      mp: savedDead ? Math.max(0, Math.min(stats.mp, saved?.mp ?? stats.mp)) : stats.mp,
      maxMp: stats.mp,
      level: saved?.level ?? 1,
      xp: saved?.xp ?? 0,
      gold: saved?.gold ?? (token ? 15 : 10),
      karma: Math.max(0, saved?.karma ?? 0),
      pkCount: Math.max(0, saved?.pkCount ?? 0),
      pvpCount: Math.max(0, saved?.pvpCount ?? 0),
      monsterKills: { ...(saved?.monsterKills ?? {}) },
      arenaRating: Math.max(700, saved?.arenaRating ?? 1000),
      arenaWins: Math.max(0, saved?.arenaWins ?? 0),
      arenaLosses: Math.max(0, saved?.arenaLosses ?? 0),
      arenaStreak: saved?.arenaStreak ?? 0,
      arenaSeasonPoints: Math.max(0, saved?.arenaSeasonPoints ?? 0),
      storyQuestRewards: [...(saved?.storyQuestRewards ?? [])],
      pendingMarketNotices: [...(saved?.marketNotices ?? [])],
      clanId,
      jumpUntil: 0,
      lastJumpInput: false,
      pvpFlagUntil: undefined,
      blocking: false,
      stunnedUntil: 0,
      zone: "safe",
      comboStage: 0,
      lastProcessedSeq: 0,
      input: this.emptyInput(),
      inventory,
      equipment,
      stats,
      wallet: saved?.wallet ?? {
        mode: "telegram-ton",
        connected: false,
        pendingToken: 0
      },
      lastAttackAt: 0,
      skillCooldowns: new Map(),
      lastConsumableAt: 0,
      lastSafePosition: this.nearestCityPosition(spawn),
      downed: savedDead,
      revivableUntil: savedDead ? Math.max(saved?.revivableUntil ?? 0, Date.now() + 30_000) : undefined,
      deathReturnPosition: savedDead ? saved?.deathReturnPosition : undefined,
	      tokenDebt: 0
	    };
    if (savedDead && !player.deathReturnPosition) {
      player.deathReturnPosition = this.deathReturnPositionFor(player);
    }

    const restoredMarketListings = (saved?.marketListings ?? [])
      .filter((listing) => listing.item && listing.priceGold > 0 && listing.quantity > 0)
      .slice(0, MARKET_MAX_LISTINGS)
      .map((listing) => ({
        ...listing,
        sellerId: player.id,
        sellerName: player.name,
        source: "player" as const,
        item: this.cloneInventoryItem(listing.item, Math.max(1, Math.trunc(listing.quantity)))
      }));
    if (restoredMarketListings.length > 0) {
      const market = this.marketCityDefinition();
      if (!this.isPlayerAtMarket(player)) {
        player.position = this.randomCityRespawnPosition(market);
      }
      player.zone = "safe";
      player.lastSafePosition = { ...market.position };
      player.sitting = true;
      player.marketVendor = {
        title: saved?.marketVendorTitle || `${player.name}'s stall`,
        items: restoredMarketListings,
        sinceAt: saved?.marketVendorSinceAt ?? Date.now(),
        playerOwned: true
      };
    }

		    if (!player.inventory.some((item) => item.id === "lesser-hp-potion")) {
      this.addItem(player, "lesser-hp-potion", 4);
    }

    this.players.set(id, player);
    this.event(id, id, 0, "loot", `${player.name} entered the world.`);
    const pendingMarketNotices = [...(player.pendingMarketNotices ?? [])];
    player.pendingMarketNotices = [];
    this.saveCharacter(player);
    for (const notice of pendingMarketNotices) {
      this.ownerSystemChat(player, notice);
    }
    this.systemChat(`${player.name} joined. ${this.players.size}/${MAX_PLAYERS_PER_WORLD} online.`);

    return {
      playerId: id,
      characterId,
      snapshot: this.snapshot(id),
      inventory: player.inventory,
      equipment: player.equipment,
      stats: player.stats,
      wallet: player.wallet
    };
  }

  renameCharacter(playerId: string, name: string): boolean {
    const player = this.players.get(playerId);
    if (!player || this.botBrains.has(player.id) || this.singerNpcIds.has(player.id)) {
      return false;
    }

    const nextName = this.sanitizeName(name);
    if (!name.trim()) {
      return false;
    }

    player.name = nextName;
    this.saveCharacter(player);
    this.systemChat(`${player.name} updated hero name.`);
    return true;
  }

  updateCustomHead(playerId: string, customHeadUrl?: string): boolean {
    const player = this.players.get(playerId);
    if (!player || this.botBrains.has(player.id) || this.singerNpcIds.has(player.id)) {
      return false;
    }

    player.customHeadUrl = this.sanitizeCustomHeadUrl(customHeadUrl);
    this.saveCharacter(player);
    return true;
  }

  leave(playerId: string): void {
    const player = this.players.get(playerId);
    if (!player) {
      return;
    }

    this.cancelTradeFor(player.id, true);
    this.clearSocialState(playerId);
    for (const key of [...this.hazardDamageReadyAt.keys()]) {
      if (key.startsWith(`${playerId}:`)) {
        this.hazardDamageReadyAt.delete(key);
      }
    }
    if (this.keepOfflineMarketSeller(player)) {
      this.prepareOfflineMarketSeller(player);
      this.saveCharacter(player);
      this.event(playerId, playerId, 0, "death", `${player.name} left a market stall.`);
      this.systemChat(`${player.name} left a market stall in Trade Zone.`);
      return;
    }

    this.returnPlayerMarketListings(player);
    this.players.delete(playerId);
    if (player.hp <= 0 || player.downed) {
      player.hp = 0;
      player.cp = 0;
      player.downed = true;
      player.revivableUntil = Math.max(player.revivableUntil ?? 0, Date.now() + 30_000);
      player.deathReturnPosition ??= this.deathReturnPositionFor(player);
    }
    this.saveCharacter(player);
    this.event(playerId, playerId, 0, "death", `${player.name} left the world.`);
    this.systemChat(`${player.name} left. ${this.players.size}/${MAX_PLAYERS_PER_WORLD} online.`);
  }

  partyInvite(fromId: string, targetId: string): boolean {
    const from = this.players.get(fromId);
    const to = this.players.get(targetId);
    if (!from || !to || !this.canCreateSocialInvite(from, to, SOCIAL_INVITE_RANGE) || this.sameParty(from.id, to.id)) {
      return false;
    }

    this.partyInvites.set(this.inviteKey(from.id, to.id), {
      fromId: from.id,
      toId: to.id,
      expiresAt: Date.now() + SOCIAL_INVITE_TTL_MS
    });
    this.systemChat(`${from.name} invited ${to.name} to party.`);
    if (this.botBrains.has(to.id)) {
      this.acceptBotPartyInvite(to, from);
    }
    return true;
  }

  partyAccept(playerId: string, fromId: string): boolean {
    this.cleanupSocialInvites(Date.now());
    const inviteKey = this.inviteKey(fromId, playerId);
    const invite = this.partyInvites.get(inviteKey);
    const from = this.players.get(fromId);
    const to = this.players.get(playerId);
    if (!invite || !from || !to || invite.toId !== playerId || invite.fromId !== fromId || this.sameParty(from.id, to.id)) {
      return false;
    }

    const partyId = this.ensurePartyFor(from.id);
    this.addPlayerToParty(partyId, to.id);
    this.partyInvites.delete(inviteKey);
    this.clearInvitesForPlayer(to.id, this.partyInvites);
    this.systemChat(`${to.name} joined ${from.name}'s party.`);
    return true;
  }

  partyDecline(playerId: string, fromId: string): boolean {
    const inviteKey = this.inviteKey(fromId, playerId);
    const invite = this.partyInvites.get(inviteKey);
    if (!invite) {
      return false;
    }

    this.partyInvites.delete(inviteKey);
    const from = this.players.get(fromId);
    const to = this.players.get(playerId);
    if (from && to) {
      this.systemChat(`${to.name} declined ${from.name}'s party invite.`);
    }
    return true;
  }

  duelInvite(fromId: string, targetId: string): boolean {
    const from = this.players.get(fromId);
    const to = this.players.get(targetId);
    if (!from || !to || !this.canCreateSocialInvite(from, to, DUEL_INVITE_RANGE) || this.areDueling(from.id, to.id)) {
      return false;
    }

    this.duelInvites.set(this.inviteKey(from.id, to.id), {
      fromId: from.id,
      toId: to.id,
      expiresAt: Date.now() + SOCIAL_INVITE_TTL_MS
    });
    this.systemChat(`${from.name} challenged ${to.name} to a duel.`);
    return true;
  }

  duelAccept(playerId: string, fromId: string): boolean {
    this.cleanupSocialInvites(Date.now());
    const inviteKey = this.inviteKey(fromId, playerId);
    const invite = this.duelInvites.get(inviteKey);
    const from = this.players.get(fromId);
    const to = this.players.get(playerId);
    if (!invite || !from || !to || invite.toId !== playerId || invite.fromId !== fromId || !this.canCreateSocialInvite(from, to, DUEL_INVITE_RANGE)) {
      return false;
    }

    this.endDuelFor(from.id);
    this.endDuelFor(to.id);
    this.duelByPlayer.set(from.id, to.id);
    this.duelByPlayer.set(to.id, from.id);
    this.duelInvites.delete(inviteKey);
    this.clearInvitesForPlayer(to.id, this.duelInvites);
    this.systemChat(`${to.name} accepted duel with ${from.name}.`);
    return true;
  }

  duelDecline(playerId: string, fromId: string): boolean {
    const inviteKey = this.inviteKey(fromId, playerId);
    const invite = this.duelInvites.get(inviteKey);
    if (!invite) {
      return false;
    }

    this.duelInvites.delete(inviteKey);
    const from = this.players.get(fromId);
    const to = this.players.get(playerId);
    if (from && to) {
      this.systemChat(`${to.name} declined duel with ${from.name}.`);
    }
    return true;
  }

  tradeInvite(fromId: string, targetId: string): boolean {
    const from = this.players.get(fromId);
    const to = this.players.get(targetId);
    if (
      !from ||
      !to ||
      this.botBrains.has(from.id) ||
      this.botBrains.has(to.id) ||
      this.tradeByPlayer.has(from.id) ||
      this.tradeByPlayer.has(to.id) ||
      !this.canCreateSocialInvite(from, to, TRADE_INVITE_RANGE)
    ) {
      return false;
    }

    this.tradeInvites.set(this.inviteKey(from.id, to.id), {
      fromId: from.id,
      toId: to.id,
      expiresAt: Date.now() + SOCIAL_INVITE_TTL_MS
    });
    this.systemChat(`${from.name} offered trade to ${to.name}.`);
    return true;
  }

  tradeAccept(playerId: string, fromId: string): boolean {
    this.cleanupSocialInvites(Date.now());
    const inviteKey = this.inviteKey(fromId, playerId);
    const invite = this.tradeInvites.get(inviteKey);
    const from = this.players.get(fromId);
    const to = this.players.get(playerId);
    if (
      !invite ||
      !from ||
      !to ||
      invite.toId !== playerId ||
      invite.fromId !== fromId ||
      this.tradeByPlayer.has(from.id) ||
      this.tradeByPlayer.has(to.id) ||
      !this.canCreateSocialInvite(from, to, TRADE_INVITE_RANGE)
    ) {
      return false;
    }

    const now = Date.now();
    const session: TradeSessionRecord = {
      id: this.createId("trade"),
      playerIds: [from.id, to.id],
      createdAt: now,
      expiresAt: now + TRADE_SESSION_TTL_MS,
      offers: new Map([
        [from.id, { playerId: from.id, gold: 0, items: [], ready: false }],
        [to.id, { playerId: to.id, gold: 0, items: [], ready: false }]
      ])
    };
    this.tradeSessions.set(session.id, session);
    this.tradeByPlayer.set(from.id, session.id);
    this.tradeByPlayer.set(to.id, session.id);
    this.tradeInvites.delete(inviteKey);
    this.clearInvitesForPlayer(to.id, this.tradeInvites);
    this.systemChat(`${to.name} started trade with ${from.name}.`);
    return true;
  }

  tradeDecline(playerId: string, fromId: string): boolean {
    const inviteKey = this.inviteKey(fromId, playerId);
    const invite = this.tradeInvites.get(inviteKey);
    if (!invite) {
      return false;
    }

    this.tradeInvites.delete(inviteKey);
    const from = this.players.get(fromId);
    const to = this.players.get(playerId);
    if (from && to) {
      this.systemChat(`${to.name} declined trade with ${from.name}.`);
    }
    return true;
  }

  tradeCancel(playerId: string): boolean {
    return this.cancelTradeFor(playerId, true);
  }

  tradeOfferGold(playerId: string, gold: number): boolean {
    const player = this.players.get(playerId);
    const session = this.tradeSessionFor(playerId);
    const offer = session?.offers.get(playerId);
    if (!player || !session || !offer) {
      return false;
    }

    offer.gold = Math.max(0, Math.min(player.gold, Math.trunc(Number.isFinite(gold) ? gold : 0)));
    this.resetTradeReady(session);
    session.expiresAt = Date.now() + TRADE_SESSION_TTL_MS;
    return true;
  }

  tradeOfferItem(playerId: string, inventoryIndex: number, quantity: number): boolean {
    const player = this.players.get(playerId);
    const session = this.tradeSessionFor(playerId);
    const offer = session?.offers.get(playerId);
    const index = Math.trunc(inventoryIndex);
    const item = player?.inventory[index];
    if (!player || !session || !offer || !item || offer.items.length >= TRADE_MAX_ITEMS_PER_SIDE) {
      return false;
    }

    const requestedQuantity = item.stackable ? Math.max(1, Math.min(item.quantity, Math.trunc(quantity))) : 1;
    const alreadyOffered = offer.items
      .filter((entry) => entry.inventoryIndex === index)
      .reduce((total, entry) => total + Math.max(1, entry.quantity), 0);
    if (alreadyOffered + requestedQuantity > Math.max(1, item.quantity)) {
      return false;
    }

    offer.items.push({
      tradeItemId: this.createId("trade_item"),
      inventoryIndex: index,
      item: this.cloneInventoryItem(item, requestedQuantity),
      quantity: requestedQuantity
    });
    this.resetTradeReady(session);
    session.expiresAt = Date.now() + TRADE_SESSION_TTL_MS;
    return true;
  }

  tradeRemoveItem(playerId: string, tradeItemId: string): boolean {
    const session = this.tradeSessionFor(playerId);
    const offer = session?.offers.get(playerId);
    if (!session || !offer) {
      return false;
    }

    const nextItems = offer.items.filter((item) => item.tradeItemId !== tradeItemId);
    if (nextItems.length === offer.items.length) {
      return false;
    }

    offer.items = nextItems;
    this.resetTradeReady(session);
    session.expiresAt = Date.now() + TRADE_SESSION_TTL_MS;
    return true;
  }

  tradeReady(playerId: string, ready: boolean): string[] {
    const session = this.tradeSessionFor(playerId);
    const offer = session?.offers.get(playerId);
    if (!session || !offer) {
      return [];
    }

    offer.ready = Boolean(ready);
    session.expiresAt = Date.now() + TRADE_SESSION_TTL_MS;
    if ([...session.offers.values()].every((entry) => entry.ready)) {
      return this.finalizeTradeSession(session);
    }
    return [];
  }

  createClan(playerId: string, name: string, emblem: ClanEmblem): boolean {
    const player = this.players.get(playerId);
    const clanName = this.sanitizeClanName(name);
    if (!player || player.clanId || clanName.length < 3 || this.clanByName(clanName)) {
      return false;
    }

    const clan: PersistedClan = {
      id: this.createId("clan"),
      name: clanName,
      tag: this.clanTagFor(clanName),
      emblem: this.validClanEmblem(emblem),
      leaderCharacterId: player.characterId,
      leaderName: player.name,
      createdAt: Date.now(),
      members: [
        {
          characterId: player.characterId,
          name: player.name,
          level: player.level,
          classId: player.classId,
          role: "leader",
          joinedAt: Date.now()
        }
      ]
    };

    this.clans.set(clan.id, clan);
    player.clanId = clan.id;
    this.saveClans();
    this.saveCharacter(player);
    this.systemChat(`${player.name} created clan ${clan.name}.`);
    return true;
  }

  clanInvite(fromId: string, targetId: string): boolean {
    const from = this.players.get(fromId);
    const to = this.players.get(targetId);
    const clan = from?.clanId ? this.clans.get(from.clanId) : undefined;
    if (!from || !to || !clan || from.id === to.id || to.clanId || this.clanRoleFor(from) !== "leader") {
      return false;
    }
    if (!this.canCreateSocialInvite(from, to, SOCIAL_INVITE_RANGE)) {
      return false;
    }

    const key = this.clanInviteKey(from.id, to.id, clan.id);
    this.clanInvites.set(key, {
      fromId: from.id,
      toId: to.id,
      clanId: clan.id,
      expiresAt: Date.now() + SOCIAL_INVITE_TTL_MS
    });
    this.systemChat(`${from.name} invited ${to.name} to clan ${clan.name}.`);
    if (this.botBrains.has(to.id)) {
      this.clanAccept(to.id, from.id, clan.id);
    }
    return true;
  }

  clanAccept(playerId: string, fromId: string, clanId: string): boolean {
    this.cleanupSocialInvites(Date.now());
    const player = this.players.get(playerId);
    const clan = this.clans.get(clanId);
    const invite = this.clanInvites.get(this.clanInviteKey(fromId, playerId, clanId));
    if (!player || !clan || !invite || player.clanId || invite.toId !== playerId || invite.fromId !== fromId) {
      return false;
    }

    this.addClanMember(clan, player, "member");
    player.clanId = clan.id;
    this.clearInvitesForPlayer(player.id, this.clanInvites);
    this.saveClans();
    this.saveCharacter(player);
    this.systemChat(`${player.name} joined clan ${clan.name}.`);
    const inviter = this.players.get(fromId);
    const brain = this.botBrains.get(player.id);
    if (inviter && brain) {
      this.placeBotNearClanmate(player, brain, inviter, Date.now());
    }
    return true;
  }

  clanDecline(playerId: string, fromId: string, clanId: string): boolean {
    const key = this.clanInviteKey(fromId, playerId, clanId);
    const invite = this.clanInvites.get(key);
    if (!invite) {
      return false;
    }

    this.clanInvites.delete(key);
    const from = this.players.get(fromId);
    const to = this.players.get(playerId);
    const clan = this.clans.get(clanId);
    if (from && to && clan) {
      this.systemChat(`${to.name} declined ${from.name}'s clan invite.`);
    }
    return true;
  }

  clanKick(playerId: string, characterId: string): boolean {
    const leader = this.players.get(playerId);
    const clan = leader?.clanId ? this.clans.get(leader.clanId) : undefined;
    if (!leader || !clan || this.clanRoleFor(leader) !== "leader" || characterId === leader.characterId) {
      return false;
    }

    const member = clan.members.find((candidate) => candidate.characterId === characterId);
    if (!member || member.role === "leader") {
      return false;
    }

    this.removeClanMember(clan, characterId);
    const online = this.onlinePlayerByCharacterId(characterId);
    if (online) {
      online.clanId = undefined;
      this.saveCharacter(online);
    }
    const saved = this.persistedCharacters.get(characterId);
    if (saved) {
      saved.clanId = undefined;
      this.persistedCharacters.set(characterId, saved);
      this.writeCharacters();
    }
    this.saveClans();
    this.systemChat(`${leader.name} removed ${member.name} from clan ${clan.name}.`);
    return true;
  }

  clanLeave(playerId: string): boolean {
    const player = this.players.get(playerId);
    const clan = player?.clanId ? this.clans.get(player.clanId) : undefined;
    if (!player || !clan) {
      return false;
    }

    const member = clan.members.find((candidate) => candidate.characterId === player.characterId);
    if (!member) {
      player.clanId = undefined;
      this.saveCharacter(player);
      return false;
    }

    this.removeClanMember(clan, player.characterId);
    player.clanId = undefined;
    if (member.role === "leader") {
      const nextLeader = clan.members[0];
      if (nextLeader) {
        nextLeader.role = "leader";
        clan.leaderCharacterId = nextLeader.characterId;
        clan.leaderName = nextLeader.name;
      } else {
        this.clans.delete(clan.id);
      }
    }

    this.saveClans();
    this.saveCharacter(player);
    this.systemChat(`${player.name} left clan ${clan.name}.`);
    return true;
  }

  applyInput(playerId: string, input: PlayerInput): void {
    const player = this.players.get(playerId);
    if (!player || input.seq <= player.lastProcessedSeq) {
      return;
    }

    const jumpInput = Boolean(input.jump);
    const movement = this.normalize(input.movement);
    const now = Date.now();
    const wasDashing = Boolean(player.input.dash && (player.dashUntil ?? 0) > now - 80);
    player.input = {
      ...input,
      movement,
      aim: input.aim ?? player.position,
      jump: jumpInput,
      // Sprint is an admin-only movement capability. Keep this authoritative
      // so a modified client cannot restore it for regular players.
      sprint: Boolean(input.sprint && this.isAdmin(playerId))
    };
    if (input.dash && (movement.x !== 0 || movement.y !== 0)) {
      if (!wasDashing) {
        player.dashStartedAt = now;
      }
      player.dashUntil = Math.max(player.dashUntil ?? 0, now + (input.boost ? 330 : 280));
      player.dashDirection = movement;
    }
    if (jumpInput) {
      player.jumpUntil = Math.max(player.jumpUntil, now + (player.lastJumpInput ? 140 : PLAYER_JUMP_HAZARD_MS));
    }
    player.lastJumpInput = jumpInput;
    const aimDirection = this.normalize({
      x: (input.aim?.x ?? player.position.x) - player.position.x,
      y: (input.aim?.y ?? player.position.y) - player.position.y
    });
    if (aimDirection.x !== 0 || aimDirection.y !== 0) {
      player.facing = aimDirection;
    }
    player.lastProcessedSeq = input.seq;
    player.blocking = input.block;
  }

  attack(playerId: string, command: AttackCommand): void {
    const player = this.players.get(playerId);
    if (!player || player.hp <= 0 || player.downed) {
      return;
    }

    const now = Date.now();
    if (now < player.stunnedUntil || now - player.lastAttackAt < this.attackCooldownMs(player)) {
      return;
    }

    const comboBonus = 1 + Math.min(player.comboStage, 3) * 0.1;
    const archerCharge = player.classId === "archer" ? Math.min(1, Math.max(0, command.charge ?? 0)) : 0;
    const chargeBonus = player.classId === "archer" ? 1 + archerCharge * (this.botBrains.has(player.id) ? 0.45 : 1.55) : 1;
    const damage = this.rollCriticalDamage(player, Math.round(this.basicAttackDamage(player) * comboBonus * chargeBonus), "attack");
    player.facing = this.directionToAim(player, command.aim);
    const attackRange = CLASS_DEFINITIONS[player.classId].attackRange;
    const didHit = this.basicMeleeCleaveProfile(player.classId)
      ? this.resolveMeleeCleaveDamage(player, command, attackRange, damage)
      : this.resolveDamage(player, command, attackRange, damage, "attack");

    player.lastAttackAt = now;
    player.comboStage = didHit ? (player.comboStage + 1) % 4 : 0;
  }

  skill(playerId: string, command: SkillCommand): void {
    const player = this.players.get(playerId);
    if (!player || player.hp <= 0 || player.downed) {
      return;
    }

    const skill = CLASS_DEFINITIONS[player.classId].skills.find((candidate) => candidate.id === command.skillId);
    if (!skill) {
      return;
    }

    const now = Date.now();
    const readyAt = player.skillCooldowns.get(skill.id) ?? 0;
    if (now < readyAt || now < player.stunnedUntil || player.mp < skill.manaCost || player.level < (skill.requiredLevel ?? 1)) {
      return;
    }

    if (skill.heal) {
      if (player.hp >= player.maxHp) {
        return;
      }
      player.facing = this.directionToAim(player, command.aim);
      player.mp = Math.max(0, player.mp - skill.manaCost);
      const beforeHp = player.hp;
      const heal = Math.max(1, Math.round(this.skillHealing(player, skill.heal)));
      player.hp = Math.min(player.maxHp, player.hp + heal);
      const restored = Math.max(0, Math.round(player.hp - beforeHp));
      if (restored > 0) {
        this.event(player.id, player.id, restored, "heal", `${player.name} restored ${restored} HP.`);
      }
      player.skillCooldowns.set(skill.id, now + this.skillCooldownMs(player, skill.cooldownMs));
      player.comboStage = 0;
      return;
    }

    const dashTarget = skill.dashDistance ? this.findTarget(player, command, skill.range + skill.dashDistance, "skill") : undefined;
    const dashStartPosition = { ...player.position };
    if (skill.dashDistance && dashTarget) {
      this.movePlayerNearTarget(player, dashTarget, player.classId === "assassin" ? 38 : 46);
    } else if (skill.dashDistance) {
      const direction = this.directionToAim(player, command.aim);
      player.position = this.clampPlayerPosition(player, {
        x: player.position.x + direction.x * skill.dashDistance,
        y: player.position.y + direction.y * skill.dashDistance
      });
      player.zone = this.zoneFor(player.position);
    }
    if (skill.dashDistance) {
      const dashDirection = this.normalize({
        x: player.position.x - dashStartPosition.x,
        y: player.position.y - dashStartPosition.y
      });
      player.dashStartedAt = now;
      player.dashUntil = now + 320;
      player.dashDirection = dashDirection.x !== 0 || dashDirection.y !== 0 ? dashDirection : this.directionToAim(player, command.aim);
    }

    player.facing = this.directionToAim(player, command.aim);
    player.mp = Math.max(0, player.mp - skill.manaCost);
    const damage = this.rollCriticalDamage(player, this.skillDamage(player, skill.damage), "skill");
    player.activeSkillId = skill.id;
    try {
      if (player.classId === "assassin" && skill.id === "shadow-step" && dashTarget) {
        this.damageResolvedTarget(player, dashTarget, damage, "skill", skill.stunMs, Boolean(command.forcePk));
      } else if (skill.pierce) {
        this.resolvePiercingDamage(player, command, skill.range, damage, "skill", skill.stunMs, skill.maxPierceTargets);
      } else if (skill.areaRadius) {
        this.resolveAreaDamage(player, command, skill.range, skill.areaRadius, damage, "skill", skill.stunMs, Boolean(skill.selfCentered));
      } else {
        this.resolveDamage(player, command, skill.range, damage, "skill", skill.stunMs);
      }
    } finally {
      player.activeSkillId = undefined;
    }
    player.skillCooldowns.set(skill.id, now + this.skillCooldownMs(player, skill.cooldownMs));
    player.comboStage = 0;
  }

  setSinging(playerId: string, active: boolean): void {
    const player = this.players.get(playerId);
    const definition = player ? this.singerDefinitionForName(player.name) : undefined;
    if (!player || !definition || player.hp <= 0 || player.downed) {
      return;
    }

    if (active) {
      this.startSinging(player, Date.now(), definition);
    } else {
      this.stopSinging(player);
    }
  }

  claimReward(playerId: string, walletAddress?: string) {
    const player = this.players.get(playerId);
    if (!player || !walletAddress) {
      return {
        claimId: this.createId("claim"),
        amount: 0,
        currency: "token" as const,
        status: "queued" as const
      };
    }

    const amount = Math.floor(player.gold / 25);
    if (amount <= 0) {
      return {
        claimId: this.createId("claim"),
        amount: 0,
        currency: "token" as const,
        status: "queued" as const
      };
    }

    player.gold -= amount * 25;
    player.wallet.connected = true;
    player.wallet.address = walletAddress;
    player.wallet.pendingToken += amount;
    player.tokenDebt += amount;
    this.event(player.id, player.id, amount, "claim", `${player.name} queued ${amount} TOKEN.`);
    this.saveCharacter(player);

    return {
      claimId: this.createId("claim"),
      amount,
      currency: "token" as const,
      status: "queued" as const
    };
  }

  claimStoryQuestReward(playerId: string, questId: string): boolean {
    const player = this.players.get(playerId);
    const reward = STORY_QUEST_REWARDS.find((candidate) => candidate.id === questId);
    if (!player || !reward) {
      return false;
    }

    if (player.storyQuestRewards.includes(reward.id)) {
      this.event(player.id, player.id, 0, "loot", `${reward.label} reward already claimed.`);
      return false;
    }

    if (!this.storyQuestRequirementMet(player, reward.requirement)) {
      this.event(player.id, player.id, 0, "loot", `${reward.label} is not complete yet.`);
      return false;
    }

    const rewardParts: string[] = [];
    if (reward.gold > 0) {
      player.gold += reward.gold;
      rewardParts.push(`${reward.gold} gold`);
    }

    for (const item of reward.items ?? []) {
      this.addItem(player, item.id, item.quantity);
      rewardParts.push(`${item.quantity} ${this.itemLabel(item.id)}`);
    }

    for (const gear of reward.classGear ?? []) {
      const offer = SHOP_CATALOG.find(
        (candidate) => candidate.item.slot === gear.slot && candidate.item.grade === gear.grade && candidate.item.classId === player.classId
      );
      if (!offer) {
        continue;
      }

      this.addInventoryItem(player, {
        ...offer.item,
        id: `${offer.item.id}-story-${reward.id}`,
        quantity: 1,
        stackable: false
      });
      rewardParts.push(offer.item.label);
    }

    player.storyQuestRewards.push(reward.id);
    this.saveCharacter(player);
    const text = `${player.name} completed ${reward.label}: ${rewardParts.join(", ")}.`;
    this.event(player.id, player.id, reward.gold, "loot", text);
    this.lootSystemChat(player, text);
    return true;
  }

  private storyQuestRequirementMet(player: PlayerPrivateState, requirement: StoryQuestRewardRequirement): boolean {
    if (requirement.kind === "monster") {
      return (player.monsterKills[requirement.archetype] ?? 0) >= requirement.count;
    }
    if (requirement.kind === "level") {
      return player.level >= requirement.level;
    }
    return player.arenaWins >= requirement.count;
  }

  chat(playerId: string, text: string, channel: Exclude<ChatChannel, "system"> = "local"): ChatMessage | undefined {
    const player = this.players.get(playerId);
    const sanitized = this.sanitizeChat(text);
    if (!player || !sanitized) {
      return undefined;
    }
    if (this.playerMutedUntil(player) > Date.now()) {
      return undefined;
    }
    if (channel === "clan" && !player.clanId) {
      return undefined;
    }

    const message: ChatMessage = {
      id: this.createId("chat"),
      at: Date.now(),
      playerId: player.id,
      playerName: player.name,
      channel,
      position: player.position,
      zone: player.zone,
      clanId: channel === "clan" ? player.clanId : undefined,
      text: sanitized
    };
    this.pushChat(message);
    return message;
  }

  reportFeedback(playerId: string, text: string, context?: string): FeedbackReport | undefined {
    const player = this.players.get(playerId);
    const sanitized = this.sanitizeFeedback(text);
    if (!player || sanitized.length < 5) {
      return undefined;
    }

    this.loadFeedbackReports();
    const report: FeedbackReport = {
      id: this.createId("feedback"),
      createdAt: Date.now(),
      playerId: player.id,
      characterId: player.characterId,
      playerName: player.name,
      level: player.level,
      zone: player.zone,
      position: player.position,
      text: sanitized,
      context: context ? this.sanitizeFeedback(context).slice(0, 220) : undefined
    };
    this.feedbackReports.unshift(report);
    if (this.feedbackReports.length > 300) {
      this.feedbackReports.splice(300);
    }
    this.saveFeedbackReports();
    return report;
  }

  private static readonly ADMIN_NAME_KEYS = new Set(["unit", "houston"]);

  isAdmin(playerId: string): boolean {
    const player = this.players.get(playerId);
    return Boolean(player && WorldService.ADMIN_NAME_KEYS.has(this.nameKey(player.name)));
  }

  adminState(playerId: string, message?: string): AdminState | undefined {
    if (!this.isAdmin(playerId)) {
      return undefined;
    }

    const now = Date.now();
    const players = [...this.players.values()];
    const realPlayers = players.filter((player) => !this.botBrains.has(player.id) && !player.offlineMarketSeller);
    return {
      updatedAt: now,
      totalOnline: this.players.size,
      realOnline: realPlayers.length,
      botOnline: Math.max(0, this.players.size - realPlayers.length),
      singerOnline: this.singerNpcIds.size,
      singersHidden: this.singerNpcsHiddenByAdmin,
      feedbackReports: this.recentFeedbackReports(),
      players: players
        .map((player) => ({
          id: player.id,
          characterId: player.characterId,
          name: player.name,
          bot: this.botBrains.has(player.id) || undefined,
          classId: player.classId,
          level: player.level,
          zone: player.zone,
          hp: player.hp,
          maxHp: player.maxHp,
          cp: player.cp,
          maxCp: player.maxCp,
          mp: player.mp,
          maxMp: player.maxMp,
          gold: player.gold,
          karma: player.karma,
          position: player.position,
          mutedUntil: this.playerMutedUntil(player) > now ? this.playerMutedUntil(player) : undefined
        }))
        .sort((first, second) => Number(Boolean(first.bot)) - Number(Boolean(second.bot)) || first.name.localeCompare(second.name)),
      message
    };
  }

  adminAction(playerId: string, action: AdminActionType, targetId: string, durationMs = 15 * 60_000): AdminActionResult {
    const admin = this.players.get(playerId);
    if (!admin || !this.isAdmin(playerId)) {
      return {};
    }

    if (action === "summonSingers") {
      this.singerNpcsHiddenByAdmin = false;
      this.updateSingerNpcs(Date.now());
      const count = this.singerNpcIds.size;
      const message = count > 0 ? `${admin.name} returned musicians to their route.` : `${admin.name} returned musician route, but real singers are already online.`;
      this.systemChat(message);
      return { state: this.adminState(playerId, message) };
    }

    if (action === "hideSingers") {
      this.singerNpcsHiddenByAdmin = true;
      const count = this.hideSingerNpcs();
      const message = count > 0 ? `${admin.name} hid ${count} musician${count === 1 ? "" : "s"}.` : `${admin.name} hid musicians.`;
      this.systemChat(message);
      return { state: this.adminState(playerId, message) };
    }

    const target = this.players.get(targetId);
    if (!target) {
      return { state: this.adminState(playerId, "Target is offline.") };
    }

    const targetBrain = this.botBrains.get(target.id);
    const targetIsBot = Boolean(targetBrain);
    const targetName = target.name;
    const saveTarget = () => this.saveCharacter(target);
    let message = "";

    if ((action === "kick" || action === "ban") && target.id === admin.id) {
      return { state: this.adminState(playerId, "You cannot kick or ban yourself.") };
    }

    if (action === "clearKarma") {
      target.karma = 0;
      saveTarget();
      message = `${admin.name} cleared karma for ${targetName}.`;
    } else if (action === "muteChat") {
      const until = Date.now() + Math.max(60_000, Math.min(durationMs, 24 * 60 * 60_000));
      this.mutedCharacterUntil.set(target.characterId, until);
      this.mutedNameUntil.set(this.nameKey(target.name), until);
      this.saveModeration();
      message = `${admin.name} muted ${targetName} chat for ${Math.round((until - Date.now()) / 60000)}m.`;
    } else if (action === "unmuteChat") {
      this.mutedCharacterUntil.delete(target.characterId);
      this.mutedNameUntil.delete(this.nameKey(target.name));
      this.saveModeration();
      message = `${admin.name} unmuted ${targetName}.`;
    } else if (action === "heal") {
      target.hp = target.maxHp;
      target.cp = target.maxCp;
      target.mp = target.maxMp;
      target.downed = false;
      target.revivableUntil = undefined;
      saveTarget();
      message = `${admin.name} healed ${targetName}.`;
    } else if (action === "revive") {
      target.downed = false;
      target.revivableUntil = undefined;
      target.deathReturnPosition = undefined;
      target.hp = Math.max(1, Math.round(target.maxHp * 0.6));
      target.cp = Math.max(0, Math.round(target.maxCp * 0.5));
      target.mp = Math.max(target.mp, Math.round(target.maxMp * 0.35));
      saveTarget();
      message = `${admin.name} revived ${targetName}.`;
    } else if (action === "summon") {
      target.position = this.pushOutOfWorldObstacles(this.clampPosition({ x: admin.position.x + 70, y: admin.position.y + 22 }));
      target.velocity = { x: 0, y: 0 };
      target.zone = this.zoneFor(target.position);
      target.lastSafePosition = target.zone === "safe" ? { ...target.position } : target.lastSafePosition;
      saveTarget();
      message = `${admin.name} summoned ${targetName}.`;
    } else if (action === "teleportTo") {
      admin.position = this.pushOutOfWorldObstacles(this.clampPosition({ x: target.position.x + 70, y: target.position.y + 22 }));
      admin.velocity = { x: 0, y: 0 };
      admin.zone = this.zoneFor(admin.position);
      admin.lastSafePosition = admin.zone === "safe" ? { ...admin.position } : admin.lastSafePosition;
      this.saveCharacter(admin);
      message = `${admin.name} teleported to ${targetName}.`;
    } else if (action === "kick") {
      message = `${admin.name} kicked ${targetName}.`;
      this.systemChat(message);
      if (targetBrain) {
        this.suspendBot(target, targetBrain, Date.now());
        return { state: this.adminState(playerId, `${message} Bot will stay offline for a bit.`) };
      }
      return {
        state: this.adminState(playerId, message),
        kickedPlayerId: target.id,
        closeCode: 4001,
        closeReason: "admin kick",
        closeErrorCode: "admin_kicked",
        closeMessage: "Вы отключены администратором."
      };
    } else if (action === "ban") {
      if (targetBrain) {
        this.suspendBot(target, targetBrain, Date.now());
        targetBrain.offlineUntil = Date.now() + 24 * 60 * 60_000;
        message = `${admin.name} banned bot ${targetName} for 24h.`;
        this.systemChat(message);
        return { state: this.adminState(playerId, message) };
      }
      this.bannedCharacterIds.add(target.characterId);
      this.bannedNames.add(this.nameKey(target.name));
      this.saveModeration();
      message = `${admin.name} banned ${targetName}.`;
      this.systemChat(message);
      return {
        state: this.adminState(playerId, message),
        kickedPlayerId: target.id,
        closeCode: 4002,
        closeReason: "admin ban",
        closeErrorCode: "admin_banned",
        closeMessage: "Персонаж заблокирован администратором."
      };
    } else {
      return { state: this.adminState(playerId, "Unknown admin action.") };
    }

    this.systemChat(message);
    if (targetIsBot && targetBrain) {
      targetBrain.chillUntil = undefined;
      targetBrain.nextThinkAt = Date.now() + 120;
    }
    return { state: this.adminState(playerId, message) };
  }

  canReceiveChat(recipientId: string, message: ChatMessage): boolean {
    if (message.recipientId && message.recipientId !== recipientId) {
      return false;
    }
    if (message.channel === "clan") {
      const recipient = this.players.get(recipientId);
      return Boolean(recipient?.clanId && recipient.clanId === message.clanId);
    }
    return true;
  }

  private canCreateSocialInvite(from: PlayerPrivateState, to: PlayerPrivateState, range: number): boolean {
    if (from.id === to.id || from.hp <= 0 || to.hp <= 0 || from.downed || to.downed || from.offlineMarketSeller || to.offlineMarketSeller) {
      return false;
    }

    return this.distance(from.position, to.position) <= range;
  }

  private ensurePartyFor(playerId: string): string {
    const currentPartyId = this.partyByPlayer.get(playerId);
    if (currentPartyId && this.parties.has(currentPartyId)) {
      return currentPartyId;
    }

    const partyId = `party_${playerId}`;
    this.parties.set(partyId, new Set([playerId]));
    this.partyByPlayer.set(playerId, partyId);
    return partyId;
  }

  private addPlayerToParty(partyId: string, playerId: string): void {
    const currentPartyId = this.partyByPlayer.get(playerId);
    if (currentPartyId === partyId) {
      return;
    }

    if (currentPartyId) {
      this.removePlayerFromParty(playerId);
    }

    const party = this.parties.get(partyId);
    if (!party) {
      return;
    }

    party.add(playerId);
    this.partyByPlayer.set(playerId, partyId);
  }

  private acceptBotPartyInvite(bot: PlayerPrivateState, from: PlayerPrivateState): void {
    const brain = this.botBrains.get(bot.id);
    const partyId = this.ensurePartyFor(from.id);
    this.addPlayerToParty(partyId, bot.id);
    this.partyInvites.delete(this.inviteKey(from.id, bot.id));
    this.clearInvitesForPlayer(bot.id, this.partyInvites);
    if (brain) {
      brain.targetId = undefined;
      brain.forcePkTargetId = undefined;
      brain.targetLockedUntil = undefined;
      brain.arenaUntil = undefined;
      brain.arenaMode = undefined;
      brain.arenaAnchorAngle = undefined;
      brain.nextArenaShiftAt = undefined;
      brain.roamTarget = this.partyFollowPoint(bot, from, brain);
      brain.chillUntil = undefined;
      brain.nextThinkAt = Date.now() + this.randomBetween(220, 900);
      this.queueBotChat(bot, brain, this.randomBotLine(brain, BOT_PARTY_ACCEPT_CHAT_LINES), "local", true, 700, 2_400);
    }
    this.systemChat(`${bot.name} joined ${from.name}'s party.`);
  }

  private removePlayerFromParty(playerId: string): void {
    const partyId = this.partyByPlayer.get(playerId);
    if (!partyId) {
      return;
    }

    const party = this.parties.get(partyId);
    this.partyByPlayer.delete(playerId);
    party?.delete(playerId);
    if (!party || party.size >= 2) {
      return;
    }

    for (const memberId of party) {
      this.partyByPlayer.delete(memberId);
    }
    this.parties.delete(partyId);
  }

  private sameParty(firstId: string, secondId: string): boolean {
    const firstPartyId = this.partyByPlayer.get(firstId);
    return Boolean(firstPartyId && firstPartyId === this.partyByPlayer.get(secondId));
  }

  voicePeers(playerId: string, channel: VoiceChannel, nearbyRange: number): VoicePeer[] {
    const source = this.players.get(playerId);
    if (!source || source.hp <= 0 || source.downed) {
      return [];
    }

    return [...this.players.values()]
      .filter((candidate) => this.canUseVoiceChannel(playerId, candidate.id, channel, nearbyRange))
      .map((candidate) => ({
        playerId: candidate.id,
        name: candidate.name,
        channel,
        distance: channel === "nearby" ? Math.round(this.distance(source.position, candidate.position)) : undefined
      }));
  }

  canUseVoiceChannel(fromId: string, toId: string, channel: VoiceChannel, nearbyRange: number): boolean {
    if (fromId === toId) {
      return false;
    }

    const from = this.players.get(fromId);
    const to = this.players.get(toId);
    if (!from || !to || from.hp <= 0 || to.hp <= 0 || from.downed || to.downed) {
      return false;
    }

    if (channel === "party") {
      return this.sameParty(fromId, toId);
    }

    return this.distance(from.position, to.position) <= nearbyRange;
  }

  canUseVoiceChannelForAnyPeer(playerId: string, channel: VoiceChannel, nearbyRange: number): boolean {
    return this.voicePeers(playerId, channel, nearbyRange).length > 0;
  }

  voicePlayerName(playerId: string): string | undefined {
    return this.players.get(playerId)?.name;
  }

  private sameClan(first: PlayerPrivateState, second: PlayerPrivateState): boolean {
    return Boolean(first.clanId && first.clanId === second.clanId);
  }

  private isFriendlyPlayerRelation(first: PlayerPrivateState, second: PlayerPrivateState): boolean {
    return this.sameParty(first.id, second.id) || this.sameClan(first, second);
  }

  private canDamagePlayer(source: PlayerPrivateState, target: PlayerPrivateState, forcePk = false): boolean {
    if (source.id === target.id || target.hp <= 0 || target.downed) {
      return false;
    }

    const duel = this.areDueling(source.id, target.id);
    if (this.isFriendlyPlayerRelation(source, target) && !duel && !forcePk) {
      return false;
    }

    if ((source.zone === "safe" || target.zone === "safe") && !duel) {
      return false;
    }

    if (this.isStarterArena(source.position) && this.isStarterArena(target.position)) {
      return true;
    }

    if (duel || target.karma > 0 || this.isPvpFlagged(target)) {
      return true;
    }

    if (!forcePk) {
      return false;
    }

    return true;
  }

  private isPvpFlagged(player: PlayerPrivateState, now = Date.now()): boolean {
    return Boolean(player.pvpFlagUntil && player.pvpFlagUntil > now);
  }

  private clearExpiredPvpFlag(player: PlayerPrivateState, now = Date.now()): void {
    if (player.pvpFlagUntil && player.pvpFlagUntil <= now) {
      player.pvpFlagUntil = undefined;
    }
  }

  private applyPlayerCombatFlag(source: PlayerPrivateState, target: PlayerPrivateState, now: number): void {
    if (this.areDueling(source.id, target.id) || (this.isStarterArena(source.position) && this.isStarterArena(target.position))) {
      return;
    }

    this.clearExpiredPvpFlag(source, now);
    this.playerHitRecords.set(this.playerHitKey(source.id, target.id), now + PLAYER_COMBAT_MS);
    if (target.karma <= 0) {
      source.pvpFlagUntil = Math.max(source.pvpFlagUntil ?? 0, now + PVP_FLAG_MS);
    }
  }

  private playerHitKey(sourceId: string, targetId: string): string {
    return `${sourceId}->${targetId}`;
  }

  private hasRecentPlayerHit(sourceId: string, targetId: string, now = Date.now()): boolean {
    return (this.playerHitRecords.get(this.playerHitKey(sourceId, targetId)) ?? 0) > now;
  }

  private clearPlayerCombatFor(playerId: string): void {
    for (const key of this.playerHitRecords.keys()) {
      if (key.startsWith(`${playerId}->`) || key.endsWith(`->${playerId}`)) {
        this.playerHitRecords.delete(key);
      }
    }
  }

  private cleanupPlayerCombat(now: number): void {
    for (const [key, expiresAt] of this.playerHitRecords.entries()) {
      if (expiresAt <= now) {
        this.playerHitRecords.delete(key);
      }
    }
    for (const [key, expiresAt] of this.pvpXpPairRecords.entries()) {
      if (expiresAt <= now) {
        this.pvpXpPairRecords.delete(key);
      }
    }
    for (const [key, expiresAt] of this.pvpXpTargetLocks.entries()) {
      if (expiresAt <= now) {
        this.pvpXpTargetLocks.delete(key);
      }
    }
    for (const player of this.players.values()) {
      this.clearExpiredPvpFlag(player, now);
    }
  }

  private classifyPlayerKill(killer: PlayerPrivateState, target: PlayerPrivateState, now: number): "pk" | "pvp" | "red" | "duel" | "monster" {
    if (this.areDueling(killer.id, target.id)) {
      return "duel";
    }

    if (this.isStarterArena(killer.position) && this.isStarterArena(target.position)) {
      return "pvp";
    }

    if (target.karma > 0) {
      return "red";
    }

    if (this.isPvpFlagged(target, now) || this.hasRecentPlayerHit(target.id, killer.id, now)) {
      return "pvp";
    }

    return "pk";
  }

  private playerGoldDropRate(kind: "pk" | "pvp" | "red" | "duel" | "monster"): number {
    if (kind === "red") {
      return 0.7;
    }
    if (kind === "pk") {
      return 0.18;
    }
    if (kind === "pvp" || kind === "duel") {
      return 0;
    }
    return 0.12;
  }

  private applyPlayerKillResult(
    killer: PlayerPrivateState,
    target: PlayerPrivateState,
    kind: "pk" | "pvp" | "red" | "duel" | "monster",
    now: number,
    arenaPvpDeath: boolean
  ): { karmaGain?: number } {
    if (kind === "pk") {
      killer.pkCount += 1;
      const karmaGain = this.karmaForPk(killer, target);
      killer.karma += karmaGain;
      killer.pvpFlagUntil = undefined;
      return { karmaGain };
    }

    if (kind === "pvp" || kind === "duel") {
      killer.pvpCount += 1;
      if (kind === "pvp") {
        killer.pvpFlagUntil = Math.max(killer.pvpFlagUntil ?? 0, now + PVP_FLAG_POST_KILL_MS);
      }
      return {};
    }

    if (kind === "red") {
      killer.pvpCount += 1;
      killer.pvpFlagUntil = undefined;
      target.karma = Math.max(0, target.karma - Math.max(160, Math.round(target.karma * 0.18)));
    }
    return {};
  }

  private karmaForPk(killer: PlayerPrivateState, target: PlayerPrivateState): number {
    return Math.round(450 + killer.pkCount * 180 + Math.max(1, target.level) * 35);
  }

  private areDueling(firstId: string, secondId: string): boolean {
    return this.duelByPlayer.get(firstId) === secondId && this.duelByPlayer.get(secondId) === firstId;
  }

  private endDuelFor(playerId: string): void {
    const opponentId = this.duelByPlayer.get(playerId);
    if (!opponentId) {
      return;
    }

    this.duelByPlayer.delete(playerId);
    if (this.duelByPlayer.get(opponentId) === playerId) {
      this.duelByPlayer.delete(opponentId);
    }
  }

  private finishDuel(winner: PlayerPrivateState, loser: PlayerPrivateState): void {
    if (!this.areDueling(winner.id, loser.id)) {
      return;
    }

    this.endDuelFor(winner.id);
  }

  private clearSocialState(playerId: string): void {
    this.clearInvitesForPlayer(playerId, this.partyInvites);
    this.clearInvitesForPlayer(playerId, this.duelInvites);
    this.clearInvitesForPlayer(playerId, this.tradeInvites);
    this.clearInvitesForPlayer(playerId, this.clanInvites);
    this.removePlayerFromParty(playerId);
    this.endDuelFor(playerId);
    this.cancelTradeFor(playerId, false);
    this.clearPlayerCombatFor(playerId);
  }

  private clearInvitesForPlayer<T extends SocialInviteRecord>(playerId: string, invites: Map<string, T>): void {
    for (const [key, invite] of invites.entries()) {
      if (invite.fromId === playerId || invite.toId === playerId) {
        invites.delete(key);
      }
    }
  }

  private cleanupSocialInvites(now: number): void {
    for (const invites of [this.partyInvites, this.duelInvites, this.tradeInvites, this.clanInvites]) {
      for (const [key, invite] of invites.entries()) {
        if (invite.expiresAt <= now || !this.players.has(invite.fromId) || !this.players.has(invite.toId)) {
          invites.delete(key);
        }
      }
    }
    this.cleanupTradeSessions(now);
  }

  private inviteKey(fromId: string, toId: string): string {
    return `${fromId}->${toId}`;
  }

  private clanInviteKey(fromId: string, toId: string, clanId: string): string {
    return `${fromId}->${toId}:${clanId}`;
  }

  private visibleInvites(invites: Map<string, SocialInviteRecord>, viewerId?: string): SocialInvite[] {
    if (!viewerId) {
      return [];
    }

    const now = Date.now();
    return [...invites.values()]
      .filter((invite) => invite.toId === viewerId && invite.expiresAt > now)
      .map((invite) => {
        const from = this.players.get(invite.fromId);
        const to = this.players.get(invite.toId);
        if (!from || !to) {
          return undefined;
        }

        return {
          fromId: from.id,
          fromName: from.name,
          toId: to.id,
          toName: to.name,
          expiresAt: invite.expiresAt
        };
      })
      .filter((invite): invite is SocialInvite => Boolean(invite));
  }

  private visibleClanInvites(viewerId?: string): ClanInvite[] {
    if (!viewerId) {
      return [];
    }

    const now = Date.now();
    return [...this.clanInvites.values()]
      .filter((invite) => invite.toId === viewerId && invite.expiresAt > now)
      .map((invite) => {
        const from = this.players.get(invite.fromId);
        const to = this.players.get(invite.toId);
        const clan = this.clans.get(invite.clanId);
        if (!from || !to || !clan) {
          return undefined;
        }

        return {
          fromId: from.id,
          fromName: from.name,
          toId: to.id,
          toName: to.name,
          expiresAt: invite.expiresAt,
          clanId: clan.id,
          clanName: clan.name,
          clanTag: clan.tag,
          clanEmblem: clan.emblem
        };
      })
      .filter((invite): invite is ClanInvite => Boolean(invite));
  }

  private tradeSessionFor(playerId: string): TradeSessionRecord | undefined {
    const sessionId = this.tradeByPlayer.get(playerId);
    return sessionId ? this.tradeSessions.get(sessionId) : undefined;
  }

  private resetTradeReady(session: TradeSessionRecord): void {
    for (const offer of session.offers.values()) {
      offer.ready = false;
    }
  }

  private cancelTradeFor(playerId: string, announce: boolean): boolean {
    const session = this.tradeSessionFor(playerId);
    if (!session) {
      return false;
    }

    this.cancelTradeSession(session, announce);
    return true;
  }

  private cancelTradeSession(session: TradeSessionRecord, announce: boolean): void {
    this.tradeSessions.delete(session.id);
    for (const playerId of session.playerIds) {
      this.tradeByPlayer.delete(playerId);
    }
    if (announce) {
      const names = session.playerIds.map((playerId) => this.players.get(playerId)?.name).filter(Boolean).join(" and ");
      if (names) {
        this.systemChat(`Trade between ${names} was cancelled.`);
      }
    }
  }

  private cleanupTradeSessions(now: number): void {
    for (const session of [...this.tradeSessions.values()]) {
      if (session.expiresAt <= now || session.playerIds.some((playerId) => !this.players.has(playerId))) {
        this.cancelTradeSession(session, true);
      }
    }
  }

  private publicTradeFor(viewerId?: string): TradeSessionState | undefined {
    if (!viewerId) {
      return undefined;
    }
    const session = this.tradeSessionFor(viewerId);
    return session ? this.publicTradeSession(session) : undefined;
  }

  private publicTradeSession(session: TradeSessionRecord): TradeSessionState | undefined {
    const [leftId, rightId] = session.playerIds;
    const left = this.players.get(leftId);
    const right = this.players.get(rightId);
    const leftOffer = session.offers.get(leftId);
    const rightOffer = session.offers.get(rightId);
    if (!left || !right || !leftOffer || !rightOffer) {
      return undefined;
    }

    return {
      id: session.id,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      left: {
        playerId: left.id,
        playerName: left.name,
        gold: leftOffer.gold,
        items: leftOffer.items,
        ready: leftOffer.ready
      },
      right: {
        playerId: right.id,
        playerName: right.name,
        gold: rightOffer.gold,
        items: rightOffer.items,
        ready: rightOffer.ready
      }
    };
  }

  private finalizeTradeSession(session: TradeSessionRecord): string[] {
    const [leftId, rightId] = session.playerIds;
    const left = this.players.get(leftId);
    const right = this.players.get(rightId);
    const leftOffer = session.offers.get(leftId);
    const rightOffer = session.offers.get(rightId);
    if (!left || !right || !leftOffer || !rightOffer) {
      this.cancelTradeSession(session, false);
      return [];
    }

    const leftTransfers = this.tradeTransfers(left, leftOffer);
    const rightTransfers = this.tradeTransfers(right, rightOffer);
    if (!leftTransfers || !rightTransfers || left.gold < leftOffer.gold || right.gold < rightOffer.gold) {
      this.resetTradeReady(session);
      this.systemChat("Trade failed because an offered item or gold changed.");
      return [];
    }

    left.gold = left.gold - leftOffer.gold + rightOffer.gold;
    right.gold = right.gold - rightOffer.gold + leftOffer.gold;
    this.removeTradeTransfers(left, leftTransfers);
    this.removeTradeTransfers(right, rightTransfers);
    for (const transfer of leftTransfers) {
      this.addInventoryItem(right, transfer.item);
    }
    for (const transfer of rightTransfers) {
      this.addInventoryItem(left, transfer.item);
    }

    this.cancelTradeSession(session, false);
    this.saveCharacter(left);
    this.saveCharacter(right);
    this.event(left.id, right.id, leftOffer.gold + rightOffer.gold, "loot", `${left.name} and ${right.name} completed trade.`);
    this.systemChat(`${left.name} and ${right.name} completed trade.`);
    return [left.id, right.id];
  }

  private tradeTransfers(player: PlayerPrivateState, offer: TradeOfferRecord): Array<{ inventoryIndex: number; item: InventoryItem; quantity: number }> | undefined {
    if (offer.gold < 0 || offer.gold > player.gold) {
      return undefined;
    }

    const grouped = new Map<number, { quantity: number; item: InventoryItem }>();
    for (const entry of offer.items) {
      const current = player.inventory[entry.inventoryIndex];
      const quantity = Math.max(1, Math.trunc(entry.quantity));
      if (!current || !this.tradeItemMatches(current, entry.item) || (!current.stackable && quantity !== 1)) {
        return undefined;
      }

      const existing = grouped.get(entry.inventoryIndex);
      grouped.set(entry.inventoryIndex, {
        quantity: (existing?.quantity ?? 0) + quantity,
        item: this.cloneInventoryItem(current, (existing?.quantity ?? 0) + quantity)
      });
    }

    const transfers = [...grouped.entries()].map(([inventoryIndex, group]) => {
      const current = player.inventory[inventoryIndex];
      if (!current || group.quantity > current.quantity || (!current.stackable && group.quantity !== 1)) {
        return undefined;
      }
      return {
        inventoryIndex,
        quantity: group.quantity,
        item: this.cloneInventoryItem(current, group.quantity)
      };
    });
    if (transfers.some((transfer) => !transfer)) {
      return undefined;
    }
    return transfers.filter((transfer): transfer is { inventoryIndex: number; item: InventoryItem; quantity: number } => Boolean(transfer));
  }

  private tradeItemMatches(current: InventoryItem, offered: InventoryItem): boolean {
    return (
      current.id === offered.id &&
      current.stackable === offered.stackable &&
      current.slot === offered.slot &&
      current.grade === offered.grade &&
      current.classId === offered.classId &&
      current.appearance === offered.appearance &&
      (current.enchantLevel ?? 0) === (offered.enchantLevel ?? 0)
    );
  }

  private removeTradeTransfers(player: PlayerPrivateState, transfers: Array<{ inventoryIndex: number; quantity: number }>): void {
    for (const transfer of [...transfers].sort((first, second) => second.inventoryIndex - first.inventoryIndex)) {
      const item = player.inventory[transfer.inventoryIndex];
      if (!item) {
        continue;
      }
      if (item.stackable) {
        item.quantity -= transfer.quantity;
        if (item.quantity <= 0) {
          player.inventory.splice(transfer.inventoryIndex, 1);
        }
      } else {
        player.inventory.splice(transfer.inventoryIndex, 1);
      }
    }
  }

  private publicClans(): ClanPublicInfo[] {
    return [...this.clans.values()]
      .map((clan) => {
        const members = clan.members.map((member) => {
          const online = this.onlinePlayerByCharacterId(member.characterId);
          return {
            characterId: member.characterId,
            playerId: online?.id,
            name: online?.name ?? member.name,
            classId: online?.classId ?? member.classId,
            level: online?.level ?? member.level,
            role: member.role,
            online: Boolean(online)
          };
        });
        return {
          id: clan.id,
          name: clan.name,
          tag: clan.tag,
          emblem: clan.emblem,
          leaderCharacterId: clan.leaderCharacterId,
          leaderName: clan.leaderName,
          memberCount: members.length,
          onlineCount: members.filter((member) => member.online).length,
          members: members.sort((first, second) => Number(second.online) - Number(first.online) || (first.role === "leader" ? -1 : second.role === "leader" ? 1 : first.name.localeCompare(second.name)))
        };
      })
      .sort((first, second) => second.onlineCount - first.onlineCount || first.name.localeCompare(second.name));
  }

  private clanByName(name: string): PersistedClan | undefined {
    const key = this.nameKey(name);
    return [...this.clans.values()].find((clan) => this.nameKey(clan.name) === key);
  }

  private clanIdForCharacter(characterId: string): string | undefined {
    return [...this.clans.values()].find((clan) => clan.members.some((member) => member.characterId === characterId))?.id;
  }

  private clanRoleFor(player: PlayerPrivateState): ClanRole | undefined {
    const clan = player.clanId ? this.clans.get(player.clanId) : undefined;
    return clan?.members.find((member) => member.characterId === player.characterId)?.role;
  }

  private onlinePlayerByCharacterId(characterId: string): PlayerPrivateState | undefined {
    return [...this.players.values()].find((player) => player.characterId === characterId);
  }

  private addClanMember(clan: PersistedClan, player: PlayerPrivateState, role: ClanRole): void {
    const existing = clan.members.find((member) => member.characterId === player.characterId);
    if (existing) {
      existing.name = player.name;
      existing.level = player.level;
      existing.classId = player.classId;
      existing.role = role;
      return;
    }
    clan.members.push({
      characterId: player.characterId,
      name: player.name,
      level: player.level,
      classId: player.classId,
      role,
      joinedAt: Date.now()
    });
  }

  private removeClanMember(clan: PersistedClan, characterId: string): void {
    clan.members = clan.members.filter((member) => member.characterId !== characterId);
    this.clearClanInvitesForCharacter(characterId);
  }

  private clearClanInvitesForCharacter(characterId: string): void {
    const player = this.onlinePlayerByCharacterId(characterId);
    if (!player) {
      return;
    }
    this.clearInvitesForPlayer(player.id, this.clanInvites);
  }

  private sanitizeClanName(value: string): string {
    return value.replace(/[^a-zA-Z0-9 _-]/g, "").replace(/\s+/g, " ").trim().slice(0, 22);
  }

  private clanTagFor(name: string): string {
    const words = name.split(/[\s_-]+/).filter(Boolean);
    const initials = words.map((word) => word[0]).join("").toUpperCase();
    const fallback = name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    return (initials.length >= 2 ? initials : fallback).slice(0, 4) || "CLN";
  }

  private validClanEmblem(emblem: ClanEmblem): ClanEmblem {
    return (["crown", "sword", "shield", "star", "moon", "flame"] as ClanEmblem[]).includes(emblem) ? emblem : "shield";
  }

  teleport(playerId: string, teleportId: TeleportId): boolean {
    const player = this.players.get(playerId);
    const teleport = TELEPORT_DEFINITIONS.find((candidate) => candidate.id === teleportId);
    if (!player || !teleport) {
      return false;
    }

    if (this.distance(player.position, teleport.position) > teleport.radius + 260) {
      return false;
    }

	    const destination =
	      "destinationCityId" in teleport
	        ? this.randomCityRespawnPosition(CITY_DEFINITIONS.find((city) => city.id === teleport.destinationCityId) ?? this.nearestCityDefinition(teleport.destination))
	        : "destinationLandmarkId" in teleport && teleport.destinationLandmarkId === "blood-ring"
	          ? this.arenaTeleportArrivalPosition(player.position)
	          : teleport.destination;
    this.returnPlayerMarketListings(player);
    this.cancelTradeFor(player.id, true);
	    player.position = this.clampPosition(destination);
    player.velocity = { x: 0, y: 0 };
    player.zone = this.zoneFor(player.position);
    this.event(player.id, player.id, 0, "loot", `${player.name} teleported to ${teleport.label}.`);
    this.saveCharacter(player);
    return true;
  }

  enterDungeon(playerId: string, landmarkId: string): boolean {
    const player = this.players.get(playerId);
    const landmark = WORLD_LANDMARKS.find((candidate) => candidate.id === landmarkId && (candidate.kind === "dungeon" || candidate.kind === "cave"));
    const dungeon = WORLD_DUNGEON_INTERIORS.find((candidate) => candidate.landmarkId === landmarkId);
    if (!player || !landmark || !dungeon || player.hp <= 0 || player.downed) {
      return false;
    }
    if (this.distance(player.position, this.dungeonEntrancePortalPosition(landmark)) > DUNGEON_PORTAL_USE_RANGE) {
      return false;
    }

    this.returnPlayerMarketListings(player);
    this.cancelTradeFor(player.id, true);
    this.placePlayerAfterDungeonTravel(player, dungeon.start, `${player.name} entered ${dungeon.label}.`);
    return true;
  }

  exitDungeon(playerId: string, dungeonId: string, exit: "start" | "end"): boolean {
    const player = this.players.get(playerId);
    const dungeon = WORLD_DUNGEON_INTERIORS.find((candidate) => candidate.id === dungeonId);
    const landmark = dungeon ? WORLD_LANDMARKS.find((candidate) => candidate.id === dungeon.landmarkId) : undefined;
    if (!player || !dungeon || !landmark || player.hp <= 0 || player.downed) {
      return false;
    }

    const portal = exit === "end" ? dungeon.end : dungeon.start;
    if (this.distance(player.position, portal) > DUNGEON_PORTAL_USE_RANGE) {
      return false;
    }

    const destination = this.pushOutOfWorldObstacles(this.clampPosition({
      x: landmark.position.x + (exit === "end" ? 190 : -190),
      y: landmark.position.y + landmark.radius + 230
    }));
    this.returnPlayerMarketListings(player);
    this.placePlayerAfterDungeonTravel(player, destination, `${player.name} left ${dungeon.label}.`);
    return true;
  }

  private placePlayerAfterDungeonTravel(player: PlayerPrivateState, position: Vector2, message: string): void {
    player.position = this.clampPosition(position);
    player.velocity = { x: 0, y: 0 };
    player.facing = { x: 0, y: -1 };
    player.input = this.emptyInput();
    player.zone = this.zoneFor(player.position);
    this.event(player.id, player.id, 0, "loot", message);
    this.saveCharacter(player);
  }

  chatHistory(): ChatMessage[] {
    return this.chatMessages.filter((message) => message.channel !== "system" || Boolean(message.recipientId)).slice(-40);
  }

  drainBroadcastChats(): ChatMessage[] {
    return this.pendingBroadcastChats.splice(0, this.pendingBroadcastChats.length);
  }

  inventory(playerId: string): { items: InventoryItem[]; equipment: EquipmentState; stats: DerivedStats; gold: number; wallet: WalletState } | undefined {
    const player = this.players.get(playerId);
    if (!player) {
      return undefined;
    }

    return {
      items: player.inventory,
      equipment: player.equipment,
      stats: player.stats,
      gold: player.gold,
      wallet: player.wallet
    };
  }

  equipItem(playerId: string, itemId: string, requestedSlot?: EquipmentSlot): boolean {
    const player = this.players.get(playerId);
    const itemIndex = player?.inventory.findIndex((candidate) => candidate.id === itemId) ?? -1;
    const item = itemIndex >= 0 ? player?.inventory[itemIndex] : undefined;
    if (!player || itemIndex < 0 || !item?.slot) {
      return false;
    }

    const slot = this.preferredEquipSlot(player, item, requestedSlot ?? item.slot);
    if (!this.canEquipToSlot(player, item, slot)) {
      return false;
    }

    player.inventory.splice(itemIndex, 1);
    const previous = player.equipment[slot];
    if (previous) {
      this.addInventoryItem(player, previous);
    }
    player.equipment[slot] = item;
    this.recalculateStats(player);
    this.saveCharacter(player);
    return true;
  }

  unequipItem(playerId: string, slot: EquipmentSlot): boolean {
    const player = this.players.get(playerId);
    if (!player || !player.equipment[slot]) {
      return false;
    }

    const item = player.equipment[slot];
    delete player.equipment[slot];
    this.addInventoryItem(player, item);
    this.recalculateStats(player);
    this.saveCharacter(player);
    return true;
  }

  useItem(playerId: string, itemId: string): boolean {
    const player = this.players.get(playerId);
    const itemIndex = player?.inventory.findIndex((candidate) => candidate.id === itemId) ?? -1;
    const item = itemIndex >= 0 ? player?.inventory[itemIndex] : undefined;
    if (!player || player.hp <= 0 || !item?.consumable || item.quantity <= 0) {
      return false;
    }

    const now = Date.now();
    if (now - player.lastConsumableAt < 8500) {
      return false;
    }

    const hpBefore = player.hp;
    const mpBefore = player.mp;
    player.hp = Math.min(player.maxHp, player.hp + (item.consumable.hp ?? 0));
    player.mp = Math.min(player.maxMp, player.mp + (item.consumable.mp ?? 0));
    if (player.hp === hpBefore && player.mp === mpBefore) {
      return false;
    }

    player.lastConsumableAt = now;
    item.quantity -= 1;
    if (item.quantity <= 0) {
      player.inventory.splice(itemIndex, 1);
    }
    this.event(player.id, player.id, Math.max(player.hp - hpBefore, player.mp - mpBefore), "claim", `${player.name} used ${item.label}.`);
    this.saveCharacter(player);
    return true;
  }

  sellInventoryItem(playerId: string, itemId: string): boolean {
    const player = this.players.get(playerId);
    const itemIndex = player?.inventory.findIndex((candidate) => candidate.id === itemId) ?? -1;
    const item = itemIndex >= 0 ? player?.inventory[itemIndex] : undefined;
    if (!player || !item || itemIndex < 0 || player.hp <= 0 || player.zone !== "safe") {
      return false;
    }

    const unitValue = this.itemSellValue(item);
    if (unitValue <= 0) {
      return false;
    }

    const quantity = Math.max(1, item.stackable ? item.quantity : 1);
    const gold = unitValue * quantity;
    player.inventory.splice(itemIndex, 1);
    player.gold += gold;
    this.event(player.id, player.id, gold, "loot", `${player.name} sold ${quantity} ${item.label} for ${gold} gold.`);
    this.saveCharacter(player);
    return true;
  }

  openResource(playerId: string, resourceId: string): boolean {
    const player = this.players.get(playerId);
    const resource = this.resources.get(resourceId);
    const now = Date.now();
    if (!player || player.hp <= 0 || player.downed || !resource || resource.remaining <= 0 || resource.respawnsAt) {
      return false;
    }

    const openRange = resource.kind === "chest" ? 180 : 145;
    if (this.distance(player.position, resource.position) > openRange) {
      return false;
    }

    resource.remaining = Math.max(0, resource.remaining - 1);
    if (resource.remaining <= 0) {
      resource.respawnsAt =
        now +
        (resource.kind === "chest"
          ? this.randomBetween(CHEST_RESPAWN_MIN_MS, CHEST_RESPAWN_MAX_MS)
          : this.randomBetween(80_000, 160_000));
    }

    if (resource.kind === "chest") {
      const gold = Math.round(this.randomBetween(18, 65) + Math.max(1, player.level) * this.randomBetween(2.5, 7.5));
      player.gold += gold;
      const item = this.randomChestItem(player);
      if (item) {
        this.addItem(player, item.id, item.quantity);
      }
      const itemText = item ? ` and ${item.quantity} ${item.label}` : "";
      const message = `${player.name} opened a chest: ${gold} gold${itemText}.`;
      this.event(player.id, resource.id, gold, "loot", message);
      this.lootSystemChat(player, message);
      this.saveCharacter(player);
      return true;
    }

    const itemId = this.resourceLootItem(resource.kind);
    this.addItem(player, itemId, 1);
    const message = `${player.name} gathered ${itemId}.`;
    this.event(player.id, resource.id, 1, "loot", message);
    this.lootSystemChat(player, message);
    this.saveCharacter(player);
    return true;
  }

  pickupGroundItem(playerId: string, itemId: string): boolean {
    const player = this.players.get(playerId);
    const item = this.groundItems.get(itemId);
    const now = Date.now();
    if (!player || player.hp <= 0 || player.downed || !item || item.expiresAt <= now) {
      return false;
    }

    if (item.ownerId && item.ownerId !== player.id && now < this.groundItemOwnerUnlockAt(item)) {
      return false;
    }

    if (this.distance(player.position, item.position) > GROUND_ITEM_PICKUP_RANGE) {
      return false;
    }

    this.groundItems.delete(item.id);
    if (item.kind === "gold") {
      player.gold += item.quantity;
    } else if (item.kind === "coin") {
      this.addItem(player, "arena-coin", item.quantity);
    } else if (item.item) {
      this.addInventoryItem(player, { ...item.item, quantity: item.quantity });
    }

    this.event(player.id, item.id, item.quantity, "loot", `${player.name} picked up ${item.quantity} ${item.label}.`);
    this.lootSystemChat(player, `${player.name} picked up ${item.quantity} ${item.label}.`);
    this.saveCharacter(player);
    return true;
  }

  enchantItem(playerId: string, itemId: string, requestedSlot?: EquipmentSlot): boolean {
    const player = this.players.get(playerId);
    if (!player || player.hp <= 0) {
      return false;
    }

    const target = this.findEnchantTarget(player, itemId, requestedSlot);
    const maxEnchantLevel = this.maxEnchantLevel(target);
    if (!target || maxEnchantLevel <= 0 || (target.enchantLevel ?? 0) >= maxEnchantLevel) {
      return false;
    }

    const scrollIds = this.enchantScrollIds(target);
    const scrollIndex = player.inventory.findIndex((candidate) => scrollIds.includes(candidate.id) && candidate.quantity > 0);
    if (scrollIndex < 0) {
      this.event(player.id, player.id, 0, "loot", `${player.name} needs ${this.itemLabel(scrollIds[0])}.`);
      return false;
    }

    const currentLevel = target.enchantLevel ?? 0;
    target.enchantLevel = Math.min(maxEnchantLevel, currentLevel + 1);
    target.enchantable = true;
    const scroll = player.inventory[scrollIndex];
    scroll.quantity -= 1;
    if (scroll.quantity <= 0) {
      player.inventory.splice(scrollIndex, 1);
    }

    this.recalculateStats(player);
    this.event(player.id, player.id, target.enchantLevel, "loot", `${player.name} enchanted ${target.label} to +${target.enchantLevel}.`);
    this.saveCharacter(player);
    return true;
  }

  buyShopItem(playerId: string, itemId: string): boolean {
    const player = this.players.get(playerId);
    const offer = SHOP_CATALOG.find((candidate) => candidate.id === itemId);
    if (!player || !offer || player.hp <= 0 || player.zone !== "safe") {
      return false;
    }
    const priceItemQuantity = offer.priceItemId ? Math.max(1, offer.priceItemQuantity ?? 1) : 0;
    const priceItemIndex = offer.priceItemId ? player.inventory.findIndex((candidate) => candidate.id === offer.priceItemId && candidate.quantity >= priceItemQuantity) : -1;
    if (offer.priceItemId && priceItemIndex < 0) {
      this.event(player.id, player.id, 0, "loot", `${player.name} needs ${priceItemQuantity} ${this.itemLabel(offer.priceItemId)} for ${offer.item.label}.`);
      return false;
    }
    if (!offer.priceItemId && player.gold < offer.priceGold) {
      this.event(player.id, player.id, 0, "loot", `${player.name} needs ${offer.priceGold} gold for ${offer.item.label}.`);
      return false;
    }
    if ((offer.item.requiredLevel ?? 1) > player.level) {
      this.event(player.id, player.id, 0, "loot", `${offer.item.label} requires Lv.${offer.item.requiredLevel}.`);
      return false;
    }

    if (offer.priceItemId) {
      const priceItem = player.inventory[priceItemIndex];
      priceItem.quantity -= priceItemQuantity;
      if (priceItem.quantity <= 0) {
        player.inventory.splice(priceItemIndex, 1);
      }
    } else {
      player.gold -= offer.priceGold;
    }
    if (offer.grantGold && offer.grantGold > 0) {
      player.gold += offer.grantGold;
      this.event(player.id, player.id, offer.grantGold, "loot", `${player.name} exchanged ${priceItemQuantity} ${this.itemLabel(offer.priceItemId ?? "")} for ${offer.grantGold} gold.`);
      this.saveCharacter(player);
      return true;
    }

    this.addInventoryItem(player, { ...offer.item });
    this.event(player.id, player.id, offer.priceItemId ? priceItemQuantity : offer.priceGold, "loot", `${player.name} bought ${offer.item.label}.`);
    this.saveCharacter(player);
    return true;
  }

  marketListItem(playerId: string, inventoryIndex: number, quantity: number, priceGold: number): boolean {
    const player = this.players.get(playerId);
    const index = Math.trunc(inventoryIndex);
    const item = player?.inventory[index];
    const price = Math.max(1, Math.min(MARKET_MAX_PRICE_GOLD, Math.trunc(Number.isFinite(priceGold) ? priceGold : 0)));
    if (
      !player ||
      this.botBrains.has(player.id) ||
      !item ||
      player.hp <= 0 ||
      player.downed ||
      !this.isPlayerAtMarket(player) ||
      (player.marketVendor?.items.length ?? 0) >= MARKET_MAX_LISTINGS
    ) {
      return false;
    }

    const listingQuantity = item.stackable ? Math.max(1, Math.min(item.quantity, Math.trunc(quantity))) : 1;
    const listedItem = this.cloneInventoryItem(item, listingQuantity);
    if (item.stackable) {
      item.quantity -= listingQuantity;
      if (item.quantity <= 0) {
        player.inventory.splice(index, 1);
      }
    } else {
      player.inventory.splice(index, 1);
    }

    const vendor: MarketVendorState = player.marketVendor?.playerOwned
      ? player.marketVendor
      : {
          title: `${player.name}'s stall`,
          items: [],
          sinceAt: Date.now(),
          playerOwned: true
        };
    vendor.items.push({
      listingId: this.createId("listing"),
      sellerId: player.id,
      sellerName: player.name,
      item: listedItem,
      quantity: listingQuantity,
      priceGold: price,
      source: "player"
    });
    player.marketVendor = vendor;
    player.sitting = true;
    player.velocity = { x: 0, y: 0 };
    player.input = this.emptyInput();
    player.zone = "safe";
    this.event(player.id, player.id, price, "loot", `${player.name} listed ${listedItem.label} for ${price} gold.`);
    this.queueMarketNotice(player, `Market: Listed ${listedItem.label} for ${price} gold.`);
    this.saveCharacter(player);
    return true;
  }

  marketCancelListing(playerId: string, listingId?: string): boolean {
    const player = this.players.get(playerId);
    const vendor = player?.marketVendor;
    if (!player || !vendor?.playerOwned || vendor.items.length === 0) {
      return false;
    }

    const returning = listingId ? vendor.items.filter((listing) => listing.listingId === listingId) : [...vendor.items];
    if (returning.length === 0) {
      return false;
    }

    for (const listing of returning) {
      this.addInventoryItem(player, this.cloneInventoryItem(listing.item, listing.quantity));
    }
    vendor.items = vendor.items.filter((listing) => !returning.some((candidate) => candidate.listingId === listing.listingId));
    if (vendor.items.length === 0) {
      player.marketVendor = undefined;
      player.sitting = false;
    }
    this.saveCharacter(player);
    return true;
  }

  buyMarketItem(buyerId: string, sellerId: string, listingId: string): string[] {
    const buyer = this.players.get(buyerId);
    const seller = this.players.get(sellerId);
    const vendor = seller?.marketVendor;
    const listingIndex = vendor?.items.findIndex((item) => item.listingId === listingId) ?? -1;
    const listing = listingIndex >= 0 ? vendor?.items[listingIndex] : undefined;
    if (
      !buyer ||
      !seller ||
      !vendor ||
      !listing ||
      buyer.id === seller.id ||
      buyer.hp <= 0 ||
      buyer.downed ||
      this.distance(buyer.position, seller.position) > MARKET_BUY_RANGE ||
      buyer.gold < listing.priceGold ||
      (listing.item.requiredLevel ?? 1) > buyer.level
    ) {
      return [];
    }

    buyer.gold -= listing.priceGold;
    seller.gold += listing.priceGold;
    this.addInventoryItem(buyer, this.cloneInventoryItem(listing.item, listing.quantity));
    vendor.items.splice(listingIndex, 1);
    if (vendor.items.length === 0 && vendor.playerOwned) {
      seller.marketVendor = undefined;
      seller.sitting = false;
    }
    this.event(buyer.id, seller.id, listing.priceGold, "loot", `${buyer.name} bought ${listing.item.label} from ${seller.name}.`);
    this.queueMarketNotice(buyer, `Market: Bought ${listing.item.label} for ${listing.priceGold} gold.`);
    if (!this.botBrains.has(seller.id)) {
      this.queueMarketNotice(seller, `Market: Sold ${listing.item.label} for ${listing.priceGold} gold.`);
      this.saveCharacter(seller);
    }
    this.saveCharacter(buyer);
    if (!this.botBrains.has(seller.id) && seller.offlineMarketSeller && !seller.marketVendor?.items.length) {
      this.players.delete(seller.id);
      this.systemChat(`${seller.name}'s market stall sold out.`);
    }
    return [buyer.id, seller.id];
  }

  respawnAtLastSafe(playerId: string): boolean {
    const player = this.players.get(playerId);
    if (!player || player.hp > 0) {
      return false;
    }

    this.respawnPlayer(player);
    this.event(player.id, player.id, 0, "revive", `${player.name} resurrected at the nearest town.`);
    this.systemChat(`${player.name} resurrected in town.`);
    this.saveCharacter(player);
    return true;
  }

  revivePlayer(sourceId: string, targetId: string): boolean {
    const source = this.players.get(sourceId);
    const target = this.players.get(targetId);
    const now = Date.now();
    if (!source || !target || source.id === target.id || source.hp <= 0 || target.hp > 0 || !target.downed) {
      return false;
    }

    if ((target.revivableUntil ?? 0) < now || this.distance(source.position, target.position) > 115) {
      return false;
    }

    target.hp = Math.max(1, Math.round(target.maxHp * 0.28));
    target.cp = Math.max(0, Math.round(target.maxCp * 0.24));
    target.mp = Math.max(0, Math.round(target.maxMp * 0.2));
    target.velocity = { x: 0, y: 0 };
    target.input = this.emptyInput();
    target.lastAttackAt = now;
    target.downed = false;
    target.revivableUntil = undefined;
    target.deathReturnPosition = undefined;
    const targetBrain = this.botBrains.get(target.id);
    if (targetBrain) {
      targetBrain.respawnAt = undefined;
      targetBrain.chillUntil = now + this.randomBetween(1_800, 6_500);
      if (Math.random() < 0.34) {
        this.queueBotChat(target, targetBrain, this.randomBotLine(targetBrain, BOT_REVIVED_CHAT_LINES), "local", true, 1_100, 5_600);
      }
    }
    const sourceBrain = this.botBrains.get(source.id);
    if (sourceBrain && Math.random() < 0.22) {
      this.queueBotChat(source, sourceBrain, this.randomBotLine(sourceBrain, BOT_REVIVE_CHAT_LINES), "local", true, 700, 2_800);
    }
    this.event(source.id, target.id, 0, "revive", `${source.name} resurrected ${target.name}.`);
    this.systemChat(`${source.name} resurrected ${target.name}.`);
    this.saveCharacter(target);
    return true;
  }

  snapshot(viewerId?: string, options: SnapshotOptions = {}): GameSnapshot {
    this.cleanupSocialInvites(Date.now());
    const viewer = viewerId ? this.players.get(viewerId) : undefined;
    const playerRadius = options.playerRadius ?? SNAPSHOT_PLAYER_RADIUS;
    const monsterRadius = options.monsterRadius ?? SNAPSHOT_MONSTER_RADIUS;
    const resourceRadius = options.resourceRadius ?? SNAPSHOT_RESOURCE_RADIUS;
    const groundItemRadius = options.groundItemRadius ?? SNAPSHOT_GROUND_ITEM_RADIUS;
    const includeSocialDistantPlayers = options.includeSocialDistantPlayers ?? true;
    const canSeePosition = (position: Vector2, radius: number) => {
      if (!viewer) {
        return true;
      }

      return this.distance(viewer.position, position) <= radius;
    };
    const viewerPartyId = viewer ? this.partyByPlayer.get(viewer.id) : undefined;
    const isViewerPartyMember = (player: PlayerPrivateState) =>
      Boolean(viewer && player.id !== viewer.id && viewerPartyId && this.partyByPlayer.get(player.id) === viewerPartyId);
    const canAlwaysSeePlayer = (player: PlayerPrivateState) =>
      Boolean(
        viewer &&
          player.id !== viewer.id &&
          (isViewerPartyMember(player) || (includeSocialDistantPlayers && viewer.clanId && player.clanId === viewer.clanId))
      );
    const playerStates = this.limitSnapshotPlayers(
      [...this.players.values()].filter((player) => !viewer || player.id === viewer.id || canAlwaysSeePlayer(player) || canSeePosition(player.position, playerRadius)),
      viewer,
      viewerPartyId,
      options.maxPlayers
    );
    const monsterStates = this.limitSnapshotByDistance(
      [...this.monsters.values()].filter((monster) => canSeePosition(monster.position, monsterRadius)),
      viewer,
      options.maxMonsters
    );
    const resourceStates = this.limitSnapshotByDistance(
      [...this.resources.values()].filter((resource) => canSeePosition(resource.position, resourceRadius)),
      viewer,
      options.maxResources
    );
    const groundItemStates = this.limitSnapshotByDistance(
      [...this.groundItems.values()].filter((item) => canSeePosition(item.position, groundItemRadius)),
      viewer,
      options.maxGroundItems
    );
    const visibleMonsterIds = new Set(monsterStates.map((monster) => monster.id));
    for (const item of groundItemStates) {
      if (!item.sourceId || visibleMonsterIds.has(item.sourceId)) {
        continue;
      }
      const sourceMonster = this.monsters.get(item.sourceId);
      if (sourceMonster && canSeePosition(sourceMonster.position, monsterRadius + 180)) {
        monsterStates.push(sourceMonster);
        visibleMonsterIds.add(sourceMonster.id);
      }
    }
    const visibleEntityIds = new Set([...playerStates.map((player) => player.id), ...monsterStates.map((monster) => monster.id)]);
    const events = this.snapshotEvents(viewer, options, visibleEntityIds);
    const eventEntityRadius = Math.max(playerRadius, monsterRadius, options.eventRadius ?? 0) + 260;
    let extraEventPlayers = 0;
    let extraEventMonsters = 0;
    for (const event of events) {
      for (const entityId of [event.sourceId, event.targetId]) {
        if (visibleEntityIds.has(entityId)) {
          continue;
        }

        const monster = this.monsters.get(entityId);
        if (monster && extraEventMonsters < 8 && canSeePosition(monster.position, eventEntityRadius)) {
          monsterStates.push(monster);
          visibleEntityIds.add(monster.id);
          extraEventMonsters += 1;
          continue;
        }

        const player = this.players.get(entityId);
        if (player && extraEventPlayers < 4 && canSeePosition(player.position, eventEntityRadius)) {
          playerStates.push(player);
          visibleEntityIds.add(player.id);
          extraEventPlayers += 1;
        }
      }
    }

    return {
      serverTime: Date.now(),
      tick: this.tick,
      onlineCount: this.players.size,
      players: playerStates.map((player) => this.publicPlayer(player)),
      monsters: monsterStates,
      resources: resourceStates,
      groundItems: groundItemStates,
      events,
      partyInvites: this.visibleInvites(this.partyInvites, viewerId),
      duelInvites: this.visibleInvites(this.duelInvites, viewerId),
      tradeInvites: this.visibleInvites(this.tradeInvites, viewerId),
      activeTrade: this.publicTradeFor(viewerId),
      clanInvites: this.visibleClanInvites(viewerId),
      clans: this.publicClans(),
      arenaSeason: this.arenaSeasonState()
    };
  }

  private limitSnapshotPlayers(
    players: PlayerPrivateState[],
    viewer: PlayerPrivateState | undefined,
    viewerPartyId: string | undefined,
    limit: number | undefined
  ): PlayerPrivateState[] {
    if (!viewer || !limit || players.length <= limit) {
      return players;
    }

    return [...players]
      .sort((a, b) => {
        const priorityA = this.snapshotPlayerPriority(a, viewer, viewerPartyId);
        const priorityB = this.snapshotPlayerPriority(b, viewer, viewerPartyId);
        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }
        return this.distanceSq(a.position, viewer.position) - this.distanceSq(b.position, viewer.position);
      })
      .slice(0, limit);
  }

  private snapshotPlayerPriority(player: PlayerPrivateState, viewer: PlayerPrivateState, viewerPartyId: string | undefined): number {
    if (player.id === viewer.id) {
      return 0;
    }
    if (viewerPartyId && this.partyByPlayer.get(player.id) === viewerPartyId) {
      return 1;
    }
    if (viewer.clanId && player.clanId === viewer.clanId) {
      return 2;
    }
    if (player.downed || player.hp <= 0) {
      return 3;
    }
    return 4;
  }

  private limitSnapshotByDistance<T extends { position: Vector2 }>(
    items: T[],
    viewer: PlayerPrivateState | undefined,
    limit: number | undefined
  ): T[] {
    if (!viewer || !limit || items.length <= limit) {
      return items;
    }

    return [...items]
      .sort((a, b) => this.distanceSq(a.position, viewer.position) - this.distanceSq(b.position, viewer.position))
      .slice(0, limit);
  }

  private snapshotEvents(viewer: PlayerPrivateState | undefined, options: SnapshotOptions, visibleEntityIds: Set<string>): CombatEvent[] {
    const limit = options.eventLimit ?? 12;
    if (!options.mobile || !viewer) {
      return this.recentEvents.slice(-limit);
    }

    const radius = options.eventRadius ?? options.playerRadius ?? SNAPSHOT_PLAYER_RADIUS;
    const radiusSq = radius * radius;
    return this.recentEvents
      .filter((event) => {
        if (event.sourceId === viewer.id || event.targetId === viewer.id) {
          return true;
        }
        if (!visibleEntityIds.has(event.sourceId) && !visibleEntityIds.has(event.targetId)) {
          return false;
        }

        const sourcePosition = this.snapshotEntityPosition(event.sourceId);
        const targetPosition = this.snapshotEntityPosition(event.targetId);
        return (
          Boolean(sourcePosition && this.distanceSq(sourcePosition, viewer.position) <= radiusSq) ||
          Boolean(targetPosition && this.distanceSq(targetPosition, viewer.position) <= radiusSq)
        );
      })
      .slice(-limit);
  }

  private snapshotEntityPosition(entityId: string): Vector2 | undefined {
    return this.players.get(entityId)?.position ?? this.monsters.get(entityId)?.position;
  }

  private updateSingerNpcs(now: number): void {
    if (this.singerNpcsHiddenByAdmin) {
      this.hideSingerNpcs();
      return;
    }

    const activeNpc = this.activeSingerNpc();
    if (activeNpc) {
      const definition = this.singerDefinitionForNpcId(activeNpc.id);
      const shouldLeave =
        !definition ||
        this.isRealSingerOnline(definition.name) ||
        activeNpc.hp <= 0 ||
        activeNpc.downed ||
        Boolean(activeNpc.singing && (activeNpc.singingNextTrackAt ?? 0) <= now);

      if (shouldLeave) {
        this.despawnSingerNpc(activeNpc.id);
      } else {
        const brain = this.singerNpcs.get(activeNpc.id);
        if (definition && brain) {
          this.updateSingerNpcMovement(activeNpc, brain, now);
          if (!activeNpc.singing) {
            this.startSinging(activeNpc, now, definition);
          }
        }
        return;
      }
    }

    const definition = this.nextOfflineSingerDefinition();
    if (definition) {
      this.createSingerNpc(now, definition);
    }
  }

  private isRealSingerOnline(name: string): boolean {
    const key = this.nameKey(name);
    return [...this.players.values()].some((player) => !this.singerNpcIds.has(player.id) && this.nameKey(player.name) === key);
  }

  private activeSingerNpc(): PlayerPrivateState | undefined {
    let active: PlayerPrivateState | undefined;
    for (const id of [...this.singerNpcIds]) {
      const player = this.players.get(id);
      if (player && !active) {
        active = player;
        continue;
      }
      if (player) {
        this.despawnSingerNpc(id);
        continue;
      }
      this.singerNpcIds.delete(id);
      this.singerNpcs.delete(id);
    }
    return active;
  }

  private hideSingerNpcs(): number {
    const ids = [...this.singerNpcIds];
    ids.forEach((id) => this.despawnSingerNpc(id));
    return ids.length;
  }

  private nextOfflineSingerDefinition(): SingerDefinition | undefined {
    for (let offset = 0; offset < SINGER_DEFINITIONS.length; offset += 1) {
      const index = (this.singerCycleIndex + offset) % SINGER_DEFINITIONS.length;
      const definition = SINGER_DEFINITIONS[index];
      if (!definition || this.isRealSingerOnline(definition.name)) {
        continue;
      }
      this.singerCycleIndex = (index + 1) % SINGER_DEFINITIONS.length;
      return definition;
    }
    return undefined;
  }

  private createSingerNpc(now: number, definition: SingerDefinition): PlayerPrivateState {
    const saved = this.savedCharacterByName(definition.name);
    const classId = this.playableClassId(saved?.classId ?? definition.classId);
    const equipment = saved?.equipment ?? this.starterEquipment(classId);
    const inventory = this.normalizeBagForEquipment(saved?.inventory ?? this.starterInventory(classId), equipment);
    const level = Math.max(1, saved?.level ?? 32);
    const stats = this.deriveStats(classId, level, equipment);
    const singerStats = { ...stats, speed: Math.min(stats.speed, SINGER_NPC_SPEED) };
    const spawnIndex = Math.max(0, SINGER_ROUTE_POINTS.length - 1);
    const spawn = this.safeSingerRoutePoint(SINGER_ROUTE_POINTS[spawnIndex] ?? WORLD_BOUNDS.town);
    const npc: PlayerPrivateState = {
      id: definition.npcId,
      characterId: definition.characterId,
      name: definition.name,
      classId,
      race: saved?.race ?? definition.race,
      face: saved?.face ?? 1,
      position: spawn,
      velocity: { x: 0, y: 0 },
      facing: { x: 1, y: 0 },
      hp: singerStats.hp,
      maxHp: singerStats.hp,
      cp: singerStats.cp,
      maxCp: singerStats.cp,
      mp: singerStats.mp,
      maxMp: singerStats.mp,
      level,
      xp: saved?.xp ?? 0,
      gold: saved?.gold ?? 0,
      karma: Math.max(0, saved?.karma ?? 0),
      pkCount: Math.max(0, saved?.pkCount ?? 0),
      pvpCount: Math.max(0, saved?.pvpCount ?? 0),
      monsterKills: { ...(saved?.monsterKills ?? {}) },
      arenaRating: Math.max(700, saved?.arenaRating ?? 1000),
      arenaWins: Math.max(0, saved?.arenaWins ?? 0),
      arenaLosses: Math.max(0, saved?.arenaLosses ?? 0),
      arenaStreak: saved?.arenaStreak ?? 0,
      arenaSeasonPoints: Math.max(0, saved?.arenaSeasonPoints ?? 0),
      storyQuestRewards: [...(saved?.storyQuestRewards ?? [])],
      clanId: saved?.clanId && this.clans.has(saved.clanId) ? saved.clanId : undefined,
      jumpUntil: 0,
      lastJumpInput: false,
      pvpFlagUntil: undefined,
      blocking: false,
      stunnedUntil: 0,
      zone: this.zoneFor(spawn),
      comboStage: 0,
      lastProcessedSeq: 0,
      input: this.emptyInput(),
      inventory,
      equipment,
      stats: singerStats,
      wallet: saved?.wallet ?? {
        mode: "telegram-ton",
        connected: false,
        pendingToken: 0
      },
      lastAttackAt: 0,
      skillCooldowns: new Map(),
      lastConsumableAt: 0,
      lastSafePosition: this.nearestCityPosition(spawn),
      downed: false,
      tokenDebt: 0
    };
    this.players.set(npc.id, npc);
    this.singerNpcIds.add(npc.id);
    this.singerNpcs.set(npc.id, {
      playerId: npc.id,
      name: npc.name,
      routeIndex: Math.max(0, spawnIndex - 1),
      routeDirection: -1,
      holdUntil: now + SINGER_ROUTE_DESTINATION_HOLD_MS,
      holdCenter: spawn,
      holdDriftTarget: this.randomSingerHoldDriftTarget(spawn),
      nextHoldDriftAt: now + this.randomBetween(SINGER_ROUTE_HOLD_DRIFT_MIN_MS, SINGER_ROUTE_HOLD_DRIFT_MAX_MS)
    });
    this.startSinging(npc, now, definition);
    return npc;
  }

  private despawnSingerNpc(playerId: string): void {
    this.players.delete(playerId);
    this.singerNpcIds.delete(playerId);
    this.singerNpcs.delete(playerId);
  }

  private savedCharacterByName(name: string): PersistedCharacter | undefined {
    const key = this.nameKey(name);
    return [...this.persistedCharacters.values()].find((character) => this.nameKey(character.name) === key);
  }

  private updateSingerNpcMovement(player: PlayerPrivateState, brain: SingerNpcBrain, now: number): void {
    if (this.isStarterArena(player.position)) {
      player.position = this.safeSingerRoutePoint(player.position);
    }

    if ((brain.holdUntil ?? 0) > now) {
      const target = this.singerHoldDriftTarget(brain, now, player.position);
      const distanceToDriftTarget = this.distance(player.position, target);
      const direction = distanceToDriftTarget > SINGER_ROUTE_HOLD_TARGET_REACHED_DISTANCE ? this.normalize({
        x: target.x - player.position.x,
        y: target.y - player.position.y
      }) : { x: 0, y: 0 };
      player.input = {
        ...this.emptyInput(),
        movement: {
          x: direction.x * SINGER_ROUTE_HOLD_DRIFT_SPEED_MULTIPLIER,
          y: direction.y * SINGER_ROUTE_HOLD_DRIFT_SPEED_MULTIPLIER
        },
        aim: {
          x: player.position.x + (direction.x || player.facing.x) * 120,
          y: player.position.y + (direction.y || player.facing.y) * 120
        },
        sentAt: now
      };
      if (direction.x !== 0 || direction.y !== 0) {
        player.facing = direction;
      }
      player.blocking = false;
      player.downed = false;
      player.hp = Math.max(1, player.hp);
      return;
    }
    brain.holdCenter = undefined;
    brain.holdDriftTarget = undefined;
    brain.nextHoldDriftAt = undefined;

    let target = this.safeSingerRoutePoint(SINGER_ROUTE_POINTS[brain.routeIndex] ?? SINGER_ROUTE_POINTS[0] ?? WORLD_BOUNDS.town);
    if (this.distance(player.position, target) <= SINGER_ROUTE_TARGET_REACHED_DISTANCE) {
      brain.holdUntil = now + this.singerRouteHoldMs(brain.routeIndex);
      brain.holdCenter = target;
      brain.holdDriftTarget = this.randomSingerHoldDriftTarget(target);
      brain.nextHoldDriftAt = now + this.randomBetween(SINGER_ROUTE_HOLD_DRIFT_MIN_MS, SINGER_ROUTE_HOLD_DRIFT_MAX_MS);
      if (brain.routeDirection < 0 && brain.routeIndex <= 0) {
        brain.routeIndex = 0;
      } else if (brain.routeIndex >= SINGER_ROUTE_POINTS.length - 1) {
        brain.routeDirection = -1;
      } else if (brain.routeIndex <= 0) {
        brain.routeDirection = 1;
      }
      if (!(brain.routeDirection < 0 && brain.routeIndex <= 0)) {
        brain.routeIndex = Math.max(0, Math.min(SINGER_ROUTE_POINTS.length - 1, brain.routeIndex + brain.routeDirection));
      }
      target = this.safeSingerRoutePoint(SINGER_ROUTE_POINTS[brain.routeIndex] ?? target);
    }

    const direction = this.normalize({
      x: target.x - player.position.x,
      y: target.y - player.position.y
    });
    player.input = {
      ...this.emptyInput(),
      movement: direction,
      aim: {
        x: player.position.x + direction.x * 120,
        y: player.position.y + direction.y * 120
      },
      sprint: false,
      sentAt: now
    };
    if (direction.x !== 0 || direction.y !== 0) {
      player.facing = direction;
    }
    player.blocking = false;
    player.downed = false;
    player.hp = Math.max(1, player.hp);
  }

  private singerHoldDriftTarget(brain: SingerNpcBrain, now: number, currentPosition: Vector2): Vector2 {
    const center = brain.holdCenter ?? this.safeSingerRoutePoint(SINGER_ROUTE_POINTS[Math.max(0, Math.min(SINGER_ROUTE_POINTS.length - 1, brain.routeIndex - brain.routeDirection))] ?? WORLD_BOUNDS.town);
    brain.holdCenter = center;
    if (
      !brain.holdDriftTarget ||
      this.distance(center, brain.holdDriftTarget) > SINGER_ROUTE_HOLD_DRIFT_RADIUS * 1.8 ||
      this.distance(currentPosition, brain.holdDriftTarget) <= SINGER_ROUTE_HOLD_TARGET_REACHED_DISTANCE ||
      now >= (brain.nextHoldDriftAt ?? 0)
    ) {
      brain.holdDriftTarget = this.randomSingerHoldDriftTarget(center);
      brain.nextHoldDriftAt = now + this.randomBetween(SINGER_ROUTE_HOLD_DRIFT_MIN_MS, SINGER_ROUTE_HOLD_DRIFT_MAX_MS);
    }
    return brain.holdDriftTarget;
  }

  private randomSingerHoldDriftTarget(center: Vector2): Vector2 {
    const angle = Math.random() * Math.PI * 2;
    const distance = this.randomBetween(12, SINGER_ROUTE_HOLD_DRIFT_RADIUS);
    return this.safeSingerRoutePoint({
      x: center.x + Math.cos(angle) * distance,
      y: center.y + Math.sin(angle) * distance
    });
  }

  private singerRouteHoldMs(routeIndex: number): number {
    if (routeIndex >= SINGER_ROUTE_POINTS.length - 1) {
      return SINGER_ROUTE_DESTINATION_HOLD_MS;
    }
    if (routeIndex <= 0) {
      return SINGER_ROUTE_HOME_HOLD_MS;
    }
    return SINGER_ROUTE_WAYPOINT_HOLD_MS;
  }

  private safeSingerRoutePoint(position: Vector2): Vector2 {
    const arenaDistance = this.distance(position, STARTER_ARENA.center);
    if (arenaDistance > STARTER_ARENA.radius + SINGER_ROUTE_ARENA_BUFFER) {
      return this.pushOutOfWorldObstacles(this.clampPosition(position));
    }

    const direction = this.normalize({
      x: position.x - STARTER_ARENA.center.x,
      y: position.y - STARTER_ARENA.center.y
    });
    const fallbackDirection = direction.x === 0 && direction.y === 0 ? { x: 0, y: -1 } : direction;
    return this.pushOutOfWorldObstacles(this.clampPosition({
      x: STARTER_ARENA.center.x + fallbackDirection.x * (STARTER_ARENA.radius + SINGER_ROUTE_ARENA_BUFFER),
      y: STARTER_ARENA.center.y + fallbackDirection.y * (STARTER_ARENA.radius + SINGER_ROUTE_ARENA_BUFFER)
    }));
  }

  private updateSingingPlayers(now: number): void {
    for (const player of this.players.values()) {
      if (!player.singing) {
        continue;
      }
      if (this.singerNpcIds.has(player.id)) {
        continue;
      }
      if (player.hp <= 0 || player.downed) {
        this.stopSinging(player);
        continue;
      }
      if ((player.singingNextTrackAt ?? 0) <= now) {
        this.advanceSingingTrack(player, now);
      }
    }
  }

  private startSinging(player: PlayerPrivateState, now: number, definition = this.singerDefinitionForName(player.name)): void {
    if (!definition) {
      return;
    }

    if (!player.singing) {
      player.singingTrackCursor = this.initialSingingTrackCursor(player, definition);
      const trackId = definition.trackIds[player.singingTrackCursor] ?? definition.trackIds[0];
      player.singing = { trackId, startedAt: now };
      player.singingNextTrackAt = now + this.singingTrackDurationMs(trackId);
      return;
    }

    if (!this.singerNpcIds.has(player.id) && (player.singingNextTrackAt ?? 0) <= now) {
      this.advanceSingingTrack(player, now);
    }
  }

  private stopSinging(player: PlayerPrivateState): void {
    player.singing = undefined;
    player.singingNextTrackAt = undefined;
    player.singingTrackCursor = undefined;
  }

  private advanceSingingTrack(player: PlayerPrivateState, now: number): void {
    const definition = this.singerDefinitionForName(player.name);
    if (!definition) {
      this.stopSinging(player);
      return;
    }

    const currentIndex = player.singingTrackCursor ?? definition.trackIds.findIndex((trackId) => trackId === player.singing?.trackId);
    player.singingTrackCursor = (Math.max(0, currentIndex) + 1) % definition.trackIds.length;
    const trackId = definition.trackIds[player.singingTrackCursor] ?? definition.trackIds[0];
    player.singing = { trackId, startedAt: now };
    player.singingNextTrackAt = now + this.singingTrackDurationMs(trackId);
  }

  private initialSingingTrackCursor(player: PlayerPrivateState, definition: SingerDefinition): number {
    if (!this.singerNpcIds.has(player.id)) {
      return Math.floor(Math.random() * definition.trackIds.length);
    }

    const key = this.nameKey(definition.name);
    const previous = this.singerNpcTrackCursors.get(key);
    const next = previous === undefined ? Math.floor(Math.random() * definition.trackIds.length) : (previous + 1) % definition.trackIds.length;
    this.singerNpcTrackCursors.set(key, next);
    return next;
  }

  private singingTrackDurationMs(trackId: number): number {
    for (const definition of SINGER_DEFINITIONS) {
      const duration = definition.trackDurationsMs[trackId];
      if (duration) {
        return duration;
      }
    }
    return SINGER_DEFAULT_TRACK_DURATION_MS;
  }

  private singerDefinitionForName(name: string): SingerDefinition | undefined {
    const key = this.nameKey(name);
    return SINGER_DEFINITIONS.find((definition) => this.nameKey(definition.name) === key);
  }

  private singerDefinitionForNpcId(playerId: string): SingerDefinition | undefined {
    return SINGER_DEFINITIONS.find((definition) => definition.npcId === playerId);
  }

  private step(): void {
    this.tick += 1;
    const now = Date.now();
    const dt = this.tickMs / 1000;
    this.cleanupSocialInvites(now);
    this.cleanupPlayerCombat(now);
    this.updateBotPopulation(now);
    this.updateSingerNpcs(now);
    this.updateSingingPlayers(now);

    for (const [botId, brain] of [...this.botBrains.entries()]) {
      const bot = this.players.get(botId);
      if (!bot) {
        if (brain.offlineUntil && now >= brain.offlineUntil) {
          this.reactivateBot(botId, brain, now);
          continue;
        }
        if (!brain.offlineUntil) {
          this.botBrains.delete(botId);
        }
        continue;
      }
      this.updateBot(bot, now);
    }

    for (const player of this.players.values()) {
      this.updatePlayer(player, dt, now);
    }

    for (const monster of this.monsters.values()) {
      this.updateMonster(monster, dt, now);
    }

    for (const resource of this.resources.values()) {
      if (resource.respawnsAt && resource.respawnsAt <= now) {
        resource.remaining = resource.kind === "chest" ? 1 : 3;
        if (resource.kind === "chest") {
          resource.position = this.randomChestPosition(resource.id);
        }
        resource.respawnsAt = undefined;
      }
    }

    this.pruneGroundItems(now);

    if (now - this.lastPositionSaveAt > 5000) {
      this.lastPositionSaveAt = now;
      for (const player of this.players.values()) {
        this.saveCharacter(player);
      }
    }
  }

  private updatePlayer(player: PlayerPrivateState, dt: number, now: number): void {
    player.zone = this.zoneFor(player.position);

    if (player.hp <= 0) {
      player.velocity = { x: 0, y: 0 };
      player.blocking = false;
      return;
    }

    if (now < player.stunnedUntil) {
      player.velocity = { x: 0, y: 0 };
      return;
    }

    if (player.marketVendor?.playerOwned && player.marketVendor.items.length > 0) {
      player.sitting = true;
      player.input = this.emptyInput();
      player.velocity = { x: 0, y: 0 };
      player.hp = Math.min(player.maxHp, player.hp + this.healthRegen(player) * dt);
      player.cp = Math.min(player.maxCp, player.cp + this.cpRegen(player, now) * dt);
      player.mp = Math.min(player.maxMp, player.mp + this.manaRegen(player.classId) * dt);
      return;
    }
    if (player.sitting && !player.marketVendor) {
      player.sitting = false;
    }

    const dashMultiplier = player.input.dash ? this.dashMultiplier(player.classId) * (player.input.boost ? 1.38 : 1) : 1;
    const sprintMultiplier = !player.input.dash && player.input.sprint && this.isAdmin(player.id) ? this.sprintMultiplier(player.classId) : 1;
    const blockMultiplier = player.input.block ? this.blockMoveMultiplier(player.classId) : 1;
    const botMovementScale = this.botMovementScale(player);
    const velocity = {
      x: player.input.movement.x * player.stats.speed * dashMultiplier * sprintMultiplier * blockMultiplier * botMovementScale,
      y: player.input.movement.y * player.stats.speed * dashMultiplier * sprintMultiplier * blockMultiplier * botMovementScale
    };

    const previousPosition = player.position;
    const nextPosition = this.clampPlayerPosition(player, {
      x: previousPosition.x + velocity.x * dt,
      y: previousPosition.y + velocity.y * dt
    });
    player.position = nextPosition;
    player.velocity = dt > 0
      ? {
          x: (nextPosition.x - previousPosition.x) / dt,
          y: (nextPosition.y - previousPosition.y) / dt
        }
      : velocity;
    player.hp = Math.min(player.maxHp, player.hp + this.healthRegen(player) * dt);
    player.cp = Math.min(player.maxCp, player.cp + this.cpRegen(player, now) * dt);
    player.mp = Math.min(player.maxMp, player.mp + this.manaRegen(player.classId) * dt);
    player.zone = this.zoneFor(player.position);
    if (player.zone === "safe") {
      player.lastSafePosition = this.nearestCityPosition(player.position);
    }
    this.applyWorldHazards(player, now);
  }

  private applyWorldHazards(player: PlayerPrivateState, now: number): void {
    if (WORLD_HAZARDS.length === 0) {
      return;
    }
    if (player.hp <= 0 || player.downed || player.zone === "safe" || now < player.jumpUntil) {
      return;
    }

    for (const hazard of WORLD_HAZARDS) {
      if (!this.worldHazardActive(hazard, now) || !this.pointInWorldHazard(player.position, hazard, now)) {
        continue;
      }

      const key = `${player.id}:${hazard.id}`;
      if ((this.hazardDamageReadyAt.get(key) ?? 0) > now) {
        continue;
      }

      this.hazardDamageReadyAt.set(key, now + HAZARD_DAMAGE_COOLDOWN_MS);
      const botPenalty = this.botBrains.has(player.id) ? 0.42 : 1;
      this.damagePlayer(hazard.label, player, Math.max(1, Math.round(hazard.damage * botPenalty)), "monster", 120);
      if (player.hp > 0 && !player.downed && hazard.knockback) {
        this.pushPlayerFromHazard(player, hazard);
      }
      return;
    }
  }

  private worldHazardActive(hazard: WorldHazardDefinition, now: number): boolean {
    if (hazard.activeMs >= hazard.cycleMs) {
      return true;
    }
    return now % Math.max(1, hazard.cycleMs) <= hazard.activeMs;
  }

  private pointInWorldHazard(point: Vector2, hazard: WorldHazardDefinition, now: number): boolean {
    const local = this.worldHazardLocalPoint(point, hazard);
    if (hazard.kind === "orbStream") {
      const phase = (now % Math.max(1, hazard.cycleMs)) / Math.max(1, hazard.activeMs);
      for (let index = 0; index < HAZARD_ORB_COUNT; index += 1) {
        const orbPhase = (phase + index / HAZARD_ORB_COUNT) % 1;
        const orbX = (orbPhase - 0.5) * hazard.width;
        const orbY = Math.sin(now / 220 + index * 1.7) * hazard.height * 0.24;
        const radius = Math.max(34, hazard.height * 0.3);
        if (this.distance(local, { x: orbX, y: orbY }) <= radius + PLAYER_OBSTACLE_RADIUS * 0.45) {
          return true;
        }
      }
      return false;
    }

    const padding = hazard.kind === "riftCrack" ? 10 : 4;
    return Math.abs(local.x) <= hazard.width / 2 + padding && Math.abs(local.y) <= hazard.height / 2 + PLAYER_OBSTACLE_RADIUS * 0.35;
  }

  private worldHazardLocalPoint(point: Vector2, hazard: WorldHazardDefinition): Vector2 {
    const rotation = hazard.rotation ?? 0;
    const dx = point.x - hazard.position.x;
    const dy = point.y - hazard.position.y;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    return {
      x: cos * dx + sin * dy,
      y: -sin * dx + cos * dy
    };
  }

  private pushPlayerFromHazard(player: PlayerPrivateState, hazard: WorldHazardDefinition): void {
    const local = this.worldHazardLocalPoint(player.position, hazard);
    const rotation = hazard.rotation ?? 0;
    const normalSign = local.y >= 0 ? 1 : -1;
    const normal = {
      x: -Math.sin(rotation) * normalSign,
      y: Math.cos(rotation) * normalSign
    };
    const fallback = this.normalize({
      x: player.position.x - hazard.position.x,
      y: player.position.y - hazard.position.y
    });
    const direction = normal.x || normal.y ? normal : fallback;
    player.position = this.clampPlayerPosition(player, {
      x: player.position.x + direction.x * (hazard.knockback ?? 80),
      y: player.position.y + direction.y * (hazard.knockback ?? 80)
    });
  }

  private updateMonster(monster: MonsterState, dt: number, now: number): void {
    if (monster.hp <= 0) {
      monster.velocity = { x: 0, y: 0 };
      if (!monster.respawnsAt) {
        monster.respawnsAt = now + this.monsterRespawnMs(monster);
        this.monsterWander.delete(monster.id);
      }

      if (monster.respawnsAt <= now) {
        monster.hp = monster.maxHp;
        monster.position = this.respawnPointFor(monster);
        monster.velocity = { x: 0, y: 0 };
        monster.respawnsAt = undefined;
        this.monsterAttackReadyAt.delete(monster.id);
        this.resetMonsterWander(monster, now);
      }
      return;
    }

    if (this.isMonsterArenaProtectedPosition(monster.position)) {
      monster.position = this.pushOutOfStarterArena(monster.position);
      monster.velocity = { x: 0, y: 0 };
      monster.targetId = undefined;
      this.resetMonsterWander(monster, now);
      return;
    }

    const aiOffset = monster.id.length + monster.level;
    if (
      !monster.targetId &&
      (this.tick + aiOffset) % MONSTER_REMOTE_SLEEP_TICKS !== 0 &&
      !this.hasActivePlayerNear(monster.position, MONSTER_REMOTE_SLEEP_RANGE)
    ) {
      monster.velocity = { x: 0, y: 0 };
      return;
    }

    const target = monster.targetId || (this.tick + aiOffset) % MONSTER_TARGET_SCAN_TICKS === 0 ? this.monsterTarget(monster) : undefined;
    monster.targetId = target?.id;
    if (!target) {
      this.updateMonsterWander(monster, dt, now);
      return;
    }
    const targetSafeBuffer = target.id === monster.targetId ? MONSTER_RETALIATE_SAFE_BUFFER : MONSTER_SAFE_TARGET_BUFFER;
    if (this.isCitySafeProtectedPosition(target.position, targetSafeBuffer)) {
      monster.targetId = undefined;
      monster.position = this.pushOutOfSafeZone(monster.position);
      monster.velocity = { x: 0, y: 0 };
      this.resetMonsterWander(monster, now);
      return;
    }
    this.monsterWander.delete(monster.id);

    const direction = this.normalize({
      x: target.position.x - monster.position.x,
      y: target.position.y - monster.position.y
    });
    const tuning = MONSTER_TUNING[monster.archetype];
    const targetDistance = this.distance(monster.position, target.position);
    if (targetDistance > tuning.attackRange * 0.82) {
      const speed = this.monsterSpeed(monster);
      const previousPosition = monster.position;
      const moveDistance = Math.min(speed * dt, targetDistance - tuning.attackRange * 0.72);
      const desiredPosition = this.clampPosition({
        x: previousPosition.x + direction.x * moveDistance,
        y: previousPosition.y + direction.y * moveDistance
      });
      if (this.isCitySafeProtectedPosition(desiredPosition, MONSTER_SAFE_MOVE_BUFFER)) {
        monster.targetId = undefined;
        monster.position = this.pushOutOfSafeZone(previousPosition);
        monster.velocity = { x: 0, y: 0 };
        this.resetMonsterWander(monster, now);
        return;
      }

      const nextPosition = this.pushOutOfSafeZone(this.pushOutOfStarterArena(desiredPosition));
      monster.position = nextPosition;
      monster.velocity = {
        x: (nextPosition.x - previousPosition.x) / dt,
        y: (nextPosition.y - previousPosition.y) / dt
      };
    } else {
      monster.velocity = { x: 0, y: 0 };
    }

    if (this.distance(monster.position, target.position) < tuning.attackRange && this.monsterCanAttack(monster, now)) {
      const attackStyle = this.monsterAttackStyle(monster, target, now);
      if (monster.archetype === "dragon") {
        this.damageDragonBreath(monster, target, attackStyle);
      } else {
        this.damagePlayer(monster.id, target, this.monsterAttackDamage(monster, attackStyle), "monster", 0, false, { attackStyle });
      }
    }
  }

  private damageDragonBreath(monster: MonsterState, target: PlayerPrivateState, attackStyle: MonsterAttackStyle = "flame"): void {
    const direction = this.normalize({
      x: target.position.x - monster.position.x,
      y: target.position.y - monster.position.y
    });
    const range = MONSTER_TUNING.dragon.attackRange + 42;
    const baseDamage = this.monsterDamage(monster);

    for (const player of this.players.values()) {
      if (player.hp <= 0 || player.downed || player.zone === "safe" || this.isMonsterArenaProtectedPosition(player.position) || this.isRoadProtectedPosition(player.position)) {
        continue;
      }

      const offset = { x: player.position.x - monster.position.x, y: player.position.y - monster.position.y };
      const distance = Math.hypot(offset.x, offset.y);
      if (distance > range || distance <= 0.001) {
        continue;
      }

      const dot = (offset.x / distance) * direction.x + (offset.y / distance) * direction.y;
      if (dot < 0.52 && player.id !== target.id) {
        continue;
      }

      const falloff = player.id === target.id ? 1 : 0.62 + Math.max(0, dot) * 0.2;
      this.damagePlayer(monster.id, player, Math.round(baseDamage * falloff), "monster", 0, false, { attackStyle });
    }
  }

  private resolveDamage(
    source: PlayerPrivateState,
    command: AttackCommand,
    range: number,
    damage: number,
    kind: "attack" | "skill",
    stunMs = 0
  ): boolean {
    const target = this.findTarget(source, command, range, kind);
    if (!target) {
      return false;
    }

    if ("classId" in target) {
      if (!this.canDamagePlayer(source, target, Boolean(command.forcePk))) {
        return false;
      }

      this.damagePlayer(source.id, target, damage, kind, stunMs, Boolean(command.forcePk));
      return true;
    }

    if (source.zone === "safe") {
      return false;
    }

    this.damageMonster(source, target, damage, kind, stunMs);
    return true;
  }

  private damageResolvedTarget(
    source: PlayerPrivateState,
    target: MonsterState | PlayerPrivateState,
    damage: number,
    kind: "attack" | "skill",
    stunMs = 0,
    forcePk = false
  ): boolean {
    if (target.hp <= 0) {
      return false;
    }

    if ("classId" in target) {
      if (!this.canDamagePlayer(source, target, forcePk)) {
        return false;
      }
      this.damagePlayer(source.id, target, damage, kind, stunMs, forcePk);
      return true;
    }

    if (source.zone === "safe") {
      return false;
    }

    this.damageMonster(source, target, damage, kind, stunMs);
    return true;
  }

  private basicMeleeCleaveProfile(classId: CharacterClass): { rangeBonus: number; minDot: number; maxTargets: number; falloff: number[] } | undefined {
    if (classId === "warrior") {
      return { rangeBonus: 56, minDot: 0.08, maxTargets: 4, falloff: [1, 0.68, 0.45, 0.3] };
    }
    if (classId === "assassin") {
      return { rangeBonus: 44, minDot: 0.02, maxTargets: 3, falloff: [1, 0.66, 0.42] };
    }
    if (classId === "tank") {
      return { rangeBonus: 34, minDot: 0.28, maxTargets: 3, falloff: [1, 0.52, 0.34] };
    }

    return undefined;
  }

  private resolveMeleeCleaveDamage(source: PlayerPrivateState, command: AttackCommand, range: number, damage: number): boolean {
    const profile = this.basicMeleeCleaveProfile(source.classId);
    if (!profile) {
      return this.resolveDamage(source, command, range, damage, "attack");
    }

    if (source.zone === "safe" && !this.duelByPlayer.has(source.id)) {
      return false;
    }

    const direction = this.directionToAim(source, command.aim);
    if (direction.x === 0 && direction.y === 0) {
      return false;
    }

    const maxRange = range + profile.rangeBonus + this.rangeGrace(source, "attack");
    const candidates: Array<MonsterState | PlayerPrivateState> = [
      ...(source.zone === "safe" ? [] : [...this.monsters.values()]),
      ...[...this.players.values()].filter((player) => player.id !== source.id && this.canDamagePlayer(source, player, Boolean(command.forcePk)))
    ];
    const hits = candidates
      .map((candidate) => {
        if (candidate.hp <= 0) {
          return undefined;
        }

        const toTarget = {
          x: candidate.position.x - source.position.x,
          y: candidate.position.y - source.position.y
        };
        const distance = Math.hypot(toTarget.x, toTarget.y);
        const radius = this.hitRadius(candidate);
        if (distance > maxRange + radius) {
          return undefined;
        }

        const dot = distance > 0.001 ? (toTarget.x * direction.x + toTarget.y * direction.y) / distance : 1;
        if (dot < profile.minDot) {
          return undefined;
        }

        const requestedBias = command.targetId === candidate.id ? -45 : 0;
        return { candidate, score: distance - dot * 30 + requestedBias };
      })
      .filter((entry): entry is { candidate: MonsterState | PlayerPrivateState; score: number } => Boolean(entry))
      .sort((a, b) => a.score - b.score)
      .slice(0, profile.maxTargets);

    hits.forEach(({ candidate }, index) => {
      const falloff = profile.falloff[index] ?? profile.falloff[profile.falloff.length - 1] ?? 0.3;
      this.damageResolvedTarget(source, candidate, Math.max(1, Math.round(damage * falloff)), "attack", 0, Boolean(command.forcePk));
    });

    return hits.length > 0;
  }

  private resolveAreaDamage(
    source: PlayerPrivateState,
    command: AttackCommand,
    range: number,
    areaRadius: number,
    damage: number,
    kind: "attack" | "skill",
    stunMs = 0,
    selfCentered = false
  ): number {
    if (source.zone === "safe" && !this.duelByPlayer.has(source.id)) {
      return 0;
    }

    const direction = this.directionToAim(source, command.aim);
    const aimDistance = this.distance(source.position, command.aim);
    const maxRange = range + this.rangeGrace(source, kind);
    const center = selfCentered
      ? source.position
      : command.targetId
        ? this.findTarget(source, command, range, kind)?.position ?? command.aim
        : direction.x === 0 && direction.y === 0
          ? source.position
          : {
              x: source.position.x + direction.x * Math.min(maxRange, aimDistance),
              y: source.position.y + direction.y * Math.min(maxRange, aimDistance)
            };
    const candidates: Array<MonsterState | PlayerPrivateState> = [
      ...(source.zone === "safe" ? [] : [...this.monsters.values()]),
      ...[...this.players.values()].filter((player) => player.id !== source.id && this.canDamagePlayer(source, player, Boolean(command.forcePk)))
    ];

    let hits = 0;
    for (const candidate of candidates) {
      if (candidate.hp <= 0) {
        continue;
      }

      const distanceToCenter = this.distance(candidate.position, center);
      if (distanceToCenter > areaRadius + this.hitRadius(candidate)) {
        continue;
      }

      if ("classId" in candidate) {
        if (!this.canDamagePlayer(source, candidate, Boolean(command.forcePk))) {
          continue;
        }
        this.damagePlayer(source.id, candidate, damage, kind, stunMs, Boolean(command.forcePk));
      } else {
        this.damageMonster(source, candidate, damage, kind, stunMs);
      }
      hits += 1;
    }

    return hits;
  }

  private resolvePiercingDamage(
    source: PlayerPrivateState,
    command: AttackCommand,
    range: number,
    damage: number,
    kind: "attack" | "skill",
    stunMs = 0,
    maxTargets = 4
  ): number {
    if (source.zone === "safe" && !this.duelByPlayer.has(source.id)) {
      return 0;
    }

    const direction = this.directionToAim(source, command.aim);
    if (direction.x === 0 && direction.y === 0) {
      return 0;
    }

    const maxRange = range + this.rangeGrace(source, kind);
    const candidates: Array<MonsterState | PlayerPrivateState> = [
      ...(source.zone === "safe" ? [] : [...this.monsters.values()]),
      ...[...this.players.values()].filter((player) => player.id !== source.id && this.canDamagePlayer(source, player, Boolean(command.forcePk)))
    ];

    const hits = candidates
      .map((candidate) => {
        const projection = this.shotProjection(source, candidate, direction, maxRange, kind);
        return projection === undefined ? undefined : { candidate, projection };
      })
      .filter((entry): entry is { candidate: MonsterState | PlayerPrivateState; projection: number } => Boolean(entry))
      .sort((a, b) => a.projection - b.projection)
      .slice(0, maxTargets);

    hits.forEach(({ candidate }, index) => {
      const falloffDamage = Math.max(1, Math.round(damage * Math.pow(0.86, index)));
      if ("classId" in candidate) {
        if (!this.canDamagePlayer(source, candidate, Boolean(command.forcePk))) {
          return;
        }
        this.damagePlayer(source.id, candidate, falloffDamage, kind, stunMs, Boolean(command.forcePk));
        return;
      }

      this.damageMonster(source, candidate, falloffDamage, kind, stunMs);
    });

    return hits.length;
  }

  private damagePlayer(
    sourceId: string,
    target: PlayerPrivateState,
    baseDamage: number,
    kind: "attack" | "skill" | "monster",
    stunMs = 0,
    forcePk = false,
    options: { skillId?: string; attackStyle?: MonsterAttackStyle } = {}
  ): void {
    if (target.hp <= 0 || target.downed) {
      return;
    }

    const sourcePlayer = this.players.get(sourceId);
    if (sourcePlayer && !this.canDamagePlayer(sourcePlayer, target, forcePk)) {
      return;
    }

    const now = Date.now();
    if (sourcePlayer) {
      this.applyPlayerCombatFlag(sourcePlayer, target, now);
    }

    const isPvpDamage = Boolean(sourcePlayer);
    const isMageIntoTank = sourcePlayer?.classId === "mage" && target.classId === "tank";
    const isArenaPvpDamage = Boolean(sourcePlayer && this.isStarterArena(sourcePlayer.position) && this.isStarterArena(target.position));
    const effectiveDefense = sourcePlayer?.classId === "mage"
      ? target.stats.defense * (isMageIntoTank ? (kind === "skill" ? 0.38 : 0.5) : kind === "skill" ? 0.48 : 0.6)
      : target.stats.defense;
    const defenseReduction = isPvpDamage
      ? Math.min(sourcePlayer?.classId === "mage" ? 0.66 : 0.7, effectiveDefense / (effectiveDefense + (sourcePlayer?.classId === "mage" ? 120 : 96)))
      : Math.min(0.64, target.stats.defense / (target.stats.defense + 95));
    const blockReduction = target.blocking ? CLASS_DEFINITIONS[target.classId].blockReduction * (isMageIntoTank ? 0.58 : 1) : 0;
    const combinedReduction = 1 - (1 - defenseReduction) * (1 - blockReduction);
    const pvpMultiplier = sourcePlayer
      ? PVP_DAMAGE_MULTIPLIER * (kind === "skill" ? PVP_SKILL_DAMAGE_MULTIPLIER : 1) * this.pvpPowerPressure(sourcePlayer, target, kind) * (isMageIntoTank ? PVP_MAGE_VS_TANK_DAMAGE_BONUS : 1)
        * this.pvpClassMatchupMultiplier(sourcePlayer, target, kind) * (isArenaPvpDamage ? PVP_ARENA_DAMAGE_MULTIPLIER : 1)
      : 1;
    const monsterMultiplier = sourcePlayer ? 1 : this.monsterDamagePressure(sourceId, target);
    const amount = Math.max(1, Math.round(baseDamage * pvpMultiplier * monsterMultiplier * (1 - combinedReduction)));
    let hpDamage = amount;
    if (sourcePlayer && target.cp > 0) {
      const cpDamage = Math.min(target.cp, hpDamage);
      target.cp -= cpDamage;
      hpDamage -= cpDamage;
    }
    target.hp = Math.max(0, target.hp - hpDamage);
    if (stunMs > 0) {
      target.stunnedUntil = Date.now() + stunMs;
    }
    this.event(sourceId, target.id, amount, kind, `${sourceId} hit ${target.name} for ${amount}.`, {
      skillId: options.skillId ?? (kind === "skill" ? sourcePlayer?.activeSkillId : undefined),
      attackStyle: options.attackStyle
    });

    if (target.hp <= 0) {
      const killer = this.players.get(sourceId);
      const killKind = killer ? this.classifyPlayerKill(killer, target, now) : "monster";
      const isArenaPvpDeath = Boolean(killer && this.isStarterArena(killer.position) && this.isStarterArena(target.position));
      const pvpInventoryReward = killer && killKind === "pvp" ? this.awardPvpCoins(killer, target, killKind, isArenaPvpDeath) : 0;
      const redCoinDrop = killer && killKind === "red" ? this.awardPvpCoins(killer, target, killKind, isArenaPvpDeath) : 0;
      const pkCoinDrop = killer && killKind === "pk" ? this.playerInventoryDropQuantity(target, "arena-coin", 0.42, 3) : 0;
      const pkPvpCoinDrop = killer && killKind === "pk" ? this.playerInventoryDropQuantity(target, PVP_COIN_ITEM_ID, 0.32, 2) : 0;
      const dropped = killer && (killKind === "pvp" || killKind === "duel")
        ? 0
        : Math.floor(target.gold * this.playerGoldDropRate(killKind));
      target.gold -= dropped;
      const xpLost = this.applyDeathPenalty(target, killKind === "red" ? 1.45 : 1);
      this.knockDownPlayer(target);
      if (killer) {
        const killResult = this.applyPlayerKillResult(killer, target, killKind, now, isArenaPvpDeath);
        this.awardPlayerKillXp(killer, target, killKind, now);
        const coinDrop = redCoinDrop + pkCoinDrop;
        const pvpCoinDrop = pkPvpCoinDrop;
        const arenaRatingChange = this.updateArenaRating(killer, target, killKind);
        if (dropped > 0) {
          this.dropGold(target.position, dropped, target.id, undefined, PVP_GROUND_DROP_TTL_MS, false);
        }
        if (pvpInventoryReward > 0) {
          this.grantPvpCoin(killer, pvpInventoryReward);
        }
        if (coinDrop > 0) {
          this.removeInventoryQuantity(target, "arena-coin", pkCoinDrop);
          this.dropCoin(target.position, coinDrop, target.id, undefined, PVP_GROUND_DROP_TTL_MS, false);
        }
        if (pvpCoinDrop > 0) {
          this.removeInventoryQuantity(target, PVP_COIN_ITEM_ID, pvpCoinDrop);
          this.dropPvpCoin(target.position, pvpCoinDrop, target.id, undefined, PVP_GROUND_DROP_TTL_MS, false);
        }
        this.saveCharacter(killer);
        if (!isArenaPvpDeath && (dropped > 0 || coinDrop > 0 || pvpCoinDrop > 0 || pvpInventoryReward > 0)) {
          const lootLabel = killKind === "red" ? "bounty" : killKind === "pk" ? "PK loot" : "PvP reward";
          const parts = [
            dropped > 0 ? `${dropped} gold` : undefined,
            coinDrop > 0 ? `${coinDrop} Coin` : undefined,
            pvpCoinDrop > 0 ? `${pvpCoinDrop} PvP Coin` : undefined,
            pvpInventoryReward > 0 ? `${pvpInventoryReward} PvP Coin` : undefined
          ].filter(Boolean);
          this.event(sourceId, target.id, Math.max(dropped, coinDrop, pvpCoinDrop, pvpInventoryReward), "loot", `${target.name}: ${parts.join(", ")} (${lootLabel}).`);
        }
        this.finishDuel(killer, target);
        this.botDeathChat(killer, target, killKind);
        this.playerKillSystemChat(killer, target, killKind, {
          arenaPvpDeath: isArenaPvpDeath,
          arenaRatingChange,
          coinDrop,
          pvpCoinDrop,
          pvpCoinReward: pvpInventoryReward,
          dropped,
          karmaGain: killResult.karmaGain
        });
      }
      target.pvpFlagUntil = undefined;
      this.clearPlayerCombatFor(target.id);
      this.saveCharacter(target);
      this.event(sourceId, target.id, 0, "death", `${target.name} was defeated.`);
      if (!killer && !this.botBrains.has(target.id)) {
        this.systemChat(`${target.name} died and lost ${xpLost} XP.`);
      }
    }
  }

  private pvpPowerPressure(source: PlayerPrivateState, target: PlayerPrivateState, kind: "attack" | "skill" | "monster"): number {
    if (kind === "monster") {
      return 1;
    }

    const offense = this.pvpOffensePower(source, kind);
    const guard = this.pvpGuardPower(target);
    const ratio = offense / Math.max(20, guard);
    if (ratio >= 3.2) {
      return 1.28;
    }
    if (ratio >= 2.2) {
      return 1.18;
    }
    if (ratio >= 1.35) {
      return 1.09;
    }
    if (ratio <= 0.62) {
      return 0.9;
    }
    return 1;
  }

  private pvpClassMatchupMultiplier(source: PlayerPrivateState, target: PlayerPrivateState, kind: "attack" | "skill" | "monster"): number {
    if (kind === "monster") {
      return 1;
    }

    if (source.classId === "archer" && target.classId === "mage") {
      return kind === "attack" ? PVP_ARCHER_VS_MAGE_ATTACK_MULTIPLIER : PVP_ARCHER_VS_MAGE_SKILL_MULTIPLIER;
    }

    return 1;
  }

  private pvpClassCpAbsorbBonus(source: PlayerPrivateState, target: PlayerPrivateState, kind: "attack" | "skill" | "monster"): number {
    if (kind === "monster") {
      return 0;
    }

    if (source.classId === "archer" && target.classId === "mage") {
      return PVP_ARCHER_VS_MAGE_CP_ABSORB_BONUS;
    }

    return 0;
  }

  private pvpCpAbsorbRatio(source: PlayerPrivateState, target: PlayerPrivateState, kind: "attack" | "skill" | "monster"): number {
    if (kind === "monster") {
      return 1;
    }

    const ratio = this.pvpOffensePower(source, kind) / Math.max(20, this.pvpGuardPower(target));
    if (ratio >= 3.2) {
      return 0.46;
    }
    if (ratio >= 2.2) {
      return 0.56;
    }
    if (ratio >= 1.35) {
      return 0.68;
    }
    return 0.78;
  }

  private pvpOffensePower(player: PlayerPrivateState, kind: "attack" | "skill" | "monster"): number {
    const weaponEnchant = player.equipment.weapon?.enchantLevel ?? 0;
    const enchantPressure = weaponEnchant * (player.classId === "mage" ? 3.8 : 2.8);
    if (player.classId === "mage") {
      return player.stats.magic + player.stats.attack * 0.35 + enchantPressure;
    }
    if (kind === "skill") {
      return Math.max(player.stats.attack, player.stats.magic * 0.72) + enchantPressure;
    }
    return player.stats.attack + player.stats.crit * 0.7 + enchantPressure;
  }

  private pvpGuardPower(player: PlayerPrivateState): number {
    const armorEnchant = Math.max(
      0,
      player.equipment.chest?.enchantLevel ?? 0,
      player.equipment.helmet?.enchantLevel ?? 0,
      player.equipment.gloves?.enchantLevel ?? 0,
      player.equipment.boots?.enchantLevel ?? 0
    );
    return player.stats.defense + player.maxCp * 0.035 + player.maxHp * 0.02 + armorEnchant * 2.2;
  }

  private botDeathChat(killer: PlayerPrivateState, target: PlayerPrivateState, killKind: "pk" | "pvp" | "red" | "duel" | "monster"): void {
    const brain = this.botBrains.get(target.id);
    if (!brain) {
      return;
    }

    const pkDeath = killKind === "pk";
    const pvpDeath = killKind === "pvp" || killKind === "duel" || killKind === "red";
    if (!pkDeath && !pvpDeath) {
      return;
    }

    const chance = pkDeath ? 0.78 : 0.54;
    if (Math.random() > chance) {
      brain.nextChatAt = Date.now() + this.randomBetween(10_000, 32_000);
      return;
    }

    const lines = pkDeath ? BOT_PK_DEATH_CHAT_LINES : BOT_PVP_DEATH_CHAT_LINES;
    const text = this.randomBotLine(brain, lines).replace("{killer}", killer.name);
    const delay = this.botTypingDelayWindow(text, pkDeath);
    this.queueBotChat(target, brain, text, pkDeath && Math.random() < 0.5 ? "zone" : "local", true, delay.min, delay.max);
  }

  private damageMonster(
    source: PlayerPrivateState,
    target: MonsterState,
    damage: number,
    kind: "attack" | "skill",
    stunMs = 0
  ): void {
    if (source.zone === "safe") {
      return;
    }

    const amount = this.damageAgainstMonster(source, target, damage);
    target.hp = Math.max(0, target.hp - amount);
    target.targetId = source.id;
    this.monsterWander.delete(target.id);
    this.event(source.id, target.id, amount, kind, `${source.name} hit ${target.archetype} Lv.${target.level} for ${amount}.`, {
      skillId: kind === "skill" ? source.activeSkillId : undefined
    });

    if (target.hp <= 0) {
      const gold = this.monsterGold(target);
      const xp = this.monsterXp(target);
      source.monsterKills[target.archetype] = Math.max(0, source.monsterKills[target.archetype] ?? 0) + 1;
      this.awardXp(source, xp);
      this.cleanseKarmaFromMonster(source, target);
      this.dropGold(target.position, gold, target.id, source.id, GROUND_ITEM_TTL_MS, false);
      this.maybeDropMonsterLoot(source, target);
      this.maybeDropEnchantScroll(source, target);
      this.maybeDropCoin(source, target);
      this.event(source.id, target.id, gold, "loot", `${gold} gold dropped on the ground.`);
      this.saveCharacter(source);
    }
  }

  private requestedCommandTarget(
    source: PlayerPrivateState,
    command: AttackCommand,
    range: number,
    kind: "attack" | "skill"
  ): MonsterState | PlayerPrivateState | undefined {
    if (!command.targetId) {
      return undefined;
    }

    const target = this.monsters.get(command.targetId) ?? this.players.get(command.targetId);
    if (!target || target.hp <= 0) {
      return undefined;
    }

    if ("classId" in target) {
      if (target.id === source.id || !this.canDamagePlayer(source, target, Boolean(command.forcePk))) {
        return undefined;
      }
    } else if (source.zone === "safe") {
      return undefined;
    }

    const targetRadius = this.hitRadius(target);
    const latencyGrace = "archetype" in target
      ? this.targetedLatencyGrace(source, kind)
      : Math.min(22, this.targetedLatencyGrace(source, kind) * 0.45);
    const maxRange = range + this.rangeGrace(source, kind) + targetRadius + Math.max(10, targetRadius * 0.45) + this.targetedCommandGrace(source, kind) + latencyGrace;
    return this.distance(source.position, target.position) <= maxRange ? target : undefined;
  }

  private findTarget(
    source: PlayerPrivateState,
    command: AttackCommand,
    range: number,
    kind: "attack" | "skill"
  ): MonsterState | PlayerPrivateState | undefined {
    const requestedTarget = this.requestedCommandTarget(source, command, range, kind);
    if (requestedTarget) {
      return requestedTarget;
    }

    const aimDirection = this.directionToAim(source, command.aim);
    if (aimDirection.x === 0 && aimDirection.y === 0) {
      return undefined;
    }

    const maxRange = range + this.rangeGrace(source, kind);
    const aimDistance = this.distance(source.position, command.aim);
    const castDistance = Math.min(maxRange, Math.max(aimDistance, this.minimumCastDistance(source, kind)));
    const candidates: Array<MonsterState | PlayerPrivateState> = [
      ...(source.zone === "safe" ? [] : [...this.monsters.values()]),
      ...[...this.players.values()].filter((player) => player.id !== source.id && this.canDamagePlayer(source, player, Boolean(command.forcePk)))
    ];

    let best: MonsterState | PlayerPrivateState | undefined;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const candidate of candidates) {
      const score = this.aimHitScore(source, candidate, aimDirection, castDistance, kind, command.targetId);
      if (score === undefined) {
        continue;
      }

      if (score < bestScore) {
        bestScore = score;
        best = candidate;
      }
    }

    return best;
  }

  private respawnPlayer(player: PlayerPrivateState): void {
    player.position = this.clampPosition(player.deathReturnPosition ?? this.deathReturnPositionFor(player));
    player.velocity = { x: 0, y: 0 };
    player.input = this.emptyInput();
    player.hp = Math.max(1, Math.round(player.maxHp * 0.38));
    player.cp = Math.max(0, Math.round(player.maxCp * 0.55));
    player.mp = Math.max(0, Math.round(player.maxMp * 0.3));
    player.zone = "safe";
    player.blocking = false;
    player.jumpUntil = 0;
    player.lastJumpInput = false;
    player.stunnedUntil = 0;
    player.comboStage = 0;
    player.downed = false;
    player.revivableUntil = undefined;
    player.deathReturnPosition = undefined;
    player.lastSafePosition = { ...player.position };
    player.lastAttackAt = Date.now();
  }

  private knockDownPlayer(player: PlayerPrivateState): void {
    player.hp = 0;
    player.cp = 0;
    player.velocity = { x: 0, y: 0 };
    player.blocking = false;
    player.jumpUntil = 0;
    player.lastJumpInput = false;
    player.stunnedUntil = 0;
    player.downed = true;
    player.revivableUntil = Date.now() + 90000;
    player.deathReturnPosition = this.deathReturnPositionFor(player);
  }

  private applyDeathPenalty(player: PlayerPrivateState, multiplier = 1): number {
    const loss = Math.min(player.xp, Math.max(25, Math.round(this.nextLevelXp(player.level) * 0.12 * multiplier)));
    player.xp = Math.max(0, player.xp - loss);
    return loss;
  }

  private itemLabel(id: string): string {
    const labels: Record<string, string> = {
      "wolf-hide": "Wolf Hide",
      "boar-tusk": "Boar Tusk",
      "spider-silk": "Spider Silk",
      "bat-wing": "Bat Wing",
      "bone-shard": "Bone Shard",
      "bandit-mark": "Bandit Mark",
      "ore-fragment": "Ore Fragment",
      "wraith-ash": "Wraith Ash",
      "drake-scale": "Drake Scale",
      "eye-lens": "Eye Lens",
      "witch-charm": "Witch Charm",
      "dragon-ember": "Dragon Ember",
      "sentinel-core": "Sentinel Core",
      "mini-boss-relic": "Mini Boss Relic",
      "boss-relic": "Boss Relic",
      "arena-coin": "Coin",
      "pvp-coin": "PvP Coin",
      "pvp-adena-pouch": "Adena Exchange",
      "lesser-hp-potion": "Lesser HP Potion",
      "greater-hp-potion": "Greater HP Potion",
      "weapon-enchant-scroll": "No Grade Scroll: Enchant Weapon",
      "armor-enchant-scroll": "No Grade Scroll: Enchant Armor",
      "weapon-enchant-scroll-common": "No Grade Scroll: Enchant Weapon",
      "weapon-enchant-scroll-rare": "D-grade Scroll: Enchant Weapon",
      "weapon-enchant-scroll-epic": "C-grade Scroll: Enchant Weapon",
      "weapon-enchant-scroll-legendary": "B-grade Scroll: Enchant Weapon",
      "weapon-enchant-scroll-mythic": "A-grade Scroll: Enchant Weapon",
      "weapon-enchant-scroll-relic": "S-grade Scroll: Enchant Weapon",
      "armor-enchant-scroll-common": "No Grade Scroll: Enchant Armor",
      "armor-enchant-scroll-rare": "D-grade Scroll: Enchant Armor",
      "armor-enchant-scroll-epic": "C-grade Scroll: Enchant Armor",
      "armor-enchant-scroll-legendary": "B-grade Scroll: Enchant Armor",
      "armor-enchant-scroll-mythic": "A-grade Scroll: Enchant Armor",
      "armor-enchant-scroll-relic": "S-grade Scroll: Enchant Armor",
      "weapon-enchant-scroll-d": "No Grade Scroll: Enchant Weapon",
      "weapon-enchant-scroll-c": "D-grade Scroll: Enchant Weapon",
      "weapon-enchant-scroll-b": "C-grade Scroll: Enchant Weapon",
      "weapon-enchant-scroll-a": "B-grade Scroll: Enchant Weapon",
      "weapon-enchant-scroll-s": "A-grade Scroll: Enchant Weapon",
      "armor-enchant-scroll-d": "No Grade Scroll: Enchant Armor",
      "armor-enchant-scroll-c": "D-grade Scroll: Enchant Armor",
      "armor-enchant-scroll-b": "C-grade Scroll: Enchant Armor",
      "armor-enchant-scroll-a": "B-grade Scroll: Enchant Armor",
      "armor-enchant-scroll-s": "A-grade Scroll: Enchant Armor",
      "mistwood-cache": "Mistwood Cache",
      "ancient-coin": "Ancient Coin"
    };
    return labels[id] ?? id;
  }

  private stackableItem(id: string, quantity: number): InventoryItem {
    return {
      id,
      label: this.itemLabel(id),
      quantity,
      stackable: true,
      grade: id === PVP_COIN_ITEM_ID ? "relic" : undefined,
      appearance: id === PVP_COIN_ITEM_ID ? "pvp" : undefined,
      consumable: id === "lesser-hp-potion" ? { hp: 90 } : id === "greater-hp-potion" ? { hp: 220 } : undefined
    };
  }

  private addItem(player: PlayerPrivateState, id: string, quantity: number): void {
    this.addInventoryItem(player, this.stackableItem(id, quantity));
  }

  private inventoryQuantity(player: PlayerPrivateState, itemId: string): number {
    return player.inventory.reduce((total, item) => total + (item.id === itemId ? Math.max(0, item.quantity) : 0), 0);
  }

  private removeInventoryQuantity(player: PlayerPrivateState, itemId: string, quantity: number): number {
    let remaining = Math.max(0, Math.floor(quantity));
    let removed = 0;
    for (let index = player.inventory.length - 1; index >= 0 && remaining > 0; index -= 1) {
      const item = player.inventory[index];
      if (item.id !== itemId || item.quantity <= 0) {
        continue;
      }

      const taken = Math.min(item.quantity, remaining);
      item.quantity -= taken;
      removed += taken;
      remaining -= taken;
      if (item.quantity <= 0) {
        player.inventory.splice(index, 1);
      }
    }
    return removed;
  }

  private playerInventoryDropQuantity(player: PlayerPrivateState, itemId: string, chance: number, maxQuantity: number): number {
    const owned = this.inventoryQuantity(player, itemId);
    if (owned <= 0 || Math.random() > chance) {
      return 0;
    }

    const rolled = 1 + Math.floor(Math.random() * Math.max(1, maxQuantity));
    return Math.min(owned, rolled);
  }

  private dropGold(position: Vector2, quantity: number, sourceId?: string, ownerId?: string, ttlMs = GROUND_ITEM_TTL_MS, announce = true): GroundItem | undefined {
    if (quantity <= 0) {
      return undefined;
    }

    return this.dropGroundItem({
      kind: "gold",
      label: "gold",
      quantity,
      position: this.scatterGroundDrop(position),
      ownerId,
      expiresAt: Date.now() + ttlMs
    }, sourceId, announce);
  }

  private dropCoin(position: Vector2, quantity: number, sourceId?: string, ownerId?: string, ttlMs = GROUND_ITEM_TTL_MS, announce = true): GroundItem | undefined {
    if (quantity <= 0) {
      return undefined;
    }

    return this.dropGroundItem({
      kind: "coin",
      label: "Coin",
      quantity,
      position: this.scatterGroundDrop(position),
      ownerId,
      expiresAt: Date.now() + ttlMs
    }, sourceId, announce);
  }

  private dropPvpCoin(position: Vector2, quantity: number, sourceId?: string, ownerId?: string, ttlMs = PVP_GROUND_DROP_TTL_MS, announce = true): GroundItem | undefined {
    if (quantity <= 0) {
      return undefined;
    }

    return this.dropGroundItem({
      kind: "item",
      label: "PvP Coin",
      quantity,
      item: this.stackableItem(PVP_COIN_ITEM_ID, quantity),
      position: this.scatterGroundDrop(position),
      ownerId,
      expiresAt: Date.now() + ttlMs
    }, sourceId, announce);
  }

  private dropStackItem(position: Vector2, itemId: string, quantity: number, rare = false, sourceId?: string, ownerId?: string): GroundItem | undefined {
    if (quantity <= 0) {
      return undefined;
    }

    return this.dropGroundItem({
      kind: "item",
      label: this.itemLabel(itemId),
      quantity,
      item: this.stackableItem(itemId, quantity),
      rare,
      position: this.scatterGroundDrop(position),
      ownerId,
      expiresAt: Date.now() + (rare ? RARE_GROUND_ITEM_TTL_MS : GROUND_ITEM_TTL_MS)
    }, sourceId);
  }

  private dropGroundItem(item: Omit<GroundItem, "id">, sourceId?: string, announce = true): GroundItem {
    const groundItem: GroundItem = {
      ...item,
      sourceId,
      id: this.createId("drop")
    };
    this.groundItems.set(groundItem.id, groundItem);
    if (this.groundItems.size > MAX_GROUND_ITEMS) {
      this.pruneGroundItems(Date.now());
    }
    if (announce && groundItem.quantity > 0) {
      this.event(sourceId ?? groundItem.id, groundItem.id, groundItem.quantity, "loot", `${groundItem.quantity} ${groundItem.label} dropped.`);
      this.lootOwnerSystemChat(groundItem.ownerId, `${groundItem.quantity} ${groundItem.label} dropped.`);
    }
    return groundItem;
  }

  private groundItemTtl(item: Pick<GroundItem, "rare">): number {
    return item.rare ? RARE_GROUND_ITEM_TTL_MS : GROUND_ITEM_TTL_MS;
  }

  private groundItemOwnerUnlockAt(item: GroundItem): number {
    return item.expiresAt - this.groundItemTtl(item) + 18_000;
  }

  private pruneGroundItems(now: number): void {
    for (const [itemId, item] of this.groundItems.entries()) {
      if (item.expiresAt <= now) {
        this.groundItems.delete(itemId);
      }
    }

    if (this.groundItems.size <= MAX_GROUND_ITEMS) {
      return;
    }

    const overflow = this.groundItems.size - MAX_GROUND_ITEMS;
    [...this.groundItems.values()]
      .sort((first, second) => first.expiresAt - second.expiresAt)
      .slice(0, overflow)
      .forEach((item) => this.groundItems.delete(item.id));
  }

  private scatterGroundDrop(position: Vector2): Vector2 {
    const angle = Math.random() * Math.PI * 2;
    const distance = this.randomBetween(18, 58);
    return this.clampPosition({
      x: position.x + Math.cos(angle) * distance,
      y: position.y + Math.sin(angle) * distance
    });
  }

  private itemSellValue(item: InventoryItem): number {
    const directValues: Record<string, number> = {
      "wolf-hide": 4,
      "boar-tusk": 5,
      "spider-silk": 6,
      "bat-wing": 6,
      "bone-shard": 8,
      "bandit-mark": 11,
      "ore-fragment": 14,
      "wraith-ash": 18,
      "drake-scale": 28,
      "eye-lens": 24,
      "witch-charm": 30,
      "dragon-ember": 62,
      "sentinel-core": 38,
      "mini-boss-relic": 80,
      "boss-relic": 180,
      "arena-coin": 55,
      "pvp-coin": 320,
      "mistwood-cache": 22,
      "ancient-coin": 35,
      "lesser-hp-potion": 14,
      "greater-hp-potion": 42,
      "weapon-enchant-scroll": 90,
      "armor-enchant-scroll": 70,
      "weapon-enchant-scroll-common": 90,
      "weapon-enchant-scroll-rare": 280,
      "weapon-enchant-scroll-epic": 900,
      "weapon-enchant-scroll-legendary": 2900,
      "weapon-enchant-scroll-mythic": 8400,
      "weapon-enchant-scroll-relic": 26000,
      "armor-enchant-scroll-common": 70,
      "armor-enchant-scroll-rare": 210,
      "armor-enchant-scroll-epic": 650,
      "armor-enchant-scroll-legendary": 2100,
      "armor-enchant-scroll-mythic": 6100,
      "armor-enchant-scroll-relic": 19000,
      "weapon-enchant-scroll-d": 90,
      "weapon-enchant-scroll-c": 280,
      "weapon-enchant-scroll-b": 900,
      "weapon-enchant-scroll-a": 2900,
      "weapon-enchant-scroll-s": 8400,
      "armor-enchant-scroll-d": 70,
      "armor-enchant-scroll-c": 210,
      "armor-enchant-scroll-b": 650,
      "armor-enchant-scroll-a": 2100,
      "armor-enchant-scroll-s": 6100
    };
    const directValue = directValues[item.id];
    if (directValue !== undefined) {
      return directValue;
    }

    const shopOffer = SHOP_CATALOG.find((offer) => offer.item.id === item.id);
    if (shopOffer) {
      return Math.max(1, Math.round(shopOffer.priceGold * 0.42));
    }

    if (item.slot) {
      const gradeMultiplier = { common: 1, rare: 1.5, epic: 2.1, legendary: 3, mythic: 4.2, relic: 5.8 }[item.grade ?? "common"];
      const enchantBonus = (item.enchantLevel ?? 0) * 18;
      return Math.max(8, Math.round((item.requiredLevel ?? 1) * 9 * gradeMultiplier + enchantBonus));
    }

    return 1;
  }

  private resourceLootItem(kind: Exclude<WorldResource["kind"], "chest">): string {
    if (kind === "herb") {
      return "lesser-hp-potion";
    }
    if (kind === "wood") {
      return "mistwood-cache";
    }
    return "ore-fragment";
  }

  private randomChestItem(player: PlayerPrivateState): { id: string; label: string; quantity: number } | undefined {
    const roll = Math.random();
    if (roll < 0.18) {
      return undefined;
    }
    if (roll < 0.5) {
      return { id: player.level >= 10 ? "greater-hp-potion" : "lesser-hp-potion", label: player.level >= 10 ? "Greater HP Potion" : "Lesser HP Potion", quantity: 1 + Math.floor(Math.random() * 2) };
    }
    if (roll < 0.61) {
      const id = this.enchantScrollDropId(player.level, "weapon");
      return { id, label: this.itemLabel(id), quantity: 1 };
    }
    if (roll < 0.72) {
      const id = this.enchantScrollDropId(player.level, "armor");
      return { id, label: this.itemLabel(id), quantity: 1 };
    }
    if (roll < 0.88) {
      return { id: "ancient-coin", label: "Ancient Coin", quantity: 1 + Math.floor(Math.random() * 4) };
    }
    return { id: "arena-coin", label: "Coin", quantity: 1 + Math.floor(Math.random() * 2) };
  }

  private maybeDropMonsterLoot(player: PlayerPrivateState, monster: MonsterState): void {
    const boss = monster.archetype === "boss";
    const dungeonboss = monster.archetype === "dungeonboss";
    const miniboss = monster.archetype === "miniboss";
    if (!boss && !dungeonboss && !miniboss) {
      const potionChance = monster.level <= 8 ? 0.08 : 0.028;
      if (Math.random() < potionChance) {
        const potionId = monster.level >= 10 ? "greater-hp-potion" : "lesser-hp-potion";
        this.dropStackItem(monster.position, potionId, 1, false, monster.id, player.id);
      }
      const lootId = MONSTER_TUNING[monster.archetype].lootId;
      const lootChance = Math.min(0.36, 0.12 + monster.level * 0.004);
      if (Math.random() < lootChance) {
        const quantity = monster.level >= 24 && Math.random() < 0.24 ? 2 : 1;
        this.dropStackItem(monster.position, lootId, quantity, false, monster.id, player.id);
        this.event(player.id, monster.id, quantity, "loot", `${quantity} ${this.itemLabel(lootId)} dropped on the ground.`);
      }
      return;
    }

    const lootId = MONSTER_TUNING[monster.archetype].lootId;
    const chance = boss ? 1 : dungeonboss ? 0.94 : 0.84;
    if (Math.random() > chance) {
      return;
    }

    const quantity = boss
      ? 5 + Math.floor(monster.level / 25)
      : dungeonboss
        ? 3 + Math.floor(monster.level / 28)
        : 2 + Math.floor(monster.level / 35);
    this.dropStackItem(monster.position, lootId, quantity, true, monster.id, player.id);
    this.event(player.id, monster.id, quantity, "loot", `${quantity} ${this.itemLabel(lootId)} dropped on the ground.`);

    this.dropStackItem(monster.position, "greater-hp-potion", 1, boss || dungeonboss, monster.id, player.id);
  }

  private maybeDropEnchantScroll(player: PlayerPrivateState, monster: MonsterState): void {
    const boss = monster.archetype === "boss";
    const dungeonboss = monster.archetype === "dungeonboss";
    const miniboss = monster.archetype === "miniboss";
    const chance = boss ? 0.45 : dungeonboss ? 0.32 : miniboss ? 0.22 : Math.min(0.09, 0.012 + monster.level * 0.0012);
    if (Math.random() > chance) {
      return;
    }

    const quantity = boss || dungeonboss ? 2 : 1;
    const scrollId = this.enchantScrollDropId(monster.level, Math.random() < 0.55 ? "weapon" : "armor");
    const scrollLabel = this.itemLabel(scrollId);
    this.dropStackItem(monster.position, scrollId, quantity, true, monster.id, player.id);
    this.event(player.id, monster.id, quantity, "loot", `${quantity} ${scrollLabel} dropped on the ground.`);
  }

  private maybeDropCoin(player: PlayerPrivateState, monster: MonsterState): void {
    const boss = monster.archetype === "boss";
    const dungeonboss = monster.archetype === "dungeonboss";
    const miniboss = monster.archetype === "miniboss";
    const dragon = monster.archetype === "dragon";
    const chance = boss ? 1 : dungeonboss ? 0.76 : miniboss ? 0.62 : dragon ? 0.18 : Math.min(0.018, 0.0025 + monster.level * 0.00012);
    if (Math.random() > chance) {
      return;
    }

    const quantity = boss
      ? 7 + Math.floor(monster.level / 18)
      : dungeonboss
        ? 3 + Math.floor(monster.level / 24)
        : miniboss
          ? 2 + Math.floor(monster.level / 30)
          : dragon
            ? 1 + (Math.random() < 0.28 ? 1 : 0)
            : 1;
    this.addItem(player, "arena-coin", quantity);
    this.event(player.id, monster.id, quantity, "loot", `${player.name} found ${quantity} Coin from ${MONSTER_TUNING[monster.archetype].label}.`);
    this.lootSystemChat(player, `${player.name} found ${quantity} Coin from ${MONSTER_TUNING[monster.archetype].label}.`);
  }

  private awardPvpCoins(killer: PlayerPrivateState, target: PlayerPrivateState, killKind: "pk" | "pvp" | "red" | "duel" | "monster", _arenaReward = false): number {
    if (killKind !== "pvp" && killKind !== "duel" && killKind !== "red" && killKind !== "pk") {
      return 0;
    }

    const arenaBonus = this.isStarterArena(killer.position) && this.isStarterArena(target.position) ? 1 : 0;
    const levelDelta = Math.max(-2, Math.min(4, target.level - killer.level));
    const pkPenalty = killKind === "pk" ? -1 : 0;
    const quantity = Math.max(0, 1 + arenaBonus + pkPenalty + Math.floor(Math.max(0, levelDelta) / 2) + (Math.random() < 0.28 ? 1 : 0));
    return quantity;
  }

  private grantPvpCoin(killer: PlayerPrivateState, quantity: number): void {
    if (quantity <= 0) {
      return;
    }

    this.addItem(killer, PVP_COIN_ITEM_ID, quantity);
  }

  private awardPlayerKillXp(
    killer: PlayerPrivateState,
    target: PlayerPrivateState,
    killKind: "pk" | "pvp" | "red" | "duel" | "monster",
    now: number
  ): number {
    if (killKind === "monster" || killKind === "duel") {
      return 0;
    }

    const targetKey = this.pvpXpCharacterKey(target);
    if ((this.pvpXpTargetLocks.get(targetKey) ?? 0) > now) {
      return 0;
    }
    this.pvpXpTargetLocks.set(targetKey, now + PVP_XP_TARGET_LOCK_MS);
    if (target.level < Math.max(1, killer.level - 8)) {
      return 0;
    }

    const pairKey = `${this.pvpXpCharacterKey(killer)}->${targetKey}`;
    if ((this.pvpXpPairRecords.get(pairKey) ?? 0) > now) {
      return 0;
    }

    const kindMultiplier = killKind === "red" ? 0.24 : killKind === "pvp" ? 0.2 : 0.12;
    const levelDeltaMultiplier = Math.max(0.38, Math.min(1.32, 1 + (target.level - killer.level) * 0.045));
    const base = Math.round(this.nextLevelXp(target.level) * kindMultiplier * levelDeltaMultiplier + target.level * 26);
    const cap = Math.round(this.nextLevelXp(killer.level) * (killKind === "pk" ? 0.2 : 0.34));
    const xp = Math.max(80, Math.min(base, cap));

    this.pvpXpPairRecords.set(pairKey, now + PVP_XP_PAIR_COOLDOWN_MS);
    this.awardXp(killer, xp);
    this.event(killer.id, target.id, xp, "loot", `${killer.name} earned ${xp} XP from ${killKind === "pk" ? "PK" : "PvP"}.`);
    return xp;
  }

  private pvpXpCharacterKey(player: PlayerPrivateState): string {
    return player.characterId || player.id;
  }

  private updateArenaRating(killer: PlayerPrivateState, target: PlayerPrivateState, killKind: "pk" | "pvp" | "red" | "duel" | "monster"): number {
    if (killKind !== "pvp" || !this.isStarterArena(killer.position) || !this.isStarterArena(target.position)) {
      return 0;
    }

    const expected = 1 / (1 + 10 ** ((target.arenaRating - killer.arenaRating) / 400));
    const change = Math.max(8, Math.min(34, Math.round(22 * (1 - expected) + Math.max(0, target.level - killer.level) * 0.6)));
    killer.arenaRating += change;
    target.arenaRating = Math.max(700, target.arenaRating - Math.max(6, Math.round(change * 0.75)));
    killer.arenaWins += 1;
    target.arenaLosses += 1;
    killer.arenaStreak = Math.max(1, killer.arenaStreak + 1);
    target.arenaStreak = Math.min(-1, target.arenaStreak - 1);
    killer.arenaSeasonPoints += change + 4 + Math.max(0, killer.arenaStreak - 1);
    return change;
  }

  private playerKillSystemChat(
    killer: PlayerPrivateState,
    target: PlayerPrivateState,
    killKind: "pk" | "pvp" | "red" | "duel" | "monster",
    reward: { arenaPvpDeath: boolean; arenaRatingChange: number; coinDrop: number; pvpCoinDrop: number; pvpCoinReward: number; dropped: number; karmaGain?: number }
  ): void {
    if (this.botBrains.has(killer.id) && this.botBrains.has(target.id)) {
      return;
    }

    if (reward.arenaPvpDeath) {
      const parts = [`Arena: ${killer.name} defeated ${target.name}`];
      if (reward.pvpCoinReward > 0) {
        parts.push(`+${reward.pvpCoinReward} PvP Coin`);
      }
      if (reward.arenaRatingChange > 0) {
        parts.push(`rating +${reward.arenaRatingChange}`);
      }
      if (killer.arenaStreak >= 2) {
        parts.push(`streak x${killer.arenaStreak}`);
      }
      this.systemChat(`${parts.join(", ")}.`);
      return;
    }

    if (killKind === "pk") {
      const parts = [`PK: ${killer.name} killed ${target.name}`];
      if (reward.karmaGain) {
        parts.push(`karma +${reward.karmaGain}`);
      }
      if (reward.dropped > 0) {
        parts.push(`${reward.dropped} gold dropped`);
      }
      if (reward.coinDrop > 0) {
        parts.push(`${reward.coinDrop} Coin dropped`);
      }
      if (reward.pvpCoinDrop > 0) {
        parts.push(`${reward.pvpCoinDrop} PvP Coin dropped`);
      }
      this.systemChat(`${parts.join(", ")}.`);
      return;
    }

    if (killKind === "red") {
      this.systemChat(`${killer.name} punished red ${target.name}${reward.coinDrop ? `, +${reward.coinDrop} Coin` : ""}.`);
      return;
    }

    if (killKind === "duel") {
      this.systemChat(`Duel: ${killer.name} defeated ${target.name}.`);
      return;
    }

    if (killKind === "pvp") {
      const parts = [`PvP: ${killer.name} defeated ${target.name}`];
      if (reward.pvpCoinReward > 0) {
        parts.push(`+${reward.pvpCoinReward} PvP Coin`);
      }
      this.systemChat(`${parts.join(", ")}.`);
    }
  }

  private arenaSeasonState() {
    const now = Date.now();
    const seasonMs = ARENA_SEASON_DAYS * 24 * 60 * 60_000;
    const seasonIndex = Math.floor(now / seasonMs);
    const startsAt = seasonIndex * seasonMs;
    return {
      id: `s${seasonIndex}`,
      label: `Arena Season ${seasonIndex + 1}`,
      endsAt: startsAt + seasonMs,
      top: [...this.players.values()]
        .filter((player) => player.arenaWins > 0 || player.arenaSeasonPoints > 0)
        .sort((a, b) => b.arenaRating - a.arenaRating || b.arenaSeasonPoints - a.arenaSeasonPoints || b.arenaWins - a.arenaWins)
        .slice(0, 10)
        .map((player) => ({
          playerId: player.id,
          playerName: player.name,
          rating: player.arenaRating,
          wins: player.arenaWins,
          losses: player.arenaLosses,
          streak: player.arenaStreak,
          seasonPoints: player.arenaSeasonPoints
        }))
    };
  }

  private addInventoryItem(player: PlayerPrivateState, item: InventoryItem): void {
    const existing = item.stackable ? player.inventory.find((candidate) => candidate.id === item.id) : undefined;
    if (existing) {
      existing.quantity += item.quantity;
      return;
    }

    player.inventory.push({ ...item });
  }

  private cloneInventoryItem(item: InventoryItem, quantity = item.quantity): InventoryItem {
    return {
      ...item,
      quantity,
      stats: item.stats ? { ...item.stats } : undefined,
      consumable: item.consumable ? { ...item.consumable } : undefined
    };
  }

  private findEnchantTarget(player: PlayerPrivateState, itemId: string, requestedSlot?: EquipmentSlot): InventoryItem | undefined {
    if (requestedSlot) {
      const equipped = player.equipment[requestedSlot];
      return equipped?.id === itemId ? equipped : undefined;
    }

    const bagItem = player.inventory.find((candidate) => candidate.id === itemId && this.maxEnchantLevel(candidate) > 0);
    if (bagItem) {
      return bagItem;
    }

    return Object.values(player.equipment).find((candidate) => candidate?.id === itemId && this.maxEnchantLevel(candidate) > 0);
  }

  private isArmorEnchantSlot(slot?: EquipmentSlot): boolean {
    return (
      slot === "shield" ||
      slot === "helmet" ||
      slot === "chest" ||
      slot === "gloves" ||
      slot === "boots" ||
      slot === "necklace" ||
      slot === "earringLeft" ||
      slot === "earringRight" ||
      slot === "ringLeft" ||
      slot === "ringRight"
    );
  }

  private maxEnchantLevel(item?: InventoryItem): number {
    if (item?.slot === "weapon") {
      return MAX_WEAPON_ENCHANT_LEVEL;
    }
    if (this.isArmorEnchantSlot(item?.slot)) {
      return MAX_ARMOR_ENCHANT_LEVEL;
    }
    return 0;
  }

  private enchantScrollIds(item: InventoryItem): string[] {
    const kind = item.slot === "weapon" ? "weapon" : "armor";
    return enchantScrollIdsForGrade(kind, item.grade);
  }

  private enchantScrollDropId(level: number, kind: "weapon" | "armor"): string {
    const grade =
      level >= 76 ? "relic" : level >= 52 ? "mythic" : level >= 32 ? "legendary" : level >= 18 ? "epic" : level >= 8 ? "rare" : "common";
    return enchantScrollIdForGrade(kind, grade);
  }

  private normalizeBagForEquipment(inventory: InventoryItem[], equipment: EquipmentState): InventoryItem[] {
    const equippedCounts = new Map<string, number>();
    for (const item of Object.values(equipment)) {
      if (item && !item.stackable) {
        equippedCounts.set(item.id, (equippedCounts.get(item.id) ?? 0) + 1);
      }
    }

    return inventory
      .map((item) => ({ ...item }))
      .filter((item) => {
        const count = equippedCounts.get(item.id) ?? 0;
        if (count <= 0 || item.stackable) {
          return true;
        }

        equippedCounts.set(item.id, count - 1);
        return false;
      });
  }

  private starterInventory(classId: CharacterClass): InventoryItem[] {
    const weaponByClass: Record<CharacterClass, InventoryItem> = {
      warrior: { id: "trainee-sword", label: "Trainee Sword", quantity: 1, stackable: false, slot: "weapon", grade: "common", requiredLevel: 1, classId: "warrior", appearance: "blade", enchantable: true, stats: { attack: 7, str: 2 } },
      assassin: { id: "trainee-dagger", label: "Trainee Dagger", quantity: 1, stackable: false, slot: "weapon", grade: "common", requiredLevel: 1, classId: "assassin", appearance: "dagger", enchantable: true, stats: { attack: 6, speed: 16, dex: 3, crit: 2, attackSpeed: 2 } },
      mage: { id: "apprentice-staff", label: "Apprentice Staff", quantity: 1, stackable: false, slot: "weapon", grade: "common", requiredLevel: 1, classId: "mage", appearance: "staff", enchantable: true, stats: { magic: 12, mp: 28, castSpeed: 2 } },
      archer: { id: "hunter-bow", label: "Hunter Bow", quantity: 1, stackable: false, slot: "weapon", grade: "common", requiredLevel: 1, classId: "archer", appearance: "bow", enchantable: true, stats: { attack: 7, speed: 6, dex: 2, crit: 2 } },
      tank: { id: "guard-mace", label: "Guard Mace", quantity: 1, stackable: false, slot: "weapon", grade: "common", requiredLevel: 1, classId: "tank", appearance: "mace", enchantable: true, stats: { attack: 4, defense: 5, str: 1 } }
    };
    const classGear: Record<CharacterClass, InventoryItem[]> = {
      warrior: [{ id: "warrior-buckler", label: "Warrior Buckler", quantity: 1, stackable: false, slot: "shield", grade: "common", requiredLevel: 1, classId: "warrior", stats: { defense: 5, hp: 12 } }],
      assassin: [
        { id: "cutthroat-gloves", label: "Cutthroat Gloves", quantity: 1, stackable: false, slot: "gloves", grade: "common", requiredLevel: 1, classId: "assassin", appearance: "shadow", stats: { attack: 3, speed: 10, attackSpeed: 1 } },
        { id: "swift-ring", label: "Swift Ring", quantity: 1, stackable: false, slot: "ringLeft", grade: "common", stats: { speed: 7, dex: 1 } }
      ],
      mage: [
        { id: "novice-robe", label: "Novice Robe", quantity: 1, stackable: false, slot: "chest", grade: "common", requiredLevel: 1, classId: "mage", appearance: "arcane", stats: { mp: 24, magic: 5 } },
        { id: "mana-earring", label: "Mana Earring", quantity: 1, stackable: false, slot: "earringLeft", grade: "common", stats: { mp: 16, magic: 3 } }
      ],
      archer: [
        { id: "scout-gloves", label: "Scout Gloves", quantity: 1, stackable: false, slot: "gloves", grade: "common", requiredLevel: 1, classId: "archer", appearance: "hunter", stats: { attack: 3, speed: 5, crit: 1 } },
        { id: "hawk-ring", label: "Hawk Ring", quantity: 1, stackable: false, slot: "ringLeft", grade: "common", stats: { attack: 2, dex: 1 } }
      ],
      tank: [
        { id: "tower-shield", label: "Tower Shield", quantity: 1, stackable: false, slot: "shield", grade: "common", requiredLevel: 1, classId: "tank", stats: { defense: 12, hp: 28, speed: -8 } },
        { id: "iron-helmet", label: "Iron Helmet", quantity: 1, stackable: false, slot: "helmet", grade: "common", requiredLevel: 1, classId: "tank", appearance: "guardian", stats: { defense: 6, hp: 18 } }
      ]
    };
    const commonChest =
      classId === "mage"
        ? { id: "linen-wraps", label: "Linen Wraps", quantity: 1, stackable: false, stats: { defense: 1 } }
        : { id: "linen-shirt", label: "Linen Shirt", quantity: 1, stackable: false, slot: "chest" as const, grade: "common" as const, requiredLevel: 1, appearance: "cloth", stats: { hp: 18, defense: 3 } };

    return [
      weaponByClass[classId],
      ...classGear[classId],
      commonChest,
      { id: "travel-boots", label: "Travel Boots", quantity: 1, stackable: false, slot: "boots", grade: "common", requiredLevel: 1, appearance: "cloth", stats: { speed: 8 } },
      { id: "bone-necklace", label: "Bone Necklace", quantity: 1, stackable: false, slot: "necklace", grade: "common", stats: { mp: 10 } },
      { id: "lesser-hp-potion", label: "Lesser HP Potion", quantity: 8, stackable: true, consumable: { hp: 90 } },
      { id: "training-token", label: "Training Token", quantity: 1, stackable: true }
    ];
  }

  private starterEquipment(classId: CharacterClass): EquipmentState {
    const inventory = this.starterInventory(classId);
    const equipment: EquipmentState = {};
    for (const item of inventory) {
      if (item.slot && !equipment[item.slot]) {
        equipment[item.slot] = item;
      }
    }
    return equipment;
  }

  private botEquipment(classId: CharacterClass, level: number, index = 0, generation = 0): EquipmentState {
    const equipment: EquipmentState = { ...this.starterEquipment(classId) };
    const slots: EquipmentSlot[] = ["weapon", "helmet", "chest", "gloves", "boots"];
    for (const slot of slots) {
      const item = this.botShopEquipment(classId, slot, level, index, generation);
      if (item) {
        equipment[slot] = this.botPreparedEquipmentItem(item, level, slot, index, generation);
      } else {
        const starterItem = equipment[slot];
        if (starterItem) {
          equipment[slot] = this.botPreparedEquipmentItem(starterItem, level, slot, index, generation);
        }
      }
    }
    return equipment;
  }

  private botPreparedEquipmentItem(item: InventoryItem, level: number, slot: EquipmentSlot, index: number, generation: number): InventoryItem {
    const enchantLevel = this.botEnchantLevel(level, slot, item.grade, index, generation);
    const prepared: InventoryItem = { ...item, quantity: 1 };
    this.applyBotGearVariant(prepared, level, slot, index, generation);
    if (enchantLevel > 0) {
      prepared.enchantLevel = enchantLevel;
      prepared.enchantable = true;
    }
    return prepared;
  }

  private botShopEquipment(classId: CharacterClass, slot: EquipmentSlot, level: number, index: number, generation: number): InventoryItem | undefined {
    const options = SHOP_CATALOG.map((offer) => offer.item)
      .filter((item) => item.slot === slot && (!item.classId || item.classId === classId) && (item.requiredLevel ?? 1) <= level)
      .sort((a, b) => (b.requiredLevel ?? 1) - (a.requiredLevel ?? 1) || this.gradeScore(b.grade) - this.gradeScore(a.grade));

    if (options.length === 0) {
      return undefined;
    }

    const seed = this.botGearSeed(slot, level, index, generation);
    const preferDowngrade = level < 20 ? seed % 100 < (slot === "weapon" ? 32 : 46) : seed % 100 < 16;
    const downgradeSpan = Math.min(2, Math.max(0, options.length - 1));
    const downgradeIndex = preferDowngrade && downgradeSpan > 0 ? 1 + (Math.floor(seed / 7) % downgradeSpan) : 0;
    return options[Math.min(downgradeIndex, options.length - 1)] ?? options[0];
  }

  private applyBotGearVariant(item: InventoryItem, level: number, slot: EquipmentSlot, index: number, generation: number): void {
    if (!["helmet", "chest", "gloves", "boots", "weapon"].includes(slot)) {
      return;
    }

    const seed = this.botGearSeed(slot, level, index, generation);
    const armorLooks = ["steel", "shadow", "arcane", "hunter", "guardian", "cloth"] as const;
    if (slot !== "weapon" && level < 22 && seed % 100 < 72) {
      const appearance = armorLooks[seed % armorLooks.length];
      item.appearance = appearance;
      if (seed % 5 === 0) {
        const prefixes = ["Road", "Ash", "Old", "Wolf", "Copper"];
        item.label = `${prefixes[Math.floor(seed / 5) % prefixes.length]} ${item.label}`;
      }
    }

    if (level < 20 && item.stats && seed % 100 < 64) {
      const lean = seed % 4;
      item.stats = { ...item.stats };
      if (lean === 0) {
        item.stats.speed = (item.stats.speed ?? 0) + 4;
      } else if (lean === 1) {
        item.stats.hp = (item.stats.hp ?? 0) + 14;
      } else if (lean === 2) {
        item.stats.defense = (item.stats.defense ?? 0) + 3;
      } else {
        item.stats.crit = (item.stats.crit ?? 0) + 2;
      }
    }
  }

  private botGearSeed(slot: EquipmentSlot, level: number, index: number, generation: number): number {
    return Math.abs(index * 97 + generation * 131 + level * 29 + slot.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0));
  }

  private botEnchantLevel(level: number, slot: EquipmentSlot, grade: InventoryItem["grade"], index: number, generation: number): number {
    if (!["weapon", "helmet", "chest", "gloves", "boots"].includes(slot) || level < 4) {
      return 0;
    }

    const gradeBonus = Math.max(0, this.gradeScore(grade) - 2);
    const seed = (index * 37 + generation * 17 + level * 11 + slot.length * 13) % 9;
    const jitter = seed % 3;
    const base = slot === "weapon"
      ? Math.floor(level / 8) + gradeBonus + jitter
      : Math.floor(level / 13) + Math.max(0, gradeBonus - 1) + (jitter > 1 ? 1 : 0);
    const cap = slot === "weapon" ? MAX_WEAPON_ENCHANT_LEVEL : 10;
    const flex = level >= 70 && slot === "weapon" ? 2 : level >= 50 && slot === "weapon" ? 1 : 0;
    return Math.max(0, Math.min(cap, base + flex));
  }

  private botInventory(classId: CharacterClass, level: number): InventoryItem[] {
    const potionId = level >= 10 ? "greater-hp-potion" : "lesser-hp-potion";
    return this.starterInventory(classId)
      .filter((item) => item.stackable || item.consumable)
      .map((item) =>
        item.id === "lesser-hp-potion"
          ? { ...item, id: potionId, label: level >= 10 ? "Greater HP Potion" : "Lesser HP Potion", quantity: level >= 10 ? 10 : 8, consumable: { hp: level >= 10 ? 220 : 90 } }
          : { ...item }
      );
  }

  private bestShopEquipment(classId: CharacterClass, slot: EquipmentSlot, level: number): InventoryItem | undefined {
    return SHOP_CATALOG.map((offer) => offer.item)
      .filter((item) => item.slot === slot && (!item.classId || item.classId === classId) && (item.requiredLevel ?? 1) <= level)
      .sort((a, b) => (b.requiredLevel ?? 1) - (a.requiredLevel ?? 1) || this.gradeScore(b.grade) - this.gradeScore(a.grade))
      [0];
  }

  private gradeScore(grade?: InventoryItem["grade"]): number {
    const scores: Record<NonNullable<InventoryItem["grade"]>, number> = { common: 1, rare: 2, epic: 3, legendary: 4, mythic: 5, relic: 6 };
    return grade ? scores[grade] : 0;
  }

  private deriveStats(classId: CharacterClass, level: number, equipment: EquipmentState): DerivedStats {
    const classDef = CLASS_DEFINITIONS[classId];
    const growth = this.classGrowth(classId);
    const stats: DerivedStats = {
      hp: classDef.maxHp + (level - 1) * growth.hp,
      cp: 0,
      mp: classDef.maxMp + (level - 1) * growth.mp,
      attack: classDef.attackDamage + (level - 1) * growth.attack,
      magic: growth.magicBase + (level - 1) * growth.magic,
      defense: growth.defenseBase + (level - 1) * growth.defense,
      speed: classDef.speed,
      str: this.baseStr(classId) + Math.floor((level - 1) * 0.55),
      dex: this.baseDex(classId) + Math.floor((level - 1) * 0.45),
      crit: this.baseCrit(classId),
      attackSpeed: 0,
      castSpeed: 0
    };

    for (const item of Object.values(equipment)) {
      stats.hp += item?.stats?.hp ?? 0;
      stats.mp += item?.stats?.mp ?? 0;
      stats.attack += item?.stats?.attack ?? 0;
      stats.magic += item?.stats?.magic ?? 0;
      stats.defense += item?.stats?.defense ?? 0;
      stats.speed += item?.stats?.speed ?? 0;
      stats.str += item?.stats?.str ?? 0;
      stats.dex += item?.stats?.dex ?? 0;
      stats.crit += item?.stats?.crit ?? 0;
      stats.attackSpeed += item?.stats?.attackSpeed ?? 0;
      stats.castSpeed += item?.stats?.castSpeed ?? 0;
      if (item) {
        const enchant = this.enchantBonus(item);
        stats.attack += enchant.attack ?? 0;
        stats.magic += enchant.magic ?? 0;
        stats.defense += enchant.defense ?? 0;
      }
    }

    stats.cp = this.deriveMaxCp(classId, level, stats);
    return stats;
  }

  private deriveMaxCp(classId: CharacterClass, level: number, stats: DerivedStats): number {
    const classMultiplier: Record<CharacterClass, number> = {
      warrior: 1.42,
      assassin: 1.24,
      mage: 1.18,
      archer: 1.28,
      tank: 1.58
    };
    const scaledCp = Math.round(stats.hp * classMultiplier[classId] + stats.defense * 1.85 + level * 5.2);
    return Math.max(stats.hp + 45 + level * 4, scaledCp);
  }

  private enchantBonus(item: InventoryItem): Partial<Pick<DerivedStats, "attack" | "magic" | "defense">> {
    const level = item.enchantLevel ?? 0;
    if (level <= 0) {
      return {};
    }

    const overSafe = Math.max(0, level - 3);
    if (item.slot === "weapon") {
      const scale = item.stats?.magic && !item.stats?.attack ? 3.6 : 2.4;
      const highEnchant = Math.max(0, level - 10);
      const bonus = Math.round(level * scale + overSafe * 1.4 + highEnchant * highEnchant * 0.12);
      return item.stats?.magic && !item.stats?.attack ? { magic: bonus } : { attack: bonus, magic: item.stats?.magic ? Math.ceil(bonus * 0.55) : 0 };
    }

    return { defense: level + Math.floor(overSafe * 0.5) };
  }

  private classGrowth(classId: CharacterClass): ClassGrowth {
    const table: Record<CharacterClass, ClassGrowth> = {
      warrior: { hp: 11, mp: 3, attack: 2.5, magicBase: 4, magic: 1, defenseBase: 8, defense: 1.4 },
      assassin: { hp: 9, mp: 4, attack: 2.1, magicBase: 4, magic: 0.8, defenseBase: 8, defense: 1.1 },
      mage: { hp: 6, mp: 8, attack: 0.9, magicBase: 20, magic: 4.2, defenseBase: 3, defense: 0.6 },
      archer: { hp: 8, mp: 4, attack: 1.9, magicBase: 5, magic: 1, defenseBase: 5, defense: 0.9 },
      tank: { hp: 15, mp: 2, attack: 1.3, magicBase: 3, magic: 0.5, defenseBase: 14, defense: 2.2 }
    };
    return table[classId];
  }

  private baseCrit(classId: CharacterClass): number {
    const table: Record<CharacterClass, number> = {
      warrior: 4,
      assassin: 10,
      mage: 3,
      archer: 8,
      tank: 2
    };
    return table[classId];
  }

  private baseStr(classId: CharacterClass): number {
    const table: Record<CharacterClass, number> = {
      warrior: 12,
      assassin: 9,
      mage: 5,
      archer: 8,
      tank: 11
    };
    return table[classId];
  }

  private baseDex(classId: CharacterClass): number {
    const table: Record<CharacterClass, number> = {
      warrior: 7,
      assassin: 14,
      mage: 6,
      archer: 12,
      tank: 5
    };
    return table[classId];
  }

  private recalculateStats(player: PlayerPrivateState): void {
    const previousMaxHp = player.maxHp;
    const previousMaxCp = player.maxCp;
    const previousMaxMp = player.maxMp;
    player.stats = this.deriveStats(player.classId, player.level, player.equipment);
    player.maxHp = player.stats.hp;
    player.maxCp = player.stats.cp;
    player.maxMp = player.stats.mp;
    player.hp = Math.min(player.maxHp, player.hp + Math.max(0, player.maxHp - previousMaxHp));
    player.cp = Math.min(player.maxCp, player.cp + Math.max(0, player.maxCp - previousMaxCp));
    player.mp = Math.min(player.maxMp, player.mp + Math.max(0, player.maxMp - previousMaxMp));
  }

  private basicAttackDamage(player: PlayerPrivateState): number {
    const strBonus = 1 + player.stats.str * 0.012;
    if (player.classId === "mage") {
      return Math.max(6, (player.stats.attack * 0.45 + player.stats.magic * 0.42) * (1 + player.stats.castSpeed * 0.004));
    }
    if (player.classId === "assassin") {
      return Math.max(4, player.stats.attack * 0.86 * strBonus);
    }
    if (player.classId === "tank") {
      return Math.max(4, player.stats.attack * 0.9 * strBonus);
    }
    return player.stats.attack * strBonus;
  }

  private attackCooldownMs(player: PlayerPrivateState): number {
    const base = CLASS_DEFINITIONS[player.classId].attackCooldownMs;
    return Math.round(base * Math.max(0.45, 1 - player.stats.dex * 0.012 - player.stats.attackSpeed * 0.006));
  }

  private skillCooldownMs(player: PlayerPrivateState, baseCooldownMs: number): number {
    return Math.round(baseCooldownMs * Math.max(0.62, 1 - player.stats.castSpeed * 0.005));
  }

  private skillDamage(player: PlayerPrivateState, baseDamage: number): number {
    if (player.classId === "mage") {
      return Math.round(baseDamage + player.stats.magic * 0.98);
    }
    if (player.classId === "assassin") {
      return Math.round(baseDamage + player.stats.attack * 0.7);
    }
    if (player.classId === "tank") {
      return Math.round(baseDamage + player.stats.attack * 0.45);
    }
    if (player.classId === "archer") {
      return Math.round(baseDamage + player.stats.attack * 0.65);
    }
    return Math.round(baseDamage + player.stats.attack * 0.6);
  }

  private skillHealing(player: PlayerPrivateState, baseHeal: number): number {
    if (player.classId === "mage") {
      return Math.round(baseHeal + player.stats.magic * 0.72);
    }
    return Math.round(baseHeal + player.stats.magic * 0.45 + player.stats.defense * 0.18);
  }

  private rollCriticalDamage(player: PlayerPrivateState, damage: number, kind: "attack" | "skill"): number {
    const classBonus = player.classId === "assassin" ? 0.035 : player.classId === "archer" ? 0.025 : 0;
    const chance = Math.min(0.38, (player.stats.crit ?? 0) * 0.004 + classBonus + (kind === "attack" ? 0.015 : 0));
    return Math.random() < chance ? Math.round(damage * 1.55) : damage;
  }

  private monsterMaxHp(archetype: MonsterArchetype, level: number): number {
    const tuning = MONSTER_TUNING[archetype];
    const rankMultiplier = archetype === "boss" ? 1.25 : archetype === "dungeonboss" ? 1.18 : archetype === "miniboss" ? 1.12 : 1;
    return Math.round(tuning.baseHp + tuning.hpPerLevel * Math.max(1, level) * rankMultiplier);
  }

  private monsterDamage(monster: MonsterState): number {
    const tuning = MONSTER_TUNING[monster.archetype];
    const base = tuning.baseDamage + tuning.damagePerLevel * Math.max(1, monster.level);
    const progressionEase =
      monster.level <= 2
        ? 0.58
        : monster.level <= 5
          ? 0.72
          : monster.level <= 10
            ? 0.84
            : monster.level <= 15
              ? 0.9
              : monster.level <= 24
                ? 0.82
                : monster.level <= 32
                  ? 0.74
                  : monster.level <= 45
                    ? 0.86
                    : 1;
    const archetypeEase =
      monster.level <= 45 && monster.archetype === "dragon"
        ? 0.66
        : monster.level <= 45 && monster.archetype === "drake"
          ? 0.74
          : monster.level <= 32 && monster.archetype === "bat"
            ? 0.88
            : 1;
    return Math.max(1, Math.round(base * progressionEase * archetypeEase));
  }

  private monsterAttackDamage(monster: MonsterState, attackStyle: MonsterAttackStyle): number {
    const base = this.monsterDamage(monster);
    if (attackStyle === "power-arrow") {
      return Math.max(1, Math.round(base * 1.16));
    }
    if (attackStyle === "lightning") {
      return Math.max(1, Math.round(base * (monster.archetype === "dungeonboss" ? 1.12 : monster.archetype === "mage" ? 1.06 : 1)));
    }
    if (attackStyle === "arcane" && monster.archetype === "dungeonboss") {
      return Math.max(1, Math.round(base * 1.08));
    }
    return base;
  }

  private monsterDamagePressure(monsterId: string, target: PlayerPrivateState): number {
    const monster = this.monsters.get(monsterId);
    if (!monster || monster.archetype === "boss" || monster.archetype === "dungeonboss" || monster.archetype === "miniboss") {
      return 1;
    }

    const playerLevelAdvantage = target.level - monster.level;
    if (playerLevelAdvantage <= 0) {
      return 1;
    }

    const levelPressure = Math.max(0.62, 1 - Math.min(0.38, playerLevelAdvantage * 0.035));
    const botSurvivalPressure = this.botBrains.has(target.id) ? 0.9 : 1;
    const lowDragonPressure = monster.level <= 45 && (monster.archetype === "dragon" || monster.archetype === "drake") ? 0.92 : 1;
    return levelPressure * botSurvivalPressure * lowDragonPressure;
  }

  private monsterSpeed(monster: MonsterState): number {
    const tuning = MONSTER_TUNING[monster.archetype];
    return tuning.speed + Math.min(42, Math.max(0, monster.level - 1) * 1.4);
  }

  private monsterCanAttack(monster: MonsterState, now: number): boolean {
    const readyAt = this.monsterAttackReadyAt.get(monster.id);
    const tuning = MONSTER_TUNING[monster.archetype];
    if (readyAt === undefined) {
      this.monsterAttackReadyAt.set(monster.id, now + this.initialMonsterAttackDelay(monster));
      return false;
    }
    if (now < readyAt) {
      return false;
    }

    this.monsterAttackReadyAt.set(monster.id, now + tuning.attackCooldownMs);
    return true;
  }

  private monsterAttackStyle(monster: MonsterState, target: PlayerPrivateState, now: number): MonsterAttackStyle {
    const tuning = MONSTER_TUNING[monster.archetype];
    const styles = tuning.attackStyles ?? (tuning.attackStyle ? [tuning.attackStyle] : undefined);
    if (styles?.length) {
      const attackCycle = Math.floor(now / Math.max(300, tuning.attackCooldownMs));
      const index = Math.floor(this.stableUnit(`${monster.id}:${target.id}:${attackCycle}`) * styles.length) % styles.length;
      return styles[index] ?? styles[0] ?? "claw";
    }

    if (monster.archetype === "drake" || monster.archetype === "dragon") {
      return "flame";
    }
    if (monster.archetype === "golem" || monster.archetype === "miniboss" || monster.archetype === "dungeonboss" || monster.archetype === "boss") {
      return "slam";
    }
    if (monster.archetype === "wraith" || monster.archetype === "bat") {
      return "shadow";
    }
    if (monster.archetype === "eye" || monster.archetype === "witch") {
      return "arcane";
    }
    if (monster.archetype === "bandit" || monster.archetype === "skeleton" || monster.archetype === "sentinel") {
      return "weapon";
    }
    return "claw";
  }

  private initialMonsterAttackDelay(monster: MonsterState): number {
    let hash = 0;
    for (let index = 0; index < monster.id.length; index += 1) {
      hash = (hash + monster.id.charCodeAt(index) * (index + 3)) % 997;
    }
    const starterExtra = monster.level <= 3 ? 420 : 180;
    return starterExtra + 360 + (hash % 420);
  }

  private movePlayerNearTarget(player: PlayerPrivateState, target: MonsterState | PlayerPrivateState, distanceFromTarget: number): void {
    const distance = this.distance(player.position, target.position);
    const direction =
      distance > 0.001
        ? {
            x: (target.position.x - player.position.x) / distance,
            y: (target.position.y - player.position.y) / distance
          }
        : player.facing;
    player.position = this.clampPlayerPosition(player, {
      x: target.position.x - direction.x * distanceFromTarget,
      y: target.position.y - direction.y * distanceFromTarget
    }, { pushOutOfSafeZone: true });
    player.zone = this.zoneFor(player.position);
    player.velocity = { x: 0, y: 0 };
  }

  private monsterGold(monster: MonsterState): number {
    const tuning = MONSTER_TUNING[monster.archetype];
    return Math.round(tuning.goldBase + tuning.goldPerLevel * monster.level);
  }

  private monsterXp(monster: MonsterState): number {
    const tuning = MONSTER_TUNING[monster.archetype];
    const starterBonus = monster.level <= 5 ? 1.16 : monster.level <= 10 ? 1.1 : monster.level <= 15 ? 1.06 : 1;
    return Math.max(1, Math.round((tuning.xpBase + tuning.xpPerLevel * monster.level) * 0.9 * starterBonus));
  }

  private monsterRespawnMs(monster: MonsterState): number {
    if (monster.archetype === "boss") {
      return 65000 + monster.level * 1400;
    }
    if (monster.archetype === "dungeonboss") {
      return 56000 + monster.level * 1100;
    }
    if (monster.archetype === "miniboss") {
      return 45000 + monster.level * 900;
    }
    return Math.max(12000, 20000 - monster.level * 90);
  }

  private damageAgainstMonster(source: PlayerPrivateState, target: MonsterState, rawDamage: number): number {
    const levelGap = target.level - source.level;
    const highLevelReduction =
      levelGap > 0
        ? Math.pow(target.archetype === "boss" ? 0.78 : target.archetype === "dungeonboss" ? 0.79 : target.archetype === "miniboss" ? 0.8 : 0.84, levelGap)
        : 1 + Math.min(0.45, Math.abs(levelGap) * 0.025);
    const armor = this.monsterArmor(target);
    const armorReduction = armor / (armor + 125);
    return Math.max(1, Math.round(rawDamage * highLevelReduction * (1 - armorReduction)));
  }

  private cleanseKarmaFromMonster(player: PlayerPrivateState, monster: MonsterState): void {
    if (player.karma <= 0) {
      return;
    }

    const previous = player.karma;
    const levelFactor = Math.max(1, monster.level);
    const bossBonus = monster.archetype === "boss" ? 5.5 : monster.archetype === "dungeonboss" ? 3.4 : monster.archetype === "miniboss" ? 2.4 : 1;
    const levelBonus = monster.level >= player.level ? 1.25 : 1;
    const cleanse = Math.round((170 + levelFactor * 44 + this.monsterXp(monster) * 0.28) * bossBonus * levelBonus);
    player.karma = Math.max(0, player.karma - cleanse);
    if (previous > 0 && player.karma === 0) {
      this.systemChat(`${player.name} washed off PK karma.`);
    }
  }

  private monsterArmor(monster: MonsterState): number {
    const baseByType: Record<MonsterArchetype, number> = {
      wolf: 4,
      boar: 8,
      spider: 6,
      bat: 5,
      skeleton: 16,
      bandit: 12,
      archer: 10,
      mage: 15,
      golem: 24,
      wraith: 18,
      drake: 28,
      eye: 17,
      witch: 22,
      dragon: 42,
      sentinel: 38,
      venomplant: 14,
      bonewarrior: 18,
      firespirit: 12,
      miniboss: 44,
      dungeonboss: 48,
      boss: 52
    };
    return baseByType[monster.archetype] + monster.level * (monster.archetype === "boss" ? 4.2 : monster.archetype === "dungeonboss" ? 3.6 : monster.archetype === "miniboss" ? 3.1 : 1.8);
  }

  private dashMultiplier(classId: CharacterClass): number {
    const table: Record<CharacterClass, number> = {
      warrior: 1.85,
      assassin: 2.55,
      mage: 1.55,
      archer: 2.05,
      tank: 1.35
    };
    return table[classId];
  }

  private sprintMultiplier(classId: CharacterClass): number {
    const table: Record<CharacterClass, number> = {
      warrior: 1.34,
      assassin: 1.46,
      mage: 1.28,
      archer: 1.38,
      tank: 1.22
    };
    return table[classId];
  }

  private botMovementScale(player: PlayerPrivateState): number {
    if (!this.botBrains.has(player.id)) {
      return 1;
    }
    if (player.classId === "archer" || player.classId === "mage") {
      return BOT_RANGED_MOVEMENT_SCALE;
    }
    if (player.classId === "tank") {
      return BOT_TANK_MOVEMENT_SCALE;
    }
    return BOT_MELEE_MOVEMENT_SCALE;
  }

  private blockMoveMultiplier(classId: CharacterClass): number {
    return classId === "tank" ? 0.55 : 0.42;
  }

  private manaRegen(classId: CharacterClass): number {
    const table: Record<CharacterClass, number> = {
      warrior: 2.8,
      assassin: 3.6,
      mage: 7.2,
      archer: 3.2,
      tank: 2.4
    };
    return table[classId];
  }

  private healthRegen(player: PlayerPrivateState): number {
    const table: Record<CharacterClass, number> = {
      warrior: 2.6,
      assassin: 2.2,
      mage: 1.8,
      archer: 2.1,
      tank: 3.4
    };
    const safeBonus = player.zone === "safe" ? 1.65 : 1;
    return (table[player.classId] + player.maxHp * 0.006) * safeBonus;
  }

  private cpRegen(player: PlayerPrivateState, now: number): number {
    if (player.hp <= 0 || player.downed || player.maxCp <= 0) {
      return 0;
    }

    const combatLocked = this.hasRecentPlayerCombat(player.id, now);
    if (combatLocked || this.isPvpFlagged(player, now)) {
      return player.zone === "safe" ? player.maxCp * 0.018 : player.maxCp * 0.004;
    }

    const safeBonus = player.zone === "safe" ? 2.4 : 1;
    return (4 + player.maxCp * 0.018 + player.level * 0.16) * safeBonus;
  }

  private hasRecentPlayerCombat(playerId: string, now: number): boolean {
    for (const [key, expiresAt] of this.playerHitRecords.entries()) {
      if (!key.startsWith(`${playerId}->`) && !key.endsWith(`->${playerId}`)) {
        continue;
      }
      if (expiresAt > now && expiresAt - PLAYER_COMBAT_MS + PVP_CP_REGEN_COMBAT_LOCK_MS > now) {
        return true;
      }
    }
    return false;
  }

  private canEquipToSlot(player: PlayerPrivateState, item: InventoryItem, slot: EquipmentSlot): boolean {
    if (!item.slot) {
      return false;
    }
    if (item.classId && item.classId !== player.classId) {
      return false;
    }
    if ((item.requiredLevel ?? 1) > player.level) {
      return false;
    }

    if (item.slot === "ringLeft" || item.slot === "ringRight") {
      return slot === "ringLeft" || slot === "ringRight";
    }
    if (item.slot === "earringLeft" || item.slot === "earringRight") {
      return slot === "earringLeft" || slot === "earringRight";
    }
    return item.slot === slot;
  }

  private pairedEquipmentSlots(slot?: EquipmentSlot): [EquipmentSlot, EquipmentSlot] | undefined {
    if (slot === "ringLeft" || slot === "ringRight") {
      return ["ringLeft", "ringRight"];
    }
    if (slot === "earringLeft" || slot === "earringRight") {
      return ["earringLeft", "earringRight"];
    }
    return undefined;
  }

  private preferredEquipSlot(player: PlayerPrivateState, item: InventoryItem, requestedSlot: EquipmentSlot): EquipmentSlot {
    const pairedSlots = this.pairedEquipmentSlots(item.slot);
    if (!pairedSlots || !pairedSlots.includes(requestedSlot)) {
      return requestedSlot;
    }
    if (!player.equipment[requestedSlot]) {
      return requestedSlot;
    }
    return pairedSlots.find((slot) => !player.equipment[slot]) ?? requestedSlot;
  }

  private awardXp(player: PlayerPrivateState, amount: number): void {
    const brain = this.botBrains.get(player.id);
    if (brain) {
      this.enforceBotLevelCap(player, brain);
    }
    const botLevelCap = brain ? this.currentBotLevelCap() : Number.POSITIVE_INFINITY;
    const earnedXp = brain ? Math.round(amount * BOT_XP_MULTIPLIER) : amount;
    player.xp += earnedXp;
    let nextLevelXp = this.nextLevelXp(player.level);
    while (player.xp >= nextLevelXp && player.level < botLevelCap) {
      player.xp -= nextLevelXp;
      player.level += 1;
      this.recalculateStats(player);
      player.hp = player.maxHp;
      player.cp = player.maxCp;
      player.mp = player.maxMp;
      this.event(player.id, player.id, player.level, "loot", `${player.name} reached level ${player.level}.`);
      this.systemChat(`${player.name} reached level ${player.level}.`);
      if (brain) {
        this.maybeBotBuyGear(player, brain, Date.now(), true);
        brain.groundIndex = this.botInitialGroundIndex(player.level, brain.index, brain.generation);
        brain.roamTarget = undefined;
        brain.chillUntil = Date.now() + this.randomBetween(1_500, 5_500);
      }
      nextLevelXp = this.nextLevelXp(player.level);
    }
    if (brain && player.level >= botLevelCap) {
      player.xp = Math.min(player.xp, Math.max(0, this.nextLevelXp(player.level) - 1));
    }
  }

  private nextLevelXp(level: number): number {
    return xpForNextLevel(level);
  }

  private seedWorld(): void {
    if (this.monsters.size > 0) {
      return;
    }

    const starterWolfPositions = [
      { x: 2400, y: 1260 },
      { x: 2800, y: 1340 },
      { x: 3220, y: 1500 },
      { x: 3650, y: 1660 },
      { x: 4100, y: 1820 },
      { x: 4620, y: 1700 },
      { x: 5200, y: 1820 },
      { x: 5900, y: 2200 },
      { x: 6500, y: 2520 },
      { x: 2100, y: 4320 },
      { x: 2460, y: 4680 },
      { x: 1320, y: 4050 },
      { x: 1660, y: 4380 },
      { x: 2080, y: 4820 },
      { x: 7040, y: 2860 },
      { x: 7520, y: 3240 },
      { x: 7920, y: 3620 },
      { x: 8580, y: 4000 }
    ];

    for (let index = 0; index < Math.min(starterWolfPositions.length, STARTER_WOLF_COUNT); index += 1) {
      this.addMonster(this.createMonster(`wolf-${index}`, "wolf", starterWolfPositions[index], 1), 280);
    }

    const worldPacks: Array<{
      prefix: string;
      archetype: MonsterArchetype;
      origin: Vector2;
      count: number;
      level: number;
      radius: number;
      respawnRadius?: number;
      spritePackId?: MonsterSpritePackId;
    }> = [
      { prefix: "highspring-boar", archetype: "boar", origin: { x: 3000, y: 1280 }, count: 14, level: 1, radius: 650 },
      { prefix: "highspring-bat", archetype: "bat", origin: { x: 3900, y: 1080 }, count: 9, level: 2, radius: 520 },
      { prefix: "greenhill-boar", archetype: "boar", origin: { x: 2550, y: 4450 }, count: 14, level: 2, radius: 620 },
      { prefix: "greenhill-bat", archetype: "bat", origin: { x: 3400, y: 1800 }, count: 12, level: 2, radius: 540 },
      { prefix: "greenhill-spider", archetype: "spider", origin: { x: 6200, y: 2350 }, count: 12, level: 3, radius: 620 },
      { prefix: "oldmill-boar", archetype: "boar", origin: { x: 1200, y: 5350 }, count: 8, level: 2, radius: 460 },
      { prefix: "oldmill-wolf", archetype: "wolf", origin: { x: 2600, y: 6700 }, count: 9, level: 3, radius: 520 },
      { prefix: "brooktrail-boar", archetype: "boar", origin: { x: 2500, y: 4700 }, count: 8, level: 3, radius: 600 },
      { prefix: "oldmill-brook-bandit", archetype: "bandit", origin: { x: 3200, y: 6700 }, count: 7, level: 5, radius: 540 },
      { prefix: "oldmill-brook-archer", archetype: "archer", origin: { x: 3550, y: 6900 }, count: 6, level: 5, radius: 520 },
      { prefix: "millroad-bandit", archetype: "bandit", origin: { x: 2400, y: 7400 }, count: 8, level: 5, radius: 500 },
      { prefix: "wolfden-bandit", archetype: "bandit", origin: { x: 6200, y: 3600 }, count: 12, level: 4, radius: 700 },
      { prefix: "wolfden-skeleton", archetype: "skeleton", origin: { x: 7300, y: 3300 }, count: 10, level: 5, radius: 640 },
      { prefix: "bonefall-bone-warrior", archetype: "bonewarrior", origin: { x: 7800, y: 3600 }, count: 12, level: 7, radius: 720, spritePackId: 12 },
      { prefix: "wolfden-archer", archetype: "archer", origin: { x: 7000, y: 3750 }, count: 7, level: 6, radius: 620 },
      { prefix: "suntrail-boar", archetype: "boar", origin: { x: 7050, y: 5050 }, count: 8, level: 5, radius: 560 },
      { prefix: "suntrail-bandit", archetype: "bandit", origin: { x: 8350, y: 6150 }, count: 8, level: 7, radius: 620 },
      { prefix: "suntrail-archer", archetype: "archer", origin: { x: 8650, y: 5900 }, count: 7, level: 8, radius: 640 },
      { prefix: "sunspire-scorpion", archetype: "spider", origin: { x: 9600, y: 4550 }, count: 16, level: 6, radius: 1080 },
      { prefix: "sunspire-bandit", archetype: "bandit", origin: { x: 10100, y: 5400 }, count: 12, level: 7, radius: 940 },
      { prefix: "sunspire-archer", archetype: "archer", origin: { x: 9300, y: 5250 }, count: 8, level: 8, radius: 840 },
      { prefix: "riverbend-bandit", archetype: "bandit", origin: { x: 11350, y: 6500 }, count: 9, level: 9, radius: 680 },
      { prefix: "riverbend-archer", archetype: "archer", origin: { x: 11750, y: 6900 }, count: 7, level: 11, radius: 700 },
      { prefix: "riverbend-spider", archetype: "spider", origin: { x: 12150, y: 6100 }, count: 8, level: 10, radius: 760 },
      { prefix: "riverbend-copse-wolf", archetype: "wolf", origin: { x: 10400, y: 8350 }, count: 8, level: 11, radius: 680 },
      { prefix: "harbor-marsh-bat", archetype: "bat", origin: { x: 5050, y: 7850 }, count: 8, level: 12, radius: 620 },
      { prefix: "harborwatch-spider", archetype: "spider", origin: { x: 4250, y: 10350 }, count: 8, level: 13, radius: 480 },
      { prefix: "harborwatch-bat", archetype: "bat", origin: { x: 5600, y: 9100 }, count: 7, level: 14, radius: 460 },
      { prefix: "frosthold-skeleton", archetype: "skeleton", origin: { x: 7600, y: 1900 }, count: 14, level: 9, radius: 740 },
      { prefix: "deepgate-bat", archetype: "bat", origin: { x: 10300, y: 1450 }, count: 12, level: 10, radius: 720 },
      { prefix: "deepgate-wraith", archetype: "wraith", origin: { x: 11000, y: 950 }, count: 14, level: 11, radius: 780 },
      { prefix: "deepgate-eye", archetype: "eye", origin: { x: 11600, y: 1540 }, count: 10, level: 12, radius: 760 },
      { prefix: "rift-golem", archetype: "golem", origin: { x: 14500, y: 8200 }, count: 16, level: 13, radius: 1040 },
      { prefix: "rift-skeleton", archetype: "skeleton", origin: { x: 13700, y: 7900 }, count: 14, level: 14, radius: 960 },
      { prefix: "moonfen-spider", archetype: "spider", origin: { x: 7200, y: 9800 }, count: 18, level: 15, radius: 1050 },
      { prefix: "moonfen-venom-plant", archetype: "venomplant", origin: { x: 8400, y: 10600 }, count: 14, level: 18, radius: 900, spritePackId: 11 },
      { prefix: "moonfen-wraith", archetype: "wraith", origin: { x: 8400, y: 10800 }, count: 12, level: 17, radius: 860 },
      { prefix: "moonfen-witch", archetype: "witch", origin: { x: 8750, y: 9800 }, count: 10, level: 18, radius: 820 },
      { prefix: "moonfen-mage", archetype: "mage", origin: { x: 7950, y: 10350 }, count: 7, level: 19, radius: 760 },
      { prefix: "iron-golem", archetype: "golem", origin: { x: 15200, y: 3550 }, count: 18, level: 20, radius: 1020 },
      { prefix: "iron-skeleton", archetype: "skeleton", origin: { x: 14200, y: 4300 }, count: 16, level: 22, radius: 980 },
      { prefix: "iron-bone-warrior", archetype: "bonewarrior", origin: { x: 14850, y: 4500 }, count: 10, level: 23, radius: 820, spritePackId: 12 },
      { prefix: "iron-archer", archetype: "archer", origin: { x: 13650, y: 4050 }, count: 8, level: 22, radius: 860 },
      { prefix: "southreach-orchard-boar", archetype: "boar", origin: { x: 10150, y: 12950 }, count: 10, level: 23, radius: 820 },
      { prefix: "southreach-wolf", archetype: "wolf", origin: { x: 12200, y: 15100 }, count: 16, level: 27, radius: 1180 },
      { prefix: "southreach-bandit", archetype: "bandit", origin: { x: 13200, y: 14500 }, count: 12, level: 29, radius: 980 },
      { prefix: "southreach-archer", archetype: "archer", origin: { x: 12650, y: 14350 }, count: 8, level: 30, radius: 960 },
      { prefix: "ember-drake", archetype: "drake", origin: { x: 15400, y: 10300 }, count: 16, level: 26, radius: 1120 },
      { prefix: "ember-bat", archetype: "bat", origin: { x: 16500, y: 11200 }, count: 16, level: 28, radius: 980 },
      { prefix: "ember-fire-spirit", archetype: "firespirit", origin: { x: 16000, y: 10800 }, count: 12, level: 29, radius: 980, spritePackId: 13 },
      { prefix: "ember-dragon", archetype: "dragon", origin: { x: 17100, y: 10100 }, count: 7, level: 31, radius: 980 },
      { prefix: "blackroot-wraith", archetype: "wraith", origin: { x: 17600, y: 12800 }, count: 18, level: 34, radius: 1220 },
      { prefix: "blackroot-venom-plant", archetype: "venomplant", origin: { x: 16800, y: 12300 }, count: 12, level: 35, radius: 980, spritePackId: 11 },
      { prefix: "blackroot-witch", archetype: "witch", origin: { x: 18400, y: 13800 }, count: 12, level: 38, radius: 980 },
      { prefix: "blackroot-mage", archetype: "mage", origin: { x: 17150, y: 13650 }, count: 8, level: 39, radius: 900 },
      { prefix: "mistford-road-wraith", archetype: "wraith", origin: { x: 17800, y: 7900 }, count: 9, level: 29, radius: 780 },
      { prefix: "mistwood-wolf", archetype: "wolf", origin: { x: 20500, y: 6200 }, count: 18, level: 30, radius: 1150 },
      { prefix: "mistwood-wraith", archetype: "wraith", origin: { x: 22000, y: 7200 }, count: 14, level: 33, radius: 980 },
      { prefix: "mistwood-bat", archetype: "bat", origin: { x: 21100, y: 7600 }, count: 18, level: 34, radius: 980 },
      { prefix: "crownspire-bandit", archetype: "bandit", origin: { x: 23800, y: 9300 }, count: 18, level: 42, radius: 1320 },
      { prefix: "crownspire-archer", archetype: "archer", origin: { x: 23200, y: 9800 }, count: 10, level: 43, radius: 1040 },
      { prefix: "crownspire-sentinel", archetype: "sentinel", origin: { x: 24700, y: 8600 }, count: 12, level: 44, radius: 1040 },
      { prefix: "crownroad-bandit", archetype: "bandit", origin: { x: 19900, y: 11100 }, count: 9, level: 39, radius: 780 },
      { prefix: "crownroad-archer", archetype: "archer", origin: { x: 20500, y: 10650 }, count: 7, level: 41, radius: 720 },
      { prefix: "crownmirror-eye", archetype: "eye", origin: { x: 22300, y: 9800 }, count: 14, level: 45, radius: 1160 },
      { prefix: "crownmirror-mage", archetype: "mage", origin: { x: 22800, y: 10350 }, count: 8, level: 46, radius: 880 },
      { prefix: "sapphire-river-bat", archetype: "bat", origin: { x: 22800, y: 11680 }, count: 9, level: 36, radius: 780 },
      { prefix: "sapphire-drake", archetype: "drake", origin: { x: 23800, y: 13200 }, count: 16, level: 37, radius: 1160 },
      { prefix: "north-sentinel", archetype: "sentinel", origin: { x: 26800, y: 2800 }, count: 16, level: 43, radius: 1120 },
      { prefix: "north-skeleton", archetype: "skeleton", origin: { x: 28100, y: 3700 }, count: 14, level: 46, radius: 980 },
      { prefix: "north-archer", archetype: "archer", origin: { x: 27400, y: 4200 }, count: 8, level: 47, radius: 860 },
      { prefix: "sky-sentinel", archetype: "sentinel", origin: { x: 33000, y: 5200 }, count: 18, level: 52, radius: 1260 },
      { prefix: "mirrorfen-spider", archetype: "spider", origin: { x: 22200, y: 19900 }, count: 18, level: 56, radius: 1280 },
      { prefix: "mirrorfen-witch", archetype: "witch", origin: { x: 23200, y: 20500 }, count: 12, level: 59, radius: 1040 },
      { prefix: "mirrorfen-mage", archetype: "mage", origin: { x: 21800, y: 20750 }, count: 8, level: 60, radius: 980 },
      { prefix: "mirrorway-wraith", archetype: "wraith", origin: { x: 19050, y: 16450 }, count: 8, level: 50, radius: 780 },
      { prefix: "ravenwood-wraith", archetype: "wraith", origin: { x: 31800, y: 9600 }, count: 18, level: 66, radius: 1260 },
      { prefix: "ravenwood-eye", archetype: "eye", origin: { x: 32800, y: 10100 }, count: 12, level: 68, radius: 980 },
      { prefix: "ravenwood-mage", archetype: "mage", origin: { x: 31200, y: 10300 }, count: 8, level: 68, radius: 980 },
      { prefix: "forge-drake", archetype: "drake", origin: { x: 36500, y: 18600 }, count: 18, level: 60, radius: 1320 },
      { prefix: "forge-fire-spirit", archetype: "firespirit", origin: { x: 35200, y: 16800 }, count: 12, level: 62, radius: 1100, spritePackId: 13 },
      { prefix: "forge-skeleton", archetype: "skeleton", origin: { x: 35200, y: 17600 }, count: 18, level: 59, radius: 1120 },
      { prefix: "forge-dragon", archetype: "dragon", origin: { x: 37400, y: 19400 }, count: 9, level: 63, radius: 1220 },
      { prefix: "starfall-wraith", archetype: "wraith", origin: { x: 28500, y: 25800 }, count: 18, level: 68, radius: 1280 },
      { prefix: "starfall-bat", archetype: "bat", origin: { x: 29600, y: 24600 }, count: 18, level: 69, radius: 1180 },
      { prefix: "starfall-eye", archetype: "eye", origin: { x: 30300, y: 26000 }, count: 12, level: 70, radius: 1180 },
      { prefix: "starfall-witch", archetype: "witch", origin: { x: 27600, y: 25000 }, count: 10, level: 71, radius: 1080 },
      { prefix: "starfall-mage", archetype: "mage", origin: { x: 28900, y: 25300 }, count: 8, level: 72, radius: 1100 },
      { prefix: "obsidian-sentinel", archetype: "sentinel", origin: { x: 41000, y: 27000 }, count: 20, level: 74, radius: 1400 },
      { prefix: "spine-golem", archetype: "golem", origin: { x: 44000, y: 7600 }, count: 18, level: 82, radius: 1360 }
    ];

    for (const pack of worldPacks) {
      this.addMonsterPack(
        pack.prefix,
        pack.archetype,
        pack.origin,
        pack.count,
        pack.level,
        pack.radius,
        pack.respawnRadius ?? pack.radius * 0.62,
        pack.spritePackId
      );
    }

    const roadPacks = [
      { prefix: "road-greenhill-1", archetype: "boar" as const, origin: { x: 4520, y: 3520 }, count: 8, level: 3, radius: 440 },
      { prefix: "road-greenhill-bat", archetype: "bat" as const, origin: { x: 4300, y: 1560 }, count: 7, level: 4, radius: 460 },
      { prefix: "road-greenhill-2", archetype: "bandit" as const, origin: { x: 6880, y: 3400 }, count: 9, level: 5, radius: 500 },
      { prefix: "road-greenhill-archer", archetype: "archer" as const, origin: { x: 6350, y: 3850 }, count: 6, level: 6, radius: 480 },
      { prefix: "road-frost-1", archetype: "golem" as const, origin: { x: 7600, y: 1950 }, count: 8, level: 9, radius: 600 },
      { prefix: "road-frost-skeleton", archetype: "skeleton" as const, origin: { x: 8400, y: 1400 }, count: 8, level: 10, radius: 620 },
      { prefix: "road-harbor-1", archetype: "spider" as const, origin: { x: 5200, y: 6100 }, count: 8, level: 10, radius: 620 },
      { prefix: "road-rift-1", archetype: "wraith" as const, origin: { x: 9400, y: 5600 }, count: 10, level: 14, radius: 660 },
      { prefix: "road-rift-mage", archetype: "mage" as const, origin: { x: 10100, y: 6100 }, count: 6, level: 18, radius: 640 },
      { prefix: "road-iron-1", archetype: "bandit" as const, origin: { x: 12400, y: 2920 }, count: 10, level: 18, radius: 700 },
      { prefix: "road-iron-archer", archetype: "archer" as const, origin: { x: 13200, y: 3500 }, count: 7, level: 21, radius: 700 },
      { prefix: "road-mist-1", archetype: "golem" as const, origin: { x: 17800, y: 4900 }, count: 11, level: 25, radius: 760 },
      { prefix: "road-southreach-1", archetype: "bandit" as const, origin: { x: 14400, y: 13200 }, count: 12, level: 30, radius: 840 },
      { prefix: "road-southreach-archer", archetype: "archer" as const, origin: { x: 13900, y: 14050 }, count: 7, level: 31, radius: 760 },
      { prefix: "road-blackroot-1", archetype: "wraith" as const, origin: { x: 17600, y: 12800 }, count: 12, level: 36, radius: 900 },
      { prefix: "road-blackroot-mage", archetype: "mage" as const, origin: { x: 18450, y: 12400 }, count: 6, level: 39, radius: 760 },
      { prefix: "road-crown-1", archetype: "sentinel" as const, origin: { x: 23200, y: 8800 }, count: 12, level: 43, radius: 900 },
      { prefix: "road-coast-1", archetype: "drake" as const, origin: { x: 22200, y: 9800 }, count: 9, level: 35, radius: 760 },
      { prefix: "road-north-1", archetype: "sentinel" as const, origin: { x: 30100, y: 3900 }, count: 10, level: 48, radius: 820 },
      { prefix: "road-forge-1", archetype: "drake" as const, origin: { x: 33000, y: 14200 }, count: 12, level: 57, radius: 900 },
      { prefix: "road-star-1", archetype: "wraith" as const, origin: { x: 28600, y: 21000 }, count: 11, level: 64, radius: 900 },
      { prefix: "road-obsidian-1", archetype: "sentinel" as const, origin: { x: 37600, y: 22900 }, count: 12, level: 72, radius: 980 },
      { prefix: "encounter-suntrail-ambush", archetype: "bandit" as const, origin: { x: 5600, y: 4450 }, count: 7, level: 6, radius: 420 },
      { prefix: "encounter-suntrail-archers", archetype: "archer" as const, origin: { x: 5900, y: 4750 }, count: 5, level: 7, radius: 420 },
      { prefix: "encounter-harbor-reef", archetype: "spider" as const, origin: { x: 4300, y: 8500 }, count: 7, level: 14, radius: 430 },
      { prefix: "encounter-moonfen-fog", archetype: "witch" as const, origin: { x: 6200, y: 11200 }, count: 6, level: 18, radius: 440 },
      { prefix: "encounter-moonfen-mage", archetype: "mage" as const, origin: { x: 6650, y: 10900 }, count: 5, level: 19, radius: 420 },
      { prefix: "encounter-iron-switchback", archetype: "golem" as const, origin: { x: 16600, y: 4700 }, count: 7, level: 24, radius: 520 },
      { prefix: "encounter-rift-sparks", archetype: "eye" as const, origin: { x: 12900, y: 7600 }, count: 8, level: 26, radius: 540 },
      { prefix: "encounter-southreach-raid", archetype: "bandit" as const, origin: { x: 11300, y: 13900 }, count: 8, level: 30, radius: 560 },
      { prefix: "encounter-mistroad-shadow", archetype: "wraith" as const, origin: { x: 19100, y: 6500 }, count: 8, level: 38, radius: 560 },
      { prefix: "encounter-crown-patrol", archetype: "sentinel" as const, origin: { x: 21600, y: 7800 }, count: 8, level: 44, radius: 620 },
      { prefix: "encounter-crown-archer", archetype: "archer" as const, origin: { x: 21100, y: 8250 }, count: 6, level: 44, radius: 560 },
      { prefix: "encounter-sapphire-cliff", archetype: "drake" as const, origin: { x: 25200, y: 12100 }, count: 8, level: 50, radius: 620 },
      { prefix: "encounter-northguard-snow", archetype: "skeleton" as const, origin: { x: 24000, y: 2200 }, count: 8, level: 48, radius: 620 },
      { prefix: "encounter-ashroad-cinders", archetype: "drake" as const, origin: { x: 35000, y: 21000 }, count: 9, level: 66, radius: 700 },
      { prefix: "encounter-starfall-orbs", archetype: "eye" as const, origin: { x: 33000, y: 25800 }, count: 8, level: 72, radius: 680 },
      { prefix: "encounter-starfall-mage", archetype: "mage" as const, origin: { x: 32200, y: 25000 }, count: 6, level: 73, radius: 660 }
    ];

    for (const pack of roadPacks) {
      this.addMonsterPack(pack.prefix, pack.archetype, pack.origin, pack.count, pack.level, pack.radius, pack.radius * 0.7);
    }

    for (const dungeon of WORLD_DUNGEON_INTERIORS) {
      if (dungeon.id === BESTIARY_CAVERN_DUNGEON_ID) {
        for (const spawn of BESTIARY_CAVERN_ROSTER) {
          this.addMonster(
            this.createMonster(
              `${dungeon.id}-pack-${spawn.packId}`,
              spawn.archetype,
              { x: dungeon.position.x + spawn.offset.x, y: dungeon.position.y + spawn.offset.y },
              spawn.level,
              spawn.packId
            ),
            spawn.packId === 10 ? 90 : 130
          );
        }
        continue;
      }
      dungeon.archetypes.forEach((archetype, index) => {
        const lane = index - (dungeon.archetypes.length - 1) / 2;
        this.addMonsterPack(
          `${dungeon.id}-${archetype}`,
          archetype,
          {
            x: dungeon.position.x + lane * 360,
            y: dungeon.position.y + (index % 2 === 0 ? -170 : 210)
          },
          index === 0 ? 5 : 4,
          dungeon.recommendedLevel + index * 2,
          390,
          320
        );
      });
      this.addMonster(this.createMonster(`${dungeon.id}-warden`, "dungeonboss", dungeon.end, dungeon.recommendedLevel + 6), 320);
    }

    this.addMonster(this.createMonster("miniboss-bone-captain", "miniboss", { x: 7200, y: 2280 }, 10), 260);
    this.addMonster(this.createMonster("miniboss-wayfarer-brute", "miniboss", { x: 8350, y: 6150 }, 12), 320);
    this.addMonster(this.createMonster("miniboss-riverbend-stalker", "miniboss", { x: 10400, y: 8350 }, 18), 320);
    this.addMonster(this.createMonster("miniboss-eye-oracle", "miniboss", { x: 5850, y: 2920 }, 14), 320);
    this.addMonster(this.createMonster("miniboss-cave-brood", "miniboss", { x: 10800, y: 1580 }, 18), 280);
    this.addMonster(this.createMonster("miniboss-moonfen-boneguard", "miniboss", { x: 7900, y: 10350 }, 25), 320);
    this.addMonster(this.createMonster("miniboss-mistwing-matriarch", "miniboss", { x: 21400, y: 7000 }, 36), 340);
    this.addMonster(this.createMonster("miniboss-crownroad-captain", "miniboss", { x: 19900, y: 11100 }, 48), 360);
    this.addMonster(this.createMonster("miniboss-forge-reaver", "miniboss", { x: 35000, y: 17200 }, 58), 380);
    this.addMonster(this.createMonster("miniboss-starfall-bone-lord", "miniboss", { x: 30000, y: 25200 }, 70), 420);
    this.addMonster(this.createMonster("boss-ancient-core", "boss", { x: 14850, y: 8500 }, 16), 360);
    this.addMonster(this.createMonster("boss-ember-wyrm", "boss", { x: 37150, y: 19150 }, 45), 480);
    this.addMonster(this.createMonster("boss-obsidian-warden", "boss", { x: 41850, y: 27850 }, 80), 520);

    for (let index = 0; index < CHEST_COUNT; index += 1) {
      const id = `chest-${index}`;
      this.resources.set(id, {
        id,
        kind: "chest",
        position: this.randomChestPosition(id),
        remaining: 1
      });
    }
  }

  private updateBotPopulation(now: number, force = false): void {
    if (!force && now - this.lastBotPopulationUpdateAt < BOT_POPULATION_RECHECK_MS) {
      return;
    }

    this.lastBotPopulationUpdateAt = now;
    const target = this.desiredBotPopulation(now);
    let active = this.activeBotCount();
    let changed = 0;
    const maxChanges = force ? this.botCount : 2;

    while (active < target && changed < maxChanges) {
      const offline = [...this.botBrains.entries()].find(
        ([botId, brain]) => brain.storedBot && !this.players.has(botId) && (!brain.offlineUntil || now >= brain.offlineUntil)
      );
      if (offline) {
        this.reactivateBot(offline[0], offline[1], now);
        active += 1;
        changed += 1;
        continue;
      }

      if (this.botBrains.size >= this.botCount) {
        break;
      }

      this.addBot(this.botBrains.size);
      active += 1;
      changed += 1;
    }

    if (active > target) {
      const candidates = [...this.players.values()]
	        .filter((player) => this.botBrains.has(player.id))
	        .map((bot) => ({ bot, brain: this.botBrains.get(bot.id)! }))
	        .filter(({ bot, brain }) => bot.hp > 0 && !bot.downed && !this.isMarketVendorBotIndex(brain.index))
        .sort((a, b) => {
          const aBusy = a.brain.targetId ? 1 : 0;
          const bBusy = b.brain.targetId ? 1 : 0;
          const aSafe = a.bot.zone === "safe" ? 0 : 1;
          const bSafe = b.bot.zone === "safe" ? 0 : 1;
          return aBusy - bBusy || aSafe - bSafe || Math.random() - 0.5;
        });
      for (const candidate of candidates.slice(0, Math.min(active - target, maxChanges))) {
        this.suspendBot(candidate.bot, candidate.brain, now);
      }
    }
  }

  private activeBotCount(): number {
    let count = 0;
    for (const botId of this.botBrains.keys()) {
      if (this.players.has(botId)) {
        count += 1;
      }
    }
    return count;
  }

  private desiredBotPopulation(now: number): number {
    if (this.botCount <= 0) {
      return 0;
    }
    if (this.botTargetOnline !== null) {
      const baseTarget = Math.min(this.botCount, this.botTargetOnline);
      if (baseTarget <= 0) {
        return 0;
      }
      const slowBucket = Math.floor(now / (6 * 60_000));
      const fastBucket = Math.floor(now / (75_000));
      const wave = Math.sin(slowBucket * 1.19 + this.botPopulationSeed) * 0.1 + Math.sin(fastBucket * 0.73 + this.botPopulationSeed * 0.6) * 0.045;
      const drift = Math.round(baseTarget * wave);
      const swing = Math.max(3, Math.min(14, Math.round(baseTarget * 0.16)));
      const floor = Math.max(1, Math.min(this.botCount, baseTarget - swing));
      const ceiling = Math.max(floor, Math.min(this.botCount, baseTarget + swing));
      return Math.max(floor, Math.min(ceiling, baseTarget + drift));
    }

    const moscowHour = (new Date(now).getUTCHours() + 3) % 24;
    const baseRatio =
      moscowHour >= 18 && moscowHour <= 23
        ? 0.86
        : moscowHour >= 12 && moscowHour < 18
          ? 0.7
          : moscowHour >= 7 && moscowHour < 12
            ? 0.48
            : 0.28;
    const slowBucket = Math.floor(now / (8 * 60_000));
    const fastBucket = Math.floor(now / (2 * 60_000));
    const wave = Math.sin(slowBucket * 1.37 + this.botPopulationSeed) * 0.16 + Math.sin(fastBucket * 0.91 + this.botPopulationSeed * 0.7) * 0.07;
    const spike = Math.sin(slowBucket * 0.43 + this.botPopulationSeed * 1.7) > 0.72 ? 0.12 : 0;
    const ratio = Math.min(1, Math.max(0.12, baseRatio + wave + spike));
    const minimum = Math.min(this.botCount, moscowHour >= 18 && moscowHour <= 23 ? 12 : moscowHour >= 12 && moscowHour < 18 ? 8 : moscowHour >= 7 && moscowHour < 12 ? 5 : 3);
    return Math.max(minimum, Math.min(this.botCount, Math.round(this.botCount * ratio)));
  }

  private seedBots(): void {
    this.updateBotPopulation(Date.now(), true);
  }

	  private addBot(index: number, generation = 0): string {
    const classId = this.botClassId(index, generation);
    const race = this.botRace(index, generation);
    const level = this.botInitialLevel(index, generation);
    const equipment = this.botEquipment(classId, level, index, generation);
	    const inventory = this.botInventory(classId, level);
	    const stats = this.deriveStats(classId, level, equipment);
	    const groundIndex = this.botInitialGroundIndex(level, index, generation);
    const marketVendor = this.isMarketVendorBotIndex(index);
	    const spawn = marketVendor ? this.marketVendorPosition(index, generation) : this.botSpawnPoint(index, generation, level, groundIndex);
	    const name = this.botName(index, generation);
	    const id = `bot_${index}_${generation}_${Math.random().toString(36).slice(2, 7)}`;
	    const levelCap = this.currentBotLevelCap();
	    const initialXp = level <= 1 || level >= levelCap ? 0 : Math.floor(this.nextLevelXp(level) * ((index % 7) / 10));
    const now = Date.now();

    const bot: PlayerPrivateState = {
      id,
      characterId: `bot_char_${index}_${generation}`,
      name: this.sanitizeName(name),
      classId,
      race,
      face: ((index * 17) % CHARACTER_FACE_VARIANT_COUNT) + 1,
      position: spawn,
      velocity: { x: 0, y: 0 },
      facing: { x: 1, y: 0 },
      hp: stats.hp,
      maxHp: stats.hp,
      cp: stats.cp,
      maxCp: stats.cp,
      mp: stats.mp,
      maxMp: stats.mp,
      level,
      xp: initialXp,
      gold: 35 + level * 18 + (index % 9) * 7,
      karma: 0,
      pkCount: 0,
      pvpCount: 0,
      monsterKills: {},
      arenaRating: 940 + ((index * 37 + generation * 53) % 180),
      arenaWins: Math.floor((index + generation) % 5),
      arenaLosses: Math.floor((index * 2 + generation) % 4),
      arenaStreak: 0,
      arenaSeasonPoints: Math.max(0, Math.floor(level / 4) + ((index + generation) % 7)),
      storyQuestRewards: [],
      jumpUntil: 0,
      lastJumpInput: false,
      pvpFlagUntil: undefined,
      blocking: false,
      stunnedUntil: 0,
      zone: this.zoneFor(spawn),
      comboStage: 0,
      lastProcessedSeq: 0,
      input: this.emptyInput(),
      inventory,
      equipment,
      stats,
      wallet: {
        mode: "telegram-ton",
        connected: false,
        pendingToken: 0
      },
      lastAttackAt: 0,
      skillCooldowns: new Map(),
      lastConsumableAt: 0,
      lastSafePosition: this.nearestCityPosition(spawn),
      downed: false,
	      tokenDebt: 0
	    };

    if (marketVendor) {
      bot.sitting = true;
      bot.marketVendor = this.createBotMarketVendor(bot, index, now);
      bot.zone = "safe";
      bot.lastSafePosition = { ...this.marketCityDefinition().position };
    }

	    this.players.set(id, bot);
	    const startsChilling = marketVendor || (generation === 0 ? Math.random() < 0.58 || index % 5 === 0 : Math.random() < 0.34);
	    this.botBrains.set(id, {
	      index,
	      nextThinkAt: now + this.randomBetween(0, 3800),
	      nextPkAt: marketVendor ? now + this.randomBetween(90 * 60_000, 220 * 60_000) : now + this.randomBetween(10_000, 65_000),
	      chillUntil: marketVendor ? now + this.randomBetween(70 * 60_000, 180 * 60_000) : startsChilling ? now + this.randomBetween(BOT_START_CHILL_MIN_MS, BOT_START_CHILL_MAX_MS) : undefined,
	      nextChillAt: now + this.randomBetween(11_000, 48_000),
	      nextChatAt: now + this.randomBetween(55_000, 210_000),
	      nextSkillAt: now + this.randomBetween(1_500, 8_000),
	      nextReviveAt: now + this.randomBetween(8_000, 42_000),
	      nextSessionAt: marketVendor ? now + this.randomBetween(90 * 60_000, 240 * 60_000) : now + this.randomBetween(BOT_SESSION_MIN_MS, BOT_SESSION_MAX_MS),
	      nextDashAt: now + this.randomBetween(9_000, 28_000),
	      strafeDirection: Math.random() < 0.5 ? -1 : 1,
	      strafeUntil: now + this.randomBetween(2_200, 7_500),
	      nextTownActionAt: now + this.randomBetween(2_000, 14_000),
	      nextWorldMoveAt: marketVendor ? now + this.randomBetween(90 * 60_000, 240 * 60_000) : now + this.randomBetween(28_000, 110_000),
        marketVendorUntil: marketVendor ? now + this.randomBetween(70 * 60_000, 180 * 60_000) : undefined,
        nextMarketRestockAt: marketVendor ? now + this.randomBetween(7 * 60_000, 19 * 60_000) : undefined,
	      nextArenaAt: now + this.initialBotArenaDelay(index),
	      nextShopAt: now + this.randomBetween(12_000, 90_000),
	      generation,
	      aggression: marketVendor ? 0 : index % 11 === 0 ? 0.96 : index % 7 === 0 ? 0.82 : index % 5 === 0 ? 0.58 : 0.22 + Math.random() * 0.34,
	      groundIndex,
	      roamSeed: Math.random() * Math.PI * 2
    });
	    return id;
	  }

  private isMarketVendorBotIndex(index: number): boolean {
    return index >= 0 && index < MARKET_VENDOR_BOT_COUNT;
  }

  private marketVendorPosition(index: number, generation = 0): Vector2 {
    const market = this.marketCityDefinition();
    const angle = (index / Math.max(1, MARKET_VENDOR_BOT_COUNT)) * Math.PI * 2 + generation * 0.23;
    const ring = index % 2 === 0 ? MARKET_VENDOR_RADIUS * 0.38 : MARKET_VENDOR_RADIUS * 0.62;
    return this.pushOutOfWorldObstacles(this.clampPosition({
      x: market.position.x + Math.cos(angle) * ring + Math.cos(angle * 3.1) * 42,
      y: market.position.y + Math.sin(angle) * ring + Math.sin(angle * 2.3) * 42
    }));
  }

  private createBotMarketVendor(bot: PlayerPrivateState, index: number, now: number): MarketVendorState {
    const titles = ["Discount gear", "Travel kit", "Rare finds", "Armor bench", "Weapon mat", "Potion crate", "Class picks", "Old stock", "Scroll box", "Camp sale"];
    const pool = SHOP_CATALOG.filter(
      (offer) =>
        offer.priceGold > 0 &&
        !offer.priceItemId &&
        !offer.grantGold &&
        (offer.item.requiredLevel ?? 1) <= Math.max(12, bot.level + 24)
    );
    const offers = pool.length > 0 ? pool : SHOP_CATALOG.filter((offer) => offer.priceGold > 0 && !offer.priceItemId && !offer.grantGold);
    const count = Math.min(8, Math.max(4, 4 + (index % 4) + Math.floor(Math.random() * 2)));
    const start = Math.floor(Math.random() * Math.max(1, offers.length));
    const items: MarketListingItem[] = [];
    for (let offset = 0; offset < count && offers.length > 0; offset += 1) {
      const offer = offers[(start + offset * (2 + (index % 3))) % offers.length];
      if (!offer) {
        continue;
      }
      const quantity = offer.item.stackable ? 1 + Math.floor(Math.random() * (offer.item.consumable ? 4 : 2)) : 1;
      const item = this.cloneInventoryItem(offer.item, quantity);
      if (item.enchantable && item.slot) {
        const enchantChance = item.slot === "weapon" ? 0.74 : 0.56;
        if (Math.random() < enchantChance) {
          const gradeCap = item.grade === "common" ? 3 : item.grade === "rare" ? 5 : item.grade === "epic" ? 7 : item.grade === "legendary" ? 9 : 11;
          const slotCap = item.slot === "weapon" ? Math.min(MAX_WEAPON_ENCHANT_LEVEL, gradeCap + Math.floor(bot.level / 12)) : Math.min(MAX_ARMOR_ENCHANT_LEVEL, gradeCap);
          item.enchantLevel = 1 + Math.floor(Math.random() * Math.max(1, slotCap));
        }
      }
      const discount = 0.52 + Math.random() * 0.31;
      const enchantPremium = item.enchantLevel ? 1 + item.enchantLevel * (item.slot === "weapon" ? 0.11 : 0.075) : 1;
      const price = Math.max(1, Math.round(offer.priceGold * quantity * discount * enchantPremium));
      items.push({
        listingId: this.createId("bot_listing"),
        sellerId: bot.id,
        sellerName: bot.name,
        item,
        quantity,
        priceGold: price,
        source: "bot"
      });
    }

    return {
      title: titles[index % titles.length] ?? "Market stall",
      items,
      sinceAt: now,
      expiresAt: now + this.randomBetween(40 * 60_000, 140 * 60_000)
    };
  }

	  private botName(index: number, generation: number): string {
    const existingName = BOT_NAMES[index];
    if (existingName) {
      return existingName;
    }

    const newcomerIndex = Math.max(0, index - BOT_NAMES.length + generation * 3);
    const prefix = BOT_NEWCOMER_PREFIXES[newcomerIndex % BOT_NEWCOMER_PREFIXES.length] ?? "Nova";
    const suffix = BOT_NEWCOMER_SUFFIXES[Math.floor(newcomerIndex / BOT_NEWCOMER_PREFIXES.length) % BOT_NEWCOMER_SUFFIXES.length] ?? "Blade";
    return `${prefix}${suffix}${String(index + 1).padStart(2, "0")}`;
  }

  private botClassId(index: number, generation: number): CharacterClass {
    const name = this.botName(index, generation).toLowerCase();
    if (name.includes("mage") || name.includes("hex") || name.includes("wind") || name.includes("soul")) {
      return "mage";
    }
    if (name.includes("bow") || name.includes("shot")) {
      return "archer";
    }
    if (name.includes("tank") || name.includes("guard") || name.includes("templar")) {
      return "warrior";
    }
    if (name.includes("pk") || name.includes("crit") || name.includes("blade") || name.includes("rift") || name.includes("fox") || name.includes("ray")) {
      return "assassin";
    }
    const sequenceIndex = index < BOT_NAMES.length ? index : index + generation * 2;
    return BOT_CLASS_SEQUENCE[sequenceIndex % BOT_CLASS_SEQUENCE.length] ?? "warrior";
  }

  private botRace(index: number, generation: number): CharacterRace {
    const name = this.botName(index, generation).toLowerCase();
    if (name.includes("elf")) {
      return "elf";
    }
    if (name.includes("orc")) {
      return "orc";
    }
    if (name.includes("dark") || name.includes("noct") || name.includes("ghost")) {
      return "darkelf";
    }
    const sequenceIndex = index < BOT_NAMES.length ? index * 3 : index * 3 + generation;
    return BOT_RACE_SEQUENCE[sequenceIndex % BOT_RACE_SEQUENCE.length] ?? "human";
  }

  private initialBotArenaDelay(index: number): number {
    if (index < BOT_NAMES.length) {
      return index % 2 === 0 ? this.randomBetween(5_000, 45_000) : this.randomBetween(24_000, 150_000);
    }
    return index % 5 === 0 ? this.randomBetween(45_000, 4 * 60_000) : this.randomBetween(3 * 60_000, 9 * 60_000);
  }

  private currentBotLevelCap(): number {
    const hardCap = Number.isFinite(BOT_HARD_LEVEL_CAP) ? BOT_HARD_LEVEL_CAP : 96;
    let realPlayerMaxLevel = [...this.persistedCharacters.values()].reduce((maxLevel, character) => Math.max(maxLevel, character.level ?? 1), 1);
    for (const player of this.players.values()) {
      if (this.botBrains.has(player.id) || this.singerNpcIds.has(player.id)) {
        continue;
      }
      realPlayerMaxLevel = Math.max(realPlayerMaxLevel, player.level);
    }
    return Math.max(1, Math.min(hardCap, realPlayerMaxLevel));
  }

  private enforceBotLevelCap(bot: PlayerPrivateState, brain: BotBrain, now = Date.now()): void {
    const levelCap = this.currentBotLevelCap();
    if (bot.level <= levelCap) {
      return;
    }

    const hpRatio = bot.maxHp > 0 ? bot.hp / bot.maxHp : 1;
    const cpRatio = bot.maxCp > 0 ? bot.cp / bot.maxCp : 1;
    const mpRatio = bot.maxMp > 0 ? bot.mp / bot.maxMp : 1;
    bot.level = levelCap;
    bot.xp = 0;
    bot.equipment = this.botEquipment(bot.classId, bot.level, brain.index, brain.generation);
    bot.inventory = this.botInventory(bot.classId, bot.level);
    this.recalculateStats(bot);
    bot.hp = bot.hp <= 0 ? 0 : Math.max(1, Math.min(bot.maxHp, Math.round(bot.maxHp * hpRatio)));
    bot.cp = Math.max(0, Math.min(bot.maxCp, Math.round(bot.maxCp * cpRatio)));
    bot.mp = Math.max(0, Math.min(bot.maxMp, Math.round(bot.maxMp * mpRatio)));
    brain.groundIndex = this.botInitialGroundIndex(bot.level, brain.index, brain.generation);
    brain.roamTarget = undefined;
    brain.nextArenaAt = now + this.randomBetween(8 * 60_000, 20 * 60_000);
  }

  private botInitialLevel(index: number, generation = 0): number {
    if (index >= BOT_NAMES.length) {
      const chainIndex = (index - BOT_NAMES.length + generation) % BOT_NEWCOMER_LEVEL_CHAIN.length;
      return Math.min(this.currentBotLevelCap(), BOT_NEWCOMER_LEVEL_CHAIN[chainIndex] ?? 1);
    }

    if (generation > 0 && (index + generation) % 5 < 2) {
      return Math.min(this.currentBotLevelCap(), 1 + ((index * 3 + generation) % 7));
    }

    const levelCap = this.currentBotLevelCap();
    const eligibleLadder = BOT_LEVEL_LADDER.filter((level) => level <= levelCap);
    const ladderIndex = (index + generation * 3) % Math.max(1, eligibleLadder.length);
    const baseLevel = eligibleLadder[ladderIndex] ?? 1;
    const jitter = generation > 0 ? ((index + generation) % 3) - 1 : 0;
    return Math.max(1, Math.min(levelCap, baseLevel + jitter));
  }

  private botInitialGroundIndex(level: number, index: number, generation: number): number {
    const eligible = BOT_HUNTING_GROUNDS
      .map((ground, groundIndex) => ({ ground, groundIndex }))
      .filter(({ ground }) => ground.level <= level + 3 && ground.level >= Math.max(1, level - 5));
    if (eligible.length === 0) {
      return 0;
    }

    const dungeonEligible = eligible.filter(({ ground }) => Boolean(ground.dungeonId));
    if (dungeonEligible.length > 0 && (index + generation * 3) % 5 === 0) {
      return dungeonEligible[(index * 3 + generation * 2) % dungeonEligible.length]?.groundIndex ?? dungeonEligible[0]?.groundIndex ?? 0;
    }

    return eligible[(index * 7 + generation * 5) % eligible.length]?.groundIndex ?? eligible[0]?.groundIndex ?? 0;
  }

  private botSpawnPoint(index: number, generation: number, level: number, groundIndex: number): Vector2 {
    const ground = BOT_HUNTING_GROUNDS[groundIndex];
    if (ground && Math.random() < (generation > 0 || index >= 6 ? 0.78 : 0.42)) {
      return this.randomGroundSpawnPoint(ground);
    }

    const eligibleCities = CITY_DEFINITIONS.filter((city) => city.recommendedLevel <= level + 8);
    const city = eligibleCities[(index * 3 + generation * 5 + Math.floor(Math.random() * Math.max(1, eligibleCities.length))) % Math.max(1, eligibleCities.length)] ?? CITY_DEFINITIONS[0];
    const angle = index * 2.3999632297 + generation * 0.91 + Math.random() * Math.PI * 2;
    const radius = 90 + Math.sqrt(Math.random()) * Math.max(120, city.safeRadius * 0.82);
    return this.clampPosition({
      x: city.position.x + Math.cos(angle) * radius + (Math.random() - 0.5) * 120,
      y: city.position.y + Math.sin(angle) * radius + (Math.random() - 0.5) * 120
    });
  }

  private suspendBot(bot: PlayerPrivateState, brain: BotBrain, now: number): void {
    this.clearSocialState(bot.id);
    bot.input = this.emptyInput();
    bot.velocity = { x: 0, y: 0 };
    bot.blocking = false;
    brain.targetId = undefined;
    brain.forcePkTargetId = undefined;
    brain.roamTarget = undefined;
    brain.arenaMode = undefined;
    brain.arenaAnchorAngle = undefined;
    brain.nextArenaShiftAt = undefined;
    brain.chillUntil = undefined;
    brain.dashUntil = undefined;
    brain.targetLockedUntil = undefined;
    brain.lastMoveDirection = undefined;
    brain.storedBot = bot;
    brain.offlineUntil = now + this.randomBetween(BOT_OFFLINE_MIN_MS, BOT_OFFLINE_MAX_MS);
    this.players.delete(bot.id);
    this.event(bot.id, bot.id, 0, "death", `${bot.name} logged out.`);
  }

  private reactivateBot(botId: string, brain: BotBrain, now: number): void {
    if (!brain.storedBot) {
      this.botBrains.delete(botId);
      const nextGeneration = brain.index >= BOT_NAMES.length ? brain.generation + 1 : brain.generation;
      const newBotId = this.addBot(brain.index, nextGeneration);
      const bot = this.players.get(newBotId);
      const newBrain = this.botBrains.get(newBotId);
      if (bot && newBrain) {
        this.botChat(bot, newBrain, this.randomBotLine(newBrain, BOT_RETURN_CHAT_LINES), "local", true);
      }
      return;
    }

    const bot = brain.storedBot;
    if (!bot) {
      return;
    }
    brain.groundIndex = this.botInitialGroundIndex(bot.level, brain.index, brain.generation);
    brain.roamSeed = Math.random() * Math.PI * 2;
    bot.position = this.botSpawnPoint(brain.index, brain.generation, bot.level, brain.groundIndex);
    bot.velocity = { x: 0, y: 0 };
    bot.input = this.emptyInput();
    brain.lastMoveDirection = undefined;
    bot.hp = Math.max(1, Math.round(bot.maxHp * (0.72 + Math.random() * 0.28)));
    bot.cp = Math.max(0, Math.round(bot.maxCp * (0.62 + Math.random() * 0.38)));
    bot.mp = Math.max(0, Math.round(bot.maxMp * (0.62 + Math.random() * 0.38)));
    bot.downed = false;
    bot.revivableUntil = undefined;
    bot.deathReturnPosition = undefined;
    bot.zone = this.zoneFor(bot.position);
    bot.lastSafePosition = this.nearestCityPosition(bot.position);
    this.players.set(bot.id, bot);

    brain.storedBot = undefined;
    brain.offlineUntil = undefined;
    brain.nextThinkAt = now + this.randomBetween(400, 1800);
    brain.nextSessionAt = now + this.randomBetween(BOT_SESSION_MIN_MS, BOT_SESSION_MAX_MS);
    brain.nextChillAt = now + this.randomBetween(4_000, 22_000);
    brain.nextChatAt = now + this.randomBetween(1_000, 12_000);
    brain.nextSkillAt = now + this.randomBetween(1_200, 5_000);
    brain.nextDashAt = now + this.randomBetween(8_000, 24_000);
    brain.nextTownActionAt = now + this.randomBetween(2_000, 12_000);
    brain.nextWorldMoveAt = now + this.randomBetween(24_000, 96_000);
    brain.arenaUntil = undefined;
    brain.arenaMode = undefined;
    brain.arenaAnchorAngle = undefined;
    brain.nextArenaShiftAt = undefined;
    brain.nextArenaAt = now + this.initialBotArenaDelay(brain.index);
    brain.nextShopAt = now + this.randomBetween(20_000, 130_000);
    brain.queuedChats = undefined;
    brain.targetLockedUntil = undefined;
    this.maybeBotBuyGear(bot, brain, now, true);
    this.botChat(bot, brain, this.randomBotLine(brain, BOT_RETURN_CHAT_LINES), "local", true);
  }

	  private updateBot(bot: PlayerPrivateState, now: number): void {
    const brain = this.botBrains.get(bot.id);
    if (!brain || now < brain.nextThinkAt) {
      return;
    }
    this.enforceBotLevelCap(bot, brain, now);
    brain.nextThinkAt = now + this.randomBetween(BOT_THINK_MIN_MS, BOT_THINK_MAX_MS);
    this.processBotQueuedChats(bot, brain, now);
    this.maybeBotChat(bot, brain, now);

    if (bot.hp <= 0 || bot.downed) {
      bot.input = this.emptyInput();
      bot.velocity = { x: 0, y: 0 };
      brain.targetId = undefined;
      brain.forcePkTargetId = undefined;
      brain.roamTarget = undefined;
      if ((brain.arenaUntil ?? 0) > now || this.isStarterArena(bot.position)) {
        brain.arenaUntil = undefined;
        brain.arenaMode = undefined;
        brain.arenaAnchorAngle = undefined;
        brain.nextArenaShiftAt = undefined;
        brain.nextArenaAt = now + this.randomBetween(4 * 60_000, 12 * 60_000);
      }
      brain.respawnAt ??= now + this.randomBetween(BOT_RESPAWN_MIN_MS, BOT_RESPAWN_MAX_MS);
      if (now >= brain.respawnAt) {
        this.respawnPlayer(bot);
        brain.respawnAt = undefined;
      }
      return;
    }

	    brain.respawnAt = undefined;
	    bot.zone = this.zoneFor(bot.position);
    if (this.updateBotMarketVendor(bot, brain, now)) {
      return;
    }
	    const partyLeader = this.botPartyLeader(bot);
    if (partyLeader) {
      brain.arenaUntil = undefined;
      brain.arenaMode = undefined;
      brain.arenaAnchorAngle = undefined;
      brain.nextArenaShiftAt = undefined;
      brain.pkModeUntil = undefined;
    } else {
      this.updateBotMood(bot, brain, now);
      this.updateBotSession(bot, brain, now);
    }
    if (!this.players.has(bot.id)) {
      return;
    }
    if (!partyLeader) {
      this.updateBotArenaIntent(bot, brain, now);
    }
    if (this.recoverStuckBot(bot, brain, now)) {
      return;
    }

    const hpRatio = bot.hp / bot.maxHp;
    if (hpRatio < 0.46) {
      this.tryBotUsePotion(bot);
    }
    if (bot.zone === "safe" && hpRatio < 0.78) {
      brain.targetId = undefined;
      brain.forcePkTargetId = undefined;
      brain.targetLockedUntil = undefined;
      brain.roamTarget = undefined;
      brain.chillUntil = Math.max(brain.chillUntil ?? 0, now + this.randomBetween(4_500, 14_000));
      this.setBotInput(bot, { x: 0, y: 0 }, this.botIdleAim(bot, brain), false, false);
      return;
    }
    if (hpRatio < 0.24 && bot.zone !== "safe") {
      const safePosition = this.nearestCityPosition(bot.position);
      this.setBotInput(bot, this.normalize({ x: safePosition.x - bot.position.x, y: safePosition.y - bot.position.y }), safePosition, true, false, this.botShouldDash(bot, brain, now, this.distance(bot.position, safePosition), "escape"));
      brain.targetId = undefined;
      brain.forcePkTargetId = undefined;
      brain.targetLockedUntil = undefined;
      brain.roamTarget = undefined;
      return;
    }
    if (partyLeader && this.updateBotPartyFollow(bot, brain, partyLeader, now)) {
      return;
    }
    const clanMate = partyLeader ? undefined : this.botClanMateToFollow(bot, brain, now);
    if (clanMate && this.updateBotClanFollow(bot, brain, clanMate, now)) {
      return;
    }
    if (this.updateBotArenaHubDispersal(bot, brain, now)) {
      return;
    }
    if (this.updateBotDungeonTravel(bot, brain, now)) {
      return;
    }
    if (this.updateBotTownChill(bot, brain, now)) {
      return;
    }

    const currentTarget = this.botCurrentTarget(bot, brain, now);
    const arenaFighter = this.isBotArenaFighter(bot, brain, now);
    if (arenaFighter && this.hasNearbyArenaHumanTarget(bot, brain, currentTarget?.id, now)) {
      brain.chillUntil = undefined;
    }
    if (currentTarget) {
      brain.chillUntil = undefined;
      this.driveBotToTarget(bot, brain, currentTarget, now);
      brain.nextThinkAt = now + this.botCombatThinkDelay(bot, currentTarget, now);
      return;
    }

    if (!currentTarget && arenaFighter) {
      const arenaTarget = this.chooseBotTarget(bot, brain, now);
      if (arenaTarget) {
        brain.chillUntil = undefined;
        this.driveBotToTarget(bot, brain, arenaTarget, now);
        brain.nextThinkAt = now + this.botCombatThinkDelay(bot, arenaTarget, now);
        return;
      }
    }

    if (!arenaFighter && this.tryBotPickupGroundLoot(bot, brain, now)) {
      return;
    }

    if (!currentTarget) {
      if (this.tryBotReviveNearby(bot, brain, now)) {
        return;
      }
      if (this.updateBotTownChill(bot, brain, now)) {
        return;
      }
      this.updateBotChill(bot, brain, now);
      if ((brain.chillUntil ?? 0) > now) {
        this.setBotInput(bot, { x: 0, y: 0 }, this.botIdleAim(bot, brain), false, false);
        return;
      }
    }

    const target = currentTarget ?? this.chooseBotTarget(bot, brain, now);
    if (target) {
      brain.chillUntil = undefined;
      this.driveBotToTarget(bot, brain, target, now);
      brain.nextThinkAt = now + this.botCombatThinkDelay(bot, target, now);
      return;
    }

    if (brain.roamTarget && this.distance(bot.position, brain.roamTarget) <= 160) {
      brain.roamTarget = undefined;
      brain.chillUntil = now + this.randomBetween(3_000, 11_000);
      this.setBotInput(bot, { x: 0, y: 0 }, this.botIdleAim(bot, brain), false, false);
      return;
    }

    const goal = this.botTravelGoal(bot, brain, now);
	    const distanceToGoal = this.distance(bot.position, goal);
	    const travelMovement = distanceToGoal > 110 ? this.normalize({ x: goal.x - bot.position.x, y: goal.y - bot.position.y }) : { x: 0, y: 0 };
	    this.setBotInput(bot, travelMovement, goal, false, false, this.botShouldDash(bot, brain, now, distanceToGoal, "travel"));
	  }

  private updateBotDungeonTravel(bot: PlayerPrivateState, brain: BotBrain, now: number): boolean {
    if ((brain.arenaUntil ?? 0) > now || brain.targetId || bot.hp <= 0 || bot.downed) {
      return false;
    }

    const ground = BOT_HUNTING_GROUNDS[brain.groundIndex];
    const assignedDungeon = this.botGroundDungeon(ground);
    const currentDungeon = this.dungeonInteriorAt(bot.position);
    if (currentDungeon && currentDungeon.id !== assignedDungeon?.id) {
      return this.driveBotToDungeonExit(bot, brain, currentDungeon, now);
    }
    if (!assignedDungeon || currentDungeon?.id === assignedDungeon.id) {
      return false;
    }

    const landmark = WORLD_LANDMARKS.find((candidate) => candidate.id === assignedDungeon.landmarkId);
    if (!landmark) {
      return false;
    }

    const portalTarget = this.botDungeonEntrancePoint(assignedDungeon);
    const distanceToEntrance = this.distance(bot.position, portalTarget);
    if (distanceToEntrance <= BOT_DUNGEON_PORTAL_USE_RANGE) {
      if (this.enterDungeon(bot.id, landmark.id)) {
        brain.roamTarget = this.randomDungeonInteriorPoint(assignedDungeon);
        brain.chillUntil = undefined;
        brain.targetLockedUntil = undefined;
        brain.nextWorldMoveAt = now + this.randomBetween(90_000, 210_000);
        brain.nextThinkAt = now + this.randomBetween(180, 420);
        return true;
      }
    }

    const entranceTarget =
      !brain.roamTarget ||
      this.distance(brain.roamTarget, portalTarget) > DUNGEON_PORTAL_USE_RANGE ||
      this.distance(bot.position, brain.roamTarget) <= 150
        ? portalTarget
        : brain.roamTarget;
    brain.roamTarget = entranceTarget;
    brain.chillUntil = undefined;
    const distanceToGoal = this.distance(bot.position, entranceTarget);
    this.setBotInput(
      bot,
      this.normalize({ x: entranceTarget.x - bot.position.x, y: entranceTarget.y - bot.position.y }),
      entranceTarget,
      distanceToGoal > 620,
      false,
      this.botShouldDash(bot, brain, now, distanceToGoal, "travel")
    );
    brain.nextThinkAt = now + this.randomBetween(180, 420);
    return true;
  }

  private driveBotToDungeonExit(
    bot: PlayerPrivateState,
    brain: BotBrain,
    dungeon: (typeof WORLD_DUNGEON_INTERIORS)[number],
    now: number
  ): boolean {
    const startDistance = this.distance(bot.position, dungeon.start);
    const endDistance = this.distance(bot.position, dungeon.end);
    const exit: "start" | "end" = endDistance < startDistance ? "end" : "start";
    const portal = exit === "end" ? dungeon.end : dungeon.start;
    const portalDistance = this.distance(bot.position, portal);
    if (portalDistance <= BOT_DUNGEON_PORTAL_USE_RANGE && this.exitDungeon(bot.id, dungeon.id, exit)) {
      brain.roamTarget = undefined;
      brain.targetLockedUntil = undefined;
      brain.nextThinkAt = now + this.randomBetween(180, 420);
      return true;
    }

    brain.roamTarget = portal;
    brain.chillUntil = undefined;
    this.setBotInput(
      bot,
      this.normalize({ x: portal.x - bot.position.x, y: portal.y - bot.position.y }),
      portal,
      portalDistance > 520,
      false,
      this.botShouldDash(bot, brain, now, portalDistance, "travel")
    );
    brain.nextThinkAt = now + this.randomBetween(180, 420);
    return true;
  }

  private updateBotMarketVendor(bot: PlayerPrivateState, brain: BotBrain, now: number): boolean {
    if (!this.isMarketVendorBotIndex(brain.index)) {
      return false;
    }

    const market = this.marketCityDefinition();
    if ((brain.marketFarmingUntil ?? 0) > now) {
      bot.marketVendor = undefined;
      bot.sitting = false;
      return false;
    }

    if (brain.marketFarmingUntil && now >= brain.marketFarmingUntil) {
      brain.marketFarmingUntil = undefined;
      brain.marketVendorUntil = now + this.randomBetween(45 * 60_000, 125 * 60_000);
      brain.nextMarketRestockAt = 0;
      brain.chillUntil = undefined;
      brain.targetId = undefined;
      brain.forcePkTargetId = undefined;
      brain.roamTarget = this.marketVendorPosition(brain.index, brain.generation);
    }

    if ((brain.marketVendorUntil ?? 0) <= now && bot.marketVendor) {
      bot.marketVendor = undefined;
      bot.sitting = false;
      brain.marketFarmingUntil = now + this.randomBetween(16 * 60_000, 44 * 60_000);
      brain.groundIndex = this.botInitialGroundIndex(bot.level, brain.index, brain.generation);
      brain.roamTarget = this.botSpawnPoint(brain.index, brain.generation, bot.level, brain.groundIndex);
      brain.chillUntil = undefined;
      brain.targetId = undefined;
      brain.forcePkTargetId = undefined;
      brain.targetLockedUntil = undefined;
      brain.nextWorldMoveAt = now + this.randomBetween(32_000, 95_000);
      brain.nextThinkAt = now + this.randomBetween(200, 700);
      return false;
    }

    if ((brain.marketVendorUntil ?? 0) <= now) {
      brain.marketVendorUntil = now + this.randomBetween(45 * 60_000, 125 * 60_000);
    }

    const seat = this.marketVendorPosition(brain.index, brain.generation);
    const distanceToSeat = this.distance(bot.position, seat);
    if (distanceToSeat > 72) {
      bot.marketVendor = undefined;
      bot.sitting = false;
      bot.zone = this.zoneFor(bot.position);
      const movement = this.normalize({ x: seat.x - bot.position.x, y: seat.y - bot.position.y });
      this.setBotInput(bot, movement, seat, distanceToSeat > 420, false, this.botShouldDash(bot, brain, now, distanceToSeat, "travel"));
      bot.blocking = false;
      brain.targetId = undefined;
      brain.forcePkTargetId = undefined;
      brain.targetLockedUntil = undefined;
      brain.roamTarget = seat;
      brain.nextThinkAt = now + this.randomBetween(180, 420);
      return true;
    }

    bot.position = seat;
    bot.facing = this.normalize({ x: market.position.x - bot.position.x, y: market.position.y - bot.position.y });
    if (!bot.marketVendor || bot.marketVendor.items.length === 0 || (brain.nextMarketRestockAt ?? 0) <= now) {
      bot.marketVendor = this.createBotMarketVendor(bot, brain.index, now);
      brain.nextMarketRestockAt = now + this.randomBetween(7 * 60_000, 19 * 60_000);
    }

    bot.sitting = true;
    bot.zone = "safe";
    bot.lastSafePosition = { ...market.position };
    bot.input = this.emptyInput();
    bot.velocity = { x: 0, y: 0 };
    bot.blocking = false;
    brain.targetId = undefined;
    brain.forcePkTargetId = undefined;
    brain.roamTarget = undefined;
    brain.targetLockedUntil = undefined;
    brain.chillUntil = Math.max(brain.chillUntil ?? 0, now + 45_000);
    return true;
  }

	  private botPartyLeader(bot: PlayerPrivateState): PlayerPrivateState | undefined {
    const partyId = this.partyByPlayer.get(bot.id);
    const party = partyId ? this.parties.get(partyId) : undefined;
    if (!party) {
      return undefined;
    }

    return [...party]
      .map((memberId) => this.players.get(memberId))
      .filter((member): member is PlayerPrivateState => Boolean(member && member.id !== bot.id && !this.botBrains.has(member.id) && member.hp > 0 && !member.downed))
      .sort((a, b) => this.distance(bot.position, a.position) - this.distance(bot.position, b.position))[0];
  }

  private partyFollowPoint(bot: PlayerPrivateState, leader: PlayerPrivateState, brain: BotBrain): Vector2 {
    const angle = (brain.index * 2.3999632297 + this.tick * 0.0008) % (Math.PI * 2);
    const radius = 150 + (brain.index % 4) * 38;
    return this.pushOutOfWorldObstacles(this.clampPosition({
      x: leader.position.x + Math.cos(angle) * radius,
      y: leader.position.y + Math.sin(angle) * radius
    }));
  }

  private updateBotPartyFollow(bot: PlayerPrivateState, brain: BotBrain, leader: PlayerPrivateState, now: number): boolean {
    const distance = this.distance(bot.position, leader.position);
    const assistTarget = this.findBotAllyDefenseTarget(bot, now) ?? this.findBotPartyAssistTarget(bot, leader) ?? this.findBotAllyMonsterAssistTarget(bot);
    if (assistTarget) {
      brain.chillUntil = undefined;
      brain.targetId = assistTarget.id;
      brain.forcePkTargetId = undefined;
      brain.targetLockedUntil = now + this.randomBetween(2_400, 6_500);
      this.driveBotToTarget(bot, brain, assistTarget, now);
      brain.nextThinkAt = now + this.botCombatThinkDelay(bot, assistTarget, now);
      return true;
    }

    brain.targetId = undefined;
    brain.forcePkTargetId = undefined;
    brain.targetLockedUntil = undefined;
    brain.chillUntil = undefined;

    if (distance > 340) {
      const followPoint = distance > 2600 ? leader.position : this.partyFollowPoint(bot, leader, brain);
      brain.roamTarget = followPoint;
      const movement = this.normalize({ x: followPoint.x - bot.position.x, y: followPoint.y - bot.position.y });
      this.setBotInput(bot, movement, leader.position, distance > 820, false, this.botShouldDash(bot, brain, now, distance, "travel"));
      brain.nextThinkAt = now + this.randomBetween(180, 420);
      return true;
    }

    brain.roamTarget = undefined;
    this.setBotInput(bot, { x: 0, y: 0 }, leader.position, false, false);
    if (now >= brain.nextChatAt && Math.random() < 0.24) {
      const line = this.randomBotLine(brain, BOT_SOCIAL_CHAT_LINES).replace("{name}", leader.name);
      this.botChat(bot, brain, line, "local", true);
    }
    return true;
  }

  private botClanMateToFollow(bot: PlayerPrivateState, brain: BotBrain, now: number): PlayerPrivateState | undefined {
    if (!bot.clanId || now < (brain.nextClanFollowAt ?? 0)) {
      return undefined;
    }

    const candidates = [...this.players.values()]
      .filter((player) => player.id !== bot.id && !this.botBrains.has(player.id) && player.clanId === bot.clanId && player.hp > 0 && !player.downed)
      .sort((first, second) => this.distance(bot.position, first.position) - this.distance(bot.position, second.position));
    return candidates[0];
  }

  private placeBotNearClanmate(bot: PlayerPrivateState, brain: BotBrain, clanMate: PlayerPrivateState, now: number): void {
    const position = this.partyFollowPoint(bot, clanMate, brain);
    bot.position = position;
    bot.velocity = { x: 0, y: 0 };
    bot.zone = this.zoneFor(bot.position);
    bot.lastSafePosition = bot.zone === "safe" ? { ...bot.position } : bot.lastSafePosition;
    bot.input = this.emptyInput();
    brain.roamTarget = this.partyFollowPoint(bot, clanMate, brain);
    brain.targetId = undefined;
    brain.forcePkTargetId = undefined;
    brain.targetLockedUntil = undefined;
    brain.chillUntil = now + this.randomBetween(1_200, 3_400);
    brain.nextClanFollowAt = now + this.randomBetween(8_000, 18_000);
  }

  private updateBotClanFollow(bot: PlayerPrivateState, brain: BotBrain, clanMate: PlayerPrivateState, now: number): boolean {
    const distance = this.distance(bot.position, clanMate.position);
    const assistTarget = this.findBotAllyDefenseTarget(bot, now) ?? this.findBotAllyMonsterAssistTarget(bot);
    if (assistTarget) {
      brain.chillUntil = undefined;
      brain.targetId = assistTarget.id;
      brain.forcePkTargetId = undefined;
      brain.targetLockedUntil = now + this.randomBetween(2_400, 6_500);
      this.driveBotToTarget(bot, brain, assistTarget, now);
      brain.nextThinkAt = now + this.botCombatThinkDelay(bot, assistTarget, now);
      return true;
    }

    if (distance > SNAPSHOT_PLAYER_RADIUS * 1.2) {
      this.placeBotNearClanmate(bot, brain, clanMate, now);
      this.setBotInput(bot, { x: 0, y: 0 }, clanMate.position, false, false);
      return true;
    }

    if (distance > 560) {
      const followPoint = distance > 2600 ? clanMate.position : this.partyFollowPoint(bot, clanMate, brain);
      brain.roamTarget = followPoint;
      brain.chillUntil = undefined;
      const movement = this.normalize({ x: followPoint.x - bot.position.x, y: followPoint.y - bot.position.y });
      this.setBotInput(bot, movement, clanMate.position, distance > 920, false, this.botShouldDash(bot, brain, now, distance, "travel"));
      brain.nextThinkAt = now + this.randomBetween(220, 520);
      return true;
    }

    if (distance < 320 && Math.random() < 0.22) {
      brain.nextClanFollowAt = now + this.randomBetween(5_000, 13_000);
      return false;
    }

    brain.roamTarget = undefined;
    this.setBotInput(bot, { x: 0, y: 0 }, clanMate.position, false, false);
    brain.nextThinkAt = now + this.randomBetween(550, 1_100);
    return true;
  }

  private arenaHubCity(): (typeof CITY_DEFINITIONS)[number] {
    return CITY_DEFINITIONS.find((city) => city.id === BOT_ARENA_HUB_CITY_ID) ?? this.nearestCityDefinition({
      x: STARTER_ARENA.center.x + STARTER_ARENA.radius,
      y: STARTER_ARENA.center.y
    });
  }

  private playerCrowdCount(position: Vector2, radius: number, filter: "all" | "bot" | "human" = "all"): number {
    let count = 0;
    for (const player of this.players.values()) {
      if (player.hp <= 0 || player.downed || this.distance(player.position, position) > radius) {
        continue;
      }

      const isBot = this.botBrains.has(player.id);
      if ((filter === "bot" && !isBot) || (filter === "human" && isBot)) {
        continue;
      }
      count += 1;
    }
    return count;
  }

  private arenaHubBotStayScore(bot: PlayerPrivateState, brain: BotBrain): number {
    const hpRatio = bot.maxHp > 0 ? bot.hp / bot.maxHp : 1;
    const oldRosterBonus = brain.index < BOT_NAMES.length ? -180 : 0;
    const lowHpBonus = hpRatio < 0.92 ? -220 : 0;
    return oldRosterBonus + lowHpBonus + Math.sin((brain.index + 1) * 12.989 + (brain.generation + 1) * 78.233) * 100 + brain.index * 0.01;
  }

  private arenaHubBotRank(bot: PlayerPrivateState, hub: (typeof CITY_DEFINITIONS)[number]): number {
    const ranked = [...this.players.values()]
      .map((candidate) => ({ bot: candidate, brain: this.botBrains.get(candidate.id) }))
      .filter(({ bot: candidate, brain }) => Boolean(brain && candidate.hp > 0 && !candidate.downed && this.distance(candidate.position, hub.position) <= BOT_ARENA_HUB_RADIUS))
      .sort((first, second) => this.arenaHubBotStayScore(first.bot, first.brain!) - this.arenaHubBotStayScore(second.bot, second.brain!));
    return ranked.findIndex((candidate) => candidate.bot.id === bot.id);
  }

  private botArenaHubDispersalPoint(bot: PlayerPrivateState, brain: BotBrain, hub: (typeof CITY_DEFINITIONS)[number]): Vector2 {
    if (bot.hp / bot.maxHp >= 0.62 && Math.random() < 0.82) {
      return this.sunspireArenaOverflowPoint(bot, brain);
    }

    const eligible = BOT_HUNTING_GROUNDS
      .map((ground, groundIndex) => ({ ground, groundIndex }))
      .filter(
        ({ ground }) =>
          ground.level <= bot.level + 7 &&
          ground.level >= Math.max(1, bot.level - 12) &&
          this.distance(ground.position, hub.position) > BOT_ARENA_HUB_RADIUS + 900
      );
    const pool =
      eligible.length > 0
        ? eligible
        : BOT_HUNTING_GROUNDS
            .map((ground, groundIndex) => ({ ground, groundIndex }))
            .filter(({ ground }) => ground.level <= bot.level + 7 && ground.level >= Math.max(1, bot.level - 12));
    const candidates = (pool.length > 0 ? pool : BOT_HUNTING_GROUNDS.map((ground, groundIndex) => ({ ground, groundIndex })))
      .map((entry) => ({
        ...entry,
        score:
          Math.abs(entry.ground.level - Math.max(1, bot.level - 1)) * 160 +
          this.playerCrowdCount(entry.ground.position, entry.ground.radius + 760, "bot") * 420 +
          (this.distance(entry.ground.position, hub.position) <= BOT_ARENA_HUB_RADIUS + 900 ? 720 : 0) +
          Math.sin((brain.index + 1) * 17.17 + entry.groundIndex * 5.31 + this.tick * 0.005) * 120
      }))
      .sort((first, second) => first.score - second.score)
      .slice(0, 4);
    const selected = candidates[(brain.index + Math.floor(this.tick / 240)) % Math.max(1, candidates.length)] ?? candidates[0];
    if (selected) {
      brain.groundIndex = selected.groundIndex;
      return this.randomGroundSpawnPoint(selected.ground);
    }
    return this.randomCityRespawnPosition(this.nearestCityDefinition(bot.position));
  }

  private sunspireArenaOverflowPoint(bot: PlayerPrivateState, brain: BotBrain): Vector2 {
    const gateAngle = this.sunspireArenaEntryAngleForBot(bot, brain);
    const spectator = bot.level < 3 || Math.random() < 0.38;
    const spread = spectator ? 0.18 : 0.28;
    const angle = gateAngle + this.randomBetween(-spread, spread);
    const minRadius = spectator ? STARTER_ARENA.innerRadius * 0.72 : STARTER_ARENA.innerRadius * 0.28;
    const maxRadius = spectator ? STARTER_ARENA.radius * 0.92 : STARTER_ARENA.innerRadius * 0.72;
    const radius = minRadius + Math.sqrt(Math.random()) * Math.max(90, maxRadius - minRadius);

    brain.arenaUntil = Date.now() + this.randomBetween(9 * 60_000, 22 * 60_000);
    brain.arenaMode = spectator ? "watch" : Math.random() < BOT_ARENA_FIGHT_RATIO ? "fight" : "watch";
    brain.arenaAnchorAngle = gateAngle;
    brain.nextArenaShiftAt = Date.now() + this.randomBetween(32_000, 78_000);
    brain.nextArenaAt = Date.now() + this.randomBetween(10 * 60_000, 22 * 60_000);

    return this.pushOutOfWorldObstacles(this.clampPosition({
      x: STARTER_ARENA.center.x + Math.cos(angle) * radius,
      y: STARTER_ARENA.center.y + Math.sin(angle) * radius
    }));
  }

  private sunspireArenaEntryAngleForBot(bot: PlayerPrivateState, brain: BotBrain): number {
    const sourceAngle = this.arenaAngleForPosition(bot.position);
    const alternates = [
      sourceAngle + Math.PI,
      sourceAngle + Math.PI * 0.72,
      sourceAngle - Math.PI * 0.72,
      sourceAngle + Math.PI * 0.48,
      sourceAngle - Math.PI * 0.48
    ];
    const anchor = alternates[(brain.index + brain.generation + Math.floor(this.tick / 120)) % alternates.length] ?? sourceAngle + Math.PI;
    return this.leastCrowdedArenaGateAngle(anchor, brain);
  }

  private updateBotArenaHubDispersal(bot: PlayerPrivateState, brain: BotBrain, now: number): boolean {
    if (bot.zone !== "safe" || (brain.arenaUntil ?? 0) > now || bot.hp / bot.maxHp < 0.78) {
      return false;
    }

    const hub = this.arenaHubCity();
    if (this.nearestCityDefinition(bot.position).id !== hub.id || this.distance(bot.position, hub.position) > BOT_ARENA_HUB_RADIUS) {
      return false;
    }

    const humanCount = this.playerCrowdCount(hub.position, BOT_ARENA_HUB_RADIUS, "human");
    const botCount = this.playerCrowdCount(hub.position, BOT_ARENA_HUB_RADIUS, "bot");
    const keepBots = Math.max(BOT_ARENA_HUB_MIN_BOTS, BOT_ARENA_HUB_SOFT_CAP - humanCount * 2);
    if (botCount <= keepBots && humanCount + botCount <= BOT_ARENA_HUB_SOFT_CAP) {
      return false;
    }

    const rank = this.arenaHubBotRank(bot, hub);
    if (rank >= 0 && rank < keepBots && humanCount + botCount < BOT_ARENA_HUB_HARD_CAP) {
      return false;
    }

    const existingTarget =
      brain.roamTarget && this.distance(brain.roamTarget, hub.position) > BOT_ARENA_HUB_RADIUS + 700 && this.distance(bot.position, brain.roamTarget) > 180
        ? brain.roamTarget
        : undefined;
    const target = existingTarget ?? this.botArenaHubDispersalPoint(bot, brain, hub);
    brain.roamTarget = target;
    brain.chillUntil = undefined;
    brain.targetId = undefined;
    brain.forcePkTargetId = undefined;
    brain.targetLockedUntil = undefined;
    brain.nextWorldMoveAt = now + this.randomBetween(22_000, 62_000);

    const distance = this.distance(bot.position, target);
    const movement = distance > 120 ? this.normalize({ x: target.x - bot.position.x, y: target.y - bot.position.y }) : { x: 0, y: 0 };
    this.setBotInput(bot, movement, target, distance > 420, false, this.botShouldDash(bot, brain, now, distance, "travel"));
    brain.nextThinkAt = now + this.randomBetween(180, 420);
    return true;
  }

  private findBotPartyAssistTarget(bot: PlayerPrivateState, leader: PlayerPrivateState): MonsterState | undefined {
    if (bot.zone === "safe" || leader.zone === "safe" || this.distance(bot.position, leader.position) > 1500) {
      return undefined;
    }

    let best: MonsterState | undefined;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const monster of this.monsters.values()) {
      if (monster.hp <= 0 || !this.botCanFightMonster(bot, monster)) {
        continue;
      }

      const leaderDistance = this.distance(leader.position, monster.position);
      const botDistance = this.distance(bot.position, monster.position);
      if (leaderDistance > 760 || botDistance > BOT_MONSTER_SCAN_RANGE) {
        continue;
      }

      const score = leaderDistance + botDistance * 0.18 - (monster.targetId === leader.id ? 420 : 0);
      if (score < bestScore) {
        best = monster;
        bestScore = score;
      }
    }
    return best;
  }

  private findBotAllyDefenseTarget(bot: PlayerPrivateState, now: number): PlayerPrivateState | undefined {
    if (bot.zone === "safe") {
      return undefined;
    }

    let best: PlayerPrivateState | undefined;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const ally of this.players.values()) {
      if (ally.id === bot.id || ally.hp <= 0 || ally.downed || !this.isFriendlyPlayerRelation(bot, ally)) {
        continue;
      }

      const allyDistance = this.distance(bot.position, ally.position);
      if (allyDistance > BOT_PVP_SCAN_RANGE * 1.25) {
        continue;
      }

      for (const attacker of this.players.values()) {
        if (
          attacker.id === bot.id ||
          attacker.id === ally.id ||
          attacker.hp <= 0 ||
          attacker.downed ||
          attacker.zone === "safe" ||
          this.isFriendlyPlayerRelation(bot, attacker) ||
          !this.hasRecentPlayerHit(attacker.id, ally.id, now)
        ) {
          continue;
        }

        const botDistance = this.distance(bot.position, attacker.position);
        if (botDistance > BOT_PVP_SCAN_RANGE * 1.35 || !this.canDamagePlayer(bot, attacker, false)) {
          continue;
        }

        const allyToAttacker = this.distance(ally.position, attacker.position);
        const lowAllyHpBonus = ally.hp / ally.maxHp < 0.45 ? -300 : 0;
        const clanBonus = bot.clanId && bot.clanId === ally.clanId ? -120 : 0;
        const score = botDistance + allyDistance * 0.18 + allyToAttacker * 0.12 + lowAllyHpBonus + clanBonus - (attacker.karma > 0 ? 160 : 0);
        if (score < bestScore) {
          best = attacker;
          bestScore = score;
        }
      }
    }

    return best;
  }

  private findBotAllyMonsterAssistTarget(bot: PlayerPrivateState): MonsterState | undefined {
    if (bot.zone === "safe") {
      return undefined;
    }

    let best: MonsterState | undefined;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const monster of this.monsters.values()) {
      if (monster.hp <= 0 || !monster.targetId || !this.botCanFightMonster(bot, monster)) {
        continue;
      }

      const ally = this.players.get(monster.targetId);
      if (!ally || ally.id === bot.id || ally.hp <= 0 || ally.downed || !this.isFriendlyPlayerRelation(bot, ally)) {
        continue;
      }

      const botDistance = this.distance(bot.position, monster.position);
      const allyDistance = this.distance(bot.position, ally.position);
      if (botDistance > BOT_MONSTER_SCAN_RANGE || allyDistance > BOT_PVP_SCAN_RANGE) {
        continue;
      }

      const score = botDistance + this.distance(ally.position, monster.position) * 0.22 + allyDistance * 0.1 - (ally.hp / ally.maxHp < 0.5 ? 260 : 0);
      if (score < bestScore) {
        best = monster;
        bestScore = score;
      }
    }

    return best;
  }

  private findBotHumanMonsterAssistTarget(bot: PlayerPrivateState, brain: BotBrain, now: number): MonsterState | undefined {
    if (bot.zone === "safe" || this.isStarterArena(bot.position) || bot.hp / Math.max(1, bot.maxHp) < 0.42) {
      return undefined;
    }

    let best: MonsterState | undefined;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const monster of this.monsters.values()) {
      if (monster.hp <= 0 || !monster.targetId || !this.botCanFightMonster(bot, monster)) {
        continue;
      }

      const player = this.players.get(monster.targetId);
      if (!player || player.id === bot.id || this.botBrains.has(player.id) || player.hp <= 0 || player.downed || player.zone === "safe") {
        continue;
      }
      if (this.isStarterArena(player.position) || this.hasRecentPlayerHit(bot.id, player.id, now) || this.hasRecentPlayerHit(player.id, bot.id, now)) {
        continue;
      }

      const botDistance = this.distance(bot.position, monster.position);
      const playerDistance = this.distance(player.position, monster.position);
      const botToPlayer = this.distance(bot.position, player.position);
      if (botDistance > BOT_MONSTER_SCAN_RANGE * 0.92 || playerDistance > 720 || botToPlayer > BOT_PVP_SCAN_RANGE * 1.15) {
        continue;
      }

      const pressure = this.botTargetPressure(monster.id, bot.id);
      const playerHpRatio = player.hp / Math.max(1, player.maxHp);
      if (pressure >= 2 && playerHpRatio > 0.48) {
        continue;
      }

      const lowHpBonus = playerHpRatio < 0.38 ? -520 : playerHpRatio < 0.62 ? -240 : 0;
      const humanLevelBonus = Math.abs(player.level - bot.level) <= 8 ? -90 : 0;
      const monsterLevelPenalty = Math.max(0, monster.level - bot.level) * 85;
      const pressurePenalty = pressure * BOT_TARGET_CROWD_PENALTY * 0.55;
      const personalNoise = Math.sin((brain.index + 5) * 14.91 + monster.id.length * 11.7 + this.tick * 0.012) * 70;
      const score =
        botDistance +
        playerDistance * 0.28 +
        botToPlayer * 0.08 +
        monsterLevelPenalty +
        pressurePenalty +
        personalNoise +
        lowHpBonus +
        humanLevelBonus;
      if (score < bestScore) {
        best = monster;
        bestScore = score;
      }
    }

    return best;
  }

  private tryBotPickupGroundLoot(bot: PlayerPrivateState, brain: BotBrain, now: number): boolean {
    if (bot.zone === "safe") {
      return false;
    }

    if (this.isBotArenaFighter(bot, brain, now)) {
      return false;
    }

    const loot = this.findBotGroundLoot(bot, now);
    if (!loot) {
      return false;
    }

    brain.targetId = undefined;
    brain.forcePkTargetId = undefined;
    brain.targetLockedUntil = undefined;
    brain.chillUntil = undefined;

    const distance = this.distance(bot.position, loot.position);
    if (distance <= GROUND_ITEM_PICKUP_RANGE) {
      this.setBotInput(bot, { x: 0, y: 0 }, loot.position, false, false);
      this.pickupGroundItem(bot.id, loot.id);
      if (Math.random() < 0.08) {
        this.queueBotChat(bot, brain, loot.kind === "coin" ? "о, койн упал" : "адена на земле, забрал", "local", false, 900, 3_400);
      }
      brain.nextThinkAt = now + this.randomBetween(260, 820);
      return true;
    }

    brain.roamTarget = loot.position;
    const movement = this.normalize({ x: loot.position.x - bot.position.x, y: loot.position.y - bot.position.y });
    this.setBotInput(bot, movement, loot.position, distance > 360, false, this.botShouldDash(bot, brain, now, distance, "travel"));
    brain.nextThinkAt = now + this.randomBetween(360, 980);
    return true;
  }

  private recoverStuckBot(bot: PlayerPrivateState, brain: BotBrain, now: number): boolean {
    if ((brain.avoidUntil ?? 0) > now && brain.avoidDirection) {
      const aim = {
        x: bot.position.x + brain.avoidDirection.x * 260,
        y: bot.position.y + brain.avoidDirection.y * 260
      };
      this.setBotInput(bot, brain.avoidDirection, aim, false, false);
      brain.nextThinkAt = now + this.randomBetween(120, 260);
      return true;
    }

    const movement = bot.input?.movement ?? { x: 0, y: 0 };
    const movementIntent = Math.hypot(movement.x, movement.y);
    if (movementIntent < 0.16) {
      brain.lastStuckCheckAt = now;
      brain.lastStuckPosition = { ...bot.position };
      brain.stuckSince = undefined;
      return false;
    }

    const previousAt = brain.lastStuckCheckAt ?? now;
    const previousPosition = brain.lastStuckPosition ?? bot.position;
    const elapsed = now - previousAt;
    if (elapsed < 420) {
      return false;
    }

    brain.lastStuckCheckAt = now;
    brain.lastStuckPosition = { ...bot.position };
    const moved = this.distance(bot.position, previousPosition);
    const velocity = Math.hypot(bot.velocity.x, bot.velocity.y);
    if (moved > 22 || velocity > Math.max(24, bot.stats.speed * 0.12)) {
      brain.stuckSince = undefined;
      return false;
    }

    brain.stuckSince ??= now;
    if (now - brain.stuckSince < 850) {
      return false;
    }

    const avoidDirection = this.botUnstuckDirection(bot, brain);
    if (avoidDirection.x === 0 && avoidDirection.y === 0) {
      brain.stuckSince = undefined;
      return false;
    }

    brain.targetId = undefined;
    brain.forcePkTargetId = undefined;
    brain.targetLockedUntil = undefined;
    brain.chillUntil = undefined;
    brain.avoidDirection = avoidDirection;
    brain.avoidUntil = now + this.randomBetween(850, 1_650);
    brain.roamTarget = this.clampPosition({
      x: bot.position.x + avoidDirection.x * this.randomBetween(320, 580),
      y: bot.position.y + avoidDirection.y * this.randomBetween(320, 580)
    });
    if (this.isStarterArena(bot.position)) {
      brain.roamTarget = this.randomArenaPoint(brain, false);
    }

    this.setBotInput(bot, avoidDirection, brain.roamTarget, false, false);
    brain.nextThinkAt = now + this.randomBetween(140, 280);
    return true;
  }

  private botUnstuckDirection(bot: PlayerPrivateState, brain: BotBrain): Vector2 {
    if (this.isNearStarterArenaWall(bot.position)) {
      const botInsideArena = this.isStarterArena(bot.position);
      const targetCrossesWall = brain.roamTarget ? botInsideArena !== this.isStarterArena(brain.roamTarget) : false;
      if (!targetCrossesWall) {
        const radial = botInsideArena
          ? { x: STARTER_ARENA.center.x - bot.position.x, y: STARTER_ARENA.center.y - bot.position.y }
          : { x: bot.position.x - STARTER_ARENA.center.x, y: bot.position.y - STARTER_ARENA.center.y };
        const awayFromWall = this.normalize(radial);
        if (awayFromWall.x !== 0 || awayFromWall.y !== 0) {
          return awayFromWall;
        }
      }

      const gate = this.nearestStarterArenaGatePoint(bot.position, brain.roamTarget);
      const toGate = this.normalize({ x: gate.x - bot.position.x, y: gate.y - bot.position.y });
      if (toGate.x !== 0 || toGate.y !== 0) {
        return toGate;
      }
    }

    const movement = this.normalize(bot.input?.movement ?? { x: 0, y: 0 });
    if (movement.x === 0 && movement.y === 0) {
      return this.normalize({
        x: Math.cos(brain.roamSeed),
        y: Math.sin(brain.roamSeed)
      });
    }

    const side = brain.index % 2 === 0 ? 1 : -1;
    return this.normalize({
      x: -movement.y * side - movement.x * 0.22,
      y: movement.x * side - movement.y * 0.22
    });
  }

  private findBotGroundLoot(bot: PlayerPrivateState, now: number): GroundItem | undefined {
    let best: GroundItem | undefined;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const item of this.groundItems.values()) {
      if (!this.botCanPickupGroundItem(bot, item, now)) {
        continue;
      }

      const distance = this.distance(bot.position, item.position);
      if (distance > BOT_LOOT_SCAN_RANGE) {
        continue;
      }

      const pvpCoin = item.item?.id === PVP_COIN_ITEM_ID;
      const kindBonus = pvpCoin ? -320 : item.kind === "coin" ? -280 : item.kind === "gold" ? -220 : item.rare ? -110 : 40;
      const ownBonus = item.ownerId === bot.id ? -180 : 0;
      const quantityBonus = -Math.min(160, item.quantity * (item.kind === "gold" ? 1.5 : 28));
      const score = distance + kindBonus + ownBonus + quantityBonus + Math.random() * 45;
      if (score < bestScore) {
        best = item;
        bestScore = score;
      }
    }

    return best;
  }

  private botCanPickupGroundItem(bot: PlayerPrivateState, item: GroundItem, now: number): boolean {
    if (item.expiresAt <= now) {
      return false;
    }

    const protectedForOwner = item.ownerId && item.ownerId !== bot.id && now < this.groundItemOwnerUnlockAt(item);
    if (protectedForOwner) {
      return false;
    }

    return item.kind === "gold" || item.kind === "coin" || item.item?.id === PVP_COIN_ITEM_ID || item.ownerId === bot.id || Boolean(item.rare);
  }

  private tryBotReviveNearby(bot: PlayerPrivateState, brain: BotBrain, now: number): boolean {
    if (now < brain.nextReviveAt || bot.hp / bot.maxHp < 0.42 || bot.zone === "safe" && Math.random() < 0.55) {
      return false;
    }

    const target = this.findBotReviveTarget(bot, brain, now);
    if (!target) {
      brain.nextReviveAt = now + this.randomBetween(6_000, 18_000);
      return false;
    }

    brain.targetId = undefined;
    brain.forcePkTargetId = undefined;
    brain.targetLockedUntil = undefined;
    brain.roamTarget = undefined;
    brain.chillUntil = undefined;

    const distance = this.distance(bot.position, target.position);
    if (distance <= BOT_REVIVE_RANGE) {
      this.setBotInput(bot, { x: 0, y: 0 }, target.position, false, false);
      this.revivePlayer(bot.id, target.id);
      brain.nextReviveAt = now + this.randomBetween(45_000, 140_000);
      brain.chillUntil = now + this.randomBetween(1_000, 3_500);
      return true;
    }

    const movement = this.normalize({ x: target.position.x - bot.position.x, y: target.position.y - bot.position.y });
    this.setBotInput(bot, movement, target.position, distance > 340, false, this.botShouldDash(bot, brain, now, distance, "travel"));
    return true;
  }

  private findBotReviveTarget(bot: PlayerPrivateState, brain: BotBrain, now: number): PlayerPrivateState | undefined {
    let best: PlayerPrivateState | undefined;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const candidate of this.players.values()) {
      if (candidate.id === bot.id || !candidate.downed || candidate.hp > 0 || (candidate.revivableUntil ?? 0) < now) {
        continue;
      }
      if (this.hasRecentPlayerHit(bot.id, candidate.id, now) || this.hasRecentPlayerHit(candidate.id, bot.id, now)) {
        continue;
      }

      const distance = this.distance(bot.position, candidate.position);
      if (distance > BOT_REVIVE_SCAN_RANGE) {
        continue;
      }

      const botTargetPenalty = this.botBrains.has(candidate.id) ? 70 : -140;
      const dangerPenalty = candidate.zone === "safe" ? 40 : 0;
      const personalNoise = Math.sin((brain.index + 3) * 19.17 + candidate.id.length * 4.13 + this.tick * 0.017) * 45;
      const score = distance + botTargetPenalty + dangerPenalty + personalNoise;
      if (score < bestScore) {
        best = candidate;
        bestScore = score;
      }
    }

    return best;
  }

  private updateBotSession(bot: PlayerPrivateState, brain: BotBrain, now: number): void {
    if (now < brain.nextSessionAt || brain.targetId || bot.zone !== "safe" && bot.hp / bot.maxHp < 0.65) {
      return;
    }

    brain.nextSessionAt = now + this.randomBetween(BOT_SESSION_MIN_MS, BOT_SESSION_MAX_MS);
    const visibleLowLevelBots = [...this.players.values()].filter((player) => this.botBrains.has(player.id) && player.level <= 5).length;
    const keepStarterCrowd = bot.level <= 5 && visibleLowLevelBots <= BOT_LOW_LEVEL_VISIBLE_COUNT;
    if (keepStarterCrowd || Math.random() > 0.2) {
      return;
    }

    this.suspendBot(bot, brain, now);
  }

  private updateBotChill(bot: PlayerPrivateState, brain: BotBrain, now: number): void {
    if ((brain.chillUntil ?? 0) > now) {
      return;
    }

    if (now < brain.nextChillAt) {
      return;
    }

    brain.nextChillAt = now + this.randomBetween(22_000, 96_000);
    if (Math.random() > (bot.zone === "safe" ? 0.68 : 0.34)) {
      return;
    }

    brain.targetId = undefined;
    brain.roamTarget = undefined;
    brain.chillUntil = now + this.randomBetween(BOT_CHILL_MIN_MS, BOT_CHILL_MAX_MS);
    if (Math.random() < 0.045) {
      this.botChat(bot, brain, this.randomBotLine(brain, BOT_CHAT_LINES), bot.zone === "safe" ? "world" : "local", true);
    }
  }

  private updateBotTownChill(bot: PlayerPrivateState, brain: BotBrain, now: number): boolean {
    if (bot.zone !== "safe" || (brain.arenaUntil ?? 0) > now) {
      return false;
    }

    if (now >= (brain.nextShopAt ?? 0) && this.maybeBotBuyGear(bot, brain, now)) {
      brain.targetId = undefined;
      brain.forcePkTargetId = undefined;
      brain.roamTarget = undefined;
      brain.chillUntil = now + this.randomBetween(2_600, 7_800);
      this.setBotInput(bot, { x: 0, y: 0 }, this.botIdleAim(bot, brain), false, false);
      return true;
    }

    if (now >= (brain.nextTownActionAt ?? 0)) {
      brain.nextTownActionAt = now + this.randomBetween(5_000, 18_000);
      if (Math.random() < 0.5) {
        brain.targetId = undefined;
        brain.forcePkTargetId = undefined;
        brain.roamTarget = undefined;
        brain.chillUntil = now + this.randomBetween(3_000, 11_000);
        if (Math.random() < 0.075) {
          this.queueBotChat(bot, brain, this.randomBotLine(brain, BOT_TOWN_CHAT_LINES), Math.random() < 0.22 ? "world" : "local", false, 1_200, 6_200);
        }
      } else if (Math.random() < 0.42) {
        const city = this.nearestCityDefinition(bot.position);
        const angle = Math.random() * Math.PI * 2;
        const radius = 60 + Math.sqrt(Math.random()) * Math.max(140, city.safeRadius * 0.56);
        brain.roamTarget = this.clampPosition({
          x: city.position.x + Math.cos(angle) * radius,
          y: city.position.y + Math.sin(angle) * radius
        });
      }
    }

    if ((brain.chillUntil ?? 0) > now) {
      const angle = brain.roamSeed + now * 0.00045;
      const movement = Math.random() < 0.18 ? this.normalize({ x: Math.cos(angle), y: Math.sin(angle) }) : { x: 0, y: 0 };
      const aim = this.clampPosition({
        x: bot.position.x + Math.cos(angle * 1.7) * 140,
        y: bot.position.y + Math.sin(angle * 1.7) * 140
      });
      this.setBotInput(bot, movement, aim, false, false);
      return true;
    }

    return false;
  }

  private maybeBotBuyGear(bot: PlayerPrivateState, brain: BotBrain, now: number, force = false): boolean {
    brain.nextShopAt = now + this.randomBetween(4 * 60_000, 18 * 60_000);
    if (!force && bot.zone !== "safe") {
      return false;
    }
    if (!force && Math.random() > 0.62) {
      return false;
    }

    const previousScore = this.equipmentLoadoutScore(bot.equipment);
    const nextEquipment = this.botEquipment(bot.classId, bot.level, brain.index, brain.generation);
    const nextScore = this.equipmentLoadoutScore(nextEquipment);
    if (nextScore <= previousScore + (force ? 0 : 8)) {
      return false;
    }

    const hpRatio = bot.maxHp > 0 ? bot.hp / bot.maxHp : 1;
    const cpRatio = bot.maxCp > 0 ? bot.cp / bot.maxCp : 1;
    const mpRatio = bot.maxMp > 0 ? bot.mp / bot.maxMp : 1;
    bot.equipment = nextEquipment;
    bot.inventory = this.botInventory(bot.classId, bot.level);
    this.recalculateStats(bot);
    bot.hp = Math.max(1, Math.min(bot.maxHp, Math.round(bot.maxHp * (force ? Math.max(hpRatio, 0.86) : hpRatio))));
    bot.cp = Math.max(0, Math.min(bot.maxCp, Math.round(bot.maxCp * (force ? Math.max(cpRatio, 0.74) : cpRatio))));
    bot.mp = Math.max(0, Math.min(bot.maxMp, Math.round(bot.maxMp * (force ? Math.max(mpRatio, 0.72) : mpRatio))));

    if (Math.random() < (force ? 0.32 : 0.14)) {
      this.queueBotChat(bot, brain, this.botGearChatLine(bot, brain), bot.zone === "safe" && Math.random() < 0.28 ? "world" : "local", false, 1_600, 7_400);
    }
    return true;
  }

  private equipmentLoadoutScore(equipment: EquipmentState): number {
    return Object.values(equipment).reduce((score, item) => {
      if (!item) {
        return score;
      }
      const statScore = Object.values(item.stats ?? {}).reduce((sum, value) => sum + Math.max(0, value ?? 0), 0);
      return score + (item.requiredLevel ?? 1) * 12 + this.gradeScore(item.grade) * 42 + (item.enchantLevel ?? 0) * 5 + statScore;
    }, 0);
  }

  private botGearChatLine(bot: PlayerPrivateState, brain: BotBrain): string {
    const weapon = bot.equipment.weapon;
    const armorGrade = this.bestArmorGrade(bot.equipment);
    const grade = armorGrade ?? weapon?.grade ?? "common";
    const enchant = weapon?.enchantLevel ?? 0;
    const weaponLabel = weapon ? `${weapon.enchantLevel ? `+${weapon.enchantLevel} ` : ""}${weapon.label}` : "новый шмот";
    return this.randomBotLine(brain, BOT_GEAR_CHAT_LINES)
      .replace("{weapon}", weaponLabel)
      .replace("{enchant}", String(enchant))
      .replace("{grade}", grade);
  }

  private bestArmorGrade(equipment: EquipmentState): InventoryItem["grade"] | undefined {
    return (["chest", "helmet", "gloves", "boots"] as const)
      .map((slot) => equipment[slot]?.grade)
      .filter((grade): grade is NonNullable<InventoryItem["grade"]> => Boolean(grade))
      .sort((a, b) => this.gradeScore(b) - this.gradeScore(a))[0];
  }

  private updateBotArenaIntent(bot: PlayerPrivateState, brain: BotBrain, now: number): void {
    if (bot.level < 3) {
      return;
    }

    if ((brain.arenaUntil ?? 0) > 0 && now >= (brain.arenaUntil ?? 0)) {
      brain.arenaUntil = undefined;
      brain.arenaMode = undefined;
      brain.arenaAnchorAngle = undefined;
      brain.nextArenaShiftAt = undefined;
      brain.roamTarget = undefined;
      brain.nextArenaAt = now + this.randomBetween(6 * 60_000, 16 * 60_000);
    }

    if ((brain.arenaUntil ?? 0) > now || now < (brain.nextArenaAt ?? 0) || bot.hp / bot.maxHp < 0.48) {
      if (this.isStarterArena(bot.position) && this.hasNearbyArenaHumanTarget(bot, brain, undefined, now) && brain.arenaMode !== "fight" && bot.hp / bot.maxHp >= 0.36) {
        if (this.activeArenaBotCount(now, "fight") >= BOT_ARENA_ACTIVE_HARD_CAP) {
          return;
        }
        brain.arenaUntil = Math.max(brain.arenaUntil ?? 0, now + this.randomBetween(5 * 60_000, 11 * 60_000));
        brain.arenaMode = "fight";
        brain.arenaAnchorAngle = this.arenaRoamAngleForBot(bot, brain, now);
        brain.nextArenaShiftAt = now + this.randomBetween(18_000, 42_000);
        brain.chillUntil = undefined;
        brain.nextArenaAt = now + this.randomBetween(5 * 60_000, 12 * 60_000);
      }
      return;
    }

    brain.nextArenaAt = now + this.randomBetween(7 * 60_000, 18 * 60_000);
    const arenaBots = this.activeArenaBotCount(now);
    const activeBots = this.activeBotCount();
    const targetArenaBots = Math.min(BOT_ARENA_ACTIVE_SOFT_CAP, Math.max(BOT_ARENA_MIN_ACTIVE, Math.floor(activeBots * BOT_ARENA_TARGET_RATIO)));
    const needsArenaBots = arenaBots < targetArenaBots;
    const oldRosterBot = brain.index < BOT_NAMES.length;
    const joinChance = needsArenaBots ? (oldRosterBot ? 0.76 : 0.58) : oldRosterBot ? 0.18 : 0.08;
    if (arenaBots >= BOT_ARENA_ACTIVE_HARD_CAP || (arenaBots >= BOT_ARENA_ACTIVE_SOFT_CAP && Math.random() < 0.68) || Math.random() > joinChance) {
      return;
    }

    brain.arenaUntil = now + this.randomBetween(7 * 60_000, 18 * 60_000);
    brain.arenaMode = Math.random() < Math.max(BOT_ARENA_FIGHT_RATIO, needsArenaBots ? 0.82 : 0.62) ? "fight" : "watch";
    brain.targetId = undefined;
    brain.forcePkTargetId = undefined;
    brain.arenaAnchorAngle = this.arenaEntryAngleForBot(bot, brain, now);
    brain.nextArenaShiftAt = now + this.randomBetween(24_000, 58_000);
    brain.roamTarget = this.randomArenaPoint(brain, brain.arenaMode === "watch", brain.arenaAnchorAngle);
    brain.chillUntil = brain.arenaMode === "watch" ? now + this.randomBetween(8_000, 24_000) : undefined;
    const arenaRoamTarget = brain.roamTarget;
    if (
      bot.zone === "safe" &&
      this.distance(bot.position, STARTER_ARENA.center) > STARTER_ARENA.radius + 700 &&
      !this.hasNearbyHumanPlayer(bot.position, 2600) &&
      !this.hasNearbyHumanPlayer(arenaRoamTarget, 2400) &&
      Math.random() < 0.12
    ) {
      bot.position = { ...arenaRoamTarget };
      bot.velocity = { x: 0, y: 0 };
      bot.zone = this.zoneFor(bot.position);
    }
    if (Math.random() < 0.1) {
      this.queueBotChat(bot, brain, this.randomBotLine(brain, brain.arenaMode === "watch" ? BOT_ARENA_WATCH_CHAT_LINES : BOT_ARENA_CHAT_LINES), "local", false, 3_200, 13_500);
    }
  }

  private isBotArenaFighter(bot: PlayerPrivateState, brain: BotBrain, now: number): boolean {
    return brain.arenaMode !== "watch" && (brain.arenaUntil ?? 0) > now && this.isStarterArena(bot.position) && bot.hp > 0 && !bot.downed;
  }

  private activeArenaBotCount(now: number, mode: "fight" | "any" = "any"): number {
    let count = 0;
    for (const [botId, brain] of this.botBrains.entries()) {
      if ((brain.arenaUntil ?? 0) <= now || (mode === "fight" && brain.arenaMode === "watch")) {
        continue;
      }

      const bot = this.players.get(botId);
      if (!bot || bot.hp <= 0 || bot.downed || !this.isStarterArena(bot.position)) {
        continue;
      }
      count += 1;
    }
    return count;
  }

  private hasNearbyArenaHumanTarget(bot: PlayerPrivateState, brain: BotBrain, ignoreId: string | undefined, now: number): boolean {
    for (const candidate of this.players.values()) {
      if (
        candidate.id === bot.id ||
        candidate.id === ignoreId ||
        this.botBrains.has(candidate.id) ||
        candidate.hp <= 0 ||
        candidate.downed ||
        candidate.zone === "safe" ||
        !this.isStarterArena(candidate.position)
      ) {
        continue;
      }
      if (this.isFriendlyPlayerRelation(bot, candidate)) {
        continue;
      }

      if (this.distance(bot.position, candidate.position) <= BOT_ARENA_PVP_SCAN_RANGE && this.canDamagePlayer(bot, candidate, this.botShouldForcePk(bot, candidate, brain, now))) {
        return true;
      }
    }

    return false;
  }

  private queueBotChat(
    bot: PlayerPrivateState,
    brain: BotBrain,
    text: string,
    channel: Exclude<ChatChannel, "system"> = "local",
    force = false,
    delayMinMs = 900,
    delayMaxMs = 4_200
  ): void {
    const sanitized = this.sanitizeChat(text);
    if (!sanitized) {
      return;
    }

    brain.queuedChats ??= [];
    if (brain.queuedChats.some((message) => message.text === sanitized)) {
      return;
    }
    brain.queuedChats.push({
      text: sanitized,
      channel,
      force,
      at: Date.now() + this.randomBetween(delayMinMs, delayMaxMs)
    });
    if (brain.queuedChats.length > 3) {
      brain.queuedChats.splice(0, brain.queuedChats.length - 3);
    }
  }

  private botTypingDelayWindow(text: string, angry = false): { min: number; max: number } {
    const chars = Math.max(10, text.length);
    const min = (angry ? 5_200 : 2_800) + chars * (angry ? 115 : 80);
    const max = (angry ? 14_000 : 8_500) + chars * (angry ? 230 : 165);
    return {
      min: Math.min(18_000, min),
      max: Math.min(34_000, Math.max(min + 1_800, max))
    };
  }

  private processBotQueuedChats(bot: PlayerPrivateState, brain: BotBrain, now: number): void {
    const queued = brain.queuedChats;
    if (!queued?.length) {
      return;
    }

    const readyIndex = queued.findIndex((message) => message.at <= now);
    if (readyIndex < 0) {
      return;
    }

    const [message] = queued.splice(readyIndex, 1);
    if (!message) {
      return;
    }

    this.botChat(bot, brain, message.text, message.channel, message.force);
    if (queued.length === 0) {
      brain.queuedChats = undefined;
    }
  }

  private maybeBotChat(bot: PlayerPrivateState, brain: BotBrain, now: number): void {
    if (now < brain.nextChatAt || bot.hp <= 0 || bot.downed) {
      return;
    }

    const redPlayer = this.nearbyRedPlayer(bot, 780);
    if (redPlayer && Math.random() < 0.2) {
      const text = this.randomBotLine(brain, BOT_RED_ALERT_CHAT_LINES)
        .replace("{name}", redPlayer.name)
        .replace("{area}", this.areaLabel(redPlayer.position));
      this.botChat(bot, brain, text, Math.random() < 0.45 ? "zone" : "local", true);
      return;
    }

    const socialTarget = this.nearbyBotSocialTarget(bot, 620);
    if (socialTarget && Math.random() < 0.12) {
      const text = this.randomBotLine(brain, BOT_SOCIAL_CHAT_LINES).replace("{name}", socialTarget.name);
      this.botChat(bot, brain, text, "local", true);
      return;
    }

    const activity = this.botActivityChatLine(bot, brain);
    this.botChat(bot, brain, activity.text, activity.channel);
  }

  private botActivityChatLine(bot: PlayerPrivateState, brain: BotBrain): { text: string; channel: Exclude<ChatChannel, "system"> } {
    const area = this.areaLabel(bot.position);
    const hp = String(Math.max(1, Math.round((bot.hp / Math.max(1, bot.maxHp)) * 100)));
    const targetPlayer = brain.targetId ? this.players.get(brain.targetId) : undefined;
    const targetMonster = brain.targetId ? this.monsters.get(brain.targetId) : undefined;
    const inArena = this.isStarterArena(bot.position) || (brain.arenaUntil ?? 0) > Date.now();

    if (bot.hp / Math.max(1, bot.maxHp) < 0.34) {
      return {
        text: this.randomBotLine(brain, BOT_LOW_HP_ACTIVITY_LINES).replace("{hp}", hp).replace("{area}", area),
        channel: "local"
      };
    }

    if (targetPlayer && targetPlayer.hp > 0) {
      return {
        text: this.randomBotLine(brain, BOT_PVP_ACTIVITY_LINES).replace("{target}", targetPlayer.name).replace("{area}", area),
        channel: inArena && Math.random() < 0.16 ? "zone" : "local"
      };
    }

    if (targetMonster && targetMonster.hp > 0) {
      const monsterLabel = MONSTER_TUNING[targetMonster.archetype].label;
      return {
        text: this.randomBotLine(brain, BOT_MONSTER_ACTIVITY_LINES).replace("{monster}", monsterLabel).replace("{area}", area),
        channel: "local"
      };
    }

    if (inArena) {
      return {
        text: this.randomBotLine(brain, BOT_ARENA_ACTIVITY_LINES).replace("{area}", area),
        channel: "local"
      };
    }

    if (brain.roamTarget && this.distance(bot.position, brain.roamTarget) > 520) {
      return {
        text: this.randomBotLine(brain, BOT_TRAVEL_ACTIVITY_LINES).replace("{area}", area),
        channel: "local"
      };
    }

    return {
      text: this.randomBotLine(brain, BOT_CHAT_LINES).replace("{area}", area),
      channel: bot.zone === "safe" && Math.random() < 0.08 ? "world" : "local"
    };
  }

  private nearbyBotSocialTarget(bot: PlayerPrivateState, range: number): PlayerPrivateState | undefined {
    let best: PlayerPrivateState | undefined;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const player of this.players.values()) {
      if (player.id === bot.id || player.hp <= 0 || player.downed) {
        continue;
      }

      const isBot = this.botBrains.has(player.id);
      const sameParty = this.sameParty(bot.id, player.id);
      if (!isBot && !sameParty) {
        continue;
      }

      const distance = this.distance(bot.position, player.position);
      if (distance > range) {
        continue;
      }

      const score = distance - (sameParty ? 280 : 0) - (!isBot ? 120 : 0) + Math.random() * 40;
      if (score < bestScore) {
        best = player;
        bestScore = score;
      }
    }
    return best;
  }

  private nearbyRedPlayer(bot: PlayerPrivateState, range: number): PlayerPrivateState | undefined {
    let best: PlayerPrivateState | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const player of this.players.values()) {
      if (player.id === bot.id || player.hp <= 0 || player.downed || player.karma <= 0) {
        continue;
      }

      const distance = this.distance(bot.position, player.position);
      if (distance > range || distance >= bestDistance) {
        continue;
      }

      best = player;
      bestDistance = distance;
    }
    return best;
  }

  private nearestCityDefinition(position: Vector2): (typeof CITY_DEFINITIONS)[number] {
    return [...CITY_DEFINITIONS].sort((a, b) => this.distance(position, a.position) - this.distance(position, b.position))[0] ?? CITY_DEFINITIONS[0];
  }

  private areaLabel(position: Vector2): string {
    if (this.isStarterArena(position)) {
      return "Arena PvP";
    }

    const city = this.nearestCityDefinition(position);
    const distance = this.distance(position, city.position);
    if (distance <= city.safeRadius + 950) {
      return city.label;
    }
    return `${city.label} дороги`;
  }

  private botChat(bot: PlayerPrivateState, brain: BotBrain, text: string, channel: Exclude<ChatChannel, "system"> = "local", force = false): void {
    const sanitized = this.sanitizeChat(force ? text : this.botChatVariant(bot, brain, text));
    const now = Date.now();
    if (!sanitized) {
      brain.nextChatAt = now + this.randomBetween(BOT_CHAT_MIN_MS, BOT_CHAT_MAX_MS);
      return;
    }

    const wideChannel = channel === "world" || channel === "zone";
    const globalGap = wideChannel ? BOT_WIDE_CHAT_GLOBAL_MIN_MS : force ? BOT_IMPORTANT_CHAT_GLOBAL_MIN_MS : BOT_CHAT_GLOBAL_MIN_MS;
    const lastGlobalChatAt = wideChannel ? this.lastBotWideChatAt : this.lastBotChatAt;
    if (now - lastGlobalChatAt < globalGap) {
      brain.nextChatAt = now + this.randomBetween(BOT_CHAT_RETRY_MIN_MS, BOT_CHAT_RETRY_MAX_MS);
      return;
    }

    const message: ChatMessage = {
      id: this.createId("chat"),
      at: now,
      playerId: bot.id,
      playerName: bot.name,
      channel,
      position: bot.position,
      zone: bot.zone,
      text: sanitized
    };
    this.pushChat(message, true);
    brain.lastChatText = sanitized;
    brain.recentChatTexts = [sanitized, ...(brain.recentChatTexts ?? []).filter((line) => line !== sanitized)].slice(0, 8);
    this.lastBotChatAt = now;
    if (wideChannel) {
      this.lastBotWideChatAt = now;
    }
    brain.nextChatAt = now + this.randomBetween(BOT_CHAT_MIN_MS, BOT_CHAT_MAX_MS);
  }

  private botChatVariant(bot: PlayerPrivateState, brain: BotBrain, text: string): string {
    const base = text.trim();
    if (base.length < 8 || /[.!?)]$/.test(base) || Math.random() > 0.42) {
      return base;
    }

    const area = this.areaLabel(bot.position);
    const variants = [
      `${base}, я у ${area}`,
      `${base}, ${bot.level} лвл если что`,
      `${base}, без суеты`,
      `${base}, аккуратно`,
      `${base}, дальше по дороге`,
      `${base}, потом в город`,
      `${base}, если рядом`,
      `${base}, не спешу`
    ];
    return variants[(brain.index + brain.generation * 3 + Math.floor(this.tick / 240) + Math.floor(Math.random() * variants.length)) % variants.length] ?? base;
  }

  private botIdleAim(bot: PlayerPrivateState, brain: BotBrain): Vector2 {
    const angle = brain.index * 0.77 + this.tick * 0.01;
    return this.clampPosition({
      x: bot.position.x + Math.cos(angle) * 120,
      y: bot.position.y + Math.sin(angle) * 120
    });
  }

  private updateBotMood(bot: PlayerPrivateState, brain: BotBrain, now: number): void {
    if (now < brain.nextPkAt) {
      return;
    }

    if (Math.random() < brain.aggression * 0.62) {
      brain.pkModeUntil = now + this.randomBetween(18_000, 42_000);
      if (Math.random() < 0.2) {
        this.botChat(bot, brain, this.randomBotLine(brain, BOT_PVP_CHAT_LINES), Math.random() < 0.22 ? "zone" : "local", true);
      }
    }
    brain.nextPkAt = now + this.randomBetween(38_000, 125_000);
  }

  private botCurrentTarget(bot: PlayerPrivateState, brain: BotBrain, now: number): MonsterState | PlayerPrivateState | undefined {
    if (!brain.targetId) {
      return undefined;
    }

    const monster = this.monsters.get(brain.targetId);
    if (monster) {
      if (monster.hp <= 0 || this.distance(bot.position, monster.position) > BOT_MONSTER_SCAN_RANGE * 1.25 || !this.botCanFightMonster(bot, monster)) {
        brain.targetId = undefined;
        if (monster.hp <= 0 && Math.random() < 0.14) {
          brain.chillUntil = now + this.randomBetween(700, 2_200);
        }
        return undefined;
      }
      if (
        now > (brain.targetLockedUntil ?? 0) &&
        this.botTargetPressure(monster.id, bot.id) >= 3 &&
        this.distance(bot.position, monster.position) > this.botPreferredCombatRange(bot, monster) + 80 &&
        Math.random() < 0.22
      ) {
        brain.targetId = undefined;
        return undefined;
      }
      return monster;
    }

    const player = this.players.get(brain.targetId);
    if (!player || player.id === bot.id || player.hp <= 0 || player.downed || this.distance(bot.position, player.position) > BOT_PVP_SCAN_RANGE * 1.2) {
      brain.targetId = undefined;
      brain.forcePkTargetId = undefined;
      if (player && player.hp <= 0 && Math.random() < 0.32) {
        brain.chillUntil = now + this.randomBetween(1_600, 5_500);
      }
      return undefined;
    }
    if (!this.canDamagePlayer(bot, player, this.botShouldForcePk(bot, player, brain, now))) {
      brain.targetId = undefined;
      brain.forcePkTargetId = undefined;
      return undefined;
    }
    if ((brain.targetLockedUntil ?? 0) < now && this.isBotArenaFighter(bot, brain, now)) {
      const targetIsBot = this.botBrains.has(player.id);
      const targetPressure = this.botTargetPressure(player.id, bot.id);
      const botIsRanged = bot.classId === "archer" || bot.classId === "mage";
      const targetCap = targetIsBot
        ? botIsRanged
          ? BOT_ARENA_BOT_TARGET_RANGED_CAP
          : BOT_ARENA_BOT_TARGET_MELEE_CAP
        : botIsRanged
          ? BOT_ARENA_HUMAN_TARGET_RANGED_CAP
          : BOT_ARENA_HUMAN_TARGET_MELEE_CAP;
      const crowdedTarget = targetPressure >= targetCap;
      if (
        (targetIsBot && this.hasNearbyArenaHumanTarget(bot, brain, player.id, now)) ||
        (targetIsBot && crowdedTarget && Math.random() < 0.76) ||
        (!targetIsBot && crowdedTarget && Math.random() < 0.34)
      ) {
        brain.targetId = undefined;
        brain.forcePkTargetId = undefined;
        return undefined;
      }
    }
    return player;
  }

  private botTargetPressure(targetId: string, exceptBotId?: string): number {
    this.refreshBotTargetPressure();
    const count = this.botTargetPressureCache.get(targetId) ?? 0;
    if (exceptBotId && this.botBrains.get(exceptBotId)?.targetId === targetId && this.players.has(exceptBotId)) {
      return Math.max(0, count - 1);
    }
    return count;
  }

  private refreshBotTargetPressure(): void {
    if (this.botTargetPressureTick === this.tick) {
      return;
    }

    this.botTargetPressureTick = this.tick;
    this.botTargetPressureCache.clear();
    for (const [botId, brain] of this.botBrains.entries()) {
      if (brain.targetId && this.players.has(botId)) {
        this.botTargetPressureCache.set(brain.targetId, (this.botTargetPressureCache.get(brain.targetId) ?? 0) + 1);
      }
    }
  }

  private chooseBotTarget(bot: PlayerPrivateState, brain: BotBrain, now: number): MonsterState | PlayerPrivateState | undefined {
    const allyDefenseTarget = this.findBotAllyDefenseTarget(bot, now) ?? this.findBotAllyMonsterAssistTarget(bot);
    if (allyDefenseTarget) {
      brain.targetId = allyDefenseTarget.id;
      brain.forcePkTargetId = undefined;
      brain.targetLockedUntil = now + this.randomBetween(2_600, 7_500);
      return allyDefenseTarget;
    }

    const pvpTarget = this.findBotPvpTarget(bot, brain, now);
    if (pvpTarget) {
      brain.targetId = pvpTarget.id;
      if (this.isBotArenaFighter(bot, brain, now)) {
        brain.targetLockedUntil =
          now + (this.botBrains.has(pvpTarget.id) ? this.randomBetween(2_400, 5_200) : this.randomBetween(6_500, 12_500));
      } else {
        brain.targetLockedUntil = now + this.randomBetween(4_000, 12_000);
      }
      return pvpTarget;
    }

    if ((brain.arenaUntil ?? 0) > now) {
      return undefined;
    }

    const humanAssistTarget = this.findBotHumanMonsterAssistTarget(bot, brain, now);
    if (humanAssistTarget) {
      brain.targetId = humanAssistTarget.id;
      brain.forcePkTargetId = undefined;
      brain.targetLockedUntil = now + this.randomBetween(4_500, 10_500);
      const assisted = humanAssistTarget.targetId ? this.players.get(humanAssistTarget.targetId) : undefined;
      if (assisted && Math.random() < 0.08) {
        const monsterLabel = MONSTER_TUNING[humanAssistTarget.archetype].label;
        this.queueBotChat(
          bot,
          brain,
          this.randomBotLine(brain, BOT_HUMAN_ASSIST_CHAT_LINES).replace("{name}", assisted.name).replace("{monster}", monsterLabel),
          "local",
          false,
          900,
          3_800
        );
      }
      return humanAssistTarget;
    }

    const monsterTarget = this.findBotMonsterTarget(bot, brain);
    if (monsterTarget) {
      brain.targetId = monsterTarget.id;
      brain.forcePkTargetId = undefined;
      brain.targetLockedUntil = now + this.randomBetween(7_000, 18_000);
      return monsterTarget;
    }

    brain.targetId = undefined;
    brain.forcePkTargetId = undefined;
    return undefined;
  }

  private findBotPvpTarget(bot: PlayerPrivateState, brain: BotBrain, now: number): PlayerPrivateState | undefined {
    if (bot.zone === "safe" || bot.level < 3) {
      return undefined;
    }

    let best: PlayerPrivateState | undefined;
    let bestScore = Number.POSITIVE_INFINITY;
    const wantsPk = (brain.pkModeUntil ?? 0) > now;
    const arenaWantsFight = this.isBotArenaFighter(bot, brain, now);
    const scanRange = arenaWantsFight ? BOT_ARENA_PVP_SCAN_RANGE : BOT_PVP_SCAN_RANGE;
    const botIsRanged = bot.classId === "archer" || bot.classId === "mage";

    for (const candidate of this.players.values()) {
      if (candidate.id === bot.id || candidate.hp <= 0 || candidate.downed || candidate.zone === "safe") {
        continue;
      }
      if (this.isFriendlyPlayerRelation(bot, candidate)) {
        continue;
      }

      const distance = this.distance(bot.position, candidate.position);
      if (distance > scanRange) {
        continue;
      }

      const retaliate = this.hasRecentPlayerHit(candidate.id, bot.id, now);
      const candidateIsBot = this.botBrains.has(candidate.id);
      const arenaLevelOk = candidateIsBot ? bot.level >= candidate.level - 12 : bot.level >= candidate.level - 28;
      const arenaTarget = arenaWantsFight && this.isStarterArena(candidate.position) && arenaLevelOk && candidate.hp / candidate.maxHp > 0.24;
      const freeTarget = retaliate || arenaTarget || candidate.karma > 0 || this.isPvpFlagged(candidate, now) || this.areDueling(bot.id, candidate.id);
      const canPk = wantsPk && bot.level >= candidate.level - 8 && bot.hp / bot.maxHp > 0.38;
      if (!freeTarget && !canPk) {
        continue;
      }

      const forcePk = !freeTarget && canPk;
      if (!this.canDamagePlayer(bot, candidate, forcePk)) {
        continue;
      }

      const targetPressure = this.botTargetPressure(candidate.id, bot.id);
      if (arenaTarget) {
        const targetCap = candidateIsBot
          ? botIsRanged
            ? BOT_ARENA_BOT_TARGET_RANGED_CAP
            : BOT_ARENA_BOT_TARGET_MELEE_CAP
          : botIsRanged
            ? BOT_ARENA_HUMAN_TARGET_RANGED_CAP
            : BOT_ARENA_HUMAN_TARGET_MELEE_CAP;
        if (!retaliate && targetPressure >= targetCap) {
          continue;
        }
      }
      const crowdPenalty = targetPressure * (arenaTarget ? BOT_PVP_TARGET_CROWD_PENALTY : BOT_TARGET_CROWD_PENALTY * 0.5);
      const humanArenaBonus = arenaTarget && !candidateIsBot ? -940 : 0;
      const botArenaPenalty = arenaTarget && candidateIsBot ? (botIsRanged ? 220 : 380) : 0;
      const personalNoise = Math.sin((brain.index + 1) * 19.37 + candidate.id.length * 31.1 + this.tick * 0.011) * (arenaTarget ? 55 : 90);
      const score =
        distance +
        Math.max(0, candidate.level - bot.level) * 140 +
        crowdPenalty +
        botArenaPenalty +
        humanArenaBonus +
        personalNoise -
        (arenaTarget ? 440 : 0) -
        (candidate.karma > 0 ? 240 : 0) -
        (retaliate ? 420 : 0);
      if (score < bestScore) {
        best = candidate;
        bestScore = score;
        brain.forcePkTargetId = forcePk ? candidate.id : undefined;
      }
    }

    return best;
  }

  private findBotMonsterTarget(bot: PlayerPrivateState, brain: BotBrain): MonsterState | undefined {
    let best: MonsterState | undefined;
    let bestScore = Number.POSITIVE_INFINITY;
    const goal = this.botPreferredGround(bot, brain);

    for (const monster of this.monsters.values()) {
      if (monster.hp <= 0 || !this.botCanFightMonster(bot, monster)) {
        continue;
      }

      const distance = this.distance(bot.position, monster.position);
      const scanRange = bot.zone === "safe" ? BOT_MONSTER_SCAN_RANGE * 1.35 : BOT_MONSTER_SCAN_RANGE;
      if (distance > scanRange) {
        continue;
      }

      const levelGap = Math.abs(monster.level - bot.level);
      const groundDistance = this.distance(goal.position, monster.position);
      const busyPenalty = monster.targetId && monster.targetId !== bot.id ? 160 : 0;
      const crowdPenalty = this.botTargetPressure(monster.id, bot.id) * BOT_TARGET_CROWD_PENALTY;
      const monsterNoise = [...monster.id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
      const personalNoise = Math.sin((brain.index + 1) * 12.9898 + monsterNoise * 78.233 + this.tick * 0.013) * 95;
      const score = distance + levelGap * 105 + groundDistance * 0.14 + busyPenalty + crowdPenalty + personalNoise;
      if (score < bestScore) {
        best = monster;
        bestScore = score;
      }
    }

    return best;
  }

  private botCanFightMonster(bot: PlayerPrivateState, monster: MonsterState): boolean {
    if (monster.archetype === "boss") {
      return bot.level >= monster.level - 1;
    }
    if (monster.archetype === "dungeonboss") {
      return bot.level >= monster.level - 3;
    }
    if (monster.archetype === "miniboss") {
      return bot.level >= monster.level - 3;
    }
    return monster.level <= bot.level + 4 && monster.level >= bot.level - 9;
  }

  private driveBotToTarget(bot: PlayerPrivateState, brain: BotBrain, target: MonsterState | PlayerPrivateState, now: number): void {
    const distance = this.distance(bot.position, target.position);
    const preferredRange = this.botPreferredCombatRange(bot, target);
    const direction = this.normalize({ x: target.position.x - bot.position.x, y: target.position.y - bot.position.y });
    const movement = this.botCombatMovement(bot, brain, target, direction, distance, preferredRange, now);
    const targetPressure = this.botTargetPressure(target.id, bot.id);
    const crowdedEngage = "classId" in target && targetPressure >= (this.botBrains.has(target.id) ? 1 : 3);
    const rangedBot = bot.classId === "archer" || bot.classId === "mage";
    const sprintChance = rangedBot ? (crowdedEngage ? 0.05 : 0.18) : crowdedEngage ? 0.1 : 0.36;
    const sprint = distance > preferredRange + (rangedBot ? 340 : 280) && bot.hp / bot.maxHp > 0.5 && Math.random() < sprintChance;
    const dash = !crowdedEngage && this.botShouldDash(bot, brain, now, distance, "combat");

    this.setBotInput(bot, movement, target.position, sprint, bot.classId === "tank" && bot.hp / bot.maxHp < 0.58, dash);

    if ("classId" in target && !this.canDamagePlayer(bot, target, this.botShouldForcePk(bot, target, brain, now))) {
      brain.targetId = undefined;
      brain.forcePkTargetId = undefined;
      return;
    }

    this.tryBotSkill(bot, brain, target, now);
    this.tryBotAttack(bot, brain, target, now);
  }

  private botCombatThinkDelay(bot: PlayerPrivateState, target: MonsterState | PlayerPrivateState, now: number): number {
    const distance = this.distance(bot.position, target.position);
    const attackRange = CLASS_DEFINITIONS[bot.classId].attackRange + this.rangeGrace(bot, "attack") + this.hitRadius(target);
    if (distance <= attackRange) {
      const untilAttack = Math.max(0, this.attackCooldownMs(bot) - (now - bot.lastAttackAt));
      const delay = untilAttack <= 35 ? this.randomBetween(BOT_COMBAT_THINK_MIN_MS, BOT_COMBAT_THINK_MIN_MS + 70) : untilAttack + this.randomBetween(8, 38);
      return Math.round(Math.min(720, Math.max(BOT_COMBAT_THINK_MIN_MS, delay)));
    }

    const preferredRange = this.botPreferredCombatRange(bot, target);
    if (distance > preferredRange + 160) {
      return this.randomBetween(190, 360);
    }

    const targetPressure = "classId" in target ? this.botTargetPressure(target.id, bot.id) : 0;
    const crowdDelay = targetPressure >= 3 ? 120 : targetPressure >= 1 ? 60 : 0;
    return this.randomBetween(BOT_COMBAT_THINK_MIN_MS + crowdDelay, BOT_COMBAT_THINK_MAX_MS + crowdDelay);
  }

  private botCombatMovement(
    bot: PlayerPrivateState,
    brain: BotBrain,
    target: MonsterState | PlayerPrivateState,
    direction: Vector2,
    distance: number,
    preferredRange: number,
    now: number
  ): Vector2 {
    if ((brain.chillUntil ?? 0) > now) {
      return { x: 0, y: 0 };
    }

    const isRanged = bot.classId === "archer" || bot.classId === "mage";
    if (!isRanged) {
      return this.botMeleeCombatMovement(bot, brain, target, direction, distance, preferredRange);
    }

    if (now >= brain.strafeUntil) {
      brain.strafeDirection = Math.random() < 0.5 ? -1 : 1;
      brain.strafeUntil = now + this.randomBetween(4_000, 11_000);
    }

    const perpendicular = {
      x: -direction.y * brain.strafeDirection,
      y: direction.x * brain.strafeDirection
    };
    const separation = this.botSeparationVector(bot, target.id, BOT_RANGED_SEPARATION_RADIUS);
    const mixSeparation = (base: Vector2, weight = 1.05): Vector2 => {
      const combined = {
        x: base.x + separation.x * weight,
        y: base.y + separation.y * weight
      };
      const normalized = this.normalize(combined);
      return normalized.x !== 0 || normalized.y !== 0 ? normalized : base;
    };

    if (distance > preferredRange + 90) {
      return mixSeparation(this.normalize({
        x: direction.x * 0.96 + perpendicular.x * 0.05,
        y: direction.y * 0.96 + perpendicular.y * 0.05
      }), 0.72);
    }

    if (distance < preferredRange * 0.56) {
      return mixSeparation(this.normalize({
        x: -direction.x * 0.28 + perpendicular.x * 0.26,
        y: -direction.y * 0.28 + perpendicular.y * 0.26
      }), 1.1);
    }

    if (Math.random() < 0.68) {
      if (separation.x !== 0 || separation.y !== 0) {
        return separation;
      }
      return { x: 0, y: 0 };
    }

    return mixSeparation(this.normalize({
      x: perpendicular.x * 0.28 + direction.x * 0.04,
      y: perpendicular.y * 0.28 + direction.y * 0.04
    }), 1.18);
  }

  private botMeleeCombatMovement(
    bot: PlayerPrivateState,
    brain: BotBrain,
    target: MonsterState | PlayerPrivateState,
    direction: Vector2,
    distance: number,
    preferredRange: number
  ): Vector2 {
    const pressure = this.botTargetPressure(target.id, bot.id);
    const slotRadius = preferredRange + Math.min(44, pressure * 12) + (brain.index % 3) * 6;
    const slotAngle = this.botEngageAngle(bot, brain, target, pressure);
    const slot = {
      x: target.position.x + Math.cos(slotAngle) * slotRadius,
      y: target.position.y + Math.sin(slotAngle) * slotRadius
    };
    const slotDistance = this.distance(bot.position, slot);
    const slotDirection = this.normalize({ x: slot.x - bot.position.x, y: slot.y - bot.position.y });
    const separation = this.botSeparationVector(bot, target.id, BOT_MELEE_SEPARATION_RADIUS);
    const attackRange = CLASS_DEFINITIONS[bot.classId].attackRange + this.rangeGrace(bot, "attack") + this.hitRadius(target);
    if (distance <= attackRange * 0.96) {
      if (pressure <= 2 || distance >= preferredRange * 0.72 || (separation.x === 0 && separation.y === 0)) {
        return { x: 0, y: 0 };
      }
      return separation;
    }

    let base: Vector2 = { x: 0, y: 0 };
    if (distance > preferredRange + 72) {
      base = this.normalize({
        x: direction.x * 0.9 + slotDirection.x * (pressure > 0 ? 0.45 : 0.18),
        y: direction.y * 0.9 + slotDirection.y * (pressure > 0 ? 0.45 : 0.18)
      });
    } else if (slotDistance > 42 && pressure > 0) {
      base = slotDirection;
    } else if (distance < preferredRange * 0.44) {
      base = { x: -direction.x, y: -direction.y };
    }

    const combined = {
      x: base.x + separation.x * 0.9,
      y: base.y + separation.y * 0.9
    };
    const normalized = this.normalize(combined);
    return normalized.x !== 0 || normalized.y !== 0 ? normalized : base;
  }

  private botEngageAngle(bot: PlayerPrivateState, brain: BotBrain, target: MonsterState | PlayerPrivateState, pressure: number): number {
    const slotCount = Math.max(3, Math.min(8, pressure + 2));
    const slotIndex = brain.index % slotCount;
    const targetSeed = this.stableUnit(`target:${target.id}`);
    const botSeed = this.stableUnit(`bot:${bot.id}:${target.id}`);
    return targetSeed * Math.PI * 2 + ((slotIndex + botSeed * 0.45) / slotCount) * Math.PI * 2;
  }

  private botSeparationVector(bot: PlayerPrivateState, targetId?: string, radius = BOT_MELEE_SEPARATION_RADIUS): Vector2 {
    let x = 0;
    let y = 0;
    for (const other of this.players.values()) {
      if (other.id === bot.id || other.id === targetId || other.hp <= 0 || other.downed || !this.botBrains.has(other.id)) {
        continue;
      }

      const distance = this.distance(bot.position, other.position);
      if (distance <= 0.001 || distance > radius) {
        continue;
      }

      const sameTarget = this.botBrains.get(other.id)?.targetId === targetId;
      const strength = ((radius - distance) / radius) * (sameTarget ? 1.45 : 0.82);
      x += ((bot.position.x - other.position.x) / distance) * strength;
      y += ((bot.position.y - other.position.y) / distance) * strength;
    }

    return this.normalize({ x, y });
  }

  private botShouldDash(bot: PlayerPrivateState, brain: BotBrain, now: number, distance: number, reason: "combat" | "travel" | "escape"): boolean {
    if ((brain.dashUntil ?? 0) > now) {
      return true;
    }

    if (now < brain.nextDashAt || bot.hp <= 0 || bot.downed) {
      return false;
    }

    const assassin = bot.classId === "assassin";
    const ranged = bot.classId === "archer" || bot.classId === "mage";
    const wantsEscape = reason === "escape" && bot.hp / bot.maxHp < 0.24 && distance > 520;
    const wantsGapClose =
      reason === "combat" &&
      distance > (assassin ? 780 : ranged ? 980 : 840) &&
      Math.random() < (assassin ? 0.1 : ranged ? 0.055 : 0.16);
    const wantsTravelBurst = reason === "travel" && distance > 3800 && Math.random() < (assassin ? 0.0009 : ranged ? 0.00045 : 0.0016);
    if (!wantsGapClose && !wantsEscape && !wantsTravelBurst) {
      brain.nextDashAt = now + this.randomBetween(ranged ? 30_000 : 22_000, ranged ? 78_000 : 62_000);
      return false;
    }

    brain.dashUntil = now + this.randomBetween(90, assassin ? 130 : ranged ? 145 : 190);
    brain.nextDashAt = now + this.randomBetween(assassin ? 80_000 : ranged ? 74_000 : 48_000, assassin ? 150_000 : ranged ? 140_000 : 105_000);
    return true;
  }

  private botPreferredCombatRange(bot: PlayerPrivateState, target: MonsterState | PlayerPrivateState): number {
    const hitRadius = this.hitRadius(target);
    if (bot.classId === "archer") {
      return Math.max(170, CLASS_DEFINITIONS.archer.attackRange * 0.72 + hitRadius);
    }
    if (bot.classId === "mage") {
      return Math.max(145, CLASS_DEFINITIONS.mage.attackRange * 0.68 + hitRadius);
    }
    if (bot.classId === "warrior") {
      return 64 + hitRadius * 0.45;
    }
    if (bot.classId === "tank") {
      return 58 + hitRadius * 0.45;
    }
    return 54 + hitRadius * 0.35;
  }

  private tryBotSkill(bot: PlayerPrivateState, brain: BotBrain, target: MonsterState | PlayerPrivateState, now: number): void {
    if (now < brain.nextSkillAt) {
      return;
    }

    const skills = CLASS_DEFINITIONS[bot.classId].skills
      .filter((skill) => !skill.heal && bot.level >= (skill.requiredLevel ?? 1) && bot.mp >= skill.manaCost && now >= (bot.skillCooldowns.get(skill.id) ?? 0))
      .sort((a, b) => (b.requiredLevel ?? 1) - (a.requiredLevel ?? 1));
    if (skills.length === 0) {
      brain.nextSkillAt = now + this.randomBetween(1_200, 4_500);
      return;
    }

    const distanceToTarget = this.distance(bot.position, target.position);
    const usableSkills = skills.filter((skill) => {
      if (!skill.dashDistance) {
        return true;
      }
      if (bot.classId === "assassin" && skill.id === "shadow-step") {
        return distanceToTarget > 240 && distanceToTarget < skill.range + skill.dashDistance * 0.78 && Math.random() < 0.045;
      }
      return distanceToTarget > 240 && Math.random() < 0.12;
    });
    const skill = usableSkills[(brain.index + this.tick) % Math.min(2, usableSkills.length)] ?? usableSkills[0];
    if (!skill) {
      brain.nextSkillAt = now + this.randomBetween(1_500, 5_500);
      return;
    }
    const range = skill.range + this.rangeGrace(bot, "skill") + this.hitRadius(target);
    if (distanceToTarget > range + (skill.dashDistance ?? 0)) {
      brain.nextSkillAt = now + this.randomBetween(900, 3_200);
      return;
    }

    this.skill(bot.id, {
      skillId: skill.id,
      aim: target.position,
      targetId: target.id,
      forcePk: "classId" in target ? this.botShouldForcePk(bot, target, brain, now) : undefined
    });
    brain.nextSkillAt = now + this.randomBetween(skill.dashDistance ? 18_000 : 2_500, skill.dashDistance ? 46_000 : 8_500);
  }

  private tryBotAttack(bot: PlayerPrivateState, brain: BotBrain, target: MonsterState | PlayerPrivateState, now: number): void {
    const range = CLASS_DEFINITIONS[bot.classId].attackRange + this.rangeGrace(bot, "attack") + this.hitRadius(target);
    if (this.distance(bot.position, target.position) > range || now - bot.lastAttackAt < this.attackCooldownMs(bot)) {
      return;
    }

    this.attack(bot.id, {
      aim: target.position,
      targetId: target.id,
      charge: bot.classId === "archer" ? 1 : undefined,
      forcePk: "classId" in target ? this.botShouldForcePk(bot, target, brain, now) : undefined
    });
  }

  private botShouldForcePk(bot: PlayerPrivateState, target: PlayerPrivateState, brain: BotBrain, now: number): boolean {
    if (this.isFriendlyPlayerRelation(bot, target)) {
      return false;
    }

    if (this.isStarterArena(bot.position) && this.isStarterArena(target.position)) {
      return false;
    }

    if (target.id === bot.id || this.areDueling(bot.id, target.id) || target.karma > 0 || this.isPvpFlagged(target, now) || this.hasRecentPlayerHit(target.id, bot.id, now)) {
      return false;
    }

    return brain.forcePkTargetId === target.id || (brain.pkModeUntil ?? 0) > now;
  }

  private tryBotUsePotion(bot: PlayerPrivateState): void {
    const potion = bot.inventory.find((item) => item.consumable?.hp && item.quantity > 0);
    if (potion) {
      this.useItem(bot.id, potion.id);
    }
  }

  private botTravelGoal(bot: PlayerPrivateState, brain: BotBrain, now: number): Vector2 {
    if ((brain.arenaUntil ?? 0) > now) {
      if (brain.roamTarget && this.isStarterArena(brain.roamTarget) && this.distance(bot.position, brain.roamTarget) > 120) {
        return brain.roamTarget;
      }
      if (brain.arenaAnchorAngle === undefined || now >= (brain.nextArenaShiftAt ?? 0)) {
        brain.arenaAnchorAngle = this.arenaRoamAngleForBot(bot, brain, now);
        brain.nextArenaShiftAt = now + this.randomBetween(22_000, 54_000);
      }
      const arenaTarget = this.randomArenaPoint(brain, brain.arenaMode === "watch", brain.arenaAnchorAngle);
      brain.roamTarget = arenaTarget;
      return arenaTarget;
    }

    this.maybeUpdateBotWorldGround(bot, brain, now);

    if (brain.roamTarget && this.distance(bot.position, brain.roamTarget) > 120) {
      return brain.roamTarget;
    }

    const ground = this.botPreferredGround(bot, brain);
    const dungeon = this.botGroundDungeon(ground);
    if (dungeon) {
      const roamTarget = this.randomDungeonInteriorPoint(dungeon);
      brain.roamTarget = roamTarget;
      brain.roamSeed = Math.random() * Math.PI * 2;
      return roamTarget;
    }
    const angle = (brain.roamSeed + Math.random() * Math.PI * 2 + this.tick * 0.0009) % (Math.PI * 2);
    const radius = 90 + Math.sqrt(Math.random()) * ground.radius;
    const roamTarget = this.pushOutOfSafeZone({
      x: ground.position.x + Math.cos(angle) * radius,
      y: ground.position.y + Math.sin(angle) * radius
    });
    brain.roamTarget = roamTarget;
    brain.roamSeed = angle + this.randomBetween(0.55, 2.4);
    return roamTarget;
  }

  private maybeUpdateBotWorldGround(bot: PlayerPrivateState, brain: BotBrain, now: number): void {
    if ((brain.arenaUntil ?? 0) > now || this.isStarterArena(bot.position) || brain.targetId || bot.hp <= 0 || bot.downed) {
      return;
    }

    if (now < (brain.nextWorldMoveAt ?? 0)) {
      return;
    }

    brain.nextWorldMoveAt = now + this.randomBetween(55_000, 180_000);
    const activityGroundIndex = this.botHumanActivityGroundIndex(bot, brain);
    const nextGroundIndex = activityGroundIndex ?? (Math.random() < 0.78 ? this.botWanderingGroundIndex(bot, brain) : undefined);
    if (nextGroundIndex === undefined) {
      return;
    }

    if (nextGroundIndex !== brain.groundIndex) {
      brain.groundIndex = nextGroundIndex;
      brain.roamTarget = undefined;
    }

    const ground = BOT_HUNTING_GROUNDS[brain.groundIndex];
    if (!ground) {
      return;
    }

    const farFromGround = this.distance(bot.position, ground.position) > 5200;
    const humanNearBot = this.hasNearbyHumanPlayer(bot.position, 3200);
    const dungeon = this.botGroundDungeon(ground);
    const dungeonLandmark = dungeon ? WORLD_LANDMARKS.find((landmark) => landmark.id === dungeon.landmarkId) : undefined;
    const destinationPosition = dungeonLandmark?.position ?? ground.position;
    const destinationRadius = dungeonLandmark?.radius ?? ground.radius;
    const humanNearDestination = this.hasNearbyHumanPlayer(destinationPosition, destinationRadius + 3200);
    if (farFromGround && !humanNearBot && !humanNearDestination) {
      bot.position = this.randomGroundSpawnPoint(ground);
      bot.velocity = { x: 0, y: 0 };
      bot.input = this.emptyInput();
      bot.zone = this.zoneFor(bot.position);
      bot.lastSafePosition = this.nearestCityPosition(bot.position);
      return;
    }

    if (farFromGround && !brain.roamTarget) {
      brain.roamTarget = this.randomGroundSpawnPoint(ground);
    }
  }

  private botHumanActivityGroundIndex(bot: PlayerPrivateState, brain: BotBrain): number | undefined {
    let bestGroundIndex: number | undefined;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const player of this.players.values()) {
      if (player.id === bot.id || this.botBrains.has(player.id) || player.hp <= 0 || player.downed || player.zone === "safe" || this.isStarterArena(player.position)) {
        continue;
      }

      for (let groundIndex = 0; groundIndex < BOT_HUNTING_GROUNDS.length; groundIndex += 1) {
        const ground = BOT_HUNTING_GROUNDS[groundIndex];
        if (!ground || ground.level > bot.level + 7 || ground.level < Math.max(1, bot.level - 12)) {
          continue;
        }

        const playerDistance = this.distance(player.position, ground.position);
        if (playerDistance > ground.radius + 1900) {
          continue;
        }

        const score =
          playerDistance +
          Math.abs(ground.level - Math.max(1, bot.level - 1)) * 190 +
          Math.sin((brain.index + 1) * 17.17 + groundIndex * 5.31 + this.tick * 0.007) * 120 -
          (player.karma > 0 || this.isPvpFlagged(player) ? 420 : 0);
        if (score < bestScore) {
          bestScore = score;
          bestGroundIndex = groundIndex;
        }
      }
    }

    return bestGroundIndex;
  }

  private botWanderingGroundIndex(bot: PlayerPrivateState, brain: BotBrain): number | undefined {
    const eligible = BOT_HUNTING_GROUNDS
      .map((ground, groundIndex) => ({ ground, groundIndex }))
      .filter(({ ground }) => ground.level <= bot.level + 6 && ground.level >= Math.max(1, bot.level - 12));
    if (eligible.length === 0) {
      return undefined;
    }

    const offset = Math.floor(this.tick / 900);
    const dungeonEligible = eligible.filter(({ ground }) => Boolean(ground.dungeonId));
    if (dungeonEligible.length > 0 && (brain.index + brain.generation * 2 + offset) % 7 === 0) {
      return dungeonEligible[(brain.index * 5 + brain.generation + offset) % dungeonEligible.length]?.groundIndex;
    }
    return eligible[(brain.index * 11 + brain.generation * 5 + offset) % eligible.length]?.groundIndex;
  }

  private botGroundDungeon(ground?: { dungeonId?: string }): (typeof WORLD_DUNGEON_INTERIORS)[number] | undefined {
    if (!ground?.dungeonId) {
      return undefined;
    }
    return WORLD_DUNGEON_INTERIORS.find((dungeon) => dungeon.id === ground.dungeonId);
  }

  private randomDungeonInteriorPoint(dungeon: (typeof WORLD_DUNGEON_INTERIORS)[number]): Vector2 {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.sqrt(Math.random());
    return this.clampPosition(this.clampToDungeonInterior({
      x: dungeon.position.x + Math.cos(angle) * dungeon.width * 0.44 * radius,
      y: dungeon.position.y + Math.sin(angle) * dungeon.height * 0.44 * radius
    }, dungeon));
  }

  private botDungeonEntrancePoint(dungeon: (typeof WORLD_DUNGEON_INTERIORS)[number]): Vector2 {
    const landmark = WORLD_LANDMARKS.find((candidate) => candidate.id === dungeon.landmarkId);
    if (!landmark) {
      return { ...dungeon.start };
    }

    return this.pushOutOfWorldObstacles(this.clampPosition(this.dungeonEntrancePortalPosition(landmark)));
  }

  private dungeonEntrancePortalPosition(landmark: (typeof WORLD_LANDMARKS)[number]): Vector2 {
    return {
      x: landmark.position.x,
      y: landmark.position.y + DUNGEON_ENTRANCE_Y_OFFSET
    };
  }

  private randomGroundSpawnPoint(ground: { position: Vector2; radius: number; dungeonId?: string }): Vector2 {
    const dungeon = this.botGroundDungeon(ground);
    if (dungeon) {
      return this.randomDungeonInteriorPoint(dungeon);
    }

    const angle = Math.random() * Math.PI * 2;
    const radius = 220 + Math.sqrt(Math.random()) * ground.radius * 0.82;
    return this.monsterSpawnPosition({
      x: ground.position.x + Math.cos(angle) * radius,
      y: ground.position.y + Math.sin(angle) * radius
    });
  }

  private hasNearbyHumanPlayer(position: Vector2, range: number): boolean {
    for (const player of this.players.values()) {
      if (this.botBrains.has(player.id) || player.hp <= 0 || player.downed) {
        continue;
      }
      if (this.distance(position, player.position) <= range) {
        return true;
      }
    }
    return false;
  }

  private randomArenaPoint(brain: BotBrain, spectator = false, preferredAngle?: number): Vector2 {
    const sectorCount = spectator ? Math.max(4, WORLD_STARTER_ARENA_GATES.length) : 8;
    const sector = (brain.index + Math.floor(this.tick / 180) + (spectator ? 2 : 0)) % sectorCount;
    const sectorAngle = (sector / sectorCount) * Math.PI * 2;
    const anchorAngle = preferredAngle ?? sectorAngle;
    const spread = preferredAngle === undefined ? 0.42 : spectator ? 0.36 : 0.52;
    const angle = (anchorAngle + this.randomBetween(-spread, spread) + Math.sin(brain.roamSeed + this.tick * 0.009) * 0.16) % (Math.PI * 2);
    const minRadius = spectator ? STARTER_ARENA.innerRadius * 0.74 : STARTER_ARENA.innerRadius * 0.2;
    const maxRadius = spectator ? STARTER_ARENA.radius * 0.9 : STARTER_ARENA.innerRadius * 0.74;
    const radius = minRadius + Math.sqrt(Math.random()) * Math.max(80, maxRadius - minRadius);
    brain.roamSeed = angle + this.randomBetween(0.45, 2.1);
    return this.pushOutOfWorldObstacles(this.clampPosition({
      x: STARTER_ARENA.center.x + Math.cos(angle) * radius,
      y: STARTER_ARENA.center.y + Math.sin(angle) * radius
    }));
  }

  private arenaEntryAngleForBot(bot: PlayerPrivateState, brain: BotBrain, now: number): number {
    const sourceAngle = this.arenaAngleForPosition(bot.position);
    const humanAngle = this.arenaHumanActivityAngle();
    const preferOppositeHumanSide = humanAngle !== undefined && (brain.index + Math.floor(now / 45_000)) % 4 === 0;
    const anchorAngle = preferOppositeHumanSide ? humanAngle + Math.PI : sourceAngle;
    return this.leastCrowdedArenaGateAngle(anchorAngle, brain);
  }

  private arenaRoamAngleForBot(bot: PlayerPrivateState, brain: BotBrain, now: number): number {
    const humanAngle = this.arenaHumanActivityAngle();
    if (humanAngle !== undefined) {
      const offset = (brain.index + Math.floor(now / 30_000)) % 5;
      if (offset === 0 || offset === 3) {
        return this.leastCrowdedArenaGateAngle(humanAngle + Math.PI, brain);
      }
      if (offset === 1) {
        return this.leastCrowdedArenaGateAngle(humanAngle, brain);
      }
    }

    return this.leastCrowdedArenaGateAngle(brain.arenaAnchorAngle ?? this.arenaAngleForPosition(bot.position), brain);
  }

  private arenaTeleportArrivalPosition(sourcePosition: Vector2): Vector2 {
    const gateAngle = this.leastCrowdedArenaGateAngle(this.arenaAngleForPosition(sourcePosition));
    const angle = gateAngle + this.randomBetween(-0.24, 0.24);
    const radius = STARTER_ARENA.innerRadius * 0.62 + Math.sqrt(Math.random()) * STARTER_ARENA.innerRadius * 0.28;
    return this.pushOutOfWorldObstacles(this.clampPosition({
      x: STARTER_ARENA.center.x + Math.cos(angle) * radius,
      y: STARTER_ARENA.center.y + Math.sin(angle) * radius
    }));
  }

  private arenaAngleForPosition(position: Vector2): number {
    return Math.atan2(position.y - STARTER_ARENA.center.y, position.x - STARTER_ARENA.center.x);
  }

  private arenaHumanActivityAngle(): number | undefined {
    let x = 0;
    let y = 0;
    let count = 0;
    for (const player of this.players.values()) {
      if (this.botBrains.has(player.id) || player.hp <= 0 || player.downed || !this.isStarterArena(player.position)) {
        continue;
      }

      const angle = this.arenaAngleForPosition(player.position);
      x += Math.cos(angle);
      y += Math.sin(angle);
      count += 1;
    }

    if (count === 0 || Math.hypot(x, y) < 0.001) {
      return undefined;
    }

    return Math.atan2(y, x);
  }

  private leastCrowdedArenaGateAngle(anchorAngle: number, brain?: BotBrain): number {
    const seed = brain ? brain.index * 13.17 + brain.generation * 7.31 + this.tick * 0.013 : this.tick * 0.017;
    const selected = [...WORLD_STARTER_ARENA_GATES]
      .map((gate, index) => ({
        gate,
        score:
          this.angleDistance(gate.angle, anchorAngle) * 210 +
          this.arenaGateCrowdScore(gate.angle) * 360 +
          Math.sin(seed + index * 2.17) * 58
      }))
      .sort((a, b) => a.score - b.score)[0]?.gate;
    return selected?.angle ?? WORLD_STARTER_ARENA_GATES[0].angle;
  }

  private arenaGateCrowdScore(gateAngle: number): number {
    let score = 0;
    for (const player of this.players.values()) {
      if (player.hp <= 0 || player.downed || !this.isStarterArena(player.position)) {
        continue;
      }

      const distance = this.angleDistance(this.arenaAngleForPosition(player.position), gateAngle);
      if (distance > 1.16) {
        continue;
      }

      const isBot = this.botBrains.has(player.id);
      const weight = distance < 0.58 ? 1 : 0.45;
      score += weight * (isBot ? 0.72 : 1.18);
    }
    return score;
  }

  private botPreferredGround(bot: PlayerPrivateState, brain?: BotBrain): BotHuntingGround {
    const firstGround: BotHuntingGround = BOT_HUNTING_GROUNDS[0] ?? {
      id: "fallback",
      label: "Fallback",
      level: 1,
      position: { ...WORLD_BOUNDS.town },
      radius: 500,
      archetypes: []
    };
    const assigned = brain ? BOT_HUNTING_GROUNDS[brain.groundIndex] : undefined;
    if (assigned && assigned.level <= bot.level + 3 && assigned.level >= Math.max(1, bot.level - 4)) {
      return assigned;
    }

    const eligible = BOT_HUNTING_GROUNDS
      .map((ground, groundIndex) => ({ ground, groundIndex }))
      .filter(({ ground }) => ground.level <= bot.level + 3 && ground.level >= Math.max(1, bot.level - 4));
    if (eligible.length === 0) {
      return firstGround;
    }

    const preferred = eligible
      .map((entry) => ({ ...entry, score: Math.abs(entry.ground.level - Math.max(1, bot.level - 1)) + Math.random() * 1.8 }))
      .sort((a, b) => a.score - b.score)
      .slice(0, 3);
    const choice = preferred[Math.floor(Math.random() * preferred.length)] ?? eligible[eligible.length - 1] ?? eligible[0];
    if (brain && choice) {
      brain.groundIndex = choice.groundIndex;
    }
    return choice?.ground ?? firstGround;
  }

  private setBotInput(bot: PlayerPrivateState, movement: Vector2, aim: Vector2, sprint: boolean, block: boolean, dash = false): void {
    const normalizedMovement = this.normalize(movement);
    const obstacleAwareMovement = this.botObstacleAwareMovement(bot, normalizedMovement, aim);
    const smoothedMovement = this.smoothBotInputMovement(bot, obstacleAwareMovement, dash);
    const pace = dash ? BOT_DASH_MOVE_PACE : sprint ? BOT_SPRINT_MOVE_PACE : BOT_NORMAL_MOVE_PACE;
    const pacedMovement = {
      x: smoothedMovement.x * pace,
      y: smoothedMovement.y * pace
    };
    const facing = this.normalize({ x: aim.x - bot.position.x, y: aim.y - bot.position.y });
    bot.input = {
      movement: pacedMovement,
      aim,
      dash,
      boost: false,
      sprint: !dash && sprint,
      block,
      combo: false,
      seq: bot.input.seq + 1,
      sentAt: Date.now()
    };
    bot.lastProcessedSeq = bot.input.seq;
    bot.blocking = block;
    if (facing.x !== 0 || facing.y !== 0) {
      bot.facing = facing;
    }
  }

  private smoothBotInputMovement(bot: PlayerPrivateState, desired: Vector2, dash: boolean): Vector2 {
    const brain = this.botBrains.get(bot.id);
    if (!brain) {
      return desired;
    }

    const desiredLength = Math.hypot(desired.x, desired.y);
    if (desiredLength <= 0.001) {
      brain.lastMoveDirection = { x: 0, y: 0 };
      return { x: 0, y: 0 };
    }

    const desiredDirection = desiredLength > 1 ? { x: desired.x / desiredLength, y: desired.y / desiredLength } : desired;
    if (dash) {
      brain.lastMoveDirection = desiredDirection;
      return desiredDirection;
    }

    const previous = brain.lastMoveDirection;
    const previousLength = previous ? Math.hypot(previous.x, previous.y) : 0;
    if (!previous || previousLength <= 0.001) {
      brain.lastMoveDirection = desiredDirection;
      return desiredDirection;
    }

    const previousDirection = previousLength > 1 ? { x: previous.x / previousLength, y: previous.y / previousLength } : previous;
    const dot = previousDirection.x * desiredDirection.x + previousDirection.y * desiredDirection.y;
    const blend = dot < -0.25 ? 0.58 : dot < 0.25 ? 0.46 : 0.34;
    const mixed = this.normalize({
      x: previousDirection.x * (1 - blend) + desiredDirection.x * blend,
      y: previousDirection.y * (1 - blend) + desiredDirection.y * blend
    });
    const result = mixed.x !== 0 || mixed.y !== 0 ? mixed : desiredDirection;
    brain.lastMoveDirection = result;
    return result;
  }

  private botObstacleAwareMovement(bot: PlayerPrivateState, movement: Vector2, aim: Vector2): Vector2 {
    if (movement.x === 0 && movement.y === 0) {
      return movement;
    }

    const lookahead = [70, 150, 260];
    const currentObstacle = this.nearestBlockingWorldObstacle(bot.position, PLAYER_OBSTACLE_RADIUS + 10);
    const nextObstacle = lookahead
      .map((distance) =>
        this.nearestBlockingWorldObstacle({
          x: bot.position.x + movement.x * distance,
          y: bot.position.y + movement.y * distance
        }, PLAYER_OBSTACLE_RADIUS + 24)
      )
      .find((obstacle): obstacle is (typeof WORLD_OBSTACLES)[number] => Boolean(obstacle));
    const obstacle = currentObstacle ?? nextObstacle;
    if (!obstacle) {
      return movement;
    }

    if (this.shouldRouteBotThroughArenaGate(bot.position, aim, obstacle)) {
      const gate = this.nearestStarterArenaGatePoint(bot.position, aim);
      const toGate = this.normalize({ x: gate.x - bot.position.x, y: gate.y - bot.position.y });
      if (toGate.x !== 0 || toGate.y !== 0) {
        return toGate;
      }
    }

    const normal = this.worldObstaclePushNormal(bot.position, obstacle);
    const desired = this.normalize({ x: aim.x - bot.position.x, y: aim.y - bot.position.y });
    const tangentA = { x: -normal.y, y: normal.x };
    const tangentB = { x: normal.y, y: -normal.x };
    const dotA = tangentA.x * desired.x + tangentA.y * desired.y;
    const dotB = tangentB.x * desired.x + tangentB.y * desired.y;
    const tangent = dotA >= dotB ? tangentA : tangentB;
    const combined = this.normalize({
      x: movement.x * 0.18 + tangent.x * 0.92 + normal.x * 0.46,
      y: movement.y * 0.18 + tangent.y * 0.92 + normal.y * 0.46
    });
    return combined.x !== 0 || combined.y !== 0 ? combined : movement;
  }

  private shouldRouteBotThroughArenaGate(position: Vector2, aim: Vector2, obstacle: (typeof WORLD_OBSTACLES)[number]): boolean {
    if (obstacle.kind !== "arenaWall" && !this.isNearStarterArenaWall(position)) {
      return false;
    }

    return this.isStarterArena(position) !== this.isStarterArena(aim);
  }

  private nearestBlockingWorldObstacle(position: Vector2, margin: number): (typeof WORLD_OBSTACLES)[number] | undefined {
    let best: (typeof WORLD_OBSTACLES)[number] | undefined;
    let bestNormalized = Number.POSITIVE_INFINITY;
    for (const obstacle of WORLD_OBSTACLES) {
      const normalized = this.worldObstacleNormalized(position, obstacle, margin);
      if (normalized >= 1 || normalized >= bestNormalized) {
        continue;
      }
      best = obstacle;
      bestNormalized = normalized;
    }
    return best;
  }

  private worldObstacleNormalized(position: Vector2, obstacle: (typeof WORLD_OBSTACLES)[number], margin: number): number {
    const rotation = obstacle.rotation ?? 0;
    const cos = Math.cos(-rotation);
    const sin = Math.sin(-rotation);
    const dx = position.x - obstacle.position.x;
    const dy = position.y - obstacle.position.y;
    const localX = dx * cos - dy * sin;
    const localY = dx * sin + dy * cos;
    const radiusX = obstacle.radiusX + margin;
    const radiusY = obstacle.radiusY + margin;
    return (localX * localX) / (radiusX * radiusX) + (localY * localY) / (radiusY * radiusY);
  }

  private worldObstaclePushNormal(position: Vector2, obstacle: (typeof WORLD_OBSTACLES)[number]): Vector2 {
    const rotation = obstacle.rotation ?? 0;
    const cos = Math.cos(-rotation);
    const sin = Math.sin(-rotation);
    const dx = position.x - obstacle.position.x;
    const dy = position.y - obstacle.position.y;
    const localX = dx * cos - dy * sin;
    const localY = dx * sin + dy * cos;
    const radiusX = obstacle.radiusX + PLAYER_OBSTACLE_RADIUS;
    const radiusY = obstacle.radiusY + PLAYER_OBSTACLE_RADIUS;
    const length = Math.hypot(localX / radiusX, localY / radiusY);
    const localNormal = length > 0.001
      ? { x: localX / radiusX / length, y: localY / radiusY / length }
      : { x: 1, y: 0 };
    const worldCos = Math.cos(rotation);
    const worldSin = Math.sin(rotation);
    return this.normalize({
      x: localNormal.x * worldCos - localNormal.y * worldSin,
      y: localNormal.x * worldSin + localNormal.y * worldCos
    });
  }

  private nearestStarterArenaGatePoint(position: Vector2, target?: Vector2): Vector2 {
    const crossesWall = target ? this.isStarterArena(position) !== this.isStarterArena(target) : false;
    const currentAngle = Math.atan2(position.y - STARTER_ARENA.center.y, position.x - STARTER_ARENA.center.x);
    const targetAngle = target ? Math.atan2(target.y - STARTER_ARENA.center.y, target.x - STARTER_ARENA.center.x) : currentAngle;
    const gate = [...WORLD_STARTER_ARENA_GATES]
      .map((candidate) => ({
        candidate,
        score:
          this.angleDistance(candidate.angle, currentAngle) * (crossesWall ? 0.36 : 1) +
          this.angleDistance(candidate.angle, targetAngle) * (crossesWall ? 1.18 : 0.35) +
          this.arenaGateCrowdScore(candidate.angle) * (crossesWall ? 0.32 : 0.12)
      }))
      .sort((a, b) => a.score - b.score)[0]?.candidate ?? WORLD_STARTER_ARENA_GATES[0];
    return {
      x: STARTER_ARENA.center.x + Math.cos(gate.angle) * WORLD_STARTER_ARENA_WALL_RADIUS,
      y: STARTER_ARENA.center.y + Math.sin(gate.angle) * WORLD_STARTER_ARENA_WALL_RADIUS
    };
  }

  private angleDistance(a: number, b: number): number {
    let diff = a - b;
    while (diff <= -Math.PI) {
      diff += Math.PI * 2;
    }
    while (diff > Math.PI) {
      diff -= Math.PI * 2;
    }
    return Math.abs(diff);
  }

  private createMonster(
    id: string,
    archetype: MonsterArchetype,
    position: Vector2,
    level: number,
    spritePackId?: MonsterSpritePackId
  ): MonsterState {
    const maxHp = this.monsterMaxHp(archetype, level);
    return {
      id,
      archetype,
      spritePackId,
      position,
      velocity: { x: 0, y: 0 },
      hp: maxHp,
      maxHp,
      level
    };
  }

  private addMonsterPack(
    prefix: string,
    archetype: MonsterArchetype,
    origin: Vector2,
    count: number,
    level: number,
    radius: number,
    respawnRadius: number,
    spritePackId?: MonsterSpritePackId
  ): void {
    const adjustedCount = Math.max(1, Math.round(count * MONSTER_DENSITY));
    for (let index = 0; index < adjustedCount; index += 1) {
      const angle = index * 2.3999632297;
      const spread = Math.sqrt((index + 1) / adjustedCount) * radius;
      const position = this.clampPosition({
        x: origin.x + Math.cos(angle) * spread,
        y: origin.y + Math.sin(angle) * spread
      });
      this.addMonster(
        this.createMonster(`${prefix}-${index}`, archetype, this.monsterSpawnPosition(position), level + (index % 3), spritePackId),
        respawnRadius
      );
    }
  }

  private monsterSpawnPosition(position: Vector2): Vector2 {
    let result = this.pushOutOfRoadCorridor(position, ROAD_CLEAR_RADIUS);
    result = this.pushOutOfStarterArena(result);
    for (const city of CITY_DEFINITIONS) {
      const distance = this.distance(result, city.position);
      if (distance > city.safeRadius + 90) {
        continue;
      }

      const direction = distance > 0
        ? { x: (result.x - city.position.x) / distance, y: (result.y - city.position.y) / distance }
        : { x: 1, y: 0 };
      result = this.clampPosition({
        x: city.position.x + direction.x * (city.safeRadius + 150),
        y: city.position.y + direction.y * (city.safeRadius + 150)
      });
    }

    return this.pushOutOfStarterArena(this.pushOutOfRoadCorridor(result, ROAD_CLEAR_RADIUS));
  }

  private pushOutOfStarterArena(position: Vector2): Vector2 {
    const protectedRadius = STARTER_ARENA_MONSTER_SAFE_RADIUS;
    const distance = this.distance(position, STARTER_ARENA.center);
    if (distance >= protectedRadius) {
      return position;
    }

    const direction = distance > 0
      ? { x: (position.x - STARTER_ARENA.center.x) / distance, y: (position.y - STARTER_ARENA.center.y) / distance }
      : { x: 1, y: 0 };
    return this.clampPosition({
      x: STARTER_ARENA.center.x + direction.x * protectedRadius,
      y: STARTER_ARENA.center.y + direction.y * protectedRadius
    });
  }

  private randomChestPosition(id: string): Vector2 {
    const seed = [...id].reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 5), 0);
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const ground = BOT_HUNTING_GROUNDS[(seed + attempt * 7 + Math.floor(Math.random() * BOT_HUNTING_GROUNDS.length)) % BOT_HUNTING_GROUNDS.length];
      if (!ground) {
        break;
      }
      const angle = Math.random() * Math.PI * 2;
      const radius = 240 + Math.sqrt(Math.random()) * (ground.radius + 520);
      const candidate = this.pushOutOfSafeZone(this.pushOutOfRoadCorridor({
        x: ground.position.x + Math.cos(angle) * radius,
        y: ground.position.y + Math.sin(angle) * radius
      }, ROAD_CLEAR_RADIUS + 95));
      if (this.nearestRoad(candidate).distance > ROAD_CLEAR_RADIUS + 70) {
        return candidate;
      }
    }

    return this.pushOutOfSafeZone(this.pushOutOfRoadCorridor(this.randomPvpPoint(false), ROAD_CLEAR_RADIUS + 100));
  }

  private pushOutOfRoadCorridor(position: Vector2, clearRadius = ROAD_CLEAR_RADIUS): Vector2 {
    let result = this.clampPosition(position);
    for (let pass = 0; pass < 5; pass += 1) {
      const nearest = this.nearestRoad(result);
      if (nearest.distance >= clearRadius) {
        return result;
      }

      const side = nearest.side >= 0 ? 1 : -1;
      const pushDistance = clearRadius - nearest.distance + 45 + pass * 18;
      result = this.clampPosition({
        x: result.x + nearest.normal.x * side * pushDistance,
        y: result.y + nearest.normal.y * side * pushDistance
      });
    }

    return result;
  }

  private nearestRoad(position: Vector2): { distance: number; normal: Vector2; side: number } {
    let nearest = { distance: Number.POSITIVE_INFINITY, normal: { x: 0, y: 1 }, side: 1 };
    for (const route of WORLD_ROADS) {
      const road = route.points;
      for (let index = 0; index < road.length - 1; index += 1) {
        const start = road[index];
        const end = road[index + 1];
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const lengthSq = dx * dx + dy * dy;
        if (lengthSq <= 0) {
          continue;
        }

        const t = Math.max(0, Math.min(1, ((position.x - start.x) * dx + (position.y - start.y) * dy) / lengthSq));
        const projected = { x: start.x + dx * t, y: start.y + dy * t };
        const distance = this.distance(position, projected);
        if (distance < nearest.distance) {
          const length = Math.sqrt(lengthSq);
          const normal = { x: -dy / length, y: dx / length };
          const side = (position.x - projected.x) * normal.x + (position.y - projected.y) * normal.y;
          nearest = { distance, normal, side };
        }
      }
    }

    return nearest;
  }

  private isRoadProtectedPosition(position: Vector2): boolean {
    return this.nearestRoad(position).distance <= ROAD_PLAYER_SAFE_RADIUS;
  }

  private nextSpawnPoint(): Vector2 {
    const index = [...this.players.keys()].filter((playerId) => !this.botBrains.has(playerId)).length;
    const hub = STARTER_SAFE_SPAWN_POINTS[index % STARTER_SAFE_SPAWN_POINTS.length] ?? WORLD_BOUNDS.town;
    const angle = index * 2.3999632297 + Math.random() * 0.7;
    const radius = 44 + Math.sqrt((index % 9) + 1) * 28 + Math.random() * 44;
    let spawn = this.clampPosition({
      x: hub.x + Math.cos(angle) * radius,
      y: hub.y + Math.sin(angle) * radius
    });
    if (!this.isCitySafeProtectedPosition(spawn)) {
      spawn = this.nearestCityPosition(hub);
    }
    return this.pushOutOfWorldObstacles(spawn);
  }

  private addMonster(monster: MonsterState, respawnRadius: number): void {
    monster.position = this.monsterSpawnPosition(monster.position);
    this.monsters.set(monster.id, monster);
    this.monsterSpawns.set(monster.id, {
      origin: { ...monster.position },
      radius: respawnRadius
    });
    this.resetMonsterWander(monster);
  }

  private respawnPointFor(monster: MonsterState): Vector2 {
    const spawn = this.monsterSpawns.get(monster.id);
    if (!spawn) {
      return this.randomPvpPoint(monster.archetype === "boss");
    }

    if (monster.archetype === "boss") {
      return { ...spawn.origin };
    }

    const angle = Math.random() * Math.PI * 2;
    const radius = Math.sqrt(Math.random()) * spawn.radius;
    const candidate = {
      x: spawn.origin.x + Math.cos(angle) * radius,
      y: spawn.origin.y + Math.sin(angle) * radius
    };
    const dungeon = this.dungeonInteriorAt(spawn.origin);
    if (dungeon) {
      return this.clampPosition(this.clampToDungeonInterior(candidate, dungeon));
    }
    return this.monsterSpawnPosition(candidate);
  }

  private resetMonsterWander(monster: MonsterState, now = Date.now()): void {
    this.monsterWander.set(monster.id, {
      nextMoveAt: now + this.randomBetween(160, MONSTER_WANDER_MAX_PAUSE_MS),
      pauseUntil: now
    });
  }

  private updateMonsterWander(monster: MonsterState, dt: number, now: number): void {
    if (monster.archetype === "boss") {
      monster.velocity = { x: 0, y: 0 };
      return;
    }

    const spawn = this.monsterSpawns.get(monster.id);
    if (!spawn) {
      monster.velocity = { x: 0, y: 0 };
      return;
    }

    if (this.isCitySafeProtectedPosition(monster.position, MONSTER_SAFE_IDLE_BUFFER)) {
      if (this.isCitySafeProtectedPosition(monster.position, MONSTER_SAFE_MOVE_BUFFER)) {
        monster.position = this.pushOutOfSafeZone(monster.position);
      }
      const state = this.monsterWander.get(monster.id) ?? {
        nextMoveAt: now,
        pauseUntil: now
      };
      state.target = this.monsterSafeEscapeTarget(monster.position);
      state.nextMoveAt = now;
      state.pauseUntil = now + this.randomBetween(MONSTER_WANDER_MIN_MOVE_MS, MONSTER_WANDER_MAX_MOVE_MS);
      this.monsterWander.set(monster.id, state);
    }

    let state = this.monsterWander.get(monster.id);
    if (!state) {
      state = {
        nextMoveAt: now + this.randomBetween(0, MONSTER_WANDER_MAX_PAUSE_MS),
        pauseUntil: now
      };
      this.monsterWander.set(monster.id, state);
    }

    if (!state.target) {
      if (now < state.nextMoveAt) {
        monster.velocity = { x: 0, y: 0 };
        return;
      }

      state.target = this.monsterWanderTarget(monster, spawn);
      state.pauseUntil = now + this.randomBetween(MONSTER_WANDER_MIN_MOVE_MS, MONSTER_WANDER_MAX_MOVE_MS);
    }

    const distanceToTarget = this.distance(monster.position, state.target);
    if (distanceToTarget <= 10 || now >= state.pauseUntil) {
      state.target = undefined;
      state.nextMoveAt = now + this.randomBetween(MONSTER_WANDER_MIN_PAUSE_MS, MONSTER_WANDER_MAX_PAUSE_MS);
      monster.velocity = { x: 0, y: 0 };
      return;
    }

    const direction = this.normalize({
      x: state.target.x - monster.position.x,
      y: state.target.y - monster.position.y
    });
    const speed = this.monsterSpeed(monster) * MONSTER_WANDER_SPEED_MULTIPLIER;
    const previousPosition = monster.position;
    const moveDistance = Math.min(speed * dt, distanceToTarget);
    const desiredPosition = this.clampPosition({
      x: previousPosition.x + direction.x * moveDistance,
      y: previousPosition.y + direction.y * moveDistance
    });
    if (this.isCitySafeProtectedPosition(desiredPosition, MONSTER_SAFE_MOVE_BUFFER)) {
      state.target = this.monsterSafeEscapeTarget(previousPosition);
      state.nextMoveAt = now;
      state.pauseUntil = now + this.randomBetween(MONSTER_WANDER_MIN_MOVE_MS, MONSTER_WANDER_MAX_MOVE_MS);
      monster.velocity = { x: 0, y: 0 };
      return;
    }

    const nextPosition = this.pushOutOfStarterArena(this.pushOutOfSafeZone(desiredPosition));
    const movedDistance = this.distance(previousPosition, nextPosition);

    if (movedDistance <= 0.25) {
      state.target = undefined;
      state.nextMoveAt = now + this.randomBetween(MONSTER_WANDER_MIN_PAUSE_MS, MONSTER_WANDER_MAX_PAUSE_MS);
      monster.velocity = { x: 0, y: 0 };
      return;
    }

    monster.position = nextPosition;
    monster.velocity = {
      x: (nextPosition.x - previousPosition.x) / dt,
      y: (nextPosition.y - previousPosition.y) / dt
    };
  }

  private monsterWanderTarget(monster: MonsterState, spawn: MonsterSpawn): Vector2 {
    const wanderRadius = this.monsterWanderRadius(monster, spawn);
    const distanceFromOrigin = this.distance(monster.position, spawn.origin);
    if (distanceFromOrigin > wanderRadius + 90) {
      return this.monsterSpawnPosition(spawn.origin);
    }

    const angle = Math.random() * Math.PI * 2;
    const radius = 28 + Math.sqrt(Math.random()) * Math.max(24, wanderRadius - 28);
    return this.monsterSpawnPosition({
      x: spawn.origin.x + Math.cos(angle) * radius,
      y: spawn.origin.y + Math.sin(angle) * radius
    });
  }

  private monsterSafeEscapeTarget(position: Vector2): Vector2 {
    const city = this.nearestCityDefinition(position);
    const direction = this.normalize({
      x: position.x - city.position.x,
      y: position.y - city.position.y
    });
    const fallback = direction.x === 0 && direction.y === 0 ? { x: 1, y: 0 } : direction;
    const side = Math.random() < 0.5 ? 1 : -1;
    const tangent = { x: -fallback.y * side, y: fallback.x * side };
    const mixed = this.normalize({
      x: fallback.x * 0.82 + tangent.x * 0.34,
      y: fallback.y * 0.82 + tangent.y * 0.34
    });
    return this.clampPosition({
      x: city.position.x + mixed.x * (city.safeRadius + MONSTER_SAFE_IDLE_BUFFER + this.randomBetween(180, 360)),
      y: city.position.y + mixed.y * (city.safeRadius + MONSTER_SAFE_IDLE_BUFFER + this.randomBetween(180, 360))
    });
  }

  private monsterWanderRadius(monster: MonsterState, spawn: MonsterSpawn): number {
    const maxRadius = monster.level <= 3 ? 150 : 220;
    return Math.max(55, Math.min(maxRadius, spawn.radius * 0.7));
  }

  private randomBetween(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  private stableUnit(value: string): number {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) / 4294967295;
  }

  private randomLine(lines: string[]): string {
    return lines[Math.floor(Math.random() * lines.length)] ?? "...";
  }

  private randomBotLine(brain: BotBrain, lines: string[]): string {
    if (lines.length <= 1) {
      return this.randomLine(lines);
    }

    const recent = new Set([brain.lastChatText, ...(brain.recentChatTexts ?? [])].filter(Boolean));
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const line = this.randomLine(lines);
      if (!recent.has(line)) {
        return line;
      }
    }

    return lines.find((line) => !recent.has(line)) ?? lines.find((line) => line !== brain.lastChatText) ?? this.randomLine(lines);
  }

  private pushOutOfSafeZone(position: Vector2): Vector2 {
    let result = this.clampPosition(position);
    for (let pass = 0; pass < 6; pass += 1) {
      const city = CITY_DEFINITIONS.find((candidate) => this.distance(result, candidate.position) <= candidate.safeRadius + 140);
      if (!city) {
        return result;
      }

      const direction = this.normalize({
        x: result.x - city.position.x,
        y: result.y - city.position.y
      });
      const fallback = direction.x === 0 && direction.y === 0 ? { x: 1, y: 0 } : direction;
      result = this.clampPosition({
        x: city.position.x + fallback.x * (city.safeRadius + 180),
        y: city.position.y + fallback.y * (city.safeRadius + 180)
      });
    }

    return result;
  }

  private pushOutOfWorldObstacles(position: Vector2, margin = PLAYER_OBSTACLE_RADIUS): Vector2 {
    let result = this.clampPosition(position);

    for (let pass = 0; pass < 8; pass += 1) {
      let pushed = false;

      for (const obstacle of WORLD_OBSTACLES) {
        const rotation = obstacle.rotation ?? 0;
        const cos = Math.cos(-rotation);
        const sin = Math.sin(-rotation);
        const dx = result.x - obstacle.position.x;
        const dy = result.y - obstacle.position.y;
        const localX = dx * cos - dy * sin;
        const localY = dx * sin + dy * cos;
        const radiusX = obstacle.radiusX + margin;
        const radiusY = obstacle.radiusY + margin;
        const normalized = (localX * localX) / (radiusX * radiusX) + (localY * localY) / (radiusY * radiusY);

        if (normalized >= 1) {
          continue;
        }

        const directionLength = Math.hypot(localX / radiusX, localY / radiusY);
        const direction =
          directionLength > 0.001
            ? { x: localX / radiusX / directionLength, y: localY / radiusY / directionLength }
            : { x: 1, y: 0 };
        const pushedLocalX = direction.x * radiusX;
        const pushedLocalY = direction.y * radiusY;
        const worldCos = Math.cos(rotation);
        const worldSin = Math.sin(rotation);
        result = this.clampPosition({
          x: obstacle.position.x + pushedLocalX * worldCos - pushedLocalY * worldSin,
          y: obstacle.position.y + pushedLocalX * worldSin + pushedLocalY * worldCos
        });
        pushed = true;
        break;
      }

      if (!pushed) {
        return result;
      }
    }

    return result;
  }

  private randomPvpPoint(boss: boolean): Vector2 {
    if (boss) {
      const zones = [
        { x: 10800, y: 6500, width: 1750, height: 1500 },
        { x: 35000, y: 17600, width: 3200, height: 2300 },
        { x: 39400, y: 25200, width: 3400, height: 2800 }
      ];
      const zone = zones[Math.floor(Math.random() * zones.length)];
      return { x: zone.x + Math.random() * zone.width, y: zone.y + Math.random() * zone.height };
    }

    return {
      x: 1700 + Math.random() * (WORLD_BOUNDS.width - 2600),
      y: 650 + Math.random() * (WORLD_BOUNDS.height - 1600)
    };
  }

  private systemChat(text: string, broadcast = false): void {
    this.pushChat({
      id: this.createId("chat"),
      at: Date.now(),
      playerId: "system",
      playerName: "System",
      channel: "system",
      text
    }, broadcast);
  }

  private lootOwnerSystemChat(ownerId: string | undefined, text: string): void {
    const owner = ownerId ? this.players.get(ownerId) : undefined;
    if (owner) {
      this.ownerSystemChat(owner, text);
    }
  }

  private lootSystemChat(player: PlayerPrivateState, text: string): void {
    if (this.botBrains.has(player.id)) {
      return;
    }
    this.ownerSystemChat(player, text);
  }

  private ownerSystemChat(player: PlayerPrivateState, text: string): void {
    if (this.botBrains.has(player.id) || this.singerNpcIds.has(player.id)) {
      return;
    }
    this.pushChat({
      id: this.createId("chat"),
      at: Date.now(),
      playerId: "system",
      playerName: "System",
      channel: "system",
      recipientId: player.id,
      text
    }, true);
  }

  private queueMarketNotice(player: PlayerPrivateState, text: string): void {
    if (this.botBrains.has(player.id) || this.singerNpcIds.has(player.id)) {
      return;
    }

    const notice = text.startsWith("Market:") ? text : `Market: ${text}`;
    if (player.offlineMarketSeller) {
      player.pendingMarketNotices = [...(player.pendingMarketNotices ?? []), notice].slice(-20);
      return;
    }

    this.ownerSystemChat(player, notice);
  }

  private findOfflineMarketSeller(characterId: string): PlayerPrivateState | undefined {
    return [...this.players.values()].find((player) => player.characterId === characterId && player.offlineMarketSeller);
  }

  private keepOfflineMarketSeller(player: PlayerPrivateState): boolean {
    return Boolean(
      !this.botBrains.has(player.id) &&
        !this.singerNpcIds.has(player.id) &&
        player.marketVendor?.playerOwned &&
        player.marketVendor.items.length > 0 &&
        player.hp > 0 &&
        !player.downed &&
        this.isPlayerAtMarket(player)
    );
  }

  private prepareOfflineMarketSeller(player: PlayerPrivateState): void {
    const market = this.marketCityDefinition();
    if (!this.isPlayerAtMarket(player)) {
      player.position = this.randomCityRespawnPosition(market);
    }
    player.offlineMarketSeller = true;
    player.sitting = true;
    player.velocity = { x: 0, y: 0 };
    player.input = this.emptyInput();
    player.zone = "safe";
    player.lastSafePosition = { ...market.position };
    player.blocking = false;
    player.pvpFlagUntil = undefined;
  }

  private pushChat(message: ChatMessage, broadcast = false): void {
    this.chatMessages.push(message);
    if (this.chatMessages.length > 200) {
      this.chatMessages.splice(0, this.chatMessages.length - 200);
    }
    if (broadcast) {
      this.pendingBroadcastChats.push(message);
      if (this.pendingBroadcastChats.length > 40) {
        this.pendingBroadcastChats.splice(0, this.pendingBroadcastChats.length - 40);
      }
    }
  }

  private loadCharacters(): void {
    try {
      const raw = readFileSync(this.savePath, "utf8");
      const parsed = JSON.parse(raw) as PersistedCharacter[];
      for (const character of parsed) {
        if (character.characterId) {
          this.persistedCharacters.set(character.characterId, character);
        }
      }
    } catch {
      this.persistedCharacters.clear();
    }
  }

  private loadClans(): void {
    try {
      const raw = readFileSync(this.clansPath, "utf8");
      const parsed = JSON.parse(raw) as PersistedClan[];
      this.clans.clear();
      for (const clan of parsed) {
        const name = this.sanitizeClanName(clan.name);
        if (!clan.id || name.length < 3 || !clan.leaderCharacterId || !Array.isArray(clan.members)) {
          continue;
        }
        const members = clan.members
          .filter((member) => member.characterId && member.name)
          .map((member) => ({
            characterId: member.characterId,
            name: this.sanitizeName(member.name),
            level: Math.max(1, Math.trunc(member.level || 1)),
            classId: member.classId,
            role: member.characterId === clan.leaderCharacterId ? "leader" as const : "member" as const,
            joinedAt: member.joinedAt || Date.now()
          }));
        if (members.length === 0) {
          continue;
        }
        this.clans.set(clan.id, {
          id: clan.id,
          name,
          tag: (clan.tag || this.clanTagFor(name)).slice(0, 4).toUpperCase(),
          emblem: this.validClanEmblem(clan.emblem),
          leaderCharacterId: clan.leaderCharacterId,
          leaderName: this.sanitizeName(clan.leaderName || members.find((member) => member.role === "leader")?.name || members[0]?.name || "Leader"),
          createdAt: clan.createdAt || Date.now(),
          members
        });
      }
    } catch {
      this.clans.clear();
    }
  }

  private saveClans(): void {
    this.writeJsonFile(this.clansPath, [...this.clans.values()]);
  }

  private loadModeration(): void {
    try {
      const raw = readFileSync(this.moderationPath, "utf8");
      const parsed = JSON.parse(raw) as PersistedModerationState;
      this.bannedCharacterIds.clear();
      this.bannedNames.clear();
      this.mutedCharacterUntil.clear();
      this.mutedNameUntil.clear();
      parsed.bannedCharacterIds?.forEach((id) => this.bannedCharacterIds.add(id));
      parsed.bannedNames?.forEach((name) => this.bannedNames.add(name));
      parsed.mutedCharacterUntil?.forEach(([id, until]) => {
        if (until > Date.now()) {
          this.mutedCharacterUntil.set(id, until);
        }
      });
      parsed.mutedNameUntil?.forEach(([name, until]) => {
        if (until > Date.now()) {
          this.mutedNameUntil.set(name, until);
        }
      });
    } catch {
      this.bannedCharacterIds.clear();
      this.bannedNames.clear();
      this.mutedCharacterUntil.clear();
      this.mutedNameUntil.clear();
    }
  }

  private saveModeration(): void {
    this.writeJsonFile(this.moderationPath, {
      bannedCharacterIds: [...this.bannedCharacterIds],
      bannedNames: [...this.bannedNames],
      mutedCharacterUntil: [...this.mutedCharacterUntil.entries()],
      mutedNameUntil: [...this.mutedNameUntil.entries()]
    } satisfies PersistedModerationState);
  }

  private loadFeedbackReports(): void {
    if (this.feedbackLoaded) {
      return;
    }

    this.feedbackLoaded = true;
    try {
      const raw = readFileSync(this.feedbackPath, "utf8");
      const parsed = JSON.parse(raw) as FeedbackReport[];
      this.feedbackReports.splice(0, this.feedbackReports.length, ...parsed.slice(0, 300));
    } catch {
      this.feedbackReports.splice(0);
    }
  }

  private saveFeedbackReports(): void {
    this.writeJsonFile(this.feedbackPath, this.feedbackReports);
  }

  private recentFeedbackReports(): FeedbackReport[] {
    this.loadFeedbackReports();
    return this.feedbackReports.slice(0, 20);
  }

  private saveCharacter(player: PlayerPrivateState): void {
    if (this.botBrains.has(player.id) || this.singerNpcIds.has(player.id)) {
      return;
    }

    if (player.clanId) {
      const clan = this.clans.get(player.clanId);
      const member = clan?.members.find((candidate) => candidate.characterId === player.characterId);
      if (member) {
        member.name = player.name;
        member.level = player.level;
        member.classId = player.classId;
        this.saveClans();
      }
    }

    const savedPosition = player.position;
    this.persistedCharacters.set(player.characterId, {
      characterId: player.characterId,
      name: player.name,
      classId: player.classId,
      race: player.race,
      face: player.face,
      customHeadUrl: player.customHeadUrl,
      level: player.level,
      xp: player.xp,
      gold: player.gold,
      karma: player.karma,
      pkCount: player.pkCount,
      pvpCount: player.pvpCount,
      monsterKills: player.monsterKills,
      clanId: player.clanId,
      arenaRating: player.arenaRating,
      arenaWins: player.arenaWins,
      arenaLosses: player.arenaLosses,
      arenaStreak: player.arenaStreak,
      arenaSeasonPoints: player.arenaSeasonPoints,
      storyQuestRewards: player.storyQuestRewards,
      hp: player.hp <= 0 || player.downed ? 0 : undefined,
      cp: player.hp <= 0 || player.downed ? player.cp : undefined,
      mp: player.hp <= 0 || player.downed ? player.mp : undefined,
      downed: player.hp <= 0 || player.downed ? true : undefined,
      revivableUntil: player.hp <= 0 || player.downed ? player.revivableUntil : undefined,
      deathReturnPosition: player.hp <= 0 || player.downed ? player.deathReturnPosition ?? this.deathReturnPositionFor(player) : undefined,
	      position: savedPosition,
	      inventory: player.inventory,
	      equipment: player.equipment,
	      marketListings: player.marketVendor?.playerOwned ? player.marketVendor.items : undefined,
	      marketVendorTitle: player.marketVendor?.playerOwned ? player.marketVendor.title : undefined,
	      marketVendorSinceAt: player.marketVendor?.playerOwned ? player.marketVendor.sinceAt : undefined,
	      marketNotices: player.pendingMarketNotices?.length ? player.pendingMarketNotices.slice(-20) : undefined,
	      wallet: player.wallet
	    });

    mkdirSync(dirname(this.savePath), { recursive: true });
    this.writeCharacters();
  }

  private writeCharacters(): void {
    this.writeJsonFile(this.savePath, [...this.persistedCharacters.values()]);
  }

  private writeJsonFile(filePath: string, value: unknown): void {
    mkdirSync(dirname(filePath), { recursive: true });
    const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
    try {
      writeFileSync(tempPath, JSON.stringify(value, null, 2));
      renameSync(tempPath, filePath);
    } catch (error) {
      rmSync(tempPath, { force: true });
      throw error;
    }
  }

  private nearestPlayer(position: Vector2, maxDistance: number, monsterId?: string): PlayerPrivateState | undefined {
    let best: PlayerPrivateState | undefined;
    let bestDistance = maxDistance;

    for (const player of this.players.values()) {
      if (player.hp <= 0 || player.zone === "safe") {
        continue;
      }
      if (this.isCitySafeProtectedPosition(player.position, MONSTER_SAFE_TARGET_BUFFER)) {
        continue;
      }
      if (this.isMonsterArenaProtectedPosition(player.position)) {
        continue;
      }
      if (this.isRoadProtectedPosition(player.position)) {
        continue;
      }
      if (monsterId && this.monsterThreatCount(player.id, monsterId) >= this.maxMonsterThreats(player)) {
        continue;
      }

      const distance = this.distance(position, player.position);
      if (distance < bestDistance) {
        best = player;
        bestDistance = distance;
      }
    }

    return best;
  }

  private monsterTarget(monster: MonsterState): PlayerPrivateState | undefined {
    const leash = this.monsterAggroRange(monster);
    const current = monster.targetId ? this.players.get(monster.targetId) : undefined;
    if (
      current &&
      current.hp > 0 &&
      current.zone !== "safe" &&
      !this.isCitySafeProtectedPosition(current.position, MONSTER_RETALIATE_SAFE_BUFFER) &&
      !this.isMonsterArenaProtectedPosition(current.position) &&
      this.distance(monster.position, current.position) <= leash * 1.35
    ) {
      return current;
    }

    return this.nearestPlayer(monster.position, leash, monster.id);
  }

  private monsterAggroRange(monster: MonsterState): number {
    const tuning = MONSTER_TUNING[monster.archetype];
    const levelBonus = monster.level <= 3 ? monster.level * 4 : monster.level * 8;
    return tuning.aggroRange + levelBonus;
  }

  private monsterThreatCount(playerId: string, ignoreMonsterId?: string): number {
    let count = 0;
    for (const monster of this.monsters.values()) {
      if (monster.id === ignoreMonsterId || monster.hp <= 0 || monster.targetId !== playerId) {
        continue;
      }
      count += 1;
    }
    return count;
  }

  private maxMonsterThreats(player: PlayerPrivateState): number {
    const base = player.level <= 2 ? 1 : player.level <= 5 ? 2 : player.level <= 12 ? 3 : 4;
    return player.classId === "tank" ? base + 1 : base;
  }

  private zoneFor(position: Vector2) {
    if (CITY_DEFINITIONS.some((city) => this.distance(position, city.position) <= city.safeRadius)) {
      return "safe" as const;
    }

    if (this.isStarterArena(position)) {
      return "pvp" as const;
    }

    if (WORLD_LANDMARKS.some((landmark) => landmark.zone === "boss" && this.distance(position, landmark.position) <= landmark.radius)) {
      return "boss" as const;
    }

    if (WORLD_DUNGEON_INTERIORS.some((dungeon) => this.isInsideDungeonInterior(position, dungeon))) {
      return "dungeon" as const;
    }

    if (WORLD_LANDMARKS.some((landmark) => landmark.zone === "dungeon" && this.distance(position, landmark.position) <= landmark.radius)) {
      return "dungeon" as const;
    }

    return "pvp" as const;
  }

  private marketCityDefinition(): (typeof CITY_DEFINITIONS)[number] {
    return CITY_DEFINITIONS.find((city) => city.id === MARKET_CITY_ID) ?? CITY_DEFINITIONS[0];
  }

  private isPlayerAtMarket(player: Pick<PlayerPrivateState, "position">): boolean {
    const market = this.marketCityDefinition();
    return this.distance(player.position, market.position) <= market.safeRadius + MARKET_PLAYER_LIST_RADIUS * 0.28;
  }

  private returnPlayerMarketListings(player: PlayerPrivateState): void {
    const vendor = player.marketVendor;
    if (!vendor?.playerOwned || vendor.items.length === 0) {
      return;
    }

    for (const listing of vendor.items) {
      this.addInventoryItem(player, this.cloneInventoryItem(listing.item, listing.quantity));
    }
    player.marketVendor = undefined;
    player.sitting = false;
  }

  private isInsideDungeonInterior(position: Vector2, dungeon: (typeof WORLD_DUNGEON_INTERIORS)[number]): boolean {
    const dx = (position.x - dungeon.position.x) / Math.max(1, dungeon.width * 0.56);
    const dy = (position.y - dungeon.position.y) / Math.max(1, dungeon.height * 0.56);
    return dx * dx + dy * dy <= 1.18;
  }

  private dungeonInteriorAt(position: Vector2): (typeof WORLD_DUNGEON_INTERIORS)[number] | undefined {
    return WORLD_DUNGEON_INTERIORS.find((dungeon) => this.isInsideDungeonInterior(position, dungeon));
  }

  private clampToDungeonInterior(position: Vector2, dungeon: (typeof WORLD_DUNGEON_INTERIORS)[number]): Vector2 {
    const radiusX = Math.max(1, dungeon.width * 0.56);
    const radiusY = Math.max(1, dungeon.height * 0.56);
    const dx = position.x - dungeon.position.x;
    const dy = position.y - dungeon.position.y;
    const normalized = (dx * dx) / (radiusX * radiusX) + (dy * dy) / (radiusY * radiusY);
    const maxNormalized = 1.14;
    if (normalized <= maxNormalized) {
      return position;
    }

    const scale = Math.sqrt(maxNormalized / Math.max(normalized, 0.0001));
    return {
      x: dungeon.position.x + dx * scale,
      y: dungeon.position.y + dy * scale
    };
  }

  private clampPlayerPosition(player: PlayerPrivateState, position: Vector2, options: { pushOutOfSafeZone?: boolean } = {}): Vector2 {
    let result = this.clampPosition(position);
    const activeDungeon = this.dungeonInteriorAt(player.position) ?? this.dungeonInteriorAt(result);
    if (activeDungeon) {
      return this.clampPosition(this.clampToDungeonInterior(result, activeDungeon));
    }

    if (options.pushOutOfSafeZone) {
      result = this.pushOutOfSafeZone(result);
    }
    return this.pushOutOfWorldObstacles(this.clampPosition(result));
  }

  private isCitySafeProtectedPosition(position: Vector2, buffer = 0): boolean {
    return CITY_DEFINITIONS.some((city) => this.distance(position, city.position) <= city.safeRadius + buffer);
  }

  private isStarterArena(position: Vector2): boolean {
    return this.distance(position, STARTER_ARENA.center) <= STARTER_ARENA.radius;
  }

  private isNearStarterArenaWall(position: Vector2): boolean {
    const distance = this.distance(position, STARTER_ARENA.center);
    return distance >= STARTER_ARENA.innerRadius * 0.92 && distance <= STARTER_ARENA.radius + 220;
  }

  private isMonsterArenaProtectedPosition(position: Vector2): boolean {
    return this.distance(position, STARTER_ARENA.center) <= STARTER_ARENA_MONSTER_SAFE_RADIUS;
  }

  private nearestCityPosition(position: Vector2): Vector2 {
    const city = this.nearestCityDefinition(position);
    return { ...city.position };
  }

  private randomCityRespawnPosition(city: (typeof CITY_DEFINITIONS)[number]): Vector2 {
    const angle = Math.random() * Math.PI * 2;
    const innerRadius = Math.max(140, city.safeRadius * 0.46);
    const outerRadius = Math.max(innerRadius + 90, city.safeRadius * 0.84);
    const radius = innerRadius + Math.sqrt(Math.random()) * (outerRadius - innerRadius);
    return this.pushOutOfWorldObstacles(this.clampPosition({
      x: city.position.x + Math.cos(angle) * radius,
      y: city.position.y + Math.sin(angle) * radius
    }));
  }

  private arenaRespawnPosition(deathPosition: Vector2 = { ...STARTER_ARENA.center }): Vector2 {
    const top = CITY_DEFINITIONS.find((candidate) => candidate.id === "greenhill") ?? this.nearestCityDefinition({ x: STARTER_ARENA.center.x, y: STARTER_ARENA.center.y - STARTER_ARENA.radius });
    const bottom = CITY_DEFINITIONS.find((candidate) => candidate.id === ARENA_RESPAWN_CITY_ID) ?? this.nearestCityDefinition({ x: STARTER_ARENA.center.x, y: STARTER_ARENA.center.y + STARTER_ARENA.radius });
    const right = this.arenaHubCity();
    const dx = deathPosition.x - STARTER_ARENA.center.x;
    const dy = deathPosition.y - STARTER_ARENA.center.y;
    const sectorSpot =
      dx > STARTER_ARENA.innerRadius * 0.22
        ? right
        : dy > STARTER_ARENA.innerRadius * 0.16
          ? bottom
          : dy < -STARTER_ARENA.innerRadius * 0.12
            ? top
            : undefined;
    const selected = [top, bottom, right]
      .map((city) => {
        const crowd = this.playerCrowdCount(city.position, city.safeRadius + 820);
        const botCrowd = this.playerCrowdCount(city.position, city.safeRadius + 820, "bot");
        const hubOverflow = city.id === BOT_ARENA_HUB_CITY_ID ? Math.max(0, crowd - BOT_ARENA_HUB_SOFT_CAP) : 0;
        const hubNeedsLife = city.id === BOT_ARENA_HUB_CITY_ID && botCrowd < BOT_ARENA_HUB_MIN_BOTS ? -720 : 0;
        return {
          city,
          score:
            this.distance(deathPosition, city.position) * 0.035 +
            crowd * 420 +
            botCrowd * 150 +
            hubOverflow * 620 +
            hubNeedsLife +
            (sectorSpot?.id === city.id ? -520 : 0) +
            Math.random() * 90
        };
      })
      .sort((a, b) => a.score - b.score)[0]?.city;
    return this.randomCityRespawnPosition(selected ?? bottom);
  }

  private deathReturnPositionFor(player: PlayerPrivateState): Vector2 {
    if (this.isStarterArena(player.position)) {
      return this.arenaRespawnPosition(player.position);
    }

    return this.randomCityRespawnPosition(this.nearestCityDefinition(player.lastSafePosition ?? player.position));
  }

  private publicPlayer(player: PlayerPrivateState): PlayerPublicState {
    const now = Date.now();
    this.clearExpiredPvpFlag(player, now);
    const clan = player.clanId ? this.clans.get(player.clanId) : undefined;
    const clanMember = clan?.members.find((member) => member.characterId === player.characterId);
    return {
      id: player.id,
      name: player.name,
      classId: player.classId,
      race: player.race,
      face: player.face,
      customHeadUrl: player.customHeadUrl,
      position: player.position,
      velocity: player.velocity,
      facing: player.facing,
      movementSpeed: player.stats.speed,
      dashStartedAt: (player.dashUntil ?? 0) > now ? player.dashStartedAt : undefined,
      dashUntil: (player.dashUntil ?? 0) > now ? player.dashUntil : undefined,
      dashDirection: (player.dashUntil ?? 0) > now ? player.dashDirection : undefined,
      weaponEnchantLevel: this.weaponEnchantLevel(player),
      equipmentVisual: this.equipmentVisual(player),
      hp: player.hp,
      maxHp: player.maxHp,
      cp: player.cp,
      maxCp: player.maxCp,
      mp: player.mp,
      maxMp: player.maxMp,
      level: player.level,
      xp: player.xp,
      gold: player.gold,
      karma: player.karma,
      pkCount: player.pkCount,
      pvpCount: player.pvpCount,
      monsterKills: player.monsterKills,
      arenaRating: player.arenaRating,
      arenaWins: player.arenaWins,
	      arenaLosses: player.arenaLosses,
	      arenaStreak: player.arenaStreak,
	      singing: player.singing,
	      sitting: player.sitting,
	      marketVendor: player.marketVendor,
	      pvpFlagUntil: this.isPvpFlagged(player, now) ? player.pvpFlagUntil : undefined,
      partyId: this.partyByPlayer.get(player.id),
      duelOpponentId: this.duelByPlayer.get(player.id),
      skillPoints: Math.max(0, player.level - 1),
      clanId: player.clanId,
      clanName: clan?.name,
      clanTag: clan?.tag,
      clanEmblem: clan?.emblem,
      clanRole: clanMember?.role,
      blocking: player.blocking,
      stunnedUntil: player.stunnedUntil,
      downed: player.downed,
      revivableUntil: player.revivableUntil,
      zone: player.zone,
      comboStage: player.comboStage,
      lastProcessedSeq: player.lastProcessedSeq
    };
  }

  private weaponEnchantLevel(player: PlayerPrivateState): number | undefined {
    const level = player.equipment.weapon?.enchantLevel ?? 0;
    return level > 0 ? level : undefined;
  }

  private equipmentVisual(player: PlayerPrivateState): PlayerPublicState["equipmentVisual"] {
    const armorEnchantLevel = Math.max(
      0,
      player.equipment.chest?.enchantLevel ?? 0,
      player.equipment.helmet?.enchantLevel ?? 0,
      player.equipment.gloves?.enchantLevel ?? 0,
      player.equipment.boots?.enchantLevel ?? 0
    );
    return {
      weapon: player.equipment.weapon?.appearance,
      weaponGrade: player.equipment.weapon?.grade,
      chest: player.equipment.chest?.appearance,
      chestGrade: player.equipment.chest?.grade,
      helmet: player.equipment.helmet?.appearance,
      helmetGrade: player.equipment.helmet?.grade,
      gloves: player.equipment.gloves?.appearance,
      glovesGrade: player.equipment.gloves?.grade,
      boots: player.equipment.boots?.appearance,
      bootsGrade: player.equipment.boots?.grade,
      armorEnchantLevel: armorEnchantLevel > 0 ? armorEnchantLevel : undefined
    };
  }

  private event(
    sourceId: string,
    targetId: string,
    amount: number,
    kind: CombatEvent["kind"],
    message: string,
    options: { skillId?: string; attackStyle?: MonsterAttackStyle } = {}
  ): void {
    this.recentEvents.push({
      id: this.createId("evt"),
      at: Date.now(),
      sourceId,
      targetId,
      amount,
      kind,
      skillId: options.skillId,
      attackStyle: options.attackStyle,
      message
    });

    if (this.recentEvents.length > 80) {
      this.recentEvents.splice(0, this.recentEvents.length - 80);
    }
  }

  private emptyInput(): PlayerInput {
    return {
      movement: { x: 0, y: 0 },
      aim: { x: WORLD_BOUNDS.town.x + 1, y: WORLD_BOUNDS.town.y },
      dash: false,
      jump: false,
      boost: false,
      sprint: false,
      block: false,
      combo: false,
      seq: 0,
      sentAt: Date.now()
    };
  }

  private normalize(vector: Vector2): Vector2 {
    const length = Math.hypot(vector.x, vector.y);
    if (length <= 0.0001) {
      return { x: 0, y: 0 };
    }

    return {
      x: vector.x / length,
      y: vector.y / length
    };
  }

  private directionToAim(player: PlayerPrivateState, aim: Vector2): Vector2 {
    const direction = this.normalize({
      x: aim.x - player.position.x,
      y: aim.y - player.position.y
    });
    if (direction.x === 0 && direction.y === 0) {
      return player.facing;
    }
    return direction;
  }

  private aimHitScore(
    source: PlayerPrivateState,
    target: MonsterState | PlayerPrivateState,
    direction: Vector2,
    castDistance: number,
    kind: "attack" | "skill",
    requestedTargetId?: string
  ): number | undefined {
    if (target.hp <= 0) {
      return undefined;
    }

    const toTarget = {
      x: target.position.x - source.position.x,
      y: target.position.y - source.position.y
    };
    const projection = toTarget.x * direction.x + toTarget.y * direction.y;
    const targetRadius = this.hitRadius(target);
    if (projection < -targetRadius || projection > castDistance + targetRadius) {
      return undefined;
    }

    const closestPoint = {
      x: source.position.x + direction.x * Math.min(castDistance, Math.max(0, projection)),
      y: source.position.y + direction.y * Math.min(castDistance, Math.max(0, projection))
    };
    const missDistance = this.distance(closestPoint, target.position);
    if (missDistance > targetRadius + this.attackPathRadius(source, kind)) {
      return undefined;
    }

    const requestedBias = requestedTargetId === target.id ? -2 : 0;
    return projection + missDistance * 4 + requestedBias;
  }

  private shotProjection(
    source: PlayerPrivateState,
    target: MonsterState | PlayerPrivateState,
    direction: Vector2,
    castDistance: number,
    kind: "attack" | "skill"
  ): number | undefined {
    if (target.hp <= 0) {
      return undefined;
    }

    const toTarget = {
      x: target.position.x - source.position.x,
      y: target.position.y - source.position.y
    };
    const projection = toTarget.x * direction.x + toTarget.y * direction.y;
    const targetRadius = this.hitRadius(target);
    if (projection < -targetRadius || projection > castDistance + targetRadius) {
      return undefined;
    }

    const closestPoint = {
      x: source.position.x + direction.x * Math.min(castDistance, Math.max(0, projection)),
      y: source.position.y + direction.y * Math.min(castDistance, Math.max(0, projection))
    };
    const missDistance = this.distance(closestPoint, target.position);
    const pathRadius = Math.max(this.attackPathRadius(source, kind), source.classId === "archer" ? 30 : 0);
    return missDistance <= targetRadius + pathRadius ? projection : undefined;
  }

  private hitRadius(target: MonsterState | PlayerPrivateState): number {
    if ("archetype" in target) {
      if (target.archetype === "boss") {
        return 42;
      }
      if (target.archetype === "dungeonboss") {
        return 42;
      }
      if (target.archetype === "miniboss") {
        return 40;
      }
      if (target.archetype === "sentinel" || target.archetype === "drake") {
        return 34;
      }
      if (target.archetype === "golem") {
        return 28;
      }
      if (target.archetype === "boar" || target.archetype === "bandit" || target.archetype === "skeleton" || target.archetype === "bonewarrior") {
        return 24;
      }
      if (target.archetype === "archer" || target.archetype === "mage" || target.archetype === "venomplant") {
        return 24;
      }
      if (target.archetype === "bat" || target.archetype === "firespirit") {
        return 22;
      }
      return 20;
    }

    return 21;
  }

  private attackPathRadius(player: PlayerPrivateState, kind: "attack" | "skill"): number {
    if (kind === "skill") {
      if (player.classId === "mage") {
        return 30;
      }
      if (player.classId === "warrior" || player.classId === "tank") {
        return 32;
      }
      if (player.classId === "assassin") {
        return 22;
      }
      return 8;
    }

    if (player.classId === "archer") {
      return 12;
    }
    if (player.classId === "mage") {
      return 26;
    }
    if (player.classId === "tank") {
      return 22;
    }
    if (player.classId === "warrior") {
      return 18;
    }
    return 14;
  }

  private targetedCommandGrace(player: PlayerPrivateState, kind: "attack" | "skill"): number {
    if (player.classId === "mage") {
      return kind === "attack" ? 58 : 42;
    }
    if (player.classId === "archer") {
      return kind === "attack" ? 42 : 38;
    }
    if (player.classId === "warrior" || player.classId === "tank") {
      return kind === "skill" ? 34 : 22;
    }
    if (player.classId === "assassin") {
      return kind === "skill" ? 32 : 22;
    }
    return 14;
  }

  private targetedLatencyGrace(player: PlayerPrivateState, kind: "attack" | "skill"): number {
    const velocity = player.velocity ?? { x: 0, y: 0 };
    const speed = Math.hypot(velocity.x, velocity.y);
    const base = kind === "skill" ? 14 : 8;
    const movingGrace = Math.min(kind === "skill" ? 42 : 30, speed * (kind === "skill" ? 0.14 : 0.1));
    return base + movingGrace;
  }

  private rangeGrace(player: PlayerPrivateState, kind: "attack" | "skill"): number {
    if (kind === "skill") {
      return player.classId === "mage" || player.classId === "archer" ? 42 : 18;
    }
    if (player.classId === "archer") {
      return 80;
    }
    if (player.classId === "mage") {
      return 68;
    }
    if (player.classId === "warrior") {
      return 38;
    }
    if (player.classId === "assassin") {
      return 24;
    }
    return 8;
  }

  private minimumCastDistance(player: PlayerPrivateState, kind: "attack" | "skill"): number {
    if (kind === "skill") {
      return player.classId === "mage" || player.classId === "archer" ? 160 : 70;
    }
    if (player.classId === "archer") {
      return 180;
    }
    if (player.classId === "mage") {
      return 140;
    }
    return 62;
  }

  private clampPosition(position: Vector2): Vector2 {
    return {
      x: Math.max(0, Math.min(WORLD_BOUNDS.width, position.x)),
      y: Math.max(0, Math.min(WORLD_BOUNDS.height, position.y))
    };
  }

  private distance(a: Vector2, b: Vector2): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  private distanceSq(a: Vector2, b: Vector2): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
  }

  private hasActivePlayerNear(position: Vector2, range: number): boolean {
    const rangeSq = range * range;
    for (const player of this.players.values()) {
      if (player.hp <= 0 || player.downed || player.zone === "safe") {
        continue;
      }
      if (this.distanceSq(position, player.position) <= rangeSq) {
        return true;
      }
    }
    return false;
  }

  private sanitizeName(name: string): string {
    const trimmed = name.trim().slice(0, 18);
    return trimmed.length > 0 ? trimmed : "Wanderer";
  }

  private nameKey(name: string): string {
    return this.sanitizeName(name).toLowerCase();
  }

  private playerMutedUntil(player: PlayerPrivateState): number {
    const byCharacter = this.mutedCharacterUntil.get(player.characterId) ?? 0;
    const byName = this.mutedNameUntil.get(this.nameKey(player.name)) ?? 0;
    const until = Math.max(byCharacter, byName);
    if (until > 0 && until <= Date.now()) {
      this.mutedCharacterUntil.delete(player.characterId);
      this.mutedNameUntil.delete(this.nameKey(player.name));
      return 0;
    }
    return until;
  }

  private sanitizeRace(race?: CharacterRace): CharacterRace {
    return race === "elf" || race === "darkelf" || race === "orc" ? race : "human";
  }

  private sanitizeFace(face?: number): number {
    return Math.max(1, Math.min(CHARACTER_FACE_VARIANT_COUNT, Math.trunc(face ?? 1)));
  }

  private sanitizeCustomHeadUrl(url?: string): string | undefined {
    const trimmed = url?.trim();
    if (!trimmed) {
      return undefined;
    }
    if (!/^\/uploads\/heads\/[a-zA-Z0-9_-]+\.png(?:\?v=\d+)?$/.test(trimmed)) {
      return undefined;
    }
    return trimmed.slice(0, 160);
  }

  private sanitizeCharacterId(characterId?: string): string | undefined {
    const sanitized = characterId?.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
    return sanitized || undefined;
  }

  private sanitizeChat(text: string): string {
    return text.replace(/\s+/g, " ").trim().slice(0, 160);
  }

  private sanitizeFeedback(text: string): string {
    return text.replace(/\s+/g, " ").trim().slice(0, 420);
  }

  private createId(prefix: string): string {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
  }
}
