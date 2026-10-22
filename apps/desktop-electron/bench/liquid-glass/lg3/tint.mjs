// Banc lg3 : essaie des TEINTES (et apparences) sur les régions natives du
// lecteur en cours, capture, et mesure le gris de chaque capsule (bande haute
// de la capsule du temps, sans glyphe). La page ne renvoie une région qu'au
// changement : la teinte essayée tient jusqu'au geste suivant.
//   node lg3/tint.mjs <compte> <nom> <niveau>,<teinte|none>,<apparence|->,<voile 0..1> …
//   ex. clear,none,-,0.55 : verre clair, sans teinte, voile noir de la PAGE à 55 % dans la forme.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { sleep } from "../lib/app.mjs";
import { Cdp, listTargets } from "../lib/cdp.mjs";
import { STATE } from "../lib/config.mjs";
import { PORTS } from "../lib/electron.mjs";
import { captureWindow, mainWindow } from "../lib/macos.mjs";

const [who, name, ...variants] = process.argv.slice(2);
const [, electronPid] = readFileSync(path.join(STATE, `hold-${who}.pid`), "utf8").trim().split(" ").map(Number);
const OUT = process.env.LG3_OUT ?? path.join(process.env.HOME, "Pictures/tentacle-banc-liquid-glass/lg3");
const target = (await listTargets(PORTS.page)).find((t) => t.type === "page" && t.url.startsWith("tentacle://app/"));
const page = await Cdp.connect(target.webSocketDebuggerUrl);
await page.send("Runtime.enable");
const list = await (await fetch(`http://127.0.0.1:${PORTS.main}/json/list`)).json();
const main = await Cdp.connect(list[0].webSocketDebuggerUrl);
const evalMain = async (body) => (await main.send("Runtime.evaluate", { expression: `(async () => { ${body} })()`, awaitPromise: true, returnByValue: true })).result?.value;

/** La moyenne sRGB (0..255, canal vert — jamais `-colorspace Gray`, LINÉAIRE en IM7) d'un rectangle de la capture, en points. */
function meanGrey(file, [x, y, w, h]) {
  // L'échelle de la capture : 2 sur l'écran Retina, 1 sur un écran externe 1×.
  const k = Number(execFileSync("magick", ["identify", "-format", "%w", file], { encoding: "utf8" })) / 1280;
  const out = execFileSync("magick", [file, "-crop", `${Math.round(w * k)}x${Math.round(h * k)}+${Math.round(x * k)}+${Math.round(y * k)}`, "-format", "%[fx:round(mean.g*255)]", "info:"], { encoding: "utf8" });
  return Number(out.trim());
}

try {
  const snap = await evalMain("return globalThis.__tentacleGlass.snapshot();");
  const regions = snap.regions.filter((r) => !r.hidden);
  for (const variant of variants) {
    const [level, tint, appearanceRaw, dim] = variant.split(",");
    const appearance = appearanceRaw === "-" ? undefined : appearanceRaw;
    // Le voile de la page : un noir à alpha DANS la forme, sous les glyphes (essai, injecté).
    await page.evaluate(`let st = document.getElementById("lg3-dim"); if (!st) { st = document.createElement("style"); st.id = "lg3-dim"; document.head.append(st); }
      st.textContent = ${JSON.stringify(Number(dim) > 0 ? `.lgp-surface::before{content:"";position:absolute;inset:0;border-radius:inherit;background:rgb(0 0 0 / ${dim});pointer-events:none} .lgp-surface > *{position:relative} .lgp-surface{--lg-player-fg:#fff !important;--lg-player-fg-2:#d4d4da !important}` : "")}; return 1;`);
    const batch = regions.map((r) => ({
      id: r.id, x: r.css.x, y: r.css.y, width: r.css.width, height: r.css.height, radius: r.css.radius,
      level, tint: tint === "none" ? null : tint, interactive: false, z: 0, group: "player", spacing: 8,
      ...(appearance ? { appearance } : {}),
    }));
    await page.evaluate(`window.tentacle.liquidGlass.upsert(${JSON.stringify(batch)}); return 1;`);
    await sleep(500);
    const file = path.join(OUT, `${name}-${variant.replace(/[#,]/g, "_")}.png`);
    captureWindow(mainWindow(STATE, electronPid).id, file);
    // Bande haute de chaque capsule (4..10 pt sous son bord), au centre horizontal ±40 %.
    const greys = regions.map((r) => {
      const c = r.css;
      return meanGrey(file, [Math.round(c.x + c.width * 0.1), Math.round(c.y + 4), Math.round(c.width * 0.8), 6]);
    });
    const back = meanGrey(file, [600, 300, 80, 80]);
    console.log(JSON.stringify({ variant, fond: back, capsules: greys }));
  }
} finally {
  page.close();
  main.close();
}
