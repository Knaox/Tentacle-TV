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
 *    `"nextEpisode"` est émis — une seule fois.
 * Corollaire assumé (l'indépendance stricte est une demande explicite) :
 * fiche éteinte + minuteur + enchaînement = un enchaînement sans surface.
 *
 * Le refus vaut pour L'ÉPISODE en cours et se réarme au changement d'item —
 * même règle que le refus de saut d'intro. Sortir de la fenêtre d'éligibilité
 * (retour en arrière) remet le minuteur à zéro ; y revenir le réarme.
 *
 * Il y a DEUX refus, un par surface : écarter la carte du générique dit
 * « dégage de mon image », pas « renonce à la suite » — l'affiche de fin garde
 * son tour, avec un décompte neuf. La croix de l'AFFICHE est l'autre refus, et
 * lui seul l'éteint. Un troisième geste, l'annulation de séance (Watch
 * Together), tue le MINUTEUR sans toucher aux surfaces : la salle a dit non à
 * l'enchaînement, pas aux propositions.
 *
 * L'éligibilité (« le déclencheur est-il franchi ») est calculée PAR
 * L'APPELANT avec le même sélecteur que l'arbitre — le moteur ne connaît ni
 * position ni segments, il ne peut donc pas diverger de l'affichage.
 */

/**
 * Le décompte livré. Il n'est plus une constante mais un DÉFAUT : la durée est
 * réglable (`nextCountdownMs`), et le moteur la raccourcit quand il le faut.
 */
export const NEXT_COUNTDOWN_MS = 10_000;

/**
 * Ce qu'on garde devant soi : le décompte doit expirer AVANT la fin du média,
 * jamais après.
 *
 * Sans cette marge, une fiche qui paraît quatre secondes avant la fin
 * décomptait dix secondes : l'épisode se terminait, l'écran de fin prenait la
 * main, et l'enchaînement partait six secondes plus tard — sur un écran de fin
 * qu'on regardait sans comprendre pourquoi il durait. Le décompte se cale
 * désormais sur ce qui reste : quatre secondes de média, trois et demie de
 * décompte.
 */
export const NEXT_COUNTDOWN_END_MARGIN_MS = 500;

/**
 * La durée réellement décomptée : le réglage, ou ce que le média peut encore
 * offrir. `remainingMediaMs` inconnu (0 ou moins) → on s'en tient au réglage,
 * faute de mieux.
 */
export function armedCountdownMs(configuredMs: number, remainingMediaMs: number): number {
  if (!Number.isFinite(remainingMediaMs) || remainingMediaMs <= 0) return configuredMs;
  return Math.max(0, Math.min(configuredMs, remainingMediaMs - NEXT_COUNTDOWN_END_MARGIN_MS));
}

export interface AutoNextState {
  phase: "idle" | "card" | "final";
  /** ms restantes du minuteur, null = aucun minuteur en cours. */
  remainingMs: number | null;
  /**
   * La durée dont ce minuteur est PARTI — celle que la barre de progression
   * mesure. Distincte du réglage : le moteur la raccourcit quand la fin du
   * média approche, et une barre qui se remplirait sur dix secondes alors que
   * le minuteur en compte trois et demie mentirait à l'œil.
   */
  armedMs: number | null;
  /** La croix a été donnée pour CET épisode — sur la carte ou la pilule. */
  dismissed: boolean;
  /** La croix de l'AFFICHE DE FIN — un autre refus, une autre surface. */
  finalDismissed: boolean;
  /**
   * Le décompte est annulé pour l'épisode (refus en séance Watch Together) :
   * plus aucun minuteur ne s'arme, mais les surfaces restent des propositions.
   */
  countdownCanceled: boolean;
  /** L'effet a déjà été émis (le temps que la navigation aboutisse). */
  chained: boolean;
  forItemId: string | null;
}

export const AUTO_NEXT_IDLE: AutoNextState = {
  phase: "idle",
  remainingMs: null,
  armedMs: null,
  dismissed: false,
  finalDismissed: false,
  countdownCanceled: false,
  chained: false,
  forItemId: null,
};

export type AutoNextInput =
  | {
      type: "frame";
      /** Le déclencheur de la carte est franchi (sélecteur partagé). */
      eligible: boolean;
      /** La lecture est arrivée au bout (EOF) — l'écran de fin. */
      ended: boolean;
      elapsedMs: number;
      /**
       * Ce qu'il reste de média, en ms. Lu UNIQUEMENT à l'armement, et
       * facultatif : un appelant qui ne le sait pas garde le comportement
       * d'avant (le réglage, tel quel).
       */
      remainingMediaMs?: number;
    }
  | { type: "item"; itemId: string }
  | { type: "dismiss" }
  | { type: "dismissFinal" }
  | { type: "cancelCountdown" }
  | { type: "playNow" };

export type AutoNextEffect = "none" | "nextEpisode";

export interface AutoNextConfig {
  hasNextEpisode: boolean;
  nextCountdown: boolean;
  nextAutoPlay: boolean;
  /** Durée voulue du décompte. Absente : la valeur livrée. */
  nextCountdownMs?: number;
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
    if (state.forItemId === input.itemId) return [state, "none"];
    return [{ ...AUTO_NEXT_IDLE, forItemId: input.itemId }, "none"];
  }

  if (input.type === "dismiss") {
    return [{ ...state, dismissed: true, remainingMs: null, armedMs: null, phase: "idle" }, "none"];
  }

  if (input.type === "dismissFinal") {
    return [
      { ...state, finalDismissed: true, remainingMs: null, armedMs: null, phase: "idle" },
      "none",
    ];
  }

  if (input.type === "cancelCountdown") {
    // La phase reste : la surface demeure une proposition, seul l'acte meurt.
    return [{ ...state, countdownCanceled: true, remainingMs: null, armedMs: null }, "none"];
  }

  if (input.type === "playNow") {
    if (state.chained || !config.hasNextEpisode) return [state, "none"];
    return [{ ...state, chained: true, remainingMs: null, armedMs: null }, "nextEpisode"];
  }

  // ── Battement de cadre ──
  // Chaque surface n'obéit qu'à SON refus : la carte au sien, l'affiche de
  // fin au sien — écarter l'une n'a jamais éteint l'autre.
  const refused = input.ended ? state.finalDismissed : state.dismissed;
  const active = config.hasNextEpisode && !refused && !state.chained;
  if (!active || (!input.eligible && !input.ended)) {
    // Hors fenêtre (ou refusé) : le minuteur retombe, prêt à se réarmer.
    if (state.phase === "idle" && state.remainingMs === null) return [state, "none"];
    return [{ ...state, phase: "idle", remainingMs: null, armedMs: null }, "none"];
  }

  const phase = input.ended ? "final" : "card";

  // Armement au front d'entrée dans la fenêtre. L'escalade carte → écran de
  // fin CONSERVE le minuteur en cours (comportement TV historique) : la fin du
  // média n'offre pas un sursis. À l'EOF en revanche, un armement NEUF (carte
  // refusée puis affiche) prend la durée réglée ENTIÈRE : le média est fini,
  // la marge « expirer avant la fin » n'a plus d'objet — sans quoi un runtime
  // de contrat plus court que le fichier armait un décompte de zéro seconde.
  let remainingMs = state.remainingMs;
  let armedMs = state.armedMs;
  if (state.phase === "idle") {
    const configured = config.nextCountdownMs ?? NEXT_COUNTDOWN_MS;
    remainingMs =
      config.nextCountdown && !state.countdownCanceled
        ? input.ended
          ? configured
          : armedCountdownMs(configured, input.remainingMediaMs ?? 0)
        : null;
    armedMs = remainingMs;
  }

  if (remainingMs === null) {
    // Référence STABLE quand rien ne change : l'appelant React s'appuie sur
    // l'identité de l'état pour ne pas re-rendre à chaque battement.
    if (state.phase === phase && state.remainingMs === null) return [state, "none"];
    return [{ ...state, phase, remainingMs: null, armedMs: null }, "none"];
  }

  remainingMs -= Math.max(0, input.elapsedMs);
  if (remainingMs > 0) return [{ ...state, phase, remainingMs, armedMs }, "none"];

  // Expiration : l'acte n'appartient qu'à `nextAutoPlay`, et une seule fois.
  if (config.nextAutoPlay) {
    return [{ ...state, phase, remainingMs: null, armedMs: null, chained: true }, "nextEpisode"];
  }
  return [{ ...state, phase, remainingMs: null, armedMs: null }, "none"];
}
