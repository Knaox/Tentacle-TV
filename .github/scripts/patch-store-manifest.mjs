#!/usr/bin/env node
// Patche les blocs stores de updates/store-versions.json : macAppStore +
// microsoftStore (version + notes FR/EN) et les notes du bloc linux (sa
// version/tag/assets restent posés par patch-linux-manifest.mjs). Les notes
// sont extraites de changelogs/desktop.md (bloc « ## [X.Y.Z] », ### FR/### EN)
// et converties en texte brut avec les limites par store (lib/changelog.mjs).
// Lancé par le job « manifest » de desktop.yml à chaque tag desktop-v* — fini
// la recopie manuelle (macAppStore était fossilisé à 1.2.1, détection morte).
//
// Usage : node patch-store-manifest.mjs <version> [--changelog=changelogs/desktop.md]
import { readFileSync, writeFileSync } from "node:fs";
import { loadNotes } from "./lib/changelog.mjs";

const [, , version, ...rest] = process.argv;
if (!version) {
  console.error("usage: patch-store-manifest.mjs <version> [--changelog=changelogs/desktop.md]");
  process.exit(1);
}
const changelog = rest.find((a) => a.startsWith("--changelog="))?.slice("--changelog=".length)
  ?? "changelogs/desktop.md";

const notesFor = (format) => {
  const n = loadNotes({ changelog, version, format });
  if (!n || (!n.fr && !n.en)) return null;
  return { fr: n.fr ?? n.en ?? "", en: n.en ?? n.fr ?? "" };
};

const asc = notesFor("asc"); // Mac App Store (limite 4000) — sert aussi au bloc linux
const msstore = notesFor("msstore"); // Microsoft Store (limite 1500)
if (!asc || !msstore) {
  console.error(`Bloc « ## [${version}] » introuvable (ou vide) dans ${changelog}`);
  process.exit(1);
}

const path = "updates/store-versions.json";
const json = JSON.parse(readFileSync(path, "utf8"));
json.macAppStore = { ...(json.macAppStore ?? {}), version, notes: asc };
json.microsoftStore = { ...(json.microsoftStore ?? {}), version, notes: msstore };
json.linux = { ...(json.linux ?? {}), notes: asc };
writeFileSync(path, JSON.stringify(json, null, 2) + "\n");
console.log(`blocs stores → v${version} (notes FR ${asc.fr.length}c / EN ${asc.en.length}c)`);
