/**
 * L'addition des sauts consécutifs.
 *
 * Sur un téléviseur on n'appuie pas une fois sur « +30 », on appuie trois fois
 * de suite pour passer une scène. Le badge du client web repart de zéro à
 * chaque appui et affiche trois fois « +30 s » — l'utilisateur doit faire
 * l'addition lui-même, ce qui est précisément ce qu'un badge existe pour
 * éviter. L'Apple TV cumule : +30, +60, +90.
 *
 * Module pur, horloge passée en paramètre : cette arithmétique est la seule
 * chose du badge qui puisse se tromper, et c'est la seule qu'on puisse
 * vérifier sans écran.
 */

/** Fenêtre de cumul, et durée d'affichage. Valeur d'`apps/tv`. */
export const FENETRE_CUMUL_MS = 1500;

export interface CumulSauts {
  total: number;
  instant: number;
}

/**
 * Ce qu'affiche le badge après ce saut-ci.
 *
 * Un saut en sens inverse repart de zéro : additionner un +30 et un −10
 * donnerait « +20 », un chiffre qui ne correspond à aucun geste. Passée la
 * fenêtre, on repart de zéro aussi — deux sauts séparés de deux secondes sont
 * deux intentions, pas une.
 */
export function cumuler(
  memoire: CumulSauts | null,
  delta: number,
  instant: number,
): CumulSauts {
  const enchaine =
    memoire !== null &&
    instant - memoire.instant < FENETRE_CUMUL_MS &&
    memoire.total > 0 === delta > 0;

  return { total: enchaine ? memoire.total + delta : delta, instant };
}
