/**
 * Faut-il relire le réglage « Vous regardez encore ? » du compte ?
 *
 * Une relecture par demi-minute suffit tant que la copie locale a déjà été
 * PROUVÉE par le serveur (`supported`). Tant qu'elle ne l'est pas, le minuteur
 * du lecteur reste éteint : la relecture part à chaque montage, sans attendre
 * — sinon une relecture « manquée » (magasin pas encore créé, réseau coupé)
 * laissait la fonction muette jusqu'au prochain passage par les Réglages.
 */
export const STILL_WATCHING_RESYNC_MIN_INTERVAL_MS = 30_000;

export function shouldResyncStillWatching(input: { supported: boolean; lastResyncAt: number; now: number }): boolean {
  if (!input.supported) return true;
  return input.now - input.lastResyncAt >= STILL_WATCHING_RESYNC_MIN_INTERVAL_MS;
}
