/**
 * Les RÉGLAGES du déplacement au lecteur TV, toutes entrées confondues —
 * flèches, boutons de l'habillage, touches média, pavé : l'unique endroit où
 * ils se retouchent. Le cerveau est partagé (`useTVPlayerControls`) : Apple TV
 * et Android TV lisent les mêmes valeurs. Les gains du pavé tactile, eux,
 * vivent dans `scrubTouchTuning.ts`.
 */

/** Le saut d'un appui VERS L'AVANT — flèche droite, bouton « +30 s », touche
 *  d'avance isolée. L'habillage l'affiche (« 30 » dans sa flèche, son
 *  libellé) : il lit cette valeur, jamais une copie. */
export const SKIP_FORWARD_SECONDS = 30;

/** Le saut d'un appui VERS L'ARRIÈRE — flèche gauche, bouton « −10 s »,
 *  touche de recul isolée. */
export const SKIP_BACK_SECONDS = 10;

/** Le saut signé d'un appui dans ce sens, en secondes. */
export function jumpSecondsOf(dir: "forward" | "backward"): number {
  return dir === "forward" ? SKIP_FORWARD_SECONDS : -SKIP_BACK_SECONDS;
}

/** La VALIDATION d'un déplacement entré en lecture : sans nouveau geste, la
 *  lecture repart à la position visée au bout de ce délai, décompté à l'écran
 *  (« Lecture dans 5 s », `scrubCountdown.ts`). Chaque geste le relance ; OK
 *  valide aussitôt, Retour annule ; en pause, rien ne part seul. */
export const RESUME_COUNTDOWN_MS = 5000;
