/* Rendu de la sonde et releve des touches de la telecommande.
 *
 * ES5 strict, aucune dependance. Cette page est servie par le serveur Tentacle
 * sur /tv/sonde.html : elle repond en une installation a ce que le portage
 * devrait sinon decouvrir ecran par ecran. Elle reste dans le paquet apres le
 * portage — c'est le premier endroit ou regarder quand un modele se comporte
 * autrement que les autres. */

(function (global) {
  "use strict";

  /* Les codes propres aux telecommandes LG. Les autres touches sont affichees
   * telles quelles : le releve sert justement a completer cette table. */
  var KEY_NAMES = {
    13: "OK",
    37: "gauche", 38: "haut", 39: "droite", 40: "bas",
    403: "rouge", 404: "vert", 405: "jaune", 406: "bleu",
    412: "retour rapide", 413: "stop", 415: "lecture",
    417: "avance rapide", 19: "pause", 461: "retour",
    457: "info"
  };

  function cell(text, cssClass) {
    var td = document.createElement("td");
    td.className = cssClass;
    td.appendChild(document.createTextNode(text));
    return td;
  }

  function classForState(state) {
    if (state === "ok") return "val ok";
    if (state === "ko") return "val ko";
    return "val neutre";
  }

  function renderSection(section) {
    var title = document.createElement("h2");
    title.appendChild(document.createTextNode(section.title));

    var table = document.createElement("table");
    for (var i = 0; i < section.lines.length; i++) {
      var line = section.lines[i];
      var tr = document.createElement("tr");
      tr.appendChild(cell(line.key, "cle"));
      tr.appendChild(cell(line.probe.value, classForState(line.probe.state)));
      table.appendChild(tr);
    }

    var fragment = document.createDocumentFragment();
    fragment.appendChild(title);
    fragment.appendChild(table);
    return fragment;
  }

  /* Les capacites materielles arrivent par deux chemins : l'API officielle si
   * webOSTV.js est charge, sinon le parametre `tvinfo` pose par la coquille.
   * La sonde affiche ce qu'elle a obtenu, et par quel chemin — c'est ce qui
   * permet de savoir si le client pourra construire un DeviceProfile juste. */
  function readDeviceInfo(onResult) {
    var param = /[?&]tvinfo=([^&]+)/.exec(global.location.search);
    if (param) {
      try {
        onResult("parametre d'URL", JSON.parse(decodeURIComponent(param[1])));
        return;
      } catch (e) {
        /* Parametre illisible : on tente l'API. */
      }
    }
    if (global.webOS && typeof global.webOS.deviceInfo === "function") {
      global.webOS.deviceInfo(function (data) {
        onResult("webOS.deviceInfo()", data);
      });
      return;
    }
    if (global.PalmSystem && global.PalmSystem.deviceInfo) {
      try {
        onResult("PalmSystem.deviceInfo", JSON.parse(global.PalmSystem.deviceInfo));
        return;
      } catch (e) {
        /* Illisible. */
      }
    }
    onResult(null, null);
  }

  function renderDeviceInfo(report) {
    readDeviceInfo(function (origin, data) {
      var lines = [];
      if (!data) {
        lines.push({
          key: "deviceInfo",
          probe: { state: "ko", value: "indisponible — ni API, ni parametre d'URL" }
        });
      } else {
        lines.push({ key: "origine", probe: { state: "ok", value: origin } });
        for (var key in data) {
          if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
          lines.push({
            key: key,
            probe: { state: "info", value: String(data[key]) }
          });
        }
      }
      report.appendChild(renderSection({ title: "Televiseur", lines: lines }));
    });
  }

  function installKeyCapture() {
    var zone = document.getElementById("touche");
    document.addEventListener("keydown", function (event) {
      var code = event.keyCode;
      var name = KEY_NAMES[code] || "inconnue";
      /* `code` et `repeat` autant que `keyCode` : le lecteur du client web lit
       * `e.code`, et si la telecommande le renseigne, chaque fleche declenche
       * AUSSI son saut dans le flux. La cadence de repetition, elle, cale la
       * detection du maintien. */
      zone.textContent =
        "keyCode " + code + "  —  " + name +
        "\ncode " + (event.code || "(vide)") +
        "   repeat " + (event.repeat ? "oui" : "non");
      /* Retour : on laisse le comportement par defaut, la sonde n'est pas une
       * application a part entiere et doit rester quittable. */
    });
  }

  /* Le clavier systeme : ce que la saisie recoit, d'ou qu'elle vienne — frappe
   * a la telecommande ou dictee au micro. Un texte qui apparait sans qu'aucun
   * `keydown` ne passe est la signature de la dictee. */
  function installInputCapture() {
    var field = document.getElementById("saisie");
    var zone = document.getElementById("dictee");
    if (!field || !zone) return;
    var keystrokes = 0;
    field.addEventListener("keydown", function () { keystrokes++; });
    field.addEventListener("input", function () {
      zone.textContent =
        "recu : « " + field.value + " »   —   " + keystrokes + " frappe(s) observee(s)";
    });
    field.addEventListener("focus", function () {
      keystrokes = 0;
      zone.textContent = "champ focalise — le clavier systeme doit s'ouvrir";
    });
  }

  /**
   * Les trois mesures qui ne peuvent se faire que sur la dalle.
   *
   * Rendues dans une section qui se réécrit : le maintien de OK et la réponse
   * du relais arrivent après le premier tracé, et le lecteur doit les voir
   * apparaître sans recharger.
   */
  function renderPanelMeasures(report) {
    var section = document.createElement("div");
    report.appendChild(section);

    var lines = global.PanelProbe.canvas();
    var redraw = function () {
      section.innerHTML = "";
      section.appendChild(renderSection({ title: "Mesures sur la dalle", lines: lines }));
    };
    redraw();

    var add = function (fresh) {
      for (var i = 0; i < fresh.length; i++) {
        var replaced = false;
        for (var j = 0; j < lines.length; j++) {
          if (lines[j].key === fresh[i].key) {
            lines[j] = fresh[i];
            replaced = true;
          }
        }
        if (!replaced) lines.push(fresh[i]);
      }
      redraw();
    };

    add([{ key: "maintien de OK", probe: { state: "info", value: "maintenez OK trois secondes" } }]);
    global.PanelProbe.installHoldCapture(add);
    global.PanelProbe.probeRelay(add);
    global.PanelProbe.measureObserverBox(add);
    global.PanelProbe.probeVoiceServices(add);
  }

  function start() {
    var report = document.getElementById("rapport");
    var sections = global.WebosProbes.sections();
    for (var i = 0; i < sections.length; i++) {
      report.appendChild(renderSection(sections[i]));
    }
    renderPanelMeasures(report);
    renderDeviceInfo(report);
    installKeyCapture();
    installInputCapture();

    var date = new Date();
    document.getElementById("horodatage").textContent =
      "releve du " + date.toISOString() + "  —  " + global.location.href;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})(window);
