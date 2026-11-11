#!/usr/bin/env node
// Patche le bloc `linux` de updates/store-versions.json à partir du SHA256SUMS
// d'une release `desktop-v*`. Le manifeste est lu par l'app via
// raw.githubusercontent (apps/web/src/lib/linuxUpdate.ts) pour proposer la mise
// à jour du bon format.
//
// Usage : node patch-linux-manifest.mjs <version> <tag> <SHA256SUMS> [--drop-missing]
//
// UN FORMAT QUI MANQUE EST UN REFUS. L'app d'une installation construit l'adresse du paquet avec
// le tag NOUVEAU et le nom d'asset du manifeste : garder l'asset d'une Release précédente pour un
// format absent de celle-ci, c'était lui promettre un 404 (« 1.50.0 disponible », puis l'échec).
// Le retirer en silence, c'était pire : l'updater d'Electron (`checkLinuxUpdate`) se TAIT quand
// son format n'a pas d'asset — ces installations ne verraient plus jamais de mise à jour.
// `--drop-missing` le fait quand même, en connaissance de cause (abandon décidé d'un format).
import { readFileSync, writeFileSync } from "node:fs";

const dropMissing = process.argv.includes("--drop-missing");
const [version, tag, sumsPath] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (!version || !tag || !sumsPath) {
  console.error("usage: patch-linux-manifest.mjs <version> <tag> <SHA256SUMS>");
  process.exit(1);
}

/** Mappe un nom de fichier vers son format d'asset (extension). */
function fmt(name) {
  if (/\.AppImage$/i.test(name)) return "appimage";
  if (/\.pkg\.tar\.zst$/i.test(name)) return "pacman"; // avant .deb/.rpm : plus spécifique
  if (/\.deb$/i.test(name)) return "deb";
  if (/\.rpm$/i.test(name)) return "rpm";
  return null;
}

// SHA256SUMS : lignes « <hash>  <fichier> » (le « * » = mode binaire de coreutils).
const assets = {};
for (const line of readFileSync(sumsPath, "utf8").split("\n")) {
  const m = line.trim().match(/^([0-9a-f]{64})\s+\*?(.+)$/i);
  if (!m) continue;
  const [, sha256, name] = m;
  const f = fmt(name.trim());
  if (f) assets[f] = { name: name.trim(), sha256: sha256.toLowerCase() };
}
if (Object.keys(assets).length === 0) {
  console.error(`Aucun asset reconnu dans ${sumsPath}`);
  process.exit(1);
}

const path = "updates/store-versions.json";
const json = JSON.parse(readFileSync(path, "utf8"));
const missing = Object.keys(json.linux?.assets ?? {}).filter((f) => !assets[f]);
if (missing.length && !dropMissing) {
  console.error(
    `La Release ${tag} n'a pas de paquet ${missing.join(", ")} : les installations de ce format ` +
      `recevraient l'adresse ${tag}/<nom d'une autre version> (404). Publie ces formats, ou relance avec ` +
      `--drop-missing pour les retirer — ces installations n'annonceraient alors PLUS AUCUNE mise à jour.`,
  );
  process.exit(1);
}
if (missing.length) console.warn(`::warning::formats retirés du bloc linux : ${missing.join(", ")} — leurs installations ne verront plus de mise à jour.`);
json.linux = { ...(json.linux ?? {}), version, tag, assets };
writeFileSync(path, JSON.stringify(json, null, 2) + "\n");
console.log(`bloc linux → v${version} (${tag}) — formats: ${Object.keys(assets).join(", ")}`);
