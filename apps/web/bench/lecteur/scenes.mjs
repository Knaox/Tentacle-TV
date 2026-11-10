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
  // La qualité : la dernière section du panneau des pistes (palier servi par « Auto »), amenée à l'écran.
  { name: "web-qualite", query: "vue=web&auto=1", themes: BOTH, steps: [click("Paramètres"), (page) => page.evaluate(() => { const el = document.querySelector(".pl-panel__scroll"); el.scrollTop = el.scrollHeight; })] },
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
  { name: "maj-disponible", query: "vue=maj&etat=disponible", themes: BOTH, settle: 700 },
  { name: "maj-telechargement", query: "vue=maj&etat=telechargement", themes: BOTH, settle: 700 },
  { name: "maj-magasin", query: "vue=maj&etat=magasin", widths: [[1440, 810]], settle: 700 },
  { name: "maj-installation", query: "vue=maj&etat=installation", themes: BOTH, widths: [[1440, 810]], settle: 700 },
  { name: "maj-redemarrage", query: "vue=maj&etat=redemarrage", widths: [[1440, 810]], settle: 700 },
  { name: "maj-erreur", query: "vue=maj&etat=erreur", themes: BOTH, settle: 700 },
  { name: "maj-appstore", query: "vue=maj&etat=appstore", widths: [[1440, 810]], settle: 700 },
  { name: "nouveautes", query: "vue=nouveautes", themes: BOTH, settle: 1500 },
  { name: "nouveautes-1-40", query: "vue=nouveautes&version=1.40.0", widths: [[1440, 810]], settle: 1500 },
  // Watch Together, séance factice.
  { name: "wt-panneau", query: "vue=wt&etat=panneau", themes: BOTH, widths: [[1024, 640]] },
  { name: "wt-panneau-groupe", query: "vue=wt&etat=panneau-groupe", themes: BOTH, widths: [[1024, 640]] },
  { name: "wt-panneau-invitations", query: "vue=wt&etat=panneau-invitations", themes: BOTH, widths: [[1024, 640]] },
  { name: "wt-panneau-ailleurs", query: "vue=wt&etat=panneau-ailleurs", widths: [[1024, 640]] },
  { name: "wt-salle", query: "vue=wt&etat=salle", themes: BOTH, settle: 900 },
  { name: "wt-inviter", query: "vue=wt&etat=inviter", themes: BOTH, settle: 900, steps: [click("Léa"), click("Noa")].slice(0, 0) },
  { name: "wt-invitations", query: "vue=wt&etat=invitations", themes: BOTH, settle: 900 },
  { name: "wt-lecteur", query: "vue=wt&etat=lecteur", settle: 1200 },
  { name: "wt-chat", query: "vue=wt&etat=chat", settle: 1200 },
  { name: "wt-ailleurs", query: "vue=wt&etat=ailleurs", themes: BOTH, widths: [[1024, 640]], settle: 700 },
  { name: "wt-groupe-en-cours", query: "vue=wt&etat=groupe-en-cours", themes: BOTH, widths: [[1024, 640]], settle: 700 },
  { name: "wt-match", query: "vue=wt&etat=match", themes: BOTH, widths: [[1440, 810]], settle: 1200 },
  // La surcouche de la coquille CEF (son propre Shadow DOM, toujours sombre), sur le lecteur.
  { name: "cef-telechargement", query: "vue=web&cef=telechargement", settle: 800 },
  { name: "cef-prete", query: "vue=web&cef=prete", widths: [[1440, 810]], settle: 800 },
  { name: "cef-installation", query: "vue=web&cef=installation", widths: [[1440, 810]], settle: 800 },
  { name: "cef-securite", query: "vue=web&cef=securite", settle: 800 },
  { name: "cef-securite-prete", query: "vue=web&cef=securite-prete", widths: [[1440, 810]], settle: 800 },
  { name: "cef-retour", query: "vue=web&cef=retour", widths: [[1440, 810]], settle: 800 },
];
