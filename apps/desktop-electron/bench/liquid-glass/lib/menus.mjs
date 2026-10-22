// Menus et feuilles sur un dessous MIXTE (accueil, héros détaillé) : menu de
// l'avatar et menu « Plus » de la barre (lg-tokens : ton par bande, voile
// minimal). Ouverts par un vrai clic au centre de leur déclencheur.
import { dismissOverlays, glassDom, go, sleep } from "./app.mjs";
import { centerOf, clickAt, mouseTo, shot, step } from "./steps.mjs";

const TRIGGERS = [
  ["avatar", '.lgc-capsule button[aria-haspopup="menu"]', null],
  ["plus", '.lgc-capsule button[aria-haspopup="dialog"]', "Plus"],
];

async function escape(page) {
  for (const type of ["keyDown", "keyUp"]) {
    await page.send("Input.dispatchKeyEvent", { type, key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  }
}

export async function menus(ctx) {
  const { page } = ctx.app;
  await go(page, "/", 2500);
  await dismissOverlays(page);
  for (const [name, selector, pattern] of TRIGGERS) {
    await step(ctx, `menu-${name}`, async () => {
      const at = await centerOf(page, selector, pattern);
      if (!at) throw new Error(`déclencheur introuvable : ${selector}`);
      await clickAt(page, at.x, at.y);
      await sleep(900);
      const open = await page.evaluate(`return [...document.querySelectorAll('[role="menu"], .lg-menu, [role="dialog"]')]
        .filter((m) => { const r = m.getBoundingClientRect(); return r.width > 40 && r.height > 40; })
        .map((m) => { const r = m.getBoundingClientRect(); return { cls: String(m.className).slice(0, 60), w: Math.round(r.width), h: Math.round(r.height), inside: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight }; });`);
      const dom = await glassDom(page);
      const capture = await shot(ctx, `menu-${name}`);
      await escape(page);
      await mouseTo(page, 5, 5);
      await sleep(500);
      if (open.length === 0) throw new Error("aucun menu ouvert après le clic");
      return { open, dom, capture };
    });
  }
}
