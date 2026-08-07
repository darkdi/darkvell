import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createConnection, type Socket } from "node:net";
import { dirname, join } from "node:path";
import { connect as createTlsConnection, type TLSSocket } from "node:tls";
import { inflateSync } from "node:zlib";
import { BadRequestException, ConflictException, Injectable, InternalServerErrorException, UnauthorizedException } from "@nestjs/common";
import { CHARACTER_FACE_VARIANT_COUNT, CLASS_DEFINITIONS, type CharacterClass, type CharacterRace } from "@mmo/shared";

interface AccountRecord {
  id: string;
  login: string;
  passwordHash: string;
  character: {
    id: string;
    name: string;
    classId: CharacterClass;
    race: CharacterRace;
    face: number;
    customHeadUrl?: string;
  };
  createdAt: string;
}

interface PendingEmailCode {
  codeHash: string;
  expiresAt: number;
  sentAt: number;
  attempts: number;
}

interface RegistrationDraft {
  login: string;
  password: string;
  characterName: string;
  characterId?: string;
  classId: CharacterClass;
  race: CharacterRace;
  face: number;
}

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

type SmtpSocket = Socket | TLSSocket;
type AuthLocale = "ru" | "en";

interface SessionTokenPayload {
  sub?: string;
  username?: string;
  authProvider?: string;
  characterId?: string;
  exp?: string;
}

export interface SessionResponse {
  token: string;
  player: {
    id: string;
    username: string;
    authProvider: "telegram" | "guest" | "account";
    character?: AccountRecord["character"];
  };
  expiresAt: string;
}

interface PersistedCharacterSummary {
  characterId: string;
  name: string;
  classId: CharacterClass;
  race?: CharacterRace;
  level: number;
  xp: number;
  gold: number;
  karma?: number;
  pkCount?: number;
  pvpCount?: number;
  clanId?: string;
  arenaRating?: number;
  arenaWins?: number;
  arenaLosses?: number;
  inventory?: unknown[];
  equipment?: Record<string, unknown>;
  firstSeenAt?: number;
  lastSeenAt?: number;
}

export interface AdminCharacterRow {
  characterId: string;
  name: string;
  classId: CharacterClass;
  race: CharacterRace;
  level: number;
  xp: number;
  gold: number;
  karma: number;
  pkCount: number;
  pvpCount: number;
  clanId?: string;
  arenaRating: number;
  arenaWins: number;
  arenaLosses: number;
  inventoryCount: number;
  equipmentCount: number;
  firstSeenAt?: number;
  lastSeenAt?: number;
  accountLogin?: string;
  accountCreatedAt?: string;
  registered: boolean;
}

@Injectable()
export class AuthService {
  private readonly secret = process.env.AUTH_TOKEN_SECRET ?? "dev-secret-change-me";
  private readonly accountsPath = join(process.cwd(), "data", "accounts.json");
  private readonly accounts = new Map<string, AccountRecord>();
  private readonly pendingEmailCodes = new Map<string, PendingEmailCode>();
  private readonly pendingPasswordResetCodes = new Map<string, PendingEmailCode>();
  private loaded = false;

  async requestRegistrationCode(input: {
    login?: string;
    password?: string;
    characterName?: string;
    characterId?: string;
    classId?: CharacterClass;
    race?: CharacterRace;
    face?: number;
    locale?: AuthLocale;
  }): Promise<{ ok: true; expiresInSeconds: number; message: string }> {
    this.loadAccounts();
    const locale = this.authLocale(input.locale);
    const draft = this.registrationDraft(input);
    const existing = this.pendingEmailCodes.get(draft.login);
    const now = Date.now();
    if (existing && existing.sentAt + 45_000 > now) {
      throw new BadRequestException("Please wait before requesting another code.");
    }

    const code = String(randomInt(100_000, 1_000_000));
    this.pendingEmailCodes.set(draft.login, {
      codeHash: this.emailCodeHash(draft.login, code),
      expiresAt: now + 1000 * 60 * 10,
      sentAt: now,
      attempts: 0
    });

    try {
      await this.sendRegistrationCode(draft.login, code, draft.characterName, locale);
    } catch (error) {
      this.pendingEmailCodes.delete(draft.login);
      console.error("registration email failed", error);
      throw new InternalServerErrorException("Could not send email code.");
    }

    return {
      ok: true,
      expiresInSeconds: 600,
      // Keep the API payload canonical so the client can re-render it after a live language switch.
      // The email itself is localized with `locale`.
      message: "Verification code sent."
    };
  }

  register(input: {
    login?: string;
    password?: string;
    characterName?: string;
    characterId?: string;
    classId?: CharacterClass;
    race?: CharacterRace;
    face?: number;
    emailCode?: string;
  }): SessionResponse {
    this.loadAccounts();
    const draft = this.registrationDraft(input);
    this.verifyEmailCode(draft.login, input.emailCode);

    const id = `acc_${randomUUID()}`;
    const account: AccountRecord = {
      id,
      login: draft.login,
      passwordHash: this.passwordHash(draft.password),
      character: {
        id: draft.characterId ?? `char_${this.hash(`${id}:${draft.characterName}`).slice(0, 24)}`,
        name: draft.characterName,
        classId: draft.classId,
        race: draft.race,
        face: draft.face
      },
      createdAt: new Date().toISOString()
    };
    this.accounts.set(draft.login, account);
    this.pendingEmailCodes.delete(draft.login);
    this.saveAccounts();
    return this.session(account.id, account.character.name, "account", undefined, account.character);
  }

