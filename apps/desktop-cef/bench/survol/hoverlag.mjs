#!/usr/bin/env node
// Un bouton REMPLACÉ sous une souris immobile (« Marquer comme vu » qui bascule) : que sait Chromium,
// et quand ? Sur la page de bench/gel, dans la coquille (ou un Chrome) : node hoverlag.mjs <port CDP>.
// Mesuré le 10/11/2026 (CEF 156) : à 0 ms, `:hover` du nouveau bouton est FAUX alors que
// `elementFromPoint` le rend déjà ; un `pointerover` de synthèse arrive sous 50 ms, sans `pointerout`
// de l'ancien. D'où `usePreviewPointer` (apps/web) : la place de la souris se lit par la géométrie.
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const { Cdp, pageTarget } = await import(path.join(here, "../../web/shim/dev/cdp.mjs"));
const cdp = await Cdp.connect((await pageTarget(Number(process.argv[2] ?? 9411))).webSocketDebuggerUrl);
// Une page neuve : un passage précédent a déjà remplacé le bouton.
await cdp.send("Page.reload");
await new Promise((s) => setTimeout(s, 1000));
const r = await cdp.eval("__bench.rect('b1')");
for (const [x, y] of [[r.x - 40, r.y + 80], [r.x - 10, r.y + 20], [r.x, r.y]]) { await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y }); await new Promise((s) => setTimeout(s, 30)); }
const out = await cdp.eval(`(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const log = [];
  const old = document.getElementById("b1");
  document.addEventListener("pointerover", (e) => log.push("pointerover " + (e.target.id || e.target.tagName)), true);
  document.addEventListener("pointerout", (e) => log.push("pointerout " + (e.target.id || e.target.tagName)), true);
  const before = { hoverOld: old.matches(":hover") };
  const fresh = old.cloneNode(true); fresh.id = "b1-neuf";
  old.replaceWith(fresh);
  const at = (ms) => ({ ms, hoverNeuf: fresh.matches(":hover"), sous: document.elementFromPoint(${r.x}, ${r.y})?.id, evenements: log.slice() });
  const t0 = at(0); await sleep(50); const t50 = at(50); await sleep(250); const t300 = at(300); await sleep(1200); const t1500 = at(1500);
  return { before, t0, t50, t300, t1500 };
})()`);
console.log(JSON.stringify(out, null, 1));
cdp.close();
