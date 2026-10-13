#!/usr/bin/env node
// Patche les blocs stores de updates/store-versions.json : macAppStore +
// microsoftStore (version + notes FR/EN) et les notes du bloc linux (sa
// version/tag/assets restent posés par patch-linux-manifest.mjs). Les notes
// sont extraites de changelogs/desktop.md (bloc « ## [X.Y.Z] », ### FR/### EN)
// et converties en texte brut avec les limites par store (lib/changelog.mjs).
// Lancé par le job « manifest » de desktop.yml à chaque tag desktop-v* — fini
// la recopie manuelle (macAppStore était fossilisé à 1.2.1, détection morte).
//
// Usage : node patch-store-manifest.mjs <version> [--changelog=...] [--only=<bloc>] [--track=<piste>]
//         blocs : mac | ms | linux | play-mobile | play-tv
//
// --only=mac : par le veilleur store-watch.yml, quand ASC passe la version en
//              vente. La pop-up de mise a jour macOS ne doit annoncer que ce
//              qui est REELLEMENT en ligne, or la livraison precede la review
//              Apple de plusieurs heures.
// --only=ms  : par le veilleur aussi, depuis le 2026-09-29, quand la vitrine
//              publique du Microsoft Store affiche les notes de la version.
//              desktop.yml le patchait des la soumission acceptee, avant une
//              certification de plusieurs heures. Notes du canal « win » —
//              celles que msstore-submit.mjs envoie au Store.
//
// --only=play-mobile / play-tv : par le veilleur SEULEMENT, comme le bloc mac.
//              mobile.yml et tv.yml patchaient ces blocs des l'envoi a Google,
//              y compris au cran test : le site annonçait une version de piste
//              fermee, ou une version encore a l'examen. Le veilleur ne les
//              patche que quand la PRODUCTION la sert (store-live.mjs), et
//              --track=<piste> y inscrit la piste. Leur changelog n'est pas
//              celui du bureau : passer --changelog=changelogs/mobile.md (ou
//              tv.md), avec les limites Play.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { loadNotes } from "./lib/changelog.mjs";
import { MANIFEST_BLOCKS } from "./lib/published.mjs";
import { isVersion } from "./lib/versions.mjs";

const [, , version, ...rest] = process.argv;
if (!version) {
  console.error("usage: patch-store-manifest.mjs <version> [--changelog=...] [--only=mac|ms|linux]");
  process.exit(1);
}
const changelog = rest.find((a) => a.startsWith("--changelog="))?.slice("--changelog=".length)
  ?? "changelogs/desktop.md";
const only = rest.find((a) => a.startsWith("--only="))?.slice("--only=".length) ?? null;
// La piste ne s'inscrit que dans un bloc Play ; ailleurs elle n'a pas de sens.
const track = rest.find((a) => a.startsWith("--track="))?.slice("--track=".length) ?? null;
if (track !== null && !/^(tv:)?[a-z][\w-]*$/i.test(track)) {
  console.error(`--track invalide: ${track}`);
  process.exit(1);
}
const BLOCKS = ["mac", "ms", "linux", "play-mobile", "play-tv"];
if (only && !BLOCKS.includes(only)) {
  console.error(`--only invalide: ${only} (attendu ${BLOCKS.join("|")})`);
  process.exit(1);
}

// Ce que chaque bloc annonçait AVANT ce patch — lu dans le commit (le job
// « manifest » de desktop.yml a déjà pu écrire linux.version sur le disque),
// sinon dans le fichier. Les notes reprennent les versions sautées depuis :
// la fenêtre de mise à jour dit tout ce qui change pour qui était resté là.
const previousManifest = (() => {
  try { return JSON.parse(execFileSync("git", ["show", "HEAD:updates/store-versions.json"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })); }
  catch { try { return JSON.parse(readFileSync("updates/store-versions.json", "utf8")); } catch { return {}; } }
})();
const previousVersion = (block) => {
  const v = previousManifest[MANIFEST_BLOCKS[block]]?.version;
  return isVersion(v) ? v : null;
};

const notesFor = (format, channel, block) => {
  const since = block ? previousVersion(block) : null;
  const n = loadNotes({ changelog, channel, version, since, format });
  if (!n || (!n.fr && !n.en)) return null;
  return { fr: n.fr ?? n.en ?? "", en: n.en ?? n.fr ?? "" };
};

/** Les notes d'un bloc, ou un echec NOMME. */
const required = (label, format, channel, block) => {
  const n = notesFor(format, channel, block);
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
const ascMac = wants("mac") ? required("macAppStore", "asc", "mac", "mac") : null;
// Le bloc linux, lui, prend les notes NEUTRES (même limite de 4000).
const asc = wants("linux") ? required("linux.notes", "asc", undefined, "linux") : null;
// Canal « win », comme msstore-submit.mjs : un bloc « ## [win-X.Y.Z] » est la
// version faite pour le Store (1500 caractères) ; le bloc nu, celle de macOS
// et Linux, y était coupé à la puce.
const msstore = wants("ms") ? required("microsoftStore", "msstore", "win", "win") : null;
// Les blocs Play n'alimentent que le site, qui n'en affiche que la version :
// une version servie sans bloc de changelog (Android TV 1.2.1, antérieure à la
// convention) s'inscrit quand même, SANS notes — mieux qu'un bloc qui ment.
const playNotes = (label, block) => {
  const notes = notesFor("play", undefined, block);
  if (!notes) console.error(`Bloc « ## [${version}] » absent de ${changelog} — ${label} inscrit sans notes.`);
  return { notes };
};
const playMobile = wants("play-mobile") ? playNotes("playMobile", "play-mobile") : null;
const playTv = wants("play-tv") ? playNotes("playTv", "play-tv") : null;

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
/** Un bloc Play : version, piste, et les notes de cette version (et des sautées) — ou aucune. */
const playBlock = (key, { notes }) => {
  const block = { ...(json[key] ?? {}), version, ...(track ? { track } : {}) };
  delete block.notes;
  json[key] = notes ? { ...block, notes } : block;
  touched.push(`${key} (${notes ? `FR ${notes.fr.length}c / EN ${notes.en.length}c` : "sans notes"})`);
};
if (playMobile) playBlock("playMobile", playMobile);
if (playTv) playBlock("playTv", playTv);
writeFileSync(path, JSON.stringify(json, null, 2) + "\n");
console.log(`blocs ${touched.join(" + ")} → v${version}`);
