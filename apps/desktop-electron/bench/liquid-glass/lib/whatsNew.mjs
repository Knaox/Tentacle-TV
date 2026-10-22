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
    // Les scènes peignent la vraie primitive sous le `scale` du canevas : on
    // relève ce qui DÉBORDE de la scène (lentille, reflet) et on capture les deux.
    const overflow = () => page.evaluate(`
      const d = [...document.querySelectorAll('[role="dialog"]')].at(-1);
      if (!d) return null;
      const box = d.getBoundingClientRect();
      const out = [...d.querySelectorAll(".lg-surface, [data-lg-render]")].filter((n) => {
        const r = n.getBoundingClientRect();
        return r.width > 0 && (r.left < box.left - 1 || r.top < box.top - 1 || r.right > box.right + 1 || r.bottom > box.bottom + 1);
      }).map((n) => String(n.className).slice(0, 50));
      return { surfaces: d.querySelectorAll(".lg-surface, [data-lg-render]").length, overflow: out };
    `);
    const scene1 = await overflow();
    const next = await page.evaluate(`
      const b = [...document.querySelectorAll('[role="dialog"] button')].find((x) => /^(Suivant|Next)$/.test(x.textContent.trim()));
      if (!b) return false;
      b.click();
      return true;
    `);
    await sleep(2500);
    const scene2 = next ? await overflow() : null;
    const capture2 = next ? await shot(ctx, "nouveautes-1-40-0-scene2") : null;
    await dismissOverlays(page);
    return { traits, hook, text, capture, capture2, scene1, scene2, shown: /Liquid Glass/.test(text) };
  });
}
