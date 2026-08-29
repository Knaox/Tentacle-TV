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

  function ok(value) { return { state: "ok", value: String(value) }; }
  function ko(value) { return { state: "ko", value: String(value) }; }
  function info(value) { return { state: "info", value: String(value) }; }
  function presence(condition) { return condition ? ok("present") : ko("absent"); }

  /* `CSS.supports` ne distingue pas `gap` en grille de `gap` en flex : il
   * repond vrai des que la grille l'accepte (Chrome 66), alors que la flexbox
   * ne l'a qu'a partir de Chrome 84. Seule une mesure reelle tranche. */
  function gapEnFlex() {
    var container = document.createElement("div");
    container.style.cssText =
      "position:absolute;visibility:hidden;display:flex;gap:50px;width:400px";
    var a = document.createElement("div");
    var b = document.createElement("div");
    a.style.cssText = b.style.cssText = "width:20px;height:20px;flex:none";
    container.appendChild(a);
    container.appendChild(b);
    document.body.appendChild(container);
    var gap = b.getBoundingClientRect().left - a.getBoundingClientRect().right;
    document.body.removeChild(container);
    return Math.round(gap) === 50
      ? ok("honore (" + Math.round(gap) + " px)")
      : ko("ignore (" + Math.round(gap) + " px au lieu de 50)");
  }

  /* Un selecteur inconnu invalide la regle entiere : le moteur ne l'insere pas
   * dans la feuille. Compter les regles est donc le test le plus fiable. */
  function validSelector(selector) {
    var tag = document.createElement("style");
    tag.appendChild(document.createTextNode(selector + "{color:red}"));
    document.head.appendChild(tag);
    var count = 0;
    try {
      count = tag.sheet && tag.sheet.cssRules ? tag.sheet.cssRules.length : 0;
    } catch (e) {
      count = 0;
    }
    document.head.removeChild(tag);
    return count > 0 ? ok("regle acceptee") : ko("regle rejetee");
  }

  function supportsCss(property, value) {
    if (!global.CSS || typeof global.CSS.supports !== "function") {
      return info("CSS.supports absent");
    }
    return global.CSS.supports(property, value) ? ok("supporte") : ko("non supporte");
  }

  /* libpgs instancie son demultiplexeur dans un worker cree depuis un blob.
   * Si la politique de securite du contenu le refuse, le rendu des sous-titres
   * PGS retombe sur le fil principal — ou echoue. */
  function workerFromBlob() {
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

  function mediaTypes() {
    var video = document.createElement("video");
    var attempts = [
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
    var lines = [];
    for (var i = 0; i < attempts.length; i++) {
      var native = video.canPlayType(attempts[i][1]) || "non";
      var mse = "n/a";
      if (global.MediaSource && global.MediaSource.isTypeSupported) {
        mse = global.MediaSource.isTypeSupported(attempts[i][1]) ? "oui" : "non";
      }
      lines.push({
        key: attempts[i][0],
        sonde: { state: native !== "non" ? "ok" : "ko",
                 value: "canPlayType: " + native + "   |   MSE: " + mse }
      });
    }
    return lines;
  }

  function environment() {
    var e = global.screen || {};
    return [
      { key: "userAgent", sonde: info(global.navigator.userAgent) },
      { key: "fenetre", sonde: info(global.innerWidth + " x " + global.innerHeight) },
      { key: "ecran", sonde: info((e.width || "?") + " x " + (e.height || "?")) },
      { key: "devicePixelRatio", sonde: info(global.devicePixelRatio || 1) },
      { key: "langue", sonde: info(global.navigator.language || "?") },
      { key: "PalmSystem", sonde: presence(!!global.PalmSystem) },
      { key: "webOS (webOSTV.js)", sonde: presence(!!global.webOS) }
    ];
  }

  function apisJs() {
    var proto = global.Element ? global.Element.prototype : {};
    return [
      /* Non couverts par core-js : ce sont des API du DOM. */
      { key: "Element.scrollBy (Chrome 61)", sonde: presence(typeof proto.scrollBy === "function") },
      { key: "Element.scrollTo (Chrome 61)", sonde: presence(typeof proto.scrollTo === "function") },
      { key: "AbortController (66)", sonde: presence(typeof global.AbortController === "function") },
      { key: "AbortSignal.timeout (103)", sonde: presence(global.AbortSignal && typeof global.AbortSignal.timeout === "function") },
      { key: "ResizeObserver (64)", sonde: presence(typeof global.ResizeObserver === "function") },
      { key: "IntersectionObserver (51)", sonde: presence(typeof global.IntersectionObserver === "function") },
      { key: "entry.isIntersecting (58)", sonde: intersectionAttribute() },
      { key: "Intl.DisplayNames (81)", sonde: presence(global.Intl && typeof global.Intl.DisplayNames === "function") },
      /* Couverts par core-js — verifies pour confirmer que le polyfill charge. */
      { key: "Object.entries (54)", sonde: presence(typeof Object.entries === "function") },
      { key: "String padStart (57)", sonde: presence(typeof String.prototype.padStart === "function") },
      { key: "Array flatMap (69)", sonde: presence(typeof Array.prototype.flatMap === "function") },
      { key: "Array.at (92)", sonde: presence(typeof Array.prototype.at === "function") },
      { key: "Promise.allSettled (76)", sonde: presence(global.Promise && typeof global.Promise.allSettled === "function") },
      { key: "queueMicrotask (71)", sonde: presence(typeof global.queueMicrotask === "function") },
      { key: "globalThis (71)", sonde: presence(typeof global.globalThis !== "undefined") },
      { key: "modules ES (61)", sonde: presence("noModule" in document.createElement("script")) },
      { key: "Worker depuis blob", sonde: workerFromBlob() }
    ];
  }

  /* L'observateur d'intersection est arrive en Chrome 51, mais `isIntersecting`
   * n'a ete ajoute a la spec qu'en Chrome 58. Entre les deux, l'attribut vaut
   * `undefined` — donc faux — alors que toutes les gardes `typeof
   * IntersectionObserver === "function"` passent et qu'aucun repli ne se
   * declenche. Sur un socle Chrome 53, c'est la difference entre un accueil
   * peuple et un accueil vide. */
  function intersectionAttribute() {
    var Entree = global.IntersectionObserverEntry;
    if (typeof Entree !== "function") return ko("IntersectionObserverEntry absent");
    return "isIntersecting" in Entree.prototype
      ? ok("present")
      : ko("ABSENT — il faut lire intersectionRatio > 0");
  }

  /* Ce que la plateforme offre a une application tierce, cote voix et cote
   * sortie. Les valeurs sont brutes : on veut savoir ce qui existe, pas ce
   * qu'on aimerait qui existe. */
  function voiceAndPlatform() {
    var palm = global.PalmSystem || {};
    var webos = global.webOS || {};
    return [
      { key: "webkitSpeechRecognition", sonde: presence(typeof global.webkitSpeechRecognition === "function") },
      { key: "SpeechRecognition", sonde: presence(typeof global.SpeechRecognition === "function") },
      { key: "speechSynthesis (synthese)", sonde: presence(!!global.speechSynthesis) },
      { key: "webOS.service.request", sonde: presence(webos.service && typeof webos.service.request === "function") },
      { key: "PalmSystem.platformBack", sonde: presence(typeof palm.platformBack === "function") },
      { key: "webOS.platformBack", sonde: presence(typeof webos.platformBack === "function") },
      { key: "PalmSystem.deviceInfo", sonde: presence(typeof palm.deviceInfo === "string") },
      /* Une saisie focalisee doit faire monter le clavier systeme : c'est le
       * seul chemin de dictee documente. Rien ne le sonde depuis le script —
       * seul l'oeil tranche. La ligne est ici pour qu'on pense a regarder. */
      { key: "clavier systeme au focus", sonde: info("a constater : le champ ci-dessous doit l'ouvrir") }
    ];
  }

  function apisCss() {
    return [
      { key: "display: grid (57)", sonde: supportsCss("display", "grid") },
      { key: "gap en flexbox (84)", sonde: gapEnFlex() },
      { key: "aspect-ratio (88)", sonde: supportsCss("aspect-ratio", "2 / 3") },
      { key: "selecteur :focus-visible (86)", sonde: validSelector(":focus-visible") },
      { key: "selecteur :where() (88)", sonde: validSelector(":where(a)") },
      { key: "backdrop-filter (76)", sonde: supportsCss("backdrop-filter", "blur(1px)") },
      { key: "position: sticky (56)", sonde: supportsCss("position", "sticky") },
      { key: "overflow: clip (90)", sonde: supportsCss("overflow", "clip") },
      { key: "content-visibility (85)", sonde: supportsCss("content-visibility", "auto") },
      { key: "variables CSS (49)", sonde: supportsCss("--x", "1px") },
      { key: "min() (79)", sonde: supportsCss("width", "min(10px, 2vw)") },
      { key: "color-mix() (111)", sonde: supportsCss("color", "color-mix(in srgb, red 50%, blue)") }
    ];
  }

  global.WebosProbes = {
    sections: function () {
      return [
        { title: "Environnement", lines: environment() },
        { title: "API JavaScript", lines: apisJs() },
        { title: "Voix et plateforme", lines: voiceAndPlatform() },
        { title: "CSS", lines: apisCss() },
        { title: "Codecs", lines: mediaTypes() }
      ];
    }
  };
})(window);
