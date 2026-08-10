/* Capacites materielles du televiseur, collectees par la coquille.
 *
 * ES5 strict. Elles alimentent le DeviceProfile envoye a Jellyfin : sans elles
 * le client ne saurait pas si la dalle accepte le 4K, le HDR10 ou le Dolby
 * Vision, et negocierait a l'aveugle.
 *
 * Deux chemins, dans cet ordre :
 *   1. `webOS.deviceInfo()` de webOSTV.js — l'API officielle, asynchrone ;
 *   2. `PalmSystem.deviceInfo` — la propriete brute injectee par le gestionnaire
 *      d'applications, lisible tout de suite, utile si webOSTV.js manque.
 *
 * Le resultat est passe au client en parametre d'URL, en repli seulement : le
 * client tente d'abord d'appeler `webOS.deviceInfo()` lui-meme, `PalmSystem`
 * restant injecte apres une navigation au sein de la meme application. On ne
 * transmet que des capacites materielles — jamais d'identifiant d'appareil,
 * de compte ni de jeton. */

(function (global) {
  "use strict";

  /* `panelType` vaut "OLED" sur une dalle OLED, et c'est le seul champ de
   * capacite que LG renseigne reellement : sur un C3 de 2023, aucun des
   * booleens ci-dessous n'est rendu. Le client en deduit la gamme, donc le
   * Dolby Vision, l'Atmos et le DTS. L'oublier du repli reviendrait a faire
   * transcoder tout ce que la dalle sait lire. */
  var CHAMPS_RETENUS = [
    "modelName", "panelType", "sdkVersion", "version", "versionMajor", "versionMinor",
    "uhd", "uhd8K", "oled", "hdr10", "dolbyVision", "dolbyAtmos",
    "screenWidth", "screenHeight"
  ];

  var collecte = null;

  function filtrer(brut) {
    var retenu = {};
    if (!brut || typeof brut !== "object") return retenu;
    for (var i = 0; i < CHAMPS_RETENUS.length; i++) {
      var cle = CHAMPS_RETENUS[i];
      if (Object.prototype.hasOwnProperty.call(brut, cle)) {
        retenu[cle] = brut[cle];
      }
    }
    return retenu;
  }

  function lirePalmSystem() {
    try {
      if (!global.PalmSystem || !global.PalmSystem.deviceInfo) return null;
      return JSON.parse(global.PalmSystem.deviceInfo);
    } catch (e) {
      return null;
    }
  }

  function collecter() {
    var immediat = lirePalmSystem();
    if (immediat) collecte = filtrer(immediat);

    if (global.webOS && typeof global.webOS.deviceInfo === "function") {
      try {
        global.webOS.deviceInfo(function (info) {
          if (info) collecte = filtrer(info);
        });
      } catch (e) {
        /* L'API officielle a echoue : la lecture directe fait office de repli. */
      }
    }
  }

  function enParametres() {
    if (!collecte) return "";
    try {
      return "?tvinfo=" + encodeURIComponent(JSON.stringify(collecte));
    } catch (e) {
      return "";
    }
  }

  global.InfoAppareil = {
    collecter: collecter,
    enParametres: enParametres
  };
})(window);
