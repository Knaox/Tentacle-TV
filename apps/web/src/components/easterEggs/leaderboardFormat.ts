/**
 * Mise en forme des chiffres du classement.
 *
 * Séparé du rendu pour être vérifiable : ce sont les seules règles du panneau
 * où l'on peut se tromper silencieusement.
 */

/**
 * Durée lisible d'un coup d'œil : « 3 j 4 h » au-delà d'une journée, « 12 h 30 »
 * au-delà d'une heure, « 45 min » en dessous. Jamais de secondes — sur des
 * durées de visionnage elles n'apprennent rien et allongent la ligne.
 */
export function formatDuration(seconds: number | null): string | null {
  if (seconds == null) return null;
  if (seconds < 60) return "< 1 min";

  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days >= 1) {
    const remainingH = hours - days * 24;
    return remainingH > 0 ? `${days} j ${remainingH} h` : `${days} j`;
  }
  if (hours >= 1) {
    const remainingM = minutes - hours * 60;
    return remainingM > 0 ? `${hours} h ${String(remainingM).padStart(2, "0")}` : `${hours} h`;
  }
  return `${minutes} min`;
}

/**
 * Longueur de barre, entre 0 et 1, relative au premier du classement.
 *
 * Un plancher à 4 % : une barre de zéro pixel se lit comme une barre absente,
 * alors que la valeur, elle, est bien affichée à côté.
 */
export function barRatio(value: number | null, maximum: number): number {
  if (!value || value <= 0 || maximum <= 0) return 0;
  return Math.max(0.04, Math.min(1, value / maximum));
}

/** La valeur sur laquelle le classement se joue : durée si connue, sinon titres vus. */
export function rankValue(entree: { watchSeconds: number | null; totalPlayed: number }): number {
  return entree.watchSeconds ?? entree.totalPlayed;
}
