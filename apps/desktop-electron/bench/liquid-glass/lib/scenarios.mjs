// Les écrans que la matrice parcourt. Chaque scénario capture et relève dans
// `ctx.report.steps` ; une erreur d'un scénario est consignée, les suivants
// continuent (une recette dit TOUT ce qui casse, pas seulement le premier).
import path from "node:path";
import { dismissOverlays, glassDom, glassToggle, go, mpvProperty, sleep } from "./app.mjs";
import { itemId, STATE } from "./config.mjs";
import { Cdp, listTargets } from "./cdp.mjs";
import { evalMain, PORTS } from "./electron.mjs";
import { captureRect, captureWindow, gpuWindow, loadAverage, mainWindow, windowsOf } from "./macos.mjs";

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

async function shot(ctx, name, { composite = false } = {}) {
  const win = mainWindow(STATE, ctx.app.pid);
  if (!win) throw new Error("fenêtre principale introuvable");
  const file = path.join(ctx.out, `${ctx.cell}-${name}.png`);
  if (composite) captureRect(win, file);
  else captureWindow(win.id, file);
  return path.basename(file);
}

async function mouseTo(page, x, y) {
  await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
}

async function clickAt(page, x, y) {
  for (const type of ["mousePressed", "mouseReleased"]) {
    await page.send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 });
  }
}

/** Le centre du premier élément visible qui vérifie le sélecteur et le motif. */
async function centerOf(page, selector, pattern = null) {
  return page.evaluate(`
    const re = ${pattern ? `new RegExp(${JSON.stringify(pattern)}, "i")` : "null"};
    const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find((n) => {
      const r = n.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || r.bottom < 0 || r.top > innerHeight) return false;
      return !re || re.test((n.getAttribute("aria-label") ?? "") + " " + (n.textContent ?? ""));
    });
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  `);
}

