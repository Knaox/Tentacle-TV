import type { MediaItem } from "@tentacle-tv/shared";
import { ticksToSeconds } from "@tentacle-tv/shared";

interface PlayableEp {
  ParentIndexNumber?: number | null;
  IndexNumber?: number | null;
  UserData?: { PlaybackPositionTicks?: number } | null;
}

function fmtTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const mm = m.toString().padStart(2, "0");
  const ss = s.toString().padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Label pour le CTA Lecture d'une série — inclut S/E + position de reprise. */
export function buildSeriesPlayLabel(ep: PlayableEp, t: (k: string, o?: any) => string): string {
  const sNum = String(ep.ParentIndexNumber ?? 1).padStart(2, "0");
  const eNum = String(ep.IndexNumber ?? 1).padStart(2, "0");
  const pos = ep.UserData?.PlaybackPositionTicks ?? 0;
  return pos > 0
    ? `${t("resumeAt", { time: fmtTime(ticksToSeconds(pos)) })} · S${sNum}E${eNum}`
    : `${t("play")} · S${sNum}E${eNum}`;
}

export { fmtTime as formatTime };

interface StreamLike {
  Type?: string;
  Width?: number;
  Codec?: string;
  Channels?: number;
  DisplayTitle?: string;
}

/**
 * Calcule la liste des badges techniques à afficher pour un item :
 * résolution (4K/1080p/720p) + codec (HEVC/H.264/AV1) + son (Atmos/7.1/5.1).
 */
export function computeBadges(item: MediaItem | undefined): string[] {
  if (!item?.MediaSources?.[0]?.MediaStreams) return [];
  const streams = item.MediaSources[0].MediaStreams as StreamLike[];
  const out: string[] = [];
  const video = streams.find((s) => s.Type === "Video");
  if (video) {
    if (video.Width && video.Width >= 3840) out.push("4K");
    else if (video.Width && video.Width >= 1920) out.push("1080p");
    else if (video.Width && video.Width >= 1280) out.push("720p");
    const c = video.Codec?.toLowerCase();
    if (c === "hevc") out.push("HEVC");
    else if (c === "h264") out.push("H.264");
    else if (c === "av1") out.push("AV1");
  }
  const audio = streams.find((s) => s.Type === "Audio");
  if (audio) {
    const dt = audio.DisplayTitle?.toLowerCase() ?? "";
    if (dt.includes("atmos")) out.push("Atmos");
    else if (audio.Channels && audio.Channels >= 8) out.push("7.1");
    else if (audio.Channels && audio.Channels >= 6) out.push("5.1");
  }
  return out;
}
