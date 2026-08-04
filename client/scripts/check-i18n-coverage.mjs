import { readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const clientRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const workspaceRoot = dirname(clientRoot);
const sourceRoot = join(clientRoot, "src");
const languageInvariants = new Set([
  "DarkVell",
  "HP",
  "CP",
  "MP",
  "PK",
  "PvP",
  "FPS",
  "TOKEN",
  "TON"
]);
const dynamicCoverageSamples = [
  "5 listed",
  "Sell for 120 gold",
  "120 gold converts into 4 TOKEN",
  "Requires Lv.8",
  "Not enough PvP Coin",
  "5 offers",
  "3 musicians live",
  "Party 3",
  "Near 2",
  "Selling 4",
  "Lv.3/8",
  "Hunt boars, wolves, bandits, archers around Old Mill Brook."
];
const systemCoverageCases = [
  ["Alice joined. 3/3000 online.", [" joined.", " online."]],
  ["Alice updated hero name.", ["updated hero name"]],
  ["Alice left a market stall in Trade Zone.", ["market stall", "Trade Zone"]],
  ["Alice invited Bob to party.", [" invited ", " party"]],
  ["Bob joined Alice's party.", [" joined ", " party"]],
  ["Bob declined Alice's party invite.", ["declined", "party invite"]],
  ["Alice challenged Bob to a duel.", ["challenged", "duel"]],
  ["Bob accepted duel with Alice.", ["accepted duel"]],
  ["Bob declined duel with Alice.", ["declined duel"]],
  ["Alice offered trade to Bob.", ["offered trade"]],
  ["Bob started trade with Alice.", ["started trade"]],
  ["Bob declined trade with Alice.", ["declined trade"]],
  ["Alice created clan Heroes.", ["created clan"]],
  ["Alice invited Bob to clan Heroes.", ["invited", "clan"]],
  ["Alice joined clan Heroes.", [" joined clan "]],
  ["Bob declined Alice's clan invite.", ["declined", "clan invite"]],
  ["Alice removed Bob from clan Heroes.", ["removed", "clan"]],
  ["Alice left clan Heroes.", [" left clan ", "clan "]],
  ["Trade between Alice, Bob was cancelled.", ["Trade between", "cancelled"]],
  ["Trade failed because an offered item or gold changed.", ["Trade failed", "offered item", "gold changed"]],
  ["Alice and Bob completed trade.", ["completed trade"]],
  ["Alice picked up 2 Copper Ring.", ["picked up", "Copper Ring"]],
  ["Market: Listed Copper Ring for 100 gold.", ["Market:", "Listed", "Copper Ring", " gold"]],
  ["Market: Bought Copper Ring for 100 gold.", ["Market:", "Bought", "Copper Ring", " gold"]],
  ["Market: Sold Copper Ring for 100 gold.", ["Market:", "Sold", "Copper Ring", " gold"]],
  ["Alice's market stall sold out.", ["market stall", "sold out"]],
  ["Alice resurrected in town.", ["resurrected", " town"]],
  ["Alice resurrected Bob.", ["resurrected"]],
  ["Bob died and lost 30 XP.", ["died and lost"]],
  ["Alice punished red Bob, +2 Coin.", ["punished red", "Coin"]],
  ["Duel: Alice defeated Bob.", ["Duel:", "defeated"]],
  ["Alice washed off PK karma.", ["washed off", "karma"]],
  ["Alice reached level 8.", ["reached level"]],
  ["2 Bone Shard dropped.", ["Bone Shard", "dropped"]]
];
const botVariantCoverageCases = [
  ["слишком больно вышло, беру дистанцию, я у Elderglen", "that hurt too much, backing off, I'm near Elderglen"],
  [
    "слишком больно вышло, беру дистанцию, я у Elderglen дороги",
    "that hurt too much, backing off, I'm by the road near Elderglen"
  ],
  ["слишком больно вышло, беру дистанцию, 17 лвл если что", "that hurt too much, backing off, level 17 btw"],
  ["слишком больно вышло, беру дистанцию, без суеты", "that hurt too much, backing off, no rush"],
  ["слишком больно вышло, беру дистанцию, аккуратно", "that hurt too much, backing off, careful"],
  ["слишком больно вышло, беру дистанцию, дальше по дороге", "that hurt too much, backing off, farther down the road"],
  ["слишком больно вышло, беру дистанцию, потом в город", "that hurt too much, backing off, then back to town"],
  ["слишком больно вышло, беру дистанцию, если рядом", "that hurt too much, backing off, if you're nearby"],
  ["слишком больно вышло, беру дистанцию, не спешу", "that hurt too much, backing off, taking my time"],
  ["хп 37%, отхожу к Bonefall, аккуратно", "HP 37%, falling back to Bonefall, careful"]
];

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(path);
    }
    return [".ts", ".tsx"].includes(extname(entry.name)) ? [path] : [];
  });
}

