// Le mode HORS LIGNE du bureau, en verre (lg-composants) : garder un titre par
// le vrai dialogue, la progression, la bascule (message temporaire), le
// catalogue, la fiche hors ligne, le dialogue de suppression, la lecture locale.
// Libellés FR : `downloads.ts`, `errors.ts` (relevé du 21/10).
import { dismissOverlays, glassDom, go, mpvProperty, sleep } from "./app.mjs";
import { itemId } from "./config.mjs";
import { centerOf, clickAt, leavePlayer, nativeSnapshot, playing, shot, showControls, step } from "./steps.mjs";

const TITLE = "Banc SDR";

async function clickSelector(page, selector, pattern = null) {
  const at = await centerOf(page, selector, pattern);
  if (!at) throw new Error(`introuvable : ${selector}${pattern ? ` /${pattern}/` : ""}`);
  await clickAt(page, at.x, at.y);
}

async function setNetwork(page, offline) {
  await page.send("Network.enable");
  await page.send("Network.emulateNetworkConditions", {
    offline,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
}

export async function offline(ctx) {
  const { page } = ctx.app;
  const id = await itemId(TITLE, "Movie");
  // Les fenêtres du démarrage (nouveautés, photo) recouvrent tout : les fermer.
  await go(page, "/", 2500);
  await dismissOverlays(page);
  await step(ctx, "hl-dialogue-garder", async () => {
    await go(page, `/media/${id}`, 3000);
    await clickSelector(page, "button[aria-label]", "^Télécharger$");
    await page.waitFor(`document.querySelector('[role="dialog"][aria-modal="true"]')`, 10_000, "dialogue de téléchargement");
    await sleep(800);
    return { dom: await glassDom(page), capture: await shot(ctx, "hl-dialogue-garder") };
  });
  await step(ctx, "hl-progression", async () => {
    await clickSelector(page, '[role="dialog"] button', "^Lancer le téléchargement$");
    await sleep(1500);
    await go(page, "/downloads", 2000);
    const capture = await shot(ctx, "hl-progression");
    // Le titre doit être COMPLET pour la lecture locale (40 s de clip).
    await page.waitFor(`document.querySelector('button[aria-label="Lecture locale"]')`, 180_000, "transfert terminé");
    return { capture, done: await shot(ctx, "hl-progression-fin") };
  });
  await step(ctx, "hl-bascule", async () => {
    await go(page, "/", 2000);
    await setNetwork(page, true);
    await page.waitFor(`document.querySelector('div[aria-live="polite"] .lg-notice')`, 20_000, "message de passage hors ligne");
    await sleep(700);
    const text = await page.evaluate(`return document.querySelector('div[aria-live="polite"] .lg-notice')?.innerText ?? "";`);
    return { text, dom: await glassDom(page), capture: await shot(ctx, "hl-bascule") };
  });
  await step(ctx, "hl-catalogue", async () => {
    await sleep(10_500); // le message s'efface (CONNECTIVITY_NOTICE_MS)
    return { dom: await glassDom(page), capture: await shot(ctx, "hl-catalogue") };
  });
  await step(ctx, "hl-fiche", async () => {
    await go(page, `/offline/item/${id}`, 2500);
    return { dom: await glassDom(page), capture: await shot(ctx, "hl-fiche") };
  });
  await step(ctx, "hl-dialogue-suppression", async () => {
    await clickSelector(page, "button[aria-label]", "^Supprimer (de cette machine|ce téléchargement)$");
    await page.waitFor(`document.querySelector('[role="alertdialog"]')`, 10_000, "dialogue de suppression");
    await sleep(800);
    const dom = await glassDom(page);
    const capture = await shot(ctx, "hl-dialogue-suppression");
    // On GARDE le titre : la lecture locale suit.
    await clickSelector(page, '[role="alertdialog"] button', "^Annuler$");
    await sleep(600);
    return { capture, dom };
  });
  await step(ctx, "hl-lecture-locale", async () => {
    await go(page, `/watch/${id}`, 2500);
    const mpv = await playing(page);
    await showControls(page);
    const capture = await shot(ctx, "hl-lecture-locale");
    const path = await mpvProperty(page, "path");
    return { mpv: { ...mpv, path }, capture, native: await nativeSnapshot(ctx.app) };
  });
  await leavePlayer(page);
  await setNetwork(page, false);
}
