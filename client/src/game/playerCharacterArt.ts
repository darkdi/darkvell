import Phaser from "phaser";
import {
  characterFaceStyleVariant,
  characterGenderFromFace,
  type CharacterClass,
  type CharacterGender,
  type CharacterRace,
  type ItemGrade,
  type PlayerPublicState
} from "@mmo/shared";

export type PlayerCharacterFrame = "idle-a" | "idle-b" | "walk-pass-a" | "walk-a" | "walk-pass-b" | "walk-b" | "attack";

export type PlayerCharacterTextureSet = Record<PlayerCharacterFrame, string>;

export const PLAYER_CHARACTER_SCALE = 0.62;

const CHARACTER_WIDTH = 112;
const CHARACTER_HEIGHT = 132;
const FRAMES: readonly PlayerCharacterFrame[] = ["idle-a", "idle-b", "walk-pass-a", "walk-a", "walk-pass-b", "walk-b", "attack"];

const CLASS_PALETTES: Record<CharacterClass, { primary: number; secondary: number; cloth: number; metal: number; accent: number }> = {
  warrior: { primary: 0x9f2d2d, secondary: 0x421b22, cloth: 0x701f28, metal: 0xb9c3cf, accent: 0xf0c46d },
  assassin: { primary: 0x4d2c73, secondary: 0x151521, cloth: 0x2d1f40, metal: 0x89829a, accent: 0xb87bea },
  mage: { primary: 0x18588c, secondary: 0x172554, cloth: 0x163967, metal: 0x8bbce2, accent: 0x5ee5f5 },
  archer: { primary: 0x35603b, secondary: 0x1f3024, cloth: 0x27492f, metal: 0xa3845b, accent: 0xa5cf79 },
  tank: { primary: 0x805223, secondary: 0x30251a, cloth: 0x4b3821, metal: 0xc69a4b, accent: 0xf2c66d }
};

const RACE_PALETTES: Record<CharacterRace, { skin: number; shadow: number; hair: number; eye: number }> = {
  human: { skin: 0xd9a66f, shadow: 0x9a6242, hair: 0x30221c, eye: 0x1b2733 },
  elf: { skin: 0xe9c39a, shadow: 0xa97858, hair: 0xbacb9e, eye: 0x2e8b57 },
  darkelf: { skin: 0x8d79b1, shadow: 0x594a79, hair: 0xe1e4eb, eye: 0xc69af4 },
  orc: { skin: 0x789b65, shadow: 0x4b653f, hair: 0x243a25, eye: 0xe5b93d }
};

const APPEARANCE_COLORS: Record<string, { primary: number; secondary: number; metal: number; accent: number }> = {
  steel: { primary: 0x87929f, secondary: 0x343b46, metal: 0xd5dce4, accent: 0xb44a4a },
  shadow: { primary: 0x3d285c, secondary: 0x11131d, metal: 0x797387, accent: 0xa56be3 },
  arcane: { primary: 0x17618c, secondary: 0x152751, metal: 0x75b7dc, accent: 0x55ddea },
  hunter: { primary: 0x3f6742, secondary: 0x213727, metal: 0x9d8058, accent: 0x9bc875 },
  guardian: { primary: 0x8a602c, secondary: 0x33291d, metal: 0xcfaa5b, accent: 0xf0c96d }
};

const GRADE_TRIMS: Record<ItemGrade, number> = {
  common: 0xb9c1ca,
  rare: 0x72c8ee,
  epic: 0xb98ae8,
  legendary: 0xeac45f,
  mythic: 0x56d9e8,
  relic: 0xf0788b
};

function mixColor(from: number, to: number, amount: number): number {
  const t = Phaser.Math.Clamp(amount, 0, 1);
  const fr = (from >> 16) & 0xff;
  const fg = (from >> 8) & 0xff;
  const fb = from & 0xff;
  const tr = (to >> 16) & 0xff;
  const tg = (to >> 8) & 0xff;
  const tb = to & 0xff;
  return (Math.round(Phaser.Math.Linear(fr, tr, t)) << 16) | (Math.round(Phaser.Math.Linear(fg, tg, t)) << 8) | Math.round(Phaser.Math.Linear(fb, tb, t));
}

function darkest(color: number, amount = 0.42): number {
  return mixColor(color, 0x090b10, amount);
}

function lightest(color: number, amount = 0.24): number {
  return mixColor(color, 0xf7f3e8, amount);
}

function gradeRank(grade?: ItemGrade): number {
  return grade ? ["common", "rare", "epic", "legendary", "mythic", "relic"].indexOf(grade) + 1 : 0;
}

function strongestGrade(...grades: Array<ItemGrade | undefined>): ItemGrade | undefined {
  return grades.reduce<ItemGrade | undefined>((best, grade) => (gradeRank(grade) > gradeRank(best) ? grade : best), undefined);
}

function safeKey(value?: string): string {
  return (value ?? "none").replace(/[^a-z0-9_-]/gi, "-").slice(0, 20);
}

