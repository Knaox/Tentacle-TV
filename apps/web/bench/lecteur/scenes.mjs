/**
 * Les scènes du banc du lecteur : une adresse du labo (`query`), des gestes, une capture.
 * `themes` : sombre seul par défaut (l'habillage posé sur la vidéo ne suit pas le thème) ;
 * les deux là où un menu, une feuille ou un avis du thème est à l'écran.
 */

const click = (name) => (page) => page.getByRole("button", { name, exact: true }).first().click();
const hover = (selector) => (page) => page.hover(selector);
const BOTH = ["dark", "light"];

export const SCENES = [
  { name: "web-repos", query: "vue=web" },
  { name: "web-film", query: "vue=web&etat=film" },
  { name: "web-masque", query: "vue=web&masque=1", widths: [[1440, 810]] },
  { name: "web-barre-survol", query: "vue=web", steps: [hover(".pl-seek")], widths: [[1440, 810]] },
  { name: "web-pistes", query: "vue=web", themes: BOTH, steps: [click("Paramètres")] },
  { name: "web-pistes-serie", query: "vue=web&serie=1&st=forces", themes: BOTH, steps: [click("Paramètres")] },
  { name: "web-vitesse", query: "vue=web", themes: BOTH, steps: [click("Vitesse de lecture")] },
  { name: "web-episodes", query: "vue=web", themes: BOTH, steps: [click("Épisodes")], settle: 900 },
  { name: "bureau-repos", query: "vue=bureau" },
  { name: "bureau-pistes", query: "vue=bureau", themes: BOTH, steps: [click("Paramètres")] },
];
