/**
 * OÙ est la souris dans la carte — la règle de Damien : l'aperçu ne part que
 * sur l'IMAGE d'une carte, jamais sous un bouton. Fonctions pures (des éléments
 * en entrée, un verdict en sortie) ; l'écoute est dans `usePreviewPointer.ts`.
 *
 * Trois places :
 *  - `control` : sur une commande du plateau de la carte (« Marquer comme vu »,
 *    Ma liste, les étoiles) ou dans leur ZONE — entre deux étoiles, entre deux
 *    boutons du plateau, on vise toujours une commande ;
 *  - `outside` : dans la carte mais hors de son image (sa légende, sous
 *    l'affiche) — une carte que seule la souris survole n'y lance rien ;
 *  - `image` : sur l'image (ou sur la mini-carte ouverte, qui EST sa carte).
 * `unknown` : on ne sait pas où est la souris (aucun mouvement depuis le
 * chargement) — ne rien savoir n'autorise à rien retenir.
 */

/** Ce qui se commande : boutons, liens, champs. */
const CONTROL = "button, a[href], [role=\"button\"], input, select, textarea, label";
/** Les zones de commandes : le plateau (`toolbar`), les étoiles (`group`), et ce qui se déclare tel. */
const CONTROL_ZONE = "[role=\"toolbar\"], [role=\"group\"], [role=\"radiogroup\"], [data-preview-hold]";
const HOLDING = `${CONTROL}, ${CONTROL_ZONE}`;

export type PointerSpot = "image" | "control" | "outside" | "unknown";

/** Ce dont la règle a besoin d'un élément (le DOM le donne ; les tests, des doublures). */
export interface SpotElement {
  contains(other: unknown): boolean;
  closest?(selector: string): SpotElement | null;
}

/**
 * La place de la souris d'après l'élément qu'elle survole (`hit`). `inCompanion` :
 * il est dans la mini-carte d'aperçu de cette carte (un portail hors de l'ancre).
 */
export function pointerSpot(anchor: SpotElement, hit: SpotElement | null, inCompanion: boolean): PointerSpot {
  if (hit === null) return "unknown";
  if (inCompanion) return "image";
  if (!anchor.contains(hit)) return "outside";
  // Une commande DU plateau — jamais la carte elle-même (souvent un lien) ni ce qui l'entoure.
  const holding = typeof hit.closest === "function" ? hit.closest(HOLDING) : null;
  return holding !== null && holding !== anchor && anchor.contains(holding) ? "control" : "image";
}

/** Ce que la place de la souris interdit à l'aperçu. */
export interface PointerHold {
  /** Sur une commande du plateau, ou dans sa zone. */
  onControl: boolean;
  /** Dans la carte, hors de son image — et rien d'autre que la souris ne la survole. */
  offImage: boolean;
}

export const NO_HOLD: PointerHold = { onControl: false, offImage: false };

/**
 * `focusOnCard` : le focus clavier est sur la carte elle-même (son porteur) —
 * son survol vient du CLAVIER, la souris peut être n'importe où : hors de
 * l'image, elle ne retient rien.
 */
export function pointerHold(spot: PointerSpot, focusOnCard: boolean): PointerHold {
  const onControl = spot === "control";
  const offImage = spot === "outside" && !focusOnCard;
  return onControl || offImage ? { onControl, offImage } : NO_HOLD;
}
