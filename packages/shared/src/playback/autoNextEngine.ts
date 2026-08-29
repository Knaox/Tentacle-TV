/**
 * LE moteur d'enchaînement d'épisode — un réducteur pur, à la place des
 * quatre implémentations (web, bureau, mobile, TV) et du filet DOM webOS.
 *
 * Les trois réglages sont STRICTEMENT indépendants, à la lettre :
 *  - `nextCard` gouverne l'AFFICHAGE de la fiche (c'est l'arbitre qui le lit) ;
 *  - `nextCountdown` gouverne le MINUTEUR : sans lui, la fiche est une simple
 *    proposition ; avec lui mais sans `nextAutoPlay`, le minuteur va au bout
 *    et il ne se passe rien ;
 *  - `nextAutoPlay` gouverne l'ACTE : à l'expiration du minuteur, l'effet
 *    `"epsSuivant"` est émis — une seule fois.
 * Corollaire assumé (l'indépendance stricte est une demande explicite) :
 * fiche éteinte + minuteur + enchaînement = un enchaînement sans surface.
 *
 * Le refus vaut pour L'ÉPISODE en cours et se réarme au changement d'item —
 * même règle que le refus de saut d'intro. Sortir de la fenêtre d'éligibilité
 * (retour en arrière) remet le minuteur à zéro ; y revenir le réarme.
 *
 * L'éligibilité (« le déclencheur est-il franchi ») est calculée PAR
 * L'APPELANT avec le même sélecteur que l'arbitre — le moteur ne connaît ni
 * position ni segments, il ne peut donc pas diverger de l'affichage.
 */

/** LA constante — remplace les cinq « 10 » dispersés du dépôt. */
export const NEXT_COUNTDOWN_MS = 10_000;

export interface AutoNextState {
  phase: "repos" | "carte" | "final";
  /** ms restantes du minuteur, null = aucun minuteur en cours. */
  remainingMs: number | null;
  /** La croix a été donnée pour CET épisode. */
  dismissed: boolean;
  /** L'effet a déjà été émis (le temps que la navigation aboutisse). */
  chained: boolean;
  forItemId: string | null;
}

export const AUTO_NEXT_IDLE: AutoNextState = {
  phase: "repos",
  remainingMs: null,
  dismissed: false,
  chained: false,
  forItemId: null,
};

export type AutoNextInput =
  | {
      type: "cadre";
      /** Le déclencheur de la carte est franchi (sélecteur partagé). */
      eligible: boolean;
      /** La lecture est arrivée au bout (EOF) — l'écran de fin. */
      ended: boolean;
      elapsedMs: number;
    }
  | { type: "item"; itemId: string }
  | { type: "refus" }
  | { type: "lireMaintenant" };

export type AutoNextEffect = "rien" | "epsSuivant";

export interface AutoNextConfig {
  hasNextEpisode: boolean;
  /** Garde serveur admin (`autoplay_next_enabled`). */
  serverEnabled: boolean;
  nextCountdown: boolean;
  nextAutoPlay: boolean;
}

/** Secondes affichées sur la fiche, null = pas d'échéance annoncée. */
export const displayedNextCountdown = (state: AutoNextState): number | null =>
  state.remainingMs === null ? null : Math.max(0, Math.ceil(state.remainingMs / 1000));

export function decideAutoNext(
  state: AutoNextState,
  input: AutoNextInput,
  config: AutoNextConfig,
): [AutoNextState, AutoNextEffect] {
  if (input.type === "item") {
    // Nouvel épisode : tout se réarme, le refus ne suit pas.
    if (state.forItemId === input.itemId) return [state, "rien"];
    return [{ ...AUTO_NEXT_IDLE, forItemId: input.itemId }, "rien"];
  }

  if (input.type === "refus") {
    return [{ ...state, dismissed: true, remainingMs: null, phase: "repos" }, "rien"];
  }

  if (input.type === "lireMaintenant") {
    if (state.chained || !config.hasNextEpisode) return [state, "rien"];
    return [{ ...state, chained: true, remainingMs: null }, "epsSuivant"];
  }

  // ── Battement de cadre ──
  const active = config.hasNextEpisode && config.serverEnabled && !state.dismissed && !state.chained;
  if (!active || (!input.eligible && !input.ended)) {
    // Hors fenêtre (ou refusé) : le minuteur retombe, prêt à se réarmer.
    if (state.phase === "repos" && state.remainingMs === null) return [state, "rien"];
    return [{ ...state, phase: "repos", remainingMs: null }, "rien"];
  }

  const phase = input.ended ? "final" : "carte";

  // Armement au front d'entrée dans la fenêtre. L'escalade carte → écran de
  // fin CONSERVE le minuteur en cours (comportement TV historique) : la fin du
  // média n'offre pas un sursis.
  let remainingMs = state.remainingMs;
  if (state.phase === "repos") {
    remainingMs = config.nextCountdown ? NEXT_COUNTDOWN_MS : null;
  }

  if (remainingMs === null) {
    // Référence STABLE quand rien ne change : l'appelant React s'appuie sur
    // l'identité de l'état pour ne pas re-rendre à chaque battement.
    if (state.phase === phase && state.remainingMs === null) return [state, "rien"];
    return [{ ...state, phase, remainingMs: null }, "rien"];
  }

  remainingMs -= Math.max(0, input.elapsedMs);
  if (remainingMs > 0) return [{ ...state, phase, remainingMs }, "rien"];

  // Expiration : l'acte n'appartient qu'à `nextAutoPlay`, et une seule fois.
  if (config.nextAutoPlay) {
    return [{ ...state, phase, remainingMs: null, chained: true }, "epsSuivant"];
  }
  return [{ ...state, phase, remainingMs: null }, "rien"];
}