  login(input: { login?: string; password?: string }): SessionResponse {
    this.loadAccounts();
    const login = this.cleanLogin(input.login);
    const password = this.cleanPassword(input.password);
    const account = login ? this.accounts.get(login) : undefined;
    if (!account || account.passwordHash !== this.passwordHash(password)) {
      throw new UnauthorizedException("Wrong login or password.");
    }

    return this.session(account.id, account.character.name, "account", undefined, account.character);
  }

  async requestPasswordResetCode(input: {
    login?: string;
    locale?: AuthLocale;
  }): Promise<{ ok: true; expiresInSeconds: number; message: string }> {
    this.loadAccounts();
    const locale = this.authLocale(input.locale);
    const login = this.cleanLogin(input.login);
    if (!login || !this.isValidEmail(login)) {
      throw new BadRequestException("Enter the account email.");
    }

    const account = this.accounts.get(login);
    const existing = this.pendingPasswordResetCodes.get(login);
    const now = Date.now();
    if (existing && existing.sentAt + 45_000 > now) {
      throw new BadRequestException("Please wait before requesting another code.");
    }

    if (account) {
      const code = String(randomInt(100_000, 1_000_000));
      this.pendingPasswordResetCodes.set(login, {
        codeHash: this.passwordResetCodeHash(login, code),
        expiresAt: now + 1000 * 60 * 10,
        sentAt: now,
        attempts: 0
      });

      try {
        await this.sendPasswordResetCode(login, code, account.character.name, locale);
      } catch (error) {
        this.pendingPasswordResetCodes.delete(login);
        console.error("password reset email failed", error);
        throw new InternalServerErrorException("Could not send password reset code.");
      }
    }

    return {
      ok: true,
      expiresInSeconds: 600,
      message: "If this email has an account, a reset code was sent."
    };
  }

  resetPassword(input: { login?: string; password?: string; emailCode?: string }): SessionResponse {
    this.loadAccounts();
    const login = this.cleanLogin(input.login);
    const password = this.cleanPassword(input.password);
    if (!login || !this.isValidEmail(login)) {
      throw new BadRequestException("Enter the account email.");
    }
    if (password.length < 6) {
      throw new BadRequestException("Password must be at least 6 characters.");
    }

    const account = this.accounts.get(login);
    if (!account) {
      throw new BadRequestException("Email code expired. Request a new one.");
    }

    this.verifyPasswordResetCode(login, input.emailCode);
    account.passwordHash = this.passwordHash(password);
    this.pendingPasswordResetCodes.delete(login);
    this.saveAccounts();
    return this.session(account.id, account.character.name, "account", undefined, account.character);
  }

  renameCharacter(input: { token?: string; characterName?: string }): SessionResponse {
    this.loadAccounts();
    const account = this.accountFromSession(input.token);

    const characterName = this.cleanName(input.characterName ?? "");
    if (!input.characterName?.trim()) {
      throw new BadRequestException("Character name is required.");
    }
    if (
      [...this.accounts.values()].some(
        (candidate) => candidate.id !== account.id && this.nameKey(candidate.character.name) === this.nameKey(characterName)
      )
    ) {
      throw new ConflictException("Character name is already taken.");
    }

    account.character.name = characterName;
    this.saveAccounts();
    return this.session(account.id, account.character.name, "account", undefined, account.character);
  }

  updateCharacterHead(input: { token?: string; imageData?: string; clear?: boolean }): SessionResponse {
    this.loadAccounts();
    const account = this.accountFromSession(input.token);

    if (input.clear) {
      account.character.customHeadUrl = undefined;
      this.saveAccounts();
      return this.session(account.id, account.character.name, "account", undefined, account.character);
    }

    const buffer = this.validatedHeadPng(input.imageData);
    const uploadDir = this.headUploadDir();
    const fileName = `${this.safeHeadFileName(account.character.id)}.png`;
    mkdirSync(uploadDir, { recursive: true });
    writeFileSync(join(uploadDir, fileName), buffer);

    account.character.customHeadUrl = `/uploads/heads/${fileName}?v=${Date.now()}`;
    this.saveAccounts();
    return this.session(account.id, account.character.name, "account", undefined, account.character);
  }

