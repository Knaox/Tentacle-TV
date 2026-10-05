// Les scénarios du banc : chacun part de l'accueil fraîchement lancé (faux
// backend nav-golden), se met en place SANS mesure (`setup`), attend le
// repos, puis joue son GESTE mesuré. `steps` : le nombre de gestes de
// l'utilisateur (pour rapporter le coût d'un pas).
//
// Touches (`Keys.java`) : `tap:<code>`, `tap:<code>x<n>@<ms>`,
// `hold:<code>:<ms>`, `wait:<ms>` — codes Android : 19 haut, 20 bas,
// 21 gauche, 22 droite, 23 OK, 4 Retour. `fixtures` : les jeux du faux
// backend (nav-golden) le temps du scénario ; par défaut, sans Vigie.
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
    id: "grille",
    title: "La grille des films : BAS tenu 4 s puis HAUT tenu 4 s",
    setup: [tap("left"), wait(700), tap("down", 5, 350), wait(700), tap("ok"), wait(4000)],
    gesture: [hold("down", 4000), wait(1500), hold("up", 4000)],
    steps: 2,
  },
];

export function scenariosOf(only) {
  if (!only) return SCENARIOS;
  const wanted = new Set(only.split(","));
  const chosen = SCENARIOS.filter((scenario) => wanted.has(scenario.id));
  if (chosen.length !== wanted.size) throw new Error(`scénario inconnu : ${[...wanted].filter((id) => !SCENARIOS.some((s) => s.id === id)).join(", ")}`);
  return chosen;
}
