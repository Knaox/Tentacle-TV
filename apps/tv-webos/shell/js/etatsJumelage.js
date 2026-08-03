/* La machine à états du jumelage, sans DOM.
 *
 * ES5 strict. Séparée du rendu parce que c'est elle qui porte les décisions —
 * quand regénérer, quand abandonner, quand naviguer — et qu'elles se lisent
 * mieux sans balisage autour.
 *
 * Les états :
 *
 *   verification  une adresse est mémorisée : le serveur répond-il encore ?
 *   generation    demande d'un code au relais
 *   attente       le code est affiché, on sonde toutes les trois secondes
 *   expire        le code a vécu ses cinq minutes
 *   erreur        le relais est injoignable
 *   navigation    jumelage obtenu, on part vers le serveur
 *
 * L'adresse mémorisée dispense de rejumeler à chaque allumage. Sa vérification
 * n'est pas un luxe : un serveur peut changer d'adresse, et sans elle le
 * téléviseur afficherait une page morte sans jamais proposer de recommencer.
 */

(function (global) {
  "use strict";

  var PERIODE_SONDAGE_MS = 3000;
  var DELAI_SANTE_MS = 8000;

  function creerMachine(vue) {
    var code = null;
    var expiration = 0;
    var minuteurSondage = null;
    var minuteurRebours = null;

    function arreter() {
      if (minuteurSondage !== null) clearInterval(minuteurSondage);
      if (minuteurRebours !== null) clearInterval(minuteurRebours);
      minuteurSondage = null;
      minuteurRebours = null;
    }

    function versGeneration() {
      arreter();
      vue.afficherChargement();
      global.RelaisJumelage.genererCode(function (reponse) {
        code = reponse.code;
        // La durée de vie vient du relais et n'est pas une constante locale :
        // s'il la change, la coquille suit sans être remise à jour.
        expiration = new Date().getTime() + (reponse.expiresIn || 300) * 1000;
        versAttente();
      }, function () {
        arreter();
        vue.afficherErreur(versGeneration);
      });
    }

    function versAttente() {
      vue.afficherCode(code, restant());

      minuteurRebours = setInterval(function () {
        var secondes = restant();
        vue.majRebours(secondes);
        if (secondes <= 0) {
          arreter();
          vue.afficherExpire(versGeneration);
        }
      }, 1000);

      minuteurSondage = setInterval(function () {
        global.RelaisJumelage.sonderStatut(code, function (statut) {
          if (statut.status === "confirmed") {
            arreter();
            versNavigation(statut);
            return;
          }
          if (statut.status === "expired") {
            arreter();
            vue.afficherExpire(versGeneration);
          }
        }, function () {
          // Un sondage qui échoue n'est pas une erreur fatale : le réseau d'un
          // salon a des trous, et le suivant réussira. Seule la génération
          // décide qu'on ne peut pas jumeler.
        });
      }, PERIODE_SONDAGE_MS);
    }

    function restant() {
      return Math.max(0, Math.ceil((expiration - new Date().getTime()) / 1000));
    }

    /**
     * Le jumelage a réussi.
     *
     * L'adresse est mémorisée AVANT la navigation : la charge utile du relais
     * est à usage unique — il supprime l'entrée en répondant — et un incident
     * pendant le changement de page ferait perdre le jumelage sans recours.
     */
    function versNavigation(statut) {
      vue.afficherAttente();
      global.StockageCoquille.ecrire(statut.serverUrl);
      vue.naviguer(statut.serverUrl, statut.token, statut.user);
    }

    /** Le serveur mémorisé répond-il encore ? */
    function versVerification(adresse) {
      vue.afficherAttente();
      var xhr = new global.XMLHttpRequest();
      var conclu = false;
      var conclure = function (ok) {
        if (conclu) return;
        conclu = true;
        if (ok) vue.naviguer(adresse, null, null);
        else versGeneration();
      };

      try {
        xhr.open("GET", adresse + "/api/health", true);
      } catch (e) {
        conclure(false);
        return;
      }
      xhr.timeout = DELAI_SANTE_MS;
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) conclure(xhr.status >= 200 && xhr.status < 400);
      };
      xhr.ontimeout = function () { conclure(false); };
      xhr.onerror = function () { conclure(false); };
      xhr.send(null);
    }

    return {
      demarrer: function () {
        var memorisee = global.StockageCoquille.lire();
        if (memorisee) versVerification(memorisee);
        else versGeneration();
      },
      arreter: arreter,
    };
  }

  global.MachineJumelage = { creer: creerMachine };
})(window);
