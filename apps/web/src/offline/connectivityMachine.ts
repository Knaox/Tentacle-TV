/**
 * Machine à états de la connectivité — LOGIQUE PURE, sans effet de bord.
 *
 * Sépare l'hystérésis (combien d'échecs/succès consécutifs avant de basculer,
 * temps de séjour minimal anti-flapping) du store qui sonde réellement le
 * réseau (`connectivityStore.ts`). Pur = testable en isolation (vitest) et
 * insensible aux timers/fetch.
 *
 * Deux dimensions orthogonales :
 * - la JOIGNABILITÉ (`reachable`), pilotée par les sondes avec hystérésis ;
 * - le MODE (`auto` / manuel), choisi par l'utilisateur (desktop uniquement).
 * L'état affiché (`ConnectivityState`) est dérivé des deux : le mode manuel
 * gagne toujours — on n'en sort QUE manuellement.
 */

export type ConnectivityState = "checking" | "online" | "offline-auto" | "offline-manual";

export interface HysteresisConfig {
  /** Nombre de résultats consécutifs opposés requis pour basculer. */
  flipThreshold: number;
  /** Temps de séjour minimal dans un état avant d'autoriser la bascule inverse. */
  dwellMs: number;
}

export interface HysteresisState {
  /** Dernière joignabilité CONFIRMÉE (null = jamais sondée → « checking »). */
  reachable: boolean | null;
  /** Résultats consécutifs contredisant `reachable`. */
  streak: number;
  /** Horodatage de la dernière bascule (pour le dwell). */
  lastFlipAt: number;
}

export interface ProbeOutcome {
  next: HysteresisState;
  /** true si `reachable` vient de changer. */
  flipped: boolean;
  /** true si une sonde de confirmation rapprochée est souhaitable. */
  wantConfirm: boolean;
}

export const initialHysteresis: HysteresisState = {
  reachable: null,
  streak: 0,
  lastFlipAt: 0,
};

/**
 * Applique un résultat de sonde. Premier résultat = vérité immédiate (pas
 * d'hystérésis au boot). Ensuite : un résultat conforme remet le compteur à
 * zéro ; un résultat contraire l'incrémente et ne bascule qu'au seuil ET après
 * le temps de séjour minimal — sinon on redemande une confirmation rapprochée.
 */
export function applyProbeResult(
  state: HysteresisState,
  ok: boolean,
  now: number,
  cfg: HysteresisConfig,
): ProbeOutcome {
  if (state.reachable === null) {
    return {
      next: { reachable: ok, streak: 0, lastFlipAt: now },
      flipped: true,
      wantConfirm: false,
    };
  }

  if (ok === state.reachable) {
    if (state.streak === 0) return { next: state, flipped: false, wantConfirm: false };
    return { next: { ...state, streak: 0 }, flipped: false, wantConfirm: false };
  }

  const streak = state.streak + 1;
  const dwellElapsed = now - state.lastFlipAt >= cfg.dwellMs;
  if (streak >= cfg.flipThreshold && dwellElapsed) {
    return {
      next: { reachable: ok, streak: 0, lastFlipAt: now },
      flipped: true,
      wantConfirm: false,
    };
  }
  return { next: { ...state, streak }, flipped: false, wantConfirm: true };
}

/** Dérive l'état affiché : le mode manuel gagne toujours. */
export function deriveState(manual: boolean, reachable: boolean | null): ConnectivityState {
  if (manual) return "offline-manual";
  if (reachable === null) return "checking";
  return reachable ? "online" : "offline-auto";
}
