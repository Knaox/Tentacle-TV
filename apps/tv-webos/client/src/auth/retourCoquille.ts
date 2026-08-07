/**
 * Oublier le jumelage.
 *
 * Sur un téléviseur, « se déconnecter » ne veut pas dire « revenir à un écran de
 * mot de passe » — il n'y en a pas. Cela veut dire oublier ce jumelage-ci et
 * revenir à un écran de code.
 *
 * **Ce n'est plus la coquille qui le fournit, et il a fallu deux tentatives pour
 * s'en apercevoir.** La première version calculait un nombre de crans
 * d'historique pour y remonter, avec `platformBack()` en filet quand le
 * document ne changeait pas — un filet plus destructeur que le défaut, puisque
 * `platformBack()` ferme l'application. La deuxième a renoncé et fait du départ
 * l'action annoncée : « Quitter l'application ». Elle l'a justifié par une
 * hypothèse — une page HTTP ne navigue pas vers `file://` — qui n'a jamais été
 * vérifiée.
 *
 * Mesuré depuis, sur l'émulateur : ce n'est pas l'origine qui bloque, c'est la
 * GARDE DE SESSION. `history.length` valait 3, la coquille était bien à l'index
 * 0, et chaque retour en arrière était ravalé par la garde, qui repose l'écran
 * de jumelage avec un `replace`. Aucun chemin d'historique n'y mène.
 *
 * Et surtout, la question ne se pose plus : au moment où l'on oublie un
 * jumelage, LE SERVEUR EST CONNU — c'est celui qui sert la page. Le client
 * demande donc son propre code au relais (`ui/ecrans/EcranNonJumele.tsx`), et
 * il n'y a plus rien à quitter. Le détour par la coquille n'avait de raison
 * d'être que tant qu'on ignorait où était le serveur, c'est-à-dire au tout
 * premier démarrage.
 *
 * Ne reste ici que la purge, et les deux passerelles de plateforme — dont
 * `focus/retour.ts` se sert encore pour rendre la main depuis l'écran d'accueil.
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
