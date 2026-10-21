// Les gestes et relevés communs des scénarios : capture de NOTRE fenêtre,
// souris par CDP (jamais le vrai pointeur), étapes consignées, lecteur.
import path from "node:path";
import { go, mpvProperty, sleep } from "./app.mjs";
import { Cdp, listTargets } from "./cdp.mjs";
import { STATE } from "./config.mjs";
import { evalMain, PORTS } from "./electron.mjs";
import { captureWindow, hidIdleSeconds, mainWindow } from "./macos.mjs";

/** Le relevé des régions natives (socle lg-natif), lu par l'inspecteur du principal. */
export async function nativeSnapshot(app) {
  try {
    return await evalMain(app, `
      const glass = globalThis.__tentacleGlass;
      if (!glass?.snapshot) return { exposed: false };
      return { exposed: true, ...(await glass.snapshot()) };
    `);
  } catch (error) {
    return { exposed: false, error: String(error) };
  }
}

export async function shot(ctx, name) {
  const win = mainWindow(STATE, ctx.app.pid);
  if (!win) throw new Error("fenêtre principale introuvable");
  const file = path.join(ctx.out, `${ctx.cell}-${name}.png`);
  captureWindow(win.id, file);
  return path.basename(file);
}

/** Plein écran, PiP : ils changent d'espace ou ouvrent une fenêtre — seulement Damien absent. */
export function damienAway() {
  return hidIdleSeconds() >= 120;
}

export async function mouseTo(page, x, y) {
  await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
}

export async function clickAt(page, x, y) {
  for (const type of ["mousePressed", "mouseReleased"]) {
    await page.send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 });
  }
}

/** Le centre du premier élément visible qui vérifie le sélecteur et le motif. */
export async function centerOf(page, selector, pattern = null) {
  return page.evaluate(`
    const re = ${pattern ? `new RegExp(${JSON.stringify(pattern)}, "i")` : "null"};
    const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find((n) => {
      const r = n.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || r.bottom < 0 || r.top > innerHeight) return false;
      // Le centre doit être VISIBLE et atteignable : ni sous la barre du haut, ni hors fenêtre.
      const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
      if (cy < 0 || cy > innerHeight || cx < 0 || cx > innerWidth) return false;
      const top = document.elementFromPoint(cx, cy);
      if (top && top !== n && !n.contains(top) && !top.contains(n) && !n.closest("a, button, [role]")?.contains(top)) return false;
      // L'aria-label seul d'abord (motifs ancrés « ^…$ »), sinon avec le texte.
      return !re || re.test(n.getAttribute("aria-label") ?? "") || re.test((n.getAttribute("aria-label") ?? "") + " " + (n.textContent ?? ""));
    });
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  `);
}

/** Clique un bouton de la fenêtre PiP (cible CDP distincte), par son aria-label. */
export async function pipButton(label) {
  const targets = await listTargets(PORTS.page);
  for (const target of targets.filter((t) => t.type === "page" && !t.url.startsWith("tentacle://app/"))) {
    const pip = await Cdp.connect(target.webSocketDebuggerUrl);
    try {
      const done = await pip.evaluate(`
        const b = [...document.querySelectorAll("button[aria-label]")].find((x) => x.getAttribute("aria-label").toLowerCase().includes(${JSON.stringify(label)}));
        if (!b) return false;
        b.click();
        return true;
      `);
      if (done) return { clicked: true, url: target.url };
    } finally {
      pip.close();
    }
  }
  return { clicked: false, targets: targets.map((t) => t.url) };
}

export async function step(ctx, name, body) {
  const entry = { name, ok: true };
  ctx.report.steps.push(entry);
  try {
    Object.assign(entry, await body());
  } catch (error) {
    entry.ok = false;
    entry.error = String(error?.message ?? error);
  }
  entry.native = await nativeSnapshot(ctx.app);
  return entry;
}

/** Attend que mpv avance (lecture réelle), puis relève le couple HDR. */
export async function playing(page) {
  const end = Date.now() + 40_000;
  for (;;) {
    const pos = Number(await mpvProperty(page, "time-pos"));
    if (Number.isFinite(pos) && pos > 1.5) break;
    if (Date.now() > end) throw new Error("mpv n'avance pas (time-pos)");
    await sleep(500);
  }
  const props = {};
  for (const name of ["video-params", "video-target-params", "current-vo", "hwdec-current", "time-pos"]) {
    props[name] = await mpvProperty(page, name);
  }
  return props;
}

export async function showControls(page) {
  const size = await page.evaluate(`return { w: innerWidth, h: innerHeight };`);
  await mouseTo(page, size.w / 2, size.h / 2);
  await sleep(150);
  await mouseTo(page, size.w / 2 + 40, size.h / 2 + 20);
  await sleep(700);
  return size;
}

export async function leavePlayer(page) {
  await page.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await page.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await sleep(800);
  await go(page, "/", 2000);
}

