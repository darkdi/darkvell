import type {
  AdminActionType,
  AdminState,
  AttackCommand,
  ChatChannel,
  ChatMessage,
  CharacterClass,
  CharacterRace,
  ClanEmblem,
  ClientMessage,
  ClientPerformanceProfile,
  DerivedStats,
  EquipmentSlot,
  EquipmentState,
  GameSnapshot,
  InventoryItem,
  PlayerInput,
  ServerMessage,
  SkillCommand,
  TeleportId,
  VoiceChannel,
  VoiceSignal,
  WalletState
} from "@mmo/shared";

type Listener<T> = (payload: T) => void;
export type RealtimeError = Extract<ServerMessage, { type: "error" }>["payload"];

// Dev-only escape hatch: automated preview browsers report document.hidden=true,
// which normally pauses snapshot delivery. `?previewActive=1` keeps snapshots flowing there.
const previewForceVisible =
  Boolean(import.meta.env?.DEV) && typeof window !== "undefined" && new URLSearchParams(window.location.search).has("previewActive");

function pageHidden(): boolean {
  return !previewForceVisible && document.hidden;
}

export interface RealtimeEvents {
  welcome: Extract<ServerMessage, { type: "welcome" }>;
  snapshot: GameSnapshot;
  inventory: { items: InventoryItem[]; equipment: EquipmentState; stats: DerivedStats; gold: number; wallet: WalletState };
  claim: Extract<ServerMessage, { type: "rewardClaimed" }>;
  chat: ChatMessage;
  voicePeers: Extract<ServerMessage, { type: "voicePeers" }>["payload"];
  voiceSignal: Extract<ServerMessage, { type: "voiceSignal" }>["payload"];
  adminState: AdminState;
  feedbackSaved: Extract<ServerMessage, { type: "feedbackSaved" }>["payload"];
  error: RealtimeError;
}

export class RealtimeClient {
  private socket?: WebSocket;
  private readonly listeners = new Map<keyof RealtimeEvents, Set<Listener<never>>>();
  private reconnectTimer?: number;
  private pendingSnapshot?: GameSnapshot;
  private snapshotFrame?: number;
  private lastSnapshotServerTime = 0;
  private serverClockOffsetMs?: number;
  private connectionWatchdogTimer?: number;
  private connectionStartedAt = 0;
  private socketOpenedAt = 0;
  private lastAcceptedSnapshotAt = 0;
  private welcomeReceived = false;
  private staleSnapshotStreamStartedAt?: number;
  private highBufferedAmountStartedAt?: number;
  private hiddenAt?: number;
  private backgroundCloseTimer?: number;
  private resumeReconnectTimer?: number;
  private reconnectOnVisible = false;
  private rawSnapshotDropUntilMs = 0;
  private resumeDropUntilMs = 0;
  private joined?: { name: string; classId: CharacterClass; characterId?: string; token?: string; race?: CharacterRace; face?: number; customHeadUrl?: string; profile?: ClientPerformanceProfile };
  private manuallyClosed = false;
  private readonly visibilityListener = () => this.handleVisibilityChange();

  private static readonly MAX_QUEUED_SNAPSHOT_AGE_MS = 900;
  private static readonly MAX_STALE_CHAT_AGE_MS = 18_000;
  private static readonly RESUME_STALE_CHAT_AGE_MS = 3_500;
  private static readonly BACKGROUND_SOCKET_PAUSE_MS = 20_000;
  private static readonly RESUME_RECONNECT_DELAY_MS = 40;
  private static readonly CONNECTION_WATCHDOG_INTERVAL_MS = 1_000;
  private static readonly CONNECT_TIMEOUT_MS = 10_000;
  private static readonly WELCOME_TIMEOUT_MS = 8_000;
  private static readonly SNAPSHOT_STREAM_TIMEOUT_MS = 8_000;
  private static readonly STALE_SNAPSHOT_STREAM_RECOVERY_MS = 2_400;
  private static readonly INPUT_BACKPRESSURE_BYTES = 16 * 1024;
  private static readonly HIGH_BACKPRESSURE_BYTES = RealtimeClient.INPUT_BACKPRESSURE_BYTES;
  private static readonly CRITICAL_BACKPRESSURE_BYTES = 64 * 1024;
  private static readonly HIGH_BACKPRESSURE_RECOVERY_MS = 3_000;

