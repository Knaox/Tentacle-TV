/**
 * Ce que le serveur a RÉELLEMENT décidé de faire du flux.
 *
 * `SupportsDirectPlay` et `SupportsDirectStream` décrivent ce que le fichier
 * PERMET, pas ce que Jellyfin a choisi : un booléen à vrai coexiste très bien
 * avec une `TranscodingUrl`. L'ancien verdict, tiré de ces deux seuls champs,
 * ne distinguait donc jamais un remux — vidéo copiée, audio converti, résultat
 * parfaitement acceptable — d'un ré-encodage complet de l'image, qui est
 * précisément ce qu'on cherche à supprimer. Sans cette distinction, le critère
 * d'acceptation du chantier n'est pas mesurable.
 */

/** Raisons Jellyfin qui imposent de RECOMPRESSER l'image. */
const RAISONS_REENCODAGE_VIDEO =
  /^(video|refframes|anamorphic|interlaced|unknownvideostream|containerbitrateexceeds)/i;

export type ModeLecture = "DirectPlay" | "DirectStream" | "Remux" | "Transcode";

export interface EntreeVerdict {
  supportsDirectPlay: boolean;
  supportsDirectStream: boolean;
  transcodingUrl?: string;
  transcodeReasons?: string[] | string;
  /** Codec de la piste vidéo source, pour comparer avec le codec de sortie. */
  codecVideoSource?: string;
  /** La source est HDR / Dolby Vision (cf. `sourceEstHdr`). */
  sourceHdr?: boolean;
  /** Le profil a déclaré savoir afficher le HDR. */
  clientAccepteHdr?: boolean;
}

/**
 * La source porte-t-elle une plage dynamique étendue ?
 *
 * ⚠️ `VideoRangeType` arrive tantôt en chaîne, tantôt en index d'énumération
 * selon le point d'entrée Jellyfin — d'où la double lecture. `0` et `1` valent
 * `Unknown` et `SDR` dans toutes les versions ; au-delà, c'est du HDR.
 */
export function sourceEstHdr(
  stream: { VideoRangeType?: string | number; DvProfile?: number; Hdr10PlusPresentFlag?: boolean } | undefined,
): boolean {
  if (!stream) return false;
  if (stream.DvProfile != null || stream.Hdr10PlusPresentFlag) return true;
  const plage = stream.VideoRangeType;
  if (typeof plage === "number") return plage > 1;
  if (typeof plage === "string") return !/^(sdr|unknown)$/i.test(plage.trim());
  return false;
}

export interface Verdict {
  mode: ModeLecture;
  raisons: string[];
  /** L'image est-elle recompressée ? Le seul critère qui compte ici. */
  reencodageVideo: boolean;
}

/** Jellyfin 10.9+ rend un tableau ; les versions antérieures, une chaîne. */
export function normaliserRaisons(brut?: string[] | string | false): string[] {
  if (!brut) return [];
  const liste = Array.isArray(brut) ? brut : brut.split(",");
  return liste.map((r) => r.trim()).filter(Boolean);
}

function lireParam(url: string, nom: string): string | undefined {
  const m = new RegExp(`[?&]${nom}=([^&]*)`, "i").exec(url);
  return m ? decodeURIComponent(m[1]) : undefined;
}

/**
 * Jellyfin ne renseigne pas toujours `TranscodeReasons` sur le `MediaSource`
 * — mesuré vide sur 10.10 — mais il le recopie systématiquement dans la query
 * de la `TranscodingUrl`. Sans ce repli, le verdict perdait sa meilleure
 * source d'information au moment même où elle comptait.
 */
function raisonsDe(e: EntreeVerdict): string[] {
  const declarees = normaliserRaisons(e.transcodeReasons);
  if (declarees.length > 0) return declarees;
  return normaliserRaisons(e.transcodingUrl && lireParam(e.transcodingUrl, "TranscodeReasons"));
}

function imageRecompressee(
  codecSortie: string | undefined, codecSource: string | undefined, raisons: string[],
): boolean {
  // Jellyfin l'annonce parfois lui-même.
  if (codecSortie?.toLowerCase() === "copy") return false;
  // Sinon les raisons font foi : elles disent ce qui a écarté la lecture
  // directe. Aucune raison vidéo (« AudioCodecNotSupported » seul, par
  // exemple) → ffmpeg copie le flux vidéo et ne touche qu'à l'audio.
  // ⚠️ `ContainerNotSupported` n'est PAS une raison vidéo : c'est un remux.
  if (raisons.length > 0) return raisons.some((r) => RAISONS_REENCODAGE_VIDEO.test(r));
  // Serveur muet sur les raisons : on compare le codec demandé à la source.
  if (codecSortie && codecSource) {
    const sorties = codecSortie.toLowerCase().split(",").map((c) => c.trim());
    return !sorties.includes(codecSource.toLowerCase());
  }
  // Faute d'information, on suppose le pire — un instrument de mesure ne doit
  // jamais flatter le résultat.
  return true;
}

export function evaluerLecture(e: EntreeVerdict): Verdict {
  const raisons = raisonsDe(e);

  if (e.supportsDirectPlay && !e.transcodingUrl) {
    return { mode: "DirectPlay", raisons, reencodageVideo: false };
  }
  if (!e.transcodingUrl) {
    // Pas d'URL de transcodage : le serveur sert le fichier tel quel, remuxé.
    return {
      mode: e.supportsDirectStream ? "DirectStream" : "Transcode",
      raisons,
      reencodageVideo: !e.supportsDirectStream,
    };
  }

  // Le tone mapping HDR→SDR n'apparaît dans AUCUN `TranscodeReasons` : Jellyfin
  // le décide APRÈS avoir choisi de transcoder, dès que la plage dynamique de
  // la source n'est pas déclarée par le client. C'est pourtant un ré-encodage
  // complet — vécu sur un Dolby Vision 8.1 dont seul l'audio était en cause, et
  // que le verdict a d'abord annoncé « Remux » à tort.
  const toneMapping = !!e.sourceHdr && e.clientAccepteHdr === false;
  const reencodageVideo = toneMapping || imageRecompressee(
    lireParam(e.transcodingUrl, "VideoCodec"), e.codecVideoSource, raisons,
  );
  return {
    mode: reencodageVideo ? "Transcode" : "Remux",
    raisons: toneMapping ? [...raisons, "ToneMappingHdrVersSdr"] : raisons,
    reencodageVideo,
  };
}
