import type { ClientGraphicsPreset, ClientPerformanceProfile } from "@mmo/shared";

export type MobileWorldRange = "mobile" | "wide" | "widePlus";

export type MobileGraphicsSettings = {
  preset: ClientGraphicsPreset;
  fpsLimit: 30 | 45 | 60 | 120;
  worldDecorations: boolean;
  worldRange: MobileWorldRange;
  combatEffects: boolean;
  floatingText: boolean;
  playerLabels: boolean;
  showFps: boolean;
  desktopWorldTextures: boolean;
  smoothRender: boolean;
  mobileFullWorldMap: boolean;
};

// v10 safely rolls the expensive full-world option back to opt-in. Existing v9
// settings are migrated below so all unrelated user choices stay intact.
export const mobileGraphicsStorageKey = "mmo.mobileGraphics.v10";
const previousMobileGraphicsStorageKey = "mmo.mobileGraphics.v9";

const highQualityWorldVisuals = {
  worldDecorations: true,
  worldRange: "wide" as MobileWorldRange,
  desktopWorldTextures: true,
  smoothRender: true,
  mobileFullWorldMap: false
};

const extraQualityWorldVisuals = {
  ...highQualityWorldVisuals,
  worldRange: "widePlus" as MobileWorldRange
};

const leanWorldVisuals = {
  worldDecorations: false,
  worldRange: "mobile" as MobileWorldRange,
  desktopWorldTextures: false,
  smoothRender: true,
  mobileFullWorldMap: false
};

const stableFullTextureWorldVisuals = {
  ...leanWorldVisuals,
  desktopWorldTextures: true
};

export const mobileGraphicsPresets: Array<{ id: ClientGraphicsPreset; label: string; hint: string; settings: MobileGraphicsSettings }> = [
  {
    id: "desktop",
    label: "Desktop 120",
    hint: "120 FPS target with the same world art and the richest combat effects.",
    settings: { preset: "desktop", fpsLimit: 120, ...extraQualityWorldVisuals, combatEffects: true, floatingText: true, playerLabels: true, showFps: false }
  },
  {
    id: "full60",
    label: "Full 60",
    hint: "60 FPS target with the same world art and full readable effects.",
    settings: { preset: "full60", fpsLimit: 60, ...extraQualityWorldVisuals, combatEffects: true, floatingText: true, playerLabels: true, showFps: false }
  },
  {
    id: "highFullPlus",
    label: "High Full+",
    hint: "60 FPS target with stable world art and extra effect readability.",
    settings: { preset: "highFullPlus", fpsLimit: 60, ...extraQualityWorldVisuals, combatEffects: true, floatingText: true, playerLabels: true, showFps: false }
  },
  {
    id: "highFull",
    label: "High Full",
    hint: "60 FPS target with stable world art and standard combat effects.",
    settings: { preset: "highFull", fpsLimit: 60, ...extraQualityWorldVisuals, combatEffects: true, floatingText: true, playerLabels: true, showFps: false }
  },
  {
    id: "mediumFull",
    label: "Medium Full",
    hint: "60 FPS target with stable world art and readable combat text.",
    settings: { preset: "mediumFull", fpsLimit: 60, ...highQualityWorldVisuals, combatEffects: true, floatingText: true, playerLabels: true, showFps: false }
  },
  {
    id: "smooth",
    label: "Smooth 120",
    hint: "120 FPS on newer phones with the same world art and more effects.",
    settings: { preset: "smooth", fpsLimit: 120, ...highQualityWorldVisuals, combatEffects: true, floatingText: true, playerLabels: true, showFps: false }
  },
  {
    id: "balanced",
    label: "Balanced 60",
    hint: "60 FPS default: optimized mobile world, readable effects and crowd savings.",
    settings: { preset: "balanced", fpsLimit: 60, ...stableFullTextureWorldVisuals, combatEffects: true, floatingText: true, playerLabels: true, showFps: false }
  },
  {
    id: "cool",
    label: "Cool phone",
    hint: "45 FPS, same world art, leaner rendering with readable combat text.",
    settings: { preset: "cool", fpsLimit: 45, ...leanWorldVisuals, combatEffects: true, floatingText: true, playerLabels: true, showFps: false }
  },
  {
    id: "minimal",
    label: "PvP saver",
    hint: "30 FPS, same world art, only core combat readability in massive fights.",
    settings: { preset: "minimal", fpsLimit: 30, ...leanWorldVisuals, worldDecorations: false, combatEffects: false, floatingText: false, playerLabels: true, showFps: false }
  }
];

export const defaultMobileGraphicsSettings: MobileGraphicsSettings =
  mobileGraphicsPresets.find((option) => option.id === "balanced")?.settings ?? mobileGraphicsPresets[0].settings;

export function presetSettings(preset: ClientGraphicsPreset): MobileGraphicsSettings {
  return mobileGraphicsPresets.find((option) => option.id === preset)?.settings ?? defaultMobileGraphicsSettings;
}

export function isRuStoreLaunch(): boolean {
  const userAgent = navigator.userAgent;
  if (/DarkVellRuStore/i.test(userAgent)) {
    return true;
  }

  try {
    return new URLSearchParams(window.location.search).get("source") === "rustore";
  } catch {
    return false;
  }
}

