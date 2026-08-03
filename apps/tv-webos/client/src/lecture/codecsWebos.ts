import type { CapacitesTeleviseur } from "../amorce/webosGlobals";

/**
 * Ce que la puce de la dalle sait décoder.
 *
 * Sondé à l'exécution par `canPlayType`, et par lui seul : `<video src>` est le
 * seul chemin de lecture du client téléviseur, donc c'est le décodeur natif
 * qu'il faut interroger. `MediaSource.isTypeSupported` décrirait un pipeline
 * qui n'est jamais emprunté ici — et il sous-déclare largement sur webOS, où
 * MSE ignore des formats que la puce ouvre sans difficulté.
 */

const sonde = typeof document !== "undefined" ? document.createElement("video") : null;

function lit(type: string): boolean {
  if (!sonde) return false;
  // `canPlayType` rend "", "maybe" ou "probably". Sur webOS, un décodeur
  // matériel présent répond souvent "maybe" faute de pouvoir garantir un
  // profil précis — exiger "probably" écarterait justement les formats qui
  // font l'intérêt d'un téléviseur.
  return sonde.canPlayType(type) !== "";
}

/** Conteneurs que le démultiplexeur de webOS ouvre. */
export const CONTENEURS_TV = ["mp4,m4v,mov", "mkv", "ts,m2ts,mts", "avi", "webm"];

export interface CodecsSondes {
  video: string[];
  audio: string[];
  hevc10bits: boolean;
  dts: boolean;
}

export function sonderCodecs(): CodecsSondes {
  const video: string[] = [];
  if (lit('video/mp4; codecs="avc1.640029"')) video.push("h264");
  if (lit('video/mp4; codecs="hvc1.1.6.L120.B0"') || lit('video/mp4; codecs="hev1.1.6.L120.B0"')) {
    video.push("hevc");
  }
  if (lit('video/webm; codecs="vp9"') || lit('video/mp4; codecs="vp09.00.51.08"')) video.push("vp9");
  if (lit('video/mp4; codecs="av01.0.15M.10"')) video.push("av1");
  if (lit("video/mpeg")) video.push("mpeg2video");

  const audio: string[] = [];
  if (lit('audio/mp4; codecs="mp4a.40.2"')) audio.push("aac");
  if (lit('audio/mp4; codecs="mp4a.69"') || lit("audio/mpeg")) audio.push("mp3");
  if (lit('audio/mp4; codecs="ac-3"')) audio.push("ac3");
  if (lit('audio/mp4; codecs="ec-3"')) audio.push("eac3");
  if (lit('audio/mp4; codecs="flac"')) audio.push("flac");
  if (lit('audio/mp4; codecs="opus"')) audio.push("opus");

  // Le DTS se sonde et ne se suppose pas : son support varie d'un modèle à
  // l'autre au sein d'une même version de webOS, selon les licences que LG a
  // payées pour un marché donné. Le déduire de la version rendrait muettes les
  // pistes DTS sur les modèles qui les décodent — ou ferait transcoder sur
  // ceux qui ne les décodent pas.
  const dts = lit('audio/mp4; codecs="dtsc"') || lit('audio/mp4; codecs="dtse"');
  if (dts) audio.push("dts");

  // TrueHD : rarement déclaré, souvent décodé. On ne le pousse que s'il est
  // annoncé, faute de quoi une piste silencieuse serait pire qu'un transcodage.
  if (lit('audio/mp4; codecs="mlpa"')) audio.push("truehd");

  const hevc10bits =
    lit('video/mp4; codecs="hvc1.2.4.L120.B0"') || lit('video/mp4; codecs="hev1.2.4.L120.B0"');

  return { video, audio, hevc10bits, dts };
}

/**
 * Plages dynamiques déclarées à Jellyfin.
 *
 * Croisement délibéré de deux sources. Le décodage 10 bits est une affaire de
 * puce, que `canPlayType` sait dire ; le HDR est une affaire de dalle, qu'il
 * ignore complètement. Une puce peut parfaitement décoder du HDR10 derrière un
 * écran qui ne l'affiche pas — déclarer le HDR dans ce cas ferait envoyer un
 * flux dont les couleurs seraient délavées, faute de conversion.
 *
 * `SDR` et `Unknown` sont toujours déclarés : ce sont les valeurs que Jellyfin
 * attribue aux fichiers dont il ne sait rien.
 */
export function plagesDynamiquesTv(
  dalle: CapacitesTeleviseur,
  codecs: CodecsSondes,
): string[] {
  const plages = ["Unknown", "SDR"];
  if (!codecs.hevc10bits) return plages;

  if (dalle.hdr10) plages.push("HDR10", "HDR10Plus", "HLG");
  if (dalle.dolbyVision) {
    plages.push("DOVI", "DOVIWithHDR10", "DOVIWithHLG", "DOVIWithSDR");
    if (dalle.hdr10) plages.push("DOVIWithHDR10Plus");
  }

  // Aucune capacité remontée : `deviceInfo` n'a pas répondu — au développement
  // dans un navigateur, ou si l'injection n'a pas eu lieu. On s'en tient alors
  // à ce que la puce déclare, plutôt que de tout refuser et de faire
  // transcoder chaque fichier HDR.
  if (dalle.hdr10 === undefined && dalle.dolbyVision === undefined) {
    plages.push("HDR10", "HLG");
  }

  return plages;
}
