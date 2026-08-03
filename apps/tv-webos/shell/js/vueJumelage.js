/* Le rendu de l'écran de jumelage.
 *
 * ES5 strict. Quatre grands chiffres, un compte à rebours, et au plus deux
 * boutons — le D-pad se réduit ainsi à haut et bas, ce qui n'a besoin d'aucune
 * navigation spatiale.
 *
 * Les chaînes sont ici et non dans le système d'internationalisation de
 * l'application : la coquille est servie depuis `file://` et ne charge aucun
 * module. Elles reprennent le vocabulaire du namespace `pairing`.
 */

(function (global) {
  "use strict";

  var T = {
    fr: {
      titre: "Jumeler ce téléviseur",
      instructions:
        "Ouvrez Tentacle TV sur votre téléphone ou votre ordinateur, allez dans " +
        "Jumeler un appareil, et saisissez ce code.",
      expireDans: "Ce code expire dans",
      chargement: "Préparation du code...",
      attente: "Connexion à votre serveur...",
      expireTitre: "Code expiré",
      expireTexte: "Personne ne l'a saisi à temps. Demandez-en un nouveau.",
      nouveauCode: "Nouveau code",
      erreurTitre: "Service de jumelage injoignable",
      erreurTexte:
        "Vérifiez que le téléviseur est connecté à Internet, puis réessayez.",
      reessayer: "Réessayer",
    },
    en: {
      titre: "Pair this TV",
      instructions:
        "Open Tentacle TV on your phone or computer, go to Pair a device, and " +
        "enter this code.",
      expireDans: "This code expires in",
      chargement: "Preparing your code...",
      attente: "Connecting to your server...",
      expireTitre: "Code expired",
      expireTexte: "Nobody entered it in time. Ask for a new one.",
      nouveauCode: "New code",
      erreurTitre: "Pairing service unreachable",
      erreurTexte: "Check that the TV is connected to the internet, then try again.",
      reessayer: "Try again",
    },
  };

  var t = T.en;

  function choisirLangue() {
    var langue = String(global.navigator.language || "en").toLowerCase();
    t = langue.indexOf("fr") === 0 ? T.fr : T.en;
  }

  function zone() {
    return document.getElementById("etape-jumelage");
  }

  function vider() {
    var conteneur = zone();
    while (conteneur.firstChild) conteneur.removeChild(conteneur.firstChild);
    return conteneur;
  }

  function element(balise, classe, texte) {
    var noeud = document.createElement(balise);
    if (classe) noeud.className = classe;
    if (texte) noeud.appendChild(document.createTextNode(texte));
    return noeud;
  }

  function bouton(libelle, action, premier) {
    var noeud = element("button", "bouton", libelle);
    noeud.type = "button";
    noeud.onclick = action;
    if (premier) setTimeout(function () { noeud.focus(); }, 0);
    return noeud;
  }

  function message(titre, texte, libelleAction, action) {
    var conteneur = vider();
    conteneur.appendChild(element("h2", "titre-etape", titre));
    conteneur.appendChild(element("p", "legende", texte));
    if (action) conteneur.appendChild(bouton(libelleAction, action, true));
  }

  function formaterRebours(secondes) {
    var minutes = Math.floor(secondes / 60);
    var reste = secondes % 60;
    return minutes + ":" + (reste < 10 ? "0" : "") + reste;
  }

  function afficherCode(code, secondes) {
    var conteneur = vider();
    conteneur.appendChild(element("h2", "titre-etape", t.titre));

    var cases = element("div", "code-cases");
    for (var i = 0; i < code.length; i++) {
      cases.appendChild(element("span", "code-case", code.charAt(i)));
    }
    conteneur.appendChild(cases);

    conteneur.appendChild(element("p", "legende", t.instructions));

    var rebours = element("p", "rebours", t.expireDans + " " + formaterRebours(secondes));
    rebours.id = "rebours";
    conteneur.appendChild(rebours);
  }

  function majRebours(secondes) {
    var noeud = document.getElementById("rebours");
    if (noeud) noeud.textContent = t.expireDans + " " + formaterRebours(secondes);
  }

  /**
   * Le jeton passe par le FRAGMENT, jamais par la requête.
   *
   * C'est un JWT sans expiration : dans une chaîne de requête il finirait dans
   * les journaux d'accès du serveur et dans les en-têtes `Referer`. Un
   * fragment n'est envoyé nulle part.
   */
  function naviguer(adresse, jeton, utilisateur) {
    var url = adresse + "/tv/" + global.InfoAppareil.enParametres();
    if (jeton) {
      url += "#jeton=" + encodeURIComponent(jeton) +
        "&u=" + encodeURIComponent(utilisateur ? utilisateur.id : "") +
        "&n=" + encodeURIComponent(utilisateur ? utilisateur.name : "");
    }
    global.location.href = url;
  }

  global.VueJumelage = {
    preparer: choisirLangue,
    afficherChargement: function () { message(t.chargement, "", null, null); },
    afficherAttente: function () { message(t.attente, "", null, null); },
    afficherCode: afficherCode,
    majRebours: majRebours,
    afficherExpire: function (action) {
      message(t.expireTitre, t.expireTexte, t.nouveauCode, action);
    },
    afficherErreur: function (action) {
      message(t.erreurTitre, t.erreurTexte, t.reessayer, action);
    },
    naviguer: naviguer,
  };
})(window);
