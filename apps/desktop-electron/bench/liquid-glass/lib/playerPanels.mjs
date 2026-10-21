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
    // La coupure passe ici par le PONT (le réglage de la page n'a pas de porte
    // de banc) : elle prouve le retrait natif et le HDR, pas le rendu de la page.
    const has = await page.evaluate(`return !!window.tentacle?.liquidGlass;`);
    if (!has) return { absent: true };
    await showControls(page);
    await page.evaluate(`window.tentacle.liquidGlass.setEnabled(false); return true;`);
    await sleep(1500);
    const off = await nativeSnapshot(ctx.app);
    const offTarget = await mpvProperty(page, "video-target-params");
    const capture = await shot(ctx, `lecteur-${label}-coupure`);
    await page.evaluate(`window.tentacle.liquidGlass.setEnabled(true); return true;`);
    await sleep(1500);
    const on = await nativeSnapshot(ctx.app);
    return { capture, offViews: off?.nativeViews, onViews: on?.nativeViews, "video-target-params": offTarget };
  });
}
