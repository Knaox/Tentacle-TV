// Banc de fluidité (lot lg5) : les GESTES mesurés. Chaque scénario a une mise
// en place (`prep`, hors mesure) et un geste (`run`, dans la fenêtre mesurée).
// `cadenceMs` : la cadence ATTENDUE quand elle n'est pas celle de l'écran — le
// travelling du héros est bridé à 30 paliers par seconde (`heroMotion.css`) :
// un intervalle de 33 ms y est voulu, pas une image manquée.
import { dismissOverlays, go, sleep } from "../lib/app.mjs";
import { itemId } from "../lib/config.mjs";
import { waitHidIdle } from "../lib/macos.mjs";
import { centerOf, clickAt, mouseTo, playing, showControls } from "../lib/steps.mjs";

const AMBIENT_MS = 1000 / 30;

async function escape(page) {
  for (const type of ["keyDown", "keyUp"]) {
    await page.send("Input.dispatchKeyEvent", { type, key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  }
}

async function home(page, scrollY = 0) {
  await go(page, "/", 2500);
  await dismissOverlays(page);
  await page.evaluate(`(document.querySelector("main")?.scrollHeight > innerHeight ? document.querySelector("main") : document.scrollingElement).scrollTo(0, ${scrollY}); return 1;`);
  await mouseTo(page, 5, 5);
  await sleep(1500);
}

const viewport = (page) => page.evaluate(`return { w: innerWidth, h: innerHeight };`);

/** Défilement « à la molette » par le compositeur (geste synthétique de Chromium). */
async function wheel(page, x, y, distance, speed = 1600) {
  await page.send("Input.synthesizeScrollGesture", {
    x, y, yDistance: -distance, speed, gestureSourceType: "mouse", preventFling: true,
  });
}

/** Le pointeur glisse d'un point à l'autre, un pas toutes les 8 ms (ProMotion). */
async function glide(page, from, to, ms) {
  const steps = Math.max(2, Math.round(ms / 8));
  for (let i = 1; i <= steps; i += 1) {
    await mouseTo(page, from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps);
    await sleep(8);
  }
}

export const SCENARIOS = [
  {
    name: "repos-accueil",
    cadenceMs: AMBIENT_MS,
    prep: (page) => home(page),
    run: () => sleep(8000),
  },
  {
    name: "defilement-accueil",
    prep: (page) => home(page),
    run: async (page) => {
      const { w, h } = await viewport(page);
      await wheel(page, w / 2, h * 0.6, 1800);
      await sleep(300);
      await wheel(page, w / 2, h * 0.6, -1800);
      await sleep(300);
    },
  },
  {
    name: "rotation-heros",
    cadenceMs: AMBIENT_MS,
    prep: (page) => home(page),
    // Une diapositive dure 8 s : la fenêtre en contient au moins un changement.
    run: () => sleep(10_000),
  },
  {
    name: "menus",
    prep: (page) => home(page),
    run: async (page) => {
      for (const [selector, pattern] of [['.lgc-capsule button[aria-haspopup="menu"]', null], ['.lgc-capsule button[aria-haspopup="dialog"]', "Plus"]]) {
        for (let i = 0; i < 3; i += 1) {
          const at = await centerOf(page, selector, pattern);
          if (!at) throw new Error(`déclencheur introuvable : ${selector}`);
          await page.evaluate(`performance.mark("lg5:open"); return 1;`);
          await clickAt(page, at.x, at.y);
          await sleep(800);
          await page.evaluate(`performance.mark("lg5:close"); return 1;`);
          await escape(page);
          await sleep(700);
        }
      }
    },
  },
  {
    // Le menu « Plus » seul, quatre fois.
    name: "menu-plus",
    prep: (page) => home(page),
    run: async (page) => {
      for (let i = 0; i < 4; i += 1) {
        const at = await centerOf(page, '.lgc-capsule button[aria-haspopup="dialog"]', "Plus");
        if (!at) throw new Error("déclencheur « Plus » introuvable");
        await page.evaluate(`performance.mark("lg5:open"); return 1;`);
        await clickAt(page, at.x, at.y);
        await sleep(800);
        await escape(page);
        await sleep(700);
      }
    },
  },
  {
    // Les mêmes menus sur une page SANS héros (aucun dessous qui bouge).
    name: "menus-statique",
    prep: async (page) => {
      await go(page, "/settings/appearance", 2000);
      await mouseTo(page, 5, 5);
      await sleep(1000);
    },
    run: (page) => SCENARIOS.find((s) => s.name === "menus").run(page),
  },
  {
    name: "survol-cartes",
    prep: (page) => home(page, 0),
    run: async (page) => {
      // Les cartes des rangées (affiche ou vignette), entières à l'écran, sous le héros.
      const cards = await page.evaluate(`const seen = new Set(); return [...document.querySelectorAll('a[href*="/media/"], [data-card]')]
        .map((n) => n.getBoundingClientRect()).filter((r) => r.width >= 100 && r.height >= 60 && r.top > 200 && r.bottom < innerHeight - 4 && r.left >= 0 && r.right <= innerWidth)
        .filter((r) => { const k = Math.round(r.x) + ":" + Math.round(r.y); if (seen.has(k)) return false; seen.add(k); return true; })
        .slice(0, 8).map((r) => ({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }));`);
      if (cards.length < 2) throw new Error("pas assez de cartes visibles");
      let at = { x: 5, y: 5 };
      // 400 ms par carte : sous le délai de l'aperçu (800 ms), aucun lecteur ne naît.
      for (const card of cards) {
        await glide(page, at, card, 160);
        await sleep(400);
        at = card;
      }
      await glide(page, at, { x: 5, y: 5 }, 160);
    },
  },
  {
    name: "repos-fiche",
    prep: async (page) => {
      await go(page, `/media/${await itemId("Banc SDR")}`, 3000);
      await mouseTo(page, 5, 5);
      await sleep(1500);
    },
    run: () => sleep(6000),
  },
  {
    // La même fiche, une fois son travelling (8 s) fini : plus rien ne doit bouger.
    name: "repos-fiche-tard",
    prep: async (page) => {
      await go(page, `/media/${await itemId("Banc SDR")}`, 3000);
      await mouseTo(page, 5, 5);
      await sleep(9000);
    },
    run: () => sleep(5000),
  },
  {
    name: "defilement-fiche",
    prep: async (page) => {
      await go(page, `/media/${await itemId("Écume", "Series")}`, 3000);
      await mouseTo(page, 5, 5);
      await sleep(1500);
    },
    run: async (page) => {
      const { w, h } = await viewport(page);
      await wheel(page, w / 2, h * 0.6, 1200);
      await sleep(300);
      await wheel(page, w / 2, h * 0.6, -1200);
      await sleep(300);
    },
  },
  {
    name: "navigation",
    prep: (page) => home(page),
    run: async (page) => {
      const media = await itemId("Banc SDR");
      for (const route of ["/favorites", "/watchlist", `/media/${media}`, "/settings/appearance", "/"]) await go(page, route, 1400);
    },
  },
  {
    name: "reglages",
    prep: async (page) => {
      await go(page, "/settings/appearance", 2000);
      await mouseTo(page, 5, 5);
    },
    run: async (page) => {
      const { w, h } = await viewport(page);
      for (const route of ["/settings/playback", "/settings/personalization", "/settings/appearance"]) await go(page, route, 1200);
      await wheel(page, w * 0.65, h * 0.6, 900);
      await sleep(300);
      await wheel(page, w * 0.65, h * 0.6, -900);
      await sleep(300);
    },
  },
  {
    name: "admin",
    account: "admin",
    prep: async (page) => {
      await go(page, "/admin", 2500);
      await mouseTo(page, 5, 5);
    },
    run: async (page) => {
      const { w, h } = await viewport(page);
      for (const route of ["/admin/users", "/admin/services", "/admin/plugins", "/admin"]) await go(page, route, 1300);
      await wheel(page, w * 0.65, h * 0.6, 900);
      await sleep(300);
      await wheel(page, w * 0.65, h * 0.6, -900);
    },
  },
  {
    name: "lecteur-controles",
    player: true,
    prep: async (page) => {
      // Une lecture peut rendre l'app active : jamais sous les doigts de Damien.
      if (!(await waitHidIdle(120, 15 * 60_000))) throw new Error("Damien actif : lecteur reporté");
      await go(page, `/watch/${await itemId("Banc SDR", "Movie")}`, 2000);
      await playing(page);
    },
    run: async (page) => {
      const { w, h } = await showControls(page);
      // Le pointeur bouge sans cesse : les contrôles restent montrés.
      for (let i = 0; i < 12; i += 1) {
        await glide(page, { x: w / 2 - 80, y: h / 2 }, { x: w / 2 + 80, y: h / 2 + 30 }, 250);
        await glide(page, { x: w / 2 + 80, y: h / 2 + 30 }, { x: w / 2 - 80, y: h / 2 }, 250);
      }
    },
  },
  {
    name: "lecteur-masques",
    player: true,
    cadenceMs: null,
    prep: async (page) => {
      await mouseTo(page, 5, 5);
      await sleep(5000);
    },
    run: () => sleep(6000),
  },
];
