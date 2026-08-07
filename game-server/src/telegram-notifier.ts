// Owner-facing Telegram alerts for real players joining the world.
//
// Entirely opt-in: with TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_CHAT_ID unset the
// notifier is inert and never touches the network. The token is only ever read
// from the environment and is never logged, so failures report the HTTP status
// rather than the request URL.

// A mobile client that blips its connection leaves and rejoins within seconds,
// and that is not an arrival worth a message. Anything longer is treated as the
// player genuinely coming back, so a break of a few minutes does notify.
const RECONNECT_GRACE_MS = 90 * 1000;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 20;
const REQUEST_TIMEOUT_MS = 5_000;

// CLASS_DEFINITIONS carries English labels for the client, but this message is
// Russian everywhere else, so translate here rather than in shared data.
const CLASS_LABELS_RU: Record<string, string> = {
  warrior: "Воин",
  assassin: "Ассасин",
  mage: "Маг",
  archer: "Лучник",
  tank: "Танк"
};

export interface PlayerJoinedNotice {
  name: string;
  characterId: string;
  classId: string;
  classLabel: string;
  level: number;
  returning: boolean;
  realOnline: number;
}

export class TelegramNotifier {
  private readonly token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  private readonly chatId = process.env.TELEGRAM_ADMIN_CHAT_ID?.trim();
  readonly enabled = Boolean(this.token && this.chatId);

  private readonly lastLeftAt = new Map<string, number>();
  private readonly announced = new Set<string>();
  private sentAt: number[] = [];
  private suppressed = 0;

  /** Called when a character leaves the world, so a quick rejoin reads as a reconnect. */
  playerLeft(characterId: string): void {
    if (!this.enabled) {
      return;
    }
    this.lastLeftAt.set(characterId, Date.now());
  }

  playerJoined(notice: PlayerJoinedNotice): void {
    if (!this.enabled) {
      return;
    }

    const now = Date.now();
    const leftAt = this.lastLeftAt.get(notice.characterId);
    const reconnect = leftAt !== undefined && now - leftAt < RECONNECT_GRACE_MS;
    if (reconnect && this.announced.has(notice.characterId)) {
      return;
    }
    this.announced.add(notice.characterId);
    this.prune(now);

    this.sentAt = this.sentAt.filter((at) => now - at < RATE_WINDOW_MS);
    if (this.sentAt.length >= MAX_PER_WINDOW) {
      this.suppressed += 1;
      return;
    }
    this.sentAt.push(now);

    const heading = notice.returning ? "Вернулся игрок" : "НОВЫЙ игрок";
    const missed = this.suppressed > 0 ? `\n(за последний час не показано ещё ${this.suppressed})` : "";
    this.suppressed = 0;

    const className = CLASS_LABELS_RU[notice.classId] ?? notice.classLabel;
    void this.send(
      `${heading}: ${notice.name}\n` +
        `${className} · ${notice.level} уровень\n` +
        `Реальных игроков онлайн: ${notice.realOnline}${missed}`
    );
  }

  private prune(now: number): void {
    if (this.lastLeftAt.size < 500) {
      return;
    }
    for (const [characterId, at] of this.lastLeftAt) {
      if (now - at >= RECONNECT_GRACE_MS) {
        this.lastLeftAt.delete(characterId);
        this.announced.delete(characterId);
      }
    }
  }

  private async send(text: string): Promise<void> {
    try {
      const response = await fetch(`https://api.telegram.org/bot${this.token}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: this.chatId, text, disable_web_page_preview: true }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      });
      if (!response.ok) {
        console.error(`telegram notify failed: HTTP ${response.status}`);
      }
    } catch (error) {
      console.error("telegram notify failed:", error instanceof Error ? error.message : "unknown error");
    }
  }
}
