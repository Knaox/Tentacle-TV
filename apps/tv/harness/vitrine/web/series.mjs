// La série web : chaque appareil, chaque langue, chaque écran de
// compose/web.json, capturé par l'hôte Electron sur le faux serveur, rangé
// dans captures-web/<appareil>/<langue>/<écran>.png.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { idOf } from "../lib/items.mjs";
import { HOME, ROOT, SOURCES, WEB_CAPTURES } from "../lib/paths.mjs";
import { describe } from "../lib/render.mjs";
import { launchEngine } from "./engine.mjs";
import { play } from "./gestures.mjs";
import { DEVICES, open, prepare, screenshot, settle, thaw } from "./shoot.mjs";
import { ORIGIN, setDemo, upWeb } from "./stack.mjs";

export const webPlan = () => JSON.parse(fs.readFileSync(path.join(ROOT, "compose/web.json"), "utf8"));
export const webCaptureFile = (device, lang, id) => path.join(WEB_CAPTURES, device, lang, `${id}.png`);
const routeOf = (route) => route.replace(/\{([^}]+)\}/g, (_, slug) => idOf(slug));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * La vidéo du lecteur : un plan du film libre Tears of Steel (CC BY, crédité),
 * tenu sur toute la durée du film (12 min 14 s) pour que le lecteur affiche
 * une position vraie. Faite une fois, hors du dépôt.
 */
function ensurePlayerVideo() {
  const file = path.join(HOME, "video", `${idOf("tears-of-steel")}.mp4`);
  if (fs.existsSync(file)) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const still = path.join(SOURCES, "tears-of-steel/Tears_of_Steel_frame_09_1a.jpg");
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-loop", "1", "-framerate", "1", "-i", still, "-t", "734",
    "-vf", "scale=1920:-2,format=yuv420p", "-c:v", "libx264", "-tune", "stillimage", "-preset", "veryfast", "-crf", "20", "-r", "1",
    "-movflags", "+faststart", file]);
  console.log(`vidéo du lecteur : ${file}`);
}

/** Les écrans d'un appareil : ceux de ses stores, le survol en DERNIER (la
 *  souris resterait sur la page suivante et y ouvrirait un plateau). */
function screensFor(plan, device, only) {
  const wanted = new Set(Object.values(plan.devices[device].stores).flat());
  const screens = plan.screens.filter((screen) => wanted.has(screen.id) && (!only || only.includes(screen.id)));
  const hovers = (screen) => (screen.actions ?? []).some((action) => "hoverOrHold" in action);
  return [...screens.filter((s) => !hovers(s)), ...screens.filter(hovers)];
}

// Le mot « téléchargement » (et ses formes, et « download ») ne doit paraître
// sur AUCUN visuel destiné à Apple : rejet App Store (voir CLAUDE.md).
const APPLE_DEVICES = new Set(["iphone", "ipad", "ipadLandscape", "mac"]);
const FORBIDDEN = /t[ée]l[ée]charg|download/i;

/** Refuse la capture d'un visuel Apple dont le texte affiché porte le mot interdit. */
async function guardWords(page, device, id) {
  const text = await page.evaluate("document.body.innerText");
  const hit = FORBIDDEN.exec(text);
  if (!hit) return;
  const excerpt = text.slice(Math.max(0, hit.index - 40), hit.index + 40).replace(/\s+/g, " ");
  if (APPLE_DEVICES.has(device)) throw new Error(`« ${hit[0]} » à l'écran (${device}/${id}) : « …${excerpt}… »`);
  console.log(`! « ${hit[0]} » à l'écran (${device}/${id}), toléré hors Apple : « …${excerpt}… »`);
}

/** Capture la série web : `devices`, `langs`, `only` (identifiants d'écrans). */
export async function captureWeb({ devices, langs, only = null, rebuild = false }) {
  const plan = webPlan();
  await upWeb({ rebuild });
  ensurePlayerVideo();
  for (const device of devices) {
    if (!plan.devices[device]) throw new Error(`appareil inconnu : ${device}`);
    const spec = DEVICES[device];
    for (const lang of langs) {
      await setDemo({ lang, hero: plan.devices[device].hero });
      const page = await launchEngine(spec);
      try {
        const { watch } = await prepare(page, { device, origin: ORIGIN, lang });
        for (const screen of screensFor(plan, device, only)) {
          await open(page, watch, ORIGIN, routeOf(screen.route), { settleMs: 600 });
          await play(page, screen.actions, { touch: spec.touch, lang });
          await settle(page, watch, { settleMs: 900 });
          await guardWords(page, device, screen.id);
          const file = webCaptureFile(device, lang, screen.id);
          await screenshot(page, file);
          await thaw(page);
          console.log(`capturé web ${device}/${lang}/${screen.id} — ${describe(file)}`);
        }
      } finally {
        page.close();
        await sleep(1200);
      }
    }
  }
}
