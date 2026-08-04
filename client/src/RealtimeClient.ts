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
  DerivedStats,
  EquipmentSlot,
  EquipmentState,
  GameSnapshot,
  InventoryItem,
  PlayerInput,
  ServerMessage,
  SkillCommand,
  TeleportId,
  WalletState
} from "@mmo/shared";

type Listener<T> = (payload: T) => void;
export type RealtimeError = Extract<ServerMessage, { type: "error" }>["payload"];

export interface RealtimeEvents {
  welcome: Extract<ServerMessage, { type: "welcome" }>;
  snapshot: GameSnapshot;
  inventory: { items: InventoryItem[]; equipment: EquipmentState; stats: DerivedStats; gold: number; wallet: WalletState };
  claim: Extract<ServerMessage, { type: "rewardClaimed" }>;
  chat: ChatMessage;
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
  private joined?: { name: string; classId: CharacterClass; characterId?: string; token?: string; race?: CharacterRace; face?: number; customHeadUrl?: string };
  private manuallyClosed = false;

  private static readonly MAX_QUEUED_SNAPSHOT_AGE_MS = 900;

  constructor(private readonly url: string) {}

  connect(name: string, classId: CharacterClass, characterId?: string, token?: string, race?: CharacterRace, face?: number, customHeadUrl?: string): void {
    this.manuallyClosed = false;
    this.joined = { name, classId, characterId, token, race, face, customHeadUrl };
    this.socket = new WebSocket(this.url);

    this.socket.addEventListener("open", () => {
      this.send({
        type: "join",
        payload: {
          name,
          classId,
          characterId,
          token,
          race,
          face,
          customHeadUrl
        }
      });
    });

    this.socket.addEventListener("message", (event) => this.handleMessage(event.data.toString()));
    this.socket.addEventListener("close", (event) => this.handleClose(event));
    this.socket.addEventListener("error", () =>
      this.emit("error", {
        code: "connection_failed",
        message: "Realtime connection failed."
      })
    );
  }

  close(): void {
    this.manuallyClosed = true;
    this.joined = undefined;
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
    }
    if (this.snapshotFrame !== undefined) {
      window.cancelAnimationFrame(this.snapshotFrame);
      this.snapshotFrame = undefined;
      this.pendingSnapshot = undefined;
    }
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

  claimReward(walletAddress?: string): void {
    this.send({ type: "claimReward", payload: { walletAddress } });
  }

  chat(text: string, channel: Exclude<ChatChannel, "system"> = "local"): void {
    this.send({ type: "chat", payload: { text, channel } });
  }

  feedbackReport(text: string, context?: string): void {
    this.send({ type: "feedbackReport", payload: { text, context } });
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
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  private handleMessage(raw: string): void {
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
      this.emit("chat", message.payload);
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
    if (snapshot.serverTime <= this.lastSnapshotServerTime) {
      return;
    }

    const queuedAgeMs = this.estimatedQueuedSnapshotAgeMs(snapshot);
    if (this.lastSnapshotServerTime > 0 && queuedAgeMs > RealtimeClient.MAX_QUEUED_SNAPSHOT_AGE_MS) {
      return;
    }

    this.pendingSnapshot = snapshot;
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

  private handleClose(event: CloseEvent): void {
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

    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.manuallyClosed || !this.joined) {
      return;
    }

    this.reconnectTimer = window.setTimeout(() => {
      if (this.joined) {
        this.connect(this.joined.name, this.joined.classId, this.joined.characterId, this.joined.token, this.joined.race, this.joined.face, this.joined.customHeadUrl);
      }
    }, 1200);
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
