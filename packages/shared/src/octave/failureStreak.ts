/**
 * Octave — les titres SANS SOURCE d'affilée. Un titre qui ne peut pas être lu
 * est signalé puis passé ; mais une file de titres injouables (reprises,
 * remix introuvables) ne doit pas défiler toute seule jusqu'au bout — chaque
 * passage coûte une résolution à l'extension (relevé du 25/10, défaut R2-04 :
 * 8 titres sautés en 12 s, puis un plafond de requêtes atteint et le dernier
 * resté muet). Au 3e d'affilée, le lecteur s'arrête sur le titre, message
 * affiché : c'est l'utilisateur qui décide de la suite.
 */

export const MAX_SKIPS_IN_ROW = 3;

export class FailureStreak {
  private count = 0;

  /** Un titre de plus sans source ; vrai s'il faut encore passer au suivant. */
  failed(): boolean {
    this.count += 1;
    return this.count < MAX_SKIPS_IN_ROW;
  }

  /** Un son, ou un choix de l'utilisateur : la série repart de zéro. */
  reset(): void {
    this.count = 0;
  }
}