  constructor(private readonly url: string) {
    document.addEventListener("visibilitychange", this.visibilityListener);
  }

  connect(name: string, classId: CharacterClass, characterId?: string, token?: string, race?: CharacterRace, face?: number, customHeadUrl?: string, profile?: ClientPerformanceProfile): void {
    this.manuallyClosed = false;
    this.reconnectOnVisible = false;
    if (this.reconnectTimer !== undefined) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    if (this.resumeReconnectTimer !== undefined) {
      window.clearTimeout(this.resumeReconnectTimer);
      this.resumeReconnectTimer = undefined;
    }
    this.stopConnectionWatchdog();
    this.resetSnapshotStreamState();
    this.joined = { name, classId, characterId, token, race, face, customHeadUrl, profile };
    const socket = new WebSocket(this.url);
    this.socket = socket;
    this.connectionStartedAt = performance.now();
    this.startConnectionWatchdog(socket);

    socket.addEventListener("open", () => {
      if (this.socket !== socket) {
        return;
      }
      this.socketOpenedAt = performance.now();
      this.send({
        type: "join",
        payload: {
          name,
          classId,
          characterId,
          token,
          race,
          face,
          customHeadUrl,
          profile
        }
      });
    });

    socket.addEventListener("message", (event) => {
      if (this.socket !== socket) {
        return;
      }
      this.handleMessage(event.data.toString());
    });
    socket.addEventListener("close", (event) => {
      if (this.socket !== socket) {
        return;
      }
      this.handleClose(event);
    });
    socket.addEventListener("error", () => {
      if (this.socket !== socket) {
        return;
      }
      this.emit("error", {
        code: "connection_failed",
        message: "Realtime connection failed."
      });
    });
  }

  close(): void {
    this.manuallyClosed = true;
    this.reconnectOnVisible = false;
    this.joined = undefined;
    if (this.reconnectTimer !== undefined) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    if (this.backgroundCloseTimer !== undefined) {
      window.clearTimeout(this.backgroundCloseTimer);
      this.backgroundCloseTimer = undefined;
    }
    if (this.resumeReconnectTimer !== undefined) {
      window.clearTimeout(this.resumeReconnectTimer);
      this.resumeReconnectTimer = undefined;
    }
    this.stopConnectionWatchdog();
    this.resetSnapshotStreamState();
    document.removeEventListener("visibilitychange", this.visibilityListener);
    this.socket?.close();
  }

  input(payload: PlayerInput): void {
    this.send({ type: "input", payload });
  }

  attack(payload: AttackCommand): void {
    this.send({ type: "attack", payload });
  }

  skill(payload: SkillCommand): void {
    this.send({ type: "skill", payload });
  }

  sing(active: boolean): void {
    this.send({ type: "sing", payload: { active } });
  }

  voicePresence(active: boolean, channel: VoiceChannel): void {
    this.send({ type: "voicePresence", payload: { active, channel } });
  }

  voiceSignal(toPlayerId: string, channel: VoiceChannel, signal: VoiceSignal): void {
    this.send({ type: "voiceSignal", payload: { toPlayerId, channel, signal } });
  }

  renameCharacter(name: string): void {
    this.send({ type: "renameCharacter", payload: { name } });
  }

  updateCustomHead(customHeadUrl?: string): void {
    if (this.joined) {
      this.joined.customHeadUrl = customHeadUrl;
    }
    this.send({ type: "customHead", payload: { customHeadUrl } });
  }

