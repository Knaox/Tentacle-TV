#!/usr/bin/env node
// Patche le bloc `linux` de updates/store-versions.json à partir du SHA256SUMS
// d'une release `desktop-v*`. Le manifeste est lu par l'app via
// raw.githubusercontent (apps/web/src/lib/linuxUpdate.ts) pour proposer la mise
// à jour du bon format.
//
// Usage : node patch-linux-manifest.mjs <version> <tag> <SHA256SUMS>
import { readFileSync, writeFileSync } from "node:fs";

const [, , version, tag, sumsPath] = process.argv;
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
json.linux = {
  ...(json.linux ?? {}),
  version,
  tag,
  assets: { ...(json.linux?.assets ?? {}), ...assets },
};
writeFileSync(path, JSON.stringify(json, null, 2) + "\n");
console.log(`bloc linux → v${version} (${tag}) — formats: ${Object.keys(assets).join(", ")}`);
