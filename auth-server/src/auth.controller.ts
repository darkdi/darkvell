import { Body, Controller, Get, Header, Headers, Inject, Post } from "@nestjs/common";
import type { CharacterClass, CharacterRace } from "@mmo/shared";
import { AuthService } from "./auth.service.js";
import { PremiumService, type PremiumPlanId } from "./premium.service.js";
import { CoinPaymentService } from "./coin-payment.service.js";

interface TelegramLoginBody {
  initData?: string;
  username?: string;
  telegramId?: string;
}

type AuthLocale = "ru" | "en";

@Controller()
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(PremiumService) private readonly premium: PremiumService,
    @Inject(CoinPaymentService) private readonly coinPayment: CoinPaymentService
  ) {}

  @Get("/health")
  health() {
    return {
      ok: true,
      service: "auth-server"
    };
  }

  @Post("/telegram/login")
  telegramLogin(@Body() body: TelegramLoginBody) {
    return this.auth.issueTelegramSession(body);
  }

  @Post("/guest/login")
  guestLogin(@Body() body: { username?: string }) {
    return this.auth.issueGuestSession(body.username);
  }

  @Post("/account/register/request-code")
  accountRegisterCode(
    @Body()
    body: {
      login?: string;
      password?: string;
      characterName?: string;
      characterId?: string;
      classId?: CharacterClass;
      race?: CharacterRace;
      face?: number;
      locale?: AuthLocale;
    }
  ) {
    return this.auth.requestRegistrationCode(body);
  }

  @Post("/account/register")
  accountRegister(
    @Body()
    body: {
      login?: string;
      password?: string;
      characterName?: string;
      characterId?: string;
      classId?: CharacterClass;
      race?: CharacterRace;
      face?: number;
      emailCode?: string;
      locale?: AuthLocale;
    }
  ) {
    return this.auth.register(body);
  }

  @Post("/account/login")
  accountLogin(@Body() body: { login?: string; password?: string; locale?: AuthLocale }) {
    return this.auth.login(body);
  }

  @Post("/account/session/refresh")
  accountSessionRefresh(@Headers("authorization") authorization?: string) {
    return this.auth.refreshAccountSession(authorization?.replace(/^Bearer\s+/i, "").trim());
  }

  @Post("/account/password/reset/request-code")
  accountPasswordResetCode(@Body() body: { login?: string; locale?: AuthLocale }) {
    return this.auth.requestPasswordResetCode(body);
  }

  @Post("/account/password/reset")
  accountPasswordReset(@Body() body: { login?: string; password?: string; emailCode?: string; locale?: AuthLocale }) {
    return this.auth.resetPassword(body);
  }

  @Post("/account/character/rename")
  accountCharacterRename(@Body() body: { token?: string; characterName?: string }) {
    return this.auth.renameCharacter(body);
  }

  @Post("/account/character/head")
  accountCharacterHead(@Body() body: { token?: string; imageData?: string; clear?: boolean }) {
    return this.auth.updateCharacterHead(body);
  }

  @Get("/premium/status")
  premiumStatus(@Headers("authorization") authorization?: string) {
    return this.premium.status(authorization?.replace(/^Bearer\s+/i, "").trim());
  }

  @Post("/premium/start")
  premiumStart(
    @Headers("authorization") authorization: string | undefined,
    @Body() body: { planId?: PremiumPlanId }
  ) {
    return this.premium.start(authorization?.replace(/^Bearer\s+/i, "").trim(), body.planId);
  }

  @Post("/premium/cancel")
  premiumCancel(@Headers("authorization") authorization?: string) {
    return this.premium.cancel(authorization?.replace(/^Bearer\s+/i, "").trim());
  }

  @Post("/premium/tbank/notification")
  @Header("content-type", "text/plain; charset=utf-8")
  premiumTbankNotification(@Body() body: Record<string, unknown>) {
    return this.premium.notification(body);
  }

  @Get("/coin-shop/status")
  coinShopStatus(@Headers("authorization") authorization?: string) {
    return this.coinPayment.status(authorization?.replace(/^Bearer\s+/i, "").trim());
  }

  @Post("/coin-shop/start")
  coinShopStart(@Headers("authorization") authorization?: string) {
    return this.coinPayment.start(authorization?.replace(/^Bearer\s+/i, "").trim());
  }

  @Post("/coin-shop/tbank/notification")
  @Header("content-type", "text/plain; charset=utf-8")
  coinShopTbankNotification(@Body() body: Record<string, unknown>) {
    return this.coinPayment.notification(body);
  }

  @Get("/admin/characters")
  adminCharacters(@Headers("authorization") authorization?: string) {
    const token = authorization?.replace(/^Bearer\s+/i, "").trim();
    return this.auth.adminCharacters(token);
  }
}