  claimReward(walletAddress?: string): void {
    this.send({ type: "claimReward", payload: { walletAddress } });
  }

  claimStoryQuestReward(questId: string): void {
    this.send({ type: "claimStoryQuestReward", payload: { questId } });
  }

  chat(text: string, channel: Exclude<ChatChannel, "system"> = "local"): void {
    this.send({ type: "chat", payload: { text, channel } });
  }

  feedbackReport(text: string, context?: string): void {
    this.send({ type: "feedbackReport", payload: { text, context } });
  }

  updateProfile(profile: ClientPerformanceProfile): void {
    if (this.joined) {
      this.joined = { ...this.joined, profile };
    }
    this.send({ type: "profileUpdate", payload: { profile } });
  }

  requestAdminState(): void {
    this.send({ type: "adminRequest", payload: {} });
  }

  adminAction(action: AdminActionType, targetId: string, durationMs?: number): void {
    this.send({ type: "adminAction", payload: { action, targetId, durationMs } });
  }

  teleport(teleportId: TeleportId): void {
    this.send({ type: "teleport", payload: { teleportId } });
  }

  enterDungeon(landmarkId: string): void {
    this.send({ type: "dungeonTravel", payload: { mode: "enter", landmarkId } });
  }

  exitDungeon(dungeonId: string, exit: "start" | "end"): void {
    this.send({ type: "dungeonTravel", payload: { mode: "exit", dungeonId, exit } });
  }

  equipItem(itemId: string, slot?: EquipmentSlot): void {
    this.send({ type: "equipItem", payload: { itemId, slot } });
  }

  unequipItem(slot: EquipmentSlot): void {
    this.send({ type: "unequipItem", payload: { slot } });
  }

  useItem(itemId: string): void {
    this.send({ type: "useItem", payload: { itemId } });
  }

  sellItem(itemId: string): void {
    this.send({ type: "sellItem", payload: { itemId } });
  }

  openResource(resourceId: string): void {
    this.send({ type: "openResource", payload: { resourceId } });
  }

  pickupGroundItem(itemId: string): void {
    this.send({ type: "pickupGroundItem", payload: { itemId } });
  }

  enchantItem(itemId: string, slot?: EquipmentSlot): void {
    this.send({ type: "enchantItem", payload: { itemId, slot } });
  }

  buyShopItem(itemId: string): void {
    this.send({ type: "buyShopItem", payload: { itemId } });
  }

  marketListItem(inventoryIndex: number, quantity: number, priceGold: number): void {
    this.send({ type: "marketListItem", payload: { inventoryIndex, quantity, priceGold } });
  }

  marketCancelListing(listingId?: string): void {
    this.send({ type: "marketCancelListing", payload: { listingId } });
  }

  buyMarketItem(sellerId: string, listingId: string): void {
    this.send({ type: "buyMarketItem", payload: { sellerId, listingId } });
  }

  respawn(): void {
    this.send({ type: "respawn", payload: { mode: "lastSafe" } });
  }

  revive(targetId: string): void {
    this.send({ type: "revive", payload: { targetId } });
  }

  partyInvite(targetId: string): void {
    this.send({ type: "partyInvite", payload: { targetId } });
  }

  partyAccept(fromId: string): void {
    this.send({ type: "partyAccept", payload: { fromId } });
  }

  partyDecline(fromId: string): void {
    this.send({ type: "partyDecline", payload: { fromId } });
  }

  duelInvite(targetId: string): void {
    this.send({ type: "duelInvite", payload: { targetId } });
  }

  duelAccept(fromId: string): void {
    this.send({ type: "duelAccept", payload: { fromId } });
  }

  duelDecline(fromId: string): void {
    this.send({ type: "duelDecline", payload: { fromId } });
  }

  tradeInvite(targetId: string): void {
    this.send({ type: "tradeInvite", payload: { targetId } });
  }

