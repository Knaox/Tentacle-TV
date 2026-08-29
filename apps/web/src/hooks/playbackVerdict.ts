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
const VIDEO_REENCODE_REASONS =
  /^(video|refframes|anamorphic|interlaced|unknownvideostream|containerbitrateexceeds)/i;

export type PlaybackMode = "DirectPlay" | "DirectStream" | "Remux" | "Transcode";

export interface VerdictInput {
  supportsDirectPlay: boolean;
  supportsDirectStream: boolean;
  transcodingUrl?: string;
  transcodeReasons?: string[] | string;
  /** Codec de la piste vidéo source, pour comparer avec le codec de sortie. */
  sourceVideoCodec?: string;
  /** La source est HDR / Dolby Vision (cf. `isHdrSource`). */
  sourceHdr?: boolean;
  /** Le profil a déclaré savoir afficher le HDR. */
  clientAcceptsHdr?: boolean;
}

/**
 * La source porte-t-elle une plage dynamique étendue ?
 *
 * ⚠️ `VideoRangeType` arrive tantôt en chaîne, tantôt en index d'énumération
 * selon le point d'entrée Jellyfin — d'où la double lecture. `0` et `1` valent
 * `Unknown` et `SDR` dans toutes les versions ; au-delà, c'est du HDR.
 */
export function isHdrSource(
  stream: { VideoRangeType?: string | number; DvProfile?: number; Hdr10PlusPresentFlag?: boolean } | undefined,
): boolean {
  if (!stream) return false;
  if (stream.DvProfile != null || stream.Hdr10PlusPresentFlag) return true;
  const range = stream.VideoRangeType;
  if (typeof range === "number") return range > 1;
  if (typeof range === "string") return !/^(sdr|unknown)$/i.test(range.trim());
  return false;
}

/**
 * La source est-elle en Dolby Vision ?
 *
 * Même double lecture que `isHdrSource`, et pour la même raison. `DvProfile`
 * est le signal le plus sûr : il reste renseigné là où la plage arrive en
 * entier, donc là où l'on ne peut rien conclure de son nom.
 *
 * Sert au profil d'appareil du téléviseur : le conteneur d'un remux ne porte
 * pas le RPU de la même façon selon qu'il est en ISOBMFF ou en flux de
 * transport, et cet arbitrage-là ne se pose que pour une source Dolby Vision.
 */
export function isDolbyVisionSource(
  stream: { VideoRangeType?: string | number; DvProfile?: number } | undefined,
): boolean {
  if (!stream) return false;
  if (stream.DvProfile != null) return true;
  const range = stream.VideoRangeType;
  if (typeof range !== "string") return false;
  const name = range.toUpperCase();
  return name.includes("DOVI") || name.includes("DOLBY");
}

export interface Verdict {
  mode: PlaybackMode;
  reasons: string[];
  /** L'image est-elle recompressée ? Le seul critère qui compte ici. */
  videoReencoded: boolean;
}

/** Jellyfin 10.9+ rend un tableau ; les versions antérieures, une chaîne. */
export function normalizeReasons(raw?: string[] | string | false): string[] {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : raw.split(",");
  return list.map((r) => r.trim()).filter(Boolean);
}

function readParam(url: string, name: string): string | undefined {
  const m = new RegExp(`[?&]${name}=([^&]*)`, "i").exec(url);
  return m ? decodeURIComponent(m[1]) : undefined;
}

/**
 * Jellyfin ne renseigne pas toujours `TranscodeReasons` sur le `MediaSource`
 * — mesuré vide sur 10.10 — mais il le recopie systématiquement dans la query
 * de la `TranscodingUrl`. Sans ce repli, le verdict perdait sa meilleure
 * source d'information au moment même où elle comptait.
 */
function reasonsOf(e: VerdictInput): string[] {
  const declared = normalizeReasons(e.transcodeReasons);
  if (declared.length > 0) return declared;
  return normalizeReasons(e.transcodingUrl && readParam(e.transcodingUrl, "TranscodeReasons"));
}