  adminCharacters(token?: string): {
    generatedAt: string;
    summary: {
      total: number;
      registered: number;
      withoutAccount: number;
      activeLast24h: number;
      activeLast7d: number;
      maxLevel: number;
      totalGold: number;
    };
    characters: AdminCharacterRow[];
  } {
    this.loadAccounts();
    this.adminAccountFromSession(token);

    const savedCharacters = this.readPersistedCharacters();
    const accountsByCharacterId = new Map([...this.accounts.values()].map((account) => [account.character.id, account]));
    const charactersById = new Map<string, AdminCharacterRow>();

    for (const saved of savedCharacters) {
      const account = accountsByCharacterId.get(saved.characterId);
      charactersById.set(saved.characterId, {
        characterId: saved.characterId,
        name: saved.name || account?.character.name || "Unknown",
        classId: saved.classId || account?.character.classId || "warrior",
        race: saved.race || account?.character.race || "human",
        level: Math.max(1, Math.trunc(saved.level || 1)),
        xp: Math.max(0, Math.trunc(saved.xp || 0)),
        gold: Math.max(0, Math.trunc(saved.gold || 0)),
        karma: Math.trunc(saved.karma || 0),
        pkCount: Math.max(0, Math.trunc(saved.pkCount || 0)),
        pvpCount: Math.max(0, Math.trunc(saved.pvpCount || 0)),
        clanId: saved.clanId,
        arenaRating: Math.max(0, Math.trunc(saved.arenaRating || 0)),
        arenaWins: Math.max(0, Math.trunc(saved.arenaWins || 0)),
        arenaLosses: Math.max(0, Math.trunc(saved.arenaLosses || 0)),
        inventoryCount: Array.isArray(saved.inventory) ? saved.inventory.length : 0,
        equipmentCount: saved.equipment ? Object.values(saved.equipment).filter(Boolean).length : 0,
        accountLogin: account?.login,
        firstSeenAt: saved.firstSeenAt,
        lastSeenAt: saved.lastSeenAt,
        accountCreatedAt: account?.createdAt,
        registered: Boolean(account)
      });
    }

    for (const account of this.accounts.values()) {
      if (charactersById.has(account.character.id)) {
        continue;
      }
      charactersById.set(account.character.id, {
        characterId: account.character.id,
        name: account.character.name,
        classId: account.character.classId,
        race: account.character.race,
        level: 1,
        xp: 0,
        gold: 0,
        karma: 0,
        pkCount: 0,
        pvpCount: 0,
        arenaRating: 0,
        arenaWins: 0,
        arenaLosses: 0,
        inventoryCount: 0,
        equipmentCount: 0,
        accountLogin: account.login,
        accountCreatedAt: account.createdAt,
        registered: true
      });
    }

    // Who played most recently is the question this directory is opened to
    // answer, so it leads the ordering. Characters saved before last-seen
    // tracking existed have no timestamp and fall to the bottom, still ordered
    // by level.
    const characters = [...charactersById.values()].sort(
      (left, right) =>
        (right.lastSeenAt ?? 0) - (left.lastSeenAt ?? 0) ||
        right.level - left.level ||
        right.gold - left.gold ||
        left.name.localeCompare(right.name)
    );
    const registered = characters.filter((character) => character.registered).length;
    const now = Date.now();
    const activeSince = (windowMs: number) =>
      characters.filter((character) => character.lastSeenAt !== undefined && now - character.lastSeenAt <= windowMs).length;
    return {
      generatedAt: new Date().toISOString(),
      summary: {
        total: characters.length,
        registered,
        withoutAccount: characters.length - registered,
        activeLast24h: activeSince(24 * 60 * 60 * 1000),
        activeLast7d: activeSince(7 * 24 * 60 * 60 * 1000),
        maxLevel: characters.reduce((max, character) => Math.max(max, character.level), 0),
        totalGold: characters.reduce((total, character) => total + character.gold, 0)
      },
      characters
    };
  }

  issueTelegramSession(input: { initData?: string; username?: string; telegramId?: string }): SessionResponse {
    const username = this.cleanName(input.username ?? "telegram_player");
    const id = input.telegramId ? `tg_${input.telegramId}` : `tg_${randomUUID()}`;

    return this.session(id, username, "telegram", input.initData);
  }

  issueGuestSession(username?: string): SessionResponse {
    return this.session(`guest_${randomUUID()}`, this.cleanName(username ?? "guest"), "guest");
  }

  private session(
    id: string,
    username: string,
    authProvider: "telegram" | "guest" | "account",
    initData?: string,
    character?: AccountRecord["character"]
  ): SessionResponse {
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 12).toISOString();
    const payload = Buffer.from(
      JSON.stringify({
        sub: id,
        username,
        authProvider,
        characterId: character?.id,
        initDataHash: initData ? this.hash(initData) : undefined,
        exp: expiresAt
      })
    ).toString("base64url");
    const signature = this.hash(payload);

