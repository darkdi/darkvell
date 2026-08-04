import { Body, Controller, Get, Headers, Inject, Post } from "@nestjs/common";
import type { CharacterClass, CharacterRace } from "@mmo/shared";
import { AuthService } from "./auth.service.js";

interface TelegramLoginBody {
  initData?: string;
  username?: string;
  telegramId?: string;
}

type AuthLocale = "ru" | "en";

@Controller()
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

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

  @Get("/admin/characters")
  adminCharacters(@Headers("authorization") authorization?: string) {
    const token = authorization?.replace(/^Bearer\s+/i, "").trim();
    return this.auth.adminCharacters(token);
  }
}
