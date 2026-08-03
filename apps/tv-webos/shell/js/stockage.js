/* Memorisation de l'adresse du serveur, cote coquille.
 *
 * ES5 strict : la coquille doit demarrer sur des moteurs bien anterieurs au
 * socle du client. Aucune syntaxe posterieure a ES5, aucun `Promise`.
 *
 * `localStorage` est disponible dans les applications webOS, mais il est
 * cloisonne par origine — celle de la coquille (`file://`) n'est pas celle du
 * client servi par le serveur. Les deux ne partagent donc rien, et c'est bien :
 * la coquille ne memorise qu'une adresse, jamais un jeton. */

(function (global) {
  "use strict";

  var CLE_ADRESSE = "tentacle_webos_serveur";

  function lire() {
    try {
      return global.localStorage.getItem(CLE_ADRESSE) || "";
    } catch (e) {
      return "";
    }
  }

  function ecrire(adresse) {
    try {
      global.localStorage.setItem(CLE_ADRESSE, adresse);
    } catch (e) {
      /* Quota ou stockage desactive : on continue sans memoriser. */
    }
  }

  function oublier() {
    try {
      global.localStorage.removeItem(CLE_ADRESSE);
    } catch (e) {
      /* Rien a faire. */
    }
  }

  /* Normalise ce que l'utilisateur a saisi a la telecommande :
   * ajoute le schema s'il manque, retire les espaces et le slash final. */
  function normaliser(saisie) {
    var adresse = String(saisie || "").replace(/^\s+|\s+$/g, "");
    if (adresse === "") return "";
    if (!/^https?:\/\//i.test(adresse)) {
      adresse = "http://" + adresse;
    }
    return adresse.replace(/\/+$/, "");
  }

  global.StockageCoquille = {
    lire: lire,
    ecrire: ecrire,
    oublier: oublier,
    normaliser: normaliser
  };
})(window);
