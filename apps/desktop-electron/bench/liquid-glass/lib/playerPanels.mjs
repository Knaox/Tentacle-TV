// Le lecteur en verre, geste par geste (lecture en cours) : contrôles masqués,
// chaque panneau ouvert par son bouton, coupure du verre en pleine lecture.
import { mpvProperty, sleep } from "./app.mjs";
import { centerOf, clickAt, mouseTo, nativeSnapshot, shot, showControls, step } from "./steps.mjs";

// Libellés FR des boutons (i18n `player`) : un bouton absent n'est pas une
// erreur du banc, il est consigné (le lecteur peut regrouper ses panneaux).
const PANELS = [
  ["parametres", "^Paramètres$"],
  ["vitesse", "^Vitesse de lecture$"],
  ["pistes", "^Pistes$"],
  ["sous-titres", "^Sous-titres$"],
  ["audio", "^Audio$"],
];

const visibleNative = (snap) => (snap?.regions ?? []).filter((r) => !r.hidden).length;

export async function playerPanels(ctx, label) {
  const { page } = ctx.app;
  await step(ctx, `lecteur-${label}-masque`, async () => {
    await showControls(page);
    // Pointeur immobile hors des contrôles : ils doivent se retirer, et leurs
    // régions natives avec (« ce qui n'est pas affiché ne consomme rien »).
    await mouseTo(page, 30, 200);
    await sleep(6000);
    const native = await nativeSnapshot(ctx.app);
    return { capture: await shot(ctx, `lecteur-${label}-masque`), visibleRegions: visibleNative(native) };
  });
  for (const [slug, pattern] of PANELS) {
    await step(ctx, `lecteur-${label}-panneau-${slug}`, async () => {
      await showControls(page);
      const at = await centerOf(page, "button[aria-label]", pattern);
      if (!at) return { absent: true };
      await clickAt(page, at.x, at.y);
      await sleep(1000);
      const capture = await shot(ctx, `lecteur-${label}-panneau-${slug}`);
      const native = await nativeSnapshot(ctx.app);
      // Refermer par le même bouton (Échap pourrait quitter le lecteur).
      await showControls(page);
      const again = await centerOf(page, "button[aria-label]", pattern);
      if (again) await clickAt(page, again.x, again.y);
      await sleep(600);
      return { capture, visibleRegions: visibleNative(native) };
    });
  }
  await step(ctx, `lecteur-${label}-coupure`, async () => {
    // Coupure du RÉGLAGE en pleine lecture : par le crochet de banc de
    // lg-lecteur (le vrai chemin de la page) s'il existe, sinon par le pont —
    // qui prouve le retrait natif mais ne prévient pas la page.
    const via = await page.evaluate(`return window.__tentaclePlayerGlass?.setLiquidGlass ? "page" : window.tentacle?.liquidGlass ? "pont" : null;`);
    if (!via) return { absent: true };
    // Seulement verre ALLUMÉ : couper puis rallumer dans une cellule coupée
    // allumerait le réglage pour toute la suite (artefact du 21/10).
    const mode = await page.evaluate(`return document.documentElement.getAttribute("data-liquid-glass");`);
    if (mode !== "native") return { absent: true, mode };
    const set = (on) => via === "page"
      ? `window.__tentaclePlayerGlass.setLiquidGlass(${on}); return true;`
      : `window.tentacle.liquidGlass.setEnabled(${on}); return true;`;
    await showControls(page);
    await page.evaluate(set(false));
    await sleep(1500);
    const off = await nativeSnapshot(ctx.app);
    const offTarget = await mpvProperty(page, "video-target-params");
    const capture = await shot(ctx, `lecteur-${label}-coupure`);
    await page.evaluate(set(true));
    await showControls(page);
    await sleep(1500);
    const on = await nativeSnapshot(ctx.app);
    const onCapture = await shot(ctx, `lecteur-${label}-rallumage`);
    return { via, capture, onCapture, offViews: off?.nativeViews, onViews: on?.nativeViews, "video-target-params": offTarget };
  });
}
