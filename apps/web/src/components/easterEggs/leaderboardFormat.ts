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
export function formaterDuree(secondes: number | null): string | null {
  if (secondes == null) return null;
  if (secondes < 60) return "< 1 min";

  const minutes = Math.floor(secondes / 60);
  const heures = Math.floor(minutes / 60);
  const jours = Math.floor(heures / 24);

  if (jours >= 1) {
    const resteH = heures - jours * 24;
    return resteH > 0 ? `${jours} j ${resteH} h` : `${jours} j`;
  }
  if (heures >= 1) {
    const resteM = minutes - heures * 60;
    return resteM > 0 ? `${heures} h ${String(resteM).padStart(2, "0")}` : `${heures} h`;
  }
  return `${minutes} min`;
}

/**
 * Longueur de barre, entre 0 et 1, relative au premier du classement.
 *
 * Un plancher à 4 % : une barre de zéro pixel se lit comme une barre absente,
 * alors que la valeur, elle, est bien affichée à côté.
 */
export function ratioBarre(valeur: number | null, maximum: number): number {
  if (!valeur || valeur <= 0 || maximum <= 0) return 0;
  return Math.max(0.04, Math.min(1, valeur / maximum));
}

/** La valeur sur laquelle le classement se joue : durée si connue, sinon titres vus. */
export function valeurDeRang(entree: { watchSeconds: number | null; totalPlayed: number }): number {
  return entree.watchSeconds ?? entree.totalPlayed;
}
