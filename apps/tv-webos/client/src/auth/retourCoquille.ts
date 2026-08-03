/**
 * Oublier le jumelage, et quitter.
 *
 * Sur un téléviseur, « se déconnecter » ne veut pas dire « revenir à un écran de
 * mot de passe » — il n'y en a pas. Cela veut dire oublier ce jumelage-ci et
 * revenir à l'écran de code de la coquille.
 *
 * **Or le client ne peut pas y ramener, et il a fallu s'y résoudre.** Une page
 * servie en HTTP ne peut pas naviguer vers `file://`. Restait l'historique,
 * puisque la coquille y reste — mais on ne peut pas savoir de combien de crans
 * remonter : le compte devient faux dès que l'utilisateur a reculé une fois, et
 * rien ne permet d'inspecter une entrée d'une autre origine pour vérifier qu'on
 * est arrivé.
 *
 * La version précédente tentait ce calcul et, s'il ne changeait pas de
 * document, appelait `platformBack()` en filet. Deux erreurs. Elle reposait sur
 * une hypothèse jamais vérifiée — qu'on peut traverser d'`http://` vers
 * `file://` sur ce moteur. Et surtout, elle faisait d'un FILET l'action la plus
 * destructrice possible : sur une dalle, `platformBack()` à la racine ferme
 * l'application. L'utilisateur voyait la page se fermer sans comprendre.
 *
 * Un filet ne doit jamais être plus destructeur que ce qu'il rattrape. On ne
 * devine donc plus : quitter est le seul chemin qui mène réellement au code, et
 * c'est désormais ce que le bouton annonce. Relancer l'application repart de la
 * coquille, qui redemande un code au relais.
 */

/** Le jumelage mémorisé est effacé. Sans effet sur la navigation. */
export function oublierJumelage(): void {
  try {
    localStorage.removeItem("tentacle_token");
    localStorage.removeItem("tentacle_user");
  } catch {
    // Stockage indisponible : la coquille regénérera un code de toute façon.
  }
}

interface PontPlateforme {
  webOS?: { platformBack?: () => void };
  PalmSystem?: { platformBack?: () => void };
}

function pont(): PontPlateforme {
  return window as unknown as PontPlateforme;
}

/**
 * La plateforme sait-elle nous rendre la main ?
 *
 * Faux au navigateur de développement, et c'est ce qui permet de n'y afficher
 * aucun bouton qui ne ferait rien — la même discipline que partout ailleurs :
 * une cible qui ne mène nulle part coûte un appui à chaque passage et laisse
 * croire que la télécommande ne répond pas.
 */
export function plateformePeutQuitter(): boolean {
  const global = pont();
  return (
    typeof global.webOS?.platformBack === "function" ||
    typeof global.PalmSystem?.platformBack === "function"
  );
}

/**
 * Rend la main au gestionnaire d'applications du téléviseur.
 *
 * `PalmSystem` est injecté dans toute page de l'application, y compris après la
 * navigation vers le serveur — c'est ce sur quoi `amorce/webosGlobals.ts`
 * compte déjà pour lire les capacités de la dalle. `webOS.platformBack`
 * n'existe que si la bibliothèque du SDK a été déposée dans la coquille ; les
 * deux font le même travail.
 */
export function rendreLaMainAuTeleviseur(): void {
  const global = pont();
  if (typeof global.webOS?.platformBack === "function") {
    global.webOS.platformBack();
    return;
  }
  if (typeof global.PalmSystem?.platformBack === "function") {
    global.PalmSystem.platformBack();
  }
}

/** Oublie le jumelage, puis quitte — dans cet ordre, et sans détour. */
export function quitterVersLaCoquille(): void {
  oublierJumelage();
  rendreLaMainAuTeleviseur();
}
