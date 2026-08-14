import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { BadGatewayException, Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";

interface CoinPaymentRecord {
  orderId: string;
  paymentId?: string;
  paymentUrl?: string;
  accountId: string;
  characterId: string;
  receiptEmail: string;
  amountKopecks: 100;
  coinQuantity: 1;
  status: string;
  createdAt: string;
  updatedAt: string;
  rewardCreatedAt?: string;
  lastError?: string;
}

interface SessionIdentity {
  accountId: string;
  characterId: string;
  email: string;
}

export interface CoinPaymentPublicStatus {
  enabled: boolean;
  mode: "disabled" | "demo" | "production";
  priceRub: 1;
  coinQuantity: 1;
  status: "none" | "pending" | "paid" | "failed";
  orderId?: string;
  updatedAt?: string;
  lastError?: string;
}

const REQUEST_TIMEOUT_MS = 15_000;

@Injectable()
export class CoinPaymentService {
  private readonly terminalKey = process.env.TBANK_TERMINAL_KEY?.trim() ?? "";
  private readonly password = process.env.TBANK_PASSWORD ?? "";
  private readonly apiUrl = (process.env.TBANK_API_URL?.trim() || "https://securepay.tbank.ru/v2").replace(/\/$/, "");
  private readonly siteUrl = (process.env.PUBLIC_SITE_URL?.trim() || "https://darkvell.ru").replace(/\/$/, "");
  private readonly sessionSecret = process.env.AUTH_TOKEN_SECRET ?? "dev-secret-change-me";
  // Fiscal settings are operational configuration, not game code. The live
  // terminal must use the merchant's actual tax system and VAT treatment.
  private readonly receiptEnabled = process.env.TBANK_RECEIPT_ENABLED?.trim() === "1";
  private readonly receiptTaxation = this.receiptTaxationValue(process.env.TBANK_RECEIPT_TAXATION);
  private readonly receiptTax = this.receiptTaxValue(process.env.TBANK_RECEIPT_TAX);
  private readonly paymentsPath = join(process.cwd(), "data", "coin-payments.json");
  private readonly rewardsDir = process.env.AUTH_COIN_REWARDS_DIR?.trim() || join(process.cwd(), "../game-server/data/coin-payment-rewards");
  private readonly records = new Map<string, CoinPaymentRecord>();
  private loaded = false;

  async status(token?: string): Promise<CoinPaymentPublicStatus> {
    const identity = this.identity(token);
    this.load();
    const record = this.latest(identity.accountId);
    if (record && ["NEW", "FORM_SHOWED", "AUTHORIZED"].includes(record.status)) {
      await this.refresh(record);
    }
    return this.publicStatus(this.latest(identity.accountId));
  }

  async start(token?: string): Promise<{ paymentUrl: string; orderId: string; status: CoinPaymentPublicStatus }> {
    this.ensureEnabled();
    const identity = this.identity(token);
    this.load();
    const pending = this.latest(identity.accountId);
    if (pending?.paymentUrl && ["NEW", "FORM_SHOWED", "AUTHORIZED"].includes(pending.status) && Date.now() - Date.parse(pending.createdAt) < 24 * 60 * 60 * 1000) {
      return { paymentUrl: pending.paymentUrl, orderId: pending.orderId, status: this.publicStatus(pending) };
    }

    const orderId = `DV-COIN-${Date.now().toString(36)}-${randomUUID().slice(0, 6)}`.slice(0, 50);
    const now = new Date().toISOString();
    const record: CoinPaymentRecord = {
      orderId,
      accountId: identity.accountId,
      characterId: identity.characterId,
      receiptEmail: identity.email,
      amountKopecks: 100,
      coinQuantity: 1,
      status: "NEW",
      createdAt: now,
      updatedAt: now
    };
    this.records.set(orderId, record);
    this.save();

    try {
      const result = await this.request("Init", {
        Amount: record.amountKopecks,
        OrderId: orderId,
        Description: "DarkVell: 1 Coin",
        OperationInitiatorType: "0",
        PayType: "O",
        DATA: { Email: record.receiptEmail, OrderNumber: orderId },
        ...(this.receiptEnabled ? { Receipt: this.receipt(record) } : {}),
        SuccessURL: `${this.siteUrl}/?coinPayment=success&order=${encodeURIComponent(orderId)}`,
        FailURL: `${this.siteUrl}/?coinPayment=fail&order=${encodeURIComponent(orderId)}`,
        NotificationURL: `${this.siteUrl}/auth/coin-shop/tbank/notification`
      });
      const paymentId = this.clean(result.PaymentId, 100);
      const paymentUrl = this.clean(result.PaymentURL, 2048);
      if (!result.Success || !paymentId || !paymentUrl.startsWith("https://")) {
        throw new BadGatewayException(this.bankMessage(result));
      }
      record.paymentId = paymentId;
      record.paymentUrl = paymentUrl;
      record.status = this.clean(result.Status || "NEW", 40).toUpperCase();
      record.updatedAt = new Date().toISOString();
      this.save();
      return { paymentUrl, orderId, status: this.publicStatus(record) };
    } catch (error) {
      this.records.delete(orderId);
      this.save();
      throw error;
    }
  }

  async notification(payload: Record<string, unknown>): Promise<"OK"> {
    this.ensureEnabled();
    const providedToken = this.clean(payload.Token, 256);
    const expectedToken = this.token(payload);
    const providedBuffer = Buffer.from(providedToken);
    const expectedBuffer = Buffer.from(expectedToken);
    if (
      this.clean(payload.TerminalKey, 100) !== this.terminalKey ||
      providedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(providedBuffer, expectedBuffer)
    ) {
      throw new UnauthorizedException("Invalid T-Bank notification signature.");
    }

    this.load();
    const orderId = this.clean(payload.OrderId, 80);
    const record = this.records.get(orderId);
    if (!record) return "OK";
    const amount = Number(payload.Amount ?? 0);
    if (!Number.isFinite(amount) || amount !== record.amountKopecks) return "OK";
    const paymentId = this.clean(payload.PaymentId, 100);
    if (record.paymentId && paymentId && record.paymentId !== paymentId) return "OK";
    record.paymentId = paymentId || record.paymentId;
    record.status = this.clean(payload.Status || record.status, 40).toUpperCase();
    record.updatedAt = new Date().toISOString();
    const success = payload.Success === true || payload.Success === "true";
    if (success && record.status === "CONFIRMED") {
      this.createReward(record);
    } else if (["REJECTED", "CANCELED", "DEADLINE_EXPIRED", "AUTH_FAIL"].includes(record.status)) {
      record.lastError = "Payment was declined by the bank.";
    }
    this.save();
    return "OK";
  }

  private async refresh(record: CoinPaymentRecord): Promise<void> {
    if (!record.paymentId) return;
    try {
      const result = await this.request("GetState", { PaymentId: record.paymentId });
      record.status = this.clean(result.Status || record.status, 40).toUpperCase();
      record.updatedAt = new Date().toISOString();
      if (result.Success && record.status === "CONFIRMED" && Number(result.Amount ?? record.amountKopecks) === record.amountKopecks) {
        this.createReward(record);
      } else if (["REJECTED", "CANCELED", "DEADLINE_EXPIRED", "AUTH_FAIL"].includes(record.status)) {
        const message = this.bankMessage(result);
        record.lastError = !message || message.toUpperCase() === "OK" ? "Payment was declined by the bank." : message;
      }
      this.save();
    } catch (error) {
      console.error("T-Bank Coin payment status failed:", error instanceof Error ? error.message : "unknown error");
    }
  }

  private createReward(record: CoinPaymentRecord): void {
    if (record.rewardCreatedAt) return;
    const reward = {
      id: record.orderId,
      orderId: record.orderId,
      paymentId: record.paymentId,
      characterId: record.characterId,
      itemId: "arena-coin",
      quantity: record.coinQuantity,
      amountKopecks: record.amountKopecks,
      createdAt: new Date().toISOString()
    };
    mkdirSync(this.rewardsDir, { recursive: true });
    this.writeJson(join(this.rewardsDir, `${record.orderId}.json`), reward);
    record.rewardCreatedAt = reward.createdAt;
    record.lastError = undefined;
  }

  private publicStatus(record?: CoinPaymentRecord): CoinPaymentPublicStatus {
    const pending = Boolean(record && ["NEW", "FORM_SHOWED", "AUTHORIZED"].includes(record.status));
    const paid = Boolean(record?.rewardCreatedAt);
    return {
      enabled: this.enabled(),
      mode: !this.enabled() ? "disabled" : this.terminalKey.toUpperCase().endsWith("DEMO") ? "demo" : "production",
      priceRub: 1,
      coinQuantity: 1,
      status: paid ? "paid" : pending ? "pending" : record ? "failed" : "none",
      orderId: record?.orderId,
      updatedAt: record?.updatedAt,
      lastError: record?.lastError
    };
  }

  private identity(token?: string): SessionIdentity {
    if (!token) throw new UnauthorizedException("Account session is required.");
    const [payload, signature] = token.split(".");
    if (!payload || !signature || this.hash(payload) !== signature) throw new UnauthorizedException("Account session is not valid.");
    let parsed: { sub?: string; authProvider?: string; characterId?: string; exp?: string };
    try {
      parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    } catch {
      throw new UnauthorizedException("Account session is not valid.");
    }
    if (parsed.authProvider !== "account" || !parsed.sub || !parsed.characterId || !parsed.exp || Date.parse(parsed.exp) <= Date.now()) {
      throw new UnauthorizedException("Account session is required.");
    }
    const accounts = this.accounts();
    const account = accounts.find((entry) => entry.id === parsed.sub && entry.character?.id === parsed.characterId);
    if (!account) throw new UnauthorizedException("Account session is not valid.");
    return { accountId: account.id, characterId: account.character.id, email: this.receiptEmail(account.login) };
  }

  private accounts(): Array<{ id: string; login: string; character: { id: string } }> {
    try {
      return JSON.parse(readFileSync(join(process.cwd(), "data", "accounts.json"), "utf8"));
    } catch {
      return [];
    }
  }

  private latest(accountId: string): CoinPaymentRecord | undefined {
    return [...this.records.values()]
      .filter((record) => record.accountId === accountId)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
  }

  private load(): void {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const records = JSON.parse(readFileSync(this.paymentsPath, "utf8")) as CoinPaymentRecord[];
      for (const record of records) if (record.orderId) this.records.set(record.orderId, record);
    } catch {
      this.records.clear();
    }
  }

  private save(): void {
    this.writeJson(this.paymentsPath, [...this.records.values()].slice(-500));
  }

  private async request(method: string, payload: Record<string, unknown>): Promise<Record<string, any>> {
    const body: Record<string, unknown> = { TerminalKey: this.terminalKey, ...payload };
    body.Token = this.token(body);
    try {
      const response = await fetch(`${this.apiUrl}/${method}`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      });
      const result = await response.json() as Record<string, any>;
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return result;
    } catch (error) {
      console.error(`T-Bank Coin ${method} failed:`, error instanceof Error ? error.message : "unknown error");
      throw new BadGatewayException("Could not connect to T-Bank.");
    }
  }

  private token(payload: Record<string, unknown>): string {
    const signed: Record<string, unknown> = { ...payload };
    delete signed.Token;
    signed.Password = this.password;
    const source = Object.keys(signed)
      .filter((key) => signed[key] !== undefined && signed[key] !== null && typeof signed[key] !== "object")
      .sort()
      .map((key) => typeof signed[key] === "boolean" ? (signed[key] ? "true" : "false") : String(signed[key]))
      .join("");
    return createHash("sha256").update(source).digest("hex");
  }

  private ensureEnabled(): void {
    if (!this.enabled()) throw new ServiceUnavailableException("Coin payment is temporarily unavailable.");
  }

  private enabled(): boolean {
    return Boolean(this.terminalKey && this.password);
  }

  private receipt(record: CoinPaymentRecord): Record<string, unknown> {
    return {
      Email: record.receiptEmail || "support@darkvell.ru",
      Taxation: this.receiptTaxation,
      Items: [
        {
          Name: "DarkVell Coin",
          Price: record.amountKopecks,
          Quantity: record.coinQuantity,
          Amount: record.amountKopecks,
          Tax: this.receiptTax,
          PaymentMethod: "full_payment",
          PaymentObject: "service",
          MeasurementUnit: "шт"
        }
      ]
    };
  }

  private receiptTaxationValue(value: string | undefined): "osn" | "usn_income" | "usn_income_outcome" | "esn" | "patent" {
    const normalized = value?.trim().toLowerCase();
    return normalized === "osn" || normalized === "usn_income" || normalized === "usn_income_outcome" || normalized === "esn" || normalized === "patent"
      ? normalized
      : "usn_income";
  }

  private receiptTaxValue(value: string | undefined): "none" | "vat0" | "vat5" | "vat7" | "vat10" | "vat22" | "vat105" | "vat107" | "vat110" | "vat122" {
    const normalized = value?.trim().toLowerCase();
    return normalized === "none" || normalized === "vat0" || normalized === "vat5" || normalized === "vat7" || normalized === "vat10" || normalized === "vat22" || normalized === "vat105" || normalized === "vat107" || normalized === "vat110" || normalized === "vat122"
      ? normalized
      : "none";
  }

  private receiptEmail(value: string): string {
    const email = value.trim().toLowerCase().slice(0, 64);
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email) ? email : "support@darkvell.ru";
  }

  private bankMessage(result: Record<string, any>): string {
    return this.clean(result.Message || result.Details || "T-Bank rejected the request.", 220);
  }

  private hash(value: string): string {
    return createHmac("sha256", this.sessionSecret).update(value).digest("base64url");
  }

  private clean(value: unknown, length: number): string {
    return String(value ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, length);
  }

  private writeJson(path: string, value: unknown): void {
    mkdirSync(dirname(path), { recursive: true });
    const temp = `${path}.${process.pid}.${Date.now()}.tmp`;
    writeFileSync(temp, JSON.stringify(value, null, 2), { mode: 0o600 });
    renameSync(temp, path);
  }
}