function imageRecompressed(
  outputCodec: string | undefined, sourceCodec: string | undefined, reasons: string[],
  url?: string,
): boolean {
  // Jellyfin l'annonce parfois lui-même.
  if (outputCodec?.toLowerCase() === "copy") return false;
  // `AllowVideoStreamCopy=false` est le serveur qui le dit lui-même.
  //
  // Le manifeste maître d'un remux Dolby Vision propose la variante copiée puis
  // deux replis, et c'est sur CES REPLIS que Jellyfin pose le drapeau : il
  // désigne noir sur blanc ceux qui imposent un ré-encodage. Il n'apparaît que
  // sur une playlist de variante — le client TV en sert une depuis qu'il
  // choisit lui-même (`varianteDovi.ts`), là où un navigateur reçoit le maître.
  //
  // Son ABSENCE ne prouve rien en revanche, et il ne faut pas la lire comme une
  // promesse de copie : Jellyfin ré-encodera quand même si le codec source ne
  // figure pas dans la liste de sortie. C'est pourquoi on ne conclut ici que
  // dans un sens, et que le cas Dolby Vision — où l'on SAIT, pour l'avoir
  // mesuré, que l'image est copiée — est tranché par `lecture/playbackInfoTv.ts`,
  // seul endroit qui sache quelle variante il a désignée.
  if (url && readParam(url, "AllowVideoStreamCopy")?.toLowerCase() === "false") return true;
  // Sinon les raisons font foi : elles disent ce qui a écarté la lecture
  // directe. Aucune raison vidéo (« AudioCodecNotSupported » seul, par
  // exemple) → ffmpeg copie le flux vidéo et ne touche qu'à l'audio.
  // ⚠️ `ContainerNotSupported` n'est PAS une raison vidéo : c'est un remux.
  if (reasons.length > 0) return reasons.some((r) => VIDEO_REENCODE_REASONS.test(r));
  // Serveur muet sur les raisons : on compare le codec demandé à la source.
  if (outputCodec && sourceCodec) {
    const outputs = outputCodec.toLowerCase().split(",").map((c) => c.trim());
    return !outputs.includes(sourceCodec.toLowerCase());
  }
  // Faute d'information, on suppose le pire — un instrument de mesure ne doit
  // jamais flatter le résultat.
  return true;
}

export function evaluatePlayback(e: VerdictInput): Verdict {
  const reasons = reasonsOf(e);

  if (e.supportsDirectPlay && !e.transcodingUrl) {
    return { mode: "DirectPlay", reasons, videoReencoded: false };
  }
  if (!e.transcodingUrl) {
    // Pas d'URL de transcodage : le serveur sert le fichier tel quel, remuxé.
    return {
      mode: e.supportsDirectStream ? "DirectStream" : "Transcode",
      reasons,
      videoReencoded: !e.supportsDirectStream,
    };
  }

  // Le tone mapping HDR→SDR n'apparaît dans AUCUN `TranscodeReasons` : Jellyfin
  // le décide APRÈS avoir choisi de transcoder, dès que la plage dynamique de
  // la source n'est pas déclarée par le client. C'est pourtant un ré-encodage
  // complet — vécu sur un Dolby Vision 8.1 dont seul l'audio était en cause, et
  // que le verdict a d'abord annoncé « Remux » à tort.
  const toneMapping = !!e.sourceHdr && e.clientAcceptsHdr === false;
  const videoReencoded = toneMapping || imageRecompressed(
    readParam(e.transcodingUrl, "VideoCodec"), e.sourceVideoCodec, reasons, e.transcodingUrl,
  );
  return {
    mode: videoReencoded ? "Transcode" : "Remux",
    reasons: toneMapping ? [...reasons, "ToneMappingHdrVersSdr"] : reasons,
    videoReencoded,
  };
}
