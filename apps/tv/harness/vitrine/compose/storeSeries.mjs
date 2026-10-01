// Les séries des stores hors Apple TV, composées depuis les captures web :
// accroche + écran (storeTemplate) pour Apple et Google ; capture NUE pour
// Microsoft (sa règle : aucun logo, icône ni message marketing dans une
// capture), avec ses légendes à part. Chaque fichier est contrôlé : taille
// exacte du store, RVB sans alpha.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { STORE_OUT } from "../lib/paths.mjs";
import { describe, renderPng } from "../lib/render.mjs";
import { webCaptureFile, webPlan } from "../web/series.mjs";
import { DEVICES } from "../web/shoot.mjs";
import { LAYOUTS, storeHtml } from "./storeTemplate.mjs";

const EXPECTED = {
  iphone: "1320x2868", ipad: "2064x2752", ipadLandscape: "2752x2064", mac: "2880x1800",
  playPhone: "1080x1920", playTablet: "2560x1440", microsoft: "3840x2160",
};

/** L'accroche d'un écran : la même partout, ou par geste (doigt / souris). */
function headlineOf(screen, lang, touch) {
  const headline = screen.headline.touch ? screen.headline[touch ? "touch" : "mouse"] : screen.headline;
  return headline[lang];
}

/** Microsoft : la capture telle quelle, aplatie en RVB sans alpha. */
function flatten(shot, out) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  execFileSync("magick", [shot, "-background", "#000000", "-alpha", "remove", "-alpha", "off", "-strip", `PNG24:${out}`]);
}

/** Les légendes Microsoft (200 caractères au plus), dans l'ordre des captures. */
function writeCaptions(plan, langs) {
  const ids = plan.devices.windows.stores.microsoft;
  const lines = ["# Légendes Microsoft Store (Partner Center, une par capture, 200 caractères au plus)", ""];
  for (const lang of langs) {
    lines.push(`## ${lang.toUpperCase()}`, "");
    for (const id of ids) {
      const caption = plan.screens.find((screen) => screen.id === id).caption[lang];
      if (caption.length > 200) throw new Error(`légende trop longue (${id}, ${lang}) : ${caption.length} caractères`);
      lines.push(`- \`${id}.png\` — ${caption}`);
    }
    lines.push("");
  }
  const file = path.join(STORE_OUT.microsoft, "legendes.md");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, lines.join("\n"));
  return file;
}

/** Compose toutes les séries (ou `only` : identifiants d'écrans, `stores` : clés de store). */
export async function composeStores({ langs, only = null, stores = null }) {
  const plan = webPlan();
  for (const [device, { stores: byStore }] of Object.entries(plan.devices)) {
    const spec = DEVICES[device];
    for (const [store, ids] of Object.entries(byStore).filter(([key]) => !stores || stores.includes(key))) {
      for (const lang of langs) {
        for (const id of ids.filter((screenId) => !only || only.includes(screenId))) {
          const screen = plan.screens.find((entry) => entry.id === id);
          const shot = webCaptureFile(device, lang, id);
          if (!fs.existsSync(shot)) throw new Error(`capture absente : ${shot} — « vitrine.mjs web »`);
          const out = path.join(STORE_OUT[store], lang, `${id}.png`);
          if (store === "microsoft") flatten(shot, out);
          else {
            const layout = LAYOUTS[store];
            const html = storeHtml({ layout: store, capture: shot, ratio: spec.width / spec.height, headline: headlineOf(screen, lang, spec.touch), lang });
            await renderPng(html, out, { width: layout.width, height: layout.height, scale: layout.scale, background: "#05050a" });
          }
          const info = describe(out);
          if (info !== `${EXPECTED[store]} srgb`) throw new Error(`format refusé pour ${out} : ${info} (attendu ${EXPECTED[store]} srgb)`);
          console.log(`${store} ${lang}/${id}.png — ${info}`);
        }
      }
    }
  }
  if (!stores || stores.includes("microsoft")) console.log(`légendes ${writeCaptions(plan, langs)}`);
}