function characterSignature(player: PlayerPublicState, headless: boolean, detailed: boolean): string {
  const gear = player.equipmentVisual;
  if (!detailed) {
    return [
      player.classId,
      player.race ?? "human",
      characterGenderFromFace(player.face),
      headless ? "headless" : "headed",
      "simple"
    ].join("-");
  }
  return [
    player.classId,
    player.race ?? "human",
    characterGenderFromFace(player.face),
    characterFaceStyleVariant(player.face),
    safeKey(gear?.chest),
    gear?.chestGrade ?? "none",
    safeKey(gear?.helmet),
    gear?.helmetGrade ?? "none",
    safeKey(gear?.gloves),
    gear?.glovesGrade ?? "none",
    safeKey(gear?.boots),
    gear?.bootsGrade ?? "none",
    headless ? "headless" : "headed"
  ].join("-");
}

export function ensurePlayerCharacterTextures(
  scene: Phaser.Scene,
  player: PlayerPublicState,
  headless = false,
  detailed = true
): PlayerCharacterTextureSet {
  const signature = characterSignature(player, headless, detailed);
  const textures = Object.fromEntries(FRAMES.map((frame) => [frame, `player-art-${signature}-${frame}`])) as PlayerCharacterTextureSet;
  if (scene.textures.exists(textures["idle-a"])) {
    return textures;
  }

  FRAMES.forEach((frame) => {
    const key = textures[frame];
    if (scene.textures.exists(key)) {
      return;
    }
    const graphics = new Phaser.GameObjects.Graphics(scene);
    paintCharacterFrame(graphics, player, frame, headless, detailed);
    graphics.generateTexture(key, CHARACTER_WIDTH, CHARACTER_HEIGHT);
    graphics.destroy();
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
  });

  return textures;
}

function paintCharacterFrame(
  graphics: Phaser.GameObjects.Graphics,
  player: PlayerPublicState,
  frame: PlayerCharacterFrame,
  headless: boolean,
  detailed: boolean
): void {
  const classPalette = CLASS_PALETTES[player.classId];
  const race = player.race ?? "human";
  const racePalette = RACE_PALETTES[race];
  const gender = characterGenderFromFace(player.face);
  const faceStyle = detailed ? characterFaceStyleVariant(player.face) - 1 : 0;
  const hairStyle = faceStyle % 6;
  const eyeStyle = Math.floor(faceStyle / 6) % 4;
  const markStyle = Math.floor(faceStyle / 24) % 4;
  const equipment = detailed ? player.equipmentVisual : undefined;
  const chest = APPEARANCE_COLORS[equipment?.chest ?? ""] ?? classPalette;
  const helmet = APPEARANCE_COLORS[equipment?.helmet ?? ""] ?? chest;
  const gloves = APPEARANCE_COLORS[equipment?.gloves ?? ""] ?? chest;
  const boots = APPEARANCE_COLORS[equipment?.boots ?? ""] ?? chest;
  const strongest = strongestGrade(equipment?.chestGrade, equipment?.helmetGrade, equipment?.glovesGrade, equipment?.bootsGrade);
  const gradeTrim = strongest ? GRADE_TRIMS[strongest] : classPalette.accent;
  const armorPower = Math.max(0, gradeRank(strongest) - 1) / 5;
  const female = gender === "female";
  const heavy = player.classId === "warrior" || player.classId === "tank";
  const light = player.classId === "assassin" || player.classId === "archer";
  const stride = frame === "walk-a" ? 1 : frame === "walk-pass-a" ? 0.28 : frame === "walk-b" ? -1 : frame === "walk-pass-b" ? -0.28 : 0;
  const walking = frame.startsWith("walk-");
  const attacking = frame === "attack";
  const idleLift = frame === "idle-b" ? -1 : 0;
  const bodyY = idleLift + (walking ? -0.5 + Math.abs(stride) * 0.25 : 0);
  const raceShoulder = race === "orc" ? 3 : race === "elf" || race === "darkelf" ? -1 : 0;
  const raceTorso = race === "orc" ? 4 : race === "elf" || race === "darkelf" ? -1 : 0;
  const weightShift = walking ? (stride >= 0 ? 0.7 : -0.7) * (1 - Math.abs(stride) * 0.35) : 0;
  const centerX = 56 + weightShift;
  const shoulderHalf = (heavy ? (female ? 20 : 24) : light ? (female ? 17 : 20) : female ? 18 : 21) + raceShoulder;
  const torsoWidth = (heavy ? (female ? 38 : 46) : light ? (female ? 31 : 36) : female ? 32 : 38) + raceTorso;
  const waistWidth = female ? torsoWidth - 7 : torsoWidth - 3;
  const hipWidth = female ? torsoWidth + (race === "orc" ? 3 : 2) : torsoWidth - (race === "orc" ? 0 : 2);
  const headY = 29 + bodyY;
  const legSpacing = (female ? 8.5 : 10) + (race === "orc" ? 1.5 : 0);
  const leftStep = stride * 0.65;
  const rightStep = -stride * 0.65;
  const leftLegY = 82 + bodyY + stride * 2.2;
  const rightLegY = 82 + bodyY - stride * 2.2;
  const outline = 0x12141b;

  graphics.fillStyle(0x020409, walking ? 0.22 : 0.28);
  graphics.fillEllipse(56, 123, heavy || race === "orc" ? 58 : 50, walking ? 10 : 12);

  drawRearCloth(graphics, player.classId, centerX, bodyY, stride, chest.secondary, classPalette.secondary, gradeTrim);

  drawLeg(graphics, centerX - legSpacing + leftStep, leftLegY, -stride, chest.secondary, boots, equipment?.bootsGrade, outline);
  drawLeg(graphics, centerX + legSpacing + rightStep, rightLegY, stride, chest.secondary, boots, equipment?.bootsGrade, outline);

  const armSwing = stride * 1.6;
  const leftHandTarget = attacking ? { x: centerX + 5, y: 73 + bodyY } : { x: centerX - shoulderHalf - 4 - armSwing, y: 73 + bodyY + armSwing };
  const rightHandTarget = attacking ? { x: centerX + shoulderHalf + 12, y: 58 + bodyY } : { x: centerX + shoulderHalf + 4 + armSwing, y: 73 + bodyY - armSwing };
  drawArm(graphics, centerX - shoulderHalf + 2, 51 + bodyY, leftHandTarget.x, leftHandTarget.y, chest.secondary, gloves, Boolean(equipment?.gloves), equipment?.glovesGrade, racePalette.skin, outline);

  drawTorso(graphics, player.classId, gender, centerX, 43 + bodyY, torsoWidth, waistWidth, hipWidth, chest, classPalette, gradeTrim, equipment?.chestGrade, outline);

  drawArm(graphics, centerX + shoulderHalf - 2, 51 + bodyY, rightHandTarget.x, rightHandTarget.y, chest.secondary, gloves, Boolean(equipment?.gloves), equipment?.glovesGrade, racePalette.skin, outline);
  drawShoulders(graphics, player.classId, centerX, 47 + bodyY, shoulderHalf, chest, gradeTrim, Boolean(equipment?.chest), armorPower, outline);

  if (!headless) {
    drawHead(graphics, race, gender, centerX, headY, hairStyle, eyeStyle, markStyle, racePalette);
    drawHelmet(graphics, player.classId, centerX, headY, gender, equipment?.helmet, equipment?.helmetGrade, helmet, gradeTrim, outline);
  }

  graphics.lineStyle(1, lightest(gradeTrim, 0.2), equipment?.chest ? 0.35 + armorPower * 0.2 : 0.14);
  graphics.lineBetween(centerX - waistWidth * 0.36, 65 + bodyY, centerX + waistWidth * 0.36, 65 + bodyY);
}

