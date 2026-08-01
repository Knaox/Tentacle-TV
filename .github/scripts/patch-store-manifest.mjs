#!/usr/bin/env node
// Patche les blocs stores de updates/store-versions.json : macAppStore +
// microsoftStore (version + notes FR/EN) et les notes du bloc linux (sa
// version/tag/assets restent posés par patch-linux-manifest.mjs). Les notes
// sont extraites de changelogs/desktop.md (bloc « ## [X.Y.Z] », ### FR/### EN)
// et converties en texte brut avec les limites par store (lib/changelog.mjs).
// Lancé par le job « manifest » de desktop.yml à chaque tag desktop-v* — fini
// la recopie manuelle (macAppStore était fossilisé à 1.2.1, détection morte).
//
// Usage : node patch-store-manifest.mjs <version> [--changelog=...] [--only=mac|ms]
//
// --only=ms  : au TAG — le bloc macAppStore n'est PLUS patche a la livraison.
//              La pop-up de mise a jour macOS ne doit annoncer que ce qui est
//              REELLEMENT en ligne, or le tag precede la review Apple de
//              plusieurs heures ; c'est le veilleur store-watch.yml qui patche
//              le bloc mac quand ASC passe la version en READY_FOR_SALE.
// --only=mac : par le veilleur, precisement pour ce bloc-la.
import { readFileSync, writeFileSync } from "node:fs";
import { loadNotes } from "./lib/changelog.mjs";

const [, , version, ...rest] = process.argv;
if (!version) {
  console.error("usage: patch-store-manifest.mjs <version> [--changelog=...] [--only=mac|ms]");
  process.exit(1);
}
const changelog = rest.find((a) => a.startsWith("--changelog="))?.slice("--changelog=".length)
  ?? "changelogs/desktop.md";
const only = rest.find((a) => a.startsWith("--only="))?.slice("--only=".length) ?? null;
if (only && only !== "mac" && only !== "ms") {
  console.error(`--only invalide: ${only} (attendu mac|ms)`);
  process.exit(1);
}

const notesFor = (format, channel) => {
  const n = loadNotes({ changelog, channel, version, format });
  if (!n || (!n.fr && !n.en)) return null;
  return { fr: n.fr ?? n.en ?? "", en: n.en ?? n.fr ?? "" };
};

// Mac App Store (limite 4000). CANAL « mac » : un bloc « ## [mac-X.Y.Z] »
// remplace le bloc nu pour Apple seul, et `extractSection` replie dessus s'il
// n'existe pas. Sans ce canal, la pop-up de mise à jour macOS annonçait les
// notes NEUTRES — celles de Windows et Linux — alors que le fichier en portait
// une version faite pour Apple. C'est déjà ce que fait `asc-release-notes.mjs`
// (CHANNEL=mac) pour les notes envoyées à App Store Connect : les deux chemins
// doivent dire la même chose.
const ascMac = notesFor("asc", "mac");
// Le bloc linux, lui, prend les notes NEUTRES (même limite de 4000).
const asc = notesFor("asc");
const msstore = notesFor("msstore"); // Microsoft Store (limite 1500)
if (!asc || !msstore || !ascMac) {
  console.error(`Bloc « ## [${version}] » introuvable (ou vide) dans ${changelog}`);
  process.exit(1);
}

const path = "updates/store-versions.json";
const json = JSON.parse(readFileSync(path, "utf8"));
const touched = [];
if (only !== "ms") {
  json.macAppStore = { ...(json.macAppStore ?? {}), version, notes: ascMac };
  touched.push("macAppStore");
}
if (only !== "mac") {
  json.microsoftStore = { ...(json.microsoftStore ?? {}), version, notes: msstore };
  json.linux = { ...(json.linux ?? {}), notes: asc };
  touched.push("microsoftStore", "linux.notes");
}
writeFileSync(path, JSON.stringify(json, null, 2) + "\n");
console.log(
  `blocs ${touched.join(" + ")} → v${version}`
  + ` (mac FR ${ascMac.fr.length}c / EN ${ascMac.en.length}c`
  + ` · neutre FR ${asc.fr.length}c / EN ${asc.en.length}c)`,
);
