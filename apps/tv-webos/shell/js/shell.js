/* Coquille IPK — saisie de l'adresse du serveur, puis navigation vers le client.
 *
 * ES5 strict, aucune dependance. Le client React n'est PAS embarque : il est
 * servi par le serveur Tentacle sur /tv. Mettre a jour le serveur met donc a
 * jour le televiseur, sans repasser par la revue du Content Store.
 *
 * Navigation en top-level (`location.href`) plutot qu'en `<iframe>` : le cookie
 * de session du backend est `sameSite: "strict"` et helmet pose
 * `X-Frame-Options: SAMEORIGIN`. Dans un cadre dont le document racine est
 * `file://`, l'authentification ne peut pas fonctionner et le cadre reste
 * blanc. En top-level, le client tourne sur l'origine du serveur : cookies,
 * routage et proxy same-origin fonctionnent sans adaptation.
 *
 * `href` et non `replace` : la page de la coquille reste dans l'historique,
 * donc la touche Retour a la racine du client peut y revenir par
 * `history.back()`. Une navigation `http://` vers `file://` etant interdite,
 * c'est le seul chemin de retour possible. */

(function (global) {
  "use strict";

  var CHEMIN_CLIENT = "/tv/";
  var DELAI_SONDE_MS = 8000;

  var T = {
    fr: {
      legende: "Adresse de votre serveur Tentacle",
      connecter: "Se connecter",
      oublier: "Changer de serveur",
      aide: "Saisissez l'adresse affichee dans les reglages de votre serveur, " +
            "par exemple http://192.168.1.10:3001. Utilisez les fleches et OK " +
            "de la telecommande.",
      attente: "Connexion au serveur...",
      vide: "Saisissez une adresse.",
      injoignable: "Serveur injoignable. Verifiez l'adresse et que le serveur " +
                   "est allume.",
      sansClientTv: "Ce serveur ne fournit pas encore le client televiseur. " +
                    "Mettez a jour Tentacle sur le serveur, puis reessayez."
    },
    en: {
      legende: "Your Tentacle server address",
      connecter: "Connect",
      oublier: "Change server",
      aide: "Enter the address shown in your server settings, for example " +
            "http://192.168.1.10:3001. Use the arrow keys and OK on your remote.",
      attente: "Connecting to the server...",
      vide: "Enter an address.",
      injoignable: "Server unreachable. Check the address and that the server " +
                   "is running.",
      sansClientTv: "This server does not provide the TV client yet. Update " +
                    "Tentacle on the server, then try again."
    }
  };

  var t = T.en;
  var champ = null;
  var boutonConnecter = null;
  var boutonOublier = null;
  var zoneErreur = null;

  function choisirLangue() {
    var langue = String(global.navigator.language || "en").toLowerCase();
    t = langue.indexOf("fr") === 0 ? T.fr : T.en;
  }

  function poserTextes() {
    document.getElementById("legende").textContent = t.legende;
    document.getElementById("aide").textContent = t.aide;
    document.getElementById("attente").textContent = t.attente;
    boutonConnecter.textContent = t.connecter;
    boutonOublier.textContent = t.oublier;
  }

  function afficherErreur(message) {
    zoneErreur.textContent = message;
    zoneErreur.style.display = message ? "block" : "none";
  }

  function afficherEtape(nom) {
    document.getElementById("etape-serveur").style.display =
      nom === "serveur" ? "block" : "none";
    document.getElementById("etape-attente").style.display =
      nom === "attente" ? "block" : "none";
  }

  /* Sonde `/tv/` avant de naviguer. Sans cela, un serveur trop ancien renvoie
   * une page blanche sans explication — le pendant de `minServer`, dans le sens
   * inverse : ici c'est le serveur qui dicte la version du client. */
  function sonderClientTv(base, auSucces, aLEchec) {
    var xhr = new global.XMLHttpRequest();
    var termine = false;

    function conclure(ok, raison) {
      if (termine) return;
      termine = true;
      if (ok) auSucces();
      else aLEchec(raison);
    }

    try {
      xhr.open("GET", base + CHEMIN_CLIENT, true);
    } catch (e) {
      conclure(false, t.injoignable);
      return;
    }
    xhr.timeout = DELAI_SONDE_MS;
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (xhr.status >= 200 && xhr.status < 400) conclure(true);
      else if (xhr.status === 0) conclure(false, t.injoignable);
      else conclure(false, t.sansClientTv);
    };
    xhr.ontimeout = function () { conclure(false, t.injoignable); };
    xhr.onerror = function () { conclure(false, t.injoignable); };
    xhr.send(null);
  }

  function connecter() {
    var base = global.StockageCoquille.normaliser(champ.value);
    if (base === "") {
      afficherErreur(t.vide);
      champ.focus();
      return;
    }
    afficherErreur("");
    afficherEtape("attente");
    sonderClientTv(base, function () {
      global.StockageCoquille.ecrire(base);
      global.location.href = base + CHEMIN_CLIENT + global.InfoAppareil.enParametres();
    }, function (raison) {
      afficherEtape("serveur");
      afficherErreur(raison);
      champ.focus();
    });
  }

  function oublier() {
    global.StockageCoquille.oublier();
    champ.value = "";
    boutonOublier.style.display = "none";
    afficherErreur("");
    champ.focus();
  }

  /* Retour a l'ecran d'accueil du televiseur. webOSTV.js n'est pas embarque
   * dans le depot — c'est une bibliotheque du SDK LG, a deposer dans
   * `shell/js/` (voir le README). En son absence, `PalmSystem` reste injecte
   * par le gestionnaire d'applications et fait exactement le meme travail. */
  function quitter() {
    if (global.webOS && typeof global.webOS.platformBack === "function") {
      global.webOS.platformBack();
      return;
    }
    if (global.PalmSystem && typeof global.PalmSystem.platformBack === "function") {
      global.PalmSystem.platformBack();
    }
  }

  /* Navigation a la telecommande : le formulaire est vertical, donc haut et bas
   * suffisent. OK valide depuis n'importe ou, Retour quitte l'application. */
  function installerTouches() {
    var ordre = [champ, boutonConnecter, boutonOublier];

    document.addEventListener("keydown", function (evenement) {
      var code = evenement.keyCode;
      if (code === 461 || code === 27) {
        quitter();
        return;
      }
      if (code === 13) {
        if (document.activeElement === champ) {
          connecter();
          evenement.preventDefault();
        }
        return;
      }
      if (code !== 38 && code !== 40) return;

      var visibles = [];
      for (var i = 0; i < ordre.length; i++) {
        if (ordre[i] && ordre[i].offsetParent !== null) visibles.push(ordre[i]);
      }
      var index = visibles.indexOf(document.activeElement);
      var suivant = index + (code === 40 ? 1 : -1);
      if (suivant < 0 || suivant >= visibles.length) return;
      visibles[suivant].focus();
      evenement.preventDefault();
    });
  }

  function demarrer() {
    choisirLangue();
    champ = document.getElementById("adresse");
    boutonConnecter = document.getElementById("connecter");
    boutonOublier = document.getElementById("oublier");
    zoneErreur = document.getElementById("erreur");

    poserTextes();
    global.InfoAppareil.collecter();

    var memorisee = global.StockageCoquille.lire();
    if (memorisee) {
      champ.value = memorisee;
      boutonOublier.style.display = "inline-block";
    }

    boutonConnecter.onclick = connecter;
    boutonOublier.onclick = oublier;
    installerTouches();

    if (memorisee) connecter();
    else champ.focus();
  }

  global.demarrerCoquille = demarrer;
})(window);