function drawRearCloth(
  graphics: Phaser.GameObjects.Graphics,
  classId: CharacterClass,
  centerX: number,
  bodyY: number,
  phase: number,
  gearSecondary: number,
  classSecondary: number,
  trim: number
): void {
  const sway = phase * 3;
  if (classId === "mage") {
    graphics.fillStyle(darkest(gearSecondary, 0.28), 0.98);
    graphics.fillTriangle(centerX, 48 + bodyY, centerX - 27 + sway, 113 + bodyY, centerX + 26 + sway, 113 + bodyY);
    graphics.fillStyle(mixColor(gearSecondary, trim, 0.18), 0.9);
    graphics.fillTriangle(centerX, 56 + bodyY, centerX - 12 + sway, 112 + bodyY, centerX + 11 + sway, 112 + bodyY);
    return;
  }
  if (classId === "assassin") {
    graphics.fillStyle(darkest(gearSecondary, 0.18), 0.9);
    graphics.fillTriangle(centerX - 12, 55 + bodyY, centerX - 23 + sway, 105 + bodyY, centerX - 2, 82 + bodyY);
    graphics.fillTriangle(centerX + 10, 55 + bodyY, centerX + 23 + sway, 102 + bodyY, centerX + 1, 82 + bodyY);
    return;
  }
  if (classId === "archer") {
    graphics.fillStyle(darkest(classSecondary, 0.12), 0.84);
    graphics.fillTriangle(centerX - 15, 46 + bodyY, centerX - 27 + sway, 103 + bodyY, centerX + 7, 76 + bodyY);
    return;
  }
  if (classId === "warrior") {
    graphics.fillStyle(darkest(classSecondary, 0.16), 0.86);
    graphics.fillTriangle(centerX, 67 + bodyY, centerX - 19 + sway, 104 + bodyY, centerX + 18 + sway, 104 + bodyY);
  }
}

