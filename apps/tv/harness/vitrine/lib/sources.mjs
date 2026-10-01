// Les images LIBRES de la vitrine (Wikimedia Commons, CC BY), telles que
// décrites par `catalog/sources.json` : présence et poids vérifiés, et
// téléchargement de celles qui manquent (accord de l'utilisateur du
// 2026-10-01 pour cette liste ; une liste élargie se redemande).
import fs from "node:fs";
import path from "node:path";
import { CATALOG, SOURCES } from "./paths.mjs";

const USER_AGENT = "TentacleVitrine/1.0 (visuels de la fiche App Store et du site)";

export const readSources = () => JSON.parse(fs.readFileSync(path.join(CATALOG, "sources.json"), "utf8"));

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function download(source, file) {
  for (let attempt = 0; attempt < 5; attempt++) {
    await pause(1200 + attempt * 6000);
    const res = await fetch(source.url, { headers: { "user-agent": USER_AGENT } });
    if (res.status === 429) continue;
    if (!res.ok) throw new Error(`${res.status} pour ${source.title}`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    return;
  }
  throw new Error(`Commons refuse encore (429) : ${source.title}`);
}

/** Vérifie chaque source ; `fetchMissing` télécharge celles qui manquent. */
export async function ensureSources({ fetchMissing = false } = {}) {
  const missing = [];
  for (const source of readSources()) {
    const file = path.join(SOURCES, source.file);
    const ok = fs.existsSync(file) && fs.statSync(file).size === source.bytes;
    if (ok) continue;
    if (!fetchMissing) {
      missing.push(source.file);
      continue;
    }
    await download(source, file);
    console.log(`téléchargé ${source.file} (${(source.bytes / 1e6).toFixed(1)} Mo, ${source.license})`);
  }
  if (missing.length) {
    throw new Error(`${missing.length} image(s) libre(s) absente(s) de ${SOURCES} — « vitrine.mjs sources --fetch » les télécharge depuis Wikimedia Commons`);
  }
  console.log(`sources : ${readSources().length} images libres présentes dans ${SOURCES}`);
}
