#!/usr/bin/env node
// Clique (CDP, vrai clic souris au centre) le premier élément visible dont le texte ou
// l'aria-label contient <texte> : node tests/recette/clicktext.mjs <port> '<texte>'
import { Cdp, pageTarget } from "../../web/shim/dev/cdp.mjs";
const [port = "9425", text = ""] = process.argv.slice(2);
const cdp = await Cdp.connect((await pageTarget(Number(port))).webSocketDebuggerUrl);
const box = await cdp.eval(`(() => {
  const want = ${JSON.stringify(text)}.toLowerCase();
  for (const e of document.querySelectorAll('button, a, [role=button], [role=menuitem], label')) {
    const t = ((e.innerText || '') + ' ' + (e.getAttribute('aria-label') || '') + ' ' + (e.title || '')).toLowerCase();
    const r = e.getBoundingClientRect();
    if (t.includes(want) && r.width > 0 && r.height > 0) return { x: r.x + r.width / 2, y: r.y + r.height / 2, tag: e.tagName };
  }
  return null; })()`);
if (!box) { console.log(JSON.stringify({ found: false })); process.exit(4); }
for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) {
  await cdp.send("Input.dispatchMouseEvent", { type, x: box.x, y: box.y, button: type === "mouseMoved" ? "none" : "left", clickCount: 1 });
}
console.log(JSON.stringify({ found: true, ...box }));
cdp.close();