function drawLeg(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  stride: number,
  clothColor: number,
  bootPalette: { primary: number; secondary: number; metal: number; accent: number },
  bootGrade: ItemGrade | undefined,
  outline: number
): void {
  const lift = Math.max(0, stride) * 2.4;
  const kneeShift = stride * 1.35;
  graphics.fillStyle(outline, 0.88);
  graphics.fillRoundedRect(x - 7, y - 1 - lift, 14, 22, 6);
  graphics.fillRoundedRect(x + kneeShift - 6.5, y + 14 - lift, 13, 20, 6);
  graphics.fillStyle(darkest(clothColor, 0.18), 1);
  graphics.fillRoundedRect(x - 5.5, y - lift, 11, 19, 5);
  graphics.fillRoundedRect(x + kneeShift - 5, y + 14 - lift, 10, 17, 5);
  graphics.fillStyle(outline, 0.92);
  graphics.fillRoundedRect(x + kneeShift - 8, y + 25 - lift, 17, 13, 5);
  graphics.fillStyle(bootGrade ? bootPalette.primary : darkest(bootPalette.secondary, 0.05), 1);
  graphics.fillRoundedRect(x + kneeShift - 6.5, y + 25 - lift, 14, 10, 4);
  if (bootGrade) {
    graphics.fillStyle(GRADE_TRIMS[bootGrade], 0.58);
    graphics.fillRect(x + kneeShift - 5, y + 27 - lift, 10, 2);
  }
}

function drawArm(
  graphics: Phaser.GameObjects.Graphics,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  sleeve: number,
  glovePalette: { primary: number; secondary: number; metal: number; accent: number },
  equipped: boolean,
  grade: ItemGrade | undefined,
  skin: number,
  outline: number
): void {
  graphics.lineStyle(13, outline, 0.92);
  graphics.lineBetween(startX, startY, endX, endY);
  graphics.lineStyle(9, mixColor(sleeve, glovePalette.primary, equipped ? 0.3 : 0), 1);
  graphics.lineBetween(startX, startY, endX, endY);
  graphics.fillStyle(outline, 0.94);
  graphics.fillCircle(endX, endY, equipped ? 7 : 6);
  graphics.fillStyle(equipped ? glovePalette.primary : skin, 1);
  graphics.fillCircle(endX, endY, equipped ? 5.3 : 4.4);
  if (grade) {
    graphics.lineStyle(1.4, GRADE_TRIMS[grade], 0.7);
    graphics.strokeCircle(endX, endY, 5.5);
  }
}

function drawTorso(
  graphics: Phaser.GameObjects.Graphics,
  classId: CharacterClass,
  gender: CharacterGender,
  centerX: number,
  top: number,
  torsoWidth: number,
  waistWidth: number,
  hipWidth: number,
  gear: { primary: number; secondary: number; metal: number; accent: number },
  classPalette: { primary: number; secondary: number; cloth: number; metal: number; accent: number },
  trim: number,
  chestGrade: ItemGrade | undefined,
  outline: number
): void {
  const equipped = Boolean(chestGrade);
  const primary = equipped ? gear.primary : classPalette.primary;
  const secondary = equipped ? gear.secondary : classPalette.secondary;
  const metal = equipped ? gear.metal : classPalette.metal;
  const female = gender === "female";

  graphics.fillStyle(outline, 0.92);
  graphics.fillRoundedRect(centerX - torsoWidth / 2 - 2, top - 2, torsoWidth + 4, 28, 9);
  graphics.fillRoundedRect(centerX - waistWidth / 2 - 2, top + 20, waistWidth + 4, 25, 6);
  graphics.fillRoundedRect(centerX - hipWidth / 2 - 2, top + 38, hipWidth + 4, 16, 5);

  graphics.fillStyle(primary, 1);
  graphics.fillRoundedRect(centerX - torsoWidth / 2, top, torsoWidth, 26, 8);
  graphics.fillStyle(secondary, 1);
  graphics.fillRoundedRect(centerX - waistWidth / 2, top + 19, waistWidth, 26, 5);
  graphics.fillStyle(mixColor(primary, secondary, 0.5), 1);
  graphics.fillRoundedRect(centerX - hipWidth / 2, top + 38, hipWidth, 13, 4);

  if (classId === "mage") {
    graphics.fillStyle(mixColor(primary, classPalette.cloth, 0.45), 0.95);
    graphics.fillTriangle(centerX, top + 23, centerX - hipWidth / 2 - 7, top + 66, centerX + hipWidth / 2 + 7, top + 66);
    graphics.lineStyle(2, trim, chestGrade ? 0.72 : 0.34);
    graphics.lineBetween(centerX, top + 25, centerX, top + 61);
  } else if (classId === "assassin") {
    graphics.lineStyle(3, darkest(trim, 0.12), chestGrade ? 0.8 : 0.45);
    graphics.lineBetween(centerX - torsoWidth * 0.31, top + 5, centerX + torsoWidth * 0.27, top + 35);
    graphics.lineBetween(centerX + torsoWidth * 0.31, top + 5, centerX - torsoWidth * 0.2, top + 31);
  } else if (classId === "archer") {
    graphics.lineStyle(4, mixColor(metal, 0x6d4c2d, 0.5), 0.9);
    graphics.lineBetween(centerX - torsoWidth * 0.28, top + 1, centerX + torsoWidth * 0.25, top + 40);
    graphics.fillStyle(trim, chestGrade ? 0.75 : 0.38);
    graphics.fillCircle(centerX + 3, top + 23, 3);
  } else {
    graphics.fillStyle(metal, equipped ? 0.92 : 0.68);
    graphics.fillRoundedRect(centerX - torsoWidth * 0.34, top + 3, torsoWidth * 0.68, heavyChestHeight(classId), 7);
    graphics.fillStyle(lightest(metal, 0.24), 0.38);
    graphics.fillRoundedRect(centerX - torsoWidth * 0.23, top + 5, torsoWidth * 0.46, 5, 3);
    graphics.lineStyle(2, trim, chestGrade ? 0.68 : 0.32);
    graphics.lineBetween(centerX, top + 8, centerX, top + 25);
  }

  if (female) {
    const contour = classId === "warrior" || classId === "tank" ? metal : primary;
    drawFemaleChestContour(graphics, centerX, top, torsoWidth, contour, secondary, classId, equipped);
  }

  graphics.fillStyle(darkest(secondary, 0.18), 0.96);
  graphics.fillRoundedRect(centerX - waistWidth / 2 - 2, top + 37, waistWidth + 4, 6, 2);
  graphics.fillStyle(trim, chestGrade ? 0.82 : 0.42);
  graphics.fillRoundedRect(centerX - 4, top + 37, 8, 6, 2);

}