/** Clique un bouton de la fenêtre PiP (cible CDP distincte), par son aria-label. */
async function pipButton(label) {
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

async function step(ctx, name, body) {
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

export async function screens(ctx) {
  const { page } = ctx.app;
  await step(ctx, "accueil", async () => {
    await go(page, "/", 2500);
    await dismissOverlays(page);
    await sleep(1000);
    return { dom: await glassDom(page), capture: await shot(ctx, "accueil") };
  });
  await step(ctx, "accueil-defile", async () => {
    await mouseTo(page, 5, 5);
    await page.evaluate(`(document.scrollingElement ?? document.body).scrollTo(0, 900); return true;`);
    await sleep(1200);
    return { capture: await shot(ctx, "accueil-defile") };
  });
  await step(ctx, "carte-survol", async () => {
    const at = await centerOf(page, 'img[src*="/Images/Primary"]');
    if (!at) throw new Error("aucune carte visible");
    await mouseTo(page, at.x, at.y);
    await sleep(1200);
    const capture = await shot(ctx, "carte-survol");
    await mouseTo(page, 5, 5);
    return { capture };
  });
  await step(ctx, "fiche", async () => {
    await go(page, `/media/${await itemId("Banc SDR")}`, 3000);
    return { dom: await glassDom(page), capture: await shot(ctx, "fiche") };
  });
  await step(ctx, "reglages-apparence", async () => {
    await go(page, "/settings/appearance", 2000);
    return { toggle: await glassToggle(page), dom: await glassDom(page), capture: await shot(ctx, "reglages-apparence") };
  });
  await step(ctx, "gpu-repos-accueil", async () => {
    await go(page, "/", 2500);
    await mouseTo(page, 5, 5);
    await sleep(3000);
    return { load: loadAverage(), gpu: await gpuWindow(10) };
  });
}

/** Attend que mpv avance (lecture réelle), puis relève le couple HDR. */
async function playing(page) {
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

async function showControls(page) {
  const size = await page.evaluate(`return { w: innerWidth, h: innerHeight };`);
  await mouseTo(page, size.w / 2, size.h / 2);
  await sleep(150);
  await mouseTo(page, size.w / 2 + 40, size.h / 2 + 20);
  await sleep(700);
  return size;
}

async function leavePlayer(page) {
  await page.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await page.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await sleep(800);
  await go(page, "/", 2000);
}

export async function player(ctx) {
  const { page } = ctx.app;
  for (const [label, title, type] of [["sdr", "Banc SDR", "Movie"], ["hdr", "Banc HDR10", "Movie"]]) {
    await step(ctx, `lecteur-${label}`, async () => {
      await go(page, `/watch/${await itemId(title, type)}`, 2000);
      const mpv = await playing(page);
      await showControls(page);
      const capture = await shot(ctx, `lecteur-${label}`, { composite: true });
      const buttons = await page.evaluate(`return [...document.querySelectorAll("button[aria-label]")].map((b) => b.getAttribute("aria-label")).filter(Boolean);`);
      const windows = windowsOf(STATE, ctx.app.pid).filter((w) => w.onscreen);
      // La marge EDR de l'ÉCRAN : sans elle (écran SDR, HDR de macOS coupé),
      // une sortie SDR est juste, et le HDR n'est pas vérifiable.
      const probe = await page.evaluate(`try { return await window.tentacle.invoke("video_surface_probe"); } catch (e) { return String(e); }`);
      return { mpv, capture, buttons, windows, edr: probe?.edr ?? null, dom: await glassDom(page) };
    });
    if (label === "hdr") {
      await step(ctx, "lecteur-hdr-plein-ecran", async () => {
        await page.evaluate(`await window.tentacle.invoke("toggle_fullscreen"); return true;`);
        await sleep(2500);
        const probe = await page.evaluate(`try { return await window.tentacle.invoke("video_surface_probe"); } catch (e) { return String(e); }`);
        const target = await mpvProperty(page, "video-target-params");
        await page.evaluate(`await window.tentacle.invoke("toggle_fullscreen"); return true;`);
        await sleep(2500);
        return { probe, "video-target-params": target };
      });
      await step(ctx, "lecteur-hdr-pip", async () => {
        await showControls(page);
        const at = await centerOf(page, "button[aria-label]", "incrustation|image dans l|picture");
        if (!at) throw new Error("bouton PiP introuvable");
        await clickAt(page, at.x, at.y);
        await sleep(2500);
        const windows = windowsOf(STATE, ctx.app.pid).filter((w) => w.onscreen && w.layer >= 0);
        const pip = windows.filter((w) => w.width < 900 && w.width > 150).sort((a, b) => a.width - b.width)[0];
        const capture = pip ? path.basename(captureRect(pip, path.join(ctx.out, `${ctx.cell}-pip.png`))) : null;
        const target = await mpvProperty(page, "video-target-params");
        const native = await nativeSnapshot(ctx.app);
        // Retour au lecteur par le VRAI bouton de la fenêtre PiP (une cible
        // CDP à part : la page l'ouvre par window.open) — sinon la lecture
        // suivante partirait dans le PiP, par conception.
        const back = await pipButton("revenir au lecteur");
        await sleep(2500);
        const afterBack = { "video-target-params": await mpvProperty(page, "video-target-params"), native: await nativeSnapshot(ctx.app) };
        return { windows, capture, "video-target-params": target, pipNative: native, back, afterBack };
      });
    }
    await leavePlayer(page);
  }
  await step(ctx, "lecteur-episodes", async () => {
    await go(page, `/watch/${await itemId("Épisode 1", "Episode")}`, 2000);
    await playing(page);
    await showControls(page);
    const at = await centerOf(page, "button[aria-label]", "épisodes|episodes");
    if (!at) throw new Error("bouton Épisodes introuvable");
    await clickAt(page, at.x, at.y);
    await sleep(1200);
    return { capture: await shot(ctx, "lecteur-episodes", { composite: true }) };
  });
  await leavePlayer(page);
}

export async function admin(ctx) {
  const { page } = ctx.app;
  for (const route of ["/admin", "/admin/users", "/settings/appearance"]) {
    await step(ctx, `admin${route.replaceAll("/", "-")}`, async () => {
      await go(page, route, 2500);
      return { dom: await glassDom(page), capture: await shot(ctx, `admin${route.replaceAll("/", "-")}`) };
    });
  }
}
