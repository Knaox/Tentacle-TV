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
  resteMs: number | null;
  /** La croix a été donnée pour CET épisode. */
  refuse: boolean;
  /** L'effet a déjà été émis (le temps que la navigation aboutisse). */
  enchaine: boolean;
  pourItemId: string | null;
}

export const AUTO_NEXT_REPOS: AutoNextState = {
  phase: "repos",
  resteMs: null,
  refuse: false,
  enchaine: false,
  pourItemId: null,
};

export type AutoNextEntree =
  | {
      type: "cadre";
      /** Le déclencheur de la carte est franchi (sélecteur partagé). */
      eligible: boolean;
      /** La lecture est arrivée au bout (EOF) — l'écran de fin. */
      termine: boolean;
      ecouleMs: number;
    }
  | { type: "item"; itemId: string }
  | { type: "refus" }
  | { type: "lireMaintenant" };

export type AutoNextEffet = "rien" | "epsSuivant";

export interface AutoNextConfig {
  hasNextEpisode: boolean;
  /** Garde serveur admin (`autoplay_next_enabled`). */
  serverEnabled: boolean;
  nextCountdown: boolean;
  nextAutoPlay: boolean;
}

/** Secondes affichées sur la fiche, null = pas d'échéance annoncée. */
export const compteAfficheEnchainement = (etat: AutoNextState): number | null =>
  etat.resteMs === null ? null : Math.max(0, Math.ceil(etat.resteMs / 1000));

export function decideAutoNext(
  etat: AutoNextState,
  entree: AutoNextEntree,
  config: AutoNextConfig,
): [AutoNextState, AutoNextEffet] {
  if (entree.type === "item") {
    // Nouvel épisode : tout se réarme, le refus ne suit pas.
    if (etat.pourItemId === entree.itemId) return [etat, "rien"];
    return [{ ...AUTO_NEXT_REPOS, pourItemId: entree.itemId }, "rien"];
  }

  if (entree.type === "refus") {
    return [{ ...etat, refuse: true, resteMs: null, phase: "repos" }, "rien"];
  }

  if (entree.type === "lireMaintenant") {
    if (etat.enchaine || !config.hasNextEpisode) return [etat, "rien"];
    return [{ ...etat, enchaine: true, resteMs: null }, "epsSuivant"];
  }

  // ── Battement de cadre ──
  const actif = config.hasNextEpisode && config.serverEnabled && !etat.refuse && !etat.enchaine;
  if (!actif || (!entree.eligible && !entree.termine)) {
    // Hors fenêtre (ou refusé) : le minuteur retombe, prêt à se réarmer.
    if (etat.phase === "repos" && etat.resteMs === null) return [etat, "rien"];
    return [{ ...etat, phase: "repos", resteMs: null }, "rien"];
  }

  const phase = entree.termine ? "final" : "carte";

  // Armement au front d'entrée dans la fenêtre. L'escalade carte → écran de
  // fin CONSERVE le minuteur en cours (comportement TV historique) : la fin du
  // média n'offre pas un sursis.
  let resteMs = etat.resteMs;
  if (etat.phase === "repos") {
    resteMs = config.nextCountdown ? NEXT_COUNTDOWN_MS : null;
  }

  if (resteMs === null) {
    // Référence STABLE quand rien ne change : l'appelant React s'appuie sur
    // l'identité de l'état pour ne pas re-rendre à chaque battement.
    if (etat.phase === phase && etat.resteMs === null) return [etat, "rien"];
    return [{ ...etat, phase, resteMs: null }, "rien"];
  }

  resteMs -= Math.max(0, entree.ecouleMs);
  if (resteMs > 0) return [{ ...etat, phase, resteMs }, "rien"];

  // Expiration : l'acte n'appartient qu'à `nextAutoPlay`, et une seule fois.
  if (config.nextAutoPlay) {
    return [{ ...etat, phase, resteMs: null, enchaine: true }, "epsSuivant"];
  }
  return [{ ...etat, phase, resteMs: null }, "rien"];
}
