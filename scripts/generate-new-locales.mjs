import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import ts from "typescript";

const root = process.cwd();
const cacheDirectory = path.join(root, "scripts", ".translation-cache");
fs.mkdirSync(cacheDirectory, { recursive: true });
const localeTargets = {
  ja: "ja",
  th: "th",
  nl: "nl",
  he: "he",
  ko: "ko",
  es: "es"
};

const studioSources = [
  ["studio-i18n-dreamface-io.ts", "studioDreamfaceIoMessages"],
  ["studio-i18n-workspace-home.ts", "studioWorkspaceHomeMessages"],
  ["studio-i18n-fal-errors.ts", "studioFalErrorMessages"],
  ["studio-i18n-additions.ts", "studioAdditionalMessages"],
  ["studio-i18n.ts", "messages"],
  ["studio-i18n.ts", "workflowMessages"],
  ["studio-i18n-home.ts", "studioHomeMessages"],
  ["studio-i18n-feedback.ts", "studioFeedbackMessages"],
  ["studio-i18n-models.ts", "studioModelMessages"]
];

const protectedTerms = [
  "DreamFace IO",
  "DreamFace",
  "ElevenLabs",
  "GPT Image",
  "Nano Banana",
  "FLUX",
  "fal.ai",
  "Kling",
  "Bria",
  "Premium",
  "UGC",
  "B-roll",
  "API",
  "URL",
  "PNG",
  "JPG",
  "JPEG",
  "WEBP",
  "GIF",
  "AVIF"
];

function propertyName(node) {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) {
    return node.text;
  }
  if (ts.isComputedPropertyName(node) && ts.isStringLiteral(node.expression)) {
    return node.expression.text;
  }
  return undefined;
}

function parseDeclarations(file) {
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true
  );
  const declarations = new Map();
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.initializer) {
        declarations.set(declaration.name.text, declaration.initializer);
      }
    }
  }
  return declarations;
}

function evaluate(node, declarations) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  if (ts.isIdentifier(node)) {
    const declaration = declarations.get(node.text);
    if (!declaration) throw new Error(`Unknown identifier: ${node.text}`);
    return evaluate(declaration, declarations);
  }
  if (ts.isObjectLiteralExpression(node)) {
    const result = {};
    for (const property of node.properties) {
      if (ts.isShorthandPropertyAssignment(property)) {
        const name = property.name.text;
        result[name] = evaluate(property.name, declarations);
        continue;
      }
      if (!ts.isPropertyAssignment(property)) continue;
      const name = propertyName(property.name);
      if (name !== undefined) result[name] = evaluate(property.initializer, declarations);
    }
    return result;
  }
  throw new Error(`Unsupported translation source node: ${ts.SyntaxKind[node.kind]}`);
}

function extractStudioEnglish() {
  const cache = new Map();
  const result = {};
  for (const [fileName, variableName] of studioSources) {
    const file = path.join(root, "src", "lib", fileName);
    const declarations = cache.get(file) || parseDeclarations(file);
    cache.set(file, declarations);
    const initializer = declarations.get(variableName);
    if (!initializer) throw new Error(`Missing ${variableName} in ${fileName}`);
    const values = evaluate(initializer, declarations);
    const english = values.en || {};
    for (const [key, value] of Object.entries(english)) {
      if (!(key in result)) result[key] = value;
    }
  }
  return result;
}

