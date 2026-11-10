// Exploration : une lecture, puis « Lecture en incrustation » ; imprime l'état natif.
//   PONT_CDP_PORT=9426 node bench/pip/explore.mjs ["Banc HDR10 Pistes"]
import { drive, findItem, sleep } from "./pip-drive.mjs";

const title = process.argv[2] ?? "Banc HDR10 Pistes";
const d = await drive();
await d.playFromDetail((await findItem(title)).item.Id);
await sleep(1500);
await d.dismissModals();
await d.waitFor(async () => (await d.prop("time-pos")) > 1, 15000);
console.log("time-pos", await d.prop("time-pos"), "path", await d.path());
console.log("avant : couches principales\n" + (await d.layers()));
await d.wake();
await sleep(300);
const clicked = await d.cdp.eval(`(() => { const b = document.querySelector('button[aria-label="Lecture en incrustation"]');
  if (!b) return false; b.click(); return true; })()`);
console.log("bouton Réduire :", clicked);
for (let i = 0; i < 10; i++) {
  await sleep(150);
  const s = await d.state();
  console.log(`+${(i + 1) * 150} ms`, JSON.stringify({ open: s?.open, bounds: s?.bounds, lent: s?.videoLent, path: await d.path() }));
}
const s = await d.state();
console.log("pile du PiP\n" + s?.layers);
console.log("couches principales\n" + (await d.layers()));
console.log("surface", JSON.stringify(await d.surface()));
const pip = await d.pip();
console.log("page du PiP :", pip ? await pip.eval("({vis: document.visibilityState, w: innerWidth, h: innerHeight, sw: screen.availWidth, dpr: devicePixelRatio, buttons: [...document.querySelectorAll('button')].map(b => b.getAttribute('aria-label'))})") : null);
const t0 = await d.prop("time-pos");
await sleep(2000);
console.log("lecture continue :", t0, "→", await d.prop("time-pos"));
pip?.close();
d.cdp.close();
