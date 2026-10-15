/**
 * L'ENTRÉE d'une rangée de cartes, quand le défilement l'amène à l'écran — la
 * règle, pure ; `useRowEntrance` l'applique.
 *
 * Ce qu'elle remplace : la section entière glissait de 16 px en `ease`, et
 * chaque carte glissait de 20 px PAR-DESSUS, deux mouvements empilés qui se
 * lisaient comme un rebond mou. Surtout, la rangée attendait son rang dans la
 * page (`150 + i × 100` ms sur l'accueil, `550 + i × 80` sur une bibliothèque) :
 * la huitième rangée, atteinte au défilement, restait vide près d'une seconde.
 *
 * Désormais :
 *   • UN mouvement par élément — le titre se pose, les cartes montent ;
 *   • une courbe « expo » : le geste est presque fini au premier tiers, la fin
 *     ne fait que se poser — rien ne traîne, rien ne rebondit ;
 *   • la cascade ne vise que les cartes de la PREMIÈRE vue, étalée sur une
 *     fenêtre fixe quel que soit leur nombre : 450 ms au plus pour la rangée ;
 *   • le décalage entre rangées naît du moment, pas d'un rang figé : des
 *     rangées qui entrent ENSEMBLE (ouverture de page, défilement rapide) se
 *     suivent de près ; une rangée qui entre seule part tout de suite.
 *
 * `transform` et `opacity` seulement : aucune peinture par image, et plus
 * rien ne tourne une fois la rangée posée.
 */

/** Courbe de sortie exponentielle : vive au départ, posée à l'arrivée. */
export const ENTRANCE_EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

/** Durée de la montée d'une carte. */
export const CARD_ENTER_MS = 340;
/** Le titre se pose un peu plus vite que les cartes qu'il annonce. */
export const HEADER_ENTER_MS = 300;
/** Écart idéal entre deux cartes (fourchette 30–50 ms d'une cascade lisible). */
export const CARD_STEP_MS = 30;
/**
 * Fenêtre où toute la cascade tient : au-delà, l'écart se resserre. Sept
 * affiches à l'écran donnent 18 ms d'écart — l'ordre se perçoit encore, et la
 * dernière carte est posée à 110 + 340 = 450 ms.
 */
export const CARD_SPREAD_MS = 110;

/** Des rangées qui démarrent à moins de cet intervalle forment un même lot. */
export const ROW_BATCH_WINDOW_MS = 120;
/** Écart entre deux rangées d'un même lot, et son plafond. */
export const ROW_STEP_MS = 60;
export const ROW_MAX_DELAY_MS = 180;

/**
 * Part de la piste de cartes qui doit être à l'écran pour lancer l'entrée :
 * on joue le mouvement quand on peut le VOIR, pas quand la rangée effleure le
 * bas de la fenêtre et que la moitié de la cascade passerait hors champ.
 */
export const ENTRANCE_VISIBLE_RATIO = 0.2;
/**
 * Garde-fou : une rangée arrêtée au bord bas de la fenêtre, sous le seuil,
 * entre quand même — jamais une bande vide qui attend un défilement.
 */
export const ENTRANCE_HOLD_MAX_MS = 450;
/**
 * Dernier recours : aucune carte montée ce délai après l'ouverture de la
 * porte (rangée repartie hors champ avant d'être remplie) — la retenue est
 * levée sans mouvement, plutôt qu'un titre caché pour toujours.
 */
export const ENTRANCE_GIVE_UP_MS = 2_000;

/** Retenue du départ : un mouvement court, qui se lit sans se remarquer. */
export const CARD_FROM = { opacity: 0, transform: "translate3d(0, 18px, 0) scale(0.98)" } as const;
export const HEADER_FROM = { opacity: 0, transform: "translate3d(0, 8px, 0)" } as const;

/**
 * Images clés : l'opacité arrive au plein à mi-course de la courbe — une carte
 * déjà opaque finit de se poser, au lieu d'un fantôme qui glisse.
 */
export function entranceKeyframes(from: { opacity: number; transform: string }): Keyframe[] {
  return [
    { opacity: from.opacity, transform: from.transform, offset: 0 },
    { opacity: 1, offset: 0.5 },
    { opacity: 1, transform: "none", offset: 1 },
  ];
}

/** Retard de chaque carte visible, dans l'ordre de la piste. */
export function cardEntranceDelays(count: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [0];
  const step = Math.min(CARD_STEP_MS, CARD_SPREAD_MS / (count - 1));
  return Array.from({ length: count }, (_, i) => Math.round(i * step));
}

/**
 * Horloge des lots : rend le retard de départ d'une rangée qui entre à
 * `now`. Partagée par toutes les rangées d'une page (une instance de module).
 */
export function createEntranceClock() {
  let lastStart = Number.NEGATIVE_INFINITY;
  let lastDelay = 0;
  return {
    slot(now: number): number {
      const delay = now - lastStart < ROW_BATCH_WINDOW_MS
        ? Math.min(lastDelay + ROW_STEP_MS, ROW_MAX_DELAY_MS)
        : 0;
      lastStart = now;
      lastDelay = delay;
      return delay;
    },
  };
}
