import { extractMediaQuality, resumeState, ticksToSeconds, type MediaItem } from "@tentacle-tv/shared";

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
  /**
   * Hauteur de la SCÈNE : le décor sur 70 % de l'écran (plafond 680), 64 % sur
   * tablette (plafond 860). Le bloc titre se pose dans son bas.
   */
  backdropH: number;
  /** Affiche (colonne gauche de l'iPad paysage) : `min(200, 0,32 × L)`, au 2:3. */
  posterW: number;
  posterH: number;
  /** Logo du titre : boîte maximale, centrée dans la scène. */
  logoMaxW: number;
  logoMaxH: number;
  /** Défilement auquel la barre haute est pleine : quand le titre de la scène la passe. */
  revealAt: number;
  /** iPad paysage : deux colonnes. */
  twoCol: boolean;
}

export function detailGeometry(width: number, height: number, isTablet: boolean, landscape: boolean): DetailGeometry {
  const backdropH = isTablet ? Math.min(860, Math.round(height * 0.64)) : Math.min(680, Math.round(height * 0.7));
  const posterW = Math.min(200, Math.round(width * 0.32));
  return {
    backdropH,
    posterW,
    posterH: Math.round(posterW * 1.5),
    logoMaxW: Math.min(isTablet ? 460 : 300, Math.round(width * 0.76)),
    logoMaxH: isTablet ? 140 : 96,
    revealAt: Math.round(backdropH * 0.82),
    twoCol: isTablet && landscape,
  };
}

/** `S01E02` — la saison manquante vaut 1, comme dans l'app. */
export function episodeCode(season: number | null | undefined, episode: number | null | undefined): string {
  return `S${String(season ?? 1).padStart(2, "0")}E${String(episode ?? 1).padStart(2, "0")}`;
}

type Translate = (key: string, opts?: Record<string, unknown>) => string;

type SeriesWatchState = { type: string; episode?: MediaItem } | undefined;

export interface PlayCta {
  /** Ce que lance le bouton ; `null` = pas de bouton (série terminée, sans état). */
  targetId: string | null;
  label: string;
  /** Avancement 0 → 1 de ce que lance le bouton, `null` s'il n'est pas entamé. */
  progress: number | null;
  /** Minutes restantes, `null` sans reprise ou sans durée. */
  remainingMinutes: number | null;
}

/**
 * Le bouton Lecture de la scène : cible, libellé, avancement.
 *
 * Le libellé ne porte plus l'horodatage (« Reprendre à 58:00 ») : ce qu'il
 * reste se lit en clair sous le verbe (« Reste 1 h 48 min ») et l'avancement
 * dans l'anneau de l'icône. Série : le verbe et le code de l'épisode visé.
 */
export function playCta(item: MediaItem, seriesWatchState: SeriesWatchState, t: Translate): PlayCta {
  const isSeries = item.Type === "Series";
  const seriesEp = isSeries && seriesWatchState?.type !== "completed" ? seriesWatchState?.episode : null;
  const target = seriesEp ?? (isSeries || item.Type === "BoxSet" ? null : item);
  if (!target) return { targetId: null, label: t("play"), progress: null, remainingMinutes: null };
  const resume = resumeState(target);
  const verb = resume ? t("resume") : t("play");
  const label = seriesEp ? `${verb} · ${episodeCode(seriesEp.ParentIndexNumber, seriesEp.IndexNumber)}` : verb;
  return { targetId: target.Id, label, progress: resume?.progress ?? null, remainingMinutes: resume?.remainingMinutes ?? null };
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
