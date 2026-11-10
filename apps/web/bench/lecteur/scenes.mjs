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
  { name: "encart-saut", query: "vue=encarts&etat=saut", themes: BOTH },
  { name: "encart-saut-decompte", query: "vue=encarts&etat=saut-decompte", widths: [[1440, 810]], settle: 1500 },
  { name: "encart-suivant", query: "vue=encarts&etat=suivant", themes: BOTH, settle: 1500 },
  { name: "encart-fin", query: "vue=encarts&etat=fin", settle: 1500 },
  { name: "encart-encore-la", query: "vue=encarts&etat=encore-la", themes: BOTH },
  { name: "encart-en-pause", query: "vue=encarts&etat=en-pause", widths: [[1440, 810]] },
  { name: "encart-badges", query: "vue=encarts&etat=badges", widths: [[1440, 810]], settle: 120 },
  { name: "encart-attente", query: "vue=encarts&etat=attente", widths: [[1440, 810]] },
  { name: "avis-qualite", query: "vue=encarts&etat=qualite", themes: BOTH, widths: [[1440, 810]], settle: 700 },
  { name: "avis-panne", query: "vue=encarts&etat=panne", themes: BOTH },
  { name: "avis-panne-longue", query: "vue=encarts&etat=panne-longue", themes: BOTH, widths: [[1440, 810]] },
  { name: "ecran-chargement", query: "vue=ecrans&etat=chargement" },
  { name: "ecran-introuvable", query: "vue=ecrans&etat=introuvable", themes: BOTH, widths: [[1440, 810]] },
  { name: "ecran-erreur", query: "vue=ecrans&etat=erreur", widths: [[1440, 810]] },
  { name: "ecran-secours", query: "vue=ecrans&etat=secours", themes: BOTH, widths: [[1440, 810]] },
  { name: "pip-lecture", query: "vue=pip", themes: BOTH, widths: [[1024, 640]], steps: [hover("[data-lab-stage] > div")] },
  { name: "pip-chargement", query: "vue=pip&etat=chargement", widths: [[1024, 640]] },
];
