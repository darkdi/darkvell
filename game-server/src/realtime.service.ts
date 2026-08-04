import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { WebSocket, WebSocketServer } from "ws";
import type { ClientMessage, ClientPerformanceProfile, ServerMessage, VoiceChannel, VoicePeer } from "@mmo/shared";
import { MAX_PLAYERS_PER_WORLD } from "@mmo/shared";
import { WorldService } from "./world.service.js";

interface ClientContext {
  socket: WebSocket;
  playerId?: string;
  characterId?: string;
  profile?: ClientPerformanceProfile;
  joinedAt?: number;
  lastSnapshotSentAt?: number;
  lastInventorySentAt?: number;
  voice?: {
    active: boolean;
    channel: VoiceChannel;
    lastPresenceAt: number;
  };
}

interface LowLatencyWebSocket extends WebSocket {
  _socket?: {
    setNoDelay?: (noDelay?: boolean) => void;
    setKeepAlive?: (enable?: boolean, initialDelay?: number) => void;
  };
}

const MOBILE_MAX_AIM_RADIUS = 520;
const WORLD_SNAPSHOT_CAMERA_ZOOM = 0.82;
const VOICE_NEARBY_RANGE = Number(process.env.GAME_VOICE_NEARBY_RANGE ?? 760);

@Injectable()
export class GameRealtimeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GameRealtimeService.name);
  private server?: WebSocketServer;
  private readonly clients = new Map<WebSocket, ClientContext>();
  private readonly characterClients = new Map<string, ClientContext>();
  private broadcastTimer?: NodeJS.Timeout;
  private readonly snapshotIntervalMs = Number(process.env.GAME_SNAPSHOT_MS ?? 25);
  private readonly inventoryPushIntervalMs = Number(process.env.GAME_INVENTORY_PUSH_MS ?? 1800);
  private readonly mobileSnapshotIntervalMs = Number(process.env.GAME_MOBILE_SNAPSHOT_MS ?? 120);
  private readonly mobileLongSessionSnapshotIntervalMs = Number(process.env.GAME_MOBILE_LONG_SNAPSHOT_MS ?? 165);
  private readonly maxBufferedBytes = Number(process.env.GAME_WS_MAX_BUFFERED_BYTES ?? 64 * 1024);
  private readonly wsDeflateEnabled = process.env.GAME_WS_DEFLATE !== "0";
  private readonly wsDeflateThresholdBytes = Number(process.env.GAME_WS_DEFLATE_THRESHOLD_BYTES ?? 1024);
  private readonly snapshotBackpressureBytes = Number(
    process.env.GAME_WS_SNAPSHOT_BACKPRESSURE_BYTES ?? Math.max(16 * 1024, this.maxBufferedBytes / 2)
  );

  constructor(@Inject(WorldService) private readonly world: WorldService) {}

  onModuleInit(): void {
    const port = Number(process.env.GAME_WS_PORT ?? 3101);
    this.server = new WebSocketServer({
      port,
      path: "/ws",
      perMessageDeflate: this.wsDeflateEnabled
        ? {
            clientNoContextTakeover: true,
            serverNoContextTakeover: true,
            threshold: this.wsDeflateThresholdBytes,
            zlibDeflateOptions: {
              level: 3,
              memLevel: 7
            }
          }
        : false
    });

    this.server.on("connection", (socket) => this.handleConnection(socket));
    this.world.start();
    this.broadcastTimer = setInterval(() => this.broadcastSnapshot(), this.snapshotIntervalMs);

    this.logger.log(`game websocket listening on :${port}/ws`);
  }

  onModuleDestroy(): void {
    if (this.broadcastTimer) {
      clearInterval(this.broadcastTimer);
    }

    for (const client of this.clients.keys()) {
      client.close(1001, "server shutting down");
    }

    this.server?.close();
    this.world.stop();
  }

  private handleConnection(socket: WebSocket): void {
    this.configureSocket(socket);

    if (this.clients.size >= MAX_PLAYERS_PER_WORLD) {
      this.send(socket, {
        type: "error",
        payload: {
          code: "world_full",
          message: `World is limited to ${MAX_PLAYERS_PER_WORLD} players in this slice.`
        }
      });
      socket.close(1008, "world full");
      return;
    }

    const context: ClientContext = { socket };
    this.clients.set(socket, context);

    socket.on("message", (raw) => this.handleMessage(context, raw.toString()));
    socket.on("close", () => {
      this.notifyVoiceLeave(context);
      if (context.characterId && this.characterClients.get(context.characterId) === context) {
        this.characterClients.delete(context.characterId);
      }
      if (context.playerId) {
        this.world.leave(context.playerId);
      }
      this.clients.delete(socket);
    });
  }

  private configureSocket(socket: WebSocket): void {
    const tcpSocket = (socket as LowLatencyWebSocket)._socket;
    tcpSocket?.setNoDelay?.(true);
    tcpSocket?.setKeepAlive?.(true, 30_000);
  }

  private handleMessage(context: ClientContext, raw: string): void {
    let message: ClientMessage;
    try {
      message = JSON.parse(raw) as ClientMessage;
    } catch {
      this.send(context.socket, {
        type: "error",
        payload: { code: "bad_json", message: "Message must be valid JSON." }
      });
      return;
    }

    if (message.type === "join") {
      const joinCheck = this.world.canJoin(message.payload.name, message.payload.characterId);
      if (!joinCheck.ok) {
        this.send(context.socket, {
          type: "error",
          payload: { code: "banned", message: joinCheck.message ?? "Character is banned." }
        });
        context.socket.close(4002, "banned");
        return;
      }
      if (message.payload.characterId) {
        this.kickCharacterSession(message.payload.characterId, context);
      }
      if (context.playerId) {
        this.world.leave(context.playerId);
        context.playerId = undefined;
      }
      if (context.characterId && this.characterClients.get(context.characterId) === context) {
        this.characterClients.delete(context.characterId);
        context.characterId = undefined;
      }

      const joined = this.world.join(
        message.payload.name,
        message.payload.classId,
        message.payload.token,
        message.payload.characterId,
        message.payload.race,
        message.payload.face,
        message.payload.customHeadUrl
      );
      this.kickCharacterSession(joined.characterId, context);
      context.playerId = joined.playerId;
      context.characterId = joined.characterId;
      context.profile = message.payload.profile;
      context.joinedAt = Date.now();
      context.lastSnapshotSentAt = undefined;
      this.characterClients.set(joined.characterId, context);
      this.send(context.socket, {
        type: "welcome",
        payload: joined
      });
      for (const chatMessage of this.world.chatHistory()) {
        if (this.world.canReceiveChat(joined.playerId, chatMessage)) {
          this.send(context.socket, {
            type: "chat",
            payload: chatMessage
          });
        }
      }
      return;
    }

    if (message.type === "profileUpdate") {
      context.profile = message.payload.profile;
      context.lastSnapshotSentAt = undefined;
      return;
    }

    if (!context.playerId) {
      this.send(context.socket, {
        type: "error",
        payload: { code: "not_joined", message: "Join before sending game commands." }
      });
      return;
    }

    if (message.type === "adminRequest") {
      this.sendAdminState(context);
      return;
    }

    if (message.type === "adminAction") {
      const result = this.world.adminAction(context.playerId, message.payload.action, message.payload.targetId, message.payload.durationMs);
      if (result.kickedPlayerId) {
        this.closePlayerSession(result.kickedPlayerId, result.closeCode ?? 4001, result.closeReason ?? "admin action", result.closeErrorCode ?? "admin_action", result.closeMessage ?? "Disconnected by admin.");
      }
      this.sendAdminState(context, result.state?.message);
      return;
    }

    if (message.type === "input") {
      this.world.applyInput(context.playerId, message.payload);
      return;
    }

    if (message.type === "attack") {
      this.world.attack(context.playerId, message.payload);
      return;
    }

    if (message.type === "skill") {
      this.world.skill(context.playerId, message.payload);
      return;
    }

    if (message.type === "sing") {
      this.world.setSinging(context.playerId, message.payload.active);
      return;
    }

    if (message.type === "voicePresence") {
      this.handleVoicePresence(context, message.payload.active, message.payload.channel);
      return;
    }

    if (message.type === "voiceSignal") {
      this.handleVoiceSignal(context, message.payload.toPlayerId, message.payload.channel, message.payload.signal);
      return;
    }

    if (message.type === "renameCharacter") {
      this.world.renameCharacter(context.playerId, message.payload.name);
      return;
    }

    if (message.type === "customHead") {
      this.world.updateCustomHead(context.playerId, message.payload.customHeadUrl);
      context.lastSnapshotSentAt = undefined;
      return;
    }

    if (message.type === "claimReward") {
      const claim = this.world.claimReward(context.playerId, message.payload.walletAddress);
      this.send(context.socket, {
        type: "rewardClaimed",
        payload: claim
      });
      this.sendInventory(context);
      return;
    }

    if (message.type === "claimStoryQuestReward") {
      this.world.claimStoryQuestReward(context.playerId, message.payload.questId);
      this.sendInventory(context);
      return;
    }

    if (message.type === "equipItem") {
      this.world.equipItem(context.playerId, message.payload.itemId, message.payload.slot);
      this.sendInventory(context);
      return;
    }

    if (message.type === "unequipItem") {
      this.world.unequipItem(context.playerId, message.payload.slot);
      this.sendInventory(context);
      return;
    }

    if (message.type === "useItem") {
      this.world.useItem(context.playerId, message.payload.itemId);
      this.sendInventory(context);
      return;
    }

    if (message.type === "sellItem") {
      this.world.sellInventoryItem(context.playerId, message.payload.itemId);
      this.sendInventory(context);
      return;
    }

    if (message.type === "openResource") {
      this.world.openResource(context.playerId, message.payload.resourceId);
      this.sendInventory(context);
      return;
    }

    if (message.type === "pickupGroundItem") {
      this.world.pickupGroundItem(context.playerId, message.payload.itemId);
      this.sendInventory(context);
      return;
    }

    if (message.type === "enchantItem") {
      this.world.enchantItem(context.playerId, message.payload.itemId, message.payload.slot);
      this.sendInventory(context);
      return;
    }

    if (message.type === "buyShopItem") {
      this.world.buyShopItem(context.playerId, message.payload.itemId);
      this.sendInventory(context);
      return;
    }

    if (message.type === "marketListItem") {
      this.world.marketListItem(context.playerId, message.payload.inventoryIndex, message.payload.quantity, message.payload.priceGold);
      this.sendInventory(context);
      return;
    }

    if (message.type === "marketCancelListing") {
      this.world.marketCancelListing(context.playerId, message.payload.listingId);
      this.sendInventory(context);
      return;
    }

    if (message.type === "buyMarketItem") {
      const affectedPlayerIds = this.world.buyMarketItem(context.playerId, message.payload.sellerId, message.payload.listingId);
      this.sendInventoriesForPlayers(affectedPlayerIds.length > 0 ? affectedPlayerIds : [context.playerId]);
      return;
    }

    if (message.type === "respawn") {
      this.world.respawnAtLastSafe(context.playerId);
      this.sendInventory(context);
      return;
    }

    if (message.type === "revive") {
      this.world.revivePlayer(context.playerId, message.payload.targetId);
      return;
    }

    if (message.type === "partyInvite") {
      this.world.partyInvite(context.playerId, message.payload.targetId);
      return;
    }

    if (message.type === "partyAccept") {
      this.world.partyAccept(context.playerId, message.payload.fromId);
      return;
    }

    if (message.type === "partyDecline") {
      this.world.partyDecline(context.playerId, message.payload.fromId);
      return;
    }

    if (message.type === "duelInvite") {
      this.world.duelInvite(context.playerId, message.payload.targetId);
      return;
    }

    if (message.type === "duelAccept") {
      this.world.duelAccept(context.playerId, message.payload.fromId);
      return;
    }

    if (message.type === "duelDecline") {
      this.world.duelDecline(context.playerId, message.payload.fromId);
      return;
    }

    if (message.type === "tradeInvite") {
      this.world.tradeInvite(context.playerId, message.payload.targetId);
      return;
    }

    if (message.type === "tradeAccept") {
      this.world.tradeAccept(context.playerId, message.payload.fromId);
      return;
    }

    if (message.type === "tradeDecline") {
      this.world.tradeDecline(context.playerId, message.payload.fromId);
      return;
    }

    if (message.type === "tradeCancel") {
      this.world.tradeCancel(context.playerId);
      return;
    }

    if (message.type === "tradeOfferGold") {
      this.world.tradeOfferGold(context.playerId, message.payload.gold);
      return;
    }

    if (message.type === "tradeOfferItem") {
      this.world.tradeOfferItem(context.playerId, message.payload.inventoryIndex, message.payload.quantity);
      return;
    }

    if (message.type === "tradeRemoveItem") {
      this.world.tradeRemoveItem(context.playerId, message.payload.tradeItemId);
      return;
    }

    if (message.type === "tradeReady") {
      const affectedPlayerIds = this.world.tradeReady(context.playerId, message.payload.ready);
      this.sendInventoriesForPlayers(affectedPlayerIds);
      return;
    }

    if (message.type === "clanCreate") {
      this.world.createClan(context.playerId, message.payload.name, message.payload.emblem);
      return;
    }

    if (message.type === "clanInvite") {
      this.world.clanInvite(context.playerId, message.payload.targetId);
      return;
    }

    if (message.type === "clanAccept") {
      this.world.clanAccept(context.playerId, message.payload.fromId, message.payload.clanId);
      return;
    }

    if (message.type === "clanDecline") {
      this.world.clanDecline(context.playerId, message.payload.fromId, message.payload.clanId);
      return;
    }

    if (message.type === "clanKick") {
      this.world.clanKick(context.playerId, message.payload.characterId);
      return;
    }

    if (message.type === "clanLeave") {
      this.world.clanLeave(context.playerId);
      return;
    }

    if (message.type === "chat") {
      const chatMessage = this.world.chat(context.playerId, message.payload.text, message.payload.channel ?? "local");
      if (chatMessage) {
        this.broadcastChat({
          type: "chat",
          payload: chatMessage
        });
      }
      return;
    }

    if (message.type === "feedbackReport") {
      const report = this.world.reportFeedback(context.playerId, message.payload.text, message.payload.context);
      this.send(context.socket, {
        type: "feedbackSaved",
        payload: {
          ok: Boolean(report),
          message: report ? "Report saved. Admins can read it in-game." : "Report was too short or could not be saved.",
          report
        }
      });
      return;
    }

    if (message.type === "teleport") {
      this.world.teleport(context.playerId, message.payload.teleportId);
      return;
    }

    if (message.type === "dungeonTravel") {
      if (message.payload.mode === "enter") {
        this.world.enterDungeon(context.playerId, message.payload.landmarkId);
      } else {
        this.world.exitDungeon(context.playerId, message.payload.dungeonId, message.payload.exit);
      }
      return;
    }
  }

  private handleVoicePresence(context: ClientContext, active: boolean, channel: VoiceChannel): void {
    if (!context.playerId) {
      return;
    }

    if (channel !== "nearby" && channel !== "party") {
      this.send(context.socket, {
        type: "error",
        payload: { code: "voice_bad_channel", message: "Unknown voice channel." }
      });
      return;
    }

    if (!active) {
      this.notifyVoiceLeave(context);
      context.voice = {
        active: false,
        channel,
        lastPresenceAt: Date.now()
      };
      this.send(context.socket, {
        type: "voicePeers",
        payload: {
          active: false,
          channel,
          peers: []
        }
      });
      return;
    }

    const peers = this.onlineVoicePeers(context.playerId, channel);
    if (channel === "party" && peers.length === 0) {
      this.send(context.socket, {
        type: "error",
        payload: { code: "voice_no_party", message: "Party voice needs at least one online party member." }
      });
    }

    context.voice = {
      active: true,
      channel,
      lastPresenceAt: Date.now()
    };
    this.send(context.socket, {
      type: "voicePeers",
      payload: {
        active: true,
        channel,
        peers
      }
    });
  }

  private handleVoiceSignal(
    context: ClientContext,
    toPlayerId: string,
    channel: VoiceChannel,
    signal: Extract<ClientMessage, { type: "voiceSignal" }>["payload"]["signal"]
  ): void {
    if (!context.playerId || !toPlayerId || context.playerId === toPlayerId) {
      return;
    }
    if (channel !== "nearby" && channel !== "party") {
      return;
    }
    if (!this.world.canUseVoiceChannel(context.playerId, toPlayerId, channel, VOICE_NEARBY_RANGE)) {
      return;
    }

    const target = this.clientForPlayer(toPlayerId);
    if (!target || target.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    this.send(target.socket, {
      type: "voiceSignal",
      payload: {
        fromPlayerId: context.playerId,
        fromName: this.world.voicePlayerName(context.playerId) ?? "Player",
        channel,
        signal
      }
    });
  }

  private notifyVoiceLeave(context: ClientContext): void {
    if (!context.playerId || !context.voice?.active) {
      return;
    }

    const channel = context.voice.channel;
    for (const peer of this.onlineVoicePeers(context.playerId, channel)) {
      const target = this.clientForPlayer(peer.playerId);
      if (!target) {
        continue;
      }
      this.send(target.socket, {
        type: "voiceSignal",
        payload: {
          fromPlayerId: context.playerId,
          fromName: this.world.voicePlayerName(context.playerId) ?? "Player",
          channel,
          signal: { kind: "leave" }
        }
      });
    }
    context.voice.active = false;
  }

  private onlineVoicePeers(playerId: string, channel: VoiceChannel): VoicePeer[] {
    return this.world.voicePeers(playerId, channel, VOICE_NEARBY_RANGE).filter((peer) => Boolean(this.clientForPlayer(peer.playerId)));
  }

  private clientForPlayer(playerId: string): ClientContext | undefined {
    return [...this.clients.values()].find((client) => client.playerId === playerId && client.socket.readyState === WebSocket.OPEN);
  }

  private kickCharacterSession(characterId: string, except?: ClientContext): void {
    const existing = this.characterClients.get(characterId);
    if (!existing || existing === except) {
      return;
    }

    this.send(existing.socket, {
      type: "error",
      payload: {
        code: "session_replaced",
        message: "В ваш аккаунт вошли в другом окне. Этот клиент отключен."
      }
    });
    this.characterClients.delete(characterId);
    if (existing.playerId) {
      this.notifyVoiceLeave(existing);
      this.world.leave(existing.playerId);
      existing.playerId = undefined;
    }
    existing.characterId = undefined;
    existing.socket.close(4000, "session replaced");
  }

  private closePlayerSession(playerId: string, code: number, reason: string, errorCode: string, errorMessage: string): void {
    const target = [...this.clients.values()].find((client) => client.playerId === playerId);
    if (!target) {
      return;
    }

    this.send(target.socket, {
      type: "error",
      payload: {
        code: errorCode,
        message: errorMessage
      }
    });
    if (target.characterId && this.characterClients.get(target.characterId) === target) {
      this.characterClients.delete(target.characterId);
    }
    this.notifyVoiceLeave(target);
    this.world.leave(playerId);
    target.playerId = undefined;
    target.characterId = undefined;
    target.socket.close(code, reason);
  }

  private sendAdminState(context: ClientContext, message?: string): void {
    if (!context.playerId) {
      return;
    }

    const state = this.world.adminState(context.playerId, message);
    if (!state) {
      this.send(context.socket, {
        type: "error",
        payload: {
          code: "not_admin",
          message: "Admin access denied."
        }
      });
      return;
    }

    this.send(context.socket, {
      type: "adminState",
      payload: state
    });
  }

  private broadcastSnapshot(): void {
    const now = Date.now();
    for (const chatMessage of this.world.drainBroadcastChats()) {
      this.broadcastChat({
        type: "chat",
        payload: chatMessage
      });
    }

    for (const [socket, context] of this.clients.entries()) {
      if (socket.readyState !== WebSocket.OPEN || !context.playerId) {
        continue;
      }
      if (socket.bufferedAmount > this.snapshotBackpressureBytes) {
        continue;
      }
      if (this.isMobileClient(context) && now - (context.lastSnapshotSentAt ?? 0) < this.mobileSnapshotInterval(context, now)) {
        continue;
      }
      if (!this.isMobileClient(context) && now - (context.lastSnapshotSentAt ?? 0) < this.desktopSnapshotInterval(context)) {
        continue;
      }

      this.send(socket, {
        type: "snapshot",
        payload: this.world.snapshot(context.playerId, this.snapshotOptions(context))
      });
      context.lastSnapshotSentAt = now;
      if (now - (context.lastInventorySentAt ?? 0) >= this.inventoryPushIntervalMs && socket.bufferedAmount <= this.maxBufferedBytes) {
        this.sendInventory(context);
        context.lastInventorySentAt = now;
      }
    }
  }

  private isMobileClient(context: ClientContext): boolean {
    return Boolean(context.profile?.mobile || context.profile?.lowPower);
  }

  private snapshotOptions(context: ClientContext): Parameters<WorldService["snapshot"]>[1] {
    if (!this.isMobileClient(context)) {
      return this.desktopSnapshotOptions(context);
    }
    const sessionMs = Date.now() - (context.joinedAt ?? Date.now());
    const longSession = sessionMs >= 120_000;
    const preset = context.profile?.graphicsPreset ?? "balanced";
    const desktopMobile = preset === "desktop";
    const smooth = preset === "smooth" || desktopMobile;
    const cool = preset === "cool" || preset === "minimal" || Boolean(context.profile?.lowPower);
    const minimal = preset === "minimal" || (context.profile?.fpsLimit ?? 60) <= 30;
    const combatEffects = context.profile?.combatEffects !== false;
    const viewportRadius = this.mobileViewportWorldRadius(context.profile);
    const playerRadius = Math.ceil(Math.min(smooth ? 1900 : cool ? 1700 : 1800, Math.max(MOBILE_MAX_AIM_RADIUS + 720, viewportRadius + (minimal ? 260 : 360))));
    const monsterRadius = Math.ceil(Math.min(smooth ? 1600 : 1450, Math.max(880, viewportRadius + (minimal ? 120 : 180))));
    const eventRadius = Math.ceil(Math.min(smooth ? 1700 : cool ? 1500 : 1600, Math.max(900, viewportRadius + (minimal ? 120 : 220))));

    return {
      mobile: true,
      playerRadius,
      monsterRadius,
      resourceRadius: minimal ? 480 : cool ? (longSession ? 540 : 620) : longSession ? 660 : 760,
      groundItemRadius: minimal ? 520 : cool ? (longSession ? 580 : 680) : longSession ? 740 : 820,
      eventRadius,
      eventLimit: !combatEffects ? 2 : minimal ? 3 : cool ? (longSession ? 4 : 5) : longSession ? 5 : 7,
      includeSocialDistantPlayers: false,
      maxPlayers: minimal ? 40 : smooth ? (longSession ? 52 : 58) : cool ? (longSession ? 44 : 52) : longSession ? 48 : 56,
      maxMonsters: minimal ? 10 : cool ? (longSession ? 12 : 14) : longSession ? 14 : 17,
      maxResources: minimal ? 3 : cool ? (longSession ? 4 : 6) : longSession ? 6 : 10,
      maxGroundItems: minimal ? 4 : cool ? (longSession ? 4 : 6) : longSession ? 6 : 10
    };
  }

  private desktopSnapshotOptions(context: ClientContext): Parameters<WorldService["snapshot"]>[1] {
    if (!context.profile) {
      return undefined;
    }

    const requestedRange = context.profile.worldRange ?? "wide";
    const range = requestedRange === "widePlus" ? "widePlus" : "wide";
    const combatEffects = context.profile.combatEffects !== false;
    const viewportRadius = this.desktopViewportWorldRadius(context.profile);
    const widePlus = range === "widePlus";
    const rangeExtra = widePlus ? 620 : 480;
    const playerRadius = Math.ceil(Math.min(widePlus ? 2200 : 1950, Math.max(1250, viewportRadius + rangeExtra)));
    const monsterRadius = Math.ceil(Math.min(widePlus ? 1700 : 1500, Math.max(900, viewportRadius + Math.round(rangeExtra * 0.58))));
    const eventRadius = Math.ceil(Math.min(widePlus ? 1800 : 1600, Math.max(960, viewportRadius + Math.round(rangeExtra * 0.64))));

    return {
      playerRadius,
      monsterRadius,
      resourceRadius: widePlus ? 980 : 820,
      groundItemRadius: widePlus ? 1_050 : 900,
      eventRadius,
      eventLimit: combatEffects ? (widePlus ? 7 : 6) : 2,
      includeSocialDistantPlayers: false,
      maxPlayers: widePlus ? 38 : 32,
      maxMonsters: widePlus ? 18 : 14,
      maxResources: widePlus ? 10 : 7,
      maxGroundItems: widePlus ? 10 : 7
    };
  }

  private desktopSnapshotInterval(context: ClientContext): number {
    const preset = context.profile?.graphicsPreset;
    const widePlus = context.profile?.worldRange === "widePlus" || preset === "desktop" || preset === "full60";
    return widePlus ? 44 : 56;
  }

  private desktopViewportWorldRadius(profile: ClientPerformanceProfile | undefined): number {
    const viewportWidth = this.clampViewportDimension(profile?.viewportWidth, 1440);
    const viewportHeight = this.clampViewportDimension(profile?.viewportHeight, 900);
    return Math.ceil(Math.hypot(viewportWidth / WORLD_SNAPSHOT_CAMERA_ZOOM, viewportHeight / WORLD_SNAPSHOT_CAMERA_ZOOM) / 2);
  }

  private mobileViewportWorldRadius(profile: ClientPerformanceProfile | undefined): number {
    const viewportWidth = this.clampViewportDimension(profile?.viewportWidth, 390);
    const viewportHeight = this.clampViewportDimension(profile?.viewportHeight, 844);
    return Math.ceil(Math.hypot(viewportWidth / WORLD_SNAPSHOT_CAMERA_ZOOM, viewportHeight / WORLD_SNAPSHOT_CAMERA_ZOOM) / 2);
  }

  private clampViewportDimension(value: number | undefined, fallback: number): number {
    if (!Number.isFinite(value) || !value) {
      return fallback;
    }
    return Math.max(280, Math.min(1400, Math.round(value)));
  }

  private mobileSnapshotInterval(context: ClientContext, now: number): number {
    const sessionMs = now - (context.joinedAt ?? now);
    const preset = context.profile?.graphicsPreset;
    const fpsLimit = context.profile?.fpsLimit ?? 60;
    if (preset === "minimal" || fpsLimit <= 30) {
      return sessionMs >= 120_000 ? 280 : 210;
    }
    if (preset === "cool" || fpsLimit <= 45 || context.profile?.lowPower) {
      return sessionMs >= 120_000 ? 240 : 180;
    }
    return sessionMs >= 120_000 ? this.mobileLongSessionSnapshotIntervalMs : this.mobileSnapshotIntervalMs;
  }

  private sendInventoriesForPlayers(playerIds: string[]): void {
    for (const playerId of new Set(playerIds)) {
      const target = this.clientForPlayer(playerId);
      if (target) {
        this.sendInventory(target);
      }
    }
  }

  private sendInventory(context: ClientContext): void {
    if (!context.playerId) {
      return;
    }

    const inventory = this.world.inventory(context.playerId);
    if (!inventory) {
      return;
    }

    this.send(context.socket, {
      type: "inventory",
      payload: inventory
    });
  }

  private send(socket: WebSocket, message: ServerMessage): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }

  private broadcast(message: ServerMessage): void {
    const encoded = JSON.stringify(message);
    for (const socket of this.clients.keys()) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(encoded);
      }
    }
  }

  private broadcastChat(message: Extract<ServerMessage, { type: "chat" }>): void {
    const encoded = JSON.stringify(message);
    for (const [socket, context] of this.clients.entries()) {
      if (!context.playerId || socket.readyState !== WebSocket.OPEN) {
        continue;
      }
      if (this.world.canReceiveChat(context.playerId, message.payload)) {
        socket.send(encoded);
      }
    }
  }
}