  tradeAccept(fromId: string): void {
    this.send({ type: "tradeAccept", payload: { fromId } });
  }

  tradeDecline(fromId: string): void {
    this.send({ type: "tradeDecline", payload: { fromId } });
  }

  tradeCancel(): void {
    this.send({ type: "tradeCancel", payload: {} });
  }

  tradeOfferGold(gold: number): void {
    this.send({ type: "tradeOfferGold", payload: { gold } });
  }

  tradeOfferItem(inventoryIndex: number, quantity: number): void {
    this.send({ type: "tradeOfferItem", payload: { inventoryIndex, quantity } });
  }

  tradeRemoveItem(tradeItemId: string): void {
    this.send({ type: "tradeRemoveItem", payload: { tradeItemId } });
  }

  tradeReady(ready: boolean): void {
    this.send({ type: "tradeReady", payload: { ready } });
  }

  clanCreate(name: string, emblem: ClanEmblem): void {
    this.send({ type: "clanCreate", payload: { name, emblem } });
  }

  clanInvite(targetId: string): void {
    this.send({ type: "clanInvite", payload: { targetId } });
  }

  clanAccept(fromId: string, clanId: string): void {
    this.send({ type: "clanAccept", payload: { fromId, clanId } });
  }

  clanDecline(fromId: string, clanId: string): void {
    this.send({ type: "clanDecline", payload: { fromId, clanId } });
  }

  clanKick(characterId: string): void {
    this.send({ type: "clanKick", payload: { characterId } });
  }

  clanLeave(): void {
    this.send({ type: "clanLeave", payload: {} });
  }

  on<K extends keyof RealtimeEvents>(event: K, listener: Listener<RealtimeEvents[K]>): () => void {
    const listeners = this.listeners.get(event) ?? new Set();
    listeners.add(listener as Listener<never>);
    this.listeners.set(event, listeners);
    return () => listeners.delete(listener as Listener<never>);
  }

  private send(message: ClientMessage): void {
    const socket = this.socket;
    if (socket?.readyState === WebSocket.OPEN) {
      if (message.type === "input" && socket.bufferedAmount > RealtimeClient.INPUT_BACKPRESSURE_BYTES) {
        return;
      }
      socket.send(JSON.stringify(message));
    }
  }

  private handleMessage(raw: string): void {
    if (this.shouldDropRawSnapshot(raw)) {
      return;
    }

    let message: ServerMessage;
    try {
      message = JSON.parse(raw) as ServerMessage;
    } catch {
      this.emit("error", {
        code: "bad_json",
        message: "Server sent invalid JSON."
      });
      return;
    }
    if (message.type === "welcome") {
      this.welcomeReceived = true;
      this.lastSnapshotServerTime = message.payload.snapshot.serverTime;
      this.markSnapshotStreamHealthy(message.payload.snapshot);
      this.emit("welcome", message);
      return;
    }
    if (message.type === "snapshot") {
      this.queueSnapshot(message.payload);
      return;
    }
    if (message.type === "inventory") {
      this.emit("inventory", message.payload);
      return;
    }
    if (message.type === "rewardClaimed") {
      this.emit("claim", message);
      return;
    }
    if (message.type === "chat") {
      if (this.shouldDropChat(message.payload)) {
        return;
      }
      this.emit("chat", message.payload);
      return;
    }
    if (message.type === "voicePeers") {
      this.emit("voicePeers", message.payload);
      return;
    }
    if (message.type === "voiceSignal") {
      this.emit("voiceSignal", message.payload);
      return;
    }
    if (message.type === "adminState") {
      this.emit("adminState", message.payload);
      return;
    }
    if (message.type === "feedbackSaved") {
      this.emit("feedbackSaved", message.payload);
      return;
    }
    if (message.type === "error") {
      this.emit("error", message.payload);
      if (message.payload.code === "session_replaced" || message.payload.code === "admin_kicked" || message.payload.code === "admin_banned" || message.payload.code === "banned") {
        this.manuallyClosed = true;
        this.joined = undefined;
        this.socket?.close();
      }
    }
  }

