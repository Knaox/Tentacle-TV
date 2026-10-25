/**
 * Octave — quand la mer bouge. Une règle, partagée par l'indicateur « en
 * cours » et l'ambiance du lecteur plein écran (règles « Coût GPU » de
 * CLAUDE.md : rien ne tourne quand ce n'est pas affiché) :
 *
 * - `run`   : la musique joue ET la houle est à l'écran, fenêtre visible ;
 * - `still` : la musique joue mais personne ne la voit (hors écran, fenêtre en
 *             arrière-plan) — l'animation est SUSPENDUE, la forme gardée ;
 * - `rest`  : la musique est en pause — la mer se calme, figée.
 *
 * Le mouvement réduit (`prefers-reduced-motion`) se tient dans la feuille :
 * aucune animation, la même composition fixe.
 */

export type SwellState = "run" | "still" | "rest";

export function swellState(playing: boolean, visible: boolean): SwellState {
  if (!playing) return "rest";
  return visible ? "run" : "still";
}
