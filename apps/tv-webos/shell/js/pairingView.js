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
      title: "Jumeler ce téléviseur",
      instructions:
        "Ouvrez Tentacle TV sur votre téléphone ou votre ordinateur, allez dans " +
        "Jumeler un appareil, et saisissez ce code.",
      expiresInMs: "Ce code expire dans",
      patience: "Chargement",
      expiredTitle: "Code expiré",
      expiredText: "Personne ne l'a saisi à temps. Demandez-en un nouveau.",
      newCode: "Nouveau code",
      errorTitle: "Service de jumelage injoignable",
      errorText:
        "Vérifiez que le téléviseur est connecté à Internet, puis réessayez.",
      retryIt: "Réessayer",
    },
    en: {
      title: "Pair this TV",
      instructions:
        "Open Tentacle TV on your phone or computer, go to Pair a device, and " +
        "enter this code.",
      expiresInMs: "This code expires in",
      patience: "Loading",
      expiredTitle: "Code expired",
      expiredText: "Nobody entered it in time. Ask for a new one.",
      newCode: "New code",
      errorTitle: "Pairing service unreachable",
      errorText: "Check that the TV is connected to the internet, then try again.",
      retryIt: "Try again",
    },
  };

  var t = T.en;

  function chooseLanguage() {
    var langue = String(global.navigator.language || "en").toLowerCase();
    t = langue.indexOf("fr") === 0 ? T.fr : T.en;
  }

  function zone() {
    return document.getElementById("etape-jumelage");
  }

  function clear() {
    document.body.classList.remove("attente");
    var container = zone();
    while (container.firstChild) container.removeChild(container.firstChild);
    return container;
  }

  function element(tag, cssClass, text) {
    var node = document.createElement(tag);
    if (cssClass) node.className = cssClass;
    if (text) node.appendChild(document.createTextNode(text));
    return node;
  }

  function button(label, action, premier) {
    var node = element("button", "bouton", label);
    node.type = "button";
    node.onclick = action;
    if (premier) setTimeout(function () { node.focus(); }, 0);
    return node;
  }

  /**
   * L'écran d'attente : le logo respire, un anneau tourne, aucun texte.
   *
   * Servi aussi bien avant la génération d'un code qu'au lancement d'une
   * application déjà jumelée — un seul état de patience, du splash au client.
   * L'anneau reste affiché pendant que le navigateur charge la page du
   * client : la navigation ne remplace le document qu'à la réponse du
   * serveur, l'animation couvre donc tout le trajet.
   */
  function showPatience() {
    var container = clear();
    document.body.classList.add("attente");
    var ring = element("div", "anneau-attente");
    ring.setAttribute("role", "progressbar");
    ring.setAttribute("aria-label", t.patience);
    container.appendChild(ring);
  }

  function message(title, text, actionLabel, action) {
    var container = clear();
    container.appendChild(element("h2", "titre-etape", title));
    container.appendChild(element("p", "legende", text));
    if (action) container.appendChild(button(actionLabel, action, true));
  }

  function formatCountdown(seconds) {
    var minutes = Math.floor(seconds / 60);
    var rest = seconds % 60;
    return minutes + ":" + (rest < 10 ? "0" : "") + rest;
  }

  /* La durée de vie annoncée à la première image, gardée pour que la jauge ait
     un dénominateur. Le relais ne la répète pas à chaque sondage. */
  var initialDuration = 0;

  function showCode(code, seconds) {
    var container = clear();
    initialDuration = seconds > 0 ? seconds : 0;

    /* Ni titre ni sous-titre : l'écran d'Android TV n'en porte pas. Il montre
       le logo, le code, l'instruction, le temps qui reste — dans cet ordre. */
    var cells = element("div", "code-cases");
    for (var i = 0; i < code.length; i++) {
      cells.appendChild(element("span", "code-case", code.charAt(i)));
    }
    container.appendChild(cells);

    container.appendChild(element("p", "legende", t.instructions));

    var countdown = element("p", "rebours", t.expiresInMs + " " + formatCountdown(seconds));
    countdown.id = "rebours";
    container.appendChild(countdown);

    /* La jauge d'Android TV : elle dit d'un coup d'œil, sans lire l'heure,
       combien il reste — c'est ce qu'on regarde en tapant le code ailleurs. */
    var gauge = element("div", "jauge");
    var fill = element("div", "jauge-remplissage");
    fill.id = "jauge-remplissage";
    fill.style.width = "100%";
    gauge.appendChild(fill);
    container.appendChild(gauge);
  }

  function updateCountdown(seconds) {
    var node = document.getElementById("rebours");
    if (node) node.textContent = t.expiresInMs + " " + formatCountdown(seconds);

    var barre = document.getElementById("jauge-remplissage");
    if (barre && initialDuration > 0) {
      var part = seconds / initialDuration;
      if (part < 0) part = 0;
      if (part > 1) part = 1;
      barre.style.width = (part * 100) + "%";
    }
  }

  /**
   * Le jeton passe par le FRAGMENT, jamais par la requête.
   *
   * C'est un JWT sans expiration : dans une chaîne de requête il finirait dans
   * les journaux d'accès du serveur et dans les en-têtes `Referer`. Un
   * fragment n'est envoyé nulle part.
   */
  function navigate(adresse, token, user) {
    var params = global.DeviceInfo.inParams();
    /* Le moteur web du téléviseur ressert volontiers un document déjà en
       cache sans le revalider, malgré le `no-cache` du serveur : une URL
       identique d'un lancement à l'autre peut figer l'appareil sur un vieux
       bundle. L'horodatage rend chaque navigation unique — seul `index.html`
       est retéléchargé, les ressources par empreinte restent en cache. */
    var url = adresse + "/tv/" + params +
      (params ? "&" : "?") + "relance=" + Date.now();
    if (token) {
      url += "#jeton=" + encodeURIComponent(token) +
        "&u=" + encodeURIComponent(user ? user.id : "") +
        "&n=" + encodeURIComponent(user ? user.name : "");
    }
    global.location.href = url;
  }

  global.PairingView = {
    prepare: chooseLanguage,
    showLoading: showPatience,
    showWaiting: showPatience,
    showCode: showCode,
    updateCountdown: updateCountdown,
    showExpired: function (action) {
      message(t.expiredTitle, t.expiredText, t.newCode, action);
    },
    showError: function (action) {
      message(t.errorTitle, t.errorText, t.retryIt, action);
    },
    navigate: navigate,
  };
})(window);
