import type { VoiceChannel, VoicePeer, VoiceSignal } from "@mmo/shared";
import { RealtimeClient } from "./RealtimeClient";

export type VoicePermissionState = "prompt" | "granted" | "denied" | "unsupported";

export interface VoiceClientState {
  supported: boolean;
  enabled: boolean;
  permission: VoicePermissionState;
  active: boolean;
  channel: VoiceChannel;
  peers: VoicePeer[];
  remoteSpeakers: Array<{ playerId: string; name: string; channel: VoiceChannel }>;
  error?: string;
}

interface VoicePeerHandle {
  playerId: string;
  name: string;
  channel: VoiceChannel;
  connection: RTCPeerConnection;
  makingOffer: boolean;
  ignoreOffer: boolean;
  lastOfferAt: number;
  audio?: HTMLAudioElement;
}

const VOICE_RTC_CONFIGURATION: RTCConfiguration = {
  iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:global.stun.twilio.com:3478"] }]
};

export class VoiceChatClient {
  private localPlayerId?: string;
  private enabled = true;
  private permission: VoicePermissionState = this.voiceSupported() ? "prompt" : "unsupported";
  private active = false;
  private channel: VoiceChannel = "nearby";
  private localStream?: MediaStream;
  private refreshTimer?: number;
  private peers: VoicePeer[] = [];
  private readonly peerHandles = new Map<string, VoicePeerHandle>();
  private readonly outboundPeerIds = new Set<string>();
  private readonly remoteSpeakers = new Map<string, { playerId: string; name: string; channel: VoiceChannel }>();
  private lastError?: string;

  constructor(
    private readonly realtime: RealtimeClient,
    private readonly onState: (state: VoiceClientState) => void
  ) {
    this.emitState();
  }

