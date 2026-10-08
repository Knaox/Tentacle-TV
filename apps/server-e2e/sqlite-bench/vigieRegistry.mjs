// Le registre LOCAL des extensions du banc (le réseau du banc n'a pas Internet) : l'entrée
// de Vigie bâtie par SA PROPRE logique de publication (`applyVersion` de
// scripts/lib/registry-entry.mjs, dépôt de Vigie) à partir d'archives construites ici.
// Les serveurs d'avant 1.25 prennent `latestVersion` (la plus récente sans plancher 1.25) ;
// la 1.25 choisit elle-même la plus récente qu'elle peut prendre.
//
//   node vigieRegistry.mjs <dossier-du-registre> <url-de-base> <registry-entry.mjs> <archive>…
// Chaque archive : plugin-vigie-v<version>.tar.gz, son plugin.json à côté (plugin-vigie-v<version>.json).
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";

const [dir, baseUrl, entryLib, ...archives] = process.argv.slice(2);
if (!dir || !baseUrl || !entryLib || !archives.length) throw new Error("usage : node vigieRegistry.mjs <dossier> <url> <registry-entry.mjs> <archive>…");
const { applyVersion, assertStorageFloor } = await import(pathToFileURL(entryLib).href);

let plugin = null;
for (const archive of archives) {
  const manifest = JSON.parse(readFileSync(archive.replace(/\.tar\.gz$/, ".json"), "utf8"));
  assertStorageFloor(manifest, manifest.minTentacleVersion);
  plugin ??= {
    id: manifest.id,
    name: manifest.name,
    description: manifest.description ?? "",
    author: manifest.author ?? "",
    repo: "",
    icon: manifest.icon ?? "",
    tags: [],
    platforms: manifest.platforms ?? ["web"],
    category: manifest.category ?? "media",
    versions: [],
  };
  const sha = createHash("sha256").update(readFileSync(archive)).digest("hex");
  plugin = applyVersion(plugin, {
    version: manifest.version,
    minTentacleVersion: manifest.minTentacleVersion ?? "0.9.0",
    maxTentacleVersion: null,
    downloadUrl: `${baseUrl}/${basename(archive)}`,
    checksum: `sha256:${sha}`,
    changelog: "",
    releaseDate: new Date().toISOString().slice(0, 10),
  });
}
const registry = { name: "Registre du banc SQLite", description: "Local, réseau interne du banc", author: "sqlite-bench", url: `${baseUrl}/registry.json`, plugins: [plugin] };
writeFileSync(join(dir, "registry.json"), JSON.stringify(registry, null, 2));
console.log(`registre : ${plugin.id}, latestVersion ${plugin.latestVersion}, versions ${plugin.versions.map((v) => `${v.version}${v.minTentacleVersion >= "1.25" ? ` (≥ ${v.minTentacleVersion})` : ""}`).join(", ")}`);
