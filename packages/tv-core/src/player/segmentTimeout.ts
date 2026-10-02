/**
 * Un SEGMENT qui tarde — AVPlayer a abandonné l'élément faute de réponse du
 * serveur. Mesuré au simulateur (2026-10-02, transcodage simulé à ×0,3,
 * premier segment à 40 s) : chaque requête de segment est abandonnée au bout
 * de ~6 s (la durée cible) et redemandée ; sans premier segment au bout de
 * ~40 s, l'élément échoue en -12889 (CoreMedia : « pas de réponse pour le
 * fichier média »). Un délai réseau dépassé (-1001, « timed out ») dit la
 * même chose.
 *
 * Sur un TRANSCODAGE, ce n'est ni une panne ni un refus : le serveur
 * travaille encore. Relancer une session neuve tuait ce qu'il avait déjà fait
 * (et la nouvelle repartait de zéro, pour échouer au même endroit) ; on
 * recharge la MÊME session, où le travail fait attend.
 */
const TIMEOUT = /-12889\b|-1001\b|\btimed out\b/i;

export function isSegmentTimeout(error: string): boolean {
  return TIMEOUT.test(error);
}
