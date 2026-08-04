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
  ClientPerformanceProfile,
  DerivedStats,
  EquipmentSlot,
  EquipmentState,
  GameSnapshot,
  InventoryItem,
  ServerMessage,
  TeleportId,
  VoiceChannel,
  WalletState
} from "@mmo/shared";
import { RealtimeClient, type RealtimeError } from "./RealtimeClient";
import { VoiceChatClient } from "./VoiceChatClient";
import { WorldScene } from "./WorldScene";
import { isMobileGameRuntime, isRuStoreLaunch, loadMobileGraphicsSettings, mobileGraphicsPerformanceProfile, type MobileGraphicsSettings } from "./performanceSettings";
import type { AppLanguage } from "../i18n";

const DESKTOP_GAME_FPS = 120;

function gameWebSocketUrl(): string {
  const configuredUrl = import.meta.env.VITE_GAME_WS_URL?.trim();
  if (configuredUrl) {
    return configuredUrl;
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
}

function clientPerformanceProfile(mobile: boolean, settings: MobileGraphicsSettings): ClientPerformanceProfile {
  return mobileGraphicsPerformanceProfile(mobile, settings);
}

interface Props {
  language: AppLanguage;
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

    hostRef.current.querySelectorAll("canvas").forEach((strayCanvas) => strayCanvas.remove());

    const mobileRuntime = isMobileGameRuntime();
    const initialGraphicsSettings = loadMobileGraphicsSettings();
    const realtime = new RealtimeClient(gameWebSocketUrl());
    const scene = new WorldScene(realtime, () => walletRef.current, props.language, initialGraphicsSettings, mobileRuntime);
    const voice = new VoiceChatClient(realtime, (state) => {
      window.dispatchEvent(new CustomEvent("mmo:voiceState", { detail: state }));
    });
    const mobileFpsLimit = mobileRuntime ? initialGraphicsSettings.fpsLimit : DESKTOP_GAME_FPS;
    const mobileHighPerformance = mobileRuntime && initialGraphicsSettings.fpsLimit >= 120;
    const powerPreference = mobileRuntime && !mobileHighPerformance ? "low-power" : "high-performance";
    const antialiasEnabled = mobileRuntime ? initialGraphicsSettings.smoothRender : true;
    const rendererType = mobileRuntime && isRuStoreLaunch() ? Phaser.CANVAS : Phaser.AUTO;
    const game = new Phaser.Game({
      type: rendererType,
      parent: hostRef.current,
      backgroundColor: "#101312",
      powerPreference,
      render: {
        antialias: antialiasEnabled,
        antialiasGL: antialiasEnabled,
        roundPixels: false,
        transparent: false,
        clearBeforeRender: true,
        powerPreference,
        autoMobilePipeline: true
      },
      fps: {
        target: mobileRuntime ? mobileFpsLimit : DESKTOP_GAME_FPS,
        limit: mobileRuntime ? mobileFpsLimit : 0,
        smoothStep: true
      },
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
    let lastGameWidth = 0;
    let lastGameHeight = 0;
    const resizeGame = () => {
      if (resizeFrame !== undefined) {
        window.cancelAnimationFrame(resizeFrame);
      }
      resizeFrame = window.requestAnimationFrame(() => {
        resizeFrame = undefined;
        if (!hostRef.current) {
          return;
        }
        const nextWidth = Math.max(1, hostRef.current.clientWidth);
        const nextHeight = Math.max(1, hostRef.current.clientHeight);
        game.scale.updateBounds();
        if (nextWidth === lastGameWidth && nextHeight === lastGameHeight) {
          return;
        }
        lastGameWidth = nextWidth;
        lastGameHeight = nextHeight;
        game.scale.resize(nextWidth, nextHeight);
      });
    };
    window.addEventListener("resize", resizeGame);
    window.addEventListener("orientationchange", resizeGame);
    window.visualViewport?.addEventListener("resize", resizeGame);
    window.visualViewport?.addEventListener("scroll", resizeGame);
    resizeGame();
    const mobileInputBoundsTimer = mobileRuntime
      ? window.setInterval(() => {
          if (window.innerWidth > window.innerHeight || window.innerHeight <= 540) {
            game.scale.updateBounds();
          }
        }, 900)
      : undefined;

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
      voice.setLocalPlayer(message.payload.playerId);
    });
    let lastUiSnapshotAt = performance.now();
    let pendingUiSnapshot: GameSnapshot | undefined;
    let uiSnapshotTimer: number | undefined;
    const uiStartedAt = performance.now();
    const uiSnapshotIntervalMs = () => {
      if (!mobileRuntime) {
        return 125;
      }
      return performance.now() - uiStartedAt >= 120_000 ? 1600 : 700;
    };
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
      const interval = uiSnapshotIntervalMs();
      if (elapsed >= interval) {
        pushUiSnapshot(snapshot);
        return;
      }

      pendingUiSnapshot = snapshot;
      if (uiSnapshotTimer === undefined) {
        uiSnapshotTimer = window.setTimeout(() => {
          if (pendingUiSnapshot) {
            pushUiSnapshot(pendingUiSnapshot);
          }
        }, interval - elapsed);
      }
    });
    const offInventory = realtime.on("inventory", (inventory) => callbacksRef.current.onInventory(inventory));
    const offClaim = realtime.on("claim", (message) => callbacksRef.current.onClaim(message.payload));
    const offChat = realtime.on("chat", (message) => callbacksRef.current.onChat(message));
    const offVoicePeers = realtime.on("voicePeers", (payload) => voice.handlePeers(payload));
    const offVoiceSignal = realtime.on("voiceSignal", (payload) => {
      void voice.handleSignal(payload);
    });
    const offAdminState = realtime.on("adminState", (state) => callbacksRef.current.onAdminState?.(state));
    const offFeedbackSaved = realtime.on("feedbackSaved", (payload) => callbacksRef.current.onFeedbackSaved?.(payload));
    const offError = realtime.on("error", (error) => {
      callbacksRef.current.onRealtimeError?.(error);
      if (error.code !== "session_replaced") {
        console.warn(error.message);
      }
    });

    realtime.connect(props.playerName, props.classId, props.characterId, props.token, props.race, props.face, props.customHeadUrl, clientPerformanceProfile(mobileRuntime, initialGraphicsSettings));

    const claimListener = (event: Event) => {
      const detail = (event as CustomEvent<{ walletAddress?: string }>).detail;
      realtime.claimReward(detail?.walletAddress);
    };
    window.addEventListener("mmo:claimReward", claimListener);
    const storyQuestRewardListener = (event: Event) => {
      const detail = (event as CustomEvent<{ questId?: string }>).detail;
      if (detail?.questId) {
        realtime.claimStoryQuestReward(detail.questId);
      }
    };
    window.addEventListener("mmo:claimStoryQuestReward", storyQuestRewardListener);
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
    const customHeadListener = (event: Event) => {
      const detail = (event as CustomEvent<{ customHeadUrl?: string }>).detail;
      realtime.updateCustomHead(detail?.customHeadUrl);
    };
    window.addEventListener("mmo:customHeadUpdate", customHeadListener);
    const mobileGraphicsSettingsListener = (event: Event) => {
      const detail = (event as CustomEvent<{ settings?: MobileGraphicsSettings }>).detail;
      const settings = detail?.settings ?? loadMobileGraphicsSettings();
      scene.setMobileGraphicsSettings(settings);
      realtime.updateProfile(clientPerformanceProfile(mobileRuntime, settings));
    };
    window.addEventListener("mmo:mobileGraphicsSettings", mobileGraphicsSettingsListener);
    const attackNearestListener = () => {
      scene.resumeAudio();
      scene.attackNearestTarget();
    };
    const attackHoldStartListener = () => {
      scene.resumeAudio();
      scene.startAttackHold();
    };
    const attackHoldReleaseListener = () => scene.releaseAttackHold();
    const attackHoldCancelListener = () => scene.cancelAttackHold();
    const skillNearestListener = (event: Event) => {
      const detail = (event as CustomEvent<{ index?: number }>).detail;
      scene.resumeAudio();
      scene.skillNearestTarget(detail?.index ?? 0);
    };
    const mobileSprintListener = () => {
      scene.resumeAudio();
      scene.mobileSprint();
    };
    const singingListener = (event: Event) => {
      const detail = (event as CustomEvent<{ active?: boolean }>).detail;
      scene.resumeAudio();
      realtime.sing(Boolean(detail?.active));
    };
    const clearSelectedTargetListener = () => scene.clearSelectedTarget();
    window.addEventListener("mmo:attackNearest", attackNearestListener);
    window.addEventListener("mmo:attackHoldStart", attackHoldStartListener);
    window.addEventListener("mmo:attackHoldRelease", attackHoldReleaseListener);
    window.addEventListener("mmo:attackHoldCancel", attackHoldCancelListener);
    window.addEventListener("mmo:skillNearest", skillNearestListener);
    window.addEventListener("mmo:mobileSprint", mobileSprintListener);
    window.addEventListener("mmo:sing", singingListener);
    window.addEventListener("mmo:clearSelectedTarget", clearSelectedTargetListener);
    const voiceEnabledListener = (event: Event) => {
      const detail = (event as CustomEvent<{ enabled?: boolean }>).detail;
      voice.setEnabled(detail?.enabled !== false);
    };
    const voicePermissionListener = () => {
      void voice.requestPermission();
    };
    const voiceChannelListener = (event: Event) => {
      const detail = (event as CustomEvent<{ channel?: VoiceChannel }>).detail;
      if (detail?.channel === "nearby" || detail?.channel === "party") {
        voice.setChannel(detail.channel);
      }
    };
    const voiceStartListener = (event: Event) => {
      const detail = (event as CustomEvent<{ channel?: VoiceChannel }>).detail;
      scene.resumeAudio();
      void voice.start(detail?.channel === "party" ? "party" : "nearby");
    };
    const voiceStopListener = () => {
      voice.stop();
    };
    window.addEventListener("mmo:voiceEnabled", voiceEnabledListener);
    window.addEventListener("mmo:voiceRequestPermission", voicePermissionListener);
    window.addEventListener("mmo:voiceChannel", voiceChannelListener);
    window.addEventListener("mmo:voiceStart", voiceStartListener);
    window.addEventListener("mmo:voiceStop", voiceStopListener);
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
    const marketListItemListener = (event: Event) => {
      const detail = (event as CustomEvent<{ inventoryIndex?: number; quantity?: number; priceGold?: number }>).detail;
      if (typeof detail?.inventoryIndex === "number" && typeof detail.priceGold === "number") {
        realtime.marketListItem(detail.inventoryIndex, detail.quantity ?? 1, detail.priceGold);
      }
    };
    const marketCancelListingListener = (event: Event) => {
      const detail = (event as CustomEvent<{ listingId?: string }>).detail;
      realtime.marketCancelListing(detail?.listingId);
    };
    const buyMarketItemListener = (event: Event) => {
      const detail = (event as CustomEvent<{ sellerId?: string; listingId?: string }>).detail;
      if (detail?.sellerId && detail.listingId) {
        realtime.buyMarketItem(detail.sellerId, detail.listingId);
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
    const tradeInviteListener = (event: Event) => {
      const detail = (event as CustomEvent<{ targetId?: string }>).detail;
      if (detail?.targetId) {
        realtime.tradeInvite(detail.targetId);
      }
    };
    const tradeAcceptListener = (event: Event) => {
      const detail = (event as CustomEvent<{ fromId?: string }>).detail;
      if (detail?.fromId) {
        realtime.tradeAccept(detail.fromId);
      }
    };
    const tradeDeclineListener = (event: Event) => {
      const detail = (event as CustomEvent<{ fromId?: string }>).detail;
      if (detail?.fromId) {
        realtime.tradeDecline(detail.fromId);
      }
    };
    const tradeCancelListener = () => {
      realtime.tradeCancel();
    };
    const tradeOfferGoldListener = (event: Event) => {
      const detail = (event as CustomEvent<{ gold?: number }>).detail;
      realtime.tradeOfferGold(detail?.gold ?? 0);
    };
    const tradeOfferItemListener = (event: Event) => {
      const detail = (event as CustomEvent<{ inventoryIndex?: number; quantity?: number }>).detail;
      if (typeof detail?.inventoryIndex === "number") {
        realtime.tradeOfferItem(detail.inventoryIndex, detail.quantity ?? 1);
      }
    };
    const tradeRemoveItemListener = (event: Event) => {
      const detail = (event as CustomEvent<{ tradeItemId?: string }>).detail;
      if (detail?.tradeItemId) {
        realtime.tradeRemoveItem(detail.tradeItemId);
      }
    };
    const tradeReadyListener = (event: Event) => {
      const detail = (event as CustomEvent<{ ready?: boolean }>).detail;
      realtime.tradeReady(Boolean(detail?.ready));
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
    window.addEventListener("mmo:marketListItem", marketListItemListener);
    window.addEventListener("mmo:marketCancelListing", marketCancelListingListener);
    window.addEventListener("mmo:buyMarketItem", buyMarketItemListener);
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
    window.addEventListener("mmo:tradeInvite", tradeInviteListener);
    window.addEventListener("mmo:tradeAccept", tradeAcceptListener);
    window.addEventListener("mmo:tradeDecline", tradeDeclineListener);
    window.addEventListener("mmo:tradeCancel", tradeCancelListener);
    window.addEventListener("mmo:tradeOfferGold", tradeOfferGoldListener);
    window.addEventListener("mmo:tradeOfferItem", tradeOfferItemListener);
    window.addEventListener("mmo:tradeRemoveItem", tradeRemoveItemListener);
    window.addEventListener("mmo:tradeReady", tradeReadyListener);
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
      window.removeEventListener("mmo:claimStoryQuestReward", storyQuestRewardListener);
      window.removeEventListener("mmo:adminRequest", adminRequestListener);
      window.removeEventListener("mmo:adminAction", adminActionListener);
      window.removeEventListener("mmo:sendChat", chatListener);
      window.removeEventListener("mmo:feedbackReport", feedbackReportListener);
      window.removeEventListener("mmo:customHeadUpdate", customHeadListener);
      window.removeEventListener("mmo:mobileGraphicsSettings", mobileGraphicsSettingsListener);
      window.removeEventListener("mmo:attackNearest", attackNearestListener);
      window.removeEventListener("mmo:attackHoldStart", attackHoldStartListener);
      window.removeEventListener("mmo:attackHoldRelease", attackHoldReleaseListener);
      window.removeEventListener("mmo:attackHoldCancel", attackHoldCancelListener);
      window.removeEventListener("mmo:skillNearest", skillNearestListener);
      window.removeEventListener("mmo:mobileSprint", mobileSprintListener);
      window.removeEventListener("mmo:sing", singingListener);
      window.removeEventListener("mmo:clearSelectedTarget", clearSelectedTargetListener);
      window.removeEventListener("mmo:voiceEnabled", voiceEnabledListener);
      window.removeEventListener("mmo:voiceRequestPermission", voicePermissionListener);
      window.removeEventListener("mmo:voiceChannel", voiceChannelListener);
      window.removeEventListener("mmo:voiceStart", voiceStartListener);
      window.removeEventListener("mmo:voiceStop", voiceStopListener);
      window.removeEventListener("mmo:equipItem", equipItemListener);
      window.removeEventListener("mmo:unequipItem", unequipItemListener);
      window.removeEventListener("mmo:useItem", useItemListener);
	      window.removeEventListener("mmo:sellItem", sellItemListener);
	      window.removeEventListener("mmo:enchantItem", enchantItemListener);
	      window.removeEventListener("mmo:buyShopItem", buyShopItemListener);
      window.removeEventListener("mmo:marketListItem", marketListItemListener);
      window.removeEventListener("mmo:marketCancelListing", marketCancelListingListener);
      window.removeEventListener("mmo:buyMarketItem", buyMarketItemListener);
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
      window.removeEventListener("mmo:tradeInvite", tradeInviteListener);
      window.removeEventListener("mmo:tradeAccept", tradeAcceptListener);
      window.removeEventListener("mmo:tradeDecline", tradeDeclineListener);
      window.removeEventListener("mmo:tradeCancel", tradeCancelListener);
      window.removeEventListener("mmo:tradeOfferGold", tradeOfferGoldListener);
      window.removeEventListener("mmo:tradeOfferItem", tradeOfferItemListener);
      window.removeEventListener("mmo:tradeRemoveItem", tradeRemoveItemListener);
      window.removeEventListener("mmo:tradeReady", tradeReadyListener);
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
      if (mobileInputBoundsTimer !== undefined) {
        window.clearInterval(mobileInputBoundsTimer);
      }
      offWelcome();
      offSnapshot();
      offInventory();
      offClaim();
      offChat();
      offVoicePeers();
      offVoiceSignal();
      offAdminState();
      offFeedbackSaved();
      offError();
      if (uiSnapshotTimer !== undefined) {
        window.clearTimeout(uiSnapshotTimer);
      }
      if (resizeFrame !== undefined) {
        window.cancelAnimationFrame(resizeFrame);
      }
      voice.close();
      realtime.close();
      const canvas = game.canvas;
      game.destroy(true);
      canvas?.remove();
    };
  }, [props.language, props.playerName, props.classId, props.characterId, props.token, props.race, props.face]);

  return <div className="gameHost" ref={hostRef} />;
}
