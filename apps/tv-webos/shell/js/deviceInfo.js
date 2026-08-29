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
  var KEPT_FIELDS = [
    "modelName", "panelType", "sdkVersion", "version", "versionMajor", "versionMinor",
    "uhd", "uhd8K", "oled", "hdr10", "dolbyVision", "dolbyAtmos",
    "screenWidth", "screenHeight"
  ];

  var collection = null;

  function filter(raw) {
    var kept = {};
    if (!raw || typeof raw !== "object") return kept;
    for (var i = 0; i < KEPT_FIELDS.length; i++) {
      var key = KEPT_FIELDS[i];
      if (Object.prototype.hasOwnProperty.call(raw, key)) {
        kept[key] = raw[key];
      }
    }
    return kept;
  }

  function readPalmSystem() {
    try {
      if (!global.PalmSystem || !global.PalmSystem.deviceInfo) return null;
      return JSON.parse(global.PalmSystem.deviceInfo);
    } catch (e) {
      return null;
    }
  }

  function collect() {
    var immediate = readPalmSystem();
    if (immediate) collection = filter(immediate);

    if (global.webOS && typeof global.webOS.deviceInfo === "function") {
      try {
        global.webOS.deviceInfo(function (info) {
          if (info) collection = filter(info);
        });
      } catch (e) {
        /* L'API officielle a echoue : la lecture directe fait office de repli. */
      }
    }
  }

  function inParams() {
    if (!collection) return "";
    try {
      return "?tvinfo=" + encodeURIComponent(JSON.stringify(collection));
    } catch (e) {
      return "";
    }
  }

  global.DeviceInfo = {
    collect: collect,
    inParams: inParams
  };
})(window);
