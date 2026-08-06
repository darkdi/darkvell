import Phaser from "phaser";
import {
  CITY_MERCHANTS,
  CLASS_DEFINITIONS,
  CITY_DEFINITIONS,
  CITY_TELEPORTERS,
  WORLD_BOUNDS,
  WORLD_DUNGEON_INTERIORS,
  WORLD_HAZARDS,
  WORLD_LAKES,
  WORLD_LANDMARKS,
  WORLD_MAP_REGIONS,
  WORLD_MOUNTAINS,
  WORLD_OBSTACLES,
  WORLD_ROADS,
  WORLD_RIVERS,
  WORLD_SCENIC_DETAILS,
  WORLD_STARTER_ARENA,
  WORLD_STARTER_ARENA_GATE_HALF_ANGLE,
  WORLD_STARTER_ARENA_GATES,
  WORLD_STARTER_ARENA_WALL_RADIUS,
  WORLD_WATERFALLS,
  type ChatMessage,
  type GameSnapshot,
  type GroundItem,
  type MonsterArchetype,
  type MonsterAttackStyle,
  type MonsterState,
  type PlayerInput,
  type PlayerPublicState,
  type Vector2,
  type WorldBiomeKind,
  type WorldHazardDefinition,
  type WorldResource
} from "@mmo/shared";
import { translateBotChat } from "../botChatI18n";
import { translateText, type AppLanguage } from "../i18n";
import { RealtimeClient } from "./RealtimeClient";
import {
  monsterSpriteFrameCount,
  monsterSpriteFrameName,
  monsterSpriteSkinFor,
  monsterSpriteStateDurationMs,
  preloadMonsterSpriteAssets,
  requestMonsterSpriteAsset,
  type MonsterSpriteSkin,
  type MonsterSpriteState
} from "./monsterSpriteAssets";
import { defaultMobileGraphicsSettings, isMobileGameRuntime, normalizeMobileGraphicsSettings, type MobileGraphicsSettings } from "./performanceSettings";
import { touchDiag } from "./touchDiagnostics";
import {
  WORLD_FOLIAGE_ATLAS_KEY,
  preloadWorldFoliageAssets,
  worldFoliageFormForFrame,
  worldFoliagePaletteFor,
  type WorldFoliageForm
} from "./worldFoliageAssets";

interface PlayerView {
  body: Phaser.GameObjects.Image;
  customHead?: Phaser.GameObjects.Image;
  facing: Phaser.GameObjects.Arc;
  weapon: Phaser.GameObjects.Image;
  weaponGlow: Phaser.GameObjects.Image;
  weaponSmoke: Phaser.GameObjects.Arc[];
  feet: Phaser.GameObjects.Ellipse[];
  label: Phaser.GameObjects.Text;
  cp: Phaser.GameObjects.Rectangle;
  hp: Phaser.GameObjects.Rectangle;
  lastPosition: Vector2;
  serverPosition: Vector2;
  velocity: Vector2;
  positionHistory: NetworkPositionSample[];
  lastServerAt: number;
  lastSnapshotSeenAt: number;
  lastHp: number;
  wasDowned: boolean;
  bodyOnlyActive: boolean;
  visualFacing: Vector2;
  visualFacingAngle: number;
  lastFacingUpdateAt: number;
  visualMode: PlayerVisualMode;
  lastRemoteRenderAt: number;
  lastUiAt: number;
  lastLabelText: string;
  lastLabelColor: string;
  lastCpRatio: number;
  lastHpRatio: number;
  lastSingingNoteAt: number;
  lastDashStartedAt: number;
  lastAttackCueAt: number;
}

type PlayerVisualMode = "full" | "simple" | "hidden";

interface MonsterView {
  body: Phaser.GameObjects.Image;
  spriteSkin?: MonsterSpriteSkin;
  animationState?: MonsterSpriteState;
  animationStartedAt: number;
  lastAnimationFrame: string;
  lastAnimatedAttackCueAt: number;
  lastHitCueAt: number;
  diedAt: number;
  feet: Phaser.GameObjects.Ellipse[];
  label: Phaser.GameObjects.Text;
  hp: Phaser.GameObjects.Rectangle;
  lastPosition: Vector2;
  serverPosition: Vector2;
  velocity: Vector2;
  positionHistory: NetworkPositionSample[];
  facingAngle: number;
  idleSeed: number;
  lastServerAt: number;
  lastHp: number;
  wasRespawning: boolean;
  lastAttackCueAt: number;
  spawnedAt: number;
  lastLabelText: string;
  lastLabelColor: string;
}

interface GroundItemView {
  id: string;
  sprite: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  glow: Phaser.GameObjects.Arc;
  createdAt: number;
  dropIntro: boolean;
  kind: GroundItem["kind"];
  rare: boolean;
  pvpCoin: boolean;
  ownerId?: string;
  sourceId?: string;
  lastPosition: Vector2;
  missingSince?: number;
  lastLabelText: string;
  lastLabelColor: string;
}

type DungeonAction =
  | { mode: "enter"; landmarkId: string; position: Vector2 }
  | { mode: "exit"; dungeonId: string; exit: "start" | "end"; position: Vector2 };

type AudioSweep = number | readonly [number, number];

interface DecorationDef {
  id: string;
  texture: string;
  position: Vector2;
  scale: number;
  rotation: number;
  depth: number;
  alpha?: number;
}

interface WorldFoliageDef {
  id: string;
  frame: string;
  form: WorldFoliageForm;
  position: Vector2;
  targetHeight: number;
  depth: number;
  alpha: number;
  flipX: boolean;
  cullRadius: number;
}

interface TerrainPatch {
  id: string;
  texture: string;
  x: number;
  y: number;
  width: number;
  height: number;
  alpha: number;
  depth: number;
}

interface StaticMapGraphicsLayer {
  view: Phaser.GameObjects.Graphics;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface CheckpointFireView {
  aura: Phaser.GameObjects.Ellipse;
  glow: Phaser.GameObjects.Ellipse;
  flame: Phaser.GameObjects.Image;
  sparkA: Phaser.GameObjects.Arc;
  sparkB: Phaser.GameObjects.Arc;
  baseScale: number;
  seed: number;
}

interface HazardView {
  warning: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Ellipse;
  glow: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Ellipse;
  core?: Phaser.GameObjects.Rectangle;
  orbs?: Phaser.GameObjects.Arc[];
  sparks?: Phaser.GameObjects.Arc[];
}

interface TouchStick {
  base: Phaser.GameObjects.Arc;
  thumb: Phaser.GameObjects.Arc;
  pointerId?: number;
  nativeTouchId?: number;
  screenBase: Vector2;
  homeBase: Vector2;
  vector: Vector2;
  radius: number;
  hitRadius: number;
}

interface NetworkPositionSample {
  position: Vector2;
  serverTime: number;
}

interface SingingAudioHandle {
  audio: HTMLAudioElement;
  source?: MediaElementAudioSourceNode;
  gain?: GainNode;
  playerId: string;
  trackId: number;
  currentVolume: number;
  createdAt: number;
  unmutedAt?: number;
  pendingPlay: boolean;
  fadingOut: boolean;
  lastSeenAt: number;
  unlockTimer?: number;
  pendingTrackId?: number;
  pendingTrackUrl?: string;
  pendingSeekSeconds?: number;
}

interface WorldMusicProfile {
  key: string;
  root: number;
  scale: readonly number[];
  bass: readonly number[];
  lead: readonly number[];
  intervalMs: number;
  padMs: number;
  noteDuration: number;
  padDuration: number;
  volume: number;
  filter: number;
  wave: OscillatorType;
  padWave: OscillatorType;
}

const playerColors: Record<string, number> = {
  warrior: 0xef4444,
  assassin: 0xa855f7,
  mage: 0x38bdf8,
  archer: 0x22c55e,
  tank: 0xf59e0b
};
const INPUT_SEND_INTERVAL_MS = 33;
const MOBILE_INPUT_SEND_INTERVAL_MS = 33;
const LOCAL_MOVEMENT_GRACE_MS = 850;
const LOCAL_STOP_SETTLE_MS = 260;
const LOCAL_STOP_SETTLE_DEADBAND = 14;
const LOCAL_STOP_VISUAL_LOCK_DISTANCE = 58;
const LOCAL_STOP_BACKTRACK_LOCK_DISTANCE = 72;
const LOCAL_RECONCILE_DEFER_DISTANCE = 360;
const LOCAL_RECONCILE_SNAP_DISTANCE = 2600;
const LOCAL_RESPAWN_SNAP_DISTANCE = 760;
const LOCAL_AUTHORITATIVE_LEAD_SECONDS = 0.035;
const LOCAL_MAX_AUTHORITATIVE_AGE_SECONDS = 0.22;
const CLICK_MOVE_RENDER_ARRIVE_DISTANCE = 12;
const CLICK_MOVE_SERVER_ARRIVE_DISTANCE = 24;
const MAX_STORED_INPUTS = 120;
const REMOTE_PLAYER_WARP_SNAP_DISTANCE = 260;
const REMOTE_PLAYER_LEAD_SECONDS = 0.04;
const REMOTE_MONSTER_LEAD_SECONDS = 0.06;
const REMOTE_PLAYER_INTERPOLATION_DELAY_MS = 74;
const REMOTE_MOBILE_PLAYER_INTERPOLATION_DELAY_MS = 118;
const REMOTE_MONSTER_INTERPOLATION_DELAY_MS = 92;
const REMOTE_MOBILE_MONSTER_INTERPOLATION_DELAY_MS = 138;
// Keep remote actors moving through one short VPN/TCP jitter gap. The value is
// still bounded so a genuinely stale actor cannot run far away from the server.
const REMOTE_EXTRAPOLATE_LIMIT_MS = 180;
const REMOTE_PLAYER_MAX_INTERPOLATION_DELAY_MS = 210;
const REMOTE_MONSTER_MAX_INTERPOLATION_DELAY_MS = 240;
const REMOTE_MOBILE_MAX_INTERPOLATION_DELAY_MS = 320;
const REMOTE_NETWORK_HISTORY_LIMIT = 8;
const MONSTER_SPAWN_FADE_MS = 360;
const MAX_CLASS_AIM_RADIUS = Math.ceil(
  Math.max(
    ...Object.values(CLASS_DEFINITIONS).map((definition) =>
      Math.max(definition.attackRange, ...definition.skills.map((skill) => skill.range + (skill.dashDistance ?? 0)))
    )
  )
);
const WORLD_CAMERA_ZOOM = 0.84;
const MOBILE_WORLD_CAMERA_ZOOM = 0.72;
const MOBILE_NORMAL_RENDER_MARGIN = MAX_CLASS_AIM_RADIUS + 80;
const MOBILE_CROWDED_RENDER_MARGIN = MAX_CLASS_AIM_RADIUS + 40;
const MOBILE_SUSTAINED_RENDER_MARGIN = MAX_CLASS_AIM_RADIUS + 10;
const MOBILE_MINIMAL_RENDER_MARGIN = MAX_CLASS_AIM_RADIUS;
const MOBILE_JOYSTICK_FACE_DEADZONE = 0.06;
const MOBILE_JOYSTICK_MOVE_DEADZONE = 0.24;
const MOBILE_TARGET_PICK_PADDING = 62;
const MERCHANT_CLICK_RADIUS_X = 58;
const MERCHANT_CLICK_RADIUS_Y = 78;
const TELEPORTER_CLICK_RADIUS = 72;
const GROUND_ITEM_PICKUP_REQUEST_RANGE = 120;
const GROUND_ITEM_APPROACH_DISTANCE = 80;
const HAZARD_ORB_COUNT = 4;
const PLAYER_CULL_MARGIN = 620;
const MONSTER_CULL_MARGIN = 700;
const PLAYER_FULL_DETAIL_DISTANCE = 720;
const PLAYER_CROWD_FULL_DETAIL_DISTANCE = 260;
const PLAYER_LABEL_DISTANCE = 620;
const CROWDED_VISIBLE_PLAYERS = 14;
const CROWDED_ARENA_PLAYERS = 9;
const MOBILE_CROWDED_VISIBLE_PLAYERS = 10;
const MOBILE_CROWDED_ARENA_PLAYERS = 7;
const CROWDED_EFFECT_BUDGET = 5;
const NORMAL_EFFECT_BUDGET = 28;
const MOBILE_AMBIENT_EFFECT_WINDOW_MS = 1000;
const MOBILE_AMBIENT_EFFECT_BUDGET = 10;
const MOBILE_CROWDED_AMBIENT_EFFECT_BUDGET = 3;
const MOBILE_PLAYER_VIEW_MISSING_GRACE_MS = 2_400;
const MOBILE_DEEP_SUSTAIN_MS = 120_000;
const MOBILE_TRANSIENT_EFFECT_TTL_MS = 2_400;
const MOBILE_TRANSIENT_EFFECT_LIMIT = 24;
const MOBILE_DEEP_TRANSIENT_EFFECT_LIMIT = 8;
const MOBILE_SUSTAINED_DAMAGE_TEXT_INTERVAL_MS = 220;
const MOBILE_DEEP_DAMAGE_TEXT_INTERVAL_MS = 520;
const MOBILE_SUSTAINED_TRAIL_INTERVAL_MS = 260;
const MOBILE_DEEP_TRAIL_INTERVAL_MS = 720;
const MOBILE_AMBIENT_SKILL_TRAIL_INTERVAL_MS = 180;
const MOBILE_DEEP_AMBIENT_SKILL_TRAIL_INTERVAL_MS = 360;
const MOBILE_FULL_WORLD_MAP = false;
const PVP_FLAG_FADE_MS = 8_000;
const mobileAutoTargetStorageKey = "mmo.mobileAutoTarget.v1";
const PLAYER_LABEL_OFFSET_Y = -36;
const PLAYER_HP_BAR_OFFSET_Y = -24;
const CUSTOM_PLAYER_HEADS: Record<
  string,
  {
    texture: string;
    url: string;
    scale: number;
    offsetY: number;
    labelOffsetY: number;
    hpBarOffsetY: number;
  }
> = {
  unit: {
    texture: "unit-custom-head",
    url: "/unit-head.png",
    scale: 0.08,
    offsetY: -22,
    labelOffsetY: -64,
    hpBarOffsetY: -50
  },
  kirs: {
    texture: "kirs-custom-head",
    url: "/kirs-head.png",
    scale: 0.08,
    offsetY: -22,
    labelOffsetY: -64,
    hpBarOffsetY: -50
  }
};
type CustomPlayerHeadConfig = (typeof CUSTOM_PLAYER_HEADS)[string];
// Audio files stay private and are excluded by .gitignore; only their runtime routes live in source.
const SINGING_TRACK_URLS: Record<number, string> = {
  1: "/songs/kirs/1.mp3",
  2: "/songs/kirs/2.mp3",
  3: "/songs/kirs/3.mp3",
  4: "/songs/kirs/4.mp3",
  5: "/songs/kirs/5.mp3",
  6: "/songs/kirs/6.mp3",
  7: "/songs/kirs/7.mp3"
};
const SINGING_AUDIO_FULL_RADIUS = 38;
const SINGING_AUDIO_MAX_RADIUS = 1180;
const SINGING_AUDIO_MAX_VOLUME = 0.42;
const SINGING_AUDIO_MIN_AUDIBLE_VOLUME = 0.000006;
const SINGING_AUDIO_PREPLAY_VOLUME = 0.00075;
const MOBILE_SINGING_AUDIO_MAX_RADIUS = 2600;
const MOBILE_SINGING_AUDIO_PREPLAY_VOLUME = 0;
const MOBILE_SINGING_AUDIO_RISE_MIN_STEP = 0.000035;
const MOBILE_SINGING_AUDIO_RISE_MAX_STEP = 0.00048;
const MOBILE_SINGING_AUDIO_FALL_MIN_STEP = 0.0009;
const MOBILE_SINGING_AUDIO_FALL_MAX_STEP = 0.0032;
const MOBILE_SINGING_AUDIO_OUT_OF_RANGE_FALL_STEP = 0.0038;
const SINGING_AUDIO_RISE_MIN_STEP = 0.0015;
const SINGING_AUDIO_RISE_MAX_STEP = 0.0052;
const SINGING_AUDIO_FALL_MIN_STEP = 0.0022;
const SINGING_AUDIO_FALL_MAX_STEP = 0.007;
const SINGING_AUDIO_OUT_OF_RANGE_FALL_STEP = 0.008;
const SINGING_AUDIO_UNMUTE_DELAY_MS = 360;
const SINGING_AUDIO_SEEK_RETRY_MS = 160;
const GAME_TONE_VOLUME_MULTIPLIER = 1.9;
const MOBILE_GAME_TONE_VOLUME_MULTIPLIER = 2.35;
const GAME_TONE_MAX_VOLUME = 0.18;
const SINGING_AUDIO_UNLOCK_SRC =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==";
const BIRD_AMBIENT_UPDATE_INTERVAL_MS = 520;
const BIRD_AMBIENT_MIN_VOLUME = 0.0005;
const BIRD_AMBIENT_DESKTOP_MAX_VOLUME = 0.36;
const BIRD_AMBIENT_MOBILE_MAX_VOLUME = 0.32;
const BIRD_AMBIENT_RISE_STEP = 0.028;
const BIRD_AMBIENT_FALL_STEP = 0.012;
const BIRD_AMBIENT_FIRST_DELAY_MIN_MS = 450;
const BIRD_AMBIENT_FIRST_DELAY_MAX_MS = 1_250;
const BIRD_AMBIENT_DELAY_MIN_MS = 1_500;
const BIRD_AMBIENT_DELAY_MAX_MS = 5_600;
const WORLD_MUSIC_UPDATE_INTERVAL_MS = 180;
const WORLD_MUSIC_MIN_VOLUME = 0.0006;
const WORLD_MUSIC_RISE_STEP = 0.011;
const WORLD_MUSIC_FALL_STEP = 0.014;
const WORLD_MUSIC_PROFILES: Record<string, WorldMusicProfile> = {
  town: {
    key: "town",
    root: 196,
    scale: [0, 2, 4, 7, 9, 12],
    bass: [-12, 0, 7, 4],
    lead: [7, 9, 12, 9, 4, 7],
    intervalMs: 1250,
    padMs: 7200,
    noteDuration: 1.35,
    padDuration: 6.4,
    volume: 0.115,
    filter: 1850,
    wave: "triangle",
    padWave: "sine"
  },
  grass: {
    key: "grass",
    root: 174.61,
    scale: [0, 3, 5, 7, 10, 12],
    bass: [-12, 0, 5, 7],
    lead: [7, 10, 12, 15, 12, 10, 7, 5],
    intervalMs: 1480,
    padMs: 8200,
    noteDuration: 1.6,
    padDuration: 7.1,
    volume: 0.105,
    filter: 1600,
    wave: "sine",
    padWave: "sine"
  },
  forest: {
    key: "forest",
    root: 164.81,
    scale: [0, 2, 3, 7, 9, 12],
    bass: [-12, 0, 7, 3],
    lead: [7, 9, 12, 14, 12, 9, 7, 3],
    intervalMs: 1580,
    padMs: 8800,
    noteDuration: 1.85,
    padDuration: 7.8,
    volume: 0.112,
    filter: 1450,
    wave: "sine",
    padWave: "triangle"
  },
  darkForest: {
    key: "darkForest",
    root: 146.83,
    scale: [0, 2, 3, 6, 7, 10, 12],
    bass: [-12, 0, 6, 3],
    lead: [7, 6, 3, 10, 7, 12],
    intervalMs: 1760,
    padMs: 9600,
    noteDuration: 1.9,
    padDuration: 8.8,
    volume: 0.105,
    filter: 1120,
    wave: "triangle",
    padWave: "sine"
  },
  desert: {
    key: "desert",
    root: 185,
    scale: [0, 1, 4, 5, 7, 10, 12],
    bass: [-12, 0, 7, 5],
    lead: [12, 10, 7, 5, 7, 10],
    intervalMs: 1420,
    padMs: 7600,
    noteDuration: 1.25,
    padDuration: 6.8,
    volume: 0.096,
    filter: 1750,
    wave: "triangle",
    padWave: "sine"
  },
  snow: {
    key: "snow",
    root: 220,
    scale: [0, 2, 5, 7, 9, 12],
    bass: [-12, 0, 5, 9],
    lead: [12, 14, 17, 14, 12, 9],
    intervalMs: 1980,
    padMs: 10400,
    noteDuration: 2.2,
    padDuration: 9.2,
    volume: 0.082,
    filter: 1250,
    wave: "sine",
    padWave: "sine"
  },
  swamp: {
    key: "swamp",
    root: 155.56,
    scale: [0, 3, 5, 6, 10, 12],
    bass: [-12, 0, 6, 5],
    lead: [5, 6, 10, 6, 3, 5],
    intervalMs: 1840,
    padMs: 9300,
    noteDuration: 1.7,
    padDuration: 8.4,
    volume: 0.093,
    filter: 980,
    wave: "triangle",
    padWave: "sine"
  },
  coast: {
    key: "coast",
    root: 207.65,
    scale: [0, 2, 5, 7, 11, 12],
    bass: [-12, 0, 5, 7],
    lead: [7, 11, 12, 14, 12, 7],
    intervalMs: 1500,
    padMs: 8400,
    noteDuration: 1.6,
    padDuration: 7.4,
    volume: 0.1,
    filter: 1700,
    wave: "sine",
    padWave: "triangle"
  },
  fire: {
    key: "fire",
    root: 130.81,
    scale: [0, 1, 5, 7, 8, 12],
    bass: [-12, 0, 7, 1],
    lead: [7, 8, 12, 8, 5, 7],
    intervalMs: 1180,
    padMs: 6400,
    noteDuration: 1.1,
    padDuration: 5.6,
    volume: 0.116,
    filter: 1320,
    wave: "sawtooth",
    padWave: "triangle"
  },
  void: {
    key: "void",
    root: 123.47,
    scale: [0, 1, 4, 6, 7, 11, 12],
    bass: [-12, 0, 6, 1],
    lead: [6, 11, 7, 4, 12, 6],
    intervalMs: 1880,
    padMs: 9800,
    noteDuration: 2.05,
    padDuration: 8.8,
    volume: 0.104,
    filter: 920,
    wave: "triangle",
    padWave: "sine"
  },
  mountain: {
    key: "mountain",
    root: 174.61,
    scale: [0, 2, 5, 7, 10, 12],
    bass: [-12, 0, 7, 5],
    lead: [12, 10, 7, 5, 10, 12],
    intervalMs: 2040,
    padMs: 10600,
    noteDuration: 2.15,
    padDuration: 9.6,
    volume: 0.086,
    filter: 1050,
    wave: "sine",
    padWave: "sine"
  },
  dungeon: {
    key: "dungeon",
    root: 110,
    scale: [0, 1, 3, 6, 7, 10, 12],
    bass: [-12, 0, 6, 3],
    lead: [6, 7, 10, 6, 3, 1],
    intervalMs: 1540,
    padMs: 7900,
    noteDuration: 1.5,
    padDuration: 7.2,
    volume: 0.11,
    filter: 820,
    wave: "triangle",
    padWave: "sine"
  },
  boss: {
    key: "boss",
    root: 98,
    scale: [0, 1, 5, 6, 7, 11, 12],
    bass: [-12, 0, 6, 0],
    lead: [7, 6, 11, 7, 12, 6],
    intervalMs: 980,
    padMs: 5600,
    noteDuration: 1.05,
    padDuration: 5.2,
    volume: 0.13,
    filter: 920,
    wave: "sawtooth",
    padWave: "triangle"
  }
};

export class WorldScene extends Phaser.Scene {
  private localPlayerId?: string;
  private snapshot?: GameSnapshot;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys?: Record<string, Phaser.Input.Keyboard.Key>;
  private lastInputAt = 0;
  private lastInputSignature = "";
  private lastLocalMovementIntentAt = 0;
  private lastLocalMovementVector: Vector2 = { x: 0, y: 0 };
  private lastLocalPredictionAt = 0;
  private lastRemotePredictionAt = 0;
  private lastLocalFacingBroadcastAngle = Number.NaN;
  private lastLocalFacingBroadcastAt = 0;
  private serverTimeOffsetMs = 0;
  private hasServerTimeOffset = false;
  private seq = 0;
  private readonly pendingInputs = new Map<number, PlayerInput>();
  private readonly players = new Map<string, PlayerView>();
  private readonly monsters = new Map<string, MonsterView>();
  private readonly configuredMonsterTextureFilters = new WeakSet<Phaser.Textures.Texture>();
  private readonly resources = new Map<string, Phaser.GameObjects.Image>();
  private readonly groundItems = new Map<string, GroundItemView>();
  private readonly terrainPatches: TerrainPatch[] = [];
  private readonly terrainTiles = new Map<string, Phaser.GameObjects.TileSprite>();
  private readonly staticMapGraphicsLayers: StaticMapGraphicsLayer[] = [];
  private lastStaticMapLayerUpdateAt = 0;
  private lastStaticMapLayerViewport?: { x: number; y: number; zoom: number };
  private ambientMotes: Array<{ dot: Phaser.GameObjects.Arc; seed: number }> = [];
  private lastAmbientUpdateAt = 0;
  private lastDayNightUpdateAt = 0;
  private worldNightAmount = 0;
  private noiseBuffer?: AudioBuffer;
  private lastLocalPickupSoundAt = 0;
  private lastTerrainUpdateAt = 0;
  private lastTerrainViewport?: { x: number; y: number; zoom: number };
  private mobileScenery?: Phaser.GameObjects.Graphics;
  private lastMobileSceneryUpdateAt = 0;
  private lastMobileSceneryViewport?: { x: number; y: number; zoom: number };
  private readonly decorationDefs: DecorationDef[] = [];
  private readonly decorations = new Map<string, Phaser.GameObjects.Image>();
  private readonly worldFoliageDefsByChunk = new Map<string, WorldFoliageDef[]>();
  private readonly worldFoliageViews = new Map<string, Phaser.GameObjects.Image>();
  private readonly worldFoliagePool: Phaser.GameObjects.Image[] = [];
  private worldFoliageDefinitionCount = 0;
  private lastWorldFoliageUpdateAt = 0;
  private lastWorldFoliageViewport?: { x: number; y: number; zoom: number };
  private worldFoliagePreviewDiagnostics?: HTMLDivElement;
  private readonly checkpointFires = new Map<string, CheckpointFireView>();
  private readonly hazardViews = new Map<string, HazardView>();
  private lastDecorationUpdateAt = 0;
  private lastDecorationViewport?: { x: number; y: number; zoom: number };
  private lastCrowdMetricsAt = 0;
  private visiblePlayerCount = 0;
  private arenaPlayerCount = 0;
  private eventText?: Phaser.GameObjects.Text;
  private systemLogLayoutSignature = "";
  private pkModeText?: Phaser.GameObjects.Text;
  private joystick?: TouchStick;
  private aimJoystick?: TouchStick;
  private removeNativeJoystickHandlers?: () => void;
  private removeMobileAutoTargetHandler?: () => void;
  private removeMobileGraphicsSettingsHandler?: () => void;
  private removeRenameCharacterHandler?: () => void;
  private attackButton?: Phaser.GameObjects.Arc;
  private skillButton?: Phaser.GameObjects.Arc;
  private jumpButton?: Phaser.GameObjects.Arc;
  private pkButton?: Phaser.GameObjects.Arc;
  private attackLabel?: Phaser.GameObjects.Image;
  private skillLabel?: Phaser.GameObjects.Image;
  private jumpLabel?: Phaser.GameObjects.Image;
  private pkLabel?: Phaser.GameObjects.Image;
  private attackRangeRing?: Phaser.GameObjects.Arc;
  private selectedTargetRing?: Phaser.GameObjects.Arc;
  private selectedTargetPulse?: Phaser.GameObjects.Arc;
  private selectedTargetArrow?: Phaser.GameObjects.Triangle;
  private aimReticle?: Phaser.GameObjects.Arc;
  private drawChargeRing?: Phaser.GameObjects.Arc;
  private selectedTargetId?: string;
  private lastAnnouncedTargetId?: string;
  private clickMoveTarget?: Vector2;
  private pendingAttackTargetId?: string;
  private pendingSkillTargetId?: string;
  private pendingResourceId?: string;
  private pendingGroundItemId?: string;
  private lastGroundItemPickupRequestAt = 0;
  private lastGroundItemPickupRequestId?: string;
  private pendingSkillIndex = 0;
  private queuedAttack?: { aim: Vector2; targetId?: string; charge?: number; forcePk?: boolean; requestedAt: number };
  private moveMarker?: Phaser.GameObjects.Arc;
  private readonly teleportViews = new Map<string, Phaser.GameObjects.Arc>();
  private readonly dungeonPortalViews = new Map<string, Phaser.GameObjects.Arc>();
  private lastLocalAttackAt = 0;
  private lastLocalSkillAt = 0;
  private rollUntil = 0;
  private lastRollAt = 0;
  private rollDirection: Vector2 = { x: 0, y: 0 };
  private rollBoost = false;
  private mobileSprintUntil = 0;
  private mobileLastTargetPickAt = 0;
  private mobileLastAttackTapAt = -Infinity;
  private mobileLastAttackTapTargetId?: string;
  private mobileAutoTarget = true;
  private pkModeLocked = false;
  private lastCtrlPkTapAt = -Infinity;
  private worldCursorMode = "";
  private worldCursorInteractive = false;
  private mobileGraphics: MobileGraphicsSettings = defaultMobileGraphicsSettings;
  private jumpStartedAt = -Infinity;
  private jumpPeak = 0;
  private jumpCount = 0;
  private audioContext?: AudioContext;
  private gameToneGain?: GainNode;
  private gameToneCompressor?: DynamicsCompressorNode;
  private readonly singingAudio = new Map<string, SingingAudioHandle>();
  private reusableSingingAudio?: HTMLAudioElement;
  private singingAudioElementWarmed = false;
  private birdAmbientGain?: GainNode;
  private birdAmbientVolume = 0;
  private nextBirdAmbientAt = 0;
  private lastBirdAmbientUpdateAt = 0;
  private worldMusicGain?: GainNode;
  private worldMusicFilter?: BiquadFilterNode;
  private worldMusicVolume = 0;
  private worldMusicKey = "";
  private worldMusicStep = 0;
  private worldMusicPhraseSeed = 0;
  private worldMusicNextNoteAt = 0;
  private worldMusicNextPadAt = 0;
  private lastWorldMusicUpdateAt = 0;
  private lastSoundAt = 0;
  private lastLootSoundAt = 0;
  private readonly loadingCustomHeadTextures = new Set<string>();
  private renderedInitialSnapshot = false;
  private readonly renderedEventIds = new Set<string>();
  private readonly pickupFeedbackItemIds = new Map<string, number>();
  private mobileAmbientEffectWindowAt = 0;
  private mobileAmbientEffectCount = 0;
  private lastMobileRemotePredictionAt = 0;
  private lastMobileWorldAnimationAt = 0;
  private lastMobileHudUpdateAt = 0;
  private lastMobileRuntimeCleanupAt = 0;
  private lastMobilePerfFrameAt = 0;
  private mobileSlowFrameScore = 0;
  private mobileLeanRuntime = false;
  private mobileSustainedLeanRuntime = false;
  private mobileDeepSustainRuntime = false;
  private lastDesktopPerfFrameAt = 0;
  private desktopSlowFrameScore = 0;
  private desktopLeanRuntime = false;
  private fpsOverlayElement?: HTMLDivElement;
  private lastFpsOverlayUpdateAt = 0;
  private mobileFpsLimit = 60;
  private mobileRefreshLocked = false;
  private mobileAudioWindowAt = 0;
  private mobileAudioCount = 0;
  private lastAudioResumeAt = 0;
  private lastSingingResumeAt = 0;
  private lastMobileInputRecoveryAt = 0;
  private lastMobileInputBoundsRefreshAt = 0;
  private lastInputBoundsRefreshPerfAt = 0;
  private lastMobileDamageTextAt = 0;
  private lastMobileTrailAt = 0;
  private lastMobileAmbientSkillTrailAt = 0;
  private readonly toneTimers = new Set<number>();
  private readonly transientEffects = new Set<Phaser.GameObjects.GameObject>();
  private uiFocused = false;
  private inputSuspended = false;
  private removeWindowInputGuards?: () => void;
  private archerDraw?: { startedAt: number; targetId?: string; aim: Vector2; direction: Vector2 };
  private archerHoldPrimary?: { pointerId: number; aim: Vector2; startedAt: number };
  private drawBowArc?: Phaser.GameObjects.Arc;
  private drawPullDot?: Phaser.GameObjects.Arc;
  private drawAimDot?: Phaser.GameObjects.Arc;
  private latestPointerScreen?: Vector2;
  private latestPointerAim?: Vector2;
  private lastTouchAimDirection?: Vector2;
  private pendingNativeWorldTap?: { id: number; start: Vector2; current: Vector2; startedAt: number; moved: boolean };
  private readonly handleScaleResize = () => {
    this.refreshInputBounds(true);
    this.syncTouchControls();
    this.resetTouchOwnership();
  };
  private lastPhaserWorldPointerDown?: { x: number; y: number; at: number };
  private static readonly JUMP_DURATION_MS = 430;
  private static readonly ARCHER_HOLD_DRAW_DELAY_MS = 180;
  private static readonly CAMERA_EDGE_PADDING = 2200;
  private static readonly WORLD_FOLIAGE_CHUNK_SIZE = 1024;

  constructor(
    private readonly realtime: RealtimeClient,
    private readonly walletAddress: () => string | undefined,
    private readonly language: AppLanguage = "ru",
    initialMobileGraphics?: MobileGraphicsSettings,
    private readonly mobileRuntime = isMobileGameRuntime()
  ) {
    super("world");
    this.mobileGraphics = normalizeMobileGraphicsSettings(initialMobileGraphics);
  }

  private tr(value: string, vars?: Record<string, string | number>): string {
    return translateText(this.language, value, vars);
  }

  private levelLabel(level: number, required = false): string {
    return this.language === "ru" ? `ур.${level}${required ? "+" : ""}` : `Lv.${level}${required ? "+" : ""}`;
  }

  private nameWithLevel(name: string, level: number, required = false): string {
    return `${this.tr(name)} ${this.levelLabel(level, required)}`;
  }

  preload(): void {
    Object.values(CUSTOM_PLAYER_HEADS).forEach((head) => {
      this.load.image(head.texture, head.url);
    });
    preloadMonsterSpriteAssets(this);
    preloadWorldFoliageAssets(this);
  }

  create(): void {
    const localPreviewBridge =
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") &&
      new URLSearchParams(window.location.search).has("previewActive");
    if (import.meta.env.DEV || localPreviewBridge) {
      (window as unknown as { __scene?: WorldScene }).__scene = this;
    }
    this.cameras.main.setBounds(
      -WorldScene.CAMERA_EDGE_PADDING,
      -WorldScene.CAMERA_EDGE_PADDING,
      WORLD_BOUNDS.width + WorldScene.CAMERA_EDGE_PADDING * 2,
      WORLD_BOUNDS.height + WorldScene.CAMERA_EDGE_PADDING * 2
    );
    this.startTouchDiagnostics();
    this.mobileAutoTarget = this.loadMobileAutoTarget();
    this.setMobileGraphicsSettings(this.mobileGraphics);
    this.createWorldTextures();
    // These large source sprites are rendered at fractional downscales. Linear sampling keeps
    // their pixels stable while the camera moves instead of producing nearest-neighbour shimmer.
    this.textures.get(WORLD_FOLIAGE_ATLAS_KEY).setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.drawMap();
    this.seedDecorations();
    this.seedWorldFoliage();
    if (localPreviewBridge) {
      this.createWorldFoliagePreviewDiagnostics();
    }
    this.createAmbientLayer();
    this.setupInput();
    this.syncTouchControls();
    this.scale.on("resize", this.handleScaleResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.handleScaleResize);
      this.removeNativeJoystickHandlers?.();
      this.removeNativeJoystickHandlers = undefined;
      this.removeMobileAutoTargetHandler?.();
      this.removeMobileAutoTargetHandler = undefined;
      this.removeMobileGraphicsSettingsHandler?.();
      this.removeMobileGraphicsSettingsHandler = undefined;
      this.removeRenameCharacterHandler?.();
      this.removeRenameCharacterHandler = undefined;
      this.clearToneTimers();
      this.pendingInputs.clear();
      this.renderedEventIds.clear();
      this.pickupFeedbackItemIds.clear();
      this.stopAllSingingAudio();
      this.stopBirdAmbientAudio();
      this.stopWorldMusic();
      this.destroyTransientEffects();
      this.destroyFpsOverlay();
      this.staticMapGraphicsLayers.length = 0;
      this.lastStaticMapLayerViewport = undefined;
      this.mobileScenery?.destroy();
      this.mobileScenery = undefined;
      this.destroyWorldFoliage();
      this.worldFoliagePreviewDiagnostics?.remove();
      this.worldFoliagePreviewDiagnostics = undefined;
    });

    this.realtime.on("snapshot", (snapshot) => {
      const sprintWasAvailable = this.localCanSprint();
      this.snapshot = snapshot;
      if (sprintWasAvailable !== this.localCanSprint()) {
        this.syncTouchControls();
      }
      this.renderSnapshot(snapshot);
    });
    this.realtime.on("chat", (message) => this.renderChatBubble(message));
    this.installMobileAutoTargetHandler();
    this.installMobileGraphicsSettingsHandler();
    this.installRenameCharacterHandler();
  }

  update(time: number): void {
    touchDiag.noteFrame();
    const mobile = this.isMobileTouchMode();
    if (mobile) {
      this.updateMobileRuntimeBudget(time);
    } else {
      this.updateDesktopRuntimeBudget(time);
    }
    this.refreshCrowdMetrics(time);
    this.updateLocalPrediction(time);
    const remotePredictionInterval = mobile ? (this.mobileLeanRuntime || this.isMobileCoolGraphics() ? 33 : 16) : this.desktopLeanRuntime ? 16 : 0;
    if (remotePredictionInterval === 0 || time - this.lastMobileRemotePredictionAt >= remotePredictionInterval) {
      this.lastMobileRemotePredictionAt = time;
      this.updateRemotePrediction(time);
    }
    const localPlayer = this.localPlayer();
    if (localPlayer) {
      const zoom = this.cameraZoom();
      if (this.cameras.main.zoom !== zoom) {
        this.cameras.main.setZoom(zoom);
        this.layoutTouchControls();
      }
      const localView = this.localPlayerId ? this.players.get(this.localPlayerId) : undefined;
      this.cameras.main.centerOn(localView?.body.x ?? localPlayer.position.x, (localView?.body.y ?? localPlayer.position.y) - this.cameraVerticalOffset());
    }

    this.updateStaticMapGraphicsLayers(time);
    this.updateTerrainTiles(time);
    this.updateAmbientLayer(time);
    if (mobile && !this.usesMobileFullWorldMap() && !this.mobileSustainedLeanRuntime && this.mobileGraphics.worldDecorations) {
      this.updateMobileScenery(time);
    } else {
      this.mobileScenery?.clear();
    }
    this.updateDecorations(time);
    this.updateWorldFoliage(time);
    const mobileWorldAnimationInterval = mobile
      ? this.mobileDeepSustainRuntime || this.isMobileMinimalGraphics()
        ? 1200
        : this.mobileSustainedLeanRuntime
          ? 900
          : this.mobileLeanRuntime || this.isMobileCoolGraphics()
            ? 420
            : 220
      : 380;
    const worldAnimationInterval = mobile ? mobileWorldAnimationInterval : this.desktopLeanRuntime ? 480 : 220;
    if (time - this.lastMobileWorldAnimationAt >= worldAnimationInterval) {
      this.lastMobileWorldAnimationAt = time;
      if (!this.mobileSustainedLeanRuntime && this.mobileGraphics.worldDecorations) {
        this.animateVisibleDecorations(time);
        this.updateCheckpointFires(time);
      }
      this.updateWorldHazards(time);
      this.updatePortalAnimations(time);
    }
    const mobileHudInterval = this.mobileDeepSustainRuntime || this.isMobileMinimalGraphics() ? 240 : this.mobileSustainedLeanRuntime ? 180 : this.mobileLeanRuntime || this.isMobileCoolGraphics() ? 140 : 90;
    const hudInterval = mobile ? mobileHudInterval : this.desktopLeanRuntime ? 180 : 120;
    if (time - this.lastMobileHudUpdateAt >= hudInterval) {
      this.lastMobileHudUpdateAt = time;
      this.updateAimReticle();
      this.updateArcherHoldPrimary(time);
      this.updateArcherDraw();
      this.updatePkModeIndicator();
      this.updateSystemLogLayout();
    }
    this.updateFpsOverlay(time);
    this.stopProceduralAmbientAudio();
    if (!this.isInputBlocked() && !this.inputSuspended) {
      this.processPendingActions(time);
    }
    this.sendInput();
  }

  setLocalPlayer(playerId: string): void {
    this.localPlayerId = playerId;
    this.lastLocalPredictionAt = 0;
    this.lastRemotePredictionAt = 0;
    this.lastLocalFacingBroadcastAngle = Number.NaN;
    this.pendingInputs.clear();
  }

  setUiFocused(focused: boolean): void {
    this.uiFocused = focused;
    if (focused) {
      this.clickMoveTarget = undefined;
      this.pendingAttackTargetId = undefined;
      this.pendingSkillTargetId = undefined;
      this.pendingResourceId = undefined;
      this.pendingGroundItemId = undefined;
      this.pendingSkillIndex = 0;
      this.queuedAttack = undefined;
      this.moveMarker?.setVisible(false);
    }
  }

  clearSelectedTarget(): void {
    this.selectedTargetId = undefined;
    this.pendingAttackTargetId = undefined;
    this.pendingSkillTargetId = undefined;
    this.pendingSkillIndex = 0;
    this.queuedAttack = undefined;
    this.cancelArcherDraw();
    this.attackRangeRing?.setVisible(false);
    this.hideSelectedTargetHighlight();
    this.announceSelectedTarget();
  }

  attackNearestTarget(): void {
    const local = this.localPlayer();
    if (!local) {
      return;
    }

    if (!this.localCanAct(local)) {
      return;
    }

    const selectedTarget = this.selectedAutoActionTarget(local) ?? this.mobileAutoActionTarget(local);
    const aim = selectedTarget ? this.entityRenderPosition(selectedTarget) : this.pointerAim(local);
    const target = selectedTarget ?? this.targetAt(aim.x, aim.y);
    if (target && this.isPlayerTarget(target) && !this.canAttackPlayerWithoutPk(target, local) && !this.isForcePkDown()) {
      this.selectedTargetId = target.id;
      this.announceSelectedTarget();
      return;
    }
    if (target && !this.canAttackTarget(target)) {
      this.selectedTargetId = target.id;
      this.pendingSkillTargetId = undefined;
      this.pendingAttackTargetId = target.id;
      this.setMoveTarget(this.approachPointForTarget(target), !this.isMobileTouchMode());
      return;
    }

    if (local.classId === "archer") {
      this.attack(aim.x, aim.y, target?.id, 0);
      return;
    }
    this.attack(aim.x, aim.y, target?.id);
  }

  startAttackHold(): void {
    const local = this.localPlayer();
    if (!local) {
      return;
    }

    if (local.classId !== "archer") {
      this.attackNearestTarget();
      return;
    }

    if (!this.localCanAct(local)) {
      return;
    }

    const selectedTarget = this.selectedAutoActionTarget(local) ?? this.mobileAutoActionTarget(local);
    const aim = selectedTarget ? this.entityRenderPosition(selectedTarget) : this.pointerAim(local);
    const target = selectedTarget ?? this.targetAt(aim.x, aim.y);
    if (target && this.isPlayerTarget(target) && !this.canAttackPlayerWithoutPk(target, local) && !this.isForcePkDown()) {
      this.selectedTargetId = target.id;
      this.announceSelectedTarget();
      return;
    }
    if (target && !this.canAttackTarget(target)) {
      this.selectedTargetId = target.id;
      this.pendingSkillTargetId = undefined;
      this.pendingAttackTargetId = target.id;
      this.setMoveTarget(this.approachPointForTarget(target), !this.isMobileTouchMode());
      return;
    }

    this.startArcherDraw(aim, target?.id);
  }

  releaseAttackHold(): void {
    this.releaseArcherDraw();
  }

  cancelAttackHold(): void {
    this.archerHoldPrimary = undefined;
    this.cancelArcherDraw();
  }

  skillNearestTarget(skillIndex = 0): void {
    const local = this.localPlayer();
    if (!local) {
      return;
    }

    if (!this.localCanAct(local)) {
      return;
    }

    const skill = CLASS_DEFINITIONS[local.classId].skills[skillIndex];
    if (!skill) {
      return;
    }
    if (skill.heal) {
      const origin = this.localRenderPosition(local);
      this.castSkill(origin.x, origin.y, undefined, skillIndex);
      return;
    }

    const selectedTarget = this.selectedAutoActionTarget(local) ?? this.mobileAutoActionTarget(local);
    const aim = selectedTarget ? this.entityRenderPosition(selectedTarget) : this.pointerAim(local);
    const target = selectedTarget ?? this.targetAt(aim.x, aim.y);
    if (target && this.isPlayerTarget(target) && !this.canAttackPlayerWithoutPk(target, local) && !this.isForcePkDown()) {
      this.selectedTargetId = target.id;
      this.announceSelectedTarget();
      return;
    }
    if (target && !this.canSkillTarget(target, skillIndex)) {
      this.selectedTargetId = target.id;
      this.pendingSkillIndex = skillIndex;
      this.pendingAttackTargetId = undefined;
      this.pendingSkillTargetId = target.id;
      this.setMoveTarget(this.approachPointForTarget(target), !this.isMobileTouchMode());
      return;
    }

    this.castSkill(aim.x, aim.y, target?.id, skillIndex);
  }

  mobileSprint(): void {
    this.resumeAudio();
    if (!this.localCanAct(this.localPlayer()) || !this.localCanSprint()) {
      return;
    }
    this.mobileSprintUntil = this.time.now + 1350;
    this.sendInput(true);
  }

  private createWorldTextures(): void {
    const create = (key: string, width: number, height: number, draw: (graphics: Phaser.GameObjects.Graphics) => void) => {
      if (this.textures.exists(key)) {
        return;
      }
      const graphics = this.add.graphics();
      draw(graphics);
      graphics.generateTexture(key, width, height);
      graphics.destroy();
    };
    const createTouchIcon = (key: string, draw: (context: CanvasRenderingContext2D) => void) => {
      if (this.textures.exists(key)) {
        return;
      }
      const texture = this.textures.createCanvas(key, 64, 64);
      if (!texture) {
        return;
      }
      const context = texture.getContext();
      context.clearRect(0, 0, 64, 64);
      context.lineCap = "round";
      context.lineJoin = "round";
      draw(context);
      texture.refresh();
    };
    type LucideNode =
      | ["path", { d: string }]
      | ["line", { x1: string; x2: string; y1: string; y2: string }]
      | ["polyline", { points: string }]
      | ["circle", { cx: string; cy: string; r: string }];
    const drawLucideNode = (context: CanvasRenderingContext2D, node: LucideNode) => {
      const [tag, attrs] = node;
      if (tag === "path") {
        context.stroke(new Path2D(attrs.d));
        return;
      }
      if (tag === "line") {
        context.beginPath();
        context.moveTo(Number(attrs.x1), Number(attrs.y1));
        context.lineTo(Number(attrs.x2), Number(attrs.y2));
        context.stroke();
        return;
      }
      if (tag === "polyline") {
        const points = attrs.points.split(" ").map((point) => point.split(",").map(Number));
        context.beginPath();
        points.forEach(([x, y], index) => {
          if (index === 0) {
            context.moveTo(x, y);
          } else {
            context.lineTo(x, y);
          }
        });
        context.stroke();
        return;
      }
      context.beginPath();
      context.arc(Number(attrs.cx), Number(attrs.cy), Number(attrs.r), 0, Math.PI * 2);
      context.stroke();
    };
    const drawLucideIcon = (context: CanvasRenderingContext2D, nodes: LucideNode[], color: string, strokeWidth = 2.35) => {
      context.save();
      context.translate(8, 8);
      context.scale(2, 2);
      context.lineCap = "round";
      context.lineJoin = "round";
      context.fillStyle = "transparent";
      context.strokeStyle = "rgba(2, 6, 23, 0.86)";
      context.lineWidth = strokeWidth + 1.9;
      nodes.forEach((node) => drawLucideNode(context, node));
      context.strokeStyle = color;
      context.lineWidth = strokeWidth;
      nodes.forEach((node) => drawLucideNode(context, node));
      context.strokeStyle = "rgba(255, 255, 255, 0.42)";
      context.lineWidth = Math.max(1.15, strokeWidth * 0.46);
      nodes.forEach((node) => drawLucideNode(context, node));
      context.restore();
    };

    createTouchIcon("touch-icon-attack", (context) => {
      drawLucideIcon(
        context,
        [
          ["polyline", { points: "14.5,17.5 3,6 3,3 6,3 17.5,14.5" }],
          ["line", { x1: "13", x2: "19", y1: "19", y2: "13" }],
          ["line", { x1: "16", x2: "20", y1: "16", y2: "20" }],
          ["line", { x1: "19", x2: "21", y1: "21", y2: "19" }],
          ["polyline", { points: "14.5,6.5 18,3 21,3 21,6 17.5,9.5" }],
          ["line", { x1: "5", x2: "9", y1: "14", y2: "18" }],
          ["line", { x1: "7", x2: "4", y1: "17", y2: "20" }],
          ["line", { x1: "3", x2: "5", y1: "19", y2: "21" }]
        ],
        "#fecaca",
        2.15
      );
    });

    createTouchIcon("touch-icon-dash", (context) => {
      drawLucideIcon(
        context,
        [["path", { d: "M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" }]],
        "#fde68a",
        2.35
      );
    });

    createTouchIcon("touch-icon-run", (context) => {
      drawLucideIcon(
        context,
        [
          ["path", { d: "M12.8 19.6A2 2 0 1 0 14 16H2" }],
          ["path", { d: "M17.5 8a2.5 2.5 0 1 1 2 4H2" }],
          ["path", { d: "M9.8 4.4A2 2 0 1 1 11 8H2" }]
        ],
        "#bbf7d0",
        2.35
      );
    });

    createTouchIcon("touch-icon-pvp", (context) => {
      drawLucideIcon(
        context,
        [
          ["path", { d: "m12.5 17-.5-1-.5 1h1z" }],
          ["path", { d: "M15 22a1 1 0 0 0 1-1v-1a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20v1a1 1 0 0 0 1 1z" }],
          ["circle", { cx: "15", cy: "12", r: "1" }],
          ["circle", { cx: "9", cy: "12", r: "1" }]
        ],
        "#fecaca",
        2.3
      );
    });

    const noise = (seed: number) => {
      const value = Math.sin(seed * 12.9898) * 43758.5453;
      return value - Math.floor(value);
    };
    const tileSpeckles = (graphics: Phaser.GameObjects.Graphics, colors: number[], alpha = 0.22, count = 72) => {
      for (let index = 0; index < count; index += 1) {
        const x = noise(index + colors.length * 11) * 256;
        const y = noise(index * 3.17 + colors.length * 19) * 256;
        const width = 10 + noise(index * 5.31) * 34;
        const height = 5 + noise(index * 7.73) * 16;
        graphics.fillStyle(colors[index % colors.length], alpha * (0.55 + noise(index * 2.11) * 0.45));
        graphics.fillEllipse(x, y, width, height);
      }
    };
    const softGrassBlades = (graphics: Phaser.GameObjects.Graphics, color: number, alpha = 0.12, count = 38) => {
      graphics.lineStyle(2, color, alpha);
      for (let index = 0; index < count; index += 1) {
        const x = noise(index * 13.77) * 256;
        const y = noise(index * 8.19) * 256;
        const length = 12 + noise(index * 2.31) * 20;
        const angle = -0.55 + noise(index * 5.81) * 1.1;
        graphics.lineBetween(x, y, x + Math.cos(angle) * length, y + Math.sin(angle) * length * 0.45);
      }
    };
    const leafBlob = (graphics: Phaser.GameObjects.Graphics, x: number, y: number, radius: number, colors: number[]) => {
      graphics.fillStyle(0x082313, 0.16);
      graphics.fillCircle(x + radius * 0.1, y + radius * 0.2, radius * 0.86);
      colors.forEach((color, index) => {
        graphics.fillStyle(color, index === 0 ? 1 : 0.84);
        const angleStep = (Math.PI * 2) / 7;
        for (let petal = 0; petal < 7; petal += 1) {
          const angle = petal * angleStep + index * 0.17;
          graphics.fillCircle(x + Math.cos(angle) * radius * 0.34, y + Math.sin(angle) * radius * 0.22, radius * (0.42 - index * 0.045));
        }
      });
      graphics.fillStyle(colors[colors.length - 1], 0.68);
      graphics.fillCircle(x - radius * 0.12, y - radius * 0.14, radius * 0.3);
    };

    create("tile-grass", 256, 256, (graphics) => {
      graphics.fillStyle(0x66ad38, 1);
      graphics.fillRect(0, 0, 256, 256);
      graphics.fillStyle(0x7fbe43, 0.46);
      graphics.fillEllipse(46, 38, 156, 82);
      graphics.fillEllipse(176, 148, 190, 104);
      graphics.fillStyle(0x4b8f2d, 0.28);
      graphics.fillEllipse(68, 190, 148, 78);
      graphics.fillEllipse(214, 40, 84, 46);
      tileSpeckles(graphics, [0x85c84d, 0x4d8d31, 0x9bdc5a, 0x3f7c2c, 0xc8ef72, 0xfef08a], 0.22, 160);
      graphics.fillStyle(0xf2ffc2, 0.095);
      for (let index = 0; index < 54; index += 1) {
        const x = noise(index * 9.13) * 256;
        const y = noise(index * 4.67) * 256;
        graphics.fillEllipse(x, y, 26 + noise(index) * 34, 8 + noise(index * 2) * 16);
      }
      graphics.lineStyle(2, 0xd9f99d, 0.12);
      for (let index = 0; index < 22; index += 1) {
        const x = noise(index * 3.41) * 256;
        const y = noise(index * 7.91) * 256;
        graphics.lineBetween(x - 18, y + 2, x + 22 + noise(index) * 16, y - 3 + noise(index * 2) * 8);
      }
      softGrassBlades(graphics, 0xf0f9b5, 0.14, 58);
      softGrassBlades(graphics, 0x2f6c25, 0.12, 38);
      // Denser blade layer + dark undergrowth veins for depth (texture is generated once).
      softGrassBlades(graphics, 0x9edc60, 0.1, 46);
      graphics.lineStyle(1, 0x2c5a1e, 0.16);
      for (let index = 0; index < 26; index += 1) {
        const x = noise(index * 12.7 + 5.9) * 256;
        const y = noise(index * 6.31 + 2.2) * 256;
        const length = 20 + noise(index * 3.7) * 30;
        const bend = (noise(index * 8.3) - 0.5) * 18;
        graphics.lineBetween(x, y, x + length, y + bend);
      }
      graphics.fillStyle(0x548c2f, 0.16);
      for (let index = 0; index < 12; index += 1) {
        const x = noise(index * 15.9 + 7.7) * 256;
        const y = noise(index * 9.83 + 4.4) * 256;
        graphics.fillEllipse(x, y, 34 + noise(index * 2.6) * 30, 12 + noise(index * 5.2) * 12);
      }
      const flowerColors = [0xfef3c7, 0xfda4af, 0xe9d5ff, 0xfef08a, 0xf8fafc];
      for (let index = 0; index < 14; index += 1) {
        const x = noise(index * 6.29 + 3.1) * 256;
        const y = noise(index * 11.47 + 8.7) * 256;
        const color = flowerColors[index % flowerColors.length];
        const petal = 1.5 + noise(index * 3.3) * 1.2;
        graphics.fillStyle(color, 0.75);
        graphics.fillCircle(x - petal, y, petal);
        graphics.fillCircle(x + petal, y, petal);
        graphics.fillCircle(x, y - petal, petal);
        graphics.fillCircle(x, y + petal, petal);
        graphics.fillStyle(0xfacc15, 0.9);
        graphics.fillCircle(x, y, petal * 0.7);
      }
      graphics.fillStyle(0x365314, 0.2);
      for (let index = 0; index < 10; index += 1) {
        const x = noise(index * 17.3 + 1.9) * 256;
        const y = noise(index * 5.71 + 12.3) * 256;
        graphics.fillCircle(x, y, 1.6);
        graphics.fillCircle(x + 3.4, y + 1.4, 1.4);
        graphics.fillCircle(x + 1.4, y + 3.6, 1.5);
      }
    });
    create("tile-forest", 256, 256, (graphics) => {
      graphics.fillStyle(0x3e7d28, 1);
      graphics.fillRect(0, 0, 256, 256);
      graphics.fillStyle(0x2d641e, 0.38);
      graphics.fillEllipse(64, 56, 166, 92);
      graphics.fillEllipse(178, 178, 174, 100);
      tileSpeckles(graphics, [0x529536, 0x27581e, 0x77bb45, 0x1f4519], 0.22, 116);
      for (let index = 0; index < 16; index += 1) {
        leafBlob(graphics, noise(index * 4.3) * 256, noise(index * 7.1) * 256, 11 + noise(index * 2.9) * 13, [0x3f8f28, 0x4fad33, 0x72c44a]);
      }
    });
    create("tile-desert", 256, 256, (graphics) => {
      graphics.fillStyle(0xd7aa54, 1);
      graphics.fillRect(0, 0, 256, 256);
      graphics.fillStyle(0xe9c36d, 0.34);
      graphics.fillEllipse(60, 74, 150, 70);
      graphics.fillEllipse(194, 188, 150, 80);
      tileSpeckles(graphics, [0xe5bf67, 0xc28d35, 0xf4d58c, 0xb5792a], 0.18, 82);
      graphics.lineStyle(3, 0xf8dda0, 0.16);
      for (let index = 0; index < 16; index += 1) {
        const y = noise(index * 3.9) * 256;
        const x = noise(index * 8.2) * 256;
        graphics.lineBetween(x, y, x + 42 + noise(index) * 60, y + Math.sin(index) * 10);
      }
    });
    create("tile-snow", 256, 256, (graphics) => {
      graphics.fillStyle(0xb7cfdd, 1);
      graphics.fillRect(0, 0, 256, 256);
      graphics.fillStyle(0xe0f2fe, 0.32);
      graphics.fillEllipse(70, 64, 154, 72);
      graphics.fillEllipse(184, 184, 168, 86);
      tileSpeckles(graphics, [0xe0f2fe, 0xf8fafc, 0x8fb0c5, 0xc7e4f3], 0.18, 76);
      graphics.lineStyle(2, 0xf8fafc, 0.17);
      for (let index = 0; index < 10; index += 1) {
        const x = noise(index * 6.4) * 256;
        const y = noise(index * 2.8) * 256;
        graphics.lineBetween(x, y, x + 38 + noise(index) * 70, y + 8 + noise(index * 3) * 18);
      }
    });
    create("tile-swamp", 256, 256, (graphics) => {
      graphics.fillStyle(0x3f7a46, 1);
      graphics.fillRect(0, 0, 256, 256);
      tileSpeckles(graphics, [0x5b9b4b, 0x2d5a38, 0x86c45f, 0x255446], 0.18, 88);
      graphics.fillStyle(0x65a5a2, 0.18);
      for (let index = 0; index < 12; index += 1) {
        graphics.fillEllipse(noise(index * 5.7) * 256, noise(index * 8.1) * 256, 44 + noise(index) * 52, 16 + noise(index * 2) * 18);
      }
    });
    create("tile-ash", 256, 256, (graphics) => {
      graphics.fillStyle(0x713a25, 1);
      graphics.fillRect(0, 0, 256, 256);
      graphics.fillStyle(0x451a12, 0.32);
      graphics.fillEllipse(75, 62, 168, 76);
      graphics.fillEllipse(176, 181, 160, 92);
      tileSpeckles(graphics, [0x9a3412, 0xf97316, 0x4a2015, 0xffb347], 0.16, 86);
      graphics.lineStyle(2, 0xfacc15, 0.12);
      for (let index = 0; index < 12; index += 1) {
        const x = noise(index * 4.4) * 256;
        const y = noise(index * 9.7) * 256;
        graphics.lineBetween(x, y, x + 18 + noise(index) * 44, y + noise(index * 2) * 14);
      }
    });
    create("tile-void", 256, 256, (graphics) => {
      graphics.fillStyle(0x3b2454, 1);
      graphics.fillRect(0, 0, 256, 256);
      graphics.fillStyle(0x21123a, 0.42);
      graphics.fillEllipse(54, 76, 158, 84);
      graphics.fillEllipse(188, 178, 172, 92);
      tileSpeckles(graphics, [0x5b2f8b, 0xa855f7, 0x251341, 0x7c3aed], 0.17, 82);
      graphics.fillStyle(0xc4b5fd, 0.12);
      for (let index = 0; index < 18; index += 1) {
        graphics.fillCircle(noise(index * 9.5) * 256, noise(index * 2.6) * 256, 2 + noise(index) * 4);
      }
    });
    create("tile-water", 256, 256, (graphics) => {
      graphics.fillStyle(0x54b7cf, 1);
      graphics.fillRect(0, 0, 256, 256);
      graphics.fillStyle(0x7dd3fc, 0.22);
      graphics.fillEllipse(78, 58, 170, 64);
      graphics.fillEllipse(182, 176, 185, 72);
      graphics.lineStyle(2, 0xc7f9ff, 0.14);
      graphics.lineBetween(22, 98, 96, 98);
      graphics.lineBetween(146, 46, 230, 46);
      graphics.lineStyle(2, 0x075985, 0.1);
      graphics.lineBetween(44, 174, 140, 174);
      graphics.lineBetween(172, 126, 244, 126);
    });
    create("tile-meadow", 256, 256, (graphics) => {
      graphics.fillStyle(0x64a83f, 1);
      graphics.fillRect(0, 0, 256, 256);
      graphics.fillStyle(0x8bcf55, 0.28);
      graphics.fillEllipse(52, 68, 150, 68);
      graphics.fillEllipse(186, 184, 172, 76);
      tileSpeckles(graphics, [0x9be15d, 0xfef08a, 0xf9a8d4, 0xffffff, 0x3f7c2c], 0.18, 150);
      softGrassBlades(graphics, 0xf0f9b5, 0.14, 58);
    });
    create("tile-moss", 256, 256, (graphics) => {
      graphics.fillStyle(0x24513a, 1);
      graphics.fillRect(0, 0, 256, 256);
      graphics.fillStyle(0x173628, 0.36);
      graphics.fillEllipse(70, 80, 178, 98);
      graphics.fillEllipse(186, 172, 166, 92);
      tileSpeckles(graphics, [0x3f7f43, 0x65a30d, 0x14372a, 0x86efac], 0.2, 120);
      for (let index = 0; index < 22; index += 1) {
        graphics.fillStyle(index % 2 === 0 ? 0xe9d5ff : 0xddd6fe, 0.18);
        graphics.fillCircle(noise(index * 11.3) * 256, noise(index * 6.8) * 256, 4 + noise(index) * 7);
      }
    });
    create("tile-stone", 256, 256, (graphics) => {
      graphics.fillStyle(0x58616e, 1);
      graphics.fillRect(0, 0, 256, 256);
      tileSpeckles(graphics, [0x94a3b8, 0x374151, 0x64748b, 0xcbd5e1], 0.18, 92);
      graphics.lineStyle(2, 0x1f2937, 0.16);
      for (let index = 0; index < 18; index += 1) {
        const x = noise(index * 4.7) * 256;
        const y = noise(index * 9.1) * 256;
        graphics.strokeEllipse(x, y, 54 + noise(index) * 66, 22 + noise(index * 2) * 32);
      }
    });
    create("tile-crystal", 256, 256, (graphics) => {
      graphics.fillStyle(0x34204f, 1);
      graphics.fillRect(0, 0, 256, 256);
      tileSpeckles(graphics, [0x7c3aed, 0xa78bfa, 0x22d3ee, 0x1e1b4b], 0.19, 110);
      for (let index = 0; index < 14; index += 1) {
        const x = noise(index * 8.4) * 256;
        const y = noise(index * 3.2) * 256;
        graphics.fillStyle(index % 2 === 0 ? 0xa78bfa : 0x67e8f9, 0.22);
        graphics.fillTriangle(x, y - 18, x - 9, y + 14, x + 13, y + 12);
      }
    });
    create("tile-dungeon", 256, 256, (graphics) => {
      graphics.fillStyle(0x2b2b31, 1);
      graphics.fillRect(0, 0, 256, 256);
      tileSpeckles(graphics, [0x111827, 0x4b5563, 0x7c4a25, 0x6b7280], 0.2, 100);
      graphics.lineStyle(3, 0x0f172a, 0.22);
      for (let y = 0; y < 256; y += 48) {
        graphics.lineBetween(0, y, 256, y + Math.sin(y) * 8);
      }
      for (let x = 0; x < 256; x += 64) {
        graphics.lineBetween(x, 0, x + Math.sin(x) * 10, 256);
      }
    });
    create("tile-road", 192, 96, (graphics) => {
      graphics.fillStyle(0x4b3523, 1);
      graphics.fillRoundedRect(0, 10, 192, 76, 16);
      tileSpeckles(graphics, [0x6b4f32, 0x9a7a4d, 0x2f2418], 0.26);
      graphics.lineStyle(3, 0xc49a63, 0.18);
      graphics.lineBetween(0, 25, 192, 22);
      graphics.lineBetween(0, 72, 192, 75);
    });
    create("city-house", 128, 108, (graphics) => {
      graphics.fillStyle(0x060807, 0.32);
      graphics.fillEllipse(64, 92, 92, 18);
      graphics.fillStyle(0x342318, 1);
      graphics.fillRoundedRect(28, 46, 72, 42, 7);
      graphics.fillStyle(0x61422a, 1);
      graphics.fillRoundedRect(36, 52, 54, 30, 5);
      graphics.fillStyle(0x8b2f18, 1);
      graphics.fillTriangle(18, 50, 64, 18, 110, 50);
      graphics.fillStyle(0xc2410c, 0.9);
      graphics.fillTriangle(28, 48, 64, 24, 100, 48);
      graphics.fillStyle(0xfbbf24, 0.9);
      graphics.fillRect(45, 61, 12, 12);
      graphics.fillRect(72, 61, 12, 12);
      graphics.fillStyle(0x1c120b, 0.95);
      graphics.fillRoundedRect(58, 67, 13, 22, 3);
      graphics.lineStyle(2, 0xfde68a, 0.24);
      graphics.lineBetween(24, 52, 64, 23);
      graphics.lineBetween(104, 52, 64, 23);
    });
    create("city-house-blue", 128, 112, (graphics) => {
      graphics.fillStyle(0x020617, 0.34);
      graphics.fillEllipse(64, 96, 94, 18);
      graphics.fillStyle(0x263b42, 1);
      graphics.fillRoundedRect(26, 42, 76, 48, 7);
      graphics.fillStyle(0x40606c, 1);
      graphics.fillRoundedRect(37, 52, 52, 31, 5);
      graphics.fillStyle(0x1e3a5f, 1);
      graphics.fillTriangle(16, 46, 64, 12, 112, 46);
      graphics.fillStyle(0x38bdf8, 0.18);
      graphics.fillTriangle(29, 45, 64, 22, 99, 45);
      graphics.fillStyle(0xfde68a, 0.86);
      graphics.fillRect(43, 61, 11, 12);
      graphics.fillRect(75, 61, 11, 12);
      graphics.fillStyle(0x0f172a, 0.95);
      graphics.fillRoundedRect(58, 68, 14, 23, 3);
      graphics.lineStyle(3, 0x93c5fd, 0.22);
      graphics.strokeRoundedRect(26, 42, 76, 48, 7);
    });
    create("city-house-green", 132, 106, (graphics) => {
      graphics.fillStyle(0x020617, 0.32);
      graphics.fillEllipse(66, 91, 94, 18);
      graphics.fillStyle(0x3b2a1d, 1);
      graphics.fillRoundedRect(24, 44, 84, 43, 7);
      graphics.fillStyle(0x5c432d, 1);
      graphics.fillRoundedRect(34, 52, 61, 28, 4);
      graphics.fillStyle(0x166534, 1);
      graphics.fillTriangle(16, 48, 66, 18, 116, 48);
      graphics.fillStyle(0x22c55e, 0.16);
      graphics.fillTriangle(29, 46, 66, 25, 103, 46);
      graphics.fillStyle(0xfacc15, 0.82);
      graphics.fillRect(45, 61, 11, 11);
      graphics.fillRect(78, 61, 11, 11);
      graphics.fillStyle(0x1f130b, 0.96);
      graphics.fillRoundedRect(61, 66, 13, 22, 3);
      graphics.lineStyle(2, 0xbbf7d0, 0.22);
      graphics.lineBetween(23, 51, 66, 22);
      graphics.lineBetween(110, 51, 66, 22);
    });
    create("city-house-stone", 132, 116, (graphics) => {
      graphics.fillStyle(0x020617, 0.34);
      graphics.fillEllipse(66, 99, 96, 18);
      graphics.fillStyle(0x475569, 1);
      graphics.fillRoundedRect(25, 44, 82, 49, 6);
      graphics.fillStyle(0x64748b, 1);
      graphics.fillRoundedRect(36, 52, 58, 32, 4);
      graphics.fillStyle(0x334155, 1);
      graphics.fillRect(24, 36, 84, 14);
      graphics.fillStyle(0x94a3b8, 0.35);
      for (let x = 35; x < 96; x += 18) {
        graphics.fillRect(x, 58, 10, 7);
      }
      graphics.fillStyle(0xfde68a, 0.82);
      graphics.fillRect(48, 69, 10, 12);
      graphics.fillRect(76, 69, 10, 12);
      graphics.fillStyle(0x0f172a, 0.95);
      graphics.fillRoundedRect(60, 72, 14, 22, 3);
    });
    create("city-market", 148, 106, (graphics) => {
      graphics.fillStyle(0x020617, 0.28);
      graphics.fillEllipse(74, 91, 120, 16);
      graphics.fillStyle(0x6b3f24, 1);
      graphics.fillRoundedRect(28, 62, 92, 26, 5);
      graphics.fillStyle(0xfacc15, 0.86);
      graphics.fillTriangle(20, 63, 52, 30, 84, 63);
      graphics.fillStyle(0xef4444, 0.86);
      graphics.fillTriangle(64, 63, 96, 30, 128, 63);
      graphics.fillStyle(0x1f2937, 0.9);
      graphics.fillRect(45, 61, 5, 30);
      graphics.fillRect(96, 61, 5, 30);
      graphics.fillStyle(0xfde68a, 0.7);
      graphics.fillRect(44, 74, 58, 8);
    });
    create("city-shrine", 122, 132, (graphics) => {
      graphics.fillStyle(0x020617, 0.34);
      graphics.fillEllipse(61, 115, 86, 17);
      graphics.fillStyle(0x334155, 1);
      graphics.fillRoundedRect(32, 49, 58, 62, 6);
      graphics.fillStyle(0x64748b, 1);
      graphics.fillRect(23, 40, 76, 18);
      graphics.fillStyle(0xa78bfa, 0.9);
      graphics.fillTriangle(22, 42, 61, 9, 100, 42);
      graphics.fillStyle(0x67e8f9, 0.92);
      graphics.fillCircle(61, 74, 13);
      graphics.lineStyle(4, 0xddd6fe, 0.3);
      graphics.strokeCircle(61, 74, 23);
      graphics.fillStyle(0x111827, 0.95);
      graphics.fillRoundedRect(53, 92, 16, 20, 4);
    });
    create("city-tower", 112, 138, (graphics) => {
      graphics.fillStyle(0x020617, 0.36);
      graphics.fillEllipse(56, 120, 78, 18);
      graphics.fillStyle(0x334155, 1);
      graphics.fillRoundedRect(31, 42, 50, 72, 6);
      graphics.fillStyle(0x475569, 1);
      graphics.fillRect(24, 28, 64, 22);
      graphics.fillStyle(0x64748b, 1);
      graphics.fillRect(29, 18, 12, 20);
      graphics.fillRect(50, 18, 12, 20);
      graphics.fillRect(71, 18, 12, 20);
      graphics.fillStyle(0xdbeafe, 0.36);
      graphics.fillRect(43, 62, 8, 15);
      graphics.fillRect(62, 62, 8, 15);
      graphics.fillStyle(0xfacc15, 0.42);
      graphics.fillRect(52, 91, 10, 20);
      graphics.lineStyle(3, 0xe2e8f0, 0.16);
      graphics.lineBetween(32, 50, 80, 50);
      graphics.lineBetween(32, 82, 80, 82);
    });
    create("city-keep", 172, 142, (graphics) => {
      graphics.fillStyle(0x020617, 0.38);
      graphics.fillEllipse(86, 124, 136, 22);
      graphics.fillStyle(0x293548, 1);
      graphics.fillRoundedRect(40, 54, 92, 58, 9);
      graphics.fillStyle(0x475569, 1);
      graphics.fillRect(28, 40, 116, 24);
      graphics.fillStyle(0x64748b, 1);
      graphics.fillRect(34, 26, 16, 22);
      graphics.fillRect(76, 22, 20, 26);
      graphics.fillRect(122, 26, 16, 22);
      graphics.fillStyle(0x8b2f18, 1);
      graphics.fillTriangle(34, 42, 86, 8, 138, 42);
      graphics.fillStyle(0xfacc15, 0.78);
      graphics.fillRect(61, 77, 13, 20);
      graphics.fillRect(98, 77, 13, 20);
      graphics.fillStyle(0x111827, 0.9);
      graphics.fillRoundedRect(78, 91, 18, 22, 4);
      graphics.lineStyle(4, 0xfde68a, 0.18);
      graphics.strokeRoundedRect(40, 54, 92, 58, 9);
    });
    create("city-wall", 160, 54, (graphics) => {
      graphics.fillStyle(0x1f2937, 0.35);
      graphics.fillEllipse(80, 44, 130, 12);
      graphics.fillStyle(0x475569, 1);
      graphics.fillRoundedRect(8, 18, 144, 26, 5);
      graphics.fillStyle(0x64748b, 1);
      for (let x = 12; x < 146; x += 22) {
        graphics.fillRect(x, 8, 15, 18);
      }
      graphics.lineStyle(2, 0xe2e8f0, 0.26);
      graphics.lineBetween(12, 35, 148, 35);
      graphics.lineStyle(2, 0x1e293b, 0.36);
      for (let x = 20; x < 145; x += 28) {
        graphics.lineBetween(x, 21, x, 43);
      }
    });
    create("obstacle-fence", 320, 118, (graphics) => {
      graphics.fillStyle(0x020617, 0.24);
      graphics.fillEllipse(160, 94, 286, 28);
      graphics.lineStyle(13, 0x3b2414, 0.96);
      graphics.lineBetween(26, 63, 294, 37);
      graphics.lineStyle(7, 0xb7793e, 0.88);
      graphics.lineBetween(30, 56, 290, 31);
      graphics.lineStyle(6, 0x2a160c, 0.86);
      graphics.lineBetween(34, 76, 286, 51);
      graphics.lineStyle(3, 0xe7b86b, 0.5);
      graphics.lineBetween(36, 49, 286, 25);
      for (let x = 42; x <= 278; x += 34) {
        const lean = ((x / 34) % 2 === 0 ? -1 : 1) * 0.08;
        graphics.fillStyle(0x2a160c, 0.98);
        graphics.fillRoundedRect(x - 6, 22, 12, 76, 5);
        graphics.fillStyle(0x6b3f20, 0.98);
        graphics.fillRoundedRect(x - 5 + lean * 12, 18, 10, 70, 4);
        graphics.fillStyle(0xd6a15d, 0.42);
        graphics.fillTriangle(x - 5 + lean * 12, 18, x + lean * 12, 5, x + 5 + lean * 12, 18);
      }
      graphics.fillStyle(0x7f1d1d, 0.66);
      graphics.fillTriangle(126, 40, 154, 30, 130, 72);
      graphics.fillStyle(0xfacc15, 0.7);
      graphics.fillTriangle(188, 34, 218, 24, 194, 66);
    });
    create("obstacle-ruin", 260, 132, (graphics) => {
      graphics.fillStyle(0x020617, 0.3);
      graphics.fillEllipse(130, 110, 214, 24);
      graphics.fillStyle(0x334155, 0.98);
      graphics.fillRoundedRect(35, 58, 36, 50, 6);
      graphics.fillRoundedRect(190, 45, 34, 64, 6);
      graphics.fillStyle(0x475569, 0.96);
      graphics.fillRoundedRect(66, 42, 132, 32, 5);
      graphics.fillStyle(0x64748b, 0.82);
      graphics.fillRect(78, 49, 24, 14);
      graphics.fillRect(118, 48, 22, 15);
      graphics.fillRect(158, 49, 26, 14);
      graphics.fillStyle(0x1f2937, 0.9);
      graphics.fillTriangle(60, 108, 112, 75, 104, 108);
      graphics.fillTriangle(148, 108, 220, 70, 210, 108);
      graphics.lineStyle(4, 0xe2e8f0, 0.22);
      graphics.lineBetween(68, 73, 198, 73);
      graphics.lineBetween(46, 92, 220, 82);
      graphics.lineStyle(3, 0x111827, 0.28);
      graphics.lineBetween(96, 45, 92, 72);
      graphics.lineBetween(151, 44, 157, 75);
    });
    create("obstacle-boulder", 210, 138, (graphics) => {
      graphics.fillStyle(0x020617, 0.28);
      graphics.fillEllipse(105, 112, 156, 24);
      graphics.fillStyle(0x334155, 1);
      graphics.fillEllipse(84, 80, 92, 62);
      graphics.fillStyle(0x475569, 0.96);
      graphics.fillEllipse(128, 72, 82, 72);
      graphics.fillStyle(0x64748b, 0.9);
      graphics.fillEllipse(112, 54, 68, 50);
      graphics.fillStyle(0x111827, 0.24);
      graphics.fillEllipse(76, 91, 54, 22);
      graphics.fillEllipse(143, 90, 46, 24);
      graphics.lineStyle(4, 0xcbd5e1, 0.18);
      graphics.lineBetween(67, 64, 108, 45);
      graphics.lineBetween(119, 51, 153, 75);
      graphics.lineStyle(3, 0x0f172a, 0.22);
      graphics.lineBetween(96, 92, 136, 63);
    });
    create("obstacle-tree-line", 280, 132, (graphics) => {
      graphics.fillStyle(0x020617, 0.24);
      graphics.fillEllipse(140, 108, 220, 24);
      graphics.lineStyle(24, 0x3b2414, 1);
      graphics.lineBetween(34, 82, 246, 50);
      graphics.lineStyle(13, 0x7c4a25, 0.96);
      graphics.lineBetween(38, 75, 242, 44);
      graphics.lineStyle(4, 0xd6a15d, 0.28);
      graphics.lineBetween(50, 66, 234, 38);
      graphics.fillStyle(0x12351f, 0.98);
      graphics.fillCircle(52, 50, 34);
      graphics.fillCircle(228, 38, 38);
      graphics.fillStyle(0x1f5d33, 0.9);
      graphics.fillCircle(76, 35, 24);
      graphics.fillCircle(204, 24, 26);
    });
    create("city-gate", 184, 138, (graphics) => {
      graphics.fillStyle(0x020617, 0.36);
      graphics.fillEllipse(92, 120, 146, 20);
      graphics.fillStyle(0x334155, 1);
      graphics.fillRoundedRect(24, 52, 136, 62, 8);
      graphics.fillStyle(0x475569, 1);
      graphics.fillRoundedRect(18, 34, 42, 84, 7);
      graphics.fillRoundedRect(124, 34, 42, 84, 7);
      graphics.fillStyle(0x64748b, 1);
      for (let x = 21; x <= 147; x += 21) {
        graphics.fillRect(x, 24, 13, 18);
      }
      graphics.fillStyle(0x17130e, 0.98);
      graphics.fillRoundedRect(70, 62, 44, 55, 18);
      graphics.fillStyle(0x5b3418, 0.94);
      graphics.fillRoundedRect(75, 70, 34, 47, 14);
      graphics.lineStyle(4, 0xd1d5db, 0.22);
      graphics.strokeRoundedRect(70, 62, 44, 55, 18);
      graphics.fillStyle(0xfacc15, 0.78);
      graphics.fillCircle(92, 89, 5);
      graphics.fillStyle(0xef4444, 0.86);
      graphics.fillTriangle(40, 18, 78, 29, 40, 40);
      graphics.fillStyle(0x38bdf8, 0.82);
      graphics.fillTriangle(144, 18, 106, 29, 144, 40);
    });
    create("city-fountain", 120, 94, (graphics) => {
      graphics.fillStyle(0x020617, 0.3);
      graphics.fillEllipse(60, 78, 92, 16);
      graphics.fillStyle(0x475569, 0.96);
      graphics.fillEllipse(60, 60, 90, 36);
      graphics.fillStyle(0x0e7490, 0.88);
      graphics.fillEllipse(60, 56, 70, 24);
      graphics.lineStyle(4, 0xcbd5e1, 0.52);
      graphics.strokeEllipse(60, 60, 90, 36);
      graphics.fillStyle(0x94a3b8, 1);
      graphics.fillRoundedRect(52, 28, 16, 34, 6);
      graphics.fillStyle(0x67e8f9, 0.76);
      graphics.fillCircle(60, 24, 8);
      graphics.lineStyle(3, 0xbae6fd, 0.7);
      graphics.lineBetween(60, 22, 43, 51);
      graphics.lineBetween(60, 22, 77, 51);
      graphics.lineBetween(60, 22, 60, 55);
    });
    create("city-tent", 128, 96, (graphics) => {
      graphics.fillStyle(0x020617, 0.28);
      graphics.fillEllipse(64, 82, 100, 15);
      graphics.fillStyle(0x7c2d12, 0.96);
      graphics.fillTriangle(20, 76, 64, 18, 108, 76);
      graphics.fillStyle(0xfacc15, 0.84);
      graphics.fillTriangle(36, 74, 64, 28, 92, 74);
      graphics.fillStyle(0x3b2414, 0.94);
      graphics.fillRoundedRect(55, 58, 18, 20, 5);
      graphics.lineStyle(4, 0xfef3c7, 0.26);
      graphics.lineBetween(20, 76, 64, 18);
      graphics.lineBetween(108, 76, 64, 18);
      graphics.fillStyle(0x111827, 0.7);
      graphics.fillRect(17, 75, 94, 6);
    });
    create("city-banner", 64, 130, (graphics) => {
      graphics.fillStyle(0x020617, 0.28);
      graphics.fillEllipse(32, 116, 36, 9);
      graphics.fillStyle(0x3b2414, 1);
      graphics.fillRoundedRect(29, 20, 7, 96, 3);
      graphics.fillStyle(0xfacc15, 0.95);
      graphics.fillCircle(32, 18, 6);
      graphics.fillStyle(0x7f1d1d, 0.92);
      graphics.fillTriangle(36, 24, 58, 40, 36, 56);
      graphics.fillStyle(0xef4444, 0.76);
      graphics.fillTriangle(36, 55, 55, 70, 36, 85);
      graphics.lineStyle(2, 0xfef3c7, 0.42);
      graphics.lineBetween(36, 28, 54, 41);
      graphics.lineBetween(36, 59, 51, 70);
    });
    create("city-dock", 188, 80, (graphics) => {
      graphics.fillStyle(0x020617, 0.22);
      graphics.fillEllipse(94, 66, 160, 13);
      graphics.fillStyle(0x5b3418, 0.98);
      graphics.fillRoundedRect(16, 30, 156, 24, 6);
      graphics.fillStyle(0x7c4a25, 0.96);
      for (let x = 24; x < 164; x += 22) {
        graphics.fillRoundedRect(x, 22, 8, 42, 3);
      }
      graphics.lineStyle(3, 0xd6a15d, 0.28);
      graphics.lineBetween(18, 38, 170, 38);
      graphics.lineBetween(18, 50, 170, 50);
      graphics.fillStyle(0x1e3a8a, 0.26);
      graphics.fillEllipse(94, 69, 142, 18);
    });
    create("decor-lamp", 46, 112, (graphics) => {
      graphics.fillStyle(0x020617, 0.26);
      graphics.fillEllipse(23, 100, 34, 8);
      graphics.fillStyle(0x3b2414, 1);
      graphics.fillRoundedRect(20, 34, 6, 66, 3);
      graphics.fillStyle(0xd6a15d, 0.96);
      graphics.fillRoundedRect(13, 22, 20, 18, 5);
      graphics.fillStyle(0xfacc15, 0.86);
      graphics.fillCircle(23, 31, 8);
      graphics.fillStyle(0xf97316, 0.18);
      graphics.fillCircle(23, 31, 22);
      graphics.lineStyle(2, 0xfef3c7, 0.36);
      graphics.strokeRoundedRect(13, 22, 20, 18, 5);
    });
    create("decor-grave", 58, 76, (graphics) => {
      graphics.fillStyle(0x020617, 0.3);
      graphics.fillEllipse(29, 66, 42, 9);
      graphics.fillStyle(0x64748b, 0.96);
      graphics.fillRoundedRect(15, 26, 28, 38, 9);
      graphics.fillStyle(0x94a3b8, 0.72);
      graphics.fillRoundedRect(20, 18, 18, 14, 7);
      graphics.lineStyle(3, 0xe5e7eb, 0.28);
      graphics.lineBetween(29, 31, 29, 52);
      graphics.lineBetween(21, 41, 37, 41);
    });
    create("decor-bone", 76, 44, (graphics) => {
      graphics.fillStyle(0x020617, 0.18);
      graphics.fillEllipse(38, 35, 54, 7);
      graphics.lineStyle(8, 0xe5e7eb, 0.9);
      graphics.lineBetween(18, 27, 58, 18);
      graphics.fillStyle(0xf8fafc, 0.92);
      graphics.fillCircle(15, 28, 8);
      graphics.fillCircle(21, 20, 7);
      graphics.fillCircle(55, 17, 7);
      graphics.fillCircle(62, 24, 8);
      graphics.lineStyle(2, 0x94a3b8, 0.42);
      graphics.lineBetween(26, 25, 50, 20);
    });
    create("decor-ruin", 110, 84, (graphics) => {
      graphics.fillStyle(0x020617, 0.28);
      graphics.fillEllipse(55, 72, 86, 11);
      graphics.fillStyle(0x475569, 0.95);
      graphics.fillRoundedRect(20, 32, 18, 38, 5);
      graphics.fillRoundedRect(72, 24, 18, 46, 5);
      graphics.fillStyle(0x64748b, 0.86);
      graphics.fillRect(28, 22, 58, 14);
      graphics.fillStyle(0x334155, 0.94);
      graphics.fillTriangle(17, 70, 49, 42, 44, 70);
      graphics.lineStyle(3, 0xd1d5db, 0.22);
      graphics.lineBetween(31, 36, 79, 36);
      graphics.lineBetween(28, 53, 87, 48);
    });
    create("decor-obelisk", 86, 146, (graphics) => {
      graphics.fillStyle(0x020617, 0.36);
      graphics.fillEllipse(43, 126, 62, 14);
      graphics.fillStyle(0x312e81, 1);
      graphics.fillTriangle(43, 8, 20, 112, 66, 112);
      graphics.fillStyle(0x4c1d95, 0.92);
      graphics.fillTriangle(43, 8, 43, 112, 66, 112);
      graphics.fillStyle(0xc4b5fd, 0.42);
      graphics.fillTriangle(43, 18, 35, 70, 46, 88);
      graphics.lineStyle(4, 0xa78bfa, 0.44);
      graphics.lineBetween(43, 16, 43, 108);
      graphics.fillStyle(0xf5f3ff, 0.76);
      graphics.fillCircle(43, 68, 7);
    });
    create("npc-merchant", 86, 118, (graphics) => {
      graphics.fillStyle(0x020617, 0.34);
      graphics.fillEllipse(43, 105, 58, 15);
      graphics.fillStyle(0x5b3418, 1);
      graphics.fillRoundedRect(24, 48, 38, 48, 8);
      graphics.fillStyle(0xc58b45, 1);
      graphics.fillRoundedRect(18, 42, 50, 18, 7);
      graphics.fillStyle(0xf1c27d, 1);
      graphics.fillCircle(43, 28, 12);
      graphics.fillStyle(0x3b2414, 0.94);
      graphics.fillTriangle(28, 29, 43, 11, 58, 29);
      graphics.fillStyle(0xfacc15, 0.92);
      graphics.fillRoundedRect(57, 54, 20, 28, 5);
      graphics.fillStyle(0x7c2d12, 0.9);
      graphics.fillRect(60, 58, 14, 6);
      graphics.fillStyle(0x1f2937, 0.86);
      graphics.fillRoundedRect(27, 78, 11, 25, 4);
      graphics.fillRoundedRect(48, 78, 11, 25, 4);
      graphics.lineStyle(3, 0xfde68a, 0.3);
      graphics.strokeRoundedRect(18, 42, 50, 54, 8);
    });
    create("city-teleporter", 114, 138, (graphics) => {
      graphics.fillStyle(0x020617, 0.36);
      graphics.fillEllipse(57, 120, 82, 18);
      graphics.fillStyle(0x2e1065, 0.92);
      graphics.fillRoundedRect(29, 40, 56, 78, 14);
      graphics.fillStyle(0x111827, 0.92);
      graphics.fillRoundedRect(39, 50, 36, 58, 18);
      graphics.lineStyle(7, 0x8b5cf6, 0.9);
      graphics.strokeRoundedRect(30, 40, 54, 78, 14);
      graphics.lineStyle(3, 0x67e8f9, 0.82);
      graphics.strokeRoundedRect(39, 50, 36, 58, 18);
      graphics.fillStyle(0xc4b5fd, 0.55);
      graphics.fillCircle(57, 76, 18);
      graphics.fillStyle(0xfacc15, 0.88);
      graphics.fillCircle(57, 20, 9);
      graphics.fillStyle(0x4c1d95, 0.82);
      graphics.fillTriangle(22, 44, 57, 10, 92, 44);
    });
    create("resource-herb", 58, 58, (graphics) => {
      graphics.fillStyle(0x052e16, 0.28);
      graphics.fillEllipse(29, 48, 42, 10);
      graphics.lineStyle(4, 0x86efac, 0.95);
      graphics.lineBetween(29, 48, 22, 18);
      graphics.lineBetween(29, 48, 34, 12);
      graphics.lineBetween(29, 48, 42, 22);
      graphics.fillStyle(0x22c55e, 0.9);
      graphics.fillEllipse(19, 26, 18, 8);
      graphics.fillEllipse(40, 28, 18, 8);
      graphics.fillStyle(0xf0fdf4, 0.7);
      graphics.fillCircle(31, 18, 5);
    });
    create("resource-ore", 58, 58, (graphics) => {
      graphics.fillStyle(0x020617, 0.3);
      graphics.fillEllipse(29, 48, 42, 10);
      graphics.fillStyle(0x475569, 1);
      graphics.fillTriangle(11, 45, 25, 16, 39, 45);
      graphics.fillStyle(0x64748b, 1);
      graphics.fillTriangle(28, 48, 42, 12, 52, 48);
      graphics.fillStyle(0xcbd5e1, 0.75);
      graphics.fillTriangle(27, 22, 34, 31, 25, 33);
    });
    create("resource-wood", 64, 58, (graphics) => {
      graphics.fillStyle(0x020617, 0.28);
      graphics.fillEllipse(32, 48, 48, 10);
      graphics.fillStyle(0x7c2d12, 1);
      graphics.fillRoundedRect(12, 22, 40, 17, 8);
      graphics.fillRoundedRect(20, 34, 36, 14, 7);
      graphics.lineStyle(3, 0xf59e0b, 0.38);
      graphics.strokeEllipse(17, 30, 12, 14);
      graphics.lineBetween(24, 28, 48, 28);
    });
    create("resource-chest", 72, 62, (graphics) => {
      graphics.fillStyle(0x020617, 0.34);
      graphics.fillEllipse(36, 52, 54, 12);
      graphics.fillStyle(0x7c3f16, 1);
      graphics.fillRoundedRect(13, 24, 46, 25, 6);
      graphics.fillStyle(0xa16207, 1);
      graphics.fillRoundedRect(16, 16, 40, 20, 8);
      graphics.lineStyle(4, 0xfacc15, 0.8);
      graphics.lineBetween(36, 18, 36, 50);
      graphics.lineStyle(3, 0x2d160b, 0.7);
      graphics.strokeRoundedRect(13, 24, 46, 25, 6);
      graphics.fillStyle(0xfef3c7, 0.95);
      graphics.fillRoundedRect(31, 31, 10, 10, 3);
    });
    create("drop-gold", 54, 46, (graphics) => {
      graphics.fillStyle(0x020617, 0.3);
      graphics.fillEllipse(27, 38, 42, 9);
      graphics.fillStyle(0xfacc15, 1);
      graphics.fillCircle(20, 28, 8);
      graphics.fillCircle(30, 23, 9);
      graphics.fillCircle(36, 31, 7);
      graphics.lineStyle(2, 0xfef3c7, 0.72);
      graphics.strokeCircle(30, 23, 9);
      graphics.strokeCircle(20, 28, 8);
    });
    create("drop-coin", 54, 50, (graphics) => {
      graphics.fillStyle(0x020617, 0.32);
      graphics.fillEllipse(27, 42, 42, 9);
      graphics.fillStyle(0xeab308, 0.92);
      graphics.fillCircle(27, 25, 14);
      graphics.fillStyle(0xfef08a, 0.86);
      graphics.fillCircle(27, 25, 9);
      graphics.lineStyle(3, 0x92400e, 0.65);
      graphics.strokeCircle(27, 25, 14);
      graphics.lineStyle(2, 0x92400e, 0.45);
      graphics.lineBetween(22, 25, 32, 25);
    });
    create("drop-pvp-coin", 58, 52, (graphics) => {
      graphics.fillStyle(0x020617, 0.34);
      graphics.fillEllipse(29, 44, 44, 10);
      graphics.fillStyle(0x7f1d1d, 0.96);
      graphics.fillCircle(29, 26, 15);
      graphics.fillStyle(0xef4444, 0.9);
      graphics.fillCircle(29, 26, 10);
      graphics.lineStyle(3, 0xfecaca, 0.74);
      graphics.strokeCircle(29, 26, 15);
      graphics.lineStyle(2, 0x450a0a, 0.64);
      graphics.lineBetween(23, 26, 35, 26);
      graphics.lineBetween(29, 20, 29, 32);
    });
    create("drop-item", 58, 52, (graphics) => {
      graphics.fillStyle(0x020617, 0.32);
      graphics.fillEllipse(29, 43, 44, 10);
      graphics.fillStyle(0x7c2d12, 1);
      graphics.fillRoundedRect(16, 19, 26, 22, 5);
      graphics.fillStyle(0xd6a15d, 0.92);
      graphics.fillRoundedRect(19, 16, 20, 8, 4);
      graphics.lineStyle(3, 0xfef3c7, 0.42);
      graphics.strokeRoundedRect(16, 19, 26, 22, 5);
    });
    create("drop-rare", 64, 58, (graphics) => {
      graphics.fillStyle(0x020617, 0.34);
      graphics.fillEllipse(32, 48, 48, 11);
      graphics.fillStyle(0x6d28d9, 0.95);
      graphics.fillRoundedRect(17, 22, 30, 24, 6);
      graphics.fillStyle(0xfacc15, 0.95);
      graphics.fillCircle(32, 18, 7);
      graphics.lineStyle(4, 0xfef3c7, 0.5);
      graphics.strokeRoundedRect(17, 22, 30, 24, 6);
      graphics.lineStyle(2, 0xc4b5fd, 0.72);
      graphics.strokeCircle(32, 34, 20);
    });

    const createCharacter = (key: string, primary: number, secondary: number, metal: number, accent: number, silhouette: "heavy" | "light" | "robe", headless = false) => {
      create(key, 96, 116, (graphics) => {
        const heavy = silhouette === "heavy";
        const robe = silhouette === "robe";
        graphics.fillStyle(0x020617, 0.34);
        graphics.fillEllipse(48, 102, heavy ? 62 : 52, 15);
        graphics.fillStyle(0x111827, 0.65);
        graphics.fillEllipse(48, 68, heavy ? 50 : 42, robe ? 58 : 48);
        graphics.fillStyle(primary, 0.34);
        graphics.fillTriangle(48, 34, heavy ? 14 : 20, 101, heavy ? 82 : 76, 101);
        graphics.fillStyle(secondary, 1);
        if (robe) {
          graphics.fillTriangle(48, 28, 22, 96, 74, 96);
          graphics.fillRoundedRect(31, 42, 34, 42, 10);
        } else {
          graphics.fillRoundedRect(31, 42, 34, 42, 9);
          graphics.fillRoundedRect(24, 50, 14, 30, 7);
          graphics.fillRoundedRect(58, 50, 14, 30, 7);
        }
        graphics.fillStyle(primary, 1);
        graphics.fillRoundedRect(34, 38, 28, 42, 8);
        graphics.fillStyle(metal, 0.92);
        graphics.fillEllipse(30, 45, heavy ? 22 : 16, heavy ? 13 : 10);
        graphics.fillEllipse(66, 45, heavy ? 22 : 16, heavy ? 13 : 10);
        graphics.fillRoundedRect(30, 45, 9, 30, 4);
        graphics.fillRoundedRect(57, 45, 9, 30, 4);
        if (!headless) {
          graphics.fillStyle(0xf1c27d, 1);
          graphics.fillCircle(48, 26, 12);
          graphics.fillStyle(0x1f2937, 0.95);
          graphics.fillTriangle(31, 29, 48, 10, 65, 29);
          if (heavy) {
            graphics.fillStyle(metal, 1);
            graphics.fillRoundedRect(26, 31, 44, 10, 5);
            graphics.fillRect(33, 20, 30, 10);
          }
        }
        if (silhouette === "light") {
          graphics.lineStyle(2, accent, 0.34);
          graphics.lineBetween(35, 38, 61, 78);
          graphics.lineBetween(61, 38, 35, 78);
        }
        if (robe) {
          graphics.lineStyle(2, accent, 0.32);
          graphics.strokeCircle(48, 58, 17);
        }
        if (!headless) {
          graphics.fillStyle(accent, 0.7);
          graphics.fillCircle(43, 25, 2);
          graphics.fillCircle(53, 25, 2);
        }
        graphics.lineStyle(2, accent, 0.24);
        graphics.lineBetween(36, 55, 60, 55);
        graphics.fillStyle(0x111827, 0.82);
        graphics.fillRoundedRect(33, 82, 11, 22, 4);
        graphics.fillRoundedRect(52, 82, 11, 22, 4);
        graphics.fillStyle(metal, 0.78);
        graphics.fillRect(31, 101, 15, 6);
        graphics.fillRect(50, 101, 15, 6);
      });
    };
    createCharacter("char-warrior", 0xa51b1b, 0x5b1111, 0xcbd5e1, 0xfef3c7, "heavy");
    createCharacter("char-assassin", 0x4c1d95, 0x111827, 0xc4b5fd, 0xc084fc, "light");
    createCharacter("char-mage", 0x0e7490, 0x172554, 0x7dd3fc, 0x7dd3fc, "robe");
    createCharacter("char-archer", 0x166534, 0x263a20, 0xd6a15d, 0xbbf7d0, "light");
    createCharacter("char-tank", 0x92400e, 0x3f2a14, 0xfacc15, 0xfef3c7, "heavy");
    createCharacter("char-warrior-headless", 0xa51b1b, 0x5b1111, 0xcbd5e1, 0xfef3c7, "heavy", true);
    createCharacter("char-assassin-headless", 0x4c1d95, 0x111827, 0xc4b5fd, 0xc084fc, "light", true);
    createCharacter("char-mage-headless", 0x0e7490, 0x172554, 0x7dd3fc, 0x7dd3fc, "robe", true);
    createCharacter("char-archer-headless", 0x166534, 0x263a20, 0xd6a15d, 0xbbf7d0, "light", true);
    createCharacter("char-tank-headless", 0x92400e, 0x3f2a14, 0xfacc15, 0xfef3c7, "heavy", true);

    create("mob-wolf", 86, 58, (graphics) => {
      graphics.fillStyle(0x050505, 0.28);
      graphics.fillEllipse(43, 48, 64, 12);
      graphics.fillStyle(0x2d1a0e, 0.9);
      graphics.fillEllipse(38, 31, 52, 30);
      graphics.fillStyle(0x6b3b20, 1);
      graphics.fillEllipse(38, 30, 48, 26);
      graphics.fillStyle(0x8a4f28, 0.9);
      graphics.fillEllipse(34, 25, 36, 15);
      graphics.fillStyle(0x4a2a15, 0.8);
      graphics.fillEllipse(20, 26, 16, 18);
      graphics.fillStyle(0x9a5a2d, 1);
      graphics.fillEllipse(64, 25, 24, 20);
      graphics.fillStyle(0xb9743c, 0.85);
      graphics.fillEllipse(66, 21, 16, 9);
      graphics.fillTriangle(56, 16, 60, 3, 67, 16);
      graphics.fillTriangle(68, 15, 76, 4, 76, 19);
      graphics.fillStyle(0x3a2114, 0.9);
      graphics.fillTriangle(59, 13, 61, 7, 65, 14);
      graphics.fillTriangle(70, 13, 74, 8, 74, 16);
      graphics.fillStyle(0xfbbf24, 0.95);
      graphics.fillCircle(69, 23, 3);
      graphics.fillStyle(0x111827, 1);
      graphics.fillCircle(70, 23, 1.4);
      graphics.fillStyle(0x111827, 0.95);
      graphics.fillEllipse(77, 28, 7, 5);
      graphics.fillStyle(0xf8fafc, 0.9);
      graphics.fillTriangle(72, 32, 75, 36, 70, 35);
      graphics.lineStyle(2, 0x3a2114, 0.6);
      graphics.lineBetween(28, 22, 40, 20);
      graphics.lineBetween(30, 27, 44, 24);
      graphics.lineStyle(4, 0x3a2114, 1);
      graphics.lineBetween(18, 40, 12, 52);
      graphics.lineBetween(32, 42, 28, 54);
      graphics.lineBetween(48, 41, 46, 54);
      graphics.lineStyle(3, 0x6b3b20, 1);
      graphics.lineBetween(14, 30, 4, 38);
    });
    create("mob-boar", 88, 62, (graphics) => {
      graphics.fillStyle(0x050505, 0.3);
      graphics.fillEllipse(44, 52, 62, 12);
      graphics.fillStyle(0x5b3324, 1);
      graphics.fillEllipse(42, 33, 56, 32);
      graphics.fillStyle(0x8b5a3c, 1);
      graphics.fillEllipse(68, 34, 24, 22);
      graphics.fillStyle(0xf8fafc, 0.95);
      graphics.fillTriangle(69, 40, 82, 35, 72, 46);
      graphics.fillTriangle(63, 40, 50, 36, 60, 46);
      graphics.fillStyle(0x21130d, 0.8);
      graphics.fillCircle(72, 31, 3);
    });
    create("mob-spider", 82, 70, (graphics) => {
      graphics.fillStyle(0x050505, 0.34);
      graphics.fillEllipse(41, 56, 56, 12);
      graphics.lineStyle(4, 0x111827, 1);
      for (let index = 0; index < 4; index += 1) {
        const y = 26 + index * 8;
        graphics.lineBetween(35, y, 16, y - 10);
        graphics.lineBetween(16, y - 10, 8, y - 16);
        graphics.lineBetween(47, y, 66, y - 10);
        graphics.lineBetween(66, y - 10, 74, y - 16);
      }
      graphics.fillStyle(0x1e1b4b, 1);
      graphics.fillEllipse(41, 38, 36, 38);
      graphics.fillStyle(0x312e81, 1);
      graphics.fillEllipse(41, 36, 32, 32);
      graphics.fillStyle(0x4338ca, 0.85);
      graphics.fillEllipse(38, 30, 20, 14);
      graphics.fillStyle(0x111827, 0.95);
      graphics.fillEllipse(41, 22, 18, 14);
      graphics.fillStyle(0xef4444, 0.95);
      graphics.fillCircle(35, 20, 3.2);
      graphics.fillCircle(47, 20, 3.2);
      graphics.fillCircle(38, 25, 2);
      graphics.fillCircle(44, 25, 2);
      graphics.fillStyle(0xfecaca, 0.8);
      graphics.fillCircle(34, 19, 1.2);
      graphics.fillCircle(46, 19, 1.2);
      graphics.lineStyle(2, 0x818cf8, 0.55);
      graphics.strokeEllipse(41, 42, 22, 18);
      graphics.lineStyle(2, 0xa78bfa, 0.4);
      graphics.lineBetween(41, 32, 41, 52);
      graphics.fillStyle(0xe5e7eb, 0.85);
      graphics.fillTriangle(37, 15, 35, 8, 40, 13);
      graphics.fillTriangle(45, 15, 47, 8, 42, 13);
    });
    create("mob-bat", 92, 64, (graphics) => {
      graphics.fillStyle(0x050505, 0.22);
      graphics.fillEllipse(46, 54, 48, 9);
      graphics.fillStyle(0x111827, 0.96);
      graphics.fillTriangle(44, 30, 5, 12, 25, 48);
      graphics.fillTriangle(48, 30, 87, 12, 67, 48);
      graphics.fillStyle(0x312e81, 1);
      graphics.fillEllipse(46, 32, 28, 22);
      graphics.fillStyle(0x0f172a, 1);
      graphics.fillTriangle(36, 24, 31, 9, 43, 21);
      graphics.fillTriangle(56, 24, 61, 9, 49, 21);
      graphics.fillStyle(0xf43f5e, 0.9);
      graphics.fillCircle(41, 30, 3);
      graphics.fillCircle(51, 30, 3);
      graphics.lineStyle(2, 0x818cf8, 0.38);
      graphics.lineBetween(17, 22, 44, 31);
      graphics.lineBetween(75, 22, 48, 31);
    });
    create("mob-skeleton", 78, 88, (graphics) => {
      graphics.fillStyle(0x050505, 0.32);
      graphics.fillEllipse(39, 76, 48, 12);
      graphics.fillStyle(0x86efac, 0.1);
      graphics.fillCircle(39, 40, 34);
      graphics.fillStyle(0x9ca3af, 1);
      graphics.fillCircle(39, 22, 15);
      graphics.fillStyle(0xe5e7eb, 1);
      graphics.fillCircle(39, 21, 14);
      graphics.fillStyle(0xf8fafc, 0.7);
      graphics.fillEllipse(36, 16, 14, 8);
      graphics.fillStyle(0x111827, 1);
      graphics.fillEllipse(34, 19, 6, 7);
      graphics.fillEllipse(45, 19, 6, 7);
      graphics.fillStyle(0x4ade80, 0.9);
      graphics.fillCircle(34, 19, 2);
      graphics.fillCircle(45, 19, 2);
      graphics.fillStyle(0x111827, 1);
      graphics.fillTriangle(39, 24, 36, 28, 42, 28);
      graphics.lineStyle(2, 0x111827, 0.8);
      graphics.lineBetween(33, 31, 45, 31);
      graphics.lineBetween(35, 29, 35, 33);
      graphics.lineBetween(39, 29, 39, 33);
      graphics.lineBetween(43, 29, 43, 33);
      graphics.fillStyle(0xd1d5db, 1);
      graphics.fillRoundedRect(31, 36, 16, 26, 5);
      graphics.lineStyle(2, 0x6b7280, 0.9);
      graphics.lineBetween(32, 42, 46, 42);
      graphics.lineBetween(32, 48, 46, 48);
      graphics.lineBetween(32, 54, 46, 54);
      graphics.lineStyle(4, 0xe5e7eb, 1);
      graphics.lineBetween(31, 43, 15, 56);
      graphics.lineBetween(47, 43, 63, 56);
      graphics.lineBetween(34, 60, 27, 79);
      graphics.lineBetween(44, 60, 51, 79);
      graphics.fillStyle(0xe5e7eb, 1);
      graphics.fillCircle(15, 56, 3.4);
      graphics.fillCircle(63, 56, 3.4);
      graphics.lineStyle(3, 0x94a3b8, 1);
      graphics.lineBetween(55, 54, 70, 34);
      graphics.fillStyle(0x4ade80, 0.75);
      graphics.fillCircle(70, 34, 4.6);
      graphics.fillStyle(0xecfdf5, 0.9);
      graphics.fillCircle(70, 34, 2);
    });
    create("mob-bandit", 74, 82, (graphics) => {
      graphics.fillStyle(0x050505, 0.32);
      graphics.fillEllipse(37, 70, 46, 12);
      graphics.fillStyle(0x0b0f16, 0.9);
      graphics.fillRoundedRect(19, 26, 36, 42, 10);
      graphics.fillStyle(0x1f2937, 1);
      graphics.fillRoundedRect(21, 28, 32, 38, 9);
      graphics.fillStyle(0x374151, 0.8);
      graphics.fillRoundedRect(24, 30, 12, 32, 6);
      graphics.fillStyle(0x111827, 1);
      graphics.fillTriangle(18, 32, 37, 8, 56, 32);
      graphics.fillStyle(0x334155, 0.6);
      graphics.fillTriangle(24, 30, 37, 12, 50, 30);
      graphics.fillStyle(0xef4444, 0.9);
      graphics.fillRect(28, 33, 18, 6);
      graphics.fillStyle(0xfacc15, 0.95);
      graphics.fillCircle(33, 36, 2);
      graphics.fillCircle(42, 36, 2);
      graphics.fillStyle(0x78350f, 0.9);
      graphics.fillRect(24, 50, 26, 5);
      graphics.fillStyle(0xd6a15d, 0.9);
      graphics.fillRect(34, 49, 6, 7);
      graphics.lineStyle(5, 0x94a3b8, 1);
      graphics.lineBetween(50, 52, 66, 28);
      graphics.lineStyle(2, 0xe5e7eb, 0.8);
      graphics.lineBetween(52, 49, 64, 30);
      graphics.fillStyle(0x78350f, 1);
      graphics.fillCircle(50, 53, 4);
    });
    create("mob-archer", 82, 86, (graphics) => {
      graphics.fillStyle(0x050505, 0.3);
      graphics.fillEllipse(41, 74, 48, 12);
      graphics.fillStyle(0x14532d, 1);
      graphics.fillRoundedRect(24, 30, 34, 42, 9);
      graphics.fillStyle(0x052e16, 1);
      graphics.fillTriangle(20, 32, 41, 10, 62, 32);
      graphics.fillStyle(0xfbbf24, 0.78);
      graphics.fillRect(30, 39, 20, 5);
      graphics.fillStyle(0xfef3c7, 0.95);
      graphics.fillCircle(41, 25, 12);
      graphics.fillStyle(0x111827, 1);
      graphics.fillCircle(36, 25, 3);
      graphics.fillCircle(46, 25, 3);
      graphics.lineStyle(4, 0x7c2d12, 1);
      graphics.lineBetween(18, 30, 68, 68);
      graphics.lineStyle(3, 0xd97706, 0.9);
      graphics.arc(63, 42, 22, -1.2, 1.2, false);
      graphics.lineStyle(2, 0xfef3c7, 0.75);
      graphics.lineBetween(54, 23, 54, 65);
      graphics.lineStyle(3, 0xf8fafc, 0.92);
      graphics.lineBetween(50, 47, 73, 37);
      graphics.fillStyle(0xf8fafc, 0.95);
      graphics.fillTriangle(73, 37, 66, 34, 67, 42);
    });
    create("mob-golem", 86, 84, (graphics) => {
      graphics.fillStyle(0x050505, 0.34);
      graphics.fillEllipse(43, 72, 58, 14);
      graphics.fillStyle(0x1e293b, 0.9);
      graphics.fillRoundedRect(23, 20, 40, 46, 9);
      graphics.fillStyle(0x475569, 1);
      graphics.fillRoundedRect(25, 22, 36, 42, 8);
      graphics.fillStyle(0x64748b, 0.85);
      graphics.fillRoundedRect(28, 25, 14, 36, 6);
      graphics.fillStyle(0x64748b, 1);
      graphics.fillCircle(24, 35, 14);
      graphics.fillCircle(62, 38, 14);
      graphics.fillStyle(0x94a3b8, 0.6);
      graphics.fillCircle(21, 31, 6);
      graphics.fillCircle(59, 34, 6);
      graphics.lineStyle(2, 0x1e293b, 0.7);
      graphics.lineBetween(30, 44, 40, 52);
      graphics.lineBetween(46, 30, 54, 40);
      graphics.lineBetween(36, 56, 44, 60);
      graphics.fillStyle(0xf59e0b, 0.95);
      graphics.fillRect(33, 31, 8, 9);
      graphics.fillRect(46, 31, 8, 9);
      graphics.fillStyle(0xfef3c7, 0.9);
      graphics.fillRect(35, 33, 4, 5);
      graphics.fillRect(48, 33, 4, 5);
      graphics.fillStyle(0xf59e0b, 0.5);
      graphics.fillCircle(43, 52, 4);
      graphics.fillStyle(0x86efac, 0.35);
      graphics.fillEllipse(30, 22, 10, 5);
      graphics.fillEllipse(56, 63, 12, 5);
    });
    create("mob-wraith", 82, 90, (graphics) => {
      graphics.fillStyle(0x050505, 0.22);
      graphics.fillEllipse(41, 74, 52, 14);
      graphics.fillStyle(0x7c3aed, 0.72);
      graphics.fillEllipse(41, 36, 42, 48);
      graphics.fillTriangle(20, 50, 32, 86, 43, 52);
      graphics.fillTriangle(40, 52, 50, 86, 62, 50);
      graphics.fillStyle(0xf5f3ff, 0.9);
      graphics.fillCircle(34, 32, 4);
      graphics.fillCircle(48, 32, 4);
    });
    create("mob-drake", 112, 88, (graphics) => {
      graphics.fillStyle(0x050505, 0.32);
      graphics.fillEllipse(56, 74, 78, 14);
      graphics.fillStyle(0x450a0a, 0.9);
      graphics.fillTriangle(30, 34, 6, 6, 46, 24);
      graphics.fillTriangle(63, 34, 106, 8, 76, 52);
      graphics.fillStyle(0x7f1d1d, 0.85);
      graphics.fillTriangle(31, 32, 12, 10, 44, 25);
      graphics.fillTriangle(64, 33, 100, 12, 75, 48);
      graphics.lineStyle(2, 0xfca5a5, 0.4);
      graphics.lineBetween(14, 12, 40, 27);
      graphics.lineBetween(24, 18, 42, 29);
      graphics.lineBetween(96, 14, 72, 40);
      graphics.lineBetween(88, 22, 70, 42);
      graphics.fillStyle(0x92400e, 1);
      graphics.fillEllipse(54, 46, 60, 32);
      graphics.fillStyle(0xb45309, 1);
      graphics.fillEllipse(54, 44, 54, 26);
      graphics.fillStyle(0xd97706, 0.85);
      graphics.fillEllipse(50, 39, 36, 14);
      graphics.fillStyle(0xfbbf24, 0.6);
      for (let index = 0; index < 4; index += 1) {
        graphics.fillEllipse(38 + index * 11, 52, 8, 5);
      }
      graphics.fillStyle(0xf97316, 1);
      graphics.fillEllipse(84, 38, 26, 20);
      graphics.fillStyle(0xfb923c, 0.8);
      graphics.fillEllipse(86, 33, 16, 8);
      graphics.fillStyle(0xfef3c7, 0.95);
      graphics.fillCircle(90, 35, 3.4);
      graphics.fillStyle(0x450a0a, 1);
      graphics.fillCircle(91, 35, 1.6);
      graphics.fillStyle(0x450a0a, 0.9);
      graphics.fillTriangle(95, 42, 104, 40, 97, 46);
      graphics.fillStyle(0xfacc15, 0.8);
      graphics.fillTriangle(74, 28, 78, 20, 82, 29);
      graphics.fillTriangle(84, 26, 89, 19, 92, 28);
    });
    create("mob-eye", 88, 78, (graphics) => {
      graphics.fillStyle(0x050505, 0.2);
      graphics.fillEllipse(44, 66, 52, 10);
      graphics.fillStyle(0x581c87, 0.88);
      graphics.fillEllipse(44, 34, 56, 42);
      graphics.fillStyle(0xf8fafc, 0.96);
      graphics.fillEllipse(44, 34, 35, 25);
      graphics.fillStyle(0xef4444, 0.95);
      graphics.fillCircle(44, 34, 10);
      graphics.fillStyle(0x020617, 1);
      graphics.fillCircle(44, 34, 4);
      graphics.lineStyle(3, 0xa78bfa, 0.72);
      graphics.lineBetween(18, 37, 4, 48);
      graphics.lineBetween(70, 37, 84, 48);
      graphics.lineBetween(32, 16, 20, 4);
      graphics.lineBetween(56, 16, 68, 4);
    });
    create("mob-witch", 82, 104, (graphics) => {
      graphics.fillStyle(0x050505, 0.3);
      graphics.fillEllipse(41, 90, 50, 12);
      graphics.fillStyle(0x2e1065, 0.98);
      graphics.fillTriangle(20, 84, 41, 28, 62, 84);
      graphics.fillStyle(0x0f172a, 1);
      graphics.fillTriangle(15, 32, 41, 2, 68, 32);
      graphics.fillStyle(0xa78bfa, 0.85);
      graphics.fillRect(25, 31, 32, 6);
      graphics.fillStyle(0xfef3c7, 0.95);
      graphics.fillCircle(41, 39, 13);
      graphics.fillStyle(0x111827, 1);
      graphics.fillCircle(36, 38, 3);
      graphics.fillCircle(46, 38, 3);
      graphics.lineStyle(4, 0x7c2d12, 1);
      graphics.lineBetween(59, 61, 75, 88);
      graphics.fillStyle(0x22c55e, 0.82);
      graphics.fillCircle(74, 88, 5);
    });
    create("mob-mage", 86, 104, (graphics) => {
      graphics.fillStyle(0x050505, 0.28);
      graphics.fillEllipse(43, 90, 52, 12);
      graphics.fillStyle(0x1e1b4b, 0.98);
      graphics.fillTriangle(20, 86, 43, 30, 66, 86);
      graphics.fillStyle(0x3730a3, 0.9);
      graphics.fillRoundedRect(29, 42, 28, 42, 7);
      graphics.fillStyle(0xe0f2fe, 0.96);
      graphics.fillCircle(43, 36, 13);
      graphics.fillStyle(0x0f172a, 1);
      graphics.fillCircle(38, 35, 3);
      graphics.fillCircle(48, 35, 3);
      graphics.fillStyle(0x312e81, 1);
      graphics.fillTriangle(18, 33, 43, 4, 68, 33);
      graphics.fillStyle(0x38bdf8, 0.82);
      graphics.fillRect(27, 33, 34, 6);
      graphics.lineStyle(4, 0x7c2d12, 1);
      graphics.lineBetween(61, 52, 75, 91);
      graphics.fillStyle(0x93c5fd, 0.9);
      graphics.fillCircle(75, 91, 6);
      graphics.lineStyle(3, 0xe0f2fe, 0.72);
      graphics.strokeCircle(75, 91, 11);
    });
    create("mob-dragon", 136, 106, (graphics) => {
      graphics.fillStyle(0x050505, 0.34);
      graphics.fillEllipse(68, 91, 96, 18);
      graphics.fillStyle(0xf97316, 0.12);
      graphics.fillEllipse(68, 55, 120, 80);
      graphics.fillStyle(0x450a0a, 0.95);
      graphics.fillTriangle(39, 42, 2, 6, 58, 28);
      graphics.fillTriangle(76, 42, 134, 8, 94, 64);
      graphics.fillStyle(0x7f1d1d, 0.9);
      graphics.fillTriangle(40, 40, 10, 12, 56, 29);
      graphics.fillTriangle(77, 41, 126, 13, 92, 60);
      graphics.lineStyle(2, 0xfca5a5, 0.45);
      graphics.lineBetween(12, 14, 52, 32);
      graphics.lineBetween(22, 22, 54, 34);
      graphics.lineBetween(122, 16, 88, 52);
      graphics.lineBetween(112, 26, 86, 54);
      graphics.fillStyle(0x7f1d1d, 1);
      graphics.fillEllipse(64, 60, 80, 42);
      graphics.fillStyle(0x991b1b, 1);
      graphics.fillEllipse(64, 58, 76, 38);
      graphics.fillStyle(0xb91c1c, 0.9);
      graphics.fillEllipse(60, 51, 52, 20);
      graphics.fillStyle(0xfbbf24, 0.55);
      for (let index = 0; index < 5; index += 1) {
        graphics.fillEllipse(42 + index * 12, 68, 9, 6);
      }
      graphics.fillStyle(0x450a0a, 0.9);
      for (let index = 0; index < 4; index += 1) {
        graphics.fillTriangle(46 + index * 12, 42, 52 + index * 12, 30, 58 + index * 12, 42);
      }
      graphics.fillStyle(0xdc2626, 1);
      graphics.fillEllipse(101, 47, 36, 24);
      graphics.fillStyle(0xef4444, 0.85);
      graphics.fillEllipse(103, 41, 22, 10);
      graphics.fillStyle(0xfef3c7, 0.95);
      graphics.fillCircle(109, 43, 4.4);
      graphics.fillStyle(0x450a0a, 1);
      graphics.fillCircle(110, 43, 2);
      graphics.fillStyle(0x450a0a, 0.9);
      graphics.fillTriangle(96, 34, 100, 24, 105, 35);
      graphics.fillTriangle(107, 33, 113, 24, 116, 35);
      graphics.fillStyle(0xf97316, 0.85);
      graphics.fillTriangle(119, 49, 136, 39, 136, 61);
      graphics.fillStyle(0xfacc15, 0.7);
      graphics.fillTriangle(123, 49, 134, 44, 134, 56);
      graphics.lineStyle(4, 0xfacc15, 0.52);
      graphics.lineBetween(104, 60, 125, 83);
      graphics.lineBetween(50, 76, 39, 98);
      graphics.lineBetween(75, 77, 88, 99);
      graphics.fillStyle(0xfacc15, 0.6);
      graphics.fillCircle(125, 83, 3);
      graphics.fillCircle(39, 98, 3);
      graphics.fillCircle(88, 99, 3);
    });
    create("mob-sentinel", 98, 96, (graphics) => {
      graphics.fillStyle(0x050505, 0.34);
      graphics.fillEllipse(49, 82, 62, 14);
      graphics.fillStyle(0x334155, 1);
      graphics.fillRoundedRect(27, 20, 44, 52, 7);
      graphics.fillStyle(0x64748b, 1);
      graphics.fillRect(20, 30, 16, 34);
      graphics.fillRect(62, 30, 16, 34);
      graphics.fillStyle(0xfacc15, 0.85);
      graphics.fillCircle(49, 38, 8);
      graphics.lineStyle(4, 0xfef3c7, 0.75);
      graphics.strokeCircle(49, 38, 14);
    });
    create("mob-miniboss", 126, 112, (graphics) => {
      graphics.fillStyle(0x050505, 0.36);
      graphics.fillEllipse(63, 94, 82, 17);
      graphics.fillStyle(0x1f2937, 1);
      graphics.fillRoundedRect(38, 28, 50, 56, 10);
      graphics.fillStyle(0x475569, 1);
      graphics.fillCircle(34, 46, 15);
      graphics.fillCircle(91, 47, 15);
      graphics.fillStyle(0xe5e7eb, 0.96);
      graphics.fillCircle(63, 26, 17);
      graphics.fillStyle(0x020617, 1);
      graphics.fillCircle(56, 24, 4);
      graphics.fillCircle(70, 24, 4);
      graphics.fillStyle(0x7c2d12, 1);
      graphics.fillTriangle(45, 16, 28, 2, 42, 30);
      graphics.fillTriangle(81, 16, 98, 2, 84, 30);
      graphics.lineStyle(7, 0xfacc15, 0.74);
      graphics.strokeCircle(63, 50, 27);
      graphics.lineStyle(6, 0x94a3b8, 1);
      graphics.lineBetween(91, 58, 112, 32);
      graphics.fillStyle(0xfef3c7, 0.8);
      graphics.fillCircle(112, 32, 5);
    });
    create("mob-dungeonboss", 154, 134, (graphics) => {
      graphics.fillStyle(0x050505, 0.42);
      graphics.fillEllipse(77, 113, 112, 22);
      graphics.fillStyle(0x1e1b4b, 1);
      graphics.fillRoundedRect(46, 32, 62, 70, 12);
      graphics.fillStyle(0x312e81, 1);
      graphics.fillCircle(40, 58, 19);
      graphics.fillCircle(113, 58, 19);
      graphics.fillStyle(0x111827, 1);
      graphics.fillTriangle(48, 38, 22, 10, 61, 55);
      graphics.fillTriangle(106, 38, 134, 10, 94, 55);
      graphics.fillStyle(0xc4b5fd, 0.98);
      graphics.fillCircle(77, 30, 22);
      graphics.fillStyle(0x020617, 1);
      graphics.fillCircle(69, 28, 5);
      graphics.fillCircle(85, 28, 5);
      graphics.lineStyle(8, 0xa855f7, 0.82);
      graphics.strokeCircle(77, 63, 36);
      graphics.lineStyle(5, 0x38bdf8, 0.72);
      graphics.lineBetween(48, 86, 25, 116);
      graphics.lineBetween(106, 86, 130, 116);
      graphics.fillStyle(0xfef3c7, 0.92);
      graphics.fillCircle(77, 63, 7);
      graphics.lineStyle(4, 0xf0abfc, 0.78);
      graphics.strokeCircle(77, 63, 48);
    });
    create("mob-boss", 142, 124, (graphics) => {
      graphics.fillStyle(0x050505, 0.38);
      graphics.fillEllipse(71, 104, 96, 20);
      graphics.fillStyle(0xf97316, 0.14);
      graphics.fillCircle(70, 58, 60);
      graphics.fillStyle(0x27060a, 1);
      graphics.fillEllipse(70, 60, 90, 78);
      graphics.fillStyle(0x450a0a, 1);
      graphics.fillEllipse(70, 58, 84, 72);
      graphics.fillStyle(0x7f1d1d, 0.85);
      graphics.fillEllipse(66, 46, 58, 40);
      graphics.fillStyle(0x991b1b, 1);
      graphics.fillTriangle(30, 34, 8, 2, 50, 28);
      graphics.fillTriangle(92, 28, 132, 4, 108, 38);
      graphics.fillStyle(0xef4444, 0.6);
      graphics.fillTriangle(32, 30, 16, 8, 46, 28);
      graphics.fillTriangle(94, 26, 124, 10, 106, 34);
      graphics.fillStyle(0x450a0a, 1);
      graphics.fillTriangle(48, 24, 58, 6, 66, 24);
      graphics.fillTriangle(76, 24, 84, 6, 94, 24);
      graphics.fillStyle(0xfbbf24, 0.5);
      graphics.fillTriangle(52, 22, 58, 10, 63, 22);
      graphics.fillTriangle(79, 22, 84, 10, 90, 22);
      graphics.fillStyle(0xf97316, 0.95);
      graphics.fillCircle(70, 55, 21);
      graphics.fillStyle(0xfbbf24, 0.85);
      graphics.fillCircle(70, 52, 14);
      graphics.fillStyle(0xfef3c7, 0.98);
      graphics.fillEllipse(61, 48, 10, 12);
      graphics.fillEllipse(79, 48, 10, 12);
      graphics.fillStyle(0x450a0a, 1);
      graphics.fillCircle(61, 49, 3);
      graphics.fillCircle(79, 49, 3);
      graphics.lineStyle(3, 0x27060a, 0.9);
      graphics.lineBetween(55, 42, 66, 45);
      graphics.lineBetween(85, 42, 74, 45);
      graphics.fillStyle(0xfef3c7, 0.95);
      for (let index = 0; index < 4; index += 1) {
        graphics.fillTriangle(58 + index * 8, 68, 61 + index * 8, 76, 64 + index * 8, 68);
      }
      graphics.lineStyle(6, 0xfacc15, 0.6);
      graphics.strokeCircle(70, 55, 34);
      graphics.lineStyle(3, 0xf97316, 0.4);
      graphics.strokeCircle(70, 56, 44);
      graphics.lineStyle(2, 0xfca5a5, 0.5);
      graphics.lineBetween(38, 80, 30, 94);
      graphics.lineBetween(102, 80, 110, 94);
    });

    create("decor-bush", 72, 56, (graphics) => {
      graphics.fillStyle(0x0b2a17, 0.35);
      graphics.fillEllipse(37, 43, 58, 14);
      leafBlob(graphics, 35, 29, 25, [0x2f7d28, 0x45a83d, 0x82cf5a]);
      graphics.fillStyle(0xf97316, 0.86);
      graphics.fillCircle(22, 22, 3);
      graphics.fillStyle(0xfef3c7, 0.86);
      graphics.fillCircle(49, 28, 3);
    });
    create("decor-tree", 90, 110, (graphics) => {
      graphics.fillStyle(0x052e16, 0.12);
      graphics.fillEllipse(45, 94, 62, 18);
      graphics.fillStyle(0x6b3f20, 1);
      graphics.fillRoundedRect(39, 54, 13, 45, 5);
      graphics.fillStyle(0x8b5a2b, 0.7);
      graphics.fillEllipse(44, 68, 16, 36);
      leafBlob(graphics, 45, 38, 32, [0x1f7a35, 0x2f9b45, 0x7ddf70]);
      leafBlob(graphics, 29, 49, 23, [0x19642d, 0x2b8f3e, 0x61c85c]);
      leafBlob(graphics, 62, 49, 24, [0x1d6f32, 0x32a24a, 0x73d56a]);
    });
    create("decor-pine", 86, 116, (graphics) => {
      graphics.fillStyle(0x052e16, 0.12);
      graphics.fillEllipse(43, 102, 58, 16);
      graphics.fillStyle(0x5b3418, 1);
      graphics.fillRoundedRect(38, 72, 10, 32, 4);
      graphics.fillStyle(0x0c4a2e, 1);
      graphics.fillTriangle(43, 7, 14, 55, 72, 55);
      graphics.fillStyle(0x137a42, 1);
      graphics.fillTriangle(43, 28, 9, 79, 77, 79);
      graphics.fillStyle(0x18a457, 0.94);
      graphics.fillTriangle(43, 49, 12, 96, 74, 96);
      graphics.fillStyle(0xd9f99d, 0.24);
      graphics.fillEllipse(42, 36, 35, 8);
      graphics.fillEllipse(42, 61, 42, 9);
    });
    create("decor-ancient-tree", 154, 190, (graphics) => {
      graphics.fillStyle(0x052e16, 0.1);
      graphics.fillEllipse(77, 166, 118, 24);
      graphics.lineStyle(18, 0x3b2414, 1);
      graphics.lineBetween(77, 154, 72, 88);
      graphics.lineStyle(10, 0x7c4a25, 0.96);
      graphics.lineBetween(75, 154, 78, 88);
      graphics.lineStyle(8, 0x4b2a15, 0.92);
      graphics.lineBetween(75, 112, 42, 72);
      graphics.lineBetween(78, 112, 114, 72);
      graphics.fillStyle(0x1d5d2d, 0.96);
      graphics.fillCircle(74, 56, 42);
      graphics.fillCircle(42, 80, 34);
      graphics.fillCircle(112, 82, 36);
      graphics.fillStyle(0x2f8a3c, 0.86);
      graphics.fillCircle(70, 42, 28);
      graphics.fillCircle(96, 62, 30);
      graphics.fillStyle(0xa7f3d0, 0.18);
      graphics.fillEllipse(65, 38, 52, 12);
      graphics.fillEllipse(106, 70, 46, 10);
    });
    create("decor-eye-tree", 132, 168, (graphics) => {
      graphics.fillStyle(0x020617, 0.12);
      graphics.fillEllipse(66, 146, 96, 22);
      graphics.lineStyle(15, 0x24120b, 1);
      graphics.lineBetween(66, 140, 66, 82);
      graphics.lineStyle(7, 0x3f1f13, 0.96);
      graphics.lineBetween(66, 116, 38, 74);
      graphics.lineBetween(66, 112, 96, 74);
      graphics.fillStyle(0x10251f, 0.98);
      graphics.fillCircle(66, 54, 42);
      graphics.fillCircle(36, 72, 29);
      graphics.fillCircle(98, 72, 31);
      graphics.fillStyle(0x1f3d34, 0.92);
      graphics.fillCircle(66, 39, 27);
      graphics.fillStyle(0xfacc15, 0.9);
      graphics.fillEllipse(52, 66, 17, 9);
      graphics.fillEllipse(82, 65, 17, 9);
      graphics.fillStyle(0x020617, 0.92);
      graphics.fillCircle(52, 66, 4);
      graphics.fillCircle(82, 65, 4);
      graphics.lineStyle(2, 0x86efac, 0.18);
      graphics.strokeCircle(66, 54, 48);
    });
    create("decor-raven", 92, 56, (graphics) => {
      graphics.fillStyle(0x020617, 0.95);
      graphics.fillEllipse(46, 30, 30, 14);
      graphics.fillTriangle(40, 29, 7, 8, 32, 38);
      graphics.fillTriangle(52, 29, 85, 9, 61, 38);
      graphics.fillStyle(0x111827, 0.96);
      graphics.fillCircle(55, 25, 9);
      graphics.fillStyle(0xfacc15, 0.82);
      graphics.fillTriangle(62, 25, 76, 20, 64, 30);
      graphics.fillStyle(0x93c5fd, 0.38);
      graphics.fillCircle(58, 23, 2);
    });
    create("decor-palm", 104, 126, (graphics) => {
      graphics.fillStyle(0x052e16, 0.1);
      graphics.fillEllipse(52, 112, 72, 16);
      graphics.fillStyle(0x7c4a25, 1);
      graphics.fillRoundedRect(48, 55, 10, 55, 5);
      graphics.lineStyle(2, 0xd6a15d, 0.32);
      for (let y = 62; y < 104; y += 10) {
        graphics.lineBetween(49, y, 58, y + 6);
      }
      const leaves = [
        { a: -2.6, l: 48 },
        { a: -2.1, l: 56 },
        { a: -1.55, l: 58 },
        { a: -0.95, l: 56 },
        { a: -0.45, l: 48 },
        { a: 0.08, l: 42 }
      ];
      leaves.forEach((leaf, index) => {
        const x2 = 52 + Math.cos(leaf.a) * leaf.l;
        const y2 = 54 + Math.sin(leaf.a) * leaf.l * 0.58;
        graphics.lineStyle(12, index % 2 === 0 ? 0x15803d : 0x22a447, 0.92);
        graphics.lineBetween(52, 55, x2, y2);
        graphics.lineStyle(4, 0x86efac, 0.38);
        graphics.lineBetween(52, 55, x2, y2);
      });
      graphics.fillStyle(0x78350f, 0.96);
      graphics.fillCircle(46, 58, 5);
      graphics.fillCircle(56, 60, 5);
    });
    create("decor-flower", 46, 42, (graphics) => {
      graphics.fillStyle(0x052e16, 0.08);
      graphics.fillEllipse(23, 34, 28, 6);
      graphics.lineStyle(3, 0x166534, 0.82);
      graphics.lineBetween(23, 34, 23, 18);
      const colors = [0xfef3c7, 0xf97316, 0xf43f5e, 0xffffff];
      for (let flower = 0; flower < 3; flower += 1) {
        const cx = 14 + flower * 9;
        const cy = 18 + (flower % 2) * 5;
        graphics.fillStyle(colors[flower], 0.95);
        graphics.fillCircle(cx - 3, cy, 3);
        graphics.fillCircle(cx + 3, cy, 3);
        graphics.fillCircle(cx, cy - 3, 3);
        graphics.fillCircle(cx, cy + 3, 3);
        graphics.fillStyle(0xfacc15, 1);
        graphics.fillCircle(cx, cy, 2);
      }
    });
    create("decor-rock", 74, 54, (graphics) => {
      graphics.fillStyle(0x111827, 0.28);
      graphics.fillEllipse(38, 41, 54, 13);
      graphics.fillStyle(0x3f4a58, 0.94);
      graphics.fillEllipse(31, 31, 36, 25);
      graphics.fillStyle(0x566372, 0.9);
      graphics.fillEllipse(49, 28, 28, 23);
      graphics.fillStyle(0x9ca3af, 0.38);
      graphics.fillEllipse(24, 23, 12, 6);
    });
    create("decor-rock-flat", 82, 44, (graphics) => {
      graphics.fillStyle(0x111827, 0.22);
      graphics.fillEllipse(42, 35, 62, 10);
      graphics.fillStyle(0x4b5563, 0.82);
      graphics.fillEllipse(34, 25, 42, 20);
      graphics.fillStyle(0x374151, 0.72);
      graphics.fillEllipse(58, 27, 28, 16);
      graphics.fillStyle(0x9ca3af, 0.3);
      graphics.fillEllipse(25, 20, 12, 5);
    });
    create("decor-pebble", 54, 38, (graphics) => {
      graphics.fillStyle(0x111827, 0.2);
      graphics.fillEllipse(28, 31, 34, 8);
      graphics.fillStyle(0x5b6470, 0.7);
      graphics.fillEllipse(24, 22, 22, 16);
      graphics.fillStyle(0x334155, 0.64);
      graphics.fillEllipse(36, 24, 17, 12);
    });
    create("decor-fire", 72, 92, (graphics) => {
      graphics.fillStyle(0x2f1308, 0.34);
      graphics.fillEllipse(36, 76, 44, 13);
      graphics.fillStyle(0x7f1d1d, 0.62);
      graphics.fillEllipse(26, 66, 20, 12);
      graphics.fillEllipse(45, 70, 24, 13);
      graphics.fillStyle(0xf97316, 0.78);
      graphics.fillCircle(30, 57, 6);
      graphics.fillCircle(47, 60, 5);
      graphics.fillStyle(0xfacc15, 0.58);
      graphics.fillCircle(37, 51, 4);
      graphics.lineStyle(3, 0xfb923c, 0.32);
      graphics.lineBetween(28, 67, 34, 46);
      graphics.lineBetween(47, 70, 51, 52);
    });
    create("decor-crystal", 64, 88, (graphics) => {
      graphics.fillStyle(0x111827, 0.28);
      graphics.fillEllipse(32, 74, 36, 10);
      graphics.fillStyle(0x5b21b6, 0.72);
      graphics.fillTriangle(32, 14, 17, 60, 32, 78);
      graphics.fillStyle(0x8b5cf6, 0.62);
      graphics.fillTriangle(32, 14, 47, 60, 32, 78);
      graphics.fillStyle(0xf5f3ff, 0.3);
      graphics.fillTriangle(31, 22, 27, 45, 35, 48);
    });
    create("decor-mushroom", 66, 58, (graphics) => {
      graphics.fillStyle(0x052e16, 0.12);
      graphics.fillEllipse(34, 49, 48, 10);
      graphics.fillStyle(0xf5e6c8, 0.9);
      graphics.fillRoundedRect(28, 28, 11, 22, 5);
      graphics.fillStyle(0xb91c1c, 0.96);
      graphics.fillEllipse(33, 25, 42, 24);
      graphics.fillStyle(0xfef3c7, 0.86);
      graphics.fillCircle(22, 21, 3);
      graphics.fillCircle(34, 15, 4);
      graphics.fillCircle(45, 25, 3);
      graphics.fillStyle(0xf5e6c8, 0.8);
      graphics.fillRoundedRect(46, 35, 7, 15, 4);
      graphics.fillStyle(0x7c2d12, 0.92);
      graphics.fillEllipse(49, 33, 22, 12);
    });
    create("decor-stalagmite", 68, 92, (graphics) => {
      graphics.fillStyle(0x030712, 0.32);
      graphics.fillEllipse(35, 78, 52, 16);
      graphics.fillStyle(0x475569, 0.96);
      graphics.fillTriangle(12, 78, 30, 20, 42, 78);
      graphics.fillStyle(0x64748b, 0.88);
      graphics.fillTriangle(28, 78, 46, 8, 58, 78);
      graphics.fillStyle(0xcbd5e1, 0.26);
      graphics.fillTriangle(42, 18, 48, 54, 45, 74);
    });
    create("decor-rune", 74, 74, (graphics) => {
      graphics.fillStyle(0x111827, 0.42);
      graphics.fillEllipse(37, 56, 56, 14);
      graphics.lineStyle(7, 0x6d28d9, 0.74);
      graphics.strokeCircle(37, 37, 23);
      graphics.lineStyle(4, 0xc4b5fd, 0.82);
      graphics.lineBetween(37, 13, 37, 61);
      graphics.lineBetween(21, 45, 53, 29);
      graphics.fillStyle(0xf5f3ff, 0.54);
      graphics.fillCircle(37, 37, 5);
    });
    create("decor-safe-shrine", 82, 104, (graphics) => {
      graphics.fillStyle(0x052e16, 0.24);
      graphics.fillEllipse(41, 89, 62, 16);
      graphics.fillStyle(0x475569, 0.94);
      graphics.fillRoundedRect(28, 48, 26, 42, 5);
      graphics.fillStyle(0x64748b, 0.98);
      graphics.fillTriangle(16, 50, 41, 18, 66, 50);
      graphics.fillStyle(0x86efac, 0.86);
      graphics.fillCircle(41, 58, 9);
      graphics.lineStyle(3, 0xbbf7d0, 0.52);
      graphics.strokeCircle(41, 58, 17);
    });
    create("decor-wave", 82, 28, (graphics) => {
      graphics.lineStyle(3, 0x7dd3fc, 0.34);
      graphics.lineBetween(8, 12, 74, 12);
      graphics.lineStyle(2, 0xe0f2fe, 0.22);
      graphics.lineBetween(16, 20, 66, 20);
    });
    create("decor-fish", 58, 34, (graphics) => {
      graphics.fillStyle(0x0e7490, 0.1);
      graphics.fillEllipse(29, 27, 42, 9);
      graphics.fillStyle(0x67e8f9, 0.82);
      graphics.fillEllipse(28, 16, 28, 14);
      graphics.fillStyle(0x22d3ee, 0.88);
      graphics.fillTriangle(42, 16, 55, 7, 55, 25);
      graphics.fillStyle(0xe0f2fe, 0.8);
      graphics.fillCircle(18, 13, 2);
      graphics.lineStyle(2, 0x0f5f72, 0.38);
      graphics.lineBetween(24, 10, 35, 16);
      graphics.lineBetween(24, 22, 35, 16);
    });
    create("decor-reed", 52, 48, (graphics) => {
      graphics.fillStyle(0x052e16, 0.12);
      graphics.fillEllipse(26, 40, 34, 6);
      const reeds = [
        { x: 15, h: 22, a: -0.16 },
        { x: 22, h: 29, a: -0.06 },
        { x: 29, h: 25, a: 0.05 },
        { x: 36, h: 30, a: 0.14 }
      ];
      reeds.forEach((reed, index) => {
        const tipX = reed.x + Math.sin(reed.a) * reed.h * 0.22;
        const tipY = 40 - reed.h;
        graphics.lineStyle(2, index % 2 === 0 ? 0x31572c : 0x4d7c0f, 0.52);
        graphics.lineBetween(reed.x, 40, tipX, tipY);
        graphics.fillStyle(0xc0843b, 0.52);
        graphics.fillEllipse(tipX, tipY, 4, 8);
      });
    });
    create("decor-lily", 58, 44, (graphics) => {
      graphics.fillStyle(0x0e7490, 0.08);
      graphics.fillEllipse(29, 31, 44, 16);
      graphics.fillStyle(0x166534, 0.88);
      graphics.beginPath();
      graphics.arc(27, 24, 17, 0.2, Math.PI * 1.78, false);
      graphics.lineTo(27, 24);
      graphics.closePath();
      graphics.fillPath();
      graphics.fillStyle(0xf9a8d4, 0.95);
      graphics.fillCircle(36, 17, 4);
      graphics.fillCircle(42, 20, 4);
      graphics.fillCircle(36, 23, 4);
      graphics.fillStyle(0xfef3c7, 0.95);
      graphics.fillCircle(38, 20, 2);
    });
    create("decor-waterfall-spray", 66, 54, (graphics) => {
      graphics.fillStyle(0xe0f7ff, 0.12);
      graphics.fillEllipse(33, 36, 56, 20);
      graphics.lineStyle(3, 0xbae6fd, 0.58);
      graphics.lineBetween(12, 20, 25, 30);
      graphics.lineBetween(28, 13, 34, 31);
      graphics.lineBetween(48, 18, 39, 32);
      graphics.fillStyle(0xf8fbff, 0.78);
      graphics.fillCircle(16, 34, 4);
      graphics.fillCircle(35, 39, 5);
      graphics.fillCircle(51, 32, 3);
    });
    create("decor-grass", 58, 44, (graphics) => {
      graphics.fillStyle(0x0f2f1c, 0.12);
      graphics.fillEllipse(29, 36, 38, 7);
      graphics.lineStyle(2, 0x4ade80, 0.42);
      graphics.lineBetween(14, 35, 18, 21);
      graphics.lineBetween(26, 36, 27, 15);
      graphics.lineBetween(39, 36, 37, 21);
      graphics.lineStyle(2, 0x166534, 0.5);
      graphics.lineBetween(20, 36, 19, 25);
      graphics.lineBetween(45, 35, 45, 25);
    });
    create("road-signpost", 112, 90, (graphics) => {
      graphics.fillStyle(0x030712, 0.28);
      graphics.fillEllipse(55, 79, 62, 12);
      graphics.fillStyle(0x4a2f1c, 1);
      graphics.fillRoundedRect(51, 28, 8, 48, 3);
      graphics.fillStyle(0x7a4a26, 1);
      graphics.fillRoundedRect(22, 16, 62, 20, 4);
      graphics.fillRoundedRect(32, 39, 58, 18, 4);
      graphics.fillTriangle(84, 16, 105, 26, 84, 36);
      graphics.fillTriangle(32, 39, 11, 48, 32, 57);
      graphics.lineStyle(2, 0xd6a15d, 0.32);
      graphics.strokeRoundedRect(22, 16, 62, 20, 4);
      graphics.strokeRoundedRect(32, 39, 58, 18, 4);
      graphics.fillStyle(0xfef3c7, 0.7);
      graphics.fillRect(36, 24, 30, 3);
      graphics.fillRect(46, 47, 26, 3);
    });
    create("projectile-arrow", 86, 18, (graphics) => {
      graphics.lineStyle(4, 0xf8fafc, 1);
      graphics.lineBetween(6, 9, 68, 9);
      graphics.fillStyle(0xf8fafc, 1);
      graphics.fillTriangle(80, 9, 60, 1, 64, 9);
      graphics.fillTriangle(80, 9, 60, 17, 64, 9);
      graphics.fillStyle(0x92400e, 1);
      graphics.fillTriangle(8, 9, 2, 3, 18, 9);
      graphics.fillTriangle(8, 9, 2, 15, 18, 9);
    });
    create("projectile-magic", 48, 48, (graphics) => {
      graphics.fillStyle(0x38bdf8, 0.22);
      graphics.fillCircle(24, 24, 22);
      graphics.fillStyle(0x60a5fa, 0.75);
      graphics.fillCircle(24, 24, 14);
      graphics.fillStyle(0xf8fafc, 0.96);
      graphics.fillCircle(24, 24, 6);
    });
    create("weapon-archer", 84, 84, (graphics) => {
      graphics.lineStyle(7, 0x6b3f1d, 1);
      graphics.beginPath();
      graphics.arc(29, 42, 34, -1.22, 1.22, false);
      graphics.strokePath();
      graphics.lineStyle(3, 0xf8fafc, 0.95);
      graphics.lineBetween(44, 8, 44, 76);
      graphics.lineStyle(4, 0xd6a15d, 0.9);
      graphics.lineBetween(44, 42, 68, 42);
      graphics.fillStyle(0x92400e, 1);
      graphics.fillTriangle(68, 42, 56, 35, 58, 42);
      graphics.fillTriangle(68, 42, 56, 49, 58, 42);
    });
    create("weapon-mage", 84, 84, (graphics) => {
      graphics.lineStyle(7, 0x7c2d12, 1);
      graphics.lineBetween(24, 72, 58, 18);
      graphics.lineStyle(3, 0xfbbf24, 0.6);
      graphics.lineBetween(30, 62, 52, 28);
      graphics.fillStyle(0x38bdf8, 0.95);
      graphics.fillCircle(61, 15, 11);
      graphics.fillStyle(0xf0f9ff, 0.9);
      graphics.fillCircle(61, 15, 5);
    });
    create("weapon-warrior", 84, 84, (graphics) => {
      graphics.lineStyle(8, 0xe5e7eb, 1);
      graphics.lineBetween(24, 70, 60, 16);
      graphics.lineStyle(4, 0x94a3b8, 1);
      graphics.lineBetween(31, 61, 56, 22);
      graphics.fillStyle(0xf8fafc, 1);
      graphics.fillTriangle(62, 13, 56, 29, 68, 25);
      graphics.lineStyle(6, 0x78350f, 1);
      graphics.lineBetween(18, 75, 30, 62);
      graphics.lineStyle(5, 0xf59e0b, 0.85);
      graphics.lineBetween(25, 58, 44, 71);
    });
    create("weapon-assassin", 84, 84, (graphics) => {
      const drawDaggerPath = (points: Vector2[], color: number, alpha: number, width: number) => {
        graphics.lineStyle(width, color, alpha);
        graphics.beginPath();
        graphics.moveTo(points[0].x, points[0].y);
        points.slice(1).forEach((point) => graphics.lineTo(point.x, point.y));
        graphics.strokePath();
      };
      const drawCurvedDagger = (mirrored: boolean) => {
        const mirrorY = (y: number) => (mirrored ? 84 - y : y);
        const outer = [
          { x: 33, y: 28 },
          { x: 43, y: 25 },
          { x: 52, y: 20 },
          { x: 62, y: 22 },
          { x: 58, y: 28 },
          { x: 51, y: 33 },
          { x: 42, y: 37 },
          { x: 34, y: 40 },
          { x: 31, y: 36 }
        ].map((point) => ({ x: point.x, y: mirrorY(point.y) }));
        const inner = [
          { x: 35, y: 29 },
          { x: 44, y: 27 },
          { x: 52, y: 22 },
          { x: 60, y: 23 },
          { x: 56, y: 28 },
          { x: 49, y: 32 },
          { x: 42, y: 35 },
          { x: 35, y: 38 },
          { x: 34, y: 34 }
        ].map((point) => ({ x: point.x, y: mirrorY(point.y) }));
        const handleY = mirrorY(34);
        graphics.lineStyle(8, 0x160d20, 1);
        graphics.lineBetween(20, handleY, 34, handleY);
        graphics.lineStyle(3, 0x6d28d9, 0.92);
        graphics.lineBetween(20, handleY, 33, handleY);
        graphics.fillStyle(0x160d20, 1);
        graphics.fillCircle(20, handleY, 4);
        graphics.fillStyle(0xa855f7, 0.9);
        graphics.fillCircle(20, handleY, 2);
        graphics.fillStyle(0x160d20, 1);
        graphics.fillPoints(outer, true);
        graphics.fillStyle(0xaebdce, 1);
        graphics.fillPoints(inner, true);
        drawDaggerPath(
          [
            { x: 35, y: mirrorY(38) },
            { x: 42, y: mirrorY(35) },
            { x: 49, y: mirrorY(32) },
            { x: 56, y: mirrorY(28) },
            { x: 60, y: mirrorY(23) }
          ],
          0xf8fafc,
          0.88,
          1.8
        );
        drawDaggerPath(
          [
            { x: 36, y: mirrorY(31) },
            { x: 44, y: mirrorY(28) },
            { x: 52, y: mirrorY(23) },
            { x: 58, y: mirrorY(24) }
          ],
          0x6d28d9,
          0.72,
          1.35
        );
        graphics.lineStyle(5, 0x160d20, 1);
        graphics.lineBetween(32, mirrorY(27), 37, mirrorY(40));
        graphics.lineStyle(2, 0xc084fc, 0.92);
        graphics.lineBetween(32, mirrorY(27), 37, mirrorY(40));
      };
      drawCurvedDagger(false);
      drawCurvedDagger(true);
    });
    create("weapon-tank", 84, 84, (graphics) => {
      graphics.fillStyle(0x92400e, 1);
      graphics.fillCircle(38, 42, 27);
      graphics.lineStyle(6, 0xfcd34d, 0.95);
      graphics.strokeCircle(38, 42, 27);
      graphics.lineStyle(4, 0xfef3c7, 0.72);
      graphics.lineBetween(38, 17, 38, 67);
      graphics.lineBetween(13, 42, 63, 42);
      graphics.lineStyle(6, 0xd1d5db, 1);
      graphics.lineBetween(20, 76, 66, 18);
      graphics.fillStyle(0xf59e0b, 0.95);
      graphics.fillCircle(67, 17, 7);
    });
    create("weapon-microphone", 84, 84, (graphics) => {
      graphics.fillStyle(0x020617, 0.32);
      graphics.fillEllipse(42, 66, 34, 9);
      graphics.lineStyle(8, 0x111827, 1);
      graphics.lineBetween(42, 72, 42, 40);
      graphics.lineStyle(3, 0x94a3b8, 0.82);
      graphics.lineBetween(46, 67, 46, 40);
      graphics.fillStyle(0xe5e7eb, 1);
      graphics.fillEllipse(42, 28, 22, 28);
      graphics.lineStyle(3, 0x334155, 0.92);
      graphics.strokeEllipse(42, 28, 22, 28);
      graphics.lineStyle(2, 0x64748b, 0.72);
      graphics.lineBetween(32, 24, 52, 24);
      graphics.lineBetween(32, 30, 52, 30);
      graphics.lineBetween(36, 17, 36, 39);
      graphics.lineBetween(42, 15, 42, 41);
      graphics.lineBetween(48, 17, 48, 39);
    });
    const createWeaponGlow = (
      classId: PlayerPublicState["classId"],
      drawShape: (graphics: Phaser.GameObjects.Graphics, width: number, alpha: number) => void
    ) => {
      create(`weapon-glow-${classId}`, 84, 84, (graphics) => {
        [
          { width: 13, alpha: 0.07 },
          { width: 8, alpha: 0.14 },
          { width: 3, alpha: 0.42 }
        ].forEach((layer) => drawShape(graphics, layer.width, layer.alpha));
      });
    };
    createWeaponGlow("archer", (graphics, width, alpha) => {
      graphics.lineStyle(width, 0xffffff, alpha);
      graphics.beginPath();
      graphics.arc(29, 42, 34, -1.22, 1.22, false);
      graphics.strokePath();
      graphics.lineStyle(Math.max(2, width * 0.48), 0xffffff, alpha * 0.72);
      graphics.lineBetween(44, 42, 68, 42);
    });
    create("weapon-glow-mage", 112, 112, (graphics) => {
      [
        { width: 13, alpha: 0.07 },
        { width: 8, alpha: 0.14 },
        { width: 3, alpha: 0.42 }
      ].forEach(({ width, alpha }) => {
        graphics.lineStyle(width * 0.9, 0xffffff, Math.min(1, alpha * 1.2));
        graphics.lineBetween(38, 86, 72, 32);
        graphics.fillStyle(0xffffff, Math.min(1, alpha * 0.9));
        graphics.fillCircle(75, 29, 10 + width * 0.82);
        graphics.lineStyle(Math.max(1.25, width * 0.24), 0xffffff, Math.min(1, alpha * 1.5));
        graphics.strokeCircle(75, 29, 8 + width * 0.62);
      });
    });
    createWeaponGlow("warrior", (graphics, width, alpha) => {
      graphics.lineStyle(width, 0xffffff, alpha);
      graphics.lineBetween(24, 70, 60, 16);
    });
    createWeaponGlow("assassin", (graphics, width, alpha) => {
      const drawGlowPath = (points: Vector2[], lineWidth: number, lineAlpha: number) => {
        graphics.lineStyle(lineWidth, 0xffffff, lineAlpha);
        graphics.beginPath();
        graphics.moveTo(points[0].x, points[0].y);
        points.slice(1).forEach((point) => graphics.lineTo(point.x, point.y));
        graphics.strokePath();
      };
      const drawBladeGlow = (mirrored: boolean) => {
        const mirrorY = (y: number) => (mirrored ? 84 - y : y);
        drawGlowPath(
          [
            { x: 35, y: mirrorY(38) },
            { x: 41, y: mirrorY(36) },
            { x: 47, y: mirrorY(33) },
            { x: 53, y: mirrorY(29) },
            { x: 58, y: mirrorY(25) },
            { x: 61, y: mirrorY(23) }
          ],
          Math.max(1.6, width * 0.58),
          Math.min(1, alpha * 1.08)
        );
        drawGlowPath(
          [
            { x: 35, y: mirrorY(30) },
            { x: 43, y: mirrorY(27) },
            { x: 52, y: mirrorY(22) },
            { x: 60, y: mirrorY(23) }
          ],
          Math.max(1.25, width * 0.34),
          alpha * 0.45
        );
      };
      drawBladeGlow(false);
      drawBladeGlow(true);
    });
    createWeaponGlow("tank", (graphics, width, alpha) => {
      graphics.lineStyle(Math.max(2, width * 0.58), 0xffffff, alpha * 0.7);
      graphics.strokeCircle(38, 42, 27);
      graphics.lineStyle(width, 0xffffff, alpha);
      graphics.lineBetween(20, 76, 66, 18);
    });
    create("skill-cleave", 96, 96, (graphics) => {
      graphics.lineStyle(10, 0xf8fafc, 0.92);
      graphics.beginPath();
      graphics.arc(48, 48, 36, -1.1, 1.1, false);
      graphics.strokePath();
      graphics.lineStyle(4, 0xfacc15, 0.7);
      graphics.beginPath();
      graphics.arc(48, 48, 26, -1, 1, false);
      graphics.strokePath();
    });
    create("skill-shadow", 92, 62, (graphics) => {
      graphics.fillStyle(0x581c87, 0.72);
      graphics.fillTriangle(5, 31, 72, 4, 52, 31);
      graphics.fillTriangle(5, 31, 72, 58, 52, 31);
      graphics.fillStyle(0xc084fc, 0.55);
      graphics.fillTriangle(26, 31, 88, 12, 70, 31);
      graphics.fillTriangle(26, 31, 88, 50, 70, 31);
    });
    create("skill-bash", 98, 98, (graphics) => {
      graphics.fillStyle(0xf59e0b, 0.18);
      graphics.fillCircle(49, 49, 44);
      graphics.lineStyle(7, 0xfacc15, 0.9);
      graphics.strokeCircle(49, 49, 35);
      graphics.lineStyle(4, 0xfef3c7, 0.75);
      graphics.lineBetween(49, 8, 49, 90);
      graphics.lineBetween(8, 49, 90, 49);
    });
  }

  private seedDecorations(): void {
    if (this.decorationDefs.length > 0) {
      return;
    }

    const mobile = this.isMobileTouchMode();
    const scaleDecorationCount = (count: number, density = 0.44) => {
      if (count <= 0) {
        return count;
      }
      const densityFactor = Math.min(1, density / 0.44);
      if (!mobile) {
        const desktopDensity = count >= 120 ? 0.12 : count >= 70 ? 0.16 : count >= 36 ? 0.24 : 0.42;
        return Math.max(1, Math.round(count * desktopDensity * densityFactor));
      }
      return Math.max(1, Math.round(count * density * 0.72));
    };
    const uprightTextures = new Set([
      "city-banner",
      "city-dock",
      "city-tent",
      "decor-bush",
      "decor-lamp",
      "decor-mushroom",
      "decor-tree",
      "decor-ancient-tree",
      "decor-eye-tree",
      "decor-pine",
      "decor-palm",
      "decor-safe-shrine",
      "decor-stalagmite",
      "decor-rune",
      "decor-crystal",
      "decor-obelisk",
      "decor-reed",
      "decor-grass",
      "decor-flower",
      "decor-grave",
      "decor-lily",
      "decor-ruin"
    ]);
    const flatScatterTextures = new Set([
      "decor-bone",
      "decor-pebble",
      "decor-rock",
      "decor-rock-flat"
    ]);
    const decorationRotation = (texture: string, fallback: number, index: number) => {
      if (uprightTextures.has(texture)) {
        return 0;
      }
      if (flatScatterTextures.has(texture)) {
        return ((((index * 17) % 9) - 4) * 0.028);
      }
      return fallback;
    };
    const decorationScaleBase = (texture: string) => {
      if (texture === "decor-ancient-tree") {
        return 0.82;
      }
      if (texture === "decor-eye-tree") {
        return 0.76;
      }
      if (texture === "decor-raven") {
        return 0.52;
      }
      if (texture === "decor-fire") {
        return 0.36;
      }
      if (texture === "decor-bone") {
        return 0.36;
      }
      if (texture === "decor-flower" || texture === "decor-lily") {
        return 0.42;
      }
      if (texture === "decor-reed") {
        return 0.34;
      }
      if (texture === "decor-fish" || texture === "decor-wave") {
        return 0.5;
      }
      if (texture === "decor-crystal" || texture === "decor-obelisk") {
        return 0.44;
      }
      return 0.52;
    };
    const decorationScaleJitter = (texture: string) => {
      if (texture === "decor-ancient-tree" || texture === "decor-eye-tree") {
        return 44;
      }
      if (texture === "decor-raven") {
        return 26;
      }
      if (texture === "decor-fire") {
        return 28;
      }
      if (texture === "decor-bone" || texture === "decor-flower" || texture === "decor-lily" || texture === "decor-reed") {
        return 22;
      }
      if (texture === "decor-fish" || texture === "decor-wave") {
        return 18;
      }
      if (texture === "decor-crystal" || texture === "decor-obelisk") {
        return 34;
      }
      return 58;
    };
    const addEllipse = (prefix: string, texture: string | string[], center: Vector2, width: number, height: number, count: number, depth: number, alpha = 1) => {
      const itemCount = scaleDecorationCount(count);
      for (let index = 0; index < itemCount; index += 1) {
        const angle = ((index * 137.508) % 360) * Phaser.Math.DEG_TO_RAD;
        const radius = Math.sqrt(((index * 67) % 997) / 997);
        const x = center.x + Math.cos(angle) * (width / 2) * radius;
        const y = center.y + Math.sin(angle) * (height / 2) * radius;
        const selectedTexture = Array.isArray(texture) ? texture[index % texture.length] : texture;
        if (Phaser.Math.Distance.Between(x, y, WORLD_BOUNDS.town.x, WORLD_BOUNDS.town.y) < 560) {
          continue;
        }
        if (this.decorationBlocked({ x, y }, selectedTexture)) {
          continue;
        }
        this.decorationDefs.push({
          id: `${prefix}-${index}`,
          texture: selectedTexture,
          position: { x, y },
          scale: decorationScaleBase(selectedTexture) + ((index * 31) % decorationScaleJitter(selectedTexture)) / 100,
          rotation: decorationRotation(selectedTexture, ((index * 19) % 360) * Phaser.Math.DEG_TO_RAD, index),
          depth,
          alpha
        });
      }
    };
    const addWaterEllipse = (prefix: string, texture: string | string[], center: Vector2, width: number, height: number, count: number, depth: number, alpha = 1) => {
      const itemCount = scaleDecorationCount(count, 0.3);
      for (let index = 0; index < itemCount; index += 1) {
        const angle = ((index * 137.508 + 19) % 360) * Phaser.Math.DEG_TO_RAD;
        const radius = Math.sqrt(((index * 83) % 997) / 997);
        const x = center.x + Math.cos(angle) * (width / 2) * radius;
        const y = center.y + Math.sin(angle) * (height / 2) * radius;
        const selectedTexture = Array.isArray(texture) ? texture[index % texture.length] : texture;
        if (!this.isWaterPosition({ x, y }) || this.decorationBlocked({ x, y }, selectedTexture)) {
          continue;
        }
        this.decorationDefs.push({
          id: `${prefix}-${index}`,
          texture: selectedTexture,
          position: { x, y },
          scale: decorationScaleBase(selectedTexture) + ((index * 23) % decorationScaleJitter(selectedTexture)) / 100,
          rotation: decorationRotation(selectedTexture, ((index * 31) % 360) * Phaser.Math.DEG_TO_RAD, index),
          depth,
          alpha
        });
      }
    };
    const addRing = (
      prefix: string,
      texture: string | string[],
      center: Vector2,
      radiusX: number,
      radiusY: number,
      count: number,
      depth: number,
      alpha = 1,
      baseScale = 0.74
    ) => {
      const itemCount = scaleDecorationCount(count, 0.56);
      for (let index = 0; index < itemCount; index += 1) {
        const angle = (index / itemCount) * Math.PI * 2 + ((index * 17) % 9) * 0.018;
        const wobble = 0.9 + (((index * 41) % 23) - 11) * 0.008;
        const x = center.x + Math.cos(angle) * radiusX * wobble;
        const y = center.y + Math.sin(angle) * radiusY * wobble;
        const selectedTexture = Array.isArray(texture) ? texture[index % texture.length] : texture;
        if (this.decorationBlocked({ x, y }, selectedTexture)) {
          continue;
        }
        this.decorationDefs.push({
          id: `${prefix}-${index}`,
          texture: selectedTexture,
          position: { x, y },
          scale: baseScale + ((index * 29) % 26) / 100,
          rotation: decorationRotation(selectedTexture, angle + Math.PI / 2, index),
          depth,
          alpha
        });
      }
    };

    CITY_DEFINITIONS.forEach((city) => {
      const isHub = city.id === "greenhill";
      const ringX = city.safeRadius * (isHub ? 0.36 : 0.3);
      const ringY = city.safeRadius * (isHub ? 0.24 : 0.22);
      addRing(`city-lamps-${city.id}`, "decor-lamp", city.position, ringX, ringY, isHub ? 8 : 3, 6.4, 0.62, isHub ? 0.62 : 0.48);
      if (city.kind === "outpost") {
        addRing(`safe-shrine-${city.id}`, ["decor-safe-shrine", "decor-lamp", "city-banner"], city.position, ringX * 0.78, ringY * 0.78, 3, 6.25, 0.72, 0.48);
      }
      if (isHub || city.kind === "fortress") {
        addRing(`city-banners-${city.id}`, "city-banner", city.position, ringX * 1.04, ringY * 1.04, isHub ? 4 : 2, 6.5, 0.58, isHub ? 0.54 : 0.44);
      }
      if (city.kind === "village" || city.kind === "outpost") {
        addRing(`city-camps-${city.id}`, ["city-tent", "decor-bush", "decor-rock-flat"], city.position, ringX * 0.78, ringY * 0.72, isHub ? 0 : 3, 5.8, 0.68, 0.5);
      }
      if (city.kind === "harbor") {
        addRing(`city-docks-${city.id}`, "city-dock", { x: city.position.x, y: city.position.y + city.safeRadius * 0.44 }, city.safeRadius * 0.24, city.safeRadius * 0.08, 2, 5.9, 0.72, 0.6);
      }
      if (city.kind === "sanctum") {
        addRing(`city-crystals-${city.id}`, ["decor-crystal", "decor-obelisk"], city.position, ringX * 0.82, ringY * 0.82, 4, 6.1, 0.68, 0.54);
      }
    });

    WORLD_LANDMARKS.forEach((landmark) => {
      if (landmark.kind === "dungeon" || landmark.kind === "cave") {
        addEllipse(`dungeon-runes-${landmark.id}`, ["decor-rune", "decor-stalagmite", "decor-crystal"], landmark.position, landmark.radius * 1.9, landmark.radius * 1.35, landmark.kind === "dungeon" ? 18 : 10, 5.1, 0.76);
      }
      if (landmark.kind === "boss") {
        addEllipse(`boss-runes-${landmark.id}`, ["decor-rune", "decor-fire", "decor-obelisk"], landmark.position, landmark.radius * 1.55, landmark.radius * 1.1, 18, 5.3, 0.82);
      }
    });

    addEllipse("greenhill-bush", "decor-bush", { x: 1900, y: 2860 }, 3300, 2450, 68, 3, 0.82);
    addEllipse("greenhill-flowers", ["decor-flower", "decor-grass", "decor-bush"], { x: 3000, y: 2850 }, 4500, 2900, 92, 3.1, 0.78);
    addRing("greenhill-forest-frame", ["decor-tree", "decor-pine", "decor-bush"], { x: 2850, y: 3260 }, 2700, 1760, 160, 4.18, 0.92, 0.72);
    addRing("greenhill-rock-frame", ["decor-rock-flat", "decor-pebble", "decor-flower"], { x: 2820, y: 3300 }, 2150, 1380, 96, 2.72, 0.6, 0.5);
    addEllipse("greenhill-meadow-sparkles", ["decor-flower", "decor-grass"], { x: 3560, y: 3380 }, 3300, 1980, 150, 2.45, 0.6);
    addEllipse("greenhill-pond-lilies", ["decor-lily", "decor-lily", "decor-reed"], { x: 2250, y: 3650 }, 1060, 680, 26, 2.55, 0.52);
    addEllipse("brookside-flowers", ["decor-flower", "decor-grass", "decor-bush"], { x: 3300, y: 4200 }, 2600, 1660, 64, 2.8, 0.64);
    addEllipse("arena-south-meadow", ["decor-grass", "decor-flower", "decor-rock-flat"], { x: 4680, y: 5480 }, 2500, 1500, 46, 2.65, 0.54);
    addEllipse("oldmill-brook-bank", ["decor-grass", "decor-rock-flat"], { x: 2840, y: 6500 }, 1900, 1260, 28, 2.8, 0.5);
    addEllipse("wolfpine-mushroom-patches", "decor-mushroom", { x: 6100, y: 2280 }, 1260, 820, 20, 4.25, 0.72);
    addEllipse("oldmill-mushroom-patches", "decor-mushroom", { x: 2300, y: 7020 }, 860, 560, 10, 4.25, 0.68);
    addEllipse("suntrail-camp-meadow", ["decor-flower", "decor-grass", "city-tent", "decor-lamp"], { x: 7050, y: 5050 }, 2200, 1400, 46, 3.35, 0.66);
    addEllipse("wayfarer-stones", ["decor-ruin", "decor-rock-flat", "decor-pebble"], { x: 8350, y: 6150 }, 1900, 1240, 34, 3.8, 0.66);
    addEllipse("riverbend-field", ["decor-flower", "decor-grass", "decor-bush"], { x: 11750, y: 6250 }, 3300, 2000, 64, 2.85, 0.62);
    addEllipse("riverbend-copse", ["decor-tree", "decor-bush", "decor-flower"], { x: 10400, y: 8350 }, 2400, 1600, 36, 3.65, 0.72);
    addEllipse("rift-road-stones", ["decor-rock", "decor-rock-flat", "decor-pebble"], { x: 12600, y: 6800 }, 3400, 2100, 48, 3.1, 0.62);
    addEllipse("southreach-orchard", ["decor-tree", "decor-flower", "city-tent"], { x: 10150, y: 12950 }, 3000, 1900, 42, 3.75, 0.72);
    addEllipse("southreach-meadow", ["decor-grass", "decor-flower", "decor-bush"], { x: 12200, y: 15100 }, 5600, 3300, 74, 2.8, 0.62);
    addEllipse("southreach-ancient-tree", ["decor-ancient-tree", "decor-tree", "decor-bush"], { x: 12600, y: 14700 }, 3600, 2300, 28, 4.05, 0.86);
    addEllipse("blackroot-eye-tree", ["decor-eye-tree", "decor-mushroom", "decor-bush"], { x: 17600, y: 12800 }, 5200, 3300, 76, 4.35, 0.88);
    addEllipse("blackroot-raven", "decor-raven", { x: 17600, y: 12800 }, 4300, 2600, 10, 8.25, 0.84);
    addEllipse("mistwood-tree", ["decor-tree", "decor-bush"], { x: 20500, y: 6200 }, 5000, 3400, 145, 4);
    addEllipse("crownspire-ancient-tree", ["decor-ancient-tree", "decor-tree", "decor-flower"], { x: 23800, y: 9000 }, 5200, 2700, 48, 4.15, 0.88);
    addEllipse("crownmirror-reeds", ["decor-reed", "decor-lily", "decor-flower"], { x: 22300, y: 9800 }, 3000, 1600, 30, 2.8, 0.62);
    addEllipse("crownroad-camp-meadow", ["decor-grass", "decor-flower", "city-tent", "decor-lamp"], { x: 19900, y: 11100 }, 3200, 2050, 46, 3.35, 0.68);
    addEllipse("mirrorway-shrine-reeds", ["decor-reed", "decor-lily", "decor-ruin"], { x: 19050, y: 16450 }, 2800, 1900, 38, 3.2, 0.66);
    addEllipse("mirrorfen-lake-life", ["decor-reed", "decor-lily", "decor-bush"], { x: 22200, y: 19900 }, 4400, 2700, 58, 2.85, 0.68);
    addEllipse("ravenwood-eye-tree", ["decor-eye-tree", "decor-pine", "decor-mushroom"], { x: 31800, y: 9600 }, 5200, 3300, 64, 4.4, 0.86);
    addEllipse("ravenwood-raven", "decor-raven", { x: 31800, y: 9600 }, 3900, 2500, 12, 8.35, 0.88);
    addEllipse("spine-pine", ["decor-pine", "decor-tree"], { x: 44000, y: 7600 }, 5200, 3600, 120, 4);
    addEllipse("north-pine", ["decor-pine", "decor-rock-flat"], { x: 26800, y: 2800 }, 4400, 2400, 86, 4);
    addEllipse("moon-bush", ["decor-bush", "decor-grass"], { x: 7200, y: 9800 }, 3600, 2300, 130, 3, 0.86);
    addEllipse("grass-a", ["decor-grass", "decor-flower"], { x: 3850, y: 3050 }, 5400, 3400, 82, 2, 0.56);
    addEllipse("grass-b", ["decor-grass", "decor-flower"], { x: 11800, y: 9200 }, 8000, 5200, 95, 2, 0.56);
    addEllipse("moonfen-west-moss", ["decor-grass", "decor-bush", "decor-rock-flat"], { x: 5900, y: 9150 }, 2600, 1720, 58, 2.75, 0.62);
    addEllipse("mistford-road-moss", ["decor-bush", "decor-grass", "decor-rock-flat"], { x: 17750, y: 7900 }, 3200, 2100, 72, 3.05, 0.66);
    addEllipse("northroad-snow-stones", ["decor-rock-flat", "decor-pebble", "decor-pine"], { x: 23800, y: 3250 }, 3600, 2100, 70, 3.25, 0.64);
    addEllipse("sapphire-river-bank", ["decor-grass", "decor-rock-flat"], { x: 22800, y: 11680 }, 2500, 1600, 34, 2.85, 0.52);
    addEllipse("coast-beach-palms", ["decor-palm", "decor-bush", "decor-flower"], { x: 25700, y: 12700 }, 3200, 1800, 72, 4.2, 0.84);
    addEllipse("harbor-beach-palms", ["decor-palm", "decor-bush"], { x: 5060, y: 6470 }, 1700, 980, 34, 4.1, 0.78);
    addEllipse("desert-rock", ["decor-rock", "decor-rock-flat", "decor-pebble"], { x: 9300, y: 5000 }, 5200, 3200, 42, 3, 0.74);
    addEllipse("iron-rock", ["decor-rock", "decor-rock-flat", "decor-pebble"], { x: 15200, y: 3550 }, 3600, 2200, 56, 3, 0.78);
    addEllipse("sky-rock", ["decor-rock", "decor-rock-flat", "decor-pebble"], { x: 33000, y: 5200 }, 4000, 2600, 48, 3, 0.78);
    addEllipse("ember-fire", ["decor-fire", "decor-rock-flat", "decor-pebble"], { x: 15400, y: 10300 }, 3400, 2200, 54, 3.15, 0.58);
    addEllipse("forge-fire", ["decor-fire", "decor-rock-flat"], { x: 36500, y: 18600 }, 4800, 2900, 92, 3.2, 0.62);
    addEllipse("obs-crystal", "decor-crystal", { x: 41000, y: 27000 }, 5100, 3300, 130, 5);
    addEllipse("star-crystal", "decor-crystal", { x: 28500, y: 25800 }, 5000, 3100, 95, 5);
    addEllipse("bonefall-graves", ["decor-grave", "decor-bone", "decor-ruin"], { x: 7600, y: 3050 }, 2050, 1300, 46, 4.4, 0.76);
    addEllipse("sunspire-bones", ["decor-bone", "decor-rock-flat", "decor-pebble"], { x: 9300, y: 5000 }, 4200, 2500, 34, 3.8, 0.62);
    addEllipse("moonfen-ruins", ["decor-ruin", "decor-grave", "decor-bush"], { x: 8300, y: 10500 }, 2100, 1500, 62, 4.5, 0.84);
    addEllipse("rift-obelisks", ["decor-obelisk", "decor-crystal", "decor-ruin"], { x: 14850, y: 8500 }, 2700, 1900, 58, 5.2, 0.9);
    addEllipse("star-obelisks", ["decor-obelisk", "decor-crystal"], { x: 30000, y: 25200 }, 2400, 1700, 54, 5.2, 0.88);
    const addAlongPath = (prefix: string, texture: string | string[], points: Vector2[], count: number, depth: number, alpha = 1, offsetBase = 24) => {
      if (points.length < 2) {
        return;
      }

      const itemCount = scaleDecorationCount(count, 0.36);
      const segments = points.slice(0, -1).map((point, index) => {
        const next = points[index + 1];
        return {
          from: point,
          to: next,
          length: Phaser.Math.Distance.Between(point.x, point.y, next.x, next.y)
        };
      });
      const total = segments.reduce((sum, segment) => sum + segment.length, 0);
      for (let index = 0; index < itemCount; index += 1) {
        let cursor = ((index + 0.35) / itemCount) * total;
        const segment = segments.find((candidate) => {
          if (cursor <= candidate.length) {
            return true;
          }
          cursor -= candidate.length;
          return false;
        }) ?? segments[segments.length - 1];
        const t = Phaser.Math.Clamp(cursor / segment.length, 0, 1);
        const side = index % 2 === 0 ? 1 : -1;
        const angle = Math.atan2(segment.to.y - segment.from.y, segment.to.x - segment.from.x);
        const offset = side * (offsetBase + (index % 5) * 9);
        const x = Phaser.Math.Linear(segment.from.x, segment.to.x, t) + Math.cos(angle + Math.PI / 2) * offset;
        const y = Phaser.Math.Linear(segment.from.y, segment.to.y, t) + Math.sin(angle + Math.PI / 2) * offset;
        const selectedTexture = Array.isArray(texture) ? texture[index % texture.length] : texture;
        if (this.decorationBlocked({ x, y }, selectedTexture)) {
          continue;
        }
        this.decorationDefs.push({
          id: `${prefix}-${index}`,
          texture: selectedTexture,
          position: { x, y },
          scale: 0.74 + ((index * 23) % 36) / 100,
          rotation: decorationRotation(selectedTexture, angle, index),
          depth,
          alpha
        });
      }
    };
    const roadPoints = (id: string) => WORLD_ROADS.find((road) => road.id === id)?.points ?? [];
    addAlongPath("kings-road-flowers", "decor-flower", roadPoints("kings-road"), 72, 2.6, 0.62);
    addAlongPath("harbor-road-palms", "decor-palm", roadPoints("harbor-road"), 30, 4.2, 0.68);
    addAlongPath("mist-road-bush", "decor-bush", roadPoints("mist-road"), 76, 3.2, 0.72);
    addAlongPath("mmo-kings-road-banners", ["city-banner", "decor-lamp"], roadPoints("kings-road"), 32, 6.25, 0.78, 58);
    addAlongPath("mmo-crown-road-banners", ["city-banner", "decor-lamp", "decor-rune"], roadPoints("crown-road"), 24, 6.25, 0.76, 62);
    addAlongPath("mmo-iron-road-runes", ["decor-rune", "decor-lamp", "decor-rock-flat"], roadPoints("iron-road"), 28, 5.3, 0.62, 72);
    addAlongPath("mmo-ash-road-fires", ["decor-fire", "decor-rune", "decor-rock-flat"], roadPoints("ash-road"), 34, 5.35, 0.68, 78);
    addAlongPath("mmo-star-road-crystals", ["decor-crystal", "decor-rune"], roadPoints("star-road"), 30, 5.25, 0.7, 72);
    WORLD_RIVERS.forEach((river, index) => {
      const width = river.width ?? 82;
      addAlongPath(`river-lilies-${river.id}`, "decor-lily", river.points, 18 + index * 4, 2.35, 0.56, Math.max(10, width * 0.12));
      addAlongPath(`river-reeds-${river.id}`, "decor-reed", river.points, 12 + index * 2, 2.75, 0.34, width * 0.62 + 42);
    });
    addWaterEllipse("stormharbor-fish", ["decor-fish", "decor-wave"], { x: 2380, y: 7200 }, 2500, 2300, 36, 2.42, 0.62);
    addWaterEllipse("stormharbor-outer-fish", ["decor-fish", "decor-wave"], { x: 1700, y: 6200 }, 2200, 3600, 28, 2.42, 0.54);
    addWaterEllipse("south-sea-fish", ["decor-fish", "decor-wave"], { x: 18000, y: 29800 }, 15000, 2200, 42, 2.42, 0.5);
    WORLD_LAKES.forEach((lake, index) => {
      addWaterEllipse(`lake-fish-${lake.id}`, ["decor-fish", "decor-wave"], lake.position, lake.width * 0.72, lake.height * 0.64, 10 + index * 4, 2.44, 0.56);
    });
    WORLD_WATERFALLS.forEach((fall) => {
      addEllipse(`waterfall-spray-${fall.id}`, ["decor-reed", "decor-rock-flat"], fall.position, fall.width * 1.6, fall.height * 0.96, 10, 2.8, 0.58);
    });
  }

  private seedWorldFoliage(): void {
    if (this.worldFoliageDefinitionCount > 0) {
      return;
    }

    const unit = (value: string) => {
      let hash = 2166136261;
      for (let index = 0; index < value.length; index += 1) {
        hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
      }
      hash += hash << 13;
      hash ^= hash >>> 7;
      hash += hash << 3;
      hash ^= hash >>> 17;
      hash += hash << 5;
      return (hash >>> 0) / 4294967296;
    };
    const regionAt = (position: Vector2) =>
      WORLD_MAP_REGIONS.find((region) =>
        this.pointInEllipse(position, region.position, region.width / 2, region.height / 2)
      );
    const spacingCell = 440;
    const placementBuckets = new Map<string, Array<{ position: Vector2; spacing: number }>>();
    const frameCycles = new Map<string, string[]>();
    const frameCursors = new Map<string, number>();
    const spacingKey = (position: Vector2) =>
      `${Math.floor(position.x / spacingCell)}:${Math.floor(position.y / spacingCell)}`;
    const hasRoom = (position: Vector2, spacing: number) => {
      const cellX = Math.floor(position.x / spacingCell);
      const cellY = Math.floor(position.y / spacingCell);
      for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
          const nearby = placementBuckets.get(`${cellX + offsetX}:${cellY + offsetY}`) ?? [];
          if (
            nearby.some(
              (placed) =>
                Phaser.Math.Distance.Between(position.x, position.y, placed.position.x, placed.position.y) <
                Math.max(spacing, placed.spacing)
            )
          ) {
            return false;
          }
        }
      }
      return true;
    };
    const rememberSpacing = (position: Vector2, spacing: number) => {
      const key = spacingKey(position);
      const bucket = placementBuckets.get(key) ?? [];
      bucket.push({ position, spacing });
      placementBuckets.set(key, bucket);
    };
    const addDefinition = (definition: WorldFoliageDef) => {
      const chunkSize = WorldScene.WORLD_FOLIAGE_CHUNK_SIZE;
      const key = `${Math.floor(definition.position.x / chunkSize)}:${Math.floor(definition.position.y / chunkSize)}`;
      const chunk = this.worldFoliageDefsByChunk.get(key) ?? [];
      chunk.push(definition);
      this.worldFoliageDefsByChunk.set(key, chunk);
      this.worldFoliageDefinitionCount += 1;
    };
    const targetHeightFor = (frame: string, form: WorldFoliageForm, seed: string) => {
      const jitter = unit(`${seed}:height`);
      if (form === "tree") {
        return 148 + jitter * 66;
      }
      if (form === "sapling") {
        return 68 + jitter * 48;
      }
      if (form === "ground") {
        return 30 + jitter * 42;
      }
      const size = Number(frame.split("/").at(-1) ?? 2);
      return Math.max(28, 78 - size * 11) * (0.9 + jitter * 0.2);
    };
    const nextFrame = (biome: WorldBiomeKind, kind: "tree" | "bush", candidates: readonly string[]) => {
      const cycleKey = `${biome}:${kind}`;
      let cycle = frameCycles.get(cycleKey);
      if (!cycle) {
        const remaining = [...candidates].sort(
          (left, right) =>
            unit(`${cycleKey}:${left}:order`) - unit(`${cycleKey}:${right}:order`) || left.localeCompare(right)
        );
        cycle = [];
        while (remaining.length > 0) {
          const previousFamily = cycle.at(-1)?.split("/").slice(0, 2).join("/");
          const differentFamilyIndex = remaining.findIndex(
            (frame) => frame.split("/").slice(0, 2).join("/") !== previousFamily
          );
          const [selected] = remaining.splice(differentFamilyIndex >= 0 ? differentFamilyIndex : 0, 1);
          if (selected) {
            cycle.push(selected);
          }
        }
        frameCycles.set(cycleKey, cycle);
      }
      const cursor = frameCursors.get(cycleKey) ?? Math.floor(unit(`${cycleKey}:offset`) * cycle.length);
      return { cycleKey, cursor, frame: cycle[cursor % cycle.length] };
    };
    const tryPlace = (biome: WorldBiomeKind, seed: string, position: Vector2) => {
      const palette = worldFoliagePaletteFor(biome);
      const tree = unit(`${seed}:kind`) < palette.treeShare;
      const candidates = tree ? palette.treeFrames : palette.bushFrames;
      const frameChoice = nextFrame(biome, tree ? "tree" : "bush", candidates);
      const frame = frameChoice.frame;
      const form = worldFoliageFormForFrame(frame);
      const spacing = form === "tree" ? 420 : form === "sapling" ? 260 : form === "ground" ? 180 : 220;
      const footprint = form === "tree" ? 92 : form === "sapling" ? 56 : form === "ground" ? 48 : 38;
      if (this.worldFoliageBlocked(position, footprint) || !hasRoom(position, spacing)) {
        return false;
      }

      const targetHeight = targetHeightFor(frame, form, seed);
      const depth = form === "tree" ? 4.16 : form === "sapling" ? 3.96 : form === "ground" ? 3.26 : 3.48;
      const idKind = form === "bush" ? "bush" : "tree";
      const positionRounded = { x: Math.round(position.x), y: Math.round(position.y) };
      addDefinition({
        id: `world-foliage-${idKind}-${seed}`,
        frame,
        form,
        position: positionRounded,
        targetHeight,
        depth: depth + unit(`${seed}:depth`) * 0.08,
        alpha: 1,
        flipX: unit(`${seed}:flip`) > 0.5,
        cullRadius: targetHeight * (form === "ground" ? 2.35 : form === "tree" ? 1.05 : 0.9)
      });
      rememberSpacing(positionRounded, spacing);
      frameCursors.set(frameChoice.cycleKey, frameChoice.cursor + 1);
      return true;
    };

    for (const region of WORLD_MAP_REGIONS) {
      const palette = worldFoliagePaletteFor(region.kind);
      const targetCount = Math.max(1, Math.round((region.density ?? 64) * palette.densityScale * 0.09));
      let placed = 0;
      for (let attempt = 0; attempt < targetCount * 10 && placed < targetCount; attempt += 1) {
        const seed = `${region.id}:${attempt}`;
        const angle = unit(`${seed}:angle`) * Math.PI * 2;
        const radius = Math.sqrt(unit(`${seed}:radius`)) * 0.94;
        const position = {
          x: region.position.x + Math.cos(angle) * (region.width / 2) * radius,
          y: region.position.y + Math.sin(angle) * (region.height / 2) * radius
        };
        if (
          position.x < 0 ||
          position.y < 0 ||
          position.x > WORLD_BOUNDS.width ||
          position.y > WORLD_BOUNDS.height ||
          regionAt(position)?.id !== region.id
        ) {
          continue;
        }
        if (tryPlace(region.kind, seed, position)) {
          placed += 1;
        }
      }
    }

    const fallbackCell = 1500;
    for (let cellX = 0; cellX * fallbackCell < WORLD_BOUNDS.width; cellX += 1) {
      for (let cellY = 0; cellY * fallbackCell < WORLD_BOUNDS.height; cellY += 1) {
        const seed = `wildlands:${cellX}:${cellY}`;
        if (unit(`${seed}:occupancy`) > 0.07) {
          continue;
        }
        const position = {
          x: (cellX + 0.16 + unit(`${seed}:x`) * 0.68) * fallbackCell,
          y: (cellY + 0.16 + unit(`${seed}:y`) * 0.68) * fallbackCell
        };
        if (position.x > WORLD_BOUNDS.width || position.y > WORLD_BOUNDS.height || regionAt(position)) {
          continue;
        }
        tryPlace("grass", seed, position);
      }
    }
  }

  private worldFoliageBlocked(position: Vector2, footprint: number): boolean {
    if (this.decorationBlocked(position, "world-foliage")) {
      return true;
    }
    if (this.isVisualOpenWaterPosition(position, footprint * 0.65)) {
      return true;
    }
    if (
      WORLD_RIVERS.some(
        (river) =>
          this.distanceToPolyline(position, [...river.points]) <
          (river.width ?? 82) * 0.52 + footprint * 0.55 + 42
      )
    ) {
      return true;
    }
    if (
      CITY_DEFINITIONS.some(
        (city) =>
          Phaser.Math.Distance.Between(position.x, position.y, city.position.x, city.position.y) <
          city.safeRadius + footprint + 110
      )
    ) {
      return true;
    }
    if (
      CITY_TELEPORTERS.some(
        (teleporter) =>
          Phaser.Math.Distance.Between(position.x, position.y, teleporter.position.x, teleporter.position.y) <
          teleporter.radius + footprint + 120
      )
    ) {
      return true;
    }
    if (
      WORLD_ROADS.some(
        (road) =>
          this.distanceToPolyline(position, [...road.points]) <
          (road.width ?? 62) * 0.5 + footprint * 0.55 + 52
      )
    ) {
      return true;
    }
    if (
      WORLD_LANDMARKS.some(
        (landmark) =>
          Phaser.Math.Distance.Between(position.x, position.y, landmark.position.x, landmark.position.y) <
          landmark.radius + footprint + 72
      )
    ) {
      return true;
    }
    if (
      WORLD_DUNGEON_INTERIORS.some(
        (dungeon) =>
          Math.abs(position.x - dungeon.position.x) < dungeon.width / 2 + footprint + 140 &&
          Math.abs(position.y - dungeon.position.y) < dungeon.height / 2 + footprint + 140
      )
    ) {
      return true;
    }
    return WORLD_OBSTACLES.some((obstacle) => this.pointInWorldObstacle(position, obstacle, footprint + 80));
  }

  private updateWorldFoliage(time: number, force = false): void {
    const mobile = this.isMobileTouchMode();
    if (!this.shouldRenderWorldFoliage()) {
      this.releaseAllWorldFoliageViews();
      this.refreshWorldFoliagePreviewDiagnostics();
      return;
    }

    const camera = this.cameras.main;
    const zoom = camera.zoom || 1;
    const centerX = camera.scrollX + camera.width / zoom / 2;
    const centerY = camera.scrollY + camera.height / zoom / 2;
    const viewportMoved =
      !this.lastWorldFoliageViewport ||
      Phaser.Math.Distance.Between(centerX, centerY, this.lastWorldFoliageViewport.x, this.lastWorldFoliageViewport.y) >
        (mobile ? 260 : 220) ||
      Math.abs(zoom - this.lastWorldFoliageViewport.zoom) > 0.03;
    const interval = mobile ? (this.mobileLeanRuntime ? 720 : 440) : this.desktopLeanRuntime ? 680 : 420;
    if (!force && !viewportMoved && time - this.lastWorldFoliageUpdateAt < interval) {
      return;
    }
    this.lastWorldFoliageUpdateAt = time;
    this.lastWorldFoliageViewport = { x: centerX, y: centerY, zoom };

    const margin = mobile ? (this.mobileLeanRuntime ? 280 : 420) : this.desktopLeanRuntime ? 300 : 460;
    const left = camera.scrollX - margin;
    const right = camera.scrollX + camera.width / zoom + margin;
    const top = camera.scrollY - margin;
    const bottom = camera.scrollY + camera.height / zoom + margin;
    const chunkSize = WorldScene.WORLD_FOLIAGE_CHUNK_SIZE;
    const candidates: WorldFoliageDef[] = [];
    const chunkCullPadding = 260;
    const startChunkX = Math.floor((left - chunkCullPadding) / chunkSize);
    const endChunkX = Math.floor((right + chunkCullPadding) / chunkSize);
    const startChunkY = Math.floor((top - chunkCullPadding) / chunkSize);
    const endChunkY = Math.floor((bottom + chunkCullPadding) / chunkSize);
    for (let chunkX = startChunkX; chunkX <= endChunkX; chunkX += 1) {
      for (let chunkY = startChunkY; chunkY <= endChunkY; chunkY += 1) {
        const chunk = this.worldFoliageDefsByChunk.get(`${chunkX}:${chunkY}`) ?? [];
        for (const definition of chunk) {
          const { x, y } = definition.position;
          if (
            x + definition.cullRadius < left ||
            x - definition.cullRadius > right ||
            y + definition.cullRadius < top ||
            y - definition.cullRadius > bottom
          ) {
            continue;
          }
          candidates.push(definition);
        }
      }
    }

    const maxActive = mobile
      ? this.isMobileMinimalGraphics()
        ? 22
        : this.mobileLeanRuntime || this.isCrowdedScene()
          ? 32
          : 44
      : this.desktopLeanRuntime
        ? this.mobileGraphics.worldDecorations
          ? 60
          : 44
        : this.mobileGraphics.worldDecorations
          ? 96
          : 64;
    candidates.sort((leftCandidate, rightCandidate) => {
      const activeOrder = Number(!this.worldFoliageViews.has(leftCandidate.id)) - Number(!this.worldFoliageViews.has(rightCandidate.id));
      const leftDistance =
        (leftCandidate.position.x - centerX) ** 2 + (leftCandidate.position.y - centerY) ** 2;
      const rightDistance =
        (rightCandidate.position.x - centerX) ** 2 + (rightCandidate.position.y - centerY) ** 2;
      return activeOrder || leftDistance - rightDistance || leftCandidate.id.localeCompare(rightCandidate.id);
    });
    const visible = candidates.slice(0, maxActive);
    const visibleIds = new Set(visible.map((definition) => definition.id));

    for (const [id, view] of this.worldFoliageViews.entries()) {
      if (!visibleIds.has(id)) {
        this.releaseWorldFoliageView(id, view);
      }
    }
    for (const definition of visible) {
      if (this.worldFoliageViews.has(definition.id)) {
        continue;
      }
      const view = this.worldFoliagePool.pop() ?? this.add.image(0, 0, WORLD_FOLIAGE_ATLAS_KEY, definition.frame);
      const atlasFrame = this.textures.get(WORLD_FOLIAGE_ATLAS_KEY).get(definition.frame);
      const rawScale = definition.targetHeight / Math.max(1, atlasFrame.realHeight);
      const scale = Phaser.Math.Clamp(Math.round(rawScale * 20) / 20, 0.25, 3.2) * (mobile ? 0.96 : 1);
      view
        .setActive(true)
        .setVisible(true)
        .setTexture(WORLD_FOLIAGE_ATLAS_KEY, definition.frame)
        .setPosition(definition.position.x, definition.position.y)
        .setOrigin(0.5, 1)
        .setScale(scale)
        .setDepth(definition.depth)
        .setRotation(0)
        .setAlpha(definition.alpha)
        .setFlipX(definition.flipX)
        .clearTint();
      this.worldFoliageViews.set(definition.id, view);
    }
    this.refreshWorldFoliagePreviewDiagnostics();
  }

  private shouldRenderWorldFoliage(): boolean {
    if (this.isMobileTouchMode()) {
      return this.mobileGraphics.worldDecorations && !this.mobileSustainedLeanRuntime;
    }
    return (
      this.mobileGraphics.worldDecorations ||
      (this.mobileGraphics.preset !== "cool" && this.mobileGraphics.preset !== "minimal")
    );
  }

  private createWorldFoliagePreviewDiagnostics(): void {
    const existing = document.getElementById("world-foliage-preview-diagnostics");
    const element = existing instanceof HTMLDivElement ? existing : document.createElement("div");
    element.id = "world-foliage-preview-diagnostics";
    Object.assign(element.style, {
      position: "fixed",
      right: "12px",
      bottom: "12px",
      zIndex: "2147483647",
      pointerEvents: "none",
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      fontSize: "11px",
      color: "#dcfce7",
      background: "rgba(5, 20, 12, 0.8)",
      border: "1px solid rgba(74, 222, 128, 0.4)",
      borderRadius: "6px",
      padding: "5px 7px"
    });
    if (!element.parentElement) {
      document.body.appendChild(element);
    }
    this.worldFoliagePreviewDiagnostics = element;
    this.refreshWorldFoliagePreviewDiagnostics();
  }

  private refreshWorldFoliagePreviewDiagnostics(): void {
    if (!this.worldFoliagePreviewDiagnostics) {
      return;
    }
    const camera = this.cameras.main;
    const zoom = camera.zoom || 1;
    const center = {
      x: camera.scrollX + camera.width / zoom / 2,
      y: camera.scrollY + camera.height / zoom / 2
    };
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const chunk of this.worldFoliageDefsByChunk.values()) {
      for (const definition of chunk) {
        nearestDistance = Math.min(
          nearestDistance,
          Phaser.Math.Distance.Between(center.x, center.y, definition.position.x, definition.position.y)
        );
      }
    }
    this.worldFoliagePreviewDiagnostics.textContent =
      `Foliage ${this.worldFoliageViews.size}/${this.worldFoliageDefinitionCount}` +
      ` · chunks ${this.worldFoliageDefsByChunk.size}` +
      ` · nearest ${Number.isFinite(nearestDistance) ? Math.round(nearestDistance) : "-"}` +
      ` · mode ${this.shouldRenderWorldFoliage() ? (this.mobileGraphics.worldDecorations ? "full" : "balanced") : "off"}` +
      ` · ${this.isMobileTouchMode() ? "mobile" : "desktop"}` +
      ` · fps ${Math.max(0, Math.round(this.game.loop.actualFps || 0))}`;
  }

  private releaseWorldFoliageView(id: string, view: Phaser.GameObjects.Image): void {
    this.worldFoliageViews.delete(id);
    view.setActive(false).setVisible(false);
    if (this.worldFoliagePool.length < 128) {
      this.worldFoliagePool.push(view);
    } else {
      view.destroy();
    }
  }

  private releaseAllWorldFoliageViews(): void {
    for (const [id, view] of [...this.worldFoliageViews.entries()]) {
      this.releaseWorldFoliageView(id, view);
    }
  }

  private destroyWorldFoliage(): void {
    for (const view of this.worldFoliageViews.values()) {
      view.destroy();
    }
    for (const view of this.worldFoliagePool) {
      view.destroy();
    }
    this.worldFoliageViews.clear();
    this.worldFoliagePool.length = 0;
    this.worldFoliageDefsByChunk.clear();
    this.worldFoliageDefinitionCount = 0;
    this.lastWorldFoliageViewport = undefined;
  }

  private updateDecorations(time: number): void {
    const mobile = this.isMobileTouchMode();
    if (!this.mobileGraphics.worldDecorations || (mobile && this.mobileSustainedLeanRuntime)) {
      for (const view of this.decorations.values()) {
        view.destroy();
      }
      this.decorations.clear();
      return;
    }

    const camera = this.cameras.main;
    const zoom = camera.zoom || 1;
    const centerX = camera.scrollX + camera.width / zoom / 2;
    const centerY = camera.scrollY + camera.height / zoom / 2;
    const viewportMoved =
      !this.lastDecorationViewport ||
      Phaser.Math.Distance.Between(centerX, centerY, this.lastDecorationViewport.x, this.lastDecorationViewport.y) > (mobile ? 300 : 260) ||
      Math.abs(zoom - this.lastDecorationViewport.zoom) > 0.03;
    const interval = mobile ? (this.mobileLeanRuntime ? 700 : 420) : this.desktopLeanRuntime ? 650 : 420;
    if (!viewportMoved && time - this.lastDecorationUpdateAt < interval) {
      return;
    }
    this.lastDecorationUpdateAt = time;
    this.lastDecorationViewport = { x: centerX, y: centerY, zoom };

    const margin = mobile ? (this.mobileLeanRuntime ? 360 : this.isCrowdedScene() ? 420 : 520) : this.desktopLeanRuntime ? 260 : 340;
    const left = camera.scrollX - margin;
    const right = camera.scrollX + camera.width / zoom + margin;
    const top = camera.scrollY - margin;
    const bottom = camera.scrollY + camera.height / zoom + margin;
    const visibleIds = new Set<string>();

    for (const decoration of this.decorationDefs) {
      const { x, y } = decoration.position;
      if (x < left || x > right || y < top || y > bottom) {
        continue;
      }

      visibleIds.add(decoration.id);
      if (!this.decorations.has(decoration.id)) {
        const alpha = decoration.alpha ?? 1;
        const visibleAlpha = mobile ? Math.min(1, alpha * 1.2 + 0.08) : alpha;
        const visibleScale = mobile ? decoration.scale * 1.04 : decoration.scale;
        const view = this.add
          .image(x, y, decoration.texture)
          .setDepth(decoration.depth)
          .setScale(visibleScale)
          .setRotation(decoration.rotation)
          .setAlpha(visibleAlpha);
        view.setData("originX", x);
        view.setData("originY", y);
        view.setData("baseScale", visibleScale);
        view.setData("baseRotation", decoration.rotation);
        this.decorations.set(decoration.id, view);
      }
    }

    for (const [id, view] of this.decorations.entries()) {
      if (!visibleIds.has(id)) {
        view.destroy();
        this.decorations.delete(id);
      }
    }
  }

  private updateTerrainTiles(time: number): void {
    const mobile = this.isMobileTouchMode();
    const camera = this.cameras.main;
    const zoom = camera.zoom || 1;
    const centerX = camera.scrollX + camera.width / zoom / 2;
    const centerY = camera.scrollY + camera.height / zoom / 2;
    const viewportMoved =
      !this.lastTerrainViewport ||
      Phaser.Math.Distance.Between(centerX, centerY, this.lastTerrainViewport.x, this.lastTerrainViewport.y) > (mobile ? 360 : 320) ||
      Math.abs(zoom - this.lastTerrainViewport.zoom) > 0.03;
    const fullWorldMobile = mobile && this.usesMobileFullWorldMap();
    const highFullPlusMobile = mobile && this.isMobileHighFullPlusGraphics();
    const widePlusMobile = mobile && this.isMobileWidePlusWorldGraphics();
    const wideMobile = mobile && this.isMobileWideWorldGraphics();
    const interval = mobile
      ? fullWorldMobile
        ? 180
        : highFullPlusMobile
          ? 190
          : widePlusMobile
          ? 210
          : wideMobile
          ? 240
          : this.mobileSustainedLeanRuntime
            ? 900
            : this.mobileLeanRuntime
              ? 460
              : 320
      : this.desktopLeanRuntime
        ? 650
        : 420;
    if (!viewportMoved && time - this.lastTerrainUpdateAt < interval) {
      return;
    }
    this.lastTerrainUpdateAt = time;
    this.lastTerrainViewport = { x: centerX, y: centerY, zoom };

    const chunk = mobile ? (fullWorldMobile ? 1024 : highFullPlusMobile ? 1152 : widePlusMobile ? 1280 : wideMobile ? 1536 : 2048) : this.desktopLeanRuntime ? 1280 : 1024;
    const margin = mobile
      ? fullWorldMobile
        ? 620
        : highFullPlusMobile
          ? 600
          : widePlusMobile
          ? 540
          : wideMobile
          ? 460
          : this.mobileSustainedLeanRuntime
            ? 160
            : this.mobileLeanRuntime
              ? 220
              : 300
      : this.desktopLeanRuntime
        ? 420
        : 560;
    const edgePadding = WorldScene.CAMERA_EDGE_PADDING;
    const viewLeft = Math.max(-edgePadding, camera.scrollX - margin);
    const viewRight = Math.min(WORLD_BOUNDS.width + edgePadding, camera.scrollX + camera.width / zoom + margin);
    const viewTop = Math.max(-edgePadding, camera.scrollY - margin);
    const viewBottom = Math.min(WORLD_BOUNDS.height + edgePadding, camera.scrollY + camera.height / zoom + margin);
    const visibleIds = new Set<string>();

    for (const patch of this.terrainPatches) {
      const patchLeft = patch.x - patch.width / 2;
      const patchRight = patch.x + patch.width / 2;
      const patchTop = patch.y - patch.height / 2;
      const patchBottom = patch.y + patch.height / 2;
      const left = Math.max(viewLeft, patchLeft);
      const right = Math.min(viewRight, patchRight);
      const top = Math.max(viewTop, patchTop);
      const bottom = Math.min(viewBottom, patchBottom);
      if (left >= right || top >= bottom) {
        continue;
      }

      const startX = Math.floor((left - patchLeft) / chunk) * chunk + patchLeft;
      const endX = Math.ceil((right - patchLeft) / chunk) * chunk + patchLeft;
      const startY = Math.floor((top - patchTop) / chunk) * chunk + patchTop;
      const endY = Math.ceil((bottom - patchTop) / chunk) * chunk + patchTop;

      for (let tileX = startX; tileX < endX; tileX += chunk) {
        for (let tileY = startY; tileY < endY; tileY += chunk) {
          const tileWidth = Math.min(chunk, patchRight - tileX);
          const tileHeight = Math.min(chunk, patchBottom - tileY);
          if (tileWidth <= 0 || tileHeight <= 0) {
            continue;
          }

          const id = `${patch.id}:${Math.round(tileX)}:${Math.round(tileY)}`;
          visibleIds.add(id);
          let tile = this.terrainTiles.get(id);
          if (!tile) {
            tile = this.add
              .tileSprite(tileX + tileWidth / 2, tileY + tileHeight / 2, tileWidth, tileHeight, patch.texture)
              .setDepth(patch.depth)
              .setAlpha(patch.alpha)
              .setTilePosition(tileX - patchLeft, tileY - patchTop);
            this.terrainTiles.set(id, tile);
          }
        }
      }
    }

    for (const [id, tile] of this.terrainTiles.entries()) {
      if (!visibleIds.has(id)) {
        tile.destroy();
        this.terrainTiles.delete(id);
      }
    }
  }

  private updateStaticMapGraphicsLayers(time: number, force = false): void {
    if (this.staticMapGraphicsLayers.length === 0 || this.isMobileTouchMode()) {
      return;
    }

    const camera = this.cameras.main;
    const zoom = camera.zoom || 1;
    const centerX = camera.scrollX + camera.width / zoom / 2;
    const centerY = camera.scrollY + camera.height / zoom / 2;
    const viewportMoved =
      !this.lastStaticMapLayerViewport ||
      Phaser.Math.Distance.Between(centerX, centerY, this.lastStaticMapLayerViewport.x, this.lastStaticMapLayerViewport.y) > 180 ||
      Math.abs(zoom - this.lastStaticMapLayerViewport.zoom) > 0.03;
    const interval = this.desktopLeanRuntime ? 420 : 260;
    if (!force && !viewportMoved && time - this.lastStaticMapLayerUpdateAt < interval) {
      return;
    }

    this.lastStaticMapLayerUpdateAt = time;
    this.lastStaticMapLayerViewport = { x: centerX, y: centerY, zoom };
    const margin = this.desktopLeanRuntime ? 420 : 620;
    const left = camera.scrollX - margin;
    const right = camera.scrollX + camera.width / zoom + margin;
    const top = camera.scrollY - margin;
    const bottom = camera.scrollY + camera.height / zoom + margin;
    for (const layer of this.staticMapGraphicsLayers) {
      const visible = layer.right >= left && layer.left <= right && layer.bottom >= top && layer.top <= bottom;
      if (layer.view.visible !== visible) {
        layer.view.setVisible(visible);
      }
    }
  }

  private createAmbientLayer(): void {
    const moteColors = [0xfef9c3, 0xd9f99d, 0xbae6fd, 0xfef3c7];
    this.ambientMotes = Array.from({ length: 16 }, (_, index) => ({
      dot: this.add
        .circle(0, 0, 1.5 + (index % 3) * 0.7, moteColors[index % moteColors.length], 0)
        .setDepth(60)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setVisible(false),
      seed: index * 137.51 + 17.3
    }));
  }

  private ambientMotesEnabled(): boolean {
    if (this.isMobileTouchMode()) {
      return this.mobileGraphics.combatEffects && !this.mobileLeanRuntime && !this.mobileSustainedLeanRuntime;
    }
    return !this.desktopLeanRuntime;
  }

  // Drives the day/night cycle used for firefly brightness and night ambient sounds
  // (crickets/owl instead of birds) only — intentionally does not tint the screen.
  private updateDayNightTint(time: number): void {
    if (time - this.lastDayNightUpdateAt < 2_000) {
      return;
    }
    this.lastDayNightUpdateAt = time;

    const cycleMs = 24 * 60 * 1000;
    const serverTime = this.snapshot?.serverTime ?? Date.now();
    const phase = (serverTime % cycleMs) / cycleMs;
    const daylight = 0.5 - 0.5 * Math.cos(phase * Math.PI * 2);
    const night = Phaser.Math.Clamp((0.58 - daylight) / 0.58, 0, 1);
    this.worldNightAmount = night;
  }

  private updateAmbientLayer(time: number): void {
    const camera = this.cameras.main;
    const zoom = camera.zoom || 1;
    const viewWidth = camera.width / zoom;
    const viewHeight = camera.height / zoom;
    const centerX = camera.scrollX + viewWidth / 2;
    const centerY = camera.scrollY + viewHeight / 2;

    const interval = this.isMobileTouchMode() ? 66 : 33;
    if (time - this.lastAmbientUpdateAt < interval) {
      return;
    }
    this.lastAmbientUpdateAt = time;
    this.updateDayNightTint(time);

    const enabled = this.ambientMotesEnabled();
    if (!enabled) {
      this.ambientMotes.forEach((mote) => mote.dot.setVisible(false));
      return;
    }

    this.ambientMotes.forEach((mote) => {
      const seed = mote.seed;
      const driftPhase = time * 0.000042 * (0.6 + ((seed * 7.3) % 1) * 0.8);
      const cellX = Math.sin(seed * 12.9898) * 0.5 + 0.5;
      const cellY = Math.sin(seed * 78.233) * 0.5 + 0.5;
      const wanderX = Math.sin(driftPhase * Math.PI * 2 + seed) * viewWidth * 0.22;
      const wanderY = Math.cos(driftPhase * Math.PI * 1.4 + seed * 2.1) * viewHeight * 0.2 - ((time * 0.006 + seed * 90) % (viewHeight * 0.5));
      const rawX = centerX - viewWidth / 2 + cellX * viewWidth + wanderX;
      const rawY = centerY - viewHeight / 2 + cellY * viewHeight + wanderY + viewHeight * 0.25;
      const wrappedX = Phaser.Math.Wrap(rawX, centerX - viewWidth * 0.55, centerX + viewWidth * 0.55);
      const wrappedY = Phaser.Math.Wrap(rawY, centerY - viewHeight * 0.55, centerY + viewHeight * 0.55);
      const pulse = 0.5 + Math.sin(time * 0.0021 + seed * 3.7) * 0.5;
      mote.dot
        .setVisible(true)
        .setPosition(wrappedX, wrappedY)
        .setAlpha((0.05 + pulse * 0.2) * (1 + this.worldNightAmount * 1.6));
    });
  }

  private updateMobileScenery(time: number): void {
    if (!this.isMobileTouchMode() || this.mobileSustainedLeanRuntime) {
      this.mobileScenery?.clear();
      return;
    }

    const camera = this.cameras.main;
    const zoom = camera.zoom || 1;
    const centerX = camera.scrollX + camera.width / zoom / 2;
    const centerY = camera.scrollY + camera.height / zoom / 2;
    const highFullPlus = this.isMobileHighFullPlusGraphics();
    const viewportMoved =
      !this.lastMobileSceneryViewport ||
      Phaser.Math.Distance.Between(centerX, centerY, this.lastMobileSceneryViewport.x, this.lastMobileSceneryViewport.y) > (this.mobileLeanRuntime ? 620 : highFullPlus ? 380 : 460) ||
      Math.abs(zoom - this.lastMobileSceneryViewport.zoom) > 0.03;
    const interval = this.mobileLeanRuntime ? 1100 : highFullPlus ? 560 : 700;
    if (!viewportMoved && time - this.lastMobileSceneryUpdateAt < interval) {
      return;
    }
    this.lastMobileSceneryUpdateAt = time;
    this.lastMobileSceneryViewport = { x: centerX, y: centerY, zoom };

    if (!this.mobileScenery) {
      this.mobileScenery = this.add.graphics().setDepth(-8.86);
    }

    const graphics = this.mobileScenery;
    graphics.clear();

    const margin = this.mobileLeanRuntime ? 340 : highFullPlus ? 560 : 460;
    const bounds = {
      left: camera.scrollX - margin,
      right: camera.scrollX + camera.width / zoom + margin,
      top: camera.scrollY - margin,
      bottom: camera.scrollY + camera.height / zoom + margin
    };

    const intersectsRect = (left: number, top: number, right: number, bottom: number) =>
      right >= bounds.left && left <= bounds.right && bottom >= bounds.top && top <= bounds.bottom;
    const ellipseVisible = (position: Vector2, width: number, height: number) =>
      intersectsRect(position.x - width / 2, position.y - height / 2, position.x + width / 2, position.y + height / 2);
    const segmentVisible = (start: Vector2, end: Vector2, pad: number) =>
      intersectsRect(Math.min(start.x, end.x) - pad, Math.min(start.y, end.y) - pad, Math.max(start.x, end.x) + pad, Math.max(start.y, end.y) + pad);

    type MobileGroundKind = (typeof WORLD_MAP_REGIONS)[number]["kind"] | "grass";
    const noise = (x: number, y: number, salt: number) => {
      const value = Math.sin(x * 0.0129898 + y * 0.078233 + salt * 37.719) * 43758.5453;
      return value - Math.floor(value);
    };
    const biomeAt = (position: Vector2): MobileGroundKind => {
      for (const region of WORLD_MAP_REGIONS) {
        const dx = (position.x - region.position.x) / (region.width / 2);
        const dy = (position.y - region.position.y) / (region.height / 2);
        if (dx * dx + dy * dy <= 1) {
          return region.kind;
        }
      }
      return "grass";
    };
    const groundPalette = (kind: MobileGroundKind) => {
      if (kind === "forest") {
        return { blade: 0xa3e65a, brush: 0x2f8d3c, dark: 0x1d5f2a, stone: 0x6b7d69, flower: 0xf9a8d4 };
      }
      if (kind === "darkForest") {
        return { blade: 0x7ea37a, brush: 0x1d342f, dark: 0x10251f, stone: 0x64748b, flower: 0xc084fc };
      }
      if (kind === "desert" || kind === "coast") {
        return { blade: 0xf7df8b, brush: 0xc4923c, dark: 0x9a6b2c, stone: 0xd6a956, flower: 0xfef3c7 };
      }
      if (kind === "snow") {
        return { blade: 0xf8fafc, brush: 0xcfe2ec, dark: 0x8fb0c5, stone: 0x94a3b8, flower: 0xdbeafe };
      }
      if (kind === "swamp") {
        return { blade: 0x9ccc65, brush: 0x2f7f61, dark: 0x235a46, stone: 0x64748b, flower: 0x67e8f9 };
      }
      if (kind === "fire") {
        return { blade: 0xf97316, brush: 0x984328, dark: 0x6f2117, stone: 0x7f1d1d, flower: 0xfacc15 };
      }
      if (kind === "void") {
        return { blade: 0xc4b5fd, brush: 0x5b2f8b, dark: 0x2d1b4d, stone: 0xa78bfa, flower: 0xf5f3ff };
      }
      if (kind === "mountain") {
        return { blade: 0xcbd5e1, brush: 0x64748b, dark: 0x334155, stone: 0x334155, flower: 0xe2e8f0 };
      }
      return { blade: 0xc6ef73, brush: 0x5faa43, dark: 0x3f7c2c, stone: 0x94a3b8, flower: 0xfef08a };
    };
    const roadAt = (position: Vector2) => {
      for (const road of WORLD_ROADS) {
        const width = road.width ?? 62;
        if (this.distanceToPolyline(position, road.points) <= width * 0.56 + 18) {
          return road;
        }
      }
      return undefined;
    };
    const drawLocalGroundTexture = () => {
      const step = this.mobileLeanRuntime ? 220 : highFullPlus ? 132 : 168;
      const startX = Math.floor(bounds.left / step) * step;
      const startY = Math.floor(bounds.top / step) * step;
      for (let x = startX; x <= bounds.right; x += step) {
        for (let y = startY; y <= bounds.bottom; y += step) {
          const px = x + (noise(x, y, 1) - 0.5) * step * 0.72;
          const py = y + (noise(x, y, 2) - 0.5) * step * 0.72;
          if (px < bounds.left || px > bounds.right || py < bounds.top || py > bounds.bottom) {
            continue;
          }
          const seed = noise(px, py, 3);
          if (this.isWaterPosition({ x: px, y: py })) {
            if (seed < 0.22) {
              continue;
            }
            graphics.lineStyle(2, 0xc7f9ff, 0.24 + seed * 0.14);
            graphics.lineBetween(px - 20 - seed * 24, py, px + 22 + seed * 22, py + (seed - 0.5) * 9);
            graphics.lineStyle(1, 0x075985, 0.14);
            graphics.lineBetween(px - 14, py + 8, px + 18, py + 5 + (seed - 0.5) * 6);
            if (!this.mobileLeanRuntime && seed > 0.72) {
              graphics.fillStyle(0x7dd3fc, 0.2);
              graphics.fillEllipse(px + 12, py + 10, 38, 15);
            }
            continue;
          }

          const road = roadAt({ x: px, y: py });
          if (road) {
            const lengthSeed = noise(px, py, 9);
            graphics.fillStyle(seed > 0.52 ? 0x9a7a4d : 0x5f4328, 0.22 + seed * 0.18);
            graphics.fillEllipse(px, py, 18 + lengthSeed * 24, 8 + seed * 10);
            if (seed > 0.46) {
              graphics.lineStyle(2, 0xd6a15d, 0.12 + seed * 0.1);
              graphics.lineBetween(px - 18, py + (seed - 0.5) * 5, px + 18, py - (seed - 0.5) * 5);
            }
            continue;
          }

          const palette = groundPalette(biomeAt({ x: px, y: py }));
          const width = 40 + seed * 54;
          const height = 12 + seed * 19;
          graphics.fillStyle(seed > 0.7 ? palette.blade : palette.brush, 0.24 + seed * 0.26);
          graphics.fillEllipse(px, py, width, height);
          if (seed > 0.34) {
            graphics.fillStyle(palette.dark, 0.1 + seed * 0.12);
            graphics.fillEllipse(px - width * 0.12, py + height * 0.12, width * 0.58, height * 0.48);
          }
          if (seed > 0.58) {
            graphics.lineStyle(2, palette.blade, 0.24);
            graphics.lineBetween(px - width * 0.28, py + height * 0.1, px + width * 0.24, py - height * 0.22);
          }
          if (!this.mobileLeanRuntime && seed > 0.84) {
            graphics.fillStyle(seed > 0.92 ? palette.flower : palette.stone, 0.34);
            graphics.fillCircle(px + width * 0.22, py - height * 0.2, 5 + seed * 6);
          }
        }
      }
    };

    const biomeColor = (kind: (typeof WORLD_MAP_REGIONS)[number]["kind"]) => {
      if (kind === "forest") {
        return { fill: 0x2f9d46, accent: 0xb7f36a };
      }
      if (kind === "darkForest") {
        return { fill: 0x213d35, accent: 0x8ddf9b };
      }
      if (kind === "desert") {
        return { fill: 0xd59b36, accent: 0xffe08a };
      }
      if (kind === "coast") {
        return { fill: 0x42c4b8, accent: 0xf1d477 };
      }
      if (kind === "snow") {
        return { fill: 0xcfe2ec, accent: 0xf8fafc };
      }
      if (kind === "swamp") {
        return { fill: 0x25866c, accent: 0x9be15d };
      }
      if (kind === "fire") {
        return { fill: 0xa8492d, accent: 0xffb020 };
      }
      if (kind === "void") {
        return { fill: 0x6d3ba8, accent: 0xd8b4fe };
      }
      if (kind === "mountain") {
        return { fill: 0x64748b, accent: 0xe2e8f0 };
      }
      return { fill: 0x5faa43, accent: 0xb6e36f };
    };

    WORLD_MAP_REGIONS.forEach((region, index) => {
      if (!ellipseVisible(region.position, region.width, region.height)) {
        return;
      }
      const colors = biomeColor(region.kind);
      graphics.fillStyle(colors.fill, region.kind === "coast" ? 0.15 : 0.2);
      graphics.fillEllipse(region.position.x, region.position.y, region.width * 0.76, region.height * 0.62);
      graphics.fillStyle(colors.accent, 0.12);
      graphics.fillEllipse(
        region.position.x - region.width * (0.11 - (index % 3) * 0.025),
        region.position.y - region.height * (0.08 + (index % 2) * 0.025),
        region.width * 0.32,
        region.height * 0.2
      );
    });

    WORLD_LAKES.forEach((lake) => {
      if (!ellipseVisible(lake.position, lake.width + 260, lake.height + 160)) {
        return;
      }
      graphics.fillStyle(0xd6a956, 0.2);
      graphics.fillEllipse(lake.position.x, lake.position.y, lake.width + 210, lake.height + 132);
      graphics.fillStyle(0x8fd4ce, 0.24);
      graphics.fillEllipse(lake.position.x, lake.position.y, lake.width + 90, lake.height + 52);
      graphics.fillStyle(0x54b7cf, 0.98);
      graphics.fillEllipse(lake.position.x, lake.position.y, lake.width, lake.height);
      graphics.fillStyle(0xc7f9ff, 0.14);
      graphics.fillEllipse(lake.position.x - lake.width * 0.14, lake.position.y - lake.height * 0.16, lake.width * 0.42, lake.height * 0.18);
      const waveCount = this.mobileLeanRuntime ? 1 : 2;
      for (let wave = 0; wave < waveCount; wave += 1) {
        const y = lake.position.y + lake.height * (-0.08 + wave * 0.16);
        const length = lake.width * (0.34 + wave * 0.08);
        graphics.lineStyle(2, 0xe0f7ff, 0.1);
        graphics.lineBetween(lake.position.x - length * 0.5, y, lake.position.x + length * 0.5, y + lake.height * 0.012);
      }
    });

    const sampleLocalRoute = (points: readonly Vector2[], steps = 5): Vector2[] => {
      if (points.length < 2) {
        return [...points];
      }
      const catmullLocal = (p0: number, p1: number, p2: number, p3: number, t: number) => {
        const t2 = t * t;
        const t3 = t2 * t;
        return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
      };
      const samples: Vector2[] = [points[0]];
      for (let index = 0; index < points.length - 1; index += 1) {
        const previous = points[Math.max(0, index - 1)];
        const current = points[index];
        const next = points[index + 1];
        const after = points[Math.min(points.length - 1, index + 2)];
        for (let step = 1; step <= steps; step += 1) {
          const t = step / steps;
          samples.push({
            x: catmullLocal(previous.x, current.x, next.x, after.x, t),
            y: catmullLocal(previous.y, current.y, next.y, after.y, t)
          });
        }
      }
      return samples;
    };
    const strokeLocalRun = (points: Vector2[], width: number, color: number, alphaValue: number) => {
      if (points.length < 2) {
        return;
      }
      graphics.lineStyle(width, color, alphaValue);
      graphics.beginPath();
      graphics.moveTo(points[0].x, points[0].y);
      points.slice(1).forEach((point) => graphics.lineTo(point.x, point.y));
      graphics.strokePath();
    };
    const drawRoute = (routes: typeof WORLD_ROADS | typeof WORLD_RIVERS, core: number, edge: number, widthBoost: number, alpha: number, skipOpenWater = false) => {
      routes.forEach((route) => {
        const width = (route.width ?? 60) + widthBoost;
        const points = skipOpenWater ? sampleLocalRoute(route.points, 5) : [...route.points];
        const edgeRun: Vector2[] = [];
        const coreRun: Vector2[] = [];
        let edgeMouth = false;
        let coreMouth = false;
        const flush = () => {
          strokeLocalRun(edgeRun, width + 28, edgeMouth ? 0x0a6a78 : edge, edgeMouth ? alpha * 0.12 : alpha * 0.34);
          strokeLocalRun(coreRun, width, coreMouth ? 0x168a99 : core, coreMouth ? alpha * 0.22 : alpha);
          edgeRun.length = 0;
          coreRun.length = 0;
        };
        for (let index = 0; index < points.length - 1; index += 1) {
          const start = points[index];
          const end = points[index + 1];
          const midpoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
          if (!segmentVisible(start, end, width * 0.75)) {
            continue;
          }
          const mouth =
            skipOpenWater &&
            (this.isRiverMouthWaterPosition(midpoint, width) ||
              this.isRiverMouthWaterPosition(start, width) ||
              this.isRiverMouthWaterPosition(end, width));
          if (edgeRun.length > 0 && mouth !== edgeMouth) {
            flush();
          }
          if (edgeRun.length === 0) {
            edgeMouth = mouth;
            coreMouth = mouth;
            edgeRun.push(start);
            coreRun.push(start);
          }
          edgeRun.push(end);
          coreRun.push(end);
          if (!skipOpenWater) {
            graphics.fillStyle(edge, alpha * 0.24);
            graphics.fillCircle(start.x, start.y, (width + 20) * 0.5);
            graphics.fillCircle(end.x, end.y, (width + 20) * 0.5);
            graphics.fillStyle(core, alpha * 0.92);
            graphics.fillCircle(start.x, start.y, width * 0.42);
            graphics.fillCircle(end.x, end.y, width * 0.42);
          }
        }
        flush();
      });
    };

    drawRoute(WORLD_RIVERS, 0x0a8eaa, 0xd6a956, 24, 0.84, true);
    drawRoute(WORLD_ROADS, 0x8b6840, 0x2d1f14, 8, 0.7);
    drawLocalGroundTexture();

    WORLD_MOUNTAINS.forEach((mountain, mountainIndex) => {
      const size = mountain.size * 42;
      const position = mountain.position;
      if (!ellipseVisible(position, size * 2.2, size * 1.8)) {
        return;
      }
      this.drawMountainShape(graphics, position.x, position.y, size, mountainIndex * 7.3 + 1.7, 0.92);
    });

    WORLD_SCENIC_DETAILS.forEach((detail, detailIndex) => {
      if (!ellipseVisible(detail.position, detail.radius * 2, detail.radius * 1.5)) {
        return;
      }
      const color = detail.kind === "flowers" ? 0xf9a8d4 : detail.kind === "stones" || detail.kind === "shells" ? 0xcbd5e1 : detail.kind === "runes" ? 0xc4b5fd : 0x86c45f;
      const count = this.mobileLeanRuntime ? 2 : 3;
      for (let index = 0; index < count; index += 1) {
        const angle = ((index * 137 + detailIndex * 23) % 360) * Phaser.Math.DEG_TO_RAD;
        const radius = detail.radius * (0.22 + index * 0.13);
        graphics.fillStyle(color, 0.12);
        graphics.fillEllipse(detail.position.x + Math.cos(angle) * radius, detail.position.y + Math.sin(angle) * radius * 0.72, 72, 22);
      }
    });
  }

  private updateMobileRuntimeBudget(time: number): void {
    if (this.lastMobilePerfFrameAt > 0) {
      const frameMs = time - this.lastMobilePerfFrameAt;
      if (frameMs > 34) {
        this.mobileSlowFrameScore = Math.min(120, this.mobileSlowFrameScore + 3);
      } else if (frameMs > 24) {
        this.mobileSlowFrameScore = Math.min(120, this.mobileSlowFrameScore + 1);
      } else {
        this.mobileSlowFrameScore = Math.max(0, this.mobileSlowFrameScore - 0.35);
      }
    }
    this.lastMobilePerfFrameAt = time;

    const actualFps = this.game.loop.actualFps;
    if (!this.mobileRefreshLocked && time > 2_600 && actualFps > 0) {
      this.mobileRefreshLocked = true;
      this.setMobileFpsLimit(this.mobileGraphics.fpsLimit);
    }

    const desktopGraphics = this.isMobileDesktopGraphics();
    const highFullPlusGraphics = this.isMobileHighFullPlusGraphics();
    const highFullGraphics = this.isMobileHighFullGraphics();
    const mediumFullGraphics = this.isMobileMediumFullGraphics();
    const minimalGraphics = this.isMobileMinimalGraphics();
    const coolGraphics = this.isMobileCoolGraphics();
    const lowFpsThreshold = minimalGraphics ? 27 : coolGraphics ? 38 : highFullPlusGraphics ? 47 : highFullGraphics ? 46 : mediumFullGraphics ? 44 : 48;
    const leanAfterMs = minimalGraphics ? 6_000 : coolGraphics ? 10_000 : highFullPlusGraphics ? 60_000 : highFullGraphics ? 42_000 : mediumFullGraphics ? 30_000 : 18_000;
    const crowdLeanAfterMs = minimalGraphics ? 1_800 : coolGraphics ? 2_800 : highFullPlusGraphics ? 10_000 : highFullGraphics ? 8_000 : mediumFullGraphics ? 6_500 : 4_000;
    const crowdSustainAfterMs = minimalGraphics ? 3_200 : coolGraphics ? 4_800 : highFullPlusGraphics ? 15_000 : highFullGraphics ? 12_500 : mediumFullGraphics ? 10_000 : 7_000;
    const sustainAfterMs = minimalGraphics ? 18_000 : coolGraphics ? 30_000 : highFullPlusGraphics ? 110_000 : highFullGraphics ? 84_000 : mediumFullGraphics ? 60_000 : 42_000;
    const deepAfterMs = minimalGraphics ? 42_000 : coolGraphics ? 78_000 : highFullPlusGraphics ? 190_000 : highFullGraphics ? 160_000 : mediumFullGraphics ? 140_000 : MOBILE_DEEP_SUSTAIN_MS;
    if (!desktopGraphics && time > leanAfterMs) {
      this.mobileLeanRuntime = true;
    }
    if (time > 6_000 && (this.mobileSlowFrameScore >= 26 || (actualFps > 0 && actualFps < lowFpsThreshold))) {
      this.mobileLeanRuntime = true;
      this.setMobileFpsLimit(this.mobileGraphics.fpsLimit);
    }
    if (!desktopGraphics && time > crowdLeanAfterMs && this.isCrowdedScene()) {
      this.mobileLeanRuntime = true;
    }
    if (!desktopGraphics && time > crowdSustainAfterMs && this.isCrowdedScene()) {
      this.enterMobileSustainedLeanRuntime();
    }
    if ((!desktopGraphics && time > sustainAfterMs) || this.mobileSlowFrameScore >= 46 || (actualFps > 0 && actualFps < lowFpsThreshold - 6)) {
      this.enterMobileSustainedLeanRuntime();
    }
    if ((!desktopGraphics && time > deepAfterMs) || this.mobileSlowFrameScore >= 72 || (time > 18_000 && actualFps > 0 && actualFps < lowFpsThreshold - 12)) {
      this.enterMobileDeepSustainRuntime();
    }

    if (time - this.lastMobileRuntimeCleanupAt >= 3_000) {
      this.lastMobileRuntimeCleanupAt = time;
      this.pruneMobileRuntimeCaches(time);
    }
  }

  private enterMobileSustainedLeanRuntime(): void {
    if (this.mobileSustainedLeanRuntime) {
      return;
    }

    this.mobileSustainedLeanRuntime = true;
    this.mobileLeanRuntime = true;
    this.mobileScenery?.clear();
    this.clearToneTimers();
    for (const view of this.decorations.values()) {
      view.destroy();
    }
    this.decorations.clear();
  }

  private enterMobileDeepSustainRuntime(): void {
    if (this.mobileDeepSustainRuntime) {
      return;
    }

    this.mobileDeepSustainRuntime = true;
    this.enterMobileSustainedLeanRuntime();
    this.clearToneTimers();
    this.pruneTransientEffects(this.time.now, true);
  }

  private pruneMobileRuntimeCaches(time: number): void {
    if (this.renderedEventIds.size > 100) {
      const ids = [...this.renderedEventIds].slice(-70);
      this.renderedEventIds.clear();
      ids.forEach((id) => this.renderedEventIds.add(id));
    }

    for (const [id, requestedAt] of this.pickupFeedbackItemIds.entries()) {
      if (time - requestedAt > 4_000) {
        this.pickupFeedbackItemIds.delete(id);
      }
    }

    if (this.toneTimers.size > 24) {
      this.clearToneTimers();
    }

    this.pruneTransientEffects(time);

    if (this.pendingInputs.size > MAX_STORED_INPUTS * 2) {
      this.prunePendingInputs(this.seq - MAX_STORED_INPUTS);
    }

    if (this.mobileSustainedLeanRuntime) {
      this.mobileScenery?.clear();
      for (const view of this.decorations.values()) {
        view.destroy();
      }
      this.decorations.clear();
    }
  }

  private trackTransient<T extends Phaser.GameObjects.GameObject>(object: T, ttlMs = MOBILE_TRANSIENT_EFFECT_TTL_MS): T {
    this.transientEffects.add(object);
    object.setData("transientCreatedAt", this.time.now);
    object.setData("transientTtlMs", ttlMs);
    object.once(Phaser.GameObjects.Events.DESTROY, () => {
      this.transientEffects.delete(object);
    });
    return object;
  }

  private destroyTransientEffect(object: Phaser.GameObjects.GameObject): void {
    this.transientEffects.delete(object);
    if (object.scene && object.active) {
      object.destroy();
    }
  }

  private destroyTransientEffects(): void {
    for (const object of [...this.transientEffects]) {
      this.destroyTransientEffect(object);
    }
    this.transientEffects.clear();
  }

  private pruneTransientEffects(time: number, force = false): void {
    const limit = this.isMobileMinimalGraphics() ? 8 : this.mobileDeepSustainRuntime ? MOBILE_DEEP_TRANSIENT_EFFECT_LIMIT : this.isMobileCoolGraphics() ? 18 : MOBILE_TRANSIENT_EFFECT_LIMIT;
    const alive: Phaser.GameObjects.GameObject[] = [];
    for (const object of this.transientEffects) {
      if (!object.scene || !object.active) {
        this.transientEffects.delete(object);
        continue;
      }
      const createdAt = Number(object.getData("transientCreatedAt") ?? time);
      const ttlMs = Number(object.getData("transientTtlMs") ?? MOBILE_TRANSIENT_EFFECT_TTL_MS);
      if (force || time - createdAt > ttlMs) {
        this.destroyTransientEffect(object);
        continue;
      }
      alive.push(object);
    }

    if (alive.length <= limit) {
      return;
    }

    alive
      .sort((a, b) => Number(a.getData("transientCreatedAt") ?? 0) - Number(b.getData("transientCreatedAt") ?? 0))
      .slice(0, alive.length - limit)
      .forEach((object) => this.destroyTransientEffect(object));
  }

  private setMobileFpsLimit(limit: number): void {
    const loop = this.game?.loop as (Phaser.Core.TimeStep & { _limitRate?: number; fpsLimitTriggered?: boolean }) | undefined;
    if (!loop) {
      return;
    }

    if (this.mobileFpsLimit === limit) {
      return;
    }

    this.mobileFpsLimit = limit;
    loop.targetFps = limit;
    loop.fpsLimit = limit;
    loop.hasFpsLimit = limit > 0;
    loop._limitRate = limit > 0 ? 1000 / limit : 0;
    loop.fpsLimitTriggered = false;
  }

  private updateDesktopRuntimeBudget(time: number): void {
    if (this.lastDesktopPerfFrameAt > 0) {
      const frameMs = time - this.lastDesktopPerfFrameAt;
      if (frameMs > 14.5) {
        this.desktopSlowFrameScore = Math.min(120, this.desktopSlowFrameScore + 3);
      } else if (frameMs > 10.5) {
        this.desktopSlowFrameScore = Math.min(120, this.desktopSlowFrameScore + 1);
      } else {
        this.desktopSlowFrameScore = Math.max(0, this.desktopSlowFrameScore - 0.75);
      }
    }
    this.lastDesktopPerfFrameAt = time;

    const actualFps = this.game.loop.actualFps;
    this.desktopLeanRuntime = time > 4_000 && (this.desktopSlowFrameScore >= 18 || (actualFps > 0 && actualFps < 104));

  }

  private updateFpsOverlay(time: number): void {
    if (!this.mobileGraphics.showFps) {
      this.destroyFpsOverlay();
      return;
    }

    if (!this.fpsOverlayElement) {
      const existing = document.getElementById("mmo-fps-overlay");
      this.fpsOverlayElement = existing instanceof HTMLDivElement ? existing : document.createElement("div");
      this.fpsOverlayElement.id = "mmo-fps-overlay";
      this.fpsOverlayElement.textContent = "FPS --";
      Object.assign(this.fpsOverlayElement.style, {
        position: "fixed",
        left: "12px",
        top: "12px",
        zIndex: "2147483647",
        pointerEvents: "none",
        whiteSpace: "pre",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        fontSize: "13px",
        lineHeight: "1.25",
        letterSpacing: "0",
        color: "#dcfce7",
        background: "rgba(5, 12, 9, 0.82)",
        border: "1px solid rgba(34, 197, 94, 0.45)",
        borderRadius: "7px",
        padding: "7px 9px",
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.38), inset 0 0 0 1px rgba(255, 255, 255, 0.06)",
        textShadow: "0 1px 2px #000",
        backdropFilter: "blur(4px)"
      });
      if (!this.fpsOverlayElement.parentElement) {
        document.body.appendChild(this.fpsOverlayElement);
      }
    }

    this.fpsOverlayElement.style.top = `${this.isMobileTouchMode() ? 82 : 12}px`;
    this.fpsOverlayElement.style.display = "block";
    if (time - this.lastFpsOverlayUpdateAt < 250) {
      return;
    }

    this.lastFpsOverlayUpdateAt = time;
    const fps = Math.max(0, Math.round(this.game.loop.actualFps || 0));
    const frameMs = fps > 0 ? 1000 / fps : 0;
    const mode = this.isMobileTouchMode()
      ? `${this.mobileFpsLimit} ${this.tr(this.mobileLeanRuntime ? "LEAN" : "FPS")}`
      : this.desktopLeanRuntime
        ? `120 ${this.tr("LEAN")}`
        : "120 FPS";
    this.fpsOverlayElement.textContent = `FPS ${fps}\n${frameMs.toFixed(1)} ms ${mode}`;
  }

  private destroyFpsOverlay(): void {
    this.fpsOverlayElement?.remove();
    this.fpsOverlayElement = undefined;
  }

  private stopProceduralAmbientAudio(): void {
    if (this.birdAmbientGain || this.birdAmbientVolume > 0 || this.nextBirdAmbientAt > 0) {
      this.stopBirdAmbientAudio();
    }
    if (this.worldMusicGain || this.worldMusicFilter || this.worldMusicVolume > 0 || this.worldMusicKey) {
      this.stopWorldMusic();
    }
  }

  private animateVisibleDecorations(time: number): void {
    for (const [id, view] of this.decorations.entries()) {
      if (this.desktopLeanRuntime && (id.includes("raven") || id.includes("ancient-tree") || id.includes("eye-tree"))) {
        continue;
      }
      if (id.includes("wave")) {
        const originX = Number(view.getData("originX") ?? view.x);
        const originY = Number(view.getData("originY") ?? view.y);
        const baseScale = Number(view.getData("baseScale") ?? view.scaleX);
        const baseRotation = Number(view.getData("baseRotation") ?? view.rotation);
        const phase = time / 640 + originX * 0.004 + originY * 0.006;
        view.setPosition(originX + Math.sin(phase) * 5, originY + Math.cos(phase * 0.7) * 2);
        view.setScale(baseScale * (0.92 + Math.sin(phase * 1.4) * 0.12), baseScale * (0.82 + Math.cos(phase) * 0.08));
        view.setRotation(baseRotation + Math.sin(phase * 0.8) * 0.035);
        view.setAlpha(0.28 + Math.sin(phase * 1.6) * 0.1);
      } else if (id.includes("fish")) {
        const originX = Number(view.getData("originX") ?? view.x);
        const originY = Number(view.getData("originY") ?? view.y);
        const baseRotation = Number(view.getData("baseRotation") ?? view.rotation);
        const phase = time / 1150 + originX * 0.006 + originY * 0.003;
        view.setPosition(originX + Math.sin(phase) * 18, originY + Math.cos(phase * 0.72) * 7);
        view.setRotation(baseRotation + Math.sin(phase) * 0.06);
        view.setAlpha(0.48 + Math.sin(phase * 1.35) * 0.11);
      } else if (id.includes("raven")) {
        const originX = Number(view.getData("originX") ?? view.x);
        const originY = Number(view.getData("originY") ?? view.y);
        const baseScale = Number(view.getData("baseScale") ?? view.scaleX);
        const phase = time / 1250 + originX * 0.0027 + originY * 0.0019;
        const wing = 1 + Math.sin(time / 95 + originX * 0.01) * 0.16;
        view.setPosition(originX + Math.sin(phase) * 86, originY + Math.cos(phase * 0.72) * 34);
        view.setRotation(Math.sin(phase * 0.9) * 0.18);
        view.setScale(baseScale * wing, baseScale * (1 - Math.sin(time / 95 + originY * 0.01) * 0.08));
        view.setAlpha(0.58 + Math.sin(phase * 1.6) * 0.22);
      } else if (id.includes("fire")) {
        const originX = Number(view.getData("originX") ?? view.x);
        const originY = Number(view.getData("originY") ?? view.y);
        const baseScale = Number(view.getData("baseScale") ?? view.scaleX);
        const phase = time / 92 + originX * 0.02;
        const flicker = Math.sin(phase) * 0.12 + Math.sin(phase * 1.7 + originY * 0.01) * 0.06;
        view.setPosition(originX + Math.sin(phase * 0.5) * 1.8, originY - Math.abs(Math.sin(phase * 0.7)) * 3);
        view.setScale(Math.max(0.36, baseScale * (0.94 + flicker)), Math.max(0.42, baseScale * (1.02 + flicker * 1.15)));
        view.setAlpha(0.72 + Math.abs(Math.sin(phase * 1.25)) * 0.24);
      } else if (id.includes("ancient-tree") || id.includes("eye-tree")) {
        const baseRotation = Number(view.getData("baseRotation") ?? 0);
        const baseScale = Number(view.getData("baseScale") ?? view.scaleX);
        const sway = Math.sin(time / 1150 + view.x * 0.0013) * 0.025;
        view.setRotation(baseRotation + sway);
        view.setScale(baseScale * (1 + Math.sin(time / 1400 + view.y * 0.001) * 0.018));
      } else if (id.includes("tree") || id.includes("pine") || id.includes("grass") || id.includes("bush")) {
        const baseRotation = Number(view.getData("baseRotation") ?? 0);
        view.setRotation(baseRotation + Math.sin(time / 900 + view.x * 0.001) * 0.012);
      } else if (id.includes("crystal")) {
        view.setAlpha(0.72 + Math.sin(time / 450 + view.x * 0.01) * 0.18);
      }
    }
  }

  private updateCheckpointFires(time: number): void {
    const mobile = this.isMobileTouchMode();
    for (const fire of this.checkpointFires.values()) {
      if (!this.isPositionNearCamera({ x: fire.flame.x, y: fire.flame.y }, mobile ? 420 : this.desktopLeanRuntime ? 520 : 720)) {
        continue;
      }

      const pulse = 1 + Math.sin(time / 110 + fire.seed) * 0.08 + Math.sin(time / 53 + fire.seed * 1.7) * 0.035;
      const slowPulse = 1 + Math.sin(time / 420 + fire.seed) * 0.08;
      fire.flame.setScale(fire.baseScale * 0.72 * pulse, fire.baseScale * 0.72 * (1.02 + Math.sin(time / 74 + fire.seed) * 0.1));
      fire.flame.setAlpha(0.82 + Math.sin(time / 68 + fire.seed) * 0.12);
      fire.glow.setScale(slowPulse, 0.94 + Math.sin(time / 260 + fire.seed) * 0.08);
      fire.glow.setAlpha(0.18 + Math.sin(time / 180 + fire.seed) * 0.08);
      fire.aura.setScale(1 + Math.sin(time / 620 + fire.seed) * 0.05);
      fire.aura.setAlpha(0.08 + Math.sin(time / 500 + fire.seed) * 0.04);

      const sparkPhaseA = (time / 900 + fire.seed) % 1;
      const sparkPhaseB = (time / 1200 + fire.seed * 0.37) % 1;
      fire.sparkA.setPosition(fire.flame.x - 22 * fire.baseScale + Math.sin(time / 160 + fire.seed) * 8, fire.flame.y - 34 * fire.baseScale - sparkPhaseA * 42 * fire.baseScale);
      fire.sparkB.setPosition(fire.flame.x + 28 * fire.baseScale + Math.cos(time / 190 + fire.seed) * 7, fire.flame.y - 22 * fire.baseScale - sparkPhaseB * 34 * fire.baseScale);
      fire.sparkA.setAlpha((1 - sparkPhaseA) * 0.82);
      fire.sparkB.setAlpha((1 - sparkPhaseB) * 0.68);
    }
  }

  private updateWorldHazards(time: number): void {
    const now = Date.now();
    const mobile = this.isMobileTouchMode();
    for (const hazard of WORLD_HAZARDS) {
      const view = this.hazardViews.get(hazard.id);
      if (!view) {
        continue;
      }
      const cameraMargin = Math.max(hazard.width, hazard.height) * 0.5 + (mobile ? 360 : this.desktopLeanRuntime ? 480 : 680);
      if (!this.isPositionNearCamera(hazard.position, cameraMargin)) {
        continue;
      }

      const cycle = Math.max(1, hazard.cycleMs);
      const phase = now % cycle;
      const warningStartsAt = Math.max(0, cycle - hazard.warningMs);
      const active = phase <= hazard.activeMs;
      const warning = !active && phase >= warningStartsAt;
      const charge = warning && hazard.warningMs > 0 ? (phase - warningStartsAt) / hazard.warningMs : 0;
      const pulse = 0.5 + Math.sin(time / 80 + hazard.position.x * 0.001) * 0.5;

      if (hazard.kind === "orbStream") {
        view.warning.setAlpha(warning ? 0.1 + charge * 0.24 : active ? 0.14 + pulse * 0.08 : 0.035);
        view.glow.setAlpha(active ? 0.18 + pulse * 0.16 : warning ? 0.1 + charge * 0.14 : 0.04);
        const rotation = hazard.rotation ?? 0;
        const tangentX = Math.cos(rotation);
        const tangentY = Math.sin(rotation);
        const normalX = -Math.sin(rotation);
        const normalY = Math.cos(rotation);
        const travelPhase = hazard.activeMs > 0 ? Phaser.Math.Clamp(phase / hazard.activeMs, 0, 1) : 0;
        view.orbs?.forEach((orb, index) => {
          const orbPhase = (travelPhase + index / HAZARD_ORB_COUNT) % 1;
          const laneWave = Math.sin(now / 220 + index * 1.7) * hazard.height * 0.24;
          const x = hazard.position.x + tangentX * ((orbPhase - 0.5) * hazard.width) + normalX * laneWave;
          const y = hazard.position.y + tangentY * ((orbPhase - 0.5) * hazard.width) + normalY * laneWave;
          orb.setPosition(x, y);
          orb.setRadius(22 + Math.sin(time / 140 + index) * 4);
          orb.setAlpha(active ? 0.74 + pulse * 0.18 : warning ? 0.22 + charge * 0.28 : 0);
        });
        view.sparks?.forEach((spark, index) => {
          const orb = view.orbs?.[index];
          if (!orb) {
            return;
          }
          spark.setPosition(orb.x, orb.y);
          spark.setScale(1 + pulse * 0.28 + index * 0.03);
          spark.setAlpha(active ? 0.12 + pulse * 0.08 : warning ? 0.06 + charge * 0.08 : 0);
        });
        continue;
      }

      const alwaysOn = hazard.activeMs >= hazard.cycleMs;
      const baseAlpha = hazard.kind === "riftCrack" ? 0.2 : 0.04;
      view.warning.setAlpha(alwaysOn ? 0.18 + pulse * 0.08 : warning ? 0.14 + charge * 0.24 : active ? 0.12 + pulse * 0.08 : baseAlpha);
      view.glow.setAlpha(alwaysOn ? 0.28 + pulse * 0.12 : active ? 0.58 + pulse * 0.24 : warning ? 0.08 + charge * 0.24 : 0);
      view.core?.setAlpha(
        hazard.kind === "riftCrack"
          ? 0.78 + pulse * 0.18
          : active
            ? 0.88 + pulse * 0.1
            : warning
              ? 0.12 + charge * 0.24
              : 0
      );
      view.glow.setScale(1, hazard.kind === "laserGate" && active ? 1 + pulse * 0.35 : 1);
    }
  }

  private updatePortalAnimations(time: number): void {
    for (const [id, view] of this.teleportViews.entries()) {
      if (!this.isPositionNearCamera({ x: view.x, y: view.y }, this.isMobileTouchMode() ? 360 : this.desktopLeanRuntime ? 460 : 620)) {
        continue;
      }

      const pulse = 1 + Math.sin(time / 360 + id.length) * 0.08;
      view.setScale(pulse);
      view.setAlpha(0.72 + Math.sin(time / 420 + id.length) * 0.18);
    }
    for (const [id, view] of this.dungeonPortalViews.entries()) {
      if (!this.isPositionNearCamera({ x: view.x, y: view.y }, this.isMobileTouchMode() ? 420 : this.desktopLeanRuntime ? 520 : 700)) {
        continue;
      }

      const phase = time / 1400 + id.length * 0.17;
      const wave = 0.5 - Math.cos(phase * Math.PI * 2) * 0.5;
      view.setScale(0.96 + wave * 0.14);
      view.setAlpha(0.46 + wave * 0.24);
    }
  }

  private refreshCrowdMetrics(time: number): void {
    if (!this.snapshot || time - this.lastCrowdMetricsAt < 240) {
      return;
    }
    this.lastCrowdMetricsAt = time;

    let visible = 0;
    let arena = 0;
    for (const player of this.snapshot.players) {
      if (player.hp <= 0 || player.downed) {
        continue;
      }
      if (this.isPositionNearCamera(player.position, 180)) {
        visible += 1;
      }
      if (this.isStarterArenaPosition(player.position)) {
        arena += 1;
      }
    }
    this.visiblePlayerCount = visible;
    this.arenaPlayerCount = arena;
  }

  private isCrowdedScene(): boolean {
    const local = this.localPlayer();
    const localInArena = local ? this.isStarterArenaPosition(this.localRenderPosition(local)) : false;
    const mobile = this.isMobileTouchMode();
    const visibleLimit = mobile ? this.mobileCrowdVisibleLimit() : CROWDED_VISIBLE_PLAYERS;
    const arenaLimit = mobile ? this.mobileCrowdArenaLimit() : CROWDED_ARENA_PLAYERS;
    return this.visiblePlayerCount >= visibleLimit || (localInArena && this.arenaPlayerCount >= arenaLimit);
  }

  private isPositionNearCamera(position: Vector2, margin: number): boolean {
    const camera = this.cameras.main;
    const zoom = camera.zoom || 1;
    const left = camera.scrollX - margin;
    const right = camera.scrollX + camera.width / zoom + margin;
    const top = camera.scrollY - margin;
    const bottom = camera.scrollY + camera.height / zoom + margin;
    return position.x >= left && position.x <= right && position.y >= top && position.y <= bottom;
  }

  private distanceSquared(a: Vector2, b: Vector2): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
  }

  private updatePkModeIndicator(): void {
    this.syncWorldCursor();
    if (!this.pkModeText) {
      return;
    }

    const mobile = this.isMobileTouchMode();
    this.pkModeText
      .setText(this.tr(mobile ? "PK ON" : "PK: attack players"))
      .setOrigin(mobile ? 1 : 0.5, 0)
      .setFontSize(mobile ? "12px" : "14px")
      .setPosition(mobile ? this.scale.width - 12 : this.scale.width / 2, mobile ? 12 : 18);
    this.pkModeText.setVisible(this.isForcePkDown() && !this.isInputBlocked());
    this.updatePkButtonVisual();
  }

  private syncWorldCursor(interactive = this.worldCursorInteractive): void {
    const blocked = this.inputSuspended || this.isMobileTouchMode() || this.isInputBlocked();
    const attack = !blocked && this.isForcePkDown();
    const hotAttack = attack && Boolean(this.keys?.CTRL?.isDown);
    const pickup = !blocked && interactive && !attack;
    const mode = `${attack ? 1 : 0}:${hotAttack ? 1 : 0}:${pickup ? 1 : 0}`;
    if (mode === this.worldCursorMode) {
      return;
    }

    this.worldCursorMode = mode;
    const root = document.documentElement;
    root.classList.toggle("mmoAttackCursor", attack);
    root.classList.toggle("mmoAttackCursorHot", hotAttack);
    root.classList.toggle("mmoPickupCursor", pickup);
  }

  private clearWorldCursor(): void {
    this.worldCursorMode = "";
    this.worldCursorInteractive = false;
    document.documentElement.classList.remove("mmoAttackCursor", "mmoAttackCursorHot", "mmoPickupCursor");
  }

  private updateSystemLogLayout(): void {
    const text = this.eventText;
    if (!text) {
      return;
    }

    const width = this.scale.width;
    const height = this.scale.height;
    const zoom = this.cameras.main.zoom || 1;
    const mobile = this.isMobileTouchMode();
    const landscape = width > height;
    const layout = mobile
      ? landscape
        ? {
            x: 12,
            y: 112,
            width: Math.min(300, Math.max(210, width * 0.28)),
            fontSize: "11px"
          }
        : {
            x: 12,
            y: 124,
            width: Math.min(300, Math.max(190, width - 24)),
            fontSize: "10px"
          }
      : {
          x: 14,
          y: 150,
          width: 310,
          fontSize: "12px"
        };
    const signature = `${layout.x}:${layout.y}:${layout.width}:${layout.fontSize}:${zoom.toFixed(3)}`;
    if (signature !== this.systemLogLayoutSignature) {
      this.systemLogLayoutSignature = signature;
      text.setOrigin(0, 0);
      text.setFontSize(layout.fontSize);
      text.setWordWrapWidth(layout.width);
    }
    text.setPosition(layout.x / zoom, layout.y / zoom).setScale(1 / zoom);
  }

  private updateAimReticle(): void {
    const local = this.localPlayer();
    if (!local || this.isInputBlocked() || this.isMobileTouchMode()) {
      this.aimReticle?.setVisible(false);
      return;
    }

    const aim = this.pointerAim(local);
    if (!this.aimReticle) {
      this.aimReticle = this.add.circle(aim.x, aim.y, 10, 0xfacc15, 0).setStrokeStyle(2, 0xfacc15, 0.8).setDepth(95);
    }
    this.aimReticle.setVisible(true).setPosition(aim.x, aim.y);
  }

  private drawMountainShape(graphics: Phaser.GameObjects.Graphics, x: number, y: number, size: number, seed: number, alpha = 1): void {
    const ridgeNoise = (value: number) => {
      const raw = Math.sin(value * 12.9898 + seed * 78.233) * 43758.5453;
      return raw - Math.floor(raw);
    };
    const tracePath = (points: Vector2[], fill: number, fillAlpha: number) => {
      graphics.fillStyle(fill, fillAlpha);
      graphics.beginPath();
      graphics.moveTo(points[0].x, points[0].y);
      points.slice(1).forEach((point) => graphics.lineTo(point.x, point.y));
      graphics.closePath();
      graphics.fillPath();
    };
    const ridgeLine = (fromX: number, fromY: number, peakX: number, peakY: number, toX: number, toY: number, jag: number, steps = 7): Vector2[] => {
      const points: Vector2[] = [];
      for (let index = 0; index <= steps; index += 1) {
        const t = index / steps;
        const baseX = t < 0.5 ? Phaser.Math.Linear(fromX, peakX, t * 2) : Phaser.Math.Linear(peakX, toX, (t - 0.5) * 2);
        const baseY = t < 0.5 ? Phaser.Math.Linear(fromY, peakY, t * 2) : Phaser.Math.Linear(peakY, toY, (t - 0.5) * 2);
        const edge = index === 0 || index === steps;
        const wobble = edge ? 0 : (ridgeNoise(index * 3.7) - 0.5) * jag;
        points.push({ x: baseX + wobble * 0.4, y: baseY + wobble });
      }
      return points;
    };

    graphics.fillStyle(0x020617, 0.2 * alpha);
    graphics.fillEllipse(x, y + size * 0.46, size * 1.5, size * 0.34);

    const baseLeft = x - size * 0.78;
    const baseRight = x + size * 0.82;
    const baseY = y + size * 0.5;
    const peakY = y - size * 0.7;
    const sidePeakLeftY = y - size * 0.3;
    const sidePeakRightY = y - size * 0.38;

    tracePath(
      [
        { x: baseLeft, y: baseY },
        ...ridgeLine(baseLeft, baseY, x - size * 0.42, sidePeakLeftY, x - size * 0.1, y - size * 0.06, size * 0.07),
        ...ridgeLine(x - size * 0.1, y - size * 0.06, x + size * 0.44, sidePeakRightY, baseRight, baseY, size * 0.08)
      ],
      0x2e3a4a,
      0.9 * alpha
    );

    const mainRidge = ridgeLine(x - size * 0.58, baseY, x + size * 0.03, peakY, x + size * 0.6, baseY, size * 0.09, 9);
    tracePath([{ x: x - size * 0.58, y: baseY }, ...mainRidge], 0x47586c, 0.96 * alpha);
    tracePath(
      [{ x: x + size * 0.03, y: peakY }, ...ridgeLine(x + size * 0.03, peakY, x + size * 0.3, y - size * 0.18, x + size * 0.6, baseY, size * 0.06, 6)],
      0x36455a,
      0.85 * alpha
    );

    const snowBottom = y - size * 0.3;
    const snow: Vector2[] = [{ x: x + size * 0.03, y: peakY }];
    for (let index = 0; index <= 6; index += 1) {
      const t = index / 6;
      const sx = Phaser.Math.Linear(x - size * 0.2, x + size * 0.24, t);
      const sy = snowBottom + Math.sin(t * Math.PI * 3 + seed) * size * 0.05 + (ridgeNoise(index * 5.1) - 0.5) * size * 0.05;
      snow.push({ x: sx, y: sy });
    }
    tracePath(snow, 0xe8eef4, 0.85 * alpha);
    graphics.fillStyle(0xf8fafc, 0.5 * alpha);
    graphics.fillEllipse(x + size * 0.01, peakY + size * 0.09, size * 0.16, size * 0.07);

    graphics.lineStyle(2, 0x1c2733, 0.3 * alpha);
    graphics.lineBetween(x + size * 0.02, peakY + size * 0.12, x - size * 0.12, y + size * 0.22);
    graphics.lineBetween(x + size * 0.05, peakY + size * 0.2, x + size * 0.22, y + size * 0.26);
  }

  private drawMap(): void {
    let graphics = this.add.graphics();
    const mobile = this.isMobileTouchMode();
    const mobileFullWorldMap = mobile && this.usesMobileFullWorldMap();
    const desktopFullWorldMap = !mobile;
    const fullWorldDetailSaver = desktopFullWorldMap || mobileFullWorldMap;
    const mobileLowPowerMap = !desktopFullWorldMap && (mobile ? !mobileFullWorldMap : true);
    const edgePadding = WorldScene.CAMERA_EDGE_PADDING;
    const cityVisualRadius = (city: (typeof CITY_DEFINITIONS)[number]) => {
      const scale =
        city.id === "crownspire"
          ? 0.56
          : city.id === "greenhill"
            ? 0.46
            : city.kind === "harbor"
              ? 0.56
              : city.kind === "fortress"
                ? 0.54
                : city.kind === "village" || city.kind === "sanctum"
                  ? 0.52
                  : 0.46;
      const minimum =
        city.kind === "harbor"
          ? 280
          : city.kind === "village" || city.kind === "fortress"
            ? 245
            : city.kind === "sanctum"
              ? 225
              : city.kind === "outpost"
                ? 180
                : 0;
      return Math.min(city.safeRadius * 0.72, Math.max(minimum, city.safeRadius * scale));
    };
    const cityKindLabel = (city: (typeof CITY_DEFINITIONS)[number]) =>
      city.kind === "capital"
        ? "Capital"
        : city.kind === "harbor"
          ? "Harbor"
          : city.kind === "fortress"
            ? "Fortress"
            : city.kind === "sanctum"
              ? "Sanctum"
              : city.kind === "outpost"
                ? "Outpost"
                : city.kind === "village"
                  ? "Village"
                  : "Town";
    this.terrainPatches.length = 0;
    const addTexturedPatch = (id: string, x: number, y: number, width: number, height: number, texture: string, alpha = 0.82, depth = -9) => {
      this.terrainPatches.push({ id, texture, x, y, width, height, alpha, depth });
    };
    // Keep chunked tile sprites only for the world base; biome overlays are organic paths so edges do not become rectangular seams.
    addTexturedPatch("edge-water", WORLD_BOUNDS.width / 2, WORLD_BOUNDS.height / 2, WORLD_BOUNDS.width + edgePadding * 2, WORLD_BOUNDS.height + edgePadding * 2, "tile-water", 0.18, -10.25);
    addTexturedPatch("base-grass", WORLD_BOUNDS.width / 2, WORLD_BOUNDS.height / 2, WORLD_BOUNDS.width, WORLD_BOUNDS.height, "tile-grass", 1, -10);
    if (mobileLowPowerMap) {
      const mobileBiomePalette = (kind: (typeof WORLD_MAP_REGIONS)[number]["kind"]) => {
        if (kind === "forest") {
          return { outer: 0x1f7438, inner: 0x42b04b, accent: 0xb7f36a };
        }
        if (kind === "darkForest") {
          return { outer: 0x17352e, inner: 0x30523f, accent: 0x8ddf9b };
        }
        if (kind === "desert") {
          return { outer: 0x9c6724, inner: 0xdcaa45, accent: 0xffe08a };
        }
        if (kind === "coast") {
          return { outer: 0x0d8598, inner: 0xd9bf6a, accent: 0x67e8f9 };
        }
        if (kind === "snow") {
          return { outer: 0x8098a8, inner: 0xd8e7ef, accent: 0xf8fafc };
        }
        if (kind === "swamp") {
          return { outer: 0x0f6155, inner: 0x3f9a68, accent: 0xb5f36c };
        }
        if (kind === "fire") {
          return { outer: 0x642019, inner: 0xb6532d, accent: 0xffb020 };
        }
        if (kind === "void") {
          return { outer: 0x2d174b, inner: 0x6d3ba8, accent: 0xd8b4fe };
        }
        if (kind === "mountain") {
          return { outer: 0x334155, inner: 0x94a3b8, accent: 0xe2e8f0 };
        }
        return { outer: 0x2f7d36, inner: 0x63b64b, accent: 0xb8e866 };
      };

      WORLD_MAP_REGIONS.forEach((region) => {
        const palette = mobileBiomePalette(region.kind);
        this.add
          .ellipse(region.position.x, region.position.y, region.width * 1.14, region.height * 1.1, palette.outer, 0.26)
          .setDepth(-9.78);
        this.add
          .ellipse(region.position.x, region.position.y, region.width * 0.94, region.height * 0.88, palette.inner, region.kind === "coast" ? 0.34 : 0.48)
          .setDepth(-9.7);
        this.add
          .ellipse(region.position.x - region.width * 0.08, region.position.y - region.height * 0.1, region.width * 0.42, region.height * 0.28, palette.accent, 0.2)
          .setDepth(-9.68);
      });
    }
    WORLD_LANDMARKS.filter((landmark) => landmark.zone === "dungeon").forEach((landmark) => {
      addTexturedPatch(`dungeon-floor-${landmark.id}`, landmark.position.x, landmark.position.y, landmark.radius * 2.35, landmark.radius * 1.75, "tile-dungeon", 0.12, -9.35);
    });
    WORLD_DUNGEON_INTERIORS.forEach((dungeon) => {
      addTexturedPatch(`dungeon-interior-floor-${dungeon.id}`, dungeon.position.x, dungeon.position.y, dungeon.width * 1.18, dungeon.height * 1.12, "tile-dungeon", 0.58, -9.28);
    });
    const drawBiome = (x: number, y: number, width: number, height: number, color: number, alpha: number, accent: number, density = 60) => {
      const pointCount = fullWorldDetailSaver ? 58 : 64;
      const organicPoints = (scale: number): Vector2[] =>
        Array.from({ length: pointCount }, (_, index) => {
          const angle = (index / pointCount) * Math.PI * 2;
          const wobble =
            1 +
            Math.sin(angle * 3 + x * 0.001) * 0.075 +
            Math.sin(angle * 5 + y * 0.001) * 0.05 +
            Math.sin(angle * 9 + (x + y) * 0.0003) * 0.025 +
            Math.sin(angle * 13 + x * 0.0007) * 0.012;
          return {
            x: x + Math.cos(angle) * (width / 2) * scale * wobble,
            y: y + Math.sin(angle) * (height / 2) * scale * wobble
          };
        });
      const fillOrganic = (points: Vector2[]) => {
        graphics.beginPath();
        graphics.moveTo(points[0].x, points[0].y);
        points.slice(1).forEach((point) => graphics.lineTo(point.x, point.y));
        graphics.closePath();
        graphics.fillPath();
      };
      const strokeOrganic = (points: Vector2[]) => {
        graphics.beginPath();
        graphics.moveTo(points[0].x, points[0].y);
        points.slice(1).forEach((point) => graphics.lineTo(point.x, point.y));
        graphics.closePath();
        graphics.strokePath();
      };
      [
        { scale: 1.34, alpha: alpha * 0.018 },
        { scale: 1.24, alpha: alpha * 0.034 },
        { scale: 1.14, alpha: alpha * 0.058 },
        { scale: 1.04, alpha: alpha * 0.12 },
        { scale: 0.96, alpha: alpha * 0.38 }
      ].forEach((layer) => {
        graphics.fillStyle(color, layer.alpha);
        fillOrganic(organicPoints(layer.scale));
      });
      graphics.fillStyle(accent, alpha * 0.026);
      fillOrganic(organicPoints(0.72));
      graphics.lineStyle(8, accent, 0.006);
      strokeOrganic(organicPoints(1.04));
      const detailCount = fullWorldDetailSaver ? Math.min(8, Math.max(3, Math.round(density / 18))) : Math.min(22, Math.max(8, Math.round(density / 8)));
      for (let index = 0; index < detailCount; index += 1) {
        const angle = ((index * 137.5) % 360) * Phaser.Math.DEG_TO_RAD;
        const radius = Math.sqrt(((index * 53) % 1000) / 1000);
        const px = x + Math.cos(angle) * (width * 0.46) * radius;
        const py = y + Math.sin(angle) * (height * 0.46) * radius;
        graphics.fillStyle(index % 4 === 0 ? accent : color, index % 4 === 0 ? 0.14 : 0.09);
        graphics.fillEllipse(px, py, 36 + (index % 5) * 12, 16 + (index % 4) * 7);
      }
    };
    const drawForest = (x: number, y: number, width: number, height: number, count: number) => {
      for (let index = 0; index < count; index += 1) {
        const px = x + (roadNoise(index * 19.37 + x * 0.013) - 0.5) * width * 0.94;
        const py = y + (roadNoise(index * 31.11 + y * 0.017) - 0.5) * height * 0.9;
        const dx = (px - x) / (width / 2);
        const dy = (py - y) / (height / 2);
        if (
          dx * dx + dy * dy > 1 ||
          Phaser.Math.Distance.Between(px, py, WORLD_BOUNDS.town.x, WORLD_BOUNDS.town.y) < 520 ||
          Phaser.Math.Distance.Between(px, py, WORLD_STARTER_ARENA.center.x, WORLD_STARTER_ARENA.center.y) < WORLD_STARTER_ARENA.radius + 520
        ) {
          continue;
        }
        graphics.fillStyle(index % 6 === 0 ? 0x2c7139 : 0x1d5a2d, 0.62);
        graphics.fillCircle(px, py, 18 + (index % 4) * 3);
        graphics.fillStyle(0x12351d, 0.38);
        graphics.fillCircle(px + 7, py - 6, 9 + (index % 3) * 2);
        graphics.fillStyle(0x4a321f, 0.58);
        graphics.fillRect(px - 3, py + 12, 6, 18);
      }
    };
    const catmull = (p0: number, p1: number, p2: number, p3: number, t: number) => {
      const t2 = t * t;
      const t3 = t2 * t;
      return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
    };
    const sampleCurve = (points: Vector2[], steps = 14) => {
      const samples: Vector2[] = [points[0]];
      for (let index = 0; index < points.length - 1; index += 1) {
        const previous = points[Math.max(0, index - 1)];
        const current = points[index];
        const next = points[index + 1];
        const after = points[Math.min(points.length - 1, index + 2)];
        for (let step = 1; step <= steps; step += 1) {
          const t = step / steps;
          samples.push({
            x: catmull(previous.x, current.x, next.x, after.x, t),
            y: catmull(previous.y, current.y, next.y, after.y, t)
          });
        }
      }
      return samples;
    };
    const strokePolyline = (points: Vector2[]) => {
      graphics.beginPath();
      graphics.moveTo(points[0].x, points[0].y);
      points.slice(1).forEach((point) => graphics.lineTo(point.x, point.y));
      graphics.strokePath();
    };
    const strokeOffsetPolyline = (points: Vector2[], offset: number) => {
      graphics.beginPath();
      points.forEach((point, index) => {
        const previous = points[Math.max(0, index - 1)];
        const next = points[Math.min(points.length - 1, index + 1)];
        const angle = Math.atan2(next.y - previous.y, next.x - previous.x);
        const x = point.x - Math.sin(angle) * offset;
        const y = point.y + Math.cos(angle) * offset;
        if (index === 0) {
          graphics.moveTo(x, y);
          return;
        }
        graphics.lineTo(x, y);
      });
      graphics.strokePath();
    };
    const roadNoise = (seed: number) => {
      const value = Math.sin(seed * 12.9898) * 43758.5453;
      return value - Math.floor(value);
    };
    if (mobileLowPowerMap) {
      const strokeLowPowerRun = (target: Phaser.GameObjects.Graphics, points: Vector2[], width: number, color: number, alphaValue: number) => {
        if (points.length < 2) {
          return;
        }
        target.lineStyle(width, color, alphaValue);
        target.beginPath();
        target.moveTo(points[0].x, points[0].y);
        points.slice(1).forEach((point) => target.lineTo(point.x, point.y));
        target.strokePath();
      };
      const addWaterRouteLayer = (color: number, alpha: number, widthBoost: number, depth: number) => {
        const routeGraphics = this.add.graphics().setDepth(depth);
        WORLD_RIVERS.forEach((route) => {
          const routeWidth = (route.width ?? 60) + widthBoost;
          const points = sampleCurve([...route.points], 8);
          const run: Vector2[] = [];
          let runMouth = false;
          const flush = () => {
            const runColor = runMouth ? (color === 0x0a8eaa ? 0x168a99 : 0x0a6170) : color;
            const runAlpha = runMouth ? alpha * (color === 0x0a8eaa ? 0.22 : 0.14) : alpha;
            strokeLowPowerRun(routeGraphics, run, routeWidth, runColor, runAlpha);
            run.length = 0;
          };

          for (let index = 0; index < points.length - 1; index += 1) {
            const start = points[index];
            const end = points[index + 1];
            const midpoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
            const mouth =
              this.isRiverMouthWaterPosition(midpoint, routeWidth) ||
              this.isRiverMouthWaterPosition(start, routeWidth) ||
              this.isRiverMouthWaterPosition(end, routeWidth);
            if (run.length > 0 && mouth !== runMouth) {
              flush();
            }
            if (run.length === 0) {
              runMouth = mouth;
              run.push(start);
            }
            run.push(end);
          }
          flush();
        });
      };
      const addRouteSegments = (
        routes: typeof WORLD_ROADS | typeof WORLD_RIVERS,
        color: number,
        alpha: number,
        widthBoost: number,
        depth: number,
        skipOpenWater = false,
        capJoints = true
      ) => {
        routes.forEach((route) => {
          const routeWidth = (route.width ?? 60) + widthBoost;
          const routePoints = skipOpenWater ? sampleCurve([...route.points], 4) : [...route.points];
          for (let index = 0; index < routePoints.length - 1; index += 1) {
            const start = routePoints[index];
            const end = routePoints[index + 1];
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const length = Math.max(1, Math.hypot(dx, dy));
            const midpoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
            const mouth =
              skipOpenWater &&
              (this.isRiverMouthWaterPosition(midpoint, routeWidth) ||
                this.isRiverMouthWaterPosition(start, routeWidth) ||
                this.isRiverMouthWaterPosition(end, routeWidth));
            const segmentColor = mouth ? (color === 0x0a8eaa ? 0x168a99 : 0x0a6170) : color;
            const segmentAlpha = mouth ? alpha * (color === 0x0a8eaa ? 0.22 : 0.14) : alpha;
            this.add
              .rectangle(midpoint.x, midpoint.y, length, routeWidth, segmentColor, segmentAlpha)
              .setRotation(Math.atan2(dy, dx))
              .setDepth(depth);
          }
          if (capJoints) {
            route.points.forEach((point) => {
              if (skipOpenWater && this.isVisualOpenWaterPosition(point, routeWidth * 0.08)) {
                return;
              }
              this.add.circle(point.x, point.y, routeWidth * 0.42, color, alpha).setDepth(depth + 0.001);
            });
          }
        });
      };

      addWaterRouteLayer(0x083d56, 0.24, 58, -9.22);
      addWaterRouteLayer(0x0a8eaa, 0.78, 28, -9.18);
      addRouteSegments(WORLD_ROADS, 0x3f2d1c, 0.24, 30, -8.96);
      addRouteSegments(WORLD_ROADS, 0x8b6840, 0.66, 10, -8.92);
      WORLD_LAKES.forEach((lake) => {
        this.add.ellipse(lake.position.x, lake.position.y, lake.width + 180, lake.height + 116, 0xd6a956, 0.14).setDepth(-9.25);
        this.add.ellipse(lake.position.x, lake.position.y, lake.width + 78, lake.height + 46, 0x8fd4ce, 0.2).setDepth(-9.23);
        this.add.ellipse(lake.position.x, lake.position.y, lake.width, lake.height, 0x54b7cf, 0.98).setDepth(-9.2);
        this.add.ellipse(lake.position.x - lake.width * 0.14, lake.position.y - lake.height * 0.14, lake.width * 0.46, lake.height * 0.22, 0xbdeefa, 0.16).setDepth(-9.19);
        for (let wave = 0; wave < 2; wave += 1) {
          this.add
            .rectangle(lake.position.x, lake.position.y + lake.height * (-0.08 + wave * 0.16), lake.width * (0.34 + wave * 0.08), 4, 0xe0f7ff, 0.12)
            .setRotation(0.03)
            .setDepth(-9.185);
        }
      });
      CITY_DEFINITIONS.forEach((city) => {
        const isHub = city.id === "greenhill";
        const isGrandCapital = city.id === "crownspire";
        const isMajorCapital = isHub || isGrandCapital;
        const townRadius = cityVisualRadius(city);
        const palette =
          city.kind === "harbor"
            ? { ground: 0x263c42, street: 0x8b6840, wall: 0x38bdf8, roof: 0x475569, label: "#bae6fd" }
            : city.kind === "capital"
              ? { ground: 0x2f3f2f, street: 0x8a6a3d, wall: 0xfacc15, roof: 0x64748b, label: "#fef3c7" }
            : city.kind === "fortress"
              ? { ground: 0x2d3340, street: 0x6b5a44, wall: 0xcbd5e1, roof: 0x64748b, label: "#dbeafe" }
              : city.kind === "sanctum"
                ? { ground: 0x28223f, street: 0x594b7c, wall: 0xa78bfa, roof: 0x6d5d9c, label: "#ddd6fe" }
                : city.kind === "outpost"
                  ? { ground: 0x322719, street: 0x7a4f2a, wall: 0xfbbf24, roof: 0x7c4a25, label: "#fef3c7" }
                  : { ground: 0x263927, street: 0x70502f, wall: 0x86efac, roof: 0x64748b, label: "#dcfce7" };
        this.add.ellipse(city.position.x, city.position.y, townRadius * 2.42, townRadius * 1.58, palette.ground, isHub ? 0.8 : 0.7).setDepth(-8.72);
        this.add.ellipse(city.position.x, city.position.y, townRadius * 2.66, townRadius * 1.78, palette.wall, 0.13).setDepth(-8.74);
        this.add.rectangle(city.position.x, city.position.y, townRadius * 2.08, 36, palette.street, 0.62).setDepth(-8.68);
        this.add.rectangle(city.position.x, city.position.y, 36, townRadius * 1.34, palette.street, 0.48).setDepth(-8.67);
        this.add.rectangle(city.position.x, city.position.y - townRadius * 0.28, townRadius * 1.42, 14, palette.street, 0.32).setDepth(-8.665);
        this.add.rectangle(city.position.x, city.position.y + townRadius * 0.28, townRadius * 1.42, 14, palette.street, 0.32).setDepth(-8.665);
        const mobileHouseCount =
          isGrandCapital ? 14 : isHub ? 12 : city.kind === "harbor" || city.kind === "fortress" || city.kind === "village" ? 7 : 5;
        for (let index = 0; index < mobileHouseCount; index += 1) {
          const angle = (index / mobileHouseCount) * Math.PI * 2;
          const x = city.position.x + Math.cos(angle) * townRadius * 0.67;
          const y = city.position.y + Math.sin(angle) * townRadius * 0.43;
          this.add
            .rectangle(x, y, isMajorCapital ? 62 : 50, isMajorCapital ? 40 : 32, palette.roof, 0.78)
            .setRotation(angle * 0.18)
            .setDepth(-8.62);
        }
        this.add
          .text(city.position.x, city.position.y - townRadius * 0.92, `${this.tr(cityKindLabel(city))} · ${this.tr(city.label)}`, {
            color: palette.label,
            fontFamily: "Inter, sans-serif",
            fontSize: isGrandCapital ? "15px" : isHub ? "14px" : "11px",
            stroke: "#0f172a",
            strokeThickness: 3
          })
          .setOrigin(0.5)
          .setAlpha(isMajorCapital ? 0.78 : 0.62)
          .setDepth(-8.5);
      });
      this.add
        .circle(WORLD_STARTER_ARENA.center.x, WORLD_STARTER_ARENA.center.y, WORLD_STARTER_ARENA_WALL_RADIUS, 0x250f10, 0.08)
        .setStrokeStyle(18, 0x7f1d1d, 0.42)
        .setDepth(-8.8);
      this.add
        .circle(WORLD_STARTER_ARENA.center.x, WORLD_STARTER_ARENA.center.y, WORLD_STARTER_ARENA.innerRadius, 0x12080a, 0.08)
        .setStrokeStyle(4, 0xf97316, 0.28)
        .setDepth(-8.79);
      const arena = WORLD_STARTER_ARENA;
      const arenaCenter = arena.center;
      this.add.circle(arenaCenter.x, arenaCenter.y, WORLD_STARTER_ARENA_WALL_RADIUS + 88, 0x160607, 0.24).setDepth(-8.84);
      this.add
        .circle(arenaCenter.x, arenaCenter.y, WORLD_STARTER_ARENA_WALL_RADIUS, 0x2a0c0e, 0.44)
        .setStrokeStyle(28, 0x7f1d1d, 0.64)
        .setDepth(-8.83);
      this.add
        .circle(arenaCenter.x, arenaCenter.y, arena.radius + 80, 0x451318, 0.5)
        .setStrokeStyle(12, 0xf97316, 0.28)
        .setDepth(-8.82);
      this.add
        .circle(arenaCenter.x, arenaCenter.y, arena.innerRadius, 0x15080a, 0.66)
        .setStrokeStyle(6, 0xf97316, 0.42)
        .setDepth(-8.81);
      WORLD_STARTER_ARENA_GATES.forEach((gate) => {
        const gateX = arenaCenter.x + Math.cos(gate.angle) * (arena.radius + 240);
        const gateY = arenaCenter.y + Math.sin(gate.angle) * (arena.radius + 240);
        this.add
          .rectangle(gateX, gateY, 520, 128, 0x8b6840, 0.72)
          .setRotation(gate.angle)
          .setDepth(-8.795);
        this.add
          .rectangle(gateX, gateY, 520, 32, 0xd6a15d, 0.2)
          .setRotation(gate.angle)
          .setDepth(-8.794);
      });
      for (let index = 0; index < 18; index += 1) {
        const angle = (index / 18) * Math.PI * 2;
        const middle = (arena.innerRadius + arena.radius) * 0.5;
        this.add
          .rectangle(arenaCenter.x + Math.cos(angle) * middle, arenaCenter.y + Math.sin(angle) * middle, arena.radius - arena.innerRadius + 96, 6, 0xf97316, index % 3 === 0 ? 0.22 : 0.12)
          .setRotation(angle)
          .setDepth(-8.79);
      }
      for (let index = 0; index < 28; index += 1) {
        const angle = (index / 28) * Math.PI * 2;
        const radius = arena.radius + 104 + (index % 2) * 34;
        this.add
          .rectangle(arenaCenter.x + Math.cos(angle) * radius, arenaCenter.y + Math.sin(angle) * radius, 58, 28, index % 2 === 0 ? 0x6b2319 : 0x3f1c14, 0.72)
          .setRotation(angle + 0.28)
          .setDepth(-8.785);
      }
      this.add
        .text(arenaCenter.x, arenaCenter.y - arena.radius - 72, this.tr("ARENA"), {
          color: "#fed7aa",
          fontFamily: "Inter, sans-serif",
          fontSize: "18px",
          fontStyle: "900",
          stroke: "#180506",
          strokeThickness: 5
        })
        .setOrigin(0.5)
        .setAlpha(0.88)
        .setDepth(-8.49);
      this.createDungeonInteriorViews();
      this.createMobileWorldFeatureViews();
      graphics.destroy();
      this.createWorldOverlayUi();
      return;
    }
    const drawBoundedMapGraphics = (left: number, top: number, right: number, bottom: number, draw: () => void) => {
      const previous = graphics;
      const layer = this.add.graphics();
      graphics = layer;
      try {
        draw();
      } finally {
        graphics = previous;
      }
      this.staticMapGraphicsLayers.push({ view: layer, left, right, top, bottom });
    };
    const drawRegionalMapGraphics = (center: Vector2, width: number, height: number, draw: () => void, padding = 260) => {
      drawBoundedMapGraphics(
        center.x - width / 2 - padding,
        center.y - height / 2 - padding,
        center.x + width / 2 + padding,
        center.y + height / 2 + padding,
        draw
      );
    };
    const mapBoundsForPoints = (points: Vector2[], padding: number) => {
      let left = Number.POSITIVE_INFINITY;
      let right = Number.NEGATIVE_INFINITY;
      let top = Number.POSITIVE_INFINITY;
      let bottom = Number.NEGATIVE_INFINITY;
      for (const point of points) {
        left = Math.min(left, point.x);
        right = Math.max(right, point.x);
        top = Math.min(top, point.y);
        bottom = Math.max(bottom, point.y);
      }
      return { left: left - padding, right: right + padding, top: top - padding, bottom: bottom + padding };
    };
    const waterRoutes: Array<{ samples: Vector2[]; width: number }> = [];
    const drawWaterRoute = (points: Vector2[], width: number, routeIndex: number) => {
      const samples = sampleCurve(points, fullWorldDetailSaver ? 16 : 28);
      waterRoutes.push({ samples, width });
      const waterLayers = [
        { width: width + 92, color: 0xd6b15d, alpha: 0.055 },
        { width: width + 54, color: 0x6fbf86, alpha: 0.06 },
        { width: width + 24, color: 0x0a8eaa, alpha: 0.84 }
      ];
      const strokeWaterRun = (points: Vector2[], layer: (typeof waterLayers)[number], mouth: boolean) => {
        if (points.length < 2) {
          return;
        }
        const layerColor = mouth ? (layer.color === 0x0a8eaa ? 0x168a99 : 0x0a6170) : layer.color;
        const layerAlpha = mouth ? layer.alpha * (layer.color === 0x0a8eaa ? 0.24 : 0.2) : layer.alpha;
        graphics.lineStyle(layer.width, layerColor, layerAlpha);
        graphics.beginPath();
        graphics.moveTo(points[0].x, points[0].y);
        points.slice(1).forEach((point) => graphics.lineTo(point.x, point.y));
        graphics.strokePath();
      };
      waterLayers.forEach((layer) => {
        const run: Vector2[] = [];
        let runMouth = false;
        const flush = () => {
          strokeWaterRun(run, layer, runMouth);
          run.length = 0;
        };
        for (let index = 0; index < samples.length - 1; index += 1) {
          const start = samples[index];
          const end = samples[index + 1];
          const midpoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
          const mouth =
            this.isRiverMouthWaterPosition(midpoint, width) ||
            this.isRiverMouthWaterPosition(start, width) ||
            this.isRiverMouthWaterPosition(end, width);
          if (run.length > 0 && mouth !== runMouth) {
            flush();
          }
          if (run.length === 0) {
            runMouth = mouth;
            run.push(start);
          }
          run.push(end);
        }
        flush();
      });

      const waveStep = fullWorldDetailSaver ? 8 : 6;
      for (let index = 3; index < samples.length - 3; index += waveStep) {
        const point = samples[index];
        if (this.isRiverMouthWaterPosition(point, width)) {
          continue;
        }
        const previous = samples[index - 1];
        const next = samples[index + 1];
        const angle = Math.atan2(next.y - previous.y, next.x - previous.x);
        const tangentX = Math.cos(angle);
        const tangentY = Math.sin(angle);
        const normalX = -Math.sin(angle);
        const normalY = Math.cos(angle);
        const noise = roadNoise(routeIndex * 389 + index * 31);
        const offset = (noise - 0.5) * width * 0.34;
        const length = width * (0.24 + noise * 0.18);
        graphics.lineStyle(3, 0xc7f9ff, 0.07);
        graphics.lineBetween(
          point.x - tangentX * length + normalX * offset,
          point.y - tangentY * length + normalY * offset,
          point.x + tangentX * length + normalX * offset,
          point.y + tangentY * length + normalY * offset
        );
      }

      for (let index = 2; index < samples.length - 2; index += 4) {
        const point = samples[index];
        if (this.isRiverMouthWaterPosition(point, width)) {
          continue;
        }
        const previous = samples[index - 1];
        const next = samples[index + 1];
        const angle = Math.atan2(next.y - previous.y, next.x - previous.x);
        const normalX = -Math.sin(angle);
        const normalY = Math.cos(angle);
        const tangentX = Math.cos(angle);
        const tangentY = Math.sin(angle);
        const noise = roadNoise(routeIndex * 503 + index * 29);
        [-1, 1].forEach((side) => {
          const sideNoise = roadNoise(routeIndex * 977 + index * 41 + side * 13);
          const bankOffset = side * (width * 0.62 + 34 + sideNoise * 72);
          const x = point.x + normalX * bankOffset;
          const y = point.y + normalY * bankOffset;
          if ((index + side) % 3 === 0) {
            graphics.fillStyle(0x2f5f2e, 0.16 + sideNoise * 0.1);
            graphics.fillEllipse(x, y, 16 + sideNoise * 20, 7 + sideNoise * 10);
          } else {
            graphics.fillStyle(0x6b7280, 0.12 + sideNoise * 0.08);
            graphics.fillEllipse(x, y, 18 + sideNoise * 26, 9 + sideNoise * 12);
          }
        });
      }
    };
    const drawWaterfall = (fall: (typeof WORLD_WATERFALLS)[number], index: number) => {
      const tangentX = Math.cos(fall.rotation);
      const tangentY = Math.sin(fall.rotation);
      const normalX = -Math.sin(fall.rotation);
      const normalY = Math.cos(fall.rotation);
      const x = fall.position.x;
      const y = fall.position.y;
      graphics.fillStyle(0x9ddde8, 0.055);
      graphics.fillEllipse(x + tangentX * fall.height * 0.38, y + tangentY * fall.height * 0.38, fall.width * 0.95, fall.width * 0.22);
      for (let spray = 0; spray < 6; spray += 1) {
        const sprayNoise = roadNoise(index * 71 + spray * 17);
        const side = spray % 2 === 0 ? 1 : -1;
        const cx = x + tangentX * (fall.height * (0.32 + sprayNoise * 0.24)) + normalX * side * fall.width * (0.12 + sprayNoise * 0.35);
        const cy = y + tangentY * (fall.height * (0.32 + sprayNoise * 0.24)) + normalY * side * fall.width * (0.12 + sprayNoise * 0.35);
        graphics.fillStyle(0xe0f7ff, 0.035 + sprayNoise * 0.055);
        graphics.fillCircle(cx, cy, 8 + sprayNoise * 14);
      }
    };
    const drawScenicDetail = (detail: (typeof WORLD_SCENIC_DETAILS)[number], detailIndex: number) => {
      const detailCount = fullWorldDetailSaver ? Math.max(1, Math.round(detail.density * 0.34)) : detail.density;
      for (let index = 0; index < detailCount; index += 1) {
        const angle = ((index * 137.508 + detailIndex * 23) % 360) * Phaser.Math.DEG_TO_RAD;
        const radius = Math.sqrt(((index * 71 + detailIndex * 43) % 997) / 997) * detail.radius;
        const x = detail.position.x + Math.cos(angle) * radius;
        const y = detail.position.y + Math.sin(angle) * radius * 0.72;
        const noise = roadNoise(detailIndex * 211 + index * 37);
        if (detail.kind === "flowers") {
          graphics.fillStyle(index % 3 === 0 ? 0xf9a8d4 : index % 3 === 1 ? 0xfef08a : 0xffffff, 0.34 + noise * 0.18);
          graphics.fillCircle(x, y, 7 + noise * 7);
          graphics.fillStyle(0x4ade80, 0.18);
          graphics.fillEllipse(x, y + 8, 24, 8);
        } else if (detail.kind === "reeds" || detail.kind === "moss") {
          graphics.fillStyle(detail.kind === "moss" ? 0x65a30d : 0x4d7c0f, 0.14 + noise * 0.1);
          graphics.fillEllipse(x, y, 26 + noise * 32, 8 + noise * 12);
        } else if (detail.kind === "stones" || detail.kind === "shells") {
          graphics.fillStyle(detail.kind === "shells" ? 0xfef3c7 : 0x94a3b8, 0.18 + noise * 0.18);
          graphics.fillEllipse(x, y, 24 + noise * 38, 12 + noise * 18);
        } else if (detail.kind === "ice") {
          graphics.fillStyle(0xe0f2fe, 0.2 + noise * 0.2);
          graphics.fillTriangle(x, y - 24 - noise * 18, x - 16 - noise * 10, y + 18, x + 20 + noise * 12, y + 16);
        } else if (detail.kind === "crystals") {
          graphics.fillStyle(0xa78bfa, 0.2 + noise * 0.2);
          graphics.fillTriangle(x, y - 32 - noise * 20, x - 14, y + 20, x + 18, y + 16);
          graphics.fillStyle(0xf5f3ff, 0.16);
          graphics.fillTriangle(x, y - 24, x - 4, y + 8, x + 7, y + 9);
        } else if (detail.kind === "mushrooms") {
          graphics.fillStyle(index % 2 === 0 ? 0xb91c1c : 0x7c2d12, 0.26 + noise * 0.16);
          graphics.fillEllipse(x, y, 22 + noise * 26, 13 + noise * 12);
          graphics.fillStyle(0xfef3c7, 0.2);
          graphics.fillCircle(x - 4, y - 3, 3 + noise * 2);
        } else if (detail.kind === "runes") {
          graphics.lineStyle(3, 0xc4b5fd, 0.18 + noise * 0.22);
          graphics.strokeCircle(x, y, 13 + noise * 12);
          graphics.lineBetween(x - 10, y + 8, x + 12, y - 8);
        } else if (detail.kind === "embers") {
          graphics.fillStyle(index % 2 === 0 ? 0xf97316 : 0xfacc15, 0.2 + noise * 0.22);
          graphics.fillCircle(x, y, 5 + noise * 8);
          graphics.fillStyle(0x7f1d1d, 0.12);
          graphics.fillEllipse(x, y + 7, 24 + noise * 24, 8 + noise * 8);
        } else {
          graphics.fillStyle(0x7dd3fc, 0.18 + noise * 0.12);
          graphics.fillEllipse(x, y, 24 + noise * 18, 12 + noise * 10);
        }
      }
    };
    const drawRoadNetwork = (
      routes: Array<{ id: string; samples: Vector2[]; width: number; fill: number; shoulder: number; edge: number; patch: number; mark: number; stone: number; mode: "cobble" | "sand" | "dirt" | "snow" | "void" | "ash" | "forest" }>,
      routeIndexOffset = 0
    ) => {
      routes.forEach((road, localRouteIndex) => {
        const routeIndex = routeIndexOffset + localRouteIndex;
        [
          { width: road.width + 44, color: 0x15100a, alpha: 0.2, joints: false },
          { width: road.width + 30, color: road.edge, alpha: 0.38, joints: false },
          { width: road.width + 16, color: road.shoulder, alpha: 0.72, joints: false },
          { width: road.width, color: road.fill, alpha: 1, joints: true }
        ].forEach((layer) => {
          graphics.lineStyle(layer.width, layer.color, layer.alpha);
          strokePolyline(road.samples);
          if (layer.joints) {
            // The world map lives in ONE persistent Graphics object that WebGL re-tessellates
            // every frame, so every extra command here is a per-frame cost. Only pad joints
            // where the polyline actually bends enough for a seam to show.
            graphics.fillStyle(layer.color, layer.alpha);
            for (let index = 1; index < road.samples.length - 1; index += 1) {
              const prev = road.samples[index - 1];
              const curr = road.samples[index];
              const next = road.samples[index + 1];
              const angleIn = Math.atan2(curr.y - prev.y, curr.x - prev.x);
              const angleOut = Math.atan2(next.y - curr.y, next.x - curr.x);
              const turn = Math.abs(Phaser.Math.Angle.Wrap(angleOut - angleIn));
              if (turn > 0.055) {
                graphics.fillCircle(curr.x, curr.y, layer.width / 2);
              }
            }
          }
        });

        const roadPatchStep = fullWorldDetailSaver ? 6 : 3;
        for (let index = 2; index < road.samples.length - 2; index += roadPatchStep) {
          const point = road.samples[index];
          const previous = road.samples[index - 1];
          const next = road.samples[index + 1];
          const angle = Math.atan2(next.y - previous.y, next.x - previous.x);
          const normalX = -Math.sin(angle);
          const normalY = Math.cos(angle);
          const noise = roadNoise(routeIndex * 211 + index * 17);
          const offset = (noise - 0.5) * road.width * 0.56;
          const stoneLike = road.mode === "cobble" || road.mode === "snow";
          graphics.fillStyle(index % 4 === 0 ? road.stone : road.patch, stoneLike ? 0.42 + noise * 0.2 : 0.12 + noise * 0.12);
          graphics.fillEllipse(
            point.x + normalX * offset,
            point.y + normalY * offset,
            stoneLike ? 22 + noise * 34 : 14 + noise * 26,
            stoneLike ? 13 + noise * 18 : 7 + noise * 13
          );
          if (stoneLike) {
            graphics.lineStyle(2, 0xffffff, 0.14);
            graphics.strokeEllipse(point.x + normalX * offset - 2, point.y + normalY * offset - 2, 14 + noise * 24, 7 + noise * 12);
          }
        }

        const roadEdgeStep = fullWorldDetailSaver ? 10 : 5;
        for (let index = 3; index < road.samples.length - 3; index += roadEdgeStep) {
          const point = road.samples[index];
          const previous = road.samples[index - 1];
          const next = road.samples[index + 1];
          const angle = Math.atan2(next.y - previous.y, next.x - previous.x);
          const normalX = -Math.sin(angle);
          const normalY = Math.cos(angle);
          [-1, 1].forEach((side) => {
            const noise = roadNoise(routeIndex * 97 + index * 13 + side * 19);
            const distance = side * (road.width * 0.46 + 7 + noise * 14);
            graphics.fillStyle(road.patch, 0.12 + noise * 0.09);
            graphics.fillEllipse(point.x + normalX * distance, point.y + normalY * distance, 22 + noise * 34, 10 + noise * 18);
          });
        }

        graphics.lineStyle(2, road.mark, 0.1);
        strokeOffsetPolyline(road.samples, road.width * 0.18);
        strokeOffsetPolyline(road.samples, -road.width * 0.18);
        graphics.lineStyle(1, road.mark, 0.08);
        strokeOffsetPolyline(road.samples, 0);
        if (road.mode === "sand" || road.mode === "ash" || road.mode === "forest") {
          graphics.lineStyle(2, road.mark, 0.1);
          for (let index = 4; index < road.samples.length - 4; index += 9) {
            const point = road.samples[index];
            const previous = road.samples[index - 1];
            const next = road.samples[index + 1];
            const angle = Math.atan2(next.y - previous.y, next.x - previous.x);
            const tangentX = Math.cos(angle);
            const tangentY = Math.sin(angle);
            graphics.lineBetween(point.x - tangentX * 18, point.y - tangentY * 18, point.x + tangentX * 18, point.y + tangentY * 18);
          }
        }
        if (road.mode === "void" || road.mode === "ash") {
          graphics.lineStyle(3, road.mark, 0.12);
          strokeOffsetPolyline(road.samples, road.width * 0.31);
          strokeOffsetPolyline(road.samples, -road.width * 0.31);
          const ornamentStep = fullWorldDetailSaver ? 18 : 13;
          for (let index = 6; index < road.samples.length - 6; index += ornamentStep) {
            const point = road.samples[index];
            const previous = road.samples[index - 1];
            const next = road.samples[index + 1];
            const angle = Math.atan2(next.y - previous.y, next.x - previous.x);
            const normalX = -Math.sin(angle);
            const normalY = Math.cos(angle);
            const noise = roadNoise(routeIndex * 313 + index * 29);
            const centerX = point.x + Math.cos(angle) * ((noise - 0.5) * 12);
            const centerY = point.y + Math.sin(angle) * ((noise - 0.5) * 12);
            graphics.lineStyle(2, road.mark, 0.18 + noise * 0.14);
            graphics.strokeCircle(centerX, centerY, 9 + noise * 9);
            graphics.lineBetween(centerX - normalX * 9, centerY - normalY * 9, centerX + normalX * 9, centerY + normalY * 9);
          }
        }
      });
    };
    const drawBridge = (x: number, y: number, rotation: number, length = 420, width = 96) => {
      const normalX = -Math.sin(rotation);
      const normalY = Math.cos(rotation);
      const tangentX = Math.cos(rotation);
      const tangentY = Math.sin(rotation);
      const along = (distance: number) => ({ x: x + tangentX * distance, y: y + tangentY * distance });

      // Soft shadow the bridge casts on the water below.
      this.add.rectangle(x, y + 7, length + 20, width + 16, 0x061826, 0.16).setRotation(rotation).setDepth(3.72);

      // Stone support pillars sitting in the water at both banks and the centre.
      [-0.5, 0, 0.5].forEach((factor) => {
        const base = along(length * factor);
        this.add.ellipse(base.x, base.y + 6, width * 0.9, width * 0.34, 0x0a3547, 0.32).setRotation(rotation).setDepth(3.9);
        this.add.rectangle(base.x, base.y, 46, width + 8, 0x5b4630, 0.9).setRotation(rotation).setDepth(4.02);
        this.add.rectangle(base.x, base.y, 46, width + 8, 0x2a1c10, 0).setStrokeStyle(2, 0x241206, 0.55).setRotation(rotation).setDepth(4.03);
        this.add.rectangle(base.x - normalX * (width * 0.42), base.y - normalY * (width * 0.42), 30, 20, 0x74593a, 0.85).setRotation(rotation).setDepth(4.04);
        this.add.rectangle(base.x + normalX * (width * 0.42), base.y + normalY * (width * 0.42), 30, 20, 0x74593a, 0.85).setRotation(rotation).setDepth(4.04);
      });

      // Warm arch-glow under the central span.
      this.add.ellipse(x, y + 2, length * 0.5, width * 0.5, 0x1a2b1a, 0.18).setRotation(rotation).setDepth(4.1);

      // Main deck with a lighter walking strip on top.
      const bridge = this.add.rectangle(x, y, length, width, 0x835231, 0.96).setRotation(rotation).setDepth(4.4);
      bridge.setStrokeStyle(3, 0x2d160b, 0.6);
      this.add.rectangle(x, y, length, width * 0.66, 0x9a6238, 0.7).setRotation(rotation).setDepth(4.44);
      this.add.rectangle(x, y - normalY * 0, length * 0.82, 4, 0xe0b986, 0.16).setRotation(rotation).setDepth(4.6);

      // Plank seams across the deck.
      const plankCount = Math.max(6, Math.round(length / 34));
      for (let index = -plankCount; index <= plankCount; index += 1) {
        const seam = along(index * (length / (plankCount * 2)));
        this.add.rectangle(seam.x, seam.y, 3, width - 4, 0x3a2211, 0.28).setRotation(rotation).setDepth(4.5);
      }

      // Railings on both sides with vertical posts.
      [-1, 1].forEach((side) => {
        const railBase = { x: x + normalX * (width * 0.44) * side, y: y + normalY * (width * 0.44) * side };
        this.add.rectangle(railBase.x, railBase.y, length + 8, 8, 0x4a2f18, 0.92).setRotation(rotation).setDepth(5.02);
        this.add.rectangle(railBase.x - normalX * 5 * side, railBase.y - normalY * 5 * side, length + 8, 4, 0x6b4426, 0.85).setRotation(rotation).setDepth(5.06);
        const postCount = Math.max(4, Math.round(length / 60));
        for (let index = -postCount; index <= postCount; index += 1) {
          const post = along(index * (length / (postCount * 2)));
          this.add.rectangle(post.x + normalX * 2 * side, post.y + normalY * 2 * side, 8, 16, 0x3a2211, 0.9).setRotation(rotation).setDepth(5.1);
        }
      });
    };
    const drawTown = (city: (typeof CITY_DEFINITIONS)[number]) => {
      const isHub = city.id === "greenhill";
      const isGrandCapital = city.id === "crownspire";
      const isMajorCapital = isHub || isGrandCapital;
      const isTradeZone = city.id === "market";
      const theme =
        isTradeZone
          ? { ground: 0x183528, street: 0x80642a, edge: 0x22c55e, wall: 0x64748b, label: "#bbf7d0" }
          : city.kind === "harbor"
          ? { ground: 0x263c42, street: 0x7a5a36, edge: 0x38bdf8, wall: 0x475569, label: "#bae6fd" }
          : city.kind === "capital"
            ? { ground: 0x2f3f2f, street: 0x8a6a3d, edge: 0xfacc15, wall: 0x94a3b8, label: "#fef3c7" }
          : city.kind === "fortress"
            ? { ground: 0x2d3340, street: 0x6b5a44, edge: 0xcbd5e1, wall: 0x64748b, label: "#dbeafe" }
            : city.kind === "sanctum"
              ? { ground: 0x28223f, street: 0x594b7c, edge: 0xa78bfa, wall: 0x6d5d9c, label: "#ddd6fe" }
              : city.kind === "outpost"
                ? { ground: 0x322719, street: 0x7a4f2a, edge: 0xfbbf24, wall: 0x7c4a25, label: "#fef3c7" }
                : { ground: 0x263927, street: 0x70502f, edge: 0x86efac, wall: 0x64748b, label: "#dcfce7" };
      graphics.lineStyle(2, theme.edge, isMajorCapital ? 0.075 : 0.045);
      graphics.strokeCircle(city.position.x, city.position.y, city.safeRadius);

      const townRadius = cityVisualRadius(city);
      const footprint = Array.from({ length: 36 }, (_, index) => {
        const angle = (index / 36) * Math.PI * 2;
        const wobble = 0.9 + Math.sin(angle * 3 + city.recommendedLevel) * 0.05 + Math.sin(angle * 7 + city.recommendedLevel * 1.7) * 0.028;
        return {
          x: city.position.x + Math.cos(angle) * townRadius * (isMajorCapital ? 1.2 : 1.02) * wobble,
          y: city.position.y + Math.sin(angle) * townRadius * (isMajorCapital ? 0.78 : 0.76) * wobble
        };
      });
      const fillFootprint = (points: Vector2[]) => {
        graphics.beginPath();
        graphics.moveTo(points[0].x, points[0].y);
        points.slice(1).forEach((point) => graphics.lineTo(point.x, point.y));
        graphics.closePath();
        graphics.fillPath();
      };
      const strokeFootprint = (points: Vector2[]) => {
        graphics.beginPath();
        graphics.moveTo(points[0].x, points[0].y);
        points.slice(1).forEach((point) => graphics.lineTo(point.x, point.y));
        graphics.closePath();
        graphics.strokePath();
      };

      graphics.fillStyle(0x3a2417, isMajorCapital ? 0.055 : 0.075);
      graphics.fillEllipse(city.position.x + townRadius * 0.04, city.position.y + townRadius * 0.12, townRadius * 2.34, townRadius * 1.58);
      graphics.fillStyle(theme.ground, isMajorCapital ? 0.74 : 0.7);
      fillFootprint(footprint);
      graphics.lineStyle(isMajorCapital ? 15 : 11, theme.edge, isMajorCapital ? 0.16 : 0.15);
      strokeFootprint(footprint);

      graphics.lineStyle(isMajorCapital ? 54 : 34, 0x1f160e, isMajorCapital ? 0.16 : 0.12);
      graphics.lineBetween(city.position.x - townRadius * 1.02, city.position.y, city.position.x + townRadius * 1.02, city.position.y);
      graphics.lineBetween(city.position.x, city.position.y - townRadius * 0.72, city.position.x, city.position.y + townRadius * 0.72);
      graphics.lineStyle(isMajorCapital ? 40 : 26, theme.street, isMajorCapital ? 0.58 : 0.48);
      graphics.lineBetween(city.position.x - townRadius * 0.96, city.position.y, city.position.x + townRadius * 0.96, city.position.y);
      graphics.lineBetween(city.position.x, city.position.y - townRadius * 0.66, city.position.x, city.position.y + townRadius * 0.66);
      graphics.lineStyle(isMajorCapital ? 22 : 16, 0x1f160e, 0.11);
      [-0.3, 0.3].forEach((offset) => {
        graphics.lineBetween(
          city.position.x - townRadius * 0.7,
          city.position.y + townRadius * offset,
          city.position.x + townRadius * 0.7,
          city.position.y + townRadius * offset
        );
      });
      graphics.lineStyle(isMajorCapital ? 15 : 11, theme.street, 0.34);
      [-0.3, 0.3].forEach((offset) => {
        graphics.lineBetween(
          city.position.x - townRadius * 0.68,
          city.position.y + townRadius * offset,
          city.position.x + townRadius * 0.68,
          city.position.y + townRadius * offset
        );
      });
      graphics.lineStyle(5, theme.edge, 0.15);
      graphics.strokeEllipse(city.position.x, city.position.y, townRadius * 1.82, townRadius * 1.12);
      graphics.lineStyle(2, 0xfde68a, 0.11);
      graphics.strokeEllipse(city.position.x, city.position.y, townRadius * 1.42, townRadius * 0.82);
      if (isTradeZone) {
        graphics.fillStyle(0x22c55e, 0.035);
        graphics.fillCircle(city.position.x, city.position.y, city.safeRadius * 0.86);
        graphics.lineStyle(12, 0x22c55e, 0.2);
        graphics.strokeCircle(city.position.x, city.position.y, city.safeRadius * 0.96);
        graphics.lineStyle(5, 0xfacc15, 0.24);
        graphics.strokeCircle(city.position.x, city.position.y, city.safeRadius * 0.58);
      }

      const fortified = isGrandCapital || city.kind === "fortress" || city.kind === "sanctum";
      if (fortified) {
        const wallCount = isGrandCapital ? 12 : city.kind === "fortress" ? 8 : 6;
        for (let index = 0; index < wallCount; index += 1) {
          const angle = (index / wallCount) * Math.PI * 2;
          const px = city.position.x + Math.cos(angle) * townRadius * (isMajorCapital ? 1.14 : 1.03);
          const py = city.position.y + Math.sin(angle) * townRadius * (isMajorCapital ? 0.76 : 0.7);
          this.add
            .image(px, py, "city-wall")
            .setRotation(angle + Math.PI / 2)
            .setScale(0.68, 0.58)
            .setTint(theme.wall)
            .setDepth(5.35);
        }
        const gatePositions = [
          { dx: 0, dy: -townRadius * 0.72, rotation: 0 },
          { dx: 0, dy: townRadius * 0.72, rotation: Math.PI }
        ];
        gatePositions.forEach((gate, index) => {
          this.add
            .image(city.position.x + gate.dx, city.position.y + gate.dy, "city-gate")
            .setRotation(gate.rotation)
            .setScale(0.56)
            .setDepth(5.75 + index * 0.01);
        });
      }

      const houseTextures = ["city-house", "city-house-blue", "city-house-green", "city-house-stone"] as const;
      const placeStructure = (texture: string, dx: number, dy: number, scale: number, rotation = 0, depth = 6) => {
        this.add
          .image(city.position.x + dx, city.position.y + dy, texture)
          .setRotation(rotation)
          .setScale(scale)
          .setDepth(depth + dy * 0.0002);
      };
      const houseCount =
        isGrandCapital
          ? 16
          : isHub
            ? 14
            : city.kind === "harbor" || city.kind === "fortress"
              ? 9
              : city.kind === "village"
                ? 8
                : city.kind === "sanctum"
                  ? 7
                  : 5;
      for (let index = 0; index < houseCount; index += 1) {
        const angle = (index / houseCount) * Math.PI * 2 + (index % 2) * 0.18;
        const radiusX = townRadius * (isMajorCapital ? 0.68 : 0.7) * (0.78 + (index % 3) * 0.08);
        const radiusY = townRadius * (isMajorCapital ? 0.42 : 0.46) * (0.82 + (index % 4) * 0.05);
        const dx = Math.cos(angle) * radiusX;
        const dy = Math.sin(angle) * radiusY;
        const texture = houseTextures[(index + city.recommendedLevel) % houseTextures.length];
        const houseScale =
          isGrandCapital
            ? 0.82
            : isHub
              ? 0.76
              : city.kind === "outpost"
                ? 0.52
                : city.kind === "sanctum"
                  ? 0.58
                  : 0.64;
        placeStructure(texture, dx, dy, houseScale, angle * 0.06, 5.95);
      }

      if (isMajorCapital) {
        placeStructure("city-keep", 0, isGrandCapital ? -168 : -124, isGrandCapital ? 1.42 : 1.18, 0, 6.25);
        placeStructure("city-market", -townRadius * 0.38, townRadius * 0.18, isGrandCapital ? 0.92 : 0.82, -0.04, 6.2);
        placeStructure("city-shrine", townRadius * 0.4, townRadius * 0.16, isGrandCapital ? 0.84 : 0.72, 0.04, 6.2);
        placeStructure("city-fountain", 0, townRadius * 0.18, isGrandCapital ? 1.08 : 0.9, 0, 6.1);
        placeStructure("city-tower", -townRadius * 0.52, -townRadius * 0.14, isGrandCapital ? 0.82 : 0.68, -0.05, 6.15);
        placeStructure("city-tower", townRadius * 0.52, -townRadius * 0.14, isGrandCapital ? 0.82 : 0.68, 0.05, 6.15);
        if (isGrandCapital) {
          placeStructure("city-gate", 0, townRadius * 0.56, 0.86, Math.PI, 6.24);
          placeStructure("city-keep", -townRadius * 0.72, townRadius * 0.02, 0.82, -0.04, 6.18);
          placeStructure("city-keep", townRadius * 0.72, townRadius * 0.02, 0.82, 0.04, 6.18);
        }
      } else {
        if (city.kind === "sanctum") {
          placeStructure("city-shrine", 0, -townRadius * 0.2, 0.82, 0, 6.22);
          placeStructure("decor-obelisk", -townRadius * 0.36, townRadius * 0.1, 0.58, -0.05, 6.15);
          placeStructure("decor-obelisk", townRadius * 0.36, townRadius * 0.1, 0.58, 0.05, 6.15);
          placeStructure("city-fountain", 0, townRadius * 0.28, 0.5, 0, 6.1);
        } else {
          placeStructure("city-keep", 0, -townRadius * 0.22, city.kind === "fortress" ? 0.92 : city.kind === "outpost" ? 0.68 : 0.8, 0, 6.2);
          placeStructure("city-market", -townRadius * 0.38, townRadius * 0.18, city.kind === "outpost" ? 0.48 : 0.58, -0.04, 6.12);
          placeStructure("city-fountain", townRadius * 0.34, townRadius * 0.18, city.kind === "outpost" ? 0.42 : 0.5, 0.03, 6.08);
        }
        if (city.kind !== "village") {
          placeStructure("city-tower", 0, townRadius * 0.46, city.kind === "fortress" ? 0.66 : 0.58, 0, 6.14);
        }
      }

      if (!fortified && city.kind !== "outpost") {
        placeStructure("city-gate", 0, townRadius * 0.7, 0.54, Math.PI, 6.04);
        placeStructure("city-banner", -townRadius * 0.78, townRadius * 0.12, 0.46, -0.05, 6.05);
        placeStructure("city-banner", townRadius * 0.78, townRadius * 0.12, 0.46, 0.05, 6.05);
      }

      if (city.kind === "harbor") {
        // The old harbor was built from two world-sized rectangles and two
        // triangles. At gameplay zoom those primitives looked like loose,
        // overlapping geometry instead of docks. Reuse the compact props so
        // every harbor keeps a readable silhouette at any camera scale.
        placeStructure("city-dock", -townRadius * 0.34, townRadius * 0.64, 0.82, -0.05, 6.02);
        placeStructure("city-dock", townRadius * 0.34, townRadius * 0.66, 0.78, 0.05, 6.02);
        placeStructure("decor-wave", -townRadius * 0.6, townRadius * 0.76, 0.56, -0.05, 5.92);
        placeStructure("decor-wave", townRadius * 0.6, townRadius * 0.78, 0.54, 0.05, 5.92);
      }
      if (isGrandCapital) {
        graphics.lineStyle(14, 0xfacc15, 0.2);
        graphics.strokeEllipse(city.position.x, city.position.y, townRadius * 2.45, townRadius * 1.55);
        graphics.lineStyle(6, 0xfef3c7, 0.22);
        graphics.strokeEllipse(city.position.x, city.position.y, townRadius * 1.32, townRadius * 0.84);
      }
      if (city.kind === "fortress") {
        graphics.lineStyle(10, 0x94a3b8, 0.18);
        graphics.strokeEllipse(city.position.x, city.position.y, townRadius * 2.16, townRadius * 1.42);
      }
      if (city.kind === "sanctum") {
        graphics.lineStyle(5, 0xa78bfa, 0.34);
        graphics.strokeCircle(city.position.x, city.position.y, townRadius * 0.72);
        graphics.strokeCircle(city.position.x, city.position.y, townRadius * 0.46);
        graphics.fillStyle(0xddd6fe, 0.36);
        graphics.fillCircle(city.position.x, city.position.y - 8, 42);
      }
      if (city.kind === "outpost") {
        placeStructure("city-tent", -townRadius * 0.44, -townRadius * 0.24, 0.54, -0.1, 6.08);
        placeStructure("city-tent", townRadius * 0.46, -townRadius * 0.18, 0.52, 0.1, 6.08);
      }

      this.add
        .text(
          city.position.x,
          city.position.y - townRadius * 0.82 - 86,
          `${this.tr(cityKindLabel(city))} · ${this.tr(city.label)}`,
          {
            color: theme.label,
            fontFamily: "Inter, sans-serif",
            fontSize: isGrandCapital ? "24px" : isHub ? "22px" : "17px",
            backgroundColor: "#07100dd9",
            padding: { x: 10, y: 5 }
          }
        )
        .setOrigin(0.5)
        .setDepth(8);
    };
    const drawTownPlaza = (city: (typeof CITY_DEFINITIONS)[number]) => {
      const isHub = city.id === "greenhill";
      const isGrandCapital = city.id === "crownspire";
      const isMajorCapital = isHub || isGrandCapital;
      const townRadius = cityVisualRadius(city);
      const width = isGrandCapital ? 500 : isHub ? 390 : townRadius * (city.kind === "outpost" ? 0.82 : 0.92);
      const height = isGrandCapital ? 290 : isHub ? 230 : townRadius * (city.kind === "outpost" ? 0.52 : 0.58);
      const x = city.position.x;
      const y = city.position.y;

      graphics.fillStyle(0x3a2417, isMajorCapital ? 0.045 : 0.065);
      graphics.fillEllipse(x, y + 10, width + 54, height + 36);
      graphics.fillStyle(0x594129, isMajorCapital ? 0.78 : 0.86);
      graphics.fillEllipse(x, y + 4, width, height);
      graphics.fillStyle(isGrandCapital ? 0xd6a15d : 0x73563a, isGrandCapital ? 0.24 : isHub ? 0.34 : 0.48);
      graphics.fillEllipse(x - width * 0.1, y - height * 0.08, width * 0.58, height * 0.5);
      graphics.lineStyle(4, 0xd6a15d, 0.22);
      graphics.strokeEllipse(x, y + 4, width, height);
      graphics.lineStyle(2, 0x2f2418, 0.2);
      graphics.strokeEllipse(x, y + 4, width * 0.7, height * 0.62);
    };
    const drawCheckpointFire = (city: (typeof CITY_DEFINITIONS)[number]) => {
      const isHub = city.id === "greenhill";
      const scale = isHub ? 1.16 : Phaser.Math.Clamp(city.safeRadius / 430, 0.74, 1.0);
      const x = city.position.x;
      const y = city.position.y + (isHub ? 32 : 24);

      this.add.ellipse(x, y + 17 * scale, 150 * scale, 58 * scale, 0x050807, 0.34).setDepth(7.05);
      const aura = this.add
        .ellipse(x, y + 2 * scale, 180 * scale, 120 * scale, 0xf97316, 0.1)
        .setStrokeStyle(4, 0xfacc15, 0.18)
        .setDepth(7.08);
      const glow = this.add.ellipse(x, y - 4 * scale, 104 * scale, 86 * scale, 0xf97316, 0.22).setDepth(7.1);
      this.add.rectangle(x - 24 * scale, y + 32 * scale, 64 * scale, 12 * scale, 0x3b2414, 0.96).setRotation(-0.33).setDepth(7.12);
      this.add.rectangle(x + 24 * scale, y + 32 * scale, 64 * scale, 12 * scale, 0x2a180c, 0.96).setRotation(0.33).setDepth(7.12);
      this.add.rectangle(x, y + 38 * scale, 76 * scale, 10 * scale, 0x5f3b1f, 0.88).setDepth(7.13);
      const flame = this.add.image(x, y - 8 * scale, "decor-fire").setScale(scale * 0.72).setDepth(7.2);
      const sparkA = this.add.circle(x - 22 * scale, y - 58 * scale, 5 * scale, 0xfacc15, 0.82).setDepth(7.24);
      const sparkB = this.add.circle(x + 28 * scale, y - 43 * scale, 4 * scale, 0xffedd5, 0.68).setDepth(7.24);

      this.checkpointFires.set(city.id, {
        aura,
        glow,
        flame,
        sparkA,
        sparkB,
        baseScale: scale,
        seed: city.recommendedLevel * 0.73 + city.position.x * 0.002
      });
    };
    const drawCityServices = (city: (typeof CITY_DEFINITIONS)[number]) => {
      const merchant = CITY_MERCHANTS.find((candidate) => candidate.cityId === city.id);
      const teleporter = CITY_TELEPORTERS.find((candidate) => candidate.cityId === city.id);
      const drawLabel = (x: number, y: number, label: string, color: string) => {
        this.add
          .text(x, y, this.tr(label), {
            color,
            fontFamily: "Inter, sans-serif",
            fontSize: city.id === "greenhill" ? "13px" : "11px",
            backgroundColor: "#00000080",
            padding: { x: 6, y: 3 }
          })
          .setOrigin(0.5)
          .setDepth(8.5);
      };

      if (merchant) {
        const { x, y } = merchant.position;
        this.add.ellipse(x, y + 18, merchant.radius * 0.72, merchant.radius * 0.32, 0xfacc15, 0.035).setStrokeStyle(2, 0xfacc15, 0.075).setDepth(7.42);
        this.add
          .image(x, y, "npc-merchant")
          .setScale(city.id === "greenhill" ? 1.02 : 0.88)
          .setDepth(8)
          .setInteractive({ useHandCursor: true })
          .on("pointerdown", (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
            event.stopPropagation();
            if (this.isInputBlocked()) {
              return;
            }
            this.clickMoveTarget = undefined;
            this.moveMarker?.setVisible(false);
            this.resumeAudio();
            window.dispatchEvent(new CustomEvent("mmo:openShop", { detail: { cityId: city.id } }));
            this.playUiOpenSound("shop");
          });
        drawLabel(x, y - 72, "Merchant", "#fef3c7");
      }

      if (teleporter) {
        const { x, y } = teleporter.position;
        const isTradeZone = city.id === "market";
        const gateScale = city.id === "greenhill" ? 1 : 0.86;
        const gate = this.add
          .image(x, y - 10, "city-teleporter")
          .setScale(gateScale)
          .setDepth(8.05)
          .setInteractive({ useHandCursor: true })
          .on("pointerdown", (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
            event.stopPropagation();
            if (this.isInputBlocked()) {
              return;
            }
            this.clickMoveTarget = undefined;
            this.moveMarker?.setVisible(false);
            this.resumeAudio();
            window.dispatchEvent(new CustomEvent("mmo:openTeleportMenu", { detail: { cityId: city.id } }));
            this.playUiOpenSound("gate");
          });
        if (isTradeZone) {
          gate.setTint(0x34d399);
        }
        this.add
          .circle(x, y - 12, teleporter.radius * 0.18, isTradeZone ? 0x22c55e : 0x7c3aed, isTradeZone ? 0.18 : 0.1)
          .setStrokeStyle(3, isTradeZone ? 0xfacc15 : 0x67e8f9, isTradeZone ? 0.36 : 0.26)
          .setDepth(7.72);
        this.teleportViews.set(
          teleporter.id,
          this.add
            .circle(x, y - 12, teleporter.radius * 0.09, isTradeZone ? 0xfacc15 : 0xc4b5fd, isTradeZone ? 0.42 : 0.34)
            .setStrokeStyle(2, isTradeZone ? 0xbbf7d0 : 0xf8fafc, isTradeZone ? 0.58 : 0.42)
            .setDepth(8.2)
        );
        gate.setData("baseScale", gateScale);
        drawLabel(x, y - 92, isTradeZone ? "Trade Gate" : "Gate", isTradeZone ? "#bbf7d0" : "#ddd6fe");
      }
    };
    const drawRoadSign = (x: number, y: number, label: string, rotation = 0) => {
      this.add.image(x, y, "road-signpost").setRotation(rotation).setScale(0.72).setDepth(6.2);
      this.add
        .text(x, y - 42, this.tr(label), {
          color: "#fef3c7",
          fontFamily: "Inter, sans-serif",
          fontSize: "11px",
          backgroundColor: "#1c120bcc",
          padding: { x: 5, y: 3 }
        })
        .setOrigin(0.5)
        .setDepth(6.3);
    };
    const drawWorldObstacle = (obstacle: (typeof WORLD_OBSTACLES)[number]) => {
      if (obstacle.kind === "arenaWall") {
        return;
      }

      if (obstacle.id === "harbor-breakwater") {
        const rotation = obstacle.rotation ?? 0;
        const tangentX = Math.cos(rotation);
        const tangentY = Math.sin(rotation);
        const depth = 5.85 + obstacle.position.y * 0.00022;
        this.add
          .ellipse(obstacle.position.x, obstacle.position.y + obstacle.radiusY * 0.55, obstacle.radiusX * 2.2, obstacle.radiusY * 1.35, 0x082f49, 0.055)
          .setRotation(rotation)
          .setDepth(depth - 0.12);
        for (let index = -3; index <= 3; index += 1) {
          const x = obstacle.position.x + tangentX * index * 54;
          const y = obstacle.position.y + tangentY * index * 54 + (index % 2) * 10;
          this.add
            .image(x, y, "decor-rock-flat")
            .setRotation(rotation + index * 0.05)
            .setScale(0.54 + Math.abs(index) * 0.04)
            .setAlpha(0.82)
            .setDepth(depth + index * 0.002);
        }
        this.add.image(obstacle.position.x - tangentX * 170, obstacle.position.y - tangentY * 170, "decor-wave").setRotation(rotation).setScale(0.9).setAlpha(0.45).setDepth(depth + 0.02);
        this.add.image(obstacle.position.x + tangentX * 168, obstacle.position.y + tangentY * 168, "decor-wave").setRotation(rotation).setScale(0.82).setAlpha(0.42).setDepth(depth + 0.02);
        return;
      }

      const texture =
        obstacle.kind === "fence"
          ? "obstacle-fence"
          : obstacle.kind === "ruin"
            ? "obstacle-ruin"
            : obstacle.kind === "treeLine"
              ? "obstacle-tree-line"
              : "obstacle-boulder";
      const rotation = obstacle.rotation ?? 0;
      const depth = 6.15 + obstacle.position.y * 0.00022;
      const widthScale = obstacle.kind === "fence" || obstacle.kind === "treeLine" ? 2.12 : 1.72;
      const heightScale = obstacle.kind === "fence" || obstacle.kind === "treeLine" ? 2.3 : 1.95;

      this.add
        .ellipse(obstacle.position.x, obstacle.position.y + obstacle.radiusY * 0.42, obstacle.radiusX * 1.92, obstacle.radiusY * 1.12, 0x3a2417, 0.055)
        .setRotation(rotation)
        .setDepth(depth - 0.08);
      this.add
        .image(obstacle.position.x, obstacle.position.y, texture)
        .setDisplaySize(obstacle.radiusX * widthScale, Math.max(92, obstacle.radiusY * heightScale))
        .setRotation(rotation)
        .setDepth(depth);
    };
    const drawWorldHazard = (hazard: WorldHazardDefinition) => {
      const rotation = hazard.rotation ?? 0;
      const depth = 8.65 + hazard.position.y * 0.00012;
      const isLaser = hazard.kind === "laserGate";
      const isCrack = hazard.kind === "riftCrack";
      const warningColor = isCrack ? 0xa855f7 : isLaser ? 0x22d3ee : 0xf97316;
      const glowColor = isCrack ? 0x7c3aed : isLaser ? 0x06b6d4 : 0xf59e0b;

      if (hazard.kind === "orbStream") {
        const warning = this.add
          .ellipse(hazard.position.x, hazard.position.y, hazard.width + 150, hazard.height + 115, warningColor, 0.08)
          .setStrokeStyle(4, warningColor, 0.18)
          .setRotation(rotation)
          .setDepth(depth - 0.4);
        const glow = this.add
          .ellipse(hazard.position.x, hazard.position.y, hazard.width + 62, hazard.height + 48, glowColor, 0.07)
          .setStrokeStyle(3, 0xffedd5, 0.16)
          .setRotation(rotation)
          .setDepth(depth - 0.2);
        const orbs = Array.from({ length: HAZARD_ORB_COUNT }, (_, index) =>
          this.add
            .circle(hazard.position.x, hazard.position.y, 26 + index * 1.5, index % 2 === 0 ? 0xf97316 : 0x22d3ee, 0.78)
            .setStrokeStyle(4, 0xffffff, 0.4)
            .setDepth(depth + 0.4 + index * 0.01)
        );
        const sparks = Array.from({ length: HAZARD_ORB_COUNT }, (_, index) =>
          this.add
            .circle(hazard.position.x, hazard.position.y, 52 + index * 2, index % 2 === 0 ? 0xf97316 : 0x22d3ee, 0.14)
            .setDepth(depth + 0.25 + index * 0.01)
        );
        this.hazardViews.set(hazard.id, { warning, glow, orbs, sparks });
        return;
      }

      const shadow = this.add
        .rectangle(hazard.position.x, hazard.position.y + 9, hazard.width + 90, hazard.height + 46, 0x020617, isCrack ? 0.28 : 0.16)
        .setRotation(rotation)
        .setDepth(depth - 0.5);
      const warning = this.add
        .rectangle(hazard.position.x, hazard.position.y, hazard.width + 70, hazard.height + 38, warningColor, isCrack ? 0.14 : 0.08)
        .setStrokeStyle(4, warningColor, isCrack ? 0.28 : 0.18)
        .setRotation(rotation)
        .setDepth(depth - 0.25);
      const glow = this.add
        .rectangle(hazard.position.x, hazard.position.y, hazard.width, hazard.height, glowColor, isCrack ? 0.24 : 0.0)
        .setRotation(rotation)
        .setDepth(depth + 0.25);
      const core = this.add
        .rectangle(hazard.position.x, hazard.position.y, hazard.width, Math.max(10, hazard.height * (isCrack ? 0.42 : 0.28)), isCrack ? 0x12051f : 0xecfeff, isCrack ? 0.92 : 0.0)
        .setStrokeStyle(isCrack ? 2 : 0, warningColor, isCrack ? 0.8 : 0)
        .setRotation(rotation)
        .setDepth(depth + 0.55);

      if (isCrack) {
        const tangentX = Math.cos(rotation);
        const tangentY = Math.sin(rotation);
        for (let index = -4; index <= 4; index += 1) {
          const offset = index * (hazard.width / 9);
          const spark = this.add
            .circle(
              hazard.position.x + tangentX * offset,
              hazard.position.y + tangentY * offset + ((index % 2) * 2 - 1) * 10,
              7 + (Math.abs(index) % 3) * 3,
              warningColor,
              0.38
            )
            .setDepth(depth + 0.7);
          this.tweens.add({
            targets: spark,
            alpha: { from: 0.18, to: 0.62 },
            scale: { from: 0.72, to: 1.18 },
            duration: 520 + Math.abs(index) * 80,
            yoyo: true,
            repeat: -1
          });
        }
      } else {
        const tangentX = Math.cos(rotation);
        const tangentY = Math.sin(rotation);
        [-1, 1].forEach((side) => {
          this.add
            .rectangle(
              hazard.position.x + tangentX * side * (hazard.width * 0.52),
              hazard.position.y + tangentY * side * (hazard.width * 0.52),
              58,
              120,
              0x111827,
              0.95
            )
            .setStrokeStyle(3, warningColor, 0.5)
            .setRotation(rotation + Math.PI / 2)
            .setDepth(depth + 0.15);
        });
      }

      shadow.setAlpha(isCrack ? 0.28 : 0.14);
      this.hazardViews.set(hazard.id, { warning, glow, core });
    };
    const drawFireField = (x: number, y: number, width: number, height: number, count: number) => {
      for (let index = 0; index < count; index += 1) {
        const px = x - width / 2 + ((index * 421) % width);
        const py = y - height / 2 + ((index * 263) % height);
        const dx = (px - x) / (width / 2);
        const dy = (py - y) / (height / 2);
        if (dx * dx + dy * dy > 1) {
          continue;
        }
        graphics.fillStyle(0x7f1d1d, 0.72);
        graphics.fillCircle(px, py, 28 + (index % 4) * 8);
        graphics.fillStyle(index % 2 === 0 ? 0xf97316 : 0xfacc15, 0.75);
        graphics.fillTriangle(px, py - 36, px - 18, py + 18, px + 18, py + 18);
      }
    };
    const drawMeadowField = (x: number, y: number, width: number, height: number, count: number, seed: number) => {
      const flowerColors = [0xfef08a, 0xfda4af, 0xe9d5ff, 0xf8fafc, 0xfdba74, 0xa7f3d0];
      for (let index = 0; index < count; index += 1) {
        const n1 = roadNoise(seed * 31 + index * 17.3);
        const n2 = roadNoise(seed * 53 + index * 29.7);
        const px = x + (n1 - 0.5) * width * 0.94;
        const py = y + (n2 - 0.5) * height * 0.94;
        const dx = (px - x) / (width / 2);
        const dy = (py - y) / (height / 2);
        if (dx * dx + dy * dy > 1) {
          continue;
        }
        if (
          Phaser.Math.Distance.Between(px, py, WORLD_BOUNDS.town.x, WORLD_BOUNDS.town.y) < 460 ||
          Phaser.Math.Distance.Between(px, py, WORLD_STARTER_ARENA.center.x, WORLD_STARTER_ARENA.center.y) < WORLD_STARTER_ARENA.radius + 360
        ) {
          continue;
        }
        const n3 = roadNoise(seed * 71 + index * 41.1);
        // Soft grass tuft base.
        graphics.fillStyle(n3 > 0.5 ? 0x63a838 : 0x4f8f2c, 0.18 + n3 * 0.14);
        graphics.fillEllipse(px, py, 26 + n3 * 30, 11 + n3 * 12);
        if (n3 > 0.6) {
          // Single flower per bright tuft: the map Graphics is redrawn every frame,
          // so flower clusters (dozens of circles each) were a real per-frame cost.
          const color = flowerColors[index % flowerColors.length];
          const petal = 2.4 + n1 * 2;
          graphics.fillStyle(color, 0.72);
          graphics.fillCircle(px - petal, py, petal);
          graphics.fillCircle(px + petal, py, petal);
          graphics.fillCircle(px, py - petal, petal);
          graphics.fillCircle(px, py + petal, petal);
          graphics.fillStyle(0xfacc15, 0.85);
          graphics.fillCircle(px, py, petal * 0.7);
        }
      }
    };
    const biomePalette = (kind: (typeof WORLD_MAP_REGIONS)[number]["kind"]) => {
      const palettes = {
        grass: { color: 0x72b83f, accent: 0xe4ff9d, alpha: 0.62 },
        forest: { color: 0x33933d, accent: 0x9df56b, alpha: 0.8 },
        darkForest: { color: 0x2f5a3a, accent: 0xa7f3d0, alpha: 0.76 },
        desert: { color: 0xd9a13d, accent: 0xffe08a, alpha: 0.8 },
        snow: { color: 0xc7dfe9, accent: 0xffffff, alpha: 0.58 },
        swamp: { color: 0x3c8d62, accent: 0xb5f36c, alpha: 0.76 },
        coast: { color: 0xe0bf69, accent: 0x67e8f9, alpha: 0.42 },
        fire: { color: 0x8f3e25, accent: 0xffb020, alpha: 0.86 },
        void: { color: 0x4b2c72, accent: 0xd8b4fe, alpha: 0.86 },
        mountain: { color: 0x87919b, accent: 0xf8fafc, alpha: 0.66 }
      } as const;
      return palettes[kind];
    };
    const drawGreenhillHuntingMeadow = () => {
      const center = { x: 3150, y: 3400 };
      const width = 5600;
      const height = 3400;
      const pointCount = 42;
      const organicPoints = (scale: number): Vector2[] =>
        Array.from({ length: pointCount }, (_, index) => {
          const angle = (index / pointCount) * Math.PI * 2;
          const wobble =
            1 +
            Math.sin(angle * 3 + 0.4) * 0.075 +
            Math.sin(angle * 7 + 1.7) * 0.045 +
            (((index * 29) % 15) - 7) * 0.006;
          return {
            x: center.x + Math.cos(angle) * (width / 2) * scale * wobble,
            y: center.y + Math.sin(angle) * (height / 2) * scale * wobble
          };
        });
      const fillOrganic = (points: Vector2[]) => {
        graphics.beginPath();
        graphics.moveTo(points[0].x, points[0].y);
        points.slice(1).forEach((point) => graphics.lineTo(point.x, point.y));
        graphics.closePath();
        graphics.fillPath();
      };

      graphics.fillStyle(0x1b4f22, 0.08);
      fillOrganic(organicPoints(1.2));
      graphics.fillStyle(0x78bc3f, 0.22);
      fillOrganic(organicPoints(1.03));
      graphics.fillStyle(0x96d84d, 0.16);
      fillOrganic(organicPoints(0.78));
      graphics.fillStyle(0xf1f5a8, 0.08);
      fillOrganic(organicPoints(0.52));

      for (let index = 0; index < 46; index += 1) {
        const angle = ((index * 137.508) % 360) * Phaser.Math.DEG_TO_RAD;
        const radius = Math.sqrt(((index * 71) % 997) / 997);
        const x = center.x + Math.cos(angle) * width * 0.42 * radius;
        const y = center.y + Math.sin(angle) * height * 0.36 * radius;
        const noise = roadNoise(index * 37 + 11);
        graphics.fillStyle(index % 5 === 0 ? 0xfef08a : index % 5 === 1 ? 0xffffff : 0xb8e866, 0.12 + noise * 0.11);
        graphics.fillEllipse(x, y, 42 + noise * 62, 12 + noise * 18);
        if (index % 4 === 0) {
          graphics.fillStyle(0x2f7d36, 0.08 + noise * 0.06);
          graphics.fillEllipse(x - 12, y + 8, 72 + noise * 46, 24 + noise * 18);
        }
      }

      const edgeCount = 34;
      for (let index = 0; index < edgeCount; index += 1) {
        const angle = (index / edgeCount) * Math.PI * 2 + roadNoise(index * 19) * 0.08;
        const x = center.x + Math.cos(angle) * width * 0.54 * (0.92 + roadNoise(index * 17) * 0.18);
        const y = center.y + Math.sin(angle) * height * 0.44 * (0.9 + roadNoise(index * 23) * 0.18);
        const dark = index % 3 === 0;
        graphics.fillStyle(dark ? 0x0f351b : 0x1f5f2c, 0.18);
        graphics.fillCircle(x, y, 42 + roadNoise(index * 31) * 38);
        graphics.fillStyle(0x071f10, 0.14);
        graphics.fillEllipse(x + 16, y + 28, 82, 24);
      }
    };
    const drawStarterArenaGroundBlend = () => {
      const { x, y } = WORLD_STARTER_ARENA.center;
      const radius = WORLD_STARTER_ARENA.radius + 360;
      const organicPoints = (scale: number): Vector2[] =>
        Array.from({ length: 34 }, (_, index) => {
          const angle = (index / 34) * Math.PI * 2;
          const wobble = 1 + Math.sin(angle * 3 + 0.7) * 0.08 + Math.sin(angle * 7 + 1.8) * 0.045;
          return {
            x: x + Math.cos(angle) * radius * scale * wobble,
            y: y + Math.sin(angle) * radius * 0.86 * scale * wobble
          };
        });
      const fillOrganic = (points: Vector2[]) => {
        graphics.beginPath();
        graphics.moveTo(points[0].x, points[0].y);
        points.slice(1).forEach((point) => graphics.lineTo(point.x, point.y));
        graphics.closePath();
        graphics.fillPath();
      };
      graphics.fillStyle(0x3a2619, 0.28);
      fillOrganic(organicPoints(1.08));
      graphics.fillStyle(0x4a3420, 0.58);
      fillOrganic(organicPoints(0.98));
      graphics.fillStyle(0x6d4d2d, 0.14);
      graphics.fillEllipse(x + 150, y + 120, radius * 0.95, radius * 0.52);
      graphics.fillStyle(0x2f4f2c, 0.1);
      graphics.fillEllipse(x - 360, y - 280, radius * 0.5, radius * 0.32);

      for (let index = 0; index < 12; index += 1) {
        const angle = ((index * 137.5) % 360) * Phaser.Math.DEG_TO_RAD;
        const distance = WORLD_STARTER_ARENA.innerRadius + 240 + ((index * 73) % 330);
        const px = x + Math.cos(angle) * distance;
        const py = y + Math.sin(angle) * distance * 0.92;
        const noise = roadNoise(index * 41 + 17);
        graphics.fillStyle(index % 3 === 0 ? 0x8b6c45 : 0x3f5f31, 0.08 + noise * 0.06);
        graphics.fillEllipse(px, py, 48 + noise * 34, 14 + noise * 12);
      }
    };
    const drawStarterArena = () => {
      const { x, y } = WORLD_STARTER_ARENA.center;
      const radius = WORLD_STARTER_ARENA.radius;
      const innerRadius = WORLD_STARTER_ARENA.innerRadius;
      const wallRadius = WORLD_STARTER_ARENA_WALL_RADIUS;
      const gateHalfAngle = WORLD_STARTER_ARENA_GATE_HALF_ANGLE;
      const normalizeAngle = (angle: number) => {
        let result = angle;
        while (result <= -Math.PI) {
          result += Math.PI * 2;
        }
        while (result > Math.PI) {
          result -= Math.PI * 2;
        }
        return result;
      };
      const angleDistance = (a: number, b: number) => Math.abs(normalizeAngle(a - b));
      const isGateAngle = (angle: number) => WORLD_STARTER_ARENA_GATES.some((gate) => angleDistance(angle, gate.angle) <= gateHalfAngle);
      const wallPoint = (angle: number, offset = 0) => ({
        x: x + Math.cos(angle) * (wallRadius + offset),
        y: y + Math.sin(angle) * (wallRadius + offset)
      });
      const drawWallArc = (offset: number, width: number, color: number, alpha: number) => {
        graphics.lineStyle(width, color, alpha);
        const segments = 132;
        for (let index = 0; index < segments; index += 1) {
          const startAngle = (index / segments) * Math.PI * 2;
          const endAngle = ((index + 1) / segments) * Math.PI * 2;
          if (isGateAngle(startAngle) || isGateAngle(endAngle)) {
            continue;
          }
          const start = wallPoint(startAngle, offset);
          const end = wallPoint(endAngle, offset);
          graphics.lineBetween(start.x, start.y, end.x, end.y);
        }
      };
      graphics.fillStyle(0x120907, 0.5);
      graphics.fillCircle(x, y + 24, radius + 82);
      graphics.fillStyle(0x43180f, 0.76);
      graphics.fillCircle(x, y, radius);
      graphics.fillStyle(0x74351f, 0.62);
      graphics.fillCircle(x, y, innerRadius);
      graphics.fillStyle(0x9a552d, 0.18);
      graphics.fillCircle(x, y, Math.max(120, innerRadius * 0.44));
      graphics.lineStyle(10, 0x3a2417, 0.38);
      graphics.strokeCircle(x, y, radius + 10);
      graphics.lineStyle(4, 0xfacc15, 0.12);
      graphics.strokeCircle(x, y, radius - 34);
      graphics.lineStyle(5, 0xfacc15, 0.28);
      graphics.strokeCircle(x, y, innerRadius);
      graphics.strokeCircle(x, y, Math.max(120, innerRadius * 0.44));

      drawWallArc(8, 42, 0x0f0804, 0.42);
      drawWallArc(0, 28, 0x3a2417, 0.94);
      drawWallArc(-5, 10, 0x7c4a25, 0.88);
      drawWallArc(-12, 4, 0xeab76c, 0.42);

      WORLD_STARTER_ARENA_GATES.forEach((gate) => {
        const center = wallPoint(gate.angle, 2);
        const left = wallPoint(gate.angle - gateHalfAngle, 16);
        const right = wallPoint(gate.angle + gateHalfAngle, 16);
        graphics.lineStyle(8, 0xfacc15, 0.26);
        graphics.lineBetween(left.x, left.y, center.x, center.y);
        graphics.lineBetween(center.x, center.y, right.x, right.y);
      });

      Array.from({ length: 7 }, (_, index) => {
        const angle = ((index * 51 + 18) % 360) * Phaser.Math.DEG_TO_RAD;
        const distance = innerRadius * (0.38 + (index % 4) * 0.12);
        const point = {
          x: x + Math.cos(angle) * distance,
          y: y + Math.sin(angle) * distance * 0.9
        };
        const texture = index % 3 === 0 ? "decor-bone" : index % 3 === 1 ? "decor-rock-flat" : "decor-ruin";
        const rotation = texture === "decor-bone" || texture === "decor-ruin" ? ((((index * 17) % 9) - 4) * 0.018) : angle + Math.PI / 2;
        this.add
          .image(point.x, point.y, texture)
          .setRotation(rotation)
          .setScale(texture === "decor-bone" ? 0.42 : texture === "decor-ruin" ? 0.42 : 0.5)
          .setAlpha(0.82)
          .setDepth(6.45 + point.y * 0.00022);
      });

      this.add
        .text(x, y - radius - 58, this.nameWithLevel(WORLD_STARTER_ARENA.label, WORLD_STARTER_ARENA.recommendedLevel, true), {
          color: "#fee2e2",
          fontFamily: "Inter, sans-serif",
          fontSize: "18px",
          backgroundColor: "#1c0b0bd9",
          padding: { x: 7, y: 4 }
        })
        .setOrigin(0.5)
        .setDepth(7.8);
    };
    const drawLandmark = (landmark: (typeof WORLD_LANDMARKS)[number]) => {
      const { x, y } = landmark.position;
      const color =
        landmark.kind === "boss" || landmark.kind === "arena"
          ? 0xef4444
          : landmark.kind === "harbor" || landmark.kind === "ship"
            ? 0x38bdf8
            : landmark.kind === "dungeon" || landmark.kind === "cave"
              ? 0xa78bfa
              : landmark.kind === "graveyard" || landmark.kind === "ruins"
                ? 0xd1d5db
                : 0xfacc15;
      const placeLandmark = (texture: string, dx: number, dy: number, scale: number, rotation = 0, depth = 6.9) => {
        this.add
          .image(x + dx, y + dy, texture)
          .setRotation(rotation)
          .setScale(scale)
          .setDepth(depth + dy * 0.0002);
      };
      graphics.fillStyle(color, landmark.kind === "boss" ? 0.09 : 0.055);
      graphics.fillCircle(x, y, landmark.radius * 0.92);
      graphics.lineStyle(2, color, 0.12);
      graphics.strokeCircle(x, y, landmark.radius * 0.62);
      graphics.lineStyle(landmark.kind === "boss" ? 10 : 6, color, landmark.kind === "boss" ? 0.32 : 0.2);
      graphics.strokeCircle(x, y, landmark.radius);
      graphics.fillStyle(0x050807, 0.54);
      graphics.fillEllipse(x, y + 34, 210, 58);
      if (landmark.kind === "harbor") {
        graphics.fillStyle(0x0e7490, 0.18);
        graphics.fillEllipse(x, y + 74, 430, 128);
        graphics.fillStyle(0x7c4a25, 0.9);
        graphics.fillRoundedRect(x - 116, y + 32, 232, 24, 7);
        graphics.fillRoundedRect(x - 18, y - 54, 36, 152, 8);
        graphics.lineStyle(4, 0xd6a15d, 0.24);
        graphics.lineBetween(x - 112, y + 43, x + 112, y + 43);
        placeLandmark("city-dock", -112, 110, 0.95, -0.04, 6.5);
        placeLandmark("city-dock", 116, 114, 0.9, 0.05, 6.5);
        placeLandmark("decor-wave", -176, 26, 0.76, -0.04, 6.45);
        placeLandmark("decor-wave", 178, 36, 0.68, 0.04, 6.45);
        placeLandmark("city-banner", -156, 18, 0.62, -0.1, 7);
      } else if (landmark.kind === "ship") {
        graphics.fillStyle(0x020617, 0.28);
        graphics.fillEllipse(x, y + 112, 322, 52);
        graphics.fillStyle(0x7c3f16, 0.94);
        graphics.fillRoundedRect(x - 150, y + 48, 300, 68, 30);
        graphics.fillStyle(0x5b3418, 0.92);
        graphics.fillRoundedRect(x - 126, y + 42, 246, 30, 13);
        graphics.lineStyle(4, 0xd6a15d, 0.3);
        graphics.strokeRoundedRect(x - 145, y + 52, 290, 58, 26);
        graphics.fillStyle(0xd6a15d, 0.72);
        graphics.fillRoundedRect(x + 12, y - 80, 9, 132, 4);
        graphics.fillStyle(0xd6a15d, 0.34);
        graphics.fillRoundedRect(x + 28, y - 56, 68, 42, 16);
        graphics.fillStyle(0xfef3c7, 0.28);
        graphics.fillRoundedRect(x - 70, y - 48, 72, 40, 16);
        placeLandmark("decor-wave", -142, 112, 0.7, -0.06, 6.45);
        placeLandmark("decor-wave", 136, 118, 0.7, 0.05, 6.45);
      } else if (landmark.kind === "dungeon" || landmark.kind === "cave") {
        graphics.fillStyle(0x020617, 0.42);
        graphics.fillEllipse(x, y + 60, 356, 246);
        graphics.fillStyle(0x1f2937, 0.96);
        graphics.fillEllipse(x, y + 30, 324, 234);
        graphics.fillStyle(0x374151, 0.72);
        graphics.fillEllipse(x - 36, y - 16, 212, 142);
        graphics.fillStyle(0x020617, 1);
        graphics.fillEllipse(x, y + 58, 138, 142);
        graphics.lineStyle(5, color, 0.7);
        graphics.strokeEllipse(x, y + 58, 138, 142);
        graphics.lineStyle(4, 0x94a3b8, 0.24);
        graphics.strokeEllipse(x, y + 30, 320, 230);
        placeLandmark("decor-ruin", -142, 78, 0.92, -0.12, 6.65);
        placeLandmark("decor-ruin", 138, 86, 0.88, 0.1, 6.65);
        placeLandmark("decor-obelisk", 0, -28, 0.84, 0, 6.7);
        placeLandmark("decor-crystal", -72, 34, 0.72, -0.04, 6.75);
        placeLandmark("decor-crystal", 82, 40, 0.68, 0.08, 6.75);
      } else if (landmark.kind === "graveyard") {
        graphics.fillStyle(0x111827, 0.38);
        graphics.fillEllipse(x, y + 34, 360, 170);
        graphics.fillStyle(0x6b7280, 0.88);
        for (let index = -3; index <= 3; index += 1) {
          graphics.fillRoundedRect(x + index * 48 - 13, y + 12 + Math.abs(index) * 8, 26, 62, 9);
          if (index % 2 === 0) {
            placeLandmark("decor-grave", index * 70, 80 + Math.abs(index) * 8, 0.82, index * 0.08, 6.7);
          }
        }
        graphics.lineStyle(4, 0xd1d5db, 0.32);
        graphics.lineBetween(x - 84, y - 28, x + 84, y - 28);
      } else if (landmark.kind === "arena") {
        graphics.fillStyle(0x7f1d1d, 0.64);
        graphics.fillCircle(x, y, 92);
        graphics.lineStyle(9, 0xfacc15, 0.56);
        graphics.strokeCircle(x, y, 142);
        placeLandmark("city-banner", -150, -54, 0.72, -0.08, 7.1);
        placeLandmark("city-banner", 150, -54, 0.72, 0.08, 7.1);
      } else if (landmark.kind === "boss") {
        graphics.fillStyle(0x1c0505, 0.48);
        graphics.fillCircle(x, y, 210);
        graphics.fillStyle(0x7f1d1d, 0.8);
        graphics.fillCircle(x, y, 108);
        graphics.fillStyle(0xf97316, 0.72);
        graphics.fillRoundedRect(x - 62, y - 88, 124, 154, 42);
        graphics.fillStyle(0xfacc15, 0.34);
        graphics.fillEllipse(x, y - 18, 82, 118);
        graphics.lineStyle(7, 0xf97316, 0.46);
        graphics.strokeCircle(x, y, 130);
        placeLandmark("decor-obelisk", -170, 44, 0.9, -0.12, 6.8);
        placeLandmark("decor-obelisk", 170, 44, 0.9, 0.12, 6.8);
        placeLandmark("decor-fire", -92, 92, 0.88, 0, 6.9);
        placeLandmark("decor-fire", 96, 92, 0.88, 0, 6.9);
      } else if (landmark.kind === "ruins") {
        graphics.fillStyle(0x1f2937, 0.5);
        graphics.fillEllipse(x, y + 26, 320, 150);
        placeLandmark("decor-ruin", -112, 34, 1.08, -0.12, 6.7);
        placeLandmark("decor-ruin", 96, 58, 0.98, 0.13, 6.7);
        placeLandmark("decor-grave", 0, 82, 0.82, 0.03, 6.72);
      } else if (landmark.kind === "camp") {
        graphics.fillStyle(0x3f2d1c, 0.42);
        graphics.fillEllipse(x, y + 42, 350, 150);
        graphics.fillStyle(0xf97316, 0.52);
        graphics.fillCircle(x, y + 42, 34);
        placeLandmark("city-tent", -112, 36, 1.0, -0.08, 6.74);
        placeLandmark("city-tent", 118, 44, 0.92, 0.08, 6.74);
        placeLandmark("decor-lamp", -12, -18, 0.76, 0, 6.9);
        placeLandmark("city-banner", 0, 88, 0.68, 0.04, 7.02);
      } else if (landmark.kind === "tower") {
        graphics.fillStyle(0x312e81, 0.18);
        graphics.fillEllipse(x, y + 52, 360, 150);
        placeLandmark("city-tower", -92, 28, 1.08, -0.06, 6.86);
        placeLandmark("city-tower", 92, 30, 1.02, 0.06, 6.86);
        placeLandmark("city-keep", 0, 54, 1.0, 0, 6.9);
        placeLandmark("city-banner", -176, 26, 0.72, -0.1, 7.05);
        placeLandmark("city-banner", 176, 28, 0.72, 0.1, 7.05);
      } else {
        graphics.fillStyle(color, 0.72);
        graphics.fillCircle(x, y, 76);
      }
      this.add
        .text(x, y - landmark.radius - 42, this.nameWithLevel(landmark.label, landmark.recommendedLevel, true), {
          color: "#f8fafc",
          fontFamily: "Inter, sans-serif",
          fontSize: landmark.kind === "boss" ? "18px" : "14px",
          backgroundColor: "#00000073",
          padding: { x: 6, y: 3 }
        })
        .setOrigin(0.5)
        .setDepth(7.6);
    };

    const edgeLeft = -edgePadding;
    const edgeTop = -edgePadding;
    const edgeRight = WORLD_BOUNDS.width + edgePadding;
    const edgeBottom = WORLD_BOUNDS.height + edgePadding;

    graphics.fillStyle(0x083d52, 0.92);
    graphics.fillRect(
      edgeLeft,
      edgeTop,
      WORLD_BOUNDS.width + edgePadding * 2,
      WORLD_BOUNDS.height + edgePadding * 2
    );
    graphics.fillStyle(0x17351f, 0.24);
    graphics.fillRect(0, 0, WORLD_BOUNDS.width, WORLD_BOUNDS.height);

    graphics.lineStyle(1, 0x24422e, 0.012);
    for (let x = 0; x <= WORLD_BOUNDS.width; x += 320) {
      graphics.lineBetween(x, 0, x, WORLD_BOUNDS.height);
    }
    for (let y = 0; y <= WORLD_BOUNDS.height; y += 320) {
      graphics.lineBetween(0, y, WORLD_BOUNDS.width, y);
    }

    const drawSmoothSea = (shorePoints: Vector2[], side: "west" | "south" | "north") => {
      const shore = sampleCurve(shorePoints, 20);
      graphics.fillStyle(0x096b82, 0.86);
      graphics.beginPath();
      if (side === "west") {
        graphics.moveTo(edgeLeft, edgeTop);
        graphics.lineTo(shore[0].x, shore[0].y);
        shore.slice(1).forEach((point) => graphics.lineTo(point.x, point.y));
        graphics.lineTo(edgeLeft, edgeBottom);
      } else if (side === "south") {
        graphics.moveTo(edgeLeft, edgeBottom);
        graphics.lineTo(shore[0].x, shore[0].y);
        shore.slice(1).forEach((point) => graphics.lineTo(point.x, point.y));
        graphics.lineTo(edgeRight, edgeBottom);
      } else {
        graphics.moveTo(edgeLeft, edgeTop);
        graphics.lineTo(edgeRight, edgeTop);
        graphics.lineTo(shore[shore.length - 1].x, shore[shore.length - 1].y);
        [...shore].reverse().forEach((point) => graphics.lineTo(point.x, point.y));
      }
      graphics.closePath();
      graphics.fillPath();
      [
        { width: 420, color: 0x0b6f82, alpha: 0.026 },
        { width: 230, color: 0xd7b86a, alpha: 0.042 },
        { width: 118, color: 0x8fd8dc, alpha: 0.058 },
        { width: 48, color: 0xe7d391, alpha: 0.105 },
        { width: 12, color: 0xe0f7ff, alpha: 0.13 }
      ].forEach((layer) => {
        graphics.lineStyle(layer.width, layer.color, layer.alpha);
        strokePolyline(shore);
      });
    };
    const drawWorldBoundaryBlend = () => {
      [
        { offset: -180, width: 520, color: 0x8fd8dc, alpha: 0.024 },
        { offset: 260, width: 900, color: 0x0b6f82, alpha: 0.048 },
        { offset: 980, width: 1500, color: 0x083d52, alpha: 0.068 }
      ].forEach((layer) => {
        graphics.lineStyle(layer.width, layer.color, layer.alpha);
        graphics.lineBetween(edgeLeft, WORLD_BOUNDS.height + layer.offset, edgeRight, WORLD_BOUNDS.height + layer.offset);
        graphics.lineBetween(edgeLeft, -layer.offset, edgeRight, -layer.offset);
        graphics.lineBetween(-layer.offset, edgeTop, -layer.offset, edgeBottom);
        graphics.lineBetween(WORLD_BOUNDS.width + layer.offset, edgeTop, WORLD_BOUNDS.width + layer.offset, edgeBottom);
      });
    };
    drawBoundedMapGraphics(edgeLeft, edgeTop, 4300, edgeBottom, () => {
      drawSmoothSea(
        [
          { x: 3600, y: 0 },
          { x: 2600, y: 900 },
          { x: 980, y: 3000 },
          { x: 1180, y: 6200 },
          { x: 2100, y: 10400 },
          { x: 1450, y: 16900 },
          { x: 2600, y: 22900 },
          { x: 1580, y: 27700 }
        ],
        "west"
      );
    });
    drawBoundedMapGraphics(edgeLeft, edgeTop, edgeRight, 1900, () => {
      drawSmoothSea(
        [
          { x: 0, y: 1260 },
          { x: 2500, y: 920 },
          { x: 5200, y: 760 },
          { x: 9000, y: 560 },
          { x: 13200, y: 740 },
          { x: 18500, y: 520 },
          { x: 23800, y: 820 },
          { x: 29600, y: 660 },
          { x: 36000, y: 860 },
          { x: 43000, y: 1120 },
          { x: WORLD_BOUNDS.width, y: 980 }
        ],
        "north"
      );
    });
    drawBoundedMapGraphics(edgeLeft, 26200, edgeRight, edgeBottom, () => {
      drawSmoothSea(
        [
          { x: 0, y: 29200 },
          { x: 7600, y: 28400 },
          { x: 15600, y: 28950 },
          { x: 23100, y: 28000 },
          { x: 31500, y: 26950 },
          { x: 38900, y: 28050 },
          { x: WORLD_BOUNDS.width, y: 26900 }
        ],
        "south"
      );
    });

    WORLD_MAP_REGIONS.forEach((region) => {
      drawRegionalMapGraphics(region.position, region.width * 1.45, region.height * 1.45, () => {
        const palette = biomePalette(region.kind);
        if (region.kind === "coast") {
          drawBiome(region.position.x, region.position.y, region.width * 0.82, region.height * 0.72, 0xc6a65c, 0.2, 0xfde68a, region.density ?? 70);
          return;
        }

        drawBiome(region.position.x, region.position.y, region.width, region.height, palette.color, palette.alpha, palette.accent, region.density ?? 70);
        if (region.kind === "forest" || region.kind === "darkForest") {
          drawForest(
            region.position.x,
            region.position.y,
            region.width * 0.92,
            region.height * 0.9,
            Math.min(fullWorldDetailSaver ? 42 : 110, Math.round((region.density ?? 120) * (fullWorldDetailSaver ? 0.24 : 0.62)))
          );
        }
        if (region.kind === "fire") {
          drawFireField(region.position.x, region.position.y, region.width * 0.74, region.height * 0.68, Math.min(fullWorldDetailSaver ? 28 : 70, Math.round((region.density ?? 70) * (fullWorldDetailSaver ? 0.24 : 0.58))));
        }
        if (region.kind === "grass" || region.kind === "swamp") {
          drawMeadowField(
            region.position.x,
            region.position.y,
            region.width * 0.9,
            region.height * 0.88,
            Math.min(fullWorldDetailSaver ? 16 : 30, Math.round((region.density ?? 70) * (fullWorldDetailSaver ? 0.14 : 0.24))),
            region.position.x * 0.013 + region.position.y * 0.007
          );
        }
      });
    });

    WORLD_RIVERS.forEach((river, index) => {
      const bounds = mapBoundsForPoints(river.points, (river.width ?? 82) + 180);
      drawBoundedMapGraphics(bounds.left, bounds.top, bounds.right, bounds.bottom, () => drawWaterRoute(river.points, river.width ?? 82, index));
    });
    WORLD_LAKES.forEach((lake) => {
      drawRegionalMapGraphics(lake.position, lake.width + 150, lake.height + 96, () => {
        graphics.fillStyle(0xd6a956, 0.18);
        graphics.fillEllipse(lake.position.x, lake.position.y, lake.width + 150, lake.height + 96);
        graphics.fillStyle(0x9fe3ec, 0.2);
        graphics.fillEllipse(lake.position.x, lake.position.y, lake.width + 54, lake.height + 34);
        graphics.fillStyle(0x54b7cf, 0.98);
        graphics.fillEllipse(lake.position.x, lake.position.y, lake.width, lake.height);
        graphics.fillStyle(0xc7f9ff, 0.12);
        graphics.fillEllipse(lake.position.x - lake.width * 0.15, lake.position.y - lake.height * 0.14, lake.width * 0.36, lake.height * 0.16);
        for (let wave = 0; wave < 3; wave += 1) {
          const y = lake.position.y + lake.height * (-0.12 + wave * 0.12);
          const length = lake.width * (0.28 + wave * 0.07);
          graphics.lineStyle(3, 0xe0f7ff, 0.08 - wave * 0.01);
          graphics.lineBetween(lake.position.x - length * 0.5, y, lake.position.x + length * 0.5, y + lake.height * 0.012);
        }
      });
    });
    WORLD_WATERFALLS.forEach((fall, index) =>
      drawRegionalMapGraphics(fall.position, fall.width * 2, fall.height * 2, () => drawWaterfall(fall, index))
    );
    WORLD_SCENIC_DETAILS.forEach((detail, index) =>
      drawRegionalMapGraphics(detail.position, detail.radius * 2, detail.radius * 1.5, () => drawScenicDetail(detail, index))
    );
    drawRegionalMapGraphics({ x: 3150, y: 3400 }, 5600, 3400, drawGreenhillHuntingMeadow, 420);
    drawRegionalMapGraphics(WORLD_STARTER_ARENA.center, (WORLD_STARTER_ARENA.radius + 360) * 2.25, (WORLD_STARTER_ARENA.radius + 360) * 2.05, drawStarterArenaGroundBlend);
    WORLD_MOUNTAINS.forEach((mountain, index) => {
      const size = mountain.size * 18;
      drawRegionalMapGraphics(mountain.position, size * 2.2, size * 1.8, () => {
        this.drawMountainShape(graphics, mountain.position.x, mountain.position.y, size, index * 3.9 + 0.6);
      });
    });
    CITY_DEFINITIONS.forEach((city) =>
      drawRegionalMapGraphics(city.position, city.safeRadius * 2.8, city.safeRadius * 2.2, () => drawTown(city), 360)
    );

    const roadWidth = 62;
    const roadStyles = [
      { widthOffset: 8, fill: 0xc5cdd0, shoulder: 0x8f9da1, edge: 0x46525a, patch: 0x9ca3af, mark: 0xffffff, stone: 0xe5e7eb, mode: "cobble" as const },
      { widthOffset: 4, fill: 0xd5a24f, shoulder: 0xc58f3a, edge: 0x7a4f22, patch: 0xe9c46d, mark: 0xfce7a6, stone: 0xf6d59d, mode: "sand" as const },
      { widthOffset: 2, fill: 0x5b477b, shoulder: 0x35265c, edge: 0x1e1439, patch: 0x7c3aed, mark: 0xc4b5fd, stone: 0xa78bfa, mode: "void" as const },
      { widthOffset: 10, fill: 0x8b6c45, shoulder: 0x6d4d2d, edge: 0x332316, patch: 0xb78b52, mark: 0xf6d59d, stone: 0xd6a15d, mode: "dirt" as const },
      { widthOffset: 3, fill: 0xdce9ef, shoulder: 0x9fb8c6, edge: 0x526b78, patch: 0xcbd5e1, mark: 0xffffff, stone: 0xf8fafc, mode: "snow" as const },
      { widthOffset: 8, fill: 0x8a3a21, shoulder: 0x5a2417, edge: 0x1c0a07, patch: 0xb45309, mark: 0xf97316, stone: 0xfacc15, mode: "ash" as const },
      { widthOffset: 4, fill: 0x4c3a68, shoulder: 0x2f2546, edge: 0x150f24, patch: 0x8b5cf6, mark: 0xddd6fe, stone: 0xc084fc, mode: "void" as const },
      { widthOffset: -2, fill: 0x6b8c43, shoulder: 0x496331, edge: 0x203718, patch: 0x86efac, mark: 0xbbf7d0, stone: 0x9cc35f, mode: "forest" as const }
    ];
    const roadRoutes = WORLD_ROADS.map((road, index) => {
      const points = [...road.points];
      const style = road.id === "north-road"
          ? roadStyles[4]
          : road.id === "rift-road" || road.id === "blackroot-road" || road.id === "mist-road"
            ? roadStyles[6]
            : road.id === "harbor-road" || road.id === "brook-trail"
              ? roadStyles[1]
              : roadStyles[index % roadStyles.length];
      return {
        id: road.id,
        points,
        samples: sampleCurve(points, fullWorldDetailSaver ? 14 : 26),
        width: points.length > 0 ? (road.width ?? roadWidth) + style.widthOffset : roadWidth + style.widthOffset,
        fill: style.fill,
        shoulder: style.shoulder,
        edge: style.edge,
        patch: style.patch,
        mark: style.mark,
        stone: style.stone,
        mode: style.mode
      };
    });
    roadRoutes.forEach((road, routeIndex) => {
      const bounds = mapBoundsForPoints(road.samples, road.width + 120);
      drawBoundedMapGraphics(bounds.left, bounds.top, bounds.right, bounds.bottom, () => drawRoadNetwork([road], routeIndex));
    });
    const segmentIntersection = (roadStart: Vector2, roadEnd: Vector2, waterStart: Vector2, waterEnd: Vector2) => {
      const roadDx = roadEnd.x - roadStart.x;
      const roadDy = roadEnd.y - roadStart.y;
      const waterDx = waterEnd.x - waterStart.x;
      const waterDy = waterEnd.y - waterStart.y;
      const denominator = roadDx * waterDy - roadDy * waterDx;
      if (Math.abs(denominator) < 0.001) {
        return undefined;
      }

      const toWaterX = waterStart.x - roadStart.x;
      const toWaterY = waterStart.y - roadStart.y;
      const roadT = (toWaterX * waterDy - toWaterY * waterDx) / denominator;
      const waterT = (toWaterX * roadDy - toWaterY * roadDx) / denominator;
      if (roadT < 0.001 || roadT > 0.999 || waterT < 0.001 || waterT > 0.999) {
        return undefined;
      }

      return {
        point: { x: roadStart.x + roadDx * roadT, y: roadStart.y + roadDy * roadT },
        roadAngle: Math.atan2(roadDy, roadDx),
        waterAngle: Math.atan2(waterDy, waterDx)
      };
    };
    const closestPointOnSegmentLocal = (point: Vector2, start: Vector2, end: Vector2) => {
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const lengthSq = dx * dx + dy * dy;
      if (lengthSq <= 0) {
        return {
          point: start,
          distance: Phaser.Math.Distance.Between(point.x, point.y, start.x, start.y)
        };
      }
      const t = Phaser.Math.Clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq, 0, 1);
      const closest = { x: start.x + dx * t, y: start.y + dy * t };
      return {
        point: closest,
        distance: Phaser.Math.Distance.Between(point.x, point.y, closest.x, closest.y)
      };
    };
    const drawnBridges: Vector2[] = [];
    const drawBridgeOnce = (point: Vector2, roadAngle: number, waterAngle: number, waterWidth: number, bridgeRoadWidth: number) => {
      if (drawnBridges.some((bridge) => Phaser.Math.Distance.Between(bridge.x, bridge.y, point.x, point.y) < 680)) {
        return;
      }
      const angleCross = Math.abs(Math.sin(roadAngle - waterAngle));
      if (angleCross < 0.44) {
        return;
      }
      const bridgeLength = Phaser.Math.Clamp((waterWidth + 86) / Math.max(0.56, angleCross) + 34, 240, 390);
      const bridgeWidth = Phaser.Math.Clamp(bridgeRoadWidth + 24, 78, 112);
      drawBridge(point.x, point.y, roadAngle, bridgeLength, bridgeWidth);
      drawnBridges.push(point);
    };
    for (const road of roadRoutes) {
      for (let roadIndex = 0; roadIndex < road.samples.length - 1; roadIndex += 1) {
        const roadStart = road.samples[roadIndex];
        const roadEnd = road.samples[roadIndex + 1];
        const roadAngle = Math.atan2(roadEnd.y - roadStart.y, roadEnd.x - roadStart.x);
        for (const water of waterRoutes) {
          for (let waterIndex = 0; waterIndex < water.samples.length - 1; waterIndex += 1) {
            const waterStart = water.samples[waterIndex];
            const waterEnd = water.samples[waterIndex + 1];
            const waterAngle = Math.atan2(waterEnd.y - waterStart.y, waterEnd.x - waterStart.x);
            const hit = segmentIntersection(roadStart, roadEnd, waterStart, waterEnd);
            if (hit) {
              drawBridgeOnce(hit.point, hit.roadAngle, hit.waterAngle, water.width, road.width);
              continue;
            }

            const midpoint = {
              x: (roadStart.x + roadEnd.x) / 2,
              y: (roadStart.y + roadEnd.y) / 2
            };
            const closest = closestPointOnSegmentLocal(midpoint, waterStart, waterEnd);
            const angleCross = Math.abs(Math.sin(roadAngle - waterAngle));
            if (closest.distance < water.width * 0.34 + road.width * 0.12 && angleCross > 0.62) {
              drawBridgeOnce(closest.point, roadAngle, waterAngle, water.width, road.width);
            }
          }
        }
      }
    }

    drawBoundedMapGraphics(edgeLeft, edgeTop, edgeRight, edgeBottom, drawWorldBoundaryBlend);
    CITY_DEFINITIONS.forEach((city) =>
      drawRegionalMapGraphics(city.position, city.safeRadius * 1.3, city.safeRadius, () => drawTownPlaza(city), 220)
    );
    CITY_DEFINITIONS.forEach((city) => drawCheckpointFire(city));
    CITY_DEFINITIONS.forEach((city) => drawCityServices(city));
    drawRegionalMapGraphics(WORLD_STARTER_ARENA.center, WORLD_STARTER_ARENA_WALL_RADIUS * 2.2, WORLD_STARTER_ARENA_WALL_RADIUS * 2.2, drawStarterArena, 340);
    WORLD_OBSTACLES.forEach((obstacle) => drawWorldObstacle(obstacle));
    WORLD_LANDMARKS.forEach((landmark) => {
      if (landmark.id !== "blood-ring") {
        drawRegionalMapGraphics(landmark.position, landmark.radius * 2.4, landmark.radius * 2.4, () => drawLandmark(landmark), 260);
      }
    });
    WORLD_HAZARDS.forEach((hazard) => drawWorldHazard(hazard));
    [
      { x: 7200, y: 4100, label: "Sunspire", rotation: 0.08 },
      { x: 7600, y: 5420, label: "Wayfarer Stones", rotation: -0.08 },
      { x: 12600, y: 6900, label: "Riftwatch", rotation: 0.12 },
      { x: 8750, y: 2460, label: "Frosthold", rotation: -0.08 },
      { x: 10380, y: 1260, label: "Deep Gate", rotation: -0.1 },
      { x: 10520, y: 12840, label: "Southreach Orchard", rotation: 0.1 },
      { x: 14720, y: 13280, label: "Southreach / Blackroot", rotation: 0.12 },
      { x: 19860, y: 10780, label: "Crownroad Camp", rotation: -0.08 },
      { x: 20220, y: 5870, label: "Coast / North", rotation: 0.2 },
      { x: 23280, y: 8320, label: "Crownspire", rotation: -0.04 },
      { x: 23620, y: 12740, label: "Starfall / Forge", rotation: -0.18 },
      { x: 32680, y: 4940, label: "Skyreach", rotation: 0.14 },
      { x: 37140, y: 18180, label: "Ashen Forge", rotation: -0.12 }
    ].forEach((sign) => drawRoadSign(sign.x, sign.y, sign.label, sign.rotation));

    this.add.circle(WORLD_BOUNDS.town.x + 165, WORLD_BOUNDS.town.y - 70, 16, 0xfacc15, 1).setDepth(4);
    this.add
      .text(WORLD_BOUNDS.town.x + 165, WORLD_BOUNDS.town.y - 100, this.tr("Warden"), {
        color: "#fef3c7",
        fontFamily: "Inter, sans-serif",
        fontSize: "12px"
      })
      .setOrigin(0.5);

    const nearestRoadSegment = (point: Vector2) => {
      let nearest: { distance: number; angle: number } | undefined;
      for (const road of WORLD_ROADS) {
        for (let index = 0; index < road.points.length - 1; index += 1) {
          const start = road.points[index];
          const end = road.points[index + 1];
          const dx = end.x - start.x;
          const dy = end.y - start.y;
          const lengthSq = dx * dx + dy * dy;
          if (lengthSq <= 0) {
            continue;
          }
          const t = Phaser.Math.Clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq, 0, 1);
          const projected = { x: start.x + dx * t, y: start.y + dy * t };
          const distance = Phaser.Math.Distance.Between(point.x, point.y, projected.x, projected.y);
          if (!nearest || distance < nearest.distance) {
            nearest = { distance, angle: Math.atan2(dy, dx) };
          }
        }
      }
      return nearest;
    };

    this.updateStaticMapGraphicsLayers(0, true);
    this.createDungeonInteriorViews();
    this.createWorldOverlayUi();
  }

  private createDungeonInteriorViews(): void {
    const dungeonByLandmark = new Map(WORLD_DUNGEON_INTERIORS.map((dungeon) => [dungeon.landmarkId, dungeon]));
    const addPortal = (
      id: string,
      position: Vector2,
      label: string,
      color: number,
      activate: () => void,
      depth = 8.35
    ) => {
      this.add.circle(position.x, position.y, 118, color, 0.08).setStrokeStyle(4, color, 0.22).setDepth(depth - 0.08);
      const portal = this.add.circle(position.x, position.y, 54, color, 0.22).setStrokeStyle(3, 0xf8fafc, 0.48).setDepth(depth);
      portal
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
          event.stopPropagation();
          activate();
        });
      this.add
        .text(position.x, position.y - 94, this.tr(label), {
          color: "#f8fafc",
          fontFamily: "Inter, sans-serif",
          fontSize: "12px",
          fontStyle: "800",
          stroke: "#020617",
          strokeThickness: 4
        })
        .setOrigin(0.5)
        .setDepth(depth + 0.08);
      this.dungeonPortalViews.set(id, portal);
    };

    WORLD_LANDMARKS.forEach((landmark) => {
      const dungeon = dungeonByLandmark.get(landmark.id);
      if (!dungeon) {
        return;
      }
      addPortal(
        `dungeon-entrance-${landmark.id}`,
        { x: landmark.position.x, y: landmark.position.y + 56 },
        "Enter",
        0xa78bfa,
        () => this.handleDungeonAction({
          mode: "enter",
          landmarkId: landmark.id,
          position: { x: landmark.position.x, y: landmark.position.y + 56 }
        })
      );
    });

    WORLD_DUNGEON_INTERIORS.forEach((dungeon, dungeonIndex) => {
      const graphics = this.add.graphics().setDepth(-8.94);
      const seed = dungeon.position.x * 0.001 + dungeonIndex * 0.83;
      graphics.fillStyle(0x020617, 0.72);
      graphics.fillEllipse(dungeon.position.x, dungeon.position.y, dungeon.width, dungeon.height);
      graphics.lineStyle(12, 0x4c1d95, 0.38);
      graphics.strokeEllipse(dungeon.position.x, dungeon.position.y, dungeon.width, dungeon.height);
      graphics.lineStyle(5, 0x67e8f9, 0.18);
      graphics.lineBetween(dungeon.start.x, dungeon.start.y, dungeon.position.x, dungeon.position.y);
      graphics.lineBetween(dungeon.position.x, dungeon.position.y, dungeon.end.x, dungeon.end.y);
      graphics.fillStyle(0x312e81, 0.18);
      graphics.fillEllipse(dungeon.position.x, dungeon.position.y, dungeon.width * 0.46, dungeon.height * 0.34);
      for (let index = 0; index < 10; index += 1) {
        const angle = (index / 10) * Math.PI * 2 + seed;
        const radiusX = dungeon.width * (0.22 + (index % 3) * 0.055);
        const radiusY = dungeon.height * (0.2 + (index % 2) * 0.06);
        const x = dungeon.position.x + Math.cos(angle) * radiusX;
        const y = dungeon.position.y + Math.sin(angle) * radiusY;
        this.add
          .image(x, y, index % 2 === 0 ? "decor-rune" : "decor-crystal")
          .setScale(index % 2 === 0 ? 0.58 : 0.46)
          .setRotation(angle * 0.18)
          .setAlpha(0.72)
          .setDepth(6.32 + y * 0.0001);
      }
      for (let index = 0; index < 5; index += 1) {
        const x = dungeon.position.x - dungeon.width * 0.38 + index * dungeon.width * 0.19;
        const y = dungeon.position.y + Math.sin(seed + index) * dungeon.height * 0.18;
        this.add
          .rectangle(x, y, 260, 9, 0x67e8f9, 0.2)
          .setRotation(seed + index * 0.7)
          .setDepth(7.05)
          .setBlendMode(Phaser.BlendModes.ADD);
      }
      this.add
        .text(dungeon.position.x, dungeon.position.y - dungeon.height * 0.55, this.tr(dungeon.label), {
          color: "#ddd6fe",
          fontFamily: "Inter, sans-serif",
          fontSize: "13px",
          fontStyle: "900",
          stroke: "#020617",
          strokeThickness: 5
        })
        .setOrigin(0.5)
        .setDepth(7.2);

      addPortal(
        `dungeon-start-exit-${dungeon.id}`,
        dungeon.start,
        "Exit",
        0x67e8f9,
        () => this.handleDungeonAction({ mode: "exit", dungeonId: dungeon.id, exit: "start", position: dungeon.start }),
        8.45
      );
      addPortal(
        `dungeon-end-exit-${dungeon.id}`,
        dungeon.end,
        "Exit",
        0xfacc15,
        () => this.handleDungeonAction({ mode: "exit", dungeonId: dungeon.id, exit: "end", position: dungeon.end }),
        8.45
      );
    });
  }

  private createWorldOverlayUi(): void {
    this.eventText = this.add
      .text(16, 16, "", {
        color: "#e5e7eb",
        fontFamily: "Inter, sans-serif",
        fontSize: "14px",
        backgroundColor: "#00000070",
        padding: { x: 8, y: 6 }
      })
      .setScrollFactor(0)
      .setDepth(100)
      .setVisible(false);
    this.updateSystemLogLayout();

    this.pkModeText = this.add
      .text(this.scale.width / 2, 18, this.tr("PK: attack players"), {
        color: "#fecaca",
        fontFamily: "Inter, sans-serif",
        fontSize: "14px",
        backgroundColor: "#7f1d1dcc",
        padding: { x: 10, y: 6 }
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(101)
      .setVisible(false);

    this.attackRangeRing = this.add
      .circle(0, 0, CLASS_DEFINITIONS.warrior.attackRange, 0xf8fafc, 0)
      .setStrokeStyle(1, 0xf8fafc, 0.1)
      .setVisible(false)
      .setDepth(6);
  }

  private createMobileWorldFeatureViews(): void {
    const serviceLabel = (x: number, y: number, label: string, color: string, depth = 8.55) => {
      this.add
        .text(x, y, this.tr(label), {
          color,
          fontFamily: "Inter, sans-serif",
          fontSize: "11px",
          backgroundColor: "#00000073",
          padding: { x: 5, y: 3 }
        })
        .setOrigin(0.5)
        .setDepth(depth);
    };
    const mobileCheckpointFire = (city: (typeof CITY_DEFINITIONS)[number]) => {
      const isHub = city.id === "greenhill";
      const scale = isHub ? 1.04 : Phaser.Math.Clamp(city.safeRadius / 460, 0.66, 0.9);
      const x = city.position.x;
      const y = city.position.y + (isHub ? 30 : 22);
      this.add.ellipse(x, y + 18 * scale, 132 * scale, 48 * scale, 0x050807, 0.3).setDepth(7.05);
      const aura = this.add
        .ellipse(x, y + 2 * scale, 154 * scale, 104 * scale, 0xf97316, 0.09)
        .setStrokeStyle(3, 0xfacc15, 0.16)
        .setDepth(7.08);
      const glow = this.add.ellipse(x, y - 4 * scale, 92 * scale, 76 * scale, 0xf97316, 0.21).setDepth(7.1);
      this.add.rectangle(x - 21 * scale, y + 31 * scale, 56 * scale, 11 * scale, 0x3b2414, 0.96).setRotation(-0.34).setDepth(7.12);
      this.add.rectangle(x + 21 * scale, y + 31 * scale, 56 * scale, 11 * scale, 0x2a180c, 0.96).setRotation(0.34).setDepth(7.12);
      const flame = this.add.image(x, y - 8 * scale, "decor-fire").setScale(scale * 0.66).setDepth(7.2);
      const sparkA = this.add.circle(x - 20 * scale, y - 54 * scale, 4.5 * scale, 0xfacc15, 0.78).setDepth(7.24);
      const sparkB = this.add.circle(x + 25 * scale, y - 40 * scale, 3.8 * scale, 0xffedd5, 0.64).setDepth(7.24);
      this.checkpointFires.set(city.id, {
        aura,
        glow,
        flame,
        sparkA,
        sparkB,
        baseScale: scale,
        seed: city.recommendedLevel * 0.73 + city.position.x * 0.002
      });
    };
    const mobileCityProps = (city: (typeof CITY_DEFINITIONS)[number]) => {
      const isHub = city.id === "greenhill";
      const isGrandCapital = city.id === "crownspire";
      const visualRadius = Math.min(
        city.safeRadius * 0.72,
        Math.max(
          city.kind === "harbor"
            ? 280
            : city.kind === "village" || city.kind === "fortress"
              ? 245
              : city.kind === "sanctum"
                ? 225
                : city.kind === "outpost"
                  ? 180
                  : 0,
          city.safeRadius *
            (isGrandCapital
              ? 0.56
              : isHub
                ? 0.46
                : city.kind === "harbor"
                  ? 0.56
                  : city.kind === "fortress"
                    ? 0.54
                    : city.kind === "village" || city.kind === "sanctum"
                      ? 0.52
                      : 0.46)
        )
      );
      const radiusX = visualRadius * (isHub || isGrandCapital ? 0.72 : 0.68);
      const radiusY = visualRadius * (isHub || isGrandCapital ? 0.46 : 0.43);
      const propCount = isHub || isGrandCapital ? 9 : 5;
      const houseTextures = ["city-house", "city-house-blue", "city-house-green", "city-house-stone"] as const;
      for (let index = 0; index < propCount; index += 1) {
        const angle = (index / propCount) * Math.PI * 2 + (city.position.x % 37) * 0.004;
        const x = city.position.x + Math.cos(angle) * radiusX;
        const y = city.position.y + Math.sin(angle) * radiusY;
        const texture =
          city.kind === "harbor" && index === propCount - 1
            ? "city-dock"
            : city.kind === "sanctum" && index === 0
              ? "decor-safe-shrine"
              : city.kind === "outpost" && index === propCount - 1
                ? "city-tent"
                : houseTextures[(index + city.recommendedLevel) % houseTextures.length];
        const scale =
          texture === "city-dock"
            ? 0.5
            : texture === "decor-safe-shrine"
              ? 0.52
              : texture === "city-tent"
                ? 0.48
                : isHub || isGrandCapital
                  ? 0.54
                  : 0.48;
        this.add
          .image(x, y, texture)
          .setRotation(texture === "city-dock" ? angle + Math.PI / 2 : angle * 0.08)
          .setScale(scale)
          .setAlpha(0.82)
          .setDepth(6.36 + y * 0.00014);
      }
    };

    CITY_DEFINITIONS.forEach((city) => {
      mobileCityProps(city);
      mobileCheckpointFire(city);
      const merchant = CITY_MERCHANTS.find((candidate) => candidate.cityId === city.id);
      const teleporter = CITY_TELEPORTERS.find((candidate) => candidate.cityId === city.id);
      if (merchant) {
        const { x, y } = merchant.position;
        const scale = city.id === "greenhill" ? 0.96 : 0.82;
        this.add.ellipse(x, y + 18, merchant.radius * 0.78, merchant.radius * 0.34, 0xfacc15, 0.055).setStrokeStyle(2, 0xfacc15, 0.14).setDepth(7.42);
        this.add
          .image(x, y, "npc-merchant")
          .setScale(scale)
          .setDepth(8)
          .setInteractive({ useHandCursor: true })
          .on("pointerdown", (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
            event.stopPropagation();
            if (this.isInputBlocked()) {
              return;
            }
            this.clickMoveTarget = undefined;
            this.moveMarker?.setVisible(false);
            window.dispatchEvent(new CustomEvent("mmo:openShop", { detail: { cityId: city.id } }));
            this.playUiOpenSound("shop");
          });
        serviceLabel(x, y - 72, "Merchant", "#fef3c7");
      }

      if (teleporter) {
        const { x, y } = teleporter.position;
        const isTradeZone = city.id === "market";
        const gateScale = city.id === "greenhill" ? 0.96 : 0.82;
        const gate = this.add
          .image(x, y - 10, "city-teleporter")
          .setScale(gateScale)
          .setDepth(8.05)
          .setInteractive({ useHandCursor: true })
          .on("pointerdown", (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
            event.stopPropagation();
            if (this.isInputBlocked()) {
              return;
            }
            this.clickMoveTarget = undefined;
            this.moveMarker?.setVisible(false);
            window.dispatchEvent(new CustomEvent("mmo:openTeleportMenu", { detail: { cityId: city.id } }));
            this.playUiOpenSound("gate");
          });
        if (isTradeZone) {
          gate.setTint(0x34d399);
        }
        gate.setData("baseScale", gateScale);
        this.add
          .circle(x, y - 12, teleporter.radius * 0.22, isTradeZone ? 0x22c55e : 0x7c3aed, isTradeZone ? 0.2 : 0.13)
          .setStrokeStyle(3, isTradeZone ? 0xfacc15 : 0x67e8f9, isTradeZone ? 0.4 : 0.32)
          .setDepth(7.72);
        this.teleportViews.set(
          teleporter.id,
          this.add
            .circle(x, y - 12, teleporter.radius * 0.1, isTradeZone ? 0xfacc15 : 0xc4b5fd, isTradeZone ? 0.48 : 0.42)
            .setStrokeStyle(2, isTradeZone ? 0xbbf7d0 : 0xf8fafc, isTradeZone ? 0.62 : 0.52)
            .setDepth(8.2)
        );
        serviceLabel(x, y - 92, isTradeZone ? "Trade Gate" : "Gate", isTradeZone ? "#bbf7d0" : "#ddd6fe");
      }
    });

    WORLD_LANDMARKS.forEach((landmark) => {
      if (landmark.id === "blood-ring") {
        return;
      }
      const { x, y } = landmark.position;
      const color =
        landmark.kind === "boss"
          ? 0xef4444
          : landmark.kind === "dungeon" || landmark.kind === "cave"
            ? 0xa78bfa
            : landmark.kind === "harbor" || landmark.kind === "ship"
              ? 0x38bdf8
              : landmark.kind === "graveyard" || landmark.kind === "ruins"
                ? 0xd1d5db
                : 0xfacc15;
      const radius = Phaser.Math.Clamp(landmark.radius * 0.22, 54, 120);
      this.add.circle(x, y, radius * 1.7, color, landmark.kind === "boss" ? 0.11 : 0.065).setStrokeStyle(4, color, landmark.kind === "boss" ? 0.34 : 0.2).setDepth(6.58);
      if (landmark.kind === "dungeon" || landmark.kind === "cave") {
        this.add.ellipse(x, y + 12, radius * 2.15, radius * 1.68, 0x1f2937, 0.9).setStrokeStyle(3, 0x64748b, 0.26).setDepth(6.64);
        this.add.ellipse(x, y + 28, radius * 0.9, radius * 0.72, 0x020617, 0.98).setStrokeStyle(3, color, 0.55).setDepth(6.66);
        this.add.image(x - radius * 1.05, y + radius * 0.42, "decor-crystal").setScale(0.46).setRotation(-0.08).setDepth(6.72);
        this.add.image(x + radius * 1.02, y + radius * 0.5, "decor-stalagmite").setScale(0.5).setRotation(0.07).setDepth(6.72);
      } else if (landmark.kind === "boss") {
        this.add.circle(x, y, radius * 0.72, 0x7f1d1d, 0.82).setStrokeStyle(5, 0xf97316, 0.45).setDepth(6.66);
        this.add.ellipse(x, y - radius * 0.12, radius * 0.62, radius * 1.08, 0xf97316, 0.58).setStrokeStyle(3, 0xfacc15, 0.28).setDepth(6.68);
        this.add.image(x - radius * 1.18, y + radius * 0.7, "decor-fire").setScale(0.54).setDepth(6.73);
        this.add.image(x + radius * 1.2, y + radius * 0.72, "decor-fire").setScale(0.54).setDepth(6.73);
      } else if (landmark.kind === "ship" || landmark.kind === "harbor") {
        this.add.rectangle(x, y + 18, radius * 1.55, radius * 0.34, 0x7c4a25, 0.86).setDepth(6.66);
        this.add.ellipse(x + radius * 0.18, y - radius * 0.28, radius * 0.72, radius * 0.92, 0xfef3c7, 0.28).setDepth(6.68);
        this.add.image(x - radius * 1.05, y + radius * 0.9, "city-dock").setScale(0.5).setRotation(-0.05).setDepth(6.63);
        this.add.image(x + radius * 1.12, y + radius * 0.92, "decor-wave").setScale(0.54).setDepth(6.62);
      } else if (landmark.kind === "graveyard") {
        this.add.circle(x, y, radius * 0.62, color, 0.48).setDepth(6.66);
        this.add.image(x - radius * 0.82, y + radius * 0.36, "decor-grave").setScale(0.58).setRotation(-0.08).setDepth(6.72);
        this.add.image(x + radius * 0.82, y + radius * 0.42, "decor-bone").setScale(0.58).setRotation(0.16).setDepth(6.72);
      } else if (landmark.kind === "ruins") {
        this.add.circle(x, y, radius * 0.62, color, 0.48).setDepth(6.66);
        this.add.image(x - radius * 0.9, y + radius * 0.34, "decor-ruin").setScale(0.58).setRotation(-0.08).setDepth(6.72);
        this.add.image(x + radius * 0.82, y + radius * 0.48, "decor-ruin").setScale(0.5).setRotation(0.12).setDepth(6.72);
      } else if (landmark.kind === "camp") {
        this.add.ellipse(x, y + radius * 0.35, radius * 1.8, radius * 0.72, 0x3f2d1c, 0.48).setDepth(6.64);
        this.add.circle(x, y + radius * 0.36, radius * 0.26, 0xf97316, 0.5).setDepth(6.67);
        this.add.image(x - radius * 0.82, y + radius * 0.34, "city-tent").setScale(0.58).setRotation(-0.08).setDepth(6.72);
        this.add.image(x + radius * 0.82, y + radius * 0.42, "city-tent").setScale(0.54).setRotation(0.08).setDepth(6.72);
        this.add.image(x, y - radius * 0.3, "decor-lamp").setScale(0.5).setDepth(6.74);
      } else {
        this.add.circle(x, y, radius * 0.62, color, 0.52).setDepth(6.66);
      }
      this.add
        .text(x, y - radius * 1.95, this.tr(landmark.label), {
          color: "#f8fafc",
          fontFamily: "Inter, sans-serif",
          fontSize: landmark.kind === "boss" ? "13px" : "11px",
          backgroundColor: "#00000066",
          padding: { x: 5, y: 2 }
        })
        .setOrigin(0.5)
        .setAlpha(0.82)
        .setDepth(7.2);
    });

    WORLD_OBSTACLES.forEach((obstacle) => {
      const color = obstacle.kind === "treeLine" ? 0x1f4f2b : 0x64748b;
      this.add
        .ellipse(obstacle.position.x, obstacle.position.y, obstacle.radiusX * 2, obstacle.radiusY * 2, color, obstacle.kind === "treeLine" ? 0.42 : 0.34)
        .setRotation(obstacle.rotation)
        .setStrokeStyle(3, obstacle.kind === "treeLine" ? 0x0f2f18 : 0xd1d5db, 0.2)
        .setDepth(5.9);
    });

    [
      { x: 7200, y: 4100, label: "Sunspire", rotation: 0.08 },
      { x: 7600, y: 5420, label: "Wayfarer", rotation: -0.08 },
      { x: 12600, y: 6900, label: "Riftwatch", rotation: 0.12 },
      { x: 8750, y: 2460, label: "Frosthold", rotation: -0.08 },
      { x: 10380, y: 1260, label: "Deep Gate", rotation: -0.1 },
      { x: 10520, y: 12840, label: "Orchard", rotation: 0.1 },
      { x: 20220, y: 5870, label: "Coast / North", rotation: 0.2 },
      { x: 19860, y: 10780, label: "Crownroad", rotation: -0.08 },
      { x: 23620, y: 12740, label: "Starfall / Forge", rotation: -0.18 },
      { x: 32680, y: 4940, label: "Skyreach", rotation: 0.14 },
      { x: 37140, y: 18180, label: "Ashen Forge", rotation: -0.12 }
    ].forEach((sign) => {
      this.add.image(sign.x, sign.y, "road-signpost").setRotation(sign.rotation).setScale(0.56).setAlpha(0.76).setDepth(6.2);
      this.add
        .text(sign.x, sign.y - 34, this.tr(sign.label), {
          color: "#fef3c7",
          fontFamily: "Inter, sans-serif",
          fontSize: "10px",
          backgroundColor: "#1c120ba8",
          padding: { x: 4, y: 2 }
        })
        .setOrigin(0.5)
        .setAlpha(0.78)
        .setDepth(6.3);
    });

    WORLD_HAZARDS.forEach((hazard) => {
      const color = hazard.kind === "orbStream" ? 0xc4b5fd : 0xf97316;
      this.add
        .rectangle(hazard.position.x, hazard.position.y, hazard.width, hazard.height, color, 0.055)
        .setRotation(hazard.rotation)
        .setStrokeStyle(4, color, 0.22)
        .setDepth(6.05);
      this.add
        .text(hazard.position.x, hazard.position.y - hazard.height * 0.74, this.tr(hazard.label), {
          color: "#ddd6fe",
          fontFamily: "Inter, sans-serif",
          fontSize: "11px",
          backgroundColor: "#160d2dcc",
          padding: { x: 5, y: 2 }
        })
        .setOrigin(0.5)
        .setAlpha(0.72)
        .setDepth(6.2);
    });
  }

  private setupInput(): void {
    this.cursors = this.input.keyboard?.createCursorKeys();
    this.keys = this.input.keyboard?.addKeys("W,A,S,D,Q,E,O,F,ONE,TWO,THREE,FOUR,SHIFT,CTRL,SPACE") as Record<
      string,
      Phaser.Input.Keyboard.Key
    >;
    this.input.keyboard?.disableGlobalCapture();
    this.input.addPointer(3);
    this.input.setPollAlways();

    this.input.mouse?.disableContextMenu();
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.resumeAudio();
      if (this.isInputBlocked()) {
        touchDiag.phaserPointerDown("BLOCKED(ui)");
        return;
      }
      if (this.isTouchControl(pointer)) {
        touchDiag.phaserPointerDown("touchControl");
        return;
      }
      touchDiag.phaserPointerDown(`world id=${pointer.id}`);
      const aim = this.screenToWorldAim({ x: pointer.x, y: pointer.y });
      if (this.shouldIgnoreMobileWorldTap(aim.x, aim.y, pointer)) {
        this.clearMoveIntent();
        return;
      }
      if (this.isSecondaryPointerAction(pointer)) {
        this.preventPointerDefault(pointer);
        this.archerHoldPrimary = undefined;
        this.cancelArcherDraw();
        return;
      }
      this.lastPhaserWorldPointerDown = { x: pointer.x, y: pointer.y, at: this.time.now };
      this.cachePointerAim(pointer);
      if (this.beginArcherPrimaryHold(pointer, aim, this.shouldChargeArcherShot(pointer))) {
        return;
      }
      this.handlePrimaryClick(aim.x, aim.y, this.shouldChargeArcherShot(pointer));
    });
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => this.handlePointerMove(pointer));
    this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => this.handlePointerUp(pointer));

    this.input.keyboard?.on("keydown-E", (event: KeyboardEvent) => {
      if (!this.isInputBlocked()) {
        this.resumeAudio();
        if (this.localPlayer()?.classId !== "archer") {
          this.attackNearestTarget();
        }
      }
    });
    this.input.keyboard?.on("keydown-SPACE", (event: KeyboardEvent) => {
      if (this.isInputBlocked() || event.repeat) {
        return;
      }

      event.preventDefault();
      this.resumeAudio();
      this.triggerJump();
    });
    this.input.keyboard?.on("keydown-Q", (event: KeyboardEvent) => {
      if (!this.isInputBlocked() && !event.repeat) {
        event.preventDefault();
        this.resumeAudio();
        this.triggerRoll();
      }
    });
    this.input.keyboard?.on("keydown-CTRL", (event: KeyboardEvent) => {
      if (this.isInputBlocked() || event.repeat) {
        return;
      }

      event.preventDefault();
      this.resumeAudio();
      const now = this.time.now;
      if (now - this.lastCtrlPkTapAt <= 360) {
        this.pkModeLocked = !this.pkModeLocked;
        this.lastCtrlPkTapAt = -Infinity;
      } else {
        this.lastCtrlPkTapAt = now;
      }
      this.updatePkModeIndicator();
    });
    this.input.keyboard?.on("keyup-CTRL", (event: KeyboardEvent) => {
      event.preventDefault();
      this.updatePkModeIndicator();
    });

    this.setupWindowInputGuards();
  }

  private setupWindowInputGuards(): void {
    this.removeWindowInputGuards?.();

    const suspend = () => {
      this.suspendLocalInput();
      this.suspendWorldAudio();
    };
    const resume = () => {
      this.resumeLocalInput();
      this.resumeAudio();
    };
    const visibility = () => {
      if (document.hidden) {
        this.suspendLocalInput();
        this.suspendWorldAudio();
      } else {
        this.resumeLocalInput();
        this.resumeAudio();
      }
    };
    const contextMenu = (event: MouseEvent) => {
      if (!(event.target instanceof HTMLElement) || !event.target.closest("canvas, .gameHost, .playLayout")) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
    };

    window.addEventListener("blur", suspend);
    window.addEventListener("focus", resume);
    window.addEventListener("pagehide", suspend);
    window.addEventListener("contextmenu", contextMenu, true);
    document.addEventListener("visibilitychange", visibility);

    this.removeWindowInputGuards = () => {
      window.removeEventListener("blur", suspend);
      window.removeEventListener("focus", resume);
      window.removeEventListener("pagehide", suspend);
      window.removeEventListener("contextmenu", contextMenu, true);
      document.removeEventListener("visibilitychange", visibility);
    };

    this.events.once("shutdown", () => {
      this.removeWindowInputGuards?.();
      this.removeWindowInputGuards = undefined;
      this.clearWorldCursor();
    });
  }

  private startTouchDiagnostics(): void {
    if (!touchDiag.enabled) {
      return;
    }

    touchDiag.start();
    touchDiag.registerState("scene", () => {
      const active = document.activeElement;
      const pointers = [this.input.mousePointer, ...(this.input.manager?.pointers ?? [])].filter(Boolean);
      const down = pointers.filter((pointer) => pointer?.isDown).length;
      return {
        susp: this.inputSuspended ? 1 : 0,
        hid: document.hidden ? 1 : 0,
        uiF: this.uiFocused ? 1 : 0,
        blk: this.isInputBlocked() ? 1 : 0,
        act: active instanceof HTMLElement ? active.tagName.toLowerCase() : "-",
        joy: `${this.joystick?.pointerId ?? "-"}/${this.joystick?.nativeTouchId ?? "-"}`,
        aim: `${this.aimJoystick?.pointerId ?? "-"}/${this.aimJoystick?.nativeTouchId ?? "-"}`,
        tap: this.pendingNativeWorldTap ? `${this.pendingNativeWorldTap.id}${this.pendingNativeWorldTap.moved ? "m" : ""}` : "-",
        ptr: `${down}/${pointers.length}`
      };
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => touchDiag.stop());
  }

  private suspendLocalInput(): void {
    this.inputSuspended = true;
    this.resetLocalInputState();
    this.syncWorldCursor(false);
    this.sendInput(true);
  }

  private resumeLocalInput(): void {
    this.inputSuspended = document.hidden;
    this.lastLocalPredictionAt = 0;
    this.lastRemotePredictionAt = 0;
    this.resetLocalInputState();
    this.syncWorldCursor(this.worldCursorInteractive);
    this.sendInput(true);
  }

  private suspendWorldAudio(): void {
    this.suspendSingingAudioPlayback();
    this.stopBirdAmbientAudio();
    this.stopWorldMusic();
    if (this.audioContext && this.audioContext.state === "running") {
      void this.audioContext.suspend().catch(() => undefined);
    }
  }

  private resetLocalInputState(): void {
    this.input.keyboard?.resetKeys();
    this.clearMoveIntent();
    this.cancelArcherDraw();
    this.rollUntil = 0;
    this.rollBoost = false;
    this.latestPointerScreen = undefined;
    this.latestPointerAim = undefined;
    this.pendingNativeWorldTap = undefined;
    this.joystick && (this.joystick.pointerId = undefined);
    this.joystick && (this.joystick.nativeTouchId = undefined);
    this.joystick && (this.joystick.vector = { x: 0, y: 0 });
    this.aimJoystick && (this.aimJoystick.pointerId = undefined);
    this.aimJoystick && (this.aimJoystick.nativeTouchId = undefined);
    this.aimJoystick && (this.aimJoystick.vector = { x: 0, y: 0 });
    this.moveMarker?.setVisible(false);
  }

  private resetTouchOwnership(): void {
    this.pendingNativeWorldTap = undefined;
    this.joystick && (this.joystick.pointerId = undefined);
    this.joystick && (this.joystick.nativeTouchId = undefined);
    this.joystick && (this.joystick.vector = { x: 0, y: 0 });
    this.aimJoystick && (this.aimJoystick.pointerId = undefined);
    this.aimJoystick && (this.aimJoystick.nativeTouchId = undefined);
    this.aimJoystick && (this.aimJoystick.vector = { x: 0, y: 0 });
  }

  private refreshInputBounds(force = false): void {
    const now = performance.now();
    if (!force && now - this.lastInputBoundsRefreshPerfAt < 160) {
      return;
    }
    this.lastInputBoundsRefreshPerfAt = now;
    this.scale.updateBounds();
  }

  private syncTouchControls(): void {
    const visible = this.isMobileTouchMode();
    const sprintVisible = visible && this.localCanSprint();
    if (visible && (!this.joystick || !this.aimJoystick)) {
      this.createTouchControls();
    }

    this.joystick?.base.setVisible(visible);
    this.joystick?.thumb.setVisible(visible);
    this.joystick?.base.setAlpha(visible ? 0.46 : 0);
    this.joystick?.thumb.setAlpha(visible ? 0.76 : 0);
    this.aimJoystick?.base.setVisible(false);
    this.aimJoystick?.thumb.setVisible(false);
    this.aimJoystick?.base.setAlpha(0);
    this.aimJoystick?.thumb.setAlpha(0);
    this.attackButton?.setVisible(visible).setAlpha(visible ? 0.82 : 0);
    this.skillButton?.setVisible(visible).setAlpha(visible ? 0.78 : 0);
    this.jumpButton?.setVisible(sprintVisible).setAlpha(sprintVisible ? 0.78 : 0);
    this.pkButton?.setVisible(visible).setAlpha(visible ? 0.92 : 0);
    this.attackLabel?.setVisible(visible).setAlpha(visible ? 0.95 : 0);
    this.skillLabel?.setVisible(visible).setAlpha(visible ? 0.95 : 0);
    this.jumpLabel?.setVisible(sprintVisible).setAlpha(sprintVisible ? 0.95 : 0);
    this.pkLabel?.setVisible(visible).setAlpha(visible ? 0.95 : 0);
    if (!visible && this.joystick) {
      this.joystick.pointerId = undefined;
      this.joystick.nativeTouchId = undefined;
      this.joystick.vector = { x: 0, y: 0 };
    }
    if (!visible && this.aimJoystick) {
      this.aimJoystick.pointerId = undefined;
      this.aimJoystick.nativeTouchId = undefined;
      this.aimJoystick.vector = { x: 0, y: 0 };
    }
    this.updatePkButtonVisual();
    this.layoutTouchControls();
  }

  private isMobileTouchMode(): boolean {
    return this.mobileRuntime;
  }

  private isMobileJoystickMode(): boolean {
    return this.isMobileTouchMode();
  }

  setMobileGraphicsSettings(settings: MobileGraphicsSettings): void {
    const previousPreset = this.mobileGraphics.preset;
    const previousFpsLimit = this.mobileGraphics.fpsLimit;
    const previousWorldRange = this.mobileGraphics.worldRange;
    const previousWorldDecorations = this.mobileGraphics.worldDecorations;
    this.mobileGraphics = normalizeMobileGraphicsSettings(settings);
    if (previousWorldDecorations !== this.mobileGraphics.worldDecorations) {
      for (const view of this.decorations.values()) {
        view.destroy();
      }
      this.decorations.clear();
      this.lastDecorationViewport = undefined;
      this.lastDecorationUpdateAt = 0;
    }
    if (this.isMobileTouchMode()) {
      this.setMobileFpsLimit(this.mobileGraphics.fpsLimit);
      if (previousPreset !== this.mobileGraphics.preset || previousFpsLimit !== this.mobileGraphics.fpsLimit || previousWorldRange !== this.mobileGraphics.worldRange) {
        this.resetMobileRuntimeBudget();
      }
      if (!this.mobileGraphics.worldDecorations) {
        this.mobileScenery?.clear();
        for (const view of this.decorations.values()) {
          view.destroy();
        }
        this.decorations.clear();
      }
    }
  }

  private resetMobileRuntimeBudget(): void {
    this.lastMobilePerfFrameAt = 0;
    this.mobileSlowFrameScore = 0;
    this.mobileLeanRuntime = false;
    this.mobileSustainedLeanRuntime = false;
    this.mobileDeepSustainRuntime = false;
  }

  private isMobileCoolGraphics(): boolean {
    return this.mobileGraphics.preset === "cool" || this.mobileGraphics.preset === "minimal" || this.mobileGraphics.fpsLimit <= 45;
  }

  private isMobileMinimalGraphics(): boolean {
    return this.mobileGraphics.preset === "minimal" || this.mobileGraphics.fpsLimit <= 30;
  }

  private isMobileDesktopGraphics(): boolean {
    return this.mobileGraphics.preset === "desktop" || this.mobileGraphics.preset === "full60";
  }

  private isMobileHighFullPlusGraphics(): boolean {
    return this.mobileGraphics.preset === "highFullPlus";
  }

  private isMobileHighFullGraphics(): boolean {
    return this.mobileGraphics.preset === "highFullPlus" || this.mobileGraphics.preset === "highFull" || this.mobileGraphics.worldRange === "widePlus";
  }

  private isMobileMediumFullGraphics(): boolean {
    return this.mobileGraphics.preset === "mediumFull" || this.mobileGraphics.worldRange === "wide";
  }

  private isMobileWidePlusWorldGraphics(): boolean {
    return this.mobileGraphics.worldRange === "widePlus";
  }

  private isMobileWideWorldGraphics(): boolean {
    return this.mobileGraphics.worldRange === "wide" || this.mobileGraphics.worldRange === "widePlus";
  }

  private usesMobileFullWorldMap(): boolean {
    return MOBILE_FULL_WORLD_MAP || (this.isMobileTouchMode() && this.mobileGraphics.mobileFullWorldMap);
  }

  private mobileEntityCullMargin(kind: "player" | "monster", crowded: boolean): number {
    const monsterExtra = kind === "monster" ? 30 : 0;
    if (this.isMobileMinimalGraphics()) {
      return MOBILE_MINIMAL_RENDER_MARGIN + monsterExtra;
    }
    if (this.mobileDeepSustainRuntime || this.mobileSustainedLeanRuntime) {
      return MOBILE_SUSTAINED_RENDER_MARGIN + monsterExtra;
    }
    if (crowded) {
      return MOBILE_CROWDED_RENDER_MARGIN + monsterExtra + (this.isMobileCoolGraphics() ? 0 : 60);
    }
    return MOBILE_NORMAL_RENDER_MARGIN + monsterExtra + (this.isMobileCoolGraphics() ? 0 : 40);
  }

  private desktopEntityCullMargin(kind: "player" | "monster", crowded: boolean): number {
    if (kind === "player") {
      return crowded ? 220 : this.desktopLeanRuntime ? 380 : PLAYER_CULL_MARGIN;
    }
    return crowded ? 220 : this.desktopLeanRuntime ? 420 : MONSTER_CULL_MARGIN;
  }

  private mobilePlayerInterpolationDelayMs(): number {
    if (this.isMobileMinimalGraphics()) {
      return 205;
    }
    if (this.isMobileCoolGraphics()) {
      return 172;
    }
    return REMOTE_MOBILE_PLAYER_INTERPOLATION_DELAY_MS;
  }

  private mobileMonsterInterpolationDelayMs(): number {
    if (this.isMobileMinimalGraphics()) {
      return 220;
    }
    if (this.isMobileCoolGraphics()) {
      return 188;
    }
    return REMOTE_MOBILE_MONSTER_INTERPOLATION_DELAY_MS;
  }

  private mobileExtrapolateLimitMs(): number {
    // Cool/minimal clients receive snapshots less often, so they need a little
    // more headroom before switching from extrapolation to a visible freeze.
    return this.isMobileCoolGraphics() ? 200 : REMOTE_EXTRAPOLATE_LIMIT_MS;
  }

  private mobileRemoteSmoothStiffness(): number {
    if (this.isMobileMinimalGraphics()) {
      return 24;
    }
    if (this.isMobileCoolGraphics()) {
      return 28;
    }
    return 34;
  }

  private mobileCrowdVisibleLimit(): number {
    if (this.isMobileMinimalGraphics()) {
      return 6;
    }
    if (this.isMobileCoolGraphics()) {
      return 8;
    }
    return MOBILE_CROWDED_VISIBLE_PLAYERS;
  }

  private mobileCrowdArenaLimit(): number {
    if (this.isMobileMinimalGraphics()) {
      return 4;
    }
    if (this.isMobileCoolGraphics()) {
      return 5;
    }
    return MOBILE_CROWDED_ARENA_PLAYERS;
  }

  private loadMobileAutoTarget(): boolean {
    try {
      return window.localStorage.getItem(mobileAutoTargetStorageKey) !== "off";
    } catch {
      return true;
    }
  }

  private installMobileAutoTargetHandler(): void {
    if (this.removeMobileAutoTargetHandler) {
      return;
    }

    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ enabled?: boolean }>).detail;
      this.mobileAutoTarget = detail?.enabled !== false;
    };
    window.addEventListener("mmo:mobileAutoTarget", handler);
    this.removeMobileAutoTargetHandler = () => window.removeEventListener("mmo:mobileAutoTarget", handler);
  }

  private installMobileGraphicsSettingsHandler(): void {
    if (this.removeMobileGraphicsSettingsHandler) {
      return;
    }

    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ settings?: MobileGraphicsSettings }>).detail;
      this.setMobileGraphicsSettings(detail?.settings ?? this.mobileGraphics);
    };
    window.addEventListener("mmo:mobileGraphicsSettings", handler);
    this.removeMobileGraphicsSettingsHandler = () => window.removeEventListener("mmo:mobileGraphicsSettings", handler);
  }

  private installRenameCharacterHandler(): void {
    if (this.removeRenameCharacterHandler) {
      return;
    }
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ name?: string }>).detail;
      if (detail?.name) {
        this.realtime.renameCharacter(detail.name);
      }
    };
    window.addEventListener("mmo:renameCharacter", handler);
    this.removeRenameCharacterHandler = () => window.removeEventListener("mmo:renameCharacter", handler);
  }

  private createTouchControls(): void {
    const radius = 56;
    const hitRadius = 86;
    if (!this.joystick) {
      this.joystick = this.createTouchStick(radius, hitRadius, 0x0b1220, 0x22c55e, 500);
    }
    if (!this.aimJoystick) {
      this.aimJoystick = this.createTouchStick(radius, hitRadius, 0x0b1220, 0x38bdf8, 502);
    }
    if (!this.attackButton) {
      this.attackButton = this.add
        .circle(0, 0, 34, 0x020617, 0.01)
        .setStrokeStyle(0, 0x000000, 0)
        .setScrollFactor(0)
        .setDepth(506)
        .setVisible(false);
      this.attackLabel = this.add
        .image(0, 0, "touch-icon-attack")
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(507)
        .setVisible(false);
    }
    if (!this.skillButton) {
      this.skillButton = this.add
        .circle(0, 0, 30, 0x020617, 0.01)
        .setStrokeStyle(0, 0x000000, 0)
        .setScrollFactor(0)
        .setDepth(506)
        .setVisible(false);
      this.skillLabel = this.add
        .image(0, 0, "touch-icon-dash")
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(507)
        .setVisible(false);
    }
    if (!this.jumpButton) {
      this.jumpButton = this.add
        .circle(0, 0, 29, 0x020617, 0.01)
        .setStrokeStyle(0, 0x000000, 0)
        .setScrollFactor(0)
        .setDepth(506)
        .setVisible(false);
      this.jumpLabel = this.add
        .image(0, 0, "touch-icon-run")
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(507)
        .setVisible(false);
    }
    if (!this.pkButton) {
      this.pkButton = this.add
        .circle(0, 0, 30, 0x020617, 0.01)
        .setStrokeStyle(0, 0x000000, 0)
        .setScrollFactor(0)
        .setDepth(506)
        .setVisible(false);
      this.pkLabel = this.add
        .image(0, 0, "touch-icon-pvp")
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(507)
        .setVisible(false);
    }
    this.layoutTouchControls();
    this.installNativeJoystickHandlers();

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      const pointerId = this.joystickPointerId(pointer);
      if (this.joystick?.pointerId === pointerId) {
        this.updateStickPoint(this.joystick, { x: pointer.x, y: pointer.y });
        return;
      }
      if (this.aimJoystick?.pointerId === pointerId) {
        this.updateStickPoint(this.aimJoystick, { x: pointer.x, y: pointer.y });
        return;
      }
    });

    this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      const pointerId = this.joystickPointerId(pointer);
      if (this.joystick?.pointerId === pointerId) {
        this.releaseJoystick();
      }
      if (this.aimJoystick?.pointerId === pointerId) {
        this.releaseAimJoystick();
      }
    });
  }

  private createTouchStick(radius: number, hitRadius: number, baseColor: number, accentColor: number, depth: number): TouchStick {
    const base = this.add.circle(84, 0, radius, baseColor, 0.66).setStrokeStyle(2, 0xe5e7eb, 0.28).setScrollFactor(0).setDepth(depth).setAlpha(0);
    const thumb = this.add.circle(84, 0, 23, 0xe5e7eb, 0.72).setStrokeStyle(2, accentColor, 0.62).setScrollFactor(0).setDepth(depth + 1).setAlpha(0);
    return { base, thumb, screenBase: { x: 84, y: 0 }, homeBase: { x: 84, y: 0 }, vector: { x: 0, y: 0 }, radius, hitRadius };
  }

  private layoutTouchControls(): void {
    this.layoutTouchStick(this.joystick, this.mobileMoveAnchor());
    this.layoutTouchStick(this.aimJoystick, this.mobileAimAnchor());
    this.layoutTouchActionButtons();
  }

  private layoutTouchStick(stick: TouchStick | undefined, homeBase: Vector2): void {
    if (!stick) {
      return;
    }

    stick.homeBase = homeBase;
    if (stick.pointerId === undefined) {
      stick.screenBase = stick.homeBase;
    }
    this.setJoystickObjectScreenPosition(stick.base, stick.screenBase, 1);
    if (stick.pointerId === undefined) {
      this.positionStickThumbFromVector(stick);
    }
  }

  private setJoystickObjectScreenPosition(object: Phaser.GameObjects.Arc, screenPosition: Vector2, scale = 1): void {
    const zoom = this.cameras.main.zoom || 1;
    const position = this.fixedCameraScreenPosition(screenPosition, zoom);
    object.setPosition(position.x, position.y).setScale(scale / zoom);
  }

  private setTouchTextScreenPosition(object: Phaser.GameObjects.Text | Phaser.GameObjects.Image | undefined, screenPosition: Vector2, scale = 1): void {
    if (!object) {
      return;
    }

    const zoom = this.cameras.main.zoom || 1;
    const position = this.fixedCameraScreenPosition(screenPosition, zoom);
    object.setPosition(position.x, position.y).setScale(scale / zoom);
  }

  private fixedCameraScreenPosition(screenPosition: Vector2, zoom = this.cameras.main.zoom || 1): Vector2 {
    const camera = this.cameras.main;
    const originX = camera.width * camera.originX;
    const originY = camera.height * camera.originY;
    return {
      x: originX + (screenPosition.x - camera.x - originX) / zoom,
      y: originY + (screenPosition.y - camera.y - originY) / zoom
    };
  }

  private layoutTouchActionButtons(): void {
    const attack = this.mobileAttackButtonAnchor();
    const skill = this.mobileSkillButtonAnchor();
    const jump = this.mobileJumpButtonAnchor();
    const pk = this.mobilePkButtonAnchor();
    if (this.attackButton) {
      this.setJoystickObjectScreenPosition(this.attackButton, attack, 1);
    }
    if (this.skillButton) {
      this.setJoystickObjectScreenPosition(this.skillButton, skill, 1);
    }
    if (this.jumpButton) {
      this.setJoystickObjectScreenPosition(this.jumpButton, jump, 1);
    }
    if (this.pkButton) {
      this.setJoystickObjectScreenPosition(this.pkButton, pk, 1);
    }
    this.setTouchTextScreenPosition(this.attackLabel, attack, 0.8);
    this.setTouchTextScreenPosition(this.skillLabel, skill, 0.78);
    this.setTouchTextScreenPosition(this.jumpLabel, jump, 0.78);
    this.setTouchTextScreenPosition(this.pkLabel, pk, 0.78);
  }

  private updateStickPoint(stick: TouchStick, point: Vector2): void {
    const dx = point.x - stick.screenBase.x;
    const dy = point.y - stick.screenBase.y;
    const maxDistance = stick.radius - 4;
    const distance = Math.hypot(dx, dy);
    const length = Math.min(maxDistance, distance);
    if (distance <= 0.001) {
      stick.vector = { x: 0, y: 0 };
      this.setJoystickObjectScreenPosition(stick.thumb, stick.screenBase, 1);
      return;
    }

    const angle = Math.atan2(dy, dx);
    stick.vector = {
      x: Math.cos(angle) * (length / maxDistance),
      y: Math.sin(angle) * (length / maxDistance)
    };
    this.setJoystickObjectScreenPosition(
      stick.thumb,
      {
        x: stick.screenBase.x + Math.cos(angle) * length,
        y: stick.screenBase.y + Math.sin(angle) * length
      },
      1
    );
    if (stick === this.aimJoystick) {
      this.storeTouchAimFromStick(stick);
    }
  }

  private positionStickThumbFromVector(stick: TouchStick): void {
    const maxDistance = stick.radius - 4;
    const length = Math.min(1, Math.hypot(stick.vector.x, stick.vector.y));
    if (length <= 0.001) {
      this.setJoystickObjectScreenPosition(stick.thumb, stick.screenBase, 1);
      return;
    }

    const angle = Math.atan2(stick.vector.y, stick.vector.x);
    this.setJoystickObjectScreenPosition(
      stick.thumb,
      {
        x: stick.screenBase.x + Math.cos(angle) * maxDistance * length,
        y: stick.screenBase.y + Math.sin(angle) * maxDistance * length
      },
      1
    );
  }

  private isTouchControl(pointer: Phaser.Input.Pointer): boolean {
    const point = { x: pointer.x, y: pointer.y };
    if (this.isAttackButtonPoint(point)) {
      this.resumeAudio();
      this.attackNearestTarget();
      return true;
    }

    if (this.isSkillButtonPoint(point)) {
      this.resumeAudio();
      this.triggerRoll(true);
      return true;
    }

    if (this.isJumpButtonPoint(point)) {
      this.resumeAudio();
      this.mobileSprint();
      return true;
    }

    if (this.isPkButtonPoint(point)) {
      this.resumeAudio();
      this.togglePkModeLock();
      return true;
    }

    if (this.joystick?.base.visible && this.isJoystickStartPoint(point)) {
      this.joystick.pointerId = this.joystickPointerId(pointer);
      this.joystick.nativeTouchId = undefined;
      this.startJoystickAt(point);
      this.clearMoveIntent();
      this.blurActiveEditable();
      this.sendInput(true);
      return true;
    }

    if (this.aimJoystick?.base.visible && this.isAimJoystickStartPoint(point)) {
      this.aimJoystick.pointerId = this.joystickPointerId(pointer);
      this.aimJoystick.nativeTouchId = undefined;
      this.startAimJoystickAt(point);
      this.blurActiveEditable();
      this.sendInput(true);
      return true;
    }

    return false;
  }

  private shouldIgnoreMobileWorldTap(x: number, y: number, pointer: Phaser.Input.Pointer): boolean {
    return false;
  }

  private isJoystickStartPoint(point: Vector2): boolean {
    if (!this.joystick?.base.visible) {
      return false;
    }

    const base = this.isMobileTouchMode() ? this.joystick.homeBase : this.joystick.screenBase;
    const radius = this.isMobileTouchMode() ? Math.min(82, Math.max(70, this.joystick.radius + 18)) : this.joystick.hitRadius;
    return Phaser.Math.Distance.Between(point.x, point.y, base.x, base.y) <= radius;
  }

  private touchStickVisualCenter(stick: TouchStick): Vector2 {
    return {
      x: stick.screenBase.x,
      y: stick.screenBase.y
    };
  }

  private isAimJoystickStartPoint(point: Vector2): boolean {
    if (!this.aimJoystick?.base.visible) {
      return false;
    }

    if (this.isMobileTouchMode()) {
      return false;
    }

    return (
      Phaser.Math.Distance.Between(point.x, point.y, this.aimJoystick.screenBase.x, this.aimJoystick.screenBase.y) < this.aimJoystick.hitRadius ||
      this.isInAimJoystickActivationZone(point)
    );
  }

  private isInJoystickActivationZone(point: Vector2): boolean {
    const zone = this.mobileMoveTouchZone();
    return point.x >= zone.left && point.x <= zone.right && point.y >= zone.top && point.y <= zone.bottom;
  }

  private isInAimJoystickActivationZone(point: Vector2): boolean {
    const width = this.scale.width;
    const height = this.scale.height;
    const landscape = width > height;
    const zoneWidth = landscape ? Math.min(330, Math.max(240, width * 0.32)) : Math.min(230, Math.max(190, width * 0.48));
    const zoneTop = landscape ? Math.max(48, height - 300) : Math.max(height * 0.38, height - 500);
    const zoneBottom = height;
    return point.x >= width - zoneWidth && point.x <= width && point.y >= zoneTop && point.y <= zoneBottom;
  }

  private isInMobileActionZone(point: Vector2): boolean {
    return this.isAttackButtonPoint(point) || this.isSkillButtonPoint(point) || this.isJumpButtonPoint(point) || this.isPkButtonPoint(point);
  }

  private startJoystickAt(point: Vector2): void {
    if (!this.joystick) {
      return;
    }

    const base = this.isMobileTouchMode() ? this.joystick.homeBase : this.clampJoystickBase(point);
    this.joystick.screenBase = base;
    this.joystick.vector = { x: 0, y: 0 };
    this.setJoystickObjectScreenPosition(this.joystick.base, base, 1);
    this.setJoystickObjectScreenPosition(this.joystick.thumb, base, 1);
    this.updateStickPoint(this.joystick, point);
  }

  private startAimJoystickAt(point: Vector2): void {
    if (!this.aimJoystick) {
      return;
    }

    const base = this.mobileAimBase();
    this.aimJoystick.screenBase = base;
    this.aimJoystick.vector = { x: 0, y: 0 };
    this.setJoystickObjectScreenPosition(this.aimJoystick.base, base, 1);
    this.setJoystickObjectScreenPosition(this.aimJoystick.thumb, base, 1);
    this.updateStickPoint(this.aimJoystick, point);
  }

  private mobileAimBase(): Vector2 {
    if (!this.isMobileTouchMode()) {
      return this.aimJoystick?.homeBase ?? { x: this.scale.width / 2, y: this.scale.height / 2 };
    }

    return this.mobileAimAnchor();
  }

  private mobileAimAnchor(): Vector2 {
    const width = this.scale.width;
    const height = this.scale.height;
    const landscape = width > height;

    return {
      x: Phaser.Math.Clamp(width - (landscape ? 118 : 104), 92, Math.max(92, width - 78)),
      y: landscape
        ? Phaser.Math.Clamp(height - 96, 100, Math.max(100, height - 72))
        : Phaser.Math.Clamp(height - 124, 142, Math.max(142, height - 96))
    };
  }

  private mobileMoveAnchor(): Vector2 {
    const width = this.scale.width;
    const height = this.scale.height;
    const landscape = width > height;
    const radius = this.joystick?.radius ?? 56;
    const centerX = radius + (landscape ? 54 : 22);
    const centerY = height - (radius + (landscape ? 20 : 22));

    return {
      x: Phaser.Math.Clamp(centerX, radius + 6, Math.max(radius + 6, width - radius - 4)),
      y: Phaser.Math.Clamp(centerY, radius + 6, Math.max(radius + 6, height - radius - 6))
    };
  }

  private mobileMoveTouchZone(): { left: number; top: number; right: number; bottom: number } {
    const height = this.scale.height;
    const base = this.mobileMoveAnchor();
    const radius = this.joystick?.radius ?? 56;
    const padding = 28;

    return {
      left: Math.max(0, base.x - radius - padding),
      top: Math.max(0, base.y - radius - padding),
      right: Math.min(this.scale.width, base.x + radius + padding),
      bottom: Math.min(height, base.y + radius + padding)
    };
  }

  private clampMobileMoveBase(point: Vector2): Vector2 {
    const width = this.scale.width;
    const height = this.scale.height;
    const landscape = width > height;
    const margin = (this.joystick?.radius ?? 54) + 10;
    const maxX = landscape ? Math.min(width * 0.48, 430) : Math.min(width * 0.72, 320);
    const minY = landscape ? Math.max(56 + margin * 0.35, height - 360) : Math.max(height * 0.34, height - 520);
    return {
      x: Phaser.Math.Clamp(point.x, margin, Math.max(margin, maxX)),
      y: Phaser.Math.Clamp(point.y, Math.min(height - margin, minY), Math.max(margin, height - margin))
    };
  }

  private mobileAttackButtonAnchor(): Vector2 {
    const width = this.scale.width;
    const height = this.scale.height;
    const landscape = width > height;
    const right = width - (landscape ? 72 : 54);
    const y = Phaser.Math.Clamp(height - (landscape ? 118 : 112), 84, Math.max(84, height - 70));
    return {
      x: Phaser.Math.Clamp(right, 78, Math.max(78, width - (landscape ? 78 : 54))),
      y
    };
  }

  private mobileSkillButtonAnchor(): Vector2 {
    const width = this.scale.width;
    const height = this.scale.height;
    const landscape = width > height;
    const right = width - (landscape ? 72 : 54);
    const y = Phaser.Math.Clamp(height - (landscape ? 118 : 112), 84, Math.max(84, height - 70));
    return {
      x: Phaser.Math.Clamp(right - (landscape ? 66 : 62), 76, Math.max(76, width - (landscape ? 144 : 116))),
      y
    };
  }

  private mobileJumpButtonAnchor(): Vector2 {
    const width = this.scale.width;
    const height = this.scale.height;
    const landscape = width > height;
    const right = width - (landscape ? 72 : 54);
    const y = Phaser.Math.Clamp(height - (landscape ? 118 : 112), 84, Math.max(84, height - 70));
    return {
      x: Phaser.Math.Clamp(right - (landscape ? 132 : 112), 76, Math.max(76, width - (landscape ? 208 : 166))),
      y
    };
  }

  private mobilePkButtonAnchor(): Vector2 {
    const width = this.scale.width;
    const height = this.scale.height;
    const landscape = width > height;
    const right = width - (landscape ? 72 : 38);
    const y = Phaser.Math.Clamp(height - (landscape ? 118 : 112), 84, Math.max(84, height - 70));
    const xOffset = landscape ? 8 : 0;
    return {
      x: Phaser.Math.Clamp(right - xOffset, 76, Math.max(76, width - (landscape ? 48 : 38))),
      y: Phaser.Math.Clamp(y - (landscape ? 74 : 72), 68, Math.max(68, height - 132))
    };
  }

  private isAttackButtonPoint(point: Vector2): boolean {
    const button = this.attackButton;
    if (!button?.visible) {
      return false;
    }

    return Phaser.Math.Distance.Between(point.x, point.y, this.mobileAttackButtonAnchor().x, this.mobileAttackButtonAnchor().y) < 48;
  }

  private isSkillButtonPoint(point: Vector2): boolean {
    const button = this.skillButton;
    if (!button?.visible) {
      return false;
    }

    return Phaser.Math.Distance.Between(point.x, point.y, this.mobileSkillButtonAnchor().x, this.mobileSkillButtonAnchor().y) < 44;
  }

  private isJumpButtonPoint(point: Vector2): boolean {
    const button = this.jumpButton;
    if (!button?.visible) {
      return false;
    }

    return Phaser.Math.Distance.Between(point.x, point.y, this.mobileJumpButtonAnchor().x, this.mobileJumpButtonAnchor().y) < 42;
  }

  private isPkButtonPoint(point: Vector2): boolean {
    const button = this.pkButton;
    if (!button?.visible) {
      return false;
    }

    const anchor = this.mobilePkButtonAnchor();
    return Phaser.Math.Distance.Between(point.x, point.y, anchor.x, anchor.y) < 42;
  }

  private isNearAimJoystickBase(point: Vector2): boolean {
    return Boolean(
      this.aimJoystick &&
        Phaser.Math.Distance.Between(point.x, point.y, this.aimJoystick.screenBase.x, this.aimJoystick.screenBase.y) < this.aimJoystick.hitRadius
    );
  }

  private hasMobileWorldActionAt(point: Vector2): boolean {
    if (!this.isMobileTouchMode()) {
      return false;
    }

    const aim = this.screenToWorldAim(point);
    return Boolean(this.merchantAt(aim.x, aim.y) || this.teleportAt(aim.x, aim.y) || this.dungeonActionAt(aim.x, aim.y) || this.resourceAt(aim.x, aim.y) || this.groundItemAt(aim.x, aim.y) || this.mobileTargetAt(aim.x, aim.y));
  }

  private clampJoystickBase(point: Vector2): Vector2 {
    const width = this.scale.width;
    const height = this.scale.height;
    const margin = 64;
    return {
      x: Phaser.Math.Clamp(point.x, margin, Math.max(margin, width - margin)),
      y: Phaser.Math.Clamp(point.y, margin, Math.max(margin, height - margin))
    };
  }

  private joystickPointerId(pointer: Phaser.Input.Pointer): number {
    return pointer.pointerId ?? pointer.identifier ?? pointer.id;
  }

  private installNativeJoystickHandlers(): void {
    if (this.removeNativeJoystickHandlers) {
      return;
    }

    const canvas = this.game.canvas;
    const toCanvasPoint = (clientX: number, clientY: number): Vector2 => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = rect.width > 0 ? this.scale.width / rect.width : 1;
      const scaleY = rect.height > 0 ? this.scale.height / rect.height : 1;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
      };
    };
    const startJoystick = (point: Vector2, id: number, nativeTouchId?: number) => {
      if (this.isInMobileActionZone(point)) {
        return false;
      }

      if (this.joystick && (this.isJoystickStartPoint(point) || this.isInJoystickActivationZone(point))) {
        this.joystick.pointerId = id;
        this.joystick.nativeTouchId = nativeTouchId;
        this.startJoystickAt(point);
        this.clearMoveIntent();
        this.blurActiveEditable();
        this.resumeAudio();
        this.sendInput(true);
        return true;
      }

      if (this.aimJoystick && this.isAimJoystickStartPoint(point)) {
        this.aimJoystick.pointerId = id;
        this.aimJoystick.nativeTouchId = nativeTouchId;
        this.startAimJoystickAt(point);
        this.blurActiveEditable();
        this.resumeAudio();
        this.sendInput(true);
        return true;
      }

      return false;
    };
    const startNativeWorldTap = (point: Vector2, id: number) => {
      if (!this.isMobileTouchMode() || this.isInMobileActionZone(point) || this.isJoystickStartPoint(point) || this.isAimJoystickStartPoint(point)) {
        return false;
      }

      this.pendingNativeWorldTap = { id, start: point, current: point, startedAt: this.time.now, moved: false };
      return true;
    };
    const continueJoystick = (point: Vector2, id: number) => {
      if (this.joystick?.pointerId === id) {
        this.updateStickPoint(this.joystick, point);
        return true;
      }

      if (this.aimJoystick?.pointerId === id) {
        this.updateStickPoint(this.aimJoystick, point);
        return true;
      }

      return false;
    };
    const continueNativeWorldTap = (point: Vector2, id: number) => {
      const tap = this.pendingNativeWorldTap;
      if (!tap || tap.id !== id) {
        return false;
      }

      tap.current = point;
      if (Phaser.Math.Distance.Between(point.x, point.y, tap.start.x, tap.start.y) > 16) {
        tap.moved = true;
      }
      return true;
    };
    const finishNativeWorldTap = (id: number) => {
      const tap = this.pendingNativeWorldTap;
      if (!tap || tap.id !== id) {
        return false;
      }

      this.pendingNativeWorldTap = undefined;
      if (tap.moved || this.time.now - tap.startedAt > 700 || this.isInputBlocked()) {
        return false;
      }

      const phaserTap = this.lastPhaserWorldPointerDown;
      if (
        phaserTap &&
        this.time.now - phaserTap.at < 550 &&
        Phaser.Math.Distance.Between(tap.start.x, tap.start.y, phaserTap.x, phaserTap.y) < 18
      ) {
        return false;
      }

      this.resumeAudio();
      this.latestPointerScreen = tap.start;
      const aim = this.screenToWorldAim(tap.start);
      this.latestPointerAim = aim;
      this.storeTouchAimFromWorld(aim);
      if (this.shouldIgnoreMobileWorldTap(aim.x, aim.y, this.input.activePointer)) {
        this.clearMoveIntent();
        return true;
      }
      this.handlePrimaryClick(aim.x, aim.y);
      return true;
    };
    const touchById = (touches: TouchList, id: number) => {
      for (let index = 0; index < touches.length; index += 1) {
        const touch = touches.item(index);
        if (touch?.identifier === id) {
          return touch;
        }
      }
      return undefined;
    };
    const onTouchStart = (event: TouchEvent) => {
      this.resumeAudio();
      let handled = false;
      for (let index = 0; index < event.changedTouches.length; index += 1) {
        const touch = event.changedTouches.item(index);
        if (!touch) {
          continue;
        }

        const point = toCanvasPoint(touch.clientX, touch.clientY);
        if (startJoystick(point, touch.identifier, touch.identifier)) {
          handled = true;
          touchDiag.canvasTouch("start", `id=${touch.identifier} joy`);
        } else if (startNativeWorldTap(point, touch.identifier)) {
          // Let normal browser/Phaser touch flow continue. This is only a fallback
          // if Phaser does not emit the world pointerdown for this tap.
          touchDiag.canvasTouch("start", `id=${touch.identifier} tap`);
        } else {
          touchDiag.canvasTouch("start", `id=${touch.identifier} none`);
        }
      }

      if (handled) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const onTouchMove = (event: TouchEvent) => {
      touchDiag.canvasTouch("move", "");
      let handled = false;
      for (let index = 0; index < event.changedTouches.length; index += 1) {
        const touch = event.changedTouches.item(index);
        if (touch && continueJoystick(toCanvasPoint(touch.clientX, touch.clientY), touch.identifier)) {
          handled = true;
        } else if (touch && continueNativeWorldTap(toCanvasPoint(touch.clientX, touch.clientY), touch.identifier)) {
          // Do not preventDefault for ordinary world drags; only joystick moves own the event.
        }
      }

      if (handled) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const onTouchEnd = (event: TouchEvent) => {
      let handled = false;
      if (this.joystick?.nativeTouchId !== undefined && touchById(event.changedTouches, this.joystick.nativeTouchId)) {
        this.releaseJoystick();
        handled = true;
      }
      if (this.aimJoystick?.nativeTouchId !== undefined && touchById(event.changedTouches, this.aimJoystick.nativeTouchId)) {
        this.releaseAimJoystick();
        handled = true;
      }
      for (let index = 0; index < event.changedTouches.length; index += 1) {
        const touch = event.changedTouches.item(index);
        if (touch && finishNativeWorldTap(touch.identifier)) {
          handled = true;
        }
      }

      touchDiag.canvasTouch("end", `n=${event.changedTouches.length} h=${handled ? 1 : 0}`);
      if (handled) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const onTouchCancel = (event: TouchEvent) => {
      touchDiag.canvasTouch("cancel", `n=${event.changedTouches.length}`);
      let handled = false;
      if (this.joystick?.nativeTouchId !== undefined && touchById(event.changedTouches, this.joystick.nativeTouchId)) {
        this.releaseJoystick();
        handled = true;
      }
      if (this.aimJoystick?.nativeTouchId !== undefined && touchById(event.changedTouches, this.aimJoystick.nativeTouchId)) {
        this.releaseAimJoystick();
        handled = true;
      }
      for (let index = 0; index < event.changedTouches.length; index += 1) {
        const touch = event.changedTouches.item(index);
        if (touch && this.pendingNativeWorldTap?.id === touch.identifier) {
          this.pendingNativeWorldTap = undefined;
        }
      }

      if (handled) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd, { passive: false });
    canvas.addEventListener("touchcancel", onTouchCancel, { passive: false });
    this.removeNativeJoystickHandlers = () => {
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
      canvas.removeEventListener("touchcancel", onTouchCancel);
    };
  }

  private releaseJoystick(): void {
    if (!this.joystick) {
      return;
    }

    this.joystick.pointerId = undefined;
    this.joystick.nativeTouchId = undefined;
    this.joystick.vector = { x: 0, y: 0 };
    this.joystick.screenBase = this.joystick.homeBase;
    this.setJoystickObjectScreenPosition(this.joystick.base, this.joystick.screenBase, 1);
    this.setJoystickObjectScreenPosition(this.joystick.thumb, this.joystick.screenBase, 1);
    this.sendInput(true);
  }

  private releaseAimJoystick(): void {
    if (!this.aimJoystick) {
      return;
    }

    this.storeTouchAimFromStick(this.aimJoystick);
    const retainedVector = { ...this.aimJoystick.vector };
    this.aimJoystick.pointerId = undefined;
    this.aimJoystick.nativeTouchId = undefined;
    this.aimJoystick.vector = retainedVector;
    this.aimJoystick.screenBase = this.aimJoystick.homeBase;
    this.setJoystickObjectScreenPosition(this.aimJoystick.base, this.aimJoystick.screenBase, 1);
    this.positionStickThumbFromVector(this.aimJoystick);
    this.sendInput(true);
  }

  private blurActiveEditable(): void {
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.closest("input, textarea, select")) {
      active.blur();
    }
  }

  private hasWorldCursorActionAt(aim: Vector2): boolean {
    if (this.isMobileTouchMode()) {
      return false;
    }

    return Boolean(this.groundItemAt(aim.x, aim.y) || this.resourceAt(aim.x, aim.y) || this.merchantAt(aim.x, aim.y) || this.teleportAt(aim.x, aim.y) || this.dungeonActionAt(aim.x, aim.y));
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    const pointerId = this.joystickPointerId(pointer);
    if (this.joystick?.pointerId === pointerId || this.aimJoystick?.pointerId === pointerId) {
      return;
    }

    const aim = this.cachePointerAim(pointer);
    this.worldCursorInteractive = this.hasWorldCursorActionAt(aim);
    this.syncWorldCursor(this.worldCursorInteractive);
    this.updateAimReticle();
    if (this.archerDraw) {
      this.updateArcherDraw();
    }
  }

  private cachePointerAim(pointer: Phaser.Input.Pointer): Vector2 {
    this.latestPointerScreen = { x: pointer.x, y: pointer.y };
    this.latestPointerAim = this.screenToWorldAim(this.latestPointerScreen);
    if (this.isMobileTouchMode()) {
      this.storeTouchAimFromWorld(this.latestPointerAim);
    }
    return this.latestPointerAim;
  }

  private currentPointerAim(): Vector2 | undefined {
    if (this.latestPointerScreen) {
      this.latestPointerAim = this.screenToWorldAim(this.latestPointerScreen);
      return this.latestPointerAim;
    }

    const pointer = this.input.activePointer;
    const pointerId = this.joystickPointerId(pointer);
    if (this.joystick?.pointerId === pointerId || this.aimJoystick?.pointerId === pointerId) {
      return this.latestPointerAim;
    }
    if (!Number.isFinite(pointer.x) || !Number.isFinite(pointer.y)) {
      return this.latestPointerAim;
    }
    if (pointer.x === 0 && pointer.y === 0) {
      return this.latestPointerAim;
    }

    return this.cachePointerAim(pointer);
  }

  private screenToWorldAim(screen: Vector2): Vector2 {
    const point = this.cameras.main.getWorldPoint(screen.x, screen.y);
    return {
      x: Phaser.Math.Clamp(point.x, 0, WORLD_BOUNDS.width),
      y: Phaser.Math.Clamp(point.y, 0, WORLD_BOUNDS.height)
    };
  }

  private storeTouchAimFromStick(stick: TouchStick): void {
    const length = Math.hypot(stick.vector.x, stick.vector.y);
    if (length <= 0.04) {
      return;
    }

    this.lastTouchAimDirection = {
      x: stick.vector.x / length,
      y: stick.vector.y / length
    };

    const local = this.localPlayer();
    if (local) {
      this.latestPointerScreen = undefined;
      this.latestPointerAim = this.storedTouchAim(local);
    }
  }

  private storeTouchAimFromWorld(aim: Vector2): void {
    const local = this.localPlayer();
    if (!local) {
      return;
    }

    const position = this.localRenderPosition(local);
    const dx = aim.x - position.x;
    const dy = aim.y - position.y;
    const length = Math.hypot(dx, dy);
    if (length <= 1) {
      return;
    }

    this.lastTouchAimDirection = {
      x: dx / length,
      y: dy / length
    };
  }

  private storedTouchAim(local: PlayerPublicState): Vector2 | undefined {
    if (!this.lastTouchAimDirection || !this.isMobileTouchMode()) {
      return undefined;
    }

    const position = this.localRenderPosition(local);
    const range = this.aimJoystickRange(local);
    return {
      x: Phaser.Math.Clamp(position.x + this.lastTouchAimDirection.x * range, 0, WORLD_BOUNDS.width),
      y: Phaser.Math.Clamp(position.y + this.lastTouchAimDirection.y * range, 0, WORLD_BOUNDS.height)
    };
  }

  private sendInput(force = false): void {
    const blocked = this.isInputBlocked();
    const local = this.localPlayer();
    const canAct = this.localCanAct(local);
    const suspended = this.inputSuspended || document.hidden;
    const vector = blocked || suspended || !canAct ? { x: 0, y: 0 } : this.normalizedInputVector();
    const rolling = !blocked && !suspended && canAct && this.isRolling();
    const aim = local ? this.pointerAim(local) : this.currentPointerAim() ?? { x: 0, y: 0 };
    const payload: PlayerInput = {
      movement: vector,
      aim: (blocked || suspended) && local ? local.position : aim,
      dash: rolling,
      jump: !blocked && !suspended && canAct && this.localJumpBlocksHazard(),
      boost: rolling && this.rollBoost,
      sprint: !rolling && !blocked && !suspended && canAct && this.isSprinting(),
      block: !blocked && !suspended && canAct && Boolean(this.keys?.F?.isDown),
      combo: false,
      seq: ++this.seq,
      sentAt: Date.now()
    };

    const signature = this.inputSignature(payload);
    if (!force && this.isMobileTouchMode() && this.time.now - this.lastInputAt < MOBILE_INPUT_SEND_INTERVAL_MS) {
      this.seq -= 1;
      return;
    }
    if (!force && signature === this.lastInputSignature && this.time.now - this.lastInputAt < INPUT_SEND_INTERVAL_MS) {
      this.seq -= 1;
      return;
    }

    this.lastInputAt = this.time.now;
    this.lastInputSignature = signature;
    this.pendingInputs.set(payload.seq, payload);
    this.prunePendingInputs(payload.seq - MAX_STORED_INPUTS);
    this.realtime.input(payload);
  }

  private inputSignature(input: PlayerInput): string {
    return [
      Math.round(input.movement.x * 1000),
      Math.round(input.movement.y * 1000),
      Math.round((input.aim?.x ?? 0) / 8),
      Math.round((input.aim?.y ?? 0) / 8),
      input.dash ? 1 : 0,
      input.jump ? 1 : 0,
      input.boost ? 1 : 0,
      input.sprint ? 1 : 0,
      input.block ? 1 : 0
    ].join(":");
  }

  private acknowledgeInputs(processedSeq: number): void {
    this.prunePendingInputs(processedSeq);
  }

  private prunePendingInputs(maxProcessedSeq: number): void {
    for (const seq of this.pendingInputs.keys()) {
      if (seq <= maxProcessedSeq) {
        this.pendingInputs.delete(seq);
      }
    }
  }

  private pendingInputCount(processedSeq: number): number {
    let count = 0;
    for (const seq of this.pendingInputs.keys()) {
      if (seq > processedSeq) {
        count += 1;
      }
    }
    return count;
  }

  private updateLocalPrediction(time: number): void {
    const local = this.localPlayer();
    const view = local ? this.players.get(local.id) : undefined;
    if (!local || !view || !this.localCanAct(local) || this.isInputBlocked()) {
      this.lastLocalPredictionAt = time;
      return;
    }

    if (this.snapshot && local.stunnedUntil > this.snapshot.serverTime) {
      this.lastLocalPredictionAt = time;
      return;
    }

    if (this.lastLocalPredictionAt === 0) {
      this.lastLocalPredictionAt = time;
      return;
    }

    const dt = Math.min(0.05, Math.max(0, (time - this.lastLocalPredictionAt) / 1000));
    this.lastLocalPredictionAt = time;
    if (dt <= 0) {
      return;
    }

    const movement = this.normalizedInputVector();
    if (movement.x === 0 && movement.y === 0) {
      this.positionPlayerView(view, local, view.lastPosition);
      return;
    }

    this.rememberLocalMovementVector(movement);
    const speed = this.localPredictionSpeed(local);
    const rawNextPosition = {
      x: Phaser.Math.Clamp(view.lastPosition.x + movement.x * speed * dt, 0, WORLD_BOUNDS.width),
      y: Phaser.Math.Clamp(view.lastPosition.y + movement.y * speed * dt, 0, WORLD_BOUNDS.height)
    };
    const nextPosition = this.pushOutOfWorldObstacles(this.clampClickMoveVisualPosition(view.lastPosition, rawNextPosition));
    view.lastPosition = nextPosition;
    this.positionPlayerView(view, local, nextPosition);
  }

  private updateRemotePrediction(time: number): void {
    if (!this.snapshot) {
      this.lastRemotePredictionAt = time;
      return;
    }

    const frameDt =
      this.lastRemotePredictionAt === 0
        ? 1 / 60
        : Math.min(0.05, Math.max(0, (time - this.lastRemotePredictionAt) / 1000));
    this.lastRemotePredictionAt = time;
    const crowded = this.isCrowdedScene();
    const mobile = this.isMobileTouchMode();
    const playerCullMargin = mobile ? this.mobileEntityCullMargin("player", crowded) : this.desktopEntityCullMargin("player", crowded);
    const monsterCullMargin = mobile ? this.mobileEntityCullMargin("monster", crowded) : this.desktopEntityCullMargin("monster", crowded);

    for (const player of this.snapshot.players) {
      if (player.id === this.localPlayerId) {
        continue;
      }
      const view = this.players.get(player.id);
      if (!view) {
        continue;
      }
      if (
        player.id !== this.selectedTargetId &&
        !this.isPositionNearCamera(player.position, playerCullMargin) &&
        !this.isPositionNearCamera(view.lastPosition, playerCullMargin)
      ) {
        view.lastPosition = { ...player.position };
        this.hidePlayerView(view);
        continue;
      }

      const playerInterpolationDelayMs = this.adaptiveNetworkInterpolationDelayMs(
        view.positionHistory,
        mobile ? this.mobilePlayerInterpolationDelayMs() : REMOTE_PLAYER_INTERPOLATION_DELAY_MS,
        mobile ? REMOTE_MOBILE_MAX_INTERPOLATION_DELAY_MS : REMOTE_PLAYER_MAX_INTERPOLATION_DELAY_MS
      );
      const predicted = this.bufferedNetworkPosition(
        view.positionHistory,
        view.serverPosition,
        view.velocity,
        time,
        playerInterpolationDelayMs,
        mobile ? this.mobileExtrapolateLimitMs() : REMOTE_EXTRAPOLATE_LIMIT_MS
      );
      const nextPosition = this.smoothNetworkPosition(view.lastPosition, predicted, frameDt, mobile ? this.mobileRemoteSmoothStiffness() : 36, 760);
      view.lastPosition = nextPosition;
      if (mobile && this.shouldThrottleMobileRemotePlayerRender(player, view, time)) {
        this.positionMobileCheapRemotePlayerView(view, player, nextPosition);
        continue;
      }
      view.lastRemoteRenderAt = time;
      this.positionPlayerView(view, player, nextPosition);
    }

    for (const monster of this.snapshot.monsters) {
      const view = this.monsters.get(monster.id);
      if (!view) {
        continue;
      }
      if (
        monster.id !== this.selectedTargetId &&
        !this.isPositionNearCamera(monster.position, monsterCullMargin) &&
        !this.isPositionNearCamera(view.lastPosition, monsterCullMargin)
      ) {
        view.lastPosition = { ...monster.position };
        this.setMonsterViewVisible(view, false);
        continue;
      }

      const monsterInterpolationDelayMs = this.adaptiveNetworkInterpolationDelayMs(
        view.positionHistory,
        mobile ? this.mobileMonsterInterpolationDelayMs() : REMOTE_MONSTER_INTERPOLATION_DELAY_MS,
        mobile ? REMOTE_MOBILE_MAX_INTERPOLATION_DELAY_MS : REMOTE_MONSTER_MAX_INTERPOLATION_DELAY_MS
      );
      const predicted = this.bufferedNetworkPosition(
        view.positionHistory,
        view.serverPosition,
        view.velocity,
        time,
        monsterInterpolationDelayMs,
        mobile ? this.mobileExtrapolateLimitMs() : REMOTE_EXTRAPOLATE_LIMIT_MS
      );
      const nextPosition = this.smoothNetworkPosition(view.lastPosition, predicted, frameDt, mobile ? this.mobileRemoteSmoothStiffness() : 34, 680);
      view.lastPosition = nextPosition;
      this.positionMonsterView(view, monster, nextPosition);
    }

    this.updateTargetAssistPositions();
  }

  private shouldThrottleMobileRemotePlayerRender(player: PlayerPublicState, view: PlayerView, time: number): boolean {
    if (!this.isMobileTouchMode() || player.id === this.localPlayerId || player.id === this.selectedTargetId) {
      return false;
    }
    if (player.sitting && player.marketVendor?.items.length) {
      return false;
    }
    if (!this.mobileLeanRuntime && !this.isCrowdedScene()) {
      return false;
    }

    const local = this.localPlayer();
    const localPosition = local ? this.localRenderPosition(local) : undefined;
    const distanceSq = localPosition ? this.distanceSquared(view.lastPosition, localPosition) : 0;
    const close = !localPosition || distanceSq <= 620 * 620;
    const important = player.downed || player.karma > 0 || this.isPlayerPvpFlagged(player);
    const interval = this.isMobileMinimalGraphics()
      ? important || close
        ? 160
        : 340
      : this.mobileDeepSustainRuntime
      ? important || close
        ? 120
        : 260
      : this.mobileSustainedLeanRuntime
        ? important || close
          ? this.isMobileCoolGraphics()
            ? 110
            : 80
          : this.isMobileCoolGraphics()
            ? 240
            : 180
        : this.isCrowdedScene()
          ? important || close
            ? this.isMobileCoolGraphics()
              ? 75
              : 50
            : this.isMobileCoolGraphics()
              ? 180
              : 120
          : 0;
    return interval > 0 && time - view.lastRemoteRenderAt < interval;
  }

  private positionMobileCheapRemotePlayerView(view: PlayerView, player: PlayerPublicState, position: Vector2): void {
    const seatedVendor = Boolean(player.sitting && player.marketVendor?.items.length);
    const facing = this.playerVisualFacing(view, player, position);
    const angle = Math.atan2(facing.y, facing.x);
    const dance = this.playerSingingDance(player, facing);
    const visualPosition = { x: position.x + dance.x, y: position.y + dance.y };
    const weaponPosition = this.playerWeaponPosition(player, visualPosition, facing);
    const attackAge = this.time.now - view.lastAttackCueAt;
    const attackPulse = player.hp > 0 && !player.downed && attackAge >= 0 && attackAge < 260 ? Math.sin((1 - attackAge / 260) * Math.PI) : 0;
    const weaponAttackPosition = {
      x: weaponPosition.x + facing.x * attackPulse * 8,
      y: weaponPosition.y + facing.y * attackPulse * 8
    };
    const weaponAttackRotation = this.playerWeaponRotation(player, angle, dance.rotation) + attackPulse * (player.classId === "assassin" ? 0.42 : 0.28);
    const enchantLevel = player.weaponEnchantLevel ?? 0;
    view.body
      .setVisible(true)
      .setTexture(this.playerBodyTexture(player))
      .setPosition(visualPosition.x, visualPosition.y + (seatedVendor ? 7 : 0))
      .setRotation(player.downed ? Math.PI / 2 : seatedVendor ? angle * 0.05 + dance.rotation + 0.16 : angle * 0.08 + dance.rotation)
      .setAlpha(player.hp > 0 ? 1 : 0.25)
      .setTint(player.blocking ? 0x93c5fd : this.raceTint(player.race));
    this.positionCustomPlayerHead(view, player, visualPosition, angle, dance.rotation);
    view.weapon
      .setVisible(player.hp > 0 && !player.downed && !seatedVendor)
      .setTexture(this.playerWeaponTexture(player))
      .setPosition(weaponAttackPosition.x, weaponAttackPosition.y)
      .setRotation(weaponAttackRotation)
      .setScale(this.playerWeaponScale(player))
      .setAlpha(player.hp > 0 ? 1 : 0.25)
      .setTint(this.playerWeaponTint(player, enchantLevel))
      .setDepth(this.playerWeaponDepth(player));
    if (!view.bodyOnlyActive) {
      this.hidePlayerHeavyDetail(view);
      view.bodyOnlyActive = true;
    }
    if (seatedVendor) {
      view.weaponGlow.setVisible(false);
      view.weaponSmoke.forEach((smoke) => smoke.setVisible(false));
    } else {
      this.positionWeaponEnchant(view, player, weaponAttackPosition, weaponAttackRotation, false);
    }
    this.positionSingingVisuals(view, player, visualPosition, facing);
    const visualMode = this.playerVisualMode(player, position, view.visualMode);
    view.visualMode = visualMode;
    this.positionPlayerMeta(view, player, position, visualMode === "hidden" ? "simple" : visualMode);
  }

  private predictedNetworkPosition(
    position: Vector2,
    velocity: Vector2,
    receivedAt: number,
    time: number,
    maxAgeSeconds: number,
    baseLeadSeconds = 0
  ): Vector2 {
    const speed = Math.hypot(velocity.x, velocity.y);
    const lead = speed > 1 ? baseLeadSeconds : 0;
    const age = Math.min(maxAgeSeconds, Math.max(0, (time - receivedAt) / 1000 + lead));
    return {
      x: Phaser.Math.Clamp(position.x + velocity.x * age, 0, WORLD_BOUNDS.width),
      y: Phaser.Math.Clamp(position.y + velocity.y * age, 0, WORLD_BOUNDS.height)
    };
  }

  private updateServerTimeOffset(serverTime: number): void {
    const observedOffset = this.time.now - serverTime;
    if (!Number.isFinite(observedOffset)) {
      return;
    }

    if (!this.hasServerTimeOffset || Math.abs(observedOffset - this.serverTimeOffsetMs) > 300) {
      this.serverTimeOffsetMs = observedOffset;
      this.hasServerTimeOffset = true;
      return;
    }

    this.serverTimeOffsetMs = Phaser.Math.Linear(this.serverTimeOffsetMs, observedOffset, 0.08);
  }

  private pushNetworkPositionSample(history: NetworkPositionSample[], position: Vector2, serverTime: number): void {
    if (!Number.isFinite(serverTime)) {
      return;
    }

    const last = history[history.length - 1];
    if (last && serverTime <= last.serverTime) {
      last.position = { ...position };
      return;
    }

    history.push({
      position: { ...position },
      serverTime
    });
    while (history.length > REMOTE_NETWORK_HISTORY_LIMIT) {
      history.shift();
    }
  }

  private resetNetworkPositionHistory(history: NetworkPositionSample[], position: Vector2, serverTime: number): void {
    history.length = 0;
    history.push({
      position: { ...position },
      serverTime: Number.isFinite(serverTime) ? serverTime : Date.now()
    });
  }

  private bufferedNetworkPosition(
    history: NetworkPositionSample[],
    fallbackPosition: Vector2,
    velocity: Vector2,
    frameTime: number,
    delayMs: number,
    maxExtrapolateMs: number
  ): Vector2 {
    if (!this.hasServerTimeOffset || history.length === 0) {
      return this.predictedNetworkPosition(fallbackPosition, velocity, frameTime, frameTime, 0, 0);
    }

    const renderServerTime = frameTime - this.serverTimeOffsetMs - delayMs;
    const first = history[0];
    const last = history[history.length - 1];
    if (!first || !last) {
      return fallbackPosition;
    }

    if (renderServerTime <= first.serverTime) {
      return first.position;
    }

    for (let index = 1; index < history.length; index += 1) {
      const previous = history[index - 1];
      const next = history[index];
      if (renderServerTime > next.serverTime) {
        continue;
      }

      const duration = Math.max(1, next.serverTime - previous.serverTime);
      const ratio = Phaser.Math.Clamp((renderServerTime - previous.serverTime) / duration, 0, 1);
      return {
        x: Phaser.Math.Linear(previous.position.x, next.position.x, ratio),
        y: Phaser.Math.Linear(previous.position.y, next.position.y, ratio)
      };
    }

    const extrapolateMs = Phaser.Math.Clamp(renderServerTime - last.serverTime, 0, maxExtrapolateMs);
    if (extrapolateMs <= 0) {
      return last.position;
    }

    const extrapolateSeconds = extrapolateMs / 1000;
    return {
      x: Phaser.Math.Clamp(last.position.x + velocity.x * extrapolateSeconds, 0, WORLD_BOUNDS.width),
      y: Phaser.Math.Clamp(last.position.y + velocity.y * extrapolateSeconds, 0, WORLD_BOUNDS.height)
    };
  }

  private adaptiveNetworkInterpolationDelayMs(history: NetworkPositionSample[], baseDelayMs: number, maxDelayMs: number): number {
    if (history.length < 3) {
      return baseDelayMs;
    }

    const intervals: number[] = [];
    for (let index = 1; index < history.length; index += 1) {
      const interval = history[index].serverTime - history[index - 1].serverTime;
      if (Number.isFinite(interval) && interval > 0 && interval < 1000) {
        intervals.push(interval);
      }
    }
    if (intervals.length === 0) {
      return baseDelayMs;
    }

    intervals.sort((a, b) => a - b);
    const median = intervals[Math.floor(intervals.length / 2)] ?? baseDelayMs;
    const adaptiveDelay = median * 1.42;
    return Phaser.Math.Clamp(Math.max(baseDelayMs, adaptiveDelay), baseDelayMs, maxDelayMs);
  }

  private smoothNetworkPosition(current: Vector2, target: Vector2, frameDt: number, stiffness: number, snapThreshold: number): Vector2 {
    if (Phaser.Math.Distance.Between(current.x, current.y, target.x, target.y) > snapThreshold) {
      return target;
    }

    const alpha = Phaser.Math.Clamp(1 - Math.exp(-stiffness * frameDt), 0, 0.86);
    return {
      x: Phaser.Math.Linear(current.x, target.x, alpha),
      y: Phaser.Math.Linear(current.y, target.y, alpha)
    };
  }

  private localPredictionSpeed(player: PlayerPublicState): number {
    const dashMultiplier = this.isRolling() ? this.localDashMultiplier(player.classId) * (this.rollBoost ? 1.38 : 1) : 1;
    const sprintMultiplier = !this.isRolling() && this.isSprinting() ? this.localSprintMultiplier(player.classId) : 1;
    const blockMultiplier = this.keys?.F?.isDown ? (player.classId === "tank" ? 0.55 : 0.42) : 1;
    return (player.movementSpeed ?? CLASS_DEFINITIONS[player.classId].speed) * dashMultiplier * sprintMultiplier * blockMultiplier;
  }

  private localDashMultiplier(classId: PlayerPublicState["classId"]): number {
    const table: Record<PlayerPublicState["classId"], number> = {
      warrior: 1.85,
      assassin: 2.55,
      mage: 1.55,
      archer: 2.05,
      tank: 1.35
    };
    return table[classId];
  }

  private localSprintMultiplier(classId: PlayerPublicState["classId"]): number {
    const table: Record<PlayerPublicState["classId"], number> = {
      warrior: 1.34,
      assassin: 1.46,
      mage: 1.28,
      archer: 1.38,
      tank: 1.22
    };
    return table[classId];
  }

  private inputVector(): Vector2 {
    if (this.isInputBlocked() || this.inputSuspended || document.hidden) {
      return { x: 0, y: 0 };
    }

    const local = this.localPlayer();
    if (!this.localCanAct(local)) {
      return { x: 0, y: 0 };
    }

    if (this.isRolling()) {
      return this.rollDirection;
    }

    const keyboard = this.keyboardMoveVector();

    if (keyboard.x !== 0 || keyboard.y !== 0) {
      this.clickMoveTarget = undefined;
      this.moveMarker?.setVisible(false);
      return keyboard;
    }

    const mobileAimMovement = this.mobileAimMovementVector();
    if (mobileAimMovement) {
      this.clearMoveIntent();
      return mobileAimMovement;
    }

    const joystick = this.joystick?.vector ?? { x: 0, y: 0 };
    if (this.joystick?.pointerId !== undefined) {
      this.clickMoveTarget = undefined;
      this.pendingAttackTargetId = undefined;
      this.pendingSkillTargetId = undefined;
      this.pendingGroundItemId = undefined;
      this.pendingSkillIndex = 0;
      this.moveMarker?.setVisible(false);
      if (this.isMobileTouchMode()) {
        return this.mobileJoystickMoveVector(joystick);
      }
      return joystick;
    }

    const moveTarget = this.currentMoveTarget();
    if (local && moveTarget) {
      const localPosition = this.localRenderPosition(local);
      const distance = Phaser.Math.Distance.Between(localPosition.x, localPosition.y, moveTarget.x, moveTarget.y);
      if (distance < CLICK_MOVE_RENDER_ARRIVE_DISTANCE) {
        const serverDistance = Phaser.Math.Distance.Between(local.position.x, local.position.y, moveTarget.x, moveTarget.y);
        if (
          serverDistance < CLICK_MOVE_RENDER_ARRIVE_DISTANCE ||
          (!this.pendingAttackTargetId && !this.pendingSkillTargetId && serverDistance < CLICK_MOVE_SERVER_ARRIVE_DISTANCE)
        ) {
          this.clickMoveTarget = undefined;
          this.moveMarker?.setVisible(false);
          return { x: 0, y: 0 };
        }

        const serverVectorLength = Math.max(1, serverDistance);
        return {
          x: (moveTarget.x - local.position.x) / serverVectorLength,
          y: (moveTarget.y - local.position.y) / serverVectorLength
        };
      }

      return {
        x: (moveTarget.x - localPosition.x) / distance,
        y: (moveTarget.y - localPosition.y) / distance
      };
    }

    return joystick;
  }

  private clampClickMoveVisualPosition(currentPosition: Vector2, nextPosition: Vector2): Vector2 {
    const target = this.currentMoveTarget();
    if (!target) {
      return nextPosition;
    }

    const currentDistance = Phaser.Math.Distance.Between(currentPosition.x, currentPosition.y, target.x, target.y);
    const nextDistance = Phaser.Math.Distance.Between(nextPosition.x, nextPosition.y, target.x, target.y);
    if (currentDistance <= CLICK_MOVE_RENDER_ARRIVE_DISTANCE || nextDistance > currentDistance) {
      return { ...target };
    }

    return nextPosition;
  }

  private isLocalClickMoveVisualArrived(position: Vector2): boolean {
    const target = this.currentMoveTarget();
    return Boolean(target && Phaser.Math.Distance.Between(position.x, position.y, target.x, target.y) <= CLICK_MOVE_RENDER_ARRIVE_DISTANCE);
  }

  private mobileJoystickMoveVector(vector: Vector2): Vector2 {
    const length = Math.hypot(vector.x, vector.y);
    if (length < MOBILE_JOYSTICK_MOVE_DEADZONE) {
      return { x: 0, y: 0 };
    }

    return {
      x: vector.x / length,
      y: vector.y / length
    };
  }

  private mobileAimMovementVector(): Vector2 | undefined {
    if (this.isMobileTouchMode()) {
      return undefined;
    }

    const stick = this.aimJoystick;
    if (!stick || stick.pointerId === undefined) {
      return undefined;
    }

    const length = Math.hypot(stick.vector.x, stick.vector.y);
    if (length <= 0.04) {
      return { x: 0, y: 0 };
    }

    return {
      x: stick.vector.x / length,
      y: stick.vector.y / length
    };
  }

  private normalizedInputVector(): Vector2 {
    return this.normalizeVector(this.inputVector());
  }

  private normalizeVector(vector: Vector2): Vector2 {
    const length = Math.hypot(vector.x, vector.y);
    if (length <= 0.001) {
      return { x: 0, y: 0 };
    }
    if (length <= 1) {
      return vector;
    }

    return {
      x: vector.x / length,
      y: vector.y / length
    };
  }

  private localRenderPosition(local: PlayerPublicState): Vector2 {
    const view = this.players.get(local.id);
    return view?.lastPosition ?? local.position;
  }

  private entityRenderPosition(entity: MonsterState | PlayerPublicState): Vector2 {
    if ("archetype" in entity) {
      return this.monsters.get(entity.id)?.lastPosition ?? entity.position;
    }

    return this.players.get(entity.id)?.lastPosition ?? entity.position;
  }

  private hasLocalMovementIntent(): boolean {
    const keyboard = this.keyboardMoveVector();
    const joystick = this.joystick?.vector ?? { x: 0, y: 0 };
    const joystickLength = Math.hypot(joystick.x, joystick.y);
    const joystickMoving = this.isMobileTouchMode() ? joystickLength >= MOBILE_JOYSTICK_MOVE_DEADZONE : joystickLength > 0.02;
    return (
      this.isRolling() ||
      keyboard.x !== 0 ||
      keyboard.y !== 0 ||
      joystickMoving ||
      Boolean(this.mobileAimMovementVector()) ||
      Boolean(this.currentMoveTarget())
    );
  }

  private keyboardMoveVector(): Vector2 {
    return {
      x:
        (this.keys?.D?.isDown || this.cursors?.right?.isDown ? 1 : 0) -
        (this.keys?.A?.isDown || this.cursors?.left?.isDown ? 1 : 0),
      y:
        (this.keys?.S?.isDown || this.cursors?.down?.isDown ? 1 : 0) -
        (this.keys?.W?.isDown || this.cursors?.up?.isDown ? 1 : 0)
    };
  }

  private isRolling(): boolean {
    return this.time.now < this.rollUntil && (this.rollDirection.x !== 0 || this.rollDirection.y !== 0);
  }

  private isForcePkDown(): boolean {
    return this.pkModeLocked || Boolean(this.keys?.CTRL?.isDown);
  }

  private togglePkModeLock(): void {
    this.pkModeLocked = !this.pkModeLocked;
    this.updatePkModeIndicator();
  }

  private updatePkButtonVisual(): void {
    const active = this.isForcePkDown() && !this.isInputBlocked();
    if (this.pkButton) {
      this.pkButton.setFillStyle(active ? 0xdc2626 : 0x020617, active ? 0.16 : 0.01);
      this.pkButton.setStrokeStyle(active ? 1 : 0, active ? 0xfef2f2 : 0x000000, active ? 0.32 : 0);
    }
    if (this.pkLabel) {
      this.pkLabel.setTint(active ? 0xffffff : 0xfecaca);
      this.pkLabel.setAlpha(this.pkButton?.visible ? (active ? 1 : 0.86) : 0);
    }
  }

  private shouldChargeArcherShot(pointer: Phaser.Input.Pointer): boolean {
    if (this.localPlayer()?.classId !== "archer" || this.isMobileTouchMode()) {
      return false;
    }

    const event = pointer.event as { shiftKey?: boolean } | undefined;
    return Boolean(event?.shiftKey || this.keys?.SHIFT?.isDown);
  }

  private beginArcherPrimaryHold(pointer: Phaser.Input.Pointer, aim: Vector2, startImmediately: boolean): boolean {
    const local = this.localPlayer();
    if (!local || local.classId !== "archer" || this.isMobileTouchMode() || !this.localCanAct(local)) {
      return false;
    }
    if (this.groundItemAt(aim.x, aim.y) || this.resourceAt(aim.x, aim.y) || this.merchantAt(aim.x, aim.y) || this.teleportAt(aim.x, aim.y) || this.dungeonActionAt(aim.x, aim.y)) {
      return false;
    }

    this.archerHoldPrimary = {
      pointerId: this.pointerInputId(pointer),
      aim,
      startedAt: this.time.now
    };
    if (startImmediately) {
      this.updateArcherHoldPrimary(this.time.now + WorldScene.ARCHER_HOLD_DRAW_DELAY_MS);
    }
    return true;
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    if (this.archerHoldPrimary && this.time.now - this.archerHoldPrimary.startedAt >= WorldScene.ARCHER_HOLD_DRAW_DELAY_MS) {
      this.updateArcherHoldPrimary(this.time.now);
    }
    if (this.archerDraw) {
      this.archerHoldPrimary = undefined;
      this.releaseArcherDraw();
      return;
    }

    const hold = this.archerHoldPrimary;
    if (!hold || hold.pointerId !== this.pointerInputId(pointer)) {
      this.releaseArcherDraw();
      return;
    }

    this.archerHoldPrimary = undefined;
    this.cachePointerAim(pointer);
    const aim = this.screenToWorldAim({ x: pointer.x, y: pointer.y });
    this.handlePrimaryClick(aim.x, aim.y, false);
  }

  private updateArcherHoldPrimary(time: number): void {
    const hold = this.archerHoldPrimary;
    const local = this.localPlayer();
    if (!hold || this.archerDraw) {
      return;
    }
    if (!local || local.classId !== "archer" || !this.localCanAct(local) || this.isInputBlocked()) {
      this.archerHoldPrimary = undefined;
      return;
    }
    if (time - hold.startedAt < WorldScene.ARCHER_HOLD_DRAW_DELAY_MS) {
      return;
    }

    const aim = this.latestPointerAim ?? hold.aim;
    const target = this.targetAt(aim.x, aim.y);
    if (target && this.isPlayerTarget(target) && !this.canAttackPlayerWithoutPk(target, local) && !this.isForcePkDown()) {
      return;
    }
    const targetId = target && this.canAttackTarget(target) ? target.id : undefined;
    this.archerHoldPrimary = undefined;
    this.startArcherDraw(aim, targetId);
  }

  private pointerInputId(pointer: Phaser.Input.Pointer): number {
    const pointerWithId = pointer as Phaser.Input.Pointer & { id?: number; pointerId?: number; identifier?: number };
    return pointerWithId.id ?? pointerWithId.pointerId ?? pointerWithId.identifier ?? 0;
  }

  private isSecondaryPointerAction(pointer: Phaser.Input.Pointer): boolean {
    const pointerButton = (pointer as Phaser.Input.Pointer & { button?: number }).button;
    const event = pointer.event as { button?: number; buttons?: number } | undefined;

    return pointer.rightButtonDown() || pointerButton === 2 || event?.button === 2 || Boolean((event?.buttons ?? 0) & 2);
  }

  private preventPointerDefault(pointer: Phaser.Input.Pointer): void {
    const event = pointer.event as { preventDefault?: () => void; stopPropagation?: () => void } | undefined;

    event?.preventDefault?.();
    event?.stopPropagation?.();
  }

  private isSprinting(): boolean {
    return this.localCanSprint() && Boolean(this.keys?.SHIFT?.isDown || (this.isMobileTouchMode() && this.time.now < this.mobileSprintUntil));
  }

  private triggerJump(): void {
    const local = this.localPlayer();
    if (!this.localCanAct(local)) {
      return;
    }

    const now = this.time.now;
    if (now - this.jumpStartedAt > WorldScene.JUMP_DURATION_MS) {
      this.jumpCount = 0;
    }
    if (this.jumpCount >= 2 || (this.jumpCount === 1 && now - this.jumpStartedAt < 115)) {
      return;
    }

    this.jumpCount += 1;
    this.jumpStartedAt = now;
    this.jumpPeak = this.jumpCount === 1 ? 28 : 42;
    this.renderJumpDust(local.position, this.jumpCount === 2);
    this.playMovementSound(this.jumpCount === 1 ? "jump" : "doubleJump");
    this.sendInput(true);
  }

  private localJumpBlocksHazard(): boolean {
    return this.localJumpOffset() > 12;
  }

  private localJumpOffset(): number {
    const elapsed = this.time.now - this.jumpStartedAt;
    if (elapsed < 0 || elapsed > WorldScene.JUMP_DURATION_MS) {
      if (elapsed > WorldScene.JUMP_DURATION_MS) {
        this.jumpPeak = 0;
      }
      return 0;
    }

    return Math.sin((elapsed / WorldScene.JUMP_DURATION_MS) * Math.PI) * this.jumpPeak;
  }

  private renderJumpDust(position: Vector2, doubleJump: boolean): void {
    const ring = this.add
      .ellipse(position.x, position.y + 18, doubleJump ? 54 : 40, doubleJump ? 18 : 13, doubleJump ? 0x93c5fd : 0xf8fafc, doubleJump ? 0.2 : 0.16)
      .setDepth(8.8);
    this.tweens.add({
      targets: ring,
      alpha: 0,
      scaleX: doubleJump ? 1.45 : 1.28,
      scaleY: doubleJump ? 1.28 : 1.18,
      duration: 260,
      ease: "Quad.easeOut",
      onComplete: () => ring.destroy()
    });
  }

  private triggerRoll(forceBoost = false): void {
    const local = this.localPlayer();
    if (!this.localCanAct(local) || this.time.now - this.lastRollAt < 520) {
      return;
    }

    const keyboard = this.keyboardMoveVector();
    const rawDirection =
      keyboard.x !== 0 || keyboard.y !== 0
        ? keyboard
        : {
            x: this.pointerAim(local).x - local.position.x,
            y: this.pointerAim(local).y - local.position.y
          };
    const length = Math.hypot(rawDirection.x, rawDirection.y);
    const direction = length > 0.001 ? { x: rawDirection.x / length, y: rawDirection.y / length } : local.facing;
    const boosted = forceBoost || Boolean(this.keys?.SHIFT?.isDown);
    this.rollDirection = direction;
    this.rollBoost = boosted;
    this.rollUntil = this.time.now + (boosted ? 250 : 190);
    this.lastRollAt = this.time.now;
    this.clickMoveTarget = undefined;
    this.pendingAttackTargetId = undefined;
    this.pendingSkillTargetId = undefined;
    this.moveMarker?.setVisible(false);
    this.renderRollEffect(local.position, direction);
    this.playMovementSound("roll");
    this.sendInput(true);
  }

  private isInputBlocked(): boolean {
    if (this.uiFocused) {
      return true;
    }

    const active = document.activeElement;
    return active instanceof HTMLElement && Boolean(active.closest("input, textarea, select"));
  }

  private handlePrimaryClick(x: number, y: number, chargeArcherShot = false): void {
    const local = this.localPlayer();
    if (!this.localCanAct(local)) {
      return;
    }

    const groundItem = this.groundItemAt(x, y);
    if (groundItem) {
      this.pendingAttackTargetId = undefined;
      this.pendingSkillTargetId = undefined;
      this.pendingResourceId = undefined;
      this.pendingGroundItemId = groundItem.id;
      this.pendingSkillIndex = 0;
      this.queuedAttack = undefined;
      this.cancelArcherDraw();
      if (this.canPickupGroundItem(groundItem)) {
        this.clickMoveTarget = undefined;
        this.moveMarker?.setVisible(false);
        if (this.requestGroundItemPickup(groundItem, true)) {
          this.renderLootEventFeedback(groundItem.position, `picked up ${groundItem.label}`, groundItem.quantity);
          this.playPickupSound(groundItem.kind, Boolean(groundItem.rare));
        }
      } else {
        this.setMoveTarget(this.approachGroundItemPoint(groundItem));
      }
      return;
    }

    const resource = this.resourceAt(x, y);
    if (resource) {
      this.pendingAttackTargetId = undefined;
      this.pendingSkillTargetId = undefined;
      this.pendingGroundItemId = undefined;
      this.pendingSkillIndex = 0;
      this.queuedAttack = undefined;
      this.cancelArcherDraw();
      if (this.canOpenResource(resource)) {
        this.pendingResourceId = undefined;
        this.clickMoveTarget = undefined;
        this.moveMarker?.setVisible(false);
        this.realtime.openResource(resource.id);
        this.playResourceOpenSound(resource.kind);
      } else {
        this.pendingResourceId = resource.id;
        this.setMoveTarget(this.approachResourcePoint(resource));
      }
      return;
    }

    const merchant = this.merchantAt(x, y);
    if (merchant) {
      this.pendingAttackTargetId = undefined;
      this.pendingSkillTargetId = undefined;
      this.pendingResourceId = undefined;
      this.pendingGroundItemId = undefined;
      this.pendingSkillIndex = 0;
      this.queuedAttack = undefined;
      this.cancelArcherDraw();
      this.clickMoveTarget = undefined;
      this.moveMarker?.setVisible(false);
      window.dispatchEvent(new CustomEvent("mmo:openShop", { detail: { cityId: merchant.cityId } }));
      this.playUiOpenSound("shop");
      return;
    }

    const teleport = this.teleportAt(x, y);
    if (teleport) {
      this.pendingAttackTargetId = undefined;
      this.pendingSkillTargetId = undefined;
      this.pendingResourceId = undefined;
      this.pendingGroundItemId = undefined;
      this.pendingSkillIndex = 0;
      this.queuedAttack = undefined;
      this.cancelArcherDraw();
      this.clickMoveTarget = undefined;
      this.moveMarker?.setVisible(false);
      window.dispatchEvent(new CustomEvent("mmo:openTeleportMenu", { detail: { cityId: teleport.cityId } }));
      this.playUiOpenSound("gate");
      return;
    }

    const dungeonAction = this.dungeonActionAt(x, y);
    if (dungeonAction) {
      this.pendingAttackTargetId = undefined;
      this.pendingSkillTargetId = undefined;
      this.pendingResourceId = undefined;
      this.pendingGroundItemId = undefined;
      this.pendingSkillIndex = 0;
      this.queuedAttack = undefined;
      this.cancelArcherDraw();
      this.handleDungeonAction(dungeonAction);
      return;
    }

    const target = this.isMobileTouchMode() ? this.mobileTargetAt(x, y) : this.targetAt(x, y);
    if (target && this.isPlayerTarget(target) && target.marketVendor?.items.length) {
      this.selectedTargetId = target.id;
      this.pendingAttackTargetId = undefined;
      this.pendingSkillTargetId = undefined;
      this.pendingResourceId = undefined;
      this.pendingGroundItemId = undefined;
      this.pendingSkillIndex = 0;
      this.queuedAttack = undefined;
      this.clickMoveTarget = undefined;
      this.cancelArcherDraw();
      this.moveMarker?.setVisible(false);
      this.announceSelectedTarget();
      window.dispatchEvent(new CustomEvent("mmo:openVendor", { detail: { sellerId: target.id } }));
      this.playUiOpenSound("shop");
      return;
    }

    if (this.isMobileTouchMode() && target) {
      this.lockMobileTarget(target, true);
      return;
    }

    if (target && this.isPlayerTarget(target) && !this.canAttackPlayerWithoutPk(target) && !this.isForcePkDown()) {
      this.selectedTargetId = target.id;
      this.pendingAttackTargetId = undefined;
      this.pendingSkillTargetId = undefined;
      this.pendingGroundItemId = undefined;
      this.pendingSkillIndex = 0;
      this.queuedAttack = undefined;
      this.clickMoveTarget = undefined;
      this.cancelArcherDraw();
      this.moveMarker?.setVisible(false);
      this.announceSelectedTarget();
      return;
    }

    if (local?.classId === "archer") {
      this.pendingAttackTargetId = undefined;
      this.pendingSkillTargetId = undefined;
      this.pendingGroundItemId = undefined;
      this.pendingSkillIndex = 0;
      this.queuedAttack = undefined;
      this.clickMoveTarget = undefined;
      this.moveMarker?.setVisible(false);
      if (!target && chargeArcherShot) {
        this.startArcherDraw({ x, y });
        return;
      }
      if (!target) {
        this.cancelArcherDraw();
        this.setMoveTarget({ x, y });
        return;
      }
      if (target && !this.canAttackTarget(target)) {
        this.selectedTargetId = target.id;
        this.pendingAttackTargetId = target.id;
        this.setMoveTarget(this.approachPointForTarget(target));
        return;
      }
      this.selectedTargetId = target.id;
      if (chargeArcherShot) {
        this.startArcherDraw({ x, y }, target.id);
        return;
      }
      this.cancelArcherDraw();
      this.attack(x, y, target.id, 0);
      return;
    }

    if (!target) {
      this.pendingAttackTargetId = undefined;
      this.pendingSkillTargetId = undefined;
      this.pendingGroundItemId = undefined;
      this.pendingSkillIndex = 0;
      this.queuedAttack = undefined;
      this.cancelArcherDraw();
      this.setMoveTarget({ x, y });
      return;
    }

    this.selectedTargetId = target.id;
    this.pendingAttackTargetId = undefined;
    this.pendingSkillTargetId = undefined;
    this.pendingResourceId = undefined;
    this.pendingGroundItemId = undefined;
    this.pendingSkillIndex = 0;
    if (this.localPlayer()?.classId === "archer" && this.canAttackTarget(target)) {
      this.startArcherDraw({ x, y }, target.id);
      return;
    }

    if (this.canAttackTarget(target)) {
      this.attack(x, y, target.id);
      return;
    }

    this.pendingAttackTargetId = target.id;
    this.setMoveTarget(this.approachPointForTarget(target));
  }

  private handleSkillClick(x: number, y: number): void {
    if (!this.localCanAct(this.localPlayer())) {
      return;
    }

    const target = this.targetAt(x, y);
    if (target && this.isPlayerTarget(target) && !this.canAttackPlayerWithoutPk(target) && !this.isForcePkDown()) {
      this.selectedTargetId = target.id;
      this.pendingAttackTargetId = undefined;
      this.pendingSkillTargetId = undefined;
      this.pendingGroundItemId = undefined;
      this.pendingSkillIndex = 0;
      this.queuedAttack = undefined;
      this.clickMoveTarget = undefined;
      this.cancelArcherDraw();
      this.moveMarker?.setVisible(false);
      this.announceSelectedTarget();
      return;
    }

    if (!target) {
      this.castSkill(x, y);
      return;
    }

    this.selectedTargetId = target.id;
    if (this.canSkillTarget(target)) {
      this.castSkill(x, y, target.id);
      return;
    }

    this.pendingSkillTargetId = target.id;
    this.pendingSkillIndex = 0;
    this.pendingAttackTargetId = undefined;
    this.pendingGroundItemId = undefined;
    this.setMoveTarget(this.approachPointForTarget(target));
  }

  private attack(x: number, y: number, explicitTargetId?: string, charge?: number): void {
    const local = this.localPlayer();
    if (!this.localCanAct(local)) {
      this.cancelArcherDraw();
      return;
    }

    const selectedTarget = explicitTargetId ? undefined : this.selectedAutoActionTarget(local);
    const explicitTarget = explicitTargetId ? this.findEntity(explicitTargetId) : undefined;
    if (explicitTarget && !this.canAttackTarget(explicitTarget)) {
      this.selectedTargetId = explicitTarget.id;
      this.pendingAttackTargetId = explicitTarget.id;
      this.pendingSkillTargetId = undefined;
      this.setMoveTarget(this.approachPointForTarget(explicitTarget), !this.isMobileTouchMode());
      return;
    }
    const rawAim = selectedTarget ? this.entityRenderPosition(selectedTarget) : { x, y };
    const aim = local.classId === "archer" ? this.extendAimToRange(local, rawAim) : rawAim;
    this.pendingResourceId = undefined;
    this.pendingGroundItemId = undefined;
    this.cancelArcherDraw(false);
    const targetId =
      explicitTargetId ?? selectedTarget?.id ?? (local.classId === "archer" ? this.firstShotTarget(local, aim)?.id : this.targetNear(aim.x, aim.y));
    const forcePk = this.isForcePkDown();
    if (targetId) {
      this.selectedTargetId = targetId;
    }
    if (this.queueAttackIfCooling(local, aim, targetId, charge, forcePk)) {
      return;
    }

    this.sendAttack(aim, targetId, charge, forcePk);
  }

  private sendAttack(aim: Vector2, targetId?: string, charge?: number, forcePk = false): void {
    this.lastLocalAttackAt = this.time.now;
    const local = this.localPlayer();
    if (local) {
      const view = this.players.get(local.id);
      if (view) {
        view.lastAttackCueAt = this.time.now;
      }
    }
    this.realtime.attack({
      aim,
      targetId,
      charge,
      forcePk
    });
    this.renderLocalAttackIntent(aim, charge, targetId);
  }

  private castSkill(x: number, y: number, explicitTargetId?: string, skillIndex = 0): void {
    const local = this.localPlayer();
    if (!this.localCanAct(local)) {
      return;
    }

    const skill = CLASS_DEFINITIONS[local.classId].skills[skillIndex];
    if (!skill) {
      return;
    }
    if (skill.heal) {
      if (local.hp >= local.maxHp) {
        return;
      }
      const origin = this.localRenderPosition(local);
      this.pendingResourceId = undefined;
      this.pendingGroundItemId = undefined;
      this.pendingSkillTargetId = undefined;
      this.lastLocalSkillAt = this.time.now;
      this.playSkillCastSound(local.classId, skillIndex);
      this.realtime.skill({
        skillId: skill.id,
        aim: origin
      });
      this.renderHealingEffect(origin);
      return;
    }

    const selectedTarget = explicitTargetId ? undefined : this.selectedAutoActionTarget(local);
    const rawAim = selectedTarget ? this.entityRenderPosition(selectedTarget) : { x, y };
    this.pendingResourceId = undefined;
    this.pendingGroundItemId = undefined;
    const skillReach = skill.range + this.attackForgiveness(local) + (skill.dashDistance ?? 0);
    const aim =
      skill.pierce && local.classId === "archer"
        ? this.extendAimToRange(local, rawAim)
        : this.capAimToRange(local, rawAim, skillReach);
    this.lastLocalSkillAt = this.time.now;
    const targetId =
      explicitTargetId ??
      selectedTarget?.id ??
      (skill.pierce && local.classId === "archer" ? this.firstShotTarget(local, aim)?.id : skill.areaRadius ? undefined : this.targetNear(aim.x, aim.y));
    if (targetId) {
      this.selectedTargetId = targetId;
    }
    this.playSkillCastSound(local.classId, skillIndex);
    this.realtime.skill({
      skillId: skill.id,
      aim,
      targetId,
      forcePk: this.isForcePkDown()
    });
    const origin = this.localRenderPosition(local);
    const visualTarget = targetId ? this.findEntity(targetId) : undefined;
    const visualAim = visualTarget ? this.entityRenderPosition(visualTarget) : aim;
    const skillImpact = skill.selfCentered ? origin : skill.areaRadius ? aim : visualAim;
    this.renderClassSkillEffect(origin, skillImpact, local.classId, targetId, skill.id, skill.areaRadius, local.id);
  }

  private startArcherDraw(aim: Vector2, targetId?: string): void {
    const local = this.localPlayer();
    if (!this.localCanAct(local)) {
      return;
    }

    const selectedTarget = targetId ? undefined : this.selectedAutoActionTarget(local);
    const lockedAim = selectedTarget ? this.entityRenderPosition(selectedTarget) : aim;
    const lockedTargetId = targetId ?? selectedTarget?.id;
    this.archerDraw = {
      startedAt: this.time.now,
      targetId: lockedTargetId,
      aim: lockedAim,
      direction: this.shotDirectionFrom(local, lockedAim)
    };
    if (lockedTargetId) {
      this.selectedTargetId = lockedTargetId;
    }
    this.pendingAttackTargetId = undefined;
    this.pendingSkillTargetId = undefined;
    this.pendingResourceId = undefined;
    this.pendingGroundItemId = undefined;
    this.queuedAttack = undefined;
    this.playMovementSound("draw");
  }

  private releaseArcherDraw(): void {
    if (!this.archerDraw || this.isInputBlocked() || !this.localCanAct(this.localPlayer())) {
      return;
    }

    const local = this.localPlayer();
    const draw = this.archerDraw;
    const aim = local ? this.archerShotAim(local, draw) : draw.aim;
    const lockedTarget = local && draw.targetId ? this.findEntity(draw.targetId) : undefined;
    const target = lockedTarget ?? (local ? this.firstShotTarget(local, aim) : undefined);
    const charge = Math.min(1, (this.time.now - draw.startedAt) / 700);
    this.archerDraw = undefined;
    this.drawChargeRing?.setVisible(false);
    this.drawBowArc?.setVisible(false);
    this.drawPullDot?.setVisible(false);
    this.drawAimDot?.setVisible(false);
    this.attack(aim.x, aim.y, target?.id, charge);
  }

  private cancelArcherDraw(hideGuide = true): void {
    this.archerHoldPrimary = undefined;
    this.archerDraw = undefined;
    if (hideGuide) {
      this.drawChargeRing?.setVisible(false);
      this.drawBowArc?.setVisible(false);
      this.drawPullDot?.setVisible(false);
      this.drawAimDot?.setVisible(false);
    }
  }

  private updateArcherDraw(): void {
    const draw = this.archerDraw;
    const local = this.localPlayer();
    if (!draw || !this.localCanAct(local) || local.classId !== "archer") {
      this.drawChargeRing?.setVisible(false);
      this.drawBowArc?.setVisible(false);
      this.drawPullDot?.setVisible(false);
      this.drawAimDot?.setVisible(false);
      return;
    }

    const pointer = this.pointerAim(local);
    const aim = this.archerShotAim(local, draw);
    const lockedTarget = draw.targetId ? this.findEntity(draw.targetId) : undefined;
    const target = lockedTarget ?? this.firstShotTarget(local, aim);
    draw.aim = aim;
    draw.targetId = target?.id;
    if (target) {
      this.selectedTargetId = target.id;
    }
    const charge = Math.min(1, (this.time.now - draw.startedAt) / 700);
    if (!this.drawChargeRing) {
      this.drawChargeRing = this.add.circle(local.position.x, local.position.y, 18, 0xfacc15, 0).setStrokeStyle(2, 0xf8fafc, 0.42).setDepth(73);
    }
    if (!this.drawBowArc) {
      this.drawBowArc = this.add.arc(local.position.x, local.position.y, 28, -70, 70, false, 0xffffff, 0).setStrokeStyle(4, 0xd6a15d, 0.9).setDepth(74);
    }
    if (!this.drawPullDot) {
      this.drawPullDot = this.add.circle(local.position.x, local.position.y, 5, 0xf8fafc, 0.88).setDepth(75);
    }
    if (!this.drawAimDot) {
      this.drawAimDot = this.add.circle(local.position.x, local.position.y, 7, 0xfacc15, 0).setStrokeStyle(2, 0xfacc15, 0.72).setDepth(75);
    }
    const shotAngle = Math.atan2(aim.y - local.position.y, aim.x - local.position.x);
    const pullDistance = Phaser.Math.Distance.Between(pointer.x, pointer.y, local.position.x, local.position.y);
    const pullOffset = Math.min(34, Math.max(8, pullDistance * 0.12 + charge * 18));
    const pullPosition = {
      x: local.position.x - Math.cos(shotAngle) * pullOffset,
      y: local.position.y - Math.sin(shotAngle) * pullOffset
    };
    this.drawChargeRing
      .setVisible(true)
      .setPosition(local.position.x, local.position.y)
      .setRadius(14 + charge * 13)
      .setStrokeStyle(2, charge >= 1 ? 0xfacc15 : 0xf8fafc, 0.22 + charge * 0.28);
    this.drawBowArc
      .setVisible(true)
      .setPosition(local.position.x + Math.cos(shotAngle) * 22, local.position.y + Math.sin(shotAngle) * 22)
      .setRotation(shotAngle)
      .setRadius(22 + charge * 5)
      .setStrokeStyle(4, charge >= 1 ? 0xfacc15 : 0xd6a15d, 0.76);
    this.drawPullDot.setVisible(true).setPosition(pullPosition.x, pullPosition.y).setAlpha(0.55 + charge * 0.35);
    this.drawAimDot
      .setVisible(true)
      .setPosition(aim.x, aim.y)
      .setRadius(5 + charge * 3)
      .setStrokeStyle(2, charge >= 1 ? 0xfacc15 : 0xf8fafc, 0.48 + charge * 0.24);
  }

  private archerShotAim(local: PlayerPublicState, draw: { direction: Vector2; aim: Vector2; targetId?: string }): Vector2 {
    const lockedTarget = draw.targetId ? this.findEntity(draw.targetId) : this.selectedAutoActionTarget(local);
    if (lockedTarget) {
      return this.extendAimToRange(local, this.entityRenderPosition(lockedTarget));
    }

    const pointer = this.pointerAim(local);
    const pointerVector = {
      x: pointer.x - local.position.x,
      y: pointer.y - local.position.y
    };
    const pointerDistance = Math.hypot(pointerVector.x, pointerVector.y);
    const shotDirection =
      pointerDistance > 44
        ? { x: pointerVector.x / pointerDistance, y: pointerVector.y / pointerDistance }
        : draw.direction;
    const shotDistance = this.attackRange(local);

    return {
      x: Phaser.Math.Clamp(local.position.x + shotDirection.x * shotDistance, 0, WORLD_BOUNDS.width),
      y: Phaser.Math.Clamp(local.position.y + shotDirection.y * shotDistance, 0, WORLD_BOUNDS.height)
    };
  }

  private shotDirectionFrom(local: PlayerPublicState, aim: Vector2): Vector2 {
    const direction = {
      x: aim.x - local.position.x,
      y: aim.y - local.position.y
    };
    const length = Math.hypot(direction.x, direction.y);
    if (length < 1) {
      return local.facing;
    }

    return {
      x: direction.x / length,
      y: direction.y / length
    };
  }

  private extendAimToRange(local: PlayerPublicState, aim: Vector2): Vector2 {
    const direction = this.shotDirectionFrom(local, aim);
    const range = this.attackRange(local);
    return {
      x: Phaser.Math.Clamp(local.position.x + direction.x * range, 0, WORLD_BOUNDS.width),
      y: Phaser.Math.Clamp(local.position.y + direction.y * range, 0, WORLD_BOUNDS.height)
    };
  }

  private capAimToRange(local: PlayerPublicState, aim: Vector2, range: number): Vector2 {
    const distance = Phaser.Math.Distance.Between(local.position.x, local.position.y, aim.x, aim.y);
    if (distance <= range || distance <= 0.001) {
      return {
        x: Phaser.Math.Clamp(aim.x, 0, WORLD_BOUNDS.width),
        y: Phaser.Math.Clamp(aim.y, 0, WORLD_BOUNDS.height)
      };
    }

    return {
      x: Phaser.Math.Clamp(local.position.x + ((aim.x - local.position.x) / distance) * range, 0, WORLD_BOUNDS.width),
      y: Phaser.Math.Clamp(local.position.y + ((aim.y - local.position.y) / distance) * range, 0, WORLD_BOUNDS.height)
    };
  }

  private queueAttackIfCooling(local: PlayerPublicState, aim: Vector2, targetId?: string, charge?: number, forcePk = false): boolean {
    if (this.lastLocalAttackAt <= 0 || this.time.now - this.lastLocalAttackAt >= this.estimatedAttackCooldown(local)) {
      return false;
    }

    if (this.queuedAttack && this.queuedAttack.targetId === targetId && this.time.now - this.queuedAttack.requestedAt < 120) {
      return true;
    }

    this.queuedAttack = {
      aim,
      targetId,
      charge,
      forcePk,
      requestedAt: this.time.now
    };
    return true;
  }

  private estimatedAttackCooldown(player: PlayerPublicState): number {
    const base = CLASS_DEFINITIONS[player.classId].attackCooldownMs;
    const baseDex: Record<string, number> = {
      warrior: 7,
      assassin: 14,
      mage: 6,
      archer: 12,
      tank: 5
    };
    const dex = (baseDex[player.classId] ?? 8) + Math.floor(Math.max(0, player.level - 1) * 0.45);
    return Math.round(base * Math.max(0.52, 1 - dex * 0.012) + 25);
  }

  private mobileCanAutoAttackTarget(local: PlayerPublicState, target: MonsterState | PlayerPublicState): boolean {
    if (!this.isPlayerTarget(target)) {
      return true;
    }
    if (this.isForcePkDown()) {
      return target.id !== local.id;
    }

    return this.canAttackPlayerWithoutPk(target, local);
  }

  private canAttackPlayerWithoutPk(target: PlayerPublicState, local = this.localPlayer()): boolean {
    if (!local || target.id === local.id) {
      return false;
    }

    const duel = local.duelOpponentId === target.id || target.duelOpponentId === local.id;
    if (this.isFriendlyPlayerTarget(local, target) && !duel) {
      return false;
    }
    if ((local.zone === "safe" || target.zone === "safe") && !duel) {
      return false;
    }

    return (
      duel ||
      target.karma > 0 ||
      Boolean(target.pvpFlagUntil && target.pvpFlagUntil > (this.snapshot?.serverTime ?? Date.now())) ||
      (this.isStarterArenaPosition(local.position) && this.isStarterArenaPosition(target.position))
    );
  }

  private isFriendlyPlayerTarget(local: PlayerPublicState, target: PlayerPublicState): boolean {
    return Boolean((local.partyId && local.partyId === target.partyId) || (local.clanId && local.clanId === target.clanId));
  }

  private isStarterArenaPosition(position: Vector2): boolean {
    return Phaser.Math.Distance.Between(position.x, position.y, WORLD_STARTER_ARENA.center.x, WORLD_STARTER_ARENA.center.y) <= WORLD_STARTER_ARENA.radius;
  }

  private selectedAutoActionTarget(local: PlayerPublicState): MonsterState | PlayerPublicState | undefined {
    if (!this.selectedTargetId) {
      return undefined;
    }

    const target = this.findEntity(this.selectedTargetId);
    if (!target || !this.mobileCanAutoAttackTarget(local, target)) {
      return undefined;
    }

    return target;
  }

  private mobileSelectedTarget(local: PlayerPublicState): MonsterState | PlayerPublicState | undefined {
    if (!this.isMobileTouchMode() || !this.selectedTargetId) {
      return undefined;
    }

    return this.selectedAutoActionTarget(local);
  }

  private mobileAutoActionTarget(local: PlayerPublicState): MonsterState | PlayerPublicState | undefined {
    if (!this.isMobileTouchMode() || !this.mobileAutoTarget) {
      return undefined;
    }

    return this.bestMobileActionTarget(local);
  }

  private lockMobileTarget(target: MonsterState | PlayerPublicState, attackNow = false): void {
    const local = this.localPlayer();
    const repeatedAttackTap = attackNow && this.shouldThrottleMobileAttackTap(target.id);
    this.selectedTargetId = target.id;
    if (repeatedAttackTap) {
      this.announceSelectedTarget();
      return;
    }

    this.pendingAttackTargetId = undefined;
    this.pendingSkillTargetId = undefined;
    this.pendingSkillIndex = 0;
    this.queuedAttack = undefined;
    this.clickMoveTarget = undefined;
    this.moveMarker?.setVisible(false);
    this.cancelArcherDraw();

    if (!local || !this.mobileCanAutoAttackTarget(local, target)) {
      this.announceSelectedTarget();
      return;
    }

    if (attackNow) {
      if (this.canAttackTarget(target)) {
        const aim = this.entityRenderPosition(target);
        this.attack(aim.x, aim.y, target.id, local.classId === "archer" ? 0 : undefined);
      } else {
        this.pendingAttackTargetId = target.id;
        this.setMoveTarget(this.approachPointForTarget(target), false);
      }
    }
    this.announceSelectedTarget();
  }

  private shouldThrottleMobileAttackTap(targetId: string): boolean {
    if (!this.isMobileTouchMode()) {
      return false;
    }

    const now = this.time.now;
    if (this.mobileLastAttackTapTargetId === targetId && now - this.mobileLastAttackTapAt < 110) {
      return true;
    }

    this.mobileLastAttackTapTargetId = targetId;
    this.mobileLastAttackTapAt = now;
    return false;
  }

  private selectMobileActionTarget(force: boolean): void {
    if (!this.mobileAutoTarget) {
      return;
    }

    if (!force && this.selectedTargetId && this.findEntity(this.selectedTargetId)) {
      return;
    }

    if (this.time.now - this.mobileLastTargetPickAt < 180) {
      return;
    }

    this.mobileLastTargetPickAt = this.time.now;
    const local = this.localPlayer();
    const target = local ? this.bestMobileActionTarget(local) : this.bestActionTarget();
    if (target) {
      this.lockMobileTarget(target);
    }
  }

  private processPendingActions(time: number): void {
    const local = this.localPlayer();
    if (local) {
      this.processQueuedAttack(local, time);
    }

    const attackTarget = this.pendingAttackTargetId ? this.findEntity(this.pendingAttackTargetId) : undefined;
    if (attackTarget) {
      this.selectedTargetId = attackTarget.id;
      const cooldown = local ? this.estimatedAttackCooldown(local) : 470;
      if (this.canAttackTarget(attackTarget) && time - this.lastLocalAttackAt > cooldown) {
        const aim = this.entityRenderPosition(attackTarget);
        this.clickMoveTarget = undefined;
        this.moveMarker?.setVisible(false);
        this.attack(aim.x, aim.y, attackTarget.id);
        this.pendingAttackTargetId = undefined;
      } else if (!this.canAttackTarget(attackTarget)) {
        this.setMoveTarget(this.approachPointForTarget(attackTarget), false);
      }
    } else {
      this.pendingAttackTargetId = undefined;
    }

    const skillTarget = this.pendingSkillTargetId ? this.findEntity(this.pendingSkillTargetId) : undefined;
    if (skillTarget) {
      this.selectedTargetId = skillTarget.id;
      if (this.canSkillTarget(skillTarget, this.pendingSkillIndex) && time - this.lastLocalSkillAt > 250) {
        const aim = this.entityRenderPosition(skillTarget);
        this.clickMoveTarget = undefined;
        this.moveMarker?.setVisible(false);
        this.castSkill(aim.x, aim.y, skillTarget.id, this.pendingSkillIndex);
        this.pendingSkillTargetId = undefined;
        this.pendingSkillIndex = 0;
      } else if (!this.canSkillTarget(skillTarget, this.pendingSkillIndex)) {
        this.setMoveTarget(this.approachPointForTarget(skillTarget), false);
      }
    } else {
      this.pendingSkillTargetId = undefined;
      this.pendingSkillIndex = 0;
    }

    const groundItem = this.pendingGroundItemId ? this.findGroundItem(this.pendingGroundItemId) : undefined;
    if (groundItem) {
      if (this.canPickupGroundItem(groundItem)) {
        this.clickMoveTarget = undefined;
        this.moveMarker?.setVisible(false);
        if (this.requestGroundItemPickup(groundItem, true)) {
          this.renderLootEventFeedback(groundItem.position, `picked up ${groundItem.label}`, groundItem.quantity);
          this.playPickupSound(groundItem.kind, Boolean(groundItem.rare));
        }
      } else {
        this.setMoveTarget(this.approachGroundItemPoint(groundItem), false);
      }
    } else {
      this.pendingGroundItemId = undefined;
    }

    const resource = this.pendingResourceId ? this.findResource(this.pendingResourceId) : undefined;
    if (resource) {
      if (this.canOpenResource(resource)) {
        this.clickMoveTarget = undefined;
        this.moveMarker?.setVisible(false);
        this.realtime.openResource(resource.id);
        this.pendingResourceId = undefined;
        this.playResourceOpenSound(resource.kind);
      } else {
        this.setMoveTarget(this.approachResourcePoint(resource), false);
      }
    } else {
      this.pendingResourceId = undefined;
    }
  }

  private processQueuedAttack(local: PlayerPublicState, time: number): void {
    if (!this.queuedAttack) {
      return;
    }
    if (!this.localCanAct(local)) {
      this.queuedAttack = undefined;
      return;
    }
    if (this.lastLocalAttackAt > 0 && time - this.lastLocalAttackAt < this.estimatedAttackCooldown(local)) {
      return;
    }
    if (time - this.queuedAttack.requestedAt > 1300) {
      this.queuedAttack = undefined;
      return;
    }

    const queued = this.queuedAttack;
    const target = queued.targetId ? this.findEntity(queued.targetId) : undefined;
    if (target && !this.canAttackTarget(target)) {
      this.pendingAttackTargetId = target.id;
      this.setMoveTarget(this.approachPointForTarget(target), false);
      this.queuedAttack = undefined;
      return;
    }

    this.queuedAttack = undefined;
    this.sendAttack(queued.aim, queued.targetId, queued.charge, Boolean(queued.forcePk && this.isForcePkDown()));
  }

  private renderSnapshot(snapshot: GameSnapshot): void {
    this.updateServerTimeOffset(snapshot.serverTime);
    const initialSnapshot = !this.renderedInitialSnapshot;
    const previouslyVisibleEntityIds = new Set<string>([...this.players.keys(), ...this.monsters.keys()]);
    const renderedPlayerIds = new Set<string>();
    const renderedMonsterIds = new Set<string>();
    const resourceIds = new Set(snapshot.resources.map((resource) => resource.id));
    const groundItemIds = new Set(snapshot.groundItems.map((item) => item.id));

    for (const player of snapshot.players) {
      renderedPlayerIds.add(player.id);
      this.renderPlayer(player);
    }

    const now = this.time.now;
    for (const [id, view] of this.players.entries()) {
      if (!renderedPlayerIds.has(id)) {
        if (this.isMobileTouchMode() && id !== this.localPlayerId && now - view.lastSnapshotSeenAt < MOBILE_PLAYER_VIEW_MISSING_GRACE_MS) {
          view.body.setVisible(true);
          view.weapon.setVisible(false);
          if (!view.bodyOnlyActive) {
            this.hidePlayerHeavyDetail(view);
            view.bodyOnlyActive = true;
          }
          continue;
        }
        this.destroyPlayerView(view);
        this.players.delete(id);
      }
    }

    for (const monster of snapshot.monsters) {
      if (monster.hp <= 0 && !this.monsters.has(monster.id)) {
        continue;
      }
      if (this.shouldCullMobileMonster(monster)) {
        continue;
      }
      renderedMonsterIds.add(monster.id);
      this.renderMonster(monster);
    }
    for (const [id, view] of this.monsters.entries()) {
      if (!renderedMonsterIds.has(id)) {
        this.destroyMonsterView(view);
        this.monsters.delete(id);
      }
    }

    for (const resource of snapshot.resources) {
      let view = this.resources.get(resource.id);
      if (!view) {
        view = this.add.image(resource.position.x, resource.position.y, `resource-${resource.kind}`).setDepth(resource.kind === "chest" ? 4.2 : 3);
        this.resources.set(resource.id, view);
      }
      const visible = resource.remaining > 0 && !resource.respawnsAt;
      const pulse = resource.kind === "chest" && visible ? 1 + Math.sin(this.time.now / 420 + resource.id.length) * 0.035 : 1;
      view
        .setTexture(`resource-${resource.kind}`)
        .setPosition(resource.position.x, resource.position.y)
        .setDepth(resource.kind === "chest" ? 4.2 : 3)
        .setScale((resource.kind === "chest" ? 0.92 : 0.84) * pulse)
        .setAlpha(visible ? (resource.kind === "chest" ? 1 : 0.92) : 0.22);
    }
    for (const [id, view] of this.resources.entries()) {
      if (!resourceIds.has(id)) {
        view.destroy();
        this.resources.delete(id);
      }
    }

    for (const item of snapshot.groundItems) {
      this.renderGroundItem(item, initialSnapshot || this.shouldQuietGroundItemSpawn(item, previouslyVisibleEntityIds));
    }
    for (const [id, view] of this.groundItems.entries()) {
      if (!groundItemIds.has(id)) {
        if (this.pickupFeedbackItemIds.has(id)) {
          this.pickupFeedbackItemIds.delete(id);
        } else {
          const missingSince = view.missingSince ?? now;
          view.missingSince = missingSince;
          const missingAge = now - missingSince;
          if (missingAge < 420) {
            const fade = Phaser.Math.Clamp(1 - missingAge / 420, 0, 1);
            const ownerBoost = view.ownerId === this.localPlayerId ? 1 : 0.82;
            view.sprite.setAlpha(ownerBoost * fade);
            view.label.setAlpha(ownerBoost * fade);
            view.glow.setAlpha(ownerBoost * fade);
            continue;
          }
          this.renderGroundItemPickupFeedback(view);
        }
        view.sprite.destroy();
        view.label.destroy();
        view.glow.destroy();
        this.groundItems.delete(id);
      }
    }

    this.eventText?.setText("");
    this.renderTargetAssist(snapshot);
    this.renderDamageNumbers(snapshot);
    this.updateSingingAudio(snapshot);
    this.renderedInitialSnapshot = true;
  }

  private shouldCullMobileMonster(monster: MonsterState): boolean {
    if (!this.isMobileTouchMode() || monster.id === this.selectedTargetId) {
      return false;
    }

    const position = this.monsters.get(monster.id)?.lastPosition ?? monster.position;
    const margin = this.mobileEntityCullMargin("monster", this.isCrowdedScene());
    return !this.isPositionNearCamera(position, margin);
  }

  private destroyPlayerView(view: PlayerView): void {
    view.body.destroy();
    view.customHead?.destroy();
    view.facing.destroy();
    view.weaponGlow.destroy();
    view.weapon.destroy();
    view.weaponSmoke.forEach((smoke) => smoke.destroy());
    view.feet.forEach((foot) => foot.destroy());
    view.label.destroy();
    view.cp.destroy();
    view.hp.destroy();
  }

  private destroyMonsterView(view: MonsterView): void {
    view.feet.forEach((foot) => foot.destroy());
    view.body.destroy();
    view.label.destroy();
    view.hp.destroy();
  }

  private renderGroundItem(item: GroundItem, quietSpawn = false): void {
    let view = this.groundItems.get(item.id);
    const pvpCoin = this.isPvpCoinGroundItem(item);
    if (!view) {
      const dropIntro = !quietSpawn && this.shouldEmphasizeGroundItem(item.position, item.ownerId);
      view = {
        id: item.id,
        sprite: this.add.image(item.position.x, item.position.y, this.groundItemTexture(item)).setDepth(5.6),
        label: this.add
          .text(item.position.x, item.position.y - 34, this.groundItemLabel(item), {
            color: pvpCoin ? "#fecaca" : item.rare ? "#fef3c7" : "#f8fafc",
            fontFamily: "Inter, sans-serif",
            fontSize: item.rare ? "13px" : "12px",
            fontStyle: "700",
            stroke: "#020617",
            strokeThickness: 4
          })
          .setOrigin(0.5)
          .setDepth(6.4),
        glow: this.add.circle(item.position.x, item.position.y, item.rare ? 32 : 24, item.rare ? 0xfacc15 : 0xffffff, 0).setDepth(5.4),
        createdAt: this.time.now,
        dropIntro,
        kind: item.kind,
        rare: Boolean(item.rare),
        pvpCoin,
        ownerId: item.ownerId,
        sourceId: item.sourceId,
        lastPosition: { ...item.position },
        lastLabelText: "",
        lastLabelColor: ""
      };
      this.groundItems.set(item.id, view);
      if (dropIntro) {
        this.renderGroundItemSpawnFeedback(item);
        this.playLootDropSound(item.kind, Boolean(item.rare));
      }
    }

    view.kind = item.kind;
    view.rare = Boolean(item.rare);
    view.pvpCoin = pvpCoin;
    view.ownerId = item.ownerId;
    view.sourceId = item.sourceId;
    view.lastPosition = { ...item.position };
    view.missingSince = undefined;
    const age = this.time.now - view.createdAt;
    const appearProgress = Phaser.Math.Clamp(age / 180, 0, 1);
    const dropProgress = view.dropIntro ? Phaser.Math.Clamp(age / 360, 0, 1) : 1;
    const dropBounce = view.dropIntro && dropProgress < 1 ? Math.sin(dropProgress * Math.PI) * (item.rare ? 28 : 20) : 0;
    const dropScale = view.dropIntro && dropProgress < 1 ? 0.92 + 0.08 * Phaser.Math.Easing.Sine.Out(dropProgress) : 1;
    const appearAlpha = view.dropIntro ? 0.62 + 0.38 * dropProgress : 0.72 + 0.28 * appearProgress;
    const labelAlpha = view.dropIntro ? Phaser.Math.Clamp(dropProgress * 1.8, 0, 1) : Phaser.Math.Clamp(appearProgress * 1.6, 0, 1);
    const ownerBoost = item.ownerId === this.localPlayerId ? 1 : 0.82;
    const labelText = this.groundItemLabel(item);
    const labelColor = pvpCoin ? "#fecaca" : item.rare ? "#fef3c7" : item.kind === "coin" || item.kind === "gold" ? "#fde68a" : "#f8fafc";
    if (labelText !== view.lastLabelText) {
      view.label.setText(labelText);
      view.lastLabelText = labelText;
    }
    if (labelColor !== view.lastLabelColor) {
      view.label.setColor(labelColor);
      view.lastLabelColor = labelColor;
    }
    view.sprite
      .setTexture(this.groundItemTexture(item))
      .setPosition(item.position.x, item.position.y - dropBounce)
      .setRotation(0)
      .setScale((item.rare ? 0.96 : 0.84) * dropScale)
      .setAlpha(ownerBoost * appearAlpha)
      .setDepth(item.rare ? 5.9 : 5.6);
    view.label.setPosition(item.position.x, item.position.y - (item.rare ? 42 : 34) - dropBounce * 0.45).setAlpha(ownerBoost * labelAlpha);
    view.glow
      .setPosition(item.position.x, item.position.y)
      .setRadius(pvpCoin ? 30 : item.rare ? 34 : 25)
      .setStrokeStyle(pvpCoin || item.rare ? 2 : 1, pvpCoin ? 0xef4444 : item.rare ? 0xfacc15 : item.kind === "gold" || item.kind === "coin" ? 0xfde68a : 0xf8fafc, pvpCoin ? 0.28 : item.rare ? 0.42 : 0.12)
      .setAlpha(ownerBoost * appearAlpha);
  }

  private shouldQuietGroundItemSpawn(item: GroundItem, previouslyVisibleEntityIds: Set<string>): boolean {
    // Ground loot lives ~2min server-side (GROUND_ITEM_TTL_MS). An item with under
    // 110s left has been lying around for a while and is only now entering our
    // snapshot window, so replaying the "fresh drop" pop/sound would look like loot
    // appearing out of nowhere.
    const remainingMs = item.expiresAt - (this.snapshot?.serverTime ?? Date.now());
    if (remainingMs < 110_000) {
      return true;
    }
    if (!item.sourceId) {
      return false;
    }
    return !previouslyVisibleEntityIds.has(item.sourceId);
  }

  private groundItemTexture(item: GroundItem): string {
    if (this.isPvpCoinGroundItem(item)) {
      return "drop-pvp-coin";
    }
    if (item.rare) {
      return "drop-rare";
    }
    if (item.kind === "gold") {
      return "drop-gold";
    }
    if (item.kind === "coin") {
      return "drop-coin";
    }
    return "drop-item";
  }

  private isPvpCoinGroundItem(item: GroundItem): boolean {
    return item.item?.id === "pvp-coin";
  }

  private groundItemLabel(item: GroundItem): string {
    const label = this.tr(item.item?.label ?? item.label);
    return item.quantity > 1 ? `${label} x${item.quantity}` : label;
  }

  private shouldEmphasizeGroundItem(position: Vector2, ownerId?: string): boolean {
    if (ownerId && ownerId !== this.localPlayerId) {
      return false;
    }
    const local = this.localPlayer();
    const nearLocal = !local || this.distanceSquared(position, this.localRenderPosition(local)) <= 1800 * 1800;
    return nearLocal && this.isPositionNearCamera(position, 420);
  }

  private groundLootColor(item: GroundItem | GroundItemView): number {
    if (("pvpCoin" in item && item.pvpCoin) || (!("pvpCoin" in item) && this.isPvpCoinGroundItem(item))) {
      return 0xef4444;
    }
    const { kind } = item;
    const rare = Boolean(item.rare);
    if (rare) {
      return 0xfacc15;
    }
    if (kind === "coin") {
      return 0xfbbf24;
    }
    if (kind === "gold") {
      return 0xfde68a;
    }
    return 0xe0f2fe;
  }

  private renderGroundItemSpawnFeedback(item: GroundItem): void {
    const color = this.groundLootColor(item);
    const ring = this.add.circle(item.position.x, item.position.y, item.rare ? 18 : 13, color, item.rare ? 0.18 : 0.12).setStrokeStyle(item.rare ? 4 : 3, color, item.rare ? 0.82 : 0.58).setDepth(7.5);
    this.tweens.add({
      targets: ring,
      scale: item.rare ? 3.2 : 2.35,
      alpha: 0,
      duration: item.rare ? 760 : 520,
      ease: "Sine.easeOut",
      onComplete: () => ring.destroy()
    });

    if (this.isMobileTouchMode() && this.mobileSustainedLeanRuntime) {
      return;
    }

    const particleCount = item.rare ? 12 : item.kind === "gold" || item.kind === "coin" ? 8 : 5;
    for (let index = 0; index < particleCount; index += 1) {
      const angle = (Math.PI * 2 * index) / particleCount + this.stableHash(`${item.id}:${index}`) * 0.0007;
      const distance = (item.rare ? 56 : 38) + (index % 3) * 8;
      const particle = this.add
        .circle(item.position.x, item.position.y - 18, item.kind === "gold" || item.kind === "coin" ? 3.8 : 3, index % 2 === 0 ? color : 0xfef3c7, item.rare ? 0.92 : 0.76)
        .setDepth(7.8);
      this.tweens.add({
        targets: particle,
        x: item.position.x + Math.cos(angle) * distance,
        y: item.position.y + Math.sin(angle) * distance * 0.46,
        alpha: 0,
        scale: 0.25,
        duration: item.rare ? 620 : 440,
        ease: "Cubic.easeOut",
        onComplete: () => particle.destroy()
      });
    }
  }

  private renderGroundItemPickupFeedback(view: GroundItemView): void {
    const local = this.localPlayer();
    if (!local) {
      return;
    }

    const localPosition = this.localRenderPosition(local);
    const nearLocal = this.distanceSquared(view.lastPosition, localPosition) <= 190 * 190;
    const pendingPickup = this.pendingGroundItemId === view.id;
    if (!pendingPickup || !nearLocal) {
      return;
    }

    const color = this.groundLootColor(view);
    const spark = this.add.circle(view.lastPosition.x, view.lastPosition.y, view.rare ? 11 : 8, color, 0.16).setStrokeStyle(2, color, 0.48).setDepth(82);
    this.tweens.add({ targets: spark, scale: 1.45, alpha: 0, duration: 180, ease: "Sine.easeOut", onComplete: () => spark.destroy() });
    this.playPickupSound(view.kind, view.rare);
  }

  private renderPlayer(player: PlayerPublicState): void {
    let view = this.players.get(player.id);
    const serverTime = this.snapshot?.serverTime ?? Date.now();
    if (!view) {
      const customHead = this.createCustomPlayerHead(player);
      view = {
        body: this.add.image(player.position.x, player.position.y, this.playerBodyTexture(player)).setDepth(10).setScale(0.62),
        customHead,
        facing: this.add.circle(player.position.x + 34, player.position.y, 5, 0xfacc15, 0).setVisible(false).setDepth(12),
        weaponGlow: this.add
          .image(player.position.x, player.position.y, `weapon-glow-${player.classId}`)
          .setDepth(12.7)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setScale(0.56)
          .setVisible(false),
        weapon: this.add.image(player.position.x, player.position.y, `weapon-${player.classId}`).setDepth(13).setScale(0.56),
        weaponSmoke: this.createPlayerWeaponSmoke(),
        feet: this.createPlayerFeet(player),
        label: this.add
          .text(player.position.x, player.position.y + this.playerLabelOffsetY(player), this.playerLabelText(player), {
            color: "#f8fafc",
            fontFamily: "Inter, sans-serif",
            fontSize: this.isMobileTouchMode() ? "14px" : "12px",
            fontStyle: "800",
            stroke: "#07110d",
            strokeThickness: this.isMobileTouchMode() ? 3 : 2
          })
          .setOrigin(0.5)
          .setDepth(11)
          .setResolution(this.isMobileTouchMode() ? 2 : 1),
        cp: this.add.rectangle(player.position.x, player.position.y + this.playerHpBarOffsetY(player) - 5, 32, 3, 0xfacc15).setDepth(11),
        hp: this.add.rectangle(player.position.x, player.position.y + this.playerHpBarOffsetY(player), 32, 3, 0x22c55e).setDepth(11),
        lastPosition: { ...player.position },
        serverPosition: { ...player.position },
        velocity: { ...player.velocity },
        positionHistory: [{ position: { ...player.position }, serverTime }],
        lastServerAt: this.time.now,
        lastSnapshotSeenAt: this.time.now,
        lastHp: player.hp,
        wasDowned: Boolean(player.downed),
        bodyOnlyActive: false,
        visualFacing: this.normalizedFacing(player.facing),
        visualFacingAngle: this.facingAngle(player.facing),
        lastFacingUpdateAt: this.time.now,
        visualMode: "full",
        lastRemoteRenderAt: 0,
        lastUiAt: 0,
        lastLabelText: "",
        lastLabelColor: "",
        lastCpRatio: -1,
        lastHpRatio: -1,
        lastSingingNoteAt: 0,
        lastDashStartedAt: 0,
        lastAttackCueAt: 0
      };
      this.players.set(player.id, view);
    }
    view.lastSnapshotSeenAt = this.time.now;

    const isLocalPlayer = player.id === this.localPlayerId;
    const arrivalElapsedSeconds = Math.max(0.016, (this.time.now - view.lastServerAt) / 1000);
    const previousNetworkSample = view.positionHistory[view.positionHistory.length - 1];
    const serverElapsedSeconds =
      previousNetworkSample && serverTime > previousNetworkSample.serverTime
        ? Phaser.Math.Clamp((serverTime - previousNetworkSample.serverTime) / 1000, 0.016, 5)
        : arrivalElapsedSeconds;
    const serverJumpDistance = Phaser.Math.Distance.Between(view.serverPosition.x, view.serverPosition.y, player.position.x, player.position.y);
    const revived = (view.lastHp <= 0 || view.wasDowned) && player.hp > 0 && !player.downed;
    const inferredVelocity = {
      x: (player.position.x - view.serverPosition.x) / serverElapsedSeconds,
      y: (player.position.y - view.serverPosition.y) / serverElapsedSeconds
    };
    const serverVelocity = player.velocity ?? inferredVelocity;
    const serverSpeed = Math.hypot(serverVelocity.x, serverVelocity.y);
    const previousSpeed = Math.hypot(view.velocity.x, view.velocity.y);
    const baseWarpSnapDistance = isLocalPlayer ? LOCAL_RESPAWN_SNAP_DISTANCE : REMOTE_PLAYER_WARP_SNAP_DISTANCE * 1.65;
    const plausibleTravelDistance = Math.max(serverSpeed, previousSpeed) * Math.min(serverElapsedSeconds, 1.2);
    const warpSnapDistance = Math.max(baseWarpSnapDistance, plausibleTravelDistance * 1.25 + 120);
    const serverWarped = serverJumpDistance > warpSnapDistance;
    // An explicit zero velocity is an authoritative stop. Replacing it with an
    // arrival-based inferred velocity makes actors overshoot after a VPN burst.
    const targetVelocity = serverWarped || player.hp <= 0 || revived ? { x: 0, y: 0 } : serverVelocity;
    const authoritativeStop = player.velocity !== undefined && serverSpeed <= 4;
    const resetNetworkHistory = player.hp <= 0 || revived || serverWarped;
    if (resetNetworkHistory) {
      this.resetNetworkPositionHistory(view.positionHistory, player.position, serverTime);
    } else {
      this.pushNetworkPositionSample(view.positionHistory, player.position, serverTime);
    }
    view.serverPosition = { ...player.position };
    const velocityBlend = this.isMobileTouchMode() ? 0.42 : 0.5;
    view.velocity =
      player.hp <= 0 || revived || serverWarped || authoritativeStop
        ? targetVelocity
        : {
            x: Phaser.Math.Linear(view.velocity.x, targetVelocity.x, velocityBlend),
            y: Phaser.Math.Linear(view.velocity.y, targetVelocity.y, velocityBlend)
          };
    view.lastServerAt = this.time.now;

    if (!isLocalPlayer) {
      this.renderRemoteDashEffect(player, view);
      const snapDistance = Phaser.Math.Distance.Between(view.lastPosition.x, view.lastPosition.y, player.position.x, player.position.y);
      if (snapDistance > warpSnapDistance || serverWarped || player.hp <= 0 || revived) {
        this.resetNetworkPositionHistory(view.positionHistory, player.position, serverTime);
        view.lastPosition = { ...player.position };
        this.snapPlayerFacing(view, player);
      }
      view.body
        .setTexture(this.playerBodyTexture(player))
        .setAlpha(player.hp > 0 ? 1 : 0.25)
        .setTint(player.blocking ? 0x93c5fd : this.raceTint(player.race));
      view.weapon.setTexture(this.playerWeaponTexture(player));
      this.positionPlayerView(view, player, view.lastPosition);
      view.lastHp = player.hp;
      view.wasDowned = Boolean(player.downed);
      return;
    }

    this.acknowledgeInputs(player.lastProcessedSeq);
    const hasMovementIntent = this.hasLocalMovementIntent();
    if (hasMovementIntent) {
      this.lastLocalMovementIntentAt = this.time.now;
    }
    const authoritativePosition = this.localAuthoritativeRenderTarget(player);
    const snapDistance = Phaser.Math.Distance.Between(view.lastPosition.x, view.lastPosition.y, authoritativePosition.x, authoritativePosition.y);
    const forcedRespawnSnap = revived || serverWarped;
    if (forcedRespawnSnap) {
      this.pendingInputs.clear();
      this.lastLocalPredictionAt = this.time.now;
    }
    const settledStopLock =
      !forcedRespawnSnap &&
      !hasMovementIntent &&
      snapDistance <= LOCAL_STOP_BACKTRACK_LOCK_DISTANCE &&
      serverSpeed <= 2 &&
      this.pendingInputCount(player.lastProcessedSeq) === 0;
    const correction = this.localReconciliationCorrection(player, hasMovementIntent, snapDistance, view.lastPosition, authoritativePosition);
    const renderPosition =
      forcedRespawnSnap || snapDistance > LOCAL_RECONCILE_SNAP_DISTANCE || this.shouldForceLocalSnap(player)
        ? authoritativePosition
        : settledStopLock
          ? view.lastPosition
        : {
            x: Phaser.Math.Linear(view.lastPosition.x, authoritativePosition.x, correction),
            y: Phaser.Math.Linear(view.lastPosition.y, authoritativePosition.y, correction)
          };
    view.lastPosition = renderPosition;
    view.body
      .setTexture(this.playerBodyTexture(player))
      .setAlpha(player.hp > 0 ? 1 : 0.25)
      .setTint(player.blocking ? 0x93c5fd : this.raceTint(player.race));
    view.weapon.setTexture(this.playerWeaponTexture(player));
    this.positionPlayerView(view, player, renderPosition);
    view.lastHp = player.hp;
    view.wasDowned = Boolean(player.downed);
  }

  private renderRemoteDashEffect(player: PlayerPublicState, view: PlayerView): void {
    const dashStartedAt = player.dashStartedAt ?? 0;
    if (!dashStartedAt || dashStartedAt <= view.lastDashStartedAt) {
      return;
    }

    view.lastDashStartedAt = dashStartedAt;
    const serverTime = this.snapshot?.serverTime ?? Date.now();
    if ((player.dashUntil ?? 0) < serverTime - 90) {
      return;
    }

    const direction = this.normalizeVector(player.dashDirection ?? player.velocity ?? player.facing);
    const fallback = this.normalizedFacing(player.facing);
    this.renderRollEffect(view.lastPosition, direction.x !== 0 || direction.y !== 0 ? direction : fallback);
  }

  private localReconciliationCorrection(
    player: PlayerPublicState,
    hasMovementIntent: boolean,
    distance: number,
    currentPosition: Vector2,
    authoritativePosition: Vector2
  ): number {
    const movementIdleMs = this.time.now - this.lastLocalMovementIntentAt;
    if (!hasMovementIntent && distance < LOCAL_STOP_VISUAL_LOCK_DISTANCE) {
      return 0;
    }
    if (!hasMovementIntent && this.isBackwardLocalCorrection(currentPosition, authoritativePosition)) {
      // Never yank a standing player backwards. We render ahead of the server, so a
      // backward pull after stopping is almost always latency catching up, not a real
      // conflict: freeze small gaps, drain bigger ones too slowly for the eye to catch.
      if (distance < LOCAL_STOP_BACKTRACK_LOCK_DISTANCE) {
        return 0;
      }
      return distance > 320 ? 0.03 : 0.006;
    }
    if (!hasMovementIntent && movementIdleMs < LOCAL_STOP_SETTLE_MS && distance < LOCAL_STOP_SETTLE_DEADBAND) {
      return 0;
    }

    const recentlyMoved = hasMovementIntent || movementIdleMs < LOCAL_MOVEMENT_GRACE_MS;
    if (!hasMovementIntent && recentlyMoved && distance < 24) {
      return 0.002;
    }
    if (!recentlyMoved) {
      return distance > 220 ? 0.14 : 0.06;
    }

    const pendingInputs = this.pendingInputCount(player.lastProcessedSeq);
    if (pendingInputs > 0 && distance < LOCAL_RECONCILE_DEFER_DISTANCE) {
      return 0;
    }
    if (pendingInputs >= 5) {
      return 0.004;
    }
    if (pendingInputs >= 2) {
      return 0.008;
    }
    return distance > 420 ? 0.035 : 0.01;
  }

  private rememberLocalMovementVector(vector: Vector2): void {
    const length = Math.hypot(vector.x, vector.y);
    if (length <= 0.001) {
      return;
    }

    this.lastLocalMovementVector = {
      x: vector.x / length,
      y: vector.y / length
    };
  }

  private isBackwardLocalCorrection(currentPosition: Vector2, authoritativePosition: Vector2): boolean {
    const movementLength = Math.hypot(this.lastLocalMovementVector.x, this.lastLocalMovementVector.y);
    if (movementLength <= 0.001) {
      return false;
    }

    const correction = {
      x: authoritativePosition.x - currentPosition.x,
      y: authoritativePosition.y - currentPosition.y
    };
    return correction.x * this.lastLocalMovementVector.x + correction.y * this.lastLocalMovementVector.y < -0.5;
  }

  private localAuthoritativeRenderTarget(player: PlayerPublicState): Vector2 {
    if (this.shouldForceLocalSnap(player)) {
      return player.position;
    }

    const velocity = player.velocity ?? { x: 0, y: 0 };
    const speed = Math.hypot(velocity.x, velocity.y);
    if (speed <= 1) {
      return player.position;
    }

    const leadSeconds = Math.min(
      LOCAL_MAX_AUTHORITATIVE_AGE_SECONDS,
      this.snapshotNetworkAgeSeconds() + LOCAL_AUTHORITATIVE_LEAD_SECONDS
    );
    return {
      x: Phaser.Math.Clamp(player.position.x + velocity.x * leadSeconds, 0, WORLD_BOUNDS.width),
      y: Phaser.Math.Clamp(player.position.y + velocity.y * leadSeconds, 0, WORLD_BOUNDS.height)
    };
  }

  private shouldForceLocalSnap(player: PlayerPublicState): boolean {
    return player.hp <= 0 || Boolean(player.downed) || Boolean(this.snapshot && player.stunnedUntil > this.snapshot.serverTime);
  }

  private snapshotNetworkAgeSeconds(): number {
    if (!this.snapshot) {
      return 0;
    }

    const ageMs = Date.now() - this.snapshot.serverTime;
    if (!Number.isFinite(ageMs) || ageMs <= 0) {
      return 0;
    }
    return Math.min(LOCAL_MAX_AUTHORITATIVE_AGE_SECONDS, ageMs / 1000);
  }

  private positionPlayerView(view: PlayerView, player: PlayerPublicState, position: Vector2): void {
    const previousMode = view.visualMode;
    const visualMode = this.playerVisualMode(player, position, previousMode);
    view.visualMode = visualMode;
    if (visualMode === "hidden") {
      if (previousMode !== "hidden") {
        this.hidePlayerView(view);
      }
      return;
	    }

    const seatedVendor = Boolean(player.sitting && player.marketVendor?.items.length);
	    const facing = this.playerVisualFacing(view, player, position);
    const angle = Math.atan2(facing.y, facing.x);
    const jumpOffset = player.id === this.localPlayerId ? this.localJumpOffset() : 0;
    const baseVisualPosition = { x: position.x, y: position.y - jumpOffset };
    const dance = this.playerSingingDance(player, facing);
    const visualPosition = { x: baseVisualPosition.x + dance.x, y: baseVisualPosition.y + dance.y };
    const weaponPosition = this.playerWeaponPosition(player, visualPosition, facing);
    const attackAge = this.time.now - view.lastAttackCueAt;
    const attackPulse = player.hp > 0 && !player.downed && attackAge >= 0 && attackAge < 260 ? Math.sin((1 - attackAge / 260) * Math.PI) : 0;
    const weaponAttackPosition = {
      x: weaponPosition.x + facing.x * attackPulse * 8,
      y: weaponPosition.y + facing.y * attackPulse * 8
    };
    const weaponAttackRotation = this.playerWeaponRotation(player, angle, dance.rotation) + attackPulse * (player.classId === "assassin" ? 0.42 : 0.28);
    const compactCrowdSimple = visualMode === "simple" && this.isMobileTouchMode() && this.isCrowdedScene();
    const readableMobileCrowdSimple = compactCrowdSimple && (this.mobileSustainedLeanRuntime || this.mobileDeepSustainRuntime || this.isMobileCoolGraphics() || this.visiblePlayerCount >= 14);
    const enchantLevel = player.weaponEnchantLevel ?? 0;
	    view.body.setVisible(true).setPosition(visualPosition.x, visualPosition.y + (seatedVendor ? 7 : 0));
	    view.body.setRotation(player.downed ? Math.PI / 2 : seatedVendor ? angle * 0.05 + dance.rotation + 0.16 : angle * 0.08 + dance.rotation);
    this.positionCustomPlayerHead(view, player, visualPosition, angle, dance.rotation);
    if (readableMobileCrowdSimple) {
	      view.weapon
	        .setVisible(player.hp > 0 && !player.downed && !seatedVendor)
        .setTexture(this.playerWeaponTexture(player))
        .setPosition(weaponAttackPosition.x, weaponAttackPosition.y)
        .setRotation(weaponAttackRotation)
        .setScale(this.playerWeaponScale(player))
        .setAlpha(player.hp > 0 ? 1 : 0.25)
        .setTint(this.playerWeaponTint(player, enchantLevel))
        .setDepth(this.playerWeaponDepth(player));
      if (!view.bodyOnlyActive) {
        this.hidePlayerHeavyDetail(view);
        view.bodyOnlyActive = true;
      }
	      if (seatedVendor) {
	        view.weaponGlow.setVisible(false);
	        view.weaponSmoke.forEach((smoke) => smoke.setVisible(false));
	      } else {
	        this.positionWeaponEnchant(view, player, weaponAttackPosition, weaponAttackRotation, false);
	      }
      this.positionSingingVisuals(view, player, visualPosition, facing);
      this.positionPlayerMeta(view, player, baseVisualPosition, visualMode);
      return;
    }
    view.bodyOnlyActive = false;
	    view.weapon
	      .setVisible(player.hp > 0 && !player.downed && !seatedVendor)
      .setTexture(this.playerWeaponTexture(player))
      .setPosition(weaponAttackPosition.x, weaponAttackPosition.y)
      .setRotation(weaponAttackRotation)
      .setScale(this.playerWeaponScale(player))
      .setAlpha(player.hp > 0 ? 1 : 0.25)
      .setTint(this.playerWeaponTint(player, enchantLevel))
      .setDepth(this.playerWeaponDepth(player));

    if (visualMode === "full") {
      this.positionPlayerFeet(view, player, position, angle, jumpOffset);
    } else if (previousMode !== "simple") {
      this.hidePlayerDetail(view);
    }
	    if (seatedVendor) {
	      view.weaponGlow.setVisible(false);
	      view.weaponSmoke.forEach((smoke) => smoke.setVisible(false));
	    } else if (compactCrowdSimple) {
	      this.positionWeaponEnchant(view, player, weaponAttackPosition, weaponAttackRotation, false);
    } else {
      this.positionWeaponEnchant(view, player, weaponAttackPosition, weaponAttackRotation, visualMode === "full");
    }

    view.facing
      .setPosition(visualPosition.x + facing.x * 36, visualPosition.y + facing.y * 36)
      .setVisible(false);
    this.positionSingingVisuals(view, player, visualPosition, facing);
    this.positionPlayerMeta(view, player, baseVisualPosition, visualMode);
  }

  private playerVisualMode(player: PlayerPublicState, position: Vector2, previousMode?: PlayerVisualMode): PlayerVisualMode {
    if (player.id === this.localPlayerId || player.id === this.selectedTargetId) {
      return "full";
    }
    const hiddenMargin = this.isMobileTouchMode()
      ? this.mobileEntityCullMargin("player", this.isCrowdedScene())
      : this.desktopEntityCullMargin("player", this.isCrowdedScene());
    if (!this.isPositionNearCamera(position, hiddenMargin)) {
      return "hidden";
    }

    const local = this.localPlayer();
    if (!local) {
      return this.isCrowdedScene() ? "simple" : "full";
    }

    const localPosition = this.localRenderPosition(local);
    const crowded = this.isCrowdedScene();
    if (crowded) {
      if (player.downed && this.distanceSquared(position, localPosition) <= PLAYER_CROWD_FULL_DETAIL_DISTANCE * PLAYER_CROWD_FULL_DETAIL_DISTANCE) {
        return "full";
      }
      return "simple";
    }

    // Hysteresis band around the full-detail radius: once "full" it takes a bigger distance
    // to drop back to "simple", and vice versa. Without this, a bot hovering right at the
    // boundary flips modes every frame, which reads as equipment flickering on/off.
    const fullDetailDistance = PLAYER_FULL_DETAIL_DISTANCE;
    const distSq = this.distanceSquared(position, localPosition);
    if (previousMode === "full") {
      const exitDistance = fullDetailDistance * 1.18;
      return distSq <= exitDistance * exitDistance ? "full" : "simple";
    }
    return distSq <= fullDetailDistance * fullDetailDistance ? "full" : "simple";
  }

  private hidePlayerView(view: PlayerView): void {
    view.body.setVisible(false);
    view.customHead?.setVisible(false);
    view.weapon.setVisible(false);
    this.hidePlayerDetail(view);
  }

  private hidePlayerDetail(view: PlayerView): void {
    this.hidePlayerHeavyDetail(view);
    view.label.setVisible(false);
    view.cp.setVisible(false);
    view.hp.setVisible(false);
  }

  private hidePlayerHeavyDetail(view: PlayerView): void {
    view.facing.setVisible(false);
    view.weaponGlow.setVisible(false);
    view.weaponSmoke.forEach((smoke) => smoke.setVisible(false));
    view.feet.forEach((foot) => foot.setVisible(false));
  }

  private createCustomPlayerHead(player: PlayerPublicState): Phaser.GameObjects.Image | undefined {
    const head = this.customPlayerHeadConfig(player);
    if (!head || !this.textures.exists(head.texture)) {
      return undefined;
    }
    return this.add
      .image(player.position.x, player.position.y + head.offsetY, head.texture)
      .setDepth(13.55)
      .setOrigin(0.5, 0.58)
      .setScale(head.scale)
      .setVisible(false);
  }

  private shouldUseCustomPlayerHead(player: PlayerPublicState): boolean {
    const head = this.customPlayerHeadConfig(player);
    return Boolean(head && this.textures.exists(head.texture));
  }

  private customPlayerHeadConfig(player: PlayerPublicState): CustomPlayerHeadConfig | undefined {
    const customUrl = this.sanitizeCustomHeadUrl(player.customHeadUrl);
    if (customUrl) {
      const texture = this.customHeadTextureKey(player, customUrl);
      if (!this.textures.exists(texture)) {
        this.loadCustomHeadTexture(texture, customUrl, player.id);
        return undefined;
      }
      return {
        texture,
        url: customUrl,
        scale: 0.08,
        offsetY: -22,
        labelOffsetY: -64,
        hpBarOffsetY: -50
      };
    }

    const staticHead = CUSTOM_PLAYER_HEADS[player.name.trim().toLowerCase()];
    return staticHead && this.textures.exists(staticHead.texture) ? staticHead : undefined;
  }

  private sanitizeCustomHeadUrl(url?: string): string | undefined {
    const trimmed = url?.trim();
    if (!trimmed || !/^\/uploads\/heads\/[a-zA-Z0-9_-]+\.png(?:\?v=\d+)?$/.test(trimmed)) {
      return undefined;
    }
    return trimmed;
  }

  private customHeadTextureKey(player: PlayerPublicState, url: string): string {
    let hash = 0;
    for (let index = 0; index < url.length; index += 1) {
      hash = (hash * 31 + url.charCodeAt(index)) >>> 0;
    }
    return `custom-player-head-${player.id}-${hash.toString(36)}`;
  }

  private loadCustomHeadTexture(texture: string, url: string, playerId: string): void {
    if (this.loadingCustomHeadTextures.has(texture)) {
      return;
    }

    this.loadingCustomHeadTextures.add(texture);
    this.load.image(texture, url);
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      this.loadingCustomHeadTextures.delete(texture);
      const view = this.players.get(playerId);
      const player = this.snapshot?.players.find((candidate) => candidate.id === playerId);
      if (view && player) {
        view.body.setTexture(this.playerBodyTexture(player));
        this.positionCustomPlayerHead(view, player, view.lastPosition, this.facingAngle(player.facing));
      }
    });
    if (!this.load.isLoading()) {
      this.load.start();
    }
  }

  private playerBodyTexture(player: PlayerPublicState): string {
    const baseTexture = `char-${player.classId}`;
    const headlessTexture = `${baseTexture}-headless`;
    return this.shouldUseCustomPlayerHead(player) && this.textures.exists(headlessTexture) ? headlessTexture : baseTexture;
  }

  private playerWeaponTexture(player: PlayerPublicState): string {
    return this.isPlayerSinging(player) && this.textures.exists("weapon-microphone") ? "weapon-microphone" : `weapon-${player.classId}`;
  }

  private isPlayerSinging(player: PlayerPublicState): boolean {
    return Boolean(player.singing);
  }

	  private playerWeaponPosition(player: PlayerPublicState, position: Vector2, facing: Vector2): Vector2 {
	    if (this.isPlayerSinging(player)) {
	      return {
	        x: position.x + 18,
	        y: position.y - 11
	      };
	    }

    return {
      x: position.x + facing.x * 24,
      y: position.y + facing.y * 24
    };
  }

  private playerWeaponScale(player: PlayerPublicState): number {
    return this.isPlayerSinging(player) ? 0.74 : 0.56;
  }

  private playerWeaponRotation(player: PlayerPublicState, angle: number, danceRotation = 0): number {
    return this.isPlayerSinging(player) ? 0 : angle + danceRotation * 0.5;
  }

  private playerWeaponDepth(player: PlayerPublicState): number {
    return this.isPlayerSinging(player) ? 13.85 : 13;
  }

  private playerWeaponTint(player: PlayerPublicState, enchantLevel: number): number {
    if (this.isPlayerSinging(player)) {
      return 0xffffff;
    }

    if (enchantLevel <= 0) {
      return this.weaponGradeTint(player.equipmentVisual?.weaponGrade);
    }

    return this.mixNumberColor(0xffffff, this.weaponEnchantTint(enchantLevel), this.weaponEnchantSurfaceMix(enchantLevel));
  }

  private playerSingingDance(player: PlayerPublicState, facing: Vector2): { x: number; y: number; rotation: number } {
    if (!this.isPlayerSinging(player) || player.hp <= 0 || player.downed) {
      return { x: 0, y: 0, rotation: 0 };
    }

    const speed = Math.hypot(player.velocity?.x ?? 0, player.velocity?.y ?? 0);
    if (speed > 34) {
      return { x: 0, y: 0, rotation: 0 };
    }

    const seed = [...player.id].reduce((total, char) => total + char.charCodeAt(0), 0);
    const phase = ((this.time.now + seed * 31) % 1200) / 1200;
    const wave = Math.sin(phase * Math.PI * 2);
    const sideWave = Math.sin(phase * Math.PI * 2 + Math.PI / 2);
    const side = { x: -facing.y, y: facing.x };
    return {
      x: side.x * sideWave * 3.4,
      y: -Math.abs(wave) * 3.2,
      rotation: wave * 0.1
    };
  }

  private playerLabelOffsetY(player: PlayerPublicState): number {
    return this.customPlayerHeadConfig(player)?.labelOffsetY ?? PLAYER_LABEL_OFFSET_Y;
  }

  private playerHpBarOffsetY(player: PlayerPublicState): number {
    return this.customPlayerHeadConfig(player)?.hpBarOffsetY ?? PLAYER_HP_BAR_OFFSET_Y;
  }

  private positionCustomPlayerHead(view: PlayerView, player: PlayerPublicState, position: Vector2, angle: number, extraRotation = 0): void {
    const head = this.customPlayerHeadConfig(player);
    if (!view.customHead && head) {
      view.customHead = this.createCustomPlayerHead(player);
    }
    if (!view.customHead) {
      return;
    }
    if (!head) {
      view.customHead.setVisible(false);
      return;
    }
    const bodyRotation = player.downed ? Math.PI / 2 : angle * 0.08 + extraRotation;
    const offsetX = Math.sin(bodyRotation) * Math.abs(head.offsetY);
    const offsetY = Math.cos(bodyRotation) * head.offsetY;
    view.customHead
      .setVisible(true)
      .setTexture(head.texture)
      .setScale(head.scale)
      .setPosition(position.x + offsetX, position.y + offsetY)
      .setRotation(bodyRotation)
      .setAlpha(player.hp > 0 ? 1 : 0.32);
  }

  private positionSingingVisuals(view: PlayerView, player: PlayerPublicState, position: Vector2, facing: Vector2): void {
    if (!this.isPlayerSinging(player) || player.hp <= 0 || player.downed) {
      return;
    }

    const now = this.time.now;
    const interval = this.isMobileTouchMode()
      ? this.mobileDeepSustainRuntime
        ? 1300
        : this.isCrowdedScene()
          ? 920
          : 680
      : 480;
    if (now - view.lastSingingNoteAt < interval) {
      return;
    }
    view.lastSingingNoteAt = now;

    const side = { x: -facing.y, y: facing.x };
    const noteText = Math.random() < 0.5 ? "♪" : "♫";
    const note = this.trackTransient(
      this.add
        .text(
          position.x + facing.x * 18 + side.x * Phaser.Math.Between(-18, 18),
          position.y - 48 + side.y * Phaser.Math.Between(-10, 10),
          noteText,
          {
            color: "#fde68a",
            fontFamily: "Inter, sans-serif",
            fontSize: this.isMobileTouchMode() ? "16px" : "18px",
            fontStyle: "700",
            stroke: "#111827",
            strokeThickness: 3
          }
        )
        .setOrigin(0.5)
        .setDepth(82)
        .setAlpha(0.92),
      this.isMobileTouchMode() ? 1200 : 1400
    );
    this.tweens.add({
      targets: note,
      x: note.x + side.x * Phaser.Math.Between(14, 32),
      y: note.y - Phaser.Math.Between(34, 56),
      alpha: 0,
      scale: 1.26,
      duration: this.isMobileTouchMode() ? 1050 : 1300,
      ease: "Sine.easeOut",
      onComplete: () => note.destroy()
    });
  }

  private positionPlayerMeta(view: PlayerView, player: PlayerPublicState, position: Vector2, visualMode: PlayerVisualMode): void {
    const local = this.localPlayer();
    const important = player.id === this.localPlayerId || player.id === this.selectedTargetId || this.isPlayerPvpFlagged(player) || player.karma > 0 || Boolean(player.downed);
    const closeEnough =
      !local || this.distanceSquared(position, this.localRenderPosition(local)) <= PLAYER_LABEL_DISTANCE * PLAYER_LABEL_DISTANCE;
    const showLabel = visualMode !== "hidden" && (!this.isMobileTouchMode() || this.mobileGraphics.playerLabels || important);
    const showHp = player.hp > 0 && !player.downed && visualMode === "full" && (important || (!this.isCrowdedScene() && closeEnough));

    if (!showLabel) {
      view.label.setVisible(false);
      view.cp.setVisible(false);
      view.hp.setVisible(false);
      return;
    }

    const cpRatio = player.maxCp > 0 ? Phaser.Math.Clamp(player.cp / player.maxCp, 0, 1) : 0;
    const hpRatio = player.maxHp > 0 ? Phaser.Math.Clamp(player.hp / player.maxHp, 0, 1) : 0;
    const now = this.time.now;
    if (now - view.lastUiAt > 120 || view.lastLabelText === "") {
      const labelText = this.playerLabelText(player);
      const labelColor = this.playerLabelColor(player);
      if (labelText !== view.lastLabelText) {
        view.label.setText(labelText);
        view.lastLabelText = labelText;
      }
      if (labelColor !== view.lastLabelColor) {
        view.label.setColor(labelColor);
        view.lastLabelColor = labelColor;
      }
      view.lastUiAt = now;
    }

    const snapMobileUi = this.isMobileTouchMode();
    const labelX = snapMobileUi ? Math.round(position.x) : position.x;
    const labelY = position.y + this.playerLabelOffsetY(player);
    const cpX = position.x;
    const cpY = position.y + this.playerHpBarOffsetY(player) - 5;
    const hpX = position.x;
    const hpY = position.y + this.playerHpBarOffsetY(player);
    view.label.setVisible(true).setPosition(labelX, snapMobileUi ? Math.round(labelY) : labelY);
    view.cp.setVisible(showHp && cpRatio > 0).setPosition(snapMobileUi ? Math.round(cpX) : cpX, snapMobileUi ? Math.round(cpY) : cpY);
    view.hp.setVisible(showHp).setPosition(snapMobileUi ? Math.round(hpX) : hpX, snapMobileUi ? Math.round(hpY) : hpY);
    if (Math.abs(cpRatio - view.lastCpRatio) > 0.01) {
      view.cp.width = Math.max(1, 32 * cpRatio);
      view.lastCpRatio = cpRatio;
    }
    if (Math.abs(hpRatio - view.lastHpRatio) > 0.01) {
      view.hp.width = Math.max(1, 32 * hpRatio);
      view.lastHpRatio = hpRatio;
    }
  }

  private playerVisualFacing(view: PlayerView, player: PlayerPublicState, position: Vector2): Vector2 {
    if (player.id !== this.localPlayerId) {
      return this.remotePlayerVisualFacing(view, player);
    }

    if (this.isInputBlocked()) {
      this.snapPlayerFacing(view, player);
      this.broadcastLocalFacing(view.visualFacing);
      return view.visualFacing;
    }

    const aim = this.aimJoystickAim(player) ?? this.selectedTargetAim(player) ?? this.mobileJoystickAim(player) ?? this.mobileAssistedAim(player) ?? this.storedTouchAim(player) ?? this.currentPointerAim();
    if (!aim) {
      this.snapPlayerFacing(view, player);
      this.broadcastLocalFacing(view.visualFacing);
      return view.visualFacing;
    }

    const dx = aim.x - position.x;
    const dy = aim.y - position.y;
    const length = Math.hypot(dx, dy);
    if (length < 1) {
      this.snapPlayerFacing(view, player);
      this.broadcastLocalFacing(view.visualFacing);
      return view.visualFacing;
    }

    view.visualFacing = {
      x: dx / length,
      y: dy / length
    };
    view.visualFacingAngle = Math.atan2(view.visualFacing.y, view.visualFacing.x);
    view.lastFacingUpdateAt = this.time.now;
    this.broadcastLocalFacing(view.visualFacing);
    return view.visualFacing;
  }

  private broadcastLocalFacing(facing: Vector2): void {
    const normalized = this.normalizedFacing(facing);
    const angle = Math.atan2(normalized.y, normalized.x);
    const now = this.time.now;
    const previous = this.lastLocalFacingBroadcastAngle;
    const changed = !Number.isFinite(previous) || Math.abs(this.shortestAngleDelta(previous, angle)) > 0.006;
    if (!changed || now - this.lastLocalFacingBroadcastAt < 12) {
      return;
    }

    this.lastLocalFacingBroadcastAngle = angle;
    this.lastLocalFacingBroadcastAt = now;
    window.dispatchEvent(new CustomEvent("mmo:localFacing", {
      detail: {
        x: normalized.x,
        y: normalized.y,
        degrees: ((angle * Phaser.Math.RAD_TO_DEG + 90) % 360 + 360) % 360
      }
    }));
  }

  private remotePlayerVisualFacing(view: PlayerView, player: PlayerPublicState): Vector2 {
    const target = this.normalizedFacing(player.facing);
    const targetAngle = Math.atan2(target.y, target.x);
    if (!Number.isFinite(view.visualFacingAngle) || view.lastFacingUpdateAt <= 0 || player.hp <= 0 || player.downed) {
      view.visualFacing = target;
      view.visualFacingAngle = targetAngle;
      view.lastFacingUpdateAt = this.time.now;
      return view.visualFacing;
    }

    const now = this.time.now;
    const dt = Math.min(0.05, Math.max(1 / 120, (now - view.lastFacingUpdateAt) / 1000));
    view.lastFacingUpdateAt = now;
    const delta = this.shortestAngleDelta(view.visualFacingAngle, targetAngle);
    const smoothing = this.isMobileTouchMode() ? 15 : 18;
    const factor = 1 - Math.exp(-smoothing * dt);
    view.visualFacingAngle = this.wrapAngle(view.visualFacingAngle + delta * factor);
    view.visualFacing = {
      x: Math.cos(view.visualFacingAngle),
      y: Math.sin(view.visualFacingAngle)
    };
    return view.visualFacing;
  }

  private snapPlayerFacing(view: PlayerView, player: PlayerPublicState): void {
    view.visualFacing = this.normalizedFacing(player.facing);
    view.visualFacingAngle = Math.atan2(view.visualFacing.y, view.visualFacing.x);
    view.lastFacingUpdateAt = this.time.now;
  }

  private normalizedFacing(facing: Vector2 | undefined): Vector2 {
    const x = facing?.x ?? 1;
    const y = facing?.y ?? 0;
    const length = Math.hypot(x, y);
    if (!Number.isFinite(length) || length <= 0.001) {
      return { x: 1, y: 0 };
    }
    return { x: x / length, y: y / length };
  }

  private facingAngle(facing: Vector2 | undefined): number {
    const normalized = this.normalizedFacing(facing);
    return Math.atan2(normalized.y, normalized.x);
  }

  private shortestAngleDelta(from: number, to: number): number {
    return this.wrapAngle(to - from);
  }

  private wrapAngle(angle: number): number {
    return Math.atan2(Math.sin(angle), Math.cos(angle));
  }

  private createPlayerFeet(player: PlayerPublicState): Phaser.GameObjects.Ellipse[] {
    const color = player.classId === "mage" ? 0x1e3a8a : player.classId === "archer" ? 0x14532d : player.classId === "tank" ? 0x5a3517 : 0x111827;
    return [-1, 1].map(() =>
      this.add
        .ellipse(player.position.x, player.position.y + 28, 13, 7, color, 0.82)
        .setDepth(10.65)
        .setSmoothness(10)
    );
  }

  private createPlayerWeaponSmoke(): Phaser.GameObjects.Arc[] {
    return Array.from({ length: 4 }, () =>
      this.add
        .circle(0, 0, 2, 0xffffff, 0)
        .setDepth(12.6)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setVisible(false)
    );
  }

  private positionPlayerFeet(view: PlayerView, player: PlayerPublicState, position: Vector2, angle: number, jumpOffset = 0): void {
    const alive = player.hp > 0 && !player.downed;
    const isLocalPlayer = player.id === this.localPlayerId;
    const localClickMoveVisualArrived = isLocalPlayer && this.isLocalClickMoveVisualArrived(position);
    const localMoving = isLocalPlayer && !localClickMoveVisualArrived && this.hasLocalMovementIntent();
    const speed = Math.hypot(view.velocity.x, view.velocity.y);
    const attacking = this.time.now - view.lastAttackCueAt < 240;
    const moving = alive && !attacking && (isLocalPlayer ? localMoving : speed > 14);
    const phase = this.time.now / (moving ? 105 : 380) + player.id.length * 0.37;
    const forward = { x: Math.cos(angle), y: Math.sin(angle) };
    const side = { x: -Math.sin(angle), y: Math.cos(angle) };
    const baseDrop = 29;
    const bootsAppearance = player.equipmentVisual?.boots;
    if (bootsAppearance) {
      const bootTint = this.mixNumberColor(this.armorAppearanceTint(bootsAppearance, player.classId, player.race), 0x111827, 0.42);
      view.feet.forEach((foot) => foot.setFillStyle(bootTint, 0.9));
    }

    view.feet.forEach((foot, index) => {
      const sideSign = index === 0 ? -1 : 1;
      const gait = phase + (sideSign > 0 ? Math.PI : 0);
      const step = moving ? Math.sin(gait) * 8.4 : Math.sin(gait) * 0.8;
      const sway = moving ? Math.cos(gait) * 2.1 : 0;
      const lift = moving ? Math.max(0, Math.sin(gait)) * 2.4 : 0;
      foot
        .setVisible(alive)
        .setPosition(position.x + side.x * (8.5 * sideSign + sway) + forward.x * step, position.y + baseDrop + side.y * (3.6 * sideSign + sway) + forward.y * step - lift)
        .setSize(moving ? 14 : 12, moving ? 7 : 6)
        .setAlpha(jumpOffset > 4 ? 0.2 : moving ? 0.92 : 0.58)
        .setRotation(angle + sideSign * (moving ? 0.42 : 0.2));
    });
  }

  private classArmorSize(classId: PlayerPublicState["classId"]): { chestWidth: number; chestHeight: number; shoulderSpread: number; shoulderWidth: number; shoulderHeight: number } {
    if (classId === "tank") {
      return { chestWidth: 36, chestHeight: 38, shoulderSpread: 17, shoulderWidth: 19, shoulderHeight: 12 };
    }
    if (classId === "mage") {
      return { chestWidth: 27, chestHeight: 40, shoulderSpread: 12, shoulderWidth: 13, shoulderHeight: 8 };
    }
    if (classId === "assassin") {
      return { chestWidth: 25, chestHeight: 29, shoulderSpread: 11, shoulderWidth: 12, shoulderHeight: 8 };
    }
    if (classId === "archer") {
      return { chestWidth: 29, chestHeight: 31, shoulderSpread: 13, shoulderWidth: 14, shoulderHeight: 9 };
    }
    return { chestWidth: 32, chestHeight: 34, shoulderSpread: 15, shoulderWidth: 17, shoulderHeight: 10 };
  }

  private strongestEquipmentGrade(...grades: Array<string | undefined>): string | undefined {
    return grades.reduce<string | undefined>((best, grade) => (this.equipmentGradeRank(grade) > this.equipmentGradeRank(best) ? grade : best), undefined);
  }

  private equipmentGradeRank(grade?: string): number {
    const ranks: Record<string, number> = {
      common: 1,
      rare: 2,
      epic: 3,
      legendary: 4,
      mythic: 5,
      relic: 6
    };
    return grade ? ranks[grade] ?? 0 : 0;
  }

  private equipmentGradePower(grade?: string): number {
    const rank = this.equipmentGradeRank(grade);
    return rank <= 1 ? 0 : Phaser.Math.Clamp((rank - 1) / 5, 0, 1);
  }

  private shouldShowHeroArmorEffects(player: PlayerPublicState): boolean {
    if (player.id === this.localPlayerId || player.name.trim().toLowerCase() === "unit") {
      return true;
    }

    const topPvp = (this.snapshot?.players ?? []).reduce((best, candidate) => Math.max(best, candidate.pvpCount ?? 0), 0);
    return topPvp > 0 && (player.pvpCount ?? 0) >= topPvp;
  }

  private armorAppearanceTint(appearance: string | undefined, classId: PlayerPublicState["classId"], race?: string): number {
    const byAppearance: Record<string, number> = {
      steel: 0xcbd5e1,
      shadow: 0x7c3aed,
      arcane: 0x38bdf8,
      hunter: 0x84cc16,
      guardian: 0xf59e0b
    };
    const base = byAppearance[appearance ?? ""] ?? this.classEffectTint(classId);
    return this.mixNumberColor(base, this.raceAccentTint(race), race === "human" || !race ? 0.08 : 0.22);
  }

  private cosmeticAppearanceTint(appearance: string | undefined, fallback: number): number {
    const byAppearance: Record<string, number> = {
      onyx: 0x111827,
      silver: 0xe5e7eb,
      gold: 0xfacc15,
      blood: 0xef4444,
      violet: 0xa78bfa
    };
    return byAppearance[appearance ?? ""] ?? fallback;
  }

  private helmetTint(appearance: string | undefined, classId: PlayerPublicState["classId"], fallback: number): number {
    if (appearance === "arcane" || classId === "mage") {
      return 0x67e8f9;
    }
    if (appearance === "shadow" || classId === "assassin") {
      return 0x8b5cf6;
    }
    if (appearance === "hunter" || classId === "archer") {
      return 0x65a30d;
    }
    if (appearance === "guardian" || classId === "tank") {
      return 0xf59e0b;
    }
    return fallback;
  }

  private helmetRadius(classId: PlayerPublicState["classId"]): number {
    if (classId === "tank") {
      return 13.5;
    }
    if (classId === "mage") {
      return 11;
    }
    return classId === "assassin" ? 10.5 : 12;
  }

  private helmetScaleX(classId: PlayerPublicState["classId"]): number {
    return classId === "tank" ? 1.18 : classId === "mage" ? 0.9 : 1;
  }

  private helmetScaleY(classId: PlayerPublicState["classId"]): number {
    return classId === "mage" ? 0.48 : classId === "assassin" ? 0.56 : 0.62;
  }

  private helmetVerticalOffset(classId: PlayerPublicState["classId"]): number {
    return classId === "mage" ? 7 : classId === "tank" ? 4 : 5;
  }

  private classCrestSideOffset(classId: PlayerPublicState["classId"]): number {
    if (classId === "assassin") {
      return -4;
    }
    if (classId === "archer") {
      return 4;
    }
    return 0;
  }

  private weaponGradeTint(grade?: string): number {
    if (grade === "relic") {
      return 0xfb7185;
    }
    if (grade === "mythic") {
      return 0x22d3ee;
    }
    if (grade === "legendary") {
      return 0xfacc15;
    }
    if (grade === "epic") {
      return 0xc084fc;
    }
    if (grade === "rare") {
      return 0x7dd3fc;
    }
    return 0xffffff;
  }

  private weaponEnchantTint(level = 0): number {
    const value = Phaser.Math.Clamp(level, 0, 16);
    if (value >= 16) {
      return 0xff2d3f;
    }
    if (value >= 10) {
      return this.mixNumberColor(0x4c9cff, 0x0b5fff, (value - 10) / 5);
    }
    if (value >= 7) {
      return this.mixNumberColor(0xcfe5ff, 0x4c9cff, (value - 7) / 3);
    }
    if (value >= 5) {
      return this.mixNumberColor(0xffffff, 0xcfe5ff, (value - 5) / 2);
    }
    if (value > 0) {
      return this.mixNumberColor(0xffd98a, 0xffffff, (value - 1) / 4);
    }
    return 0xffffff;
  }

  private weaponEnchantStrength(level = 0): number {
    const value = Phaser.Math.Clamp(level, 0, 16);
    if (value <= 0) {
      return 0;
    }
    if (value <= 5) {
      return Phaser.Math.Linear(0.26, 0.38, (value - 1) / 4);
    }
    if (value <= 7) {
      return Phaser.Math.Linear(0.38, 0.46, (value - 5) / 2);
    }
    if (value <= 10) {
      return Phaser.Math.Linear(0.46, 0.6, (value - 7) / 3);
    }
    if (value <= 15) {
      return Phaser.Math.Linear(0.6, 0.84, (value - 10) / 5);
    }
    return 0.9;
  }

  private weaponEnchantSurfaceMix(level = 0): number {
    const value = Phaser.Math.Clamp(level, 0, 16);
    if (value >= 16) {
      return 0.42;
    }
    if (value >= 10) {
      return Phaser.Math.Linear(0.24, 0.4, (value - 10) / 5);
    }
    if (value >= 7) {
      return Phaser.Math.Linear(0.14, 0.24, (value - 7) / 3);
    }
    if (value >= 5) {
      return Phaser.Math.Linear(0.1, 0.14, (value - 5) / 2);
    }
    return value > 0 ? Phaser.Math.Linear(0.06, 0.1, (value - 1) / 4) : 0;
  }

  private positionWeaponEnchant(view: PlayerView, player: PlayerPublicState, position: Vector2, weaponRotation: number, fullDetail = true): void {
    if (this.isPlayerSinging(player)) {
      view.weaponGlow.setVisible(false);
      view.weaponSmoke.forEach((smoke) => smoke.setVisible(false));
      return;
    }

    const level = player.weaponEnchantLevel ?? 0;
    const visible = player.hp > 0 && !player.downed && level > 0;
    const color = this.weaponEnchantTint(level);
    const strength = this.weaponEnchantStrength(level);
    const red = level >= 16;
    if (!visible) {
      view.weaponGlow.setVisible(false);
      view.weaponSmoke.forEach((smoke) => smoke.setVisible(false));
      return;
    }

    const mobile = this.isMobileTouchMode();
    const glowCenter = mobile ? { x: Math.round(position.x), y: Math.round(position.y) } : position;
    const pulse = (Math.sin(this.time.now / (red ? 320 : 460) + level * 0.17) + 1) * 0.5;
    const weaponScale = this.playerWeaponScale(player);
    const glowScale = weaponScale * (1 + pulse * (0.008 + strength * 0.012));
    const classGlowBoost = player.classId === "mage" ? 1.18 : player.classId === "assassin" ? 1.08 : 1;
    const glowAlpha = (strength + pulse * (0.04 + strength * 0.055)) * classGlowBoost;

    view.weaponGlow
      .setVisible(true)
      .setTexture(`weapon-glow-${player.classId}`)
      .setPosition(glowCenter.x, glowCenter.y)
      .setRotation(weaponRotation)
      .setScale(glowScale)
      .setTint(color)
      .setAlpha(Math.min(0.92, glowAlpha));

    const allowParticles = fullDetail && (!mobile || this.mobileGraphics.combatEffects);
    const desktopParticleCount = player.classId === "assassin" ? (level >= 10 ? 4 : 2) : level >= 15 ? 4 : level >= 10 ? 3 : 2;
    const particleCount = allowParticles
      ? mobile
        ? player.classId === "assassin"
          ? 2
          : Math.min(desktopParticleCount, level >= 15 ? 3 : 2)
        : desktopParticleCount
      : 0;
    const forward = { x: Math.cos(weaponRotation), y: Math.sin(weaponRotation) };
    const side = { x: -Math.sin(weaponRotation), y: Math.cos(weaponRotation) };

    view.weaponSmoke.forEach((smoke, index) => {
      if (index >= particleCount) {
        smoke.setVisible(false);
        return;
      }

      const phase = this.time.now / (red ? 430 : 620) + index * 0.88 + level * 0.13;
      const local = this.weaponEnchantParticlePoint(player.classId, index, particleCount, phase);
      const localX = local.x * weaponScale;
      const localY = local.y * weaponScale;
      const twinkle = (Math.sin(phase) + 1) * 0.5;
      const baseRadius = 1.05 + strength * (red ? 1.45 : 1.05);
      const radius = baseRadius * (player.classId === "archer" ? 0.82 : 1) + twinkle * 0.35;
      const sparkColor = index % 2 === 0 ? color : this.mixNumberColor(color, 0xffffff, 0.48);
      smoke
        .setVisible(true)
        .setFillStyle(sparkColor, (0.12 + strength * 0.2 + twinkle * 0.08) * (mobile ? 0.88 : 1))
        .setPosition(glowCenter.x + forward.x * localX + side.x * localY, glowCenter.y + forward.y * localX + side.y * localY)
        .setScale(radius / 2);
    });
  }

  private weaponEnchantParticlePoint(
    classId: PlayerPublicState["classId"],
    index: number,
    count: number,
    phase: number
  ): Vector2 {
    const progress = count <= 1 ? 0.5 : index / (count - 1);
    const drift = Math.sin(phase) * 1.1;
    if (classId === "archer") {
      const theta = -1.16 + progress * 2.32;
      const radius = 34 + drift;
      return {
        x: -13 + Math.cos(theta) * radius,
        y: Math.sin(theta) * radius
      };
    }
    if (classId === "assassin") {
      const lane = index % 2;
      const laneIndex = Math.floor(index / 2);
      const laneCount = Math.ceil((count - lane) / 2);
      const laneProgress = laneCount <= 1 ? 0.66 : Phaser.Math.Linear(0.28, 0.86, laneIndex / (laneCount - 1));
      const path: Vector2[] =
        lane === 0
          ? [
              { x: -7, y: -4 },
              { x: -1, y: -6 },
              { x: 5, y: -9 },
              { x: 11, y: -13 },
              { x: 16, y: -17 },
              { x: 19, y: -19 }
            ]
          : [
              { x: -7, y: 4 },
              { x: -1, y: 6 },
              { x: 5, y: 9 },
              { x: 11, y: 13 },
              { x: 16, y: 17 },
              { x: 19, y: 19 }
            ];
      const pathPosition = laneProgress * (path.length - 1);
      const segmentIndex = Math.min(path.length - 2, Math.floor(pathPosition));
      const segmentProgress = pathPosition - segmentIndex;
      const from = path[segmentIndex];
      const to = path[segmentIndex + 1];
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const length = Math.max(1, Math.hypot(dx, dy));
      const normal = { x: -dy / length, y: dx / length };
      return {
        x: Phaser.Math.Linear(from.x, to.x, segmentProgress) + normal.x * drift * 0.3,
        y: Phaser.Math.Linear(from.y, to.y, segmentProgress) + normal.y * drift * 0.3
      };
    }

    const endpoints: Record<PlayerPublicState["classId"], { start: Vector2; end: Vector2 }> = {
      warrior: { start: { x: -18, y: 28 }, end: { x: 18, y: -26 } },
      mage: { start: { x: -18, y: 30 }, end: { x: 19, y: -27 } },
      tank: { start: { x: -22, y: 34 }, end: { x: 24, y: -24 } },
      archer: { start: { x: 0, y: 0 }, end: { x: 0, y: 0 } },
      assassin: { start: { x: 0, y: 0 }, end: { x: 0, y: 0 } }
    };
    const geometry = endpoints[classId];
    const pathProgress = classId === "mage" ? 0.5 + progress * 0.5 : progress;
    const dx = geometry.end.x - geometry.start.x;
    const dy = geometry.end.y - geometry.start.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const normal = { x: -dy / length, y: dx / length };
    return {
      x: Phaser.Math.Linear(geometry.start.x, geometry.end.x, pathProgress) + normal.x * drift * 0.55,
      y: Phaser.Math.Linear(geometry.start.y, geometry.end.y, pathProgress) + normal.y * drift * 0.55
    };
  }

  private playerLabelText(player: PlayerPublicState): string {
    const clanPrefix = player.clanTag ? `[${player.clanTag}] ` : "";
    const identity = `${clanPrefix}${player.name} ${this.levelLabel(player.level)}`;
    if (player.downed) {
      return `${identity} ${this.tr("[revive]")}`;
    }
    if (player.karma > 0) {
      return `${identity} [PK ${Math.ceil(player.karma / 100)}]`;
    }
	    if (this.isPlayerPvpFlagged(player)) {
	      return `${identity} [PvP]`;
	    }
	    if (player.marketVendor?.items.length) {
	      return `${identity} [${this.tr("Selling {count}", { count: player.marketVendor.items.length })}]`;
	    }
	    return `${identity}${player.zone === "safe" ? ` ${this.tr("[safe]")}` : ""}`;
	  }

	  private playerLabelColor(player: PlayerPublicState): string {
	    if (player.karma > 0) {
	      return "#ef4444";
	    }
    if (player.marketVendor?.items.length) {
      return "#facc15";
    }
    const pvpFlagRemainingMs = this.playerPvpFlagRemainingMs(player);
    if (pvpFlagRemainingMs > 0) {
      if (pvpFlagRemainingMs <= PVP_FLAG_FADE_MS) {
        const fade = 1 - pvpFlagRemainingMs / PVP_FLAG_FADE_MS;
        const blinkToNormal = pvpFlagRemainingMs <= 3_400 && Math.floor(this.time.now / 220) % 2 === 0;
        return blinkToNormal ? "#f8fafc" : this.mixHexColor(0xfb7185, 0xf8fafc, fade);
      }
      return "#fb7185";
    }
    if (player.id === this.localPlayerId) {
      return "#bbf7d0";
    }
    return "#f8fafc";
  }

  private isPlayerPvpFlagged(player: PlayerPublicState): boolean {
    return this.playerPvpFlagRemainingMs(player) > 0;
  }

  private playerPvpFlagRemainingMs(player: PlayerPublicState): number {
    return Math.max(0, (player.pvpFlagUntil ?? 0) - (this.snapshot?.serverTime ?? Date.now()));
  }

  private mixHexColor(from: number, to: number, ratio: number): string {
    const clamped = Phaser.Math.Clamp(ratio, 0, 1);
    const fromRed = (from >> 16) & 0xff;
    const fromGreen = (from >> 8) & 0xff;
    const fromBlue = from & 0xff;
    const toRed = (to >> 16) & 0xff;
    const toGreen = (to >> 8) & 0xff;
    const toBlue = to & 0xff;
    const red = Math.round(Phaser.Math.Linear(fromRed, toRed, clamped));
    const green = Math.round(Phaser.Math.Linear(fromGreen, toGreen, clamped));
    const blue = Math.round(Phaser.Math.Linear(fromBlue, toBlue, clamped));
    return `#${red.toString(16).padStart(2, "0")}${green.toString(16).padStart(2, "0")}${blue.toString(16).padStart(2, "0")}`;
  }

  private renderMonster(monster: MonsterState): void {
    let view = this.monsters.get(monster.id);
    const size = this.monsterDrawSize(monster);
    const serverTime = this.snapshot?.serverTime ?? Date.now();
    const loadedSpriteSkin = this.loadedMonsterSpriteSkin(monster);
    if (!loadedSpriteSkin && monster.spritePackId && this.isPositionNearCamera(monster.position, 720)) {
      requestMonsterSpriteAsset(this, monster.spritePackId);
    }
    if (view && !view.spriteSkin && loadedSpriteSkin) {
      view.spriteSkin = loadedSpriteSkin;
      view.animationState = "idle";
      view.animationStartedAt = this.time.now;
      view.lastAnimationFrame = "";
      view.body.setTexture(loadedSpriteSkin.atlasKey, monsterSpriteFrameName(loadedSpriteSkin, "idle", 0));
    }
    if (!view) {
      const spriteSkin = loadedSpriteSkin;
      const initialFrame = spriteSkin
        ? monsterSpriteFrameName(spriteSkin, "idle", this.stableHash(`${monster.id}:idle-frame`) % monsterSpriteFrameCount(spriteSkin, "idle"))
        : undefined;
      const animationStartedAt = this.time.now - (this.stableHash(`${monster.id}:idle-phase`) % monsterSpriteStateDurationMs("idle", spriteSkin));
      view = {
        body: this.add
          .image(monster.position.x, monster.position.y, spriteSkin?.atlasKey ?? this.monsterTexture(monster), initialFrame)
          .setDepth(8)
          .setDisplaySize(size.width, size.height),
        spriteSkin,
        animationState: spriteSkin ? "idle" : undefined,
        animationStartedAt,
        lastAnimationFrame: initialFrame ?? "",
        lastAnimatedAttackCueAt: Number.NEGATIVE_INFINITY,
        lastHitCueAt: Number.NEGATIVE_INFINITY,
        diedAt: 0,
        feet: this.createMonsterFeet(monster),
        label: this.add
          .text(monster.position.x, monster.position.y - size.height / 2 - 14, this.nameWithLevel(this.monsterDisplayName(monster), monster.level), {
            color: "#f8fafc",
            fontFamily: "Inter, sans-serif",
            fontSize: "9px"
          })
          .setOrigin(0.5)
          .setDepth(9),
        hp: this.add.rectangle(monster.position.x, monster.position.y - size.height / 2 - 8, size.width * 0.72, 3, 0xef4444).setDepth(9),
        lastPosition: { ...monster.position },
        serverPosition: { ...monster.position },
        velocity: monster.velocity ?? { x: 0, y: 0 },
        positionHistory: [{ position: { ...monster.position }, serverTime }],
        facingAngle: 0,
        idleSeed: this.stableHash(monster.id) * 0.01,
        lastServerAt: this.time.now,
        lastHp: monster.hp,
        wasRespawning: Boolean(monster.respawnsAt) || monster.hp <= 0,
        lastAttackCueAt: Number.NEGATIVE_INFINITY,
        spawnedAt: this.renderedInitialSnapshot ? this.time.now : this.time.now - monsterSpriteStateDurationMs("spawn", spriteSkin),
        lastLabelText: "",
        lastLabelColor: ""
      };
      this.monsters.set(monster.id, view);
    }

    const isRespawning = Boolean(monster.respawnsAt) || monster.hp <= 0;
    const diedNow = !view.wasRespawning && view.lastHp > 0 && monster.hp <= 0;
    if (diedNow) {
      view.diedAt = this.time.now;
      view.animationState = undefined;
      this.renderMonsterDeathFeedback(monster, view.lastPosition);
    }
    const damagedNow = !isRespawning && monster.hp > 0 && monster.hp < view.lastHp;
    if (damagedNow) {
      view.lastHitCueAt = this.time.now;
    }
    const justRespawned = (view.wasRespawning || view.lastHp <= 0) && !isRespawning;
    if (justRespawned) {
      view.spawnedAt = this.time.now;
      view.diedAt = 0;
      view.animationState = undefined;
    }
    const arrivalElapsedSeconds = Math.max(0.016, (this.time.now - view.lastServerAt) / 1000);
    const previousNetworkSample = view.positionHistory[view.positionHistory.length - 1];
    const serverElapsedSeconds =
      previousNetworkSample && serverTime > previousNetworkSample.serverTime
        ? Phaser.Math.Clamp((serverTime - previousNetworkSample.serverTime) / 1000, 0.016, 5)
        : arrivalElapsedSeconds;
    const serverJumpDistance = Phaser.Math.Distance.Between(view.serverPosition.x, view.serverPosition.y, monster.position.x, monster.position.y);
    const inferredVelocity = {
      x: (monster.position.x - view.serverPosition.x) / serverElapsedSeconds,
      y: (monster.position.y - view.serverPosition.y) / serverElapsedSeconds
    };
    const serverVelocity = monster.velocity ?? inferredVelocity;
    const serverSpeed = Math.hypot(serverVelocity.x, serverVelocity.y);
    const previousSpeed = Math.hypot(view.velocity.x, view.velocity.y);
    const plausibleTravelDistance = Math.max(serverSpeed, previousSpeed) * Math.min(serverElapsedSeconds, 1.2);
    const warpSnapDistance = Math.max(300, plausibleTravelDistance * 1.25 + 96);
    const targetVelocity = serverVelocity;
    const authoritativeStop = monster.velocity !== undefined && serverSpeed <= 4;
    if (isRespawning || justRespawned || serverJumpDistance > warpSnapDistance) {
      this.resetNetworkPositionHistory(view.positionHistory, monster.position, serverTime);
    } else {
      this.pushNetworkPositionSample(view.positionHistory, monster.position, serverTime);
    }
    view.serverPosition = { ...monster.position };
    const velocityBlend = this.isMobileTouchMode() ? 0.42 : 0.5;
    view.velocity =
      isRespawning || justRespawned || authoritativeStop
        ? targetVelocity
        : {
            x: Phaser.Math.Linear(view.velocity.x, targetVelocity.x, velocityBlend),
            y: Phaser.Math.Linear(view.velocity.y, targetVelocity.y, velocityBlend)
          };
    view.lastServerAt = this.time.now;
    const snapDistance = Phaser.Math.Distance.Between(view.lastPosition.x, view.lastPosition.y, monster.position.x, monster.position.y);
    if (justRespawned || snapDistance > warpSnapDistance || isRespawning) {
      this.resetNetworkPositionHistory(view.positionHistory, monster.position, serverTime);
      view.lastPosition = { ...monster.position };
    }
    view.lastHp = monster.hp;
    view.wasRespawning = isRespawning;
    this.positionMonsterView(view, monster, view.lastPosition);
  }

  private renderMonsterDeathFeedback(monster: MonsterState, position: Vector2): void {
    const localKill = this.wasRecentlyDamagedByLocal(monster.id);
    const important = localKill || monster.id === this.selectedTargetId;
    const local = this.localPlayer();
    const localPosition = local ? this.localRenderPosition(local) : undefined;
    const nearLocal = !localPosition || this.distanceSquared(position, localPosition) <= 1800 * 1800;
    const onScreen = this.isPositionNearCamera(position, 420);
    if (this.isMobileTouchMode() && !this.mobileGraphics.combatEffects) {
      return;
    }
    if (this.isMobileTouchMode() && !important) {
      return;
    }
    if (!important && (!onScreen || !nearLocal || this.isCrowdedScene())) {
      return;
    }

    const bossLike = monster.archetype === "boss" || monster.archetype === "dungeonboss" || monster.archetype === "miniboss" || monster.archetype === "dragon";
    const color = bossLike ? 0xfacc15 : monster.archetype === "wraith" ? 0xa78bfa : 0xf97316;
    const size = this.monsterDrawSize(monster);
    const baseRadius = Math.max(24, Math.min(70, Math.max(size.width, size.height) * 0.52));
    const shock = this.add.circle(position.x, position.y, baseRadius * 0.55, color, bossLike ? 0.18 : 0.12).setStrokeStyle(bossLike ? 5 : 4, color, bossLike ? 0.86 : 0.68).setDepth(86);
    const flash = this.add.ellipse(position.x, position.y - size.height * 0.16, size.width * 0.82, size.height * 0.72, bossLike ? 0xfef3c7 : 0xffffff, bossLike ? 0.22 : 0.14).setDepth(85);
    const shadow = this.add.ellipse(position.x, position.y + size.height * 0.25, size.width * 0.86, size.height * 0.22, 0x020617, 0.3).setDepth(7.2);

    this.tweens.add({ targets: shock, scale: bossLike ? 3.05 : 2.45, alpha: 0, duration: bossLike ? 780 : 520, ease: "Sine.easeOut", onComplete: () => shock.destroy() });
    this.tweens.add({ targets: flash, scale: bossLike ? 2.05 : 1.62, alpha: 0, duration: bossLike ? 470 : 340, ease: "Sine.easeOut", onComplete: () => flash.destroy() });
    this.tweens.add({ targets: shadow, scaleX: 1.65, alpha: 0, duration: 480, ease: "Sine.easeOut", onComplete: () => shadow.destroy() });

    const mobile = this.isMobileTouchMode();
    const particleCount = mobile ? (important ? (bossLike ? 14 : 9) : 0) : important ? (bossLike ? 20 : 14) : 8;
    for (let index = 0; index < particleCount; index += 1) {
      const angle = (Math.PI * 2 * index) / particleCount + this.stableHash(`${monster.id}:death:${index}`) * 0.0005;
      const distance = baseRadius * (bossLike ? 1.35 : 1.05) + (index % 4) * 9;
      const ember = this.add.circle(position.x, position.y - size.height * 0.22, bossLike ? 4.6 : 3.5, index % 3 === 0 ? 0xfef3c7 : color, bossLike ? 0.9 : 0.72).setDepth(87);
      this.tweens.add({
        targets: ember,
        x: position.x + Math.cos(angle) * distance,
        y: position.y + Math.sin(angle) * distance * 0.58,
        alpha: 0,
        scale: 0.25,
        duration: bossLike ? 720 : 520,
        ease: "Cubic.easeOut",
        onComplete: () => ember.destroy()
      });
    }

    if (important) {
      const text = this.add
        .text(position.x, position.y - size.height * 0.72, this.tr(bossLike ? "BIG KILL" : "KILL"), {
          color: bossLike ? "#fef3c7" : "#fed7aa",
          fontFamily: "Inter, sans-serif",
          fontSize: bossLike ? "22px" : "18px",
          fontStyle: "900",
          stroke: "#1c1917",
          strokeThickness: 5
        })
        .setOrigin(0.5)
        .setDepth(90);
      this.tweens.add({ targets: text, y: text.y - 34, scale: 1.16, alpha: 0, delay: 180, duration: 680, ease: "Sine.easeIn", onComplete: () => text.destroy() });
      this.cameras.main.shake(bossLike ? (mobile ? 150 : 165) : mobile ? 115 : 96, bossLike ? (mobile ? 0.0048 : 0.005) : mobile ? 0.0038 : 0.0032);
      this.playMonsterKillSound(bossLike);
    }
  }

  private renderPlayerDefeatFeedback(position: Vector2, important: boolean, localKill = false): void {
    const mobile = this.isMobileTouchMode();
    if (mobile && (!this.mobileGraphics.combatEffects || (!important && !localKill))) {
      return;
    }

    const color = 0xfb7185;
    const shock = this.add.circle(position.x, position.y, 24, color, 0.13).setStrokeStyle(4, color, 0.72).setDepth(86);
    const flash = this.add.ellipse(position.x, position.y - 18, 48, 42, 0xfef2f2, 0.16).setDepth(85);
    this.tweens.add({ targets: shock, scale: important ? 2.7 : 1.9, alpha: 0, duration: important ? 560 : 360, ease: "Sine.easeOut", onComplete: () => shock.destroy() });
    this.tweens.add({ targets: flash, scale: important ? 1.7 : 1.3, alpha: 0, duration: 320, ease: "Sine.easeOut", onComplete: () => flash.destroy() });

    const particleCount = mobile ? 7 : 11;
    for (let index = 0; index < particleCount; index += 1) {
      const angle = (Math.PI * 2 * index) / particleCount;
      const spark = this.add.circle(position.x, position.y - 14, 3.2, index % 2 === 0 ? 0xfef2f2 : color, 0.76).setDepth(87);
      this.tweens.add({
        targets: spark,
        x: position.x + Math.cos(angle) * (42 + (index % 3) * 8),
        y: position.y + Math.sin(angle) * 26 - 14,
        alpha: 0,
        scale: 0.25,
        duration: 430,
        ease: "Cubic.easeOut",
        onComplete: () => spark.destroy()
      });
    }

    if (localKill) {
      const text = this.add
        .text(position.x, position.y - 52, this.tr("KILL"), {
          color: "#fed7aa",
          fontFamily: "Inter, sans-serif",
          fontSize: mobile ? "18px" : "19px",
          fontStyle: "900",
          stroke: "#1c1917",
          strokeThickness: 5
        })
        .setOrigin(0.5)
        .setDepth(90);
      this.tweens.add({ targets: text, y: text.y - 34, scale: 1.14, alpha: 0, delay: 160, duration: 680, ease: "Sine.easeIn", onComplete: () => text.destroy() });
      this.cameras.main.shake(mobile ? 115 : 96, mobile ? 0.0038 : 0.0032);
      this.playMonsterKillSound(false);
    } else if (important) {
      this.cameras.main.shake(mobile ? 105 : 88, mobile ? 0.0034 : 0.0028);
    }
  }

  private wasRecentlyDamagedByLocal(targetId: string): boolean {
    if (!this.localPlayerId || !this.snapshot) {
      return false;
    }

    const now = this.snapshot.serverTime ?? Date.now();
    return this.snapshot.events.some(
      (event) => event.targetId === targetId && event.sourceId === this.localPlayerId && (event.kind === "attack" || event.kind === "skill") && Math.abs(now - event.at) <= 1400
    );
  }

  private positionMonsterView(view: MonsterView, monster: MonsterState, position: Vector2): void {
    const size = this.monsterDrawSize(monster);
    const variant = this.monsterVisualVariant(monster);
    const spriteHeight = size.height * variant.scale * (view.spriteSkin?.heightScale ?? 1);
    const visualSize = view.spriteSkin
      ? { width: spriteHeight * view.spriteSkin.aspectRatio, height: spriteHeight }
      : { width: size.width * variant.scale, height: spriteHeight };
    const cullMargin = this.isMobileTouchMode()
      ? this.mobileEntityCullMargin("monster", this.isCrowdedScene())
      : this.desktopEntityCullMargin("monster", this.isCrowdedScene());
    if (monster.id !== this.selectedTargetId && !this.isPositionNearCamera(position, cullMargin)) {
      this.setMonsterViewVisible(view, false);
      return;
    }
    this.setMonsterViewVisible(view, true);

    const alive = monster.hp > 0;
    const spawnProgress = Phaser.Math.Clamp((this.time.now - view.spawnedAt) / MONSTER_SPAWN_FADE_MS, 0, 1);
    const spawnEase = Phaser.Math.Easing.Sine.Out(spawnProgress);
    const spawnScale = alive ? 0.82 + spawnEase * 0.18 : 1;
    const deathProgress = alive
      ? 0
      : Phaser.Math.Clamp((this.time.now - (view.diedAt || this.time.now)) / monsterSpriteStateDurationMs("death", view.spriteSkin), 0, 1);
    const alpha = alive ? 0.18 + spawnEase * 0.82 : Phaser.Math.Linear(0.96, 0.24, deathProgress);
    const target = monster.targetId ? this.snapshot?.players.find((player) => player.id === monster.targetId && player.hp > 0) : undefined;
    const faceVector = target
      ? { x: this.localRenderPosition(target).x - position.x, y: this.localRenderPosition(target).y - position.y }
      : view.velocity;
    const speed = Math.hypot(view.velocity.x, view.velocity.y);
    const moving = alive && speed > 5;
    const nextFaceAngle = Math.atan2(faceVector.y, faceVector.x);
    const faceAngle = Number.isFinite(nextFaceAngle) && (target || speed > 2) ? nextFaceAngle : view.facingAngle;
    view.facingAngle = Number.isFinite(faceAngle) ? faceAngle : 0;
    const attackAge = this.time.now - view.lastAttackCueAt;
    const attackPulse = alive && attackAge >= 0 && attackAge < 260 ? Math.sin((1 - attackAge / 260) * Math.PI) : 0;
    const hitAge = this.time.now - view.lastHitCueAt;
    const hitPulse = alive && hitAge >= 0 && hitAge < 180 ? Math.sin((hitAge / 180) * Math.PI) : 0;
    const forward = { x: Math.cos(view.facingAngle), y: Math.sin(view.facingAngle) };

    const walkRate = Math.max(64, 118 - Math.min(160, speed) * 0.22);
    const phase = this.time.now / (moving && attackPulse <= 0 ? walkRate : 320) + view.idleSeed;
    const idlePhase = this.time.now / 1000 + view.idleSeed;
    const attacking = attackPulse > 0;
    const atlasBacked = this.updateMonsterSpriteFrame(view, monster, moving);
    const breathe = alive
      ? 1 + Math.sin(idlePhase * 2.3) * (atlasBacked ? (moving && !attacking ? 0.003 : 0.007) : moving && !attacking ? 0.02 : 0.045)
      : 1;
    const bob = alive ? Math.sin(phase) * (atlasBacked ? (moving && !attacking ? 0.48 : 0.24) : moving && !attacking ? 2.35 : 0.9) : 0;
    const idleSide = !moving && alive ? Math.sin(idlePhase * 1.55) * (atlasBacked ? 0.2 : 0.8) : 0;
    const idleNod = !moving && alive ? Math.cos(idlePhase * 1.15) * (atlasBacked ? 0.12 : 0.45) : 0;
    const side = { x: -Math.sin(view.facingAngle), y: Math.cos(view.facingAngle) };
    const rotation = atlasBacked
      ? (alive ? Math.sin(phase) * (moving && !attacking ? 0.006 : 0.003) : 0) + attackPulse * 0.012
      : view.facingAngle * 0.05 + (alive ? Math.sin(phase) * (moving && !attacking ? 0.035 : 0.02) : 0) + attackPulse * 0.08;
    if (!atlasBacked && view.body.texture.key !== this.monsterTexture(monster)) {
      view.body.setTexture(this.monsterTexture(monster));
    }
    const attackLunge = atlasBacked ? 4 : 8;
    view.body
      .setDisplaySize(
        visualSize.width * (breathe + attackPulse * 0.018 + hitPulse * 0.025) * spawnScale,
        visualSize.height * (1 + (breathe - 1) * 0.7 - hitPulse * 0.035) * spawnScale
      )
      .setAlpha(alpha)
      .setPosition(
        position.x + side.x * idleSide + forward.x * (attackPulse * attackLunge - hitPulse * 2.8),
        position.y + side.y * idleSide + bob + idleNod + forward.y * (attackPulse * attackLunge - hitPulse * 2.8) + (1 - spawnEase) * 10
      )
      .setRotation(rotation)
      .setFlipX(Math.cos(view.facingAngle) < 0);
    if (hitPulse > 0.08) {
      view.body.setTintFill(0xffe2c2);
    } else {
      view.body.setTint(variant.tint);
    }
    const compactCrowdMonster = this.isMobileTouchMode() && this.isCrowdedScene() && monster.id !== this.selectedTargetId;
    if (compactCrowdMonster) {
      view.feet.forEach((foot) => foot.setVisible(false));
      view.label.setVisible(false);
      view.hp.setVisible(false);
      return;
    }

    this.positionMonsterFeet(view, monster, position, visualSize, view.facingAngle, phase, moving, alpha);
    view.label.setVisible(true).setAlpha(alpha);
    const labelText = this.nameWithLevel(this.monsterDisplayName(monster), monster.level);
    if (variant.labelColor !== view.lastLabelColor) {
      view.label.setColor(variant.labelColor);
      view.lastLabelColor = variant.labelColor;
    }
    if (labelText !== view.lastLabelText) {
      view.label.setText(labelText);
      view.lastLabelText = labelText;
    }
    // Pack 12 keeps a 128px bottom-pivot source canvas around a much shorter trimmed figure.
    // Anchor its metadata to the visible frame, otherwise the transparent top padding lifts it far above the head.
    const bodyTop =
      view.spriteSkin?.packId === 12 && view.body.frame.trimmed
        ? view.body.y + (view.body.frame.y - view.body.displayOriginY) * Math.abs(view.body.scaleY)
        : view.body.y - view.body.displayHeight * view.body.originY;
    view.label.setPosition(position.x, bodyTop - 14);
    view.hp.setVisible(true).setAlpha(alpha);
    const hpWidth = visualSize.width * 0.72;
    view.hp.setPosition(position.x - (hpWidth - hpWidth * (monster.hp / monster.maxHp)) / 2, bodyTop - 8);
    view.hp.width = Math.max(1, hpWidth * (monster.hp / monster.maxHp));
  }

  private loadedMonsterSpriteSkin(monster: MonsterState): MonsterSpriteSkin | undefined {
    const skin = monsterSpriteSkinFor(monster.spritePackId);
    if (!skin || !this.textures.exists(skin.atlasKey)) {
      return undefined;
    }
    const idleFrame = monsterSpriteFrameName(skin, "idle", 0);
    const texture = this.textures.get(skin.atlasKey);
    if (!texture.has(idleFrame)) {
      return undefined;
    }
    if (skin.pixelArt && !this.configuredMonsterTextureFilters.has(texture)) {
      texture.setFilter(skin.smoothDownscale ? Phaser.Textures.FilterMode.LINEAR : Phaser.Textures.FilterMode.NEAREST);
      this.configuredMonsterTextureFilters.add(texture);
    }
    return skin;
  }

  private updateMonsterSpriteFrame(view: MonsterView, monster: MonsterState, moving: boolean): boolean {
    const skin = view.spriteSkin;
    if (!skin || !this.textures.exists(skin.atlasKey)) {
      return false;
    }

    const now = this.time.now;
    const alive = monster.hp > 0;
    const attackActive = alive && now - view.lastAttackCueAt >= 0 && now - view.lastAttackCueAt < monsterSpriteStateDurationMs("attack", skin);
    const spawnActive = alive && now - view.spawnedAt >= 0 && now - view.spawnedAt < monsterSpriteStateDurationMs("spawn", skin);
    const state: MonsterSpriteState = !alive ? "death" : attackActive ? "attack" : spawnActive ? "spawn" : moving ? "move" : "idle";
    const restartedAttack = state === "attack" && view.lastAttackCueAt > view.lastAnimatedAttackCueAt;

    if (view.animationState !== state || restartedAttack) {
      view.animationState = state;
      if (state === "death") {
        view.animationStartedAt = view.diedAt || now;
      } else if (state === "spawn") {
        view.animationStartedAt = view.spawnedAt;
      } else if (state === "attack") {
        view.animationStartedAt = now;
        view.lastAnimatedAttackCueAt = view.lastAttackCueAt;
      } else {
        const duration = monsterSpriteStateDurationMs(state, skin);
        view.animationStartedAt = now - (this.stableHash(`${monster.id}:${state}`) % duration);
      }
      view.lastAnimationFrame = "";
    }

    const duration = monsterSpriteStateDurationMs(state, skin);
    const frameCount = monsterSpriteFrameCount(skin, state);
    let elapsed = Math.max(0, now - view.animationStartedAt);
    const mobileLowRate =
      this.isMobileTouchMode() &&
      monster.id !== this.selectedTargetId &&
      state !== "attack" &&
      state !== "death" &&
      (this.mobileLeanRuntime || this.mobileSustainedLeanRuntime || this.isCrowdedScene());
    if (mobileLowRate) {
      const stepMs = 1000 / 10;
      elapsed = Math.floor(elapsed / stepMs) * stepMs;
    }
    const looping = state === "idle" || state === "move";
    const progress = looping ? (elapsed % duration) / duration : Phaser.Math.Clamp(elapsed / duration, 0, 0.999999);
    const frameIndex = Math.min(frameCount - 1, Math.floor(progress * frameCount));
    const frameName = monsterSpriteFrameName(skin, state, frameIndex);
    if (frameName !== view.lastAnimationFrame) {
      const texture = this.textures.get(skin.atlasKey);
      if (!texture.has(frameName)) {
        return false;
      }
      view.body.setTexture(skin.atlasKey, frameName);
      view.lastAnimationFrame = frameName;
    }
    return true;
  }

  private setMonsterViewVisible(view: MonsterView, visible: boolean): void {
    if (view.body.visible === visible) {
      return;
    }
    view.body.setVisible(visible);
    view.feet.forEach((foot) => foot.setVisible(visible));
    view.label.setVisible(visible);
    view.hp.setVisible(visible);
  }

  private createMonsterFeet(monster: MonsterState): Phaser.GameObjects.Ellipse[] {
    if (this.loadedMonsterSpriteSkin(monster)) {
      return [this.add.ellipse(monster.position.x, monster.position.y, 24, 8, 0x020617, 0.3).setDepth(7.7).setSmoothness(16)];
    }
    const color = this.monsterFootColor(monster);
    return Array.from({ length: this.monsterFootCount(monster) }, () =>
      this.add
        .ellipse(monster.position.x, monster.position.y, 8, 4, color, 0.56)
        .setDepth(7.7)
        .setSmoothness(10)
    );
  }

  private positionMonsterFeet(
    view: MonsterView,
    monster: MonsterState,
    position: Vector2,
    size: { width: number; height: number },
    angle: number,
    phase: number,
    moving: boolean,
    alpha: number
  ): void {
    if (view.spriteSkin) {
      const shadow = view.feet[0];
      if (!shadow) {
        return;
      }
      view.feet.slice(1).forEach((foot) => foot.setVisible(false));
      const deathFade =
        monster.hp > 0
          ? 1
          : 1 - Phaser.Math.Clamp((this.time.now - (view.diedAt || this.time.now)) / monsterSpriteStateDurationMs("death", view.spriteSkin), 0, 1);
      const flightLift = view.spriteSkin.flying ? size.height * 0.12 : 0;
      // Pack 12 uses a bottom pivot: the boots already land exactly at position.y.
      const groundShadowDrop = view.spriteSkin.packId === 12 ? 2 : size.height * 0.35;
      shadow
        .setVisible(monster.hp > 0 || deathFade > 0.02)
        .setPosition(position.x, position.y + groundShadowDrop + flightLift)
        .setSize(Math.max(18, size.width * (view.spriteSkin.flying ? 0.56 : 0.64)), Math.max(5, size.height * 0.13))
        .setRotation(0)
        .setAlpha(alpha * deathFade * (view.spriteSkin.flying ? 0.24 : 0.34));
      return;
    }
    const visible = monster.hp > 0;
    const forward = { x: Math.cos(angle), y: Math.sin(angle) };
    const side = { x: -Math.sin(angle), y: Math.cos(angle) };
    const pairs = Math.max(1, Math.ceil(view.feet.length / 2));
    const sideSpread = size.width * (monster.archetype === "spider" ? 0.29 : 0.22);
    const frontBack = size.height * (monster.archetype === "spider" ? 0.18 : 0.13);
    const baseDrop = size.height * (monster.archetype === "wraith" ? 0.22 : 0.31);
    const footWidth = Math.max(5, size.width * (monster.archetype === "spider" ? 0.13 : 0.16));
    const footHeight = Math.max(3, size.height * (monster.archetype === "spider" ? 0.06 : 0.075));
    const stepDistance = Math.min(7, size.height * 0.12);
    const liftDistance = Math.min(3, size.height * 0.05);

    view.feet.forEach((foot, index) => {
      const pairIndex = Math.floor(index / 2);
      const sideSign = index % 2 === 0 ? -1 : 1;
      const rowOffset = pairs <= 1 ? 0 : (pairIndex / (pairs - 1)) * 2 - 1;
      const gait = phase + pairIndex * 1.2 + (sideSign > 0 ? Math.PI : 0);
      const idleGait = gait * 0.78;
      const step = moving ? Math.sin(gait) * stepDistance : Math.sin(idleGait) * 1.45;
      const lift = moving ? Math.max(0, Math.sin(gait)) * liftDistance : Math.max(0, Math.sin(idleGait)) * 0.35;
      const sway = moving ? Math.cos(gait) * 1.1 : Math.sin(gait) * 0.6;
      const footAlpha = moving ? 0.76 : 0.48 + Math.max(0, Math.sin(idleGait)) * 0.1;
      const footX = position.x + side.x * (sideSign * sideSpread + sway) + forward.x * (rowOffset * frontBack + step);
      const footY =
        position.y +
        baseDrop +
        side.y * (sideSign * sideSpread * 0.32 + sway) +
        forward.y * (rowOffset * frontBack + step) -
        lift;

      foot
        .setVisible(visible)
        .setPosition(footX, footY)
        .setSize(footWidth, footHeight)
        .setAlpha(alpha * footAlpha)
        .setRotation(angle + sideSign * 0.22);
    });
  }

  private monsterFootCount(monster: MonsterState): number {
    if (monster.archetype === "bat" || monster.archetype === "eye") {
      return 0;
    }
    if (monster.archetype === "dragon") {
      return 6;
    }
    if (monster.archetype === "spider" || monster.archetype === "miniboss" || monster.archetype === "dungeonboss" || monster.archetype === "boss") {
      return 6;
    }
    if (monster.archetype === "wraith" || monster.archetype === "skeleton" || monster.archetype === "archer" || monster.archetype === "mage") {
      return 2;
    }
    return 4;
  }

  private monsterFootColor(monster: MonsterState): number {
    const byType: Record<string, number> = {
      wolf: 0x2b1710,
      boar: 0x3a2018,
      spider: 0x17112f,
      bat: 0x111827,
      skeleton: 0xe5e7eb,
      bandit: 0x111827,
      archer: 0x14532d,
      mage: 0x1e1b4b,
      golem: 0x334155,
      wraith: 0x4c1d95,
      drake: 0x4a160f,
      eye: 0x7e22ce,
      witch: 0x2e1065,
      dragon: 0x7f1d1d,
      sentinel: 0x334155,
      miniboss: 0x1f2937,
      dungeonboss: 0x312e81,
      boss: 0x4c0519
    };
    const base = byType[monster.archetype] ?? 0x1f2937;
    const regionTint = this.monsterRegionTint(monster);
    return regionTint === 0xffffff ? base : this.mixNumberColor(base, regionTint, 0.24);
  }

  private monsterVisualVariant(monster: MonsterState): { tint: number; labelColor: string; scale: number } {
    const regionTint = this.monsterRegionTint(monster);
    const atlasBacked = Boolean(this.loadedMonsterSpriteSkin(monster));
    const tint = atlasBacked && regionTint !== 0xffffff ? this.mixNumberColor(0xffffff, regionTint, 0.12) : atlasBacked ? 0xffffff : regionTint;
    const scaleSeed = this.stableHash(`${monster.id}:visual`) % 7;
    return {
      tint,
      labelColor: this.monsterRegionLabelColor(monster),
      scale: 0.97 + scaleSeed * 0.008
    };
  }

  private monsterRegionTint(monster: MonsterState): number {
    const id = monster.id;
    if (id.includes("sunspire") || id.includes("ember") || id.includes("forge") || id.includes("ashroad")) {
      return 0xffc078;
    }
    if (id.includes("moonfen") || id.includes("harbor") || id.includes("mirror")) {
      return 0x99f6e4;
    }
    if (id.includes("frost") || id.includes("north") || id.includes("sky") || id.includes("spine")) {
      return 0xbfdbfe;
    }
    if (id.includes("deepgate") || id.includes("rift") || id.includes("blackroot") || id.includes("ravenwood")) {
      return 0xc4b5fd;
    }
    if (id.includes("crown") || id.includes("iron") || id.includes("obsidian")) {
      return 0xe2e8f0;
    }
    if (id.includes("starfall") || id.includes("star-") || id.includes("star-road")) {
      return 0xf0abfc;
    }
    if (id.includes("riverbend") || id.includes("southreach") || id.includes("suntrail") || id.includes("oldmill") || id.includes("greenhill") || id.includes("wolfden") || id.includes("highspring") || id.includes("mistwood") || id.includes("mistford")) {
      return 0xbbf7d0;
    }
    return 0xffffff;
  }

  private monsterRegionLabelColor(monster: MonsterState): string {
    const tint = this.monsterRegionTint(monster);
    if (tint === 0xffc078) {
      return "#fed7aa";
    }
    if (tint === 0x99f6e4) {
      return "#ccfbf1";
    }
    if (tint === 0xbfdbfe) {
      return "#dbeafe";
    }
    if (tint === 0xc4b5fd) {
      return "#ddd6fe";
    }
    if (tint === 0xe2e8f0) {
      return "#e2e8f0";
    }
    if (tint === 0xf0abfc) {
      return "#f5d0fe";
    }
    if (tint === 0xbbf7d0) {
      return "#dcfce7";
    }
    return "#f8fafc";
  }

  private raceTint(race?: string): number {
    if (race === "elf") {
      return 0xd9f99d;
    }
    if (race === "darkelf") {
      return 0xc4b5fd;
    }
    if (race === "orc") {
      return 0xbbf7d0;
    }
    return 0xffffff;
  }

  private raceAccentTint(race?: string): number {
    if (race === "elf") {
      return 0x86efac;
    }
    if (race === "darkelf") {
      return 0xc084fc;
    }
    if (race === "orc") {
      return 0x4ade80;
    }
    return 0xf8fafc;
  }

  private classEffectTint(classId?: string): number {
    if (classId === "mage") {
      return 0x38bdf8;
    }
    if (classId === "archer") {
      return 0xfacc15;
    }
    if (classId === "assassin") {
      return 0xa855f7;
    }
    if (classId === "tank") {
      return 0xf59e0b;
    }
    return 0xf8fafc;
  }

  private mixNumberColor(from: number, to: number, ratio: number): number {
    const clamped = Phaser.Math.Clamp(ratio, 0, 1);
    const fromRed = (from >> 16) & 0xff;
    const fromGreen = (from >> 8) & 0xff;
    const fromBlue = from & 0xff;
    const toRed = (to >> 16) & 0xff;
    const toGreen = (to >> 8) & 0xff;
    const toBlue = to & 0xff;
    const red = Math.round(Phaser.Math.Linear(fromRed, toRed, clamped));
    const green = Math.round(Phaser.Math.Linear(fromGreen, toGreen, clamped));
    const blue = Math.round(Phaser.Math.Linear(fromBlue, toBlue, clamped));
    return (red << 16) + (green << 8) + blue;
  }

  private stableHash(value: string): number {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
      hash = (hash * 31 + value.charCodeAt(index)) % 100000;
    }
    return hash;
  }

  private monsterTexture(monster: MonsterState): string {
    if (monster.archetype === "firespirit") {
      return "mob-wraith";
    }
    if (monster.archetype === "venomplant") {
      return "mob-witch";
    }
    if (monster.archetype === "bonewarrior") {
      return "mob-skeleton";
    }
    return `mob-${monster.archetype}`;
  }

  private monsterDisplayName(monster: MonsterState): string {
    const names: Record<MonsterArchetype, string> = {
      wolf: "Wolf",
      boar: "Boar",
      spider: "Spider",
      bat: "Bat",
      skeleton: "Skeleton",
      bandit: "Bandit",
      archer: "Archer",
      mage: "Mage",
      golem: "Golem",
      wraith: "Wraith",
      drake: "Drake",
      eye: "Flying Eye",
      witch: "Witch",
      dragon: "Dragon",
      sentinel: "Sentinel",
      miniboss: "Mini Boss",
      dungeonboss: "Dungeon Boss",
      venomplant: "Venom Plant",
      bonewarrior: "Bone Warrior",
      firespirit: "Fire Spirit",
      boss: "Boss"
    };
    return this.tr(names[monster.archetype]);
  }

  private monsterDrawSize(monster: MonsterState): { width: number; height: number } {
    const byType: Record<string, { width: number; height: number }> = {
      wolf: { width: 50, height: 36 },
      boar: { width: 52, height: 38 },
      spider: { width: 54, height: 46 },
      bat: { width: 58, height: 40 },
      skeleton: { width: 48, height: 56 },
      bandit: { width: 44, height: 50 },
      archer: { width: 50, height: 58 },
      mage: { width: 54, height: 68 },
      golem: { width: 58, height: 58 },
      wraith: { width: 56, height: 64 },
      drake: { width: 76, height: 58 },
      eye: { width: 58, height: 52 },
      witch: { width: 54, height: 68 },
      dragon: { width: 92, height: 72 },
      sentinel: { width: 64, height: 64 },
      venomplant: { width: 78, height: 78 },
      bonewarrior: { width: 78, height: 78 },
      firespirit: { width: 74, height: 74 },
      miniboss: { width: 88, height: 78 },
      dungeonboss: { width: 112, height: 96 },
      boss: { width: 96, height: 84 }
    };
    const base = byType[monster.archetype] ?? { width: 48, height: 48 };
    const levelScale = Math.min(
      1.55,
      1 + Math.max(0, monster.level - 1) * (monster.archetype === "boss" ? 0.008 : monster.archetype === "dungeonboss" ? 0.007 : monster.archetype === "miniboss" ? 0.006 : 0.004)
    );
    return {
      width: base.width * levelScale,
      height: base.height * levelScale
    };
  }

  private targetNear(x: number, y: number): string | undefined {
    return this.targetAt(x, y)?.id;
  }

  private groundItemAt(x: number, y: number): GroundItem | undefined {
    if (!this.snapshot) {
      return undefined;
    }

    const local = this.localPlayer();
    return this.snapshot.groundItems
      .map((item) => ({
        item,
        distance: Phaser.Math.Distance.Between(x, y, item.position.x, item.position.y),
        ownerLocked: Boolean(item.ownerId && item.ownerId !== local?.id)
      }))
      .filter((entry) => entry.distance <= this.groundItemPickRadius(entry.item))
      .sort((a, b) => Number(a.ownerLocked) - Number(b.ownerLocked) || a.distance - b.distance)[0]?.item;
  }

  private groundItemPickRadius(item: GroundItem): number {
    if (this.isPvpCoinGroundItem(item)) {
      return 82;
    }
    return item.rare ? 82 : item.kind === "gold" || item.kind === "coin" ? 76 : 62;
  }

  private findGroundItem(id: string): GroundItem | undefined {
    return this.snapshot?.groundItems.find((item) => item.id === id);
  }

  private requestGroundItemPickup(item: GroundItem, markFeedback = false): boolean {
    const now = this.time.now;
    if (this.lastGroundItemPickupRequestId === item.id && now - this.lastGroundItemPickupRequestAt < 280) {
      return false;
    }

    // A delayed snapshot can keep the picked item visible long enough to retry
    // this reliable WS command. Keep those retries, but never replay optimistic
    // visual/audio feedback for the same ground-item id.
    const firstFeedback = !markFeedback || !this.pickupFeedbackItemIds.has(item.id);
    this.lastGroundItemPickupRequestId = item.id;
    this.lastGroundItemPickupRequestAt = now;
    if (markFeedback) {
      this.pickupFeedbackItemIds.set(item.id, now);
    }
    this.realtime.pickupGroundItem(item.id);
    return firstFeedback;
  }

  private canPickupGroundItem(item: GroundItem): boolean {
    const local = this.localPlayer();
    if (!local) {
      return false;
    }

    if (item.ownerId && item.ownerId !== local.id) {
      return false;
    }

    const snapshotDistance = Phaser.Math.Distance.Between(local.position.x, local.position.y, item.position.x, item.position.y);
    return snapshotDistance <= GROUND_ITEM_PICKUP_REQUEST_RANGE;
  }

  private approachGroundItemPoint(item: GroundItem): Vector2 {
    const local = this.localPlayer();
    if (!local) {
      return item.position;
    }

    const localPosition = this.localRenderPosition(local);
    const distance = Phaser.Math.Distance.Between(localPosition.x, localPosition.y, item.position.x, item.position.y);
    if (distance < 1) {
      return localPosition;
    }

    const desiredDistance = GROUND_ITEM_APPROACH_DISTANCE;
    return {
      x: item.position.x - ((item.position.x - localPosition.x) / distance) * desiredDistance,
      y: item.position.y - ((item.position.y - localPosition.y) / distance) * desiredDistance
    };
  }

  private resourceAt(x: number, y: number): WorldResource | undefined {
    if (!this.snapshot) {
      return undefined;
    }

    return this.snapshot.resources
      .filter((resource) => resource.remaining > 0 && !resource.respawnsAt)
      .map((resource) => ({
        resource,
        distance: Phaser.Math.Distance.Between(x, y, resource.position.x, resource.position.y)
      }))
      .filter((entry) => entry.distance <= this.resourcePickRadius(entry.resource))
      .sort((a, b) => a.distance - b.distance)[0]?.resource;
  }

  private resourcePickRadius(resource: WorldResource): number {
    return resource.kind === "chest" ? 72 : 52;
  }

  private findResource(id: string): WorldResource | undefined {
    return this.snapshot?.resources.find((resource) => resource.id === id && resource.remaining > 0 && !resource.respawnsAt);
  }

  private canOpenResource(resource: WorldResource): boolean {
    const local = this.localPlayer();
    if (!local) {
      return false;
    }

    const position = this.localRenderPosition(local);
    const range = resource.kind === "chest" ? 154 : 128;
    return Phaser.Math.Distance.Between(position.x, position.y, resource.position.x, resource.position.y) <= range;
  }

  private approachResourcePoint(resource: WorldResource): Vector2 {
    const local = this.localPlayer();
    if (!local) {
      return resource.position;
    }

    const localPosition = this.localRenderPosition(local);
    const distance = Phaser.Math.Distance.Between(localPosition.x, localPosition.y, resource.position.x, resource.position.y);
    if (distance < 1) {
      return localPosition;
    }

    const desiredDistance = resource.kind === "chest" ? 118 : 96;
    return {
      x: resource.position.x - ((resource.position.x - localPosition.x) / distance) * desiredDistance,
      y: resource.position.y - ((resource.position.y - localPosition.y) / distance) * desiredDistance
    };
  }

  private mobileTargetAt(x: number, y: number): MonsterState | PlayerPublicState | undefined {
    return this.targetAt(x, y, MOBILE_TARGET_PICK_PADDING);
  }

  private localPlayer(): PlayerPublicState | undefined {
    return this.snapshot?.players.find((player) => player.id === this.localPlayerId);
  }

  private localCanSprint(): boolean {
    const name = this.localPlayer()?.name.trim().toLowerCase();
    return name === "unit" || name === "houston";
  }

  private localCanAct(player?: PlayerPublicState): player is PlayerPublicState {
    return Boolean(player && player.hp > 0 && !player.downed);
  }

  private cameraZoom(): number {
    return this.isMobileTouchMode() ? MOBILE_WORLD_CAMERA_ZOOM : WORLD_CAMERA_ZOOM;
  }

  private cameraVerticalOffset(): number {
    return 0;
  }

  private pointerAim(local: PlayerPublicState): Vector2 {
    const joystickAim = this.aimJoystickAim(local);
    if (joystickAim) {
      return joystickAim;
    }

    const mobileJoystickAim = this.mobileJoystickAim(local);
    if (mobileJoystickAim) {
      return mobileJoystickAim;
    }

    const selectedAim = this.selectedTargetAim(local);
    if (selectedAim) {
      return selectedAim;
    }

    const assistedAim = this.mobileAssistedAim(local);
    if (assistedAim) {
      return assistedAim;
    }

    const storedTouchAim = this.storedTouchAim(local);
    if (storedTouchAim) {
      return storedTouchAim;
    }

    const pointerAim = this.currentPointerAim();
    if (pointerAim) {
      return pointerAim;
    }

    const range = this.attackRange(local);
    const position = this.localRenderPosition(local);
    return {
      x: Phaser.Math.Clamp(position.x + local.facing.x * range, 0, WORLD_BOUNDS.width),
      y: Phaser.Math.Clamp(position.y + local.facing.y * range, 0, WORLD_BOUNDS.height)
    };
  }

  private selectedTargetAim(local: PlayerPublicState): Vector2 | undefined {
    const target = this.selectedTargetId ? this.findEntity(this.selectedTargetId) : undefined;
    if (!target || !this.mobileCanAutoAttackTarget(local, target)) {
      return undefined;
    }

    return this.entityRenderPosition(target);
  }

  private mobileJoystickAim(local: PlayerPublicState): Vector2 | undefined {
    if (!this.isMobileTouchMode() || this.joystick?.pointerId === undefined) {
      return undefined;
    }

    const vector = this.joystick.vector;
    const length = Math.hypot(vector.x, vector.y);
    if (length <= MOBILE_JOYSTICK_FACE_DEADZONE) {
      return undefined;
    }

    const direction = {
      x: vector.x / length,
      y: vector.y / length
    };
    this.lastTouchAimDirection = direction;
    const position = this.localRenderPosition(local);
    const range = this.aimJoystickRange(local);
    return {
      x: Phaser.Math.Clamp(position.x + direction.x * range, 0, WORLD_BOUNDS.width),
      y: Phaser.Math.Clamp(position.y + direction.y * range, 0, WORLD_BOUNDS.height)
    };
  }

  private mobileAssistedAim(local: PlayerPublicState): Vector2 | undefined {
    if (!this.isMobileTouchMode()) {
      return undefined;
    }

    const target = this.selectedTargetId ? this.findEntity(this.selectedTargetId) : undefined;
    if (!target || !this.mobileCanAutoAttackTarget(local, target)) {
      return undefined;
    }

    return this.entityRenderPosition(target);
  }

  private aimJoystickAim(local: PlayerPublicState): Vector2 | undefined {
    const stick = this.aimJoystick;
    if (!stick || stick.pointerId === undefined) {
      return undefined;
    }

    const length = Math.hypot(stick.vector.x, stick.vector.y);
    if (length <= 0.02) {
      return undefined;
    }

    const position = this.localRenderPosition(local);
    const range = this.aimJoystickRange(local);
    return {
      x: Phaser.Math.Clamp(position.x + (stick.vector.x / length) * range, 0, WORLD_BOUNDS.width),
      y: Phaser.Math.Clamp(position.y + (stick.vector.y / length) * range, 0, WORLD_BOUNDS.height)
    };
  }

  private aimJoystickRange(local: PlayerPublicState): number {
    const skillRange = CLASS_DEFINITIONS[local.classId].skills.reduce((range, skill) => Math.max(range, skill.range + (skill.dashDistance ?? 0)), 0);
    return Math.max(this.attackRange(local), skillRange, 420);
  }

  private findEntity(id: string): MonsterState | PlayerPublicState | undefined {
    if (!this.snapshot) {
      return undefined;
    }

    return [...this.snapshot.monsters, ...this.snapshot.players].find((candidate) => candidate.id === id && candidate.hp > 0);
  }

  private targetAt(x: number, y: number, pickPadding = 0): MonsterState | PlayerPublicState | undefined {
    if (!this.snapshot) {
      return undefined;
    }

    return [...this.snapshot.monsters, ...this.snapshot.players.filter((player) => player.id !== this.localPlayerId)]
      .filter((candidate) => candidate.hp > 0)
      .map((candidate) => {
        const position = this.entityRenderPosition(candidate);
        return {
          candidate,
          distance: Phaser.Math.Distance.Between(x, y, position.x, position.y)
        };
      })
      .filter((entry) => entry.distance <= this.pickRadius(entry.candidate) + pickPadding)
      .sort((a, b) => this.pickScore(a.candidate, a.distance) - this.pickScore(b.candidate, b.distance))[0]?.candidate;
  }

  private isPlayerTarget(target: MonsterState | PlayerPublicState): target is PlayerPublicState {
    return !("archetype" in target);
  }

  private isMonsterTarget(target: MonsterState | PlayerPublicState): target is MonsterState {
    return "archetype" in target;
  }

  private announceSelectedTarget(): void {
    if (this.selectedTargetId === this.lastAnnouncedTargetId) {
      return;
    }

    this.lastAnnouncedTargetId = this.selectedTargetId;
    window.dispatchEvent(new CustomEvent("mmo:selectedTarget", { detail: { targetId: this.selectedTargetId } }));
  }

  private firstShotTarget(local: PlayerPublicState, aim: Vector2): MonsterState | PlayerPublicState | undefined {
    if (!this.snapshot) {
      return undefined;
    }

    const direction = this.shotDirectionFrom(local, aim);
    const range = this.attackRange(local);
    const candidates: Array<MonsterState | PlayerPublicState> = [
      ...this.snapshot.monsters,
      ...this.snapshot.players.filter((player) => player.id !== local.id && player.zone !== "safe")
    ];

    return candidates
      .filter((candidate) => candidate.hp > 0)
      .map((candidate) => {
        const toTarget = {
          x: candidate.position.x - local.position.x,
          y: candidate.position.y - local.position.y
        };
        const projection = toTarget.x * direction.x + toTarget.y * direction.y;
        const radius = this.projectileHitRadius(candidate);
        if (projection < -radius || projection > range + radius) {
          return undefined;
        }

        const closestPoint = {
          x: local.position.x + direction.x * Phaser.Math.Clamp(projection, 0, range),
          y: local.position.y + direction.y * Phaser.Math.Clamp(projection, 0, range)
        };
        const missDistance = Phaser.Math.Distance.Between(closestPoint.x, closestPoint.y, candidate.position.x, candidate.position.y);
        return missDistance <= radius + 10 ? { candidate, projection } : undefined;
      })
      .filter((entry): entry is { candidate: MonsterState | PlayerPublicState; projection: number } => Boolean(entry))
      .sort((a, b) => a.projection - b.projection)[0]?.candidate;
  }

  private projectileHitRadius(target: MonsterState | PlayerPublicState): number {
    if ("archetype" in target) {
      if (target.archetype === "boss") {
        return 42;
      }
      if (target.archetype === "dungeonboss") {
        return 44;
      }
      return Math.max(18, this.monsterDrawSize(target).width * 0.34);
    }

    return 20;
  }

  private merchantAt(x: number, y: number) {
    return CITY_MERCHANTS.find((merchant) => {
      const scale = this.isMobileTouchMode() ? 1.12 : 1;
      const dx = (x - merchant.position.x) / (MERCHANT_CLICK_RADIUS_X * scale);
      const dy = (y - merchant.position.y) / (MERCHANT_CLICK_RADIUS_Y * scale);
      return dx * dx + dy * dy <= 1;
    });
  }

  private teleportAt(x: number, y: number) {
    const clickRadius = this.isMobileTouchMode() ? TELEPORTER_CLICK_RADIUS + 64 : TELEPORTER_CLICK_RADIUS;
    return CITY_TELEPORTERS.find(
      (teleporter) => Phaser.Math.Distance.Between(x, y, teleporter.position.x, teleporter.position.y - 10) <= clickRadius
    );
  }

  private dungeonActionAt(x: number, y: number): DungeonAction | undefined {
    const clickRadius = this.isMobileTouchMode() ? 190 : 145;
    for (const dungeon of WORLD_DUNGEON_INTERIORS) {
      const landmark = WORLD_LANDMARKS.find((candidate) => candidate.id === dungeon.landmarkId);
      if (landmark && Phaser.Math.Distance.Between(x, y, landmark.position.x, landmark.position.y + 56) <= clickRadius) {
        return { mode: "enter", landmarkId: landmark.id, position: { x: landmark.position.x, y: landmark.position.y + 56 } };
      }
      if (Phaser.Math.Distance.Between(x, y, dungeon.start.x, dungeon.start.y) <= clickRadius) {
        return { mode: "exit", dungeonId: dungeon.id, exit: "start", position: dungeon.start };
      }
      if (Phaser.Math.Distance.Between(x, y, dungeon.end.x, dungeon.end.y) <= clickRadius) {
        return { mode: "exit", dungeonId: dungeon.id, exit: "end", position: dungeon.end };
      }
    }
    return undefined;
  }

  private handleDungeonAction(action: DungeonAction): void {
    if (this.isInputBlocked()) {
      return;
    }

    const local = this.localPlayer();
    if (!local) {
      return;
    }

    const distance = Phaser.Math.Distance.Between(local.position.x, local.position.y, action.position.x, action.position.y);
    if (distance > 270) {
      this.clickMoveTarget = undefined;
      this.moveMarker?.setVisible(false);
      this.setMoveTarget(action.position);
      return;
    }

    this.clickMoveTarget = undefined;
    this.moveMarker?.setVisible(false);
    this.renderDungeonPortalUseEffect(action.position, action.mode === "enter" ? 0xa78bfa : 0x67e8f9);
    if (action.mode === "enter") {
      this.realtime.enterDungeon(action.landmarkId);
    } else {
      this.realtime.exitDungeon(action.dungeonId, action.exit);
    }
    this.playUiOpenSound("gate");
  }

  private renderDungeonPortalUseEffect(position: Vector2, color: number): void {
    const veil = this.trackTransient(this.add.circle(position.x, position.y, 42, color, 0.14).setDepth(86).setBlendMode(Phaser.BlendModes.ADD), 900);
    const ring = this.trackTransient(this.add.circle(position.x, position.y, 34, color, 0).setStrokeStyle(5, 0xf8fafc, 0.7).setDepth(87).setBlendMode(Phaser.BlendModes.ADD), 900);
    const inner = this.trackTransient(this.add.circle(position.x, position.y, 18, 0xf8fafc, 0.16).setDepth(88).setBlendMode(Phaser.BlendModes.ADD), 700);
    this.tweens.add({
      targets: veil,
      scale: 2.2,
      alpha: 0,
      duration: 560,
      ease: "Sine.easeInOut",
      onComplete: () => this.destroyTransientEffect(veil)
    });
    this.tweens.add({
      targets: ring,
      scale: 2.6,
      alpha: 0,
      duration: 640,
      ease: "Sine.easeInOut",
      onComplete: () => this.destroyTransientEffect(ring)
    });
    this.tweens.add({
      targets: inner,
      scale: 0.35,
      alpha: 0,
      duration: 420,
      ease: "Sine.easeIn",
      onComplete: () => this.destroyTransientEffect(inner)
    });
  }

  private decorationBlocked(position: Vector2, texture: string): boolean {
    if (CITY_TELEPORTERS.some((teleporter) => Phaser.Math.Distance.Between(position.x, position.y, teleporter.position.x, teleporter.position.y) < teleporter.radius + 130)) {
      return true;
    }

    const waterDecoration =
      texture === "decor-wave" ||
      texture === "decor-fish" ||
      texture === "decor-lily" ||
      texture === "decor-reed" ||
      texture === "decor-waterfall-spray" ||
      texture === "city-dock";
    if (!waterDecoration && this.isWaterPosition(position)) {
      return true;
    }

    if (
      Phaser.Math.Distance.Between(position.x, position.y, WORLD_STARTER_ARENA.center.x, WORLD_STARTER_ARENA.center.y) <
      WORLD_STARTER_ARENA.radius + 520
    ) {
      return true;
    }

    const roadEdgeDecoration = texture === "decor-flower" || texture === "decor-grass" || texture === "decor-reed" || texture === "decor-rock-flat" || texture === "decor-pebble";
    if (
      texture !== "city-dock" &&
      WORLD_ROADS.some((road) => this.distanceToPolyline(position, [...road.points]) < Math.max(18, (road.width ?? 62) * (roadEdgeDecoration ? 0.32 : 0.5)))
    ) {
      return true;
    }

    if (WORLD_OBSTACLES.some((obstacle) => this.pointInWorldObstacle(position, obstacle, 120))) {
      return true;
    }

    return false;
  }

  private pointInWorldObstacle(position: Vector2, obstacle: (typeof WORLD_OBSTACLES)[number], padding = 0): boolean {
    const rotation = obstacle.rotation ?? 0;
    const cos = Math.cos(-rotation);
    const sin = Math.sin(-rotation);
    const dx = position.x - obstacle.position.x;
    const dy = position.y - obstacle.position.y;
    const localX = dx * cos - dy * sin;
    const localY = dx * sin + dy * cos;
    const radiusX = obstacle.radiusX + padding;
    const radiusY = obstacle.radiusY + padding;
    return (localX * localX) / (radiusX * radiusX) + (localY * localY) / (radiusY * radiusY) <= 1;
  }

  private pushOutOfWorldObstacles(position: Vector2, margin = 34): Vector2 {
    let result = {
      x: Phaser.Math.Clamp(position.x, 0, WORLD_BOUNDS.width),
      y: Phaser.Math.Clamp(position.y, 0, WORLD_BOUNDS.height)
    };

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
        result = {
          x: Phaser.Math.Clamp(obstacle.position.x + pushedLocalX * worldCos - pushedLocalY * worldSin, 0, WORLD_BOUNDS.width),
          y: Phaser.Math.Clamp(obstacle.position.y + pushedLocalX * worldSin + pushedLocalY * worldCos, 0, WORLD_BOUNDS.height)
        };
        pushed = true;
        break;
      }

      if (!pushed) {
        return result;
      }
    }

    return result;
  }

  private isWaterPosition(position: Vector2): boolean {
    return (
      this.isOpenSeaPosition(position) ||
      WORLD_RIVERS.some((river) => this.distanceToPolyline(position, river.points) < (river.width ?? 82) * 0.78 + 62) ||
      WORLD_LAKES.some((lake) => this.pointInEllipse(position, lake.position, lake.width / 2 + 150, lake.height / 2 + 110))
    );
  }

  private isVisualLakePosition(position: Vector2, padding = 0): boolean {
    return WORLD_LAKES.some((lake) => this.pointInEllipse(position, lake.position, lake.width / 2 + padding, lake.height / 2 + padding * 0.72));
  }

  private isVisualOpenWaterPosition(position: Vector2, padding = 0): boolean {
    const nearOpenSea =
      this.isOpenSeaPosition(position) ||
      (padding > 0 &&
        (this.isOpenSeaPosition({ x: position.x - padding, y: position.y }) ||
          this.isOpenSeaPosition({ x: position.x, y: position.y - padding }) ||
          this.isOpenSeaPosition({ x: position.x, y: position.y + padding })));
    return (
      this.isVisualLakePosition(position, padding) ||
      position.x < -padding ||
      position.y < -padding ||
      position.x > WORLD_BOUNDS.width + padding ||
      position.y > WORLD_BOUNDS.height + padding ||
      nearOpenSea
    );
  }

  private isRiverMouthWaterPosition(position: Vector2, width: number): boolean {
    const seaPadding = width * 2.2 + 240;
    const lakePadding = width * 0.55 + 90;
    return this.isVisualLakePosition(position, lakePadding) || this.isVisualOpenWaterPosition(position, seaPadding);
  }

  private isVisualRiverMergePosition(position: Vector2, riverId: string, width: number): boolean {
    return WORLD_RIVERS.some(
      (river) => river.id !== riverId && this.distanceToPolyline(position, river.points) < (river.width ?? 82) * 0.5 + width * 0.38
    );
  }

  private isOpenSeaPosition(position: Vector2): boolean {
    const westShore: Vector2[] = [
      { x: 3600, y: 0 },
      { x: 2600, y: 900 },
      { x: 980, y: 3000 },
      { x: 1180, y: 6200 },
      { x: 2100, y: 10400 },
      { x: 1450, y: 16900 },
      { x: 2600, y: 22900 },
      { x: 1580, y: 27700 }
    ];
    const southShore: Vector2[] = [
      { x: 0, y: 29200 },
      { x: 7600, y: 28400 },
      { x: 15600, y: 28950 },
      { x: 23100, y: 28000 },
      { x: 31500, y: 26950 },
      { x: 38900, y: 28050 },
      { x: WORLD_BOUNDS.width, y: 26900 }
    ];
    const northShore: Vector2[] = [
      { x: 0, y: 1260 },
      { x: 2500, y: 920 },
      { x: 5200, y: 760 },
      { x: 9000, y: 560 },
      { x: 13200, y: 740 },
      { x: 18500, y: 520 },
      { x: 23800, y: 820 },
      { x: 29600, y: 660 },
      { x: 36000, y: 860 },
      { x: 43000, y: 1120 },
      { x: WORLD_BOUNDS.width, y: 980 }
    ];
    const shoreX = this.interpolateShoreXAtY(westShore, position.y);
    const shoreY = this.interpolateShoreYAtX(southShore, position.x);
    const northShoreY = this.interpolateShoreYAtX(northShore, position.x);
    return position.x < shoreX - 80 || position.y > shoreY + 80 || position.y < northShoreY - 80;
  }

  private interpolateShoreXAtY(points: Vector2[], y: number): number {
    for (let index = 0; index < points.length - 1; index += 1) {
      const from = points[index];
      const to = points[index + 1];
      if ((y >= from.y && y <= to.y) || (y >= to.y && y <= from.y)) {
        const span = Math.max(1, to.y - from.y);
        return Phaser.Math.Linear(from.x, to.x, Phaser.Math.Clamp((y - from.y) / span, 0, 1));
      }
    }
    return y < points[0].y ? points[0].x : points[points.length - 1].x;
  }

  private interpolateShoreYAtX(points: Vector2[], x: number): number {
    for (let index = 0; index < points.length - 1; index += 1) {
      const from = points[index];
      const to = points[index + 1];
      if ((x >= from.x && x <= to.x) || (x >= to.x && x <= from.x)) {
        const span = Math.max(1, to.x - from.x);
        return Phaser.Math.Linear(from.y, to.y, Phaser.Math.Clamp((x - from.x) / span, 0, 1));
      }
    }
    return x < points[0].x ? points[0].y : points[points.length - 1].y;
  }

  private distanceToPolyline(position: Vector2, points: Vector2[]): number {
    let best = Number.POSITIVE_INFINITY;
    for (let index = 0; index < points.length - 1; index += 1) {
      best = Math.min(best, this.distanceToSegment(position, points[index], points[index + 1]));
    }
    return best;
  }

  private distanceToSegment(position: Vector2, start: Vector2, end: Vector2): number {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared <= 0) {
      return Phaser.Math.Distance.Between(position.x, position.y, start.x, start.y);
    }

    const t = Phaser.Math.Clamp(((position.x - start.x) * dx + (position.y - start.y) * dy) / lengthSquared, 0, 1);
    return Phaser.Math.Distance.Between(position.x, position.y, start.x + dx * t, start.y + dy * t);
  }

  private pointInEllipse(position: Vector2, center: Vector2, radiusX: number, radiusY: number): boolean {
    const dx = (position.x - center.x) / radiusX;
    const dy = (position.y - center.y) / radiusY;
    return dx * dx + dy * dy <= 1;
  }

  private pickRadius(target: MonsterState | PlayerPublicState): number {
    if (this.isPlayerTarget(target)) {
      return 70;
    }
    if ("archetype" in target && target.archetype === "boss") {
      return 70;
    }
    if ("archetype" in target && target.archetype === "dungeonboss") {
      return 72;
    }
    if ("archetype" in target && target.archetype === "miniboss") {
      return 66;
    }
    if ("archetype" in target && (target.archetype === "sentinel" || target.archetype === "drake")) {
      return 60;
    }
    if ("archetype" in target && target.archetype === "golem") {
      return 54;
    }
    if ("archetype" in target && target.archetype === "skeleton") {
      return 50;
    }
    if ("archetype" in target && (target.archetype === "archer" || target.archetype === "mage")) {
      return 50;
    }
    if ("archetype" in target && target.archetype === "bat") {
      return 46;
    }
    return 46;
  }

  private pickScore(candidate: MonsterState | PlayerPublicState, distance: number): number {
    return distance - (this.isPlayerTarget(candidate) ? 24 : 0);
  }

  private currentMoveTarget(): Vector2 | undefined {
    const attackTarget = this.pendingAttackTargetId ? this.findEntity(this.pendingAttackTargetId) : undefined;
    if (attackTarget && !this.canAttackTarget(attackTarget)) {
      return this.approachPointForTarget(attackTarget);
    }

    const skillTarget = this.pendingSkillTargetId ? this.findEntity(this.pendingSkillTargetId) : undefined;
    if (skillTarget && !this.canSkillTarget(skillTarget, this.pendingSkillIndex)) {
      return this.approachPointForTarget(skillTarget);
    }

    const resource = this.pendingResourceId ? this.findResource(this.pendingResourceId) : undefined;
    if (resource && !this.canOpenResource(resource)) {
      return this.approachResourcePoint(resource);
    }

    return this.clickMoveTarget;
  }

  private setMoveTarget(target: Vector2, visible = true): void {
    this.clickMoveTarget = this.pushOutOfWorldObstacles({
      x: Phaser.Math.Clamp(target.x, 0, WORLD_BOUNDS.width),
      y: Phaser.Math.Clamp(target.y, 0, WORLD_BOUNDS.height)
    });

    if (!this.moveMarker) {
      this.moveMarker = this.add.circle(0, 0, 12, 0x22c55e, 0.18).setStrokeStyle(2, 0x86efac, 0.9).setDepth(9.05);
    }
    this.moveMarker.setPosition(this.clickMoveTarget.x, this.clickMoveTarget.y).setVisible(visible);
  }

  private clearMoveIntent(): void {
    this.clickMoveTarget = undefined;
    this.pendingAttackTargetId = undefined;
    this.pendingSkillTargetId = undefined;
    this.pendingResourceId = undefined;
    this.pendingGroundItemId = undefined;
    this.pendingSkillIndex = 0;
    this.queuedAttack = undefined;
    this.moveMarker?.setVisible(false);
  }

  private approachPoint(target: Vector2): Vector2 {
    const local = this.localPlayer();
    if (!local) {
      return target;
    }

    const localPosition = this.localRenderPosition(local);
    const distance = Phaser.Math.Distance.Between(localPosition.x, localPosition.y, target.x, target.y);
    if (distance < 1) {
      return localPosition;
    }

    const desiredDistance = Math.max(30, this.attackRange(local) - 30);
    const direction = {
      x: (target.x - localPosition.x) / distance,
      y: (target.y - localPosition.y) / distance
    };

    return {
      x: target.x - direction.x * desiredDistance,
      y: target.y - direction.y * desiredDistance
    };
  }

  private approachPointForTarget(target: MonsterState | PlayerPublicState): Vector2 {
    const targetPosition = this.entityRenderPosition(target);
    const baseApproach = this.approachPoint(targetPosition);
    const local = this.localPlayer();
    if (!local || !this.isMonsterTarget(target) || local.zone !== "safe") {
      return baseApproach;
    }

    return this.safeZoneCombatExitPoint(baseApproach, targetPosition, local);
  }

  private safeZoneCombatExitPoint(baseApproach: Vector2, targetPosition: Vector2, local: PlayerPublicState): Vector2 {
    const localPosition = this.localRenderPosition(local);
    let blockingCity: (typeof CITY_DEFINITIONS)[number] | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const city of CITY_DEFINITIONS) {
      const distance = Phaser.Math.Distance.Between(localPosition.x, localPosition.y, city.position.x, city.position.y);
      if (distance <= city.safeRadius + 24 && distance < bestDistance) {
        blockingCity = city;
        bestDistance = distance;
      }
    }

    if (!blockingCity) {
      return baseApproach;
    }

    const exitDistance = blockingCity.safeRadius + 90;
    const baseDistance = Phaser.Math.Distance.Between(baseApproach.x, baseApproach.y, blockingCity.position.x, blockingCity.position.y);
    if (baseDistance >= exitDistance) {
      return baseApproach;
    }

    let direction = {
      x: targetPosition.x - blockingCity.position.x,
      y: targetPosition.y - blockingCity.position.y
    };
    let length = Math.hypot(direction.x, direction.y);
    if (length < 1) {
      direction = {
        x: localPosition.x - blockingCity.position.x,
        y: localPosition.y - blockingCity.position.y
      };
      length = Math.hypot(direction.x, direction.y);
    }
    if (length < 1) {
      direction = local.facing.x !== 0 || local.facing.y !== 0 ? local.facing : { x: 1, y: 0 };
      length = Math.hypot(direction.x, direction.y);
    }

    return {
      x: Phaser.Math.Clamp(blockingCity.position.x + (direction.x / length) * exitDistance, 0, WORLD_BOUNDS.width),
      y: Phaser.Math.Clamp(blockingCity.position.y + (direction.y / length) * exitDistance, 0, WORLD_BOUNDS.height)
    };
  }

  private canAttackTarget(target: MonsterState | PlayerPublicState): boolean {
    const local = this.localPlayer();
    if (!local) {
      return false;
    }
    if (this.isMonsterTarget(target) && local.zone === "safe") {
      return false;
    }

    const localPosition = this.localRenderPosition(local);
    const targetPosition = this.entityRenderPosition(target);
    return Phaser.Math.Distance.Between(localPosition.x, localPosition.y, targetPosition.x, targetPosition.y) <= this.attackRange(local) + this.targetReachPadding(target);
  }

  private canSkillTarget(target: MonsterState | PlayerPublicState, skillIndex = 0): boolean {
    const local = this.localPlayer();
    if (!local) {
      return false;
    }

    const skill = CLASS_DEFINITIONS[local.classId].skills[skillIndex];
    if (!skill) {
      return false;
    }
    if (this.isMonsterTarget(target) && local.zone === "safe") {
      return false;
    }
    const forgiveness = this.attackForgiveness(local);
    const localPosition = this.localRenderPosition(local);
    const targetPosition = this.entityRenderPosition(target);
    return Phaser.Math.Distance.Between(localPosition.x, localPosition.y, targetPosition.x, targetPosition.y) <= skill.range + forgiveness + (skill.dashDistance ?? 0) + this.targetReachPadding(target);
  }

  private attackRange(player: PlayerPublicState): number {
    return CLASS_DEFINITIONS[player.classId].attackRange + this.attackForgiveness(player);
  }

  private attackForgiveness(player: PlayerPublicState): number {
    if (player.classId === "archer") {
      return 80;
    }
    if (player.classId === "mage") {
      return 68;
    }
    if (player.classId === "warrior") {
      return 26;
    }
    return 18;
  }

  private targetReachPadding(target: MonsterState | PlayerPublicState): number {
    return Math.max(10, this.projectileHitRadius(target) * 0.55);
  }

  private bestActionTarget(): (MonsterState | PlayerPublicState) | undefined {
    const local = this.localPlayer();
    if (!this.snapshot || !local) {
      return undefined;
    }

    const classRange = this.attackRange(local);
    const localPosition = this.localRenderPosition(local);
    const liveMonsters = this.snapshot.monsters.filter((monster) => monster.hp > 0);
    const livePlayers = this.snapshot.players.filter((player) => player.id !== local.id && player.hp > 0 && player.zone !== "safe");
    return [...liveMonsters, ...livePlayers]
      .map((candidate) => {
        const position = this.entityRenderPosition(candidate);
        return {
          candidate,
          distance: Phaser.Math.Distance.Between(localPosition.x, localPosition.y, position.x, position.y)
        };
      })
      .filter((entry) => entry.distance <= Math.max(classRange, 260))
      .sort((a, b) => a.distance - b.distance)[0]?.candidate;
  }

  private bestMobileActionTarget(local: PlayerPublicState): (MonsterState | PlayerPublicState) | undefined {
    if (!this.snapshot) {
      return undefined;
    }

    const classRange = this.attackRange(local);
    const localPosition = this.localRenderPosition(local);
    const candidates: Array<MonsterState | PlayerPublicState> = [
      ...this.snapshot.monsters,
      ...this.snapshot.players.filter((player) => player.id !== local.id && player.hp > 0 && player.zone !== "safe")
    ];

    return candidates
      .filter((candidate) => candidate.hp > 0 && this.mobileCanAutoAttackTarget(local, candidate))
      .map((candidate) => {
        const position = this.entityRenderPosition(candidate);
        const distance = Phaser.Math.Distance.Between(localPosition.x, localPosition.y, position.x, position.y);
        return {
          candidate,
          distance,
          score: distance + this.mobileTargetScorePenalty(candidate)
        };
      })
      .filter((entry) => entry.distance <= Math.max(classRange + 170, 360))
      .sort((a, b) => a.score - b.score)[0]?.candidate;
  }

  private mobileTargetScorePenalty(candidate: MonsterState | PlayerPublicState): number {
    if (this.isPlayerTarget(candidate)) {
      return 80;
    }
    if (candidate.archetype === "boss") {
      return 420;
    }
    if (candidate.archetype === "dungeonboss") {
      return 340;
    }
    if (candidate.archetype === "miniboss") {
      return 240;
    }
    if (candidate.archetype === "dragon") {
      return 300;
    }
    if (candidate.archetype === "archer" || candidate.archetype === "mage" || candidate.archetype === "sentinel" || candidate.archetype === "drake" || candidate.archetype === "golem" || candidate.archetype === "witch" || candidate.archetype === "eye") {
      return 120;
    }
    return 0;
  }

  private ensureSelectedTargetHighlight(): void {
    if (!this.selectedTargetRing) {
      this.selectedTargetRing = this.add.circle(0, 0, 48, 0xfacc15, 0).setStrokeStyle(3, 0xfacc15, 0.9).setDepth(72).setVisible(false);
    }
    if (!this.selectedTargetPulse) {
      this.selectedTargetPulse = this.add.circle(0, 0, 56, 0xfacc15, 0).setStrokeStyle(2, 0xfef08a, 0.32).setDepth(71).setVisible(false);
    }
    if (!this.selectedTargetArrow) {
      this.selectedTargetArrow = this.add.triangle(0, 0, 0, 0, 18, 0, 9, 14, 0xfacc15, 0.92).setOrigin(0.5).setDepth(73).setVisible(false);
    }
  }

  private hideSelectedTargetHighlight(): void {
    this.selectedTargetRing?.setVisible(false);
    this.selectedTargetPulse?.setVisible(false);
    this.selectedTargetArrow?.setVisible(false);
  }

  private updateSelectedTargetHighlight(target?: MonsterState | PlayerPublicState): void {
    if (!target) {
      this.hideSelectedTargetHighlight();
      return;
    }

    this.ensureSelectedTargetHighlight();
    const position = this.entityRenderPosition(target);
    const radius = this.pickRadius(target) + (this.isPlayerTarget(target) ? 4 : 9);
    const color = this.isPlayerTarget(target) ? 0x38bdf8 : 0xfacc15;
    const pulse = 1 + Math.sin(this.time.now / 150) * 0.075;
    this.selectedTargetRing?.setVisible(true).setPosition(position.x, position.y).setRadius(radius).setStrokeStyle(3, color, 0.92);
    if (this.isPlayerTarget(target)) {
      this.selectedTargetPulse?.setVisible(true).setPosition(position.x, position.y).setRadius(radius + 10).setScale(pulse).setFillStyle(color, 0).setStrokeStyle(2, color, 0.28);
    } else {
      this.selectedTargetPulse?.setVisible(false);
    }
    this.selectedTargetArrow?.setVisible(true).setPosition(position.x, position.y - radius - 22).setFillStyle(color, 0.94);
  }

  private renderTargetAssist(snapshot: GameSnapshot): void {
    const local = this.localPlayer();
    if (!local) {
      this.selectedTargetId = undefined;
      this.announceSelectedTarget();
      this.attackRangeRing?.setVisible(false);
      this.hideSelectedTargetHighlight();
      return;
    }

    const target = this.selectedTargetId
      ? (snapshot.monsters.find((candidate) => candidate.id === this.selectedTargetId && candidate.hp > 0) ??
        snapshot.players.find((candidate) => candidate.id === this.selectedTargetId && candidate.hp > 0))
      : undefined;

    if (this.selectedTargetId && !target) {
      this.selectedTargetId = undefined;
      this.announceSelectedTarget();
      this.attackRangeRing?.setVisible(false);
      this.hideSelectedTargetHighlight();
      return;
    }
    this.announceSelectedTarget();
    this.updateSelectedTargetHighlight(target);

    this.attackRangeRing?.setVisible(false);
  }

  private updateTargetAssistPositions(): void {
    const local = this.localPlayer();
    if (!local) {
      return;
    }

    this.attackRangeRing?.setVisible(false);
    this.updateSelectedTargetHighlight(this.selectedTargetId ? this.findEntity(this.selectedTargetId) : undefined);
  }

  private renderDamageNumbers(snapshot: GameSnapshot): void {
    const crowded = this.isCrowdedScene();
    const mobile = this.isMobileTouchMode();
    const effectBudget = mobile && !this.mobileGraphics.floatingText ? 0 : mobile ? (this.mobileSustainedLeanRuntime ? 0 : this.mobileLeanRuntime ? (crowded ? 1 : 4) : crowded ? 3 : 10) : crowded ? CROWDED_EFFECT_BUDGET : NORMAL_EFFECT_BUDGET;
    const local = this.localPlayer();
    const localPosition = local ? this.localRenderPosition(local) : undefined;
    const localEffectRadius = mobile
      ? this.mobileDeepSustainRuntime
        ? 480
        : this.mobileSustainedLeanRuntime
          ? 650
          : this.mobileLeanRuntime
            ? crowded
              ? 650
              : 1100
            : crowded
              ? 900
              : 1500
      : crowded
        ? 1250
        : 2400;
    let renderedEffects = 0;
    let actors: Map<string, MonsterState | PlayerPublicState> | undefined;
    const actorById = (id: string) => {
      actors ??= new Map([...snapshot.monsters, ...snapshot.players].map((candidate) => [candidate.id, candidate]));
      return actors.get(id);
    };

    for (const event of snapshot.events) {
      if (this.renderedEventIds.has(event.id)) {
        continue;
      }

      const target = actorById(event.targetId);
      if (!target) {
        continue;
      }

      this.renderedEventIds.add(event.id);
      const source = actorById(event.sourceId);
      const targetPosition = this.entityRenderPosition(target);
      const sourcePosition = source ? this.entityRenderPosition(source) : undefined;
      const combatDamageEvent = event.amount > 0 && (event.kind === "attack" || event.kind === "skill" || event.kind === "monster");
      if (combatDamageEvent) {
        if (source) {
          this.markCombatAttackCue(source);
        }
        if ("archetype" in target) {
          this.markMonsterHitCue(target);
        }
      }
      const actorImportant =
        target.id === this.localPlayerId ||
        source?.id === this.localPlayerId ||
        target.id === this.selectedTargetId ||
        source?.id === this.selectedTargetId;
      const onScreen = this.isPositionNearCamera(targetPosition, 260) || Boolean(sourcePosition && this.isPositionNearCamera(sourcePosition, 260));
      const nearLocal = !localPosition || this.distanceSquared(targetPosition, localPosition) <= localEffectRadius * localEffectRadius;
      const globallyImportant = !mobile && (event.kind === "loot" || event.kind === "claim" || event.kind === "revive");
      const mobileAmbientSkillTrail =
        mobile &&
        event.kind === "skill" &&
        !actorImportant &&
        Boolean(source) &&
        onScreen &&
        nearLocal &&
        this.spendMobileAmbientSkillTrail();
      const important = actorImportant || globallyImportant;
      const allowAmbientVisual = !important && onScreen && nearLocal && renderedEffects < effectBudget && (!mobile || this.spendMobileAmbientEffect(crowded));
      const allowVisual = important || mobileAmbientSkillTrail || allowAmbientVisual;
      if (!allowVisual) {
        continue;
      }
      renderedEffects += 1;

      if (event.kind === "revive") {
        if (mobile && !actorImportant) {
          continue;
        }
        this.renderReviveEffect(targetPosition);
        this.playReviveSound();
        continue;
      }
      if (event.kind === "death") {
        if (!("archetype" in target)) {
          this.renderPlayerDefeatFeedback(targetPosition, actorImportant, source?.id === this.localPlayerId && target.id !== this.localPlayerId);
        }
        continue;
      }
      if (event.amount <= 0) {
        continue;
      }
      if (event.kind === "loot" && event.message.includes("reached level")) {
        if (mobile && !actorImportant) {
          continue;
        }
        this.renderLevelUpEffect(targetPosition, event.amount);
        this.playLevelUpSound();
        continue;
      }
      if (source && (event.kind === "attack" || event.kind === "skill" || event.kind === "monster")) {
        const isLocalAttackEcho = source.id === this.localPlayerId && (event.kind === "attack" || event.kind === "skill");
        const trailImportant = actorImportant || mobileAmbientSkillTrail;
        const localActorTrail = source.id === this.localPlayerId || target.id === this.localPlayerId;
        const allowTrail = !mobile || (trailImportant && (localActorTrail || mobileAmbientSkillTrail || this.spendMobileImportantTrail(event.kind)));
        if (!isLocalAttackEcho && allowTrail) {
          this.renderCombatTrail(sourcePosition ?? source.position, targetPosition, event.kind, "classId" in source ? source.classId : undefined, source.id, trailImportant, target.id, event.skillId, event.attackStyle);
        }
      }
      if (event.kind === "heal") {
        this.renderHealingEffect(targetPosition);
        if (!mobile || important) {
          this.playSoftRewardTick();
        }
      } else if (event.kind === "loot" || event.kind === "claim") {
        const recentLocalPickupChime = target.id === this.localPlayerId && this.time.now - this.lastLocalPickupSoundAt < 1_200;
        if (event.kind === "loot" && actorImportant) {
          this.renderLootEventFeedback(targetPosition, event.message, event.amount);
          if (!recentLocalPickupChime) {
            this.playLootEventSound(event.message);
          }
        } else if (!mobile && !recentLocalPickupChime) {
          this.playSoftRewardTick();
        }
      } else if (!mobile || important) {
        const impactVolumeScale = important ? 1 : crowded ? 0.22 : 0.34;
        this.playImpactSound(event.kind, source && "classId" in source ? source.classId : undefined, target.id === this.localPlayerId, impactVolumeScale);
      }
      if (mobile && !this.spendMobileDamageText(important)) {
        continue;
      }
      const color = event.kind === "heal" ? "#86efac" : event.kind === "loot" || event.kind === "claim" ? "#facc15" : "#f8fafc";
      const amountText = event.kind === "loot" || event.kind === "claim" || event.kind === "heal" ? `+${event.amount}` : `-${event.amount}`;
      const text = this.trackTransient(
        this.add.text(targetPosition.x, targetPosition.y - 36, amountText, {
          color,
          fontFamily: "Inter, sans-serif",
          fontSize: "18px",
          fontStyle: "bold",
          stroke: "#000",
          strokeThickness: 4
        }),
        mobile ? 1_200 : 2_000
      )
        .setOrigin(0.5)
        .setDepth(80);

      this.tweens.add({
        targets: text,
        y: text.y - 38,
        alpha: 0,
        duration: 720,
        onComplete: () => this.destroyTransientEffect(text)
      });
    }

    if (this.renderedEventIds.size > 120) {
      const ids = [...this.renderedEventIds].slice(-80);
      this.renderedEventIds.clear();
      ids.forEach((id) => this.renderedEventIds.add(id));
    }
  }

  private markCombatAttackCue(source: MonsterState | PlayerPublicState): void {
    if ("archetype" in source) {
      const view = this.monsters.get(source.id);
      if (view) {
        view.lastAttackCueAt = this.time.now;
      }
      return;
    }

    const view = this.players.get(source.id);
    if (view) {
      view.lastAttackCueAt = this.time.now;
    }
  }

  private markMonsterHitCue(target: MonsterState): void {
    const view = this.monsters.get(target.id);
    if (view && target.hp > 0) {
      view.lastHitCueAt = this.time.now;
    }
  }

  private spendMobileDamageText(important: boolean): boolean {
    if (!this.mobileGraphics.floatingText) {
      return false;
    }
    if (!important) {
      return !this.mobileSustainedLeanRuntime;
    }
    const interval = this.mobileDeepSustainRuntime
      ? MOBILE_DEEP_DAMAGE_TEXT_INTERVAL_MS
      : this.mobileSustainedLeanRuntime
        ? MOBILE_SUSTAINED_DAMAGE_TEXT_INTERVAL_MS
        : 0;
    if (interval <= 0) {
      return true;
    }
    const now = this.time.now;
    if (now - this.lastMobileDamageTextAt < interval) {
      return false;
    }
    this.lastMobileDamageTextAt = now;
    return true;
  }

  private spendMobileImportantTrail(kind: "attack" | "skill" | "monster"): boolean {
    if (!this.mobileGraphics.combatEffects) {
      return false;
    }
    if (!this.mobileSustainedLeanRuntime) {
      return true;
    }
    if (kind !== "skill" && this.mobileDeepSustainRuntime) {
      return false;
    }
    const interval = this.mobileDeepSustainRuntime ? MOBILE_DEEP_TRAIL_INTERVAL_MS : MOBILE_SUSTAINED_TRAIL_INTERVAL_MS;
    const now = this.time.now;
    if (now - this.lastMobileTrailAt < interval) {
      return false;
    }
    this.lastMobileTrailAt = now;
    return true;
  }

  private spendMobileAmbientSkillTrail(): boolean {
    if (!this.mobileGraphics.combatEffects) {
      return false;
    }
    if (!this.mobileSustainedLeanRuntime) {
      return true;
    }

    const interval = this.mobileDeepSustainRuntime ? MOBILE_DEEP_AMBIENT_SKILL_TRAIL_INTERVAL_MS : MOBILE_AMBIENT_SKILL_TRAIL_INTERVAL_MS;
    const now = this.time.now;
    if (now - this.lastMobileAmbientSkillTrailAt < interval) {
      return false;
    }
    this.lastMobileAmbientSkillTrailAt = now;
    return true;
  }

  private spendMobileAmbientEffect(crowded: boolean): boolean {
    if (this.mobileSustainedLeanRuntime || !this.mobileGraphics.worldDecorations) {
      return false;
    }

    const now = this.time.now;
    if (now - this.mobileAmbientEffectWindowAt >= MOBILE_AMBIENT_EFFECT_WINDOW_MS) {
      this.mobileAmbientEffectWindowAt = now;
      this.mobileAmbientEffectCount = 0;
    }

    const limit = this.mobileLeanRuntime ? (crowded ? 1 : 4) : crowded ? MOBILE_CROWDED_AMBIENT_EFFECT_BUDGET : MOBILE_AMBIENT_EFFECT_BUDGET;
    if (this.mobileAmbientEffectCount >= limit) {
      return false;
    }

    this.mobileAmbientEffectCount += 1;
    return true;
  }

  private renderLevelUpEffect(position: Vector2, level: number): void {
    const burst = this.add.circle(position.x, position.y, 30, 0xfacc15, 0.2).setDepth(88);
    const halo = this.add.circle(position.x, position.y, 42, 0xfacc15, 0).setStrokeStyle(5, 0xfacc15, 0.9).setDepth(89);
    const inner = this.add.circle(position.x, position.y, 18, 0xfef3c7, 0.32).setDepth(90);
    const pillar = this.add.rectangle(position.x, position.y - 46, 26, 170, 0xfef3c7, 0.16).setDepth(87);
    const crown = this.add.circle(position.x, position.y - 94, 26, 0xfef3c7, 0.18).setStrokeStyle(3, 0xfacc15, 0.72).setDepth(91);
    const text = this.add
      .text(position.x, position.y - 70, this.tr(`LEVEL ${level}`), {
        color: "#fef3c7",
        fontFamily: "Inter, sans-serif",
        fontSize: "22px",
        fontStyle: "bold",
        stroke: "#7c2d12",
        strokeThickness: 5
      })
      .setOrigin(0.5)
      .setDepth(92);

    for (let index = 0; index < 10; index += 1) {
      const angle = (Math.PI * 2 * index) / 10;
      const ray = this.add
        .line(
          0,
          0,
          position.x + Math.cos(angle) * 20,
          position.y + Math.sin(angle) * 20,
          position.x + Math.cos(angle) * 86,
          position.y + Math.sin(angle) * 86,
          0xfacc15,
          0.75
        )
        .setLineWidth(4)
        .setDepth(91);
      this.tweens.add({
        targets: ray,
        alpha: 0,
        duration: 620,
        ease: "Sine.easeOut",
        onComplete: () => ray.destroy()
      });
    }

    this.tweens.add({ targets: burst, scale: 3.2, alpha: 0, duration: 700, ease: "Sine.easeOut", onComplete: () => burst.destroy() });
    this.tweens.add({ targets: halo, scale: 2.4, alpha: 0, duration: 820, ease: "Sine.easeOut", onComplete: () => halo.destroy() });
    this.tweens.add({ targets: inner, scale: 2.8, alpha: 0, duration: 520, ease: "Sine.easeOut", onComplete: () => inner.destroy() });
    this.tweens.add({ targets: pillar, scaleY: 1.35, alpha: 0, duration: 860, ease: "Sine.easeOut", onComplete: () => pillar.destroy() });
    this.tweens.add({ targets: crown, y: crown.y - 24, scale: 1.7, alpha: 0, duration: 760, ease: "Sine.easeOut", onComplete: () => crown.destroy() });
    this.tweens.add({
      targets: text,
      y: text.y - 34,
      scale: 1.12,
      alpha: 0,
      delay: 420,
      duration: 780,
      ease: "Sine.easeIn",
      onComplete: () => text.destroy()
    });
  }

  private renderLootEventFeedback(position: Vector2, message: string, amount: number): void {
    const coinLike = /gold|coin|bounty|loot/i.test(message);
    const rare = /scroll|relic|boss|coin/i.test(message) || amount >= 100;
    const color = coinLike ? 0xfacc15 : rare ? 0x93c5fd : 0xf8fafc;
    const ring = this.add.circle(position.x, position.y - 8, rare ? 24 : 17, color, coinLike ? 0.16 : 0.1).setStrokeStyle(rare ? 4 : 3, color, rare ? 0.78 : 0.56).setDepth(83);
    this.tweens.add({ targets: ring, scale: rare ? 2.6 : 2.05, alpha: 0, duration: rare ? 620 : 420, ease: "Sine.easeOut", onComplete: () => ring.destroy() });

    if (this.isMobileTouchMode() && this.mobileSustainedLeanRuntime) {
      return;
    }

    if (!coinLike) {
      return;
    }

    const count = rare ? 10 : 6;
    for (let index = 0; index < count; index += 1) {
      const angle = -Math.PI / 2 + (index - (count - 1) / 2) * 0.28;
      const distance = 38 + (index % 3) * 11;
      const coin = this.add.circle(position.x, position.y - 10, 3.6, index % 2 === 0 ? 0xfde68a : 0xfbbf24, 0.88).setDepth(84);
      this.tweens.add({
        targets: coin,
        x: position.x + Math.cos(angle) * distance,
        y: position.y + Math.sin(angle) * distance + 18,
        alpha: 0,
        scale: 0.25,
        duration: 460 + index * 16,
        ease: "Cubic.easeOut",
        onComplete: () => coin.destroy()
      });
    }
  }

  private renderReviveEffect(position: Vector2): void {
    const ring = this.add.circle(position.x, position.y, 30, 0x22c55e, 0.08).setStrokeStyle(4, 0xbbf7d0, 0.86).setDepth(91);
    const light = this.add.rectangle(position.x, position.y - 34, 18, 112, 0xbbf7d0, 0.2).setDepth(90);
    const crossA = this.add.rectangle(position.x, position.y - 48, 48, 10, 0xf0fdf4, 0.72).setDepth(92);
    const crossB = this.add.rectangle(position.x, position.y - 48, 10, 48, 0xf0fdf4, 0.72).setDepth(92);
    this.tweens.add({ targets: ring, scale: 2.6, alpha: 0, duration: 720, ease: "Sine.easeOut", onComplete: () => ring.destroy() });
    this.tweens.add({ targets: light, y: light.y - 22, scaleY: 1.35, alpha: 0, duration: 760, ease: "Sine.easeOut", onComplete: () => light.destroy() });
    this.tweens.add({ targets: [crossA, crossB], y: position.y - 76, scale: 1.2, alpha: 0, duration: 680, ease: "Sine.easeOut", onComplete: () => {
      crossA.destroy();
      crossB.destroy();
    }});
  }

  private renderHealingEffect(position: Vector2): void {
    const ring = this.add.circle(position.x, position.y, 22, 0x22c55e, 0.1).setStrokeStyle(3, 0x86efac, 0.82).setDepth(91);
    const pulse = this.add.circle(position.x, position.y - 30, 12, 0xbbf7d0, 0.34).setDepth(92);
    const crossA = this.add.rectangle(position.x, position.y - 30, 34, 7, 0xf0fdf4, 0.74).setDepth(93);
    const crossB = this.add.rectangle(position.x, position.y - 30, 7, 34, 0xf0fdf4, 0.74).setDepth(93);
    this.tweens.add({ targets: ring, scale: 2, alpha: 0, duration: 520, ease: "Sine.easeOut", onComplete: () => ring.destroy() });
    this.tweens.add({ targets: pulse, y: pulse.y - 18, scale: 1.4, alpha: 0, duration: 540, ease: "Sine.easeOut", onComplete: () => pulse.destroy() });
    this.tweens.add({
      targets: [crossA, crossB],
      y: position.y - 52,
      scale: 1.1,
      alpha: 0,
      duration: 520,
      ease: "Sine.easeOut",
      onComplete: () => {
        crossA.destroy();
        crossB.destroy();
      }
    });
  }

  private renderLocalAttackIntent(aim: Vector2, charge?: number, targetId?: string): void {
    const local = this.localPlayer();
    if (!local) {
      return;
    }

    const attackCharge = local.classId === "archer" ? Phaser.Math.Clamp(charge ?? 0, 0, 1) : 1;
    this.playClassAttackSound(local.classId, attackCharge);
    const origin = this.localRenderPosition(local);
    const range = this.attackRange(local);
    const distance = Phaser.Math.Distance.Between(origin.x, origin.y, aim.x, aim.y);
    const cappedAim =
      distance > range && distance > 0
        ? {
            x: origin.x + ((aim.x - origin.x) / distance) * range,
            y: origin.y + ((aim.y - origin.y) / distance) * range
          }
        : aim;

    const lockedProjectileTarget = targetId ? this.findEntity(targetId) : undefined;
    const firstProjectileTarget = lockedProjectileTarget ?? (local.classId === "archer" || local.classId === "mage" ? this.firstShotTarget(local, cappedAim) : undefined);
    const projectileAim = firstProjectileTarget ? this.entityRenderPosition(firstProjectileTarget) : cappedAim;
    if (local.classId === "archer") {
      this.renderArrowProjectile(origin, projectileAim, attackCharge, firstProjectileTarget?.id, local.id);
      return;
    }
    if (local.classId === "mage") {
      this.renderMagicProjectile(origin, projectileAim, false, firstProjectileTarget?.id, local.id);
      return;
    }
    this.renderMeleeAttack(origin, cappedAim, local.classId, local.id);
  }

  private renderCombatTrail(from: Vector2, to: Vector2, kind: "attack" | "skill" | "monster", classId?: string, sourceId?: string, important = false, targetId?: string, skillId?: string, attackStyle?: MonsterAttackStyle): void {
    if (this.isMobileTouchMode() && this.mobileSustainedLeanRuntime && !important) {
      return;
    }

    const hit = this.effectAnchorPosition(targetId, to);
    if (kind === "skill" && classId) {
      this.renderClassSkillEffect(from, hit, classId, targetId, skillId, undefined, sourceId);
      return;
    }
    if (classId === "archer" && kind === "attack") {
      this.renderArrowProjectile(from, hit, 1, targetId, sourceId);
      return;
    }
    if (classId === "mage") {
      this.renderMagicProjectile(from, hit, kind === "skill", targetId, sourceId);
      return;
    }
    if (kind === "monster") {
      this.renderMonsterAttackCue(from, hit, sourceId, important, attackStyle, targetId);
      return;
    }
    if ((classId === "warrior" || classId === "assassin" || classId === "tank") && kind === "attack") {
      this.renderMeleeAttack(from, hit, classId, sourceId);
      return;
    }

    const color = kind === "skill" ? 0x38bdf8 : 0xf8fafc;
    const trail = this.trackTransient(this.add.ellipse(hit.x, hit.y, kind === "skill" ? 46 : 26, kind === "skill" ? 18 : 10, color, kind === "skill" ? 0.22 : 0.16).setDepth(70), 900);
    this.tweens.add({
      targets: trail,
      scale: kind === "skill" ? 1.8 : 1.35,
      alpha: 0,
      duration: kind === "skill" ? 240 : 160,
      onComplete: () => this.destroyTransientEffect(trail)
    });
  }

  private renderMonsterAttackCue(from: Vector2, to: Vector2, sourceId?: string, important = false, attackStyle?: MonsterAttackStyle, targetId?: string): void {
    const sourceEntity = sourceId ? this.findEntity(sourceId) : undefined;
    const archetype = sourceEntity && "archetype" in sourceEntity ? sourceEntity.archetype : undefined;
    const source = sourceEntity && "archetype" in sourceEntity ? this.entityRenderPosition(sourceEntity) : this.effectAnchorPosition(sourceId, from);
    if (attackStyle === "arrow" || attackStyle === "power-arrow" || archetype === "archer") {
      this.renderMonsterArrowProjectile(source, to, archetype, important, targetId, attackStyle === "power-arrow");
      return;
    }
    if (attackStyle === "lightning") {
      this.renderMonsterLightningAttack(source, to, archetype, important, targetId);
      return;
    }
    if (attackStyle === "magic-bolt" || archetype === "mage") {
      this.renderMonsterMagicBolt(source, to, archetype, important, targetId);
      return;
    }
    if (attackStyle === "flame") {
      this.renderMonsterFlameAttack(source, to, archetype ?? "drake", important);
      return;
    }
    if (attackStyle === "slam") {
      this.renderMonsterSlamAttack(source, to, archetype ?? "golem", important);
      return;
    }
    if (attackStyle === "shadow") {
      this.renderMonsterShadowAttack(source, to, archetype ?? "wraith", important);
      return;
    }
    if (attackStyle === "arcane") {
      this.renderMonsterArcaneAttack(source, to, archetype ?? "witch", important);
      return;
    }
    if (attackStyle === "weapon") {
      this.renderMonsterWeaponAttack(source, to, archetype ?? "bandit", important);
      return;
    }
    if (archetype === "drake" || archetype === "dragon") {
      this.renderMonsterFlameAttack(source, to, archetype, important);
      return;
    }
    if (archetype === "golem" || archetype === "miniboss" || archetype === "dungeonboss" || archetype === "boss") {
      this.renderMonsterSlamAttack(source, to, archetype, important);
      return;
    }
    if (archetype === "wraith" || archetype === "bat") {
      this.renderMonsterShadowAttack(source, to, archetype, important);
      return;
    }
    if (archetype === "eye" || archetype === "witch") {
      this.renderMonsterArcaneAttack(source, to, archetype, important);
      return;
    }
    if (archetype === "bandit" || archetype === "skeleton" || archetype === "sentinel") {
      this.renderMonsterWeaponAttack(source, to, archetype, important);
      return;
    }
    this.renderMonsterClawAttack(source, to, archetype, important);
  }

  private renderMonsterClawAttack(source: Vector2, to: Vector2, archetype: MonsterArchetype | undefined, important = false): void {
    const angle = Math.atan2(to.y - source.y, to.x - source.x);
    const distance = Phaser.Math.Distance.Between(source.x, source.y, to.x, to.y);
    const color = archetype === "spider" ? 0xa3e635 : archetype === "boar" ? 0xf59e0b : important ? 0xf97316 : 0xfbbf24;
    const reach = Math.min(distance, important ? 90 : 66);
    const end = { x: source.x + Math.cos(angle) * reach, y: source.y + Math.sin(angle) * reach };
    const side = { x: -Math.sin(angle), y: Math.cos(angle) };
    for (let index = 0; index < 3; index += 1) {
      const offset = (index - 1) * (important ? 11 : 8);
      const slash = this.trackTransient(
        this.add
          .line(0, 0, source.x + Math.cos(angle) * 12 + side.x * offset, source.y + Math.sin(angle) * 12 + side.y * offset, end.x + side.x * offset * 0.35, end.y + side.y * offset * 0.35, color, important ? 0.78 : 0.5)
          .setLineWidth(important ? 5 : 4)
          .setDepth(79),
        760
      );
      this.tweens.add({ targets: slash, alpha: 0, duration: 160 + index * 22, ease: "Sine.easeOut", onComplete: () => this.destroyTransientEffect(slash) });
    }
    const claw = this.trackTransient(this.add.arc(to.x, to.y, important ? 30 : 23, -55, 55, false, color, 0).setStrokeStyle(important ? 5 : 4, color, important ? 0.7 : 0.48).setRotation(angle + 0.2).setDepth(80), 820);
    this.tweens.add({ targets: claw, rotation: angle + 0.72, alpha: 0, duration: 240, ease: "Sine.easeOut", onComplete: () => this.destroyTransientEffect(claw) });
  }

  private renderMonsterArrowProjectile(source: Vector2, to: Vector2, archetype: MonsterArchetype | undefined, important = false, targetId?: string, power = false): void {
    const angle = Math.atan2(to.y - source.y, to.x - source.x);
    const distance = Phaser.Math.Distance.Between(source.x, source.y, to.x, to.y);
    const color = power ? 0xfacc15 : archetype === "sentinel" ? 0x93c5fd : 0xf8fafc;
    const duration = Phaser.Math.Clamp(distance * (power ? 0.27 : 0.32), important ? 130 : 118, important ? 310 : 270);
    const arrow = this.trackTransient(
      this.add.image(source.x, source.y, "projectile-arrow").setRotation(angle).setTint(color).setDepth(83).setScale(power ? important ? 1.55 : 1.32 : important ? 1.24 : 1.02),
      1_100
    );
    const trail = this.trackTransient(this.add.circle(source.x, source.y, power ? important ? 15 : 12 : important ? 10 : 7, color, power ? 0.34 : important ? 0.22 : 0.14).setDepth(82).setBlendMode(Phaser.BlendModes.ADD), 1_100);
    const cast = power
      ? this.trackTransient(this.add.circle(source.x, source.y, important ? 22 : 17, color, 0).setStrokeStyle(important ? 4 : 3, color, important ? 0.66 : 0.48).setDepth(82).setBlendMode(Phaser.BlendModes.ADD), 820)
      : undefined;
    if (cast) {
      this.tweens.add({ targets: cast, scale: important ? 1.85 : 1.45, alpha: 0, duration: important ? 300 : 230, ease: "Sine.easeOut", onComplete: () => this.destroyTransientEffect(cast) });
    }
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration,
      ease: "Sine.easeOut",
      onUpdate: (tween) => {
        const progress = Number(tween.getValue() ?? 0);
        const hit = this.effectAnchorPosition(targetId, to);
        const nextX = Phaser.Math.Linear(source.x, hit.x, progress);
        const nextY = Phaser.Math.Linear(source.y, hit.y, progress);
        const nextAngle = Math.atan2(hit.y - source.y, hit.x - source.x);
        arrow.setPosition(nextX, nextY).setRotation(nextAngle);
        trail.setPosition(nextX, nextY);
      },
      onComplete: () => {
        const hit = this.effectAnchorPosition(targetId, to);
        this.renderEnergyImpactBurst(hit, color, important || power);
        this.destroyTransientEffect(arrow);
        this.destroyTransientEffect(trail);
      }
    });
  }

  private renderMonsterMagicBolt(source: Vector2, to: Vector2, archetype: MonsterArchetype | undefined, important = false, targetId?: string): void {
    const angle = Math.atan2(to.y - source.y, to.x - source.x);
    const distance = Phaser.Math.Distance.Between(source.x, source.y, to.x, to.y);
    const color = archetype === "venomplant" ? 0x84cc16 : archetype === "eye" ? 0x22d3ee : archetype === "mage" ? 0x60a5fa : 0xc084fc;
    const core = archetype === "venomplant" ? 0xecfccb : archetype === "mage" ? 0xe0f2fe : 0xf5d0fe;
    const duration = Phaser.Math.Clamp(distance * 0.28, important ? 155 : 135, important ? 340 : 290);
    const cast = this.trackTransient(
      this.add.circle(source.x, source.y, important ? 24 : 18, color, 0).setStrokeStyle(important ? 4 : 3, core, important ? 0.62 : 0.44).setDepth(82).setBlendMode(Phaser.BlendModes.ADD),
      900
    );
    const orb = this.trackTransient(this.add.image(source.x, source.y, "projectile-magic").setTint(color).setDepth(83).setScale(important ? 1.24 : 0.94).setBlendMode(Phaser.BlendModes.ADD), 1_100);
    const aura = this.trackTransient(this.add.circle(source.x, source.y, important ? 16 : 12, color, important ? 0.26 : 0.18).setDepth(82).setBlendMode(Phaser.BlendModes.ADD), 1_100);
    this.tweens.add({ targets: cast, scale: important ? 1.9 : 1.55, alpha: 0, duration: important ? 320 : 240, ease: "Sine.easeOut", onComplete: () => this.destroyTransientEffect(cast) });
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration,
      ease: "Sine.easeOut",
      onUpdate: (tween) => {
        const progress = Number(tween.getValue() ?? 0);
        const hit = this.effectAnchorPosition(targetId, to);
        const curve = Math.sin(progress * Math.PI) * Math.min(28, 10 + distance * 0.035);
        const side = { x: -Math.sin(angle), y: Math.cos(angle) };
        const nextX = Phaser.Math.Linear(source.x, hit.x, progress) + side.x * curve;
        const nextY = Phaser.Math.Linear(source.y, hit.y, progress) + side.y * curve;
        orb.setPosition(nextX, nextY).setRotation(progress * 3.8);
        aura.setPosition(nextX, nextY);
      },
      onComplete: () => {
        const hit = this.effectAnchorPosition(targetId, to);
        const burst = this.trackTransient(this.add.circle(hit.x, hit.y, important ? 38 : 28, color, important ? 0.3 : 0.22).setDepth(84).setBlendMode(Phaser.BlendModes.ADD), 900);
        this.renderEnergyImpactBurst(hit, color, important);
        this.tweens.add({ targets: burst, scale: important ? 2 : 1.7, alpha: 0, duration: 320, ease: "Sine.easeOut", onComplete: () => this.destroyTransientEffect(burst) });
        this.destroyTransientEffect(orb);
        this.destroyTransientEffect(aura);
      }
    });
  }

  private renderMonsterLightningAttack(source: Vector2, to: Vector2, archetype: MonsterArchetype | undefined, important = false, targetId?: string): void {
    const hit = this.effectAnchorPosition(targetId, to);
    const angle = Math.atan2(hit.y - source.y, hit.x - source.x);
    const distance = Phaser.Math.Distance.Between(source.x, source.y, hit.x, hit.y);
    const color = archetype === "dungeonboss" ? 0xa78bfa : archetype === "mage" ? 0x60a5fa : 0x93c5fd;
    const core = 0xe0f2fe;
    const segments = this.mobileSustainedLeanRuntime ? 4 : important ? 8 : 6;
    const points: Vector2[] = [source];
    for (let index = 1; index < segments; index += 1) {
      const progress = index / segments;
      const jitter = Math.sin(this.time.now * 0.019 + index * 2.31 + distance * 0.01) * Math.min(38, 12 + distance * 0.05);
      points.push({
        x: Phaser.Math.Linear(source.x, hit.x, progress) + Math.cos(angle + Math.PI / 2) * jitter,
        y: Phaser.Math.Linear(source.y, hit.y, progress) + Math.sin(angle + Math.PI / 2) * jitter
      });
    }
    points.push(hit);

    for (let index = 0; index < points.length - 1; index += 1) {
      const start = points[index];
      const end = points[index + 1];
      const glow = this.trackTransient(this.add.line(0, 0, start.x, start.y, end.x, end.y, color, important ? 0.42 : 0.3).setLineWidth(important ? 12 : 9).setDepth(82).setBlendMode(Phaser.BlendModes.ADD), 900);
      const bolt = this.trackTransient(this.add.line(0, 0, start.x, start.y, end.x, end.y, core, important ? 0.88 : 0.72).setLineWidth(important ? 4 : 3).setDepth(83).setBlendMode(Phaser.BlendModes.ADD), 900);
      this.tweens.add({ targets: [glow, bolt], alpha: 0, duration: 150 + index * 9, ease: "Sine.easeOut", onComplete: () => {
        this.destroyTransientEffect(glow);
        this.destroyTransientEffect(bolt);
      }});
    }

    const branchCount = this.mobileSustainedLeanRuntime ? 1 : important ? 4 : 2;
    for (let index = 0; index < branchCount; index += 1) {
      const anchor = points[Math.max(1, Math.min(points.length - 2, 1 + index * 2))] ?? hit;
      const branchAngle = angle + (index % 2 === 0 ? 1 : -1) * (0.66 + index * 0.14);
      const length = 28 + index * 9;
      const branch = this.trackTransient(
        this.add.line(0, 0, anchor.x, anchor.y, anchor.x + Math.cos(branchAngle) * length, anchor.y + Math.sin(branchAngle) * length, core, important ? 0.62 : 0.46).setLineWidth(3).setDepth(82).setBlendMode(Phaser.BlendModes.ADD),
        760
      );
      this.tweens.add({ targets: branch, alpha: 0, duration: 140, ease: "Sine.easeOut", onComplete: () => this.destroyTransientEffect(branch) });
    }

    this.renderEnergyImpactBurst(hit, color, important);
  }

  private renderMonsterWeaponAttack(source: Vector2, to: Vector2, archetype: MonsterArchetype, important = false): void {
    const angle = Math.atan2(to.y - source.y, to.x - source.x);
    const color = archetype === "sentinel" ? 0x93c5fd : archetype === "skeleton" || archetype === "bonewarrior" ? 0xe5e7eb : 0xfbbf24;
    const arc = this.trackTransient(this.add.arc(source.x, source.y, important ? 72 : 56, -34, 58, false, color, 0).setStrokeStyle(important ? 6 : 4, color, important ? 0.78 : 0.55).setRotation(angle - 0.35).setDepth(80), 860);
    const hit = this.trackTransient(this.add.line(0, 0, source.x, source.y, to.x, to.y, color, important ? 0.5 : 0.34).setLineWidth(important ? 6 : 4).setDepth(79), 780);
    this.tweens.add({ targets: arc, rotation: angle + 0.64, alpha: 0, duration: 230, ease: "Sine.easeOut", onComplete: () => this.destroyTransientEffect(arc) });
    this.tweens.add({ targets: hit, alpha: 0, duration: 180, ease: "Sine.easeOut", onComplete: () => this.destroyTransientEffect(hit) });
    if (archetype === "sentinel") {
      this.renderEnergyImpactBurst(to, color, important);
    }
  }

  private renderMonsterShadowAttack(source: Vector2, to: Vector2, archetype: MonsterArchetype, important = false): void {
    const angle = Math.atan2(to.y - source.y, to.x - source.x);
    const color = archetype === "venomplant" ? 0x84cc16 : archetype === "bat" ? 0x64748b : 0xa78bfa;
    const shadow = this.trackTransient(this.add.ellipse(source.x, source.y, important ? 70 : 48, important ? 22 : 16, color, important ? 0.28 : 0.18).setRotation(angle).setDepth(78), 850);
    const streak = this.trackTransient(this.add.line(0, 0, source.x, source.y, to.x, to.y, color, important ? 0.72 : 0.48).setLineWidth(important ? 8 : 6).setDepth(80).setBlendMode(Phaser.BlendModes.ADD), 820);
    this.tweens.add({ targets: shadow, x: to.x, y: to.y, scaleX: 1.8, alpha: 0, duration: 210, ease: "Sine.easeOut", onComplete: () => this.destroyTransientEffect(shadow) });
    this.tweens.add({ targets: streak, alpha: 0, duration: 170, ease: "Sine.easeOut", onComplete: () => this.destroyTransientEffect(streak) });
    const pop = this.trackTransient(this.add.circle(to.x, to.y, important ? 18 : 12, color, important ? 0.26 : 0.16).setDepth(81).setBlendMode(Phaser.BlendModes.ADD), 760);
    this.tweens.add({ targets: pop, scale: important ? 2.4 : 1.8, alpha: 0, duration: 260, onComplete: () => this.destroyTransientEffect(pop) });
  }

  private renderMonsterArcaneAttack(source: Vector2, to: Vector2, archetype: MonsterArchetype, important = false): void {
    const dungeonBoss = archetype === "dungeonboss";
    const color = archetype === "eye" ? 0x22d3ee : dungeonBoss ? 0xa855f7 : 0xc084fc;
    const core = archetype === "eye" ? 0xe0f2fe : dungeonBoss ? 0x38bdf8 : 0xf5d0fe;
    const beam = this.trackTransient(this.add.line(0, 0, source.x, source.y, to.x, to.y, core, important ? 0.82 : dungeonBoss ? 0.68 : 0.58).setLineWidth(important || dungeonBoss ? 5 : 3).setDepth(82).setBlendMode(Phaser.BlendModes.ADD), 820);
    const glow = this.trackTransient(this.add.line(0, 0, source.x, source.y, to.x, to.y, color, important ? 0.34 : dungeonBoss ? 0.28 : 0.22).setLineWidth(important || dungeonBoss ? 13 : 9).setDepth(81).setBlendMode(Phaser.BlendModes.ADD), 820);
    const orb = this.trackTransient(this.add.circle(to.x, to.y, important || dungeonBoss ? 18 : 13, color, important ? 0.28 : dungeonBoss ? 0.24 : 0.18).setDepth(83).setBlendMode(Phaser.BlendModes.ADD), 840);
    this.tweens.add({ targets: [beam, glow], alpha: 0, duration: 180, ease: "Sine.easeOut", onComplete: () => {
      this.destroyTransientEffect(beam);
      this.destroyTransientEffect(glow);
    }});
    this.tweens.add({ targets: orb, scale: important || dungeonBoss ? 2.2 : 1.75, alpha: 0, duration: 260, onComplete: () => this.destroyTransientEffect(orb) });
  }

  private renderMonsterFlameAttack(source: Vector2, to: Vector2, archetype: MonsterArchetype, important = false): void {
    const angle = Math.atan2(to.y - source.y, to.x - source.x);
    const color = archetype === "dragon" ? 0xef4444 : 0xf97316;
    const core = 0xfef3c7;
    const flame = this.trackTransient(this.add.line(0, 0, source.x, source.y, to.x, to.y, color, important ? 0.62 : 0.42).setLineWidth(archetype === "dragon" || important ? 18 : 12).setDepth(82).setBlendMode(Phaser.BlendModes.ADD), 860);
    const hot = this.trackTransient(this.add.line(0, 0, source.x, source.y, to.x, to.y, core, important ? 0.58 : 0.36).setLineWidth(archetype === "dragon" || important ? 7 : 5).setDepth(83), 840);
    this.tweens.add({ targets: [flame, hot], alpha: 0, duration: 230, ease: "Sine.easeOut", onComplete: () => {
      this.destroyTransientEffect(flame);
      this.destroyTransientEffect(hot);
    }});
    const embers = this.mobileSustainedLeanRuntime ? 3 : archetype === "dragon" ? 8 : 5;
    for (let index = 0; index < embers; index += 1) {
      const side = (index - (embers - 1) / 2) * 8;
      const ember = this.trackTransient(this.add.circle(source.x, source.y, 4, index % 2 === 0 ? core : color, 0.82).setDepth(84), 760);
      this.tweens.add({ targets: ember, x: to.x + Math.cos(angle + Math.PI / 2) * side, y: to.y + Math.sin(angle + Math.PI / 2) * side, scale: 0.25, alpha: 0, duration: 220 + index * 12, onComplete: () => this.destroyTransientEffect(ember) });
    }
  }

  private renderMonsterSlamAttack(source: Vector2, to: Vector2, archetype: MonsterArchetype, important = false): void {
    const color = archetype === "boss" ? 0xef4444 : archetype === "dungeonboss" ? 0xa855f7 : archetype === "miniboss" ? 0xf97316 : 0x94a3b8;
    const angle = Math.atan2(to.y - source.y, to.x - source.x);
    const heavy = archetype === "boss" || archetype === "dungeonboss";
    const strike = this.trackTransient(this.add.line(0, 0, source.x, source.y, to.x, to.y, color, important ? 0.66 : 0.42).setLineWidth(important || heavy ? 10 : 7).setDepth(80), 820);
    const quake = this.trackTransient(this.add.circle(to.x, to.y, important || heavy ? 30 : 22, color, 0).setStrokeStyle(important || heavy ? 6 : 4, color, important ? 0.82 : heavy ? 0.72 : 0.58).setDepth(82), 920);
    const dust = this.trackTransient(this.add.ellipse(to.x, to.y + 12, important || heavy ? 58 : 42, important || heavy ? 22 : 16, 0x0f172a, important ? 0.28 : heavy ? 0.24 : 0.18).setRotation(angle).setDepth(78), 820);
    this.tweens.add({ targets: strike, alpha: 0, duration: 190, ease: "Sine.easeOut", onComplete: () => this.destroyTransientEffect(strike) });
    this.tweens.add({ targets: quake, scale: archetype === "boss" ? 2.8 : archetype === "dungeonboss" ? 2.55 : 2.15, alpha: 0, duration: 360, ease: "Sine.easeOut", onComplete: () => this.destroyTransientEffect(quake) });
    this.tweens.add({ targets: dust, scaleX: 1.8, alpha: 0, duration: 330, ease: "Sine.easeOut", onComplete: () => this.destroyTransientEffect(dust) });
  }

  private playNoteSequence(
    notes: Array<{ frequency: number; duration: number; volume: number; delay: number; type?: OscillatorType; filter?: number }>
  ): void {
    const sequence = this.isMobileTouchMode() && this.mobileLeanRuntime ? notes.slice(0, 1) : notes;
    for (const note of sequence) {
      this.scheduleTone(() => this.playTone(note.frequency, note.duration, note.volume, 0, note.type ?? "triangle", note.filter ?? 1800), note.delay);
    }
  }

  private scheduleTone(callback: () => void, delay: number): void {
    if (this.isMobileTouchMode() && this.toneTimers.size >= (this.mobileDeepSustainRuntime ? 2 : this.mobileSustainedLeanRuntime ? 3 : this.mobileLeanRuntime ? 6 : 16)) {
      return;
    }

    const timer = window.setTimeout(() => {
      this.toneTimers.delete(timer);
      callback();
    }, delay);
    this.toneTimers.add(timer);
  }

  private clearToneTimers(): void {
    for (const timer of this.toneTimers) {
      window.clearTimeout(timer);
    }
    this.toneTimers.clear();
  }

  private playMovementSound(kind: "jump" | "doubleJump" | "roll" | "draw" | "release"): void {
    if (kind === "doubleJump") {
      this.playTone([174, 92], 0.09, 0.025, 22, "triangle", 620);
      this.playNoiseBurst(0.065, 0.01, [1_800, 620]);
      return;
    }
    if (kind === "jump") {
      this.playTone([132, 76], 0.08, 0.022, 22, "triangle", 480);
      this.playNoiseBurst(0.052, 0.009, [760, 240], 0, "lowpass");
      return;
    }
    if (kind === "roll") {
      this.playTone([98, 42], 0.095, 0.032, 24, "sawtooth", 360);
      this.playNoiseBurst(0.085, 0.016, [1_200, 250], 0, "lowpass");
      return;
    }
    if (kind === "draw") {
      this.playTone([122, 82], 0.1, 0.018, 24, "triangle", 420);
      this.playNoiseBurst(0.075, 0.009, [1_700, 650]);
      return;
    }
    this.playTone([165, 64], 0.068, 0.026, 22, "triangle", 600);
    this.playNoiseBurst(0.06, 0.014, [3_200, 850]);
  }

  private playUiOpenSound(kind: "shop" | "gate"): void {
    if (kind === "gate") {
      this.playTone([142, 58], 0.16, 0.029, 35, "triangle", 520);
      this.playNoiseBurst(0.14, 0.011, [2_200, 420]);
      return;
    }
    this.playTone([176, 118], 0.075, 0.024, 35, "triangle", 560);
    this.playNoiseBurst(0.052, 0.009, [1_500, 480], 0, "lowpass");
  }

  private playResourceOpenSound(kind: string): void {
    const chest = kind === "chest";
    this.playTone(chest ? [104, 48] : [142, 82], chest ? 0.13 : 0.08, chest ? 0.034 : 0.025, 35, chest ? "sawtooth" : "triangle", chest ? 380 : 480);
    this.playNoiseBurst(chest ? 0.12 : 0.065, chest ? 0.018 : 0.01, chest ? [980, 230] : [1_650, 480], 0, chest ? "lowpass" : "bandpass");
  }

  private playLevelUpSound(): void {
    this.playTone([110, 62], 0.18, 0.034, 0, "triangle", 480);
    this.playNoiseBurst(0.28, 0.007, [2_400, 820], 24, "highpass");
    this.playNoteSequence([
      { frequency: 196, duration: 0.12, volume: 0.024, delay: 90, type: "sine", filter: 900 },
      { frequency: 294, duration: 0.15, volume: 0.021, delay: 190, type: "sine", filter: 1100 },
      { frequency: 392, duration: 0.2, volume: 0.018, delay: 310, type: "sine", filter: 1350 }
    ]);
  }

  private playReviveSound(): void {
    this.playTone([146, 102], 0.18, 0.027, 0, "sine", 620);
    this.playNoiseBurst(0.2, 0.006, [1_800, 620], 18, "highpass");
    if (!this.isMobileTouchMode()) {
      this.scheduleTone(() => this.playTone([245, 196], 0.18, 0.015, 0, "sine", 900), 110);
    }
  }

  private playSoftRewardTick(): void {
    this.playTone([230, 176], 0.06, 0.022, 60, "sine", 720);
    this.playNoiseBurst(0.038, 0.006, [1_800, 760]);
  }

  private playClassAttackSound(classId: PlayerPublicState["classId"], charge = 1): void {
    if (classId === "archer") {
      this.playTone([205 + charge * 24, 86], 0.068 + charge * 0.018, 0.022 + charge * 0.005, 22, "triangle", 680);
      this.playNoiseBurst(0.065 + charge * 0.018, 0.012 + charge * 0.003, [3_200, 860]);
      return;
    }
    if (classId === "mage") {
      this.playTone([285, 132], 0.11, 0.025, 24, "triangle", 1_050);
      this.playNoiseBurst(0.1, 0.008, [3_800, 1_100]);
      return;
    }
    if (classId === "assassin") {
      this.playTone([220, 82], 0.05, 0.026, 18, "triangle", 700);
      this.playNoiseBurst(0.048, 0.015, [4_200, 1_050]);
      return;
    }
    if (classId === "tank") {
      this.playTone([112, 44], 0.12, 0.036, 24, "sawtooth", 360);
      this.playNoiseBurst(0.13, 0.021, [920, 230], 0, "lowpass");
      return;
    }
    this.playTone([178, 62], 0.085, 0.032, 20, "sawtooth", 520);
    this.playNoiseBurst(0.078, 0.016, [2_200, 520]);
  }

  private playSkillCastSound(classId: PlayerPublicState["classId"], skillIndex: number): void {
    const skillId = CLASS_DEFINITIONS[classId].skills[skillIndex]?.id ?? "";
    const power = 0.9 + Math.min(4, Math.max(0, skillIndex)) * 0.1;

    if (skillId === "healing-light") {
      this.playTone([224, 184], 0.22, 0.024, 18, "sine", 820);
      this.playNoiseBurst(0.18, 0.006, [1_600, 580], 0, "highpass");
      if (!this.isMobileTouchMode()) {
        this.scheduleTone(() => this.playTone([294, 245], 0.18, 0.014, 0, "sine", 1_000), 90);
      }
      return;
    }

    if (/meteor|ground-slam|earth-splitter/.test(skillId)) {
      this.playTone([92, 38], 0.16 * power, 0.038 * power, 18, "sawtooth", 330);
      this.playNoiseBurst(0.18 * power, 0.024 * power, [900, 180], 0, "lowpass");
      return;
    }

    if (skillId === "arc-lightning") {
      this.playTone([380, 108], 0.072, 0.027, 18, "sawtooth", 1_100);
      this.playNoiseBurst(0.06, 0.018, [4_800, 900]);
      return;
    }

    if (skillId === "whirlwind" || skillId === "smoke-dance") {
      const smoky = skillId === "smoke-dance";
      this.playTone(smoky ? [196, 54] : [168, 46], smoky ? 0.16 : 0.18, smoky ? 0.028 : 0.034, 18, "sawtooth", smoky ? 620 : 440);
      this.playNoiseBurst(smoky ? 0.2 : 0.18, smoky ? 0.019 : 0.021, smoky ? [3_400, 340] : [2_200, 240], 0, smoky ? "bandpass" : "lowpass");
      return;
    }

    if (/shadow-step|rush-break/.test(skillId)) {
      this.playTone([260, 72], 0.075 * power, 0.028 * power, 18, "triangle", 760);
      this.playNoiseBurst(0.09 * power, 0.017 * power, [4_200, 720]);
      return;
    }

    if (skillId === "twin-cut") {
      this.playTone([238, 70], 0.062, 0.027, 18, "triangle", 720);
      this.playNoiseBurst(0.052, 0.016, [4_100, 920]);
      if (!this.isMobileTouchMode()) {
        this.playNoiseBurst(0.048, 0.012, [3_600, 760], 58);
      }
      return;
    }

    if (skillId === "venom-fang") {
      this.playTone([214, 62], 0.095, 0.029, 18, "triangle", 660);
      this.playNoiseBurst(0.105, 0.016, [2_800, 420]);
      return;
    }

    if (/piercing-shot|pinning-shot|volley|rain-of-arrows/.test(skillId)) {
      const rain = skillId === "rain-of-arrows" || skillId === "volley";
      this.playTone([rain ? 184 : 235, rain ? 76 : 92], rain ? 0.13 : 0.08, rain ? 0.025 : 0.028, 18, "triangle", 720);
      this.playNoiseBurst(rain ? 0.16 : 0.075, rain ? 0.014 : 0.017, [rain ? 3_600 : 4_300, rain ? 680 : 1_000]);
      return;
    }

    if (skillId === "fire-nova") {
      this.playTone([168, 58], 0.14, 0.031, 18, "sawtooth", 520);
      this.playNoiseBurst(0.16, 0.019, [1_500, 260], 0, "lowpass");
      return;
    }

    if (skillId === "frost-bolt") {
      this.playTone([310, 156], 0.12, 0.024, 18, "sine", 1_050);
      this.playNoiseBurst(0.105, 0.009, [3_200, 920], 0, "highpass");
      return;
    }

    if (/shield-bash|guard-break/.test(skillId)) {
      this.playTone([122, 46], 0.13, 0.037, 18, "sawtooth", 360);
      this.playNoiseBurst(0.085, 0.018, [1_800, 420]);
      return;
    }

    if (skillId === "iron-roar") {
      this.playTone([118, 34], 0.2, 0.04, 18, "sawtooth", 320);
      this.playNoiseBurst(0.22, 0.023, [1_100, 150], 0, "lowpass");
      return;
    }

    const profile: Record<PlayerPublicState["classId"], { tone: readonly [number, number]; noise: readonly [number, number]; duration: number; volume: number; noiseVolume: number; type: OscillatorType; filter: number }> = {
      warrior: { tone: [190, 58], noise: [2_500, 480], duration: 0.11, volume: 0.033, noiseVolume: 0.017, type: "sawtooth", filter: 520 },
      assassin: { tone: [245, 74], noise: [4_200, 880], duration: 0.075, volume: 0.028, noiseVolume: 0.016, type: "triangle", filter: 740 },
      mage: { tone: [320, 138], noise: [3_800, 980], duration: 0.14, volume: 0.027, noiseVolume: 0.009, type: "triangle", filter: 1_100 },
      archer: { tone: [225, 86], noise: [3_600, 820], duration: 0.09, volume: 0.027, noiseVolume: 0.014, type: "triangle", filter: 720 },
      tank: { tone: [118, 42], noise: [1_050, 240], duration: 0.15, volume: 0.039, noiseVolume: 0.022, type: "sawtooth", filter: 360 }
    };
    const cue = profile[classId];
    this.playTone(cue.tone, cue.duration * power, cue.volume * power, 18, cue.type, cue.filter);
    this.playNoiseBurst(cue.duration * power, cue.noiseVolume * power, cue.noise, 0, classId === "tank" ? "lowpass" : "bandpass");
  }

  private playMonsterKillSound(rare = false): void {
    this.playTone(rare ? [158, 52] : [128, 46], rare ? 0.17 : 0.11, rare ? 0.039 : 0.031, 0, "sawtooth", rare ? 520 : 420);
    this.playNoiseBurst(rare ? 0.16 : 0.1, rare ? 0.018 : 0.013, rare ? [2_400, 380] : [1_600, 300], 0, "lowpass");
    if (rare && !this.isMobileTouchMode()) {
      this.scheduleTone(() => this.playTone([294, 220], 0.16, 0.014, 0, "sine", 1_050), 125);
    }
  }

  private playLootDropSound(kind: GroundItem["kind"], rare = false): void {
    const now = this.time.now;
    if (now - this.lastLootSoundAt < 85) {
      return;
    }

    this.lastLootSoundAt = now;
    const coinLike = kind === "coin" || kind === "gold";
    this.playTone(coinLike ? [520, 380] : [178, 112], coinLike ? 0.05 : 0.075, rare ? 0.03 : 0.022, 0, coinLike ? "sine" : "triangle", coinLike ? 1_050 : 560);
    this.playNoiseBurst(coinLike ? 0.045 : 0.065, coinLike ? 0.008 : 0.012, coinLike ? [3_600, 1_500] : [920, 240], 0, coinLike ? "bandpass" : "lowpass");
    if (rare && !this.isMobileTouchMode()) {
      this.scheduleTone(() => this.playTone([330, 245], 0.12, 0.014, 0, "sine", 980), 85);
    }
  }

  private playPickupSound(kind: GroundItem["kind"], rare = false): void {
    // Remember when the local pickup chime played so the server's loot event for the
    // same pickup (arriving ~1 RTT later) doesn't layer a second chime on top.
    this.lastLocalPickupSoundAt = this.time.now;
    const item = kind === "item";
    this.playTone(item ? [164, 108] : [500, 370], item ? 0.068 : 0.045, rare ? 0.029 : 0.021, 0, item ? "triangle" : "sine", item ? 560 : 1_000);
    this.playNoiseBurst(item ? 0.06 : 0.04, item ? 0.011 : 0.007, item ? [780, 230] : [3_400, 1_450], 0, item ? "lowpass" : "bandpass");
    if (rare && !this.isMobileTouchMode()) {
      this.scheduleTone(() => this.playTone([294, 220], 0.11, 0.012, 0, "sine", 900), 72);
    }
  }

  private playLootEventSound(message: string): void {
    const coinLike = /gold|coin|bounty|loot/i.test(message);
    if (coinLike) {
      this.playLootDropSound(message.toLowerCase().includes("coin") ? "coin" : "gold", /boss|bounty|coin/i.test(message));
      return;
    }

    this.playTone([220, 148], 0.072, 0.023, 30, "triangle", 680);
    this.playNoiseBurst(0.05, 0.008, [1_600, 520]);
  }

  private playImpactSound(
    kind: "attack" | "skill" | "monster" | "death" | "loot" | "claim" | "revive",
    classId?: PlayerPublicState["classId"],
    localWasHit = false,
    volumeScale = 1
  ): void {
    if (kind === "monster" || localWasHit) {
      this.playTone([104, 42], 0.095, (localWasHit ? 0.038 : 0.027) * volumeScale, 35, "sawtooth", 340);
      this.playNoiseBurst(0.08, 0.017 * volumeScale, [1_100, 220], 0, "lowpass");
      return;
    }
    if (kind === "skill") {
      const tone: readonly [number, number] = classId === "mage" ? [290, 110] : classId === "tank" ? [120, 40] : classId === "assassin" ? [230, 72] : [205, 66];
      this.playTone(tone, classId === "tank" ? 0.12 : 0.082, 0.028 * volumeScale, 32, classId === "tank" ? "sawtooth" : "triangle", classId === "tank" ? 380 : 760);
      this.playNoiseBurst(classId === "tank" ? 0.1 : 0.065, 0.014 * volumeScale, classId === "tank" ? [900, 220] : [2_600, 560], 0, classId === "tank" ? "lowpass" : "bandpass");
      return;
    }
    if (classId === "assassin") {
      this.playTone([196, 72], 0.048, 0.023 * volumeScale, 26, "triangle", 620);
      this.playNoiseBurst(0.04, 0.011 * volumeScale, [3_200, 820]);
      return;
    }
    if (classId === "tank") {
      this.playTone([106, 42], 0.09, 0.032 * volumeScale, 30, "sawtooth", 360);
      this.playNoiseBurst(0.075, 0.015 * volumeScale, [820, 210], 0, "lowpass");
      return;
    }
    this.playTone([176, 58], 0.065, 0.026 * volumeScale, 28, "triangle", 560);
    this.playNoiseBurst(0.052, 0.012 * volumeScale, [2_100, 480]);
  }

  private effectAnchorPosition(sourceId: string | undefined, fallback: Vector2): Vector2 {
    const entity = sourceId ? this.findEntity(sourceId) : undefined;
    return entity ? this.entityRenderPosition(entity) : fallback;
  }

  private renderSoulshotBurst(position: Vector2, angle: number, classId?: string, strong = false, sourceId?: string): void {
    if (this.isMobileTouchMode() && !this.mobileGraphics.combatEffects) {
      return;
    }

    void angle;
    const anchor = this.effectAnchorPosition(sourceId, position);
    const color = this.classEffectTint(classId);
    const coreColor = classId === "mage" ? 0xe0f2fe : classId === "assassin" ? 0xf5d0fe : 0xfffbeb;
    const radius = strong ? 18 : 13;
    const core = this.trackTransient(this.add.circle(anchor.x, anchor.y, strong ? 6 : 4.8, coreColor, strong ? 0.42 : 0.3).setDepth(83).setBlendMode(Phaser.BlendModes.ADD), 760);
    const ring = this.trackTransient(
      this.add.circle(anchor.x, anchor.y, radius, color, 0).setStrokeStyle(strong ? 3 : 2, color, strong ? 0.46 : 0.34).setDepth(82).setBlendMode(Phaser.BlendModes.ADD),
      820
    );
    this.tweens.add({
      targets: core,
      scale: strong ? 2.15 : 1.72,
      alpha: 0,
      duration: strong ? 220 : 175,
      ease: "Sine.easeOut",
      onUpdate: () => {
        const next = this.effectAnchorPosition(sourceId, position);
        core.setPosition(next.x, next.y);
      },
      onComplete: () => this.destroyTransientEffect(core)
    });
    this.tweens.add({
      targets: ring,
      scale: strong ? 1.48 : 1.28,
      alpha: 0,
      duration: strong ? 320 : 240,
      ease: "Sine.easeOut",
      onUpdate: () => {
        const next = this.effectAnchorPosition(sourceId, position);
        ring.setPosition(next.x, next.y);
      },
      onComplete: () => this.destroyTransientEffect(ring)
    });
  }

  private renderEnergyImpactBurst(position: Vector2, color: number, strong = false): void {
    if (this.isMobileTouchMode() && this.mobileSustainedLeanRuntime && !strong) {
      return;
    }

    const flash = this.trackTransient(this.add.circle(position.x, position.y, strong ? 18 : 12, color, strong ? 0.34 : 0.22).setDepth(84).setBlendMode(Phaser.BlendModes.ADD), 760);
    const ring = this.trackTransient(
      this.add.circle(position.x, position.y, strong ? 28 : 20, color, 0).setStrokeStyle(strong ? 4 : 3, color, strong ? 0.72 : 0.5).setDepth(83).setBlendMode(Phaser.BlendModes.ADD),
      820
    );
    this.tweens.add({ targets: flash, scale: strong ? 2.2 : 1.8, alpha: 0, duration: strong ? 280 : 210, ease: "Sine.easeOut", onComplete: () => this.destroyTransientEffect(flash) });
    this.tweens.add({ targets: ring, scale: strong ? 2 : 1.65, alpha: 0, duration: strong ? 360 : 260, ease: "Sine.easeOut", onComplete: () => this.destroyTransientEffect(ring) });

    if (strong && (!this.isMobileTouchMode() || this.mobileGraphics.combatEffects)) {
      const sparkCount = this.isMobileTouchMode() ? 4 : 6;
      for (let index = 0; index < sparkCount; index += 1) {
        const sparkAngle = (index / sparkCount) * Math.PI * 2 + Math.random() * 0.7;
        const speed = 26 + Math.random() * 26;
        const spark = this.trackTransient(
          this.add.circle(position.x, position.y, 1.6 + Math.random() * 1.4, color, 0.9).setDepth(84).setBlendMode(Phaser.BlendModes.ADD),
          620
        );
        this.tweens.add({
          targets: spark,
          x: position.x + Math.cos(sparkAngle) * speed,
          y: position.y + Math.sin(sparkAngle) * speed - 8,
          alpha: 0,
          scale: 0.4,
          duration: 300 + Math.random() * 160,
          ease: "Cubic.easeOut",
          onComplete: () => this.destroyTransientEffect(spark)
        });
      }
    }
  }

  private renderMeleeAttack(from: Vector2, to: Vector2, classId: string, sourceId?: string): void {
    const anchor = this.effectAnchorPosition(sourceId, from);
    const angle = Math.atan2(to.y - anchor.y, to.x - anchor.x);
    const color = classId === "assassin" ? 0xc084fc : classId === "tank" ? 0xf59e0b : 0xf8fafc;
    const width = classId === "tank" ? 9 : classId === "assassin" ? 4 : 6;
    const duration = classId === "assassin" ? 150 : classId === "tank" ? 235 : 210;
    const reach = classId === "assassin" ? 52 : classId === "tank" ? 66 : 61;
    const container = this.trackTransient(this.add.container(anchor.x, anchor.y).setDepth(80), 1_100);
    this.renderSoulshotBurst(anchor, angle, classId, classId === "tank" || classId === "warrior", sourceId);
    const weapon = this.add
      .image(Math.cos(angle) * 20, Math.sin(angle) * 20, `weapon-${classId}`)
      .setScale(classId === "assassin" ? 0.46 : 0.54)
      .setRotation(angle - 0.85);
    const cleaveArc = this.add.arc(0, 0, classId === "assassin" ? 70 : classId === "tank" ? 88 : 82, -42, 42, false, 0xffffff, 0);
    cleaveArc.setStrokeStyle(classId === "assassin" ? 3 : 4, color, classId === "assassin" ? 0.34 : 0.3);
    cleaveArc.setRotation(angle - 0.28);
    const arc = this.add.arc(0, 0, classId === "assassin" ? 44 : 54, -45, 65, false, 0xffffff, 0);
    arc.setStrokeStyle(width, color, 0.9);
    arc.setRotation(angle - 0.45);
    container.add([cleaveArc, arc, weapon]);
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: duration + 90,
      onUpdate: () => {
        const nextAnchor = this.effectAnchorPosition(sourceId, from);
        container.setPosition(nextAnchor.x, nextAnchor.y);
      },
      onComplete: () => this.destroyTransientEffect(container)
    });
    this.tweens.add({
      targets: weapon,
      x: Math.cos(angle) * reach,
      y: Math.sin(angle) * reach,
      rotation: angle + 0.65,
      alpha: 0,
      duration,
      ease: "Sine.easeOut"
    });
    this.tweens.add({
      targets: arc,
      rotation: angle + 0.45,
      alpha: 0,
      duration: duration + 20
    });
    this.tweens.add({
      targets: cleaveArc,
      rotation: angle + 0.36,
      scaleX: 1.16,
      scaleY: 1.08,
      alpha: 0,
      duration: duration + 70,
      ease: "Sine.easeOut"
    });
    if (classId === "assassin") {
      [-0.42, 0.42].forEach((offset, index) => {
        const fan = this.add.arc(0, 0, 62 + index * 10, -34, 34, false, 0xffffff, 0);
        fan.setStrokeStyle(3, 0xe9d5ff, 0.58);
        fan.setRotation(angle + offset);
        container.add(fan);
        this.tweens.add({
          targets: fan,
          rotation: angle + offset + 0.42,
          alpha: 0,
          duration: 135
        });
      });
    }
    if (classId === "tank") {
      const quake = this.add.circle(Math.cos(angle) * reach, Math.sin(angle) * reach, 18, 0xf59e0b, 0.22);
      container.add(quake);
      this.tweens.add({ targets: quake, scale: 2.2, alpha: 0, duration: 260 });
    }
  }

  private renderRollEffect(position: Vector2, direction: Vector2): void {
    const angle = Math.atan2(direction.y, direction.x);
    const dust = this.trackTransient(this.add.ellipse(position.x - direction.x * 12, position.y - direction.y * 12, 44, 18, 0xe5e7eb, 0.22).setDepth(71), 900);
    dust.setRotation(angle);
    this.tweens.add({
      targets: dust,
      scaleX: 1.7,
      alpha: 0,
      duration: 240,
      ease: "Sine.easeOut",
      onComplete: () => this.destroyTransientEffect(dust)
    });
  }

  private renderAreaSkillEffect(position: Vector2, radius: number): void {
    const pulse = this.trackTransient(this.add.circle(position.x, position.y, Math.max(18, radius * 0.18), 0xfef3c7, 0.16).setDepth(79), 900);
    this.tweens.add({ targets: pulse, scale: 2.4, alpha: 0, duration: 260, onComplete: () => this.destroyTransientEffect(pulse) });
  }

  private renderPinningShot(from: Vector2, to: Vector2, targetId?: string): void {
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const distance = Phaser.Math.Distance.Between(from.x, from.y, to.x, to.y);
    const bolt = this.trackTransient(
      this.add.image(from.x, from.y, "projectile-arrow").setRotation(angle).setTint(0xa78bfa).setDepth(81).setScale(1.18),
      1_100
    );
    const duration = Phaser.Math.Clamp(distance * 0.34, 120, 270);
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration,
      ease: "Sine.easeOut",
      onUpdate: (tween) => {
        const progress = Number(tween.getValue() ?? 0);
        const hit = this.effectAnchorPosition(targetId, to);
        const nextX = Phaser.Math.Linear(from.x, hit.x, progress);
        const nextY = Phaser.Math.Linear(from.y, hit.y, progress);
        bolt.setPosition(nextX, nextY).setRotation(Math.atan2(hit.y - from.y, hit.x - from.x));
      },
      onComplete: () => {
        const hit = this.effectAnchorPosition(targetId, to);
        const snare = this.trackTransient(this.add.circle(hit.x, hit.y, 24, 0xa78bfa, 0.08).setStrokeStyle(4, 0xddd6fe, 0.72).setDepth(82), 1_100);
        this.tweens.add({ targets: snare, scale: 1.9, alpha: 0, duration: 360, onComplete: () => this.destroyTransientEffect(snare) });
        this.destroyTransientEffect(bolt);
      }
    });
  }

  private renderRainOfArrows(position: Vector2, radius: number): void {
    const arrowCount = this.mobileDeepSustainRuntime ? 5 : this.mobileSustainedLeanRuntime ? 8 : 14;
    for (let index = 0; index < arrowCount; index += 1) {
      const angle = (index * 2.3999632297) % (Math.PI * 2);
      const distance = Math.sqrt(((index * 71) % 100) / 100) * radius;
      const hit = {
        x: position.x + Math.cos(angle) * distance,
        y: position.y + Math.sin(angle) * distance
      };
      const arrow = this.trackTransient(
        this.add.image(hit.x - 44, hit.y - 120, "projectile-arrow").setRotation(Math.PI / 2.7).setTint(index % 2 === 0 ? 0x67e8f9 : 0xfef3c7).setDepth(81).setScale(0.92),
        1_200
      );
      this.tweens.add({
        targets: arrow,
        x: hit.x,
        y: hit.y,
        alpha: 0,
        delay: index * 18,
        duration: 260,
        ease: "Sine.easeIn",
        onComplete: () => this.destroyTransientEffect(arrow)
      });
    }
  }

  private renderClassSkillEffect(from: Vector2, to: Vector2, classId: string, targetId?: string, skillId?: string, areaRadius?: number, sourceId?: string): void {
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    if (classId === "mage") {
      if (skillId === "arc-lightning") {
        this.renderMageLightning(from, to, targetId, sourceId);
        return;
      }
      if (skillId === "meteor") {
        this.renderMageMeteor(to, areaRadius ?? 132);
        return;
      }
      if (skillId === "fire-nova") {
        this.renderMageFireNova(to, areaRadius ?? 96);
        return;
      }
      this.renderMagicProjectile(from, to, skillId !== "frost-bolt", targetId, sourceId);
      return;
    }
    if (classId === "archer") {
      if (skillId === "rain-of-arrows") {
        this.renderRainOfArrows(to, areaRadius ?? 180);
        return;
      }
      if (skillId === "volley") {
        this.renderArcherVolley(from, to, areaRadius ?? 108, sourceId);
        return;
      }
      if (skillId === "pinning-shot") {
        this.renderPinningShot(from, to, targetId);
        return;
      }
      this.renderPiercingArrowProjectile(from, to, sourceId);
      return;
    }
    if (classId === "warrior") {
      this.renderSoulshotBurst(from, angle, "warrior", true, sourceId);
      this.renderSwingArc(from, to, "skill-cleave", 1.25);
      return;
    }
    if (classId === "assassin") {
      this.renderSoulshotBurst(from, angle, "assassin", true, sourceId);
      if (skillId === "smoke-dance") {
        this.renderAssassinBladeStorm(from, areaRadius ?? 94);
        return;
      }
      if (skillId === "twin-cut") {
        this.renderAssassinFlyingBlades(from, to, targetId, 2, 0xe9d5ff);
        return;
      }
      if (skillId === "venom-fang") {
        this.renderAssassinFlyingBlades(from, to, targetId, 3, 0x86efac);
        return;
      }
      this.renderAssassinShadowStep(from, to);
      return;
    }
    if (classId === "tank") {
      this.renderSoulshotBurst(from, angle, "tank", true, sourceId);
      const impact = this.trackTransient(this.add.image(to.x, to.y, "skill-bash").setDepth(79).setScale(0.7), 1_100);
      this.renderEnergyImpactBurst(to, 0xf59e0b, true);
      this.tweens.add({
        targets: impact,
        scale: 1.8,
        alpha: 0,
        duration: 420,
        ease: "Sine.easeOut",
        onComplete: () => this.destroyTransientEffect(impact)
      });
      return;
    }

    this.renderSwingArc(from, to, "skill-cleave", 1);
  }

  private renderMageLightning(from: Vector2, to: Vector2, targetId?: string, sourceId?: string): void {
    const hit = this.effectAnchorPosition(targetId, to);
    const angle = Math.atan2(hit.y - from.y, hit.x - from.x);
    const distance = Phaser.Math.Distance.Between(from.x, from.y, hit.x, hit.y);
    const color = 0x93c5fd;
    const core = 0xe0f2fe;
    const segments = this.mobileSustainedLeanRuntime ? 4 : 7;
    this.renderSoulshotBurst(from, angle, "mage", true, sourceId);

    const points: Vector2[] = [from];
    for (let index = 1; index < segments; index += 1) {
      const progress = index / segments;
      const jitter = Math.sin(this.time.now * 0.021 + index * 2.17) * Math.min(34, 10 + distance * 0.045);
      points.push({
        x: Phaser.Math.Linear(from.x, hit.x, progress) + Math.cos(angle + Math.PI / 2) * jitter,
        y: Phaser.Math.Linear(from.y, hit.y, progress) + Math.sin(angle + Math.PI / 2) * jitter
      });
    }
    points.push(hit);

    for (let index = 0; index < points.length - 1; index += 1) {
      const start = points[index];
      const end = points[index + 1];
      const glow = this.trackTransient(this.add.line(0, 0, start.x, start.y, end.x, end.y, color, 0.34).setLineWidth(11).setDepth(82).setBlendMode(Phaser.BlendModes.ADD), 900);
      const bolt = this.trackTransient(this.add.line(0, 0, start.x, start.y, end.x, end.y, core, 0.9).setLineWidth(4).setDepth(83).setBlendMode(Phaser.BlendModes.ADD), 900);
      this.tweens.add({ targets: [glow, bolt], alpha: 0, duration: 170 + index * 8, ease: "Sine.easeOut", onComplete: () => {
        this.destroyTransientEffect(glow);
        this.destroyTransientEffect(bolt);
      }});
    }

    const branchCount = this.mobileSustainedLeanRuntime ? 1 : 3;
    for (let index = 0; index < branchCount; index += 1) {
      const anchor = points[Math.max(1, Math.min(points.length - 2, 2 + index * 2))] ?? hit;
      const branchAngle = angle + (index % 2 === 0 ? 1 : -1) * (0.72 + index * 0.16);
      const length = 34 + index * 10;
      const branch = this.trackTransient(
        this.add.line(0, 0, anchor.x, anchor.y, anchor.x + Math.cos(branchAngle) * length, anchor.y + Math.sin(branchAngle) * length, core, 0.62).setLineWidth(3).setDepth(82),
        760
      );
      this.tweens.add({ targets: branch, alpha: 0, duration: 150, ease: "Sine.easeOut", onComplete: () => this.destroyTransientEffect(branch) });
    }

    this.renderEnergyImpactBurst(hit, color, true);
  }

  private renderMageMeteor(position: Vector2, radius: number): void {
    const start = {
      x: position.x - radius * 0.52,
      y: position.y - radius * 1.75
    };
    const color = 0xfb923c;
    const core = 0xfef3c7;
    const meteor = this.trackTransient(this.add.image(start.x, start.y, "projectile-magic").setTint(color).setScale(1.55).setDepth(84).setBlendMode(Phaser.BlendModes.ADD), 1_200);
    const tail = this.trackTransient(this.add.line(0, 0, start.x - 34, start.y - 42, start.x, start.y, color, 0.64).setLineWidth(9).setDepth(83).setBlendMode(Phaser.BlendModes.ADD), 1_100);
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 330,
      ease: "Cubic.easeIn",
      onUpdate: (tween) => {
        const progress = Number(tween.getValue() ?? 0);
        const x = Phaser.Math.Linear(start.x, position.x, progress);
        const y = Phaser.Math.Linear(start.y, position.y, progress);
        meteor.setPosition(x, y).setRotation(progress * 3.6);
        tail.setTo(x - 38, y - 48, x, y);
      },
      onComplete: () => {
        const blast = this.trackTransient(this.add.circle(position.x, position.y, Math.max(34, radius * 0.34), color, 0.32).setDepth(85).setBlendMode(Phaser.BlendModes.ADD), 1_100);
        const ring = this.trackTransient(this.add.circle(position.x, position.y, radius * 0.54, color, 0).setStrokeStyle(6, core, 0.82).setDepth(86), 1_100);
        const shock = this.trackTransient(this.add.circle(position.x, position.y, radius * 0.18, 0x7c2d12, 0.26).setDepth(82), 1_100);
        this.tweens.add({ targets: blast, scale: 2.35, alpha: 0, duration: 420, ease: "Sine.easeOut", onComplete: () => this.destroyTransientEffect(blast) });
        this.tweens.add({ targets: ring, scale: 1.75, alpha: 0, duration: 520, ease: "Sine.easeOut", onComplete: () => this.destroyTransientEffect(ring) });
        this.tweens.add({ targets: shock, scale: 3.1, alpha: 0, duration: 460, ease: "Sine.easeOut", onComplete: () => this.destroyTransientEffect(shock) });
        this.destroyTransientEffect(meteor);
        this.destroyTransientEffect(tail);
      }
    });
  }

  private renderMageFireNova(position: Vector2, radius: number): void {
    const color = 0xf97316;
    const core = 0xfef3c7;
    const pulse = this.trackTransient(this.add.circle(position.x, position.y, Math.max(22, radius * 0.25), color, 0.22).setDepth(82).setBlendMode(Phaser.BlendModes.ADD), 900);
    const ring = this.trackTransient(this.add.circle(position.x, position.y, radius * 0.62, color, 0).setStrokeStyle(5, core, 0.72).setDepth(83), 900);
    this.tweens.add({ targets: pulse, scale: 2.5, alpha: 0, duration: 360, ease: "Sine.easeOut", onComplete: () => this.destroyTransientEffect(pulse) });
    this.tweens.add({ targets: ring, scale: 1.55, alpha: 0, duration: 440, ease: "Sine.easeOut", onComplete: () => this.destroyTransientEffect(ring) });

    const flameCount = this.mobileSustainedLeanRuntime ? 5 : 10;
    for (let index = 0; index < flameCount; index += 1) {
      const angle = (Math.PI * 2 * index) / flameCount + 0.18;
      const ember = this.trackTransient(this.add.circle(position.x, position.y, 5, index % 2 === 0 ? core : color, 0.76).setDepth(84).setBlendMode(Phaser.BlendModes.ADD), 900);
      this.tweens.add({
        targets: ember,
        x: position.x + Math.cos(angle) * radius * 0.74,
        y: position.y + Math.sin(angle) * radius * 0.74,
        scale: 0.25,
        alpha: 0,
        duration: 310 + index * 12,
        ease: "Cubic.easeOut",
        onComplete: () => this.destroyTransientEffect(ember)
      });
    }
  }

  private renderArcherVolley(from: Vector2, to: Vector2, radius: number, sourceId?: string): void {
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const side = { x: -Math.sin(angle), y: Math.cos(angle) };
    const arrowCount = this.mobileSustainedLeanRuntime ? 4 : 7;
    this.renderSoulshotBurst(from, angle, "archer", true, sourceId);
    for (let index = 0; index < arrowCount; index += 1) {
      const offset = (index - (arrowCount - 1) / 2) * 18;
      const targetOffset = (index - (arrowCount - 1) / 2) * Math.min(28, radius * 0.24);
      const start = {
        x: from.x + side.x * offset,
        y: from.y + side.y * offset
      };
      const hit = {
        x: to.x + side.x * targetOffset,
        y: to.y + side.y * targetOffset
      };
      const arrow = this.trackTransient(
        this.add.image(start.x, start.y, "projectile-arrow").setRotation(angle).setDepth(82).setTint(index % 2 === 0 ? 0xfef3c7 : 0x86efac).setScale(0.96),
        1_100
      );
      this.tweens.add({
        targets: arrow,
        x: hit.x,
        y: hit.y,
        alpha: 0,
        delay: index * 18,
        duration: 190,
        ease: "Sine.easeOut",
        onComplete: () => {
          const pop = this.trackTransient(this.add.circle(hit.x, hit.y, 10, 0x86efac, 0.24).setDepth(83), 620);
          this.tweens.add({ targets: pop, scale: 1.9, alpha: 0, duration: 190, onComplete: () => this.destroyTransientEffect(pop) });
          this.destroyTransientEffect(arrow);
        }
      });
    }
  }

  private renderAssassinFlyingBlades(from: Vector2, to: Vector2, targetId: string | undefined, count: number, color: number): void {
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const side = { x: -Math.sin(angle), y: Math.cos(angle) };
    for (let index = 0; index < count; index += 1) {
      const sideSign = index % 2 === 0 ? -1 : 1;
      const offset = sideSign * (18 + index * 5);
      const blade = this.trackTransient(
        this.add.image(from.x + side.x * offset, from.y + side.y * offset, "weapon-assassin").setTint(color).setDepth(84).setScale(0.46).setRotation(angle - 0.55),
        1_100
      );
      const trail = this.trackTransient(this.add.circle(from.x + side.x * offset, from.y + side.y * offset, 9, color, 0.24).setDepth(83).setBlendMode(Phaser.BlendModes.ADD), 1_100);
      this.tweens.addCounter({
        from: 0,
        to: 1,
        delay: index * 32,
        duration: 175,
        ease: "Sine.easeOut",
        onUpdate: (tween) => {
          const progress = Number(tween.getValue() ?? 0);
          const hit = this.effectAnchorPosition(targetId, to);
          const curve = Math.sin(progress * Math.PI) * offset * 0.55;
          const x = Phaser.Math.Linear(from.x + side.x * offset, hit.x, progress) + side.x * curve;
          const y = Phaser.Math.Linear(from.y + side.y * offset, hit.y, progress) + side.y * curve;
          blade.setPosition(x, y).setRotation(angle + progress * 4.8);
          trail.setPosition(x, y);
        },
        onComplete: () => {
          const hit = this.effectAnchorPosition(targetId, to);
          this.renderEnergyImpactBurst(hit, color, index === count - 1);
          this.destroyTransientEffect(blade);
          this.destroyTransientEffect(trail);
        }
      });
    }
  }

  private renderAssassinBladeStorm(position: Vector2, radius: number): void {
    const color = 0xc084fc;
    const smoke = this.trackTransient(this.add.circle(position.x, position.y, radius * 0.42, 0x111827, 0.28).setDepth(81), 900);
    const ring = this.trackTransient(this.add.circle(position.x, position.y, radius * 0.62, color, 0).setStrokeStyle(4, color, 0.7).setDepth(83), 900);
    this.tweens.add({ targets: smoke, scale: 1.9, alpha: 0, duration: 420, ease: "Sine.easeOut", onComplete: () => this.destroyTransientEffect(smoke) });
    this.tweens.add({ targets: ring, scale: 1.55, alpha: 0, duration: 380, ease: "Sine.easeOut", onComplete: () => this.destroyTransientEffect(ring) });

    const bladeCount = this.mobileSustainedLeanRuntime ? 4 : 8;
    for (let index = 0; index < bladeCount; index += 1) {
      const angle = (Math.PI * 2 * index) / bladeCount;
      const blade = this.trackTransient(
        this.add.image(position.x + Math.cos(angle) * radius * 0.18, position.y + Math.sin(angle) * radius * 0.18, "weapon-assassin").setTint(index % 2 === 0 ? color : 0xe9d5ff).setDepth(84).setScale(0.42).setRotation(angle),
        1_100
      );
      this.tweens.add({
        targets: blade,
        x: position.x + Math.cos(angle + 0.55) * radius * 0.78,
        y: position.y + Math.sin(angle + 0.55) * radius * 0.78,
        rotation: angle + 4.6,
        alpha: 0,
        duration: 260 + index * 10,
        ease: "Sine.easeOut",
        onComplete: () => this.destroyTransientEffect(blade)
      });
    }
  }

  private renderAssassinShadowStep(from: Vector2, to: Vector2): void {
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const distance = Phaser.Math.Distance.Between(from.x, from.y, to.x, to.y);
    const cappedDistance = Math.min(distance, 190);
    const end = {
      x: from.x + Math.cos(angle) * cappedDistance,
      y: from.y + Math.sin(angle) * cappedDistance
    };
    const ghost = this.trackTransient(this.add.image(from.x, from.y, "char-assassin").setRotation(angle + Math.PI / 2).setDepth(79).setScale(0.46).setAlpha(0.5), 1_100);
    const slash = this.trackTransient(this.add.image(end.x, end.y, "skill-shadow").setRotation(angle).setDepth(80).setScale(1.08).setAlpha(0.95), 1_100);
    const impact = this.trackTransient(this.add.circle(end.x, end.y, 18, 0xa855f7, 0.16).setStrokeStyle(4, 0xe9d5ff, 0.72).setDepth(79), 1_100);
    this.tweens.add({
      targets: ghost,
      x: end.x,
      y: end.y,
      alpha: 0,
      duration: 170,
      ease: "Sine.easeOut",
      onComplete: () => this.destroyTransientEffect(ghost)
    });
    this.tweens.add({
      targets: slash,
      scaleX: 1.85,
      scaleY: 1.35,
      alpha: 0,
      duration: 260,
      ease: "Sine.easeOut",
      onComplete: () => this.destroyTransientEffect(slash)
    });
    this.tweens.add({ targets: impact, scale: 2.2, alpha: 0, duration: 300, onComplete: () => this.destroyTransientEffect(impact) });
  }

  private renderSwingArc(from: Vector2, to: Vector2, texture: string, scale: number): void {
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const effect = this.trackTransient(
      this.add.image(from.x + Math.cos(angle) * 38, from.y + Math.sin(angle) * 38, texture).setRotation(angle).setDepth(79).setScale(scale),
      1_100
    );
    this.tweens.add({
      targets: effect,
      x: to.x,
      y: to.y,
      angle: effect.angle + 35,
      alpha: 0,
      duration: 220,
      onComplete: () => this.destroyTransientEffect(effect)
    });
  }

  private renderArrowProjectile(from: Vector2, to: Vector2, charge = 1, targetId?: string, sourceId?: string): void {
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const distance = Phaser.Math.Distance.Between(from.x, from.y, to.x, to.y);
    const strong = charge >= 0.82;
    const color = 0xf8fafc;
    const duration = Phaser.Math.Clamp(distance * 0.36, 110, 260);
    this.renderSoulshotBurst(from, angle, undefined, strong, sourceId);
    const arrow = this.trackTransient(
      this.add.image(from.x, from.y, "projectile-arrow").setRotation(angle).setDepth(80).setTint(color).setScale(0.78 + charge * 0.38),
      1_100
    );
    const glow = this.trackTransient(this.add.circle(from.x, from.y, strong ? 10 : 7, color, strong ? 0.18 : 0.12).setDepth(79).setBlendMode(Phaser.BlendModes.ADD), 1_100);
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration,
      ease: "Sine.easeOut",
      onUpdate: (tween) => {
        const progress = Number(tween.getValue() ?? 0);
        const hit = this.effectAnchorPosition(targetId, to);
        const nextX = Phaser.Math.Linear(from.x, hit.x, progress);
        const nextY = Phaser.Math.Linear(from.y, hit.y, progress);
        const nextAngle = Math.atan2(hit.y - from.y, hit.x - from.x);
        arrow.setPosition(nextX, nextY).setRotation(nextAngle);
        glow.setPosition(nextX, nextY);
      },
      onComplete: () => {
        const hit = this.effectAnchorPosition(targetId, to);
        this.renderEnergyImpactBurst(hit, color, strong);
        this.destroyTransientEffect(arrow);
        this.destroyTransientEffect(glow);
      }
    });
  }

  private renderPiercingArrowProjectile(from: Vector2, to: Vector2, sourceId?: string): void {
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const distance = Phaser.Math.Distance.Between(from.x, from.y, to.x, to.y);
    this.renderSoulshotBurst(from, angle, "archer", true, sourceId);
    const arrow = this.trackTransient(this.add.image(from.x, from.y, "projectile-arrow").setRotation(angle).setDepth(81).setTint(0x67e8f9).setScale(1.55), 1_200);
    const glow = this.trackTransient(this.add.circle(from.x, from.y, 14, 0x67e8f9, 0.36).setDepth(80), 1_200);

    const sparkCount = this.mobileDeepSustainRuntime ? 2 : this.mobileSustainedLeanRuntime ? 3 : 5;
    for (let index = 0; index < sparkCount; index += 1) {
      const offset = (index - 2) * 10;
      const spark = this.trackTransient(
        this.add.circle(from.x - Math.sin(angle) * offset, from.y + Math.cos(angle) * offset, 4, index % 2 === 0 ? 0xfef3c7 : 0x67e8f9, 0.75).setDepth(79),
        1_100
      );
      this.tweens.add({
        targets: spark,
        x: to.x - Math.sin(angle) * offset * 0.4,
        y: to.y + Math.cos(angle) * offset * 0.4,
        alpha: 0,
        duration: Phaser.Math.Clamp(distance * 0.32, 150, 330),
        ease: "Sine.easeOut",
        onComplete: () => this.destroyTransientEffect(spark)
      });
    }

    this.tweens.add({
      targets: [arrow, glow],
      x: to.x,
      y: to.y,
      duration: Phaser.Math.Clamp(distance * 0.32, 150, 330),
      ease: "Sine.easeOut",
      onComplete: () => {
        const impact = this.trackTransient(this.add.circle(to.x, to.y, 30, 0x67e8f9, 0.28).setDepth(82), 1_100);
        this.renderEnergyImpactBurst(to, 0x67e8f9, true);
        this.tweens.add({ targets: impact, scale: 2.2, alpha: 0, duration: 260, onComplete: () => this.destroyTransientEffect(impact) });
        this.destroyTransientEffect(arrow);
        this.destroyTransientEffect(glow);
      }
    });
  }

  private renderMagicProjectile(from: Vector2, to: Vector2, heavy: boolean, targetId?: string, sourceId?: string): void {
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const distance = Phaser.Math.Distance.Between(from.x, from.y, to.x, to.y);
    const color = heavy ? 0xa78bfa : 0x38bdf8;
    const coreColor = heavy ? 0xf5d0fe : 0xe0f2fe;
    const duration = Phaser.Math.Clamp(distance * (heavy ? 0.3 : 0.26), heavy ? 170 : 130, heavy ? 300 : 230);
    this.renderSoulshotBurst(from, angle, "mage", heavy, sourceId);
    const castRing = this.trackTransient(
      this.add.circle(from.x, from.y, heavy ? 24 : 18, color, 0).setStrokeStyle(heavy ? 4 : 3, coreColor, heavy ? 0.62 : 0.44).setDepth(80).setBlendMode(Phaser.BlendModes.ADD),
      900
    );
    const orb = this.trackTransient(this.add.image(from.x, from.y, "projectile-magic").setDepth(79).setTint(color).setScale(heavy ? 1.32 : 0.92), 1_200);
    const aura = this.trackTransient(this.add.circle(from.x, from.y, heavy ? 18 : 12, color, heavy ? 0.26 : 0.18).setDepth(78).setBlendMode(Phaser.BlendModes.ADD), 1_200);
    this.tweens.add({ targets: castRing, scale: heavy ? 1.9 : 1.55, alpha: 0, duration: heavy ? 320 : 240, ease: "Sine.easeOut", onComplete: () => this.destroyTransientEffect(castRing) });
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration,
      ease: "Sine.easeOut",
      onUpdate: (tween) => {
        const progress = Number(tween.getValue() ?? 0);
        const hit = this.effectAnchorPosition(targetId, to);
        const nextX = Phaser.Math.Linear(from.x, hit.x, progress);
        const nextY = Phaser.Math.Linear(from.y, hit.y, progress);
        orb.setPosition(nextX, nextY);
        aura.setPosition(nextX, nextY);
      },
      onComplete: () => {
        const hit = this.effectAnchorPosition(targetId, to);
        const burst = this.trackTransient(this.add.circle(hit.x, hit.y, heavy ? 44 : 28, color, 0.28).setDepth(80).setBlendMode(Phaser.BlendModes.ADD), 1_100);
        this.renderEnergyImpactBurst(hit, color, heavy);
        this.tweens.add({
          targets: burst,
          scale: 1.8,
          alpha: 0,
          duration: 360,
          onComplete: () => this.destroyTransientEffect(burst)
        });
        this.destroyTransientEffect(orb);
        this.destroyTransientEffect(aura);
      }
    });
  }

  private renderChatBubble(message: ChatMessage): void {
    if (message.channel === "system") {
      return;
    }

    const player = this.snapshot?.players.find((candidate) => candidate.id === message.playerId);
    const position = player?.position ?? message.position;
    if (!position) {
      return;
    }
    if (!this.isPositionNearCamera(position, 360)) {
      return;
    }
    if (!this.isMobileTouchMode() && this.isCrowdedScene() && message.playerId !== this.localPlayerId && message.channel !== "world") {
      return;
    }

    const channelLabel = this.tr(message.channel === "world" ? "World" : message.channel === "dungeon" ? "Dungeon" : message.channel === "zone" ? "Zone" : "Local");
    const messageText = message.playerId.startsWith("bot_") ? translateBotChat(this.language, message.text) : message.text;
    const color =
      message.channel === "world"
        ? "#fde68a"
        : message.channel === "dungeon"
          ? "#bfdbfe"
          : message.channel === "zone"
            ? "#bbf7d0"
            : "#f8fafc";
    const bubble = this.add
      .text(position.x, position.y - 62, `[${channelLabel}] ${messageText}`, {
        color,
        fontFamily: "Inter, sans-serif",
        fontSize: "13px",
        backgroundColor: "#000000b5",
        padding: { x: 8, y: 5 },
        wordWrap: { width: 230 }
      })
      .setOrigin(0.5, 1)
      .setDepth(120);

    this.tweens.add({
      targets: bubble,
      y: bubble.y - 18,
      alpha: 0,
      delay: 2300,
      duration: 900,
      onComplete: () => bubble.destroy()
    });
  }

  private updateSingingAudio(snapshot: GameSnapshot): void {
    if (document.hidden) {
      this.stopAllSingingAudio();
      return;
    }

    const local = this.localPlayer();
    if (!local) {
      this.stopAllSingingAudio();
      return;
    }

    const localPosition = this.localRenderPosition(local);
    let retainedPlayerIds: Set<string> | undefined;
    for (const player of snapshot.players) {
      if (!player.singing || player.hp <= 0 || player.downed) {
        continue;
      }

      retainedPlayerIds ??= new Set<string>();
      retainedPlayerIds.add(player.id);
      const position = this.players.get(player.id)?.lastPosition ?? player.position;
      const distance = Phaser.Math.Distance.Between(localPosition.x, localPosition.y, position.x, position.y);
	      const volume = this.singingVolume(distance);
	      if (volume <= SINGING_AUDIO_MIN_AUDIBLE_VOLUME) {
	        const handle = this.singingAudio.get(player.id);
	        if (handle) {
	          handle.lastSeenAt = this.time.now;
          this.fadeSingingAudioOut(handle, true, this.singingOutOfRangeFallStep());
	        }
	        continue;
	      }

      this.ensureSingingAudio(player, snapshot.serverTime, volume);
    }

	    for (const [playerId, handle] of [...this.singingAudio.entries()]) {
	      if (!retainedPlayerIds?.has(playerId)) {
        this.fadeSingingAudioOut(handle, true, this.singingOutOfRangeFallStep());
	      }
	    }
	  }

	  private ensureSingingAudio(player: PlayerPublicState, serverTime: number, volume: number): void {
	    const singing = player.singing;
	    const url = singing ? SINGING_TRACK_URLS[singing.trackId] : undefined;
	    if (!singing || !url) {
	      return;
    }

    let handle = this.singingAudio.get(player.id);
    if (!handle) {
      handle = {
        audio: this.createSingingAudio(url),
	        playerId: player.id,
	        trackId: singing.trackId,
	        currentVolume: 0,
	        createdAt: this.time.now,
	        unmutedAt: undefined,
		        pendingPlay: false,
		        fadingOut: false,
		        lastSeenAt: this.time.now,
	        unlockTimer: undefined,
	        pendingTrackId: undefined,
	        pendingTrackUrl: undefined,
	        pendingSeekSeconds: undefined
	      };
	      const createdHandle = handle;
	      createdHandle.audio.onloadedmetadata = () => this.applyPendingSingingSeek(createdHandle);
	      this.singingAudio.set(player.id, handle);
	    } else {
	      handle.lastSeenAt = this.time.now;
	      handle.fadingOut = false;
	      if (handle.trackId !== singing.trackId) {
	        this.queueSingingAudioTrack(handle, singing.trackId, url);
	      }
	    }

	    if (handle.pendingTrackId !== undefined && handle.pendingTrackUrl) {
	      this.fadeSingingAudioOut(handle, false);
	      if (handle.currentVolume <= SINGING_AUDIO_MIN_AUDIBLE_VOLUME) {
	        const nextTrackId = handle.pendingTrackId;
	        const nextTrackUrl = handle.pendingTrackUrl;
	        handle.pendingTrackId = undefined;
	        handle.pendingTrackUrl = undefined;
	        this.loadSingingAudioTrack(handle, nextTrackId, nextTrackUrl);
	        this.playSingingAudio(handle);
	      }
	      return;
	    }

		    const playable = !handle.audio.paused && !handle.pendingPlay && !handle.audio.muted;
	    const distanceTarget = playable ? volume : Math.min(volume, this.singingPreplayVolume());
	    const targetVolume = Phaser.Math.Clamp(distanceTarget, 0, SINGING_AUDIO_MAX_VOLUME);
    const volumeDelta = targetVolume - handle.currentVolume;
    const volumeRatio = Phaser.Math.Clamp(targetVolume / SINGING_AUDIO_MAX_VOLUME, 0, 1);
    const quietDistanceRatio = 1 - volumeRatio;
    const volumeStep =
      volumeDelta > 0
        ? this.singingRiseStep(volumeRatio)
        : this.singingFallStep(quietDistanceRatio);
    handle.currentVolume =
      Math.abs(volumeDelta) <= volumeStep ? targetVolume : handle.currentVolume + Math.sign(volumeDelta) * volumeStep;
    this.setSingingAudioVolume(handle, handle.currentVolume);
    this.syncSingingAudioTime(handle, singing, serverTime);
	    if (handle.audio.paused || handle.pendingPlay) {
	      this.playSingingAudio(handle);
	    }
	  }

		  private fadeSingingAudioOut(handle: SingingAudioHandle, stopWhenSilent: boolean, step = SINGING_AUDIO_FALL_MAX_STEP): void {
		    handle.fadingOut = true;
		    handle.currentVolume = Math.max(0, handle.currentVolume - step);
	    this.setSingingAudioVolume(handle, handle.currentVolume);
	    if (stopWhenSilent && handle.currentVolume <= SINGING_AUDIO_MIN_AUDIBLE_VOLUME) {
	      this.stopSingingAudio(handle);
	    }
	  }

	  private queueSingingAudioTrack(handle: SingingAudioHandle, trackId: number, url: string): void {
	    if (handle.pendingTrackId === trackId && handle.pendingTrackUrl === url) {
	      return;
	    }
	    handle.pendingTrackId = trackId;
	    handle.pendingTrackUrl = url;
	    handle.fadingOut = true;
	  }

  private createSingingAudio(url: string): HTMLAudioElement {
    const audio = this.reusableSingingAudio ?? new Audio();
    this.reusableSingingAudio = undefined;
    audio.autoplay = false;
    audio.preload = "auto";
    audio.loop = false;
    audio.muted = false;
    audio.volume = 0;
    audio.setAttribute("playsinline", "true");
    audio.setAttribute("webkit-playsinline", "true");
    audio.src = url;
    return audio;
  }

	  private loadSingingAudioTrack(handle: SingingAudioHandle, trackId: number, url: string): void {
	    handle.audio.pause();
	    handle.trackId = trackId;
	    handle.pendingPlay = false;
	    handle.currentVolume = 0;
	    handle.createdAt = this.time.now;
	    handle.unmutedAt = undefined;
	    handle.pendingTrackId = undefined;
	    handle.pendingTrackUrl = undefined;
    handle.pendingSeekSeconds = undefined;
    handle.audio.muted = true;
    handle.audio.volume = 0;
    if (handle.unlockTimer !== undefined) {
      window.clearTimeout(handle.unlockTimer);
      handle.unlockTimer = undefined;
    }
	    this.setSingingAudioVolume(handle, 0);
    handle.audio.src = url;
    handle.audio.load();
  }

  private playSingingAudio(handle: SingingAudioHandle): void {
    if (document.hidden) {
      return;
    }

    if (handle.unlockTimer !== undefined) {
      window.clearTimeout(handle.unlockTimer);
      handle.unlockTimer = undefined;
    }
	    handle.audio.muted = true;
	    handle.audio.volume = 0;
	    handle.currentVolume = Math.min(handle.currentVolume, this.singingPreplayVolume());
	    this.setSingingAudioVolume(handle, handle.currentVolume);
	    handle.pendingPlay = true;
	    const playResult = handle.audio.play();
	    if (!playResult) {
	      handle.pendingPlay = false;
      this.scheduleSingingAudioUnmute(handle, SINGING_AUDIO_UNMUTE_DELAY_MS);
      return;
    }

    void playResult
      .then(() => {
        handle.pendingPlay = false;
        if (document.hidden) {
          handle.currentVolume = 0;
          handle.audio.muted = true;
          handle.audio.volume = 0;
          handle.audio.pause();
          return;
        }
        handle.currentVolume = Math.min(handle.currentVolume, this.singingPreplayVolume());
        this.setSingingAudioVolume(handle, handle.currentVolume);
        this.applyPendingSingingSeek(handle);
        this.scheduleSingingAudioUnmute(handle, SINGING_AUDIO_UNMUTE_DELAY_MS);
      })
      .catch(() => {
        handle.pendingPlay = true;
        handle.audio.pause();
        handle.audio.muted = false;
      });
  }

  private resumeSingingAudioPlayback(): void {
    for (const handle of this.singingAudio.values()) {
      this.setSingingAudioVolume(handle, handle.currentVolume);
      if (handle.audio.paused || handle.pendingPlay) {
        this.playSingingAudio(handle);
      }
    }
  }

  private scheduleSingingAudioUnmute(handle: SingingAudioHandle, delay: number): void {
    if (handle.unlockTimer !== undefined) {
      window.clearTimeout(handle.unlockTimer);
    }
    handle.unlockTimer = window.setTimeout(() => {
      if (this.singingAudio.get(handle.playerId) !== handle) {
        return;
      }
      if (document.hidden) {
        handle.currentVolume = 0;
        handle.audio.muted = true;
        handle.audio.volume = 0;
        handle.audio.pause();
        handle.unlockTimer = undefined;
        return;
      }
      this.applyPendingSingingSeek(handle);
	      if (handle.pendingSeekSeconds !== undefined && handle.audio.readyState < 1) {
	        this.scheduleSingingAudioUnmute(handle, SINGING_AUDIO_SEEK_RETRY_MS);
	        return;
	      }
	      handle.currentVolume = Math.min(handle.currentVolume, this.singingPreplayVolume());
	      handle.unmutedAt = this.time.now;
	      this.setSingingAudioVolume(handle, handle.currentVolume);
	      handle.audio.muted = false;
	      handle.unlockTimer = undefined;
	    }, delay);
	  }

		  private setSingingAudioVolume(handle: SingingAudioHandle, volume: number): void {
		    const clampedVolume = Phaser.Math.Clamp(volume, 0, SINGING_AUDIO_MAX_VOLUME);
    const gain = this.ensureSingingAudioGain(handle);
    if (gain && this.audioContext && this.audioContext.state !== "closed") {
      const now = this.audioContext.currentTime;
      const rampDuration = this.isMobileTouchMode() ? 0.22 : 0.08;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(clampedVolume, now + rampDuration);
      handle.audio.volume = 1;
      return;
    }
		    handle.audio.volume = clampedVolume;
	  }

  private ensureSingingAudioGain(handle: SingingAudioHandle): GainNode | undefined {
    if (handle.gain && handle.source) {
      return handle.gain;
    }

    const context = this.ensureAudioContext();
    if (!context || context.state === "closed") {
      return undefined;
    }

    try {
      handle.source = context.createMediaElementSource(handle.audio);
      handle.gain = context.createGain();
      handle.gain.gain.setValueAtTime(0, context.currentTime);
      handle.source.connect(handle.gain);
      handle.gain.connect(context.destination);
      handle.audio.volume = 1;
      return handle.gain;
    } catch {
      handle.source = undefined;
      handle.gain = undefined;
      return undefined;
    }
  }

  private warmReusableSingingAudio(): void {
    if (this.singingAudioElementWarmed || document.hidden) {
      return;
    }

    const activeHandle = [...this.singingAudio.values()].find((handle) => handle.audio.paused || handle.pendingPlay);
    if (activeHandle) {
      this.playSingingAudio(activeHandle);
      return;
    }

    const audio = this.reusableSingingAudio ?? new Audio();
    this.reusableSingingAudio = audio;
    audio.preload = "auto";
    audio.loop = false;
    audio.muted = true;
    audio.volume = 0;
    if (!audio.src) {
      audio.src = SINGING_AUDIO_UNLOCK_SRC;
    }

    const playResult = audio.play();
    if (!playResult) {
      this.singingAudioElementWarmed = true;
      audio.pause();
      audio.muted = false;
      return;
    }

    void playResult
      .then(() => {
        audio.pause();
        try {
          audio.currentTime = 0;
        } catch {
          // Some browsers reject seeking a tiny data URI; the element is still warmed.
        }
        audio.muted = false;
        this.singingAudioElementWarmed = true;
      })
      .catch(() => {
        audio.pause();
        audio.muted = false;
      });
  }

  private syncSingingAudioTime(handle: SingingAudioHandle, singing: NonNullable<PlayerPublicState["singing"]>, serverTime: number): void {
    const elapsedSeconds = Math.max(0, (serverTime - singing.startedAt) / 1000);
    handle.pendingSeekSeconds = elapsedSeconds;
    const targetTime = this.singingSeekTargetTime(handle, elapsedSeconds);
    if (targetTime === undefined) {
      return;
    }
	    const shouldSeek =
	      handle.audio.muted ||
	      Math.abs(handle.audio.currentTime - targetTime) > 3.2;
    if (shouldSeek) {
      this.applyPendingSingingSeek(handle);
    } else {
      handle.pendingSeekSeconds = undefined;
    }
  }

  private singingSeekTargetTime(handle: SingingAudioHandle, elapsedSeconds: number): number | undefined {
    if (Number.isFinite(handle.audio.duration) && handle.audio.duration > 0) {
      return elapsedSeconds % handle.audio.duration;
    }
    if (handle.audio.readyState >= 1) {
      return elapsedSeconds;
    }
    return undefined;
  }

  private applyPendingSingingSeek(handle: SingingAudioHandle): void {
    if (handle.pendingSeekSeconds === undefined) {
      return;
    }
    const targetTime = this.singingSeekTargetTime(handle, handle.pendingSeekSeconds);
    if (targetTime === undefined || !Number.isFinite(targetTime)) {
      return;
    }
    try {
      handle.audio.currentTime = targetTime;
      handle.pendingSeekSeconds = undefined;
    } catch {
      // Some mobile browsers reject seeks before enough media metadata is loaded.
    }
  }

  private singingVolume(distance: number): number {
    const mobile = this.isMobileTouchMode();
    const fullRadius = mobile ? SINGING_AUDIO_FULL_RADIUS + 14 : SINGING_AUDIO_FULL_RADIUS;
    const maxRadius = mobile ? MOBILE_SINGING_AUDIO_MAX_RADIUS : SINGING_AUDIO_MAX_RADIUS;
    const maxVolume = mobile ? SINGING_AUDIO_MAX_VOLUME * 0.88 : SINGING_AUDIO_MAX_VOLUME;
    if (distance <= fullRadius) {
      return maxVolume;
    }
    if (distance >= maxRadius) {
      return 0;
    }

    const ratio = Phaser.Math.Clamp(1 - (distance - fullRadius) / (maxRadius - fullRadius), 0, 1);
    const eased = mobile ? ratio * ratio * (3 - 2 * ratio) : Phaser.Math.Clamp(Math.pow(ratio, 1.28), 0, 1);
    return maxVolume * eased;
  }

  private singingPreplayVolume(): number {
    return this.isMobileTouchMode() ? MOBILE_SINGING_AUDIO_PREPLAY_VOLUME : SINGING_AUDIO_PREPLAY_VOLUME;
  }

  private singingRiseStep(volumeRatio: number): number {
    return this.isMobileTouchMode()
      ? Phaser.Math.Linear(MOBILE_SINGING_AUDIO_RISE_MIN_STEP, MOBILE_SINGING_AUDIO_RISE_MAX_STEP, volumeRatio)
      : Phaser.Math.Linear(SINGING_AUDIO_RISE_MIN_STEP, SINGING_AUDIO_RISE_MAX_STEP, volumeRatio);
  }

  private singingFallStep(quietDistanceRatio: number): number {
    return this.isMobileTouchMode()
      ? Phaser.Math.Linear(MOBILE_SINGING_AUDIO_FALL_MIN_STEP, MOBILE_SINGING_AUDIO_FALL_MAX_STEP, quietDistanceRatio)
      : Phaser.Math.Linear(SINGING_AUDIO_FALL_MIN_STEP, SINGING_AUDIO_FALL_MAX_STEP, quietDistanceRatio);
  }

  private singingOutOfRangeFallStep(): number {
    return this.isMobileTouchMode() ? MOBILE_SINGING_AUDIO_OUT_OF_RANGE_FALL_STEP : SINGING_AUDIO_OUT_OF_RANGE_FALL_STEP;
  }

  private updateBirdAmbientAudio(time: number): void {
    if (time - this.lastBirdAmbientUpdateAt < BIRD_AMBIENT_UPDATE_INTERVAL_MS) {
      return;
    }
    this.lastBirdAmbientUpdateAt = time;

    const targetVolume = this.birdAmbientTargetVolume();
    const delta = targetVolume - this.birdAmbientVolume;
    const step = delta > 0 ? BIRD_AMBIENT_RISE_STEP : BIRD_AMBIENT_FALL_STEP;
    this.birdAmbientVolume = Math.abs(delta) <= step ? targetVolume : this.birdAmbientVolume + Math.sign(delta) * step;
    this.setBirdAmbientVolume(this.birdAmbientVolume);

    if (targetVolume <= BIRD_AMBIENT_MIN_VOLUME) {
      this.nextBirdAmbientAt = time + this.birdAmbientDelay(true);
      return;
    }

    if (this.nextBirdAmbientAt <= 0) {
      this.nextBirdAmbientAt = time + this.birdAmbientDelay(true);
      return;
    }

    if (time < this.nextBirdAmbientAt) {
      return;
    }

    if (this.playBirdAmbientPattern()) {
      this.nextBirdAmbientAt = time + this.birdAmbientDelay(false);
    } else {
      this.nextBirdAmbientAt = time + 900;
    }
  }

  private birdAmbientDelay(first: boolean): number {
    const min = first ? BIRD_AMBIENT_FIRST_DELAY_MIN_MS : BIRD_AMBIENT_DELAY_MIN_MS;
    const max = first ? BIRD_AMBIENT_FIRST_DELAY_MAX_MS : BIRD_AMBIENT_DELAY_MAX_MS;
    const mobileExtra = this.isMobileTouchMode() ? 900 : 0;
    const leanExtra = this.mobileDeepSustainRuntime ? 4_500 : this.mobileSustainedLeanRuntime ? 2_400 : this.mobileLeanRuntime ? 1_100 : 0;
    return Math.round(Phaser.Math.Between(min + mobileExtra + leanExtra, max + mobileExtra + leanExtra));
  }

  private playBirdAmbientPattern(): boolean {
    const destination = this.birdAmbientDestination();
    if (!destination || this.birdAmbientVolume <= BIRD_AMBIENT_MIN_VOLUME) {
      return false;
    }

    if (this.worldNightAmount > 0.55) {
      return this.playNightAmbientPattern();
    }

    const local = this.localPlayer();
    const biome = local ? this.worldBiomeAt(this.localRenderPosition(local)) : "grass";
    if ((biome === "darkForest" || biome === "swamp") && Phaser.Math.Between(0, 100) < 58) {
      return this.playCrowAmbientPattern();
    }

    const patterns: Array<Array<{ ratio: number; delay: number; duration: number; bend: number; volume: number }>> = [
      [
        { ratio: 1, delay: 0, duration: 0.052, bend: 1.22, volume: 1 },
        { ratio: 1.34, delay: 86, duration: 0.047, bend: 1.12, volume: 0.82 },
        { ratio: 1.72, delay: 178, duration: 0.064, bend: 0.92, volume: 0.66 }
      ],
      [
        { ratio: 1, delay: 0, duration: 0.038, bend: 0.88, volume: 0.88 },
        { ratio: 0.82, delay: 62, duration: 0.042, bend: 1.18, volume: 0.78 },
        { ratio: 1.48, delay: 134, duration: 0.052, bend: 1.08, volume: 0.7 },
        { ratio: 1.18, delay: 232, duration: 0.07, bend: 0.94, volume: 0.58 }
      ],
      [
        { ratio: 1, delay: 0, duration: 0.07, bend: 1.36, volume: 0.94 },
        { ratio: 1.08, delay: 126, duration: 0.042, bend: 1.18, volume: 0.76 }
      ],
      [
        { ratio: 1, delay: 0, duration: 0.045, bend: 1.16, volume: 0.82 },
        { ratio: 1.58, delay: 92, duration: 0.036, bend: 0.9, volume: 0.68 },
        { ratio: 1.28, delay: 174, duration: 0.052, bend: 1.24, volume: 0.72 }
      ],
      [
        { ratio: 1, delay: 0, duration: 0.082, bend: 0.78, volume: 0.7 }
      ],
      [
        { ratio: 1, delay: 0, duration: 0.032, bend: 1.48, volume: 0.94 },
        { ratio: 1.9, delay: 54, duration: 0.036, bend: 0.82, volume: 0.74 },
        { ratio: 1.52, delay: 112, duration: 0.04, bend: 1.2, volume: 0.66 },
        { ratio: 2.12, delay: 184, duration: 0.05, bend: 0.9, volume: 0.54 }
      ],
      [
        { ratio: 0.78, delay: 0, duration: 0.11, bend: 1.08, volume: 0.62 },
        { ratio: 1, delay: 142, duration: 0.12, bend: 0.96, volume: 0.68 },
        { ratio: 0.86, delay: 304, duration: 0.09, bend: 1.16, volume: 0.52 }
      ],
      [
        { ratio: 1, delay: 0, duration: 0.028, bend: 1.7, volume: 0.9 },
        { ratio: 1.64, delay: 44, duration: 0.03, bend: 1.35, volume: 0.82 },
        { ratio: 2.25, delay: 91, duration: 0.044, bend: 0.78, volume: 0.62 }
      ],
      [
        { ratio: 1, delay: 0, duration: 0.064, bend: 0.72, volume: 0.78 },
        { ratio: 0.62, delay: 96, duration: 0.07, bend: 1.28, volume: 0.66 },
        { ratio: 1.14, delay: 214, duration: 0.052, bend: 1.08, volume: 0.6 }
      ]
    ];
    const pattern = patterns[Phaser.Math.Between(0, patterns.length - 1)] ?? patterns[0];
    const root = Phaser.Math.Between(1040, 3040);
    const type: OscillatorType = Phaser.Math.Between(0, 4) === 0 ? "triangle" : "sine";
    const filterBase = Phaser.Math.Between(3000, 6800);
    const gainBoost = Phaser.Math.FloatBetween(1.85, 2.45);
    pattern.forEach((note) => {
      this.playBirdChirp(root * note.ratio, note.duration, note.volume * gainBoost, note.delay, note.bend, filterBase, type);
    });
    return true;
  }

  private playNightAmbientPattern(): boolean {
    const destination = this.birdAmbientDestination();
    if (!destination || this.birdAmbientVolume <= BIRD_AMBIENT_MIN_VOLUME) {
      return false;
    }

    if (Phaser.Math.Between(0, 100) < 16) {
      this.playBirdChirp(324, 0.16, 0.85, 0, 0.92, 760, "sine");
      this.playBirdChirp(286, 0.22, 0.72, 300, 0.88, 700, "sine");
      return true;
    }

    const trains = Phaser.Math.Between(2, 4);
    const root = Phaser.Math.Between(3500, 4400);
    for (let train = 0; train < trains; train += 1) {
      const start = train * Phaser.Math.Between(340, 520);
      const pulses = Phaser.Math.Between(5, 9);
      for (let pulse = 0; pulse < pulses; pulse += 1) {
        this.playBirdChirp(root * Phaser.Math.FloatBetween(0.985, 1.015), 0.02, 0.62 - train * 0.09, start + pulse * 33, 1.03, Math.min(7600, root * 1.7), "sine");
      }
    }
    return true;
  }

  private playCrowAmbientPattern(): boolean {
    const destination = this.birdAmbientDestination();
    if (!destination || this.birdAmbientVolume <= BIRD_AMBIENT_MIN_VOLUME) {
      return false;
    }

    const calls = Phaser.Math.Between(2, 4);
    const root = Phaser.Math.Between(210, 340);
    for (let index = 0; index < calls; index += 1) {
      this.playCrowCaw(root * Phaser.Math.FloatBetween(0.82, 1.18), 0.16 + Phaser.Math.FloatBetween(0, 0.08), 0.78 - index * 0.08, index * Phaser.Math.Between(160, 260));
    }
    return true;
  }

  private playCrowCaw(frequency: number, duration: number, volume: number, delay: number): void {
    this.scheduleTone(() => {
      if (document.hidden || this.birdAmbientVolume <= BIRD_AMBIENT_MIN_VOLUME) {
        return;
      }

      const context = this.ensureAudioContext();
      if (!context || context.state !== "running") {
        return;
      }
      const destination = this.birdAmbientDestination();
      if (!destination) {
        return;
      }

      const oscillator = context.createOscillator();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();
      const start = context.currentTime;
      oscillator.type = "sawtooth";
      oscillator.frequency.setValueAtTime(Math.max(90, frequency), start);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(90, frequency * 0.62), start + duration * 0.82);
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(620, start);
      filter.Q.setValueAtTime(2.4, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * 1.65), start + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(filter);
      filter.connect(gain);
      gain.connect(destination);
      oscillator.onended = () => {
        oscillator.disconnect();
        filter.disconnect();
        gain.disconnect();
      };
      oscillator.start(start);
      oscillator.stop(start + duration + 0.025);
    }, delay);
  }

  private playBirdChirp(
    frequency: number,
    duration: number,
    volume: number,
    delay: number,
    bend: number,
    filterFrequency: number,
    type: OscillatorType
  ): void {
    this.scheduleTone(() => {
      if (document.hidden || this.birdAmbientVolume <= BIRD_AMBIENT_MIN_VOLUME) {
        return;
      }

      const context = this.ensureAudioContext();
      if (!context || context.state !== "running") {
        return;
      }
      const destination = this.birdAmbientDestination();
      if (!destination) {
        return;
      }

      const oscillator = context.createOscillator();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();
      const start = context.currentTime;
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(Math.max(220, frequency), start);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(220, frequency * bend), start + duration * 0.76);
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(filterFrequency, start);
      filter.Q.setValueAtTime(7.5, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(filter);
      filter.connect(gain);
      gain.connect(destination);
      oscillator.onended = () => {
        oscillator.disconnect();
        filter.disconnect();
        gain.disconnect();
      };
      oscillator.start(start);
      oscillator.stop(start + duration + 0.018);
    }, delay);
  }

  private birdAmbientTargetVolume(): number {
    if (document.hidden) {
      return 0;
    }

    const local = this.localPlayer();
    if (!local) {
      return 0;
    }

    const biome = this.worldBiomeAt(this.localRenderPosition(local));
    const biomeVolume =
      biome === "forest"
        ? 1
        : biome === "grass"
          ? 1
          : biome === "darkForest"
            ? 0.72
            : biome === "swamp"
              ? 0.62
              : biome === "coast"
                ? 0.68
                : biome === "desert"
                  ? 0.72
                  : biome === "snow" || biome === "mountain"
                    ? 0.34
                : biome === "fire" || biome === "void"
                  ? 0
                  : 0.24;
    if (biomeVolume <= 0) {
      return 0;
    }

    const baseVolume = this.isMobileTouchMode() ? BIRD_AMBIENT_MOBILE_MAX_VOLUME : BIRD_AMBIENT_DESKTOP_MAX_VOLUME;
    const loudestSingerVolume = Math.max(0, ...[...this.singingAudio.values()].map((handle) => handle.currentVolume));
    const singingDuck = Phaser.Math.Linear(1, 0.78, Phaser.Math.Clamp(loudestSingerVolume / SINGING_AUDIO_MAX_VOLUME, 0, 1));
    return baseVolume * biomeVolume * singingDuck;
  }

  private worldBiomeAt(position: Vector2): WorldBiomeKind {
    for (const region of WORLD_MAP_REGIONS) {
      const dx = (position.x - region.position.x) / (region.width / 2);
      const dy = (position.y - region.position.y) / (region.height / 2);
      if (dx * dx + dy * dy <= 1) {
        return region.kind;
      }
    }
    return "grass";
  }

  private birdAmbientDestination(): GainNode | undefined {
    const context = this.ensureAudioContext();
    if (!context || context.state !== "running") {
      return undefined;
    }
    if (!this.birdAmbientGain) {
      this.birdAmbientGain = context.createGain();
      this.birdAmbientGain.gain.setValueAtTime(Phaser.Math.Clamp(this.birdAmbientVolume, 0, BIRD_AMBIENT_DESKTOP_MAX_VOLUME), context.currentTime);
      this.birdAmbientGain.connect(context.destination);
    }
    return this.birdAmbientGain;
  }

  private setBirdAmbientVolume(volume: number): void {
    if (!this.birdAmbientGain) {
      return;
    }
    const context = this.ensureAudioContext();
    if (!context || context.state === "closed") {
      return;
    }
    const clamped = Phaser.Math.Clamp(volume, 0, BIRD_AMBIENT_DESKTOP_MAX_VOLUME);
    this.birdAmbientGain.gain.cancelScheduledValues(context.currentTime);
    this.birdAmbientGain.gain.linearRampToValueAtTime(clamped, context.currentTime + 0.22);
  }

  private stopBirdAmbientAudio(): void {
    this.birdAmbientGain?.disconnect();
    this.birdAmbientGain = undefined;
    this.birdAmbientVolume = 0;
    this.nextBirdAmbientAt = 0;
  }

  private updateWorldMusic(time: number): void {
    if (time - this.lastWorldMusicUpdateAt < WORLD_MUSIC_UPDATE_INTERVAL_MS) {
      return;
    }
    this.lastWorldMusicUpdateAt = time;

    const target = this.worldMusicTarget();
    const delta = target.volume - this.worldMusicVolume;
    const step = delta > 0 ? WORLD_MUSIC_RISE_STEP : WORLD_MUSIC_FALL_STEP;
    this.worldMusicVolume = Math.abs(delta) <= step ? target.volume : this.worldMusicVolume + Math.sign(delta) * step;
    this.setWorldMusicVolume(this.worldMusicVolume);

    if (!target.profile || this.worldMusicVolume <= WORLD_MUSIC_MIN_VOLUME) {
      return;
    }

    if (target.profile.key !== this.worldMusicKey) {
      this.worldMusicKey = target.profile.key;
      this.worldMusicStep = 0;
      this.worldMusicPhraseSeed = Phaser.Math.Between(0, 999);
      this.worldMusicNextNoteAt = time + Phaser.Math.Between(850, 1_650);
      this.worldMusicNextPadAt = time + Phaser.Math.Between(2_400, 5_200);
    }

    if (time >= this.worldMusicNextPadAt) {
      this.playWorldMusicPad(target.profile);
      this.worldMusicNextPadAt = time + target.profile.padMs + Phaser.Math.Between(2_400, 6_200);
    }

    if (time >= this.worldMusicNextNoteAt) {
      if (this.worldMusicStep > 0 && this.worldMusicStep % 24 === 0) {
        this.worldMusicPhraseSeed = Phaser.Math.Between(0, 999);
      }
      this.playWorldMusicNote(target.profile);
      const mobileExtra = this.isMobileTouchMode() ? 420 : 0;
      const phraseRest = (this.worldMusicStep + this.worldMusicPhraseSeed) % 13 === 10 ? Phaser.Math.Between(1_600, 3_200) : 0;
      this.worldMusicNextNoteAt = time + Math.max(1_050, target.profile.intervalMs * Phaser.Math.FloatBetween(0.68, 1.18)) + mobileExtra + phraseRest;
      this.worldMusicStep += 1;
    }
  }

  private worldMusicTarget(): { profile?: WorldMusicProfile; volume: number } {
    if (document.hidden) {
      return { volume: 0 };
    }

    const local = this.localPlayer();
    if (!local) {
      return { volume: 0 };
    }

    const profile = this.worldMusicProfileFor(local);
    if (!profile) {
      return { volume: 0 };
    }

    const loudestSingerVolume = Math.max(0, ...[...this.singingAudio.values()].map((handle) => handle.currentVolume));
    const singingDuck = Phaser.Math.Linear(1, 0.55, Phaser.Math.Clamp(loudestSingerVolume / SINGING_AUDIO_MAX_VOLUME, 0, 1));
    const mobileDuck = this.isMobileTouchMode() ? 0.72 : 1;
    const leanDuck = this.mobileDeepSustainRuntime ? 0.45 : this.mobileSustainedLeanRuntime ? 0.62 : this.mobileLeanRuntime ? 0.8 : 1;
    return {
      profile,
      volume: profile.volume * 0.62 * mobileDuck * leanDuck * singingDuck
    };
  }

  private worldMusicProfileFor(player: PlayerPublicState): WorldMusicProfile | undefined {
    if (player.zone === "boss") {
      return WORLD_MUSIC_PROFILES.boss;
    }
    if (player.zone === "dungeon") {
      return WORLD_MUSIC_PROFILES.dungeon;
    }
    if (player.zone === "safe") {
      return WORLD_MUSIC_PROFILES.town;
    }
    const biome = this.worldBiomeAt(this.localRenderPosition(player));
    return WORLD_MUSIC_PROFILES[biome] ?? WORLD_MUSIC_PROFILES.grass;
  }

  private playWorldMusicPad(profile: WorldMusicProfile): void {
    const phrase = this.worldMusicStep + this.worldMusicPhraseSeed;
    if (phrase % 5 === 2) {
      return;
    }

    const bassSemitone = profile.bass[phrase % profile.bass.length] ?? -12;
    const colorSemitone = profile.scale[(phrase + 3) % profile.scale.length] ?? profile.scale[2] ?? 7;
    const padDuration = Math.min(profile.padDuration, Phaser.Math.FloatBetween(1.7, 3.15));
    const padWave: OscillatorType = profile.padWave === "sawtooth" ? "triangle" : profile.padWave;
    this.playWorldMusicTone(this.noteFrequency(profile.root, bassSemitone), padDuration, 0.04, padWave, -5);
    this.playWorldMusicTone(
      this.noteFrequency(profile.root, colorSemitone) * (phrase % 2 === 0 ? 1.5 : 1.25),
      padDuration * 0.72,
      0.018,
      "sine",
      8,
      160
    );
  }

  private playWorldMusicNote(profile: WorldMusicProfile): void {
    const phrase = this.worldMusicStep + this.worldMusicPhraseSeed;
    if (phrase % 11 === 5) {
      const restBass = profile.bass[(phrase + 1) % profile.bass.length] ?? -12;
      this.playWorldMusicTone(this.noteFrequency(profile.root, restBass), 0.32, 0.032, "triangle", -7);
      return;
    }

    const stride = (this.worldMusicPhraseSeed % 3) + 1;
    const leadIndex = (this.worldMusicStep * stride + this.worldMusicPhraseSeed) % profile.lead.length;
    const leadSemitone = profile.lead[leadIndex] ?? profile.scale[0] ?? 0;
    const leadWave: OscillatorType = profile.wave === "sawtooth" ? "triangle" : profile.wave;
    const leadOctave = phrase % 4 === 0 ? 2 : phrase % 3 === 0 ? 1.5 : 1.25;
    const leadDuration = Phaser.Math.Clamp(profile.noteDuration * Phaser.Math.FloatBetween(0.28, 0.54), 0.28, 0.86);
    this.playWorldMusicTone(this.noteFrequency(profile.root, leadSemitone) * leadOctave, leadDuration, 0.108, leadWave, phrase % 2 === 0 ? -3 : 4);

    if (phrase % 4 === 0) {
      const bassSemitone = profile.bass[(this.worldMusicStep + 1) % profile.bass.length] ?? -12;
      this.playWorldMusicTone(this.noteFrequency(profile.root, bassSemitone), 0.38, 0.052, "triangle", -6, 42);
    }

    if (!this.isMobileTouchMode() && phrase % 6 === 2) {
      const harmonyA = profile.scale[(leadIndex + 2) % profile.scale.length] ?? leadSemitone;
      const harmonyB = profile.scale[(leadIndex + 4) % profile.scale.length] ?? harmonyA;
      this.playWorldMusicTone(this.noteFrequency(profile.root, harmonyA) * 1.5, 0.42, 0.052, "triangle", 7, 118);
      this.playWorldMusicTone(this.noteFrequency(profile.root, harmonyB) * 2, 0.48, 0.038, "sine", 10, 260);
    }

    if (!this.isMobileTouchMode() && phrase % 9 === 7) {
      const sparkle = profile.scale[(leadIndex + 5) % profile.scale.length] ?? leadSemitone;
      this.playWorldMusicTone(this.noteFrequency(profile.root, sparkle) * 2.5, 0.24, 0.026, "sine", 14, 360);
    }
  }

  private noteFrequency(root: number, semitone: number): number {
    return root * Math.pow(2, semitone / 12);
  }

  private playWorldMusicTone(frequency: number, duration: number, volume: number, type: OscillatorType, detune: number, delayMs = 0): void {
    if (delayMs > 0) {
      this.scheduleTone(() => this.playWorldMusicTone(frequency, duration, volume, type, detune), delayMs);
      return;
    }

    if (document.hidden || this.worldMusicVolume <= WORLD_MUSIC_MIN_VOLUME) {
      return;
    }

    const context = this.ensureAudioContext();
    if (!context || context.state !== "running") {
      return;
    }
    const destination = this.worldMusicDestination();
    if (!destination) {
      return;
    }

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime;
    const attack = Math.min(0.16, Math.max(0.012, duration * 0.12));
    const releaseAt = Math.max(start + attack + 0.05, start + duration * 0.64);
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(28, frequency), start);
    oscillator.detune.setValueAtTime(detune, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(Math.max(0.0001, volume), start + attack);
    gain.gain.setValueAtTime(Math.max(0.0001, volume * (duration > 1.2 ? 0.48 : 0.68)), releaseAt);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start(start);
    oscillator.stop(start + duration + 0.04);
  }

  private worldMusicDestination(): AudioNode | undefined {
    const context = this.ensureAudioContext();
    if (!context || context.state !== "running") {
      return undefined;
    }
    if (!this.worldMusicGain || !this.worldMusicFilter) {
      this.worldMusicFilter = context.createBiquadFilter();
      this.worldMusicFilter.type = "lowpass";
      this.worldMusicFilter.frequency.setValueAtTime(1400, context.currentTime);
      this.worldMusicFilter.Q.setValueAtTime(0.7, context.currentTime);
      this.worldMusicGain = context.createGain();
      this.worldMusicGain.gain.setValueAtTime(0, context.currentTime);
      this.worldMusicFilter.connect(this.worldMusicGain);
      this.worldMusicGain.connect(context.destination);
    }

    const profile = WORLD_MUSIC_PROFILES[this.worldMusicKey];
    if (profile) {
      this.worldMusicFilter.frequency.linearRampToValueAtTime(Math.max(1850, profile.filter + 620), context.currentTime + 0.75);
    }
    return this.worldMusicFilter;
  }

  private setWorldMusicVolume(volume: number): void {
    if (!this.worldMusicGain) {
      return;
    }
    const context = this.ensureAudioContext();
    if (!context || context.state === "closed") {
      return;
    }
    this.worldMusicGain.gain.cancelScheduledValues(context.currentTime);
    this.worldMusicGain.gain.linearRampToValueAtTime(Phaser.Math.Clamp(volume, 0, 0.16), context.currentTime + 0.42);
  }

  private stopWorldMusic(): void {
    this.worldMusicGain?.disconnect();
    this.worldMusicFilter?.disconnect();
    this.worldMusicGain = undefined;
    this.worldMusicFilter = undefined;
    this.worldMusicVolume = 0;
    this.worldMusicKey = "";
    this.worldMusicPhraseSeed = 0;
    this.worldMusicNextNoteAt = 0;
    this.worldMusicNextPadAt = 0;
  }

  private suspendSingingAudioPlayback(): void {
    for (const handle of this.singingAudio.values()) {
      if (handle.unlockTimer !== undefined) {
        window.clearTimeout(handle.unlockTimer);
        handle.unlockTimer = undefined;
      }
      handle.pendingPlay = false;
      handle.fadingOut = true;
      handle.currentVolume = 0;
      handle.unmutedAt = undefined;
      if (handle.gain && this.audioContext && this.audioContext.state !== "closed") {
        handle.gain.gain.cancelScheduledValues(this.audioContext.currentTime);
        handle.gain.gain.setValueAtTime(0, this.audioContext.currentTime);
      }
      handle.audio.muted = true;
      handle.audio.volume = 0;
      handle.audio.pause();
    }
    if (this.reusableSingingAudio) {
      this.reusableSingingAudio.muted = true;
      this.reusableSingingAudio.volume = 0;
      this.reusableSingingAudio.pause();
    }
  }

  private stopSingingAudio(handle: SingingAudioHandle): void {
    if (handle.unlockTimer !== undefined) {
      window.clearTimeout(handle.unlockTimer);
      handle.unlockTimer = undefined;
    }
    handle.pendingTrackId = undefined;
    handle.pendingTrackUrl = undefined;
    handle.gain?.disconnect();
    handle.source?.disconnect();
    const reusable = !handle.source;
    handle.gain = undefined;
    handle.source = undefined;
    handle.audio.muted = false;
    handle.audio.pause();
    handle.audio.removeAttribute("src");
    handle.audio.load();
    this.singingAudio.delete(handle.playerId);
    if (reusable && !this.reusableSingingAudio) {
      this.reusableSingingAudio = handle.audio;
    }
  }

  private stopAllSingingAudio(): void {
    let cachedReusable = Boolean(this.reusableSingingAudio);
    for (const handle of this.singingAudio.values()) {
      handle.gain?.disconnect();
      handle.source?.disconnect();
      const reusable = !handle.source;
      handle.gain = undefined;
      handle.source = undefined;
      handle.audio.pause();
      handle.audio.removeAttribute("src");
      handle.audio.load();
      if (reusable && !cachedReusable) {
        this.reusableSingingAudio = handle.audio;
        cachedReusable = true;
      }
    }
    this.singingAudio.clear();
  }

  private ensureAudioContext(): AudioContext | undefined {
    if (!this.audioContext) {
      try {
        const audioContextCtor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (audioContextCtor) {
          this.audioContext = new audioContextCtor();
          this.gameToneGain = undefined;
          this.gameToneCompressor = undefined;
        }
      } catch {
        this.audioContext = undefined;
      }
    }

    return this.audioContext;
  }

  private gameToneDestination(): AudioNode | undefined {
    const context = this.ensureAudioContext();
    if (!context || context.state !== "running") {
      return undefined;
    }
    if (!this.gameToneGain) {
      this.gameToneGain = context.createGain();
      this.gameToneCompressor = context.createDynamicsCompressor();
      this.gameToneGain.gain.setValueAtTime(1, context.currentTime);
      this.gameToneCompressor.threshold.setValueAtTime(-18, context.currentTime);
      this.gameToneCompressor.knee.setValueAtTime(18, context.currentTime);
      this.gameToneCompressor.ratio.setValueAtTime(5, context.currentTime);
      this.gameToneCompressor.attack.setValueAtTime(0.003, context.currentTime);
      this.gameToneCompressor.release.setValueAtTime(0.12, context.currentTime);
      this.gameToneGain.connect(this.gameToneCompressor);
      this.gameToneCompressor.connect(context.destination);
    }
    return this.gameToneGain;
  }

  resumeAudio(): void {
    const now = this.time.now || performance.now();
    const birdNeedsResume = this.birdAmbientTargetVolume() > BIRD_AMBIENT_MIN_VOLUME && this.audioContext?.state !== "running";
    if (this.audioContext?.state === "running" && this.singingAudioElementWarmed && !birdNeedsResume && now - this.lastAudioResumeAt < 300) {
      return;
    }
    this.lastAudioResumeAt = now;

    const context = this.ensureAudioContext();
    if (context && context.state !== "running" && context.state !== "closed") {
      void context.resume();
    }
    if (!this.singingAudioElementWarmed) {
      this.warmReusableSingingAudio();
    }
    if (now - this.lastSingingResumeAt > 450) {
      this.lastSingingResumeAt = now;
      this.resumeSingingAudioPlayback();
    }
  }

  private playNoiseBurst(duration: number, volume: number, filterFrequency: AudioSweep, delay = 0, filterType: BiquadFilterType = "bandpass"): void {
    this.scheduleTone(() => {
      if (document.hidden) {
        return;
      }
      const context = this.ensureAudioContext();
      if (!context || context.state !== "running") {
        return;
      }
      const destination = this.gameToneDestination();
      if (!destination) {
        return;
      }
      if (this.isMobileTouchMode() && !this.spendMobileAudioBudget()) {
        return;
      }

      if (!this.noiseBuffer || this.noiseBuffer.sampleRate !== context.sampleRate) {
        const length = Math.floor(context.sampleRate * 0.75);
        const buffer = context.createBuffer(1, length, context.sampleRate);
        const data = buffer.getChannelData(0);
        for (let index = 0; index < length; index += 1) {
          data[index] = Math.random() * 2 - 1;
        }
        this.noiseBuffer = buffer;
      }

      const source = context.createBufferSource();
      source.buffer = this.noiseBuffer;
      const filter = context.createBiquadFilter();
      const gain = context.createGain();
      const start = context.currentTime;
      const [filterStart, filterEnd] = typeof filterFrequency === "number"
        ? [filterFrequency, Math.max(140, filterFrequency * 0.42)]
        : filterFrequency;
      filter.type = filterType;
      filter.frequency.setValueAtTime(Math.max(40, filterStart), start);
      filter.frequency.exponentialRampToValueAtTime(Math.max(40, filterEnd), start + duration);
      filter.Q.setValueAtTime(1.1, start);
      const burstVolume = Math.min(
        GAME_TONE_MAX_VOLUME,
        volume * (this.isMobileTouchMode() ? MOBILE_GAME_TONE_VOLUME_MULTIPLIER : GAME_TONE_VOLUME_MULTIPLIER)
      );
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(Math.max(0.0001, burstVolume), start + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(destination);
      source.onended = () => {
        source.disconnect();
        filter.disconnect();
        gain.disconnect();
      };
      const maxOffset = Math.max(0, (source.buffer?.duration ?? duration) - duration - 0.01);
      source.start(start, Math.random() * maxOffset);
      source.stop(start + duration + 0.02);
    }, delay);
  }

  private playTone(
    frequency: AudioSweep,
    duration: number,
    volume: number,
    throttleMs = 45,
    type: OscillatorType = "triangle",
    filterFrequency = 1200,
    retryAfterResume = true
  ): void {
    if (document.hidden) {
      return;
    }

    const context = this.ensureAudioContext();
    if (!context) {
      return;
    }
    if (context.state !== "running") {
      if (context.state !== "closed" && retryAfterResume) {
        void context.resume().then(() => {
          this.playTone(frequency, duration, volume, throttleMs, type, filterFrequency, false);
        }).catch(() => undefined);
      }
      return;
    }
    const destination = this.gameToneDestination();
    if (!destination) {
      return;
    }
    if (this.isMobileTouchMode() && !this.spendMobileAudioBudget()) {
      return;
    }

    const now = this.time.now;
    if (throttleMs > 0) {
      const effectiveThrottleMs = this.isMobileTouchMode()
        ? Math.max(throttleMs, this.mobileDeepSustainRuntime ? 220 : this.mobileSustainedLeanRuntime ? 160 : this.mobileLeanRuntime ? 80 : 18)
        : throttleMs;
      if (now - this.lastSoundAt < effectiveThrottleMs) {
        return;
      }
      this.lastSoundAt = now;
    }

    const oscillator = context.createOscillator();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    const start = context.currentTime;
    const attack = Math.min(0.008, Math.max(0.002, duration * 0.24));
    const [frequencyStart, frequencyEnd] = typeof frequency === "number" ? [frequency, frequency] : frequency;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(20, frequencyStart), start);
    if (frequencyEnd !== frequencyStart) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, frequencyEnd), start + duration);
    }
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(filterFrequency, start);
    filter.Q.setValueAtTime(0.62, start);
    const toneVolume = Math.min(GAME_TONE_MAX_VOLUME, volume * (this.isMobileTouchMode() ? MOBILE_GAME_TONE_VOLUME_MULTIPLIER : GAME_TONE_VOLUME_MULTIPLIER));
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(Math.max(0.0001, toneVolume), start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    oscillator.onended = () => {
      oscillator.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
    oscillator.start(start);
    oscillator.stop(start + duration);
  }

  private spendMobileAudioBudget(): boolean {
    const now = this.time.now;
    if (now - this.mobileAudioWindowAt >= 1_000) {
      this.mobileAudioWindowAt = now;
      this.mobileAudioCount = 0;
    }

    const limit = this.mobileDeepSustainRuntime ? 3 : this.mobileSustainedLeanRuntime ? 5 : this.mobileLeanRuntime ? 8 : 20;
    if (this.mobileAudioCount >= limit) {
      return false;
    }

    this.mobileAudioCount += 1;
    return true;
  }
}
