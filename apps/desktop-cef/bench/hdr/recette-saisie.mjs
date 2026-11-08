// Recette des apports de `saisie` dans l'app CEF (lancée par scripts/recette.sh avec
// --debug-input, au premier plan : SDL3 jette les touches d'une fenêtre inactive). Les touches
// sont de VRAIS NSEvent postés (shell.debug.native), jamais des évènements CDP :
//   navigator.language(s) = langues du système (RECETTE_LANGUES, « fr-CH,en-AU ») ;
//   F11 et ⌃⌘F : plein écran puis fenêtré, prouvé par la NSWindow ET le serveur de fenêtres ;
//   ⌘Q en pleine lecture : l'app se ferme (son code de sortie est lu par recette.sh).
// L'Entrée sur /login est prouvée avant par tests/saisie/connexion.mjs (profil neuf).
//
//   node bench/hdr/recette-saisie.mjs
// Environnement : PONT_CDP_PORT, RECETTE_APP_PID, WIN_STATE, RECETTE_LANGUES.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { connect, findItem, sleep } from "../../web/shim/dev/drive.mjs";
import { connect as connectNative, keyboard, K, P } from "../../tests/saisie/lib.mjs";

const run = promisify(execFile);
const port = process.env.PONT_CDP_PORT ?? "9317";
const pid = process.env.RECETTE_APP_PID;
const win = async () => JSON.parse((await run(process.env.WIN_STATE, [pid])).stdout);

const d = await connect();
const { cdp, check, last } = d;
const n = await connectNative(port);
const { native, press } = keyboard(n.js);
const app = async () => JSON.parse(await native({ type: "app", action: "state" }));
const until = async (pred, ms = 5000) => {
  for (let t = 0; t < ms; t += 150) { const s = await app(); if (pred(s)) return s; await sleep(150); }
  return app();
};

// Langue : la première langue du système, et ses bases, dans l'ordre (comme Electron).
const sys = (process.env.RECETTE_LANGUES ?? "").split(",").filter(Boolean);
const langs = await cdp.eval("JSON.stringify([navigator.language, ...navigator.languages])").then(JSON.parse);
check(`navigator.language = ${sys[0] ?? "?"} (système)`, sys.length > 0 && langs[0] === sys[0],
  `navigator.language ${langs[0]}, navigator.languages ${JSON.stringify(langs.slice(1))}, système ${JSON.stringify(sys)}`);
check("navigator.languages suit l'ordre du système", sys.every((l, i) => langs.slice(1).indexOf(l) >= 0
  && (i === 0 || langs.slice(1).indexOf(l) > langs.slice(1).indexOf(sys[i - 1]))), JSON.stringify(langs.slice(1)));

// Plein écran par le clavier : NSWindow (styleMask) et serveur de fenêtres, aller puis retour.
async function toggle(name, gesture) {
  await native({ type: "app", action: "unhide" });  // fenêtre clé : SDL3 jette sinon les touches
  await gesture();
  const on = await until((s) => s.fullscreen);
  await sleep(1500);  // l'animation d'entrée dans l'espace plein écran
  const w1 = await win();
  await gesture();
  const off = await until((s) => !s.fullscreen);
  await sleep(1500);
  const w2 = await win();
  check(`${name} : plein écran puis fenêtré`, on.fullscreen && w1.fullscreen && !off.fullscreen && !w2.fullscreen,
    `NSWindow ${on.fullscreen} → ${off.fullscreen}, serveur de fenêtres ${w1.fullscreen} → ${w2.fullscreen} ` +
    `(${JSON.stringify(w1.windows.filter((w) => w.layer === 0))})`);
}
await toggle("F11", () => press(K.f11));
await toggle("⌃⌘F", () => press(P.f, ["ctrl", "cmd"]));

// ⌘Q en pleine lecture.
await d.playFromDetail((await findItem("Banc Pistes SDR (2026)")).item.Id);
await sleep(1500);
await d.dismissModals();
const playing = await d.waitFor(async () => { const a = await last("time-pos"); await sleep(600); return (await last("time-pos")) > a; }, 15000);
check("lecture en cours avant ⌘Q", playing, `time-pos = ${await last("time-pos")}, page ${await d.path()}`);
const ok = d.results.every((r) => r.ok);
const total = d.results.length;
const failed = d.results.filter((r) => !r.ok).length;
cdp.close();
await native({ type: "app", action: "unhide" });
// La page disparaît avec l'app : la réponse à la touche ne vient jamais, d'où l'attente bornée.
await Promise.race([press(P.q, ["cmd"]).catch(() => {}), sleep(3000)]);
n.close();
console.log(`\n${total - failed}/${total} cas réussis (⌘Q envoyé)`);
process.exit(ok ? 0 : 1);
