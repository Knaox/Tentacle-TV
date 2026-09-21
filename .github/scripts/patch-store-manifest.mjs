#!/usr/bin/env node
// Patche les blocs stores de updates/store-versions.json : macAppStore +
// microsoftStore (version + notes FR/EN) et les notes du bloc linux (sa
// version/tag/assets restent posés par patch-linux-manifest.mjs). Les notes
// sont extraites de changelogs/desktop.md (bloc « ## [X.Y.Z] », ### FR/### EN)
// et converties en texte brut avec les limites par store (lib/changelog.mjs).
// Lancé par le job « manifest » de desktop.yml à chaque tag desktop-v* — fini
// la recopie manuelle (macAppStore était fossilisé à 1.2.1, détection morte).
//
// Usage : node patch-store-manifest.mjs <version> [--changelog=...] [--only=<bloc>]
//         blocs : mac | ms | linux | play-mobile | play-tv
//
// --only=ms  : au TAG — le bloc macAppStore n'est PLUS patche a la livraison.
//              La pop-up de mise a jour macOS ne doit annoncer que ce qui est
//              REELLEMENT en ligne, or le tag precede la review Apple de
//              plusieurs heures ; c'est le veilleur store-watch.yml qui patche
//              le bloc mac quand ASC passe la version en READY_FOR_SALE.
// --only=mac : par le veilleur, precisement pour ce bloc-la.
//
// --only=play-mobile / play-tv : les deux blocs Play etaient tenus A LA MAIN,
//              parce que tv.yml et mobile.yml publiaient en « status: draft »
//              sur une piste fermee — « publie » n'etait donc pas deductible
//              d'un run. Depuis que play-publish.mjs pose « completed », il
//              l'est, et ces blocs suivent leur workflow. Leur changelog n'est
//              pas celui du bureau : passer --changelog=changelogs/mobile.md
//              (ou tv.md), avec les limites Play.
import { readFileSync, writeFileSync } from "node:fs";
import { loadNotes } from "./lib/changelog.mjs";

const [, , version, ...rest] = process.argv;
if (!version) {
  console.error("usage: patch-store-manifest.mjs <version> [--changelog=...] [--only=mac|ms|linux]");
  process.exit(1);
}
const changelog = rest.find((a) => a.startsWith("--changelog="))?.slice("--changelog=".length)
  ?? "changelogs/desktop.md";
const only = rest.find((a) => a.startsWith("--only="))?.slice("--only=".length) ?? null;
const BLOCKS = ["mac", "ms", "linux", "play-mobile", "play-tv"];
if (only && !BLOCKS.includes(only)) {
  console.error(`--only invalide: ${only} (attendu ${BLOCKS.join("|")})`);
  process.exit(1);
}

const notesFor = (format, channel) => {
  const n = loadNotes({ changelog, channel, version, format });
  if (!n || (!n.fr && !n.en)) return null;
  return { fr: n.fr ?? n.en ?? "", en: n.en ?? n.fr ?? "" };
};

/** Les notes d'un bloc, ou un echec NOMME. */
const required = (label, format, channel) => {
  const n = notesFor(format, channel);
  if (!n) {
    console.error(`Bloc « ## [${version}] » introuvable (ou vide) dans ${changelog} — necessaire pour ${label}.`);
    process.exit(1);
  }
  return n;
};

// Mac App Store (limite 4000). CANAL « mac » : un bloc « ## [mac-X.Y.Z] »
// remplace le bloc nu pour Apple seul, et `extractSection` replie dessus s'il
// n'existe pas. Sans ce canal, la pop-up de mise à jour macOS annonçait les
// notes NEUTRES — celles de Windows et Linux — alors que le fichier en portait
// une version faite pour Apple. C'est déjà ce que fait `asc-release-notes.mjs`
// (CHANNEL=mac) pour les notes envoyées à App Store Connect : les deux chemins
// doivent dire la même chose.
// Les notes ne sont chargees QUE pour les blocs reellement ecrits. Avant, les
// trois etaient exigees meme avec --only sur un seul : le veilleur macOS
// devenait rouge toutes les trente minutes des qu'un bloc nu manquait, alors
// qu'il n'avait besoin que du canal « mac ».
const wants = (block) => only === null || only === block;
const ascMac = wants("mac") ? required("macAppStore", "asc", "mac") : null;
// Le bloc linux, lui, prend les notes NEUTRES (même limite de 4000).
const asc = wants("linux") ? required("linux.notes", "asc") : null;
const msstore = wants("ms") ? required("microsoftStore", "msstore") : null;
const playMobile = wants("play-mobile") ? required("playMobile", "play") : null;
const playTv = wants("play-tv") ? required("playTv", "play") : null;

const path = "updates/store-versions.json";
const json = JSON.parse(readFileSync(path, "utf8"));
const touched = [];
// Trois blocs INDÉPENDANTS. `linux.notes` voyageait avec `microsoftStore`,
// dans la même branche : livrer Linux seul laissait donc ses notes sur la
// version précédente — la bannière de mise à jour annonçait la nouvelle
// version avec les nouveautés de l'ancienne. Chaque bloc appartient désormais
// au job de son système, et `--only` sait nommer les trois.
if (ascMac) {
  json.macAppStore = { ...(json.macAppStore ?? {}), version, notes: ascMac };
  touched.push(`macAppStore (FR ${ascMac.fr.length}c / EN ${ascMac.en.length}c)`);
}
if (msstore) {
  json.microsoftStore = { ...(json.microsoftStore ?? {}), version, notes: msstore };
  touched.push(`microsoftStore (FR ${msstore.fr.length}c / EN ${msstore.en.length}c)`);
}
if (asc) {
  json.linux = { ...(json.linux ?? {}), notes: asc };
  touched.push(`linux.notes (FR ${asc.fr.length}c / EN ${asc.en.length}c)`);
}
if (playMobile) {
  json.playMobile = { ...(json.playMobile ?? {}), version, notes: playMobile };
  touched.push(`playMobile (FR ${playMobile.fr.length}c / EN ${playMobile.en.length}c)`);
}
if (playTv) {
  json.playTv = { ...(json.playTv ?? {}), version, notes: playTv };
  touched.push(`playTv (FR ${playTv.fr.length}c / EN ${playTv.en.length}c)`);
}
writeFileSync(path, JSON.stringify(json, null, 2) + "\n");
console.log(`blocs ${touched.join(" + ")} → v${version}`);
