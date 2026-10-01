#!/usr/bin/env node
// La vitrine en ligne de commande : les visuels des stores (Apple TV par la
// refonte au banc ; iPhone, iPad, Play, Mac et Microsoft par le client web de
// main) et du site, sur un catalogue LIBRE. Voir README.md pour le déroulé.
import fs from "node:fs";
import path from "node:path";
import { capture, down, up } from "./lib/bench.mjs";
import { writeCredits } from "./lib/credits.mjs";
import { APPSTORE_OUT, BENCH, CAPTURES, HOME, LANGS, SITE_OUT, STORE_OUT } from "./lib/paths.mjs";
import { appstoreScreens, captureScreens, composeAppStore, composeSite, siteVisuals } from "./lib/series.mjs";
import { contactSheet } from "./lib/sheets.mjs";
import { shutdown } from "./lib/simulator.mjs";
import { writeSnapshots } from "./lib/snapshot.mjs";
import { ensureSources } from "./lib/sources.mjs";
import { composeBrandArt } from "./compose/brandArt.mjs";
import { composeGithub } from "./compose/githubArt.mjs";
import { exportSite } from "./compose/siteExport.mjs";
import { composeStores } from "./compose/storeSeries.mjs";
import { captureWeb, webPlan } from "./web/series.mjs";
import { downWeb } from "./web/stack.mjs";

const WEB_DEVICES = ["iphone", "ipad", "ipadLandscape", "tablet", "mac", "windows"];

const [command = "help", ...args] = process.argv.slice(2);
const option = (name, fallback) => args.find((arg) => arg.startsWith(`--${name}=`))?.split("=")[1] ?? fallback;

const langsOf = () => (option("lang", null) ? [option("lang")] : LANGS);
const only = () => option("only", null)?.split(",") ?? null;
const devicesOf = () => option("device", null)?.split(",") ?? WEB_DEVICES;

// Les planches des séries web : colonnes et vignette par store.
const STORE_SHEETS = {
  iphone: { columns: 5, tile: "300x652" }, ipad: { columns: 5, tile: "450x600" }, ipadLandscape: { columns: 3, tile: "800x600" },
  mac: { columns: 3, tile: "960x600" },
  playPhone: { columns: 4, tile: "338x600" }, playTablet: { columns: 3, tile: "960x540" }, microsoft: { columns: 3, tile: "960x540" },
};

/** Les planches de relecture : la série App Store, les visuels du site, les séries web. */
function planches() {
  const plan = webPlan();
  for (const lang of langsOf()) {
    for (const { stores } of Object.values(plan.devices)) {
      for (const [store, ids] of Object.entries(stores)) {
        const files = ids.map((id) => ({ file: path.join(STORE_OUT[store], lang, `${id}.png`), label: `${id} · ${lang}` })).filter((f) => fs.existsSync(f.file));
        if (files.length) console.log(`planche ${contactSheet(files, `${store}-${lang}`, STORE_SHEETS[store])}`);
      }
    }
    const store = appstoreScreens().map((screen) => ({ file: path.join(APPSTORE_OUT, lang, `${screen.id}.png`), label: `${screen.id} · ${lang}` }));
    console.log(`planche ${contactSheet(store, `appstore-${lang}`)}`);
    const site = siteVisuals().map((visual) => ({ file: path.join(SITE_OUT, lang, `${visual.id}.png`), label: `${visual.id} · ${lang}` }));
    console.log(`planche ${contactSheet(site, `site-${lang}`)}`);
  }
}

/** Les crédits CC BY à côté de chaque série : ils partent avec les images. */
function credits() {
  const { iphone, ipad, ipadLandscape, mac, playBrand, microsoft } = STORE_OUT;
  for (const dir of [APPSTORE_OUT, iphone, ipad, ipadLandscape, mac, playBrand, microsoft, SITE_OUT, HOME]) console.log(`crédits ${writeCredits(dir)}`);
}

