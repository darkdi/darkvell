import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { BadGatewayException, BadRequestException, Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";

export type PremiumPlanId = "week" | "month";

interface SessionIdentity {
  accountId: string;
  characterId: string;
  login: string;
  email: string;
  characterName: string;
}

interface PremiumPayment {
  orderId: string;
  paymentId?: string;
  amountKopecks: number;
  planId: PremiumPlanId;
  kind: "setup" | "renewal";
  createdAt: string;
  status: string;
  paymentUrl?: string;
  appliedAt?: string;
  refundedAt?: string;
}

interface PremiumRecord {
  accountId: string;
  characterId: string;
  receiptEmail?: string;
  customerKey: string;
  planId: PremiumPlanId;
  status: "pending" | "trial" | "active" | "past_due" | "canceled";
  trialStartedAt?: string;
  premiumUntil?: string;
  nextChargeAt?: string;
  cancelAtPeriodEnd: boolean;
  rebillId?: string;
  cardId?: string;
  lastPaymentId?: string;
  lastError?: string;
  payments: PremiumPayment[];
  updatedAt: string;
}

export interface PremiumPublicStatus {
  enabled: boolean;
  mode: "disabled" | "demo" | "production";
  status: PremiumRecord["status"] | "none";
  planId?: PremiumPlanId;
  trialStartedAt?: string;
  premiumUntil?: string;
  nextChargeAt?: string;
  cancelAtPeriodEnd: boolean;
  active: boolean;
  canStartTrial: boolean;
  lastError?: string;
  plans: Array<{ id: PremiumPlanId; priceRub: number; periodDays: number }>;
  benefits: { xpMultiplier: number; goldMultiplier: number; rareLootMultiplier: number; restRegenMultiplier: number };
}

const PLANS = {
  week: { id: "week" as const, priceRub: 150, periodDays: 7 },
  month: { id: "month" as const, priceRub: 404, periodDays: 30 }
};
const TRIAL_MS = 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 15_000;

@Injectable()
export class PremiumService {
  private readonly terminalKey = process.env.TBANK_TERMINAL_KEY?.trim() ?? "";
  private readonly password = process.env.TBANK_PASSWORD ?? "";
  private readonly apiUrl = (process.env.TBANK_API_URL?.trim() || "https://securepay.tbank.ru/v2").replace(/\/$/, "");
  private readonly siteUrl = (process.env.PUBLIC_SITE_URL?.trim() || "https://darkvell.ru").replace(/\/$/, "");
  private readonly sessionSecret = process.env.AUTH_TOKEN_SECRET ?? "dev-secret-change-me";
  private readonly receiptEnabled = process.env.TBANK_RECEIPT_ENABLED?.trim() === "1";
  private readonly receiptTaxation = this.receiptTaxationValue(process.env.TBANK_RECEIPT_TAXATION);
  private readonly receiptTax = this.receiptTaxValue(process.env.TBANK_RECEIPT_TAX);
  private readonly subscriptionsPath = join(process.cwd(), "data", "premium-subscriptions.json");
  private readonly entitlementsPath = process.env.AUTH_PREMIUM_ENTITLEMENTS_PATH?.trim() || join(process.cwd(), "../game-server/data/premium-entitlements.json");
  private readonly records = new Map<string, PremiumRecord>();
  private loaded = false;
  private renewalTimer?: NodeJS.Timeout;
  private renewalRunning = false;

  constructor() {
    this.renewalTimer = setInterval(() => void this.processRenewals(), 60_000);
    this.renewalTimer.unref?.();
  }

  async status(token?: string): Promise<PremiumPublicStatus> {
    const identity = this.identity(token);
    this.load();
    const record = this.records.get(identity.accountId);
    if (record?.status === "pending") {
      await this.refreshPendingSetup(record);
    }
    return this.publicStatus(record);
  }

  async start(token: string | undefined, planId: unknown): Promise<{ paymentUrl: string; orderId: string; status: PremiumPublicStatus }> {
    this.ensureEnabled();
    const identity = this.identity(token);
    const plan = this.plan(planId);
    this.load();
    const existing = this.records.get(identity.accountId);
    if (existing?.trialStartedAt || existing?.rebillId) {
      throw new BadRequestException("Premium trial has already been used for this account.");
    }
    if (existing?.status === "pending") {
      const pending = [...existing.payments].reverse().find((payment) => payment.kind === "setup" && payment.paymentUrl);
      if (pending?.paymentUrl) {
        // The setup operation always verifies the card for the same refundable
        // 1 ₽. If the player changes the plan after opening the bank form, keep
        // the safe existing payment but persist the newly confirmed plan before
        // returning its URL. This avoids parallel card-link operations and makes
        // the first renewal use exactly the plan selected on the final click.
        if (existing.planId !== plan.id || pending.planId !== plan.id) {
          existing.planId = plan.id;
          pending.planId = plan.id;
          existing.lastError = undefined;
          existing.updatedAt = new Date().toISOString();
          this.save();
          this.writeEntitlements();
        }
        return { paymentUrl: pending.paymentUrl, orderId: pending.orderId, status: this.publicStatus(existing) };
      }
      throw new BadRequestException("Card linking is already in progress.");
    }

    const orderId = `DV-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`.slice(0, 50);
    // T-Bank's DEMO terminal does not issue a RebillId for a zero-ruble
    // AddCard check. A reversible 1 ₽ parent payment creates the reusable
    // credential; it is refunded immediately after confirmation. The first
    // subscription charge is still scheduled only after the 24-hour trial.
    const amountKopecks = 100;
    const customerKey = this.customerKey(identity.accountId);
    const payment: PremiumPayment = {
      orderId,
      amountKopecks,
      planId: plan.id,
      kind: "setup",
      createdAt: new Date().toISOString(),
      status: "NEW"
    };
    const record: PremiumRecord = {
      accountId: identity.accountId,
      characterId: identity.characterId,
      receiptEmail: identity.email,
      customerKey,
      planId: plan.id,
      status: "pending",
      cancelAtPeriodEnd: false,
      payments: [payment],
      updatedAt: new Date().toISOString()
    };
    this.records.set(identity.accountId, record);
    this.save();

    try {
      const result = await this.request("Init", {
        Amount: amountKopecks,
        OrderId: orderId,
        Description: "DarkVell Premium: проверка карты",
        CustomerKey: customerKey,
        Recurrent: "Y",
        OperationInitiatorType: "1",
        PayType: "O",
        DATA: { Email: identity.email, OrderNumber: orderId },
        ...(this.receiptEnabled ? { Receipt: this.receipt(record, payment) } : {}),
        SuccessURL: `${this.siteUrl}/?premium=success&order=${encodeURIComponent(orderId)}`,
        FailURL: `${this.siteUrl}/?premium=fail&order=${encodeURIComponent(orderId)}`,
        NotificationURL: `${this.siteUrl}/auth/premium/tbank/notification`
      });
      const paymentId = this.clean(result.PaymentId, 100);
      const paymentUrl = this.clean(result.PaymentURL, 2048);
      if (!result.Success || !paymentId || !paymentUrl.startsWith("https://")) {
        throw new BadGatewayException(this.bankMessage(result));
      }
      payment.paymentId = paymentId;
      payment.paymentUrl = paymentUrl;
      payment.status = this.clean(result.Status || "NEW", 40);
      record.updatedAt = new Date().toISOString();
      this.save();
      return { paymentUrl, orderId, status: this.publicStatus(record) };
    } catch (error) {
      this.records.delete(identity.accountId);
      this.save();
      throw error;
    }
  }

  async cancel(token?: string): Promise<PremiumPublicStatus> {
    const identity = this.identity(token);
    this.load();
    const record = this.records.get(identity.accountId);
    if (!record) {
      return this.publicStatus(undefined);
    }
    record.cancelAtPeriodEnd = true;
    record.status = this.isActive(record) ? record.status : "canceled";
    record.nextChargeAt = undefined;
    record.updatedAt = new Date().toISOString();
    this.save();
    this.writeEntitlements();
    await this.removeSavedCards(record);
    return this.publicStatus(record);
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
    const paymentId = this.clean(payload.PaymentId, 100);
    const status = this.clean(payload.Status, 40).toUpperCase();
    const success = payload.Success === true || payload.Success === "true";
    const match = [...this.records.values()]
      .map((record) => ({ record, payment: record.payments.find((payment) => payment.orderId === orderId && (!payment.paymentId || payment.paymentId === paymentId)) }))
      .find((entry) => entry.payment);
    if (!match?.payment) {
      return "OK";
    }
    const { record, payment } = match;
    const amount = Number(payload.Amount ?? 0);
    if (!Number.isFinite(amount) || amount !== payment.amountKopecks) {
      throw new BadRequestException("T-Bank notification amount mismatch.");
    }
    payment.paymentId = paymentId || payment.paymentId;
    payment.status = status || payment.status;
    record.lastPaymentId = payment.paymentId;
    const rebillId = this.clean(payload.RebillId ?? payload.RebillID, 200);
    const cardId = this.clean(payload.CardId ?? payload.CardID, 100);
    if (rebillId) record.rebillId = rebillId;
    if (cardId) record.cardId = cardId;

    if (success && status === "CONFIRMED" && (payment.kind === "renewal" || Boolean(record.rebillId))) {
      this.applyConfirmedPayment(record, payment);
    } else if (payment.kind === "setup" && payment.appliedAt && ["CANCELED", "REFUNDED", "REVERSED"].includes(status)) {
      payment.refundedAt ??= new Date().toISOString();
      record.lastError = undefined;
    } else if (["REJECTED", "CANCELED", "DEADLINE_EXPIRED"].includes(status)) {
      record.lastError = "Payment was declined by the bank.";
      if (payment.kind === "renewal") record.status = "past_due";
    }
    record.updatedAt = new Date().toISOString();
    this.save();
    this.writeEntitlements();
    if (payment.kind === "setup" && payment.appliedAt && !payment.refundedAt) {
      void this.refundSetupCheck(record, payment);
    }
    return "OK";
  }

  private async processRenewals(): Promise<void> {
    if (this.renewalRunning || !this.enabled()) return;
    this.renewalRunning = true;
    try {
      this.load();
      const now = Date.now();
      for (const record of this.records.values()) {
        const setup = record.payments.find((payment) => payment.kind === "setup" && payment.appliedAt && !payment.refundedAt);
        if (setup) await this.refundSetupCheck(record, setup);
        if (record.status === "pending") {
          await this.refreshPendingSetup(record);
          continue;
        }
        const due = Date.parse(record.nextChargeAt ?? "");
        if (!record.rebillId || record.cancelAtPeriodEnd || !Number.isFinite(due) || due > now) continue;
        const recentPending = record.payments.find((payment) => payment.kind === "renewal" && ["NEW", "AUTHORIZED"].includes(payment.status) && now - Date.parse(payment.createdAt) < 30 * 60 * 1000);
        if (recentPending) continue;
        await this.renew(record);
      }
    } finally {
      this.renewalRunning = false;
    }
  }

  private async refreshPendingSetup(record: PremiumRecord): Promise<void> {
    const payment = [...record.payments].reverse().find((entry) => entry.kind === "setup" && entry.paymentId);
    if (!payment?.paymentId) return;
    try {
      const result = await this.request("GetState", { PaymentId: payment.paymentId });
      const status = this.clean(result.Status || payment.status, 40).toUpperCase();
      payment.status = status;
      let rebillId = this.clean(result.RebillId ?? result.RebillID, 200);
      let cardId = this.clean(result.CardId ?? result.CardID, 100);
      if (result.Success && status === "CONFIRMED" && !rebillId) {
        const list = await this.request("GetCardList", { CustomerKey: record.customerKey });
        const cards = Array.isArray(list) ? list : Array.isArray(list.Cards) ? list.Cards : [];
        const card = cards.find((entry) => this.clean(entry?.Status, 10).toUpperCase() === "A" && this.clean(entry?.RebillId ?? entry?.RebillID, 200));
        rebillId = this.clean(card?.RebillId ?? card?.RebillID, 200);
        cardId = this.clean(card?.CardId ?? card?.CardID, 100);
      }
      if (rebillId) record.rebillId = rebillId;
      if (cardId) record.cardId = cardId;
      const success = result.Success === true || result.Success === "true";
      if (success && rebillId && ["COMPLETED", "CONFIRMED", "AUTHORIZED", "ACTIVE"].includes(status)) {
        this.applyConfirmedPayment(record, payment);
      } else if (["REJECTED", "CANCELED", "DEADLINE_EXPIRED"].includes(status)) {
        record.status = "canceled";
        record.lastError = this.bankMessage(result);
      }
      record.updatedAt = new Date().toISOString();
      this.save();
      this.writeEntitlements();
      if (payment.appliedAt && !payment.refundedAt) await this.refundSetupCheck(record, payment);
    } catch (error) {
      // Keep pending. The next status request/worker pass retries without ever
      // granting the entitlement on a network error.
      console.error("T-Bank setup status check failed:", error instanceof Error ? error.message : "unknown error");
    }
  }

  private async refundSetupCheck(record: PremiumRecord, payment: PremiumPayment): Promise<void> {
    if (!payment.paymentId || payment.refundedAt || payment.amountKopecks <= 0) return;
    try {
      const result = await this.request("Cancel", {
        PaymentId: payment.paymentId,
        Amount: payment.amountKopecks,
        ...(this.receiptEnabled ? { Receipt: this.receipt(record, payment) } : {})
      });
      if (!result.Success) throw new Error(this.bankMessage(result));
      payment.refundedAt = new Date().toISOString();
      record.updatedAt = new Date().toISOString();
      this.save();
    } catch (error) {
      console.error("T-Bank setup payment refund failed:", error instanceof Error ? error.message : "unknown error");
    }
  }

  private async removeSavedCards(record: PremiumRecord): Promise<void> {
    try {
      const list = await this.request("GetCardList", { CustomerKey: record.customerKey });
      const cards = Array.isArray(list) ? list : Array.isArray(list.Cards) ? list.Cards : [];
      for (const card of cards) {
        const cardId = this.clean(card?.CardId ?? card?.CardID, 100);
        if (cardId) await this.request("RemoveCard", { CustomerKey: record.customerKey, CardId: cardId });
      }
    } catch (error) {
      console.error("T-Bank saved card cleanup failed:", error instanceof Error ? error.message : "unknown error");
    }
  }

  private async renew(record: PremiumRecord): Promise<void> {
    const plan = PLANS[record.planId];
    const orderId = `DV-R-${Date.now().toString(36)}-${randomUUID().slice(0, 6)}`.slice(0, 50);
    const payment: PremiumPayment = {
      orderId,
      amountKopecks: plan.priceRub * 100,
      planId: plan.id,
      kind: "renewal",
      createdAt: new Date().toISOString(),
      status: "NEW"
    };
    record.payments.push(payment);
    record.payments = record.payments.slice(-30);
    try {
      const init = await this.request("Init", {
        Amount: payment.amountKopecks,
        OrderId: orderId,
        Description: `Продление DarkVell Premium: ${plan.id === "month" ? "30 дней" : "7 дней"}`,
        CustomerKey: record.customerKey,
        OperationInitiatorType: "R",
        PayType: "O",
        DATA: { Email: this.recordReceiptEmail(record), OrderNumber: orderId },
        ...(this.receiptEnabled ? { Receipt: this.receipt(record, payment) } : {}),
        NotificationURL: `${this.siteUrl}/auth/premium/tbank/notification`
      });
      const paymentId = this.clean(init.PaymentId, 100);
      if (!init.Success || !paymentId) throw new Error(this.bankMessage(init));
      payment.paymentId = paymentId;
      payment.status = this.clean(init.Status || "NEW", 40);
      const charged = await this.request("Charge", { PaymentId: paymentId, RebillId: record.rebillId });
      payment.status = this.clean(charged.Status || payment.status, 40);
      if (!charged.Success) throw new Error(this.bankMessage(charged));
      if (payment.status.toUpperCase() === "CONFIRMED") {
        this.applyConfirmedPayment(record, payment);
      }
      record.lastError = undefined;
    } catch (error) {
      record.status = "past_due";
      record.lastError = error instanceof Error ? error.message.slice(0, 180) : "Renewal failed.";
      record.nextChargeAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    }
    record.updatedAt = new Date().toISOString();
    this.save();
    this.writeEntitlements();
  }

  private applyConfirmedPayment(record: PremiumRecord, payment: PremiumPayment): void {
    if (payment.appliedAt) return;
    const now = Date.now();
    if (payment.kind === "setup") {
      record.trialStartedAt = new Date(now).toISOString();
      record.premiumUntil = new Date(now + TRIAL_MS).toISOString();
      record.nextChargeAt = new Date(now + TRIAL_MS).toISOString();
      record.status = "trial";
    } else {
      const base = Math.max(now, Date.parse(record.premiumUntil ?? "") || 0);
      record.premiumUntil = new Date(base + PLANS[payment.planId].periodDays * 24 * 60 * 60 * 1000).toISOString();
      record.nextChargeAt = new Date(record.premiumUntil).toISOString();
      record.status = "active";
    }
    payment.appliedAt = new Date(now).toISOString();
    record.lastError = undefined;
  }

  private publicStatus(record?: PremiumRecord): PremiumPublicStatus {
    const active = Boolean(record && this.isActive(record));
    return {
      enabled: this.enabled(),
      mode: !this.enabled() ? "disabled" : this.terminalKey.toUpperCase().endsWith("DEMO") ? "demo" : "production",
      status: record?.status ?? "none",
      planId: record?.planId,
      trialStartedAt: record?.trialStartedAt,
      premiumUntil: record?.premiumUntil,
      nextChargeAt: record?.nextChargeAt,
      cancelAtPeriodEnd: record?.cancelAtPeriodEnd ?? false,
      active,
      canStartTrial: !record?.trialStartedAt && !record?.rebillId,
      lastError: record?.lastError,
      plans: Object.values(PLANS),
      benefits: { xpMultiplier: 2, goldMultiplier: 2, rareLootMultiplier: 1.5, restRegenMultiplier: 2 }
    };
  }

  private isActive(record: PremiumRecord): boolean {
    return Date.parse(record.premiumUntil ?? "") > Date.now() && ["trial", "active", "past_due"].includes(record.status);
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
    return {
      accountId: account.id,
      characterId: account.character.id,
      login: account.login,
      email: this.receiptEmail(account.login),
      characterName: account.character.name
    };
  }

  private accounts(): Array<{ id: string; login: string; character: { id: string; name: string } }> {
    try {
      return JSON.parse(readFileSync(join(process.cwd(), "data", "accounts.json"), "utf8"));
    } catch {
      return [];
    }
  }

  private plan(value: unknown): (typeof PLANS)[PremiumPlanId] {
    if (value === "week" || value === "month") return PLANS[value];
    throw new BadRequestException("Choose a Premium plan.");
  }

  private ensureEnabled(): void {
    if (!this.enabled()) throw new ServiceUnavailableException("Premium payment is temporarily unavailable.");
  }

  private enabled(): boolean {
    return Boolean(this.terminalKey && this.password);
  }

  private customerKey(accountId: string): string {
    return `darkvell-${createHash("sha256").update(accountId).digest("hex").slice(0, 32)}`;
  }

  private receipt(record: PremiumRecord, payment: PremiumPayment): Record<string, unknown> {
    const plan = PLANS[payment.planId];
    const name = payment.kind === "setup"
      ? "DarkVell Premium — проверка карты"
      : `DarkVell Premium — ${plan.periodDays} дней`;
    return {
      Email: this.recordReceiptEmail(record),
      Taxation: this.receiptTaxation,
      Items: [
        {
          Name: name,
          Price: payment.amountKopecks,
          Quantity: 1,
          Amount: payment.amountKopecks,
          Tax: this.receiptTax,
          PaymentMethod: "full_payment",
          PaymentObject: "service",
          MeasurementUnit: "шт"
        }
      ]
    };
  }

  private recordReceiptEmail(record: PremiumRecord): string {
    if (record.receiptEmail) return this.receiptEmail(record.receiptEmail);
    const account = this.accounts().find((entry) => entry.id === record.accountId);
    const email = this.receiptEmail(account?.login ?? "");
    record.receiptEmail = email;
    return email;
  }

  private receiptEmail(value: string): string {
    const email = value.trim().toLowerCase().slice(0, 64);
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email) ? email : "support@darkvell.ru";
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
      console.error(`T-Bank ${method} failed:`, error instanceof Error ? error.message : "unknown error");
      throw new BadGatewayException("Could not connect to T-Bank.");
    }
  }

  private bankMessage(result: Record<string, any>): string {
    return this.clean(result.Message || result.Details || "T-Bank rejected the request.", 220);
  }

  private load(): void {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const parsed = JSON.parse(readFileSync(this.subscriptionsPath, "utf8")) as PremiumRecord[];
      for (const record of parsed) if (record.accountId) this.records.set(record.accountId, record);
    } catch {
      this.records.clear();
    }
    this.writeEntitlements();
  }

  private save(): void {
    this.writeJson(this.subscriptionsPath, [...this.records.values()]);
  }

  private writeEntitlements(): void {
    const entitlements = [...this.records.values()].map((record) => ({
      characterId: record.characterId,
      activeUntil: this.isActive(record) ? record.premiumUntil : undefined,
      planId: record.planId,
      cancelAtPeriodEnd: record.cancelAtPeriodEnd,
      updatedAt: record.updatedAt
    }));
    this.writeJson(this.entitlementsPath, entitlements);
  }

  private writeJson(path: string, value: unknown): void {
    mkdirSync(dirname(path), { recursive: true });
    const temp = `${path}.${process.pid}.tmp`;
    writeFileSync(temp, JSON.stringify(value, null, 2), { mode: 0o600 });
    renameSync(temp, path);
  }

  private hash(value: string): string {
    return createHmac("sha256", this.sessionSecret).update(value).digest("base64url");
  }

  private clean(value: unknown, length: number): string {
    return String(value ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, length);
  }
}
