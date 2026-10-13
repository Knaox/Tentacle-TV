/**
 * Les RÈGLES de vie de la mini-carte d'aperçu — pures, sans DOM ni React :
 * quand elle se ferme, comment (en douceur, ou d'un coup), et où va le focus
 * au clavier. `useCardPreview` ne fait que brancher les évènements dessus.
 *
 * Deux façons de se fermer :
 *
 *   • EN DOUCEUR (`soft`) — Échap, clic ailleurs, fenêtre quittée : la
 *     mini-carte revient se poser sur sa carte (sortie animée). Le curseur
 *     est immobile, rien ne bouge sous elle.
 *   • D'UN COUP (`dry`) — défilement, molette, redimensionnement : la page
 *     bouge SOUS une mini-carte fixée à l'écran. Une sortie animée y resterait
 *     clouée pendant que sa carte s'en va (le « survol fantôme », payé par
 *     l'ancien panneau d'aperçu) : elle disparaît net.
 *
 * Dans les deux cas, l'aperçu reste fermé jusqu'à la fin du survol de la
 * carte : on ne rouvre pas sous le nez de qui vient de le refuser.
 */

export type PreviewClosing = "soft" | "dry";

/** Ce qui peut fermer une mini-carte montrée. */
export type PreviewCloseCause =
  | "scroll"
  | "wheel"
  | "resize"
  | "escape"
  | "window-blur"
  | "pointer-outside";

export function previewClosingFor(cause: PreviewCloseCause): PreviewClosing {
  switch (cause) {
    case "scroll":
    case "wheel":
    case "resize":
      return "dry";
    case "escape":
    case "window-blur":
    case "pointer-outside":
      return "soft";
  }
}

/** La porte de l'aperçu d'une carte. */
export interface PreviewGate {
  /** Fermé par l'utilisateur : rien ne se rouvre avant la fin du survol. */
  dismissed: boolean;
  /** Fermé d'un coup : la mini-carte n'est plus rendue, même pendant le fondu du moteur. */
  cut: boolean;
}

export const OPEN_GATE: PreviewGate = { dismissed: false, cut: false };

export function gateAfterClose(gate: PreviewGate, closing: PreviewClosing): PreviewGate {
  return { dismissed: true, cut: gate.cut || closing === "dry" };
}

/**
 * La porte suit la carte et le moteur : la fin du survol la rouvre, la vidéo
 * démontée lève la coupure. Même objet rendu quand rien ne change (état React).
 */
export function gateAfterInputs(gate: PreviewGate, inputs: { hovered: boolean; engineMounted: boolean }): PreviewGate {
  const dismissed = gate.dismissed && inputs.hovered;
  const cut = gate.cut && inputs.engineMounted;
  return dismissed === gate.dismissed && cut === gate.cut ? gate : { dismissed, cut };
}

/**
 * Le survol que voit le MOTEUR : celui de la carte, moins ce qui l'interdit —
 * une carte sans bande-annonce possible, un aperçu coupé (menu contextuel,
 * sélection), refusé (porte fermée), ou un focus clavier posé sur le plateau
 * de la carte elle-même : on n'agrandit pas sous les doigts de qui y navigue.
 */
export function engineHovered(input: {
  hovered: boolean;
  hasSubject: boolean;
  disabled: boolean;
  gate: PreviewGate;
  keyboardInCard: boolean;
}): boolean {
  return input.hovered && input.hasSubject && !input.disabled && !input.gate.dismissed && !input.keyboardInCard;
}

/**
 * Ce que la mini-carte rend : MONTÉE dès que le moteur a sa vidéo (cachée,
 * hors du flux), VUE seulement quand le moteur la montre ET qu'elle est placée
 * et révélée (son départ calculé). Jamais vue sans bande-annonce prête ni
 * après une fermeture.
 */
export function previewStage(input: {
  engineMounted: boolean;
  engineVisible: boolean;
  gate: PreviewGate;
  placed: boolean;
  revealed: boolean;
}): { mounted: boolean; shown: boolean } {
  const mounted = input.engineMounted && !input.gate.cut && input.placed;
  return { mounted, shown: mounted && input.engineVisible && !input.gate.dismissed && input.revealed };
}

/** Où se trouve le focus, vu de la mini-carte. */
export type PreviewFocusSpot =
  | "owner"
  | "preview-first"
  | "preview-last"
  | "preview-only"
  | "preview-middle"
  | "elsewhere";

/** Ce que fait une tabulation, mini-carte montrée. */
export type PreviewTabMove = "enter-preview" | "back-to-owner" | "after-card" | null;

/**
 * La mini-carte vit dans un portail, à la fin du document : sans aide, la
 * tabulation la sauterait. On l'INSÈRE donc dans le parcours, juste après la
 * carte : Tab depuis la carte entre dans la mini-carte (bouton du son, étoiles,
 * plateau), Tab depuis son dernier bouton reprend après la carte, Maj+Tab
 * depuis son premier bouton revient sur la carte. Partout ailleurs, le
 * navigateur fait son travail.
 */
export function previewTabMove(spot: PreviewFocusSpot, shift: boolean): PreviewTabMove {
  if (spot === "owner") return shift ? null : "enter-preview";
  if (spot === "preview-only") return shift ? "back-to-owner" : "after-card";
  if (spot === "preview-first") return shift ? "back-to-owner" : null;
  if (spot === "preview-last") return shift ? null : "after-card";
  return null;
}