const i18nSource = readFileSync(join(sourceRoot, "i18n.ts"), "utf8");
const i18nJavaScript = ts.transpileModule(i18nSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022
  }
}).outputText;
const i18nModuleUrl = `data:text/javascript;base64,${Buffer.from(i18nJavaScript).toString("base64")}`;
const { translateText } = await import(i18nModuleUrl);
const botChatSource = readFileSync(join(sourceRoot, "botChatI18n.ts"), "utf8");
const botChatJavaScript = ts.transpileModule(botChatSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022
  }
}).outputText;
const botChatModuleUrl = `data:text/javascript;base64,${Buffer.from(botChatJavaScript).toString("base64")}`;
const { botChatTranslationCoverage, translateBotChat } = await import(botChatModuleUrl);

const missing = [];
for (const file of sourceFiles(sourceRoot)) {
  const source = readFileSync(file, "utf8");
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    extname(file) === ".tsx" ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );

  const visit = (node) => {
    if (ts.isCallExpression(node) && node.arguments.length > 0) {
      const expression = node.expression;
      const isTranslator =
        (ts.isIdentifier(expression) && expression.text === "tr") ||
        (ts.isPropertyAccessExpression(expression) && expression.name.text === "tr");
      const argument = node.arguments[0];
      if (
        isTranslator &&
        (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument)) &&
        /\p{L}/u.test(argument.text) &&
        !languageInvariants.has(argument.text) &&
        translateText("ru", argument.text) === argument.text
      ) {
        const location = sourceFile.getLineAndCharacterOfPosition(argument.getStart(sourceFile));
        missing.push(`${file}:${location.line + 1} "${argument.text}"`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
}

for (const sample of dynamicCoverageSamples) {
  if (translateText("ru", sample) === sample) {
    missing.push(`dynamic sample "${sample}"`);
  }
}
for (const [sample, forbiddenFragments] of systemCoverageCases) {
  const translated = translateText("ru", sample);
  const leftovers = forbiddenFragments.filter((fragment) => translated.toLocaleLowerCase("en").includes(fragment.toLocaleLowerCase("en")));
  if (translated === sample || leftovers.length > 0) {
    missing.push(`system sample "${sample}" -> "${translated}" (English left: ${leftovers.join(", ") || "unchanged"})`);
  }
}

const serverWorldSource = readFileSync(join(workspaceRoot, "game-server", "src", "world.service.ts"), "utf8");
const serverWorldFile = ts.createSourceFile(
  "game-server/src/world.service.ts",
  serverWorldSource,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS
);
const botSourceLines = [];
for (const statement of serverWorldFile.statements) {
  if (!ts.isVariableStatement(statement)) {
    continue;
  }
  for (const declaration of statement.declarationList.declarations) {
    const name = ts.isIdentifier(declaration.name) ? declaration.name.text : "";
    if (
      !/^BOT_.*(?:CHAT|ACTIVITY)_LINES$/.test(name) ||
      !declaration.initializer ||
      !ts.isArrayLiteralExpression(declaration.initializer)
    ) {
      continue;
    }
    for (const element of declaration.initializer.elements) {
      if (ts.isStringLiteral(element) || ts.isNoSubstitutionTemplateLiteral(element)) {
        botSourceLines.push(element.text);
      }
    }
  }
}

const uniqueBotSourceLines = [...new Set(botSourceLines)];
const botCoverage = botChatTranslationCoverage();
if (
  botCoverage.sourceEntries !== botSourceLines.length ||
  botCoverage.uniqueSourceEntries !== uniqueBotSourceLines.length ||
  botCoverage.fixedEntries + botCoverage.templateEntries !== uniqueBotSourceLines.length
) {
  missing.push(
    `bot chat coverage mismatch: server=${botSourceLines.length}/${uniqueBotSourceLines.length}, client=${botCoverage.fixedEntries}+${botCoverage.templateEntries}`
  );
}
for (const line of uniqueBotSourceLines) {
  const substituted = line.replace(/\{([a-z]+)\}/gi, (_full, key) =>
    key === "hp" ? "42" : `Codex${key[0].toUpperCase()}${key.slice(1)}`
  );
  const english = translateBotChat("en", substituted);
  if (line !== "++" && (english === substituted || /[А-Яа-яЁё]/u.test(english))) {
    missing.push(`bot EN sample "${line}" -> "${english}"`);
  }
  if (translateBotChat("ru", substituted) !== substituted) {
    missing.push(`bot RU text was mutated: "${line}"`);
  }
}
if (translateBotChat("en", "human chat must stay raw") !== "human chat must stay raw") {
  missing.push("unknown human chat was mutated by bot translator");
}
for (const [sample, expected] of botVariantCoverageCases) {
  const english = translateBotChat("en", sample);
  if (english !== expected) {
    missing.push(`bot variant sample "${sample}" -> "${english}" (expected "${expected}")`);
  }
  if (translateBotChat("ru", sample) !== sample) {
    missing.push(`bot variant RU text was mutated: "${sample}"`);
  }
}
const unknownBotVariant = "это неизвестная реплика бота, без суеты";
if (translateBotChat("en", unknownBotVariant) !== unknownBotVariant) {
  missing.push("unknown bot text with a variant-like suffix was mutated");
}

if (missing.length > 0) {
  console.error("RU translations are missing for literal UI keys:");
  console.error(missing.join("\n"));
  process.exitCode = 1;
} else {
  console.log("i18n literal coverage: OK");
}
