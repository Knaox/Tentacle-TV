/**
 * Les droits de LECTURE d'un compte (docs/DROITS-UTILISATEURS.md § 9.2) — la
 * politique Jellyfin fait foi (`EnableMediaPlayback`,
 * `EnableVideoPlaybackTranscoding`, `EnableAudioPlaybackTranscoding`,
 * `EnablePlaybackRemuxing`, `RemoteClientBitrateLimit`), le SERVEUR Tentacle
 * les rend tels qu'ils valent pour UN client (`GET /api/playback/rights`,
 * capacité `playback.rights`) et les applique dans son proxy.
 *
 * Ce que Jellyfin 10.11 fait seul (mesuré, source relue) : rien sur la lecture
 * elle-même (`EnableMediaPlayback` ne change que `PlayAccess` d'une fiche) ;
 * une conversion offerte par `PlaybackInfo` dès qu'UN des trois droits de
 * conversion reste ; au flux, l'image et le son COPIÉS de force pour un jeton
 * de compte sans le droit (illisible pour l'appareil), rien du tout derrière
 * une clé d'API ; le plafond de débit des clients distants jugé sur l'adresse
 * qui lui parle — celle de Tentacle derrière son proxy, donc jamais.
 *
 * Une seule règle dit ce qu'une URL de flux demande au serveur
 * (`streamConversions`) et si le compte le permet (`playbackRefusal`) : le
 * proxy s'en sert pour refuser, les lecteurs pour ne jamais demander en douce
 * un mode refusé et dire pourquoi. Elle penche vers la COPIE quand elle ne sait
 * pas (profil, niveau, plage) : le serveur force alors la copie, comme Jellyfin.
 *
 * Recopié octet pour octet dans `apps/backend/src/playback/` (sharedMirror) :
 * aucun import. Les noms traversent le réseau : ils ne se renomment jamais.
 */

export interface PlaybackRights {
  /** Lire un média de la bibliothèque (`EnableMediaPlayback`). */
  mediaPlayback: boolean;
  /** Réencoder l'image (`EnableVideoPlaybackTranscoding`). */
  videoTranscoding: boolean;
  /** Convertir le son (`EnableAudioPlaybackTranscoding`). */
  audioTranscoding: boolean;
  /** Changer de conteneur sans rien réencoder (`EnablePlaybackRemuxing`). */
  remuxing: boolean;
  /** Le plafond de débit de CE client en bits/s (distant et limité), `null` : aucun. */
  maxBitrate: number | null;
}

/** Ce que vaut un compte face à un serveur qui ne déclare rien : tout, comme avant. */
export const FULL_PLAYBACK_RIGHTS: PlaybackRights = {
  mediaPlayback: true,
  videoTranscoding: true,
  audioTranscoding: true,
  remuxing: true,
  maxBitrate: null,
};

/** Les refus (403, corps `{ code }`), du proxy comme des lecteurs. */
export const PLAYBACK_REFUSALS = ["playback_not_allowed", "conversion_not_allowed"] as const;
export type PlaybackRefusal = (typeof PLAYBACK_REFUSALS)[number];

export function isPlaybackRefusal(value: unknown): value is PlaybackRefusal {
  return typeof value === "string" && (PLAYBACK_REFUSALS as readonly string[]).includes(value);
}

/** Ce qu'une lecture fait faire au serveur. */
export interface StreamConversions {
  video: boolean;
  audio: boolean;
  /** Un autre conteneur que le fichier (HLS, `stream.mp4`…). */
  container: boolean;
}

export const NO_CONVERSION: StreamConversions = { video: false, audio: false, container: false };

/** Une piste, telle que Jellyfin la décrit (`MediaStreams`). */
export interface ConversionStream {
  Type?: string | null;
  Index?: number | null;
  Codec?: string | null;
  Width?: number | null;
  Height?: number | null;
  BitRate?: number | null;
  Channels?: number | null;
}

/** La source lue (`MediaSources[i]`) — `null` : inconnue, seules les demandes EXPLICITES comptent. */
export interface ConversionSource {
  MediaStreams?: ReadonlyArray<ConversionStream> | null;
  DefaultAudioStreamIndex?: number | null;
}

type Query = Readonly<Record<string, string | null | undefined>>;

/** Un paramètre, sans égard à la casse (Jellyfin lit ses requêtes ainsi). */
export function queryParam(query: Query, name: string): string | null {
  const wanted = name.toLowerCase();
  for (const key of Object.keys(query)) {
    const value = query[key];
    if (key.toLowerCase() === wanted && value != null) return value;
  }
  return null;
}

function numberParam(query: Query, name: string): number | null {
  const value = Number(queryParam(query, name));
  return queryParam(query, name) !== null && Number.isFinite(value) ? value : null;
}

