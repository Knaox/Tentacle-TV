/* Les mesures que seule la dalle peut donner.
 *
 * ES5 strict. Elles ne relèvent pas d'une curiosité : chacune décide de la
 * forme d'une partie du client, et aucun navigateur de bureau ne peut y
 * répondre — Chrome ignore le meta viewport, n'a pas de télécommande, ne sert
 * jamais de page depuis `file://` et n'a pas de bus de services Luna.
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
 *   4. Le `ResizeObserver` natif rend-il une boîte de CONTENU ? Le polyfill du
 *      client rend une boîte de bordure ; la grille de bibliothèque mesure sa
 *      largeur avec, et se trompe alors de tout le padding.
 *   5. Que répondent les services Luna candidats ? La reconnaissance vocale
 *      n'est pas exposée aux applications tierces — on relève ce que la
 *      plateforme dit elle-même plutôt que de le supposer.
 */

(function (global) {
  "use strict";

  var RELAY = "https://pair.tentacletv.app";
  var CODE_OK = 13;

  function line(key, state, value) {
    return { key: key, sonde: { state: state, value: String(value) } };
  }

  /* ── 1. Canevas ──────────────────────────────────────────────────────── */

  function measureCanvas() {
    var declare = null;
    var tags = document.getElementsByTagName("meta");
    for (var i = 0; i < tags.length; i++) {
      if (tags[i].getAttribute("name") === "viewport") {
        declare = tags[i].getAttribute("content");
      }
    }

    var cssWidth = document.documentElement.clientWidth;
    var panelWidth = global.screen ? global.screen.width : 0;
    var honors = declare && declare.indexOf("width=") !== -1 && cssWidth !== panelWidth;

    return [
      line("meta viewport déclaré", "info", declare || "aucun"),
      line("largeur CSS (clientWidth)", "info", cssWidth),
      line("largeur de la dalle (screen)", "info", panelWidth),
      line("agrandissement matériel", "info",
        cssWidth > 0 ? (panelWidth / cssWidth).toFixed(2) + " ×" : "?"),
      line("meta viewport honoré", honors ? "ok" : "ko",
        honors ? "oui — le canevas suffit"
               : "NON — il faudra mettre le CSS à l'échelle à la compilation"),
    ];
  }

  /* ── 2. Répétition et relâchement de OK ──────────────────────────────── */

  function installHoldCapture(auRapport) {
    var debut = 0;
    var repeats = 0;
    var last = 0;
    var intervals = [];
    var sawKeyup = false;

    document.addEventListener("keydown", function (event) {
      if (event.keyCode !== CODE_OK) return;
      var now = new Date().getTime();
      if (debut === 0) {
        debut = now;
        last = now;
        return;
      }
      repeats++;
      intervals.push(now - last);
      last = now;
    });

    document.addEventListener("keyup", function (event) {
      if (event.keyCode !== CODE_OK || debut === 0) return;
      sawKeyup = true;
      var duration = new Date().getTime() - debut;
      var mean = intervals.length > 0 ? average(intervals) : 0;

      auRapport([
        line("keyup reçu", "ok", "oui — le maintien peut se mesurer directement"),
        line("durée du maintien", "info", duration + " ms"),
        line("répétitions observées", repeats > 0 ? "ok" : "ko", repeats),
        line("intervalle de répétition", "info",
          mean > 0 ? Math.round(mean) + " ms" : "aucune répétition"),
      ]);

      debut = 0;
      repeats = 0;
      intervals = [];
    });

    // Chien de garde : si aucun `keyup` n'arrive dans les deux secondes qui
    // suivent la dernière répétition, c'est que le modèle ne le notifie pas.
    setInterval(function () {
      if (debut === 0 || sawKeyup) return;
      var silence = new Date().getTime() - last;
      if (silence < 2000) return;
      auRapport([
        line("keyup reçu", "ko", "NON — il faudra déduire le relâchement du silence"),
        line("intervalle de répétition", "info",
          intervals.length > 0 ? Math.round(average(intervals)) + " ms" : "aucune"),
      ]);
      debut = 0;
      repeats = 0;
      intervals = [];
    }, 500);
  }

  function average(values) {
    var somme = 0;
    for (var i = 0; i < values.length; i++) somme += values[i];
    return somme / values.length;
  }

  /* ── 3. Le relais depuis file:// ─────────────────────────────────────── */

  function probeRelay(auRapport) {
    var xhr = new global.XMLHttpRequest();
    var origin = global.location.protocol === "file:" ? "null (file://)" : global.location.origin;

    try {
      xhr.open("POST", RELAY + "/generate", true);
    } catch (e) {
      auRapport([line("relais joignable", "ko", "open() a échoué : " + e.message)]);
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
        line("origine de la coquille", "info", origin),
        line("relais joignable", ok ? "ok" : "ko",
          ok ? "oui — code obtenu" : "statut " + xhr.status + " (0 = bloqué par CORS)"),
        line("réponse du relais", ok ? "ok" : "info", (xhr.responseText || "").slice(0, 80)),
      ]);
    };
    xhr.ontimeout = function () {
      auRapport([line("relais joignable", "ko", "délai dépassé (8 s)")]);
    };
    xhr.send(null);
  }

  /* ── 4. La boîte rendue par le ResizeObserver natif ──────────────────── */

  function measureObserverBox(auRapport) {
    if (typeof global.ResizeObserver !== "function") {
      auRapport([
        line("ResizeObserver.contentRect", "info",
          "pas d'observateur natif — c'est le polyfill du client qui répond"),
      ]);
      return;
    }

    var box = document.createElement("div");
    box.style.cssText =
      "position:absolute;left:-9999px;top:0;box-sizing:content-box;" +
      "width:200px;height:20px;padding:20px;border:5px solid #000";
    document.body.appendChild(box);

    var answered = false;
    var ranger = function () {
      if (box.parentNode) box.parentNode.removeChild(box);
    };

    var observer = new global.ResizeObserver(function (entries) {
      answered = true;
      var width = Math.round(entries[0].contentRect.width);
      observer.disconnect();
      ranger();
      auRapport([
        line("ResizeObserver.contentRect", width === 200 ? "ok" : "ko",
          width === 200
            ? "boîte de contenu (200 px) — conforme"
            : "boîte de BORDURE (" + width + " px au lieu de 200)"),
      ]);
    });
    observer.observe(box);

    // L'observateur livre ses mesures dans la boucle de rendu. Un silence n'est
    // donc pas un détail d'implémentation : c'est un observateur présent mais
    // inerte, et le client doit alors s'en passer comme s'il était absent.
    setTimeout(function () {
      if (answered) return;
      observer.disconnect();
      ranger();
      auRapport([
        line("ResizeObserver.contentRect", "ko",
          "aucune notification en 2 s — présent mais inerte"),
      ]);
    }, 2000);
  }

  /* ── 5. Ce que répondent les services Luna candidats ─────────────────── */

  /* On demande une méthode inoffensive et on rapporte la réponse telle quelle,
   * succès comme erreur. Un « service introuvable » et un « accès refusé » ne
   * disent pas la même chose, et c'est précisément la distinction cherchée :
   * savoir si une application tierce peut approcher la dictée, ou si le clavier
   * système reste le seul chemin. */
  function probeVoiceServices(auRapport) {
    var service = global.webOS && global.webOS.service;
    if (!service || typeof service.request !== "function") {
      auRapport([
        line("services Luna", "info",
          "webOS.service absent — déposez webOSTV.js dans la coquille pour trancher"),
      ]);
      return;
    }

    var candidates = [
      ["com.webos.service.ime", "getStatus"],
      ["com.webos.service.tts", "getStatus"],
      ["com.webos.service.voiceinput", "getStatus"],
    ];

    for (var i = 0; i < candidates.length; i++) {
      callService(service, candidates[i][0], candidates[i][1], auRapport);
    }
  }

  function callService(service, nom, method, auRapport) {
    var key = "luna://" + nom;
    auRapport([line(key, "info", "interrogation…")]);
    try {
      service.request(key, {
        method: method,
        parameters: {},
        onSuccess: function (response) {
          auRapport([line(key, "ok", "répond : " + summarize(response))]);
        },
        onFailure: function (error) {
          auRapport([line(key, "ko", "refuse : " + summarize(error))]);
        },
      });
    } catch (e) {
      auRapport([line(key, "ko", "appel impossible : " + e.message)]);
    }
  }

  function summarize(value) {
    try {
      return JSON.stringify(value).slice(0, 120);
    } catch (e) {
      return String(value).slice(0, 120);
    }
  }

  global.PanelProbe = {
    canvas: measureCanvas,
    installHoldCapture: installHoldCapture,
    probeRelay: probeRelay,
    measureObserverBox: measureObserverBox,
    probeVoiceServices: probeVoiceServices,
  };
})(window);
