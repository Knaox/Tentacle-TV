/**
 * Ligne d'épisode de la liste Saisons & Épisodes — extraite d'EpisodeList
 * (limite de 300 lignes par fichier).
 *
 * La forme de la refonte de nov. 2026 (docs/REFONTE-UI.md) : le numéro en
 * chiffres à chasse fixe, la vignette 16:9 (la couleur de l'image d'abord,
 * puis UN fondu), le titre et ses puces, le résumé sur deux lignes, la durée.
 * L'épisode en cours repose sur une encre plus claire ; rien d'autre ne
 * distingue une ligne au repos.
 *
 * L'état se dit EN MOTS sur la ligne du titre — la coche « vu » à la teinte
 * franche, « Épisode actuel », « Sur cet appareil » — et la progression se
 * mesure sur la vignette, au dégradé de jauge. Au survol (ou au focus
 * clavier), les actions paraissent au bout du titre : garder hors ligne
 * (bureau, droit requis) et la bascule « vu ». Aucun bouton de lecture sur la
 * vignette : la ligne entière lit.
 */

import { useMemo, type KeyboardEvent, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { CheckIcon } from "@phosphor-icons/react/dist/csr/Check";
import { useCardMarkers, useJellyfinClient, useWatchedToggle } from "@tentacle-tv/api-client";
import { cardDeviceLabelKey, cardToggleLabelKey, type MediaItem } from "@tentacle-tv/shared";
import { useCardDeviceState } from "../downloads/useDeviceState";
import { FadeImage } from "./FadeImage";
import { KeptGlyph, WatchedGlyph } from "./cards/cardGlyphs";
import { QualityChips, LanguagePill } from "./media/MetaChips";
import { extractMediaQuality } from "../lib/mediaQuality";
import { itemImageColor } from "../lib/itemImageColor";
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
  /**
   * La ligne est elle-même une cible du clavier (Tab, Entrée, Espace). Le
   * client LG l'ENVELOPPE dans sa propre cible (`EpisodeRowTv`) et ne le passe
   * pas : deux cibles emboîtées feraient deux arrêts par épisode.
   */
  keyboard?: boolean;
}

/** Le voile sous la jauge : elle se lit sur n'importe quelle vignette (posé sur média, constant). */
const GAUGE_TRACK = { backgroundColor: "rgba(11, 11, 12, 0.62)" } as const;

