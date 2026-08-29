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

  var ADDRESS_KEY = "tentacle_webos_serveur";

  function lire() {
    try {
      return global.localStorage.getItem(ADDRESS_KEY) || "";
    } catch (e) {
      return "";
    }
  }

  function write(adresse) {
    try {
      global.localStorage.setItem(ADDRESS_KEY, adresse);
    } catch (e) {
      /* Quota ou stockage desactive : on continue sans memoriser. */
    }
  }

  function forget() {
    try {
      global.localStorage.removeItem(ADDRESS_KEY);
    } catch (e) {
      /* Rien a faire. */
    }
  }

  /* Normalise ce que l'utilisateur a saisi a la telecommande :
   * ajoute le schema s'il manque, retire les espaces et le slash final. */
  function normalize(input) {
    var adresse = String(input || "").replace(/^\s+|\s+$/g, "");
    if (adresse === "") return "";
    if (!/^https?:\/\//i.test(adresse)) {
      adresse = "http://" + adresse;
    }
    return adresse.replace(/\/+$/, "");
  }

  global.ShellStorage = {
    lire: lire,
    write: write,
    forget: forget,
    normalize: normalize
  };
})(window);
