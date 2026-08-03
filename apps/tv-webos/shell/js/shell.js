/* Coquille IPK — jumelage, puis navigation vers le client.
 *
 * ES5 strict, aucune dépendance. Le client React n'est PAS embarqué : il est
 * servi par le serveur Tentacle. Mettre à jour le serveur met donc à jour le
 * téléviseur, sans repasser par la revue du Content Store.
 *
 * **Il n'y a rien à saisir.** Le téléviseur ne connaît pas l'adresse de son
 * serveur, et c'est justement ce que le relais résout : il rend l'adresse en
 * même temps que le jeton, une fois qu'un appareil déjà connecté a validé le
 * code affiché ici. C'est aussi pourquoi cet écran vit dans la coquille et non
 * dans le client — celui-ci est servi par le serveur qu'il s'agit de trouver.
 *
 * Navigation en top-level plutôt qu'en `<iframe>` : le cookie de session du
 * backend est `sameSite: "strict"` et helmet pose `X-Frame-Options:
 * SAMEORIGIN`. Dans un cadre dont le document racine est `file://`, rien ne
 * fonctionnerait.
 *
 * `href` et non `replace` : la page de la coquille reste dans l'historique,
 * donc l'écran de rejumelage du client peut y revenir par `history.back()`.
 * Une navigation `http://` vers `file://` étant interdite, c'est le seul
 * chemin de retour possible.
 */

(function (global) {
  "use strict";

  var CODE_RETOUR = 461;
  var CODE_ECHAP = 27;

  /**
   * Retour à l'écran d'accueil du téléviseur.
   *
   * webOSTV.js n'est pas versionné dans le dépôt — c'est une bibliothèque du
   * SDK LG, à déposer dans `shell/js/` (voir le README). En son absence,
   * `PalmSystem` reste injecté par le gestionnaire d'applications et fait
   * exactement le même travail.
   */
  function quitter() {
    if (global.webOS && typeof global.webOS.platformBack === "function") {
      global.webOS.platformBack();
      return;
    }
    if (global.PalmSystem && typeof global.PalmSystem.platformBack === "function") {
      global.PalmSystem.platformBack();
    }
  }

  /**
   * Navigation à la télécommande.
   *
   * L'écran ne porte jamais plus d'un bouton : haut et bas suffisent, et il n'y
   * a aucune navigation spatiale à écrire. OK valide le bouton qui a le focus,
   * Retour quitte l'application.
   */
  function installerTouches() {
    document.addEventListener("keydown", function (evenement) {
      var code = evenement.keyCode;

      if (code === CODE_RETOUR || code === CODE_ECHAP) {
        quitter();
        return;
      }

      if (code !== 38 && code !== 40) return;

      var boutons = document.getElementsByTagName("button");
      if (boutons.length < 2) return;

      var index = -1;
      for (var i = 0; i < boutons.length; i++) {
        if (boutons[i] === document.activeElement) index = i;
      }
      var suivant = index + (code === 40 ? 1 : -1);
      if (suivant < 0 || suivant >= boutons.length) return;
      boutons[suivant].focus();
      evenement.preventDefault();
    });
  }

  function demarrer() {
    global.VueJumelage.preparer();
    global.InfoAppareil.collecter();
    installerTouches();

    var machine = global.MachineJumelage.creer(global.VueJumelage);

    // Le sondage est suspendu quand l'application passe en arrière-plan : un
    // téléviseur laisse volontiers une application ouverte des heures, et rien
    // ne justifie d'interroger le relais toutes les trois secondes pendant ce
    // temps-là.
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) machine.arreter();
      else machine.demarrer();
    });

    machine.demarrer();
  }

  global.demarrerCoquille = demarrer;
})(window);
