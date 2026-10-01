// L'export vers le site tentacletv.app (dépôt « Tentacle Web ») : les
// captures brutes de la vitrine, copiées sous le nom qu'elles portent dans la
// recette du site (tools/capture/shots.json) — dans out/raw/vitrine/, que git
// ignore. Le site en tire ensuite ses AVIF et WebP : node tools/capture/optimize.mjs.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CAPTURES } from "../lib/paths.mjs";
import { webCaptureFile } from "../web/series.mjs";

const SITE_REPO = process.env.VITRINE_SITE_REPO ?? path.join(os.homedir(), "Desktop/Projet - local/Tentacle Web");
export const SITE_RAW = path.join(SITE_REPO, "tools/capture/out/raw/vitrine");

/** Chaque visuel du site : sa source dans la vitrine et ses largeurs servies. */
export const SITE_SHOTS = [
  { name: "web-home-v2", source: (lang) => webCaptureFile("mac", lang, "01_accueil"), widths: [720, 1440, 2160] },
  { name: "web-detail-v2", source: (lang) => webCaptureFile("mac", lang, "02_fiche"), widths: [720, 1440, 2160] },
  { name: "web-library-v2", source: (lang) => webCaptureFile("mac", lang, "06_bibliotheque"), widths: [720, 1440, 2160] },
  { name: "mobile-home-v2", source: (lang) => webCaptureFile("iphone", lang, "01_accueil"), widths: [440, 880, 1320] },
  { name: "mobile-pair-v2", source: (lang) => webCaptureFile("iphone", lang, "10_jumeler"), widths: [440, 880, 1320] },
  { name: "appletv-home", source: (lang) => path.join(CAPTURES, lang, "01_accueil.png"), widths: [960, 1440, 1920] },
  { name: "appletv-detail", source: (lang) => path.join(CAPTURES, lang, "02_fiche.png"), widths: [960, 1440, 1920] },
];

/** Copie les sources brutes dans le dépôt du site ; rend les entrées de sa recette. */
export function exportSite(langs) {
  if (!fs.existsSync(SITE_REPO)) throw new Error(`dépôt du site introuvable : ${SITE_REPO} (VITRINE_SITE_REPO)`);
  fs.mkdirSync(SITE_RAW, { recursive: true });
  const recipe = [];
  for (const shot of SITE_SHOTS) {
    for (const lang of langs) {
      const source = shot.source(lang);
      if (!fs.existsSync(source)) throw new Error(`capture absente : ${source}`);
      const name = `${shot.name}-${lang}`;
      fs.copyFileSync(source, path.join(SITE_RAW, `${name}.png`));
      recipe.push({ name, src: `out/raw/vitrine/${name}.png`, widths: shot.widths });
      console.log(`site ${name} ← ${path.relative(path.dirname(path.dirname(source)), source)}`);
    }
  }
  return recipe;
}
