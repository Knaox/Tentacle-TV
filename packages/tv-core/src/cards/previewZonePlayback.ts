/**
 * La zone d'aperçu PENDANT la bande-annonce (Apple TV, Android TV) — retour
 * de Damien du 18/10 : « on ne voit pas bien la bande-annonce, et le texte
 * raccourci dérange pendant qu'on la regarde ». Façon Netflix au salon : dès
 * que la vidéo a sa première image, la zone s'efface devant elle.
 *
 * - le TEXTE se retire : surtitre, raison, ligne de métadonnées et synopsis
 *   s'effacent en fondu ; le logo (ou le titre écrit) reste, réduit, posé en
 *   bas du bloc — il dit encore ce qu'on regarde, sans couvrir l'image ;
 * - les VOILES s'allègent : le fondu vers le noir à gauche et en bas ne garde
 *   que ce qui raccorde la vidéo au noir de la page (aucune arête), la vidéo
 *   se voit sur toute sa largeur utile.
 *
 * Tout revient au changement de focus (la vidéo sort), à la fin de l'aperçu,
 * et quand l'aperçu est mis en PAUSE (Lecture/Pause) : on s'arrête pour lire.
 * Seules des opacités et des transformations s'animent : rien ne se remet en
 * page, la navigation n'attend rien.
 *
 * Module pur.
 */

export const PREVIEW_ZONE_PLAYBACK = {
  /** Le texte qui se retire, sur l'entrée de la vidéo (360 ms) : un peu plus posé. */
  recedeMs: 420,
  /** Le texte qui revient : plus bref (la sortie de la vidéo, 180 ms, et un peu plus). */
  returnMs: 240,
  /** L'échelle du logo pendant la vidéo (ancré en bas à gauche). */
  titleScale: 0.66,
} as const;

export interface PreviewZonePlaybackInput {
  /** La vidéo de la zone a sa première image, et se montre. */
  videoShown: boolean;
  /** L'aperçu est en pause (Lecture/Pause). */
  paused: boolean;
}

/** Vrai quand la zone s'efface devant la vidéo : texte retiré, logo réduit, voiles allégés. */
export function previewZoneWatching(input: PreviewZonePlaybackInput): boolean {
  return input.videoShown && !input.paused;
}

/** La durée du fondu vers l'état demandé. */
export function previewZoneWatchingMs(watching: boolean): number {
  return watching ? PREVIEW_ZONE_PLAYBACK.recedeMs : PREVIEW_ZONE_PLAYBACK.returnMs;
}
