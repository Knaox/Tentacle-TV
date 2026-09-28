import type { MediaItem } from "@tentacle-tv/shared";
import { resumeState, ticksToSeconds } from "@tentacle-tv/shared";

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

/**
 * Label pour le CTA Lecture d'une série — inclut S/E + position de reprise.
 * Encore lu par les écrans hors ligne ; la fiche en ligne passe par
 * `detailPlayCta`.
 */
export function buildSeriesPlayLabel(ep: PlayableEp, t: (k: string, o?: any) => string): string {
  const sNum = String(ep.ParentIndexNumber ?? 1).padStart(2, "0");
  const eNum = String(ep.IndexNumber ?? 1).padStart(2, "0");
  const pos = ep.UserData?.PlaybackPositionTicks ?? 0;
  return pos > 0
    ? `${t("resumeAt", { time: fmtTime(ticksToSeconds(pos)) })} · S${sNum}E${eNum}`
    : `${t("play")} · S${sNum}E${eNum}`;
}

export { fmtTime as formatTime };

type SeriesWatchState = { type: string; episode?: MediaItem } | undefined;

export interface DetailPlayCta {
  /** Ce que lance le bouton ; `null` = pas de bouton (série terminée, collection). */
  targetId: string | null;
  label: string;
  /** Avancement 0 → 1, `null` s'il n'y a rien à reprendre. */
  progress: number | null;
  /** Minutes restantes, `null` sans reprise ou sans durée. */
  remainingMinutes: number | null;
}

/**
 * Le bouton Lecture de la fiche — jumeau de `playCta` du miroir web.
 *
 * Le libellé ne porte plus l'horodatage (« Reprendre à 58:00 ») : le temps
 * restant se lit en clair sous le verbe, l'avancement dans l'anneau de
 * l'icône. Série : le verbe et le code de l'épisode visé.
 */
export function detailPlayCta(item: MediaItem, seriesWatchState: SeriesWatchState, t: (k: string) => string): DetailPlayCta {
  const isSeries = item.Type === "Series";
  const seriesEp = isSeries && seriesWatchState?.type !== "completed" ? seriesWatchState?.episode : null;
  const target = seriesEp ?? (isSeries || item.Type === "BoxSet" ? null : item);
  if (!target) return { targetId: null, label: t("play"), progress: null, remainingMinutes: null };
  const resume = resumeState(target);
  const verb = resume ? t("resume") : t("play");
  const code = seriesEp
    ? `S${String(seriesEp.ParentIndexNumber ?? 1).padStart(2, "0")}E${String(seriesEp.IndexNumber ?? 1).padStart(2, "0")}`
    : "";
  return {
    targetId: target.Id,
    label: code ? `${verb} · ${code}` : verb,
    progress: resume?.progress ?? null,
    remainingMinutes: resume?.remainingMinutes ?? null,
  };
}

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
