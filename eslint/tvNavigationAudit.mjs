#!/usr/bin/env node
/**
 * Audit de la garde de la navigation TV (`tvNavigation.mjs`).
 *
 * Fait tourner les six règles SANS aucune exception sur le chemin refondu, et
 * confronte le relevé à la liste des exceptions :
 *  - une exception qui ne couvre plus rien est PÉRIMÉE : sa tâche a extrait le
 *    fichier, la ligne doit partir (la liste fond à chaque fusion) ;
 *  - un usage hors de toute exception est NOUVEAU : à extraire, ou à inscrire
 *    avec sa justification.
 * Sort en erreur s'il y a l'un ou l'autre.
 *
 *   node eslint/tvNavigationAudit.mjs            # le bilan
 *   node eslint/tvNavigationAudit.mjs --json     # le relevé complet, ligne à ligne
 */
import { globSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import tseslint from "typescript-eslint";
import { TV_NAV_EXCEPTIONS } from "./tvNavigationExceptions.mjs";
import { TV_NAV_ALLOWED, TV_NAV_RULES, TV_NAV_SCOPE, tvNavigationPlugin } from "./tvNavigation.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = "apps/tv/src/";
/** Une constante numérique EN CAPITALES, ou une minuterie à délai littéral. */
const ADAPTER_TIMING = /\bconst\s+[A-Z][A-Z0-9_]*\s*=\s*-?\d|\b(setTimeout|setInterval)\([^;]*,\s*\d+\s*\)/;

const eslint = new ESLint({
  cwd: ROOT,
  overrideConfigFile: true,
  overrideConfig: [
    {
      files: TV_NAV_SCOPE,
      ignores: TV_NAV_ALLOWED,
      languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } },
      plugins: { "tv-nav": tvNavigationPlugin },
      rules: Object.fromEntries(TV_NAV_RULES.map((rule) => [`tv-nav/${rule}`, "error"])),
      // Les directives des autres règles (react-hooks…) ne regardent pas cet audit.
      linterOptions: { reportUnusedDisableDirectives: "off" },
    },
  ],
});

const results = await eslint.lintFiles(TV_NAV_SCOPE);
const hits = [];
for (const result of results) {
  const file = path.relative(path.join(ROOT, SRC), result.filePath);
  for (const m of result.messages) {
    if (m.fatal) throw new Error(`${file}:${m.line} — ${m.message}`);
    if (!m.ruleId?.startsWith("tv-nav/")) continue; // directive d'une règle absente de l'audit
    hits.push({ file, line: m.line, rule: m.ruleId.replace("tv-nav/", "") });
  }
}

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(hits, null, 1));
  process.exit(0);
}

const covered = (hit) => TV_NAV_EXCEPTIONS.some((e) => e.file === hit.file && e.rules.includes(hit.rule));
const fresh = hits.filter((hit) => !covered(hit));
const stale = TV_NAV_EXCEPTIONS.flatMap((e) =>
  e.rules.filter((rule) => !hits.some((h) => h.file === e.file && h.rule === rule)).map((rule) => `${e.file} · ${rule}`),
);
const unknown = TV_NAV_EXCEPTIONS.flatMap((e) => e.rules.filter((rule) => !TV_NAV_RULES.includes(rule)).map((rule) => `${e.file} · ${rule}`));

const byRule = Object.fromEntries(TV_NAV_RULES.map((rule) => [rule, hits.filter((h) => h.rule === rule).length]));
console.log(`Garde de la navigation TV — ${hits.length} usages dans ${new Set(hits.map((h) => h.file)).size} fichiers`);
for (const [rule, n] of Object.entries(byRule)) console.log(`  ${rule.padEnd(22)} ${n}`);
console.log(`Exceptions : ${TV_NAV_EXCEPTIONS.length} fichiers, ${TV_NAV_EXCEPTIONS.reduce((n, e) => n + e.rules.length, 0)} couples fichier · famille`);
if (unknown.length) console.log(`\nFamilles inconnues :\n  ${unknown.join("\n  ")}`);
if (stale.length) console.log(`\nExceptions PÉRIMÉES (plus rien à couvrir — retirer la ligne) :\n  ${stale.join("\n  ")}`);
if (fresh.length) console.log(`\nUsages NOUVEAUX (hors exceptions) :\n  ${fresh.map((h) => `${h.file}:${h.line} · ${h.rule}`).join("\n  ")}`);
if (!stale.length && !fresh.length && !unknown.length) console.log("\nListe à jour : chaque exception couvre encore un usage, aucun usage n'en sort.");

// L'adaptateur APPLIQUE : il n'a pas le droit de contenir un seuil ni une
// durée (docs/TV-NAVIGATION.md). Signalé à part, sans faire échouer l'audit :
// un délai imposé par UIKit (un contournement natif) peut s'y justifier.
const adapterFiles = globSync(`${SRC}platform/**/*.{ts,tsx}`, { cwd: ROOT }).filter((f) => !/\.test\.tsx?$/.test(f)).sort();
const timings = adapterFiles.flatMap((file) =>
  readFileSync(path.join(ROOT, file), "utf8").split("\n").flatMap((line, i) =>
    /^\s*(\/\/|\*)/.test(line) || !ADAPTER_TIMING.test(line) ? [] : [`${file.replace(SRC, "")}:${i + 1} — ${line.trim().slice(0, 90)}`],
  ),
);
if (timings.length) console.log(`\nSeuils et durées DANS l'adaptateur (à justifier, ou à prendre dans tv-core) :\n  ${timings.join("\n  ")}`);
process.exit(stale.length || fresh.length || unknown.length ? 1 : 0);
