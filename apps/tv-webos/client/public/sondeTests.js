/* Batterie de sondes — ce que le moteur du televiseur sait reellement faire.
 *
 * ES5 strict, aucune dependance : ce fichier doit s'executer sur le moteur le
 * plus ancien que l'on envisage de supporter, sans quoi il ne rapporterait
 * rien. Chaque sonde renvoie { etat: "ok" | "ko" | "info", valeur: string }.
 *
 * Les seuils indiques en commentaire sont les versions de Chromium ou la
 * fonctionnalite apparait ; le socle vise est Chrome 53 (webOS 4.0). */

(function (global) {
  "use strict";

  function ok(valeur) { return { etat: "ok", valeur: String(valeur) }; }
  function ko(valeur) { return { etat: "ko", valeur: String(valeur) }; }
  function info(valeur) { return { etat: "info", valeur: String(valeur) }; }
  function presence(condition) { return condition ? ok("present") : ko("absent"); }

  /* `CSS.supports` ne distingue pas `gap` en grille de `gap` en flex : il
   * repond vrai des que la grille l'accepte (Chrome 66), alors que la flexbox
   * ne l'a qu'a partir de Chrome 84. Seule une mesure reelle tranche. */
  function gapEnFlex() {
    var conteneur = document.createElement("div");
    conteneur.style.cssText =
      "position:absolute;visibility:hidden;display:flex;gap:50px;width:400px";
    var a = document.createElement("div");
    var b = document.createElement("div");
    a.style.cssText = b.style.cssText = "width:20px;height:20px;flex:none";
    conteneur.appendChild(a);
    conteneur.appendChild(b);
    document.body.appendChild(conteneur);
    var ecart = b.getBoundingClientRect().left - a.getBoundingClientRect().right;
    document.body.removeChild(conteneur);
    return Math.round(ecart) === 50
      ? ok("honore (" + Math.round(ecart) + " px)")
      : ko("ignore (" + Math.round(ecart) + " px au lieu de 50)");
  }

  /* Un selecteur inconnu invalide la regle entiere : le moteur ne l'insere pas
   * dans la feuille. Compter les regles est donc le test le plus fiable. */
  function selecteurValide(selecteur) {
    var balise = document.createElement("style");
    balise.appendChild(document.createTextNode(selecteur + "{color:red}"));
    document.head.appendChild(balise);
    var nombre = 0;
    try {
      nombre = balise.sheet && balise.sheet.cssRules ? balise.sheet.cssRules.length : 0;
    } catch (e) {
      nombre = 0;
    }
    document.head.removeChild(balise);
    return nombre > 0 ? ok("regle acceptee") : ko("regle rejetee");
  }

  function supporteCss(propriete, valeur) {
    if (!global.CSS || typeof global.CSS.supports !== "function") {
      return info("CSS.supports absent");
    }
    return global.CSS.supports(propriete, valeur) ? ok("supporte") : ko("non supporte");
  }

  /* libpgs instancie son demultiplexeur dans un worker cree depuis un blob.
   * Si la politique de securite du contenu le refuse, le rendu des sous-titres
   * PGS retombe sur le fil principal — ou echoue. */
  function workerDepuisBlob() {
    try {
      var source = "self.onmessage=function(){self.postMessage(1)}";
      var url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
      var worker = new Worker(url);
      worker.terminate();
      URL.revokeObjectURL(url);
      return ok("autorise");
    } catch (e) {
      return ko("refuse — " + (e && e.message ? e.message : "erreur inconnue"));
    }
  }

  function typesMedia() {
    var video = document.createElement("video");
    var essais = [
      ["h264", 'video/mp4; codecs="avc1.640029"'],
      ["hevc", 'video/mp4; codecs="hvc1.1.6.L120.B0"'],
      ["hevc main10", 'video/mp4; codecs="hvc1.2.4.L120.B0"'],
      ["av1", 'video/mp4; codecs="av01.0.15M.10"'],
      ["vp9", 'video/webm; codecs="vp9"'],
      ["eac3", 'audio/mp4; codecs="ec-3"'],
      ["ac3", 'audio/mp4; codecs="ac-3"'],
      ["dts", 'audio/mp4; codecs="dtsc"'],
      ["opus", 'audio/mp4; codecs="opus"'],
      ["mkv", "video/x-matroska"],
      ["hls", "application/vnd.apple.mpegurl"]
    ];
    var lignes = [];
    for (var i = 0; i < essais.length; i++) {
      var natif = video.canPlayType(essais[i][1]) || "non";
      var mse = "n/a";
      if (global.MediaSource && global.MediaSource.isTypeSupported) {
        mse = global.MediaSource.isTypeSupported(essais[i][1]) ? "oui" : "non";
      }
      lignes.push({
        cle: essais[i][0],
        sonde: { etat: natif !== "non" ? "ok" : "ko",
                 valeur: "canPlayType: " + natif + "   |   MSE: " + mse }
      });
    }
    return lignes;
  }

  function environnement() {
    var e = global.screen || {};
    return [
      { cle: "userAgent", sonde: info(global.navigator.userAgent) },
      { cle: "fenetre", sonde: info(global.innerWidth + " x " + global.innerHeight) },
      { cle: "ecran", sonde: info((e.width || "?") + " x " + (e.height || "?")) },
      { cle: "devicePixelRatio", sonde: info(global.devicePixelRatio || 1) },
      { cle: "langue", sonde: info(global.navigator.language || "?") },
      { cle: "PalmSystem", sonde: presence(!!global.PalmSystem) },
      { cle: "webOS (webOSTV.js)", sonde: presence(!!global.webOS) }
    ];
  }

  function apisJs() {
    var proto = global.Element ? global.Element.prototype : {};
    return [
      /* Non couverts par core-js : ce sont des API du DOM. */
      { cle: "Element.scrollBy (Chrome 61)", sonde: presence(typeof proto.scrollBy === "function") },
      { cle: "Element.scrollTo (Chrome 61)", sonde: presence(typeof proto.scrollTo === "function") },
      { cle: "AbortController (66)", sonde: presence(typeof global.AbortController === "function") },
      { cle: "AbortSignal.timeout (103)", sonde: presence(global.AbortSignal && typeof global.AbortSignal.timeout === "function") },
      { cle: "ResizeObserver (64)", sonde: presence(typeof global.ResizeObserver === "function") },
      { cle: "IntersectionObserver (51)", sonde: presence(typeof global.IntersectionObserver === "function") },
      { cle: "Intl.DisplayNames (81)", sonde: presence(global.Intl && typeof global.Intl.DisplayNames === "function") },
      /* Couverts par core-js — verifies pour confirmer que le polyfill charge. */
      { cle: "Object.entries (54)", sonde: presence(typeof Object.entries === "function") },
      { cle: "String padStart (57)", sonde: presence(typeof String.prototype.padStart === "function") },
      { cle: "Array flatMap (69)", sonde: presence(typeof Array.prototype.flatMap === "function") },
      { cle: "Array.at (92)", sonde: presence(typeof Array.prototype.at === "function") },
      { cle: "Promise.allSettled (76)", sonde: presence(global.Promise && typeof global.Promise.allSettled === "function") },
      { cle: "queueMicrotask (71)", sonde: presence(typeof global.queueMicrotask === "function") },
      { cle: "globalThis (71)", sonde: presence(typeof global.globalThis !== "undefined") },
      { cle: "modules ES (61)", sonde: presence("noModule" in document.createElement("script")) },
      { cle: "Worker depuis blob", sonde: workerDepuisBlob() }
    ];
  }

  function apisCss() {
    return [
      { cle: "display: grid (57)", sonde: supporteCss("display", "grid") },
      { cle: "gap en flexbox (84)", sonde: gapEnFlex() },
      { cle: "aspect-ratio (88)", sonde: supporteCss("aspect-ratio", "2 / 3") },
      { cle: "selecteur :focus-visible (86)", sonde: selecteurValide(":focus-visible") },
      { cle: "selecteur :where() (88)", sonde: selecteurValide(":where(a)") },
      { cle: "backdrop-filter (76)", sonde: supporteCss("backdrop-filter", "blur(1px)") },
      { cle: "position: sticky (56)", sonde: supporteCss("position", "sticky") },
      { cle: "overflow: clip (90)", sonde: supporteCss("overflow", "clip") },
      { cle: "content-visibility (85)", sonde: supporteCss("content-visibility", "auto") },
      { cle: "variables CSS (49)", sonde: supporteCss("--x", "1px") },
      { cle: "min() (79)", sonde: supporteCss("width", "min(10px, 2vw)") },
      { cle: "color-mix() (111)", sonde: supporteCss("color", "color-mix(in srgb, red 50%, blue)") }
    ];
  }

  global.SondesWebos = {
    sections: function () {
      return [
        { titre: "Environnement", lignes: environnement() },
        { titre: "API JavaScript", lignes: apisJs() },
        { titre: "CSS", lignes: apisCss() },
        { titre: "Codecs", lignes: typesMedia() }
      ];
    }
  };
})(window);
