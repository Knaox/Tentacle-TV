import type { Direction } from "./keys";

/**
 * Une touche maintenue fait défiler vite — et s'arrête avec la touche.
 *
 * Tenue, une flèche de télécommande envoie ses répétitions à cadence fixe,
 * qu'on ait fini de traiter la précédente ou non. Sur le processeur d'une
 * dalle, un déplacement (recensement, pose du focus, rendu de la carte,
 * peinture) peut durer plus longtemps que l'intervalle entre deux
 * répétitions : elles s'ENTASSENT derrière la tâche en cours, puis sont
 * traitées d'une traite, sans une image entre elles. Le focus continuait donc
 * de courir après qu'on avait lâché la touche, et chaque répétition relançait
 * un pas de révélation par-dessus le précédent — mesuré au banc (processeur
 * bridé ×4, bas maintenu sur l'accueil) : le focus perdu, la page repartie
 * d'un écran et demi en arrière.
 *
 * La règle : un déplacement dans une direction n'en admet un autre DANS LA
 * MÊME direction qu'une fois le premier présenté à l'écran (deux images), et
 * pas tant qu'un pas de révélation attend sa carte. Ce qui arrive entre-temps
 * est avalé, pas mis en file : la vitesse suit ce que la dalle sait afficher,
 * et lâcher la touche arrête tout sur-le-champ. Une autre direction passe
 * toujours — c'est un geste nouveau, pas une répétition.
 *
 * `event.repeat` n'est pas consulté : toutes les plateformes ne le posent pas,
 * et deux appuis humains sur la même touche en moins d'une image n'existent pas.
 */

/** Filet si les images ne viennent pas (page cachée) : la touche ne reste pas muette. */
const FRAME_FALLBACK_MS = 120;
/** Au-delà, le pas de révélation a abouti ou renoncé (deux pas de 400 ms). */
const REVEAL_HOLD_MS = 800;

let pending: Direction | null = null;
let generation = 0;
let revealing: { direction: Direction; until: number } | null = null;
let watching = false;

function release(token: number): void {
  if (token === generation) pending = null;
}

/** Le focus a bougé : le pas de révélation a trouvé sa carte. */
function onArrival(): void {
  revealing = null;
}

/** Ce déplacement peut-il partir maintenant ? L'admettre arme la garde. */
export function admitMove(direction: Direction): boolean {
  if (pending === direction) return false;
  if (revealing && revealing.direction === direction && Date.now() < revealing.until) return false;

  pending = direction;
  const token = ++generation;
  requestAnimationFrame(() => requestAnimationFrame(() => release(token)));
  setTimeout(() => release(token), FRAME_FALLBACK_MS);
  return true;
}

/** Un pas de défilement attend que sa cible soit montée : on ne l'empile pas. */
export function holdWhileRevealing(direction: Direction): void {
  if (!watching && typeof document !== "undefined") {
    document.addEventListener("focusin", onArrival, true);
    watching = true;
  }
  revealing = { direction, until: Date.now() + REVEAL_HOLD_MS };
}
