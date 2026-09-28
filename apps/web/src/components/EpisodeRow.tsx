/**
 * Ligne d'épisode de la liste Saisons & Épisodes — extraite d'EpisodeList
 * (limite de 300 lignes par fichier). Vignette + progression, toggle « vu »,
 * bouton de téléchargement compact (desktop, droit requis), méta qualité.
 *
 * Mêmes marques que les cartes : la pastille « vu » sur la vignette, la barre
 * de progression commune, et la bascule « vu » au glyphe et au libellé du
 * survol (`cardToggleLabelKey`) — une coche maison y avait divergé.
 */

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useJellyfinClient, useWatchedToggle } from "@tentacle-tv/api-client";
import { cardToggleLabelKey, type MediaItem } from "@tentacle-tv/shared";
import { FadeImage } from "./FadeImage";
import { CardProgressBar } from "./cards/CardProgressBar";
import { CardStatusMarkers } from "./cards/CardStatusMarkers";
import { WatchedGlyph } from "./cards/cardGlyphs";
import { QualityChips, LanguagePill } from "./media/MetaChips";
import { extractMediaQuality } from "../lib/mediaQuality";
import { EpisodeDownloadAction } from "../downloads/EpisodeDownloadAction";
import { RichOverview } from "../lib/overviewHtml";
import { EpisodeRatingLine } from "./rating/EpisodeRatingLine";
import type { EpisodeRatingValues } from "./rating/EpisodeRatingLine";

/** Notes d'un épisode + saisie : valeurs et rappels fournis par la liste (un seul abonnement). */
export interface EpisodeRowRating extends EpisodeRatingValues {
  onRate: (score: number) => void;
  onClear: () => void;
}

export interface EpisodeRowProps {
  episode: MediaItem;
  client: ReturnType<typeof useJellyfinClient>;
  seriesId: string;
  seasonId?: string;
  isSelecting: boolean;
  isSelected: boolean;
  isCurrent?: boolean;
  onToggleSelect: () => void;
  onPlay: () => void;
  /** Absent quand l'épisode n'est pas notable (série sans tmdb, numéros manquants). */
  rating?: EpisodeRowRating;
}

const WATCHED_ONLY = ["watched"] as const;