export function isMobileGameRuntime(width = window.innerWidth, height = window.innerHeight): boolean {
  const localMobilePreview =
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") &&
    new URLSearchParams(window.location.search).get("mobilePreview") === "1";
  if (localMobilePreview) {
    return true;
  }
  const userAgent = navigator.userAgent;
  const mobileUserAgent = /Android|iPhone|iPad|iPod|Mobile|DarkVellRuStore/i.test(userAgent);
  const coarsePointer = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const noHover = window.matchMedia?.("(hover: none)").matches ?? false;
  const touchOnlyDevice = (navigator.maxTouchPoints ?? 0) > 0 && noHover;
  const compactViewport = width <= 920 || height <= 760;
  return compactViewport && (mobileUserAgent || coarsePointer || touchOnlyDevice);
}

function ruStoreStartupSettings(): MobileGraphicsSettings {
  return {
    ...presetSettings("balanced"),
    ...stableFullTextureWorldVisuals,
    fpsLimit: 60,
    combatEffects: true,
    floatingText: true,
    playerLabels: true,
    showFps: false
  };
}

export function normalizeMobileGraphicsSettings(raw: Partial<MobileGraphicsSettings> | undefined): MobileGraphicsSettings {
  const preset =
    !raw?.preset || !mobileGraphicsPresets.some((option) => option.id === raw.preset) ? defaultMobileGraphicsSettings.preset : raw.preset;
  const base = presetSettings(preset);
  const fpsLimit =
    !(raw?.fpsLimit === 30 || raw?.fpsLimit === 45 || raw?.fpsLimit === 60 || raw?.fpsLimit === 120) ? base.fpsLimit : raw.fpsLimit;
  const worldRange =
    raw?.worldRange === "mobile" || raw?.worldRange === "wide" || raw?.worldRange === "widePlus" ? raw.worldRange : base.worldRange;
  return {
    preset,
    fpsLimit,
    worldDecorations: typeof raw?.worldDecorations === "boolean" ? raw.worldDecorations : base.worldDecorations,
    worldRange,
    combatEffects: typeof raw?.combatEffects === "boolean" ? raw.combatEffects : base.combatEffects,
    floatingText: typeof raw?.floatingText === "boolean" ? raw.floatingText : base.floatingText,
    playerLabels: typeof raw?.playerLabels === "boolean" ? raw.playerLabels : base.playerLabels,
    showFps: typeof raw?.showFps === "boolean" ? raw.showFps : false,
    desktopWorldTextures: typeof raw?.desktopWorldTextures === "boolean" ? raw.desktopWorldTextures : base.desktopWorldTextures,
    smoothRender: typeof raw?.smoothRender === "boolean" ? raw.smoothRender : base.smoothRender,
    mobileFullWorldMap: typeof raw?.mobileFullWorldMap === "boolean" ? raw.mobileFullWorldMap : base.mobileFullWorldMap
  };
}

function defaultMobileGraphicsSettingsForDevice(): MobileGraphicsSettings {
  if (isRuStoreLaunch()) {
    return ruStoreStartupSettings();
  }
  return presetSettings("balanced");
}

export function loadMobileGraphicsSettings(): MobileGraphicsSettings {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(mobileGraphicsStorageKey) ?? "null") as Partial<MobileGraphicsSettings> | null | undefined;
    if (parsed) {
      return normalizeMobileGraphicsSettings(parsed);
    }

    const previous = JSON.parse(window.localStorage.getItem(previousMobileGraphicsStorageKey) ?? "null") as
      | Partial<MobileGraphicsSettings>
      | null
      | undefined;
    if (previous) {
      const migrated = normalizeMobileGraphicsSettings({ ...previous, mobileFullWorldMap: false });
      saveMobileGraphicsSettings(migrated);
      return migrated;
    }

    return defaultMobileGraphicsSettingsForDevice();
  } catch {
    return defaultMobileGraphicsSettingsForDevice();
  }
}

export function saveMobileGraphicsSettings(settings: MobileGraphicsSettings): void {
  window.localStorage.setItem(mobileGraphicsStorageKey, JSON.stringify(settings));
}

export function mobileGraphicsPerformanceProfile(mobile: boolean, settings: MobileGraphicsSettings): ClientPerformanceProfile {
  return {
    mobile,
    lowPower:
      mobile &&
      settings.preset !== "smooth" &&
      settings.preset !== "desktop" &&
      settings.preset !== "full60" &&
      settings.preset !== "highFullPlus" &&
      settings.preset !== "highFull" &&
      settings.preset !== "mediumFull" &&
      settings.preset !== "balanced",
    viewportWidth: Math.round(window.innerWidth),
    viewportHeight: Math.round(window.innerHeight),
    devicePixelRatio: Math.min(3, Math.round((window.devicePixelRatio || 1) * 100) / 100),
    graphicsPreset: settings.preset,
    fpsLimit: mobile ? settings.fpsLimit : undefined,
    worldDecorations: settings.worldDecorations,
    worldRange: settings.worldRange,
    combatEffects: settings.combatEffects,
    floatingText: settings.floatingText,
    playerLabels: settings.playerLabels
  };
}
