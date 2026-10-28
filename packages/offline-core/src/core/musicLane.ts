/**
 * Les places du moteur : un film à la fois (`MAX_PARALLEL`), mais PLUSIEURS
 * titres de musique quand la plateforme le demande (`EngineDeps.musicParallelLimit`,
 * bureau).
 *
 * Un titre d'Octave pèse quelques mégaoctets et son temps part dans la
 * PRÉPARATION du serveur (une extraction, un transcodage qui démarre), pas dans
 * la bande passante : un à un, une playlist attendait chaque préparation tour à
 * tour (1,47 s par titre au banc, 28/10, dont 0,04 s de transfert). Plusieurs à
 * la fois, les préparations se recouvrent ; le serveur reste l'arbitre de leur
 * rythme (la garde YouTube d'une extension, le plafond de débit du cœur).
 *
 * Jamais un film à côté d'un titre, ni l'inverse : la file reste FIFO et la tête
 * attend que sa place se libère.
 */

export interface Lanes {
  /** Les places de tous les transferts (`parallelLimit`). */
  all: number;
  /** Les places des titres de musique ; à `all` ou moins, aucune de plus. */
  music: number;
}

/** La tête de file peut-elle partir à côté de ce qui tourne ? */
export function mayStart(next: { music: boolean }, active: { total: number; music: number }, lanes: Lanes): boolean {
  if (next.music && lanes.music > lanes.all) return active.total === active.music && active.music < lanes.music;
  return active.total < lanes.all;
}
