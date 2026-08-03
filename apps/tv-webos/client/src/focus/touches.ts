/**
 * Codes de touche des télécommandes LG.
 *
 * Relevés sur `/tv/sonde.html`, qui affiche le `keyCode` de chaque appui : les
 * tables publiées varient d'un modèle à l'autre, et une valeur supposée qui se
 * révèle fausse rend une touche muette sans que rien ne le signale.
 *
 * Les flèches et OK sont les codes standards du web ; les autres sont propres
 * à webOS.
 */

export type Direction = "haut" | "bas" | "gauche" | "droite";

export type Intention =
  | { type: "deplacer"; direction: Direction }
  | { type: "valider" }
  | { type: "retour" }
  | { type: "transport"; commande: TransportCommande };

export type TransportCommande = "lecture" | "pause" | "arret" | "avance" | "retour";

const DIRECTIONS: Record<number, Direction> = {
  38: "haut",
  40: "bas",
  37: "gauche",
  39: "droite",
};

const TRANSPORTS: Record<number, TransportCommande> = {
  415: "lecture",
  19: "pause",
  413: "arret",
  417: "avance",
  412: "retour",
};

/** Retour de la télécommande, et Échap pour le développement au clavier. */
const RETOUR = new Set([461, 27]);

/** OK de la télécommande, et Entrée. */
const VALIDATION = new Set([13]);

export function lireIntention(evenement: KeyboardEvent): Intention | null {
  const code = evenement.keyCode;

  const direction = DIRECTIONS[code];
  if (direction) return { type: "deplacer", direction };

  if (VALIDATION.has(code)) return { type: "valider" };
  if (RETOUR.has(code)) return { type: "retour" };

  const commande = TRANSPORTS[code];
  if (commande) return { type: "transport", commande };

  return null;
}

/** Axe de déplacement d'une direction. */
export function estHorizontale(direction: Direction): boolean {
  return direction === "gauche" || direction === "droite";
}

/** Sens : +1 vers la droite ou le bas, -1 vers la gauche ou le haut. */
export function sens(direction: Direction): 1 | -1 {
  return direction === "droite" || direction === "bas" ? 1 : -1;
}
