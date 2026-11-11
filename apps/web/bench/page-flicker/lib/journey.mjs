/**
 * Le PARCOURS du banc : accueil ↔ bibliothèque ↔ fiche ↔ « Pour vous » ↔ Ma liste ↔ réglages ↔
 * recherche — par de vrais clics là où l'écran offre une cible, par l'historique ailleurs.
 * Chaque étape dit son geste et ce qui prouve l'arrivée.
 */

const centre = (box) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });

/**
 * Un geste au pointeur, en deux temps : `aim` pose le pointeur sur la cible AVANT la capture (le
 * survol qu'il déclenche — une carte qui grossit, son plateau — fait partie de l'état de départ,
 * pas de la transition), `gesture` clique là où il est.
 */
const pointer = (locate) => {
  let at = null;
  return {
    aim: async (page) => {
      at = await locate(page);
      await page.mouse.move(at.x, at.y);
    },
    gesture: async (page) => {
      if (!at) at = await locate(page);
      await page.mouse.click(at.x, at.y);
      at = null;
    },
  };
};

/** Le premier élément visible qui porte ce texte. */
const byText = (selector, text) => pointer(async (page) => {
  const box = await page.locator(selector, { hasText: text }).first().boundingBox({ timeout: 5000 });
  if (!box) throw new Error(`cible absente : ${selector} « ${text} »`);
  return centre(box);
});

/** Le premier lien de la barre dont l'adresse convient (un onglet de bibliothèque). */
const byHref = (pattern) => pointer(async (page) => {
  const at = await page.evaluate((source) => {
    const link = [...document.querySelectorAll("header a[href]")].find((a) => new RegExp(source).test(a.getAttribute("href") ?? ""));
    if (!link) return null;
    const box = link.getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  }, pattern.source);
  if (!at) throw new Error(`aucun lien de la barre vers ${pattern}`);
  return at;
});

/**
 * Une AFFICHE entièrement à l'écran, image peinte. Une affiche (plus haute que large) ouvre la
 * fiche ; une vignette 16:9 lance la lecture — ce n'est pas le geste mesuré ici.
 */
const aCard = () => pointer(async (page) => {
  const at = await page.evaluate(() => {
    const cards = [...document.querySelectorAll("[data-card-visual]")].filter((card) => {
      const box = card.getBoundingClientRect();
      const img = card.querySelector("img");
      return box.height > box.width && box.top > 110 && box.bottom < innerHeight - 30 && box.left > 30 && box.right < innerWidth - 30 && img?.complete && img.naturalWidth > 0;
    });
    const card = cards[Math.min(2, cards.length - 1)];
    if (!card) return null;
    const box = card.getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  });
  if (!at) throw new Error("aucune affiche peinte à l'écran");
  return at;
});

/** Le bouton Retour de la fiche. */
const backButton = () => pointer(async (page) => {
  const at = await page.evaluate(() => {
    const button = [...document.querySelectorAll("button")].find((b) => /^(Retour|Back)$/.test((b.textContent ?? "").trim()));
    if (!button) return null;
    const box = button.getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  });
  if (!at) throw new Error("bouton Retour absent");
  return at;
});

/** Navigation par l'historique (le routeur écoute `popstate`) — là où aucun lien n'est à l'écran. */
const go = (path) => ({
  gesture: async (page) => {
    await page.evaluate((to) => window.__flickerProbe.go(to), path);
  },
});

/**
 * @returns {Array<{ id: string, aim?: (page: import("playwright-core").Page) => Promise<void>, gesture: (page: import("playwright-core").Page) => Promise<void>, arrives: RegExp, cards?: boolean, before?: (page: import("playwright-core").Page) => Promise<void> }>}
 */
export function journey() {
  // Fait défiler l'accueil, pas à pas (les rangées se montent à l'approche), jusqu'à une rangée
  // d'AFFICHES entièrement à l'écran — les premières rangées sont des vignettes de reprise.
  const scrollToRows = async (page) => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const found = await page.evaluate(() => {
        const poster = [...document.querySelectorAll("[data-card-visual]")].find((card) => {
          const box = card.getBoundingClientRect();
          return box.height > box.width && box.width > 0 && box.top > 0;
        });
        if (!poster) {
          scrollBy(0, 500);
          return false;
        }
        scrollBy(0, poster.getBoundingClientRect().top - 220);
        return true;
      });
      await page.waitForTimeout(350);
      if (found) return;
    }
  };
  return [
    { id: "accueil→bibliothèque", ...byHref(/^\/library\//), arrives: /^\/library\// },
    { id: "bibliothèque→fiche", ...aCard(), arrives: /^\/media\//, cards: false },
    { id: "fiche→bibliothèque (Retour)", ...backButton(), arrives: /^\/library\// },
    { id: "bibliothèque→accueil", ...byText("header a", "Accueil"), arrives: /^\/$/ },
    { id: "accueil→fiche", before: scrollToRows, ...aCard(), arrives: /^\/media\//, cards: false },
    { id: "fiche→accueil (Retour)", ...backButton(), arrives: /^\/$/ },
    { id: "accueil→pour vous", ...byText("header a", "Pour vous"), arrives: /^\/recommendations/, cards: false },
    { id: "pour vous→ma liste", ...go("/watchlist"), arrives: /^\/watchlist/, cards: false },
    { id: "ma liste→réglages", ...go("/settings"), arrives: /^\/settings/, cards: false },
    { id: "réglages→recherche", ...go("/search?q=the"), arrives: /^\/search/, cards: false },
    { id: "recherche→accueil", ...byText("header a", "Accueil"), arrives: /^\/$/ },
  ];
}