function drawFemaleChestContour(
  graphics: Phaser.GameObjects.Graphics,
  centerX: number,
  top: number,
  torsoWidth: number,
  material: number,
  shadow: number,
  classId: CharacterClass,
  equipped: boolean
): void {
  const halfGap = Math.max(5, torsoWidth * 0.18);
  const cupWidth = Math.max(11, torsoWidth * 0.36);
  const cupHeight = classId === "warrior" || classId === "tank" ? 11 : 12.5;
  const centerY = top + 13;
  graphics.fillStyle(darkest(shadow, 0.06), equipped ? 0.42 : 0.3);
  graphics.fillEllipse(centerX - halfGap, centerY + 1, cupWidth + 2, cupHeight + 2);
  graphics.fillEllipse(centerX + halfGap, centerY + 1, cupWidth + 2, cupHeight + 2);
  graphics.fillStyle(mixColor(material, lightest(material, 0.34), 0.34), equipped ? 0.62 : 0.48);
  graphics.fillEllipse(centerX - halfGap, centerY, cupWidth, cupHeight);
  graphics.fillEllipse(centerX + halfGap, centerY, cupWidth, cupHeight);
  graphics.fillStyle(lightest(material, 0.4), equipped ? 0.23 : 0.18);
  graphics.fillEllipse(centerX - halfGap - 1.5, centerY - 2.2, cupWidth * 0.45, cupHeight * 0.28);
  graphics.fillEllipse(centerX + halfGap - 1.5, centerY - 2.2, cupWidth * 0.45, cupHeight * 0.28);
  graphics.lineStyle(1, darkest(shadow, 0.12), equipped ? 0.36 : 0.24);
  graphics.lineBetween(centerX, top + 8, centerX, top + 19);
}

function heavyChestHeight(classId: CharacterClass): number {
  return classId === "tank" ? 25 : 22;
}

function drawShoulders(
  graphics: Phaser.GameObjects.Graphics,
  classId: CharacterClass,
  centerX: number,
  y: number,
  shoulderHalf: number,
  gear: { primary: number; secondary: number; metal: number; accent: number },
  trim: number,
  equipped: boolean,
  armorPower: number,
  outline: number
): void {
  const heavy = classId === "warrior" || classId === "tank";
  const width = heavy ? 18 : 14;
  const height = heavy ? 10 : 8;
  [-1, 1].forEach((side) => {
    const x = centerX + side * shoulderHalf;
    graphics.fillStyle(outline, 0.92);
    graphics.fillEllipse(x, y, width + 4, height + 3);
    graphics.fillStyle(equipped ? gear.metal : mixColor(gear.primary, gear.metal, 0.45), 1);
    graphics.fillEllipse(x, y - 0.5, width, height);
    graphics.fillStyle(trim, equipped ? 0.38 + armorPower * 0.28 : 0.18);
    graphics.fillEllipse(x - side * 1.5, y - 2, width * 0.56, height * 0.32);
  });
}

