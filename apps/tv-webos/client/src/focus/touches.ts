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

/**
 * Repli par le NOM de la touche, quand `keyCode` n'est pas renseigné.
 *
 * `keyCode` est déprécié depuis longtemps, et une source d'événements qui ne le
 * remplit pas rend le moteur entièrement muet — les flèches redescendent alors
 * aux gestionnaires du client web, qui déplacent le focus selon une logique qui
 * n'est pas spatiale, et le déplacement paraît erratique. C'est exactement ce
 * qui s'est produit au banc d'essai, où les événements portaient `keyCode: 0`.
 *
 * Le repli ne coûte rien et retire une panne entière du champ des possibles sur
 * un modèle qu'on n'a pas pu tester. Il reste un repli : sur webOS, `keyCode`
 * est renseigné et gagne, notamment pour les codes propres à la plateforme que
 * `key` ne nomme pas.
 *
 * Les touches de transport ne sont reprises ici que lorsque le nom désigne la
 * même commande, sans ambiguïté. `MediaPlayPause` en est absente : c'est une
 * bascule, et la table ci-dessus distingue lecture et pause.
 */
const DIRECTIONS_PAR_NOM: Record<string, Direction> = {
  ArrowUp: "haut",
  ArrowDown: "bas",
  ArrowLeft: "gauche",
  ArrowRight: "droite",
};

const TRANSPORTS_PAR_NOM: Record<string, TransportCommande> = {
  MediaPlay: "lecture",
  MediaPause: "pause",
  MediaStop: "arret",
  MediaFastForward: "avance",
  MediaRewind: "retour",
};

const VALIDATION_PAR_NOM = new Set(["Enter"]);
const RETOUR_PAR_NOM = new Set(["Escape", "BrowserBack", "GoBack"]);

export function lireIntention(evenement: KeyboardEvent): Intention | null {
  const code = evenement.keyCode;

  const direction = DIRECTIONS[code];
  if (direction) return { type: "deplacer", direction };

  if (VALIDATION.has(code)) return { type: "valider" };
  if (RETOUR.has(code)) return { type: "retour" };

  const commande = TRANSPORTS[code];
  if (commande) return { type: "transport", commande };

  return parLeNom(evenement.key);
}

function parLeNom(nom: string | undefined): Intention | null {
  if (!nom) return null;

  const direction = DIRECTIONS_PAR_NOM[nom];
  if (direction) return { type: "deplacer", direction };

  if (VALIDATION_PAR_NOM.has(nom)) return { type: "valider" };
  if (RETOUR_PAR_NOM.has(nom)) return { type: "retour" };

  const commande = TRANSPORTS_PAR_NOM[nom];
  if (commande) return { type: "transport", commande };

  return null;
}

/**
 * OK/Entrée, par code ou à défaut par nom.
 *
 * Partagé entre la machine d'appui long et le verrou de touche : les deux
 * doivent reconnaître la MÊME touche, y compris sur une source qui ne
 * renseigne pas `keyCode` — le banc d'essai en est une, et `appuiLong` qui ne
 * lisait que le code y prenait chaque répétition d'Entrée pour un déplacement,
 * annulant le maintien qu'elle était censée prouver.
 */
export function estValidation(evenement: { keyCode?: number; key?: string }): boolean {
  if (evenement.keyCode !== undefined && VALIDATION.has(evenement.keyCode)) return true;
  return !!evenement.key && VALIDATION_PAR_NOM.has(evenement.key);
}

/** Axe de déplacement d'une direction. */
export function estHorizontale(direction: Direction): boolean {
  return direction === "gauche" || direction === "droite";
}

/** Sens : +1 vers la droite ou le bas, -1 vers la gauche ou le haut. */
export function sens(direction: Direction): 1 | -1 {
  return direction === "droite" || direction === "bas" ? 1 : -1;
}
