import type { Direction } from "../input/keys";
import type { RemoteTraits } from "../remote/bindings/types";
import type { IntentEvent } from "../remote/signals";

/**
 * « AU-DELÀ DU BORD » : un geste vers une direction où le focus ne va nulle
 * part — un pas ou un glisser — alors que le focus est sur l'élément du bord,
 * et qu'il y était déjà AVANT le geste. L'accueil s'en sert pour tourner son
 * héros : DROITE au-delà du dernier bouton passe au titre suivant.
 *
 * Là où le moteur de focus natif déplace le focus AVANT que l'intention
 * n'arrive (`RemoteTraits.focusMovesBeforeIntent` — tvOS : un appui déplace
 * le focus à l'enfoncement et ne s'annonce qu'au relâchement, ~60 ms après ;
 * un glisser, à sa fin), le geste qui vient d'AMENER le focus au bord
 * s'annonce avec le focus déjà dessus : il ne compte pas. D'où l'arrivée
 * datée, et `BEYOND_EDGE_SETTLE_MS`.
 *
 * Un appui ne compte qu'une fois : là où il est annoncé au relâchement
 * (`pressOnRelease`), un signal d'enfoncement n'est pas le geste. Les
 * maintiens ne comptent pas (une flèche maintenue fait défiler le focus).
 * Un événement, une réponse : un titre par geste.
 *
 * Module pur : l'horloge est celle des intentions (`IntentEvent.at`) et des
 * arrivées que l'appelant date de la même façon.
 */

/** Le temps que le focus doit avoir passé sur le bord avant le geste. */
export const BEYOND_EDGE_SETTLE_MS = 400;

/** La dernière prise de focus, datée (ms). */
export interface FocusArrival {
  readonly key: string | null;
  readonly at: number;
}

export const NO_FOCUS_ARRIVAL: FocusArrival = Object.freeze({ key: null, at: 0 });

/** Les faits de la plateforme que la règle lit. */
export type BeyondEdgeTraits = Pick<RemoteTraits, "focusMovesBeforeIntent" | "pressOnRelease">;

/** L'arrivée après un événement de focus : seule une prise la change. */
export function arrivalAfterFocus(arrival: FocusArrival, key: string, focused: boolean, now: number): FocusArrival {
  return focused ? { key, at: now } : arrival;
}

/** Un geste VERS la direction : un glisser, ou un pas — pas son enfoncement là où l'appui s'annonce au relâchement. */
export function isGestureToward(event: IntentEvent, direction: Direction, traits: BeyondEdgeTraits): boolean {
  const { intent, signal } = event;
  if (intent.type === "swipe") return intent.direction === direction;
  if (intent.type !== "move" || intent.direction !== direction) return false;
  return !(traits.pressOnRelease && signal.phase === "down");
}

export interface BeyondEdgeInput {
  /** L'élément du bord ; `null` : rien à écouter. */
  edgeKey: string | null;
  direction: Direction;
  /** La clé qui porte le focus au moment du geste. */
  focusedKey: string | null;
  arrival: FocusArrival;
  traits: BeyondEdgeTraits;
}

/** Ce geste va-t-il au-delà du bord ? */
export function isBeyondEdge(event: IntentEvent, { edgeKey, direction, focusedKey, arrival, traits }: BeyondEdgeInput): boolean {
  if (!edgeKey || !isGestureToward(event, direction, traits)) return false;
  if (focusedKey !== edgeKey) return false;
  const justArrived = arrival.key === edgeKey && event.at - arrival.at < BEYOND_EDGE_SETTLE_MS;
  return !(traits.focusMovesBeforeIntent && justArrived);
}