function protect(text) {
  const replacements = [];
  const patterns = [
    /\{[^{}]+\}/g,
    /https?:\/\/\S+/g,
    ...protectedTerms.map((term) => new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"))
  ];
  let value = text;
  for (const pattern of patterns) {
    value = value.replace(pattern, (match) => {
      const token = `__DFTOKEN_${replacements.length}__`;
      replacements.push(match);
      return token;
    });
  }
  return { value, replacements };
}

function restore(text, replacements) {
  let value = text;
  replacements.forEach((replacement, index) => {
    value = value.replaceAll(`__DFTOKEN_${index}__`, replacement);
    value = value.replaceAll(`__ DFTOKEN_${index} __`, replacement);
  });
  return value;
}

let bingSession;

function getBingSession() {
  if (bingSession) return bingSession;
  const command = [
    "$content=(Invoke-WebRequest 'https://www.bing.com/translator' -UseBasicParsing -TimeoutSec 60).Content;",
    "$ig=[regex]::Match($content,'IG:\"([^\"]+)\"').Groups[1].Value;",
    "$match=[regex]::Match($content,'params_AbusePreventionHelper\\s*=\\s*\\[([0-9]+),\"([^\"]+)\"');",
    "$value=@{ig=$ig;key=$match.Groups[1].Value;token=$match.Groups[2].Value}|ConvertTo-Json -Compress;",
    "[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($value))"
  ].join("");
  const result = spawnSync("powershell.exe", ["-NoProfile", "-Command", command], {
    encoding: "utf8",
    timeout: 90000
  });
  if (result.status !== 0 || !result.stdout.trim()) {
    throw new Error(result.stderr.trim() || "Unable to initialize Bing translation session");
  }
  bingSession = JSON.parse(
    Buffer.from(result.stdout.trim(), "base64").toString("utf8")
  );
  return bingSession;
}

function requestTranslation(text, target) {
  const session = getBingSession();
  const command = [
    "$text=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($env:DF_TRANSLATE_TEXT));",
    "$body=@{text=$text;fromLang='en';to=$env:DF_TRANSLATE_TARGET;token=$env:DF_BING_TOKEN;key=$env:DF_BING_KEY;tryFetchingGenderDebiasedTranslations='true'};",
    "$uri='https://www.bing.com/ttranslatev3?isVertical=1&IG='+$env:DF_BING_IG+'&IID=translator.5028.1';",
    "$result=Invoke-RestMethod -Uri $uri -Method Post -Body $body -TimeoutSec 60;",
    "$translated=$result[0].translations[0].text;",
    "[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($translated))"
  ].join("");
  let lastError;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const result = spawnSync("powershell.exe", ["-NoProfile", "-Command", command], {
      encoding: "utf8",
      env: {
        ...process.env,
        DF_TRANSLATE_TEXT: Buffer.from(text, "utf8").toString("base64"),
        DF_TRANSLATE_TARGET: target,
        DF_BING_IG: session.ig,
        DF_BING_KEY: session.key,
        DF_BING_TOKEN: session.token
      },
      timeout: 90000
    });
    if (result.status === 0 && result.stdout.trim()) {
      return Buffer.from(result.stdout.trim(), "base64").toString("utf8");
    }
    lastError = new Error(result.stderr.trim() || `PowerShell translation exited ${result.status}`);
  }
  throw lastError;
}

async function translateMap(source, target, label, checkpointFile) {
  const entries = Object.entries(source);
  let translated = {};
  if (checkpointFile && fs.existsSync(checkpointFile)) {
    translated = JSON.parse(fs.readFileSync(checkpointFile, "utf8"));
    console.log(`${label}: resumed ${Object.keys(translated).length}/${entries.length}`);
  }
  const separator = "[[[DFSEP_9F31]]]";
  const chunks = [];
  let chunk = [];
  let chunkLength = 0;

  for (const entry of entries) {
    const protectedValue = protect(entry[1]);
    const size = protectedValue.value.length + separator.length + 2;
    if (chunk.length && (chunkLength + size > 900 || chunk.length >= 20)) {
      chunks.push(chunk);
      chunk = [];
      chunkLength = 0;
    }
    chunk.push({ key: entry[0], ...protectedValue });
    chunkLength += size;
  }
  if (chunk.length) chunks.push(chunk);

  let completed = Object.keys(translated).length;

  async function translateChunk(currentChunk) {
    const pending = currentChunk.filter((item) => !(item.key in translated));
    if (!pending.length) return;
    if (pending.length === 1) {
      const item = pending[0];
      translated[item.key] = restore(requestTranslation(item.value, target).trim(), item.replacements);
      return;
    }
    const joined = pending.map((item) => item.value).join(`\n${separator}\n`);
    const output = requestTranslation(joined, target);
    const parts = output.split(separator).map((part) => part.trim());
    if (parts.length !== pending.length) {
      const middle = Math.ceil(pending.length / 2);
      await translateChunk(pending.slice(0, middle));
      await translateChunk(pending.slice(middle));
      return;
    }
    pending.forEach((item, index) => {
      translated[item.key] = restore(parts[index], item.replacements);
    });
  }

  for (const currentChunk of chunks) {
    const before = Object.keys(translated).length;
    await translateChunk(currentChunk);
    completed += Object.keys(translated).length - before;
    if (checkpointFile) {
      fs.writeFileSync(checkpointFile, `${JSON.stringify(translated, null, 2)}\n`, "utf8");
    }
    console.log(`${label}: ${completed}/${entries.length}`);
    await new Promise((resolve) => setTimeout(resolve, 1200));
  }

  for (const [key, sourceValue] of entries) {
    const translatedValue = translated[key];
    const sourcePlaceholders = [...sourceValue.matchAll(/\{[^{}]+\}/g)].map((match) => match[0]).sort();
    const targetPlaceholders = [...translatedValue.matchAll(/\{[^{}]+\}/g)].map((match) => match[0]).sort();
    if (JSON.stringify(sourcePlaceholders) !== JSON.stringify(targetPlaceholders)) {
      throw new Error(`${label}: placeholder mismatch for ${key}`);
    }
    for (const term of protectedTerms) {
      if (sourceValue.toLowerCase().includes(term.toLowerCase()) && !translatedValue.toLowerCase().includes(term.toLowerCase())) {
        throw new Error(`${label}: protected term "${term}" was changed for ${key}`);
      }
    }
  }
  return Object.fromEntries(entries.map(([key]) => [key, translated[key]]));
}