function drawHead(
  graphics: Phaser.GameObjects.Graphics,
  race: CharacterRace,
  gender: CharacterGender,
  centerX: number,
  centerY: number,
  hairStyle: number,
  eyeStyle: number,
  markStyle: number,
  palette: { skin: number; shadow: number; hair: number; eye: number }
): void {
  const female = gender === "female";
  const headWidth = (female ? 21 : 23) + (race === "orc" ? 3 : race === "elf" || race === "darkelf" ? -1 : 0);
  const headHeight = (female ? 25 : 26) + (race === "orc" ? 1 : race === "elf" || race === "darkelf" ? 2 : 0);
  const hairTint = mixColor(palette.hair, [0x4b3025, 0x68412d, 0x202838, 0x7c5b38, 0x2a2a2a, 0x8b5845][hairStyle], 0.34);
  const eyes = [palette.eye, 0x46a86d, 0xe6bf43, 0x72cef0][eyeStyle];

  graphics.fillStyle(palette.shadow, 1);
  graphics.fillRoundedRect(centerX - 4, centerY + 10, 8, 10, 3);
  if (race === "elf" || race === "darkelf") {
    graphics.fillStyle(palette.skin, 1);
    graphics.fillTriangle(centerX - headWidth / 2 + 1, centerY - 4, centerX - headWidth / 2 - 13, centerY - 8, centerX - headWidth / 2 + 1, centerY + 3);
    graphics.fillTriangle(centerX + headWidth / 2 - 1, centerY - 4, centerX + headWidth / 2 + 13, centerY - 8, centerX + headWidth / 2 - 1, centerY + 3);
    graphics.lineStyle(1, mixColor(palette.shadow, palette.skin, 0.35), 0.72);
    graphics.lineBetween(centerX - headWidth / 2, centerY - 3, centerX - headWidth / 2 - 10, centerY - 7);
    graphics.lineBetween(centerX + headWidth / 2, centerY - 3, centerX + headWidth / 2 + 10, centerY - 7);
  } else if (race === "orc") {
    graphics.fillStyle(palette.shadow, 1);
    graphics.fillTriangle(centerX - headWidth / 2 + 1, centerY - 1, centerX - headWidth / 2 - 7, centerY + 1, centerX - headWidth / 2 + 1, centerY + 5);
    graphics.fillTriangle(centerX + headWidth / 2 - 1, centerY - 1, centerX + headWidth / 2 + 7, centerY + 1, centerX + headWidth / 2 - 1, centerY + 5);
  }
  graphics.fillStyle(0x17131a, 0.72);
  graphics.fillEllipse(centerX, centerY + 1, headWidth + 4, headHeight + 3);
  graphics.fillStyle(palette.skin, 1);
  graphics.fillEllipse(centerX, centerY, headWidth, headHeight);
  if (race === "elf" || race === "darkelf") {
    graphics.fillTriangle(centerX - headWidth * 0.34, centerY + 6, centerX + headWidth * 0.34, centerY + 6, centerX, centerY + headHeight * 0.58);
  } else if (race === "orc") {
    graphics.fillStyle(mixColor(palette.skin, palette.shadow, 0.16), 1);
    graphics.fillRoundedRect(centerX - headWidth * 0.39, centerY + 4, headWidth * 0.78, 8, 4);
  }
  graphics.fillStyle(lightest(palette.skin, 0.25), 0.22);
  graphics.fillEllipse(centerX - 3, centerY - 5, headWidth * 0.42, headHeight * 0.26);

  drawHair(graphics, centerX, centerY, hairStyle, gender, hairTint);

  graphics.fillStyle(eyes, 1);
  const eyeWidth = race === "elf" || race === "darkelf" ? 4.2 : race === "orc" ? 3.5 : 3.2;
  graphics.fillEllipse(centerX - 4.2, centerY + 1, eyeWidth, 2.2);
  graphics.fillEllipse(centerX + 4.2, centerY + 1, eyeWidth, 2.2);
  if (race === "orc") {
    graphics.lineStyle(1.7, darkest(palette.shadow, 0.22), 0.88);
    graphics.lineBetween(centerX - 8, centerY - 3, centerX - 2, centerY - 1);
    graphics.lineBetween(centerX + 8, centerY - 3, centerX + 2, centerY - 1);
    graphics.fillStyle(palette.shadow, 0.72);
    graphics.fillEllipse(centerX, centerY + 4, 5.5, 3.6);
  }
  graphics.fillStyle(0x10131a, 0.9);
  graphics.fillRect(centerX - 4.3, centerY + 4.5, 8.6, 1.2);

  if (markStyle === 1) {
    graphics.lineStyle(1.2, 0x7b2f32, 0.86);
    graphics.lineBetween(centerX - 7, centerY + (female ? 1 : -1), centerX - 3, centerY + 7);
  } else if (markStyle === 2) {
    graphics.fillStyle(race === "darkelf" ? 0xd7b4f5 : 0x2c2034, 0.78);
    graphics.fillCircle(centerX - 7, centerY + 4, female ? 1.2 : 1.6);
    graphics.fillCircle(centerX - 5, centerY + 6, 0.8);
  } else if (markStyle === 3) {
    graphics.lineStyle(female ? 1.15 : 1.4, race === "orc" ? 0xf0d9b1 : lightest(eyes, 0.34), female ? 0.62 : 0.72);
    graphics.lineBetween(centerX - 8, centerY - 1, centerX - 5, centerY + 5);
    graphics.lineBetween(centerX + 8, centerY - 1, centerX + 5, centerY + 5);
  }

  if (race === "orc") {
    graphics.fillStyle(0xe8dfbf, 0.94);
    graphics.fillTriangle(centerX - 7, centerY + 7, centerX - 4, centerY + 12, centerX - 2, centerY + 6);
    graphics.fillTriangle(centerX + 7, centerY + 7, centerX + 4, centerY + 12, centerX + 2, centerY + 6);
  }
}

