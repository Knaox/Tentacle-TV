// Les nouveautés 1.40.0 : visibles sur macOS 26 seulement. En dev, la version
// de l'app reste celle de versions.json (le bump est fait par la CI) : la porte
// réelle ne s'ouvre pas sur 1.40.0. Le banc prouve donc séparément :
//  - le RENDU des scènes, par le crochet de dev `__tentacleShowWhatsNew` ;
//  - les TRAITS que le filtre `forClient` lit (`clientTraits.ts`) : liquidGlass =
//    pont présent et supporté, liquidGlassPlayer = refractsVideo.
import { dismissOverlays, go, sleep } from "./app.mjs";
import { shot, step } from "./steps.mjs";

export async function whatsNew(ctx) {
  const { page } = ctx.app;
  await step(ctx, "nouveautes-1-40-0", async () => {
    await go(page, "/", 2500);
    await dismissOverlays(page);
    const traits = await page.evaluate(`
      const b = window.tentacle?.liquidGlass;
      const glass = window.tentacle?.platform === "darwin" && b?.supported === true;
      return { liquidGlass: glass, liquidGlassPlayer: glass && b.refractsVideo === true };
    `);
    if (!traits.liquidGlass) return { traits, shown: false };
    const hook = await page.evaluate(`return typeof window.__tentacleShowWhatsNew === "function";`);
    if (!hook) return { traits, hook };
    await page.evaluate(`window.__tentacleShowWhatsNew("1.40.0"); return true;`);
    await sleep(2500);
    const text = await page.evaluate(`return [...document.querySelectorAll('[role="dialog"]')].map((d) => d.innerText).join(" | ").slice(0, 400);`);
    const capture = await shot(ctx, "nouveautes-1-40-0");
    await dismissOverlays(page);
    return { traits, hook, text, capture, shown: /Liquid Glass/.test(text) };
  });
}