function mapNested(value, translations, prefix = "") {
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      return [
        key,
        child && typeof child === "object"
          ? mapNested(child, translations, fullKey)
          : translations[fullKey]
      ];
    })
  );
}

function flatten(value, prefix = "", result = {}) {
  for (const [key, child] of Object.entries(value)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === "object") flatten(child, fullKey, result);
    else result[fullKey] = child;
  }
  return result;
}

const acceptableUnchanged = new Set([
  "dreamface",
  "DreamFace",
  "DreamFace Studio",
  "Premium",
  "Premium Lite",
  "UGC",
  "B-roll",
  "Prompt",
  "Seed",
  "Guidance",
  "Studio",
  "Platform",
  "Avatar",
  "Projects",
  "JPEG",
  "PNG",
  "URL",
  "API",
  "name@example.com",
  "FLUX Schnell",
  "GPT Image 2",
  "Nano Banana 2"
]);

const studioTranslationOverrides = {
  th: {
    "studio.workspace.heroBody": "เปลี่ยนรูปภาพ สินค้า และพรอมต์ให้เป็นวิดีโอโซเชียล โฆษณา ภาพบุคคล AI และภาพสไตล์ภาพยนตร์ได้ในพื้นที่ทำงานเดียว",
    "studio.status.mockFailed": "การสร้างล้มเหลว ลองใช้พรอมต์ที่ชัดเจนขึ้นหรือเปลี่ยนผู้ให้บริการ",
    "studio.gallery.eyebrow": "แกลเลอรีพรอมต์",
    "studio.field.prompt": "พรอมต์",
    "studio.placeholder.system": "คำแนะนำเพิ่มเติมสำหรับโมเดล",
    "studio.header.projectsDescription": "จัดการผลงานที่สร้าง พรอมต์ เครดิต การลองใหม่ และภาพอ้างอิงภายในสตูดิโอ",
    "studio.header.videoDescription": "สร้างการเคลื่อนไหวด้วย AI จากพรอมต์ หรือทำให้ภาพอ้างอิงเคลื่อนไหว",
    "studio.preview.model": "โมเดล"
  },
  nl: {
    "studio.workspace.intent.enhanceBody": "Vergroot afbeeldingen, herstel gezichten, verwijder achtergronden en maak assets schoon.",
    "studio.projects.generationFailed": "Generatie mislukt",
    "studio.billing.close": "Prijzen sluiten",
    "studio.option.autoRatio": "Automatische verhouding"
  },
  ko: {
    "studio.status.backgroundRunning": "이 작업은 여전히 백그라운드에서 실행 중입니다. 이 페이지를 떠나더라도 나중에 프로젝트에서 확인할 수 있습니다. DreamFace는 공급자 상태를 계속 새로고침합니다.",
    "studio.field.limitGenerations": "생성 수 제한",
    "studio.status.avatarDurationChanged": "아바타 재생 시간이 {seconds}초로 변경되었습니다. DreamFace가 새 길이에 맞게 자를 수 있도록 오디오 파일을 다시 선택하세요.",
    "studio.status.audioFits": "{file}의 길이는 {duration}이며 선택한 {seconds}초 아바타 길이에 맞습니다.",
    "studio.status.audioTrimmed": "이 아바타에 맞게 {file} 파일의 길이를 {original}에서 {output}로 줄였습니다.",
    "studio.status.audioReselect": "DreamFace가 선택한 {seconds}초 아바타 길이에 맞게 자를 수 있도록 오디오 파일을 다시 선택하세요."
  }
};