function codecList(query: Query, name: string): string[] {
  return (queryParam(query, name) ?? "").toLowerCase().split(",").map((codec) => codec.trim()).filter(Boolean);
}

/** Le fichier tel quel (`Static=true`) : rien à convertir. */
function servesFileAsIs(query: Query): boolean {
  return queryParam(query, "static")?.toLowerCase() === "true";
}

function videoConverted(query: Query, video: ConversionStream | undefined): boolean {
  if (queryParam(query, "AllowVideoStreamCopy")?.toLowerCase() === "false") return true;
  const subtitleIndex = numberParam(query, "SubtitleStreamIndex");
  if (subtitleIndex !== null && subtitleIndex >= 0 && queryParam(query, "SubtitleMethod")?.toLowerCase() === "encode") return true;
  if (!video) return false;
  const codecs = codecList(query, "VideoCodec");
  if (codecs.includes("copy")) return false;
  const codec = video.Codec?.toLowerCase();
  if (codecs.length > 0 && codec && !codecs.includes(codec)) return true;
  const maxWidth = numberParam(query, "MaxWidth");
  const maxHeight = numberParam(query, "MaxHeight");
  if (maxWidth !== null && video.Width && video.Width > maxWidth) return true;
  if (maxHeight !== null && video.Height && video.Height > maxHeight) return true;
  const bitrate = numberParam(query, "VideoBitrate");
  return bitrate !== null && !!video.BitRate && video.BitRate > bitrate;
}

function audioConverted(query: Query, audio: ConversionStream | undefined): boolean {
  if (queryParam(query, "AllowAudioStreamCopy")?.toLowerCase() === "false") return true;
  if (queryParam(query, "EnableAutoStreamCopy")?.toLowerCase() === "false") return true;
  if (!audio) return false;
  const codecs = codecList(query, "AudioCodec");
  if (codecs.includes("copy")) return false;
  const codec = audio.Codec?.toLowerCase();
  if (codecs.length > 0 && codec && !codecs.includes(codec)) return true;
  const channels = [numberParam(query, "TranscodingMaxAudioChannels"), numberParam(query, "MaxAudioChannels"), numberParam(query, "AudioChannels")]
    .filter((value): value is number => value !== null);
  if (channels.length > 0 && audio.Channels && audio.Channels > Math.min(...channels)) return true;
  const bitrate = numberParam(query, "AudioBitrate");
  return bitrate !== null && !!audio.BitRate && audio.BitRate > bitrate;
}

/** La piste son lue : celle que la requête nomme, sinon celle par défaut, sinon la première. */
function chosenAudio(query: Query, source: ConversionSource | null): ConversionStream | undefined {
  const audios = (source?.MediaStreams ?? []).filter((stream) => stream.Type === "Audio");
  const index = numberParam(query, "AudioStreamIndex") ?? source?.DefaultAudioStreamIndex ?? null;
  return audios.find((stream) => stream.Index === index) ?? audios[0];
}

/**
 * Ce que demande une URL de flux de Jellyfin (`path` sans `/api/jellyfin/`,
 * `query` sans casse). `null` : ce n'est pas un flux ; `NO_CONVERSION` : le
 * fichier tel quel.
 */
export function streamConversions(path: string, query: Query, source: ConversionSource | null): StreamConversions | null {
  const isAudioPath = /^Audio\/[^/]+\//i.test(path);
  if (!isAudioPath && !/^Videos\/[^/]+\/(?:[^/]+\/)?(stream|master\.m3u8|main\.m3u8|live\.m3u8|hls1\/)/i.test(path)) return null;
  if (servesFileAsIs(query)) return NO_CONVERSION;
  const video = isAudioPath ? undefined : (source?.MediaStreams ?? []).find((stream) => stream.Type === "Video");
  return {
    video: !isAudioPath && videoConverted(query, video),
    audio: audioConverted(query, chosenAudio(query, source)),
    container: true,
  };
}

/** Le refus que mérite cette lecture, ou `null` : permise. `conversions` `null` : rien à juger que la lecture. */
export function playbackRefusal(rights: PlaybackRights, conversions: StreamConversions | null): PlaybackRefusal | null {
  if (!rights.mediaPlayback) return "playback_not_allowed";
  if (!conversions) return null;
  if (conversions.video && !rights.videoTranscoding) return "conversion_not_allowed";
  if (conversions.audio && !rights.audioTranscoding) return "conversion_not_allowed";
  if (conversions.container && !conversions.video && !conversions.audio && !rights.remuxing) return "conversion_not_allowed";
  return null;
}

/** Le compte peut-il demander un PALIER (une image réencodée à un débit choisi) ? */
export function mayRequestQualityTier(rights: PlaybackRights): boolean {
  return rights.mediaPlayback && rights.videoTranscoding;
}
