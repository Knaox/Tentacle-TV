/**
 * Les scènes du banc des fiches : un écran (`route`, filtres compris — ils vivent dans
 * l'adresse), et au besoin un geste (`act`) joué avant la capture — ouvrir un menu, survoler.
 * Une scène avec geste est capturée à la taille de la fenêtre ; sans geste, la page entière —
 * et `screens` écrans de plus, pris en défilant (les rangées hors écran ne sont pas montées).
 */

const FILMS = "/library/films";
const FILTERED = `${FILMS}?genres=g-thriller,g-drame&status=IsUnplayed&rating=7.5&sort=CommunityRating&order=desc`;

/** Ouvre le n-ième menu de la barre d'outils (0 : tri, puis genres, années, note, plateformes, audio, sous-titres). */
const openMenu = (index) => async (page) => {
  await page.locator('section [aria-haspopup="true"]').nth(index).click();
};

export const SCENES = [
  { name: "bibliotheque-films", route: FILMS },
  { name: "bibliotheque-series", route: "/library/series" },
  { name: "bibliotheque-3-filtres", route: FILTERED },
  { name: "bibliotheque-menu-tri", route: FILMS, act: openMenu(0) },
  { name: "bibliotheque-menu-genres", route: FILTERED, act: openMenu(1) },
  { name: "bibliotheque-menu-annees", route: `${FILMS}?from=1950&to=1960`, act: openMenu(2) },
  { name: "bibliotheque-menu-note", route: `${FILMS}?rating=7.5`, act: openMenu(3) },
  { name: "bibliotheque-menu-plateformes", route: FILMS, act: openMenu(4) },
  { name: "bibliotheque-menu-audio", route: `${FILMS}?audio=fr`, act: openMenu(5) },
  { name: "bibliotheque-menu-sous-titres", route: FILMS, act: openMenu(6) },
  { name: "bibliotheque-recherche", route: `${FILMS}?q=mor` },
  { name: "bibliotheque-filtree-vide", route: `${FILMS}?genres=g-western&fav=1` },
  { name: "bibliotheque-vide", route: "/library/vide" },
  { name: "bibliotheque-chargement", route: `${FILMS}?etat=loading`, ready: "section" },
  { name: "fiche-film", route: "/media/sintel", screens: 3 },
  { name: "fiche-film-sans-decor", route: "/media/vertigo" },
  { name: "fiche-serie", route: "/media/cam", screens: 3 },
  { name: "fiche-episode", route: "/media/cam2" },
  { name: "fiche-collection", route: "/media/blender", screens: 2 },
  { name: "fiche-chargement", route: "/media/sintel?etat=loading", ready: "body" },
  { name: "fiche-echec", route: "/media/inconnu", ready: "body" },
  { name: "personne", route: "/person/p-cary-grant" },
  { name: "recherche-resultats", route: "/search?q=s" },
  { name: "recherche-aucun-resultat", route: "/search?q=zzz" },
  { name: "recherche-vide", route: "/search" },
  { name: "recherche-genre", route: "/search?genre=Thriller" },
  { name: "ma-liste", route: "/watchlist" },
  { name: "ma-liste-vue-liste", route: "/watchlist?view=list" },
  { name: "mes-favoris", route: "/favorites" },
];
