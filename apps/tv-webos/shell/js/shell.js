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

  var BACK_CODE = 461;
  var ESCAPE_CODE = 27;

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
  function installKeys() {
    document.addEventListener("keydown", function (event) {
      var code = event.keyCode;

      if (code === BACK_CODE || code === ESCAPE_CODE) {
        quitter();
        return;
      }

      if (code !== 38 && code !== 40) return;

      var buttons = document.getElementsByTagName("button");
      if (buttons.length < 2) return;

      var index = -1;
      for (var i = 0; i < buttons.length; i++) {
        if (buttons[i] === document.activeElement) index = i;
      }
      var next = index + (code === 40 ? 1 : -1);
      if (next < 0 || next >= buttons.length) return;
      buttons[next].focus();
      event.preventDefault();
    });
  }

  function start() {
    global.PairingView.prepare();
    global.DeviceInfo.collect();
    installKeys();

    var machine = global.PairingMachine.create(global.PairingView);

    // Le sondage est suspendu quand l'application passe en arrière-plan : un
    // téléviseur laisse volontiers une application ouverte des heures, et rien
    // ne justifie d'interroger le relais toutes les trois secondes pendant ce
    // temps-là.
    document.addEventListener("visibilitychange", function () {
      // La classe suspend les animations de l'écran d'attente : rien ne doit
      // se composer pendant que l'application est en arrière-plan.
      if (document.hidden) {
        document.body.classList.add("cachee");
        machine.stop2();
      } else {
        document.body.classList.remove("cachee");
        machine.start();
      }
    });

    machine.start();
  }

  global.startShell = start;
})(window);
