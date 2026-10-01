#!/usr/bin/env node
// La vitrine en ligne de commande : des visuels App Store (Apple TV) et du
// site, tirés de la VRAIE interface refondue, sur un catalogue LIBRE. Voir
// README.md pour le déroulé et les droits.
import path from "node:path";
import { capture, down, up } from "./lib/bench.mjs";
import { writeCredits } from "./lib/credits.mjs";
import { APPSTORE_OUT, BENCH, CAPTURES, HOME, LANGS, SITE_OUT } from "./lib/paths.mjs";
import { appstoreScreens, captureScreens, composeAppStore, composeSite, siteVisuals } from "./lib/series.mjs";
import { contactSheet } from "./lib/sheets.mjs";
import { shutdown } from "./lib/simulator.mjs";
import { writeSnapshots } from "./lib/snapshot.mjs";
import { ensureSources } from "./lib/sources.mjs";

const [command = "help", ...args] = process.argv.slice(2);
const option = (name, fallback) => args.find((arg) => arg.startsWith(`--${name}=`))?.split("=")[1] ?? fallback;

const langsOf = () => (option("lang", null) ? [option("lang")] : LANGS);
const only = () => option("only", null)?.split(",") ?? null;

/** Les planches de relecture : la série App Store et les visuels du site. */
function planches() {
  for (const lang of langsOf()) {
    const store = appstoreScreens().map((screen) => ({ file: path.join(APPSTORE_OUT, lang, `${screen.id}.png`), label: `${screen.id} · ${lang}` }));
    console.log(`planche ${contactSheet(store, `appstore-${lang}`)}`);
    const site = siteVisuals().map((visual) => ({ file: path.join(SITE_OUT, lang, `${visual.id}.png`), label: `${visual.id} · ${lang}` }));
    console.log(`planche ${contactSheet(site, `site-${lang}`)}`);
  }
}

function credits() {
  for (const dir of [APPSTORE_OUT, SITE_OUT, HOME]) console.log(`crédits ${writeCredits(dir)}`);
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
  /** Tout, de bout en bout : la commande à rejouer quand la refonte bouge. */
  all: async () => {
    await ensureSources();
    writeSnapshots();
    for (const lang of langsOf()) await captureScreens(lang);
    for (const lang of langsOf()) {
      await composeAppStore(lang);
      await composeSite(lang);
    }
    credits();
    planches();
  },
  down: () => {
    down();
    if (args.includes("--sim")) shutdown();
    console.log("banc de la vitrine arrêté");
  },
  help: () =>
    console.log(`usage : vitrine.mjs <commande>
  all [--lang=…]                  tout, de bout en bout (sources → planches)
  sources [--fetch]               vérifie les images libres (et télécharge celles qui manquent)
  snapshot                        tire les images et écrit l'instantané vitrine (fr, en)
  bench [--lang=fr|en]            monte le banc (Metro ${BENCH.metroPort}, relais ${BENCH.relayPort}, simulateur 4K)
  shot <scène> [--focus=…] [--lang=…] [--glass=on|sim|off]   une capture d'essai
  capture [--lang=…] [--only=…]   capture les écrans de la série au banc
  compose [--lang=…] [--only=…]   compose les images App Store et les visuels du site (+ crédits)
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
