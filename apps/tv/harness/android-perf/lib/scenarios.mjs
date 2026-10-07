// Les scénarios du banc : chacun part de l'accueil fraîchement lancé (faux
// backend nav-golden), se met en place SANS mesure (`setup`), attend le
// repos, puis joue son GESTE mesuré. `steps` : le nombre de gestes de
// l'utilisateur (pour rapporter le coût d'un pas).
//
// Touches (`Keys.java`) : `tap:<code>`, `tap:<code>x<n>@<ms>`,
// `hold:<code>:<ms>`, `wait:<ms>` — codes Android : 19 haut, 20 bas,
// 21 gauche, 22 droite, 23 OK, 4 Retour. `fixtures` : les jeux du faux
// backend (nav-golden) le temps du scénario ; par défaut, sans Vigie.
// `expectReady` : l'écran où la mise en place doit aboutir (« prêt:<nom> » du
// mode de mesure) — sinon la passe est rejouée : jamais une mesure d'un autre
// écran que celui du scénario.
import { KEY } from "./device.mjs";

const tap = (key, times, every) => (times ? `tap:${KEY[key]}x${times}@${every}` : `tap:${KEY[key]}`);
const hold = (key, ms) => `hold:${KEY[key]}:${ms}`;
const wait = (ms) => `wait:${ms}`;

