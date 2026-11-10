/**
 * Les vues que `capture.mjs` prend : un nom, comment ouvrir la page, et ce qu'on y fait avant
 * la capture. Chacune est prise en sombre et en clair, à 1440 et à 1024 px.
 */

const settle = (page, ms = 500) => page.waitForTimeout(ms);
const BAR = { x: 0, y: 0, height: 84 };

export const SHOTS = [
  {
    name: "repos",
    async run(page, { file }) {
      await page.screenshot({ path: file() });
      await page.screenshot({ path: file("-page"), fullPage: true });
    },
  },
  {
    // Le halo suit l'image : trois diapositives, par la flèche « Suivant ».
    name: "banniere",
    async run(page, { file }) {
      await page.screenshot({ path: file("-1") });
      for (const index of [2, 3]) {
        await page.locator("[data-hero-frame] button[data-hero-step='next']").click();
        await settle(page, 1900);
        await page.screenshot({ path: file(`-${index}`) });
      }
    },
  },
  {
    name: "barre-3",
    open: { libs: 3, route: "/dev/accueil?vue=etats" },
    async run(page, { file, width }) {
      await page.screenshot({ path: file(), clip: { ...BAR, width } });
    },
  },
  {
    name: "barre-20",
    open: { libs: 20, route: "/dev/accueil?vue=etats" },
    async run(page, { file, width }) {
      await page.screenshot({ path: file(), clip: { ...BAR, width } });
      await page.locator("[data-top-nav] button[aria-haspopup='dialog']").first().click();
      await settle(page);
      await page.screenshot({ path: file("-plus") });
    },
  },
  {
    name: "plus",
    open: { route: "/dev/accueil?vue=etats" },
    async run(page, { file }) {
      await page.locator("[data-top-nav] button[aria-haspopup='dialog']").first().click();
      await settle(page);
      await page.screenshot({ path: file() });
      await page.locator("[data-nav-customize]").click();
      await settle(page);
      await page.screenshot({ path: file("-personnaliser") });
    },
  },
  {
    name: "menu-compte",
    open: { route: "/dev/accueil?vue=etats" },
    async run(page, { file }) {
      await page.locator("[data-top-nav] [data-account-trigger]").click();
      await settle(page);
      await page.screenshot({ path: file() });
    },
  },
  {
    name: "cloche",
    open: { route: "/dev/accueil?vue=etats" },
    async run(page, { file }) {
      await page.locator("[data-top-nav] button[aria-haspopup='dialog']").last().click();
      await settle(page);
      await page.screenshot({ path: file() });
    },
  },
  {
    // La proposition « Hors ligne / Réglages dans la barre » : deux maquettes à comparer.
    name: "barre-proposition",
    open: { route: "/dev/accueil?vue=barre" },
    widths: [1440],
    async run(page, { file }) {
      const box = await page.locator("[data-lab-view='barre']").boundingBox();
      await page.screenshot({ path: file(), clip: box });
    },
  },
  {
    name: "omnibox",
    async run(page, { file }) {
      await page.keyboard.press("Control+k");
      await settle(page);
      await page.screenshot({ path: file("-vide") });
      await page.keyboard.type("s");
      await settle(page, 900);
      await page.screenshot({ path: file("-resultats") });
    },
  },
  {
    name: "cartes",
    open: { route: "/dev/accueil?vue=cartes", height: 1300 },
    async run(page, { file }) {
      await page.screenshot({ path: file("-repos"), fullPage: true });
      for (const kind of ["affiche", "vignette", "reco"]) {
        const card = page.locator(`[data-lab-cards='${kind}'] [data-card-visual]`).nth(1);
        await card.scrollIntoViewIfNeeded();
        await card.hover();
        await settle(page, 700);
        const box = await page.locator(`[data-lab-cards='${kind}']`).boundingBox();
        await page.screenshot({ path: file(`-survol-${kind}`), clip: box });
      }
    },
  },
  {
    // La feuille de la carte au bureau : son menu contextuel (clic droit). Vue à part — un
    // défilement le referme, et les survols de la vue « cartes » font défiler.
    name: "carte-menu",
    open: { route: "/dev/accueil?vue=cartes" },
    async run(page, { file }) {
      await page.locator("[data-lab-cards='affiche'] [data-card-visual]").nth(2).click({ button: "right" });
      await settle(page);
      await page.screenshot({ path: file(), clip: { x: 0, y: 0, width: 1024, height: 620 } });
    },
  },
  {
    name: "rangees",
    open: { route: "/dev/accueil?vue=rangees" },
    async run(page, { file }) {
      await page.locator("section[role='region']").nth(1).hover();
      await settle(page);
      await page.screenshot({ path: file() });
    },
  },
  {
    name: "avis",
    open: { route: "/dev/accueil?vue=avis" },
    async run(page, { file }) {
      for (const label of ["Avis de réussite", "Avis d'échec", "Avis d'information"]) await page.getByRole("button", { name: label }).click();
      await settle(page);
      await page.screenshot({ path: file() });
    },
  },
  {
    name: "etats",
    open: { route: "/dev/accueil?vue=etats" },
    async run(page, { file }) {
      await page.screenshot({ path: file(), fullPage: true });
    },
  },
  {
    name: "etat-chargement",
    open: { etat: "slow" },
    widths: [1440],
    async run(page, { file }) {
      await page.screenshot({ path: file() });
    },
  },
  {
    name: "etat-erreur",
    open: { etat: "error" },
    widths: [1440],
    async run(page, { file }) {
      await settle(page, 1200);
      await page.screenshot({ path: file() });
    },
  },
  {
    name: "etat-vide",
    open: { etat: "empty" },
    widths: [1440],
    async run(page, { file }) {
      await settle(page, 800);
      await page.screenshot({ path: file() });
    },
  },
];