    return {
      token: `${payload}.${signature}`,
      player: {
        id,
        username,
        authProvider,
        character
      },
      expiresAt
    };
  }

  private loadAccounts(): void {
    if (this.loaded) {
      return;
    }

    this.loaded = true;
    try {
      const parsed = JSON.parse(readFileSync(this.accountsPath, "utf8")) as AccountRecord[];
      for (const account of parsed) {
        if (account.login) {
          this.accounts.set(account.login, account);
        }
      }
    } catch {
      this.accounts.clear();
    }
  }

  private saveAccounts(): void {
    mkdirSync(dirname(this.accountsPath), { recursive: true });
    writeFileSync(this.accountsPath, JSON.stringify([...this.accounts.values()], null, 2));
  }

  private accountFromSession(token?: string): AccountRecord {
    const payload = this.verifySessionToken(token);
    if (payload.authProvider !== "account" || !payload.sub) {
      throw new UnauthorizedException("Account session is required.");
    }

    const account = [...this.accounts.values()].find((candidate) => candidate.id === payload.sub || candidate.character.id === payload.characterId);
    if (!account) {
      throw new UnauthorizedException("Account session is not valid.");
    }
    return account;
  }

  private adminAccountFromSession(token?: string): AccountRecord {
    const account = this.accountFromSession(token);
    const configuredNames = (process.env.AUTH_ADMIN_NAMES ?? "unit,houston")
      .split(",")
      .map((name) => this.nameKey(name))
      .filter(Boolean);
    if (!configuredNames.includes(this.nameKey(account.character.name))) {
      throw new UnauthorizedException("Admin access is required.");
    }
    return account;
  }

  private gameCharactersPath(): string {
    const configured = process.env.AUTH_GAME_CHARACTERS_PATH?.trim();
    if (configured) {
      return configured;
    }
    const siblingPath = join(process.cwd(), "..", "game-server", "data", "characters.json");
    return existsSync(siblingPath) ? siblingPath : join(process.cwd(), "game-server", "data", "characters.json");
  }

  private readPersistedCharacters(): PersistedCharacterSummary[] {
    try {
      const parsed = JSON.parse(readFileSync(this.gameCharactersPath(), "utf8")) as unknown;
      return Array.isArray(parsed)
        ? parsed.filter(
            (character): character is PersistedCharacterSummary =>
              Boolean(
                character &&
                  typeof character === "object" &&
                  "characterId" in character &&
                  typeof character.characterId === "string" &&
                  "name" in character &&
                  typeof character.name === "string"
              )
          )
        : [];
    } catch (error) {
      console.error("admin character directory read failed", error);
      throw new InternalServerErrorException("Could not read character directory.");
    }
  }

  private cleanName(name: string): string {
    const cleaned = name
      .trim()
      .replace(/[^\p{L}\p{N}_ -]/gu, "")
      .replace(/\s+/g, " ")
      .slice(0, 18);
    return cleaned || "player";
  }

  private cleanLogin(login?: string): string {
    return (login ?? "").trim().toLowerCase().replace(/[^a-z0-9_.@%+-]/g, "").slice(0, 72);
  }

  private cleanPassword(password?: string): string {
    return (password ?? "").slice(0, 72);
  }

  private authLocale(locale?: string): AuthLocale {
    return locale === "en" ? "en" : "ru";
  }

  private cleanCharacterId(characterId?: string): string | undefined {
    const cleaned = (characterId ?? "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
    return cleaned.length >= 8 ? cleaned : undefined;
  }

  private safeHeadFileName(characterId: string): string {
    return characterId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || `char_${randomUUID()}`;
  }

  private headUploadDir(): string {
    const configured = process.env.AUTH_HEAD_UPLOAD_DIR?.trim();
    if (configured) {
      return configured;
    }
    if (existsSync("/var/www/darkvell")) {
      return "/var/www/darkvell/uploads/heads";
    }
    const repoClientPublic = join(process.cwd(), "client", "public");
    if (existsSync(repoClientPublic)) {
      return join(repoClientPublic, "uploads", "heads");
    }
    return join(process.cwd(), "public", "uploads", "heads");
  }

  private validatedHeadPng(imageData?: string): Buffer {
    const raw = imageData?.trim() ?? "";
    const match = /^data:image\/png;base64,([\s\S]+)$/i.exec(raw);
    const base64 = (match ? match[1] : raw).replace(/\s+/g, "");
    if (!base64 || !/^[a-zA-Z0-9+/]+={0,2}$/.test(base64)) {
      throw new BadRequestException("Upload a PNG image.");
    }

    const buffer = Buffer.from(base64, "base64");
    if (buffer.length < 1024 || buffer.length > 650_000) {
      throw new BadRequestException("PNG must be between 1 KB and 650 KB.");
    }
    if (!buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
      throw new BadRequestException("Upload a PNG image.");
    }
    if (buffer.length < 33 || buffer.toString("ascii", 12, 16) !== "IHDR") {
      throw new BadRequestException("PNG header is invalid.");
    }

    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    const bitDepth = buffer[24];
    const colorType = buffer[25];
    const interlace = buffer[28];
    if (width < 128 || height < 128 || width > 1024 || height > 1024 || Math.abs(width - height) > Math.max(8, width * 0.04)) {
      throw new BadRequestException("Use a square PNG face, 128-1024 px.");
    }
    if (bitDepth !== 8 || colorType !== 6 || interlace !== 0) {
      throw new BadRequestException("Use an 8-bit RGBA PNG with transparent background.");
    }

    this.validateHeadComposition(buffer, width, height);
    return buffer;
  }

  private validateHeadComposition(buffer: Buffer, width: number, height: number): void {
    const idatChunks: Buffer[] = [];
    let offset = 8;
    while (offset + 12 <= buffer.length) {
      const length = buffer.readUInt32BE(offset);
      const type = buffer.toString("ascii", offset + 4, offset + 8);
      const dataStart = offset + 8;
      const dataEnd = dataStart + length;
      if (dataEnd + 4 > buffer.length) {
        throw new BadRequestException("PNG data is invalid.");
      }
      if (type === "IDAT") {
        idatChunks.push(buffer.subarray(dataStart, dataEnd));
      }
      if (type === "IEND") {
        break;
      }
      offset = dataEnd + 4;
    }
    if (idatChunks.length === 0) {
      throw new BadRequestException("PNG data is invalid.");
    }

    const bytesPerPixel = 4;
    const rowLength = width * bytesPerPixel;
    let raw: Buffer;
    try {
      raw = inflateSync(Buffer.concat(idatChunks));
    } catch {
      throw new BadRequestException("PNG data is invalid.");
    }
    if (raw.length < (rowLength + 1) * height) {
      throw new BadRequestException("PNG data is invalid.");
    }

    let sourceOffset = 0;
    let previousRow = Buffer.alloc(rowLength);
    let opaquePixels = 0;
    let edgeOpaquePixels = 0;
    let edgePixels = 0;
    let centerOpaquePixels = 0;
    let centerPixels = 0;
    let solidRows = 0;

    for (let y = 0; y < height; y += 1) {
      const filter = raw[sourceOffset];
      sourceOffset += 1;
      if (filter > 4) {
        throw new BadRequestException("PNG data is invalid.");
      }
      const row = Buffer.from(raw.subarray(sourceOffset, sourceOffset + rowLength));
      sourceOffset += rowLength;
      for (let index = 0; index < rowLength; index += 1) {
        const left = index >= bytesPerPixel ? row[index - bytesPerPixel] : 0;
        const up = previousRow[index] ?? 0;
        const upLeft = index >= bytesPerPixel ? previousRow[index - bytesPerPixel] ?? 0 : 0;
        let value = row[index];
        if (filter === 1) {
          value += left;
        } else if (filter === 2) {
          value += up;
        } else if (filter === 3) {
          value += Math.floor((left + up) / 2);
        } else if (filter === 4) {
          const estimate = left + up - upLeft;
          const leftDistance = Math.abs(estimate - left);
          const upDistance = Math.abs(estimate - up);
          const upLeftDistance = Math.abs(estimate - upLeft);
          value += leftDistance <= upDistance && leftDistance <= upLeftDistance ? left : upDistance <= upLeftDistance ? up : upLeft;
        }
        row[index] = value & 0xff;
      }

      let rowOpaquePixels = 0;
      for (let x = 0; x < width; x += 1) {
        const opaque = row[x * bytesPerPixel + 3] > 28;
        if (opaque) {
          opaquePixels += 1;
          rowOpaquePixels += 1;
        }

        const nearEdge = x < width * 0.12 || x > width * 0.88 || y < height * 0.12 || y > height * 0.88;
        if (nearEdge) {
          edgePixels += 1;
          if (opaque) {
            edgeOpaquePixels += 1;
          }
        }

        const inCenter = x > width * 0.28 && x < width * 0.72 && y > height * 0.22 && y < height * 0.72;
        if (inCenter) {
          centerPixels += 1;
          if (opaque) {
            centerOpaquePixels += 1;
          }
        }
      }
      if (rowOpaquePixels > width * 0.72) {
        solidRows += 1;
      }
      previousRow = row;
    }

    const totalPixels = width * height;
    const opaqueRatio = opaquePixels / totalPixels;
    const edgeRatio = edgeOpaquePixels / Math.max(1, edgePixels);
    const centerRatio = centerOpaquePixels / Math.max(1, centerPixels);
    if (opaqueRatio < 0.12 || opaqueRatio > 0.72 || edgeRatio > 0.28 || centerRatio < 0.42 || solidRows > height * 0.12) {
      throw new BadRequestException("Upload a transparent PNG face without text, logos or solid background.");
    }
  }

  private registrationDraft(input: {
    login?: string;
    password?: string;
    characterName?: string;
    characterId?: string;
    classId?: CharacterClass;
    race?: CharacterRace;
    face?: number;
  }): RegistrationDraft {
    const login = this.cleanLogin(input.login);
    const password = this.cleanPassword(input.password);
    const characterName = this.cleanName(input.characterName ?? "");
    const characterId = this.cleanCharacterId(input.characterId);
    const classId = this.cleanClass(input.classId);
    const race = this.cleanRace(input.race);
    const face = this.cleanFace(input.face);

    if (!login || !password || !input.characterName?.trim()) {
      throw new BadRequestException("Email, password and character name are required.");
    }
    if (!this.isValidEmail(login)) {
      throw new BadRequestException("Use a valid email address.");
    }
    if (password.length < 6) {
      throw new BadRequestException("Password must be at least 6 characters.");
    }
    if (this.accounts.has(login)) {
      throw new ConflictException("Email is already registered.");
    }
    if (characterId && [...this.accounts.values()].some((account) => account.character.id === characterId)) {
      throw new ConflictException("Character is already saved to another account.");
    }
    if ([...this.accounts.values()].some((account) => this.nameKey(account.character.name) === this.nameKey(characterName))) {
      throw new ConflictException("Character name is already taken.");
    }

    return {
      login,
      password,
      characterName,
      characterId,
      classId,
      race,
      face
    };
  }

  private verifyEmailCode(login: string, emailCode?: string): void {
    const code = (emailCode ?? "").replace(/\D/g, "").slice(0, 6);
    if (code.length !== 6) {
      throw new BadRequestException("Email code is required.");
    }

    const pending = this.pendingEmailCodes.get(login);
    if (!pending || pending.expiresAt < Date.now()) {
      this.pendingEmailCodes.delete(login);
      throw new BadRequestException("Email code expired. Request a new one.");
    }
    if (pending.attempts >= 5) {
      this.pendingEmailCodes.delete(login);
      throw new BadRequestException("Too many wrong codes. Request a new one.");
    }
    if (pending.codeHash !== this.emailCodeHash(login, code)) {
      pending.attempts += 1;
      throw new BadRequestException("Wrong email code.");
    }
  }

  private emailCodeHash(login: string, code: string): string {
    return this.hash(`email-code:${login}:${code}`);
  }

  private verifyPasswordResetCode(login: string, emailCode?: string): void {
    const code = (emailCode ?? "").replace(/\D/g, "").slice(0, 6);
    if (code.length !== 6) {
      throw new BadRequestException("Email code is required.");
    }

    const pending = this.pendingPasswordResetCodes.get(login);
    if (!pending || pending.expiresAt < Date.now()) {
      this.pendingPasswordResetCodes.delete(login);
      throw new BadRequestException("Email code expired. Request a new one.");
    }
    if (pending.attempts >= 5) {
      this.pendingPasswordResetCodes.delete(login);
      throw new BadRequestException("Too many wrong codes. Request a new one.");
    }
    if (pending.codeHash !== this.passwordResetCodeHash(login, code)) {
      pending.attempts += 1;
      throw new BadRequestException("Wrong email code.");
    }
  }

  private passwordResetCodeHash(login: string, code: string): string {
    return this.hash(`password-reset-code:${login}:${code}`);
  }

  private isValidEmail(login: string): boolean {
    return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(login);
  }

  private async sendRegistrationCode(
    email: string,
    code: string,
    characterName: string,
    locale: AuthLocale
  ): Promise<void> {
    const config = this.smtpConfig();
    const subject = locale === "ru" ? `Код регистрации DarkVell: ${code}` : `DarkVell registration code: ${code}`;
    const text =
      locale === "ru"
        ? [
            "Добро пожаловать в DarkVell.",
            "",
            `Ваш код регистрации: ${code}.`,
            `Герой: ${characterName}`,
            "",
            "Код действует 10 минут. Если вы его не запрашивали, просто проигнорируйте это письмо."
          ].join("\n")
        : [
            "Welcome to DarkVell.",
            "",
            `Your registration code is ${code}.`,
            `Hero: ${characterName}`,
            "",
            "The code expires in 10 minutes. If you did not request it, ignore this message."
          ].join("\n");
    const html = this.registrationEmailHtml(code, characterName, locale);
    await this.sendSmtpMail(config, email, subject, text, html);
  }

  private async sendPasswordResetCode(
    email: string,
    code: string,
    characterName: string,
    locale: AuthLocale
  ): Promise<void> {
    const config = this.smtpConfig();
    const subject = locale === "ru" ? `Код сброса пароля DarkVell: ${code}` : `DarkVell password reset code: ${code}`;
    const text =
      locale === "ru"
        ? [
            "Сброс пароля DarkVell.",
            "",
            `Ваш код сброса пароля: ${code}.`,
            `Герой: ${characterName}`,
            "",
            "Код действует 10 минут. Если вы его не запрашивали, просто проигнорируйте это письмо."
          ].join("\n")
        : [
            "DarkVell password reset.",
            "",
            `Your password reset code is ${code}.`,
            `Hero: ${characterName}`,
            "",
            "The code expires in 10 minutes. If you did not request it, ignore this message."
          ].join("\n");
    const html = this.passwordResetEmailHtml(code, characterName, locale);
    await this.sendSmtpMail(config, email, subject, text, html);
  }

  private smtpConfig(): SmtpConfig {
    const user = process.env.SMTP_USER ?? process.env.MAIL_USER ?? "";
    const pass = process.env.SMTP_PASS ?? process.env.MAIL_PASS ?? "";
    const host = process.env.SMTP_HOST ?? "smtp.timeweb.ru";
    const port = Number(process.env.SMTP_PORT ?? 465);
    const secure = this.envFlag(process.env.SMTP_SECURE, port === 465);
    const from = process.env.SMTP_FROM ?? `DarkVell <${user}>`;
    if (!user || !pass) {
      throw new Error("SMTP credentials are not configured.");
    }

    return { host, port, secure, user, pass, from };
  }

  private envFlag(value: string | undefined, fallback: boolean): boolean {
    if (value === undefined) {
      return fallback;
    }
    return value === "1" || value.toLowerCase() === "true" || value.toLowerCase() === "yes";
  }

  private async sendSmtpMail(config: SmtpConfig, to: string, subject: string, text: string, html: string): Promise<void> {
    let socket: SmtpSocket = config.secure
      ? createTlsConnection({ host: config.host, port: config.port, servername: config.host })
      : createConnection({ host: config.host, port: config.port });

    socket.setEncoding("utf8");
    socket.setTimeout(15_000);
    try {
      await this.readSmtpResponse(socket, [220]);
      await this.smtpCommand(socket, `EHLO ${process.env.SMTP_HELO_HOST ?? "darkvell.ru"}`, [250]);
      if (!config.secure && this.envFlag(process.env.SMTP_STARTTLS, true)) {
        await this.smtpCommand(socket, "STARTTLS", [220]);
        socket = createTlsConnection({ socket, servername: config.host });
        socket.setEncoding("utf8");
        socket.setTimeout(15_000);
        await this.smtpCommand(socket, `EHLO ${process.env.SMTP_HELO_HOST ?? "darkvell.ru"}`, [250]);
      }
      await this.smtpCommand(socket, "AUTH LOGIN", [334]);
      await this.smtpCommand(socket, Buffer.from(config.user).toString("base64"), [334]);
      await this.smtpCommand(socket, Buffer.from(config.pass).toString("base64"), [235]);
      await this.smtpCommand(socket, `MAIL FROM:<${this.extractEmailAddress(config.from)}>`, [250]);
      await this.smtpCommand(socket, `RCPT TO:<${to}>`, [250, 251]);
      await this.smtpCommand(socket, "DATA", [354]);
      await this.smtpCommand(socket, `${this.mimeMessage(config.from, to, subject, text, html)}\r\n.`, [250]);
      await this.smtpCommand(socket, "QUIT", [221]);
    } finally {
      socket.end();
    }
  }

  private async smtpCommand(socket: SmtpSocket, command: string, expectedCodes: number[]): Promise<string> {
    socket.write(`${command}\r\n`);
    return this.readSmtpResponse(socket, expectedCodes);
  }

  private readSmtpResponse(socket: SmtpSocket, expectedCodes: number[]): Promise<string> {
    return new Promise((resolve, reject) => {
      let response = "";
      const cleanup = () => {
        socket.off("data", onData);
        socket.off("error", onError);
        socket.off("timeout", onTimeout);
      };
      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };
      const onTimeout = () => {
        cleanup();
        socket.destroy();
        reject(new Error("SMTP timeout."));
      };
      const onData = (chunk: Buffer | string) => {
        response += chunk.toString();
        const lines = response.split(/\r?\n/).filter(Boolean);
        const lastLine = lines.at(-1);
        const code = lastLine ? Number(lastLine.slice(0, 3)) : NaN;
        if (!lastLine || !/^\d{3} /.test(lastLine)) {
          return;
        }
        cleanup();
        if (!expectedCodes.includes(code)) {
          reject(new Error(`SMTP rejected command with ${code}.`));
          return;
        }
        resolve(response);
      };

      socket.on("data", onData);
      socket.once("error", onError);
      socket.once("timeout", onTimeout);
    });
  }

  private mimeMessage(from: string, to: string, subject: string, text: string, html: string): string {
    const boundary = `darkvell-${randomUUID()}`;
    const headers = [
      `From: ${this.formatAddressHeader(from)}`,
      `To: <${to}>`,
      `Subject: ${this.encodeHeader(subject)}`,
      "MIME-Version: 1.0",
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: <${randomUUID()}@darkvell.ru>`
    ];

    return [
      ...headers,
      "",
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: 8bit",
      "",
      this.dotStuff(text),
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      "Content-Transfer-Encoding: 8bit",
      "",
      this.dotStuff(html),
      `--${boundary}--`
    ].join("\r\n");
  }

  private registrationEmailHtml(code: string, characterName: string, locale: AuthLocale): string {
    const escapedName = this.escapeHtml(characterName);
    const logoUrl = this.escapeHtml(process.env.PUBLIC_LOGO_URL ?? "https://darkvell.ru/darkvell-login-logo.png");
    const heading = locale === "ru" ? "Добро пожаловать в мир" : "Welcome to the world";
    const intro =
      locale === "ru"
        ? `Используйте этот код, чтобы завершить регистрацию героя <strong style="color:#bbf7d0;">${escapedName}</strong>.`
        : `Use this code to finish registration for hero <strong style="color:#bbf7d0;">${escapedName}</strong>.`;
    const codeLabel = locale === "ru" ? "Код регистрации" : "Registration code";
    const expires =
      locale === "ru"
        ? "Код действует 10 минут. Если вы его не запрашивали, просто проигнорируйте это письмо."
        : "The code expires in 10 minutes. If you did not request it, ignore this message.";
    return `<!doctype html>
<html lang="${locale}">
  <body style="margin:0;background:#050807;color:#e5f7ee;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#050807;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#07100d;border:1px solid #22c55e66;border-radius:12px;box-shadow:0 18px 60px rgba(0,0,0,.45);overflow:hidden;">
            <tr>
              <td style="padding:22px 24px 12px;border-bottom:1px solid rgba(34,197,94,.28);">
                <img src="${logoUrl}" width="172" alt="DarkVell" style="display:block;width:172px;max-width:72%;height:auto;margin:0 0 12px;border:0;outline:none;text-decoration:none;">
                <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#86efac;font-weight:800;">DarkVell</div>
                <h1 style="margin:8px 0 0;color:#f0fdf4;font-size:25px;line-height:1.15;">${heading}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 24px;">
                <p style="margin:0 0 12px;color:#cbd5e1;font-size:15px;line-height:1.55;">${intro}</p>
                <div style="margin:18px 0;padding:16px 18px;background:#0f1f18;border:1px solid #22c55e80;border-radius:10px;text-align:center;">
                  <div style="color:#86efac;font-size:11px;text-transform:uppercase;letter-spacing:1.8px;font-weight:800;">${codeLabel}</div>
                  <div style="margin-top:8px;color:#ffffff;font-size:36px;line-height:1;font-weight:900;letter-spacing:8px;">${code}</div>
                </div>
                <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.5;">${expires}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  }

  private passwordResetEmailHtml(code: string, characterName: string, locale: AuthLocale): string {
    const escapedName = this.escapeHtml(characterName);
    const logoUrl = this.escapeHtml(process.env.PUBLIC_LOGO_URL ?? "https://darkvell.ru/darkvell-login-logo.png");
    const heading = locale === "ru" ? "Сброс пароля" : "Password reset";
    const intro =
      locale === "ru"
        ? `Используйте этот код, чтобы задать новый пароль для героя <strong style="color:#bbf7d0;">${escapedName}</strong>.`
        : `Use this code to set a new password for hero <strong style="color:#bbf7d0;">${escapedName}</strong>.`;
    const codeLabel = locale === "ru" ? "Код сброса" : "Reset code";
    const expires =
      locale === "ru"
        ? "Код действует 10 минут. Если вы его не запрашивали, просто проигнорируйте это письмо."
        : "The code expires in 10 minutes. If you did not request it, ignore this message.";
    return `<!doctype html>
<html lang="${locale}">
  <body style="margin:0;background:#050807;color:#e5f7ee;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#050807;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#07100d;border:1px solid #22c55e66;border-radius:12px;box-shadow:0 18px 60px rgba(0,0,0,.45);overflow:hidden;">
            <tr>
              <td style="padding:22px 24px 12px;border-bottom:1px solid rgba(34,197,94,.28);">
                <img src="${logoUrl}" width="172" alt="DarkVell" style="display:block;width:172px;max-width:72%;height:auto;margin:0 0 12px;border:0;outline:none;text-decoration:none;">
                <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#86efac;font-weight:800;">DarkVell</div>
                <h1 style="margin:8px 0 0;color:#f0fdf4;font-size:25px;line-height:1.15;">${heading}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 24px;">
                <p style="margin:0 0 12px;color:#cbd5e1;font-size:15px;line-height:1.55;">${intro}</p>
                <div style="margin:18px 0;padding:16px 18px;background:#0f1f18;border:1px solid #22c55e80;border-radius:10px;text-align:center;">
                  <div style="color:#86efac;font-size:11px;text-transform:uppercase;letter-spacing:1.8px;font-weight:800;">${codeLabel}</div>
                  <div style="margin-top:8px;color:#ffffff;font-size:36px;line-height:1;font-weight:900;letter-spacing:8px;">${code}</div>
                </div>
                <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.5;">${expires}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  }

  private extractEmailAddress(value: string): string {
    return value.match(/<([^>]+)>/)?.[1] ?? value;
  }

  private formatAddressHeader(value: string): string {
    const address = this.extractEmailAddress(value);
    const name = value.includes("<") ? value.slice(0, value.indexOf("<")).trim().replace(/^"|"$/g, "") : "DarkVell";
    return `${this.encodeHeader(name || "DarkVell")} <${address}>`;
  }

  private encodeHeader(value: string): string {
    return /^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${Buffer.from(value).toString("base64")}?=`;
  }

  private dotStuff(value: string): string {
    return value.replace(/\r?\n/g, "\r\n").replace(/^\./gm, "..");
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
  }

  private cleanRace(race?: CharacterRace): CharacterRace {
    return race === "elf" || race === "darkelf" || race === "orc" ? race : "human";
  }

  private cleanClass(classId?: CharacterClass): CharacterClass {
    return classId && classId !== "tank" && CLASS_DEFINITIONS[classId] ? classId : "warrior";
  }

  private cleanFace(face?: number): number {
    return Math.max(1, Math.min(CHARACTER_FACE_VARIANT_COUNT, Math.trunc(face ?? 1)));
  }

  private nameKey(name: string): string {
    return name.trim().replace(/\s+/g, " ").toLowerCase();
  }

  private passwordHash(password: string): string {
    return this.hash(`password:${password}`);
  }

  private verifySessionToken(token?: string): SessionTokenPayload {
    const [payload, signature] = (token ?? "").split(".");
    if (!payload || !signature || !this.safeEqual(signature, this.hash(payload))) {
      throw new UnauthorizedException("Session token is not valid.");
    }

    let parsed: SessionTokenPayload;
    try {
      parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionTokenPayload;
    } catch {
      throw new UnauthorizedException("Session token is not valid.");
    }

    if (parsed.exp && Date.parse(parsed.exp) <= Date.now()) {
      throw new UnauthorizedException("Session token expired.");
    }
    return parsed;
  }

  private safeEqual(a: string, b: string): boolean {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    return left.length === right.length && timingSafeEqual(left, right);
  }

  private hash(value: string): string {
    return createHmac("sha256", this.secret).update(value).digest("base64url");
  }
}
