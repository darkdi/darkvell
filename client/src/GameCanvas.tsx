import { useEffect, useRef } from "react";
import Phaser from "phaser";
import type {
  AdminActionType,
  AdminState,
  CharacterClass,
  CharacterRace,
  ChatChannel,
  ChatMessage,
  ClanEmblem,
  DerivedStats,
  EquipmentSlot,
  EquipmentState,
  GameSnapshot,
  InventoryItem,
  ServerMessage,
  TeleportId,
  WalletState
} from "@mmo/shared";
import { RealtimeClient, type RealtimeError } from "./game/RealtimeClient";
import { WorldScene } from "./game/WorldScene";

function gameWebSocketUrl(): string {
  const configuredUrl = import.meta.env.VITE_GAME_WS_URL?.trim();
  if (configuredUrl) {
    return configuredUrl;
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
}

interface Props {
  playerName: string;
  classId: CharacterClass;
  characterId: string;
  token?: string;
  race?: CharacterRace;
  face?: number;
  customHeadUrl?: string;
  walletAddress?: string;
  onPlayerId: (playerId: string) => void;
  onSnapshot: (snapshot: GameSnapshot) => void;
  onInventory: (payload: { items: InventoryItem[]; equipment: EquipmentState; stats: DerivedStats; gold: number; wallet: WalletState }) => void;
  onClaim: (claim: Extract<ServerMessage, { type: "rewardClaimed" }>["payload"]) => void;
  onChat: (message: ChatMessage) => void;
  onAdminState?: (state: AdminState) => void;
  onFeedbackSaved?: (payload: Extract<ServerMessage, { type: "feedbackSaved" }>["payload"]) => void;
  onRealtimeError?: (error: RealtimeError) => void;
}

export function GameCanvas(props: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const walletRef = useRef(props.walletAddress);
  const callbacksRef = useRef({
    onPlayerId: props.onPlayerId,
    onSnapshot: props.onSnapshot,
    onInventory: props.onInventory,
    onClaim: props.onClaim,
    onChat: props.onChat,
    onAdminState: props.onAdminState,
    onFeedbackSaved: props.onFeedbackSaved,
    onRealtimeError: props.onRealtimeError
  });

  useEffect(() => {
    walletRef.current = props.walletAddress;
    callbacksRef.current = {
      onPlayerId: props.onPlayerId,
      onSnapshot: props.onSnapshot,
      onInventory: props.onInventory,
      onClaim: props.onClaim,
      onChat: props.onChat,
      onAdminState: props.onAdminState,
      onFeedbackSaved: props.onFeedbackSaved,
      onRealtimeError: props.onRealtimeError
    };
  }, [props.walletAddress, props.onPlayerId, props.onSnapshot, props.onInventory, props.onClaim, props.onChat, props.onAdminState, props.onFeedbackSaved, props.onRealtimeError]);

  useEffect(() => {
    if (!hostRef.current) {
      return;
    }

    const realtime = new RealtimeClient(gameWebSocketUrl());
    const scene = new WorldScene(realtime, () => walletRef.current);
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: hostRef.current,
      backgroundColor: "#101312",
      scale: {
        mode: Phaser.Scale.RESIZE,
        width: hostRef.current.clientWidth,
        height: hostRef.current.clientHeight
      },
      physics: {
        default: "arcade"
      },
      scene
    });

    let resizeFrame: number | undefined;
    const resizeGame = () => {
      if (resizeFrame !== undefined) {
        window.cancelAnimationFrame(resizeFrame);
      }
      resizeFrame = window.requestAnimationFrame(() => {
        resizeFrame = undefined;
        if (!hostRef.current) {
          return;
        }
        game.scale.resize(Math.max(1, hostRef.current.clientWidth), Math.max(1, hostRef.current.clientHeight));
      });
    };
    window.addEventListener("resize", resizeGame);
    window.addEventListener("orientationchange", resizeGame);
    window.visualViewport?.addEventListener("resize", resizeGame);
    window.visualViewport?.addEventListener("scroll", resizeGame);
    resizeGame();

    const offWelcome = realtime.on("welcome", (message) => {
      callbacksRef.current.onPlayerId(message.payload.playerId);
      callbacksRef.current.onSnapshot(message.payload.snapshot);
      const player = message.payload.snapshot.players.find((candidate) => candidate.id === message.payload.playerId);
      callbacksRef.current.onInventory({
        items: message.payload.inventory,
        equipment: message.payload.equipment,
        stats: message.payload.stats,
        gold: player?.gold ?? 0,
        wallet: message.payload.wallet
      });
      scene.setLocalPlayer(message.payload.playerId);
    });
    let lastUiSnapshotAt = performance.now();
    let pendingUiSnapshot: GameSnapshot | undefined;
    let uiSnapshotTimer: number | undefined;
    const pushUiSnapshot = (snapshot: GameSnapshot) => {
      if (uiSnapshotTimer !== undefined) {
        window.clearTimeout(uiSnapshotTimer);
      }
      lastUiSnapshotAt = performance.now();
      pendingUiSnapshot = undefined;
      uiSnapshotTimer = undefined;
      callbacksRef.current.onSnapshot(snapshot);
    };
    const offSnapshot = realtime.on("snapshot", (snapshot) => {
      const now = performance.now();
      const elapsed = now - lastUiSnapshotAt;
      if (elapsed >= 125) {
        pushUiSnapshot(snapshot);
        return;
      }

      pendingUiSnapshot = snapshot;
      if (uiSnapshotTimer === undefined) {
        uiSnapshotTimer = window.setTimeout(() => {
          if (pendingUiSnapshot) {
            pushUiSnapshot(pendingUiSnapshot);
          }
        }, 125 - elapsed);
      }
    });
    const offInventory = realtime.on("inventory", (inventory) => callbacksRef.current.onInventory(inventory));
    const offClaim = realtime.on("claim", (message) => callbacksRef.current.onClaim(message.payload));
    const offChat = realtime.on("chat", (message) => callbacksRef.current.onChat(message));
    const offAdminState = realtime.on("adminState", (state) => callbacksRef.current.onAdminState?.(state));
    const offFeedbackSaved = realtime.on("feedbackSaved", (payload) => callbacksRef.current.onFeedbackSaved?.(payload));
    const offError = realtime.on("error", (error) => {
      callbacksRef.current.onRealtimeError?.(error);
      if (error.code !== "session_replaced") {
        console.warn(error.message);
      }
    });

    realtime.connect(props.playerName, props.classId, props.characterId, props.token, props.race, props.face, props.customHeadUrl);

    const claimListener = (event: Event) => {
      const detail = (event as CustomEvent<{ walletAddress?: string }>).detail;
      realtime.claimReward(detail?.walletAddress);
    };
    window.addEventListener("mmo:claimReward", claimListener);
    const adminRequestListener = () => {
      realtime.requestAdminState();
    };
    const adminActionListener = (event: Event) => {
      const detail = (event as CustomEvent<{ action?: AdminActionType; targetId?: string; durationMs?: number }>).detail;
      if (detail?.action && detail.targetId) {
        realtime.adminAction(detail.action, detail.targetId, detail.durationMs);
      }
    };
    window.addEventListener("mmo:adminRequest", adminRequestListener);
    window.addEventListener("mmo:adminAction", adminActionListener);
    const chatListener = (event: Event) => {
      const detail = (event as CustomEvent<{ text?: string; channel?: Exclude<ChatChannel, "system"> }>).detail;
      if (detail?.text) {
        realtime.chat(detail.text, detail.channel ?? "local");
      }
    };
    window.addEventListener("mmo:sendChat", chatListener);
    const feedbackReportListener = (event: Event) => {
      const detail = (event as CustomEvent<{ text?: string; context?: string }>).detail;
      if (detail?.text) {
        realtime.feedbackReport(detail.text, detail.context);
      }
    };
    window.addEventListener("mmo:feedbackReport", feedbackReportListener);
    const attackNearestListener = () => scene.attackNearestTarget();
    const skillNearestListener = (event: Event) => {
      const detail = (event as CustomEvent<{ index?: number }>).detail;
      scene.skillNearestTarget(detail?.index ?? 0);
    };
    window.addEventListener("mmo:attackNearest", attackNearestListener);
    window.addEventListener("mmo:skillNearest", skillNearestListener);
    const equipItemListener = (event: Event) => {
      const detail = (event as CustomEvent<{ itemId?: string; slot?: EquipmentSlot }>).detail;
      if (detail?.itemId) {
        realtime.equipItem(detail.itemId, detail.slot);
      }
    };
    const unequipItemListener = (event: Event) => {
      const detail = (event as CustomEvent<{ slot?: EquipmentSlot }>).detail;
      if (detail?.slot) {
        realtime.unequipItem(detail.slot);
      }
    };
    const useItemListener = (event: Event) => {
      const detail = (event as CustomEvent<{ itemId?: string }>).detail;
      if (detail?.itemId) {
        realtime.useItem(detail.itemId);
      }
    };
    const sellItemListener = (event: Event) => {
      const detail = (event as CustomEvent<{ itemId?: string }>).detail;
      if (detail?.itemId) {
        realtime.sellItem(detail.itemId);
      }
    };
    const enchantItemListener = (event: Event) => {
      const detail = (event as CustomEvent<{ itemId?: string; slot?: EquipmentSlot }>).detail;
      if (detail?.itemId) {
        realtime.enchantItem(detail.itemId, detail.slot);
      }
    };
    const buyShopItemListener = (event: Event) => {
      const detail = (event as CustomEvent<{ itemId?: string }>).detail;
      if (detail?.itemId) {
        realtime.buyShopItem(detail.itemId);
      }
    };
    const pickupGroundItemListener = (event: Event) => {
      const detail = (event as CustomEvent<{ itemId?: string }>).detail;
      if (detail?.itemId) {
        realtime.pickupGroundItem(detail.itemId);
      }
    };
    const teleportListener = (event: Event) => {
      const detail = (event as CustomEvent<{ teleportId?: TeleportId }>).detail;
      if (detail?.teleportId) {
        realtime.teleport(detail.teleportId);
      }
    };
    const respawnListener = () => {
      realtime.respawn();
    };
    const reviveListener = (event: Event) => {
      const detail = (event as CustomEvent<{ targetId?: string }>).detail;
      if (detail?.targetId) {
        realtime.revive(detail.targetId);
      }
    };
    const partyInviteListener = (event: Event) => {
      const detail = (event as CustomEvent<{ targetId?: string }>).detail;
      if (detail?.targetId) {
        realtime.partyInvite(detail.targetId);
      }
    };
    const partyAcceptListener = (event: Event) => {
      const detail = (event as CustomEvent<{ fromId?: string }>).detail;
      if (detail?.fromId) {
        realtime.partyAccept(detail.fromId);
      }
    };
    const partyDeclineListener = (event: Event) => {
      const detail = (event as CustomEvent<{ fromId?: string }>).detail;
      if (detail?.fromId) {
        realtime.partyDecline(detail.fromId);
      }
    };
    const duelInviteListener = (event: Event) => {
      const detail = (event as CustomEvent<{ targetId?: string }>).detail;
      if (detail?.targetId) {
        realtime.duelInvite(detail.targetId);
      }
    };
    const duelAcceptListener = (event: Event) => {
      const detail = (event as CustomEvent<{ fromId?: string }>).detail;
      if (detail?.fromId) {
        realtime.duelAccept(detail.fromId);
      }
    };
    const duelDeclineListener = (event: Event) => {
      const detail = (event as CustomEvent<{ fromId?: string }>).detail;
      if (detail?.fromId) {
        realtime.duelDecline(detail.fromId);
      }
    };
    const clanCreateListener = (event: Event) => {
      const detail = (event as CustomEvent<{ name?: string; emblem?: ClanEmblem }>).detail;
      if (detail?.name && detail.emblem) {
        realtime.clanCreate(detail.name, detail.emblem);
      }
    };
    const clanInviteListener = (event: Event) => {
      const detail = (event as CustomEvent<{ targetId?: string }>).detail;
      if (detail?.targetId) {
        realtime.clanInvite(detail.targetId);
      }
    };
    const clanAcceptListener = (event: Event) => {
      const detail = (event as CustomEvent<{ fromId?: string; clanId?: string }>).detail;
      if (detail?.fromId && detail.clanId) {
        realtime.clanAccept(detail.fromId, detail.clanId);
      }
    };
    const clanDeclineListener = (event: Event) => {
      const detail = (event as CustomEvent<{ fromId?: string; clanId?: string }>).detail;
      if (detail?.fromId && detail.clanId) {
        realtime.clanDecline(detail.fromId, detail.clanId);
      }
    };
    const clanKickListener = (event: Event) => {
      const detail = (event as CustomEvent<{ characterId?: string }>).detail;
      if (detail?.characterId) {
        realtime.clanKick(detail.characterId);
      }
    };
    const clanLeaveListener = () => {
      realtime.clanLeave();
    };
    window.addEventListener("mmo:equipItem", equipItemListener);
    window.addEventListener("mmo:unequipItem", unequipItemListener);
    window.addEventListener("mmo:useItem", useItemListener);
    window.addEventListener("mmo:sellItem", sellItemListener);
    window.addEventListener("mmo:enchantItem", enchantItemListener);
    window.addEventListener("mmo:buyShopItem", buyShopItemListener);
    window.addEventListener("mmo:pickupGroundItem", pickupGroundItemListener);
    window.addEventListener("mmo:teleportTo", teleportListener);
    window.addEventListener("mmo:respawn", respawnListener);
    window.addEventListener("mmo:revive", reviveListener);
    window.addEventListener("mmo:partyInvite", partyInviteListener);
    window.addEventListener("mmo:partyAccept", partyAcceptListener);
    window.addEventListener("mmo:partyDecline", partyDeclineListener);
    window.addEventListener("mmo:duelInvite", duelInviteListener);
    window.addEventListener("mmo:duelAccept", duelAcceptListener);
    window.addEventListener("mmo:duelDecline", duelDeclineListener);
    window.addEventListener("mmo:clanCreate", clanCreateListener);
    window.addEventListener("mmo:clanInvite", clanInviteListener);
    window.addEventListener("mmo:clanAccept", clanAcceptListener);
    window.addEventListener("mmo:clanDecline", clanDeclineListener);
    window.addEventListener("mmo:clanKick", clanKickListener);
    window.addEventListener("mmo:clanLeave", clanLeaveListener);
    const uiFocusListener = (event: Event) => {
      const detail = (event as CustomEvent<{ focused?: boolean }>).detail;
      scene.setUiFocused(Boolean(detail?.focused));
    };
    window.addEventListener("mmo:uiFocus", uiFocusListener);

    return () => {
      window.removeEventListener("mmo:claimReward", claimListener);
      window.removeEventListener("mmo:adminRequest", adminRequestListener);
      window.removeEventListener("mmo:adminAction", adminActionListener);
      window.removeEventListener("mmo:sendChat", chatListener);
      window.removeEventListener("mmo:feedbackReport", feedbackReportListener);
      window.removeEventListener("mmo:attackNearest", attackNearestListener);
      window.removeEventListener("mmo:skillNearest", skillNearestListener);
      window.removeEventListener("mmo:equipItem", equipItemListener);
      window.removeEventListener("mmo:unequipItem", unequipItemListener);
      window.removeEventListener("mmo:useItem", useItemListener);
      window.removeEventListener("mmo:sellItem", sellItemListener);
      window.removeEventListener("mmo:enchantItem", enchantItemListener);
      window.removeEventListener("mmo:buyShopItem", buyShopItemListener);
      window.removeEventListener("mmo:pickupGroundItem", pickupGroundItemListener);
      window.removeEventListener("mmo:teleportTo", teleportListener);
      window.removeEventListener("mmo:respawn", respawnListener);
      window.removeEventListener("mmo:revive", reviveListener);
      window.removeEventListener("mmo:partyInvite", partyInviteListener);
      window.removeEventListener("mmo:partyAccept", partyAcceptListener);
      window.removeEventListener("mmo:partyDecline", partyDeclineListener);
      window.removeEventListener("mmo:duelInvite", duelInviteListener);
      window.removeEventListener("mmo:duelAccept", duelAcceptListener);
      window.removeEventListener("mmo:duelDecline", duelDeclineListener);
      window.removeEventListener("mmo:clanCreate", clanCreateListener);
      window.removeEventListener("mmo:clanInvite", clanInviteListener);
      window.removeEventListener("mmo:clanAccept", clanAcceptListener);
      window.removeEventListener("mmo:clanDecline", clanDeclineListener);
      window.removeEventListener("mmo:clanKick", clanKickListener);
      window.removeEventListener("mmo:clanLeave", clanLeaveListener);
      window.removeEventListener("mmo:uiFocus", uiFocusListener);
      window.removeEventListener("resize", resizeGame);
      window.removeEventListener("orientationchange", resizeGame);
      window.visualViewport?.removeEventListener("resize", resizeGame);
      window.visualViewport?.removeEventListener("scroll", resizeGame);
      offWelcome();
      offSnapshot();
      offInventory();
      offClaim();
      offChat();
      offAdminState();
      offFeedbackSaved();
      offError();
      if (uiSnapshotTimer !== undefined) {
        window.clearTimeout(uiSnapshotTimer);
      }
      if (resizeFrame !== undefined) {
        window.cancelAnimationFrame(resizeFrame);
      }
      realtime.close();
      game.destroy(true);
    };
  }, [props.playerName, props.classId, props.characterId, props.token, props.race, props.face]);

  return <div className="gameHost" ref={hostRef} />;
}
