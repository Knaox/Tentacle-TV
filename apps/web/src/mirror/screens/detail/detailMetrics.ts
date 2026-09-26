import { extractMediaQuality, ticksToSeconds, type MediaItem } from "@tentacle-tv/shared";

/**
 * Les mesures et libellés purs de la fiche de l'app (`MediaDetailScreen`,
 * `DetailHeader`, `computeBadges`, `MetaTokens`), recopiés à l'identique.
 * Aucune dépendance au DOM : testés à part.
 */

/** Note Jellyfin : `status.rating` de l'app — le web n'a pas de jeton équivalent. */
export const RATING_COLOR = "#fbbf24";
/** Largeur de la colonne gauche figée de l'iPad en paysage. */
export const TWO_COL_LEFT_WIDTH = 380;
/** Largeur max des deux colonnes réunies (iPad paysage). */
export const TWO_COL_MAX_WIDTH = 1180;
/** Largeur max du bouton Lecture (et de la rangée d'actions qui s'y aligne). */
export const PLAY_MAX_WIDTH = 420;
/** Hauteur de la barre de l'en-tête de l'app (`HEADER_BAR_HEIGHT`). */
export const HEADER_BAR_HEIGHT = 44;
/** Course du fondu de la barre haute (`DetailTopBar`). */
export const TOP_BAR_FADE_SPAN = 80;

export interface DetailGeometry {
  /** Hauteur du visuel plein cadre : `min(520 | 620, 0,52 × H)`. */
  backdropH: number;
  /** Affiche : `min(200, 0,32 × L)`, au 2:3. */
  posterW: number;
  posterH: number;
  /** Défilement auquel la barre haute est pleine : 0,62 × visuel. */
  revealAt: number;
  /** iPad paysage : deux colonnes. */
  twoCol: boolean;
}

export function detailGeometry(width: number, height: number, isTablet: boolean, landscape: boolean): DetailGeometry {
  const backdropH = Math.min(isTablet ? 620 : 520, Math.round(height * 0.52));
  const posterW = Math.min(200, Math.round(width * 0.32));
  return {
    backdropH,
    posterW,
    posterH: Math.round(posterW * 1.5),
    revealAt: backdropH * 0.62,
    twoCol: isTablet && landscape,
  };
}

/** `fmtTime` de l'app : `h:mm:ss`, ou `mm:ss` sous l'heure. */
export function formatTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const mm = m.toString().padStart(2, "0");
  const ss = s.toString().padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** `S01E02` — la saison manquante vaut 1, comme dans l'app. */
export function episodeCode(season: number | null | undefined, episode: number | null | undefined): string {
  return `S${String(season ?? 1).padStart(2, "0")}E${String(episode ?? 1).padStart(2, "0")}`;
}

type Translate = (key: string, opts?: Record<string, unknown>) => string;

interface PlayableEp {
  ParentIndexNumber?: number | null;
  IndexNumber?: number | null;
  UserData?: { PlaybackPositionTicks?: number } | null;
}

/** `buildSeriesPlayLabel` de l'app : S/E + position de reprise. */
export function buildSeriesPlayLabel(ep: PlayableEp, t: Translate): string {
  const code = episodeCode(ep.ParentIndexNumber, ep.IndexNumber);
  const pos = ep.UserData?.PlaybackPositionTicks ?? 0;
  return pos > 0
    ? `${t("resumeAt", { time: formatTime(ticksToSeconds(pos)) })} · ${code}`
    : `${t("play")} · ${code}`;
}

type SeriesWatchState = { type: string; episode?: MediaItem } | undefined;

export interface PlayCta {
  /** Ce que lance le bouton ; `null` = pas de bouton (série terminée, sans état). */
  targetId: string | null;
  label: string;
  /** Film / épisode entamé : la barre de progression sous le bouton. */
  showProgress: boolean;
  progress: number;
}

/** Le bouton Lecture de `DetailHeader` : cible, libellé, progression. */
export function playCta(item: MediaItem, seriesWatchState: SeriesWatchState, t: Translate): PlayCta {
  const isSeries = item.Type === "Series";
  const posTicks = item.UserData?.PlaybackPositionTicks ?? 0;
  const hasResume = posTicks > 0;
  const progress = item.UserData?.PlayedPercentage ? item.UserData.PlayedPercentage / 100 : 0;
  const seriesEp = isSeries && seriesWatchState?.type !== "completed" ? seriesWatchState?.episode : null;
  const targetId = seriesEp?.Id ?? (isSeries ? null : item.Id);
  const label = seriesEp
    ? buildSeriesPlayLabel(seriesEp, t)
    : hasResume
      ? t("resumeAt", { time: formatTime(ticksToSeconds(posTicks)) })
      : t("play");
  return { targetId, label, showProgress: !isSeries && hasResume, progress };
}

export interface MetaToken {
  label: string;
  accent?: boolean;
}

/** `MetaTokens` de l'app : qualité (4K accentué), HDR / Vision, Atmos, puis 3 langues au plus. */
export function metaTokens(item: MediaItem | undefined): { tokens: MetaToken[]; langs: string[] } {
  const q = extractMediaQuality(item);
  const tokens: MetaToken[] = [];
  if (q.resolution === "4K") tokens.push({ label: "4K", accent: true });
  else if (q.resolution === "FHD") tokens.push({ label: "1080P" });
  else if (q.resolution === "HD") tokens.push({ label: "720P" });
  if (q.isDolbyVision) tokens.push({ label: "Vision" });
  else if (q.isHDR) tokens.push({ label: "HDR" });
  if (q.isDolbyAtmos) tokens.push({ label: "Atmos" });
  const langs = q.audioLabels.map((l) => l.token).slice(0, 3);
  return { tokens, langs };
}

/** Durée en minutes arrondies ; `null` sans durée connue. */
export function runtimeMinutes(ticks: number | null | undefined): number | null {
  return ticks ? Math.round(ticksToSeconds(ticks) / 60) : null;
}

/** Extrait l'identifiant d'une vidéo YouTube (watch?v=, youtu.be/, embed/). */
export function youtubeId(url: string): string | null {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : null;
}
