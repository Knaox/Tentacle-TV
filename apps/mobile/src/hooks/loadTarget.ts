import { TICKS_PER_SECOND } from "@tentacle-tv/shared";

/**
 * Où poser le lecteur à son chargement (`handleLoad`) : au PREMIER chargement
 * d'un titre, la position de départ voulue — celle de la séance Watch Together
 * quand elle l'impose (`startOverrideSeconds`, 0 compris), sinon la reprise
 * Jellyfin personnelle ; aux suivants (piste, qualité, relance), la position
 * courante.
 *
 * Le bug (banc du 20/10, retour de Damien) : en séance, le premier chargement
 * sautait à la reprise PERSONNELLE de l'arrivant (56,8 s) alors que la salle
 * l'attendait à 115 s ; s'il calait là, la salle se gelait en arrière, l'hôte
 * reculait avec elle.
 */
export function loadTargetSeconds(opts: {
  firstLoad: boolean;
  currentS: number;
  resumeTicks: number | null | undefined;
  startOverrideSeconds: number | undefined;
}): number {
  if (!opts.firstLoad) return opts.currentS;
  if (opts.startOverrideSeconds !== undefined) return opts.startOverrideSeconds;
  return (opts.resumeTicks ?? 0) / TICKS_PER_SECOND;
}

/** Un saut de départ en cours d'atterrissage : sa cible, et quand il est parti. */
export interface StartLanding {
  targetS: number;
  sinceMs: number;
}

/** Atterri : la progression annoncée est à moins de ça de la cible. */
export const LANDING_TOLERANCE_S = 5;
/** Au-delà, la progression fait foi même loin de la cible (un saut qui n'atterrit pas). */
export const LANDING_TIMEOUT_MS = 10_000;

/**
 * La progression annoncée peut-elle devenir la position du lecteur ? Pas tant
 * que le saut de départ (`handleLoad`) n'a pas atterri : Android annonce encore
 * 0 s, et une renégociation du flux à ce moment (préférence de piste)
 * repartait de là — l'arrivant d'une séance Watch Together se disait prêt à
 * 0 s (banc du 21/10).
 */
export function progressCountsAsPosition(landing: StartLanding | null, positionS: number, nowMs: number): boolean {
  if (!landing) return true;
  return Math.abs(positionS - landing.targetS) <= LANDING_TOLERANCE_S || nowMs - landing.sinceMs >= LANDING_TIMEOUT_MS;
}
