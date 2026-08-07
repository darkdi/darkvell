// Debug-only mobile input diagnostics.
//
// Fully inert unless explicitly enabled with `?touchdebug=1` (the flag is then
// remembered in localStorage; `?touchdebug=0` clears it). When disabled nothing
// is allocated, no listeners are attached and every call is a boolean check, so
// regular players are unaffected.
//
// Purpose: the mobile "taps stop working for a few seconds" bug has several
// competing explanations (main-thread stall, touch events never reaching JS,
// stuck input-ownership state, websocket reconnect swallowing commands). This
// overlay records all four layers side by side so a single reproduction on a
// real device tells us which one it is instead of guessing.

const STORAGE_KEY = "mmo.touchdebug";
const LOG_LIMIT = 16;
const STALL_THRESHOLD_MS = 220;

type StateProvider = () => Record<string, string | number | boolean | undefined>;

function readEnabledFlag(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("touchdebug");
    if (requested === "0" || requested === "off") {
      window.localStorage.removeItem(STORAGE_KEY);
      return false;
    }
    if (requested !== null) {
      window.localStorage.setItem(STORAGE_KEY, "1");
      return true;
    }
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

const ENABLED = readEnabledFlag();

interface LogEntry {
  at: number;
  gap: number;
  text: string;
}

// A "freeze" is a window where the player was clearly tapping fast and then the
// page stopped receiving touches. Capturing it automatically removes the need
// to screenshot at the exact instant the bug hits.
interface FreezeRecord {
  at: number;
  gapMs: number;
  frames: number;
  fpsDuring: number;
  gestures: number;
  cancels: number;
  pointers: number;
  scale: string;
}

const FREEZE_MIN_GAP_MS = 600;
const FREEZE_BURST_WINDOW_MS = 2_500;
const FREEZE_MIN_BURST_TAPS = 3;

class TouchDiagnostics {
  readonly enabled = ENABLED;

  private readonly log: LogEntry[] = [];
  private readonly providers = new Map<string, StateProvider>();
  private readonly counts = { docStart: 0, docEnd: 0, docCancel: 0, canvasStart: 0, canvasMove: 0, canvasEnd: 0, canvasCancel: 0, phaserDown: 0, hud: 0 };
  private readonly startedAt = performance.now();
  private lastEventAt = performance.now();
  private lastFrameAt = 0;
  private frameCount = 0;
  private frameWindowAt = 0;
  private fps = 0;
  private worstFrameMs = 0;
  private worstFrameAt = 0;
  private activeTouches = 0;
  private overlay?: HTMLDivElement;
  private renderTimer?: number;
  private totalFrames = 0;
  private lastDocTouchAt = 0;
  private framesAtLastDocTouch = 0;
  private gesturesAtLastDocTouch = 0;
  private cancelsAtLastDocTouch = 0;
  private gestureCount = 0;
  private pointerDownCount = 0;
  private pointersAtLastDocTouch = 0;
  private readonly recentDocStarts: number[] = [];
  private worstFreeze?: FreezeRecord;
  private lastFreeze?: FreezeRecord;
  private freezeCount = 0;

  start(): void {
    if (!this.enabled || this.overlay) {
      return;
    }

    // Passive counters only: they never call preventDefault or stopPropagation,
    // so they cannot alter the touch behaviour we are trying to observe. They
    // exist to tell "the browser stopped delivering touches" apart from "the
    // canvas handler stopped seeing them".
    document.addEventListener("touchstart", this.onDocTouchStart, { passive: true, capture: true });
    document.addEventListener("touchend", this.onDocTouchEnd, { passive: true, capture: true });
    document.addEventListener("touchcancel", this.onDocTouchCancel, { passive: true, capture: true });
    // Pointer events come down a different WebKit path than touch events. If a
    // freeze shows pointerdowns arriving while touchstarts do not, Safari is
    // suppressing touch events specifically rather than ignoring the finger.
    document.addEventListener("pointerdown", this.onDocPointerDown, { passive: true, capture: true });
    window.addEventListener("blur", this.onBlur);
    window.addEventListener("focus", this.onFocus);
    document.addEventListener("visibilitychange", this.onVisibility);

    // iOS Safari fires these when it decides a multi-finger gesture is in
    // progress. While that happens the page stops receiving touch events even
    // though rendering continues -- exactly the reported symptom -- so this is
    // the signal that separates "browser took over" from everything else.
    // `gesture*` is Safari-only and absent from lib.dom, hence the cast.
    const target = window as unknown as EventTarget;
    target.addEventListener("gesturestart", this.onGesture, { passive: true });
    target.addEventListener("gesturechange", this.onGesture, { passive: true });
    target.addEventListener("gestureend", this.onGesture, { passive: true });
    window.visualViewport?.addEventListener("resize", this.onViewport);

    this.overlay = document.createElement("div");
    this.overlay.style.cssText = [
      "position:fixed",
      "left:4px",
      "top:4px",
      "z-index:99999",
      "max-width:min(430px,62vw)",
      "padding:5px 6px",
      "background:rgba(2,8,6,0.82)",
      "color:#c8f7d8",
      "font:10px/1.28 ui-monospace,SFMono-Regular,Menlo,monospace",
      "white-space:pre",
      "border:1px solid #2f5a45",
      "border-radius:6px",
      "pointer-events:none",
      "text-shadow:0 1px 0 #000"
    ].join(";");
    document.body.appendChild(this.overlay);

    this.renderTimer = window.setInterval(() => this.render(), 250);
    this.event("diag on");
  }

  registerState(name: string, provider: StateProvider): void {
    if (!this.enabled) {
      return;
    }
    this.providers.set(name, provider);
  }

  event(text: string): void {
    if (!this.enabled) {
      return;
    }

    const at = performance.now();
    this.log.push({ at, gap: at - this.lastEventAt, text });
    this.lastEventAt = at;
    if (this.log.length > LOG_LIMIT) {
      this.log.shift();
    }
  }

  noteFrame(): void {
    if (!this.enabled) {
      return;
    }

    this.totalFrames += 1;
    const now = performance.now();
    if (this.lastFrameAt > 0) {
      const delta = now - this.lastFrameAt;
      if (delta > STALL_THRESHOLD_MS) {
        this.event(`FRAME STALL ${Math.round(delta)}ms`);
      }
      if (delta > this.worstFrameMs || now - this.worstFrameAt > 5_000) {
        this.worstFrameMs = delta;
        this.worstFrameAt = now;
      }
    }
    this.lastFrameAt = now;

    this.frameCount += 1;
    if (this.frameWindowAt === 0) {
      this.frameWindowAt = now;
    } else if (now - this.frameWindowAt >= 1_000) {
      this.fps = Math.round((this.frameCount * 1000) / (now - this.frameWindowAt));
      this.frameCount = 0;
      this.frameWindowAt = now;
    }
  }

  canvasTouch(kind: "start" | "move" | "end" | "cancel", detail: string): void {
    if (!this.enabled) {
      return;
    }

    if (kind === "start") {
      // A `doc start` without a matching `cv start` in the log means the touch
      // never reached the canvas listener: the gap is in event delivery, not in
      // game logic.
      this.counts.canvasStart += 1;
      this.event(`cv start ${detail}`);
      return;
    }
    if (kind === "move") {
      this.counts.canvasMove += 1;
      return;
    }
    if (kind === "end") {
      this.counts.canvasEnd += 1;
      this.event(`cv end ${detail}`);
      return;
    }
    this.counts.canvasCancel += 1;
    this.event(`cv CANCEL ${detail}`);
  }

  phaserPointerDown(detail: string): void {
    if (!this.enabled) {
      return;
    }
    this.counts.phaserDown += 1;
    this.event(`phaser down ${detail}`);
  }

  hudTap(detail: string): void {
    if (!this.enabled) {
      return;
    }
    this.counts.hud += 1;
    this.event(`hud ${detail}`);
  }

  private readonly onDocTouchStart = (event: TouchEvent) => {
    this.counts.docStart += 1;
    this.activeTouches = event.touches.length;
    this.detectFreeze();
    this.noteDocTouch();
    this.recentDocStarts.push(performance.now());
    const target = event.target instanceof HTMLElement ? event.target.tagName.toLowerCase() : "?";
    this.event(`doc start n=${event.touches.length} ${target}`);
  };

  private readonly onDocTouchEnd = (event: TouchEvent) => {
    this.counts.docEnd += 1;
    this.activeTouches = event.touches.length;
    this.noteDocTouch();
  };

  private readonly onDocTouchCancel = (event: TouchEvent) => {
    this.counts.docCancel += 1;
    this.activeTouches = event.touches.length;
    this.noteDocTouch();
    this.event(`doc CANCEL n=${event.touches.length}`);
  };

  private readonly onDocPointerDown = () => {
    this.pointerDownCount += 1;
  };

  private readonly onGesture = (event: Event) => {
    this.gestureCount += 1;
    const scale = (event as Event & { scale?: number }).scale;
    this.event(`iOS GESTURE ${event.type}${scale === undefined ? "" : ` s=${scale.toFixed(2)}`}`);
  };

  private readonly onViewport = () => {
    const viewport = window.visualViewport;
    this.event(`viewport ${viewport?.width.toFixed(0)}x${viewport?.height.toFixed(0)} s=${viewport?.scale.toFixed(2)}`);
  };

  private noteDocTouch(): void {
    this.lastDocTouchAt = performance.now();
    this.framesAtLastDocTouch = this.totalFrames;
    this.gesturesAtLastDocTouch = this.gestureCount;
    this.cancelsAtLastDocTouch = this.counts.docCancel;
    this.pointersAtLastDocTouch = this.pointerDownCount;
  }

  // Called on a fresh touchstart: measures the silence that just ended. Frames
  // rendered during that silence are the decisive number -- a live frame count
  // means the main thread was fine and the browser simply stopped delivering
  // touches, while a near-zero count means the page was stalled.
  private detectFreeze(): void {
    const now = performance.now();
    if (this.lastDocTouchAt === 0) {
      return;
    }

    const gapMs = now - this.lastDocTouchAt;
    if (gapMs < FREEZE_MIN_GAP_MS) {
      return;
    }

    while (this.recentDocStarts.length > 0 && this.lastDocTouchAt - this.recentDocStarts[0] > FREEZE_BURST_WINDOW_MS) {
      this.recentDocStarts.shift();
    }
    if (this.recentDocStarts.length < FREEZE_MIN_BURST_TAPS) {
      // Not a burst of taps before the silence: the player simply stopped
      // touching the screen, which is not the bug.
      return;
    }

    const frames = this.totalFrames - this.framesAtLastDocTouch;
    const record: FreezeRecord = {
      at: now,
      gapMs,
      frames,
      fpsDuring: Math.round((frames * 1000) / gapMs),
      gestures: this.gestureCount - this.gesturesAtLastDocTouch,
      cancels: this.counts.docCancel - this.cancelsAtLastDocTouch,
      pointers: this.pointerDownCount - this.pointersAtLastDocTouch,
      scale: window.visualViewport ? window.visualViewport.scale.toFixed(2) : "-"
    };
    this.freezeCount += 1;
    this.lastFreeze = record;
    if (!this.worstFreeze || record.gapMs > this.worstFreeze.gapMs) {
      this.worstFreeze = record;
    }
    this.event(`FREEZE ${Math.round(gapMs)}ms frames=${frames} (${record.fpsDuring}fps) g=${record.gestures} c=${record.cancels}`);
  }

  private describeFreeze(label: string, record: FreezeRecord | undefined, now: number): string {
    if (!record) {
      return `${label}: none`;
    }
    return `${label}: ${Math.round(record.gapMs)}ms fr=${record.frames} ${record.fpsDuring}fps gest=${record.gestures} pd=${record.pointers} cnc=${record.cancels} sc=${record.scale} ${((now - record.at) / 1000).toFixed(0)}s ago`;
  }

  private readonly onBlur = () => this.event("window blur");
  private readonly onFocus = () => this.event("window focus");
  private readonly onVisibility = () => this.event(`hidden=${document.hidden ? 1 : 0}`);

  private render(): void {
    if (!this.overlay) {
      return;
    }

    const now = performance.now();
    const lines: string[] = [];
    lines.push(
      `fps ${this.fps} worst ${Math.round(this.worstFrameMs)}ms  up ${Math.round((now - this.startedAt) / 1000)}s`
    );
    lines.push(
      `doc s/e/c ${this.counts.docStart}/${this.counts.docEnd}/${this.counts.docCancel}  live ${this.activeTouches}`
    );
    lines.push(
      `cv s/m/e/c ${this.counts.canvasStart}/${this.counts.canvasMove}/${this.counts.canvasEnd}/${this.counts.canvasCancel}  ph ${this.counts.phaserDown}  hud ${this.counts.hud}`
    );
    lines.push(`freezes ${this.freezeCount}  iOSgesture ${this.gestureCount}  pd ${this.pointerDownCount}`);
    lines.push(this.describeFreeze("WORST", this.worstFreeze, now));
    lines.push(this.describeFreeze("LAST ", this.lastFreeze, now));

    this.providers.forEach((provider, name) => {
      let state: Record<string, string | number | boolean | undefined>;
      try {
        state = provider();
      } catch {
        lines.push(`${name}: <error>`);
        return;
      }
      const body = Object.entries(state)
        .map(([key, value]) => `${key}=${value === undefined ? "-" : String(value)}`)
        .join(" ");
      lines.push(`${name}: ${body}`);
    });

    lines.push("--");
    this.log.forEach((entry) => {
      lines.push(`${((now - entry.at) / 1000).toFixed(1)}s +${Math.round(entry.gap)} ${entry.text}`);
    });

    this.overlay.textContent = lines.join("\n");
  }

  stop(): void {
    if (!this.enabled) {
      return;
    }

    document.removeEventListener("touchstart", this.onDocTouchStart, true);
    document.removeEventListener("touchend", this.onDocTouchEnd, true);
    document.removeEventListener("touchcancel", this.onDocTouchCancel, true);
    document.removeEventListener("pointerdown", this.onDocPointerDown, true);
    window.removeEventListener("blur", this.onBlur);
    window.removeEventListener("focus", this.onFocus);
    document.removeEventListener("visibilitychange", this.onVisibility);
    const target = window as unknown as EventTarget;
    target.removeEventListener("gesturestart", this.onGesture);
    target.removeEventListener("gesturechange", this.onGesture);
    target.removeEventListener("gestureend", this.onGesture);
    window.visualViewport?.removeEventListener("resize", this.onViewport);
    if (this.renderTimer !== undefined) {
      window.clearInterval(this.renderTimer);
      this.renderTimer = undefined;
    }
    this.overlay?.remove();
    this.overlay = undefined;
    this.providers.clear();
  }
}

export const touchDiag = new TouchDiagnostics();