export function EpisodeRow({ episode: ep, client, seriesId, seasonId, isSelecting, isSelected, isCurrent, onToggleSelect, onPlay, rating }: EpisodeRowProps) {
  const { t } = useTranslation(["common", "cards"]);
  const { markWatched, markUnwatched } = useWatchedToggle(ep.Id, { seriesId, seasonId });
  const quality = useMemo(() => extractMediaQuality(ep), [ep]);

  // PAS de `scrollIntoView` sur l'épisode courant. Il ramenait la page au
  // centre de la liste d'épisodes DÈS l'arrivée sur la fiche : on atterrissait
  // sur « Saisons & Épisodes » sans jamais voir la bannière, le titre ni les
  // actions — et l'animation d'ouverture jouait dans le vide, hors écran.
  // Le surlignage `isCurrent` suffit à situer l'épisode une fois qu'on
  // descend jusqu'à la liste de son plein gré.
  const thumbUrl = ep.ImageTags?.Primary
    ? client.getImageUrl(ep.Id, "Primary", { width: 300, quality: 85 })
    : ep.SeriesId ? client.getImageUrl(ep.SeriesId, "Backdrop", { width: 300, quality: 85 }) : "";

  const progress = ep.UserData?.PlayedPercentage;
  const played = ep.UserData?.Played === true;
  const watchedLabel = t(`cards:${cardToggleLabelKey("watched", played)}`);
  const runtime = ep.RunTimeTicks ? Math.floor(ep.RunTimeTicks / 600_000_000) : null;

  const handleClick = () => {
    if (isSelecting) {
      onToggleSelect();
    } else {
      onPlay();
    }
  };

  const handleWatchedToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (played) {
      markUnwatched.mutate();
    } else {
      markWatched.mutate();
    }
  };

  return (
    <div onClick={handleClick}
      className={`group flex cursor-pointer gap-4 rounded-xl p-3 transition-colors ${
        isSelecting && isSelected
          ? "bg-[rgba(var(--brand-rgb),0.1)] ring-1 ring-[rgba(var(--brand-rgb),0.4)]"
          : "bg-fill-faint hover:bg-fill-soft"
      }`}>
      {/* Selection checkbox or thumbnail */}
      {isSelecting ? (
        <div className="flex w-24 flex-shrink-0 xs:w-28 items-center justify-center sm:w-44">
          <div className={`h-5 w-5 rounded border-2 transition-colors ${
            isSelected ? "border-[rgba(var(--brand-rgb),0.45)] bg-[var(--brand-soft)]" : "border-line-strong"
          }`}>
            {isSelected && (
              <svg className="h-full w-full text-[var(--brand-light)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        </div>
      ) : (
        <div className="relative w-24 flex-shrink-0 xs:w-28 overflow-hidden rounded-lg bg-tentacle-surface sm:w-44">
          <div className="aspect-video">
            {thumbUrl && <FadeImage src={thumbUrl} alt="" className="h-full w-full object-cover" loading="lazy" />}
          </div>
          {/* Halo + bouton lecture + barre de progression posés SUR la vignette :
              restent blanc/noir dans les deux thèmes (cf. règle « posé sur média »). */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90">
              <svg className="ml-0.5 h-5 w-5 text-tentacle-bg" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            </div>
          </div>
          {/* La pastille « vu » et la barre de TOUTES les cartes : un épisode vu
              n'a pas de pourcentage, c'est la pastille qui le dit. */}
          {played ? <CardStatusMarkers statuses={WATCHED_ONLY} className="right-1.5 top-1.5" /> : <CardProgressBar percent={progress} />}
        </div>
      )}

      {/* Info */}
      <div className="flex-1 py-1">
        <div className="flex items-center gap-2">
          <span className={`text-sm text-content-primary ${isCurrent ? "font-bold" : "font-semibold"}`}>
            {isCurrent && (
              <span
                className="mr-2 inline-block h-2 w-2 rounded-full bg-[var(--brand-accent)] align-middle shadow-[0_0_8px_rgba(var(--brand-accent-rgb),0.7)]"
                aria-hidden
              />
            )}
            {ep.IndexNumber}. {ep.Name}
          </span>
          {isCurrent && (
            <span className="flex-shrink-0 text-[10px] font-bold uppercase tracking-wider text-[var(--brand-accent-light)]">
              {t("common:currentEpisode")}
            </span>
          )}
          {/* Téléchargement de CET épisode (desktop, droit requis — sinon absent) */}
          {!isSelecting && <EpisodeDownloadAction episode={ep} />}
          {!isSelecting && (
            <button
              type="button"
              onClick={handleWatchedToggle}
              title={watchedLabel}
              aria-label={watchedLabel}
              aria-pressed={played}
              className={`flex-shrink-0 transition-colors ${
                played ? "text-[var(--brand-light)] hover:text-content-tertiary" : "text-content-disabled hover:text-[var(--brand-light)]"
              }`}
            >
              <WatchedGlyph className="h-5 w-5" filled={played} />
            </button>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-content-quaternary">
          {runtime && <span>{t("common:minutesShort", { count: runtime })}</span>}
          {ep.PremiereDate && <span>{new Date(ep.PremiereDate).toLocaleDateString()}</span>}
          {rating && <EpisodeRatingLine {...rating} />}
          {/* Méta qualité + langues à côté du titre (plus sur la miniature). */}
          <QualityChips quality={quality} density="full" />
          <LanguagePill labels={quality.audioLabels} max={3} />
        </div>
        {ep.Overview && <p className="mt-1.5 text-xs leading-relaxed text-content-tertiary line-clamp-2"><RichOverview text={ep.Overview} /></p>}
      </div>
    </div>
  );
}