async function refreshUnchanged(source, translated, target, label, checkpointFile) {
  const candidates = Object.entries(source).filter(([key, value]) => {
    const current = translated[key];
    return (
      current === value &&
      /[A-Za-z]/.test(value) &&
      !acceptableUnchanged.has(value) &&
      !/^https?:\/\//.test(value) &&
      !/^[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}$/.test(value)
    );
  });
  if (!candidates.length) return translated;

  console.log(`${label}: rechecking ${candidates.length} unchanged values`);
  for (const [key, value] of candidates) {
    const protectedValue = protect(value);
    translated[key] = restore(
      requestTranslation(protectedValue.value, target).trim(),
      protectedValue.replacements
    );
  }
  if (checkpointFile) {
    fs.writeFileSync(checkpointFile, `${JSON.stringify(translated, null, 2)}\n`, "utf8");
  }
  return translated;
}

function writeStudioFile(allLocales) {
  const lines = [
    'import type { Locale } from "../i18n/routing";',
    "",
    "type Messages = Record<string, string>;",
    "",
    "export const studioNewLocaleMessages: Partial<Record<Locale, Messages>> = {"
  ];
  for (const [locale, messages] of Object.entries(allLocales)) {
    lines.push(`  ${JSON.stringify(locale)}: ${JSON.stringify(messages, null, 2).replace(/\n/g, "\n  ")},`);
  }
  lines.push("};", "");
  fs.writeFileSync(
    path.join(root, "src", "lib", "studio-i18n-new-locales.ts"),
    lines.join("\n"),
    "utf8"
  );
}

const englishMarketingTree = JSON.parse(
  fs.readFileSync(path.join(root, "messages", "en.json"), "utf8")
);
const englishMarketing = flatten(englishMarketingTree);
const englishStudio = extractStudioEnglish();
const studioLocales = {};

console.log(`Source totals: marketing=${Object.keys(englishMarketing).length}, studio=${Object.keys(englishStudio).length}`);

const requestedLocales = process.env.LOCALES?.split(",").filter(Boolean);
for (const [locale, googleTarget] of Object.entries(localeTargets)) {
  if (requestedLocales && !requestedLocales.includes(locale)) continue;
  console.log(`Translating ${locale}...`);
  const marketingFile = path.join(root, "messages", `${locale}.json`);
  let marketing;
  if (fs.existsSync(marketingFile)) {
    const existingTree = JSON.parse(fs.readFileSync(marketingFile, "utf8"));
    const existingFlat = flatten(existingTree);
    if (Object.keys(existingFlat).length === Object.keys(englishMarketing).length) {
      marketing = existingFlat;
      console.log(`${locale} marketing: using existing complete file`);
    }
  }
  if (!marketing) {
    const marketingCacheFile = path.join(cacheDirectory, `marketing-${locale}.json`);
    marketing = await translateMap(
      englishMarketing,
      googleTarget,
      `${locale} marketing`,
      marketingCacheFile
    );
    fs.writeFileSync(
      marketingFile,
      `${JSON.stringify(mapNested(englishMarketingTree, marketing), null, 2)}\n`,
      "utf8"
    );
  }
  const marketingCacheFile = path.join(cacheDirectory, `marketing-${locale}.json`);
  marketing = await refreshUnchanged(
    englishMarketing,
    marketing,
    googleTarget,
    `${locale} marketing`,
    marketingCacheFile
  );
  fs.writeFileSync(
    marketingFile,
    `${JSON.stringify(mapNested(englishMarketingTree, marketing), null, 2)}\n`,
    "utf8"
  );

  const studioCacheFile = path.join(cacheDirectory, `studio-${locale}.json`);
  let studio;
  if (fs.existsSync(studioCacheFile)) {
    const existing = JSON.parse(fs.readFileSync(studioCacheFile, "utf8"));
    if (Object.keys(existing).length === Object.keys(englishStudio).length) {
      studio = existing;
      console.log(`${locale} studio: using complete cache`);
    }
  }
  if (!studio) {
    studio = await translateMap(
      englishStudio,
      googleTarget,
      `${locale} studio`,
      studioCacheFile
    );
    fs.writeFileSync(studioCacheFile, `${JSON.stringify(studio, null, 2)}\n`, "utf8");
  }
  studio = await refreshUnchanged(
    englishStudio,
    studio,
    googleTarget,
    `${locale} studio`,
    studioCacheFile
  );
  Object.assign(studio, studioTranslationOverrides[locale] || {});
  studioLocales[locale] = studio;
}

writeStudioFile(studioLocales);
console.log("Locale generation complete.");
