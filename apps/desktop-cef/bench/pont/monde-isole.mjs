// Banc du PONT face aux mondes isolés (lot rf2, recette) : un outil qui ouvre un monde isolé
// dans la page — les outils de développement, Playwright (un monde par session, recréé à
// chaque document) — ne doit ni recevoir le pont, ni le prendre à la page.
//
//   PONT_CDP_PORT=9415 node bench/pont/monde-isole.mjs
//
// L'app : lancée avec --devtools-port, une page chargée (n'importe laquelle). Le banc ouvre un
// monde isolé, puis en inscrit un pour chaque document à venir et recharge la page ; après
// chaque geste il demande une réponse au pont DEPUIS LA PAGE. Avant le correctif
// (src/shell/renderer_ipc.cpp), la première réponse après l'ouverture du monde n'arrivait
// jamais. Code de sortie 1 au premier écart.
import { Cdp, pageTarget } from "../../web/shim/dev/cdp.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cdp = await Cdp.connect((await pageTarget()).webSocketDebuggerUrl);
let failed = 0;
const check = (label, ok, detail = "") => {
  if (!ok) failed += 1;
  console.log(`${ok ? "✅" : "❌"} ${label}${detail ? ` — ${detail}` : ""}`);
};

/** Une commande que toute coquille annonce ; la réponse doit revenir en moins de trois secondes. */
const ANSWER = `(async () => {
  const command = window.tentacle?.capabilities?.find((c) => c === "display_hdr_state") ?? window.tentacle?.capabilities?.[0];
  if (!command) return "pont absent de la page";
  const t0 = performance.now();
  const outcome = await Promise.race([
    window.tentacle.invoke(command).then(() => "réponse", () => "réponse (refus)"),
    new Promise((resolve) => setTimeout(() => resolve("SANS RÉPONSE"), 3000)),
  ]);
  return outcome + " en " + Math.round(performance.now() - t0) + " ms (" + command + ")";
})()`;
const answers = async (label) => {
  const outcome = await cdp.eval(ANSWER);
  check(label, outcome.startsWith("réponse"), outcome);
};

await answers("le pont répond à la page, avant tout");

const { frameTree } = await cdp.send("Page.getFrameTree");
const world = await cdp.send("Page.createIsolatedWorld", { frameId: frameTree.frame.id, worldName: "banc-monde-isole" });
const inside = await cdp.send("Runtime.evaluate", { expression: "typeof window.__shell + '/' + typeof window.__shellNative + '/' + typeof window.tentacle", contextId: world.executionContextId, returnByValue: true });
check("le monde isolé ne reçoit ni le pont ni son amorce", inside.result.value === "undefined/undefined/undefined", inside.result.value);
await answers("le pont répond toujours à la page, un monde isolé ouvert");

// Le cas de Playwright : un monde inscrit pour CHAQUE document, puis un rechargement.
await cdp.send("Page.enable");
const script = await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: "globalThis.__bancMondeIsole = true;", worldName: "banc-monde-de-document" });
await cdp.send("Page.reload");
for (let i = 0; i < 40; i++) {
  await sleep(250);
  const ready = await cdp.eval("document.readyState === 'complete' && typeof window.tentacle === 'object'").catch(() => false);
  if (ready) break;
}
await sleep(500);
await answers("le pont répond à la page rechargée, un monde isolé inscrit pour chaque document");
await cdp.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: script.identifier });

console.log(failed === 0 ? "\n✅ le pont reste à la page" : `\n❌ ${failed} écart(s)`);
cdp.close();
process.exit(failed === 0 ? 0 : 1);