export const SCENARIOS = [
  {
    id: "demarrage",
    title: "Démarrage à froid jusqu'à l'accueil prêt",
    cold: true,
  },
  {
    id: "focus-rangee",
    title: "Focus d'une carte : 6 pas à droite puis 6 à gauche sur « Reprendre » (agrandissement, ombre, recul, fond)",
    setup: [tap("down"), wait(2500)],
    gesture: [tap("right", 6, 550), wait(900), tap("left", 6, 550)],
    steps: 12,
  },
  {
    id: "rangee-tenue",
    title: "Défilement d'une rangée, DROITE tenue 2,5 s puis GAUCHE tenue 2,5 s",
    setup: [tap("down"), wait(2500)],
    gesture: [hold("right", 2500), wait(1200), hold("left", 2500)],
    steps: 2,
  },
  {
    id: "accueil-pas",
    title: "La page qui suit le focus : 5 pas vers le bas, puis 5 vers le haut (sections, révélations)",
    setup: [wait(500)],
    gesture: [tap("down", 5, 800), wait(900), tap("up", 5, 800)],
    steps: 10,
  },
  {
    id: "accueil-tenu",
    title: "Défilement de l'accueil, BAS tenu 3 s puis HAUT tenu 3 s",
    setup: [wait(500)],
    gesture: [hold("down", 3000), wait(1200), hold("up", 3000)],
    steps: 2,
  },
  {
    id: "rail",
    title: "Le rail qui se déplie puis se replie, trois fois",
    setup: [tap("down"), wait(2500)],
    gesture: [tap("left"), wait(1100), tap("right"), wait(1100), tap("left"), wait(1100), tap("right"), wait(1100), tap("left"), wait(1100), tap("right")],
    steps: 6,
  },
  {
    id: "heros",
    title: "Le héros qui tourne (fondu de l'image, du halo et du texte), deux rotations",
    setup: [wait(500)],
    gesture: [wait(17000)],
    steps: 2,
  },
  {
    id: "panneau",
    title: "Le grand panneau : OK maintenu sur une carte, l'échelle de note (3 pas), puis Retour",
    setup: [tap("down"), wait(1200), tap("right"), wait(2500)],
    gesture: [hold("ok", 900), wait(1600), tap("right", 3, 450), wait(900), tap("back"), wait(1200)],
    steps: 5,
  },
  {
    id: "fiche",
    title: "La fiche : « Plus d'infos » du héros, 3 sections vers le bas et retour, puis Retour",
    setup: [tap("right"), wait(1500)],
    gesture: [tap("ok"), wait(3500), tap("down", 3, 800), wait(900), tap("up", 3, 800), wait(900), tap("back"), wait(1500)],
    steps: 8,
  },
  {
    id: "recherche",
    title: "La recherche : trois lettres tapées au clavier de l'écran (les résultats arrivent à chaque frappe)",
    setup: [tap("left"), wait(900), tap("up"), wait(700), tap("ok"), wait(3000)],
    gesture: [tap("ok"), wait(1800), tap("right"), wait(400), tap("ok"), wait(1800), tap("right"), wait(400), tap("ok"), wait(2500)],
    steps: 3,
  },
  {
    id: "lecteur",
    title: "Le lecteur : « Orgueil et Préjugés » (MP4 du banc), OK fait paraître l'habillage, 3 sauts à droite, puis l'habillage s'efface",
    fixtures: ["base/vigie-off", "lecteur/flux-mp4"],
    setup: [tap("down"), wait(1500), tap("ok"), wait(7000)],
    gesture: [tap("ok"), wait(1500), tap("right", 3, 700), wait(1500), wait(6500)],
    steps: 5,
  },
  {
    id: "decompte",
    title: "Le défilement du lecteur : ⏩ ouvre la vignette et son décompte (« Lecture dans 5 s »), qui s'écoule puis referme tout",
    fixtures: ["base/vigie-off", "lecteur/flux-mp4"],
    setup: [tap("down"), wait(1500), tap("ok"), wait(7000)],
    gesture: [tap("fastForward"), wait(7500)],
    steps: 1,
  },
  {
    id: "aller-retour",
    title: "Changer de page : « Plus d'infos » du héros ouvre la fiche, puis Retour revient à l'accueil",
    setup: [tap("right"), wait(1500)],
    gesture: [tap("ok"), wait(3500), tap("back"), wait(2500)],
    steps: 2,
  },
  {
    id: "lancement",
    title: "Lancer une vidéo : OK sur « Reprendre » (MP4 du banc), puis Retour revient à l'accueil",
    fixtures: ["base/vigie-off", "lecteur/flux-mp4"],
    setup: [tap("down"), wait(1500)],
    gesture: [tap("ok"), wait(7000), tap("back"), wait(3000)],
    steps: 2,
  },
  {
    id: "page-films",
    title: "Changer de page par le rail : ouvrir « Films » (la grille d'affiches)",
    setup: [tap("left"), wait(700), tap("down", 5, 350), wait(900)],
    gesture: [tap("ok"), wait(4000)],
    steps: 1,
  },
  {
    id: "page-pourvous",
    title: "Changer de page par le rail : ouvrir « Pour vous » (ses rangées)",
    setup: [tap("left"), wait(700), tap("down"), wait(900)],
    gesture: [tap("ok"), wait(4000)],
    steps: 1,
  },
  {
    // Retour, sur une page du rail, ouvre le rail (`railBackStep`) : on y
    // remonte à « Accueil ».
    id: "page-accueil",
    title: "Revenir à l'accueil par le rail depuis « Films » (l'accueil gardé sous la page)",
    setup: [tap("left"), wait(700), tap("down", 5, 350), wait(700), tap("ok"), wait(4000), tap("back"), wait(900), tap("up", 5, 350), wait(900)],
    gesture: [tap("ok"), wait(3000)],
    steps: 1,
  },
  {
    // Le rail se POSE avant OK (2 s) : sous la charge, un OK traité en retard
    // y devient un appui maintenu, qui ouvre le menu de l'entrée (vécu).
    // « Bleach » : 6e affiche d'« Animés », l'une des cinq séries dont
    // l'instantané garde les saisons. INSTABLE (07/10) : dans le banc, le
    // focus reste dans la barre de filtres de la grille (BAS ne descend pas
    // aux affiches), alors qu'à la main le même chemin mène à « Bleach » ; la
    // passe est alors notée « non mesurée », capture à l'appui. Jamais OK sur
    // un épisode (il lancerait la lecture) : OK sur un ONGLET de saison.
    id: "saisons-episodes",
    title: "Saisons et épisodes (« Bleach ») : BAS aux onglets puis aux épisodes, 4 épisodes à droite, HAUT, la saison 3 choisie, ses épisodes",
    expectReady: "fiche",
    setup: [wait(1500), tap("left"), wait(1500), tap("down", 4, 450), wait(2000), tap("ok"), wait(8000), tap("down"), wait(1500), tap("up"), wait(1500), tap("down"), wait(2000), tap("right", 5, 600), wait(900), tap("ok"), wait(5000)],
    gesture: [tap("down"), wait(1800), tap("down"), wait(1800), tap("right", 4, 600), wait(900), tap("up"), wait(1200), tap("right", 2, 600), wait(600), tap("ok"), wait(2500), tap("down"), wait(1500), tap("right", 3, 600), wait(900)],
    steps: 14,
  },
  {
    // GAUCHE depuis le rail : « Réglages ». Aucun OK dans un panneau : on ne
    // change aucun réglage, on ne fait que montrer les onglets et parcourir.
    id: "reglages",
    title: "Réglages : les onglets montrés un à un (OK sur l'onglet), puis le panneau Lecture parcouru, sans rien changer",
    setup: [wait(1500), tap("left"), wait(1500), tap("left"), wait(1200), tap("ok"), wait(4000)],
    gesture: [tap("down"), wait(700), tap("ok"), wait(1500), tap("down"), wait(700), tap("ok"), wait(1500), tap("down"), wait(700), tap("ok"), wait(1500), tap("up", 2, 700), wait(700), tap("ok"), wait(1500), tap("right"), wait(900), tap("down", 4, 700), wait(900), tap("up", 4, 700), wait(700), tap("left"), wait(900)],
    steps: 18,
  },
  {
    id: "grille",
    title: "La grille des films : BAS tenu 4 s puis HAUT tenu 4 s",
    expectReady: "bibliothèque",
    setup: [tap("left"), wait(700), tap("down", 5, 350), wait(700), tap("ok"), wait(4000)],
    gesture: [hold("down", 4000), wait(1500), hold("up", 4000)],
    steps: 2,
  },
  // Les VUES du différentiel visuel normal → Lite (L5a, `--shots`) : un geste
  // court qui finit sur l'écran à montrer, capturé 1,5 s après.
  {
    id: "vue-fiche",
    title: "Vue : la fiche (« Plus d'infos » du héros)",
    setup: [tap("right"), wait(1500)],
    gesture: [tap("ok"), wait(4500)],
    steps: 1,
  },
  {
    id: "vue-fiche-bas",
    title: "Vue : la fiche, une section plus bas",
    setup: [tap("right"), wait(1500)],
    gesture: [tap("ok"), wait(4000), tap("down"), wait(1800)],
    steps: 2,
  },
  {
    id: "vue-rail",
    title: "Vue : le rail déplié",
    setup: [tap("down"), wait(2500)],
    gesture: [tap("left"), wait(1500)],
    steps: 1,
  },
  {
    id: "vue-reglages",
    title: "Vue : Réglages, le panneau du deuxième onglet (sans rien changer)",
    setup: [wait(1500), tap("left"), wait(1500), tap("left"), wait(1200), tap("ok"), wait(4000)],
    gesture: [tap("down"), wait(700), tap("ok"), wait(1500), tap("right"), wait(1200)],
    steps: 3,
  },
  {
    id: "vue-saisons",
    title: "Vue : les saisons et épisodes (« Bleach »)",
    expectReady: "fiche",
    setup: [wait(1500), tap("left"), wait(1500), tap("down", 4, 450), wait(2000), tap("ok"), wait(8000), tap("down"), wait(1500), tap("up"), wait(1500), tap("down"), wait(2000), tap("right", 5, 600), wait(900), tap("ok"), wait(5000)],
    gesture: [tap("down"), wait(1800), tap("down"), wait(1800)],
    steps: 2,
  },
  {
    id: "vue-lecteur",
    title: "Vue : l'habillage du lecteur",
    fixtures: ["base/vigie-off", "lecteur/flux-mp4"],
    setup: [tap("down"), wait(1500), tap("ok"), wait(7000)],
    gesture: [tap("ok"), wait(600)],
    steps: 1,
  },
];

export function scenariosOf(only) {
  // Les vues du différentiel (`vue-*`) ne se jouent que nommées.
  if (!only) return SCENARIOS.filter((scenario) => !scenario.id.startsWith("vue-"));
  const wanted = new Set(only.split(","));
  const chosen = SCENARIOS.filter((scenario) => wanted.has(scenario.id));
  if (chosen.length !== wanted.size) throw new Error(`scénario inconnu : ${[...wanted].filter((id) => !SCENARIOS.some((s) => s.id === id)).join(", ")}`);
  return chosen;
}