  setLocalPlayer(playerId: string): void {
    this.localPlayerId = playerId;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.stop();
    }
    this.emitState();
  }

  setChannel(channel: VoiceChannel): void {
    if (this.channel === channel) {
      return;
    }
    const wasActive = this.active;
    this.stop();
    this.channel = channel;
    this.peers = [];
    this.emitState();
    if (wasActive) {
      void this.start(channel);
    }
  }

  async requestPermission(): Promise<void> {
    if (!this.voiceSupported()) {
      this.permission = "unsupported";
      this.lastError = "Voice chat is not supported in this browser.";
      this.emitState();
      return;
    }

    try {
      const stream = await this.openMicrophone();
      stream.getTracks().forEach((track) => track.stop());
      this.permission = "granted";
      this.lastError = undefined;
      this.emitState();
    } catch (error) {
      this.permission = "denied";
      this.lastError = error instanceof Error ? error.message : "Microphone permission denied.";
      this.emitState();
    }
  }

  async start(channel = this.channel): Promise<void> {
    if (!this.enabled) {
      this.lastError = "Voice chat is disabled in settings.";
      this.emitState();
      return;
    }
    if (!this.voiceSupported()) {
      this.permission = "unsupported";
      this.lastError = "Voice chat is not supported in this browser.";
      this.emitState();
      return;
    }

    this.channel = channel;
    try {
      if (!this.localStream) {
        this.localStream = await this.openMicrophone();
      }
      this.permission = "granted";
      this.active = true;
      this.lastError = undefined;
      this.realtime.voicePresence(true, this.channel);
      this.startRefreshTimer();
      this.emitState();
    } catch (error) {
      this.permission = "denied";
      this.active = false;
      this.lastError = error instanceof Error ? error.message : "Microphone permission denied.";
      this.emitState();
    }
  }

  stop(): void {
    if (this.active) {
      this.realtime.voicePresence(false, this.channel);
    }
    this.active = false;
    this.stopRefreshTimer();
    this.localStream?.getTracks().forEach((track) => track.stop());
    this.localStream = undefined;
    for (const peerId of [...this.outboundPeerIds]) {
      this.realtime.voiceSignal(peerId, this.channel, { kind: "leave" });
    }
    this.outboundPeerIds.clear();
    this.closeAllPeers();
    this.peers = [];
    this.emitState();
  }

  handlePeers(payload: { active: boolean; channel: VoiceChannel; peers: VoicePeer[] }): void {
    if (payload.channel !== this.channel) {
      return;
    }
    if (!payload.active || !this.active) {
      this.peers = payload.peers;
      this.emitState();
      return;
    }

    this.peers = payload.peers;
    const allowed = new Set(payload.peers.map((peer) => peer.playerId));
    for (const peerId of [...this.outboundPeerIds]) {
      if (!allowed.has(peerId)) {
        this.realtime.voiceSignal(peerId, this.channel, { kind: "leave" });
        this.closePeer(peerId);
      }
    }

    for (const peer of payload.peers) {
      this.outboundPeerIds.add(peer.playerId);
      const { handle, created } = this.ensurePeer(peer.playerId, peer.name, peer.channel);
      const shouldOffer =
        created ||
        handle.connection.connectionState === "failed" ||
        handle.connection.iceConnectionState === "failed" ||
        (handle.connection.connectionState !== "connected" && Date.now() - handle.lastOfferAt > 5_000);
      if (shouldOffer) {
        void this.makeOffer(handle);
      }
    }
    this.emitState();
  }

  async handleSignal(payload: { fromPlayerId: string; fromName: string; channel: VoiceChannel; signal: VoiceSignal }): Promise<void> {
    if (!this.enabled || payload.channel !== this.channel) {
      return;
    }
    const signal = payload.signal;
    if (signal.kind === "leave") {
      this.closePeer(payload.fromPlayerId);
      this.emitState();
      return;
    }

    const { handle } = this.ensurePeer(payload.fromPlayerId, payload.fromName, payload.channel);
    const connection = handle.connection;
    try {
      if (signal.kind === "offer") {
        const polite = this.isPolitePeer(payload.fromPlayerId);
        const offerCollision = handle.makingOffer || connection.signalingState !== "stable";
        handle.ignoreOffer = !polite && offerCollision;
        if (handle.ignoreOffer) {
          return;
        }
        await connection.setRemoteDescription({ type: "offer", sdp: signal.sdp });
        this.attachLocalTracks(handle);
        const answer = await connection.createAnswer();
        await connection.setLocalDescription(answer);
        if (connection.localDescription?.sdp) {
          this.realtime.voiceSignal(payload.fromPlayerId, payload.channel, { kind: "answer", sdp: connection.localDescription.sdp });
        }
        return;
      }

      if (signal.kind === "answer") {
        await connection.setRemoteDescription({ type: "answer", sdp: signal.sdp });
        return;
      }

      if (signal.kind === "ice" && signal.candidate?.candidate) {
        await connection.addIceCandidate(signal.candidate as RTCIceCandidateInit);
      }
    } catch (error) {
      if (!handle.ignoreOffer) {
        this.lastError = error instanceof Error ? error.message : "Voice connection failed.";
        this.emitState();
      }
    }
  }

  close(): void {
    this.stop();
    this.enabled = false;
  }

  private async makeOffer(handle: VoicePeerHandle): Promise<void> {
    if (!this.active || !this.localStream || handle.makingOffer) {
      return;
    }

    try {
      handle.makingOffer = true;
      handle.lastOfferAt = Date.now();
      this.attachLocalTracks(handle);
      const offer = await handle.connection.createOffer({ offerToReceiveAudio: true });
      await handle.connection.setLocalDescription(offer);
      if (handle.connection.localDescription?.sdp) {
        this.realtime.voiceSignal(handle.playerId, handle.channel, { kind: "offer", sdp: handle.connection.localDescription.sdp });
      }
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : "Voice offer failed.";
      this.emitState();
    } finally {
      handle.makingOffer = false;
    }
  }

  private ensurePeer(playerId: string, name: string, channel: VoiceChannel): { handle: VoicePeerHandle; created: boolean } {
    const existing = this.peerHandles.get(playerId);
    if (existing && existing.connection.signalingState !== "closed") {
      existing.name = name;
      existing.channel = channel;
      return { handle: existing, created: false };
    }

    const connection = new RTCPeerConnection(VOICE_RTC_CONFIGURATION);
    const handle: VoicePeerHandle = {
      playerId,
      name,
      channel,
      connection,
      makingOffer: false,
      ignoreOffer: false,
      lastOfferAt: 0
    };
    connection.onicecandidate = (event) => {
      if (!event.candidate) {
        return;
      }
      this.realtime.voiceSignal(playerId, channel, {
        kind: "ice",
        candidate: event.candidate.toJSON()
      });
    };
    connection.ontrack = (event) => {
      const stream = event.streams[0];
      if (!stream) {
        return;
      }
      if (!handle.audio) {
        handle.audio = document.createElement("audio");
        handle.audio.autoplay = true;
        (handle.audio as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
        handle.audio.volume = 1;
        handle.audio.dataset.voicePeer = playerId;
        handle.audio.style.display = "none";
        document.body.appendChild(handle.audio);
      }
      handle.audio.srcObject = stream;
      this.remoteSpeakers.set(playerId, { playerId, name: handle.name, channel: handle.channel });
      void handle.audio.play().catch(() => {
        this.lastError = "Tap the mic button once to unlock voice playback.";
        this.emitState();
      });
      this.emitState();
    };
    connection.onconnectionstatechange = () => {
      if (connection.connectionState === "failed" || connection.connectionState === "closed") {
        this.closePeer(playerId);
        this.emitState();
      }
    };
    this.peerHandles.set(playerId, handle);
    return { handle, created: true };
  }

  private attachLocalTracks(handle: VoicePeerHandle): void {
    if (!this.localStream) {
      return;
    }

    const existingTrackIds = new Set(handle.connection.getSenders().map((sender) => sender.track?.id).filter(Boolean));
    for (const track of this.localStream.getAudioTracks()) {
      if (!existingTrackIds.has(track.id)) {
        handle.connection.addTrack(track, this.localStream);
      }
    }
  }

  private closeAllPeers(): void {
    for (const playerId of [...this.peerHandles.keys()]) {
      this.closePeer(playerId);
    }
  }

  private closePeer(playerId: string): void {
    const handle = this.peerHandles.get(playerId);
    if (!handle) {
      return;
    }
    handle.audio?.pause();
    if (handle.audio) {
      handle.audio.srcObject = null;
      handle.audio.remove();
    }
    handle.connection.onicecandidate = null;
    handle.connection.ontrack = null;
    handle.connection.onconnectionstatechange = null;
    handle.connection.close();
    this.peerHandles.delete(playerId);
    this.outboundPeerIds.delete(playerId);
    this.remoteSpeakers.delete(playerId);
  }

  private startRefreshTimer(): void {
    this.stopRefreshTimer();
    this.refreshTimer = window.setInterval(() => {
      if (this.active) {
        this.realtime.voicePresence(true, this.channel);
      }
    }, 2_400);
  }

  private stopRefreshTimer(): void {
    if (this.refreshTimer !== undefined) {
      window.clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }
  }

  private async openMicrophone(): Promise<MediaStream> {
    return navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: false
    });
  }

  private voiceSupported(): boolean {
    const mediaDevices = (navigator as Navigator & { mediaDevices?: { getUserMedia?: unknown } }).mediaDevices;
    return Boolean(mediaDevices && typeof mediaDevices.getUserMedia === "function" && "RTCPeerConnection" in window);
  }

  private isPolitePeer(peerId: string): boolean {
    return Boolean(this.localPlayerId && this.localPlayerId > peerId);
  }

  private emitState(): void {
    this.onState({
      supported: this.voiceSupported(),
      enabled: this.enabled,
      permission: this.permission,
      active: this.active,
      channel: this.channel,
      peers: this.peers,
      remoteSpeakers: [...this.remoteSpeakers.values()],
      error: this.lastError
    });
  }
}