function drawHair(
  graphics: Phaser.GameObjects.Graphics,
  centerX: number,
  centerY: number,
  hairStyle: number,
  gender: CharacterGender,
  color: number
): void {
  const female = gender === "female";
  graphics.fillStyle(color, 1);
  if (female) {
    if (hairStyle === 0) {
      graphics.fillEllipse(centerX, centerY - 10, 24, 12);
      graphics.fillRoundedRect(centerX - 12, centerY - 8, 5, 22, 3);
      graphics.fillRoundedRect(centerX + 7, centerY - 8, 5, 22, 3);
      graphics.fillTriangle(centerX - 9, centerY - 10, centerX - 1, centerY - 15, centerX + 2, centerY - 7);
      return;
    }
    if (hairStyle === 1) {
      graphics.fillEllipse(centerX, centerY - 9, 25, 13);
      graphics.fillRoundedRect(centerX - 12, centerY - 7, 6, 26, 4);
      graphics.fillRoundedRect(centerX + 7, centerY - 5, 5, 18, 4);
      graphics.fillCircle(centerX - 10, centerY + 13, 4.2);
      graphics.fillCircle(centerX + 9, centerY + 8, 3.8);
      return;
    }
    if (hairStyle === 2) {
      graphics.fillEllipse(centerX, centerY - 9, 22, 10);
      graphics.fillCircle(centerX + 1, centerY - 18, 6.2);
      graphics.fillRoundedRect(centerX + 5, centerY - 17, 7, 30, 4);
      graphics.fillCircle(centerX + 8, centerY + 12, 4.2);
      return;
    }
    if (hairStyle === 3) {
      graphics.fillEllipse(centerX, centerY - 9, 25, 13);
      graphics.fillRoundedRect(centerX - 13, centerY - 8, 7, 38, 4);
      graphics.fillRoundedRect(centerX + 6, centerY - 8, 7, 38, 4);
      graphics.fillEllipse(centerX, centerY + 14, 23, 27);
      graphics.fillStyle(lightest(color, 0.2), 0.2);
      graphics.fillRoundedRect(centerX - 10, centerY - 4, 2, 26, 1);
      graphics.fillRoundedRect(centerX + 8, centerY - 4, 2, 26, 1);
      return;
    }
    if (hairStyle === 4) {
      graphics.fillEllipse(centerX, centerY - 10, 24, 11);
      for (let index = 0; index < 5; index += 1) {
        graphics.fillCircle(centerX - 9 + index * 4.5, centerY - 13 + Math.abs(2 - index) * 0.8, 3.3);
      }
      graphics.fillCircle(centerX + 8, centerY - 15, 5);
      graphics.fillRoundedRect(centerX - 11, centerY - 7, 4, 17, 3);
      graphics.fillRoundedRect(centerX + 7, centerY - 6, 4, 14, 3);
      return;
    }
    graphics.fillEllipse(centerX, centerY - 10, 24, 11);
    graphics.fillRoundedRect(centerX - 12, centerY - 7, 5, 15, 3);
    graphics.fillRoundedRect(centerX + 7, centerY - 7, 5, 15, 3);
    [-1, 1].forEach((side) => {
      for (let index = 0; index < 4; index += 1) {
        graphics.fillCircle(centerX + side * (10 + (index % 2) * 1.5), centerY + 7 + index * 5.2, 3.2 - index * 0.18);
      }
    });
    return;
  }
  if (hairStyle === 0) {
    graphics.fillEllipse(centerX, centerY - 10, 22, 9);
    graphics.fillTriangle(centerX - 10, centerY - 10, centerX - 3, centerY - 15, centerX - 1, centerY - 7);
    return;
  }
  if (hairStyle === 1) {
    graphics.fillEllipse(centerX, centerY - 9, 24, 12);
    graphics.fillRoundedRect(centerX - 12, centerY - 8, 5, 14, 3);
    graphics.fillRoundedRect(centerX + 7, centerY - 8, 5, 14, 3);
    return;
  }
  if (hairStyle === 2) {
    graphics.fillEllipse(centerX, centerY - 9, 21, 9);
    graphics.fillCircle(centerX + 1, centerY - 17, 5.5);
    return;
  }
  if (hairStyle === 3) {
    graphics.fillEllipse(centerX, centerY - 9, 24, 12);
    graphics.fillRoundedRect(centerX - 12, centerY - 7, 5, 22, 3);
    graphics.fillRoundedRect(centerX + 7, centerY - 7, 5, 22, 3);
    graphics.fillEllipse(centerX, centerY + 7, 20, 13);
    return;
  }
  if (hairStyle === 4) {
    graphics.fillTriangle(centerX - 9, centerY - 8, centerX, centerY - 23, centerX + 9, centerY - 8);
    graphics.fillEllipse(centerX, centerY - 9, 20, 8);
    return;
  }
  graphics.fillEllipse(centerX, centerY - 9, 24, 11);
  graphics.lineStyle(4, color, 1);
  graphics.lineBetween(centerX - 9, centerY - 4, centerX - 13, centerY + 14);
  graphics.lineBetween(centerX + 9, centerY - 4, centerX + 13, centerY + 14);
}