  private queueSnapshot(snapshot: GameSnapshot): void {
    if (pageHidden()) {
      this.pendingSnapshot = undefined;
      return;
    }
    if (snapshot.serverTime <= this.lastSnapshotServerTime) {
      return;
    }

    const queuedAgeMs = this.estimatedQueuedSnapshotAgeMs(snapshot);
    if (performance.now() < this.resumeDropUntilMs && queuedAgeMs > 260) {
      return;
    }
    if (this.lastSnapshotServerTime > 0 && queuedAgeMs > RealtimeClient.MAX_QUEUED_SNAPSHOT_AGE_MS) {
      const now = performance.now();
      this.staleSnapshotStreamStartedAt ??= now;
      if (now - this.staleSnapshotStreamStartedAt >= RealtimeClient.STALE_SNAPSHOT_STREAM_RECOVERY_MS) {
        this.recoverConnection("stale snapshot stream");
      }
      return;
    }

    this.markSnapshotStreamHealthy(snapshot);
    this.pendingSnapshot = snapshot;

    if (previewForceVisible) {
      // Hidden preview tabs throttle requestAnimationFrame, so emit snapshots directly.
      this.pendingSnapshot = undefined;
      this.lastSnapshotServerTime = snapshot.serverTime;
      this.emit("snapshot", snapshot);
      return;
    }

    if (this.snapshotFrame !== undefined) {
      return;
    }

    this.snapshotFrame = window.requestAnimationFrame(() => {
      this.snapshotFrame = undefined;
      const nextSnapshot = this.pendingSnapshot;
      this.pendingSnapshot = undefined;
      if (!nextSnapshot || nextSnapshot.serverTime <= this.lastSnapshotServerTime) {
        return;
      }

      this.lastSnapshotServerTime = nextSnapshot.serverTime;
      this.emit("snapshot", nextSnapshot);
    });
  }

  private estimatedQueuedSnapshotAgeMs(snapshot: GameSnapshot): number {
    const observedOffset = Date.now() - snapshot.serverTime;
    if (!Number.isFinite(observedOffset)) {
      return 0;
    }

    if (this.serverClockOffsetMs === undefined || observedOffset < this.serverClockOffsetMs) {
      this.serverClockOffsetMs = observedOffset;
    }

    return Math.max(0, observedOffset - this.serverClockOffsetMs);
  }

  private shouldDropChat(message: ChatMessage): boolean {
    if (pageHidden()) {
      return true;
    }
    if (message.channel === "system" && !this.isLootSystemChat(message)) {
      return true;
    }

    const ageMs = Date.now() - message.at;
    if (!Number.isFinite(ageMs)) {
      return false;
    }
    if (ageMs > RealtimeClient.MAX_STALE_CHAT_AGE_MS) {
      return true;
    }
    return performance.now() < this.resumeDropUntilMs && ageMs > RealtimeClient.RESUME_STALE_CHAT_AGE_MS;
  }

  private isLootSystemChat(message: ChatMessage): boolean {
    return message.channel === "system" && /\b(picked up|dropped|opened a chest|gathered|found|reward|sold|bought|exchanged|enchanted|reached level)\b/i.test(message.text);
  }

  private shouldDropRawSnapshot(raw: string): boolean {
    if (!raw.includes('"type":"snapshot"')) {
      return false;
    }
    return pageHidden() || performance.now() < this.rawSnapshotDropUntilMs;
  }

