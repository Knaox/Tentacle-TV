/**
 * Les scènes du banc d'Octave : `name` nomme la capture ET la scène du labo (`?vue=`, sauf `view`),
 * `act` ouvre un calque par un clic sur le VRAI bouton (son nom accessible, en français).
 */

const button = (page, name) => page.getByRole("button", { name, exact: true });

export const SCENES = [
  { name: "accueil" },
  { name: "accueil-lecture" },
  { name: "album" },
  { name: "artiste" },
  { name: "playlist" },
  { name: "bibliotheque" },
  { name: "titres-aimes" },
  { name: "playlists" },
  {
    // Les résultats : la barre perd le focus, ses suggestions se referment.
    name: "recherche",
    act: async (page) => {
      await page.getByRole("heading", { name: "Albums", exact: true }).click();
    },
  },
  { name: "recherche-accueil" },
  {
    // La file « À suivre », ouverte par son bouton du dock.
    name: "file",
    act: async (page) => {
      await button(page, "File d'attente").click();
    },
  },
  {
    // Le lecteur plein écran, ouvert par le titre en cours du dock.
    name: "en-cours",
    act: async (page) => {
      await button(page, "Ouvrir le lecteur").first().click();
    },
  },
  {
    // Le menu « … » d'un titre de l'album.
    name: "menu",
    act: async (page) => {
      const more = button(page, "Plus d'options pour Sel et cendre");
      await more.scrollIntoViewIfNeeded();
      await more.click({ force: true });
    },
  },
  {
    // « Ajouter à une playlist » : la boîte de dialogue, ouverte par le « + » d'une rangée.
    name: "feuille",
    act: async (page) => {
      const row = page.getByRole("button", { name: "Plus d'options pour Périphérique", exact: true });
      await row.hover({ force: true });
      await button(page, "Ajouter à une playlist").nth(1).click({ force: true });
    },
  },
  {
    // « Détails de la playlist », par le menu « … » de sa tête.
    name: "feuille-details",
    view: "feuille",
    act: async (page) => {
      // Le rail porte le même bouton pour sa playlist : celui de la PAGE.
      await page.locator("#octave-main").getByRole("button", { name: "Plus d'options pour « Matins lents »", exact: true }).click();
      await page.getByRole("menuitem", { name: "Modifier les détails…", exact: true }).click();
    },
  },
  { name: "vide" },
  { name: "vide-aimes" },
  { name: "erreur" },
  { name: "chargement" },
  { name: "chargement-accueil" },
  { name: "appareil" },
  { name: "reglages" },
  { name: "pause" },
];

/** Le survol d'une carte d'album de l'accueil (sombre, 1440). */
export const HOVER_SCENE = {
  name: "carte-survol",
  view: "accueil-lecture",
  act: async (page) => {
    const card = page.locator('a.octave-card[href*="/octave/album/"]').first();
    await card.evaluate((element) => element.scrollIntoView({ block: "center" }));
    await page.waitForTimeout(300);
    await card.hover();
  },
};
