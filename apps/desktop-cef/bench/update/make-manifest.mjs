#!/usr/bin/env node
// Fabrique et signe le flux de mise à jour (l'enveloppe lue par src/update/manifest.cpp).
// C'est l'outil de la CI (docs/patches/maj-desktop-cef-ci.patch) ; le banc a le sien (feed.mjs).
//
//   TENTACLE_UPDATE_SIGNING_KEY="$(cat cle.pem)" node bench/update/make-manifest.mjs \
//     --version=1.43.0 --channel=stable --changelog=changelogs/desktop.md \
//     --asset=macos-arm64=https://github.com/…/Tentacle-1.43.0-macos-arm64.tar.xz:dist/Tentacle-1.43.0-macos-arm64.tar.xz \
//     [--severity=major] [--min-version=1.40.0] [--key-id=tentacle-2026] [--notes-url=https://…] --out=stable.json
//
// La gravité vient du changelog (`<!-- severity: minor|major|critical -->` dans le bloc
// `## [X.Y.Z]`, mineure par défaut) sauf --severity ; `majorSince` = la dernière version
// majeure du changelog jusqu'à --version (une critique n'est pas une « grosse » mise à jour).
// La raison d'une critique : le bloc `### Sécurité` / `### Security` du même bloc.
// Clé de signature : PEM PKCS#8 ed25519 dans TENTACLE_UPDATE_SIGNING_KEY (secret de la CI) ;
// `--print-public-key` donne la clé publique à compiler (-DTENTACLE_UPDATE_PUBLIC_KEYS=id:…).
import { createHash, createPrivateKey, createPublicKey, sign } from "node:crypto";
import { readFileSync, statSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const opt = {};
const assets = [];
for (const a of args) {
  const [k, ...rest] = a.replace(/^--/, "").split("=");
  if (k === "asset") assets.push(rest.join("="));
  else opt[k] = rest.length ? rest.join("=") : true;
}
const pem = process.env.TENTACLE_UPDATE_SIGNING_KEY;
if (!pem) throw new Error("TENTACLE_UPDATE_SIGNING_KEY absente");
const key = createPrivateKey(pem);
if (opt["print-public-key"]) {
  console.log(Buffer.from(createPublicKey(key).export({ format: "jwk" }).x, "base64url").toString("base64"));
  process.exit(0);
}

const cmp = (a, b) => {
  const pa = a.split(/[.-]/).map(Number), pb = b.split(/[.-]/).map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
};

// Les blocs « ## [X.Y.Z] » du changelog : gravité, notes FR/EN (puces), section sécurité.
function changelog(file) {
  const blocks = {};
  for (const part of readFileSync(file, "utf8").split(/^## \[/m).slice(1)) {
    const version = part.slice(0, part.indexOf("]"));
    if (!/^\d+\.\d+\.\d+$/.test(version)) continue;  // [mac-…], [win-…] : variantes de boutique
    const severity = (part.match(/<!--\s*severity:\s*(minor|major|critical)\s*-->/) || [])[1] || "minor";
    const section = (title) => {
      const m = part.match(new RegExp(`^### ${title}\\s*$([\\s\\S]*?)(?=^### |(?![\\s\\S]))`, "m"));
      return m ? m[1].split("\n").filter((l) => l.startsWith("- ")).map((l) => "• " + l.slice(2).replace(/\*\*/g, "")).join("\n") : "";
    };
    blocks[version] = { severity, notes: { fr: section("FR"), en: section("EN") },
      reason: { fr: section("Sécurité"), en: section("Security") } };
  }
  return blocks;
}

const version = opt.version;
const blocks = opt.changelog ? changelog(opt.changelog) : {};
const block = blocks[version] || { severity: "minor", notes: { fr: "", en: "" }, reason: { fr: "", en: "" } };
const severity = opt.severity || block.severity;
const majors = Object.entries(blocks).filter(([v, b]) => b.severity === "major" && cmp(v, version) <= 0).map(([v]) => v).sort(cmp);

const manifest = {
  version, channel: opt.channel || "stable", severity, issuedAt: Math.floor(Date.now() / 1000),
  ...(opt["min-version"] ? { minVersion: opt["min-version"] } : {}),
  ...(majors.length ? { majorSince: majors[majors.length - 1] } : {}),
  notes: block.notes,
  ...(severity === "critical" && block.reason.fr ? { reason: block.reason } : {}),
  ...(opt["notes-url"] ? { notesUrl: opt["notes-url"] } : {}),
  assets: Object.fromEntries(assets.map((spec) => {
    const [name, rest] = [spec.slice(0, spec.indexOf("=")), spec.slice(spec.indexOf("=") + 1)];
    const cut = rest.lastIndexOf(":");  // url:fichier (l'URL contient « https: »)
    const url = rest.slice(0, cut), file = rest.slice(cut + 1);
    const sha256 = createHash("sha256").update(readFileSync(file)).digest("hex");
    return [name, { url, sha256, size: statSync(file).size }];
  })),
};
const text = JSON.stringify(manifest, null, 2);
const envelope = { format: 1, keyId: opt["key-id"] || "tentacle-2026", manifest: text,
  signature: sign(null, Buffer.from(text, "utf8"), key).toString("base64") };
writeFileSync(opt.out || "stable.json", JSON.stringify(envelope, null, 2) + "\n");
console.log(`flux ${manifest.channel} ${version} (${severity}${manifest.majorSince ? `, majeure depuis ${manifest.majorSince}` : ""}) → ${opt.out || "stable.json"}`);
