// Banc lg3 : la vignette du survol suit-elle le pointeur ? Balayage de la barre
// par la souris (CDP, un pas toutes les 16 ms), relevé À CHAQUE IMAGE de la page
// (rAF) : pointeur, centre de la vignette ; et, dans le principal, la vue native
// sous la vignette s'il y en a une (son retard sur la page, en ms).
//   node lg3/trail.mjs <compte> <nom>     (lecteur ouvert, en pause, fenêtre active)
import { writeFileSync } from "node:fs";
import path from "node:path";
import { sleep } from "../lib/app.mjs";
import { Cdp, listTargets } from "../lib/cdp.mjs";
import { STATE } from "../lib/config.mjs";
import { PORTS } from "../lib/electron.mjs";
import { mouseTo } from "../lib/steps.mjs";

const [, name = "trail"] = process.argv.slice(2);
const target = (await listTargets(PORTS.page)).find((t) => t.type === "page" && t.url.startsWith("tentacle://app/"));
const page = await Cdp.connect(target.webSocketDebuggerUrl);
await page.send("Runtime.enable");
const list = await (await fetch(`http://127.0.0.1:${PORTS.main}/json/list`)).json();
const main = await Cdp.connect(list[0].webSocketDebuggerUrl);
const evalMain = async (body) => (await main.send("Runtime.evaluate", { expression: `(async () => { ${body} })()`, awaitPromise: true, returnByValue: true })).result?.value;

const STEPS = 60;
try {
  const rail = await page.evaluate(`const r = document.querySelector(".lgp-scrub").getBoundingClientRect(); return { x: r.left, w: r.width, y: r.top + r.height / 2 };`);
  await mouseTo(page, rail.x + rail.w * 0.2, rail.y);
  await sleep(600);
  // Le relevé de la page : une ligne par image, horloge commune `Date.now()`.
  await page.evaluate(`
    window.__trail = []; window.__pointer = null;
    addEventListener("mousemove", (e) => { window.__pointer = e.clientX; }, { capture: true });
    const tick = () => {
      const el = document.querySelector(".lgp-trickplay");
      const r = el?.getBoundingClientRect();
      window.__trail.push([Date.now(), window.__pointer, r ? r.left + r.width / 2 : null, el ? getComputedStyle(el).transitionProperty : null]);
      if (window.__trail.length < 400) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return 1;`);
  // Le principal relève la vue native sous la vignette (la plus haute région au-dessus de la barre).
  const nativeRun = evalMain(`
    const out = []; const end = Date.now() + ${STEPS * 16 + 800};
    while (Date.now() < end) {
      const regions = globalThis.__tentacleGlass.snapshot().regions.filter((r) => !r.hidden && r.css.y + r.css.height < ${rail.y} - 8 && r.css.height > 30);
      const tip = regions.sort((a, b) => a.css.y - b.css.y)[0];
      out.push([Date.now(), tip ? tip.css.x + tip.css.width / 2 : null, tip ? tip.frame.x + tip.frame.width / 2 : null]);
      await new Promise((r) => setTimeout(r, 4));
    }
    return out;`);
  for (let i = 0; i <= STEPS; i += 1) {
    await mouseTo(page, rail.x + rail.w * (0.2 + (0.6 * i) / STEPS), rail.y);
    await sleep(16);
  }
  await sleep(500);
  const pageRows = await page.evaluate("return window.__trail;");
  const nativeRows = await nativeRun;
  // Retard de la vignette sur le pointeur, image par image (hors butées de la barre).
  const moving = pageRows.filter((r) => r[1] !== null && r[2] !== null);
  const offsets = moving.map((r) => Math.round(r[2] - r[1]));
  const steady = offsets.length ? offsets.sort((a, b) => a - b)[Math.floor(offsets.length / 2)] : null;
  const late = moving.filter((r) => Math.abs(r[2] - r[1] - steady) > 1).length;
  // Retard de la vue native sur la page : pour chaque centre natif, depuis quand la page y était.
  let nativeLag = null;
  if (nativeRows.some((r) => r[2] !== null)) {
    const lags = [];
    for (const [t, , x] of nativeRows) {
      if (x === null) continue;
      const seen = pageRows.find((r) => r[2] !== null && Math.abs(r[2] - x) < 1);
      if (seen) lags.push(t - seen[0]);
    }
    lags.sort((a, b) => a - b);
    nativeLag = lags.length ? { mediane: lags[Math.floor(lags.length / 2)], max: lags.at(-1), n: lags.length } : "aucune correspondance";
  }
  const transitions = [...new Set(pageRows.map((r) => r[3]))];
  const report = { name, images: pageRows.length, suivies: moving.length, decalageRepos: steady, imagesEnRetard: late, vueNative: nativeLag ?? "aucune", transitions };
  console.log(JSON.stringify(report));
  writeFileSync(path.join(STATE, `../trail-${name}.json`), JSON.stringify({ report, pageRows, nativeRows }));
} finally {
  page.close();
  main.close();
}
