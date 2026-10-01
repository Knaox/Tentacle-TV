// Les illustrations du dépôt GitHub (README) : l'image d'en-tête — le bureau,
// l'Apple TV refondue et le téléphone, ensemble, sans texte — et les quatre
// captures du bureau de docs/screenshots/. En anglais, comme le README.
// Rangées dans Tentacle-Vitrine/github/, à recopier dans docs/ du dépôt, avec
// leurs crédits (docs/screenshots/CREDITS.md).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { writeCredits } from "../lib/credits.mjs";
import { CAPTURES, HOME } from "../lib/paths.mjs";
import { describe, fileUrl, renderPng } from "../lib/render.mjs";
import { webCaptureFile } from "../web/series.mjs";

export const GITHUB_OUT = path.join(HOME, "github/docs");

/** Les captures du bureau, au nom qu'elles ont dans docs/screenshots/. */
const SCREENSHOTS = {
  "hero-home": "01_accueil",
  "movie-detail": "02_fiche",
  "library-browse": "06_bibliotheque",
  "player-fullscreen": "09_lecteur",
};

const panel = (cls, file) => `<div class="panel ${cls}"><img src="${fileUrl(file)}" alt=""></div>`;

/** Trois écrans de la même bibliothèque, trois titres : la TV derrière à gauche (son
 *  interface, à gauche de l'écran, reste à vue), le bureau devant à droite, le
 *  téléphone au premier plan sur l'illustration du bureau — jamais sur un texte. */
function stageHtml({ desktop, tv, phone }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;width:1600px;height:900px;overflow:hidden;background:#05050a;}
.canvas{position:relative;width:1600px;height:900px;overflow:hidden;background:#05050a;}
.halo{position:absolute;inset:0;background:
  radial-gradient(760px 420px at 46% 44%, rgba(139,92,246,.42), transparent 70%),
  radial-gradient(560px 340px at 82% 70%, rgba(236,72,153,.26), transparent 72%),
  radial-gradient(520px 320px at 14% 70%, rgba(167,139,250,.18), transparent 72%);filter:blur(30px);}
.panel{position:absolute;overflow:hidden;background:#000;border:1px solid rgba(255,255,255,.14);line-height:0;
  box-shadow:0 40px 90px rgba(0,0,0,.75), 0 0 80px rgba(139,92,246,.18);}
.panel img{display:block;width:100%;}
.tv{left:70px;top:80px;width:900px;border-radius:12px;filter:brightness(.86);}
.desktop{left:600px;top:210px;width:940px;border-radius:14px;}
.phone{left:1330px;top:420px;width:220px;border-radius:28px;border-color:rgba(255,255,255,.2);}
.floor{position:absolute;left:0;right:0;top:760px;bottom:0;background:linear-gradient(180deg, rgba(5,5,10,0), #05050a 85%);}
</style></head><body><div class="canvas">
<div class="halo"></div>${panel("tv", tv)}${panel("desktop", desktop)}${panel("phone", phone)}<div class="floor"></div>
</div></body></html>`;
}

/** Rend l'image d'en-tête et redimensionne les quatre captures du bureau. */
export async function composeGithub() {
  const header = path.join(GITHUB_OUT, "screenshot-home.png");
  const shots = {
    desktop: webCaptureFile("mac", "en", "01_accueil"),
    tv: path.join(CAPTURES, "en", "02_fiche.png"),
    phone: webCaptureFile("iphone", "en", "01_accueil"),
  };
  for (const file of Object.values(shots)) if (!fs.existsSync(file)) throw new Error(`capture absente : ${file}`);
  await renderPng(stageHtml(shots), header, { width: 1600, height: 900, scale: 1.5, background: "#05050a" });
  console.log(`GitHub screenshot-home.png — ${describe(header)}`);
  for (const [name, id] of Object.entries(SCREENSHOTS)) {
    const out = path.join(GITHUB_OUT, "screenshots", `${name}.png`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    execFileSync("magick", [webCaptureFile("windows", "en", id), "-resize", "1920x1080", "-background", "#000", "-alpha", "remove", "-alpha", "off", "-strip", `PNG24:${out}`]);
    console.log(`GitHub screenshots/${name}.png — ${describe(out)}`);
  }
  // Licence CC BY : les crédits voyagent avec les captures, dans le dépôt.
  console.log(`GitHub ${path.relative(GITHUB_OUT, writeCredits(path.join(GITHUB_OUT, "screenshots")))}`);
}
