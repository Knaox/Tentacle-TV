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

  var RELAIS = "https://pair.tentacletv.app";
  var CODE_OK = 13;

  function ligne(cle, etat, valeur) {
    return { cle: cle, sonde: { etat: etat, valeur: String(valeur) } };
  }

  /* ── 1. Canevas ──────────────────────────────────────────────────────── */

  function mesurerCanevas() {
    var declare = null;
    var balises = document.getElementsByTagName("meta");
    for (var i = 0; i < balises.length; i++) {
      if (balises[i].getAttribute("name") === "viewport") {
        declare = balises[i].getAttribute("content");
      }
    }

    var largeurCss = document.documentElement.clientWidth;
    var largeurDalle = global.screen ? global.screen.width : 0;
    var honore = declare && declare.indexOf("width=") !== -1 && largeurCss !== largeurDalle;

    return [
      ligne("meta viewport déclaré", "info", declare || "aucun"),
      ligne("largeur CSS (clientWidth)", "info", largeurCss),
      ligne("largeur de la dalle (screen)", "info", largeurDalle),
      ligne("agrandissement matériel", "info",
        largeurCss > 0 ? (largeurDalle / largeurCss).toFixed(2) + " ×" : "?"),
      ligne("meta viewport honoré", honore ? "ok" : "ko",
        honore ? "oui — le canevas suffit"
               : "NON — il faudra mettre le CSS à l'échelle à la compilation"),
    ];
  }

  /* ── 2. Répétition et relâchement de OK ──────────────────────────────── */

  function installerReleveMaintien(auRapport) {
    var debut = 0;
    var repetitions = 0;
    var dernier = 0;
    var intervalles = [];
    var vuKeyup = false;

    document.addEventListener("keydown", function (evenement) {
      if (evenement.keyCode !== CODE_OK) return;
      var maintenant = new Date().getTime();
      if (debut === 0) {
        debut = maintenant;
        dernier = maintenant;
        return;
      }
      repetitions++;
      intervalles.push(maintenant - dernier);
      dernier = maintenant;
    });

    document.addEventListener("keyup", function (evenement) {
      if (evenement.keyCode !== CODE_OK || debut === 0) return;
      vuKeyup = true;
      var duree = new Date().getTime() - debut;
      var moyen = intervalles.length > 0 ? moyenne(intervalles) : 0;

      auRapport([
        ligne("keyup reçu", "ok", "oui — le maintien peut se mesurer directement"),
        ligne("durée du maintien", "info", duree + " ms"),
        ligne("répétitions observées", repetitions > 0 ? "ok" : "ko", repetitions),
        ligne("intervalle de répétition", "info",
          moyen > 0 ? Math.round(moyen) + " ms" : "aucune répétition"),
      ]);

      debut = 0;
      repetitions = 0;
      intervalles = [];
    });

    // Chien de garde : si aucun `keyup` n'arrive dans les deux secondes qui
    // suivent la dernière répétition, c'est que le modèle ne le notifie pas.
    setInterval(function () {
      if (debut === 0 || vuKeyup) return;
      var silence = new Date().getTime() - dernier;
      if (silence < 2000) return;
      auRapport([
        ligne("keyup reçu", "ko", "NON — il faudra déduire le relâchement du silence"),
        ligne("intervalle de répétition", "info",
          intervalles.length > 0 ? Math.round(moyenne(intervalles)) + " ms" : "aucune"),
      ]);
      debut = 0;
      repetitions = 0;
      intervalles = [];
    }, 500);
  }

  function moyenne(valeurs) {
    var somme = 0;
    for (var i = 0; i < valeurs.length; i++) somme += valeurs[i];
    return somme / valeurs.length;
  }

  /* ── 3. Le relais depuis file:// ─────────────────────────────────────── */

  function sonderRelais(auRapport) {
    var xhr = new global.XMLHttpRequest();
    var origine = global.location.protocol === "file:" ? "null (file://)" : global.location.origin;

    try {
      xhr.open("POST", RELAIS + "/generate", true);
    } catch (e) {
      auRapport([ligne("relais joignable", "ko", "open() a échoué : " + e.message)]);
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
        ligne("origine de la coquille", "info", origine),
        ligne("relais joignable", ok ? "ok" : "ko",
          ok ? "oui — code obtenu" : "statut " + xhr.status + " (0 = bloqué par CORS)"),
        ligne("réponse du relais", ok ? "ok" : "info", (xhr.responseText || "").slice(0, 80)),
      ]);
    };
    xhr.ontimeout = function () {
      auRapport([ligne("relais joignable", "ko", "délai dépassé (8 s)")]);
    };
    xhr.send(null);
  }

  /* ── 4. La boîte rendue par le ResizeObserver natif ──────────────────── */

  function mesurerBoiteObservateur(auRapport) {
    if (typeof global.ResizeObserver !== "function") {
      auRapport([
        ligne("ResizeObserver.contentRect", "info",
          "pas d'observateur natif — c'est le polyfill du client qui répond"),
      ]);
      return;
    }

    var boite = document.createElement("div");
    boite.style.cssText =
      "position:absolute;left:-9999px;top:0;box-sizing:content-box;" +
      "width:200px;height:20px;padding:20px;border:5px solid #000";
    document.body.appendChild(boite);

    var repondu = false;
    var ranger = function () {
      if (boite.parentNode) boite.parentNode.removeChild(boite);
    };

    var observateur = new global.ResizeObserver(function (entrees) {
      repondu = true;
      var largeur = Math.round(entrees[0].contentRect.width);
      observateur.disconnect();
      ranger();
      auRapport([
        ligne("ResizeObserver.contentRect", largeur === 200 ? "ok" : "ko",
          largeur === 200
            ? "boîte de contenu (200 px) — conforme"
            : "boîte de BORDURE (" + largeur + " px au lieu de 200)"),
      ]);
    });
    observateur.observe(boite);

    // L'observateur livre ses mesures dans la boucle de rendu. Un silence n'est
    // donc pas un détail d'implémentation : c'est un observateur présent mais
    // inerte, et le client doit alors s'en passer comme s'il était absent.
    setTimeout(function () {
      if (repondu) return;
      observateur.disconnect();
      ranger();
      auRapport([
        ligne("ResizeObserver.contentRect", "ko",
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
  function sonderServicesVocaux(auRapport) {
    var service = global.webOS && global.webOS.service;
    if (!service || typeof service.request !== "function") {
      auRapport([
        ligne("services Luna", "info",
          "webOS.service absent — déposez webOSTV.js dans la coquille pour trancher"),
      ]);
      return;
    }

    var candidats = [
      ["com.webos.service.ime", "getStatus"],
      ["com.webos.service.tts", "getStatus"],
      ["com.webos.service.voiceinput", "getStatus"],
    ];

    for (var i = 0; i < candidats.length; i++) {
      interrogerService(service, candidats[i][0], candidats[i][1], auRapport);
    }
  }

  function interrogerService(service, nom, methode, auRapport) {
    var cle = "luna://" + nom;
    auRapport([ligne(cle, "info", "interrogation…")]);
    try {
      service.request(cle, {
        method: methode,
        parameters: {},
        onSuccess: function (reponse) {
          auRapport([ligne(cle, "ok", "répond : " + resumer(reponse))]);
        },
        onFailure: function (erreur) {
          auRapport([ligne(cle, "ko", "refuse : " + resumer(erreur))]);
        },
      });
    } catch (e) {
      auRapport([ligne(cle, "ko", "appel impossible : " + e.message)]);
    }
  }

  function resumer(valeur) {
    try {
      return JSON.stringify(valeur).slice(0, 120);
    } catch (e) {
      return String(valeur).slice(0, 120);
    }
  }

  global.SondeDalle = {
    canevas: mesurerCanevas,
    installerReleveMaintien: installerReleveMaintien,
    sonderRelais: sonderRelais,
    mesurerBoiteObservateur: mesurerBoiteObservateur,
    sonderServicesVocaux: sonderServicesVocaux,
  };
})(window);