  private handleVisibilityChange(): void {
    if (pageHidden()) {
      this.hiddenAt = performance.now();
      this.pendingSnapshot = undefined;
      if (this.snapshotFrame !== undefined) {
        window.cancelAnimationFrame(this.snapshotFrame);
        this.snapshotFrame = undefined;
      }
      if (this.backgroundCloseTimer !== undefined) {
        window.clearTimeout(this.backgroundCloseTimer);
      }
      this.backgroundCloseTimer = window.setTimeout(() => {
        this.backgroundCloseTimer = undefined;
        if (!pageHidden() || this.manuallyClosed || !this.joined) {
          return;
        }

        const state = this.socket?.readyState;
        if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) {
          this.reconnectOnVisible = true;
          this.socket?.close(4003, "background pause");
        } else {
          this.reconnectOnVisible = true;
        }
      }, RealtimeClient.BACKGROUND_SOCKET_PAUSE_MS);
      return;
    }

    const hiddenForMs = this.hiddenAt ? performance.now() - this.hiddenAt : 0;
    this.hiddenAt = undefined;
    if (this.backgroundCloseTimer !== undefined) {
      window.clearTimeout(this.backgroundCloseTimer);
      this.backgroundCloseTimer = undefined;
    }
    this.pendingSnapshot = undefined;
    this.serverClockOffsetMs = undefined;
    this.lastSnapshotServerTime = 0;
    this.staleSnapshotStreamStartedAt = undefined;
    this.highBufferedAmountStartedAt = undefined;
    this.lastAcceptedSnapshotAt = performance.now();
    this.rawSnapshotDropUntilMs = performance.now() + (hiddenForMs > 30_000 ? 90 : 45);
    this.resumeDropUntilMs = performance.now() + (hiddenForMs > 30_000 ? 240 : 120);
    if (this.reconnectOnVisible) {
      this.reconnectOnVisible = false;
      this.scheduleResumeReconnect();
    }
  }

  private handleClose(event: CloseEvent): void {
    this.stopConnectionWatchdog();
    if (this.manuallyClosed) {
      return;
    }

    if (event.code === 4000 || event.code === 4001 || event.code === 4002 || event.reason === "session replaced" || event.reason === "admin kick" || event.reason === "admin ban" || event.reason === "banned") {
      this.manuallyClosed = true;
      this.joined = undefined;
      this.emit("error", {
        code: event.code === 4001 ? "admin_kicked" : event.code === 4002 ? "admin_banned" : "session_replaced",
        message: event.code === 4001 ? "Вы отключены администратором." : event.code === 4002 ? "Персонаж заблокирован администратором." : "В ваш аккаунт вошли в другом окне. Этот клиент отключен."
      });
      return;
    }

    if (this.reconnectOnVisible || pageHidden()) {
      this.reconnectOnVisible = true;
      return;
    }

    this.scheduleReconnect();
  }

  private scheduleResumeReconnect(): void {
    if (this.resumeReconnectTimer !== undefined) {
      window.clearTimeout(this.resumeReconnectTimer);
    }
    this.resumeReconnectTimer = window.setTimeout(() => {
      this.resumeReconnectTimer = undefined;
      this.reconnectNow();
    }, RealtimeClient.RESUME_RECONNECT_DELAY_MS);
  }

  private reconnectNow(): void {
    if (this.manuallyClosed || !this.joined) {
      return;
    }

    const state = this.socket?.readyState;
    if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) {
      return;
    }

    this.connect(this.joined.name, this.joined.classId, this.joined.characterId, this.joined.token, this.joined.race, this.joined.face, this.joined.customHeadUrl, this.joined.profile);
  }

  private scheduleReconnect(): void {
    if (this.manuallyClosed || !this.joined) {
      return;
    }
    if (this.reconnectTimer !== undefined) {
      window.clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = window.setTimeout(() => {
      if (this.joined) {
        this.connect(this.joined.name, this.joined.classId, this.joined.characterId, this.joined.token, this.joined.race, this.joined.face, this.joined.customHeadUrl, this.joined.profile);
      }
    }, 1200);
  }

  private markSnapshotStreamHealthy(snapshot: GameSnapshot): void {
    this.lastAcceptedSnapshotAt = performance.now();
    this.staleSnapshotStreamStartedAt = undefined;
    const observedOffset = Date.now() - snapshot.serverTime;
    if (Number.isFinite(observedOffset) && this.serverClockOffsetMs === undefined) {
      this.serverClockOffsetMs = observedOffset;
    }
  }

  private resetSnapshotStreamState(): void {
    if (this.snapshotFrame !== undefined) {
      window.cancelAnimationFrame(this.snapshotFrame);
      this.snapshotFrame = undefined;
    }
    this.pendingSnapshot = undefined;
    this.lastSnapshotServerTime = 0;
    this.serverClockOffsetMs = undefined;
    this.connectionStartedAt = 0;
    this.socketOpenedAt = 0;
    this.lastAcceptedSnapshotAt = 0;
    this.welcomeReceived = false;
    this.staleSnapshotStreamStartedAt = undefined;
    this.highBufferedAmountStartedAt = undefined;
  }

  private startConnectionWatchdog(socket: WebSocket): void {
    this.connectionWatchdogTimer = window.setInterval(() => {
      if (this.socket !== socket || this.manuallyClosed || !this.joined || pageHidden()) {
        return;
      }

      const now = performance.now();
      if (socket.readyState === WebSocket.CONNECTING) {
        if (now - this.connectionStartedAt >= RealtimeClient.CONNECT_TIMEOUT_MS) {
          this.recoverConnection("connect timeout");
        }
        return;
      }

      if (socket.readyState !== WebSocket.OPEN) {
        this.recoverConnection("closed without event");
        return;
      }

      if (!this.welcomeReceived) {
        if (now - this.socketOpenedAt >= RealtimeClient.WELCOME_TIMEOUT_MS) {
          this.recoverConnection("welcome timeout");
        }
        return;
      }

      if (now - this.lastAcceptedSnapshotAt >= RealtimeClient.SNAPSHOT_STREAM_TIMEOUT_MS) {
        this.recoverConnection("snapshot timeout");
        return;
      }

      if (socket.bufferedAmount >= RealtimeClient.CRITICAL_BACKPRESSURE_BYTES) {
        this.recoverConnection("critical backpressure");
        return;
      }
      if (socket.bufferedAmount >= RealtimeClient.HIGH_BACKPRESSURE_BYTES) {
        this.highBufferedAmountStartedAt ??= now;
        if (now - this.highBufferedAmountStartedAt >= RealtimeClient.HIGH_BACKPRESSURE_RECOVERY_MS) {
          this.recoverConnection("sustained backpressure");
        }
      } else {
        this.highBufferedAmountStartedAt = undefined;
      }
    }, RealtimeClient.CONNECTION_WATCHDOG_INTERVAL_MS);
  }

  private stopConnectionWatchdog(): void {
    if (this.connectionWatchdogTimer !== undefined) {
      window.clearInterval(this.connectionWatchdogTimer);
      this.connectionWatchdogTimer = undefined;
    }
  }

  private recoverConnection(reason: string): void {
    if (this.manuallyClosed || !this.joined || pageHidden()) {
      return;
    }

    const joined = this.joined;
    const staleSocket = this.socket;
    this.socket = undefined;
    this.stopConnectionWatchdog();
    this.resetSnapshotStreamState();
    try {
      staleSocket?.close(4004, reason);
    } catch {
      // A half-open browser socket may reject close; replacing it is still safe.
    }
    this.connect(joined.name, joined.classId, joined.characterId, joined.token, joined.race, joined.face, joined.customHeadUrl, joined.profile);
  }

  private emit<K extends keyof RealtimeEvents>(event: K, payload: RealtimeEvents[K]): void {
    const listeners = this.listeners.get(event);
    if (!listeners) {
      return;
    }

    for (const listener of listeners) {
      listener(payload as never);
    }
  }
}