const commands = {
  sources: () => ensureSources({ fetchMissing: args.includes("--fetch") }),
  snapshot: async () => {
    await ensureSources();
    writeSnapshots();
  },
  /** Monte le banc sur l'instantané d'une langue (Metro, relais, simulateur, app). */
  bench: async () => {
    const lang = option("lang", "fr");
    if (!LANGS.includes(lang)) throw new Error(`langue inconnue : ${lang}`);
    const udid = await up(lang);
    console.log(`banc prêt (${lang}) sur le simulateur ${udid}`);
  },
  /** Une capture d'essai : `shot <scène> [--focus=…] [--lang=…] [--glass=on|sim|off]`. */
  shot: async () => {
    const scene = args.find((arg) => !arg.startsWith("--"));
    if (!scene) throw new Error("usage : shot <scène> [--focus=…] [--lang=fr|en]");
    const lang = option("lang", "fr");
    const udid = await up(lang);
    const file = path.join(CAPTURES, "essais", `${scene.replace(/\//g, "_")}-${lang}.png`);
    await capture(udid, { scene, focus: option("focus", null), lang, glass: option("glass", "on") }, file);
    console.log(file);
  },
  /** Capture les écrans de la série : `capture [--lang=fr|en] [--only=01_accueil,…]`. */
  capture: async () => {
    for (const lang of langsOf()) await captureScreens(lang, only());
  },
  /** Compose les images App Store et les visuels du site à partir des captures. */
  compose: async () => {
    for (const lang of langsOf()) {
      await composeAppStore(lang, only());
      await composeSite(lang);
    }
    credits();
  },
  planches,
  /** Les captures du client web : `web [--device=iphone,…] [--lang=…] [--only=…] [--rebuild]`. */
  web: async () => {
    await ensureSources();
    writeSnapshots();
    await captureWeb({ devices: devicesOf(), langs: langsOf(), only: only(), rebuild: args.includes("--rebuild") });
  },
  /** Les séries des stores hors Apple TV, depuis les captures web : `stores [--lang=…] [--only=…]`. */
  stores: async () => {
    await composeStores({ langs: langsOf(), only: only(), stores: option("store", null)?.split(",") ?? null });
    credits();
  },
  /** Les visuels de marque (Microsoft : Super hero art, icône 300×300). */
  brand: composeBrandArt,
  /** Les illustrations du README GitHub, dans Tentacle-Vitrine/github/docs. */
  github: composeGithub,
  /** Les captures brutes du site, copiées dans le dépôt « Tentacle Web ». */
  site: () => {
    const recipe = exportSite(langsOf());
    console.log(`${recipe.length} sources copiées — puis, dans Tentacle Web : node tools/capture/optimize.mjs`);
  },
  /** Tout, de bout en bout : Apple TV au banc, puis le web et les autres stores. */
  all: async () => {
    await ensureSources();
    writeSnapshots();
    for (const lang of langsOf()) await captureScreens(lang);
    for (const lang of langsOf()) {
      await composeAppStore(lang);
      await composeSite(lang);
    }
    await captureWeb({ devices: WEB_DEVICES, langs: langsOf() });
    await composeStores({ langs: langsOf() });
    await composeBrandArt();
    await composeGithub();
    exportSite(langsOf());
    credits();
    planches();
  },
  down: () => {
    down();
    downWeb();
    if (args.includes("--sim")) shutdown();
    console.log("banc de la vitrine arrêté (Metro, relais, faux serveur web, client web)");
  },
  help: () =>
    console.log(`usage : vitrine.mjs <commande>
  all [--lang=…]                  tout, de bout en bout (Apple TV, web, stores, site, planches)
  sources [--fetch]               vérifie les images libres (et télécharge celles qui manquent)
  snapshot                        tire les images et écrit l'instantané vitrine (fr, en)
  bench [--lang=fr|en]            monte le banc (Metro ${BENCH.metroPort}, relais ${BENCH.relayPort}, simulateur 4K)
  shot <scène> [--focus=…] [--lang=…] [--glass=on|sim|off]   une capture d'essai
  capture [--lang=…] [--only=…]   capture les écrans de la série au banc
  compose [--lang=…] [--only=…]   compose les images App Store et les visuels du site (+ crédits)
  web [--device=…] [--only=…]     captures du client web (iphone, ipad, ipadLandscape, tablet, mac, windows) [--rebuild]
  stores [--store=…] [--only=…]   séries iPhone, iPad, Play, Mac, Microsoft (+ légendes Microsoft)
  brand                           visuels de marque Microsoft (Super hero art, icône 300×300)
  github                          illustrations du README (Tentacle-Vitrine/github/docs)
  site [--lang=…]                 copie les sources du site dans le dépôt Tentacle Web
  planches [--lang=…]             planches contact de relecture
  down [--sim]                    arrête Metro et le relais de la vitrine (et le simulateur)`),
};

const run = commands[command];
if (!run) {
  console.error(`commande inconnue : ${command}`);
  process.exit(1);
}
Promise.resolve(run()).catch((error) => {
  console.error(`✗ ${error.message}`);
  process.exit(1);
});
