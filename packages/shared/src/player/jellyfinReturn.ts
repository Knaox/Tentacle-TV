/**
 * Ce qu'un lecteur fait quand Jellyfin REVIENT d'une panne — la même règle
 * pour les six lecteurs (web et webOS, bureau mpv, mobile, Apple TV, Android
 * TV), pure.
 *
 * Le retour est TRANSPARENT : une lecture qui a tenu sur sa réserve continue,
 * sans rien recharger. Le serveur Tentacle redit lui-même la lecture à
 * Jellyfin (`/Sessions/Playing` puis `/Progress`, à la position), et le
 * lecteur reprend son flux là où sa réserve s'arrête, tout seul : mpv se
 * reconnecte (`stream-lavf-o=reconnect…`), hls.js redemande le segment
 * suivant, et Jellyfin relance l'encodage de ce segment-là.
 *
 * Le flux ne se rouvre (même position, mêmes pistes, nouvelle session) que
 * s'il le FAUT :
 *  - la lecture n'avait pas démarré (la négociation est morte avec Jellyfin) ;
 *  - le lecteur a perdu son flux PENDANT la panne (erreur tue alors) ;
 *  - après le retour, une erreur, ou une image arrêtée plus de
 *    `RETURN_STALL_MS` : l'URL ne vaut plus, l'encodage ne repart pas, ou la
 *    réserve s'est épuisée sans que le lecteur sache se reconnecter. Une fois
 *    par retour, pendant `RETURN_WATCH_MS` — au-delà, une erreur est un vrai
 *    problème, diagnostiqué.
 */

/** Après un retour, ce qui casse est encore mis sur le compte de la panne (la réserve de mpv tient 30 s, celle d'un navigateur bien plus). */
export const RETURN_WATCH_MS = 180_000;
/** Une image arrêtée après le retour : le temps laissé au lecteur pour se reconnecter seul, avant de rouvrir. */
export const RETURN_STALL_MS = 5_000;

export type JellyfinReturnAction = "resume" | "reopen";

export function decideJellyfinReturn(p: { started: boolean; failedDuringOutage: boolean }): JellyfinReturnAction {
  return !p.started || p.failedDuringOutage ? "reopen" : "resume";
}

/** La fenêtre d'après-retour est-elle encore ouverte ? */
export function withinReturnWatch(now: number, returnedAt: number | null): boolean {
  return returnedAt !== null && now - returnedAt < RETURN_WATCH_MS;
}

/**
 * Une image arrêtée après le retour : quand rouvrir ? `null` : jamais (hors
 * fenêtre, ou déjà rouvert pour ce retour). L'attente court depuis le plus
 * tardif de l'arrêt et du retour : un lecteur arrêté PENDANT la panne a lui
 * aussi droit à sa reconnexion.
 */
export function returnStallDeadline(p: {
  now: number;
  returnedAt: number | null;
  stalledSince: number | null;
  reopened: boolean;
}): number | null {
  if (p.reopened || p.stalledSince === null || p.returnedAt === null) return null;
  const deadline = Math.max(p.stalledSince, p.returnedAt) + RETURN_STALL_MS;
  return deadline - p.returnedAt < RETURN_WATCH_MS ? deadline : null;
}
