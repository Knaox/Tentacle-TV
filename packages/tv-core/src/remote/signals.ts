import type { RemoteIntent } from "./intents";

/**
 * Le signal NATIF, tel qu'un adaptateur le lit — avant toute interprétation —
 * et l'intention datée qu'en tire la table de traduction.
 *
 * Le signal garde le vocabulaire de sa plateforme (le `eventType` de tvOS, un
 * nom de touche…) : c'est l'ENTRÉE des tables (`bindings/`). Seule sa phase
 * est ramenée à trois mots communs, pour que la traduction d'un maintien ou
 * d'un glisser s'écrive une fois : l'enfoncement (ou le doigt qui se pose),
 * ce qui se prolonge, le relâchement (ou le doigt qui se lève).
 *
 * Module pur : ni DOM, ni React Native.
 */

/** La phase physique d'un signal. `null` (dans `RemoteSignal`) : la
 *  plateforme ne la dit pas — tvOS, pour un reconnaisseur « Changed ». */
export type SignalPhase = "down" | "change" | "up";

/** Les mesures d'un geste continu sur une surface tactile. */
export interface SignalMotion {
  /** Translation depuis la pose. */
  x: number;
  y: number;
  /** Vitesse. */
  vx: number;
  vy: number;
}

export interface RemoteSignal {
  /** Le nom du signal dans sa plateforme — tvOS : le `eventType` de
   *  TVEventHandler, ou celui qu'un adaptateur donne à une source à part
   *  (`menu`, pour le Menu que rend `MenuPressInterceptor`). */
  name: string;
  phase: SignalPhase | null;
  motion?: SignalMotion;
  /** La plateforme répète l'appui d'une touche tenue (Android TV, LG). */
  repeat?: boolean;
  /** L'arrivée dans le JS, en millisecondes (`Date.now()` de l'adaptateur). */
  at: number;
}

/** Une intention, datée, avec le signal dont elle vient (diagnostic, et pour
 *  les rares comportements qui doivent savoir COMMENT elle est arrivée). */
export interface IntentEvent<I extends RemoteIntent = RemoteIntent> {
  intent: I;
  at: number;
  signal: RemoteSignal;
}
