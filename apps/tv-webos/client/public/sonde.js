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
  var NOMS_TOUCHES = {
    13: "OK",
    37: "gauche", 38: "haut", 39: "droite", 40: "bas",
    403: "rouge", 404: "vert", 405: "jaune", 406: "bleu",
    412: "retour rapide", 413: "stop", 415: "lecture",
    417: "avance rapide", 19: "pause", 461: "retour",
    457: "info"
  };

  function cellule(texte, classe) {
    var td = document.createElement("td");
    td.className = classe;
    td.appendChild(document.createTextNode(texte));
    return td;
  }

  function classePourEtat(etat) {
    if (etat === "ok") return "val ok";
    if (etat === "ko") return "val ko";
    return "val neutre";
  }

  function rendreSection(section) {
    var titre = document.createElement("h2");
    titre.appendChild(document.createTextNode(section.titre));

    var table = document.createElement("table");
    for (var i = 0; i < section.lignes.length; i++) {
      var ligne = section.lignes[i];
      var tr = document.createElement("tr");
      tr.appendChild(cellule(ligne.cle, "cle"));
      tr.appendChild(cellule(ligne.sonde.valeur, classePourEtat(ligne.sonde.etat)));
      table.appendChild(tr);
    }

    var bloc = document.createDocumentFragment();
    bloc.appendChild(titre);
    bloc.appendChild(table);
    return bloc;
  }

  /* Les capacites materielles arrivent par deux chemins : l'API officielle si
   * webOSTV.js est charge, sinon le parametre `tvinfo` pose par la coquille.
   * La sonde affiche ce qu'elle a obtenu, et par quel chemin — c'est ce qui
   * permet de savoir si le client pourra construire un DeviceProfile juste. */
  function lireInfoAppareil(auResultat) {
    var parametre = /[?&]tvinfo=([^&]+)/.exec(global.location.search);
    if (parametre) {
      try {
        auResultat("parametre d'URL", JSON.parse(decodeURIComponent(parametre[1])));
        return;
      } catch (e) {
        /* Parametre illisible : on tente l'API. */
      }
    }
    if (global.webOS && typeof global.webOS.deviceInfo === "function") {
      global.webOS.deviceInfo(function (donnees) {
        auResultat("webOS.deviceInfo()", donnees);
      });
      return;
    }
    if (global.PalmSystem && global.PalmSystem.deviceInfo) {
      try {
        auResultat("PalmSystem.deviceInfo", JSON.parse(global.PalmSystem.deviceInfo));
        return;
      } catch (e) {
        /* Illisible. */
      }
    }
    auResultat(null, null);
  }

  function rendreInfoAppareil(rapport) {
    lireInfoAppareil(function (origine, donnees) {
      var lignes = [];
      if (!donnees) {
        lignes.push({
          cle: "deviceInfo",
          sonde: { etat: "ko", valeur: "indisponible — ni API, ni parametre d'URL" }
        });
      } else {
        lignes.push({ cle: "origine", sonde: { etat: "ok", valeur: origine } });
        for (var cle in donnees) {
          if (!Object.prototype.hasOwnProperty.call(donnees, cle)) continue;
          lignes.push({
            cle: cle,
            sonde: { etat: "info", valeur: String(donnees[cle]) }
          });
        }
      }
      rapport.appendChild(rendreSection({ titre: "Televiseur", lignes: lignes }));
    });
  }

  function installerReleveTouches() {
    var zone = document.getElementById("touche");
    document.addEventListener("keydown", function (evenement) {
      var code = evenement.keyCode;
      var nom = NOMS_TOUCHES[code] || "inconnue";
      /* `code` et `repeat` autant que `keyCode` : le lecteur du client web lit
       * `e.code`, et si la telecommande le renseigne, chaque fleche declenche
       * AUSSI son saut dans le flux. La cadence de repetition, elle, cale la
       * detection du maintien. */
      zone.textContent =
        "keyCode " + code + "  —  " + nom +
        "\ncode " + (evenement.code || "(vide)") +
        "   repeat " + (evenement.repeat ? "oui" : "non");
      /* Retour : on laisse le comportement par defaut, la sonde n'est pas une
       * application a part entiere et doit rester quittable. */
    });
  }

  /* Le clavier systeme : ce que la saisie recoit, d'ou qu'elle vienne — frappe
   * a la telecommande ou dictee au micro. Un texte qui apparait sans qu'aucun
   * `keydown` ne passe est la signature de la dictee. */
  function installerReleveSaisie() {
    var champ = document.getElementById("saisie");
    var zone = document.getElementById("dictee");
    if (!champ || !zone) return;
    var frappes = 0;
    champ.addEventListener("keydown", function () { frappes++; });
    champ.addEventListener("input", function () {
      zone.textContent =
        "recu : « " + champ.value + " »   —   " + frappes + " frappe(s) observee(s)";
    });
    champ.addEventListener("focus", function () {
      frappes = 0;
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
  function rendreMesuresDalle(rapport) {
    var section = document.createElement("div");
    rapport.appendChild(section);

    var lignes = global.SondeDalle.canevas();
    var redessiner = function () {
      section.innerHTML = "";
      section.appendChild(rendreSection({ titre: "Mesures sur la dalle", lignes: lignes }));
    };
    redessiner();

    var ajouter = function (nouvelles) {
      for (var i = 0; i < nouvelles.length; i++) {
        var remplace = false;
        for (var j = 0; j < lignes.length; j++) {
          if (lignes[j].cle === nouvelles[i].cle) {
            lignes[j] = nouvelles[i];
            remplace = true;
          }
        }
        if (!remplace) lignes.push(nouvelles[i]);
      }
      redessiner();
    };

    ajouter([{ cle: "maintien de OK", sonde: { etat: "info", valeur: "maintenez OK trois secondes" } }]);
    global.SondeDalle.installerReleveMaintien(ajouter);
    global.SondeDalle.sonderRelais(ajouter);
    global.SondeDalle.mesurerBoiteObservateur(ajouter);
    global.SondeDalle.sonderServicesVocaux(ajouter);
  }

  function demarrer() {
    var rapport = document.getElementById("rapport");
    var sections = global.SondesWebos.sections();
    for (var i = 0; i < sections.length; i++) {
      rapport.appendChild(rendreSection(sections[i]));
    }
    rendreMesuresDalle(rapport);
    rendreInfoAppareil(rapport);
    installerReleveTouches();
    installerReleveSaisie();

    var date = new Date();
    document.getElementById("horodatage").textContent =
      "releve du " + date.toISOString() + "  —  " + global.location.href;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", demarrer);
  } else {
    demarrer();
  }
})(window);
