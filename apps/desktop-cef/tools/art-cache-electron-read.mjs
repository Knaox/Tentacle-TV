#!/usr/bin/env node
// Le cache disque des pochettes écrit par CEF, relu par le CODE D'ELECTRON
// (`octaveArt/artCache.ts`, chargé tel quel par Node), réseau coupé : chaque pochette doit
// revenir du disque (`fromDisk: true`), sans une requête.
//   node tools/art-cache-electron-read.mjs <dossier octave-art> <fichier JSON [{o, u}, …]>
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// artCache.ts importe « ./artCachePolicy » sans extension (résolution de Vite) : on la donne.
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith(".") && !path.extname(specifier)) {
      try { return next(`${specifier}.ts`, context); } catch { /* repli */ }
    }
    return next(specifier, context);
  },
});
const here = path.dirname(fileURLToPath(import.meta.url));
const { createArtCache } = await import(pathToFileURL(path.resolve(here, "../../desktop-electron/src/main/octaveArt/artCache.ts")).href);
const [root, listFile] = process.argv.slice(2);
const wanted = JSON.parse(readFileSync(listFile, "utf8"));
let fetched = 0;
const cache = createArtCache({ root, fetchUpstream: async () => { fetched++; return null; } });
let fromDisk = 0;
for (const { o, u } of wanted) {
  const art = await cache.serve(o === "" ? null : o, u);
  if (art?.fromDisk) fromDisk++;
}
console.log(`electron relit le cache de CEF : ${fromDisk}/${wanted.length} pochettes depuis le disque, ${fetched} requête(s)`);
process.exit(fromDisk === wanted.length && fetched === 0 ? 0 : 1);