function drawHelmet(
  graphics: Phaser.GameObjects.Graphics,
  classId: CharacterClass,
  centerX: number,
  centerY: number,
  gender: CharacterGender,
  appearance: string | undefined,
  grade: ItemGrade | undefined,
  palette: { primary: number; secondary: number; metal: number; accent: number },
  fallbackTrim: number,
  outline: number
): void {
  if (!appearance) {
    return;
  }
  const trim = grade ? GRADE_TRIMS[grade] : fallbackTrim;
  const width = gender === "female" ? 24 : 27;
  if (appearance === "arcane" || classId === "mage") {
    graphics.lineStyle(4, outline, 0.9);
    graphics.lineBetween(centerX - 9, centerY - 7, centerX - 15, centerY - 21);
    graphics.lineBetween(centerX + 9, centerY - 7, centerX + 15, centerY - 21);
    graphics.lineStyle(2.3, palette.metal, 1);
    graphics.lineBetween(centerX - 9, centerY - 7, centerX - 14, centerY - 20);
    graphics.lineBetween(centerX + 9, centerY - 7, centerX + 14, centerY - 20);
    graphics.fillStyle(trim, 0.95);
    graphics.fillCircle(centerX, centerY - 11, 3.7);
    return;
  }
  if (appearance === "shadow" || classId === "assassin") {
    graphics.fillStyle(outline, 0.94);
    graphics.fillEllipse(centerX, centerY - 6, width + 5, 19);
    graphics.fillStyle(palette.secondary, 1);
    graphics.fillEllipse(centerX, centerY - 6, width + 2, 16);
    graphics.fillStyle(palette.primary, 0.96);
    graphics.fillRoundedRect(centerX - width / 2, centerY + 2, width, 8, 3);
    graphics.lineStyle(1.4, trim, 0.72);
    graphics.lineBetween(centerX - 7, centerY + 4, centerX + 7, centerY + 4);
    return;
  }
  if (appearance === "hunter" || classId === "archer") {
    graphics.fillStyle(outline, 0.92);
    graphics.fillTriangle(centerX, centerY - 20, centerX - width / 2 - 3, centerY + 8, centerX + width / 2 + 3, centerY + 8);
    graphics.fillStyle(palette.secondary, 1);
    graphics.fillTriangle(centerX, centerY - 17, centerX - width / 2, centerY + 7, centerX + width / 2, centerY + 7);
    graphics.lineStyle(2, trim, 0.5);
    graphics.lineBetween(centerX - width / 2 + 3, centerY + 5, centerX + width / 2 - 3, centerY + 5);
    return;
  }

  graphics.fillStyle(outline, 0.94);
  graphics.fillRoundedRect(centerX - width / 2 - 2, centerY - 13, width + 4, 22, 9);
  graphics.fillStyle(palette.metal, 1);
  graphics.fillRoundedRect(centerX - width / 2, centerY - 12, width, 19, 8);
  graphics.fillStyle(palette.secondary, 1);
  graphics.fillRoundedRect(centerX - 6, centerY - 2, 12, 10, 3);
  graphics.lineStyle(1.5, trim, 0.74);
  graphics.lineBetween(centerX - width / 2 + 2, centerY - 4, centerX + width / 2 - 2, centerY - 4);
  if (appearance === "guardian" || classId === "tank") {
    graphics.fillStyle(outline, 0.94);
    graphics.fillTriangle(centerX - width / 2 + 2, centerY - 7, centerX - width / 2 - 8, centerY - 15, centerX - width / 2 + 5, centerY - 12);
    graphics.fillTriangle(centerX + width / 2 - 2, centerY - 7, centerX + width / 2 + 8, centerY - 15, centerX + width / 2 - 5, centerY - 12);
    graphics.fillStyle(trim, 0.92);
    graphics.fillTriangle(centerX - width / 2 + 2, centerY - 8, centerX - width / 2 - 6, centerY - 14, centerX - width / 2 + 5, centerY - 12);
    graphics.fillTriangle(centerX + width / 2 - 2, centerY - 8, centerX + width / 2 + 6, centerY - 14, centerX + width / 2 - 5, centerY - 12);
  }
}
