import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type WheelEvent as ReactWheelEvent
} from "react";
import {
  ArrowUpRight,
  Axe,
  Backpack,
  BookOpen,
  Bomb,
  ChevronDown,
  CloudLightning,
  Coins,
  Crosshair,
  Crown,
  Download,
  Droplets,
  Footprints,
  Flame,
  Gem,
  Hand,
  HeartPulse,
  Map as MapIcon,
  MessageSquare,
  Mic,
  Mic2,
  MicOff,
  Package,
  Radio,
  Send,
  Settings,
  Shield,
  ShieldAlert,
  Shirt,
  Snowflake,
  Sparkles,
  Store,
  Swords,
  Target,
  UserRound,
  Users,
  WalletCards,
  Wind,
  X,
  Zap,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import {
  CHARACTER_FACE_VARIANT_COUNT,
  CHARACTER_FACE_VARIANTS_PER_GENDER,
  CITY_DEFINITIONS,
  CLASS_DEFINITIONS,
  MAX_ARMOR_ENCHANT_LEVEL,
  MAX_WEAPON_ENCHANT_LEVEL,
  SHOP_CATALOG,
  TELEPORT_DEFINITIONS,
  WORLD_BOUNDS,
  WORLD_DUNGEON_INTERIORS,
  WORLD_LAKES,
  WORLD_LANDMARKS,
  WORLD_MAP_LABELS,
  WORLD_MAP_REGIONS,
  WORLD_MOUNTAINS,
  WORLD_OBSTACLES,
  WORLD_ROADS,
  WORLD_RIVERS,
  WORLD_SCENIC_DETAILS,
  WORLD_HUNTING_GROUNDS,
  WORLD_STARTER_ARENA,
  WORLD_STARTER_ARENA_GATES,
  WORLD_STARTER_ARENA_WALL_RADIUS,
  WORLD_WATERFALLS,
  WORLD_HAZARDS,
  enchantScrollIdsForGrade,
  characterFaceStyleVariant,
  characterGenderFromFace,
  itemGradeLabel,
  itemGradeText,
  xpForNextLevel,
  type AdminActionType,
  type AdminState,
  type CharacterClass,
  type CharacterGender,
  type CharacterRace,
  type ChatChannel,
  type ChatMessage,
  type ClanEmblem,
  type DerivedStats,
  type EquipmentSlot,
  type EquipmentState,
  type GameSnapshot,
  type InventoryItem,
  type MonsterArchetype,
  type PlayerPublicState,
  type TeleportId,
  type VoiceChannel,
  type WalletState
} from "@mmo/shared";
import { GameCanvas } from "./game/GameCanvas";
import { touchDiag } from "./game/touchDiagnostics";
import {
  loadMobileGraphicsSettings,
  mobileGraphicsPresets,
  presetSettings,
  saveMobileGraphicsSettings,
  type MobileGraphicsSettings
} from "./game/performanceSettings";
import { translateBotChat } from "./botChatI18n";
import {
  LANGUAGE_OPTIONS,
  loadLanguage,
  saveLanguage,
  translateText,
  type AppLanguage
} from "./i18n";

type ProfileTab = "equipment" | "stats" | "wallet" | "skills" | "quests" | "clan" | "map" | "arena" | "settings" | "admin";
type AuthMode = "login" | "register" | "reset";
type AccountSession = {
  token: string;
  login?: string;
  authProvider?: "account" | "guest";
  character: {
    id: string;
    name: string;
    classId: CharacterClass;
    race: CharacterRace;
    face: number;
    customHeadUrl?: string;
  };
};
type PremiumPlanId = "week" | "month";
type PremiumStatus = {
  enabled: boolean;
  mode: "disabled" | "demo" | "production";
  status: "none" | "pending" | "trial" | "active" | "past_due" | "canceled";
  planId?: PremiumPlanId;
  premiumUntil?: string;
  nextChargeAt?: string;
  cancelAtPeriodEnd: boolean;
  active: boolean;
  canStartTrial: boolean;
  lastError?: string;
};
type CoinPaymentStatus = {
  enabled: boolean;
  mode: "disabled" | "demo" | "production";
  priceRub: 1;
  coinQuantity: 1;
  status: "none" | "pending" | "paid" | "failed";
  orderId?: string;
  updatedAt?: string;
  lastError?: string;
};
type HotbarEntry = { type: "attack" } | { type: "sprint" } | { type: "skill"; skillId: string } | { type: "item"; itemId: string };
type SkillVisual = { Icon: typeof Zap; className: string; shortLabel: string };
type FaceParts = { gender: CharacterGender; hair: number; eyes: number; mark: number };
type LocalFacingEventDetail = { x?: number; y?: number; degrees?: number };
type ChallengePeriod = "hourly" | "daily";
type ChallengeMetric = "xp" | "gold" | "coin" | "arenaWins" | "level" | "gear";
type ChallengeStats = Record<ChallengeMetric, number>;
type ChallengeDefinition = {
  id: string;
  period: ChallengePeriod;
  label: string;
  hint: string;
  metric: ChallengeMetric;
  goal: number;
};
type StoredPathChallenges = {
  collapsed?: boolean;
  seenKey?: string;
  baselines?: Record<string, ChallengeStats>;
};
type VoicePermissionState = "prompt" | "granted" | "denied" | "unsupported";
type VoiceUiState = {
  supported: boolean;
  enabled: boolean;
  permission: VoicePermissionState;
  active: boolean;
  channel: VoiceChannel;
  peers: Array<{ playerId: string; name: string; channel: VoiceChannel; distance?: number }>;
  remoteSpeakers: Array<{ playerId: string; name: string; channel: VoiceChannel }>;
  error?: string;
};
type StoryQuestObjective =
  | { kind: "monster"; archetype: MonsterArchetype; goal: number; label: string }
  | { kind: "level"; goal: number; label: string }
  | { kind: "arenaWins"; goal: number; label: string }
  | { kind: "pk"; goal: number; label: string };
type StoryQuestTarget = {
  label: string;
  position: { x: number; y: number };
  radius: number;
  hint: string;
};
type StoryQuestDefinition = {
  id: string;
  chapter: string;
  title: string;
  summary: string;
  objective: StoryQuestObjective;
  target?: StoryQuestTarget;
  rewardHint: string;
};
type StoryQuestBaseline = {
  monsterKills?: Partial<Record<MonsterArchetype, number>>;
  arenaWins: number;
  pkCount: number;
};
type StoredStoryQuestState = {
  activeQuestId?: string;
  completedQuestIds?: string[];
  baselines?: Record<string, StoryQuestBaseline>;
};
type QuestCompleteCue = {
  id: number;
  title: string;
};
type ScreenWakeLockSentinelLike = EventTarget & {
  released: boolean;
  release: () => Promise<void>;
};
type ScreenWakeLockNavigator = Navigator & {
  wakeLock?: {
    request: (type: "screen") => Promise<ScreenWakeLockSentinelLike>;
  };
};
type BeforeInstallPromptEvent = Event & {
  platforms?: string[];
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt: () => Promise<void>;
};
type StandaloneNavigator = Navigator & {
  standalone?: boolean;
};

const launcherStorageKey = "mmo.launcher.v1";
const accountStorageKey = "mmo.account.v1";
const hotbarStorageKey = "mmo.hotbar.v1";
const mobileAutoTargetStorageKey = "mmo.mobileAutoTarget.v1";
const pathChallengesStorageKey = "mmo.pathChallenges.v1";
const storyQuestStorageKey = "mmo.storyQuests.v2";
const betaNoticeStorageKey = "mmo.betaNotice.2026-05";
const legacyCharacterIdStorageKey = "mmo.characterId";
const pwaInstallSnoozeStorageKey = "mmo.pwaInstall.snoozeUntil.v1";
const voiceEnabledStorageKey = "mmo.voice.enabled.v1";
const voiceChannelStorageKey = "mmo.voice.channel.v1";
const pvpFlagUiFadeMs = 8_000;
const groundItemPickupUiRange = 120;
const questCompleteSparkIndexes = Array.from({ length: 16 }, (_, index) => index);
const hairOptions = ["Crop", "Wave", "Topknot", "Long", "Hawk", "Braids"];
const eyeOptions = ["Dark", "Green", "Gold", "Ice"];
const markOptions = ["Clean", "Scar", "Tattoo", "Warpaint"];
const femaleMarkOptions = ["Clean", "Scar", "Rune", "Makeup"];
const raceOptions: Array<{ id: CharacterRace; label: string }> = [
  { id: "human", label: "Human" },
  { id: "elf", label: "Elf" },
  { id: "darkelf", label: "Dark Elf" },
  { id: "orc", label: "Orc" }
];
const genderOptions: Array<{ id: CharacterGender; label: string }> = [
  { id: "male", label: "Male" },
  { id: "female", label: "Female" }
];
const playableClassIds: CharacterClass[] = ["mage", "warrior", "assassin", "archer"];
const playableClassDefinitions = playableClassIds.map((id) => CLASS_DEFINITIONS[id]);
const defaultInventory: InventoryItem[] = [];
const defaultEquipment: EquipmentState = {};
const defaultStats: DerivedStats = { hp: 0, cp: 0, mp: 0, attack: 0, magic: 0, defense: 0, speed: 0, str: 0, dex: 0, crit: 0, attackSpeed: 0, castSpeed: 0 };
const runtimeUrl = (configuredUrl: string | undefined, fallbackUrl: string) => (configuredUrl?.trim() || fallbackUrl).replace(/\/+$/, "");
let questCompleteAudioContext: AudioContext | undefined;

function playQuestCompleteSound(): void {
  if (typeof window === "undefined" || document.hidden) {
    return;
  }

  try {
    if (questCompleteAudioContext?.state === "closed") {
      questCompleteAudioContext = undefined;
    }
    const audioContextCtor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!questCompleteAudioContext && audioContextCtor) {
      questCompleteAudioContext = new audioContextCtor();
    }

    const context = questCompleteAudioContext;
    if (!context || context.state === "closed") {
      return;
    }

    if (context.state !== "running") {
      void context.resume();
    }

    const start = context.currentTime + 0.012;
    const master = context.createGain();
    const compressor = context.createDynamicsCompressor();
    master.gain.setValueAtTime(0.0001, start);
    master.gain.exponentialRampToValueAtTime(0.2, start + 0.045);
    master.gain.exponentialRampToValueAtTime(0.0001, start + 1.15);
    compressor.threshold.setValueAtTime(-18, start);
    compressor.knee.setValueAtTime(18, start);
    compressor.ratio.setValueAtTime(5, start);
    compressor.attack.setValueAtTime(0.004, start);
    compressor.release.setValueAtTime(0.14, start);
    master.connect(compressor);
    compressor.connect(context.destination);

    const notes = [
      { frequency: 196, endFrequency: 174, delay: 0, duration: 0.3, volume: 0.34, type: "sine" as OscillatorType },
      { frequency: 293.66, endFrequency: 261.63, delay: 0.1, duration: 0.36, volume: 0.42, type: "sine" as OscillatorType },
      { frequency: 392, endFrequency: 329.63, delay: 0.24, duration: 0.46, volume: 0.34, type: "triangle" as OscillatorType }
    ];

    notes.forEach((note) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const noteStart = start + note.delay;
      oscillator.type = note.type;
      oscillator.frequency.setValueAtTime(note.frequency, noteStart);
      oscillator.frequency.exponentialRampToValueAtTime(note.endFrequency, noteStart + note.duration);
      gain.gain.setValueAtTime(0.0001, noteStart);
      gain.gain.exponentialRampToValueAtTime(note.volume, noteStart + 0.035);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + note.duration);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
      oscillator.start(noteStart);
      oscillator.stop(noteStart + note.duration + 0.035);
    });

    const bufferLength = Math.max(1, Math.floor(context.sampleRate * 0.26));
    const buffer = context.createBuffer(1, bufferLength, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < bufferLength; index += 1) {
      const envelope = 1 - index / bufferLength;
      data[index] = (Math.random() * 2 - 1) * envelope * envelope;
    }
    const sparkle = context.createBufferSource();
    const sparkleFilter = context.createBiquadFilter();
    const sparkleGain = context.createGain();
    sparkle.buffer = buffer;
    sparkleFilter.type = "bandpass";
    sparkleFilter.frequency.setValueAtTime(1_600, start);
    sparkleFilter.frequency.exponentialRampToValueAtTime(520, start + 0.42);
    sparkleFilter.Q.setValueAtTime(0.8, start);
    sparkleGain.gain.setValueAtTime(0.0001, start + 0.06);
    sparkleGain.gain.exponentialRampToValueAtTime(0.16, start + 0.1);
    sparkleGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.42);
    sparkle.connect(sparkleFilter);
    sparkleFilter.connect(sparkleGain);
    sparkleGain.connect(master);
    sparkle.onended = () => {
      sparkle.disconnect();
      sparkleFilter.disconnect();
      sparkleGain.disconnect();
    };
    sparkle.start(start + 0.055);
    sparkle.stop(start + 0.44);

    window.setTimeout(() => {
      master.disconnect();
      compressor.disconnect();
    }, 1300);
  } catch {
    questCompleteAudioContext = undefined;
  }
}
const equipmentSlotLabels: Record<EquipmentSlot, string> = {
  weapon: "Weapon",
  shield: "Shield",
  helmet: "Helmet",
  chest: "Armor",
  gloves: "Gloves",
  boots: "Boots",
  necklace: "Neck",
  earringLeft: "Earring",
  earringRight: "Earring",
  ringLeft: "Ring",
  ringRight: "Ring",
  glasses: "Glasses",
  mask: "Mask",
  headAccessory: "Head"
};
const equipmentSlots: Array<{ slot: EquipmentSlot; label: string }> = [
  { slot: "helmet", label: equipmentSlotLabels.helmet },
  { slot: "necklace", label: equipmentSlotLabels.necklace },
  { slot: "earringLeft", label: equipmentSlotLabels.earringLeft },
  { slot: "earringRight", label: equipmentSlotLabels.earringRight },
  { slot: "weapon", label: equipmentSlotLabels.weapon },
  { slot: "chest", label: equipmentSlotLabels.chest },
  { slot: "shield", label: equipmentSlotLabels.shield },
  { slot: "gloves", label: equipmentSlotLabels.gloves },
  { slot: "ringLeft", label: equipmentSlotLabels.ringLeft },
  { slot: "ringRight", label: equipmentSlotLabels.ringRight },
  { slot: "boots", label: equipmentSlotLabels.boots }
];
const armorEnchantSlots = new Set<EquipmentSlot>(["shield", "helmet", "chest", "gloves", "boots", "necklace", "earringLeft", "earringRight", "ringLeft", "ringRight"]);
const paperdollAreas: Record<EquipmentSlot, string> = {
  headAccessory: "headAccessory",
  glasses: "glasses",
  mask: "mask",
  helmet: "helmet",
  necklace: "necklace",
  earringLeft: "earringLeft",
  earringRight: "earringRight",
  weapon: "weapon",
  chest: "chest",
  shield: "shield",
  gloves: "gloves",
  ringLeft: "ringLeft",
  ringRight: "ringRight",
  boots: "boots"
};

function pairedEquipmentSlots(slot?: EquipmentSlot): [EquipmentSlot, EquipmentSlot] | undefined {
  if (slot === "ringLeft" || slot === "ringRight") {
    return ["ringLeft", "ringRight"];
  }
  if (slot === "earringLeft" || slot === "earringRight") {
    return ["earringLeft", "earringRight"];
  }
  return undefined;
}

function preferredEquipSlot(item: InventoryItem | undefined, equipment: EquipmentState): EquipmentSlot | undefined {
  if (!item?.slot) {
    return undefined;
  }

  const pairedSlots = pairedEquipmentSlots(item.slot);
  if (!pairedSlots) {
    return item.slot;
  }

  const emptySlot = pairedSlots.find((slot) => !equipment[slot]);
  return emptySlot ?? item.slot;
}

function itemEnchantCap(item?: InventoryItem): number {
  if (item?.slot === "weapon") {
    return MAX_WEAPON_ENCHANT_LEVEL;
  }
  if (armorEnchantSlots.has(item?.slot as EquipmentSlot)) {
    return MAX_ARMOR_ENCHANT_LEVEL;
  }
  return 0;
}

function enchantScrollIdsForItem(item?: InventoryItem): string[] {
  if (!item || itemEnchantCap(item) <= 0) {
    return [];
  }

  const kind = item.slot === "weapon" ? "weapon" : "armor";
  return enchantScrollIdsForGrade(kind, item.grade);
}
const profileTabs: Array<{ id: ProfileTab; label: string; icon: typeof Backpack }> = [
  { id: "equipment", label: "Gear", icon: Backpack },
  { id: "stats", label: "Stats", icon: Shield },
  { id: "wallet", label: "Premium & Coin", icon: Crown },
  { id: "skills", label: "Skills", icon: BookOpen },
  { id: "quests", label: "Quests", icon: Target },
  { id: "clan", label: "Clan", icon: Shield },
  { id: "map", label: "Map", icon: MapIcon },
  { id: "arena", label: "Arena", icon: Crown },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "admin", label: "Admin", icon: ShieldAlert }
];
const defaultSkillVisual: SkillVisual = { Icon: Zap, className: "skillElementArcane", shortLabel: "Sk" };
const basicAttackVisual: SkillVisual = { Icon: Swords, className: "skillElementBasic", shortLabel: "Atk" };
const sprintVisual: SkillVisual = { Icon: Footprints, className: "skillElementRush", shortLabel: "Run" };
const skillVisuals: Record<string, SkillVisual> = {
  cleave: { Icon: Swords, className: "skillElementSteel", shortLabel: "Cl" },
  whirlwind: { Icon: Wind, className: "skillElementGale", shortLabel: "Wh" },
  "rush-break": { Icon: Footprints, className: "skillElementRush", shortLabel: "Ru" },
  "earth-splitter": { Icon: Axe, className: "skillElementEarth", shortLabel: "Ea" },
  "shadow-step": { Icon: Footprints, className: "skillElementShadow", shortLabel: "Sh" },
  "twin-cut": { Icon: Swords, className: "skillElementCrimson", shortLabel: "Tw" },
  "venom-fang": { Icon: Droplets, className: "skillElementVenom", shortLabel: "Ve" },
  "smoke-dance": { Icon: Wind, className: "skillElementSmoke", shortLabel: "Sm" },
  "frost-bolt": { Icon: Snowflake, className: "skillElementFrost", shortLabel: "Fr" },
  "fire-nova": { Icon: Flame, className: "skillElementFire", shortLabel: "Fi" },
  "arc-lightning": { Icon: CloudLightning, className: "skillElementStorm", shortLabel: "Ar" },
  meteor: { Icon: Bomb, className: "skillElementMeteor", shortLabel: "Me" },
  "healing-light": { Icon: HeartPulse, className: "skillElementHeal", shortLabel: "He" },
  "piercing-shot": { Icon: ArrowUpRight, className: "skillElementArrow", shortLabel: "Pi" },
  volley: { Icon: Crosshair, className: "skillElementVolley", shortLabel: "Vo" },
  "pinning-shot": { Icon: Target, className: "skillElementPin", shortLabel: "Pn" },
  "rain-of-arrows": { Icon: Sparkles, className: "skillElementRain", shortLabel: "Ra" },
  "shield-bash": { Icon: Shield, className: "skillElementGuard", shortLabel: "Sh" },
  "ground-slam": { Icon: Hand, className: "skillElementEarth", shortLabel: "Gr" },
  "guard-break": { Icon: ShieldAlert, className: "skillElementBreak", shortLabel: "Gb" },
  "iron-roar": { Icon: Crown, className: "skillElementRoar", shortLabel: "Ir" }
};
const skillAtlasCells: Record<string, readonly [column: number, row: number]> = {
  cleave: [0, 0],
  whirlwind: [1, 0],
  "rush-break": [2, 0],
  "earth-splitter": [3, 0],
  "shadow-step": [0, 1],
  "twin-cut": [1, 1],
  "venom-fang": [2, 1],
  "smoke-dance": [3, 1],
  "frost-bolt": [0, 2],
  "fire-nova": [1, 2],
  "arc-lightning": [2, 2],
  meteor: [3, 2],
  "healing-light": [4, 2],
  "piercing-shot": [0, 3],
  volley: [1, 3],
  "pinning-shot": [2, 3],
  "rain-of-arrows": [3, 3],
  "shield-bash": [0, 4],
  "ground-slam": [1, 4],
  "guard-break": [2, 4],
  "iron-roar": [3, 4]
};

function SkillArt({ skillId, className = "" }: { skillId: string; className?: string }) {
  const cell = skillAtlasCells[skillId];
  if (!cell) {
    return null;
  }
  // The painted circles in the source atlas lean a few pixels toward the atlas
  // centre. Compensate by column so every icon is optically centred in its own slot.
  const horizontalNudge = (cell[0] - 2) * 1.5;
  return (
    <i
      aria-hidden="true"
      className={`skillAtlasIcon ${className}`.trim()}
      style={
        {
          "--skill-art-x": `${cell[0] * 25}%`,
          "--skill-art-y": `${cell[1] * 25}%`,
          "--skill-art-nudge-x": `${horizontalNudge}px`,
          // Keep the painted circle clear of the slot's bottom edge. Moving the
          // atlas upward also prevents the previous row leaking in at the top.
          "--skill-art-nudge-y": "-3px"
        } as CSSProperties
      }
    />
  );
}

const basicAttackAtlasColumns: Record<CharacterClass, number> = {
  warrior: 0,
  tank: 1,
  assassin: 2,
  archer: 3,
  mage: 4
};

function BasicAttackArt({ classId, className = "" }: { classId: CharacterClass; className?: string }) {
  return (
    <i
      aria-hidden="true"
      className={`basicAttackAtlasIcon ${className}`.trim()}
      style={{ "--basic-attack-art-x": `${basicAttackAtlasColumns[classId] * 25}%` } as CSSProperties}
    />
  );
}
const MAP_ZOOM_MIN = 1;
const MAP_ZOOM_MAX = 120;
const DEFAULT_MAP_ZOOM = 5;
const RADAR_MAP_OPEN_ZOOM = 5;
const MINI_RADAR_RANGE = 4200;
const MINI_RADAR_PLAYER_RANGE = 1500;
const MINI_RADAR_MAX_PLAYERS = 12;
const MINI_RADAR_EDGE_PERCENT = 44;
const WORLD_MAP_HEAVY_DETAILS = false;
const clanEmblems: Array<{ id: ClanEmblem; label: string; mark: string }> = [
  { id: "crown", label: "Crown", mark: "CR" },
  { id: "sword", label: "Sword", mark: "SW" },
  { id: "shield", label: "Shield", mark: "SH" },
  { id: "star", label: "Star", mark: "ST" },
  { id: "moon", label: "Moon", mark: "MO" },
  { id: "flame", label: "Flame", mark: "FL" }
];
const clanEmblemMark = (emblem?: ClanEmblem): string => clanEmblems.find((item) => item.id === emblem)?.mark ?? "CL";
const clampMapZoom = (value: number): number => {
  const clamped = Math.min(MAP_ZOOM_MAX, Math.max(MAP_ZOOM_MIN, value));
  if (clamped >= 10) {
    return Math.round(clamped);
  }
  if (clamped >= 2) {
    return Number(clamped.toFixed(1));
  }
  return Number(clamped.toFixed(2));
};
const zoomMapIn = (value: number): number => clampMapZoom(value < 2.8 ? value + 0.15 : value < 18 ? value * 1.18 : value * 1.12);
const zoomMapOut = (value: number): number => clampMapZoom(value <= 2.8 ? value - 0.15 : value < 18 ? value / 1.18 : value / 1.12);
const formatMapZoom = (value: number): string => (value >= 10 ? `${Math.round(value)}x` : `${value.toFixed(1)}x`);
const formatStatValue = (value: number | undefined): string => {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) {
    return "0";
  }
  const rounded = Math.abs(numeric) >= 100 ? Math.round(numeric) : Number(numeric.toFixed(2));
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/\.?0+$/, "");
};
const mapBiomes = WORLD_MAP_REGIONS.map((region) => ({
  id: region.id,
  kind: region.kind,
  className: `mapBiome ${region.kind}Biome`,
  x: region.position.x,
  y: region.position.y,
  width: region.width,
  height: region.height,
  path: ""
}));
const starterArena = { x: WORLD_STARTER_ARENA.center.x, y: WORLD_STARTER_ARENA.center.y, radius: WORLD_STARTER_ARENA.radius, label: WORLD_STARTER_ARENA.label };
const mapArenaGates = WORLD_STARTER_ARENA_GATES.map((gate) => ({
  id: gate.id,
  label: gate.label.replace(" Gate", ""),
  angle: gate.angle,
  x: Math.round(WORLD_STARTER_ARENA.center.x + Math.cos(gate.angle) * WORLD_STARTER_ARENA_WALL_RADIUS),
  y: Math.round(WORLD_STARTER_ARENA.center.y + Math.sin(gate.angle) * WORLD_STARTER_ARENA_WALL_RADIUS)
}));
const mapArenaSectors = Array.from({ length: 8 }, (_, index) => {
  const angle = (index / 8) * Math.PI * 2;
  return {
    id: `arena-sector-${index}`,
    innerX: Math.round(Math.cos(angle) * WORLD_STARTER_ARENA.innerRadius * 0.36),
    innerY: Math.round(Math.sin(angle) * WORLD_STARTER_ARENA.innerRadius * 0.36),
    outerX: Math.round(Math.cos(angle) * WORLD_STARTER_ARENA.radius * 0.92),
    outerY: Math.round(Math.sin(angle) * WORLD_STARTER_ARENA.radius * 0.92)
  };
});
const mapHuntingGrounds = WORLD_HUNTING_GROUNDS.map((ground, index) => ({
  id: ground.id,
  label: ground.label,
  level: ground.level,
  tier: ground.level >= 70 ? "endgame" : ground.level >= 45 ? "high" : ground.level >= 20 ? "mid" : "early",
  x: ground.position.x,
  y: ground.position.y,
  radius: ground.radius,
  seed: index + ground.level * 13,
  path: ""
}));
const mapRoads = WORLD_ROADS.map((road) => ({ id: road.id, width: road.width, points: [...road.points], path: "" }));
const mapRivers = WORLD_RIVERS.map((river) => ({ id: river.id, width: river.width ?? 82, points: [...river.points], path: "" }));
const mapLakes = WORLD_LAKES.map((lake) => ({ id: lake.id, x: lake.position.x, y: lake.position.y, width: lake.width, height: lake.height, path: "" }));
const mapWaterfalls = WORLD_WATERFALLS.map((fall) => ({ id: fall.id, x: fall.position.x, y: fall.position.y, width: fall.width, height: fall.height, rotation: fall.rotation }));
const mapMountains = WORLD_MAP_HEAVY_DETAILS
  ? WORLD_MOUNTAINS.filter((mountain) => mountain.position.x > 2500).map((mountain) => ({
      id: mountain.id,
      x: mountain.position.x,
      y: mountain.position.y,
      size: mountain.size
    }))
  : [];
const mapObstacles = WORLD_OBSTACLES.filter((obstacle) => obstacle.kind !== "arenaWall").map((obstacle) => ({
  id: obstacle.id,
  kind: obstacle.kind,
  x: obstacle.position.x,
  y: obstacle.position.y,
  radiusX: obstacle.radiusX,
  radiusY: obstacle.radiusY,
  rotation: obstacle.rotation ?? 0
}));
const mapHazards = WORLD_HAZARDS.map((hazard) => ({
  id: hazard.id,
  kind: hazard.kind,
  x: hazard.position.x,
  y: hazard.position.y,
  width: hazard.width,
  height: hazard.height,
  rotation: hazard.rotation ?? 0
}));
const mapRegionLabels = WORLD_MAP_LABELS;
const teleportKindLabel: Record<string, string> = {
  arena: "Arena",
  boss: "Boss zone",
  cave: "Cave",
  dungeon: "Dungeon",
  capital: "Capital",
  fortress: "Fortress",
  harbor: "Harbor",
  outpost: "Outpost",
  sanctum: "Sanctum",
  village: "Village",
  town: "Town"
};
const teleportKindPriority: Record<string, number> = {
  capital: 0,
  village: 0,
  harbor: 0,
  fortress: 0,
  outpost: 0,
  sanctum: 0,
  town: 0,
  arena: 1,
  dungeon: 1,
  cave: 1,
  boss: 1
};
const hourlyChallengePool: ChallengeDefinition[] = [
  { id: "hour-xp", period: "hourly", label: "Earn 350 XP", hint: "Farm mobs near your level", metric: "xp", goal: 350 },
  { id: "hour-gold", period: "hourly", label: "Earn 450 gold", hint: "Kill mobs, sell loot or open chests", metric: "gold", goal: 450 },
  { id: "hour-coin", period: "hourly", label: "Collect 2 Coin", hint: "Arena PvP, bosses and rare drops", metric: "coin", goal: 2 },
  { id: "hour-arena", period: "hourly", label: "Win 1 arena PvP", hint: "Teleport to Blood Ring Arena", metric: "arenaWins", goal: 1 },
  { id: "hour-gear", period: "hourly", label: "Improve gear power", hint: "Buy, equip or enchant gear", metric: "gear", goal: 70 }
];
const dailyChallengePool: ChallengeDefinition[] = [
  { id: "day-xp", period: "daily", label: "Earn 2200 XP", hint: "Push one hunting ground deeper", metric: "xp", goal: 2200 },
  { id: "day-gold", period: "daily", label: "Earn 1800 gold", hint: "Farm mobs, chests and sell stacks", metric: "gold", goal: 1800 },
  { id: "day-coin", period: "daily", label: "Collect 8 Coin", hint: "Arena PvP pays the fastest", metric: "coin", goal: 8 },
  { id: "day-arena", period: "daily", label: "Win 3 arena PvP", hint: "Blood Ring wins raise your rating", metric: "arenaWins", goal: 3 },
  { id: "day-level", period: "daily", label: "Gain 1 level", hint: "Keep farming until the level pops", metric: "level", goal: 1 },
  { id: "day-gear", period: "daily", label: "Upgrade gear power", hint: "New grade or enchant counts", metric: "gear", goal: 160 }
];
const monsterQuestLabels: Record<MonsterArchetype, string> = {
  wolf: "wolves",
  boar: "boars",
  spider: "spiders",
  bat: "bats",
  skeleton: "skeletons",
  bandit: "bandits",
  golem: "golems",
  wraith: "wraiths",
  drake: "drakes",
  eye: "rift eyes",
  witch: "witches",
  mage: "mages",
  archer: "archers",
  dragon: "dragons",
  sentinel: "sentinels",
  venomplant: "venom plants",
  bonewarrior: "bone warriors",
  firespirit: "fire spirits",
  miniboss: "minibosses",
  dungeonboss: "dungeon bosses",
  boss: "bosses"
};
const questTargetFromGround = (groundId: string, hint?: string): StoryQuestTarget => {
  const ground = WORLD_HUNTING_GROUNDS.find((candidate) => candidate.id === groundId) ?? WORLD_HUNTING_GROUNDS[0];
  const monsterList = ground.archetypes.map((archetype) => monsterQuestLabels[archetype]).join(", ");
  return {
    label: ground.label,
    position: ground.position,
    radius: ground.radius + 180,
    hint: hint ?? `Hunt ${monsterList} around ${ground.label}.`
  };
};
const arenaQuestTarget: StoryQuestTarget = {
  label: WORLD_STARTER_ARENA.label,
  position: WORLD_STARTER_ARENA.center,
  radius: WORLD_STARTER_ARENA.radius,
  hint: "Teleport to the Blood Ring Arena and fight inside the ring."
};
const storyQuestChain: StoryQuestDefinition[] = [
  {
    id: "wolfpine-first-blood",
    chapter: "Chapter 1",
    title: "Wolfpine First Blood",
    summary: "Clear the first road out of Elderglen and learn the basic hunting loop.",
    objective: { kind: "monster", archetype: "wolf", goal: 8, label: "Kill 8 wolves" },
    target: questTargetFromGround("wolfpine-1", "Wolves roam north-east of Elderglen, around Wolfpine Edge."),
    rewardHint: "Reward: gold and HP potions."
  },
  {
    id: "suntrail-supplies",
    chapter: "Chapter 1",
    title: "Suntrail Supplies",
    summary: "The camp south-east of the road needs supplies and a safer path.",
    objective: { kind: "monster", archetype: "boar", goal: 6, label: "Kill 6 boars" },
    target: questTargetFromGround("suntrail-camp", "Hunt around Suntrail Camp and pick up the dropped gold."),
    rewardHint: "Reward: gold and a No Grade weapon enchant scroll."
  },
  {
    id: "wayfarer-brute",
    chapter: "Chapter 1",
    title: "Wayfarer Brute",
    summary: "The first named threat guards the stone road toward Sunspire.",
    objective: { kind: "monster", archetype: "miniboss", goal: 1, label: "Kill 1 miniboss" },
    target: questTargetFromGround("wayfarer-stones", "Find Wayfarer Stones and kill the brute guarding the ruins."),
    rewardHint: "Reward: rare class weapon, scroll and Coin."
  },
  {
    id: "oldmill-brook-bandits",
    chapter: "Chapter 2",
    title: "Old Mill Trouble",
    summary: "Bandits and beasts are blocking the brook path toward Bonefall.",
    objective: { kind: "monster", archetype: "bandit", goal: 10, label: "Kill 10 bandits" },
    target: questTargetFromGround("oldmill-brook"),
    rewardHint: "Reward: gold, potions and an armor enchant scroll."
  },
  {
    id: "bonefall-skeletons",
    chapter: "Chapter 2",
    title: "Bonefall Cemetery",
    summary: "Push through the graveyard and start collecting stronger upgrade materials.",
    objective: { kind: "monster", archetype: "skeleton", goal: 12, label: "Kill 12 skeletons" },
    target: questTargetFromGround("bonefall"),
    rewardHint: "Reward: gold, Coin and a weapon enchant scroll."
  },
  {
    id: "reach-level-8",
    chapter: "Chapter 2",
    title: "Gear Check",
    summary: "Farm, equip drops and enchant your weapon until the next road is realistic.",
    objective: { kind: "level", goal: 8, label: "Reach level 8" },
    target: questTargetFromGround("sunspire", "Stay near Sunspire or Bonefall until level 8, then claim the gear reward."),
    rewardHint: "Reward: rare class chest armor and gold."
  },
  {
    id: "sunspire-spiders",
    chapter: "Chapter 4",
    title: "Sunspire Stingers",
    summary: "The desert road is the first longer trip with real danger between camps.",
    objective: { kind: "monster", archetype: "spider", goal: 18, label: "Kill 18 spiders" },
    target: questTargetFromGround("sunspire"),
    rewardHint: "Reward: gold and a D-grade weapon enchant scroll."
  },
  {
    id: "riverbend-stalker",
    chapter: "Chapter 4",
    title: "Riverbend Stalker",
    summary: "A stronger named enemy patrols the green gap beyond Riverbend.",
    objective: { kind: "monster", archetype: "miniboss", goal: 2, label: "Kill 2 minibosses total" },
    target: questTargetFromGround("riverbend-copse", "Hunt the Riverbend Stalker near Riverbend Watch."),
    rewardHint: "Reward: Coin and a D-grade armor enchant scroll."
  },
  {
    id: "blood-ring-first-win",
    chapter: "Chapter 5",
    title: "Blood Ring First Win",
    summary: "Step into the arena once the first PvE route is comfortable.",
    objective: { kind: "arenaWins", goal: 1, label: "Win 1 arena fight" },
    target: arenaQuestTarget,
    rewardHint: "Reward: PvP Coin and gold."
  },
  {
    id: "moonfen-wraiths",
    chapter: "Chapter 5",
    title: "Moonfen Shadows",
    summary: "Wraiths mark the first long travel step across the marsh route.",
    objective: { kind: "monster", archetype: "wraith", goal: 18, label: "Kill 18 wraiths" },
    target: questTargetFromGround("moonfen"),
    rewardHint: "Reward: epic class weapon. Starter story chain complete."
  }
];
const teleportDestinationMeta = (teleport: (typeof TELEPORT_DEFINITIONS)[number]) => {
  if ("destinationCityId" in teleport) {
    const city = CITY_DEFINITIONS.find((candidate) => candidate.id === teleport.destinationCityId) ?? CITY_DEFINITIONS[0];
    const kind = city.kind ?? "town";
    const tradeZone = city.id === "market";
    return {
      label: city.label,
      level: city.recommendedLevel,
      kind,
      kindClass: tradeZone ? "trade" : "city",
      kindLabel: tradeZone ? "Trade Zone" : teleportKindLabel[kind] ?? "Town",
      priority: tradeZone ? -1 : teleportKindPriority[kind] ?? 3
    };
  }

  const landmark = "destinationLandmarkId" in teleport ? WORLD_LANDMARKS.find((candidate) => candidate.id === teleport.destinationLandmarkId) : undefined;
  const kind = ("destinationKind" in teleport ? teleport.destinationKind : landmark?.kind) ?? "town";
  return {
    label: landmark?.label ?? teleport.label,
    level: landmark?.recommendedLevel ?? teleport.requiredLevel ?? 1,
    kind,
    kindClass: kind,
    kindLabel: teleportKindLabel[kind] ?? kind,
    priority: teleportKindPriority[kind] ?? 4
  };
};

type LocationBanner = {
  key: string;
  label: string;
  subtitle: string;
};

const locationDistance = (first: { x: number; y: number }, second: { x: number; y: number }): number => Math.hypot(first.x - second.x, first.y - second.y);

const inMapEllipse = (position: { x: number; y: number }, center: { x: number; y: number }, width: number, height: number): boolean => {
  const dx = (position.x - center.x) / Math.max(1, width / 2);
  const dy = (position.y - center.y) / Math.max(1, height / 2);
  return dx * dx + dy * dy <= 1;
};

const locationBannerForPosition = (position?: { x: number; y: number }): LocationBanner | undefined => {
  if (!position) {
    return undefined;
  }

  const dungeon = WORLD_DUNGEON_INTERIORS.find((candidate) =>
    inMapEllipse(position, candidate.position, candidate.width * 1.12, candidate.height * 1.12)
  );
  if (dungeon) {
    return { key: `dungeon:${dungeon.id}`, label: dungeon.label, subtitle: `Lv.${dungeon.recommendedLevel}+ dungeon` };
  }

  if (locationDistance(position, WORLD_STARTER_ARENA.center) <= WORLD_STARTER_ARENA.radius + 140) {
    return { key: WORLD_STARTER_ARENA.id, label: WORLD_STARTER_ARENA.label, subtitle: "Arena PvP" };
  }

  const city = CITY_DEFINITIONS.find((candidate) => locationDistance(position, candidate.position) <= candidate.safeRadius + 120);
  if (city) {
    const kind = city.kind ?? "town";
    return { key: `city:${city.id}`, label: city.label, subtitle: teleportKindLabel[kind] ?? "Safe zone" };
  }

  const landmark = WORLD_LANDMARKS.find((candidate) => locationDistance(position, candidate.position) <= candidate.radius + 180);
  if (landmark) {
    return { key: `landmark:${landmark.id}`, label: landmark.label, subtitle: teleportKindLabel[landmark.kind] ?? "Landmark" };
  }

  const huntingGround = WORLD_HUNTING_GROUNDS.find((ground) => locationDistance(position, ground.position) <= ground.radius + 180);
  if (huntingGround) {
    return { key: `hunt:${huntingGround.id}`, label: huntingGround.label, subtitle: `Lv.${huntingGround.level}+ hunting ground` };
  }

  const region = WORLD_MAP_REGIONS.find((candidate) => inMapEllipse(position, candidate.position, candidate.width, candidate.height));
  if (region) {
    const label = WORLD_MAP_LABELS.find((candidate) => locationDistance(position, { x: candidate.x, y: candidate.y }) <= Math.max(region.width, region.height) * 0.52)?.label;
    return { key: `region:${region.id}`, label: label ?? region.id.replace(/-/g, " "), subtitle: `${region.kind} lands` };
  }

  return { key: "wilds", label: "Open Wilds", subtitle: "Wilderness" };
};
const serverClockFormatters: Record<AppLanguage, Intl.DateTimeFormat> = {
  ru: new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Moscow"
  }),
  en: new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Moscow"
  })
};
const formatServerClock = (serverTime: number, language: AppLanguage): string => serverClockFormatters[language].format(new Date(serverTime));
const itemSellValue = (item?: InventoryItem): number => {
  if (!item) {
    return 0;
  }

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
};
const itemSellTotal = (item?: InventoryItem): number => (item ? itemSellValue(item) * Math.max(1, item.stackable ? item.quantity : 1) : 0);
const westMapCoastPath = `M 520 0 C 640 900 560 1900 760 3000 C 950 4300 620 5600 780 7200 C 920 9300 520 11200 700 13600 C 940 16900 620 19800 780 22400 C 960 25500 650 28500 820 ${WORLD_BOUNDS.height}`;
const westMapSeaPath = `${westMapCoastPath.replace("M 520 0", "M 0 0 H 520")} H 0 Z`;
const westMapShallowSeaPath = `${westMapCoastPath} L 250 ${WORLD_BOUNDS.height} C 90 28500 420 25500 250 22400 C 90 19800 410 16900 180 13600 C 10 11200 410 9300 260 7200 C 120 5600 450 4300 280 3000 C 110 1900 220 900 120 0 Z`;
const westMapBeachPath = `${westMapCoastPath} L 1400 ${WORLD_BOUNDS.height} C 1230 28500 1530 25500 1360 22400 C 1190 19800 1530 16900 1250 13600 C 1070 11200 1450 9300 1320 7200 C 1190 5600 1500 4300 1320 3000 C 1120 1900 1200 900 1080 0 Z`;
const southMapCoastPath = `M 0 29750 C 7800 29100 15200 29600 22900 28600 C 31300 27520 38700 28480 ${WORLD_BOUNDS.width} 27650`;
const southMapSeaPath = `${southMapCoastPath} V ${WORLD_BOUNDS.height} H 0 Z`;
const southMapShallowSeaPath = `${southMapCoastPath} L ${WORLD_BOUNDS.width} ${WORLD_BOUNDS.height} H 0 Z`;
const southMapBeachPath = `${southMapCoastPath} L ${WORLD_BOUNDS.width} 27070 C 38680 27900 31340 26930 22940 28060 C 15260 29080 7840 28580 0 29180 Z`;

function mapShapeNoise(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function mapOrganicBlobPath(cx: number, cy: number, width: number, height: number, seed: number): string {
  const rx = width / 2;
  const ry = height / 2;
  const steps = 10;
  const rotation = ((seed % 7) - 3) * 0.12;
  const points = Array.from({ length: steps }, (_, index) => {
    const angle = (index / steps) * Math.PI * 2 + rotation;
    const wobble = 0.88 + mapShapeNoise(seed * 43 + index * 17) * 0.24;
    const driftX = Math.sin(angle * 2.1 + seed) * rx * 0.05;
    const driftY = Math.cos(angle * 1.7 + seed) * ry * 0.06;
    return {
      x: Math.round(cx + Math.cos(angle) * rx * wobble + driftX),
      y: Math.round(cy + Math.sin(angle) * ry * wobble + driftY)
    };
  });
  const commands = [`M ${points[0].x} ${points[0].y}`];
  for (let index = 0; index < points.length; index += 1) {
    const previous = points[(index - 1 + points.length) % points.length];
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const after = points[(index + 2) % points.length];
    const controlA = {
      x: Math.round(current.x + (next.x - previous.x) / 6),
      y: Math.round(current.y + (next.y - previous.y) / 6)
    };
    const controlB = {
      x: Math.round(next.x - (after.x - current.x) / 6),
      y: Math.round(next.y - (after.y - current.y) / 6)
    };
    commands.push(`C ${controlA.x} ${controlA.y} ${controlB.x} ${controlB.y} ${next.x} ${next.y}`);
  }
  commands.push("Z");
  return commands.join(" ");
}

function mapRoutePath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) {
    return "";
  }
  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }

  const commands = [`M ${points[0].x} ${points[0].y}`];
  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[Math.max(0, index - 1)];
    const current = points[index];
    const next = points[index + 1];
    const after = points[Math.min(points.length - 1, index + 2)];
    const controlA = {
      x: current.x + (next.x - previous.x) / 6,
      y: current.y + (next.y - previous.y) / 6
    };
    const controlB = {
      x: next.x - (after.x - current.x) / 6,
      y: next.y - (after.y - current.y) / 6
    };
    commands.push(`C ${controlA.x} ${controlA.y} ${controlB.x} ${controlB.y} ${next.x} ${next.y}`);
  }
  return commands.join(" ");
}

function createPixelPathTiles(points: Array<{ x: number; y: number }>, prefix: string, step: number, size: number) {
  const grid = 320;
  const tiles = new Map<string, { id: string; x: number; y: number; size: number }>();
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);
    const count = Math.max(1, Math.ceil(length / step));
    for (let sample = 0; sample <= count; sample += 1) {
      const t = sample / count;
      const x = Math.round((start.x + dx * t) / grid) * grid;
      const y = Math.round((start.y + dy * t) / grid) * grid;
      const id = `${prefix}-${x}-${y}`;
      tiles.set(id, { id, x, y, size });
    }
  }
  return [...tiles.values()];
}

mapBiomes.forEach((biome, index) => {
  biome.path = mapOrganicBlobPath(biome.x, biome.y, biome.width, biome.height, index + 11);
});
mapHuntingGrounds.forEach((ground) => {
  ground.path = mapOrganicBlobPath(ground.x, ground.y, ground.radius * 1.45, ground.radius * 0.92, ground.seed);
});
mapRivers.forEach((river) => {
  river.path = mapRoutePath(river.points);
});
mapRoads.forEach((road) => {
  road.path = mapRoutePath(road.points);
});
mapLakes.forEach((lake) => {
  lake.path = mapOrganicBlobPath(lake.x, lake.y, lake.width, lake.height, lake.width + lake.height);
});

const mapRiverTiles = WORLD_MAP_HEAVY_DETAILS ? mapRivers.flatMap((river) => createPixelPathTiles(river.points, `river-${river.id}`, Math.max(320, river.width * 4.2), Math.max(420, river.width * 5.4))) : [];
const mapRoadTiles = WORLD_MAP_HEAVY_DETAILS ? mapRoads.flatMap((road) => createPixelPathTiles(road.points, `road-${road.id}`, Math.max(280, (road.width ?? 62) * 4), Math.max(360, (road.width ?? 62) * 4.8))) : [];
const seededMapNoise = (seed: number): number => {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
};
const mapScenicPixels = WORLD_MAP_HEAVY_DETAILS
  ? WORLD_SCENIC_DETAILS.flatMap((detail, detailIndex) => {
      const count = Math.min(24, Math.max(7, Math.round(detail.density / 2.6)));
      return Array.from({ length: count }, (_, index) => {
        const angle = ((index * 137.508 + detailIndex * 29) % 360) * (Math.PI / 180);
        const radius = Math.sqrt(seededMapNoise(detailIndex * 101 + index * 17)) * detail.radius;
        const size = 120 + Math.round(seededMapNoise(detailIndex * 211 + index * 31) * 190);
        return {
          id: `scenic-${detail.id}-${index}`,
          kind: detail.kind,
          x: Math.max(0, Math.min(WORLD_BOUNDS.width - size, detail.position.x + Math.cos(angle) * radius - size / 2)),
          y: Math.max(0, Math.min(WORLD_BOUNDS.height - size, detail.position.y + Math.sin(angle) * radius * 0.72 - size / 2)),
          size
        };
      });
    })
  : [];
const mapWaterMarks = WORLD_MAP_HEAVY_DETAILS
  ? [
      ...[
        { id: "west-sea-a", x: 1500, y: 6400, rotation: -0.18, size: 360 },
        { id: "west-sea-b", x: 2100, y: 8800, rotation: 0.22, size: 300 },
        { id: "west-sea-c", x: 1050, y: 13200, rotation: -0.08, size: 330 },
        { id: "south-sea-a", x: 8200, y: 29800, rotation: 0.08, size: 380 },
        { id: "south-sea-b", x: 21200, y: 29300, rotation: -0.12, size: 340 },
        { id: "south-sea-c", x: 35600, y: 28700, rotation: 0.16, size: 360 }
      ],
      ...mapRivers.flatMap((river, riverIndex) =>
        river.points.slice(1, -1).map((point, pointIndex) => ({
          id: `river-${river.id}-${pointIndex}`,
          x: point.x,
          y: point.y,
          rotation: ((riverIndex + pointIndex) % 5) * 0.18 - 0.32,
          size: Math.max(220, river.width * 2.4)
        }))
      ),
      ...mapLakes.flatMap((lake, lakeIndex) =>
        Array.from({ length: 3 }, (_, index) => ({
          id: `lake-${lake.id}-${index}`,
          x: lake.x + Math.cos((index / 3) * Math.PI * 2 + lakeIndex) * lake.width * 0.18,
          y: lake.y + Math.sin((index / 3) * Math.PI * 2 + lakeIndex) * lake.height * 0.18,
          rotation: index * 0.26 - 0.18,
          size: Math.max(240, Math.min(420, lake.width * 0.14))
        }))
      )
    ]
  : [];
function mapCityClass(city: (typeof CITY_DEFINITIONS)[number]) {
  if (city.id === "greenhill") {
    return "hubMapCity";
  }
  if (city.safeRadius >= 500) {
    return "majorMapCity";
  }
  if (city.recommendedLevel >= 70) {
    return "endgameMapCity";
  }
  return "minorMapCity";
}

function mapCityStyle(city: (typeof CITY_DEFINITIONS)[number]): CSSProperties {
  const size = city.id === "greenhill" ? 54 : city.safeRadius >= 500 ? 42 : city.recommendedLevel >= 70 ? 38 : 34;
  const zone = city.id === "greenhill" ? 138 : city.safeRadius >= 500 ? 104 : city.recommendedLevel >= 70 ? 92 : 78;
  return {
    left: `${(city.position.x / WORLD_BOUNDS.width) * 100}%`,
    top: `${(city.position.y / WORLD_BOUNDS.height) * 100}%`,
    "--city-size": `${size}px`,
    "--city-zone": `${zone}px`
  } as CSSProperties;
}

function mapCityVisual(city: (typeof CITY_DEFINITIONS)[number]) {
  if (city.id === "greenhill") {
    return { zone: 980, keep: 440, house: 230 };
  }
  if (city.safeRadius >= 500) {
    return { zone: 700, keep: 310, house: 175 };
  }
  if (city.recommendedLevel >= 70) {
    return { zone: 620, keep: 280, house: 155 };
  }
  return { zone: 540, keep: 245, house: 140 };
}

function mapLandmarkShort(kind: string): string {
  if (kind === "arena") return "PvP";
  if (kind === "dungeon") return "DG";
  if (kind === "cave") return "CV";
  if (kind === "graveyard") return "GY";
  if (kind === "harbor") return "HB";
  if (kind === "ship") return "SH";
  if (kind === "ruins") return "RU";
  if (kind === "boss") return "B";
  return "POI";
}

function normalizeCharacterName(name: string): string {
  const normalized = name.trim().replace(/\s+/g, " ").toLowerCase();
  return normalized.length > 0 ? normalized : "wanderer";
}

function isGeneratedPlayerName(name?: string): boolean {
  return /^player\d{2,}$/i.test((name ?? "").trim());
}

function hashCharacterKey(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function characterIdFor(name: string, classId: CharacterClass): string {
  const key = `${classId}:${normalizeCharacterName(name)}`;
  return `char_${classId}_${hashCharacterKey(key)}`;
}

function normalizePlayableClass(classId?: CharacterClass): CharacterClass {
  return classId && playableClassIds.includes(classId) ? classId : "mage";
}

function loadLauncherProfile(): { name: string; classId: CharacterClass; legacyCharacterId?: string } {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(launcherStorageKey) ?? "{}") as Partial<{
      name: string;
      classId: CharacterClass;
    }>;
    const legacyCharacterId = window.localStorage.getItem(legacyCharacterIdStorageKey) ?? undefined;
    return {
      name: typeof parsed.name === "string" && parsed.name.trim() ? parsed.name : `Player${Math.floor(Math.random() * 900 + 100)}`,
      classId: normalizePlayableClass(parsed.classId),
      legacyCharacterId: parsed.name ? undefined : legacyCharacterId
    };
  } catch {
    return {
      name: `Player${Math.floor(Math.random() * 900 + 100)}`,
      classId: "mage",
      legacyCharacterId: window.localStorage.getItem(legacyCharacterIdStorageKey) ?? undefined
    };
  }
}

function sessionTokenPayload(token: string): { authProvider?: string; exp?: string } | undefined {
  try {
    const encoded = token.split(".")[0];
    if (!encoded) return undefined;
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    return JSON.parse(atob(padded)) as { authProvider?: string; exp?: string };
  } catch {
    return undefined;
  }
}

function accountSessionNeedsRefresh(session: AccountSession): boolean {
  const expiresAt = Date.parse(sessionTokenPayload(session.token)?.exp ?? "");
  return !Number.isFinite(expiresAt) || expiresAt <= Date.now() + 24 * 60 * 60 * 1000;
}

function isAccountSessionMessage(message: string): boolean {
  return ["Account session is required.", "Account session is not valid.", "Session token expired."].includes(message);
}

function loadAccountSession(): AccountSession | undefined {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(accountStorageKey) ?? "null") as AccountSession | null;
    if (parsed?.token && parsed.character?.id) {
      let authProvider = parsed.authProvider;
      if (!authProvider) {
        const payload = sessionTokenPayload(parsed.token);
        authProvider = payload?.authProvider === "account" ? "account" : payload?.authProvider === "guest" ? "guest" : undefined;
      }
      const migrated = { ...parsed, authProvider: authProvider ?? (parsed.login ? "account" : "guest") };
      saveAccountSession(migrated);
      return migrated;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function loadHotbar(classId: CharacterClass): Array<HotbarEntry | undefined> {
  try {
    const saved = JSON.parse(window.localStorage.getItem(hotbarStorageKey) ?? "{}") as Record<string, Array<HotbarEntry | undefined>>;
    const entries = saved[classId];
    if (Array.isArray(entries)) {
      return normalizeHotbar(classId, entries);
    }
  } catch {
    // ignore invalid local data
  }

  return defaultHotbar(classId);
}

function loadMobileAutoTarget(): boolean {
  try {
    return window.localStorage.getItem(mobileAutoTargetStorageKey) !== "off";
  } catch {
    return true;
  }
}

function loadVoiceEnabled(): boolean {
  try {
    return window.localStorage.getItem(voiceEnabledStorageKey) !== "off";
  } catch {
    return true;
  }
}

function loadVoiceChannel(): VoiceChannel {
  try {
    const channel = window.localStorage.getItem(voiceChannelStorageKey);
    return channel === "party" ? "party" : "nearby";
  } catch {
    return "nearby";
  }
}

function loadChatOpenDefault(): boolean {
  try {
    return !detectMobileLayout();
  } catch {
    return true;
  }
}

function isLootSystemChat(message: ChatMessage): boolean {
  return message.channel === "system" && /\b(picked up|dropped|opened a chest|gathered|found|reward|sold|bought|exchanged|enchanted|reached level)\b/i.test(message.text);
}

function localizedChatText(language: AppLanguage, message: ChatMessage): string {
  if (message.channel === "system") {
    return translateText(language, message.text);
  }
  return message.playerId.startsWith("bot_") ? translateBotChat(language, message.text) : message.text;
}

function detectMobileLayout(): boolean {
  try {
    return Boolean(
      navigator.maxTouchPoints > 0 ||
        window.matchMedia("(hover: none), (pointer: coarse), (max-width: 920px), (max-height: 540px)").matches ||
        window.innerWidth <= 920 ||
        window.innerHeight <= 540
    );
  } catch {
    return false;
  }
}

function isStandalonePwa(): boolean {
  try {
    return window.matchMedia("(display-mode: standalone)").matches || (navigator as StandaloneNavigator).standalone === true;
  } catch {
    return false;
  }
}

function isAppleMobileDevice(): boolean {
  try {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  } catch {
    return false;
  }
}

function isPwaInstallContext(): boolean {
  try {
    return window.isSecureContext || window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function isPwaInstallSnoozed(): boolean {
  try {
    const snoozeUntil = Number(window.localStorage.getItem(pwaInstallSnoozeStorageKey) ?? 0);
    return Number.isFinite(snoozeUntil) && snoozeUntil > Date.now();
  } catch {
    return false;
  }
}

function snoozePwaInstallOffer(hours: number): void {
  try {
    window.localStorage.setItem(pwaInstallSnoozeStorageKey, String(Date.now() + hours * 60 * 60 * 1000));
  } catch {
    // Storage can be unavailable in private browsing.
  }
}

function clearPwaInstallSnooze(): void {
  try {
    window.localStorage.removeItem(pwaInstallSnoozeStorageKey);
  } catch {
    // Storage can be unavailable in private browsing.
  }
}

function useMobileGameWakeLock(enabled: boolean): void {
  const sentinelRef = useRef<ScreenWakeLockSentinelLike>();
  const pendingRef = useRef(false);
  const lastAttemptAtRef = useRef(0);

  const requestWakeLock = useCallback(async (force = false) => {
    if (!enabled || document.visibilityState !== "visible") {
      return;
    }

    const wakeLock = (navigator as ScreenWakeLockNavigator).wakeLock;
    if (!wakeLock || pendingRef.current || (sentinelRef.current && !sentinelRef.current.released)) {
      return;
    }

    const now = performance.now();
    if (!force && now - lastAttemptAtRef.current < 15_000) {
      return;
    }
    lastAttemptAtRef.current = now;
    pendingRef.current = true;

    try {
      const sentinel = await wakeLock.request("screen");
      sentinelRef.current = sentinel;
      sentinel.addEventListener(
        "release",
        () => {
          if (sentinelRef.current === sentinel) {
            sentinelRef.current = undefined;
          }
        },
        { once: true }
      );
    } catch {
      sentinelRef.current = undefined;
    } finally {
      pendingRef.current = false;
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      const current = sentinelRef.current;
      sentinelRef.current = undefined;
      void current?.release().catch(() => undefined);
      return;
    }

    const retryWakeLock = (force = false) => {
      void requestWakeLock(force);
    };
    const retryWhenVisible = () => {
      if (document.visibilityState === "visible") {
        retryWakeLock(true);
      }
    };
    const retryFromFocus = () => retryWakeLock(true);

    retryWakeLock(true);
    document.addEventListener("visibilitychange", retryWhenVisible);
    window.addEventListener("focus", retryFromFocus);
    window.addEventListener("pageshow", retryFromFocus);

    return () => {
      document.removeEventListener("visibilitychange", retryWhenVisible);
      window.removeEventListener("focus", retryFromFocus);
      window.removeEventListener("pageshow", retryFromFocus);
      const current = sentinelRef.current;
      sentinelRef.current = undefined;
      void current?.release().catch(() => undefined);
    };
  }, [enabled, requestWakeLock]);
}

function loadBetaNoticeOpen(): boolean {
  try {
    return window.localStorage.getItem(betaNoticeStorageKey) !== "seen";
  } catch {
    return true;
  }
}

function loadPathChallenges(): StoredPathChallenges {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(pathChallengesStorageKey) ?? "{}") as StoredPathChallenges;
    return { ...parsed, collapsed: true };
  } catch {
    return { collapsed: true };
  }
}

function disabledTonWalletAddress(): string | undefined {
  return undefined;
}

function savePathChallenges(state: StoredPathChallenges): void {
  window.localStorage.setItem(pathChallengesStorageKey, JSON.stringify(state));
}

function loadStoryQuests(): StoredStoryQuestState {
  try {
    return JSON.parse(window.localStorage.getItem(storyQuestStorageKey) ?? "{}") as StoredStoryQuestState;
  } catch {
    return {};
  }
}

function saveStoryQuests(state: StoredStoryQuestState): void {
  window.localStorage.setItem(storyQuestStorageKey, JSON.stringify(state));
}

function challengeHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function challengeTimeKeys(time: number): { daily: string; hourly: string; nextHourlyAt: number; nextDailyAt: number } {
  const date = new Date(time);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hour = `${date.getHours()}`.padStart(2, "0");
  const nextHour = new Date(date);
  nextHour.setMinutes(0, 0, 0);
  nextHour.setHours(nextHour.getHours() + 1);
  const nextDay = new Date(date);
  nextDay.setHours(24, 0, 0, 0);
  return {
    daily: `${year}-${month}-${day}`,
    hourly: `${year}-${month}-${day}-${hour}`,
    nextHourlyAt: nextHour.getTime(),
    nextDailyAt: nextDay.getTime()
  };
}

function formatCountdown(ms: number, language: AppLanguage): string {
  const safe = Math.max(0, ms);
  const hours = Math.floor(safe / 3_600_000);
  const minutes = Math.floor((safe % 3_600_000) / 60_000);
  if (hours > 0) {
    return language === "ru" ? `${hours} ч ${minutes} мин` : `${hours}h ${minutes}m`;
  }
  return language === "ru" ? `${minutes} мин` : `${minutes}m`;
}

function totalXpProgress(level: number, xp: number): number {
  let total = Math.max(0, xp);
  for (let current = 1; current < level; current += 1) {
    total += xpForNextLevel(current);
  }
  return total;
}

function equipmentPower(equipment: EquipmentState): number {
  const gradeScore: Record<string, number> = {
    common: 18,
    rare: 42,
    epic: 86,
    legendary: 145,
    mythic: 230,
    relic: 340
  };
  return Object.values(equipment).reduce((sum, item) => {
    if (!item) {
      return sum;
    }
    const statPower = Object.values(item.stats ?? {}).reduce((statSum, value) => statSum + Math.max(0, Number(value) || 0), 0);
    return sum + (gradeScore[item.grade ?? "common"] ?? 0) + statPower + (item.enchantLevel ?? 0) * (item.slot === "weapon" ? 18 : 10);
  }, 0);
}

function pickChallengeSet(pool: ChallengeDefinition[], seed: string, count: number): ChallengeDefinition[] {
  return [...pool]
    .map((challenge) => ({ challenge, score: challengeHash(`${seed}:${challenge.id}`) }))
    .sort((first, second) => first.score - second.score)
    .slice(0, count)
    .map(({ challenge }) => challenge);
}

function questBaselineFor(player?: PlayerPublicState): StoryQuestBaseline {
  return {
    monsterKills: { ...(player?.monsterKills ?? {}) },
    arenaWins: player?.arenaWins ?? 0,
    pkCount: player?.pkCount ?? 0
  };
}

function storyQuestProgress(
  quest: StoryQuestDefinition,
  player: PlayerPublicState | undefined,
  baseline: StoryQuestBaseline
): { progress: number; goal: number; done: boolean; valueText: string } {
  const objective = quest.objective;
  if (objective.kind === "monster") {
    const currentKills = player?.monsterKills?.[objective.archetype] ?? 0;
    const baselineKills = baseline.monsterKills?.[objective.archetype] ?? 0;
    const progress = Math.max(0, currentKills - baselineKills);
    return {
      progress,
      goal: objective.goal,
      done: progress >= objective.goal,
      valueText: `${Math.min(progress, objective.goal)}/${objective.goal}`
    };
  }
  if (objective.kind === "level") {
    const progress = player?.level ?? 1;
    return {
      progress,
      goal: objective.goal,
      done: progress >= objective.goal,
      valueText: `Lv.${Math.min(progress, objective.goal)}/${objective.goal}`
    };
  }
  if (objective.kind === "arenaWins") {
    const progress = Math.max(0, (player?.arenaWins ?? 0) - baseline.arenaWins);
    return {
      progress,
      goal: objective.goal,
      done: progress >= objective.goal,
      valueText: `${Math.min(progress, objective.goal)}/${objective.goal}`
    };
  }

  const progress = Math.max(0, (player?.pkCount ?? 0) - baseline.pkCount);
  return {
    progress,
    goal: objective.goal,
    done: progress >= objective.goal,
    valueText: `${Math.min(progress, objective.goal)}/${objective.goal}`
  };
}

function saveHotbar(classId: CharacterClass, entries: Array<HotbarEntry | undefined>): void {
  let saved: Record<string, Array<HotbarEntry | undefined>> = {};
  try {
    saved = JSON.parse(window.localStorage.getItem(hotbarStorageKey) ?? "{}") as Record<string, Array<HotbarEntry | undefined>>;
  } catch {
    saved = {};
  }
  saved[classId] = entries;
  window.localStorage.setItem(hotbarStorageKey, JSON.stringify(saved));
}

function saveLauncherProfile(name: string, classId: CharacterClass): void {
  window.localStorage.setItem(launcherStorageKey, JSON.stringify({ name: name.trim(), classId }));
}

function saveAccountSession(session: AccountSession): void {
  window.localStorage.setItem(accountStorageKey, JSON.stringify(session));
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Could not read PNG."));
      }
    });
    reader.addEventListener("error", () => reject(new Error("Could not read PNG.")));
    reader.readAsDataURL(file);
  });
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(target.closest("input, textarea, select, button"));
}

function enchantBonusText(item?: InventoryItem): string {
  const level = item?.enchantLevel ?? 0;
  if (!item || level <= 0) {
    return "";
  }
  if (item.slot === "weapon") {
    const overSafe = Math.max(0, level - 3);
    const scale = item.stats?.magic && !item.stats?.attack ? 3 : 2;
    const bonus = level * scale + Math.floor(overSafe * 1.2);
    return item.stats?.magic && !item.stats?.attack ? ` enchant magic+${bonus}` : ` enchant atk+${bonus}`;
  }
  return ` enchant def+${level}`;
}

function itemDisplayName(item?: InventoryItem): string {
  if (!item) {
    return "Empty";
  }
  return item.enchantLevel ? `+${item.enchantLevel} ${item.label}` : item.label;
}

function safeClassPart(value?: string): string {
  return (value ?? "none").replace(/[^a-zA-Z0-9_-]/g, "");
}

function itemEnchantClass(item?: InventoryItem): string {
  const level = item?.enchantLevel ?? 0;
  if (level >= 16) {
    return "enchantGlow enchantRed";
  }
  if (level >= 7) {
    return "enchantGlow enchantBlueSmoke";
  }
  if (level >= 6) {
    return "enchantGlow enchantBlue";
  }
  if (level >= 4) {
    return "enchantGlow enchantWhite";
  }
  return "";
}

function itemGradeClass(item?: InventoryItem): string {
  return `itemGrade-${item?.grade ?? "common"}`;
}

function itemAppearanceClass(item?: InventoryItem): string {
  return item?.appearance ? `itemAppearance-${safeClassPart(item.appearance)}` : "";
}

function shopCurrencyLabel(itemId?: string): string {
  if (itemId === "pvp-coin") {
    return "PvP Coin";
  }
  if (itemId === "arena-coin") {
    return "Coin";
  }
  return itemId ?? "gold";
}

function shopGradeSortScore(item: InventoryItem): number {
  return { common: 0, rare: 1, epic: 2, legendary: 3, mythic: 4, relic: 5 }[item.grade ?? "common"] ?? 0;
}

function itemSlotLabel(slot?: EquipmentSlot): string | undefined {
  return slot ? equipmentSlotLabels[slot] : undefined;
}

function itemMetaText(item?: InventoryItem, options: { includeSlot?: boolean } = {}): string {
  if (!item) {
    return "";
  }

  const includeSlot = options.includeSlot ?? true;
  const parts = [
    includeSlot ? itemSlotLabel(item.slot) : undefined,
    item.grade ? itemGradeText(item.grade) : undefined,
    item.requiredLevel ? `Lv.${item.requiredLevel}+` : undefined,
    item.classId ? CLASS_DEFINITIONS[item.classId].label : undefined
  ].filter(Boolean);
  return parts.join(" · ");
}

function itemStatsText(item?: InventoryItem): string {
  if (item?.consumable) {
    return `${item.consumable.hp ? `HP+${item.consumable.hp}` : ""}${item.consumable.mp ? ` MP+${item.consumable.mp}` : ""} x${item.quantity}`;
  }
  if (!item?.stats) {
    return item?.stackable ? `x${item.quantity}` : "";
  }

  return Object.entries(item.stats)
    .filter(([, value]) => value !== 0)
    .map(([key, value]) => `${statLabel(key)}${value > 0 ? "+" : ""}${value}`)
    .join(" ")
    .concat(enchantBonusText(item));
}

function statLabel(key: string): string {
  const labels: Record<string, string> = {
    hp: "HP",
    mp: "MP",
    attack: "ATK",
    magic: "M.ATK",
    defense: "DEF",
    speed: "SPD",
    str: "STR",
    dex: "DEX",
    crit: "CRIT",
    attackSpeed: "ATK SPD",
    castSpeed: "CAST"
  };
  return labels[key] ?? key;
}

function skillDescription(skillId: string): string {
  const descriptions: Record<string, string> = {
    "piercing-shot": "Charged arrow that pierces up to 4 enemies in a line.",
    volley: "Area shot: damages enemies around the aimed point.",
    "pinning-shot": "Precision shot: high single-target damage and short stun.",
    "rain-of-arrows": "Large area burst: arrows fall around the aimed point.",
    "frost-bolt": "Single-target magic hit with a short stun.",
    "fire-nova": "Area fire blast around the aimed point.",
    "arc-lightning": "Longer-range magic strike with a mini stun.",
    meteor: "Large delayed-feeling area nuke.",
    "healing-light": "Self-heal that restores HP without needing a target.",
    cleave: "Heavy frontal melee strike.",
    "battle-cry": "Self-centered area hit around your character.",
    "shadow-step": "Fast assassin strike toward the target.",
    "shield-bash": "Close-range hit with stun."
  };
  return descriptions[skillId] ?? "Active class skill.";
}

function skillVisual(skillId: string): SkillVisual {
  return skillVisuals[skillId] ?? defaultSkillVisual;
}

function defaultHotbar(classId: CharacterClass): Array<HotbarEntry | undefined> {
  const entries: HotbarEntry[] = [
    { type: "attack" },
    ...CLASS_DEFINITIONS[classId].skills.slice(0, 5).map((skill) => ({ type: "skill" as const, skillId: skill.id }))
  ];
  if (entries.length < 6) {
    entries.push({ type: "item", itemId: "lesser-hp-potion" });
  }
  return entries.slice(0, 6);
}

function normalizeHotbar(classId: CharacterClass, entries?: Array<HotbarEntry | undefined>): Array<HotbarEntry | undefined> {
  const normalized = Array.isArray(entries) ? [...entries.slice(0, 6), ...Array<undefined>(6)].slice(0, 6) : defaultHotbar(classId);
  const hasAttack = normalized.some((entry) => entry?.type === "attack");
  const next = hasAttack ? normalized : [{ type: "attack" as const }, ...normalized.slice(0, 5)];

  for (const skill of CLASS_DEFINITIONS[classId].skills.slice(0, 5)) {
    if (next.some((entry) => entry?.type === "skill" && entry.skillId === skill.id)) {
      continue;
    }
    const replaceIndex = next.findIndex((entry, index) => index > 0 && (!entry || entry.type === "item" || entry.type === "sprint"));
    const fallbackIndex = next.findIndex((entry, index) => index > 0 && entry?.type !== "attack");
    const targetIndex = replaceIndex >= 0 ? replaceIndex : fallbackIndex;
    if (targetIndex >= 0) {
      next[targetIndex] = { type: "skill", skillId: skill.id };
    }
  }

  return next;
}

function decodeFaceVariant(face?: number): FaceParts {
  const normalized = Math.max(1, Math.min(CHARACTER_FACE_VARIANT_COUNT, Math.trunc(face ?? 1)));
  const variant = characterFaceStyleVariant(normalized) - 1;
  return {
    gender: characterGenderFromFace(normalized),
    hair: (variant % hairOptions.length) + 1,
    eyes: (Math.floor(variant / hairOptions.length) % eyeOptions.length) + 1,
    mark: (Math.floor(variant / (hairOptions.length * eyeOptions.length)) % markOptions.length) + 1
  };
}

function encodeFaceVariant(parts: FaceParts): number {
  const hair = Math.max(1, Math.min(hairOptions.length, Math.trunc(parts.hair)));
  const eyes = Math.max(1, Math.min(eyeOptions.length, Math.trunc(parts.eyes)));
  const mark = Math.max(1, Math.min(markOptions.length, Math.trunc(parts.mark)));
  const styleVariant = 1 + (hair - 1) + (eyes - 1) * hairOptions.length + (mark - 1) * hairOptions.length * eyeOptions.length;
  return styleVariant + (parts.gender === "female" ? CHARACTER_FACE_VARIANTS_PER_GENDER : 0);
}

function itemKind(item?: InventoryItem, slot?: EquipmentSlot): EquipmentSlot | "item" {
  return item?.slot ?? slot ?? "item";
}

function itemSpriteClass(item?: InventoryItem, slot?: EquipmentSlot): string {
  const id = item?.id ?? "";
  const kind = itemKind(item, slot);
  if (id.includes("scroll")) {
    return "sprite-scroll";
  }
  if (id.includes("potion")) {
    return "sprite-potion";
  }
  if (id === "pvp-coin") {
    return "sprite-pvp-coin";
  }
  if (id.includes("coin")) {
    return "sprite-coin";
  }
  if (id.includes("bow")) {
    return "sprite-bow";
  }
  if (id.includes("staff")) {
    return "sprite-staff";
  }
  if (id.includes("dagger")) {
    return "sprite-dagger";
  }
  if (id.includes("mace")) {
    return "sprite-mace";
  }
  if (kind === "weapon") {
    return "sprite-sword";
  }
  if (kind === "shield") {
    return "sprite-shield";
  }
  if (kind === "helmet") {
    return "sprite-helmet";
  }
  if (kind === "chest") {
    return "sprite-chest";
  }
  if (kind === "gloves") {
    return "sprite-gloves";
  }
  if (kind === "boots") {
    return "sprite-boots";
  }
  if (kind === "necklace" || kind === "earringLeft" || kind === "earringRight" || kind === "ringLeft" || kind === "ringRight") {
    return "sprite-jewel";
  }
  return "sprite-bag";
}

function monsterLabel(archetype: string): string {
  return archetype
    .split("-")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

const itemGradeAccents: Record<string, string> = {
  common: "#cbd5e1",
  rare: "#38bdf8",
  epic: "#a78bfa",
  legendary: "#facc15",
  mythic: "#22d3ee",
  relic: "#fb7185"
};

const itemAppearancePalette: Record<string, { base: string; dark: string; light: string }> = {
  steel: { base: "#94a3b8", dark: "#475569", light: "#e2e8f0" },
  shadow: { base: "#7c3aed", dark: "#3b0764", light: "#c4b5fd" },
  arcane: { base: "#38bdf8", dark: "#075985", light: "#bae6fd" },
  hunter: { base: "#65a30d", dark: "#365314", light: "#d9f99d" },
  guardian: { base: "#f59e0b", dark: "#92400e", light: "#fde68a" },
  wood: { base: "#a16207", dark: "#573107", light: "#d6a15d" },
  blade: { base: "#cbd5e1", dark: "#64748b", light: "#f8fafc" },
  dagger: { base: "#a78bfa", dark: "#4c1d95", light: "#ede9fe" },
  staff: { base: "#38bdf8", dark: "#1e3a8a", light: "#e0f2fe" },
  bow: { base: "#d6a15d", dark: "#78350f", light: "#fde68a" },
  mace: { base: "#f59e0b", dark: "#7c2d12", light: "#fef3c7" }
};

function itemGradeRank(grade?: string): number {
  return { common: 1, rare: 2, epic: 3, legendary: 4, mythic: 5, relic: 6 }[grade ?? "common"] ?? 1;
}

function itemArtKind(item: InventoryItem, slot?: EquipmentSlot): string {
  const id = item.id ?? "";
  const kind = itemKind(item, slot);
  if (id.includes("enchant-scroll") || id.includes("scroll")) {
    return id.startsWith("armor") ? "scroll-armor" : "scroll-weapon";
  }
  if (id.includes("potion")) {
    return id.includes("mp") ? "potion-mp" : "potion-hp";
  }
  if (id === "pvp-coin") {
    return "pvp-coin";
  }
  if (id.includes("coin")) {
    return "coin";
  }
  if (kind === "weapon") {
    const appearance = item.appearance ?? "";
    if (appearance === "bow" || id.includes("bow")) {
      return "bow";
    }
    if (appearance === "staff" || id.includes("staff")) {
      return "staff";
    }
    if (appearance === "dagger" || id.includes("dagger")) {
      return "dagger";
    }
    if (appearance === "mace" || id.includes("mace")) {
      return "mace";
    }
    return "sword";
  }
  if (kind === "shield" || kind === "helmet" || kind === "chest" || kind === "gloves" || kind === "boots") {
    return kind;
  }
  if (kind === "necklace") {
    return "necklace";
  }
  if (kind === "earringLeft" || kind === "earringRight") {
    return "earring";
  }
  if (kind === "ringLeft" || kind === "ringRight") {
    return "ring";
  }
  return "bag";
}

function ItemIconArt({ item, slot }: { item: InventoryItem; slot?: EquipmentSlot }) {
  const art = itemArtKind(item, slot);
  const rank = itemGradeRank(item.grade);
  const accent = itemGradeAccents[item.grade ?? "common"] ?? itemGradeAccents.common;
  const palette = itemAppearancePalette[item.appearance ?? ""] ?? itemAppearancePalette.steel;
  const fancy = rank >= 3;
  const elite = rank >= 5;

  const gradeStar =
    rank >= 4 ? <path d="M32 5 L33.4 8.6 L37 10 L33.4 11.4 L32 15 L30.6 11.4 L27 10 L30.6 8.6 Z" fill={accent} opacity="0.95" /> : null;

  let body: JSX.Element;
  switch (art) {
    case "sword":
      body = (
        <g transform="rotate(45 20 20)">
          <polygon points="20,1 23,6 23,22 17,22 17,6" fill={palette.light} stroke={palette.dark} strokeWidth="0.8" />
          <line x1="20" y1="4" x2="20" y2="21" stroke={fancy ? accent : palette.base} strokeWidth={fancy ? 1.6 : 1} opacity="0.9" />
          {elite ? <polygon points="17,8 14.6,10.5 17,13" fill={palette.light} stroke={palette.dark} strokeWidth="0.6" /> : null}
          {elite ? <polygon points="23,8 25.4,10.5 23,13" fill={palette.light} stroke={palette.dark} strokeWidth="0.6" /> : null}
          <rect x="12.5" y="22" width="15" height="3.4" rx="1.4" fill={fancy ? "#eab308" : "#8b5e34"} stroke="#3f2708" strokeWidth="0.6" />
          {fancy ? <circle cx="20" cy="23.7" r="1.7" fill={accent} stroke="#0f172a" strokeWidth="0.5" /> : null}
          <rect x="18.4" y="25.4" width="3.2" height="8" rx="1.4" fill="#6b4226" />
          <circle cx="20" cy="35" r="2.3" fill={fancy ? accent : "#94a3b8"} stroke="#3f2708" strokeWidth="0.6" />
        </g>
      );
      break;
    case "dagger":
      body = (
        <g>
          <g transform="rotate(38 16 22)">
            <polygon points="16,4 18.5,8 18.5,20 13.5,20 13.5,8" fill={palette.light} stroke={palette.dark} strokeWidth="0.7" />
            <rect x="12" y="20" width="8" height="2.6" rx="1.2" fill="#4c1d95" />
            <rect x="14.7" y="22.6" width="2.6" height="6.4" rx="1.2" fill="#2e1065" />
          </g>
          <g transform="rotate(58 26 22)">
            <polygon points="26,6 28.5,10 28.5,22 23.5,22 23.5,10" fill={fancy ? accent : palette.base} stroke={palette.dark} strokeWidth="0.7" opacity="0.94" />
            <rect x="22" y="22" width="8" height="2.6" rx="1.2" fill="#4c1d95" />
            <rect x="24.7" y="24.6" width="2.6" height="6.4" rx="1.2" fill="#2e1065" />
          </g>
          {elite ? <circle cx="20" cy="14" r="2.2" fill={accent} opacity="0.85" /> : null}
        </g>
      );
      break;
    case "bow":
      body = (
        <g>
          <path d="M13 4 Q34 20 13 36" fill="none" stroke={fancy ? palette.dark : "#8b5e34"} strokeWidth="3" strokeLinecap="round" />
          {fancy ? <path d="M13 4 Q34 20 13 36" fill="none" stroke={accent} strokeWidth="1.1" strokeLinecap="round" opacity="0.8" /> : null}
          <line x1="13" y1="5" x2="13" y2="35" stroke="#f8fafc" strokeWidth="1" />
          <line x1="8" y1="20" x2="28" y2="20" stroke={elite ? accent : "#d6a15d"} strokeWidth="1.6" />
          <polygon points="30,20 25,17 26,20 25,23" fill={elite ? accent : "#e2e8f0"} />
          {elite ? <polygon points="11,2 16,5 12,8" fill={accent} /> : null}
          {elite ? <polygon points="11,38 16,35 12,32" fill={accent} /> : null}
        </g>
      );
      break;
    case "staff":
      body = (
        <g>
          <line x1="12" y1="36" x2="27" y2="12" stroke="#6b4226" strokeWidth="2.8" strokeLinecap="round" />
          {fancy ? <line x1="14" y1="32" x2="25" y2="15" stroke={accent} strokeWidth="0.9" opacity="0.75" /> : null}
          {elite ? (
            <g>
              <polygon points="28,2 23.5,10 32.5,10" fill={accent} stroke="#0f172a" strokeWidth="0.5" />
              <polygon points="28,17 23.5,9.5 32.5,9.5" fill={palette.light} stroke="#0f172a" strokeWidth="0.5" />
            </g>
          ) : (
            <g>
              <circle cx="28" cy="9" r={fancy ? 5.4 : 4.4} fill={fancy ? accent : palette.base} stroke={palette.dark} strokeWidth="1" />
              <circle cx="28" cy="9" r="2" fill="#f0f9ff" opacity="0.95" />
            </g>
          )}
          {fancy ? <path d="M23 13 Q28 17 33 13" fill="none" stroke="#eab308" strokeWidth="1.4" /> : null}
        </g>
      );
      break;
    case "mace":
      body = (
        <g>
          <line x1="13" y1="36" x2="26" y2="15" stroke="#7c6f64" strokeWidth="3" strokeLinecap="round" />
          <circle cx="27" cy="12" r={fancy ? 7 : 6} fill={fancy ? palette.base : "#94a3b8"} stroke={palette.dark} strokeWidth="1.2" />
          {[0, 60, 120, 180, 240, 300].map((deg) => (
            <polygon key={deg} points="27,2.6 25.4,7 28.6,7" fill={elite ? accent : palette.dark} transform={`rotate(${deg} 27 12)`} />
          ))}
          <circle cx="27" cy="12" r="2.4" fill={fancy ? accent : "#e2e8f0"} />
        </g>
      );
      break;
    case "shield":
      body = (
        <g>
          <path d="M20 3 L34 8 V19 C34 28 28 34 20 37.5 C12 34 6 28 6 19 V8 Z" fill={palette.base} stroke={palette.dark} strokeWidth="1.4" />
          <path d="M20 6 L31 10 V19 C31 26 26 31 20 34 C14 31 9 26 9 19 V10 Z" fill={palette.dark} opacity="0.55" />
          <circle cx="20" cy="18" r={fancy ? 4.6 : 3.6} fill={fancy ? accent : palette.light} stroke="#0f172a" strokeWidth="0.8" />
          {elite ? <path d="M20 8 V30 M11 18 H29" stroke={accent} strokeWidth="1.4" opacity="0.7" /> : null}
        </g>
      );
      break;
    case "helmet":
      body = (
        <g>
          {item.appearance === "guardian" || item.appearance === "wood" ? (
            <g>
              <path d="M8 14 Q4 6 10 4 Q12 10 14 12 Z" fill={palette.dark} />
              <path d="M32 14 Q36 6 30 4 Q28 10 26 12 Z" fill={palette.dark} />
            </g>
          ) : null}
          <path d="M9 22 Q9 8 20 8 Q31 8 31 22 L31 28 L9 28 Z" fill={palette.base} stroke={palette.dark} strokeWidth="1.2" />
          <path d="M11 21 Q11 11 20 11 Q29 11 29 21 L29 26 L11 26 Z" fill={palette.dark} opacity="0.4" />
          <rect x="12" y="20" width="16" height="3.2" rx="1.6" fill="#0f172a" opacity="0.85" />
          {fancy ? <path d="M20 4 L22 9 L18 9 Z" fill={accent} /> : null}
          {elite ? <path d="M14 30 L20 33 L26 30" fill="none" stroke={accent} strokeWidth="1.4" /> : null}
        </g>
      );
      break;
    case "chest":
      body = (
        <g>
          <path d="M12 7 L20 5 L28 7 L33 12 L29 16 L29 30 Q20 35 11 30 L11 16 L7 12 Z" fill={palette.base} stroke={palette.dark} strokeWidth="1.2" />
          <path d="M14 9 L20 7.5 L26 9 L28 12 L20 15 L12 12 Z" fill={palette.light} opacity="0.5" />
          <line x1="20" y1="15" x2="20" y2="32" stroke={palette.dark} strokeWidth="1.2" opacity="0.8" />
          <line x1="13" y1="20" x2="27" y2="20" stroke={palette.dark} strokeWidth="1" opacity="0.6" />
          {fancy ? <circle cx="20" cy="19" r="2.4" fill={accent} stroke="#0f172a" strokeWidth="0.6" /> : null}
          {elite ? <path d="M13 26 Q20 30 27 26" fill="none" stroke={accent} strokeWidth="1.3" opacity="0.85" /> : null}
        </g>
      );
      break;
    case "gloves":
      body = (
        <g>
          <g transform="rotate(-10 13 22)">
            <rect x="8" y="14" width="10" height="14" rx="3.4" fill={palette.base} stroke={palette.dark} strokeWidth="1" />
            <rect x="8" y="24" width="10" height="4" fill={palette.dark} opacity="0.7" />
            <rect x="16.6" y="17" width="3.6" height="6" rx="1.6" fill={palette.base} stroke={palette.dark} strokeWidth="0.8" />
          </g>
          <g transform="rotate(10 28 22)">
            <rect x="22" y="12" width="10" height="14" rx="3.4" fill={palette.base} stroke={palette.dark} strokeWidth="1" />
            <rect x="22" y="22" width="10" height="4" fill={palette.dark} opacity="0.7" />
            <rect x="19.8" y="15" width="3.6" height="6" rx="1.6" fill={palette.base} stroke={palette.dark} strokeWidth="0.8" />
          </g>
          {fancy ? <circle cx="13" cy="19" r="1.6" fill={accent} /> : null}
          {fancy ? <circle cx="27" cy="17" r="1.6" fill={accent} /> : null}
        </g>
      );
      break;
    case "boots":
      body = (
        <g>
          <path d="M10 10 L16 10 L16 24 L22 28 L22 32 L10 32 Z" fill={palette.base} stroke={palette.dark} strokeWidth="1" />
          <path d="M24 8 L30 8 L30 22 L36 26 L36 30 L24 30 Z" fill={palette.base} stroke={palette.dark} strokeWidth="1" transform="translate(-4 2)" />
          <rect x="10" y="10" width="6" height="3.4" fill={palette.dark} opacity="0.75" />
          <rect x="20" y="10" width="6" height="3.4" fill={palette.dark} opacity="0.75" />
          {fancy ? <line x1="10" y1="28" x2="22" y2="28" stroke={accent} strokeWidth="1.3" /> : null}
        </g>
      );
      break;
    case "necklace":
      body = (
        <g>
          <path d="M11 6 Q20 16 29 6" fill="none" stroke="#d6a15d" strokeWidth="1.8" strokeDasharray="2.6 1.6" />
          <circle cx="20" cy="14" r="2" fill="#d6a15d" />
          <polygon points="20,17 25,23 20,31 15,23" fill={accent} stroke="#0f172a" strokeWidth="0.8" />
          <polygon points="20,19.5 23,23 20,28 17,23" fill="#f8fafc" opacity="0.4" />
        </g>
      );
      break;
    case "earring":
      body = (
        <g>
          <path d="M20 6 Q26 8 24 14 Q22 18 20 17" fill="none" stroke="#d6a15d" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="20" cy="20" r="2.2" fill="#d6a15d" />
          <polygon points="20,23 24,28 20,34 16,28" fill={accent} stroke="#0f172a" strokeWidth="0.8" />
        </g>
      );
      break;
    case "ring":
      body = (
        <g>
          <circle cx="20" cy="23" r="9" fill="none" stroke="#d6a15d" strokeWidth="3.4" />
          <circle cx="20" cy="23" r="9" fill="none" stroke="#f5e6b3" strokeWidth="1.1" opacity="0.7" />
          <polygon points="20,6 25,11 20,16 15,11" fill={accent} stroke="#0f172a" strokeWidth="0.8" />
          <polygon points="20,8 23,11 20,14 17,11" fill="#f8fafc" opacity="0.45" />
        </g>
      );
      break;
    case "potion-hp":
    case "potion-mp": {
      const liquid = art === "potion-mp" ? "#3b82f6" : "#ef4444";
      const liquidDark = art === "potion-mp" ? "#1e3a8a" : "#7f1d1d";
      const greater = (item.id ?? "").includes("greater");
      body = (
        <g>
          <rect x="17" y="4" width="6" height="5" fill="#cbd5e1" stroke="#64748b" strokeWidth="0.8" />
          <rect x="16" y="3" width="8" height="2.4" rx="1" fill="#8b5e34" />
          <path d={greater ? "M17 9 L13 15 Q9 22 12 29 Q15 36 20 36 Q25 36 28 29 Q31 22 27 15 L23 9 Z" : "M17 9 L14 16 Q12 22 15 28 Q17 32 20 32 Q23 32 25 28 Q28 22 26 16 L23 9 Z"} fill="#e0f2fe" opacity="0.35" stroke="#bae6fd" strokeWidth="1" />
          <path d={greater ? "M13.4 18 Q11 24 13.5 29.5 Q16 34.5 20 34.5 Q24 34.5 26.5 29.5 Q29 24 26.6 18 Z" : "M14.6 18 Q13 23 15.6 27.5 Q17.5 30.5 20 30.5 Q22.5 30.5 24.4 27.5 Q27 23 25.4 18 Z"} fill={liquid} />
          <ellipse cx="20" cy="19" rx={greater ? 6 : 5} ry="1.6" fill={liquidDark} opacity="0.65" />
          <circle cx="17" cy="24" r="1" fill="#fecaca" opacity="0.8" />
          <circle cx="22" cy="27" r="0.8" fill="#fecaca" opacity="0.6" />
          {greater ? <path d="M20 21 L21.2 23.6 L24 24 L22 26 L22.5 28.8 L20 27.5 L17.5 28.8 L18 26 L16 24 L18.8 23.6 Z" fill="#fef3c7" opacity="0.9" /> : null}
        </g>
      );
      break;
    }
    case "scroll-weapon":
    case "scroll-armor": {
      const seal = art === "scroll-weapon" ? "#dc2626" : "#2563eb";
      body = (
        <g transform="rotate(-8 20 20)">
          <rect x="8" y="10" width="24" height="20" rx="2" fill="#f5e6b3" stroke="#b99b62" strokeWidth="1" />
          <rect x="6" y="9" width="4.6" height="22" rx="2.3" fill="#8b5e34" />
          <rect x="29.4" y="9" width="4.6" height="22" rx="2.3" fill="#8b5e34" />
          <line x1="13" y1="16" x2="27" y2="16" stroke="#8b5e34" strokeWidth="1" opacity="0.7" />
          <line x1="13" y1="20" x2="27" y2="20" stroke="#8b5e34" strokeWidth="1" opacity="0.55" />
          <line x1="13" y1="24" x2="23" y2="24" stroke="#8b5e34" strokeWidth="1" opacity="0.4" />
          <circle cx="26" cy="26" r="3.4" fill={seal} stroke="#450a0a" strokeWidth="0.7" />
          <circle cx="26" cy="26" r="1.4" fill={accent} />
        </g>
      );
      break;
    }
    case "coin":
      body = (
        <g>
          <circle cx="20" cy="20" r="13" fill="#eab308" stroke="#92400e" strokeWidth="1.6" />
          <circle cx="20" cy="20" r="9" fill="#fef08a" stroke="#ca8a04" strokeWidth="1" />
          <path d="M20 14 V26 M16 17 H24 M16 23 H24" stroke="#92400e" strokeWidth="1.4" />
        </g>
      );
      break;
    case "pvp-coin":
      body = (
        <g>
          <circle cx="20" cy="20" r="13" fill="#7f1d1d" stroke="#fecaca" strokeWidth="1.4" />
          <circle cx="20" cy="20" r="9" fill="#ef4444" stroke="#450a0a" strokeWidth="1" />
          <path d="M15 15 L25 25 M25 15 L15 25" stroke="#fee2e2" strokeWidth="1.8" strokeLinecap="round" />
        </g>
      );
      break;
    default:
      body = (
        <g>
          <path d="M12 14 Q10 10 14 9 L26 9 Q30 10 28 14 L30 28 Q30 33 25 33 L15 33 Q10 33 10 28 Z" fill="#8b5e34" stroke="#4a2f1c" strokeWidth="1.2" />
          <path d="M14 9 Q20 13 26 9" fill="none" stroke="#d6a15d" strokeWidth="1.6" />
          <circle cx="20" cy="21" r="2.2" fill="#d6a15d" />
        </g>
      );
      break;
  }

  return (
    <svg className="itemArt" viewBox="0 0 40 40" aria-hidden="true">
      {body}
      {gradeStar}
    </svg>
  );
}

function ItemIcon({ item, slot }: { item?: InventoryItem; slot?: EquipmentSlot }) {
  const kind = itemKind(item, slot);

  return (
    <span className={item ? `itemIcon itemIcon-${kind} ${itemGradeClass(item)} ${itemAppearanceClass(item)} ${itemEnchantClass(item)}` : `itemIcon itemIcon-${kind} emptyIcon`}>
      {item ? (
        <>
          <ItemIconArt item={item} slot={slot} />
          {item.enchantLevel ? <em>+{item.enchantLevel}</em> : null}
        </>
      ) : (
        <span className="itemSprite sprite-empty" />
      )}
    </span>
  );
}


function paperdollAppearanceClasses(equipment: EquipmentState): string {
  const weaponEnchant = equipment.weapon?.enchantLevel ?? 0;
  return (["helmet", "chest", "gloves", "boots"] as const)
    .map((slot) => (equipment[slot]?.appearance ? `paper-${slot}-${safeClassPart(equipment[slot]?.appearance)}` : ""))
    .concat(equipment.chest?.grade ? [`paper-grade-${equipment.chest.grade}`] : [])
    .concat(equipment.weapon?.grade ? [`paper-weapon-grade-${equipment.weapon.grade}`] : [])
    .concat(weaponEnchant >= 12 ? ["paper-enchant-red"] : weaponEnchant >= 7 ? ["paper-enchant-blue"] : weaponEnchant >= 4 ? ["paper-enchant-white"] : [])
    .filter(Boolean)
    .join(" ");
}

function effectiveAttackCooldownMs(baseCooldownMs: number, stats: DerivedStats): number {
  return Math.round(baseCooldownMs * Math.max(0.45, 1 - (stats.dex ?? 0) * 0.012 - (stats.attackSpeed ?? 0) * 0.006));
}

function effectiveSkillCooldownMs(baseCooldownMs: number, stats: DerivedStats): number {
  return Math.round(baseCooldownMs * Math.max(0.62, 1 - (stats.castSpeed ?? 0) * 0.005));
}

export function App() {
  const [language, setLanguage] = useState<AppLanguage>(loadLanguage);
  const tr = useCallback(
    (value: string): string => translateText(language, value),
    [language]
  );
  const [launcherProfile] = useState(loadLauncherProfile);
  const [accountSession, setAccountSession] = useState<AccountSession | undefined>(loadAccountSession);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [accountLogin, setAccountLogin] = useState(accountSession?.login ?? "");
  const [accountPassword, setAccountPassword] = useState("");
  const [registerEmailCode, setRegisterEmailCode] = useState("");
  const [registerCodeSent, setRegisterCodeSent] = useState(false);
  const [resetEmailCode, setResetEmailCode] = useState("");
  const [resetCodeSent, setResetCodeSent] = useState(false);
  const [guestEmailCode, setGuestEmailCode] = useState("");
  const [guestCodeSent, setGuestCodeSent] = useState(false);
  const [sessionToken, setSessionToken] = useState(accountSession?.token);
  const [accountCharacterId, setAccountCharacterId] = useState(accountSession?.character.id);
  const [playerName, setPlayerName] = useState(accountSession?.character.name ?? launcherProfile.name);
  const initialClassId = normalizePlayableClass(accountSession?.character.classId ?? launcherProfile.classId);
  const [classId, setClassId] = useState<CharacterClass>(initialClassId);
  const [hotbar, setHotbar] = useState<Array<HotbarEntry | undefined>>(() => loadHotbar(initialClassId));
  const [assignSlot, setAssignSlot] = useState(0);
  const [cooldowns, setCooldowns] = useState<Record<string, { readyAt: number; duration: number }>>({});
  const [nowMs, setNowMs] = useState(Date.now());
  const [race, setRace] = useState<CharacterRace>(accountSession?.character.race ?? "human");
  const [face, setFace] = useState(accountSession?.character.face ?? 1);
  const [customHeadUrl, setCustomHeadUrl] = useState(accountSession?.character.customHeadUrl);
  const faceParts = useMemo(() => decodeFaceVariant(face), [face]);
  const activeMarkOptions = faceParts.gender === "female" ? femaleMarkOptions : markOptions;
  const [legacyCharacterId, setLegacyCharacterId] = useState(accountSession ? undefined : launcherProfile.legacyCharacterId);
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [saveHeroOpen, setSaveHeroOpen] = useState(false);
  const [saveHeroStatus, setSaveHeroStatus] = useState("");
  const [renameHeroOpen, setRenameHeroOpen] = useState(false);
  const [renameHeroStatus, setRenameHeroStatus] = useState("");
  const [headUploadStatus, setHeadUploadStatus] = useState("");
  const [headUploadBusy, setHeadUploadBusy] = useState(false);
  const [started, setStarted] = useState(Boolean(accountSession?.token && accountSession.character?.id));
  const [onlinePlayers, setOnlinePlayers] = useState<number>();
  const [playerId, setPlayerId] = useState<string>();
  const [snapshot, setSnapshot] = useState<GameSnapshot>();
  const [inventory, setInventory] = useState(defaultInventory);
  const [equipment, setEquipment] = useState<EquipmentState>(defaultEquipment);
  const [stats, setStats] = useState<DerivedStats>(defaultStats);
  const [profileOpen, setProfileOpen] = useState(false);
	  const [profileTab, setProfileTab] = useState<ProfileTab>("equipment");
	  const [shopOpen, setShopOpen] = useState(false);
	  const [teleportMenuOpen, setTeleportMenuOpen] = useState(false);
  const [vendorSellerId, setVendorSellerId] = useState<string>();
  const [marketPriceDraft, setMarketPriceDraft] = useState("");
  const [marketQuantityDraft, setMarketQuantityDraft] = useState("1");
  const [tradeGoldDraft, setTradeGoldDraft] = useState("0");
  const [tradeItemIndex, setTradeItemIndex] = useState<number>();
  const [tradeQuantityDraft, setTradeQuantityDraft] = useState("1");
	  const [interactionCityId, setInteractionCityId] = useState(CITY_DEFINITIONS[0].id);
  const [selectedMapCity, setSelectedMapCity] = useState<string>(CITY_DEFINITIONS[0].id);
  const [mapZoom, setMapZoom] = useState(DEFAULT_MAP_ZOOM);
  const worldMapRef = useRef<HTMLDivElement>(null);
  const mapDragRef = useRef<{ pointerId: number; startX: number; startY: number; scrollLeft: number; scrollTop: number; moved: boolean }>();
  const mapSuppressClickRef = useRef(false);
  const profileWindowRef = useRef<HTMLDivElement>(null);
	  const customHeadInputRef = useRef<HTMLInputElement>(null);
	  const shopWindowRef = useRef<HTMLDivElement>(null);
	  const teleportWindowRef = useRef<HTMLDivElement>(null);
  const vendorWindowRef = useRef<HTMLDivElement>(null);
  const tradeWindowRef = useRef<HTMLDivElement>(null);
	  const adminPanelRef = useRef<HTMLDivElement>(null);
  const [selectedBagIndex, setSelectedBagIndex] = useState<number>();
  const [selectedEquipmentSlot, setSelectedEquipmentSlot] = useState<EquipmentSlot>();
  const [gold, setGold] = useState(0);
  const [, setWalletState] = useState<WalletState>({ mode: "telegram-ton", connected: false, pendingToken: 0 });
  const [, setClaimStatus] = useState("25 gold = 1 TOKEN");
  const [premiumStatus, setPremiumStatus] = useState<PremiumStatus>();
  const [premiumPlan, setPremiumPlan] = useState<PremiumPlanId>("month");
  const [premiumBusy, setPremiumBusy] = useState(false);
  const [premiumMessage, setPremiumMessage] = useState("");
  const [coinPaymentStatus, setCoinPaymentStatus] = useState<CoinPaymentStatus>();
  const [coinPaymentBusy, setCoinPaymentBusy] = useState(false);
  const [coinPaymentMessage, setCoinPaymentMessage] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [chatChannel, setChatChannel] = useState<Exclude<ChatChannel, "system">>("local");
  const [chatOpen, setChatOpen] = useState(loadChatOpenDefault);
  const [chatToasts, setChatToasts] = useState<ChatMessage[]>([]);
  const [mobileLayout, setMobileLayout] = useState(detectMobileLayout);
  const [feedbackDraft, setFeedbackDraft] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("Saved reports are visible to admins in-game.");
  const [clanNameDraft, setClanNameDraft] = useState("");
  const [clanEmblem, setClanEmblem] = useState<ClanEmblem>("shield");
  const [clanStatus, setClanStatus] = useState("");
  const [mobileAutoTarget, setMobileAutoTarget] = useState(loadMobileAutoTarget);
  const [mobileGraphics, setMobileGraphics] = useState<MobileGraphicsSettings>(loadMobileGraphicsSettings);
  const [voiceEnabled, setVoiceEnabled] = useState(loadVoiceEnabled);
  const [voiceChannel, setVoiceChannel] = useState<VoiceChannel>(loadVoiceChannel);
  const [voiceState, setVoiceState] = useState<VoiceUiState>({
    supported: true,
    enabled: loadVoiceEnabled(),
    permission: "prompt",
    active: false,
    channel: loadVoiceChannel(),
    peers: [],
    remoteSpeakers: []
  });
  const [selectedTargetId, setSelectedTargetId] = useState<string>();
  const [localFacingOverrideDegrees, setLocalFacingOverrideDegrees] = useState<number>();
  const [adminState, setAdminState] = useState<AdminState>();
  const [adminOpen, setAdminOpen] = useState(false);
  const [selectedAdminPlayerId, setSelectedAdminPlayerId] = useState<string>();
  const [pathChallengeState, setPathChallengeState] = useState<StoredPathChallenges>(loadPathChallenges);
  const [storyQuestState, setStoryQuestState] = useState<StoredStoryQuestState>(loadStoryQuests);
  const [questCompleteCue, setQuestCompleteCue] = useState<QuestCompleteCue>();
  const [betaNoticeOpen, setBetaNoticeOpen] = useState(loadBetaNoticeOpen);
  const [pwaInstallPrompt, setPwaInstallPrompt] = useState<BeforeInstallPromptEvent>();
  const [pwaInstallVisible, setPwaInstallVisible] = useState(false);
  const [pwaInstallBusy, setPwaInstallBusy] = useState(false);
  const [pwaInstalled, setPwaInstalled] = useState(isStandalonePwa);
  const chatOpenRef = useRef(chatOpen);
  const chatToastTimerRef = useRef<number[]>([]);
  const questCompleteTimerRef = useRef<number>();
  const chatListRef = useRef<HTMLDivElement>(null);
  const chatDockRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const mobileLayoutRef = useRef(mobileLayout);
  const accountSessionRef = useRef(accountSession);
  const accountSessionRefreshRef = useRef<Promise<AccountSession | undefined>>();
  const walletAddress = disabledTonWalletAddress();
  const blockchainApiUrl = runtimeUrl(import.meta.env.VITE_BLOCKCHAIN_API_URL, "/blockchain");
  const authApiUrl = runtimeUrl(import.meta.env.VITE_AUTH_API_URL, "/auth");
  const gameApiUrl = runtimeUrl(import.meta.env.VITE_GAME_API_URL, "/game");
  const serverClock = formatServerClock(snapshot?.serverTime ?? nowMs, language);
  const claimableToken = Math.floor(gold / 25);
  const claimableGold = claimableToken * 25;
  const showManualPwaInstallHint = !pwaInstallPrompt && isPwaInstallContext() && isAppleMobileDevice();
  const showPwaInstallOffer = pwaInstallVisible && !pwaInstalled && Boolean(pwaInstallPrompt || showManualPwaInstallHint);
  const pwaInstallHint = pwaInstallPrompt ? "Open fullscreen from your home screen." : "Safari: Share, then Add to Home Screen.";

  const chooseLanguage = useCallback((nextLanguage: AppLanguage): void => {
    setLanguage(nextLanguage);
    saveLanguage(nextLanguage);
  }, []);

  useEffect(() => {
    saveLanguage(language);
  }, [language]);

  useEffect(() => {
    accountSessionRef.current = accountSession;
  }, [accountSession]);

  const renewAccountSession = useCallback(async (force = false): Promise<AccountSession | undefined> => {
    const current = accountSessionRef.current;
    if (!current?.token || current.authProvider !== "account") return undefined;
    if (!force && !accountSessionNeedsRefresh(current)) return current;
    if (accountSessionRefreshRef.current) return accountSessionRefreshRef.current;

    const refreshRequest = (async (): Promise<AccountSession | undefined> => {
      const response = await fetch(`${authApiUrl}/account/session/refresh`, {
        method: "POST",
        headers: { authorization: `Bearer ${current.token}` }
      });
      const payload = (await response.json()) as {
        token?: string;
        message?: string;
        player?: { character?: AccountSession["character"] };
      };
      if (!response.ok || !payload.token || !payload.player?.character) {
        throw new Error(payload.message || "Account session is required.");
      }

      if (accountSessionRef.current?.token !== current.token) return accountSessionRef.current;
      const refreshed: AccountSession = {
        ...current,
        token: payload.token,
        authProvider: "account",
        character: {
          ...payload.player.character,
          classId: normalizePlayableClass(payload.player.character.classId)
        }
      };
      accountSessionRef.current = refreshed;
      setAccountSession(refreshed);
      setSessionToken(refreshed.token);
      setAccountCharacterId(refreshed.character.id);
      saveAccountSession(refreshed);
      return refreshed;
    })();

    accountSessionRefreshRef.current = refreshRequest;
    try {
      return await refreshRequest;
    } finally {
      if (accountSessionRefreshRef.current === refreshRequest) accountSessionRefreshRef.current = undefined;
    }
  }, [authApiUrl]);

  const fetchWithAccountSession = useCallback(async (path: string, init?: RequestInit): Promise<Response> => {
    let session = await renewAccountSession(false);
    if (!session) throw new Error("Account session is required.");

    const send = (token: string): Promise<Response> => {
      const headers = new Headers(init?.headers);
      headers.set("authorization", `Bearer ${token}`);
      return fetch(`${authApiUrl}${path}`, { ...init, headers });
    };

    let response = await send(session.token);
    if (response.status === 401) {
      session = await renewAccountSession(true);
      if (!session) throw new Error("Account session is required.");
      response = await send(session.token);
    }
    return response;
  }, [authApiUrl, renewAccountSession]);

  const characterId = useMemo(() => accountCharacterId ?? legacyCharacterId ?? characterIdFor(playerName, classId), [accountCharacterId, legacyCharacterId, playerName, classId]);
  const localPlayer = snapshot?.players.find((player) => player.id === playerId);
  const snapshotFacingDegrees = localPlayer ? Math.atan2(localPlayer.facing.y, localPlayer.facing.x) * (180 / Math.PI) + 90 : 0;
  const localFacingDegrees = localFacingOverrideDegrees ?? snapshotFacingDegrees;
  const mapUsesReactFacing = profileOpen && profileTab === "map";
  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<LocalFacingEventDetail>).detail;
      const degrees = Number.isFinite(detail?.degrees)
        ? Number(detail.degrees)
        : Number.isFinite(detail?.x) && Number.isFinite(detail?.y)
          ? Math.atan2(Number(detail.y), Number(detail.x)) * (180 / Math.PI) + 90
          : undefined;
      if (degrees === undefined || !Number.isFinite(degrees)) {
        return;
      }

      const normalized = ((degrees % 360) + 360) % 360;
      document.documentElement.style.setProperty("--mmo-local-facing-deg", `${normalized}deg`);
      if (!mapUsesReactFacing) {
        return;
      }
      setLocalFacingOverrideDegrees((previous) => {
        if (previous === undefined) {
          return normalized;
        }
        const delta = Math.abs(((normalized - previous + 540) % 360) - 180);
        return delta < 0.35 ? previous : normalized;
      });
    };

    window.addEventListener("mmo:localFacing", listener);
    return () => window.removeEventListener("mmo:localFacing", listener);
  }, [mapUsesReactFacing]);
  useEffect(() => {
    if (!localPlayer) {
      document.documentElement.style.removeProperty("--mmo-local-facing-deg");
      setLocalFacingOverrideDegrees(undefined);
    }
  }, [localPlayer?.id]);
  useEffect(() => {
    if (!mapUsesReactFacing) {
      setLocalFacingOverrideDegrees(undefined);
    }
  }, [mapUsesReactFacing]);
  const canUseSinging = localPlayer ? localPlayer.name.trim().toLowerCase() === "kirs" : false;
  const rawLocationBanner = useMemo(
    () => locationBannerForPosition(localPlayer?.position),
    [localPlayer?.position.x, localPlayer?.position.y]
  );
  const [locationBanner, setLocationBanner] = useState<LocationBanner | undefined>(rawLocationBanner);
  const classDef = CLASS_DEFINITIONS[classId];
  const activeClassDef = localPlayer ? CLASS_DEFINITIONS[localPlayer.classId] : classDef;
  const guestSessionActive = accountSession?.authProvider === "guest";
  const accountHeroNeedsName = accountSession?.authProvider === "account" && isGeneratedPlayerName(accountSession.character.name);
  const selectedPlayer = snapshot?.players.find((player) => player.id === selectedTargetId && player.id !== playerId && player.hp > 0);
  const selectedMonster = snapshot?.monsters.find((monster) => monster.id === selectedTargetId && monster.hp > 0);
  const selectedTarget = selectedMonster ?? selectedPlayer;
  const selectedTargetTitle = selectedMonster ? monsterLabel(selectedMonster.archetype) : selectedPlayer?.name;
  const selectedTargetSubtitle = selectedMonster
    ? `${tr("Lv.")}${selectedMonster.level}`
	    : selectedPlayer
	      ? `${tr(CLASS_DEFINITIONS[selectedPlayer.classId].label)} · ${tr("Lv.")}${selectedPlayer.level}${selectedPlayer.clanTag ? ` · ${selectedPlayer.clanTag}` : ""}${selectedPlayer.marketVendor?.items.length ? ` · ${tr("Selling")}` : ""}`
      : "";
  const selectedTargetHasCp = Boolean(selectedPlayer && selectedPlayer.maxCp > 0);
  const partyMembers = useMemo(
    () => (localPlayer?.partyId ? (snapshot?.players ?? []).filter((player) => player.partyId === localPlayer.partyId) : []),
    [localPlayer?.partyId, snapshot?.players]
  );
  const canUsePartyVoice = partyMembers.length > 1;
  const effectiveVoiceChannel: VoiceChannel = voiceChannel === "party" && canUsePartyVoice ? "party" : "nearby";
  const voicePeerCount = voiceState.active ? voiceState.peers.length : voiceState.remoteSpeakers.length;
  const voiceStatusText = !voiceState.supported
    ? "No voice"
    : !voiceEnabled
      ? "Mic off"
      : voiceState.active
        ? `${voiceState.channel === "party" ? "Party" : "Near"} ${voicePeerCount}`
        : voiceState.remoteSpeakers.length > 0
          ? voiceState.remoteSpeakers.slice(0, 2).map((speaker) => speaker.name).join(", ")
          : effectiveVoiceChannel === "party"
            ? "Party"
            : "Near";
  const voiceStatusDisplay =
    !voiceState.active && voiceState.remoteSpeakers.length > 0
      ? voiceStatusText
      : tr(voiceStatusText);
  const partyVitalWidth = (value: number, max: number, min = 3) => `${max > 0 && value > 0 ? Math.min(100, Math.max(min, (value / max) * 100)) : 0}%`;
	  const incomingPartyInvite = snapshot?.partyInvites?.[0];
	  const incomingDuelInvite = snapshot?.duelInvites?.[0];
  const incomingTradeInvite = snapshot?.tradeInvites?.[0];
	  const incomingClanInvites = snapshot?.clanInvites ?? [];
  const clans = snapshot?.clans ?? [];
  const localClan = localPlayer?.clanId ? clans.find((clan) => clan.id === localPlayer.clanId) : undefined;
  const localClanMember = localClan?.members.find((member) => member.characterId === characterId || member.playerId === localPlayer?.id);
  const localClanIsLeader = localClanMember?.role === "leader";
  const selectedPlayerClan = selectedPlayer?.clanId ? clans.find((clan) => clan.id === selectedPlayer.clanId) : undefined;
  const serverNow = snapshot?.serverTime ?? nowMs;
  const showMiniRadar = true;
  const miniRadarRange = MINI_RADAR_RANGE;
  const miniRadarPlayerRange = MINI_RADAR_PLAYER_RANGE;
  const completedStoryQuestIds = new Set(storyQuestState.completedQuestIds ?? []);
  const activeStoryQuest = storyQuestChain.find((quest) => quest.id === storyQuestState.activeQuestId && !completedStoryQuestIds.has(quest.id));
  const nextStoryQuest = storyQuestChain.find((quest) => !completedStoryQuestIds.has(quest.id));
  const visibleStoryQuest = activeStoryQuest ?? nextStoryQuest;
  const activeStoryBaseline = activeStoryQuest ? storyQuestState.baselines?.[activeStoryQuest.id] ?? questBaselineFor(localPlayer) : undefined;
  const activeStoryProgress = activeStoryQuest && activeStoryBaseline ? storyQuestProgress(activeStoryQuest, localPlayer, activeStoryBaseline) : undefined;
  const activeQuestTarget = activeStoryQuest?.target;
  const activeQuestProgressPercent = activeStoryProgress ? Math.min(100, Math.max(0, (activeStoryProgress.progress / Math.max(1, activeStoryProgress.goal)) * 100)) : 0;
  const activeQuestProgressText = activeStoryProgress?.valueText ?? "";
  const activeQuestProgressLabel =
    activeStoryQuest && activeStoryProgress
      ? activeStoryQuest.objective.kind === "monster"
        ? `${monsterQuestLabels[activeStoryQuest.objective.archetype]} killed`
        : activeStoryQuest.objective.kind === "level"
          ? "Character level"
          : activeStoryQuest.objective.kind === "arenaWins"
            ? "Arena wins"
            : "PK count"
      : "";
  const questTargetVector =
    localPlayer && activeQuestTarget
      ? {
          dx: activeQuestTarget.position.x - localPlayer.position.x,
          dy: activeQuestTarget.position.y - localPlayer.position.y
        }
      : undefined;
  useMobileGameWakeLock(started && mobileLayout);
  const questTargetDistance = questTargetVector ? Math.hypot(questTargetVector.dx, questTargetVector.dy) : undefined;
  const questTargetAngle = questTargetVector ? Math.atan2(questTargetVector.dy, questTargetVector.dx) : 0;
  const questRadarPoint =
    questTargetVector && questTargetDistance !== undefined
      ? (() => {
          const safeDistance = Math.max(1, questTargetDistance);
          const edgeRatio = Math.min(1, questTargetDistance / miniRadarRange);
          return {
            x: 50 + (questTargetVector.dx / safeDistance) * MINI_RADAR_EDGE_PERCENT * edgeRatio,
            y: 50 + (questTargetVector.dy / safeDistance) * MINI_RADAR_EDGE_PERCENT * edgeRatio,
            distance: questTargetDistance,
            outOfRange: questTargetDistance > miniRadarRange
          };
        })()
      : undefined;
  const miniRadarPlayers = useMemo(() => {
    if (!localPlayer || !showMiniRadar) {
      return [];
    }

    return (snapshot?.players ?? [])
      .filter((player) => player.id !== localPlayer.id && player.hp > 0)
      .map((player) => {
        const dx = player.position.x - localPlayer.position.x;
        const dy = player.position.y - localPlayer.position.y;
        const distance = Math.hypot(dx, dy);
        const safeDistance = Math.max(1, distance);
        const edgeRatio = Math.min(1, distance / miniRadarPlayerRange);
        const clanmate = Boolean(localPlayer.clanId && player.clanId === localPlayer.clanId);
        const partyMate = Boolean(localPlayer.partyId && player.partyId === localPlayer.partyId);
        const dangerous = player.karma > 0 || Boolean(player.pvpFlagUntil && player.pvpFlagUntil > serverNow);
        return {
          id: player.id,
          name: player.name,
          distance,
          x: 50 + (dx / safeDistance) * MINI_RADAR_EDGE_PERCENT * edgeRatio,
          y: 50 + (dy / safeDistance) * MINI_RADAR_EDGE_PERCENT * edgeRatio,
          outOfRange: false,
          relation: clanmate ? "clan" : partyMate ? "party" : dangerous ? "danger" : "player"
        };
      })
      .filter((entry) => entry.distance <= miniRadarPlayerRange)
      .sort((first, second) => first.distance - second.distance)
      .slice(0, MINI_RADAR_MAX_PLAYERS);
  }, [
    localPlayer?.clanId,
    localPlayer?.id,
    localPlayer?.partyId,
    localPlayer?.position.x,
    localPlayer?.position.y,
    miniRadarPlayerRange,
    serverNow,
    showMiniRadar,
    snapshot?.players
  ]);
  const miniRadarClanCount = miniRadarPlayers.filter((entry) => entry.relation === "clan").length;
  const localPvpFlagRemainingMs = Math.max(0, (localPlayer?.pvpFlagUntil ?? 0) - serverNow);
  const localPvpFlagged = localPvpFlagRemainingMs > 0;
  const localPvpFlagFading = localPvpFlagged && localPvpFlagRemainingMs <= pvpFlagUiFadeMs;
  const localNameState = localPlayer?.karma ? "redName" : localPvpFlagged ? `pinkName${localPvpFlagFading ? " pvpNameFading" : ""}` : "";
  const localPlayerNameKey = localPlayer?.name.trim().toLowerCase();
  const isAdmin = localPlayerNameKey === "unit" || localPlayerNameKey === "houston";
  const selectedAdminPlayer = adminState?.players.find((player) => player.id === selectedAdminPlayerId) ?? adminState?.players[0];
  const visibleProfileTabs = useMemo(() => profileTabs.filter((tab) => tab.id !== "admin" || isAdmin), [isAdmin]);
  const currentLevel = localPlayer?.level ?? 1;
  const nextLevelXp = xpForNextLevel(currentLevel);
  const skillPoints = Math.max(0, currentLevel - 1);
  const mobileSkillHotbar = useMemo<Array<HotbarEntry>>(
    () => {
      const classSkillIds = new Set(activeClassDef.skills.map((skill) => skill.id));
      const seen = new Set<string>();
      const configuredSkills = hotbar.flatMap((entry) => {
        if (entry?.type !== "skill" || !classSkillIds.has(entry.skillId) || seen.has(entry.skillId)) {
          return [];
        }
        seen.add(entry.skillId);
        return [entry];
      });
      const skillEntries = configuredSkills.length > 0 ? configuredSkills : activeClassDef.skills.map((skill) => ({ type: "skill" as const, skillId: skill.id }));
      return [{ type: "attack" as const }, ...skillEntries];
    },
    [activeClassDef, hotbar]
  );
  const visibleHotbar: Array<HotbarEntry | undefined> = (mobileLayout ? mobileSkillHotbar : hotbar).map((entry) =>
    entry?.type === "sprint" && !isAdmin ? undefined : entry
  );
  const selectedBagItem = selectedBagIndex === undefined ? undefined : inventory[selectedBagIndex];
  const selectedEquipmentItem = selectedEquipmentSlot ? equipment[selectedEquipmentSlot] : undefined;
  const selectedGearItem = selectedEquipmentItem ?? selectedBagItem;
  const selectedGearSlot = selectedEquipmentItem ? selectedEquipmentSlot : selectedBagItem?.slot;
  const selectedBagEquipSlot = preferredEquipSlot(selectedBagItem, equipment);
  const selectedEnchantCap = itemEnchantCap(selectedGearItem);
  const selectedEnchantScrollIds = enchantScrollIdsForItem(selectedGearItem);
  const selectedEnchantScrollCount = selectedEnchantScrollIds.reduce((sum, scrollId) => sum + (inventory.find((item) => item.id === scrollId)?.quantity ?? 0), 0);
  const selectedEnchantScrollLabel =
    selectedGearItem && selectedEnchantCap > 0
      ? `${itemGradeText(selectedGearItem.grade)} ${selectedGearItem.slot === "weapon" ? "weapon" : "armor"} scrolls`
      : "";
  const inventoryQuantity = useCallback((itemId: string) => inventory.find((item) => item.id === itemId)?.quantity ?? 0, [inventory]);
  const coinCount = inventoryQuantity("arena-coin");
  const pvpCoinCount = inventoryQuantity("pvp-coin");
  const activeShopCity =
    localPlayer?.position
      ? CITY_DEFINITIONS.reduce((best, city) => {
          const bestDistance = Math.hypot(best.position.x - localPlayer.position.x, best.position.y - localPlayer.position.y);
          const cityDistance = Math.hypot(city.position.x - localPlayer.position.x, city.position.y - localPlayer.position.y);
          return cityDistance < bestDistance ? city : best;
        }, CITY_DEFINITIONS[0])
      : CITY_DEFINITIONS[0];
  const interactionCity = CITY_DEFINITIONS.find((city) => city.id === interactionCityId) ?? activeShopCity;
  const teleportOptions = useMemo(
    () =>
      TELEPORT_DEFINITIONS.filter((teleport) => teleport.sourceCityId === interactionCity.id).sort((first, second) => {
        const firstDestination = teleportDestinationMeta(first);
        const secondDestination = teleportDestinationMeta(second);
        return (
          firstDestination.priority - secondDestination.priority ||
          firstDestination.level - secondDestination.level ||
          firstDestination.label.localeCompare(secondDestination.label)
        );
      }),
    [interactionCity.id]
  );
	  const safeTeleportOptions = useMemo(() => teleportOptions.filter((teleport) => {
    const kindClass = teleportDestinationMeta(teleport).kindClass;
    return kindClass === "city" || kindClass === "trade";
  }), [teleportOptions]);
	  const adventureTeleportOptions = useMemo(() => teleportOptions.filter((teleport) => {
    const kindClass = teleportDestinationMeta(teleport).kindClass;
    return kindClass !== "city" && kindClass !== "trade";
  }), [teleportOptions]);
	  const canUseShop = localPlayer?.zone === "safe";
  const isAtMarket = Boolean(canUseShop && activeShopCity.id === "market");
  const activeVendorSeller = snapshot?.players.find((player) => player.id === vendorSellerId && player.marketVendor?.items.length);
  const localMarketVendor = localPlayer?.marketVendor?.playerOwned ? localPlayer.marketVendor : undefined;
  const activeTrade = snapshot?.activeTrade;
  const tradeSelfOffer = activeTrade
    ? activeTrade.left.playerId === playerId
      ? activeTrade.left
      : activeTrade.right.playerId === playerId
        ? activeTrade.right
        : undefined
    : undefined;
  const tradePeerOffer = activeTrade && tradeSelfOffer ? (activeTrade.left.playerId === tradeSelfOffer.playerId ? activeTrade.right : activeTrade.left) : undefined;
  const marketListingQuantity = selectedBagItem?.stackable
    ? Math.max(1, Math.min(selectedBagItem.quantity, Math.trunc(Number(marketQuantityDraft) || 1)))
    : 1;
  const marketDefaultPrice = selectedBagItem ? Math.max(1, Math.round(itemSellValue(selectedBagItem) * marketListingQuantity * 1.65)) : 1;
  const marketListingPrice = Math.max(1, Math.trunc(Number(marketPriceDraft) || marketDefaultPrice));
  const tradeSelectedItem = tradeItemIndex === undefined ? undefined : inventory[tradeItemIndex];
  const tradeSelectedQuantity = tradeSelectedItem?.stackable
    ? Math.max(1, Math.min(tradeSelectedItem.quantity, Math.trunc(Number(tradeQuantityDraft) || 1)))
    : 1;
	  const shopOffers = useMemo(
    () =>
      [...SHOP_CATALOG].sort((first, second) => {
        const firstClassScore = first.item.classId && first.item.classId !== activeClassDef.id ? 1 : 0;
        const secondClassScore = second.item.classId && second.item.classId !== activeClassDef.id ? 1 : 0;
        const firstGradeScore = shopGradeSortScore(first.item);
        const secondGradeScore = shopGradeSortScore(second.item);
        const firstPrice = first.priceItemQuantity ?? first.priceGold;
        const secondPrice = second.priceItemQuantity ?? second.priceGold;
        return (
          firstClassScore - secondClassScore ||
          firstGradeScore - secondGradeScore ||
          (first.item.requiredLevel ?? 1) - (second.item.requiredLevel ?? 1) ||
          firstPrice - secondPrice
        );
      }),
    [activeClassDef.id]
  );
  const nearbyDownedPlayers = useMemo(
    () =>
      localPlayer && localPlayer.hp > 0
        ? (snapshot?.players ?? []).filter(
            (player) =>
              player.id !== localPlayer.id &&
              player.downed &&
              Math.hypot(player.position.x - localPlayer.position.x, player.position.y - localPlayer.position.y) <= 135
          )
        : [],
    [localPlayer?.hp, localPlayer?.id, localPlayer?.position.x, localPlayer?.position.y, snapshot?.players]
  );
  const nearbyGroundItems = useMemo(
    () =>
      localPlayer && localPlayer.hp > 0
        ? (snapshot?.groundItems ?? [])
            .map((item) => ({
              item,
              distance: Math.hypot(item.position.x - localPlayer.position.x, item.position.y - localPlayer.position.y)
            }))
            .filter((entry) => entry.distance <= groundItemPickupUiRange)
            .sort((first, second) => first.distance - second.distance)
        : [],
    [localPlayer?.hp, localPlayer?.position.x, localPlayer?.position.y, snapshot?.groundItems]
  );
  const arenaSeason = snapshot?.arenaSeason;
  const localArenaRating = localPlayer?.arenaRating ?? 1000;
  const challengeClock = snapshot?.serverTime ?? nowMs;
  const challengeKeys = challengeTimeKeys(challengeClock);
  const challengeIdentity = `${characterId}:${challengeKeys.daily}:${challengeKeys.hourly}`;
  const hourlyBaselineKey = `${characterId}:hourly:${challengeKeys.hourly}`;
  const dailyBaselineKey = `${characterId}:daily:${challengeKeys.daily}`;
  const challengeStats = useMemo<ChallengeStats>(
    () => ({
      xp: totalXpProgress(currentLevel, localPlayer?.xp ?? 0),
      gold: gold || localPlayer?.gold || 0,
      coin: coinCount + pvpCoinCount,
      arenaWins: localPlayer?.arenaWins ?? 0,
      level: currentLevel,
      gear: equipmentPower(equipment)
    }),
    [coinCount, pvpCoinCount, currentLevel, equipment, gold, localPlayer?.arenaWins, localPlayer?.gold, localPlayer?.xp]
  );
  const hourlyChallenges = useMemo(() => pickChallengeSet(hourlyChallengePool, `${characterId}:${challengeKeys.hourly}`, 3), [challengeKeys.hourly, characterId]);
  const dailyChallenges = useMemo(() => pickChallengeSet(dailyChallengePool, `${characterId}:${challengeKeys.daily}`, 4), [challengeKeys.daily, characterId]);
  const guideSteps = [...hourlyChallenges, ...dailyChallenges].map((challenge) => {
    const baseline = pathChallengeState.baselines?.[challenge.period === "hourly" ? hourlyBaselineKey : dailyBaselineKey] ?? challengeStats;
    const progress = Math.max(0, challengeStats[challenge.metric] - baseline[challenge.metric]);
    return {
      ...challenge,
      progress,
      done: progress >= challenge.goal
    };
  });
  const nextGuideStep = guideSteps.find((step) => !step.done);
  const hourlyDone = guideSteps.filter((step) => step.period === "hourly" && step.done).length;
  const dailyDone = guideSteps.filter((step) => step.period === "daily" && step.done).length;
  const hourlyGuideSteps = guideSteps.filter((step) => step.period === "hourly");
  const dailyGuideSteps = guideSteps.filter((step) => step.period === "daily");
  const hourlyResetText = formatCountdown(challengeKeys.nextHourlyAt - challengeClock, language);
  const dailyResetText = formatCountdown(challengeKeys.nextDailyAt - challengeClock, language);
  const selectedCity = CITY_DEFINITIONS.find((city) => city.id === selectedMapCity) ?? CITY_DEFINITIONS[0];
  const mapMarkerScale = Math.max(0.005, Math.min(1, Number((3.15 / Math.max(1, mapZoom)).toFixed(4))));
  const mapPlayerScale = Math.max(0.002, Math.min(1, Number((1.45 / Math.max(1, mapZoom)).toFixed(4))));
  const mapRegionScale = Math.max(0.003, Math.min(1, Number((1.75 / Math.max(1, mapZoom)).toFixed(4))));
  const mapRegionLabelOpacity = mapZoom >= 8 ? 0.18 : mapZoom >= 4 ? 0.28 : 0.42;
  const mapHuntingLabelOpacity = mapZoom >= 3 ? 0.86 : mapZoom >= 2 ? 0.35 : 0;
  const mapHuntingLabelScale = Math.max(0.004, Math.min(0.92, Number((1.9 / Math.max(1, mapZoom)).toFixed(4))));
  const mapArenaDetailOpacity = mapZoom >= 1.4 ? 0.72 : 0.46;
  const mapArenaGateLabelOpacity = mapZoom >= 2.2 ? 0.9 : 0;

  function centerWorldMapOnPosition(position: { x: number; y: number }, behavior: ScrollBehavior = "smooth"): void {
    const mapElement = worldMapRef.current;
    if (!mapElement) {
      return;
    }

    const rawLeft = (position.x / WORLD_BOUNDS.width) * mapElement.scrollWidth - mapElement.clientWidth / 2;
    const rawTop = (position.y / WORLD_BOUNDS.height) * mapElement.scrollHeight - mapElement.clientHeight / 2;
    const maxLeft = Math.max(0, mapElement.scrollWidth - mapElement.clientWidth);
    const maxTop = Math.max(0, mapElement.scrollHeight - mapElement.clientHeight);

    mapElement.scrollTo({
      left: Math.max(0, Math.min(rawLeft, maxLeft)),
      top: Math.max(0, Math.min(rawTop, maxTop)),
      behavior
    });
  }

  function centerWorldMapOnPlayer(behavior: ScrollBehavior = "smooth"): void {
    if (!localPlayer) {
      return;
    }

    centerWorldMapOnPosition(localPlayer.position, behavior);
  }

  function updateMapZoom(nextZoom: number, anchor?: { clientX: number; clientY: number }): void {
    const clampedZoom = clampMapZoom(nextZoom);
    const mapElement = worldMapRef.current;
    const rect = mapElement?.getBoundingClientRect();
    const anchorScreenX = anchor && rect ? anchor.clientX - rect.left : mapElement ? mapElement.clientWidth / 2 : 0;
    const anchorScreenY = anchor && rect ? anchor.clientY - rect.top : mapElement ? mapElement.clientHeight / 2 : 0;
    const anchorX = mapElement ? (mapElement.scrollLeft + anchorScreenX) / Math.max(1, mapElement.scrollWidth) : 0.5;
    const anchorY = mapElement ? (mapElement.scrollTop + anchorScreenY) / Math.max(1, mapElement.scrollHeight) : 0.5;

    setMapZoom(clampedZoom);

    window.requestAnimationFrame(() => {
      const nextMapElement = worldMapRef.current;
      if (!nextMapElement) {
        return;
      }

      nextMapElement.scrollTo({
        left: Math.max(0, anchorX * nextMapElement.scrollWidth - anchorScreenX),
        top: Math.max(0, anchorY * nextMapElement.scrollHeight - anchorScreenY),
        behavior: "auto"
      });
    });
  }

  function handleWorldMapPointerDown(event: ReactPointerEvent<HTMLDivElement>): void {
    if (event.button !== 0 && event.pointerType === "mouse") {
      return;
    }

    const mapElement = worldMapRef.current;
    if (!mapElement) {
      return;
    }

    mapDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: mapElement.scrollLeft,
      scrollTop: mapElement.scrollTop,
      moved: false
    };
    mapElement.setPointerCapture?.(event.pointerId);
    mapElement.classList.add("draggingWorldMap");
  }

  function handleWorldMapPointerMove(event: ReactPointerEvent<HTMLDivElement>): void {
    const drag = mapDragRef.current;
    const mapElement = worldMapRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !mapElement) {
      return;
    }

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) > 3) {
      drag.moved = true;
    }
    if (drag.moved) {
      mapElement.scrollLeft = drag.scrollLeft - dx;
      mapElement.scrollTop = drag.scrollTop - dy;
      event.preventDefault();
    }
  }

  function finishWorldMapDrag(event: ReactPointerEvent<HTMLDivElement>): void {
    const drag = mapDragRef.current;
    const mapElement = worldMapRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    mapSuppressClickRef.current = drag.moved;
    mapDragRef.current = undefined;
    mapElement?.releasePointerCapture?.(event.pointerId);
    mapElement?.classList.remove("draggingWorldMap");
    if (drag.moved) {
      window.setTimeout(() => {
        mapSuppressClickRef.current = false;
      }, 0);
    }
  }

  function handleWorldMapClickCapture(event: ReactMouseEvent<HTMLDivElement>): void {
    if (!mapSuppressClickRef.current) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    mapSuppressClickRef.current = false;
  }

  function handleWorldMapWheel(event: ReactWheelEvent<HTMLDivElement>): void {
    if (!event.ctrlKey && !event.metaKey && !event.altKey) {
      return;
    }

    event.preventDefault();
    updateMapZoom(event.deltaY < 0 ? zoomMapIn(mapZoom) : zoomMapOut(mapZoom), { clientX: event.clientX, clientY: event.clientY });
  }

  useEffect(() => {
    setHotbar(loadHotbar(classId));
  }, [classId]);

  useEffect(() => {
    saveHotbar(classId, hotbar);
  }, [classId, hotbar]);

  useEffect(() => {
    const nextKey = rawLocationBanner?.key;
    if (nextKey === locationBanner?.key) {
      return;
    }

    const delay = locationBanner ? 850 : 0;
    const timer = window.setTimeout(() => {
      setLocationBanner(rawLocationBanner);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [locationBanner?.key, rawLocationBanner?.key, rawLocationBanner?.label, rawLocationBanner?.subtitle]);

  useEffect(() => {
    if (selectedBagIndex !== undefined && selectedBagIndex >= inventory.length) {
      setSelectedBagIndex(undefined);
    }
  }, [inventory.length, selectedBagIndex]);

  useEffect(() => {
    if (localPlayer) {
      setGold(localPlayer.gold);
    }
  }, [localPlayer?.gold]);

  const refreshPremiumStatus = useCallback(async () => {
    if (!accountSession?.token || accountSession.authProvider !== "account") {
      setPremiumStatus(undefined);
      return;
    }
    try {
      const response = await fetchWithAccountSession("/premium/status");
      const payload = (await response.json()) as PremiumStatus & { message?: string };
      if (!response.ok) throw new Error(payload.message || "Could not load Premium status.");
      setPremiumStatus(payload);
      // A pending card-link attempt may still carry the previously selected
      // plan. Do not let the 3-second status poll overwrite a new manual choice
      // before the player presses the activation button.
      if (payload.planId && payload.status !== "pending") setPremiumPlan(payload.planId);
      setPremiumMessage((previous) => isAccountSessionMessage(previous) ? "" : previous);
    } catch (error) {
      setPremiumMessage(error instanceof Error ? error.message : "Could not load Premium status.");
    }
  }, [accountSession?.authProvider, accountSession?.token, fetchWithAccountSession]);

  useEffect(() => {
    if (!started || !accountSession?.token || accountSession.authProvider !== "account") return undefined;
    void refreshPremiumStatus();
    const query = new URLSearchParams(window.location.search);
    if (query.get("premium") === "success") {
      setPremiumMessage("Card linked. Premium activation is being confirmed.");
      window.setTimeout(() => void refreshPremiumStatus(), 1800);
    } else if (query.get("premium") === "fail") {
      setPremiumMessage("Card linking was canceled.");
    }
    const timer = window.setInterval(() => void refreshPremiumStatus(), 60_000);
    return () => window.clearInterval(timer);
  }, [accountSession?.authProvider, accountSession?.token, refreshPremiumStatus, started]);

  useEffect(() => {
    if (premiumStatus?.status !== "pending") return;
    const timer = window.setInterval(() => void refreshPremiumStatus(), 3_000);
    return () => window.clearInterval(timer);
  }, [premiumStatus?.status, refreshPremiumStatus]);

  const refreshCoinPaymentStatus = useCallback(async () => {
    if (!accountSession?.token || accountSession.authProvider !== "account") {
      setCoinPaymentStatus(undefined);
      return;
    }
    try {
      const response = await fetchWithAccountSession("/coin-shop/status");
      const payload = (await response.json()) as CoinPaymentStatus & { message?: string };
      if (!response.ok) throw new Error(payload.message || "Could not load Coin payment status.");
      setCoinPaymentStatus(payload);
      if (payload.status === "paid") setCoinPaymentMessage("Payment confirmed. 1 Coin has been added to your hero.");
      if (payload.status === "failed") setCoinPaymentMessage(payload.lastError || "Payment was declined by the bank.");
    } catch (error) {
      setCoinPaymentMessage(error instanceof Error ? error.message : "Could not load Coin payment status.");
    }
  }, [accountSession?.authProvider, accountSession?.token, fetchWithAccountSession]);

  useEffect(() => {
    if (!started || !accountSession?.token || accountSession.authProvider !== "account") return undefined;
    void refreshCoinPaymentStatus();
    const query = new URLSearchParams(window.location.search);
    if (query.get("coinPayment") === "success") {
      setCoinPaymentMessage("Payment is being confirmed. Coin will arrive automatically.");
      window.setTimeout(() => void refreshCoinPaymentStatus(), 1_500);
    } else if (query.get("coinPayment") === "fail") {
      setCoinPaymentMessage("Payment was not completed.");
    }
    const timer = window.setInterval(() => void refreshCoinPaymentStatus(), 60_000);
    return () => window.clearInterval(timer);
  }, [accountSession?.authProvider, accountSession?.token, refreshCoinPaymentStatus, started]);

  useEffect(() => {
    if (coinPaymentStatus?.status !== "pending") return;
    const timer = window.setInterval(() => void refreshCoinPaymentStatus(), 3_000);
    return () => window.clearInterval(timer);
  }, [coinPaymentStatus?.status, refreshCoinPaymentStatus]);

  useEffect(() => {
    if (!profileOpen || profileTab !== "map" || !localPlayer) {
      return undefined;
    }

    const frame = window.requestAnimationFrame(() => centerWorldMapOnPlayer("auto"));
    return () => window.cancelAnimationFrame(frame);
  }, [profileOpen, profileTab, localPlayer?.id]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), mobileLayout ? 1000 : 120);
    return () => window.clearInterval(timer);
  }, [mobileLayout]);

  useEffect(() => {
    if (started) {
      return undefined;
    }

    let cancelled = false;
    const loadOnline = async () => {
      try {
        const response = await fetch(`${gameApiUrl}/health`, { cache: "no-store" });
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as { players?: unknown };
        if (!cancelled && typeof payload.players === "number") {
          setOnlinePlayers(payload.players);
        }
      } catch {
        // The launcher can still work when the health endpoint is temporarily unreachable.
      }
    };

    void loadOnline();
    const timer = window.setInterval(() => void loadOnline(), 15000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [gameApiUrl, started]);

  useEffect(() => {
    const markInstalled = () => {
      setPwaInstalled(true);
      setPwaInstallPrompt(undefined);
      setPwaInstallVisible(false);
      clearPwaInstallSnooze();
    };

    const syncStandalone = () => {
      if (isStandalonePwa()) {
        markInstalled();
      }
    };

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setPwaInstalled(false);
      setPwaInstallPrompt(event as BeforeInstallPromptEvent);
      if (!isPwaInstallSnoozed()) {
        setPwaInstallVisible(true);
      }
    };

    const standaloneQuery = window.matchMedia("(display-mode: standalone)");
    const canUseMediaQueryEventListener = typeof standaloneQuery.addEventListener === "function";
    const iosOfferTimer = window.setTimeout(() => {
      if (!isStandalonePwa() && !isPwaInstallSnoozed() && isPwaInstallContext() && isAppleMobileDevice()) {
        setPwaInstallVisible(true);
      }
    }, started ? 3200 : 900);

    syncStandalone();
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", markInstalled);
    if (canUseMediaQueryEventListener) {
      standaloneQuery.addEventListener("change", syncStandalone);
    } else {
      standaloneQuery.addListener(syncStandalone);
    }

    return () => {
      window.clearTimeout(iosOfferTimer);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", markInstalled);
      if (canUseMediaQueryEventListener) {
        standaloneQuery.removeEventListener("change", syncStandalone);
      } else {
        standaloneQuery.removeListener(syncStandalone);
      }
    };
  }, [started]);

  useEffect(() => {
    savePathChallenges(pathChallengeState);
  }, [pathChallengeState]);

  useEffect(() => {
    saveStoryQuests(storyQuestState);
  }, [storyQuestState]);

  useEffect(() => {
    if (!localPlayer) {
      return;
    }

    setPathChallengeState((current) => {
      const baselines = { ...(current.baselines ?? {}) };
      let changed = false;
      if (!baselines[hourlyBaselineKey]) {
        baselines[hourlyBaselineKey] = challengeStats;
        changed = true;
      }
      if (!baselines[dailyBaselineKey]) {
        baselines[dailyBaselineKey] = challengeStats;
        changed = true;
      }
      if (current.seenKey !== challengeIdentity) {
        changed = true;
        return {
          ...current,
          baselines,
          collapsed: true,
          seenKey: challengeIdentity
        };
      }
      return changed ? { ...current, baselines } : current;
    });
  }, [challengeIdentity, challengeStats, dailyBaselineKey, hourlyBaselineKey, localPlayer]);

  useEffect(() => {
    if (!localPlayer || !storyQuestState.activeQuestId) {
      return;
    }

    setStoryQuestState((current) => {
      const activeId = current.activeQuestId;
      if (!activeId || current.baselines?.[activeId]) {
        return current;
      }

      return {
        ...current,
        baselines: {
          ...(current.baselines ?? {}),
          [activeId]: questBaselineFor(localPlayer)
        }
      };
    });
  }, [localPlayer, storyQuestState.activeQuestId]);

  useEffect(() => {
    if (!localPlayer || storyQuestState.activeQuestId || !nextStoryQuest) {
      return;
    }

    setStoryQuestState((current) => {
      if (current.activeQuestId || current.completedQuestIds?.includes(nextStoryQuest.id)) {
        return current;
      }

      return {
        ...current,
        activeQuestId: nextStoryQuest.id,
        baselines: {
          ...(current.baselines ?? {}),
          [nextStoryQuest.id]: questBaselineFor(localPlayer)
        }
      };
    });
  }, [localPlayer, nextStoryQuest?.id, storyQuestState.activeQuestId]);

  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<{ targetId?: string }>).detail;
      setSelectedTargetId(detail?.targetId);
    };

    window.addEventListener("mmo:selectedTarget", listener);
    return () => window.removeEventListener("mmo:selectedTarget", listener);
  }, []);

  useEffect(() => {
    const openShop = (event: Event) => {
      const detail = (event as CustomEvent<{ cityId?: string }>).detail;
      setInteractionCityId(detail?.cityId ?? activeShopCity.id);
	      setShopOpen(true);
	      setTeleportMenuOpen(false);
      setVendorSellerId(undefined);
	      setProfileOpen(false);
	    };
    const openTeleportMenu = (event: Event) => {
      const detail = (event as CustomEvent<{ cityId?: string }>).detail;
      setInteractionCityId(detail?.cityId ?? activeShopCity.id);
	      setTeleportMenuOpen(true);
	      setShopOpen(false);
      setVendorSellerId(undefined);
	      setProfileOpen(false);
    };
    const openVendor = (event: Event) => {
      const detail = (event as CustomEvent<{ sellerId?: string }>).detail;
      if (!detail?.sellerId) {
        return;
      }
      setVendorSellerId(detail.sellerId);
      setShopOpen(false);
      setTeleportMenuOpen(false);
      setProfileOpen(false);
    };

    window.addEventListener("mmo:openShop", openShop);
    window.addEventListener("mmo:openTeleportMenu", openTeleportMenu);
    window.addEventListener("mmo:openVendor", openVendor);
    return () => {
      window.removeEventListener("mmo:openShop", openShop);
      window.removeEventListener("mmo:openTeleportMenu", openTeleportMenu);
      window.removeEventListener("mmo:openVendor", openVendor);
    };
  }, [activeShopCity.id]);

  useEffect(() => {
    if (!started) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Tab") {
        event.preventDefault();
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        window.dispatchEvent(new CustomEvent("mmo:uiFocus", { detail: { focused: profileOpen } }));
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        if (blurChatInput()) {
          return;
        }
        if (activeTrade) {
          window.dispatchEvent(new CustomEvent("mmo:tradeCancel"));
        } else if (vendorSellerId) {
          setVendorSellerId(undefined);
	        } else if (adminOpen) {
	          setAdminOpen(false);
        } else if (shopOpen || teleportMenuOpen) {
          setShopOpen(false);
          setTeleportMenuOpen(false);
        } else if (profileOpen) {
          setProfileOpen(false);
        } else if (selectedTargetId) {
          clearSelectedTarget();
        } else {
          setProfileTab("settings");
          setProfileOpen(true);
        }
        return;
      }

      if (isEditableTarget(event.target)) {
        return;
      }

	      if (event.key === "Enter") {
	        event.preventDefault();
	        focusChatInput();
	        return;
	      }

      if (event.key.toLowerCase() === "o") {
        event.preventDefault();
        if (!event.repeat && !voiceState.active) {
          startVoicePushToTalk();
        }
        return;
      }

	      if (event.key.toLowerCase() === "m") {
	        event.preventDefault();
	        setProfileTab("map");
	        setProfileOpen((current) => !current || profileTab !== "map");
      }
      if (/^[1-6]$/.test(event.key)) {
        event.preventDefault();
        activateHotbarSlot(Number(event.key) - 1);
	      }
	    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        return;
      }
      if (event.key.toLowerCase() === "o") {
        event.preventDefault();
        stopVoicePushToTalk();
      }
    };

	    window.addEventListener("keydown", handleKeyDown, { capture: true });
    window.addEventListener("keyup", handleKeyUp, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
      window.removeEventListener("keyup", handleKeyUp, { capture: true });
    };
  }, [activeTrade, adminOpen, profileOpen, profileTab, selectedTargetId, shopOpen, teleportMenuOpen, started, hotbar, cooldowns, activeClassDef, inventory, currentLevel, nowMs, localPlayer, voiceEnabled, effectiveVoiceChannel, voiceState.active, vendorSellerId]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("mmo:uiFocus", { detail: { focused: profileOpen || shopOpen || teleportMenuOpen || adminOpen || Boolean(vendorSellerId) || Boolean(activeTrade) } }));
  }, [activeTrade, adminOpen, profileOpen, shopOpen, teleportMenuOpen, vendorSellerId]);

  useEffect(() => {
    if (!selectedBagItem) {
      setMarketQuantityDraft("1");
      setMarketPriceDraft("");
      return;
    }

    const quantity = selectedBagItem.stackable ? 1 : 1;
    setMarketQuantityDraft(String(quantity));
    setMarketPriceDraft(String(Math.max(1, Math.round(itemSellValue(selectedBagItem) * quantity * 1.65))));
  }, [selectedBagIndex, selectedBagItem?.id, selectedBagItem?.quantity]);

  useEffect(() => {
    setTradeGoldDraft(String(tradeSelfOffer?.gold ?? 0));
    setTradeItemIndex(undefined);
    setTradeQuantityDraft("1");
  }, [activeTrade?.id]);

  useEffect(() => {
    if (!started) {
      return undefined;
    }

    const isEventInside = (ref: RefObject<HTMLElement>, target: Node, path: EventTarget[]): boolean => {
      const element = ref.current;
      return Boolean(element && (element.contains(target) || path.includes(element)));
    };

    const handlePointerDown = (event: PointerEvent) => {
      const targetNode = event.target instanceof Node ? event.target : undefined;
      if (!targetNode) {
        return;
      }

      const path = event.composedPath();
      const targetElement = targetNode instanceof Element ? targetNode : targetNode.parentElement;
      const profileTrigger = Boolean(targetElement?.closest(".profileVitals, .miniRadar, .questTrackerPanel"));
      const adminTrigger = Boolean(targetElement?.closest(".adminOpenButton"));
	      const insideProfile = profileOpen && isEventInside(profileWindowRef, targetNode, path);
	      const insideShop = shopOpen && isEventInside(shopWindowRef, targetNode, path);
	      const insideTeleport = teleportMenuOpen && isEventInside(teleportWindowRef, targetNode, path);
      const insideVendor = Boolean(vendorSellerId) && isEventInside(vendorWindowRef, targetNode, path);
      const insideTrade = Boolean(activeTrade) && isEventInside(tradeWindowRef, targetNode, path);
	      const insideAdmin = adminOpen && isEventInside(adminPanelRef, targetNode, path);
	      const insideBlockingUi = insideProfile || insideShop || insideTeleport || insideVendor || insideTrade || insideAdmin;
      const activeElement = document.activeElement;

      if (activeElement instanceof HTMLElement && chatDockRef.current?.contains(activeElement) && !chatDockRef.current.contains(targetNode)) {
        activeElement.blur();
        window.dispatchEvent(new CustomEvent("mmo:uiFocus", { detail: { focused: profileOpen || shopOpen || teleportMenuOpen || adminOpen || Boolean(vendorSellerId) || Boolean(activeTrade) } }));
	      }

      if (!insideBlockingUi && !profileOpen && !shopOpen && !teleportMenuOpen && !vendorSellerId && !activeTrade && !adminOpen && !(targetElement instanceof HTMLElement && isEditableTarget(targetElement))) {
	        window.dispatchEvent(new CustomEvent("mmo:uiFocus", { detail: { focused: false } }));
      }

      if (insideBlockingUi) {
        return;
      }

      if (mobileLayout && profileOpen) {
        return;
      }

      if (profileOpen && !profileTrigger) {
        setProfileOpen(false);
      }
      if (shopOpen) {
        setShopOpen(false);
      }
	      if (teleportMenuOpen) {
	        setTeleportMenuOpen(false);
	      }
      if (vendorSellerId) {
        setVendorSellerId(undefined);
      }
	      if (adminOpen && !adminTrigger) {
        setAdminOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown, { capture: true });
    return () => document.removeEventListener("pointerdown", handlePointerDown, { capture: true });
  }, [activeTrade, adminOpen, mobileLayout, profileOpen, shopOpen, started, teleportMenuOpen, vendorSellerId]);

  useEffect(() => {
    if (!started || !isAdmin) {
      setAdminOpen(false);
      setAdminState(undefined);
      if (profileTab === "admin") {
        setProfileTab("settings");
      }
      return undefined;
    }

    const requestAdminState = () => window.dispatchEvent(new CustomEvent("mmo:adminRequest"));
    requestAdminState();
    const timer = window.setInterval(requestAdminState, 5000);
    return () => window.clearInterval(timer);
  }, [isAdmin, profileTab, started]);

  useEffect(() => {
    if (!adminState?.players.length) {
      setSelectedAdminPlayerId(undefined);
      return;
    }
    if (!selectedAdminPlayerId || !adminState.players.some((player) => player.id === selectedAdminPlayerId)) {
      setSelectedAdminPlayerId(adminState.players[0].id);
    }
  }, [adminState, selectedAdminPlayerId]);

  useEffect(() => {
    mobileLayoutRef.current = mobileLayout;
  }, [mobileLayout]);

  useEffect(() => {
    window.localStorage.setItem(mobileAutoTargetStorageKey, mobileAutoTarget ? "on" : "off");
    window.dispatchEvent(new CustomEvent("mmo:mobileAutoTarget", { detail: { enabled: mobileAutoTarget } }));
  }, [mobileAutoTarget]);

  useEffect(() => {
    saveMobileGraphicsSettings(mobileGraphics);
    window.dispatchEvent(new CustomEvent("mmo:mobileGraphicsSettings", { detail: { settings: mobileGraphics } }));
  }, [mobileGraphics]);

  useEffect(() => {
    try {
      window.localStorage.setItem(voiceEnabledStorageKey, voiceEnabled ? "on" : "off");
    } catch {
      // Ignore storage failures.
    }
    window.dispatchEvent(new CustomEvent("mmo:voiceEnabled", { detail: { enabled: voiceEnabled } }));
  }, [voiceEnabled]);

  useEffect(() => {
    try {
      window.localStorage.setItem(voiceChannelStorageKey, voiceChannel);
    } catch {
      // Ignore storage failures.
    }
    window.dispatchEvent(new CustomEvent("mmo:voiceChannel", { detail: { channel: voiceChannel } }));
  }, [voiceChannel]);

  useEffect(() => {
    if (voiceChannel === "party" && !canUsePartyVoice) {
      setVoiceChannel("nearby");
    }
  }, [canUsePartyVoice, voiceChannel]);

  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<VoiceUiState>).detail;
      if (detail) {
        setVoiceState(detail);
      }
    };
    window.addEventListener("mmo:voiceState", listener);
    return () => window.removeEventListener("mmo:voiceState", listener);
  }, []);

  useEffect(() => {
    const query = window.matchMedia("(hover: none), (pointer: coarse), (max-width: 920px), (max-height: 520px)");
    const syncMobileLayout = () => {
      const mobile = detectMobileLayout();
      const wasMobile = mobileLayoutRef.current;
      mobileLayoutRef.current = mobile;
      setMobileLayout(mobile);
      if (mobile && !wasMobile) {
        setChatOpen(false);
      }
    };

    syncMobileLayout();
    query.addEventListener("change", syncMobileLayout);
    window.addEventListener("resize", syncMobileLayout);
    window.addEventListener("orientationchange", syncMobileLayout);
    window.visualViewport?.addEventListener("resize", syncMobileLayout);
    return () => {
      query.removeEventListener("change", syncMobileLayout);
      window.removeEventListener("resize", syncMobileLayout);
      window.removeEventListener("orientationchange", syncMobileLayout);
      window.visualViewport?.removeEventListener("resize", syncMobileLayout);
    };
  }, []);

  useEffect(() => {
    chatOpenRef.current = chatOpen;
    if (chatOpen) {
      setChatToasts([]);
      chatToastTimerRef.current.forEach((timer) => window.clearTimeout(timer));
      chatToastTimerRef.current = [];
    }
  }, [chatOpen]);

  useEffect(() => {
    if (!chatOpen) {
      return;
    }

    const list = chatListRef.current;
    if (list) {
      list.scrollTop = list.scrollHeight;
    }
  }, [chatMessages.length, chatOpen]);

  useEffect(
    () => () => {
      chatToastTimerRef.current.forEach((timer) => window.clearTimeout(timer));
      chatToastTimerRef.current = [];
    },
    []
  );

  useEffect(
    () => () => {
      if (questCompleteTimerRef.current !== undefined) {
        window.clearTimeout(questCompleteTimerRef.current);
      }
    },
    []
  );

	  function setGameplayFocusFromUiState() {
    window.dispatchEvent(new CustomEvent("mmo:uiFocus", { detail: { focused: profileOpen || shopOpen || teleportMenuOpen || adminOpen || Boolean(vendorSellerId) || Boolean(activeTrade) } }));
	  }

  function focusChatInput() {
    setChatOpen(true);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        chatInputRef.current?.focus();
        window.dispatchEvent(new CustomEvent("mmo:uiFocus", { detail: { focused: true } }));
      });
    });
  }

  function blurChatInput(): boolean {
    const activeElement = document.activeElement;
    if (!(activeElement instanceof HTMLElement) || !chatDockRef.current?.contains(activeElement)) {
      return false;
    }

    activeElement.blur();
    setGameplayFocusFromUiState();
    return true;
  }

  function requestVoicePermission() {
    window.dispatchEvent(new CustomEvent("mmo:voiceRequestPermission"));
  }

  function updateVoiceEnabled(enabled: boolean) {
    setVoiceEnabled(enabled);
    if (!enabled) {
      window.dispatchEvent(new CustomEvent("mmo:voiceStop"));
    }
  }

  function updateVoiceChannel(channel: VoiceChannel) {
    const nextChannel = channel === "party" && canUsePartyVoice ? "party" : "nearby";
    setVoiceChannel(nextChannel);
    window.dispatchEvent(new CustomEvent("mmo:voiceChannel", { detail: { channel: nextChannel } }));
  }

  function startVoicePushToTalk() {
    if (!voiceEnabled || !voiceState.supported) {
      return;
    }
    window.dispatchEvent(new CustomEvent("mmo:voiceStart", { detail: { channel: effectiveVoiceChannel } }));
  }

  function stopVoicePushToTalk() {
    window.dispatchEvent(new CustomEvent("mmo:voiceStop"));
  }

  function clearSelectedTarget() {
    setSelectedTargetId(undefined);
    window.dispatchEvent(new CustomEvent("mmo:clearSelectedTarget"));
  }

  function sendChat(): boolean {
    const text = chatDraft.trim();
    if (!text) {
      return false;
    }

    window.dispatchEvent(new CustomEvent("mmo:sendChat", { detail: { text, channel: chatChannel } }));
    setChatDraft("");
    return true;
  }

  function createClan() {
    const name = clanNameDraft.trim();
    if (name.length < 3) {
      setClanStatus("Clan name needs at least 3 characters.");
      return;
    }

    window.dispatchEvent(new CustomEvent("mmo:clanCreate", { detail: { name, emblem: clanEmblem } }));
    setClanStatus("Clan request sent.");
  }

  function setClanChatChannel() {
    if (!localClan) {
      setClanStatus("Join or create a clan first.");
      return;
    }
    setChatChannel("clan");
    setChatOpen(true);
    setClanStatus("Clan chat selected.");
  }

  function sendFeedback() {
    const text = feedbackDraft.trim();
    if (text.length < 5) {
      setFeedbackStatus("Write at least a few words so the report is useful.");
      return;
    }

    setFeedbackStatus("Sending report...");
    window.dispatchEvent(
      new CustomEvent("mmo:feedbackReport", {
        detail: {
          text,
          context: [
            `level=${currentLevel}`,
            `target=${selectedTargetTitle ?? "none"}`,
            localPlayer ? `x=${Math.round(localPlayer.position.x)} y=${Math.round(localPlayer.position.y)} zone=${localPlayer.zone}` : undefined
          ]
            .filter(Boolean)
            .join("; ")
        }
      })
    );
  }

  function setHotbarSlot(slot: number, entry: HotbarEntry): void {
    setHotbar((current) => {
      const next = [...current];
      next[slot] = entry;
      return next;
    });
  }

  function cooldownKey(entry: HotbarEntry): string {
    if (entry.type === "attack") {
      return "attack:basic";
    }
    if (entry.type === "sprint") {
      return "mobility:sprint";
    }
    return `${entry.type}:${entry.type === "skill" ? entry.skillId : entry.itemId}`;
  }

  function activateHotbarEntry(entry: HotbarEntry | undefined): void {
    if (!entry) {
      return;
    }

    const key = cooldownKey(entry);
    if ((cooldowns[key]?.readyAt ?? 0) > nowMs) {
      touchDiag.hudTap(`${entry.type} COOLDOWN`);
      return;
    }
    touchDiag.hudTap(`${entry.type} fire`);

    if (entry.type === "attack") {
      window.dispatchEvent(new CustomEvent("mmo:attackNearest"));
      setCooldowns((current) => ({
        ...current,
        [key]: { readyAt: nowMs + effectiveAttackCooldownMs(activeClassDef.attackCooldownMs, stats), duration: effectiveAttackCooldownMs(activeClassDef.attackCooldownMs, stats) }
      }));
      return;
    }

    if (entry.type === "sprint") {
      if (!isAdmin) {
        return;
      }
      window.dispatchEvent(new CustomEvent("mmo:mobileSprint"));
      setCooldowns((current) => ({
        ...current,
        [key]: { readyAt: nowMs + 650, duration: 650 }
      }));
      return;
    }

    if (entry.type === "skill") {
      const skillIndex = activeClassDef.skills.findIndex((skill) => skill.id === entry.skillId);
      const skill = skillIndex >= 0 ? activeClassDef.skills[skillIndex] : undefined;
      if (!skill || currentLevel < (skill.requiredLevel ?? 1)) {
        return;
      }
      if (localPlayer && localPlayer.mp < skill.manaCost) {
        return;
      }
      if (skill.heal && localPlayer && localPlayer.hp >= localPlayer.maxHp) {
        return;
      }

      window.dispatchEvent(new CustomEvent("mmo:skillNearest", { detail: { index: skillIndex } }));
      const duration = effectiveSkillCooldownMs(skill.cooldownMs, stats);
      setCooldowns((current) => ({
        ...current,
        [key]: { readyAt: nowMs + duration, duration }
      }));
      return;
    }

    const item = inventory.find((candidate) => candidate.id === entry.itemId && candidate.quantity > 0);
    if (!item?.consumable) {
      return;
    }
    const hpUseful = Boolean(item.consumable.hp && localPlayer && localPlayer.hp < localPlayer.maxHp);
    const mpUseful = Boolean(item.consumable.mp && localPlayer && localPlayer.mp < localPlayer.maxMp);
    if (!hpUseful && !mpUseful) {
      return;
    }

    window.dispatchEvent(new CustomEvent("mmo:useItem", { detail: { itemId: item.id } }));
    setCooldowns((current) => ({
      ...current,
      [key]: { readyAt: nowMs + 8500, duration: 8500 }
    }));
  }

  function activateHotbarSlot(index: number): void {
    activateHotbarEntry(hotbar[index]);
  }

  function activateBasicAttackButton(event: ReactPointerEvent<HTMLButtonElement>): void {
    event.preventDefault();
    event.stopPropagation();
    if (activeClassDef.id === "archer") {
      event.currentTarget.setPointerCapture?.(event.pointerId);
      window.dispatchEvent(new CustomEvent("mmo:attackHoldStart"));
      return;
    }
    window.dispatchEvent(new CustomEvent("mmo:attackNearest"));
  }

  function releaseBasicAttackButton(event: ReactPointerEvent<HTMLButtonElement>): void {
    if (activeClassDef.id !== "archer") {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    window.dispatchEvent(new CustomEvent("mmo:attackHoldRelease"));
  }

  function cancelBasicAttackButton(event: ReactPointerEvent<HTMLButtonElement>): void {
    if (activeClassDef.id !== "archer") {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    window.dispatchEvent(new CustomEvent("mmo:attackHoldCancel"));
  }

  function toggleSinging(event: ReactPointerEvent<HTMLButtonElement>): void {
    event.preventDefault();
    event.stopPropagation();
    window.dispatchEvent(new CustomEvent("mmo:sing", { detail: { active: !localPlayer?.singing } }));
  }

  function activateHotbarPointer(event: ReactPointerEvent<HTMLButtonElement>, entry: HotbarEntry | undefined): void {
    event.preventDefault();
    event.stopPropagation();
    touchDiag.event(`hud pointerdown ${event.pointerType}#${event.pointerId}`);
    if (entry?.type === "attack" && activeClassDef.id === "archer") {
      event.currentTarget.setPointerCapture?.(event.pointerId);
      window.dispatchEvent(new CustomEvent("mmo:attackHoldStart"));
      return;
    }
    activateHotbarEntry(entry);
  }

  function releaseHotbarPointer(event: ReactPointerEvent<HTMLButtonElement>, entry: HotbarEntry | undefined): void {
    if (entry?.type !== "attack" || activeClassDef.id !== "archer") {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    window.dispatchEvent(new CustomEvent("mmo:attackHoldRelease"));
  }

  function cancelHotbarPointer(event: ReactPointerEvent<HTMLButtonElement>, entry: HotbarEntry | undefined): void {
    if (entry?.type !== "attack" || activeClassDef.id !== "archer") {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    window.dispatchEvent(new CustomEvent("mmo:attackHoldCancel"));
  }

  function dismissPwaInstallOffer(hours = 48): void {
    snoozePwaInstallOffer(hours);
    setPwaInstallVisible(false);
  }

  async function requestPwaInstall(): Promise<void> {
    if (pwaInstallBusy) {
      return;
    }
    if (!pwaInstallPrompt) {
      dismissPwaInstallOffer(72);
      return;
    }

    setPwaInstallBusy(true);
    try {
      await pwaInstallPrompt.prompt();
      const choice = await pwaInstallPrompt.userChoice;
      setPwaInstallPrompt(undefined);
      setPwaInstallVisible(false);
      if (choice.outcome === "accepted") {
        setPwaInstalled(true);
        clearPwaInstallSnooze();
      } else {
        snoozePwaInstallOffer(24);
      }
    } catch {
      setPwaInstallPrompt(undefined);
      setPwaInstallVisible(false);
      snoozePwaInstallOffer(24);
    } finally {
      setPwaInstallBusy(false);
    }
  }

  function startWithAccountSession(session: AccountSession): void {
    const accountCharacter = { ...session.character, classId: normalizePlayableClass(session.character.classId) };
    setAccountSession({ ...session, character: accountCharacter });
    setSessionToken(session.token);
    setAccountCharacterId(accountCharacter.id);
    setPlayerName(accountCharacter.name);
    setClassId(accountCharacter.classId);
    setRace(accountCharacter.race);
    setFace(accountCharacter.face);
    setCustomHeadUrl(accountCharacter.customHeadUrl);
    setLegacyCharacterId(undefined);
    window.localStorage.removeItem(legacyCharacterIdStorageKey);
    saveLauncherProfile(accountCharacter.name, accountCharacter.classId);
    setStarted(true);
  }

  function currentHeroCharacter(): AccountSession["character"] {
    const draftedName = playerName.trim() || localPlayer?.name || "Hero";
    return {
      id: characterId,
      name: draftedName,
      classId: normalizePlayableClass(localPlayer?.classId ?? classId),
      race: localPlayer?.race ?? race,
      face: localPlayer?.face ?? face,
      customHeadUrl: localPlayer?.customHeadUrl ?? customHeadUrl
    };
  }

  async function startGuestWorld(): Promise<void> {
    setAuthError("");
    setAuthNotice("");
    setSaveHeroStatus("");
    if (accountSession?.authProvider !== "guest" && accountSession?.token && accountSession.character?.id) {
      startWithAccountSession(accountSession);
      return;
    }

    if (accountSession?.authProvider === "guest" && accountSession.token && accountSession.character?.id && normalizePlayableClass(accountSession.character.classId) === classId) {
      startWithAccountSession(accountSession);
      return;
    }

    setAuthBusy(true);
    try {
      const guestName = playerName.trim() || `Player${Math.floor(Math.random() * 900 + 100)}`;
      const guestCharacter: AccountSession["character"] = {
        id: legacyCharacterId ?? characterIdFor(guestName, classId),
        name: guestName,
        classId,
        race,
        face,
        customHeadUrl
      };
      const response = await fetch(`${authApiUrl}/guest/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ username: guestName })
      });
      const payload = (await response.json()) as { token?: string; message?: string };
      if (!response.ok || !payload.token) {
        throw new Error(payload.message ?? "Guest login failed.");
      }

      const session: AccountSession = {
        token: payload.token,
        authProvider: "guest",
        character: guestCharacter
      };
      saveAccountSession(session);
      window.localStorage.setItem(legacyCharacterIdStorageKey, guestCharacter.id);
      startWithAccountSession(session);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Guest login failed.");
    } finally {
      setAuthBusy(false);
    }
  }

  function resetEmailCodeState(): void {
    setRegisterCodeSent(false);
    setRegisterEmailCode("");
    setResetCodeSent(false);
    setResetEmailCode("");
    setGuestCodeSent(false);
    setGuestEmailCode("");
    setAuthNotice("");
    setSaveHeroStatus("");
    setRenameHeroStatus("");
  }

  async function requestAccountEmailCode(hero?: AccountSession["character"], target: "launcher" | "guest" = "launcher"): Promise<boolean> {
    const draftHero = hero ?? {
      id: undefined,
      name: playerName,
      classId,
      race,
      face
    };
    if (target === "launcher") {
      setAuthError("");
      setAuthNotice("");
    } else {
      setSaveHeroStatus("");
    }

    setAuthBusy(true);
    try {
      const response = await fetch(`${authApiUrl}/account/register/request-code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          login: accountLogin,
          password: accountPassword,
          characterName: draftHero.name,
          classId: draftHero.classId,
          race: draftHero.race,
          face: draftHero.face,
          characterId: draftHero.id,
          locale: language
        })
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? "Could not send email code.");
      }

      const message = "Code sent to email. Enter it to finish registration.";
      if (target === "launcher") {
        setRegisterCodeSent(true);
        setAuthNotice(payload.message ?? message);
      } else {
        setGuestCodeSent(true);
        setSaveHeroStatus(payload.message ?? message);
      }
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not send email code.";
      if (target === "launcher") {
        setAuthError(message);
      } else {
        setSaveHeroStatus(message);
      }
      return false;
    } finally {
      setAuthBusy(false);
    }
  }

  async function requestPasswordResetCode(): Promise<boolean> {
    setAuthError("");
    setAuthNotice("");
    setAuthBusy(true);
    try {
      const response = await fetch(`${authApiUrl}/account/password/reset/request-code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          login: accountLogin,
          locale: language
        })
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? "Could not send password reset code.");
      }

      setResetCodeSent(true);
      setAuthNotice(payload.message ?? "If this email has an account, a reset code was sent.");
      return true;
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Could not send password reset code.");
      return false;
    } finally {
      setAuthBusy(false);
    }
  }

  async function resetAccountPassword(): Promise<void> {
    setAuthError("");
    setAuthNotice("");
    if (!resetCodeSent) {
      await requestPasswordResetCode();
      return;
    }
    if (!resetEmailCode.trim()) {
      setAuthError("Enter the code from email.");
      return;
    }

    setAuthBusy(true);
    try {
      const response = await fetch(`${authApiUrl}/account/password/reset`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          login: accountLogin,
          password: accountPassword,
          emailCode: resetEmailCode,
          locale: language
        })
      });
      const payload = (await response.json()) as {
        token?: string;
        message?: string;
        player?: {
          character?: {
            id: string;
            name: string;
            classId: CharacterClass;
            race: CharacterRace;
            face: number;
            customHeadUrl?: string;
          };
        };
      };
      if (!response.ok || !payload.token || !payload.player?.character) {
        throw new Error(payload.message ?? "Could not reset password.");
      }

      const character = payload.player.character;
      const accountCharacter = { ...character, classId: normalizePlayableClass(character.classId) };
      const session: AccountSession = { token: payload.token, login: accountLogin.trim(), authProvider: "account", character: accountCharacter };
      setSessionToken(payload.token);
      setAccountCharacterId(character.id);
      setPlayerName(character.name);
      setClassId(accountCharacter.classId);
      setRace(character.race);
      setFace(character.face);
      setCustomHeadUrl(accountCharacter.customHeadUrl);
      setLegacyCharacterId(undefined);
      window.localStorage.removeItem(legacyCharacterIdStorageKey);
      setAccountSession(session);
      saveAccountSession(session);
      saveLauncherProfile(character.name, accountCharacter.classId);
      setResetCodeSent(false);
      setResetEmailCode("");
      setAuthMode("login");
      setAuthNotice("Password updated.");
      setStarted(true);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Could not reset password.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function saveGuestCharacter(): Promise<void> {
    setAuthError("");
    setAuthNotice("");
    setSaveHeroStatus("");
    if (!guestSessionActive) {
      return;
    }

    const hero = currentHeroCharacter();
    if (!guestCodeSent) {
      await requestAccountEmailCode(hero, "guest");
      return;
    }
    if (!guestEmailCode.trim()) {
      setSaveHeroStatus("Enter the code from email.");
      return;
    }

    setAuthBusy(true);
    try {
      const response = await fetch(`${authApiUrl}/account/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          login: accountLogin,
          password: accountPassword,
          characterName: hero.name,
          classId: hero.classId,
          race: hero.race,
          face: hero.face,
          characterId: hero.id,
          emailCode: guestEmailCode,
          locale: language
        })
      });
      const payload = (await response.json()) as {
        token?: string;
        message?: string;
        player?: {
          character?: {
            id: string;
            name: string;
            classId: CharacterClass;
            race: CharacterRace;
            face: number;
            customHeadUrl?: string;
          };
        };
      };
      if (!response.ok || !payload.token || !payload.player?.character) {
        throw new Error(payload.message ?? "Could not save hero.");
      }

      const character = payload.player.character;
      const accountCharacter = { ...character, classId: normalizePlayableClass(character.classId) };
      const session: AccountSession = {
        token: payload.token,
        login: accountLogin.trim(),
        authProvider: "account",
        character: accountCharacter
      };
      saveAccountSession(session);
      setAccountSession(session);
      setSessionToken(payload.token);
      setAccountCharacterId(accountCharacter.id);
      setPlayerName(accountCharacter.name);
      setClassId(accountCharacter.classId);
      setRace(accountCharacter.race);
      setFace(accountCharacter.face);
      setCustomHeadUrl(accountCharacter.customHeadUrl);
      setLegacyCharacterId(undefined);
      window.localStorage.removeItem(legacyCharacterIdStorageKey);
      saveLauncherProfile(accountCharacter.name, accountCharacter.classId);
      setSaveHeroOpen(false);
      setSaveHeroStatus("Hero saved to account.");
      setAccountPassword("");
      setGuestCodeSent(false);
      setGuestEmailCode("");
      setRegisterCodeSent(false);
      setRegisterEmailCode("");
      window.dispatchEvent(new CustomEvent("mmo:renameCharacter", { detail: { name: accountCharacter.name } }));
    } catch (error) {
      setSaveHeroStatus(error instanceof Error ? error.message : "Could not save hero.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function renameAccountHero(): Promise<void> {
    setRenameHeroStatus("");
    setAuthError("");
    setAuthNotice("");
    const nextName = playerName.trim();
    if (!accountSession?.token || accountSession.authProvider !== "account") {
      setRenameHeroStatus("Account session is required.");
      return;
    }
    if (!nextName) {
      setRenameHeroStatus("Enter hero name.");
      return;
    }

    setAuthBusy(true);
    try {
      const response = await fetch(`${authApiUrl}/account/character/rename`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          token: accountSession.token,
          characterName: nextName
        })
      });
      const payload = (await response.json()) as {
        token?: string;
        message?: string;
        player?: {
          character?: {
            id: string;
            name: string;
            classId: CharacterClass;
            race: CharacterRace;
            face: number;
            customHeadUrl?: string;
          };
        };
      };
      if (!response.ok || !payload.token || !payload.player?.character) {
        throw new Error(payload.message ?? "Could not rename hero.");
      }

      const character = payload.player.character;
      const accountCharacter = { ...character, classId: normalizePlayableClass(character.classId) };
      const session: AccountSession = {
        ...accountSession,
        token: payload.token,
        authProvider: "account",
        character: accountCharacter
      };
      saveAccountSession(session);
      setAccountSession(session);
      setSessionToken(payload.token);
      setAccountCharacterId(accountCharacter.id);
      setPlayerName(accountCharacter.name);
      setClassId(accountCharacter.classId);
      setRace(accountCharacter.race);
      setFace(accountCharacter.face);
      setCustomHeadUrl(accountCharacter.customHeadUrl);
      saveLauncherProfile(accountCharacter.name, accountCharacter.classId);
      window.dispatchEvent(new CustomEvent("mmo:renameCharacter", { detail: { name: accountCharacter.name } }));
      setRenameHeroOpen(false);
      setRenameHeroStatus("Hero name updated.");
    } catch (error) {
      setRenameHeroStatus(error instanceof Error ? error.message : "Could not rename hero.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function uploadCustomHead(file?: File): Promise<void> {
    setHeadUploadStatus("");
    if (!accountSession?.token || accountSession.authProvider !== "account") {
      setHeadUploadStatus("Account session is required.");
      return;
    }
    if (!file) {
      return;
    }
    if (file.type && file.type !== "image/png") {
      setHeadUploadStatus("Upload PNG only.");
      return;
    }
    if (file.size > 650_000) {
      setHeadUploadStatus("PNG must be 650 KB or smaller.");
      return;
    }

    setHeadUploadBusy(true);
    try {
      const imageData = await readFileAsDataUrl(file);
      const response = await fetch(`${authApiUrl}/account/character/head`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          token: accountSession.token,
          imageData
        })
      });
      const payload = (await response.json()) as {
        token?: string;
        message?: string;
        player?: {
          character?: {
            id: string;
            name: string;
            classId: CharacterClass;
            race: CharacterRace;
            face: number;
            customHeadUrl?: string;
          };
        };
      };
      if (!response.ok || !payload.token || !payload.player?.character) {
        throw new Error(payload.message ?? "Could not upload face.");
      }

      const accountCharacter = { ...payload.player.character, classId: normalizePlayableClass(payload.player.character.classId) };
      const session: AccountSession = {
        ...accountSession,
        token: payload.token,
        authProvider: "account",
        character: accountCharacter
      };
      saveAccountSession(session);
      setAccountSession(session);
      setSessionToken(payload.token);
      setAccountCharacterId(accountCharacter.id);
      setCustomHeadUrl(accountCharacter.customHeadUrl);
      window.dispatchEvent(new CustomEvent("mmo:customHeadUpdate", { detail: { customHeadUrl: accountCharacter.customHeadUrl } }));
      setHeadUploadStatus("Face updated.");
    } catch (error) {
      setHeadUploadStatus(error instanceof Error ? error.message : "Could not upload face.");
    } finally {
      setHeadUploadBusy(false);
      if (customHeadInputRef.current) {
        customHeadInputRef.current.value = "";
      }
    }
  }

  async function clearCustomHead(): Promise<void> {
    setHeadUploadStatus("");
    if (!accountSession?.token || accountSession.authProvider !== "account") {
      setHeadUploadStatus("Account session is required.");
      return;
    }

    setHeadUploadBusy(true);
    try {
      const response = await fetch(`${authApiUrl}/account/character/head`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          token: accountSession.token,
          clear: true
        })
      });
      const payload = (await response.json()) as {
        token?: string;
        message?: string;
        player?: {
          character?: {
            id: string;
            name: string;
            classId: CharacterClass;
            race: CharacterRace;
            face: number;
            customHeadUrl?: string;
          };
        };
      };
      if (!response.ok || !payload.token || !payload.player?.character) {
        throw new Error(payload.message ?? "Could not reset face.");
      }

      const accountCharacter = { ...payload.player.character, classId: normalizePlayableClass(payload.player.character.classId) };
      const session: AccountSession = {
        ...accountSession,
        token: payload.token,
        authProvider: "account",
        character: accountCharacter
      };
      saveAccountSession(session);
      setAccountSession(session);
      setSessionToken(payload.token);
      setAccountCharacterId(accountCharacter.id);
      setCustomHeadUrl(undefined);
      window.dispatchEvent(new CustomEvent("mmo:customHeadUpdate", { detail: { customHeadUrl: undefined } }));
      setHeadUploadStatus("Default face restored.");
    } catch (error) {
      setHeadUploadStatus(error instanceof Error ? error.message : "Could not reset face.");
    } finally {
      setHeadUploadBusy(false);
    }
  }

  async function enterWorld() {
    setAuthError("");
    setAuthNotice("");
    if (authMode === "reset") {
      await resetAccountPassword();
      return;
    }

    if (authMode === "login" && accountSession?.authProvider !== "guest" && accountSession && !accountPassword.trim()) {
      startWithAccountSession(accountSession);
      return;
    }

    if (authMode === "register") {
      if (!registerCodeSent) {
        await requestAccountEmailCode(undefined, "launcher");
        return;
      }
      if (!registerEmailCode.trim()) {
        setAuthError("Enter the code from email.");
        return;
      }
    }

    setAuthBusy(true);
    try {
      const endpoint = authMode === "register" ? "/account/register" : "/account/login";
      const response = await fetch(`${authApiUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(
          authMode === "register"
            ? {
                login: accountLogin,
                password: accountPassword,
                characterName: playerName,
                classId,
                race,
                face,
                emailCode: registerEmailCode,
                locale: language
              }
            : {
                login: accountLogin,
                password: accountPassword,
                locale: language
              }
        )
      });
      const payload = (await response.json()) as {
        token?: string;
        message?: string;
        player?: {
          character?: {
            id: string;
            name: string;
            classId: CharacterClass;
            race: CharacterRace;
            face: number;
            customHeadUrl?: string;
          };
        };
      };
      if (!response.ok || !payload.token || !payload.player?.character) {
        throw new Error(payload.message ?? "Auth failed.");
      }

      const character = payload.player.character;
      const accountCharacter = { ...character, classId: normalizePlayableClass(character.classId) };
      const session: AccountSession = { token: payload.token, login: accountLogin.trim(), authProvider: "account", character: accountCharacter };
      setSessionToken(payload.token);
      setAccountCharacterId(character.id);
      setPlayerName(character.name);
      setClassId(accountCharacter.classId);
      setRace(character.race);
      setFace(character.face);
      setCustomHeadUrl(accountCharacter.customHeadUrl);
      setLegacyCharacterId(undefined);
      window.localStorage.removeItem(legacyCharacterIdStorageKey);
      setAccountSession(session);
      saveAccountSession(session);
      saveLauncherProfile(character.name, accountCharacter.classId);
      setStarted(true);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Auth failed.");
    } finally {
      setAuthBusy(false);
    }
  }

  function handleRealtimeError(error: { code: string; message: string }): void {
    if (error.code !== "session_replaced") {
      return;
    }

    setStarted(false);
    setProfileOpen(false);
    setShopOpen(false);
    setTeleportMenuOpen(false);
    setChatOpen(false);
    setSnapshot(undefined);
    setPlayerId(undefined);
    setSelectedTargetId(undefined);
    setAuthBusy(false);
    setAuthMode("login");
    setAuthError(error.message || "В ваш аккаунт вошли в другом окне. Этот клиент отключен.");
  }

  function detachLegacyCharacter() {
    if (!legacyCharacterId) {
      return;
    }

    setLegacyCharacterId(undefined);
    window.localStorage.removeItem(legacyCharacterIdStorageKey);
  }

  function openProfile(tab: ProfileTab) {
    setProfileTab(tab);
    setProfileOpen(true);
    setShopOpen(false);
    setTeleportMenuOpen(false);
  }

  async function startPremiumTrial(): Promise<void> {
    if (!accountSession?.token || accountSession.authProvider !== "account" || premiumBusy) {
      setPremiumMessage("Save your hero to an account before activating Premium.");
      return;
    }
    const bankWindow = window.open("", "darkvell-premium-card");
    setPremiumBusy(true);
    setPremiumMessage("");
    try {
      const response = await fetchWithAccountSession("/premium/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId: premiumPlan })
      });
      const payload = (await response.json()) as { paymentUrl?: string; message?: string };
      if (!response.ok || !payload.paymentUrl) throw new Error(payload.message || "Could not open secure card linking.");
      if (bankWindow) {
        bankWindow.opener = null;
        bankWindow.location.assign(payload.paymentUrl);
      } else {
        window.location.assign(payload.paymentUrl);
      }
      setPremiumMessage("Complete card linking in the T-Bank window. Premium will activate automatically.");
      await refreshPremiumStatus();
    } catch (error) {
      bankWindow?.close();
      setPremiumMessage(error instanceof Error ? error.message : "Could not open secure card linking.");
    } finally {
      setPremiumBusy(false);
    }
  }

  async function cancelPremiumRenewal(): Promise<void> {
    if (!accountSession?.token || accountSession.authProvider !== "account" || premiumBusy) return;
    setPremiumBusy(true);
    try {
      const response = await fetchWithAccountSession("/premium/cancel", { method: "POST" });
      const payload = (await response.json()) as PremiumStatus & { message?: string };
      if (!response.ok) throw new Error(payload.message || "Could not cancel renewal.");
      setPremiumStatus(payload);
      setPremiumMessage("Renewal canceled. Premium stays active until the shown date.");
    } catch (error) {
      setPremiumMessage(error instanceof Error ? error.message : "Could not cancel renewal.");
    } finally {
      setPremiumBusy(false);
    }
  }

  async function buyOneCoin(): Promise<void> {
    if (!accountSession?.token || accountSession.authProvider !== "account" || coinPaymentBusy) {
      setCoinPaymentMessage("Save your hero to an account before buying Coin.");
      return;
    }
    const bankWindow = window.open("", "darkvell-coin-payment");
    setCoinPaymentBusy(true);
    setCoinPaymentMessage("");
    try {
      const response = await fetchWithAccountSession("/coin-shop/start", { method: "POST" });
      const payload = (await response.json()) as { paymentUrl?: string; message?: string };
      if (!response.ok || !payload.paymentUrl) throw new Error(payload.message || "Could not open secure Coin payment.");
      if (bankWindow) {
        bankWindow.opener = null;
        bankWindow.location.assign(payload.paymentUrl);
      } else {
        window.location.assign(payload.paymentUrl);
      }
      setCoinPaymentMessage("Complete the one-time payment in the T-Bank window.");
      await refreshCoinPaymentStatus();
    } catch (error) {
      bankWindow?.close();
      setCoinPaymentMessage(error instanceof Error ? error.message : "Could not open secure Coin payment.");
    } finally {
      setCoinPaymentBusy(false);
    }
  }

  function selectTeleportDestination(teleportId: TeleportId) {
    window.dispatchEvent(new CustomEvent("mmo:teleportTo", { detail: { teleportId } }));
    setTeleportMenuOpen(false);
  }

  function openWorldMapFromRadar() {
    setProfileTab("map");
    setProfileOpen(true);
    setShopOpen(false);
    setTeleportMenuOpen(false);
    setMapZoom((current) => Math.max(current, RADAR_MAP_OPEN_ZOOM));
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => centerWorldMapOnPlayer("auto"));
    });
  }

  function openStoryQuestMap(target: StoryQuestTarget | undefined = activeQuestTarget) {
    if (!target) {
      return;
    }

    setProfileTab("map");
    setProfileOpen(true);
    setShopOpen(false);
    setTeleportMenuOpen(false);
    setMapZoom((current) => Math.max(current, RADAR_MAP_OPEN_ZOOM));
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => centerWorldMapOnPosition(target.position, "auto"));
    });
  }

  function acceptStoryQuest(questId?: string) {
    if (activeStoryQuest) {
      return;
    }

    const quest = storyQuestChain.find((candidate) => candidate.id === questId) ?? nextStoryQuest;
    if (!quest || completedStoryQuestIds.has(quest.id)) {
      return;
    }

    setStoryQuestState((current) => ({
      ...current,
      activeQuestId: quest.id,
      baselines: {
        ...(current.baselines ?? {}),
        [quest.id]: questBaselineFor(localPlayer)
      }
    }));
  }

  function showQuestCompleteCelebration(quest: StoryQuestDefinition): void {
    playQuestCompleteSound();
    setQuestCompleteCue({ id: Date.now(), title: quest.title });
    if (questCompleteTimerRef.current !== undefined) {
      window.clearTimeout(questCompleteTimerRef.current);
    }
    questCompleteTimerRef.current = window.setTimeout(() => {
      setQuestCompleteCue(undefined);
      questCompleteTimerRef.current = undefined;
    }, 3200);
  }

  function completeStoryQuest() {
    if (!activeStoryQuest || !activeStoryProgress?.done) {
      return;
    }

    const completedQuest = activeStoryQuest;
    window.dispatchEvent(new CustomEvent("mmo:claimStoryQuestReward", { detail: { questId: completedQuest.id } }));
    setStoryQuestState((current) => {
      if (current.activeQuestId !== completedQuest.id) {
        return current;
      }

      const completedQuestIds = Array.from(new Set([...(current.completedQuestIds ?? []), completedQuest.id]));
      const nextQuest = storyQuestChain.find((quest) => !completedQuestIds.includes(quest.id));
      return {
        ...current,
        activeQuestId: nextQuest?.id,
        completedQuestIds,
        baselines: nextQuest && localPlayer
          ? {
              ...(current.baselines ?? {}),
              [nextQuest.id]: questBaselineFor(localPlayer)
            }
          : current.baselines
      };
    });
    showQuestCompleteCelebration(completedQuest);
  }

  function closeProfile() {
    setProfileOpen(false);
  }

  function updateFacePart(partial: Partial<FaceParts>): void {
    setFace(encodeFaceVariant({ ...faceParts, ...partial }));
  }

  function sendAdminAction(action: AdminActionType, targetId = selectedAdminPlayer?.id, durationMs?: number): void {
    if (!targetId) {
      return;
    }
    window.dispatchEvent(new CustomEvent("mmo:adminAction", { detail: { action, targetId, durationMs } }));
  }

  function applyMobileGraphicsPreset(preset: MobileGraphicsSettings["preset"]): void {
    setMobileGraphics((current) => ({
      ...presetSettings(preset),
      showFps: current.showFps,
      mobileFullWorldMap: current.mobileFullWorldMap
    }));
  }

  function updateMobileGraphics(partial: Partial<MobileGraphicsSettings>): void {
    setMobileGraphics((current) => ({ ...current, ...partial }));
  }

  function updateStartupGraphics(partial: Partial<MobileGraphicsSettings>): void {
    const next = { ...mobileGraphics, ...partial };
    setMobileGraphics(next);
    saveMobileGraphicsSettings(next);
    window.dispatchEvent(new CustomEvent("mmo:mobileGraphicsSettings", { detail: { settings: next } }));
    if (started) {
      window.setTimeout(() => window.location.reload(), 90);
    }
  }

  return (
    <main className={started ? (mobileLayout ? "shell gameShell mobileGameShell" : "shell gameShell") : "shell"}>
      {showPwaInstallOffer ? (
        <aside className={started ? "pwaInstallOffer gamePwaInstallOffer" : "pwaInstallOffer launcherPwaInstallOffer"} role="dialog" aria-label={tr("Install DarkVell")}>
          <span className="pwaInstallGlyph" aria-hidden="true">
            <Download size={17} />
          </span>
          <span className="pwaInstallCopy">
            <strong>{tr("Install DarkVell")}</strong>
            <span>{tr(pwaInstallHint)}</span>
          </span>
          <button type="button" className="pwaInstallAction" onClick={() => void requestPwaInstall()} disabled={pwaInstallBusy}>
            {pwaInstallPrompt ? (pwaInstallBusy ? tr("Opening...") : tr("Install")) : "OK"}
          </button>
          <button type="button" className="pwaInstallClose" onClick={() => dismissPwaInstallOffer()} aria-label={tr("Dismiss install offer")}>
            <X size={14} />
          </button>
        </aside>
      ) : null}
      {questCompleteCue && started ? (
        <div className="questCompleteToast" key={questCompleteCue.id} role="status" aria-live="polite">
          <div className="questCompleteBurst" aria-hidden="true">
            {questCompleteSparkIndexes.map((sparkIndex) => (
              <i
                key={sparkIndex}
                style={{
                  "--spark-angle": `${sparkIndex * 22.5}deg`,
                  "--spark-delay": `${sparkIndex * 26}ms`
                } as CSSProperties}
              />
            ))}
          </div>
          <span className="questCompleteLabel">
            <Sparkles size={20} />
            {tr("QUEST COMPLETE")}
            <Sparkles size={20} />
          </span>
          <strong>{tr(questCompleteCue.title)}</strong>
          <em>{tr("Reward claimed")}</em>
        </div>
      ) : null}
      {!started ? (
        <section className="launcher">
          <div className="launcherShell">
            <div className="launcherLanguageSwitch languageSwitch" role="group" aria-label={tr("Language")}>
              {LANGUAGE_OPTIONS.map((option) => (
                <button
                  type="button"
                  className={language === option.id ? "activeLanguage" : ""}
                  key={option.id}
                  aria-pressed={language === option.id}
                  title={option.label}
                  onClick={() => chooseLanguage(option.id)}
                >
                  {option.shortLabel}
                </button>
              ))}
            </div>
            <aside className="launcherBrandPanel" aria-label={tr("DarkVell beta status")}>
              <img className="launcherLogo" src="/darkvell-login-logo.png?v=transparent-20260519" alt="DarkVell" />
              <div className="launcherKicker">{tr("Closed beta")}</div>
              <p>{tr("Closed beta testing of the earliest playable version. Balance, locations, economy, and PvP can change while we test.")}</p>
              <div className="launcherStatusGrid">
                <div className="launcherStat">
                  <strong>{onlinePlayers ?? "..."}</strong>
                  <span>{tr("online now")}</span>
                </div>
                <div className="launcherStat">
                  <strong>{tr("Early build")}</strong>
                  <span>{tr("Core world systems are still under active testing")}</span>
                </div>
              </div>
            </aside>

            <div
              className={authMode === "register" ? "launcherForm createLauncherForm" : "launcherForm"}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !authBusy) {
                  event.preventDefault();
                  void enterWorld();
                }
              }}
            >
              <div className="quickPlayPanel">
                <div>
                  <strong>{tr(accountSession?.authProvider === "account" ? `Continue as ${accountSession.character.name}` : accountSession?.authProvider === "guest" ? `Continue guest ${accountSession.character.name}` : "Play now")}</strong>
                  <span>{tr(accountSession?.authProvider === "account" ? "Your hero is saved to this account." : "Start instantly. Save the hero to an account later.")}</span>
                </div>
                {accountSession?.authProvider !== "account" ? (
                  <div className="quickClassChoices" aria-label={tr("Quick play class")}>
                    {playableClassDefinitions.map((definition) => (
                      <button
                        type="button"
                        className={definition.id === classId ? "quickClassChoice activeQuickClassChoice" : "quickClassChoice"}
                        key={definition.id}
                        onClick={() => {
                          detachLegacyCharacter();
                          setAccountCharacterId(undefined);
                          setClassId(definition.id);
                        }}
                      >
                        {tr(definition.label)}
                      </button>
                    ))}
                  </div>
                ) : null}
                <button className="launcherSubmit quickPlayButton" type="button" onClick={() => void startGuestWorld()} disabled={authBusy}>
                  {authBusy ? tr("Connecting...") : tr("Play")}
                </button>
              </div>

              <div className="authTabs">
                <button
                  type="button"
                  className={authMode === "login" ? "authTab activeAuthTab" : "authTab"}
                  onClick={() => {
                    setAuthMode("login");
                    setAuthError("");
                    setAuthNotice("");
                  }}
                >
                  {tr("Sign in")}
                </button>
                <button
                  type="button"
                  className={authMode === "register" ? "authTab activeAuthTab" : "authTab"}
                  onClick={() => {
                    setAuthMode("register");
                    setAuthError("");
                    setAuthNotice("");
                  }}
                >
                  {tr("Create account")}
                </button>
                <button
                  type="button"
                  className={authMode === "reset" ? "authTab activeAuthTab" : "authTab"}
                  onClick={() => {
                    setAuthMode("reset");
                    setAuthError("");
                    setAuthNotice("");
                  }}
                >
                  {tr("Reset password")}
                </button>
              </div>

              <div className="accountGrid">
                <label>
                  {tr(authMode === "register" ? "Email" : authMode === "reset" ? "Account email" : "Email / login")}
                  <input
                    value={accountLogin}
                    maxLength={72}
                    autoComplete="username"
                    onChange={(event) => {
                      setAccountLogin(event.target.value);
                      resetEmailCodeState();
                    }}
                  />
                </label>
                <label>
                  {tr(authMode === "reset" ? "New password" : "Password")}
                  <input
                    type="password"
                    value={accountPassword}
                    maxLength={72}
                    autoComplete={authMode === "login" ? "current-password" : "new-password"}
                    onChange={(event) => setAccountPassword(event.target.value)}
                  />
                </label>
              </div>

              {authMode === "register" && registerCodeSent ? (
                <div className="emailCodePanel">
                  <label>
                    {tr("Email code")}
                    <input
                      value={registerEmailCode}
                      inputMode="numeric"
                      maxLength={6}
                      autoComplete="one-time-code"
                      placeholder="000000"
                      onChange={(event) => setRegisterEmailCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    />
                  </label>
                  <button type="button" className="secondaryLauncherButton" onClick={() => void requestAccountEmailCode(undefined, "launcher")} disabled={authBusy}>
                    {tr("Resend")}
                  </button>
                </div>
              ) : null}

              {authMode === "reset" && resetCodeSent ? (
                <div className="emailCodePanel">
                  <label>
                    {tr("Reset code")}
                    <input
                      value={resetEmailCode}
                      inputMode="numeric"
                      maxLength={6}
                      autoComplete="one-time-code"
                      placeholder="000000"
                      onChange={(event) => setResetEmailCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    />
                  </label>
                  <button type="button" className="secondaryLauncherButton" onClick={() => void requestPasswordResetCode()} disabled={authBusy}>
                    {tr("Resend")}
                  </button>
                </div>
              ) : null}

              {authMode === "register" ? (
                <>
                  <label>
                    {tr("Character name")}
                    <input
                      value={playerName}
                      maxLength={18}
                      onChange={(event) => {
                        detachLegacyCharacter();
                        setAccountCharacterId(undefined);
                        setPlayerName(event.target.value);
                      }}
                    />
                  </label>
                  <div className="classChoices">
                    {playableClassDefinitions.map((definition) => (
                      <button
                        type="button"
                        className={definition.id === classId ? "classChoice activeClass" : "classChoice"}
                        key={definition.id}
                        onClick={() => {
                          detachLegacyCharacter();
                          setAccountCharacterId(undefined);
                          setClassId(definition.id);
                        }}
                      >
                        <strong>{tr(definition.label)}</strong>
                        <span>
                        {tr(`${definition.speed} speed, ${definition.attackRange}px, ${definition.attackCooldownMs}ms`)}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="raceChoices">
                    {raceOptions.map((option) => (
                      <button type="button" className={race === option.id ? "raceChoice activeRace" : "raceChoice"} key={option.id} onClick={() => setRace(option.id)}>
                        {tr(option.label)}
                      </button>
                    ))}
                  </div>
                  <div className="appearancePanel">
                    <div className="appearanceRow">
                      <strong>{tr("Gender")}</strong>
                      <div className="appearanceChoices compactAppearanceChoices genderAppearanceChoices">
                        {genderOptions.map((option) => (
                          <button
                            type="button"
                            className={faceParts.gender === option.id ? "appearanceChoice activeAppearanceChoice" : "appearanceChoice"}
                            key={option.id}
                            onClick={() => updateFacePart({ gender: option.id })}
                          >
                            {tr(option.label)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="appearanceRow">
                      <strong>{tr("Hair")}</strong>
                      <div className="appearanceChoices">
                        {hairOptions.map((label, index) => (
                          <button
                            type="button"
                            className={faceParts.hair === index + 1 ? "appearanceChoice activeAppearanceChoice" : "appearanceChoice"}
                            key={label}
                            onClick={() => updateFacePart({ hair: index + 1 })}
                          >
                            {tr(label)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="appearanceRow">
                      <strong>{tr("Eyes")}</strong>
                      <div className="appearanceChoices compactAppearanceChoices">
                        {eyeOptions.map((label, index) => (
                          <button
                            type="button"
                            className={faceParts.eyes === index + 1 ? "appearanceChoice activeAppearanceChoice" : "appearanceChoice"}
                            key={label}
                            onClick={() => updateFacePart({ eyes: index + 1 })}
                          >
                            {tr(label)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="appearanceRow">
                      <strong>{tr("Mark")}</strong>
                      <div className="appearanceChoices compactAppearanceChoices">
                        {activeMarkOptions.map((label, index) => (
                          <button
                            type="button"
                            className={faceParts.mark === index + 1 ? "appearanceChoice activeAppearanceChoice" : "appearanceChoice"}
                            key={label}
                            onClick={() => updateFacePart({ mark: index + 1 })}
                          >
                            {tr(label)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className={`characterPreview race-${race} class-${classId} gender-${faceParts.gender} hair-${faceParts.hair} eyes-${faceParts.eyes} mark-${faceParts.mark}`}>
                    <div className="previewStage">
                      <span className="previewAvatar">
                        <span className="previewCloak" />
                        <span className="previewHead">
                          <span className="previewEar previewEarLeft" />
                          <span className="previewEar previewEarRight" />
                          <span className="previewHair" />
                          <span className="previewEyes" />
                          <span className="previewFaceMark" />
                          <span className="previewTusks" />
                        </span>
                        <span className="previewShoulder previewShoulderLeft" />
                        <span className="previewShoulder previewShoulderRight" />
                        <span className="previewArm previewArmLeft" />
                        <span className="previewArm previewArmRight" />
                        <span className="previewBody" />
                        <span className="previewBust" />
                        <span className="previewLeg previewLegLeft" />
                        <span className="previewLeg previewLegRight" />
                        <span className="previewBoot previewBootLeft" />
                        <span className="previewBoot previewBootRight" />
                        <span className="previewWeapon" />
                      </span>
                    </div>
                    <div>
                      <strong>{playerName.trim() || tr("New hero")}</strong>
                      <span>
                        {tr(genderOptions.find((option) => option.id === faceParts.gender)?.label ?? "")} · {tr(raceOptions.find((option) => option.id === race)?.label ?? "")} {tr(classDef.label)}, {tr(hairOptions[faceParts.hair - 1])} {tr("hair")}, {tr(eyeOptions[faceParts.eyes - 1])} {tr("eyes")}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="classPanel">
                  <UserRound size={18} />
                  <span>
                    {authMode === "reset"
                      ? tr("Enter the email used for the account. A reset code will be sent there.")
                      : accountSession?.authProvider === "account"
                        ? tr(`${accountSession.character.name} saved locally. Leave password empty for quick enter.`)
                        : tr("Sign in returns a saved account hero.")}
                  </span>
                </div>
              )}

              <div className="classPanel">
                <Shield size={18} />
                <span>
                  {authMode === "register"
                    ? tr(`${classDef.maxHp} HP, ${classDef.speed} speed, ${classDef.attackRange}px attack`)
                    : authMode === "reset"
                      ? tr("Reset codes expire in 10 minutes. Existing sessions stay valid until replaced.")
                      : tr("Names are locked after creation.")}
                </span>
              </div>
              {authNotice ? <div className="authNotice">{tr(authNotice)}</div> : null}
              {authError ? <div className="authError">{tr(authError)}</div> : null}
              <button className="launcherSubmit" type="button" onClick={() => void enterWorld()} disabled={authBusy}>
                {authBusy
                  ? tr("Connecting...")
                  : authMode === "reset"
                    ? resetCodeSent
                      ? tr("Reset password & enter")
                      : tr("Send reset code")
                    : authMode === "register"
                    ? registerCodeSent
                      ? tr("Verify code & create")
                      : tr("Send email code")
                    : accountSession?.authProvider === "account" && !accountPassword.trim()
                      ? tr(`Enter as ${accountSession.character.name}`)
                      : tr("Enter world")}
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section className={`${profileOpen || shopOpen || teleportMenuOpen || vendorSellerId || activeTrade || adminOpen ? "playLayout profileActive" : "playLayout"}${chatOpen ? " chatActive" : ""}`}>
          <GameCanvas
            language={language}
            playerName={playerName}
            classId={classId}
            characterId={characterId}
            token={sessionToken}
            race={race}
            face={face}
            customHeadUrl={customHeadUrl}
            walletAddress={walletAddress}
            onPlayerId={setPlayerId}
            onSnapshot={setSnapshot}
            onInventory={(payload) => {
              setInventory(payload.items);
              setEquipment(payload.equipment);
              setStats(payload.stats);
              setGold(payload.gold);
              setWalletState(payload.wallet);
            }}
            onChat={(message) => {
              const chatAgeMs = Date.now() - message.at;
              const lootSystemChat = isLootSystemChat(message);
              if ((message.channel === "system" && !lootSystemChat) || document.hidden || (Number.isFinite(chatAgeMs) && chatAgeMs > 18_000)) {
                return;
              }
              const chatLimit = mobileLayout ? 60 : 200;
              const toastLimit = mobileLayout ? 4 : 64;
              setChatMessages((current) => [...current.filter((item) => item.id !== message.id), message].slice(-chatLimit));
              if (!chatOpenRef.current) {
                setChatToasts((current) => [...current.filter((item) => item.id !== message.id), message].slice(-toastLimit));
                const timer = window.setTimeout(() => {
                  setChatToasts((current) => current.filter((item) => item.id !== message.id));
                  chatToastTimerRef.current = chatToastTimerRef.current.filter((item) => item !== timer);
                }, mobileLayout ? 4200 : 11000);
                chatToastTimerRef.current.push(timer);
              }
            }}
            onAdminState={setAdminState}
            onFeedbackSaved={(payload) => {
              setFeedbackStatus(payload.message);
              if (payload.ok) {
                setFeedbackDraft("");
              }
            }}
            onRealtimeError={handleRealtimeError}
            onClaim={(claim) => {
              setClaimStatus(claim.amount > 0 ? `${claim.amount} TOKEN queued` : "Need 25 gold and connected wallet");
              if (claim.amount > 0) {
                setWalletState((current) => ({
                  ...current,
                  connected: Boolean(walletAddress),
                  address: walletAddress ?? current.address,
                  pendingToken: current.pendingToken + claim.amount
                }));
              }
              if (claim.amount > 0) {
                void fetch(`${blockchainApiUrl}/claims/reward`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json"
                  },
                  body: JSON.stringify({
                    playerId,
                    walletAddress,
                    amount: claim.amount
                  })
                  })
                  .then((response) => response.json())
                  .then((queued: { claimId?: string; status?: string }) => {
                    setClaimStatus(`${claim.amount} TOKEN ${queued.status ?? "queued"}`);
                  })
                  .catch(() => {
                    setClaimStatus(`${claim.amount} TOKEN queued locally`);
                  });
              }
            }}
          />

          {locationBanner ? (
            <div className="locationBanner" key={locationBanner.key}>
              <span>{tr(locationBanner.subtitle)}</span>
              <strong>{tr(locationBanner.label)}</strong>
            </div>
          ) : null}

          <aside
            className="hud"
            onFocusCapture={(event) => {
              const target = event.target;
              const focused = profileOpen || shopOpen || teleportMenuOpen || Boolean(vendorSellerId) || Boolean(activeTrade) || (target instanceof HTMLElement && Boolean(target.closest("input, textarea, select")));
              window.dispatchEvent(new CustomEvent("mmo:uiFocus", { detail: { focused } }));
            }}
            onBlurCapture={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null) && !profileOpen && !shopOpen && !teleportMenuOpen && !vendorSellerId && !activeTrade) {
                window.dispatchEvent(new CustomEvent("mmo:uiFocus", { detail: { focused: false } }));
              }
            }}
          >
            <div
              className="vitals profileVitals"
              role="button"
              tabIndex={0}
              onClick={() => openProfile("equipment")}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openProfile("equipment");
                }
              }}
            >
              <div className="statusHeader compactStatus">
                <div className="statusIdentity">
                  {localPlayer?.clanTag ? <span className={`clanBadge clan-${localPlayer.clanEmblem ?? "shield"}`}>{clanEmblemMark(localPlayer.clanEmblem)}</span> : null}
                  {localPlayer?.clanTag ? <span className="statusClanTag">{localPlayer.clanTag}</span> : null}
                  <strong className={localNameState}>{localPlayer?.name ?? playerName}</strong>
                  {localPlayer?.premium ? <span className="statusPremiumBadge"><Crown size={11} /> Premium</span> : null}
                </div>
                <span>
                  {isAdmin && adminState ? `${tr("real")} ${adminState.realOnline}/${adminState.totalOnline}` : `${tr("online")} ${snapshot?.onlineCount ?? 0}`} · {serverClock}
                </span>
              </div>
              <div className="combatCounters">
                <span>PK {localPlayer?.pkCount ?? 0}</span>
                <span>PvP {localPlayer?.pvpCount ?? 0}</span>
                <span>AR {localArenaRating}</span>
                <span className={localNameState}>
                  {localPlayer?.karma ? `${tr("Karma")} ${localPlayer.karma}` : localPvpFlagged ? tr("PvP flag") : tr("Neutral")}
                </span>
              </div>
              <div className="barStack">
                <div className="resourceBar cpBar">
                  <span style={{ width: `${localPlayer && localPlayer.cp > 0 && localPlayer.maxCp > 0 ? Math.max(3, (localPlayer.cp / localPlayer.maxCp) * 100) : 0}%` }} />
                  <strong>
                    CP {Math.round(localPlayer?.cp ?? 0)}/{localPlayer?.maxCp ?? 0}
                  </strong>
                </div>
                <div className="resourceBar hpBar">
                  <span style={{ width: `${localPlayer ? Math.max(3, (localPlayer.hp / localPlayer.maxHp) * 100) : 0}%` }} />
                  <strong>
                    HP {Math.round(localPlayer?.hp ?? 0)}/{localPlayer?.maxHp ?? classDef.maxHp}
                  </strong>
                </div>
                <div className="resourceBar mpBar">
                  <span style={{ width: `${localPlayer ? Math.max(3, (localPlayer.mp / localPlayer.maxMp) * 100) : 0}%` }} />
                  <strong>
                    MP {Math.round(localPlayer?.mp ?? 0)}/{localPlayer?.maxMp ?? classDef.maxMp}
                  </strong>
                </div>
                <div className="resourceBar xpBar">
                  <span
                    style={{
                      width: `${Math.min(100, ((localPlayer?.xp ?? 0) / nextLevelXp) * 100)}%`
                    }}
                  />
                  <strong>
                    {tr("Lv.")}{localPlayer?.level ?? 1} XP {localPlayer?.xp ?? 0}
                  </strong>
                </div>
              </div>
            </div>

            {guestSessionActive ? (
              <div className={saveHeroOpen ? "guestSavePanel openGuestSavePanel" : "guestSavePanel"}>
                {!saveHeroOpen ? (
                  <button type="button" className="guestSaveToggle" onClick={() => setSaveHeroOpen(true)}>
                    <Shield size={15} />
                    <span>{tr("Save hero")}</span>
                  </button>
                ) : (
                  <div className="guestSaveCard" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
                    <div className="guestSaveHeader">
                      <div>
                        <strong>{tr("Save hero")}</strong>
                        <span>{tr("Name and bind this character to an account.")}</span>
                      </div>
                      <button type="button" className="iconOnly" onClick={() => setSaveHeroOpen(false)} aria-label={tr("Close save hero")}>
                        <X size={14} />
                      </button>
                    </div>
                    <div className="guestSaveFields guestNameFields">
                      <input
                        aria-label={tr("Hero name")}
                        value={playerName}
                        maxLength={18}
                        placeholder={tr("hero name")}
                        autoComplete="nickname"
                        onChange={(event) => {
                          setPlayerName(event.target.value);
                          resetEmailCodeState();
                        }}
                        onKeyDown={(event) => event.stopPropagation()}
                      />
                    </div>
                    <div className="guestSaveFields">
                      <input
                        aria-label={tr("Email or login")}
                        value={accountLogin}
                        maxLength={72}
                        placeholder={tr("email")}
                        autoComplete="username"
                        onChange={(event) => {
                          setAccountLogin(event.target.value);
                          resetEmailCodeState();
                        }}
                        onKeyDown={(event) => event.stopPropagation()}
                      />
                      <input
                        aria-label={tr("Password")}
                        type="password"
                        value={accountPassword}
                        maxLength={72}
                        placeholder={tr("password")}
                        autoComplete="new-password"
                        onChange={(event) => setAccountPassword(event.target.value)}
                        onKeyDown={(event) => event.stopPropagation()}
                      />
                    </div>
                    {guestCodeSent ? (
                      <div className="guestSaveFields guestCodeFields">
                        <input
                          aria-label={tr("Email code")}
                          value={guestEmailCode}
                          inputMode="numeric"
                          maxLength={6}
                          placeholder={tr("email code")}
                          autoComplete="one-time-code"
                          onChange={(event) => setGuestEmailCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                          onKeyDown={(event) => event.stopPropagation()}
                        />
                        <button type="button" className="guestSaveSubmit secondaryGuestSaveButton" onClick={() => void requestAccountEmailCode(currentHeroCharacter(), "guest")} disabled={authBusy}>
                          {tr("Resend")}
                        </button>
                      </div>
                    ) : null}
                    <button type="button" className="guestSaveSubmit" onClick={() => void saveGuestCharacter()} disabled={authBusy}>
                      {authBusy ? tr("Saving...") : guestCodeSent ? tr("Verify & save") : tr("Send email code")}
                    </button>
                    {saveHeroStatus ? <span className="guestSaveStatus">{tr(saveHeroStatus)}</span> : null}
                  </div>
                )}
              </div>
            ) : accountHeroNeedsName ? (
              <div className={renameHeroOpen ? "guestSavePanel openGuestSavePanel renameHeroPanel" : "guestSavePanel renameHeroPanel"}>
                {!renameHeroOpen ? (
                  <button
                    type="button"
                    className="guestSaveToggle"
                    onClick={() => {
                      setRenameHeroOpen(true);
                      setPlayerName(localPlayer?.name ?? accountSession?.character.name ?? playerName);
                    }}
                  >
                    <UserRound size={15} />
                    <span>{tr("Name hero")}</span>
                  </button>
                ) : (
                  <div className="guestSaveCard" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
                    <div className="guestSaveHeader">
                      <div>
                        <strong>{tr("Name hero")}</strong>
                        <span>{tr("Replace the temporary Player name.")}</span>
                      </div>
                      <button type="button" className="iconOnly" onClick={() => setRenameHeroOpen(false)} aria-label={tr("Close rename hero")}>
                        <X size={14} />
                      </button>
                    </div>
                    <div className="guestSaveFields guestNameFields">
                      <input
                        aria-label={tr("Hero name")}
                        value={playerName}
                        maxLength={18}
                        placeholder={tr("hero name")}
                        autoComplete="nickname"
                        onChange={(event) => setPlayerName(event.target.value)}
                        onKeyDown={(event) => event.stopPropagation()}
                      />
                    </div>
                    <button type="button" className="guestSaveSubmit" onClick={() => void renameAccountHero()} disabled={authBusy}>
                      {authBusy ? tr("Saving...") : tr("Save name")}
                    </button>
                    {renameHeroStatus ? <span className="guestSaveStatus">{tr(renameHeroStatus)}</span> : null}
                  </div>
                )}
              </div>
            ) : saveHeroStatus ? (
              <div className="guestSavePanel savedGuestNotice">
                <span>{tr(saveHeroStatus)}</span>
              </div>
            ) : null}

            {isAdmin && adminOpen ? (
              <div className="adminPanel" ref={adminPanelRef} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
                <div className="adminPanelHeader">
                  <div>
                    <strong>{tr("Admin")}</strong>
                    <span>
                      {tr("real")} {adminState?.realOnline ?? 0} · {tr("bots")} {adminState?.botOnline ?? 0} · {tr("total")} {adminState?.totalOnline ?? snapshot?.onlineCount ?? 0}
                    </span>
                  </div>
                  <button type="button" onClick={() => setAdminOpen(false)} aria-label={tr("Close admin panel")}>
                    <X size={16} />
                  </button>
                </div>
                {adminState?.message ? <div className="adminNotice">{tr(adminState.message)}</div> : null}
                <div className="adminGlobalActions">
                  <span>{tr(adminState?.singersHidden ? "Musicians hidden" : `${adminState?.singerOnline ?? 0} musicians live`)}</span>
                  <button type="button" onClick={() => sendAdminAction("summonSingers", localPlayer?.id)} disabled={!localPlayer}>
                    <Mic2 size={13} />
                    {tr("Return musicians")}
                  </button>
                  <button type="button" onClick={() => sendAdminAction("hideSingers", localPlayer?.id)} disabled={!localPlayer}>
                    <X size={13} />
                    {tr("Hide musicians")}
                  </button>
                </div>
                <div className="adminFeedbackList">
                  <strong>{tr("Beta reports")}</strong>
                  {(adminState?.feedbackReports ?? []).slice(0, 5).map((report) => (
                    <div className="adminFeedbackItem" key={report.id}>
                      <span>
                        {report.playerName} · {tr("Lv.")}{report.level} ·{" "}
                        {new Date(report.createdAt).toLocaleTimeString(language === "ru" ? "ru-RU" : "en-US", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <p>{report.text}</p>
                      <em>
                        {tr(report.zone)} · x {Math.round(report.position.x)} y {Math.round(report.position.y)}
                        {report.context ? ` · ${report.context}` : ""}
                      </em>
                    </div>
                  ))}
                  {adminState && adminState.feedbackReports.length === 0 ? <span className="adminEmpty">{tr("No beta reports yet.")}</span> : null}
                </div>
                <div className="adminPlayerList">
                  {(adminState?.players ?? []).map((player) => (
                    <button
                      type="button"
                      className={`${player.bot ? "adminPlayer botAdminPlayer" : "adminPlayer"} ${selectedAdminPlayer?.id === player.id ? "activeAdminPlayer" : ""}`}
                      key={player.id}
                      onClick={() => setSelectedAdminPlayerId(player.id)}
                    >
                      <strong>{player.name}</strong>
                      <span>
                        {tr(player.bot ? "Bot" : "Real")} · {tr("Lv.")}{player.level} {tr(CLASS_DEFINITIONS[player.classId].label)} · HP {Math.round(player.hp)}/{player.maxHp} · {tr(player.zone)}
                      </span>
                      <em>{tr(player.mutedUntil && player.mutedUntil > Date.now() ? "muted" : player.karma > 0 ? `karma ${player.karma}` : "ok")}</em>
                    </button>
                  ))}
                  {adminState && adminState.players.length === 0 ? <span className="adminEmpty">{tr("No players or bots online.")}</span> : null}
                </div>
                {selectedAdminPlayer ? (
                  <div className="adminSelected">
                    <div>
                      <strong>{selectedAdminPlayer.name}</strong>
                      <span>
                        {selectedAdminPlayer.bot ? `${tr("bot")} · ` : ""}{tr("gold")} {selectedAdminPlayer.gold} · {tr("karma")} {selectedAdminPlayer.karma} · x {Math.round(selectedAdminPlayer.position.x)} y {Math.round(selectedAdminPlayer.position.y)}
                      </span>
                    </div>
                    <div className="adminActions">
                      <button type="button" onClick={() => sendAdminAction("teleportTo")}>{tr("Go")}</button>
                      <button type="button" onClick={() => sendAdminAction("summon")}>{tr("Summon")}</button>
                      <button type="button" onClick={() => sendAdminAction("heal")}>{tr("Heal")}</button>
                      <button type="button" onClick={() => sendAdminAction("revive")}>{tr("Revive")}</button>
                      <button type="button" onClick={() => sendAdminAction("clearKarma")}>{tr("Clear karma")}</button>
                      <button type="button" onClick={() => sendAdminAction("muteChat", selectedAdminPlayer.id, 15 * 60_000)}>{tr("Mute 15m")}</button>
                      <button type="button" onClick={() => sendAdminAction("unmuteChat")}>{tr("Unmute")}</button>
                      <button type="button" disabled={selectedAdminPlayer.id === localPlayer?.id} onClick={() => sendAdminAction("kick")}>{tr("Kick")}</button>
                      <button type="button" className="dangerAdminAction" disabled={selectedAdminPlayer.id === localPlayer?.id} onClick={() => sendAdminAction("ban")}>{tr("Ban")}</button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {localPlayer || visibleStoryQuest ? (
              <div className={profileOpen || shopOpen || teleportMenuOpen || vendorSellerId || activeTrade || adminOpen ? "leftHudStack hiddenLeftHudStack" : "leftHudStack"}>
                {visibleStoryQuest ? (
                  <div className={activeStoryQuest ? "questTrackerPanel activeQuestTracker" : "questTrackerPanel"}>
                    <div className="questTrackerOneLine">
	                      <button type="button" className="questTrackerMain" onClick={() => openProfile("quests")}>
	                        <Target size={15} />
	                        {activeStoryQuest || !mobileLayout ? <span>{tr(activeStoryQuest ? activeQuestProgressLabel : visibleStoryQuest.title)}</span> : null}
	                        {activeStoryQuest && activeStoryProgress ? <strong>{tr(activeQuestProgressText)}</strong> : !mobileLayout ? <strong>{tr("Take")}</strong> : null}
	                      </button>
	                      {activeStoryQuest || !mobileLayout ? (
	                        <button type="button" className="questTrackerPlace" disabled={!visibleStoryQuest.target} onClick={() => openStoryQuestMap(visibleStoryQuest.target)}>
	                          <span>{tr(visibleStoryQuest.target?.label ?? "Target")}</span>
	                          {activeStoryQuest && questTargetDistance !== undefined ? <strong>{Math.round(questTargetDistance)}{tr("m")}</strong> : null}
	                        </button>
	                      ) : null}
                    </div>
                    <b className="questTrackerProgress">
                      <b style={{ width: `${activeStoryQuest && activeStoryProgress ? activeQuestProgressPercent : 0}%` }} />
                    </b>
                  </div>
                ) : null}

                {localPlayer ? (
                  <div className={pathChallengeState.collapsed ? "guidePanel checkGuidePanel collapsedGuidePanel" : "guidePanel checkGuidePanel"}>
                    <button type="button" className="guideHeader" onClick={() => setPathChallengeState((current) => ({ ...current, collapsed: !current.collapsed }))}>
                      <div>
                        <strong>{tr("Daily checks")}</strong>
                        <span>{tr(nextGuideStep ? nextGuideStep.label : "All checks complete")}</span>
                      </div>
                      <em>
                        {hourlyDone}/{hourlyGuideSteps.length} {tr("H")} · {dailyDone}/{dailyGuideSteps.length} {tr("D")}
                      </em>
                      <ChevronDown className="guideCollapseIcon" size={14} aria-hidden />
                    </button>
                    {!pathChallengeState.collapsed ? (
                      <>
                        <div className="guideSectionTitle">
                          <span>{tr("Hourly")}</span>
                          <small>{hourlyResetText}</small>
                        </div>
                        {hourlyGuideSteps.map((step) => {
                          const progressRatio = Math.min(100, Math.max(0, (step.progress / Math.max(1, step.goal)) * 100));
                          const progressValue = Math.min(step.goal, Math.max(0, Math.round(step.progress)));
                          return (
                            <i className={step.done ? "doneGuideStep" : nextGuideStep?.id === step.id ? "activeGuideStep" : ""} key={step.id}>
                              <strong>{tr(step.label)}</strong>
                              <span>{tr(step.hint)}</span>
                              <em>
                                {progressValue}/{step.goal}
                              </em>
                              <b className="guideProgress">
                                <b style={{ width: `${progressRatio}%` }} />
                              </b>
                            </i>
                          );
                        })}
                        <div className="guideSectionTitle">
                          <span>{tr("Daily")}</span>
                          <small>{dailyResetText}</small>
                        </div>
                        {dailyGuideSteps.map((step) => {
                          const progressRatio = Math.min(100, Math.max(0, (step.progress / Math.max(1, step.goal)) * 100));
                          const progressValue = Math.min(step.goal, Math.max(0, Math.round(step.progress)));
                          return (
                            <i className={step.done ? "doneGuideStep" : nextGuideStep?.id === step.id ? "activeGuideStep" : ""} key={step.id}>
                              <strong>{tr(step.label)}</strong>
                              <span>{tr(step.hint)}</span>
                              <em>
                                {progressValue}/{step.goal}
                              </em>
                              <b className="guideProgress">
                                <b style={{ width: `${progressRatio}%` }} />
                              </b>
                            </i>
                          );
                        })}
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="rightHudStack">
              {localPlayer && showMiniRadar ? (
                <button type="button" className="miniRadar" aria-label={tr("Open world map centered on you")} title={tr("Open map")} onClick={openWorldMapFromRadar}>
                  <div className="miniRadarDisc">
                    <span className="miniRadarNorth">{tr("N")}</span>
                    <span className="miniRadarEast">{tr("E")}</span>
                    <span className="miniRadarSouth">{tr("S")}</span>
                    <span className="miniRadarWest">{tr("W")}</span>
                    <i className="miniRadarSelf" style={{ transform: `translate(-50%, -50%) rotate(var(--mmo-local-facing-deg, ${snapshotFacingDegrees}deg))` } as CSSProperties} />
                    {miniRadarPlayers.map((entry) => (
                      <i
                        className={`miniRadarDot radar-${entry.relation}${entry.outOfRange ? " radar-far" : ""}`}
                        key={entry.id}
                        style={{ left: `${entry.x}%`, top: `${entry.y}%` } as CSSProperties}
                        title={`${entry.name} · ${Math.round(entry.distance)} ${tr("m")}`}
                      />
                    ))}
                    {questRadarPoint ? (
                      <i
                        className={questRadarPoint.outOfRange ? "miniRadarQuestTarget questTargetOutside" : "miniRadarQuestTarget"}
                        style={{ left: `${questRadarPoint.x}%`, top: `${questRadarPoint.y}%` } as CSSProperties}
                        title={`${tr(activeQuestTarget?.label ?? "Quest")} · ${Math.round(questRadarPoint.distance)} ${tr("m")}`}
                      />
                    ) : null}
                  </div>
                  <div className="miniRadarMeta">
                    <strong>{miniRadarPlayers.length}</strong>
                    <span>{miniRadarClanCount} {tr("clan")}</span>
	                  </div>
	                </button>
	              ) : null}

              {localPlayer ? (
                <div className={`voiceHud ${voiceState.active ? "voiceActive" : ""} ${voiceEnabled ? "" : "voiceDisabled"} ${canUsePartyVoice ? "" : "voiceIconOnly"}`}>
                  <button
                    type="button"
                    className="voicePttButton"
                    aria-label={`${tr("Push to talk")}: ${voiceStatusDisplay}`}
                    title={voiceStatusDisplay}
                    disabled={!voiceEnabled || !voiceState.supported}
	                    onPointerDown={(event) => {
	                      event.preventDefault();
                      event.currentTarget.setPointerCapture?.(event.pointerId);
	                      startVoicePushToTalk();
	                    }}
	                    onPointerUp={(event) => {
	                      event.preventDefault();
                      event.currentTarget.releasePointerCapture?.(event.pointerId);
	                      stopVoicePushToTalk();
	                    }}
                    onPointerCancel={stopVoicePushToTalk}
                    onPointerLeave={() => {
                      if (voiceState.active) {
                        stopVoicePushToTalk();
                      }
                    }}
                  >
                    {voiceEnabled && voiceState.supported ? <Mic size={16} /> : <MicOff size={16} />}
                  </button>
                  {canUsePartyVoice ? (
                    <div className="voiceChannelToggle" role="group" aria-label={tr("Voice channel")}>
                      <button type="button" className={effectiveVoiceChannel === "nearby" ? "active" : ""} onClick={() => updateVoiceChannel("nearby")}>
                        <Radio size={13} />
                        <span>{tr("Near")}</span>
                      </button>
                      <button type="button" className={effectiveVoiceChannel === "party" ? "active" : ""} onClick={() => updateVoiceChannel("party")}>
                        <Users size={13} />
                        <span>{tr("Party")}</span>
                      </button>
                    </div>
                  ) : null}
                  {voiceState.error ? <small className="voiceStatusLine">{tr(voiceState.error)}</small> : null}
                </div>
              ) : null}

	              {nearbyGroundItems.length > 0 ? (
	                <div className="lootPanel">
                  <div className="lootPanelHeader">
                    <Package size={15} />
                    <strong>{tr("Loot nearby")}</strong>
                  </div>
                  {nearbyGroundItems.slice(0, 3).map(({ item }) => (
                    <button type="button" className={item.rare ? "rareLootButton" : ""} key={item.id} onClick={() => window.dispatchEvent(new CustomEvent("mmo:pickupGroundItem", { detail: { itemId: item.id } }))}>
                      <Package size={14} />
                      <span>
                        {tr(item.label)} {item.quantity > 1 ? `x${item.quantity}` : ""}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}

              {localPlayer?.hp !== 0 && nearbyDownedPlayers.length > 0 ? (
                <div className="revivePanel">
                  <div className="revivePanelHeader">
                    <HeartPulse size={15} />
                    <strong>{tr("Res nearby")}</strong>
                  </div>
                  {nearbyDownedPlayers.slice(0, 2).map((player) => (
                    <button type="button" key={player.id} onClick={() => window.dispatchEvent(new CustomEvent("mmo:revive", { detail: { targetId: player.id } }))}>
                      <HeartPulse size={14} />
                      <span>{player.name}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {betaNoticeOpen ? (
              <div className="betaNotice" role="dialog" aria-label={tr("Beta information")}>
                <div className="betaNoticeHeader">
                  <ShieldAlert size={18} />
                  <div>
                    <strong>{tr("Open beta build")}</strong>
                    <span>{tr("Progress can be wiped while balance, map and economy are being tested.")}</span>
                  </div>
                  <button
                    type="button"
                    aria-label={tr("Close beta notice")}
                    onClick={() => {
                      setBetaNoticeOpen(false);
                      try {
                        window.localStorage.setItem(betaNoticeStorageKey, "seen");
                      } catch {
                        // Ignore storage failures in private browsing.
                      }
                    }}
                  >
                    <X size={15} />
                  </button>
                </div>
                <p>{tr("Bug reports are saved in-game now. Open Settings and send a beta feedback report; admins can read it inside the admin panel.")}</p>
              </div>
            ) : null}

            {partyMembers.length > 1 ? (
              <div className="partyRoster">
                <strong>{tr("Party")}</strong>
                {partyMembers.slice(0, 5).map((member) => (
                  <div className="partyMember" key={member.id}>
                    <div className="partyMemberHeader">
                      <span className="partyMemberName">{member.name}</span>
                      <span className="partyMemberLevel">{tr("Lv.")}{member.level}</span>
                    </div>
                    <div className="partyVitals">
                      <div className="partyVitalBar partyHpBar">
                        <i style={{ width: partyVitalWidth(member.hp, member.maxHp) }} />
                        <em>
                          HP {Math.ceil(member.hp)}/{member.maxHp}
                        </em>
                      </div>
                      <div className="partyVitalBar partyCpBar">
                        <i style={{ width: partyVitalWidth(member.cp, member.maxCp) }} />
                        <em>
                          CP {Math.ceil(member.cp)}/{member.maxCp}
                        </em>
                      </div>
                      <div className="partyVitalBar partyMpBar">
                        <i style={{ width: partyVitalWidth(member.mp, member.maxMp) }} />
                        <em>
                          MP {Math.ceil(member.mp)}/{member.maxMp}
                        </em>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {selectedTarget ? (
              <div className="selectedTargetPanel">
                <div className="selectedTargetHeader">
                  <div className="selectedTargetTitleBlock">
                    <strong>{selectedMonster ? tr(selectedTargetTitle ?? "") : selectedTargetTitle}</strong>
                    <span>{selectedTargetSubtitle}</span>
                  </div>
                  <button
                    type="button"
                    className="selectedTargetClose"
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedTargetId(undefined);
                      window.dispatchEvent(new CustomEvent("mmo:clearSelectedTarget"));
                    }}
                    aria-label={tr("Clear target")}
                  >
                    <X size={12} />
                  </button>
                </div>
                <div className={selectedTargetHasCp ? "targetBars hasCp" : "targetBars"}>
                  {selectedTargetHasCp && selectedPlayer ? (
                    <div className="targetBar targetCpBar">
                      <span style={{ width: `${selectedPlayer.cp > 0 ? Math.max(2, (selectedPlayer.cp / selectedPlayer.maxCp) * 100) : 0}%` }} />
                      <strong>
                        CP {Math.ceil(selectedPlayer.cp)}/{selectedPlayer.maxCp}
                      </strong>
                    </div>
                  ) : null}
                  <div className="targetBar targetHpBar">
                    <span style={{ width: `${Math.max(3, (selectedTarget.hp / selectedTarget.maxHp) * 100)}%` }} />
                    <strong>
                      HP {Math.ceil(selectedTarget.hp)}/{selectedTarget.maxHp}
                    </strong>
                  </div>
                </div>
                {selectedPlayer ? (
                  <div className="selectedTargetActions">
                    <button
                      type="button"
                      disabled={Boolean(localPlayer?.partyId && selectedPlayer.partyId === localPlayer.partyId)}
                      onClick={() => window.dispatchEvent(new CustomEvent("mmo:partyInvite", { detail: { targetId: selectedPlayer.id } }))}
                    >
                      <UserRound size={14} />
                      {tr("Group")}
                    </button>
	                    <button
	                      type="button"
	                      disabled={localPlayer?.duelOpponentId === selectedPlayer.id || selectedPlayer.duelOpponentId === playerId}
	                      onClick={() => window.dispatchEvent(new CustomEvent("mmo:duelInvite", { detail: { targetId: selectedPlayer.id } }))}
	                    >
	                      <Swords size={14} />
	                      {tr("Duel")}
	                    </button>
                    {selectedPlayer.marketVendor?.items.length ? (
                      <button
                        type="button"
                        onClick={() => {
                          setVendorSellerId(selectedPlayer.id);
                          setShopOpen(false);
                          setTeleportMenuOpen(false);
                          setProfileOpen(false);
                        }}
                      >
                        <Store size={14} />
                        {tr("Shop")}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={Boolean(activeTrade) || selectedPlayer.id.startsWith("bot_")}
                      onClick={() => window.dispatchEvent(new CustomEvent("mmo:tradeInvite", { detail: { targetId: selectedPlayer.id } }))}
                    >
                      <Hand size={14} />
                      {tr("Trade")}
                    </button>
	                    {localClanIsLeader ? (
                      <button
                        type="button"
                        disabled={Boolean(selectedPlayer.clanId)}
                        onClick={() => window.dispatchEvent(new CustomEvent("mmo:clanInvite", { detail: { targetId: selectedPlayer.id } }))}
                      >
                        <Shield size={14} />
                        {tr("Clan")}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {incomingPartyInvite || incomingDuelInvite || incomingTradeInvite || incomingClanInvites.length > 0 ? (
	              <div className="invitePanel">
                {incomingPartyInvite ? (
                  <div className="inviteLine">
                    <strong>{incomingPartyInvite.fromName}</strong>
                    <span>{tr("invites you to party")}</span>
                    <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("mmo:partyAccept", { detail: { fromId: incomingPartyInvite.fromId } }))}>
                      {tr("Accept")}
                    </button>
                    <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("mmo:partyDecline", { detail: { fromId: incomingPartyInvite.fromId } }))}>
                      {tr("Decline")}
                    </button>
                  </div>
                ) : null}
	                {incomingDuelInvite ? (
	                  <div className="inviteLine">
	                    <strong>{incomingDuelInvite.fromName}</strong>
	                    <span>{tr("challenges you to duel")}</span>
                    <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("mmo:duelAccept", { detail: { fromId: incomingDuelInvite.fromId } }))}>
                      {tr("Accept")}
                    </button>
                    <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("mmo:duelDecline", { detail: { fromId: incomingDuelInvite.fromId } }))}>
                      {tr("Decline")}
                    </button>
	                  </div>
	                ) : null}
                {incomingTradeInvite ? (
                  <div className="inviteLine">
                    <strong>{incomingTradeInvite.fromName}</strong>
                    <span>{tr("wants to trade")}</span>
                    <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("mmo:tradeAccept", { detail: { fromId: incomingTradeInvite.fromId } }))}>
                      {tr("Accept")}
                    </button>
                    <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("mmo:tradeDecline", { detail: { fromId: incomingTradeInvite.fromId } }))}>
                      {tr("Decline")}
                    </button>
                  </div>
                ) : null}
	                {incomingClanInvites.map((invite) => (
                  <div className="inviteLine" key={`${invite.clanId}-${invite.fromId}`}>
                    <strong>{invite.fromName}</strong>
                    <span>{tr("invites you to clan")} {invite.clanTag}</span>
                    <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("mmo:clanAccept", { detail: { fromId: invite.fromId, clanId: invite.clanId } }))}>
                      {tr("Accept")}
                    </button>
                    <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("mmo:clanDecline", { detail: { fromId: invite.fromId, clanId: invite.clanId } }))}>
                      {tr("Decline")}
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            {localPlayer?.hp === 0 ? (
              <div className="deathPanel">
                <strong>{tr("You are downed")}</strong>
                <span>{tr("Resurrect in the nearest town or wait for another player to revive you.")}</span>
                <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("mmo:respawn"))}>
                  {tr("Resurrect in town")}
                </button>
              </div>
            ) : null}

            <div className="bottomDock">
              <button type="button" className={chatOpen ? "chatToggle openChatToggle" : "chatToggle"} onClick={() => setChatOpen((current) => !current)} aria-label={tr("Toggle chat")}>
                <MessageSquare size={18} />
                <span>{tr(chatOpen ? "Hide" : "Chat")}</span>
              </button>
              {chatToasts.length > 0 && !chatOpen ? (
                <div className="chatToastStack">
                  {chatToasts.slice(mobileLayout ? -1 : -40).map((message) => (
                    <button
                      type="button"
                      className={message.channel === "system" ? "chatToast systemToast" : message.channel === "clan" ? "chatToast clanToast" : "chatToast"}
                      key={message.id}
                      onClick={() => setChatOpen(true)}
                    >
                      <strong>{message.channel === "system" ? tr("System") : message.playerName}</strong>
                      <span>{localizedChatText(language, message)}</span>
                    </button>
                  ))}
                </div>
              ) : null}
              <div className={chatOpen ? "chatDock openChatDock" : "chatDock"} ref={chatDockRef}>
                <div className="chatList" ref={chatListRef}>
                  {chatMessages.filter((message) => message.channel !== "system" || isLootSystemChat(message)).map((message) => (
                    <div className={message.channel === "system" ? "chatLine systemLine" : message.channel === "clan" ? "chatLine clanLine" : "chatLine"} key={message.id}>
                      <strong>
                        {message.playerName} [{tr(message.channel === "system" ? "System" : message.channel === "local" ? "Local" : message.channel === "zone" ? "Zone" : message.channel === "dungeon" ? "Dungeon" : message.channel === "world" ? "World" : "Clan")}]
                      </strong>
                      <span>{localizedChatText(language, message)}</span>
                    </div>
                  ))}
                </div>
                <form
                  className="chatForm"
                  onSubmit={(event) => {
                    event.preventDefault();
                    sendChat();
                    blurChatInput();
                  }}
                >
                  <select
                    value={chatChannel}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      if (mobileLayout) {
                        window.dispatchEvent(new CustomEvent("mmo:uiFocus", { detail: { focused: true } }));
                      }
                    }}
                    onChange={(event) => setChatChannel(event.target.value as Exclude<ChatChannel, "system">)}
                  >
                    <option value="local">{tr("Local")}</option>
                    <option value="zone">{tr("Zone")}</option>
                    <option value="dungeon">{tr("Dungeon")}</option>
                    <option value="world">{tr("World")}</option>
                    <option value="clan" disabled={!localClan}>{tr("Clan")}</option>
                  </select>
                  <input
                    aria-label={tr("Chat message")}
                    ref={chatInputRef}
                    value={chatDraft}
                    maxLength={160}
                    enterKeyHint="send"
                    onChange={(event) => setChatDraft(event.target.value)}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      if (mobileLayout) {
                        event.currentTarget.focus({ preventScroll: true });
                        window.dispatchEvent(new CustomEvent("mmo:uiFocus", { detail: { focused: true } }));
                      }
                    }}
                    onKeyDown={(event) => {
                      event.stopPropagation();
                      if (event.key === "Escape") {
                        event.preventDefault();
                        blurChatInput();
                      }
                    }}
                  />
                  <button type="submit" aria-label={tr("Send chat")}>
                    <Send size={16} />
                  </button>
                </form>
              </div>
              <div className="skillDock">
                {!mobileLayout ? (
                  <button
                    type="button"
                    className="basicAttackButton"
                    onPointerDown={activateBasicAttackButton}
                    onPointerUp={releaseBasicAttackButton}
                    onPointerCancel={cancelBasicAttackButton}
                    onLostPointerCapture={releaseBasicAttackButton}
                    aria-label={tr("Basic attack")}
                  >
                    <Swords size={24} />
                    <span>{tr("Attack")}</span>
                  </button>
                ) : null}
                {canUseSinging && localPlayer ? (
                  <button
                    type="button"
                    className={localPlayer.singing ? "singingButton activeSingingButton" : "singingButton"}
                    onPointerDown={toggleSinging}
                    aria-label={tr(localPlayer.singing ? "Stop singing" : "Start singing")}
                    title={tr(localPlayer.singing ? "Stop singing" : "Sing")}
                  >
                    <Mic2 size={22} />
                    <span>{tr(localPlayer.singing ? "Singing" : "Sing")}</span>
                  </button>
                ) : null}
                <div className="hotbar">
                  {visibleHotbar.map((entry, index) => {
                    const skill = entry?.type === "skill" ? activeClassDef.skills.find((candidate) => candidate.id === entry.skillId) : undefined;
                    const item = entry?.type === "item" ? inventory.find((candidate) => candidate.id === entry.itemId) : undefined;
                    const locked = skill ? currentLevel < (skill.requiredLevel ?? 1) : entry?.type === "item" ? !item?.quantity : false;
                    const key = entry ? cooldownKey(entry) : "";
                    const cooldown = key ? cooldowns[key] : undefined;
                    const cooldownMs = cooldown && cooldown.readyAt > nowMs ? cooldown.readyAt - nowMs : 0;
                    const cooldownRatio = cooldownMs > 0 && cooldown ? cooldownMs / cooldown.duration : 0;
                    const cooldownSeconds = Math.ceil(cooldownMs / 1000);
                    const label = entry?.type === "attack" ? "Basic attack" : entry?.type === "sprint" ? "Quick run" : (skill?.label ?? item?.label ?? "Empty");
                    const visual = entry?.type === "attack" ? basicAttackVisual : entry?.type === "sprint" ? sprintVisual : skill ? skillVisual(skill.id) : undefined;
                    const SkillIcon = visual?.Icon;
                    const toneClass = visual ? visual.className : item ? "itemSlot" : "emptySlot";
                    const hasSkillArt = Boolean(skill && skillAtlasCells[skill.id]);
                    const hasPaintedArt = entry?.type === "attack" || hasSkillArt;
                    const slotClass = `${locked ? `skillSlot ${toneClass} lockedSkill` : `skillSlot ${toneClass}`}${cooldownRatio > 0 ? " coolingDown" : ""}${hasPaintedArt ? " hasSkillArt" : ""}`;
                    return (
                      <button
                        type="button"
                        className={slotClass}
                        key={`${index}-${entry?.type ?? "empty"}-${entry?.type === "skill" ? entry.skillId : entry?.type === "item" ? entry.itemId : entry?.type === "sprint" ? "run" : "basic"}`}
                        disabled={!entry || locked}
                        onPointerDown={(event) => activateHotbarPointer(event, entry)}
                        onPointerUp={(event) => releaseHotbarPointer(event, entry)}
                        onPointerCancel={(event) => cancelHotbarPointer(event, entry)}
                        onLostPointerCapture={(event) => releaseHotbarPointer(event, entry)}
                        style={cooldownRatio > 0 ? ({ "--cooldown-progress": `${cooldownRatio * 360}deg` } as CSSProperties) : undefined}
                        title={tr(label)}
                      >
                        <span>{index + 1}</span>
                        {entry?.type === "attack" ? (
                          <BasicAttackArt classId={classId} className="hotbarSkillArt" />
                        ) : skill && hasSkillArt ? (
                          <SkillArt skillId={skill.id} className="hotbarSkillArt" />
                        ) : SkillIcon && visual ? (
                          <i className={`skillGlyph ${visual.className}`} aria-hidden="true">
                            <SkillIcon size={24} />
                          </i>
                        ) : (
                          <strong>{item ? "HP" : "-"}</strong>
                        )}
                        <small>{entry?.type === "attack" ? tr("basic") : entry?.type === "sprint" ? tr("run") : skill ? (locked ? `${tr("Lv.")}${skill.requiredLevel}` : `${skill.manaCost} MP`) : item ? `x${item.quantity}` : tr("empty")}</small>
                        {cooldownRatio > 0 ? <em className="cooldownTimer">{cooldownSeconds}</em> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {profileOpen ? (
              <div className="profileWindow" ref={profileWindowRef} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
                <div className="windowHeader">
                  <div>
                    <strong>{localPlayer?.name ?? playerName}</strong>
                    <span>
                      {tr(activeClassDef.label)} · {tr("Lv.")}{localPlayer?.level ?? 1}
                    </span>
                  </div>
                  <button type="button" className="iconOnly" onClick={closeProfile} aria-label={tr("Close profile")}>
                    <X size={18} />
                  </button>
                </div>

                <div className="profileTabs">
                  {visibleProfileTabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        type="button"
                        className={profileTab === tab.id ? "profileTab activeProfileTab" : "profileTab"}
                        key={tab.id}
                        onClick={() => setProfileTab(tab.id)}
                      >
                        <Icon size={17} />
                        <span>{tr(tab.label)}</span>
                      </button>
                    );
                  })}
                </div>

                {profileTab === "equipment" ? (
                  <div className="profilePane gearPane l2InventoryWindow">
                    <section className="l2PaperdollPanel">
                      <div className="l2PanelTitle">
                        <strong>{tr("Equipment")}</strong>
                        <span>{tr(activeClassDef.label)}</span>
                      </div>
                      <div className="paperdoll">
                        <div className={`paperdollCharacter class-${localPlayer?.classId ?? classId} race-${localPlayer?.race ?? race} gender-${decodeFaceVariant(localPlayer?.face ?? face).gender} hair-${decodeFaceVariant(localPlayer?.face ?? face).hair} eyes-${decodeFaceVariant(localPlayer?.face ?? face).eyes} mark-${decodeFaceVariant(localPlayer?.face ?? face).mark} ${paperdollAppearanceClasses(equipment)}`}>
                          <span className="paperdollAvatar">
                            <i className="paperAura" />
                            <i className="paperCloak" />
                            <i className="paperEar paperEarLeft" />
                            <i className="paperEar paperEarRight" />
                            <i className="paperHead" />
                            <i className="paperTusks" />
                            <i className="paperHelmet" />
                            <i className="paperTorso" />
                            <i className="paperBust" />
                            <i className="paperShoulder paperShoulderLeft" />
                            <i className="paperShoulder paperShoulderRight" />
                            <i className="paperArm paperArmLeft" />
                            <i className="paperArm paperArmRight" />
                            <i className="paperGlove paperGloveLeft" />
                            <i className="paperGlove paperGloveRight" />
                            <i className="paperLeg paperLegLeft" />
                            <i className="paperLeg paperLegRight" />
                            <i className="paperBoot paperBootLeft" />
                            <i className="paperBoot paperBootRight" />
                            <i className="paperWeaponGlow" />
                          </span>
                          <strong>{localPlayer?.name ?? playerName}</strong>
                        </div>
                        {equipmentSlots.map(({ slot, label }) => {
                          const item = equipment[slot];
                          const active = selectedEquipmentSlot === slot && !selectedBagItem;
                          return (
                            <button
                              type="button"
                              className={`${item ? "equipmentSlot filledSlot" : "equipmentSlot"} ${active ? "selectedEquipmentSlot" : ""}`}
                              key={slot}
                              onClick={() => {
                                setSelectedEquipmentSlot(slot);
                                setSelectedBagIndex(undefined);
                              }}
                              style={{ gridArea: paperdollAreas[slot] }}
                            >
                              <ItemIcon item={item} slot={slot} />
                              <span>{tr(label)}</span>
                            </button>
                          );
                        })}
                      </div>
                    </section>

                    <section className="l2BagPanel">
                      <div className="l2BagHeader">
                        <strong>{tr("Inventory")}</strong>
                        <span>{inventory.length}/250</span>
                      </div>
                      <div className="l2BagGrid">
                        {inventory.map((item, index) => (
                          <button
                            type="button"
                            className={`l2BagCell ${selectedBagIndex === index ? "selectedBagCell" : ""}`}
                            key={`${item.id}-${item.slot ?? "item"}-${index}`}
                            onClick={() => {
                              setSelectedBagIndex(index);
                              setSelectedEquipmentSlot(undefined);
                            }}
                            title={`${tr(itemDisplayName(item))} ${tr(itemStatsText(item))}`}
                          >
                            <ItemIcon item={item} />
                            {item.stackable ? <small>x{item.quantity}</small> : null}
                          </button>
                        ))}
                        {Array.from({ length: Math.max(0, 45 - inventory.length) }).map((_, index) => (
                          <span className="l2BagCell emptyBagCell" key={`empty-${index}`} />
                        ))}
                      </div>
                      <div className="l2ItemDetails">
                        <div className="selectedItemPreview">
                          <ItemIcon item={selectedGearItem} slot={selectedGearSlot} />
                          <div>
                            <strong>{tr(itemDisplayName(selectedGearItem))}</strong>
                            <span>{selectedGearItem ? [tr(itemMetaText(selectedGearItem)), tr(itemStatsText(selectedGearItem) || "No stats")].filter(Boolean).join(" · ") : tr("Select an item")}</span>
                            {selectedBagItem ? <em>{tr("Sell value:")} {itemSellTotal(selectedBagItem)} {tr("gold")}</em> : null}
                            {selectedEnchantScrollLabel ? <em>{tr(selectedEnchantScrollLabel)}: {selectedEnchantScrollCount}</em> : null}
                          </div>
                        </div>
	                        <div className="itemActions">
                          <button
                            type="button"
                            disabled={!selectedBagItem?.slot}
                            onClick={() =>
                              selectedBagItem?.slot &&
                              window.dispatchEvent(new CustomEvent("mmo:equipItem", { detail: { itemId: selectedBagItem.id, slot: selectedBagEquipSlot } }))
                            }
                          >
                            {tr("Equip")}
                          </button>
                          <button
                            type="button"
                            disabled={!selectedEquipmentItem || !selectedEquipmentSlot}
                            onClick={() =>
                              selectedEquipmentSlot && window.dispatchEvent(new CustomEvent("mmo:unequipItem", { detail: { slot: selectedEquipmentSlot } }))
                            }
                          >
                            {tr("Unequip")}
                          </button>
                          <button
                            type="button"
                            disabled={!selectedGearItem?.consumable}
                            onClick={() => selectedGearItem && window.dispatchEvent(new CustomEvent("mmo:useItem", { detail: { itemId: selectedGearItem.id } }))}
                          >
                            {tr("Use")}
                          </button>
                          <button
                            type="button"
                            disabled={!selectedBagItem || !canUseShop}
                            title={!canUseShop ? tr("Sell in a safe town") : selectedBagItem ? tr(`Sell for ${itemSellTotal(selectedBagItem)} gold`) : undefined}
                            onClick={() =>
                              selectedBagItem && window.dispatchEvent(new CustomEvent("mmo:sellItem", { detail: { itemId: selectedBagItem.id } }))
                            }
                          >
                            {tr("Sell")}
                          </button>
                          <button
                            type="button"
                            disabled={
                              !selectedGearItem ||
                              selectedEnchantCap <= 0 ||
                              selectedEnchantScrollCount <= 0 ||
                              (selectedGearItem.enchantLevel ?? 0) >= selectedEnchantCap
                            }
                            onClick={() =>
                              selectedGearItem &&
                              window.dispatchEvent(new CustomEvent("mmo:enchantItem", { detail: { itemId: selectedGearItem.id, slot: selectedEquipmentSlot } }))
                            }
                          >
                            {tr("Enchant")}
	                          </button>
	                        </div>
                        {isAtMarket ? (
                          <div className="marketListingBox">
                            <div className="marketListingHeader">
                              <strong>{tr("Market stall")}</strong>
                              <span>{tr(localMarketVendor ? `${localMarketVendor.items.length} listed` : "Sell from this town")}</span>
                            </div>
                            <div className="marketListingControls">
                              <label>
                                {tr("Qty")}
                                <input
                                  type="number"
                                  min={1}
                                  max={selectedBagItem?.stackable ? selectedBagItem.quantity : 1}
                                  value={marketQuantityDraft}
                                  disabled={!selectedBagItem || !selectedBagItem.stackable}
                                  onChange={(event) => setMarketQuantityDraft(event.target.value)}
                                />
                              </label>
                              <label>
                                {tr("Gold")}
                                <input
                                  type="number"
                                  min={1}
                                  value={marketPriceDraft}
                                  disabled={!selectedBagItem}
                                  onChange={(event) => setMarketPriceDraft(event.target.value)}
                                />
                              </label>
                              <button
                                type="button"
                                disabled={!selectedBagItem || selectedBagIndex === undefined}
                                onClick={() =>
                                  selectedBagIndex !== undefined &&
                                  window.dispatchEvent(
                                    new CustomEvent("mmo:marketListItem", {
                                      detail: { inventoryIndex: selectedBagIndex, quantity: marketListingQuantity, priceGold: marketListingPrice }
                                    })
                                  )
                                }
                              >
                                <Store size={14} />
                                {tr("List")}
                              </button>
                            </div>
                            {localMarketVendor ? (
                              <div className="marketListingList">
                                {localMarketVendor.items.map((listing) => (
                                  <button
                                    type="button"
                                    key={listing.listingId}
                                    onClick={() => window.dispatchEvent(new CustomEvent("mmo:marketCancelListing", { detail: { listingId: listing.listingId } }))}
                                  >
                                    <span>{tr(listing.item.label)}</span>
                                    <small>{listing.priceGold.toLocaleString(language === "ru" ? "ru-RU" : "en-US")} {tr("gold")}</small>
                                  </button>
                                ))}
                                <button type="button" className="marketCloseStall" onClick={() => window.dispatchEvent(new CustomEvent("mmo:marketCancelListing", { detail: {} }))}>
                                  <X size={14} />
                                  {tr("Close stall")}
                                </button>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
	                        <div className="slotPicker wideSlotPicker">
                          {hotbar.map((slotEntry, index) => (
                            <button
                              type="button"
                              className={selectedGearItem && slotEntry?.type === "item" && slotEntry.itemId === selectedGearItem.id ? "slotPick activeSlotPick" : "slotPick"}
                              disabled={!selectedGearItem?.consumable}
                              key={index}
                              onClick={() => selectedGearItem && setHotbarSlot(index, { type: "item", itemId: selectedGearItem.id })}
                            >
                              {index + 1}
                            </button>
                          ))}
                        </div>
                      </div>
                    </section>
                  </div>
                ) : null}

                {profileTab === "stats" ? (
                  <div className="profilePane statCards">
                    <div className="largeStat">
                      <span>HP</span>
                      <strong>{formatStatValue(stats.hp)}</strong>
                    </div>
                    <div className="largeStat">
                      <span>CP</span>
                      <strong>{formatStatValue(stats.cp)}</strong>
                    </div>
                    <div className="largeStat">
                      <span>MP</span>
                      <strong>{formatStatValue(stats.mp)}</strong>
                    </div>
                    <div className="largeStat">
                      <span>{tr("P.Atk")}</span>
                      <strong>{formatStatValue(stats.attack)}</strong>
                    </div>
                    <div className="largeStat">
                      <span>{tr("M.Atk")}</span>
                      <strong>{formatStatValue(stats.magic)}</strong>
                    </div>
                    <div className="largeStat">
                      <span>{tr("P.Def")}</span>
                      <strong>{formatStatValue(stats.defense)}</strong>
                    </div>
                    <div className="largeStat">
                      <span>{tr("Speed")}</span>
                      <strong>{formatStatValue(stats.speed)}</strong>
                    </div>
                    <div className="largeStat">
                      <span>{tr("STR")}</span>
                      <strong>{formatStatValue(stats.str)}</strong>
                    </div>
                    <div className="largeStat">
                      <span>{tr("DEX")}</span>
                      <strong>{formatStatValue(stats.dex)}</strong>
                    </div>
                    <div className="largeStat">
                      <span>{tr("Gold")}</span>
                      <strong>{gold || localPlayer?.gold || 0}</strong>
                    </div>
                    <div className="largeStat">
                      <span>PK</span>
                      <strong>{localPlayer?.pkCount ?? 0}</strong>
                    </div>
                    <div className="largeStat">
                      <span>PvP</span>
                      <strong>{localPlayer?.pvpCount ?? 0}</strong>
                    </div>
                    <div className="largeStat">
                      <span>{tr("Karma")}</span>
                      <strong>{localPlayer?.karma ?? 0}</strong>
                    </div>
                    <div className="largeStat">
                      <span>{tr("Zone")}</span>
                      <strong>{tr(localPlayer?.zone ?? "safe")}</strong>
                    </div>
                  </div>
                ) : null}

                {profileTab === "wallet" ? (
                  <div className="profilePane paymentPane">
                    <section className="premiumPane">
                      <section className="premiumHeroCard">
                        <div className="premiumCrown"><Crown size={34} /></div>
                        <div>
                          <span className="premiumEyebrow">DARKVELL PREMIUM</span>
                          <h2>{tr("Level up twice as fast")}</h2>
                          <p>{tr("24 hours free, then the selected plan renews automatically. Cancel anytime.")}</p>
                        </div>
                        {premiumStatus?.mode === "demo" ? <em className="premiumDemoBadge">DEMO</em> : null}
                      </section>

                      <div className="premiumBenefitGrid">
                        <article><strong>×2 XP</strong><span>{tr("Experience from monsters")}</span></article>
                        <article><strong>×2</strong><span>{tr("Adena and gold from monsters and chests")}</span></article>
                        <article><strong>+50%</strong><span>{tr("Rare monster loot chance")}</span></article>
                        <article><strong>×2</strong><span>{tr("Rest regeneration")}</span></article>
                      </div>

                      {premiumStatus?.active ? (
                        <section className="premiumActiveCard">
                          <Crown size={28} />
                          <div>
                            <strong>{premiumStatus.status === "trial" ? tr("Premium trial is active") : tr("Premium is active")}</strong>
                            <span>{tr("Active until")} {premiumStatus.premiumUntil ? new Date(premiumStatus.premiumUntil).toLocaleString(language === "ru" ? "ru-RU" : "en-US") : "—"}</span>
                          </div>
                          {!premiumStatus.cancelAtPeriodEnd ? (
                            <button type="button" disabled={premiumBusy} onClick={() => void cancelPremiumRenewal()}>{tr("Cancel renewal")}</button>
                          ) : <em>{tr("Renewal canceled")}</em>}
                        </section>
                      ) : (
                        <>
                          <div className="premiumPlans" role="radiogroup" aria-label={tr("Premium plan")}>
                            <button type="button" className={premiumPlan === "week" ? "premiumPlan selectedPremiumPlan" : "premiumPlan"} onClick={() => setPremiumPlan("week")}>
                              <span>{tr("Week")}</span><strong>150 ₽</strong><small>{tr("every 7 days")}</small>
                            </button>
                            <button type="button" className={premiumPlan === "month" ? "premiumPlan selectedPremiumPlan recommendedPremiumPlan" : "premiumPlan recommendedPremiumPlan"} onClick={() => setPremiumPlan("month")}>
                              <em>{tr("Best value")}</em><span>{tr("Month")}</span><strong>404 ₽</strong><small>{tr("every 30 days")}</small>
                            </button>
                          </div>
                          <button
                            type="button"
                            className="premiumActivateButton"
                            disabled={premiumBusy || premiumStatus?.enabled === false || premiumStatus?.canStartTrial === false}
                            onClick={() => void startPremiumTrial()}
                          >
                            <Crown size={19} />
                            {premiumStatus?.status === "pending" ? tr("Continue card linking") : tr("Activate 24 hours free")}
                          </button>
                          <p className="premiumConsent">
                            {tr(`By activating, you link your card through T-Bank and agree that ${premiumPlan === "week" ? "150 ₽ every 7 days" : "404 ₽ every 30 days"} will be charged automatically after the free 24 hours until canceled.`)}
                          </p>
                        </>
                      )}
                      {premiumMessage || premiumStatus?.lastError ? <div className="premiumMessage">{tr(premiumMessage || premiumStatus?.lastError || "")}</div> : null}
                      <small className="premiumSecureNote">{tr("T-Bank may temporarily charge 1 ₽ to verify and save the card; DarkVell refunds it immediately.")}</small>
                      <small className="premiumSecureNote">{tr("Card number and CVC are entered only on the secure T-Bank page and are never stored by DarkVell.")}</small>
                    </section>

                    <section className="coinShopCard">
                      <div className="coinShopArt"><Coins size={32} /></div>
                      <div className="coinShopCopy">
                        <span className="premiumEyebrow">DARKVELL COIN</span>
                        <strong>{tr("1 Coin for 1 ₽")}</strong>
                        <small>{tr("One-time payment. No subscription and no automatic renewal.")}</small>
                        <em>{tr("In inventory now")}: {coinCount.toLocaleString(language === "ru" ? "ru-RU" : "en-US")} Coin</em>
                      </div>
                      {coinPaymentStatus?.mode === "demo" ? <b className="premiumDemoBadge">DEMO</b> : null}
                      <button
                        type="button"
                        className="coinBuyButton"
                        disabled={coinPaymentBusy || coinPaymentStatus?.enabled === false}
                        onClick={() => void buyOneCoin()}
                      >
                        <Coins size={18} />
                        {coinPaymentStatus?.status === "pending" ? tr("Continue payment") : tr("Buy 1 Coin for 1 ₽")}
                      </button>
                      {coinPaymentMessage ? <p className="coinPaymentMessage">{tr(coinPaymentMessage)}</p> : null}
                      <small className="coinShopSecure">{tr("Payment details are entered only on the secure T-Bank page.")}</small>
                    </section>
                  </div>
                ) : null}

                {profileTab === "skills" ? (
                  <div className="profilePane skillTree">
                    <div className="skillPointPanel">
                      <strong>{skillPoints} {tr("skill points")}</strong>
                      <span>{tr("Basic attack can sit on any slot. Active skills now unlock at Lv.5, Lv.10, Lv.15 and Lv.25.")}</span>
                      <div className="slotPicker wideSlotPicker">
                        {hotbar.map((_, index) => (
                          <button type="button" className={assignSlot === index ? "slotPick activeSlotPick" : "slotPick"} key={index} onClick={() => setAssignSlot(index)}>
                            {index + 1}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className={`skillNode ${basicAttackVisual.className}`}>
                      <BasicAttackArt classId={classId} className={`skillIcon ${basicAttackVisual.className} profileSkillArt`} />
                      <div>
                        <strong>{tr("Basic attack")}</strong>
                        <span>
                          {activeClassDef.attackDamage} {tr("damage")}, {activeClassDef.attackRange}px, {activeClassDef.attackCooldownMs}ms
                        </span>
                        <span>{tr("Regular weapon hit. Works from the hotbar and on mobile buttons.")}</span>
                      </div>
                      <div className="slotPicker">
                        {hotbar.map((slotEntry, index) => (
                          <button
                            type="button"
                            className={slotEntry?.type === "attack" ? "slotPick activeSlotPick" : "slotPick"}
                            key={index}
                            onClick={() => setHotbarSlot(index, { type: "attack" })}
                          >
                            {index + 1}
                          </button>
                        ))}
                      </div>
                    </div>
                    {activeClassDef.skills.map((skill) => {
                      const visual = skillVisual(skill.id);
                      return (
                        <div className={currentLevel < (skill.requiredLevel ?? 1) ? `skillNode ${visual.className} lockedSkillNode` : `skillNode ${visual.className}`} key={skill.id}>
                          <SkillArt skillId={skill.id} className={`skillIcon ${visual.className} profileSkillArt`} />
                          <div>
                            <strong>
                              {skill.key} - {tr(skill.label)}
                            </strong>
                            <span>
                              {tr("Lv.")}{skill.requiredLevel ?? 1},{" "}
                              {skill.heal ? `${skill.heal} ${tr("healing")}` : `${skill.damage} ${tr("damage")}`}, {skill.areaRadius ? `${skill.areaRadius}px AoE, ` : ""}
                              {skill.range}px, {skill.manaCost} MP
                            </span>
                            <span>{tr(skillDescription(skill.id))}</span>
                          </div>
                          <div className="slotPicker">
                            {hotbar.map((slotEntry, index) => (
                              <button
                                type="button"
                                className={slotEntry?.type === "skill" && slotEntry.skillId === skill.id ? "slotPick activeSlotPick" : "slotPick"}
                                key={index}
                                onClick={() => setHotbarSlot(index, { type: "skill", skillId: skill.id })}
                              >
                                {index + 1}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    {activeClassDef.passives.map((passive) => (
                      <div className="skillNode passiveNode" key={passive}>
                        <span className="skillIcon">
                          <BookOpen size={20} />
                        </span>
                        <div>
                          <strong>{tr("Passive")}</strong>
                          <span>{tr(passive)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                {profileTab === "quests" ? (
                  <div className="profilePane questsPane">
                    {visibleStoryQuest ? (
                      <section className={activeStoryQuest ? "questFocusCard activeQuestFocus" : "questFocusCard"}>
                        <div className="questFocusHeader">
                          <span>{tr(visibleStoryQuest.chapter)}</span>
                          <strong>{tr(visibleStoryQuest.title)}</strong>
                          <p>{tr(visibleStoryQuest.summary)}</p>
                        </div>
                        <div className="questObjectiveBox">
                          <Target size={22} />
                          <div>
                            <strong>{tr(visibleStoryQuest.objective.label)}</strong>
                            <span>{tr(visibleStoryQuest.target?.hint ?? "Complete the active objective to move the chain forward.")}</span>
                          </div>
                          <em>{activeStoryQuest && activeStoryProgress ? tr(activeStoryProgress.valueText) : tr("Ready")}</em>
                        </div>
                        {activeStoryQuest && activeStoryProgress ? (
                          <div className="questProgressBar" aria-label={tr("Quest progress")}>
                            <span style={{ width: `${Math.min(100, Math.max(0, (activeStoryProgress.progress / Math.max(1, activeStoryProgress.goal)) * 100))}%` }} />
                          </div>
                        ) : null}
                        <div className="questActionRow">
                          {activeStoryQuest ? (
                            <button type="button" disabled={!activeStoryProgress?.done} onClick={completeStoryQuest}>
                              {tr(activeStoryProgress?.done ? "Complete quest" : "In progress")}
                            </button>
                          ) : (
                            <button type="button" onClick={() => acceptStoryQuest(visibleStoryQuest.id)}>
                              {tr("Take quest")}
                            </button>
                          )}
                          <button type="button" disabled={!visibleStoryQuest.target} onClick={() => openStoryQuestMap(visibleStoryQuest.target)}>
                            <MapIcon size={16} />
                            {tr("Show target")}
                          </button>
                        </div>
                        <span className="questRewardHint">{tr(visibleStoryQuest.rewardHint)}</span>
                      </section>
                    ) : (
                      <section className="questFocusCard">
                        <div className="questFocusHeader">
                          <span>{tr("Story")}</span>
                          <strong>{tr("Starter chain complete")}</strong>
                          <p>{tr("All current story quests are done. The next chapters can be added on top of this chain.")}</p>
                        </div>
                      </section>
                    )}
                    <section className="questChainList">
                      <div className="questChainHeader">
                        <strong>{tr("Story chain")}</strong>
                        <span>{tr("Only one active quest can be taken at a time.")}</span>
                      </div>
                      {storyQuestChain.map((quest, index) => {
                        const completed = completedStoryQuestIds.has(quest.id);
                        const active = activeStoryQuest?.id === quest.id;
                        const available = !activeStoryQuest && nextStoryQuest?.id === quest.id;
                        const locked = !completed && !active && !available;
                        return (
                          <button
                            type="button"
                            className={`questChainStep ${completed ? "completedQuestStep" : ""} ${active ? "activeQuestStep" : ""} ${locked ? "lockedQuestStep" : ""}`}
                            disabled={locked || completed || activeStoryQuest?.id === quest.id}
                            key={quest.id}
                            onClick={() => available && acceptStoryQuest(quest.id)}
                          >
                            <em>{index + 1}</em>
                            <div>
                              <strong>{tr(quest.title)}</strong>
                              <span>{tr(quest.objective.label)}</span>
                            </div>
                            <small>{tr(completed ? "Done" : active ? "Active" : available ? "Take" : "Locked")}</small>
                          </button>
                        );
                      })}
                    </section>
                  </div>
                ) : null}

                {profileTab === "clan" ? (
                  <div className="profilePane clanPane">
                    {localClan ? (
                      <>
                        <div className="clanSummary">
                          <span className={`clanBadge largeClanBadge clan-${localClan.emblem}`}>{clanEmblemMark(localClan.emblem)}</span>
                          <div>
                            <strong>{localClan.name}</strong>
                            <span>
                              {localClan.tag} · {localClan.onlineCount}/{localClan.memberCount} {tr("online")}
                            </span>
                          </div>
                          <button type="button" onClick={setClanChatChannel}>
                            <MessageSquare size={16} />
                            {tr("Clan Chat")}
                          </button>
                          <button type="button" className="dangerClanButton" onClick={() => window.dispatchEvent(new CustomEvent("mmo:clanLeave"))}>
                            {tr("Leave")}
                          </button>
                        </div>
                        <div className="clanRosterHeader">
                          <strong>{tr("Members")}</strong>
                          <span>{tr(localClanIsLeader ? "Leader controls active" : localClanMember?.role ?? "member")}</span>
                        </div>
                        <div className="clanRoster">
                          {localClan.members.map((member) => {
                            const isSelf = member.characterId === characterId || member.playerId === localPlayer?.id;
                            const classLabel = member.classId ? tr(CLASS_DEFINITIONS[member.classId].label) : tr("Member");
                            return (
                              <div className={member.online ? "clanMemberRow onlineClanMember" : "clanMemberRow"} key={member.characterId}>
                                <span className="clanMemberStatus" />
                                <div>
                                  <strong>
                                    {member.name}
                                    {isSelf ? ` (${tr("you")})` : ""}
                                  </strong>
                                  <span>
                                    {classLabel} · {tr("Lv.")}{member.level} · {tr(member.role)}
                                  </span>
                                </div>
                                <em>{tr(member.online ? "online" : "offline")}</em>
                                {localClanIsLeader && !isSelf && member.role !== "leader" ? (
                                  <button type="button" className="dangerClanButton" onClick={() => window.dispatchEvent(new CustomEvent("mmo:clanKick", { detail: { characterId: member.characterId } }))}>
                                    {tr("Kick")}
                                  </button>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="clanCreateBox">
                          <label>
                            {tr("Clan name")}
                            <input value={clanNameDraft} maxLength={24} onChange={(event) => setClanNameDraft(event.target.value)} onKeyDown={(event) => event.stopPropagation()} />
                          </label>
                          <div className="clanEmblemPicker">
                            {clanEmblems.map((emblem) => (
                              <button
                                type="button"
                                className={clanEmblem === emblem.id ? `clanEmblemOption activeClanEmblem clan-${emblem.id}` : `clanEmblemOption clan-${emblem.id}`}
                                key={emblem.id}
                                onClick={() => setClanEmblem(emblem.id)}
                              >
                                <span className={`clanBadge clan-${emblem.id}`}>{emblem.mark}</span>
                                <strong>{tr(emblem.label)}</strong>
                              </button>
                            ))}
                          </div>
                          <button type="button" onClick={createClan}>
                            <Shield size={16} />
                            {tr("Create clan")}
                          </button>
                        </div>
                        {incomingClanInvites.length > 0 ? (
                          <div className="clanInviteList">
                            <strong>{tr("Invites")}</strong>
                            {incomingClanInvites.map((invite) => (
                              <div className="clanInviteRow" key={`${invite.clanId}-${invite.fromId}`}>
                                <span className={`clanBadge clan-${invite.clanEmblem}`}>{clanEmblemMark(invite.clanEmblem)}</span>
                                <div>
                                  <strong>{invite.clanName}</strong>
                                  <span>
                                    {invite.clanTag} · {invite.fromName}
                                  </span>
                                </div>
                                <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("mmo:clanAccept", { detail: { fromId: invite.fromId, clanId: invite.clanId } }))}>
                                  {tr("Accept")}
                                </button>
                                <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("mmo:clanDecline", { detail: { fromId: invite.fromId, clanId: invite.clanId } }))}>
                                  {tr("Decline")}
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </>
                    )}
                    {clanStatus ? <span className="clanStatus">{tr(clanStatus)}</span> : null}
                  </div>
                ) : null}

                {profileTab === "map" ? (
                  <div className="profilePane mapPane">
                    <div className="worldMapShell">
                      <div
                        className="worldMap"
                        ref={worldMapRef}
                        onClickCapture={handleWorldMapClickCapture}
                        onPointerCancel={finishWorldMapDrag}
                        onPointerDown={handleWorldMapPointerDown}
                        onPointerLeave={finishWorldMapDrag}
                        onPointerMove={handleWorldMapPointerMove}
                        onPointerUp={finishWorldMapDrag}
                        onWheel={handleWorldMapWheel}
                      >
                        <div
                          className="worldMapSurface"
                          style={{
                            width: `${mapZoom * 100}%`,
                            height: `${mapZoom * 100}%`
                          }}
                        >
                          <svg className="worldMapSvg pixelWorldMap" viewBox={`0 0 ${WORLD_BOUNDS.width} ${WORLD_BOUNDS.height}`} preserveAspectRatio="xMidYMid meet">
                          <defs>
                            <radialGradient id="mapLandGradient" cx="42%" cy="38%" r="74%">
                              <stop offset="0%" stopColor="#315f37" />
                              <stop offset="52%" stopColor="#193b28" />
                              <stop offset="100%" stopColor="#0b1c16" />
                            </radialGradient>
                            <linearGradient id="mapSeaGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                              <stop offset="0%" stopColor="#075267" />
                              <stop offset="56%" stopColor="#0b7188" />
                              <stop offset="100%" stopColor="#159ca4" />
                            </linearGradient>
                            <linearGradient id="mapShallowSeaGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                              <stop offset="0%" stopColor="#12829a" />
                              <stop offset="55%" stopColor="#29b6ad" />
                              <stop offset="100%" stopColor="#9bd8bd" />
                            </linearGradient>
                            <linearGradient id="mapBeachGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                              <stop offset="0%" stopColor="#c9a55a" />
                              <stop offset="58%" stopColor="#e2c878" />
                              <stop offset="100%" stopColor="#6aa56d" />
                            </linearGradient>
                            <radialGradient id="mapBiome-grass" cx="42%" cy="34%" r="68%">
                              <stop offset="0%" stopColor="#55b95c" />
                              <stop offset="100%" stopColor="#1f6b35" />
                            </radialGradient>
                            <radialGradient id="mapBiome-desert" cx="44%" cy="42%" r="70%">
                              <stop offset="0%" stopColor="#c89645" />
                              <stop offset="100%" stopColor="#7d5424" />
                            </radialGradient>
                            <radialGradient id="mapBiome-snow" cx="44%" cy="38%" r="72%">
                              <stop offset="0%" stopColor="#d8e6ec" />
                              <stop offset="100%" stopColor="#879ca8" />
                            </radialGradient>
                            <radialGradient id="mapBiome-swamp" cx="48%" cy="54%" r="70%">
                              <stop offset="0%" stopColor="#15857d" />
                              <stop offset="100%" stopColor="#0b4745" />
                            </radialGradient>
                            <radialGradient id="mapBiome-coast" cx="48%" cy="45%" r="70%">
                              <stop offset="0%" stopColor="#d8bc72" />
                              <stop offset="58%" stopColor="#64b8b5" />
                              <stop offset="100%" stopColor="#0b6c82" />
                            </radialGradient>
                            <radialGradient id="mapBiome-forest" cx="45%" cy="42%" r="70%">
                              <stop offset="0%" stopColor="#208b3a" />
                              <stop offset="100%" stopColor="#0f3d25" />
                            </radialGradient>
                            <radialGradient id="mapBiome-darkForest" cx="45%" cy="42%" r="70%">
                              <stop offset="0%" stopColor="#29443d" />
                              <stop offset="100%" stopColor="#101827" />
                            </radialGradient>
                            <radialGradient id="mapBiome-fire" cx="50%" cy="46%" r="70%">
                              <stop offset="0%" stopColor="#a9482a" />
                              <stop offset="100%" stopColor="#4b1716" />
                            </radialGradient>
                            <radialGradient id="mapBiome-void" cx="50%" cy="48%" r="72%">
                              <stop offset="0%" stopColor="#6441a5" />
                              <stop offset="100%" stopColor="#231238" />
                            </radialGradient>
                            <radialGradient id="mapBiome-mountain" cx="46%" cy="38%" r="72%">
                              <stop offset="0%" stopColor="#9ca3af" />
                              <stop offset="100%" stopColor="#334155" />
                            </radialGradient>
                            <filter id="softMapBiome" x="-18%" y="-18%" width="136%" height="136%">
                              <feGaussianBlur stdDeviation="46" />
                            </filter>
                            <filter id="softMapCoast" x="-4%" y="-4%" width="108%" height="108%">
                              <feGaussianBlur stdDeviation="18" />
                            </filter>
                          </defs>
                            <rect className="mapBaseLand" x={0} y={0} width={WORLD_BOUNDS.width} height={WORLD_BOUNDS.height} />
                          <path className="mapSea" d={westMapSeaPath} />
                          <path className="mapSea" d={southMapSeaPath} />
                          <path className="mapShallowSea" d={westMapShallowSeaPath} />
                          <path className="mapShallowSea" d={southMapShallowSeaPath} />
                          <path className="mapBeach" d={westMapBeachPath} />
                          <path className="mapBeach" d={southMapBeachPath} />
                          <path className="mapCoastline" d={westMapCoastPath} />
                          <path className="mapCoastline" d={southMapCoastPath} />
                          {mapBiomes.map((biome, index) => (
                            <path
                              className="mapSvgBiome"
                              key={biome.id}
                              d={biome.path}
                              fill={`url(#mapBiome-${biome.kind})`}
                            />
                          ))}
                          <g className="mapHuntingGroundLayer">
                            {mapHuntingGrounds.map((ground) => (
                              <g className={`mapHuntingGroundMark mapHuntingGround-${ground.tier}`} key={ground.id}>
                                <path
                                  className="mapHuntingGround"
                                  d={ground.path}
                                />
                                <g transform={`translate(${ground.x} ${ground.y}) scale(${mapHuntingLabelScale})`} style={{ opacity: mapHuntingLabelOpacity }}>
                                  <text className="mapHuntingGroundLevel" x={0} y={-88}>
                                    {tr("Lv.")}{ground.level}
                                  </text>
                                  <text className="mapHuntingGroundLabel" x={0} y={84}>
                                    {tr(ground.label)}
                                  </text>
                                </g>
                              </g>
                            ))}
                          </g>
                          <g className="mapPixelWorldLayer">
                            {mapScenicPixels.map((pixel) => (
                              <ellipse
                                className={`mapPixelDetail mapPixelDetail-${pixel.kind}`}
                                key={pixel.id}
                                cx={pixel.x + pixel.size / 2}
                                cy={pixel.y + pixel.size / 2}
                                rx={pixel.size * 0.5}
                                ry={Math.max(40, pixel.size * 0.28)}
                                transform={`rotate(${(pixel.x + pixel.y) % 28 - 14} ${pixel.x + pixel.size / 2} ${pixel.y + pixel.size / 2})`}
                              />
                            ))}
                            {mapRiverTiles.map((tile) => (
                              <ellipse className="pixelRiverTile" key={tile.id} cx={tile.x} cy={tile.y} rx={tile.size * 0.38} ry={tile.size * 0.2} />
                            ))}
                            {mapRoadTiles.map((tile) => (
                              <ellipse className="pixelRoadTile" key={tile.id} cx={tile.x} cy={tile.y} rx={tile.size * 0.36} ry={tile.size * 0.18} />
                            ))}
                          </g>
                          {mapRivers.map((river, index) => {
                            const riverWidth = `${Math.max(7, Math.round(river.width / 10))}px`;
                            return (
                              <g className={`mapSvgRiver mapRiverRoute${index % 3}`} key={river.id} style={{ "--map-river-width": riverWidth } as CSSProperties}>
                                <path className="mapRiverShadow" d={river.path} />
                                <path className="mapRiverBank" d={river.path} />
                                <path className="mapRiverCore" d={river.path} />
                              </g>
                            );
                          })}
                          {mapLakes.map((lake) => (
                            <path className="mapSvgLake" key={lake.id} d={lake.path} />
                          ))}
                          {mapWaterfalls.map((fall) => (
                            <g className="mapSvgWaterfall" key={fall.id} transform={`translate(${fall.x} ${fall.y}) rotate(${(fall.rotation * 180) / Math.PI})`}>
                              <ellipse className="mapWaterfallMist" cx={fall.height * 0.38} cy={0} rx={fall.width * 0.48} ry={fall.width * 0.18} />
                              <path className="mapWaterfallStream" d={`M ${-fall.height * 0.28} 0 C ${-fall.height * 0.08} ${-fall.width * 0.08} ${fall.height * 0.12} ${fall.width * 0.1} ${fall.height * 0.36} ${fall.width * 0.18}`} />
                            </g>
                          ))}
                          <g className="mapWaterLifeLayer">
                            {mapWaterMarks.map((mark) => (
                              <g className="mapWaterFish" key={mark.id} transform={`translate(${mark.x} ${mark.y}) rotate(${(mark.rotation * 180) / Math.PI}) scale(${mark.size / 260})`}>
                                <path className="mapWaterFishBody" d="M -90 0 C -54 -46 28 -48 72 0 C 28 48 -54 46 -90 0 Z" />
                                <path className="mapWaterFishTail" d="M 68 0 L 112 -38 L 112 38 Z" />
                                <circle className="mapWaterFishEye" cx={-52} cy={-10} r={7} />
                              </g>
                            ))}
                          </g>
                          <g className="mapSvgObstacleLayer">
                            {mapObstacles.map((obstacle) => (
                              <ellipse
                                className={`mapSvgObstacle mapObstacle-${obstacle.kind}`}
                                key={obstacle.id}
                                cx={obstacle.x}
                                cy={obstacle.y}
                                rx={obstacle.radiusX}
                                ry={obstacle.radiusY}
                                transform={`rotate(${(obstacle.rotation * 180) / Math.PI} ${obstacle.x} ${obstacle.y})`}
                              />
                            ))}
                            {mapHazards.map((hazard) => (
                              <rect
                                className={`mapSvgHazard mapHazard-${hazard.kind}`}
                                key={hazard.id}
                                x={hazard.x - hazard.width / 2}
                                y={hazard.y - hazard.height / 2}
                                width={hazard.width}
                                height={hazard.height}
                                rx={hazard.height * 0.45}
                                transform={`rotate(${(hazard.rotation * 180) / Math.PI} ${hazard.x} ${hazard.y})`}
                              />
                            ))}
                          </g>
                          {mapRoads.map((road, index) => {
                            return (
                              <g className={`mapSvgRoad mapRoadRoute${index % 5}`} key={road.id}>
                                <path className="mapRoadShadow" d={road.path} />
                                <path className="mapRoadBank" d={road.path} />
                                <path className="mapRoadCore" d={road.path} />
                                <path className="mapRoadTrack" d={road.path} />
                                <path className="mapRoadHighlight" d={road.path} />
                              </g>
                            );
                          })}
                          <g
                            className="mapSvgArena"
                            style={
                              {
                                "--map-arena-detail-opacity": mapArenaDetailOpacity,
                                "--map-arena-gate-label-opacity": mapArenaGateLabelOpacity
                              } as CSSProperties
                            }
                            transform={`translate(${starterArena.x} ${starterArena.y})`}
                          >
                            <circle className="mapSvgArenaOuter" r={starterArena.radius} />
                            <circle className="mapSvgArenaInner" r={starterArena.radius * 0.66} />
                            <circle className="mapSvgArenaCenter" r={starterArena.radius * 0.18} />
                            {mapArenaSectors.map((sector) => (
                              <path className="mapSvgArenaSpoke" key={sector.id} d={`M ${sector.innerX} ${sector.innerY} L ${sector.outerX} ${sector.outerY}`} />
                            ))}
                            {mapArenaGates.map((gate) => {
                              const relativeX = gate.x - starterArena.x;
                              const relativeY = gate.y - starterArena.y;
                              const sideX = Math.cos(gate.angle + Math.PI / 2) * 190;
                              const sideY = Math.sin(gate.angle + Math.PI / 2) * 190;
                              const roadX = Math.cos(gate.angle) * 280;
                              const roadY = Math.sin(gate.angle) * 280;
                              return (
                                <g className="mapSvgArenaGate" key={gate.id} transform={`translate(${relativeX} ${relativeY})`}>
                                  <path className="mapSvgArenaGateRoad" d={`M ${-roadX} ${-roadY} L ${roadX} ${roadY}`} />
                                  <path className="mapSvgArenaGateBar" d={`M ${-sideX} ${-sideY} L ${sideX} ${sideY}`} />
                                  <g transform={`translate(${Math.cos(gate.angle) * 330} ${Math.sin(gate.angle) * 330}) scale(${mapMarkerScale})`}>
                                    <text className="mapSvgArenaGateLabel" x={0} y={0}>
                                      {tr(gate.label)}
                                    </text>
                                  </g>
                                </g>
                              );
                            })}
                            <g transform={`translate(0 ${-starterArena.radius - 150}) scale(${mapMarkerScale})`}>
                              <text className="mapSvgArenaRingLabel" x={0} y={0}>
                                {tr("PvP zone")}
                              </text>
                            </g>
                            <g transform={`translate(0 ${-starterArena.radius * 0.66 - 70}) scale(${mapMarkerScale})`}>
                              <text className="mapSvgArenaCoreLabel" x={0} y={0}>
                                {tr("inner fight ring")}
                              </text>
                            </g>
                            <g transform={`translate(0 ${starterArena.radius + 330}) scale(${mapMarkerScale})`}>
                              <text className="mapSvgArenaLabel" x={0} y={0}>
                                {tr(starterArena.label)}
                              </text>
                            </g>
                          </g>
                          {mapMountains.map((mountain) => {
                            const size = mountain.size * 42;
                            return (
                              <g className="mapSvgMountain" key={mountain.id} transform={`translate(${mountain.x} ${mountain.y})`}>
                                <path className="mapSvgMountainShadow" d={`M ${-size * 0.78} ${size * 0.3} C ${-size * 0.52} ${size * 0.05} ${-size * 0.38} ${-size * 0.24} ${-size * 0.16} ${-size * 0.06} C ${size * 0.02} ${size * 0.08} ${size * 0.16} ${-size * 0.46} ${size * 0.38} ${-size * 0.22} C ${size * 0.54} ${-size * 0.04} ${size * 0.64} ${size * 0.14} ${size * 0.8} ${size * 0.22}`} />
                                <path className="mapSvgMountainRidge" d={`M ${-size * 0.72} ${size * 0.24} C ${-size * 0.5} ${-size * 0.02} ${-size * 0.35} ${-size * 0.3} ${-size * 0.12} ${-size * 0.1} C ${size * 0.08} ${size * 0.06} ${size * 0.18} ${-size * 0.5} ${size * 0.42} ${-size * 0.18} C ${size * 0.56} ${0} ${size * 0.66} ${size * 0.12} ${size * 0.76} ${size * 0.18}`} />
                                <path className="mapSvgMountainSnow" d={`M ${-size * 0.22} ${-size * 0.12} C ${-size * 0.06} ${-size * 0.23} ${size * 0.06} ${-size * 0.24} ${size * 0.19} ${-size * 0.16}`} />
                              </g>
                            );
                          })}
                          {mapRegionLabels.map((region) => (
                            <g key={region.id} transform={`translate(${region.x} ${region.y}) scale(${mapRegionScale})`} style={{ opacity: mapRegionLabelOpacity }}>
                              <text className="mapSvgRegionLabel" x={0} y={0}>
                                {tr(region.label)}
                              </text>
                            </g>
                          ))}
                          {WORLD_LANDMARKS.filter((landmark) => landmark.id !== "blood-ring").map((landmark) => (
                            <g className={`mapSvgLandmark mapLandmark-${landmark.kind}`} key={landmark.id} transform={`translate(${landmark.position.x} ${landmark.position.y}) scale(${mapMarkerScale})`}>
                              {landmark.kind === "boss" ? <circle className="mapSvgLandmarkRange" r={landmark.radius} /> : null}
                              <path className="mapSvgLandmarkPin" d="M 0 -220 C 130 -220 220 -126 220 0 C 220 150 0 315 0 315 C 0 315 -220 150 -220 0 C -220 -126 -130 -220 0 -220 Z" />
                              <circle className="mapSvgLandmarkCore" r={92} />
                              <text className="mapSvgLandmarkIcon" x={0} y={34}>
                                {mapLandmarkShort(landmark.kind)}
                              </text>
                              <text className="mapSvgLandmarkLabel" x={0} y={520}>
                                {tr(landmark.label)}
                              </text>
                            </g>
                          ))}
                          {CITY_DEFINITIONS.map((city) => {
                            const visual = mapCityVisual(city);
                            const isActive = city.id === selectedCity.id;
                            return (
                              <g
                                className={`mapSvgCity ${mapCityClass(city)} ${isActive ? "activeMapSvgCity" : ""}`}
                                key={city.id}
                                onClick={() => setSelectedMapCity(city.id)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    setSelectedMapCity(city.id);
                                  }
                                }}
                                role="button"
                                tabIndex={0}
                                transform={`translate(${city.position.x} ${city.position.y}) scale(${mapMarkerScale})`}
                              >
                                <ellipse className="mapSvgCityZone" cx={0} cy={visual.zone * 0.08} rx={visual.zone * 0.56} ry={visual.zone * 0.34} />
                                <circle className="mapSvgCityCore" cx={0} cy={-visual.zone * 0.03} r={visual.keep * 0.28} />
                                <circle className="mapSvgCityInner" cx={0} cy={-visual.zone * 0.03} r={visual.keep * 0.12} />
                                <text className="mapSvgCityLabel" x={0} y={visual.zone * 0.62}>
                                  {tr(city.label)}
                                </text>
                                <text className="mapSvgCityLevel" x={0} y={visual.zone * 0.82}>
                                  {tr("Lv.")}{city.recommendedLevel}+
                                </text>
                              </g>
                            );
                          })}
                          {activeQuestTarget ? (
                            <>
                              <circle
                                className="mapSvgQuestArea"
                                cx={activeQuestTarget.position.x}
                                cy={activeQuestTarget.position.y}
                                r={activeQuestTarget.radius}
                              />
                              <g className="mapSvgQuestTarget" transform={`translate(${activeQuestTarget.position.x} ${activeQuestTarget.position.y}) scale(${mapMarkerScale})`}>
                                <circle className="mapSvgQuestPulse" r={360} />
                                <path className="mapSvgQuestPin" d="M 0 -270 C 160 -270 270 -154 270 0 C 270 184 0 390 0 390 C 0 390 -270 184 -270 0 C -270 -154 -160 -270 0 -270 Z" />
                                <circle className="mapSvgQuestCore" r={118} />
                                <text className="mapSvgQuestIcon" x={0} y={43}>
                                  Q
                                </text>
                                <text className="mapSvgQuestLabel" x={0} y={610}>
                                  {tr(activeQuestTarget.label)}
                                </text>
                              </g>
                            </>
                          ) : null}
                          {localPlayer ? (
                            <g className="mapSvgPlayer" transform={`translate(${localPlayer.position.x} ${localPlayer.position.y}) scale(${mapPlayerScale})`}>
                              <circle className="mapSvgPlayerOuter" r={520} />
                              <circle className="mapSvgPlayerPulse" r={330} />
                              <circle className="mapSvgPlayerDot" r={160} />
                              <path className="mapSvgPlayerArrow" d="M 0 -520 L 185 125 L 0 52 L -185 125 Z" transform={`rotate(${localFacingDegrees})`} />
                              <text className="mapSvgPlayerLabel" x={0} y={720}>
                                {tr("YOU")}
                              </text>
                            </g>
                          ) : null}
                          </svg>
                        </div>
                      </div>
                      <div className="mapZoomControls">
                        <button type="button" className="mapZoomButton" onClick={() => updateMapZoom(zoomMapOut(mapZoom))} aria-label={tr("Zoom out")}>
                          <ZoomOut size={16} />
                        </button>
                        <span>{formatMapZoom(mapZoom)}</span>
                        <button type="button" className="mapZoomButton" onClick={() => updateMapZoom(zoomMapIn(mapZoom))} aria-label={tr("Zoom in")}>
                          <ZoomIn size={16} />
                        </button>
                        <button type="button" className="mapZoomButton mapCenterButton" onClick={() => centerWorldMapOnPlayer()} disabled={!localPlayer} aria-label={tr("Center on player")} title={tr("Center on player")}>
                          <Crosshair size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="mapInfo">
                      <strong>
                        {tr(selectedCity.label)} {tr("Lv.")}{selectedCity.recommendedLevel}+
                      </strong>
                      <span>
                        {localPlayer ? `${tr("You")} x ${Math.round(localPlayer.position.x)}, y ${Math.round(localPlayer.position.y)} · ` : ""}
                        {tr("City")} x {selectedCity.position.x}, y {selectedCity.position.y}
                        <br />
                        {tr("Red ring = PvP zone · Gold ring = inner fight ring")}
                      </span>
                    </div>
                  </div>
                ) : null}

                {profileTab === "arena" ? (
                  <div className="profilePane arenaPane">
                    <div className="arenaSummary">
                      <div>
                        <strong>{tr(arenaSeason?.label ?? "Arena Season")}</strong>
                        <span>
                          {tr("Rating")} {localArenaRating} · {tr("Wins")} {localPlayer?.arenaWins ?? 0} / {tr("Losses")} {localPlayer?.arenaLosses ?? 0} · {tr("Streak")} {localPlayer?.arenaStreak ?? 0}
                        </span>
                      </div>
                      <div>
                        <strong>{coinCount.toLocaleString(language === "ru" ? "ru-RU" : "en-US")} {tr("Coin")}</strong>
                        <span>{tr("Earned from arena PvP, bosses and rare mob drops.")}</span>
                      </div>
                    </div>
                    <div className="arenaBoard">
                      {(arenaSeason?.top ?? []).length > 0 ? (
                        (arenaSeason?.top ?? []).map((standing, index) => (
                          <div className={standing.playerId === playerId ? "arenaBoardRow activeArenaBoardRow" : "arenaBoardRow"} key={`${standing.playerId}-${index}`}>
                            <strong>{index + 1}. {standing.playerName}</strong>
                            <span>R {standing.rating} · {standing.wins}-{standing.losses} · {standing.seasonPoints} {tr("pts")}</span>
                          </div>
                        ))
                      ) : (
                        <div className="arenaBoardEmpty">
                          <strong>{tr("No arena wins yet")}</strong>
                          <span>{tr("First kills in Blood Ring Arena will start the leaderboard.")}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}

                {profileTab === "admin" && isAdmin ? (
                  <div className="profilePane adminProfilePane">
                    <div className="adminPanelHeader">
                      <div>
                        <strong>{tr("Admin")}</strong>
                        <span>
                          {tr("real")} {adminState?.realOnline ?? 0} · {tr("bots")} {adminState?.botOnline ?? 0} · {tr("total")} {adminState?.totalOnline ?? snapshot?.onlineCount ?? 0}
                        </span>
                      </div>
                      <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("mmo:adminRequest"))}>{tr("Refresh")}</button>
                    </div>
                    {adminState?.message ? <div className="adminNotice">{tr(adminState.message)}</div> : null}
                    <div className="adminGlobalActions">
                      <span>{tr(adminState?.singersHidden ? "Musicians hidden" : `${adminState?.singerOnline ?? 0} musicians live`)}</span>
                      <button type="button" onClick={() => sendAdminAction("summonSingers", localPlayer?.id)} disabled={!localPlayer}>
                        <Mic2 size={13} />
                        {tr("Return musicians")}
                      </button>
                      <button type="button" onClick={() => sendAdminAction("hideSingers", localPlayer?.id)} disabled={!localPlayer}>
                        <X size={13} />
                        {tr("Hide musicians")}
                      </button>
                    </div>
                    <div className="adminFeedbackList">
                      <strong>{tr("Beta reports")}</strong>
                      {(adminState?.feedbackReports ?? []).slice(0, 5).map((report) => (
                        <div className="adminFeedbackItem" key={report.id}>
                          <span>
                            {report.playerName} · {tr("Lv.")}{report.level} ·{" "}
                            {new Date(report.createdAt).toLocaleTimeString(language === "ru" ? "ru-RU" : "en-US", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          <p>{report.text}</p>
                          <em>
                            {tr(report.zone)} · x {Math.round(report.position.x)} y {Math.round(report.position.y)}
                            {report.context ? ` · ${report.context}` : ""}
                          </em>
                        </div>
                      ))}
                      {adminState && adminState.feedbackReports.length === 0 ? <span className="adminEmpty">{tr("No beta reports yet.")}</span> : null}
                    </div>
                    <div className="adminPlayerList">
                      {(adminState?.players ?? []).map((player) => (
                        <button
                          type="button"
                          className={`${player.bot ? "adminPlayer botAdminPlayer" : "adminPlayer"} ${selectedAdminPlayer?.id === player.id ? "activeAdminPlayer" : ""}`}
                          key={player.id}
                          onClick={() => setSelectedAdminPlayerId(player.id)}
                        >
                          <strong>{player.name}</strong>
                          <span>
                            {tr(player.bot ? "Bot" : "Real")} · {tr("Lv.")}{player.level} {tr(CLASS_DEFINITIONS[player.classId].label)} · HP {Math.round(player.hp)}/{player.maxHp} · {tr(player.zone)}
                          </span>
                          <em>{tr(player.mutedUntil && player.mutedUntil > Date.now() ? "muted" : player.karma > 0 ? `karma ${player.karma}` : "ok")}</em>
                        </button>
                      ))}
                      {adminState && adminState.players.length === 0 ? <span className="adminEmpty">{tr("No players or bots online.")}</span> : null}
                    </div>
                    {selectedAdminPlayer ? (
                      <div className="adminSelected">
                        <div>
                          <strong>{selectedAdminPlayer.name}</strong>
                          <span>
                            {selectedAdminPlayer.bot ? `${tr("bot")} · ` : ""}{tr("gold")} {selectedAdminPlayer.gold} · {tr("karma")} {selectedAdminPlayer.karma} · x {Math.round(selectedAdminPlayer.position.x)} y {Math.round(selectedAdminPlayer.position.y)}
                          </span>
                        </div>
                        <div className="adminActions">
                          <button type="button" onClick={() => sendAdminAction("teleportTo")}>{tr("Go")}</button>
                          <button type="button" onClick={() => sendAdminAction("summon")}>{tr("Summon")}</button>
                          <button type="button" onClick={() => sendAdminAction("heal")}>{tr("Heal")}</button>
                          <button type="button" onClick={() => sendAdminAction("revive")}>{tr("Revive")}</button>
                          <button type="button" onClick={() => sendAdminAction("clearKarma")}>{tr("Clear karma")}</button>
                          <button type="button" onClick={() => sendAdminAction("muteChat", selectedAdminPlayer.id, 15 * 60_000)}>{tr("Mute 15m")}</button>
                          <button type="button" onClick={() => sendAdminAction("unmuteChat")}>{tr("Unmute")}</button>
                          <button type="button" disabled={selectedAdminPlayer.id === localPlayer?.id} onClick={() => sendAdminAction("kick")}>{tr("Kick")}</button>
                          <button type="button" className="dangerAdminAction" disabled={selectedAdminPlayer.id === localPlayer?.id} onClick={() => sendAdminAction("ban")}>{tr("Ban")}</button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {profileTab === "settings" ? (
                  <div className="profilePane settingsPane">
                    <div className="settingsBox languageSettingsBox">
                      <div className="settingsBoxHeader">
                        <div>
                          <strong>{tr("Language")}</strong>
                          <span>{language === "ru" ? "Русский" : "English"}</span>
                        </div>
                        <div className="settingsLanguageSwitch languageSwitch" role="group" aria-label={tr("Language")}>
                          {LANGUAGE_OPTIONS.map((option) => (
                            <button
                              type="button"
                              className={language === option.id ? "activeLanguage" : ""}
                              key={option.id}
                              aria-pressed={language === option.id}
                              title={option.label}
                              onClick={() => chooseLanguage(option.id)}
                            >
                              {option.shortLabel}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
	                    <label className="settingsToggle">
	                      <span>
	                        <strong>{tr("Mobile auto target")}</strong>
	                        <small>{tr("ATK/SKL can pick the nearest mob when no target is selected.")}</small>
	                      </span>
	                      <input type="checkbox" checked={mobileAutoTarget} onChange={(event) => setMobileAutoTarget(event.target.checked)} />
	                    </label>
                    <div className="settingsBox voiceSettingsBox">
                      <div className="settingsBoxHeader">
                        <div>
                          <strong>{tr("Voice chat")}</strong>
                          <span>{tr(voiceState.supported ? (voiceState.permission === "granted" ? "Microphone ready" : voiceState.permission === "denied" ? "Microphone blocked" : "Microphone permission") : "Unavailable")}</span>
                        </div>
                        <button type="button" onClick={requestVoicePermission} disabled={!voiceEnabled || !voiceState.supported}>
                          <Mic2 size={15} />
                          {tr("Mic")}
                        </button>
                      </div>
                      <div className="settingsToggleGrid">
                        <label className="settingsToggle compactSettingsToggle">
                          <span>
                            <strong>{tr("Microphone")}</strong>
                            <small>{tr(voiceState.active ? "Live" : voiceState.enabled ? "Enabled" : "Disabled")}</small>
                          </span>
                          <input type="checkbox" checked={voiceEnabled} onChange={(event) => updateVoiceEnabled(event.target.checked)} />
                        </label>
                        <label className="settingsToggle compactSettingsToggle">
                          <span>
                            <strong>{tr("Voice channel")}</strong>
                            <small>{tr(effectiveVoiceChannel === "party" ? "Party" : "Nearby")}</small>
                          </span>
                          <select value={effectiveVoiceChannel} onChange={(event) => updateVoiceChannel(event.target.value as VoiceChannel)}>
                            <option value="nearby">{tr("Nearby")}</option>
                            <option value="party" disabled={!canUsePartyVoice}>{tr("Party")}</option>
                          </select>
                        </label>
                      </div>
                      {voiceState.error ? <span className="voiceSettingsStatus">{tr(voiceState.error)}</span> : null}
                    </div>
	                    <div className="settingsBox customHeadSettings">
                      <div className="settingsBoxHeader">
                        <div>
                          <strong>{tr("Profile face")}</strong>
                          <span>{tr("PNG face like Kirs/Unit: square, transparent background, no text or logos.")}</span>
                        </div>
                        <span className="customHeadBadge">{tr(accountSession?.authProvider === "account" ? "Account" : "Account only")}</span>
                      </div>
                      <div className="customHeadBody">
                        <span className="customHeadPreview">
                          <img src={customHeadUrl ?? "/kirs-head.png"} alt="" />
                        </span>
                        <div className="customHeadActions">
                          <input
                            ref={customHeadInputRef}
                            type="file"
                            accept="image/png"
                            onChange={(event) => void uploadCustomHead(event.currentTarget.files?.[0])}
                            onKeyDown={(event) => event.stopPropagation()}
                          />
                          <button type="button" onClick={() => customHeadInputRef.current?.click()} disabled={headUploadBusy || accountSession?.authProvider !== "account"}>
                            <UserRound size={15} />
                            {tr("Choose PNG")}
                          </button>
                          <button type="button" onClick={() => void clearCustomHead()} disabled={headUploadBusy || accountSession?.authProvider !== "account" || !customHeadUrl}>
                            <X size={15} />
                            {tr("Use default")}
                          </button>
                        </div>
                      </div>
                      <small className="customHeadHint">{tr("Server rejects plain screenshots, text banners and non-transparent images.")}</small>
                      {headUploadStatus ? <span className="customHeadStatus">{tr(headUploadStatus)}</span> : null}
                    </div>
                    <div className="settingsBox graphicsSettingsBox">
                      <div className="settingsBoxHeader">
                        <div>
                          <strong>{tr("Graphics")}</strong>
                          <span>{tr(mobileGraphicsPresets.find((option) => option.id === mobileGraphics.preset)?.hint ?? "Mobile performance profile")}</span>
                        </div>
                        <select value={mobileGraphics.fpsLimit} onChange={(event) => updateMobileGraphics({ fpsLimit: Number(event.target.value) as MobileGraphicsSettings["fpsLimit"] })}>
                          <option value={120}>120 FPS</option>
                          <option value={60}>60 FPS</option>
                          <option value={45}>45 FPS</option>
                          <option value={30}>30 FPS</option>
                        </select>
                      </div>
                      <div className="graphicsPresetGrid">
                        {mobileGraphicsPresets.map((preset) => (
                          <button
                            type="button"
                            className={mobileGraphics.preset === preset.id ? "activeGraphicsPreset" : ""}
                            key={preset.id}
                            onClick={() => applyMobileGraphicsPreset(preset.id)}
                          >
                            <strong>{tr(preset.label)}</strong>
                            <span>{preset.settings.fpsLimit} FPS</span>
                          </button>
                        ))}
                      </div>
                      <div className="settingsToggleGrid">
                        <div className="settingsToggle compactSettingsToggle staticSettingsToggle">
                          <span>
                            <strong>{tr("World style locked")}</strong>
                            <small>{tr("Presets keep the same camera, meadow style and safe default world profile.")}</small>
                          </span>
                          <small className="lockedSettingBadge">{tr("Stable")}</small>
                        </div>
                        <label className="settingsToggle compactSettingsToggle">
                          <span>
                            <strong>{tr("Full mobile world")}</strong>
                            <small>{tr("Desktop-style map on mobile. Turn off if the phone heats or drops frames.")}</small>
                          </span>
                          <input type="checkbox" checked={mobileGraphics.mobileFullWorldMap} onChange={(event) => updateStartupGraphics({ mobileFullWorldMap: event.target.checked })} />
                        </label>
                        <label className="settingsToggle compactSettingsToggle">
                          <span>
                            <strong>{tr("Combat effects")}</strong>
                            <small>{tr("Skill trails, kill flashes and cast visuals.")}</small>
                          </span>
                          <input type="checkbox" checked={mobileGraphics.combatEffects} onChange={(event) => updateMobileGraphics({ combatEffects: event.target.checked })} />
                        </label>
                        <label className="settingsToggle compactSettingsToggle">
                          <span>
                            <strong>{tr("Damage text")}</strong>
                            <small>{tr("Floating damage and healing numbers.")}</small>
                          </span>
                          <input type="checkbox" checked={mobileGraphics.floatingText} onChange={(event) => updateMobileGraphics({ floatingText: event.target.checked })} />
                        </label>
                        <label className="settingsToggle compactSettingsToggle">
                          <span>
                            <strong>{tr("Player labels")}</strong>
                            <small>{tr("Names, PvP/PK markers and level text.")}</small>
                          </span>
                          <input type="checkbox" checked={mobileGraphics.playerLabels} onChange={(event) => updateMobileGraphics({ playerLabels: event.target.checked })} />
                        </label>
                        <label className="settingsToggle compactSettingsToggle">
                          <span>
                            <strong>{tr("Show FPS")}</strong>
                            <small>{tr("Small live frame counter for performance testing.")}</small>
                          </span>
                          <input type="checkbox" checked={mobileGraphics.showFps} onChange={(event) => updateMobileGraphics({ showFps: event.target.checked })} />
                        </label>
                      </div>
                    </div>
                    <label>
                      {tr("Chat channel")}
                      <select value={chatChannel} onChange={(event) => setChatChannel(event.target.value as Exclude<ChatChannel, "system">)}>
                        <option value="local">{tr("Local")}</option>
                        <option value="zone">{tr("Zone")}</option>
                        <option value="dungeon">{tr("Dungeon")}</option>
                        <option value="world">{tr("World")}</option>
                        <option value="clan" disabled={!localClan}>{tr("Clan")}</option>
                      </select>
                    </label>
                    <div className="feedbackBox">
                      <strong>{tr("Beta feedback")}</strong>
                      <textarea
                        value={feedbackDraft}
                        maxLength={420}
                        placeholder={tr("Bug, stuck place, bad balance, UI problem...")}
                        onChange={(event) => setFeedbackDraft(event.target.value)}
                        onKeyDown={(event) => event.stopPropagation()}
                      />
                      <button type="button" onClick={sendFeedback}>
                        <MessageSquare size={16} />
                        {tr("Send report")}
                      </button>
                      <span>{tr(feedbackStatus)}</span>
                    </div>
                    <button type="button" onClick={() => setStarted(false)}>
                      {tr("Character select")}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

	            {shopOpen ? (
	              <div className="worldNpcWindow shopNpcWindow" ref={shopWindowRef} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
                <div className="windowHeader npcWindowHeader">
                  <span className="npcWindowIcon">
                    <Store size={20} />
                  </span>
                  <div>
                    <strong>{tr(interactionCity.label)} {tr("Merchant")}</strong>
                    <span>{tr(canUseShop ? "Town trade" : "Move closer to a town merchant.")}</span>
                  </div>
                  <button type="button" className="iconOnly" onClick={() => setShopOpen(false)} aria-label={tr("Close shop")}>
                    <X size={18} />
                  </button>
                </div>
                <div className="profilePane shopPane npcShopPane">
                  <div className="shopHeader">
                    <div>
                      <span className="shopEyebrow">{tr("Merchant stock")}</span>
                      <strong>{tr("Gear, scrolls and supplies")}</strong>
                      <span>{tr("All class gear, grade scrolls, consumables and arena ornaments")}</span>
                    </div>
                    <div className="shopWalletChips">
                      <span><Coins size={14} />{gold.toLocaleString(language === "ru" ? "ru-RU" : "en-US")} {tr("gold")}</span>
                      <span><Crown size={14} />{coinCount.toLocaleString(language === "ru" ? "ru-RU" : "en-US")} {tr("Coin")}</span>
                      <span><Gem size={14} />{pvpCoinCount.toLocaleString(language === "ru" ? "ru-RU" : "en-US")} {tr("PvP Coin")}</span>
                    </div>
                  </div>
                  <div className="shopGrid">
                    {shopOffers.map((offer) => {
                      const coinPrice = offer.priceItemQuantity ?? 0;
                      const priceItemCount = offer.priceItemId ? inventoryQuantity(offer.priceItemId) : 0;
                      const priceCurrency = shopCurrencyLabel(offer.priceItemId);
                      const affordable = offer.priceItemId ? priceItemCount >= coinPrice : gold >= offer.priceGold;
                      const levelReady = currentLevel >= (offer.item.requiredLevel ?? 1);
                      const canBuyOffer = Boolean(canUseShop && affordable && levelReady);
                      const priceLocale = language === "ru" ? "ru-RU" : "en-US";
                      const priceLabel = offer.priceItemId
                        ? `${coinPrice.toLocaleString(priceLocale)} ${tr(priceCurrency)}`
                        : offer.priceGold.toLocaleString(priceLocale);
                      const slotLabel = itemSlotLabel(offer.item.slot);
                      const gradeLabel = offer.item.grade ? itemGradeLabel(offer.item.grade) : undefined;
                      return (
                        <div className={`shopItem ${itemGradeClass(offer.item)}`} key={offer.id}>
                          <ItemIcon item={offer.item} />
                          <div className="shopItemCopy">
                            <div className="shopItemTitle">
                              <strong>{tr(offer.item.label)}</strong>
                              {gradeLabel ? <small className="shopGradeBadge">{tr(gradeLabel)}</small> : null}
                              {slotLabel ? <small className="shopSlotBadge">{tr(slotLabel)}</small> : null}
                            </div>
                            <span>{tr(offer.description)}</span>
                            <em>{[tr(itemMetaText(offer.item, { includeSlot: false })), tr(itemStatsText(offer.item))].filter(Boolean).join(" · ")}</em>
                          </div>
                          <button
                            type="button"
                            disabled={!canBuyOffer}
                            title={!levelReady ? tr(`Requires Lv.${offer.item.requiredLevel}`) : !affordable ? tr(offer.priceItemId ? `Not enough ${priceCurrency}` : "Not enough gold") : undefined}
                            onClick={() => window.dispatchEvent(new CustomEvent("mmo:buyShopItem", { detail: { itemId: offer.id } }))}
                          >
                            {priceLabel}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
	              </div>
	            ) : null}

            {activeVendorSeller?.marketVendor ? (
              <div className="worldNpcWindow marketNpcWindow" ref={vendorWindowRef} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
                <div className="windowHeader npcWindowHeader">
                  <span className="npcWindowIcon">
                    <Store size={20} />
                  </span>
                  <div>
                    <strong>{activeVendorSeller.name}</strong>
                    <span>{tr(activeVendorSeller.marketVendor.title)}</span>
                  </div>
                  <button type="button" className="iconOnly" onClick={() => setVendorSellerId(undefined)} aria-label={tr("Close market")}>
                    <X size={18} />
                  </button>
                </div>
                <div className="profilePane shopPane npcShopPane marketPane">
                  <div className="shopHeader">
                    <div>
                      <span className="shopEyebrow">{tr("Market seller")}</span>
                      <strong>{activeVendorSeller.marketVendor.items.length} {tr("offers")}</strong>
                      <span>{tr("Player stalls and NPC discounts")}</span>
                    </div>
                    <div className="shopWalletChips">
                      <span><Coins size={14} />{gold.toLocaleString(language === "ru" ? "ru-RU" : "en-US")} {tr("gold")}</span>
                    </div>
                  </div>
                  <div className="shopGrid marketGrid">
                    {activeVendorSeller.marketVendor.items.map((listing) => {
                      const affordable = gold >= listing.priceGold;
                      const levelReady = currentLevel >= (listing.item.requiredLevel ?? 1);
                      return (
                        <div className={`shopItem ${itemGradeClass(listing.item)}`} key={listing.listingId}>
                          <ItemIcon item={listing.item} />
                          <div className="shopItemCopy">
                            <div className="shopItemTitle">
                              <strong>{tr(itemDisplayName(listing.item))}</strong>
                              {listing.item.grade ? <small className="shopGradeBadge">{tr(itemGradeLabel(listing.item.grade))}</small> : null}
                              {listing.item.slot ? <small className="shopSlotBadge">{tr(itemSlotLabel(listing.item.slot) ?? "")}</small> : null}
                            </div>
                            <span>{tr(listing.source === "bot" ? "NPC market stock" : "Player listing")}</span>
                            <em>{[tr(itemMetaText(listing.item, { includeSlot: false })), tr(itemStatsText(listing.item))].filter(Boolean).join(" · ")}</em>
                          </div>
                          <button
                            type="button"
                            disabled={!affordable || !levelReady}
                            title={!levelReady ? tr(`Requires Lv.${listing.item.requiredLevel}`) : !affordable ? tr("Not enough gold") : undefined}
                            onClick={() => window.dispatchEvent(new CustomEvent("mmo:buyMarketItem", { detail: { sellerId: activeVendorSeller.id, listingId: listing.listingId } }))}
                          >
                            {listing.priceGold.toLocaleString(language === "ru" ? "ru-RU" : "en-US")}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}

            {activeTrade && tradeSelfOffer && tradePeerOffer ? (
              <div className="worldNpcWindow tradeNpcWindow" ref={tradeWindowRef} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
                <div className="windowHeader npcWindowHeader">
                  <span className="npcWindowIcon">
                    <Hand size={20} />
                  </span>
                  <div>
                    <strong>{tr("Trade")}</strong>
                    <span>{tradePeerOffer.playerName}</span>
                  </div>
                  <button type="button" className="iconOnly" onClick={() => window.dispatchEvent(new CustomEvent("mmo:tradeCancel"))} aria-label={tr("Cancel trade")}>
                    <X size={18} />
                  </button>
                </div>
                <div className="tradePane">
                  <section className={tradeSelfOffer.ready ? "tradeOffer readyTradeOffer" : "tradeOffer"}>
                    <div className="tradeOfferHeader">
                      <strong>{tr("Your offer")}</strong>
                      <span>{tr(tradeSelfOffer.ready ? "Ready" : "Editing")}</span>
                    </div>
                    <div className="tradeGoldRow">
                      <Coins size={15} />
                      <input type="number" min={0} max={gold} value={tradeGoldDraft} onChange={(event) => setTradeGoldDraft(event.target.value)} />
                      <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("mmo:tradeOfferGold", { detail: { gold: Math.max(0, Math.trunc(Number(tradeGoldDraft) || 0)) } }))}>
                        {tr("Set")}
                      </button>
                    </div>
                    <div className="tradeItemPicker">
                      <select value={tradeItemIndex ?? ""} onChange={(event) => setTradeItemIndex(event.target.value === "" ? undefined : Number(event.target.value))}>
                        <option value="">{tr("Select item")}</option>
                        {inventory.map((item, index) => (
                          <option value={index} key={`${item.id}-${index}`}>
                            {tr(itemDisplayName(item))}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={1}
                        max={tradeSelectedItem?.stackable ? tradeSelectedItem.quantity : 1}
                        value={tradeQuantityDraft}
                        disabled={!tradeSelectedItem?.stackable}
                        onChange={(event) => setTradeQuantityDraft(event.target.value)}
                      />
                      <button
                        type="button"
                        disabled={tradeItemIndex === undefined || !tradeSelectedItem}
                        onClick={() =>
                          tradeItemIndex !== undefined &&
                          window.dispatchEvent(new CustomEvent("mmo:tradeOfferItem", { detail: { inventoryIndex: tradeItemIndex, quantity: tradeSelectedQuantity } }))
                        }
                      >
                        <Package size={14} />
                        {tr("Add")}
                      </button>
                    </div>
                    <div className="tradeOfferItems">
                      {tradeSelfOffer.items.length === 0 ? <span className="emptyTradeOffer">{tr("No items")}</span> : null}
                      {tradeSelfOffer.items.map((entry) => (
                        <button type="button" key={entry.tradeItemId} onClick={() => window.dispatchEvent(new CustomEvent("mmo:tradeRemoveItem", { detail: { tradeItemId: entry.tradeItemId } }))}>
                          <ItemIcon item={entry.item} />
                          <span>{tr(itemDisplayName(entry.item))}</span>
                          <small>{entry.quantity > 1 ? `x${entry.quantity}` : tr("Remove")}</small>
                        </button>
                      ))}
                    </div>
                  </section>
                  <section className={tradePeerOffer.ready ? "tradeOffer readyTradeOffer" : "tradeOffer"}>
                    <div className="tradeOfferHeader">
                      <strong>{tradePeerOffer.playerName}</strong>
                      <span>{tr(tradePeerOffer.ready ? "Ready" : "Editing")}</span>
                    </div>
                    <div className="tradePeerGold">
                      <Coins size={15} />
                      {tradePeerOffer.gold.toLocaleString(language === "ru" ? "ru-RU" : "en-US")} {tr("gold")}
                    </div>
                    <div className="tradeOfferItems">
                      {tradePeerOffer.items.length === 0 ? <span className="emptyTradeOffer">{tr("No items")}</span> : null}
                      {tradePeerOffer.items.map((entry) => (
                        <div className="tradePeerItem" key={entry.tradeItemId}>
                          <ItemIcon item={entry.item} />
                          <span>{tr(itemDisplayName(entry.item))}</span>
                          <small>{entry.quantity > 1 ? `x${entry.quantity}` : tr(itemMetaText(entry.item))}</small>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
                <div className="tradeFooter">
                  <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("mmo:tradeReady", { detail: { ready: !tradeSelfOffer.ready } }))}>
                    <Hand size={14} />
                    {tr(tradeSelfOffer.ready ? "Edit" : "Ready")}
                  </button>
                  <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("mmo:tradeCancel"))}>
                    <X size={14} />
                    {tr("Cancel")}
                  </button>
                </div>
              </div>
            ) : null}

	            {teleportMenuOpen ? (
              <div className="worldNpcWindow teleportNpcWindow" ref={teleportWindowRef} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
                <div className="windowHeader npcWindowHeader">
                  <span className="npcWindowIcon teleportNpcIcon">
                    <Sparkles size={20} />
                  </span>
                  <div>
                    <strong>{tr(interactionCity.label)} {tr("Gate")}</strong>
                    <span>{tr("Choose destination from the active gate network")}</span>
                  </div>
                  <button type="button" className="iconOnly" onClick={() => setTeleportMenuOpen(false)} aria-label={tr("Close teleport menu")}>
                    <X size={18} />
                  </button>
                </div>
                <div className="teleportChoiceGrid">
                  {[
                    { id: "safe", label: tr("Safe zones"), options: safeTeleportOptions },
                    { id: "wild", label: tr("Rifts / dungeons"), options: adventureTeleportOptions }
                  ].map((section) =>
                    section.options.length > 0 ? (
                      <div className="teleportChoiceSection" key={section.id}>
                        <div className="teleportChoiceSectionTitle">{section.label}</div>
                        <div className="teleportChoiceSectionList">
                          {section.options.map((teleport) => {
                            const destination = teleportDestinationMeta(teleport);
                            return (
                              <button
                                type="button"
                                className={`teleportChoice teleportChoice-${destination.kindClass}`}
                                key={teleport.id}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  selectTeleportDestination(teleport.id as TeleportId);
                                }}
                              >
                                <span>
                                  <strong>{tr(destination.label)}</strong>
                                  <small>{tr(destination.kindLabel)} · {tr("Lv.")}{destination.level}+</small>
                                </span>
                                <Sparkles size={17} />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null
                  )}
                </div>
              </div>
            ) : null}
          </aside>
        </section>
      )}
    </main>
  );
}
