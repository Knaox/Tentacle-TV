/**
 * Le code injecté dans la page du téléviseur.
 *
 * Il n'est jamais compilé : il part en chaîne dans `Runtime.evaluate` et dans
 * `Page.addScriptToEvaluateOnNewDocument`. D'où l'écriture volontairement
 * pauvre — aucune syntaxe que Chrome 94 ne connaisse, aucun import.
 *
 * **Les relevés sortent par la console**, que Node capte en
 * `Runtime.consoleAPICalled`. C'est ce qui évite un aller-retour toutes les
 * 250 ms : l'ordre est garanti, et l'horodatage est posé par la page, donc
 * comparable aux événements média qu'elle vient d'émettre.
 */

/** Ce qu'un lecteur émet, du chargement à la panne. Aucun filtre : c'est la
 *  liste elle-même qui répond à « le téléviseur émet-il seulement `waiting` ? ». */
const EVENEMENTS = [
  "loadstart", "loadedmetadata", "loadeddata", "canplay", "canplaythrough",
  "play", "playing", "pause", "seeking", "seeked", "waiting", "stalled",
  "suspend", "emptied", "abort", "ratechange", "error",
];

const PERIODE_ETAT_MS = 250;
const PERIODE_SORTIE_MS = 2000;

export function codeSonde() {
  return `(${sonde.toString()})(${JSON.stringify(EVENEMENTS)}, ${PERIODE_ETAT_MS}, ${PERIODE_SORTIE_MS});`;
}

/* eslint-disable */
function sonde(evenements, periodeEtat, periodeSortie) {
  if (window.__ttvReleve) return "deja-en-place";
  window.__ttvReleve = true;

  var BALISE = "[TTV-RELEVE] ";
  function emettre(rec) {
    rec.tp = Date.now();
    try { console.info(BALISE + JSON.stringify(rec)); } catch (e) { /* rien à faire */ }
  }

  function video() { return document.querySelector("video"); }

  function bornes(v) {
    var b = v.buffered, i;
    for (i = 0; i < b.length; i++) {
      if (v.currentTime >= b.start(i) - 0.5 && v.currentTime <= b.end(i) + 0.5) {
        return [b.start(i), b.end(i)];
      }
    }
    return b.length ? [b.start(0), b.end(b.length - 1)] : [null, null];
  }

  function etat(v) {
    var bo = bornes(v);
    var e = {
      position: v.currentTime, bufferDebut: bo[0], bufferFin: bo[1],
      pret: v.readyState, reseau: v.networkState, enPause: v.paused,
      erreur: v.error ? v.error.code : null,
    };
    // Ces compteurs restent à zéro quand le décodage est matériel et hors
    // compositing : on les émet quand même, un zéro est une information.
    if (typeof v.getVideoPlaybackQuality === "function") {
      var q = v.getVideoPlaybackQuality();
      e.imagesTotales = q.totalVideoFrames;
      e.imagesPerdues = q.droppedVideoFrames;
    }
    return e;
  }

  // ── Capacités : c'est ce champ-là qui tranche le défaut des préférences ──
  var essai = document.createElement("video");
  emettre({
    evt: "capacites",
    audioTracksSurElement: "audioTracks" in essai,
    hlsNatif: essai.canPlayType("application/vnd.apple.mpegurl"),
    qualiteDispo: typeof essai.getVideoPlaybackQuality === "function",
    pontLuna: typeof window.PalmServiceBridge === "function",
    agent: navigator.userAgent,
    url: location.href,
  });

  // ── Événements média, en CAPTURE sur le document : ils ne remontent pas,
  //    mais ils descendent — et la balise appartient au lecteur, pas à nous ──
  evenements.forEach(function (nom) {
    document.addEventListener(nom, function (ev) {
      if (!(ev.target instanceof HTMLVideoElement)) return;
      var rec = etat(ev.target);
      rec.evt = "media";
      rec.nom = nom;
      emettre(rec);
    }, true);
  });

  // ── État échantillonné : la dérivée de la position sur quatre secondes est
  //    le discriminant des saccades, et 250 ms suffisent à la voir ──
  setInterval(function () {
    var v = video();
    if (!v) return;
    var rec = etat(v);
    rec.evt = "etat";
    emettre(rec);
  }, periodeEtat);

  // ── Ce qui sort réellement vers la dalle. On n'y cherche pas `frameRate`,
  //    qui est la cadence NOMINALE et ne détecte aucun gel, mais les rectangles :
  //    vides, l'image ne passe pas par le plan vidéo matériel ──
  if (typeof window.PalmServiceBridge === "function") {
    setInterval(function () {
      try {
        var pont = new window.PalmServiceBridge();
        pont.onservicecallback = function (reponse) {
          try {
            var charge = JSON.parse(reponse);
            var info = (charge && charge.video && charge.video[0]) || {};
            emettre({
              evt: "sortie",
              hdrType: info.hdrType, frameRate: info.frameRate,
              sourceRect: info.sourceRect, videoRect: info.videoRect,
              adaptive: info.adaptive, connecte: charge && charge.connectedSource,
            });
          } catch (e) { /* réponse illisible : on saute ce relevé */ }
        };
        pont.call("luna://com.webos.service.videooutput/getStatus", "{}");
      } catch (e) { /* le pont refuse : rien à faire */ }
    }, periodeSortie);
  }

  return "en-place";
}
/* eslint-enable */
