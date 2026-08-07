// Owner-facing Telegram alerts for real players joining the world.
//
// Entirely opt-in: with TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_CHAT_ID unset the
// notifier is inert and never touches the network. The token is only ever read
// from the environment and is never logged, so failures report the HTTP status
// rather than the request URL.

const DEDUPE_MS = 30 * 60 * 1000;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 20;
const REQUEST_TIMEOUT_MS = 5_000;

export interface PlayerJoinedNotice {
  name: string;
  characterId: string;
  classLabel: string;
  level: number;
  returning: boolean;
  realOnline: number;
}

export class TelegramNotifier {
  private readonly token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  private readonly chatId = process.env.TELEGRAM_ADMIN_CHAT_ID?.trim();
  readonly enabled = Boolean(this.token && this.chatId);

  private readonly lastNotifiedAt = new Map<string, number>();
  private sentAt: number[] = [];
  private suppressed = 0;

  playerJoined(notice: PlayerJoinedNotice): void {
    if (!this.enabled) {
      return;
    }

    const now = Date.now();
    // Mobile clients reconnect often, and a reconnect is not a new arrival.
    const previous = this.lastNotifiedAt.get(notice.characterId);
    if (previous !== undefined && now - previous < DEDUPE_MS) {
      this.lastNotifiedAt.set(notice.characterId, now);
      return;
    }
    this.lastNotifiedAt.set(notice.characterId, now);
    this.pruneDedupe(now);

    this.sentAt = this.sentAt.filter((at) => now - at < RATE_WINDOW_MS);
    if (this.sentAt.length >= MAX_PER_WINDOW) {
      this.suppressed += 1;
      return;
    }
    this.sentAt.push(now);

    const heading = notice.returning ? "Вернулся игрок" : "НОВЫЙ игрок";
    const missed = this.suppressed > 0 ? `\n(за последний час не показано ещё ${this.suppressed})` : "";
    this.suppressed = 0;

    void this.send(
      `${heading}: ${notice.name}\n` +
        `${notice.classLabel} · ${notice.level} уровень\n` +
        `Реальных игроков онлайн: ${notice.realOnline}${missed}`
    );
  }

  private pruneDedupe(now: number): void {
    if (this.lastNotifiedAt.size < 500) {
      return;
    }
    for (const [characterId, at] of this.lastNotifiedAt) {
      if (now - at >= DEDUPE_MS) {
        this.lastNotifiedAt.delete(characterId);
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
