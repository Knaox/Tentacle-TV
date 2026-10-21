// Les écrans que la matrice parcourt. Chaque scénario capture et relève dans
// `ctx.report.steps` ; une erreur d'un scénario est consignée, les suivants
// continuent (une recette dit TOUT ce qui casse, pas seulement le premier).
import path from "node:path";
import { dismissOverlays, glassDom, glassToggle, go, mpvProperty, sleep } from "./app.mjs";
import { itemId, STATE } from "./config.mjs";
import { captureWindow, gpuWindow, loadAverage, windowsOf } from "./macos.mjs";
import { playerPanels } from "./playerPanels.mjs";
import { nativeSnapshot, shot, damienAway, mouseTo, clickAt, centerOf, pipButton, step, playing, showControls, leavePlayer } from "./steps.mjs";

export async function screens(ctx) {
  const { page } = ctx.app;
  await step(ctx, "accueil", async () => {
    await go(page, "/", 2500);
    await dismissOverlays(page);
    await sleep(1000);
    return { dom: await glassDom(page), capture: await shot(ctx, "accueil") };
  });
  await step(ctx, "accueil-defile-300", async () => {
    await mouseTo(page, 5, 5);
    await page.evaluate(`(document.scrollingElement ?? document.body).scrollTo(0, 300); return true;`);
    await sleep(1200);
    return { dom: await glassDom(page), capture: await shot(ctx, "accueil-defile-300") };
  });
  await step(ctx, "accueil-defile", async () => {
    await mouseTo(page, 5, 5);
    await page.evaluate(`(document.scrollingElement ?? document.body).scrollTo(0, 900); return true;`);
    await sleep(1200);
    return { dom: await glassDom(page), capture: await shot(ctx, "accueil-defile") };
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
  await step(ctx, "reglages-lecture", async () => {
    await go(page, "/settings/playback", 2000);
    return { dom: await glassDom(page), capture: await shot(ctx, "reglages-lecture") };
  });
  await step(ctx, "gpu-repos-defile", async () => {
    await go(page, "/", 2500);
    await mouseTo(page, 5, 5);
    await page.evaluate(`(document.scrollingElement ?? document.body).scrollTo(0, 900); return true;`);
    await sleep(3000);
    return { load: loadAverage(), gpu: await gpuWindow(30) };
  });
  await step(ctx, "gpu-repos-accueil", async () => {
    await go(page, "/", 2500);
    await mouseTo(page, 5, 5);
    await sleep(3000);
    return { load: loadAverage(), gpu: await gpuWindow(30) };
  });
}

export async function player(ctx) {
  const { page } = ctx.app;
  for (const [label, title, type] of [["sdr", "Banc SDR", "Movie"], ["hdr", "Banc HDR10", "Movie"]]) {
    await step(ctx, `lecteur-${label}`, async () => {
      await go(page, `/watch/${await itemId(title, type)}`, 2000);
      const mpv = await playing(page);
      await showControls(page);
      const capture = await shot(ctx, `lecteur-${label}`);
      const buttons = await page.evaluate(`return [...document.querySelectorAll("button[aria-label]")].map((b) => b.getAttribute("aria-label")).filter(Boolean);`);
      const windows = windowsOf(STATE, ctx.app.pid).filter((w) => w.onscreen);
      // La marge EDR de l'ÉCRAN : sans elle (écran SDR, HDR de macOS coupé),
      // une sortie SDR est juste, et le HDR n'est pas vérifiable.
      const probe = await page.evaluate(`try { return await window.tentacle.invoke("video_surface_probe"); } catch (e) { return String(e); }`);
      return { mpv, capture, buttons, windows, edr: probe?.edr ?? null, dom: await glassDom(page) };
    });
    if (ctx.report.steps.at(-1)?.ok) await playerPanels(ctx, label);
    if (label === "hdr") {
      await step(ctx, "lecteur-hdr-plein-ecran", async () => {
        if (!damienAway()) return { skipped: "Damien actif : pas de changement d'espace" };
        await page.evaluate(`await window.tentacle.invoke("toggle_fullscreen"); return true;`);
        await sleep(2500);
        const probe = await page.evaluate(`try { return await window.tentacle.invoke("video_surface_probe"); } catch (e) { return String(e); }`);
        const target = await mpvProperty(page, "video-target-params");
        await showControls(page);
        const during = await nativeSnapshot(ctx.app);
        await page.evaluate(`await window.tentacle.invoke("toggle_fullscreen"); return true;`);
        await sleep(2500);
        return { probe, "video-target-params": target, duringViews: during?.nativeViews, duringVisible: (during?.regions ?? []).filter((r) => !r.hidden).length };
      });
      await step(ctx, "lecteur-hdr-pip", async () => {
        if (!damienAway()) return { skipped: "Damien actif : pas de fenêtre PiP" };
        await showControls(page);
        const at = await centerOf(page, "button[aria-label]", "incrustation|image dans l|picture");
        if (!at) throw new Error("bouton PiP introuvable");
        await clickAt(page, at.x, at.y);
        await sleep(2500);
        const windows = windowsOf(STATE, ctx.app.pid).filter((w) => w.onscreen && w.layer >= 0);
        const pip = windows.filter((w) => w.width < 900 && w.width > 150).sort((a, b) => a.width - b.width)[0];
        const capture = pip ? path.basename(captureWindow(pip.id, path.join(ctx.out, `${ctx.cell}-pip.png`))) : null;
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
    return { capture: await shot(ctx, "lecteur-episodes") };
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
