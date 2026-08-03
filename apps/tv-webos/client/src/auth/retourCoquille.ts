/**
 * Quitter le jumelage : oublier ce qu'on en sait, puis revenir à la coquille.
 *
 * Sur un téléviseur, « se déconnecter » ne veut pas dire « revenir à un écran
 * de mot de passe » — il n'y en a pas. Cela veut dire oublier ce jumelage-ci et
 * rendre la main à la coquille, qui redemandera un code au relais.
 *
 * **La coquille est dans l'historique, et c'est le seul chemin.** Elle navigue
 * vers le client en `location.href` et non en `replace` (`shell/js/shell.js`),
 * précisément pour rester derrière nous ; une page servie en HTTP ne peut pas
 * naviguer vers `file://`, donc l'historique est la seule porte.
 *
 * Reste à savoir de combien de crans remonter. `history.back()` seul ne suffit
 * pas : la garde de routes navigue en `replace`, mais tout le reste de
 * l'application empile — un écran de plus visité, c'est un cran de plus à
 * défaire. On mémorise donc la profondeur de la pile à l'arrivée, et on remonte
 * l'écart plus un.
 *
 * Ce compte peut être faux : l'utilisateur a pu reculer entre-temps, et la pile
 * d'un téléviseur laissé allumé des heures peut avoir été tronquée. D'où le
 * filet — si l'on est toujours sur la même page après un court délai, on rend
 * la main à la plateforme. Relancer l'application repart de la coquille, ce qui
 * est exactement le résultat cherché.
 */

/** Le temps qu'on laisse à `history.go` pour changer de document. */
const DELAI_VERIFICATION_MS = 400;

let profondeurDepart: number | null = null;

/**
 * À appeler une fois au démarrage, avant toute navigation.
 *
 * Appelée deux fois, elle garde la première valeur : ce qui compte est la
 * profondeur à l'arrivée sur le client, pas celle du moment où on la relit.
 */
export function memoriserProfondeurHistorique(): void {
  if (profondeurDepart === null) profondeurDepart = window.history.length;
}

/** Efface le jumelage mémorisé. N'a pas d'effet sur la navigation. */
export function oublierJumelage(): void {
  try {
    localStorage.removeItem("tentacle_token");
    localStorage.removeItem("tentacle_user");
  } catch {
    // Stockage indisponible : la coquille regénérera un code de toute façon.
  }
}

/**
 * Rend la main au gestionnaire d'applications du téléviseur.
 *
 * `PalmSystem` est injecté dans toute page de l'application, y compris après la
 * navigation vers le serveur — c'est ce sur quoi `amorce/webosGlobals.ts`
 * compte déjà pour lire les capacités de la dalle. `webOS.platformBack` n'existe
 * que si la bibliothèque du SDK a été déposée dans la coquille ; les deux font
 * le même travail.
 */
export function rendreLaMainAuTeleviseur(): void {
  const global = window as unknown as {
    webOS?: { platformBack?: () => void };
    PalmSystem?: { platformBack?: () => void };
  };
  if (typeof global.webOS?.platformBack === "function") {
    global.webOS.platformBack();
    return;
  }
  if (typeof global.PalmSystem?.platformBack === "function") {
    global.PalmSystem.platformBack();
  }
}

/**
 * Remonte jusqu'à la coquille.
 *
 * Le minuteur de vérification meurt avec le document quand la navigation
 * aboutit — c'est ce qui le rend inoffensif dans le cas nominal, et utile dans
 * l'autre.
 */
export function revenirALaCoquille(): void {
  const longueur = window.history.length;
  const pas = profondeurDepart === null ? 1 : longueur - profondeurDepart + 1;

  if (pas > 0 && pas < longueur) {
    window.history.go(-pas);
    window.setTimeout(rendreLaMainAuTeleviseur, DELAI_VERIFICATION_MS);
    return;
  }

  rendreLaMainAuTeleviseur();
}
