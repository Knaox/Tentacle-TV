/* Le relais de jumelage, vu de la coquille.
 *
 * ES5 strict, XHR. C'est le seul service que le téléviseur peut joindre avant
 * de savoir où est son serveur — et c'est précisément ce qui résout le
 * problème : le relais rend l'adresse du serveur en même temps que le jeton,
 * donc il n'y a rien à saisir.
 *
 * Trois précautions tirées du code du relais.
 *
 * **La génération part sans corps ni `Content-Type`.** La requête reste
 * « simple » au sens CORS, il n'y a pas de préflight, et toute une classe
 * d'échec depuis une origine `file://` — qui vaut « null » — disparaît. Le
 * relais ne lit pas le corps de toute façon.
 *
 * **Un seul sondage en vol.** Le relais SUPPRIME l'entrée à la première
 * réponse « confirmed » : deux requêtes concurrentes et la seconde reçoit
 * « expired » juste après un jumelage réussi, ce qui afficherait « code
 * expiré » une seconde après avoir réussi.
 *
 * **La charge utile est à usage unique.** Ce que rend le sondage n'existe plus
 * nulle part ensuite : l'appelant doit le mémoriser avant de naviguer.
 */

(function (global) {
  "use strict";

  var RELAY = "https://pair.tentacletv.app";
  var DELAY_MS = 10000;

  var pollInFlight = false;

  function request(method, path, onResult, onError) {
    var xhr = new global.XMLHttpRequest();
    try {
      xhr.open(method, RELAY + path, true);
    } catch (e) {
      onError("ouverture");
      return null;
    }
    xhr.timeout = DELAY_MS;
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (xhr.status < 200 || xhr.status >= 300) {
        onError(xhr.status === 0 ? "reseau" : "statut " + xhr.status);
        return;
      }
      try {
        onResult(JSON.parse(xhr.responseText));
      } catch (e) {
        onError("reponse illisible");
      }
    };
    xhr.ontimeout = function () { onError("delai"); };
    xhr.onerror = function () { onError("reseau"); };
    return xhr;
  }

  /** Demande un code. Rend `{ code, expiresIn }`. */
  function generateCode(onResult, onError) {
    var xhr = request("POST", "/generate", onResult, onError);
    if (xhr) xhr.send(null);
  }

  /**
   * Interroge l'état d'un code.
   *
   * Rend `{ status: "pending" }`, `{ status: "expired" }`, ou
   * `{ status: "confirmed", serverUrl, token, user }`.
   */
  function probeStatus(code, onResult, onError) {
    if (pollInFlight) return;
    pollInFlight = true;

    var done = function (rappel) {
      return function (argument) {
        pollInFlight = false;
        rappel(argument);
      };
    };

    var xhr = request("GET", "/status/" + code, done(onResult), done(onError));
    if (xhr) xhr.send(null);
    else pollInFlight = false;
  }

  /** Un sondage est-il en cours ? Utile pour ne pas empiler les minuteurs. */
  function busy() {
    return pollInFlight;
  }

  global.PairingRelay = {
    generateCode: generateCode,
    probeStatus: probeStatus,
    busy: busy,
  };
})(window);
