/**
 * Ligne d'épisode de la liste Saisons & Épisodes — extraite d'EpisodeList
 * (limite de 300 lignes par fichier). Vignette + progression, méta qualité,
 * et les actions de l'épisode : garder hors ligne (bureau, droit requis) et
 * la bascule « vu ».
 *
 * La grammaire des cartes, jusqu'au bout : AU REPOS, l'état se lit sur la
 * vignette et nulle part ailleurs — la pastille du modèle (vu, sur cette
 * machine) et la barre de progression commune ; AU SURVOL (ou au focus
 * clavier), les actions paraissent au bout du titre et la pastille leur cède
 * la place, comme le plateau d'une carte. Une coche violette restait
 * affichée à côté du titre, pleine quand l'épisode était vu : elle doublait
 * la pastille. Aucun bouton de lecture sur la vignette : la ligne entière lit.
 */

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useJellyfinClient, useWatchedToggle } from "@tentacle-tv/api-client";
import { cardToggleLabelKey, resolveCardMarkers, type MediaItem } from "@tentacle-tv/shared";
import { useCardDeviceState } from "../downloads/useDeviceState";
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

  // Le modèle des marqueurs, réduit à ce qu'une LIGNE dit d'un épisode : vu,
  // et sur cette machine. Ma liste et les favoris vivent au niveau de la
  // série, sur la fiche — les répéter à chaque ligne serait du bruit.
  const device = useCardDeviceState(ep);
  const markers = resolveCardMarkers({ item: ep, communityRating: null, inWatchlist: false, isFavorite: false, device });
  const played = markers.statuses.includes("watched");
  const progress = ep.UserData?.PlayedPercentage;
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
          {/* La pastille et la barre de TOUTES les cartes, posées sur la
              vignette : un épisode vu n'a pas de pourcentage, c'est la pastille
              qui le dit. Au survol, elle cède la place aux actions. */}
          <CardStatusMarkers
            statuses={markers.statuses}
            device={markers.device}
            className="right-1.5 top-1.5 group-hover:opacity-0 group-focus-within:opacity-0"
          />
          {!played && <CardProgressBar percent={progress} />}
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
          {/* Les actions de l'épisode, au survol ou au focus seulement :
              garder hors ligne (bureau, droit requis — sinon absent) puis
              « vu ». Toujours à leur place (opacité), le titre ne bouge pas. */}
          {!isSelecting && (
            <span className="flex flex-shrink-0 items-center gap-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
              <EpisodeDownloadAction episode={ep} />
              <button
                type="button"
                onClick={handleWatchedToggle}
                title={watchedLabel}
                aria-label={watchedLabel}
                aria-pressed={played}
                className={`flex-shrink-0 transition-colors ${
                  played ? "text-[var(--brand-light)] hover:text-content-secondary" : "text-content-tertiary hover:text-[var(--brand-light)]"
                }`}
              >
                <WatchedGlyph className="h-5 w-5" filled={played} />
              </button>
            </span>
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

