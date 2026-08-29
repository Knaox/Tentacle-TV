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

  var POLL_PERIOD_MS = 3000;
  var HEALTH_DELAY_MS = 8000;

  function createMachine(view) {
    var code = null;
    var expiration = 0;
    var pollTimer = null;
    var countdownTimer = null;

    function stop2() {
      if (pollTimer !== null) clearInterval(pollTimer);
      if (countdownTimer !== null) clearInterval(countdownTimer);
      pollTimer = null;
      countdownTimer = null;
    }

    function toGeneration() {
      stop2();
      view.showLoading();
      global.PairingRelay.generateCode(function (response) {
        code = response.code;
        // La durée de vie vient du relais et n'est pas une constante locale :
        // s'il la change, la coquille suit sans être remise à jour.
        expiration = new Date().getTime() + (response.expiresIn || 300) * 1000;
        toWaiting();
      }, function () {
        stop2();
        view.showError(toGeneration);
      });
    }

    function toWaiting() {
      view.showCode(code, remaining());

      countdownTimer = setInterval(function () {
        var seconds = remaining();
        view.updateCountdown(seconds);
        if (seconds <= 0) {
          stop2();
          view.showExpired(toGeneration);
        }
      }, 1000);

      pollTimer = setInterval(function () {
        global.PairingRelay.probeStatus(code, function (status) {
          if (status.status === "confirmed") {
            stop2();
            toNavigation(status);
            return;
          }
          if (status.status === "expired") {
            stop2();
            view.showExpired(toGeneration);
          }
        }, function () {
          // Un sondage qui échoue n'est pas une erreur fatale : le réseau d'un
          // salon a des trous, et le suivant réussira. Seule la génération
          // décide qu'on ne peut pas jumeler.
        });
      }, POLL_PERIOD_MS);
    }

    function remaining() {
      return Math.max(0, Math.ceil((expiration - new Date().getTime()) / 1000));
    }

    /**
     * Le jumelage a réussi.
     *
     * L'adresse est mémorisée AVANT la navigation : la charge utile du relais
     * est à usage unique — il supprime l'entrée en répondant — et un incident
     * pendant le changement de page ferait perdre le jumelage sans recours.
     */
    function toNavigation(status) {
      view.showWaiting();
      global.ShellStorage.write(status.serverUrl);
      view.navigate(status.serverUrl, status.token, status.user);
    }

    /** Le serveur mémorisé répond-il encore ? */
    function toVerification(address) {
      view.showWaiting();
      var xhr = new global.XMLHttpRequest();
      var concluded = false;
      var conclude = function (ok) {
        if (concluded) return;
        concluded = true;
        if (ok) view.navigate(address, null, null);
        else toGeneration();
      };

      try {
        xhr.open("GET", address + "/api/health", true);
      } catch (e) {
        conclude(false);
        return;
      }
      xhr.timeout = HEALTH_DELAY_MS;
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) conclude(xhr.status >= 200 && xhr.status < 400);
      };
      xhr.ontimeout = function () { conclude(false); };
      xhr.onerror = function () { conclude(false); };
      xhr.send(null);
    }

    return {
      start: function () {
        var remembered = global.ShellStorage.lire();
        if (remembered) toVerification(remembered);
        else toGeneration();
      },
      stop2: stop2,
    };
  }

  global.PairingMachine = { create: createMachine };
})(window);
