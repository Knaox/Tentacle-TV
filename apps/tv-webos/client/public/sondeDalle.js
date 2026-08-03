/* Trois mesures que seule la dalle peut donner.
 *
 * ES5 strict. Elles ne relèvent pas d'une curiosité : chacune décide de la
 * forme d'une partie du client, et aucun navigateur de bureau ne peut y
 * répondre — Chrome ignore le meta viewport, n'a pas de télécommande, et ne
 * sert jamais de page depuis `file://`.
 *
 *   1. Le meta viewport est-il honoré ? Toute la mise à l'échelle en dépend :
 *      si le téléviseur compose bien en 1280 et agrandit lui-même, il n'y a
 *      rien d'autre à faire ; sinon il faut mettre le CSS à l'échelle à la
 *      compilation, ce qui laisse les styles en ligne de côté.
 *   2. Le relâchement d'une touche est-il notifié ? Le maintien de OK ouvre la
 *      fiche ; s'il n'y a pas de `keyup`, il faut le déduire de l'arrêt de la
 *      répétition, dont l'intervalle se mesure ici.
 *   3. Le relais accepte-t-il une requête venue de `file://` ? L'origine y vaut
 *      « null », et un préflight suffirait à rendre le jumelage impossible.
 */

(function (global) {
  "use strict";

  var RELAIS = "https://pair.tentacletv.app";
  var CODE_OK = 13;

  function ligne(cle, etat, valeur) {
    return { cle: cle, sonde: { etat: etat, valeur: String(valeur) } };
  }

  /* ── 1. Canevas ──────────────────────────────────────────────────────── */

  function mesurerCanevas() {
    var declare = null;
    var balises = document.getElementsByTagName("meta");
    for (var i = 0; i < balises.length; i++) {
      if (balises[i].getAttribute("name") === "viewport") {
        declare = balises[i].getAttribute("content");
      }
    }

    var largeurCss = document.documentElement.clientWidth;
    var largeurDalle = global.screen ? global.screen.width : 0;
    var honore = declare && declare.indexOf("width=") !== -1 && largeurCss !== largeurDalle;

    return [
      ligne("meta viewport déclaré", "info", declare || "aucun"),
      ligne("largeur CSS (clientWidth)", "info", largeurCss),
      ligne("largeur de la dalle (screen)", "info", largeurDalle),
      ligne("agrandissement matériel", "info",
        largeurCss > 0 ? (largeurDalle / largeurCss).toFixed(2) + " ×" : "?"),
      ligne("meta viewport honoré", honore ? "ok" : "ko",
        honore ? "oui — le canevas suffit"
               : "NON — il faudra mettre le CSS à l'échelle à la compilation"),
    ];
  }

  /* ── 2. Répétition et relâchement de OK ──────────────────────────────── */

  function installerReleveMaintien(auRapport) {
    var debut = 0;
    var repetitions = 0;
    var dernier = 0;
    var intervalles = [];
    var vuKeyup = false;

    document.addEventListener("keydown", function (evenement) {
      if (evenement.keyCode !== CODE_OK) return;
      var maintenant = new Date().getTime();
      if (debut === 0) {
        debut = maintenant;
        dernier = maintenant;
        return;
      }
      repetitions++;
      intervalles.push(maintenant - dernier);
      dernier = maintenant;
    });

    document.addEventListener("keyup", function (evenement) {
      if (evenement.keyCode !== CODE_OK || debut === 0) return;
      vuKeyup = true;
      var duree = new Date().getTime() - debut;
      var moyen = intervalles.length > 0 ? moyenne(intervalles) : 0;

      auRapport([
        ligne("keyup reçu", "ok", "oui — le maintien peut se mesurer directement"),
        ligne("durée du maintien", "info", duree + " ms"),
        ligne("répétitions observées", repetitions > 0 ? "ok" : "ko", repetitions),
        ligne("intervalle de répétition", "info",
          moyen > 0 ? Math.round(moyen) + " ms" : "aucune répétition"),
      ]);

      debut = 0;
      repetitions = 0;
      intervalles = [];
    });

    // Chien de garde : si aucun `keyup` n'arrive dans les deux secondes qui
    // suivent la dernière répétition, c'est que le modèle ne le notifie pas.
    setInterval(function () {
      if (debut === 0 || vuKeyup) return;
      var silence = new Date().getTime() - dernier;
      if (silence < 2000) return;
      auRapport([
        ligne("keyup reçu", "ko", "NON — il faudra déduire le relâchement du silence"),
        ligne("intervalle de répétition", "info",
          intervalles.length > 0 ? Math.round(moyenne(intervalles)) + " ms" : "aucune"),
      ]);
      debut = 0;
      repetitions = 0;
      intervalles = [];
    }, 500);
  }

  function moyenne(valeurs) {
    var somme = 0;
    for (var i = 0; i < valeurs.length; i++) somme += valeurs[i];
    return somme / valeurs.length;
  }

  /* ── 3. Le relais depuis file:// ─────────────────────────────────────── */

  function sonderRelais(auRapport) {
    var xhr = new global.XMLHttpRequest();
    var origine = global.location.protocol === "file:" ? "null (file://)" : global.location.origin;

    try {
      xhr.open("POST", RELAIS + "/generate", true);
    } catch (e) {
      auRapport([ligne("relais joignable", "ko", "open() a échoué : " + e.message)]);
      return;
    }

    // Volontairement sans corps ni `Content-Type` : la requête reste « simple »
    // au sens CORS, il n'y a pas de préflight, et toute une classe d'échec
    // depuis une origine « null » disparaît.
    xhr.timeout = 8000;
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var ok = xhr.status >= 200 && xhr.status < 300;
      auRapport([
        ligne("origine de la coquille", "info", origine),
        ligne("relais joignable", ok ? "ok" : "ko",
          ok ? "oui — code obtenu" : "statut " + xhr.status + " (0 = bloqué par CORS)"),
        ligne("réponse du relais", ok ? "ok" : "info", (xhr.responseText || "").slice(0, 80)),
      ]);
    };
    xhr.ontimeout = function () {
      auRapport([ligne("relais joignable", "ko", "délai dépassé (8 s)")]);
    };
    xhr.send(null);
  }

  global.SondeDalle = {
    canevas: mesurerCanevas,
    installerReleveMaintien: installerReleveMaintien,
    sonderRelais: sonderRelais,
  };
})(window);
