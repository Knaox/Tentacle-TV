/**
 * La décision du badge central, en fonction PURE.
 *
 * Extraite de `usePlaybackFlash` pour être testable : quatre règles s'y croisent
 * — le démarrage qui n'est pas une bascule, les armements comptés du glissement,
 * leur péremption, et l'état inerte d'un rechargement de source — et chacune
 * répond à un badge apparu là où il n'avait rien à faire.
 *
 * Aucun accès au temps ni au DOM : `now` est passé par l'appelant.
 */

/** Ce que le badge doit montrer. */
export type FlashKind = "pause" | "play" | "mute" | "unmute";

/** Durée de validité d'un armement non consommé, en ms. */
export const EXPIRY_MS = 3000;

export interface FlashState {
  /** Dernier état observé, ou `null` avant le premier passage. */
  previous: { paused: boolean; muted: boolean } | null;
  /** La lecture a-t-elle démarré une première fois ? */
  started: boolean;
  /** Horodatages des armements en attente. */
  arms: readonly number[];
}

export const initialFlashState: FlashState = {
  previous: null,
  started: false,
  arms: [],
};

export interface FlashInput {
  paused: boolean;
  muted: boolean;
  /** Le lecteur n'est pas dans un état stable (rechargement de source). */
  inert: boolean;
  now: number;
}

/** Ajoute un armement : la prochaine bascule de pause sera avalée. */
export function arm(state: FlashState, now: number): FlashState {
  return { ...state, arms: [...state.arms, now] };
}

/**
 * Faut-il annoncer quelque chose ? Rend le nouvel état et le badge éventuel.
 *
 * L'ordre des règles compte :
 *  1. avant le premier départ, on s'arme sans rien dire — un lecteur qui monte
 *     passe par `paused: true` puis `false`, et personne n'a rien demandé ;
 *  2. état inerte : on suit sans annoncer, y compris à la sortie de cet état,
 *     puisque la référence est mise à jour au passage ;
 *  3. une bascule de pause consomme un armement s'il en reste un valide ;
 *  4. la coupure du son ne compte que si la pause n'a pas bougé — un seul badge
 *     à la fois.
 */
export function decideFlash(
  state: FlashState,
  input: FlashInput,
): { state: FlashState; kind: FlashKind | null } {
  const { paused, muted, inert, now } = input;
  const before = state.previous;
  const next: FlashState = { ...state, previous: { paused, muted } };

  if (!state.started) {
    return { state: { ...next, started: !paused }, kind: null };
  }
  if (before === null || inert) return { state: next, kind: null };

  if (before.paused !== paused) {
    const valid = state.arms.filter((t) => now - t < EXPIRY_MS);
    if (valid.length > 0) {
      return { state: { ...next, arms: valid.slice(1) }, kind: null };
    }
    return { state: { ...next, arms: [] }, kind: paused ? "pause" : "play" };
  }

  if (before.muted !== muted) {
    return { state: next, kind: muted ? "mute" : "unmute" };
  }
  return { state: next, kind: null };
}
