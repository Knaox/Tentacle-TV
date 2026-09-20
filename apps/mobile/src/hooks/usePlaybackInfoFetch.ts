import { Platform } from "react-native";
import { TextTrackType } from "react-native-video";
import type { MediaSource, MediaStream as JfStream, PlaybackInfoResponse } from "@tentacle-tv/shared";
import { supportsAv1HardwareDecode } from "../../modules/mpv-player";
import { externalSubtitleFormat } from "@/player/engine/trackMapping";
import type { ExternalSubtitleSource, PlayerEngineKind } from "@/player/engine/types";
import { buildIosDeviceProfile } from "../lib/iosDeviceProfile";
import { buildAndroidDeviceProfile } from "../lib/androidDeviceProfile";
import { toISO6391 } from "../lib/playerUtils";

/** Bitmap subtitle codecs that need server-side burn-in */
const BITMAP_CODECS = new Set(["pgssub", "dvdsub", "dvbsub", "pgs", "vobsub"]);

export function isBitmapSub(stream: JfStream): boolean {
  return BITMAP_CODECS.has(stream.Codec?.toLowerCase() ?? "");
}

export interface TextTrackEntry {
  title: string;
  language: string;
  type: TextTrackType;
  uri: string;
}

/** Ce que `fetchPlaybackInfo` accepte : pistes, position, plafond, relance, moteur. */
export interface PlaybackFetchOptions {
  audioStreamIndex?: number;
  subtitleStreamIndex?: number;
  startTimeTicks?: number;
  maxBitrate?: number;
  maxWidth?: number;
  maxHeight?: number;
  isRetry?: boolean;
  /** Le moteur pour lequel négocier ; sinon celui de la session. */
  engine?: PlayerEngineKind;
}

/** Build sideloaded VTT tracks for iOS AVPlayer (direct play only) */
export function buildTextTracks(
  ms: MediaSource,
  getSubtitleUrl: (itemId: string, msId: string, idx: number, ext: string) => string,
  itemId: string,
): TextTrackEntry[] {
  if (!ms.MediaStreams) return [];
  return ms.MediaStreams
    .filter((s) => s.Type === "Subtitle" && !isBitmapSub(s))
    .map((s) => ({
      title: s.DisplayTitle || s.Title || s.Language || `Sub ${s.Index}`,
      language: toISO6391(s.Language),
      type: TextTrackType.VTT,
      uri: getSubtitleUrl(itemId, ms.Id, s.Index, "vtt"),
    }));
}

/**
 * Les sous-titres texte que le lecteur avancé ajoute lui-même (`sub-add`),
 * servis dans leur FORMAT D'ORIGINE (`Stream.ass`, jamais converti). En lecture
 * directe, seuls les externes : les pistes intégrées sont dans le fichier. Sous
 * un plafond de débit (HLS), tous les textes : le flux transcodé n'en porte aucun.
 */
export function buildExternalSubtitles(
  ms: MediaSource,
  getSubtitleUrl: (itemId: string, msId: string, idx: number, ext: string) => string,
  itemId: string,
  options: { externalOnly: boolean },
): ExternalSubtitleSource[] {
  if (!ms.MediaStreams) return [];
  return ms.MediaStreams
    .filter((s) => s.Type === "Subtitle" && !isBitmapSub(s) && (!options.externalOnly || s.IsExternal === true))
    .map((s) => {
      const format = externalSubtitleFormat(s.Codec);
      return { jellyfinIndex: s.Index, url: getSubtitleUrl(itemId, ms.Id, s.Index, format), format };
    });
}

export function detectBurnIn(ms: MediaSource, subIdx: number): number {
  if (subIdx < 0) return -1;
  const sub = ms.MediaStreams?.find((s) => s.Index === subIdx && s.Type === "Subtitle");
  return sub && isBitmapSub(sub) ? subIdx : -1;
}

export interface DirectStreamingCfg {
  mediaBaseUrl: string;
  jellyfinToken: string;
}

/** Construit l'URL HLS / direct depuis la réponse PlaybackInfo. */
export function buildStreamUrl(opts: {
  itemId: string;
  ms: MediaSource;
  directPlay: boolean;
  ds: DirectStreamingCfg | null;
  baseUrl: string;
  accessToken: string | null;
  subIdx: number;
}): string | null {
  const { itemId, ms, directPlay, ds, baseUrl, accessToken, subIdx } = opts;

  if (directPlay) {
    const root = ds ? ds.mediaBaseUrl : baseUrl;
    const token = ds ? ds.jellyfinToken : accessToken;
    return `${root}/Videos/${itemId}/stream?Static=true&MediaSourceId=${ms.Id}&api_key=${token}`;
  }

  if (!ms.TranscodingUrl) return null;

  const root = ds ? ds.mediaBaseUrl : baseUrl;
  let transcodingPath = ms.TranscodingUrl;

  if (ds) {
    transcodingPath = transcodingPath.replace(
      /([?&])(api_key|ApiKey)=[^&]*/i,
      `$1ApiKey=${encodeURIComponent(ds.jellyfinToken)}`,
    );
  } else if (Platform.OS === "ios") {
    // iOS AirPlay: Apple TV needs api_key in the URL (no cookie support)
    if (accessToken && !/api_key|ApiKey/i.test(transcodingPath)) {
      transcodingPath += (transcodingPath.includes("?") ? "&" : "?") + `api_key=${encodeURIComponent(accessToken)}`;
    }
  }

  let url = `${root}${transcodingPath}`;

  // Disable subtitle sidecar in the HLS manifest. Mobile renders text subs
  // via the custom `SubtitleOverlay` (and burns-in bitmap subs server-side
  // through SubtitleStreamIndex below). Leaving them in the manifest causes
  // AVPlayer to also display them → double-subtitles on iOS for some animes.
  url = url.replace(/EnableSubtitlesInManifest=true/i, "EnableSubtitlesInManifest=false");
  if (!/EnableSubtitlesInManifest/i.test(url)) {
    url += (url.includes("?") ? "&" : "?") + "EnableSubtitlesInManifest=false";
  }
  if (subIdx >= 0 && !/SubtitleStreamIndex/i.test(url)) {
    url += `&SubtitleStreamIndex=${subIdx}`;
  }
  return url;
}

/** Le profil d'appareil du MOTEUR qui lira, selon la plateforme et le débit cible. */
export function buildPlatformDeviceProfile(engine: PlayerEngineKind, bitrate: number, isRetry: boolean) {
  const maxBitrate = bitrate > 0 ? bitrate : undefined;
  const profile = Platform.OS === "android"
    ? buildAndroidDeviceProfile(engine, maxBitrate)
    : buildIosDeviceProfile(engine, maxBitrate, { av1Hardware: supportsAv1HardwareDecode() });
  if (isRetry) profile.DirectPlayProfiles = [];
  return profile;
}

/** Extrait le StartTimeTicks effectif depuis l'URL renvoyée par Jellyfin. */
export function extractActualStartTicks(ms: MediaSource): number {
  if (!ms.TranscodingUrl) return 0;
  const match = ms.TranscodingUrl.match(/StartTimeTicks=(\d+)/i);
  return match ? Number(match[1]) : 0;
}

export type { PlaybackInfoResponse };
