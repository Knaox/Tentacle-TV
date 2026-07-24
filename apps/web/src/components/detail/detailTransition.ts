export interface DetailOrigin {
  itemId: string;
  /** Rectangle de la carte cliquée, en coordonnées de fenêtre. */
  rect: { top: number; left: number; width: number; height: number };
  /** Visuel affiché par la carte — première image de l'animation d'ouverture. */
  imageUrl: string;
  /** Rayon de la carte, pour que le coin s'ouvre au lieu de sauter. */
  radius: number;
  stamp: number;
}

/**
 * Origine de la prochaine ouverture de fiche.
 *
 * Un module et non un contexte React : la valeur est posée pendant le
 * `onClick`, JUSTE avant `navigate()`, et relue au montage de la page de
 * destination. Un state React serait perdu dans le démontage de la route
 * source, et un contexte imposerait un provider autour de tout l'arbre pour
 * une donnée qui vit trois cents millisecondes.
 */
let pending: DetailOrigin | null = null;

/** Au-delà, l'origine est périmée : navigation arrière, lien direct, onglet ré-ouvert. */
const MAX_AGE_MS = 1200;

/**
 * Mémorise d'où part l'ouverture. À appeler dans le `onClick` de la carte,
 * avant la navigation — c'est le seul moment où son rectangle existe encore.
 */
export function captureDetailOrigin(
  element: HTMLElement | null,
  itemId: string,
  imageUrl: string,
  radius = 12,
): void {
  if (!element) {
    pending = null;
    return;
  }
  const r = element.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) {
    pending = null;
    return;
  }
  pending = {
    itemId,
    rect: { top: r.top, left: r.left, width: r.width, height: r.height },
    imageUrl,
    radius,
    stamp: Date.now(),
  };
}

/**
 * Relit l'origine si elle concerne bien cet item et vient d'être posée. Toute
 * autre entrée sur la fiche (lien partagé, rechargement, retour navigateur)
 * retombe sur un simple fondu.
 *
 * La lecture est NON DESTRUCTIVE, et c'est essentiel : appelée depuis un
 * initialiseur `useState`, elle est exécutée DEUX FOIS par React en mode
 * strict (cf. `<StrictMode>` dans main.tsx). La version qui remettait
 * `pending` à null au premier appel renvoyait donc null au second — la fiche
 * ne recevait jamais son origine et l'animation d'ouverture ne se déclenchait
 * pas du tout en développement. Ce sont l'identifiant et l'ancienneté qui
 * bornent la validité, pas l'effet de bord de la lecture.
 */
export function consumeDetailOrigin(itemId: string | undefined): DetailOrigin | null {
  const origin = pending;
  if (!origin || !itemId || origin.itemId !== itemId) return null;
  if (Date.now() - origin.stamp > MAX_AGE_MS) return null;
  return origin;
}
