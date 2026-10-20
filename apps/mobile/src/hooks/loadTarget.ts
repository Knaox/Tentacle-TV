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
