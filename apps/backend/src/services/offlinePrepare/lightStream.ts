/**
 * Le transcodage du mode Allégé, tel que Jellyfin le reçoit : les paliers et
 * la requête `Videos/{id}/stream.mp4`. Partagé par le flux direct
 * (`routes/downloads.ts`, `/light`) et la préparation tenue par le serveur
 * (`offlinePrepare/`, `/prepared`) — un seul endroit pour la recette.
 */

export const ITEM_ID_RE = /^[0-9a-fA-F-]{32,36}$/;

export interface TranscodePreset {
  /** Listes acceptées par Jellyfin : le premier codec est la cible d'un réencodage, toute la liste autorise la copie. */
  videoCodec: string;
  audioCodec: string;
  videoBitRate?: number;
  audioBitRate?: number;
  maxHeight?: number;
  /** Plafond de canaux — un MAXIMUM : une source stéréo n'est pas gonflée. */
  maxAudioChannels?: number;
}

/**
 * Paliers du mode Allégé — les trois premiers sont le miroir de
 * `packages/offline-core/src/core/presets.ts`.
 *
 * `pmax` = QUALITÉ D'ORIGINE EN MP4, pour les appareils qui ne lisent pas le
 * MKV (iPhone, iPad) : aucun plafond de débit — Jellyfin REFUSE la copie de
 * flux dès qu'un `videoBitRate` est demandé et que le débit de la source est
 * inconnu, ce qui est fréquent en MKV —, donc la vidéo H.264/HEVC est recopiée
 * telle quelle (10 bits et HDR compris).
 *
 * ⚠️ JAMAIS `context=Static` ici. Il demande un MP4 classique, dont l'index
 * (`moov`) s'écrit EN DERNIER — or Jellyfin sert le fichier pendant que ffmpeg
 * l'écrit encore. Dès que le client va plus vite que le transcodage, la réponse
 * s'achève sur la fin du `mdat` et l'index n'arrive jamais : fichier ni lisible
 * ni finalisable (mesuré sur deux épisodes de Rick et Morty — HEVC copié, mais
 * audio E-AC3 à réencoder, donc un transcodage assez lent pour se faire
 * doubler ; Naruto, lui, en pure copie, passait). Le fMP4 fragmenté que rend
 * Jellyfin par défaut se décrit dès son premier octet ; la finalisation native
 * du client en fait ensuite un MP4 indexé, ce qui est précisément son travail.
 *
 * L'audio, lui, passe TOUJOURS en AAC sur ce palier : voir le commentaire de
 * `pmax` ci-dessous, cette copie-là écrivait des fichiers illisibles.
 */
export const TRANSCODE_PRESETS: Record<string, TranscodePreset> = {
  p1080: { videoCodec: "h264", audioCodec: "aac", videoBitRate: 8_000_000, audioBitRate: 192_000, maxHeight: 1080 },
  p720: { videoCodec: "h264", audioCodec: "aac", videoBitRate: 4_000_000, audioBitRate: 160_000, maxHeight: 720 },
  p480: { videoCodec: "h264", audioCodec: "aac", videoBitRate: 1_500_000, audioBitRate: 128_000, maxHeight: 480 },
  // Le remux garde l'IMAGE telle quelle, mais jamais le Dolby Digital : en
  // copiant de l'ac3/eac3 vers un MP4, Jellyfin écrit un fichier sans `moov`
  // (mesuré — `ftyp`, `free`, puis un `mdat` de taille nulle). Ni lisible, ni
  // finalisable : deux épisodes entièrement reçus étaient bons à jeter. L'audio
  // repasse donc en AAC, et le plafond de canaux lui évite de redescendre en
  // stéréo au passage — puisqu'il ne peut plus être copié, qu'il perde au
  // moins le minimum.
  pmax: { videoCodec: "h264,hevc", audioCodec: "aac", maxAudioChannels: 6 },
};

/** Le palier qui recopie l'image ; il ne dépend PAS du droit de conversion. */
export const REMUX_PRESET_ID = "pmax";
/** Ce que ces droits-là donnent droit à demander. L'ordre reste celui de
 *  `TRANSCODE_PRESETS` : un client ancien lit la liste telle qu'il l'attendait. */
export function presetsFor(capabilities: { remuxDownloads: boolean; lightDownloads: boolean }): string[] {
  return Object.keys(TRANSCODE_PRESETS).filter((id) =>
    id === REMUX_PRESET_ID ? capabilities.remuxDownloads : capabilities.lightDownloads,
  );
}

/** Ce qu'un client demande : le titre, la source, le palier, les pistes. */
export interface LightRequest {
  itemId: string;
  presetId: string;
  preset: TranscodePreset;
  mediaSourceId: string | null;
  audioStreamIndex: number | null;
  burnSubtitleIndex: number | null;
}

function streamIndex(raw: string | undefined): number | null {
  const value = Number.parseInt(raw ?? "", 10);
  return Number.isInteger(value) && value >= 0 && value < 1000 ? value : null;
}

/** La demande lue dans l'URL ; `null` si le titre ou le palier ne tiennent pas. */
export function parseLightRequest(itemId: string, query: Record<string, string | undefined>): LightRequest | null {
  const presetId = query.preset ?? "p720";
  const preset = TRANSCODE_PRESETS[presetId];
  if (!ITEM_ID_RE.test(itemId) || !preset) return null;
  const mediaSourceId = query.mediaSourceId && ITEM_ID_RE.test(query.mediaSourceId) ? query.mediaSourceId : null;
  return {
    itemId,
    presetId,
    preset,
    mediaSourceId,
    audioStreamIndex: streamIndex(query.audioStreamIndex),
    burnSubtitleIndex: streamIndex(query.burnSubtitleIndex),
  };
}

/** La requête de Jellyfin (`stream.mp4`) pour cette demande et cette session de transcodage. */
export function lightStreamParams(
  request: LightRequest,
  session: { playSessionId: string; deviceId: string },
): URLSearchParams {
  const { preset } = request;
  const params = new URLSearchParams({
    static: "false",
    container: "mp4",
    videoCodec: preset.videoCodec,
    audioCodec: preset.audioCodec,
    deviceId: session.deviceId,
    playSessionId: session.playSessionId,
    // Copie de flux autorisée sous le plafond de débit : une source déjà
    // h264/aac plus légère que le preset est remuxée sans réencodage.
    allowVideoStreamCopy: "true",
    allowAudioStreamCopy: "true",
  });
  if (preset.videoBitRate !== undefined) params.set("videoBitRate", String(preset.videoBitRate));
  if (preset.audioBitRate !== undefined) params.set("audioBitRate", String(preset.audioBitRate));
  if (preset.maxHeight !== undefined) params.set("maxHeight", String(preset.maxHeight));
  if (preset.maxAudioChannels !== undefined) params.set("maxAudioChannels", String(preset.maxAudioChannels));
  if (request.mediaSourceId !== null) params.set("mediaSourceId", request.mediaSourceId);
  if (request.audioStreamIndex !== null) params.set("audioStreamIndex", String(request.audioStreamIndex));
  if (request.burnSubtitleIndex !== null) {
    params.set("subtitleStreamIndex", String(request.burnSubtitleIndex));
    params.set("subtitleMethod", "Encode");
  }
  return params;
}