export function EpisodeRow({ episode: ep, client, seriesId, seasonId, isSelecting, isSelected, isCurrent, onToggleSelect, onPlay, rating, keyboard = false }: EpisodeRowProps) {
  const { t } = useTranslation(["common", "cards"]);
  const { markWatched, markUnwatched } = useWatchedToggle(ep.Id, { seriesId, seasonId });
  const quality = useMemo(() => extractMediaQuality(ep), [ep]);

  // PAS de `scrollIntoView` sur l'épisode courant. Il ramenait la page au
  // centre de la liste d'épisodes DÈS l'arrivée sur la fiche : on atterrissait
  // sur « Saisons & Épisodes » sans jamais voir la bannière, le titre ni les
  // actions — et l'animation d'ouverture jouait dans le vide, hors écran.
  // Le surlignage `isCurrent` suffit à situer l'épisode une fois qu'on
  // descend jusqu'à la liste de son plein gré.
  const ownImage = Boolean(ep.ImageTags?.Primary);
  const thumbUrl = ownImage
    ? client.getImageUrl(ep.Id, "Primary", { width: 300, quality: 85 })
    : ep.SeriesId ? client.getImageUrl(ep.SeriesId, "Backdrop", { width: 300, quality: 85 }) : "";
  // La couleur d'attente : celle de la vignette, lue dans son blurhash (rien à décoder).
  const thumbColor = ownImage ? itemImageColor(ep, "Primary", ep.ImageTags?.Primary) : null;

  // Le modèle des marqueurs, réduit à ce qu'une LIGNE dit d'un épisode : vu,
  // et sur cette machine. Ma liste et les favoris vivent au niveau de la
  // série, sur la fiche — les répéter à chaque ligne serait du bruit (d'où
  // les deux `false`). `useCardMarkers` et non `ep.UserData` : le geste en
  // cours passe devant le cache, la coche répond au clic.
  const device = useCardDeviceState(ep);
  const markers = useCardMarkers(ep, { communityRating: null, scope: "item", inWatchlist: false, isFavorite: false, device });
  const played = markers.statuses.includes("watched");
  const percent = played ? null : ep.UserData?.PlayedPercentage;
  const ratio = percent != null && percent >= 1 ? Math.min(100, percent) / 100 : null;
  const watchedLabel = t(`cards:${cardToggleLabelKey("watched", played)}`);
  const runtime = ep.RunTimeTicks ? Math.floor(ep.RunTimeTicks / 600_000_000) : null;

  const handleClick = () => {
    if (isSelecting) {
      onToggleSelect();
    } else {
      onPlay();
    }
  };

  // Entrée et Espace sur la LIGNE seulement : un bouton qu'elle contient garde les siennes.
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return;
    e.preventDefault();
    handleClick();
  };

  const handleWatchedToggle = (e: MouseEvent) => {
    e.stopPropagation();
    if (played) {
      markUnwatched.mutate();
    } else {
      markWatched.mutate();
    }
  };

  const selected = isSelecting && isSelected;
  const surface = selected
    ? "bg-accent-soft shadow-[inset_0_0_0_1.5px_var(--accent)]"
    : isCurrent ? "bg-surface-2" : "hover:bg-surface-2";

  return (
    <div
      onClick={handleClick}
      onKeyDown={keyboard ? handleKeyDown : undefined}
      role={keyboard ? (isSelecting ? "checkbox" : "button") : undefined}
      aria-checked={keyboard && isSelecting ? isSelected : undefined}
      // Pas d'`aria-current` : le moteur de focus du client LG y lit sa cible d'arrivée
      // (`focus/default.ts`) ; « Épisode actuel » le dit en mots, sur la ligne.
      tabIndex={keyboard ? 0 : undefined}
      className={`group flex cursor-pointer items-center gap-3 rounded-tile p-2.5 outline-none transition-colors duration-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)] sm:gap-4 ${surface}`}
    >
      {/* Le numéro — ou, en sélection, la case : la vignette reste, on choisit ce qu'on voit. */}
      <span className="flex w-6 flex-shrink-0 justify-center">
        {isSelecting ? (
          <span className="ui-check" data-checked={isSelected}>
            <CheckIcon weight="bold" className="h-3.5 w-3.5" aria-hidden />
          </span>
        ) : (
          <span className="font-display text-[15px] font-semibold tabular-nums leading-none text-content-tertiary">
            {ep.IndexNumber ?? "·"}
          </span>
        )}
      </span>

      <div
        className="relative w-24 flex-shrink-0 overflow-hidden rounded-card bg-surface-2 xs:w-28 sm:w-44"
        style={thumbColor ? { backgroundColor: thumbColor } : undefined}
      >
        <div className="aspect-video">
          {thumbUrl && <FadeImage src={thumbUrl} alt="" duration={0.22} className="h-full w-full object-cover" loading="lazy" />}
        </div>
        {/* Ce qui se MESURE porte le dégradé de jauge ; un `scaleX`, jamais une largeur. */}
        {ratio !== null && (
          <div
            className="gauge absolute inset-x-2 bottom-2"
            style={GAUGE_TRACK}
            role="img"
            aria-label={t("common:percentWatched", { percent: Math.round(ratio * 100) })}
          >
            <i style={{ transform: `scaleX(${ratio})` }} />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1 py-0.5">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className={`min-w-0 text-[15px] leading-snug text-content-primary ${isCurrent ? "font-bold" : "font-semibold"}`}>
            {ep.Name}
          </span>
          {played && (
            <span className="flex-shrink-0 text-accent" role="img" aria-label={t("cards:status.watched")}>
              <WatchedGlyph className="h-4 w-4" filled />
            </span>
          )}
          {isCurrent && <span className="chip chip-accent flex-shrink-0">{t("common:currentEpisode")}</span>}
          {markers.device !== null && (
            <span className="chip chip-success flex-shrink-0">
              <KeptGlyph className="h-3 w-3" />
              {t(`cards:${cardDeviceLabelKey(markers.device)}`)}
            </span>
          )}
        </div>
        {ep.Overview && (
          <p className="card-caption mt-1 line-clamp-2 max-w-[68ch] text-[13px] leading-relaxed">
            <RichOverview text={ep.Overview} />
          </p>
        )}
        <div className="card-caption mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs tabular-nums">
          {runtime && <span>{t("common:minutesShort", { count: runtime })}</span>}
          {ep.PremiereDate && <span>{new Date(ep.PremiereDate).toLocaleDateString()}</span>}
          {rating && <EpisodeRatingLine {...rating} />}
          {/* Méta qualité + langues à côté du titre (plus sur la miniature). */}
          <QualityChips quality={quality} density="full" />
          <LanguagePill labels={quality.audioLabels} max={3} />
        </div>
      </div>

      {/* Les actions de l'épisode, au survol ou au focus seulement : garder
          hors ligne (bureau, droit requis — sinon absent) puis « vu ».
          Toujours à leur place (opacité), rien ne bouge. Au doigt, pas de
          survol : elles restent visibles. */}
      {!isSelecting && (
        <span className="flex flex-shrink-0 items-center gap-1.5 self-center opacity-0 transition-opacity duration-hover group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
          <EpisodeDownloadAction episode={ep} />
          <button
            type="button"
            onClick={handleWatchedToggle}
            title={watchedLabel}
            aria-label={watchedLabel}
            aria-pressed={played}
            className="icon-btn btn-sm"
          >
            <WatchedGlyph className="h-[18px] w-[18px]" filled={played} />
          </button>
        </span>
      )}
    </div>
  );
}
