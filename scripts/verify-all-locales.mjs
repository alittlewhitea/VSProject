import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const locales = ["en", "zh-CN", "zh-TW", "pt-BR", "ru", "vi", "de", "fr", "ja", "th", "nl", "he", "ko", "es", "it", "ar"];
const studioSources = [
  ["studio-i18n-controls.ts", "studioControlMessages"],
  ["studio-i18n-dreamface-io.ts", "studioDreamfaceIoMessages"],
  ["studio-i18n-workspace-home.ts", "studioWorkspaceHomeMessages"],
  ["studio-i18n-fal-errors.ts", "studioFalErrorMessages"],
  ["studio-i18n-additions.ts", "studioAdditionalMessages"],
  ["studio-i18n-audio-workbench.ts", "studioAudioWorkbenchMessages"],
  ["studio-i18n-video-workbench.ts", "studioVideoWorkbenchMessages"],
  ["studio-i18n-avatar-workbench.ts", "studioAvatarWorkbenchMessages"],
  ["studio-i18n-text-image.ts", "studioTextImageMessages"],
  ["studio-i18n-image-workbench.ts", "studioImageWorkbenchMessages"],
  ["studio-i18n.ts", "messages"],
  ["studio-i18n.ts", "workflowMessages"],
  ["studio-i18n-home.ts", "studioHomeMessages"],
  ["studio-i18n-feedback.ts", "studioFeedbackMessages"],
  ["studio-i18n-models.ts", "studioModelMessages"]
  ,["studio-i18n-music.ts", "studioMusicMessages"]
];

function flatten(value, prefix = "", result = {}) {
  for (const [key, child] of Object.entries(value)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === "object") flatten(child, fullKey, result);
    else result[fullKey] = child;
  }
  return result;
}

function placeholders(value) {
  return [...String(value).matchAll(/\{[^{}]+\}/g)].map((match) => match[0]).sort();
}

function propertyName(node) {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) return node.text;
  if (ts.isComputedPropertyName(node) && ts.isStringLiteral(node.expression)) return node.expression.text;
  return undefined;
}

const declarationCache = new Map();
function declarations(file) {
  if (declarationCache.has(file)) return declarationCache.get(file);
  const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  const result = new Map();
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.initializer) {
        result.set(declaration.name.text, declaration.initializer);
      }
    }
  }
  declarationCache.set(file, result);
  return result;
}

function evaluate(node, available) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isIdentifier(node)) return evaluate(available.get(node.text), available);
  if (ts.isObjectLiteralExpression(node)) {
    const result = {};
    for (const property of node.properties) {
      if (ts.isSpreadAssignment(property)) {
        Object.assign(result, evaluate(property.expression, available));
      } else if (ts.isShorthandPropertyAssignment(property)) {
        result[property.name.text] = evaluate(property.name, available);
      } else if (ts.isPropertyAssignment(property)) {
        const key = propertyName(property.name);
        if (key !== undefined) result[key] = evaluate(property.initializer, available);
      }
    }
    return result;
  }
  throw new Error(`Unsupported syntax: ${ts.SyntaxKind[node.kind]}`);
}

function readVariable(fileName, variableName) {
  const file = path.join(root, "src", "lib", fileName);
  const available = declarations(file);
  return evaluate(available.get(variableName), available);
}

function verify(label, reference, localized) {
  const referenceKeys = Object.keys(reference).sort();
  const localizedKeys = Object.keys(localized).sort();
  if (JSON.stringify(referenceKeys) !== JSON.stringify(localizedKeys)) {
    const missing = referenceKeys.filter((key) => !(key in localized));
    const extra = localizedKeys.filter((key) => !(key in reference));
    throw new Error(`${label}: missing=${missing.join(",")} extra=${extra.join(",")}`);
  }
  for (const key of referenceKeys) {
    if (typeof localized[key] !== "string" || !localized[key].trim()) throw new Error(`${label}: empty ${key}`);
    if (/DFTOKEN|DFSEP|\uFFFD/.test(localized[key])) throw new Error(`${label}: corrupt token in ${key}`);
    if (JSON.stringify(placeholders(reference[key])) !== JSON.stringify(placeholders(localized[key]))) {
      throw new Error(`${label}: placeholder mismatch in ${key}`);
    }
  }
}

const marketing = Object.fromEntries(
  locales.map((locale) => [
    locale,
    flatten(JSON.parse(fs.readFileSync(path.join(root, "messages", `${locale}.json`), "utf8")))
  ])
);

const studioSets = studioSources.map(([file, variable]) => readVariable(file, variable));
const newStudio = readVariable("studio-i18n-new-locales.ts", "studioNewLocaleMessages");
const german = readVariable("studio-i18n-de.ts", "studioGermanMessages");
const french = readVariable("studio-i18n-fr.ts", "studioFrenchMessages");
const traditionalChinese = readVariable("studio-i18n-zh-tw.ts", "studioTraditionalChineseMessages");
const studioEnglish = {};
for (const set of studioSets) {
  for (const [key, value] of Object.entries(set.en || {})) {
    if (!(key in studioEnglish)) studioEnglish[key] = value;
  }
}

for (const locale of locales) {
  verify(`${locale} marketing`, marketing.en, marketing[locale]);
  const effectiveStudio = {};
  if (newStudio[locale]) Object.assign(effectiveStudio, newStudio[locale]);
  for (const set of studioSets) {
    for (const [key, value] of Object.entries(set[locale] || {})) {
      if (!(key in effectiveStudio)) effectiveStudio[key] = value;
    }
  }
  const standalone =
    locale === "de"
      ? german
      : locale === "fr"
        ? french
        : locale === "zh-TW"
          ? traditionalChinese
          : {};
  for (const [key, value] of Object.entries(standalone)) {
    if (!(key in effectiveStudio)) effectiveStudio[key] = value;
  }
  verify(`${locale} studio`, studioEnglish, effectiveStudio);
  console.log(`${locale}: marketing ${Object.keys(marketing[locale]).length}, studio ${Object.keys(effectiveStudio).length}`);
}

console.log("All locale dictionaries are complete and structurally valid.");
