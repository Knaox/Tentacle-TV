/**
 * La SESSION d'aperçu d'une carte (Apple TV, Android TV) — sa machine, sa
 * requête, son abonnement au cache des aperçus — ne se monte qu'au focus
 * TENU. Une rafale de flèches (un pas toutes les 100 à 300 ms) traverse une
 * rangée sans rien monter ni démonter carte après carte : le JS d'un pas reste
 * celui d'une rangée sans aperçu (demande du 16/10 : « l'aperçu ne doit jamais
 * gêner la navigation »).
 *
 * La machine est datée de l'ARRIVÉE du focus, pas du montage : son rythme
 * (la demande, la première image — `trailerPreviewTv.ts`) ne change pas, tant
 * que l'attente reste sous le plancher de la demande (vérifié par les tests
 * pour chaque délai réglable).
 */

/** Le focus tenu avant que la session d'aperçu de la carte ne se monte. */
export const PREVIEW_SESSION_DWELL_MS = 250;

/** Ce qu'il reste à attendre (ms) avant de monter la session d'un focus arrivé à `since`. */
export function previewSessionDwellLeft(since: number, now: number): number {
  return Math.max(0, since + PREVIEW_SESSION_DWELL_MS - now);
}
