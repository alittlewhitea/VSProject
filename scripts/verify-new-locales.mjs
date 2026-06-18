import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const locales = ["ja", "th", "nl", "he", "ko", "es"];

function flatten(value, prefix = "", result = {}) {
  for (const [key, child] of Object.entries(value)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === "object") flatten(child, fullKey, result);
    else result[fullKey] = child;
  }
  return result;
}

function placeholders(value) {
  return [...value.matchAll(/\{[^{}]+\}/g)].map((match) => match[0]).sort();
}

function parseStudioLocales() {
  const file = path.join(root, "src", "lib", "studio-i18n-new-locales.ts");
  const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);

  function propertyName(node) {
    return ts.isIdentifier(node) || ts.isStringLiteral(node) ? node.text : undefined;
  }

  function object(node) {
    const result = {};
    for (const property of node.properties) {
      if (!ts.isPropertyAssignment(property)) continue;
      const key = propertyName(property.name);
      if (key === undefined) continue;
      result[key] = ts.isObjectLiteralExpression(property.initializer)
        ? object(property.initializer)
        : property.initializer.text;
    }
    return result;
  }

  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === "studioNewLocaleMessages" &&
        declaration.initializer &&
        ts.isObjectLiteralExpression(declaration.initializer)
      ) {
        return object(declaration.initializer);
      }
    }
  }
  throw new Error("studioNewLocaleMessages was not found");
}

function verifyMap(label, reference, localized) {
  const referenceKeys = Object.keys(reference).sort();
  const localizedKeys = Object.keys(localized).sort();
  if (JSON.stringify(referenceKeys) !== JSON.stringify(localizedKeys)) {
    const missing = referenceKeys.filter((key) => !(key in localized));
    const extra = localizedKeys.filter((key) => !(key in reference));
    throw new Error(`${label}: key mismatch; missing=${missing.join(",")}; extra=${extra.join(",")}`);
  }

  for (const key of referenceKeys) {
    const value = localized[key];
    if (typeof value !== "string" || !value.trim()) throw new Error(`${label}: empty ${key}`);
    if (value.includes("DFTOKEN") || value.includes("DFSEP")) {
      throw new Error(`${label}: temporary token remains in ${key}`);
    }
    if (JSON.stringify(placeholders(reference[key])) !== JSON.stringify(placeholders(value))) {
      throw new Error(`${label}: placeholder mismatch for ${key}`);
    }
  }
}

const englishMarketing = flatten(JSON.parse(fs.readFileSync(path.join(root, "messages", "en.json"), "utf8")));
const studioLocales = parseStudioLocales();
const studioReference = studioLocales.es;

for (const locale of locales) {
  const marketing = flatten(JSON.parse(fs.readFileSync(path.join(root, "messages", `${locale}.json`), "utf8")));
  verifyMap(`${locale} marketing`, englishMarketing, marketing);
  verifyMap(`${locale} studio`, studioReference, studioLocales[locale]);
  console.log(`${locale}: marketing ${Object.keys(marketing).length}, studio ${Object.keys(studioLocales[locale]).length}`);
}

console.log("All new locale dictionaries passed structural validation.");
