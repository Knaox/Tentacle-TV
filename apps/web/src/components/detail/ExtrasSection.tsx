import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useItemTrailer, useSeasons } from "@tentacle-tv/api-client";
import {
  catalogEntriesByScope, catalogRowFor, seasonHasExtras, seasonScopeKey, type CatalogScopes, type MediaItem,
} from "@tentacle-tv/shared";
import { ExtrasRow } from "./ExtrasRow";
import { useItemRemoteTrailers } from "../../hooks/useItemRemoteTrailers";
import { useWebTrailerPlatform } from "./trailerPlatform";
import type { RichTrailer } from "./trailerLang";

/**
 * Section « Extras » de la page détail.
 *
 *  - Film : une rangée pour ses bandes-annonces locales, ses bonus et ses
 *    vidéos en ligne.
 *  - Série : sa rangée à elle, puis une rangée par saison QUI A des extras —
 *    bonus, bandes-annonces locales (`Season 02/trailers/`) ou en ligne.
 *  - Épisode : sa rangée, puis celle de SA saison, avant la série et les
 *    autres saisons.
 *
 * Avec le catalogue du serveur (lecteur complet), ses vidéos nourrissent les
 * rangées, portée par portée — AlloCiné compris, la langue du serveur d'abord,
 * UNE requête pour toute la fiche (`catalogExtras.ts`, shared). Chaque rangée se
 * masque d'elle-même si elle n'a aucun extra.
 */
export function ExtrasSection({ item, seriesItem }: { item: MediaItem; seriesItem?: MediaItem }) {
  const { i18n } = useTranslation();
  const platform = useWebTrailerPlatform();
  const { entries, language } = useItemTrailer(item, i18n.language, platform);
  const scopes = useMemo(
    () => (platform.playable.includes("dailymotion") && entries.length > 0 ? catalogEntriesByScope(entries, language) : null),
    [platform, entries, language],
  );
  // Sans catalogue : les vidéos distantes d'avant (Jellyfin + TMDB, triées langue).
  const remote = useItemRemoteTrailers(scopes ? undefined : item);
  if (item.Type === "Series") return <SeriesExtras item={item} seriesTrailers={remote} scopes={scopes} />;
  if (item.Type === "Episode") {
    return (
      <>
        <ExtrasRow owner={item} remoteTrailers={scopes ? [] : remote} />
        {seriesItem && <SeriesExtrasAuto item={seriesItem} scopes={scopes} currentSeason={item.ParentIndexNumber} />}
      </>
    );
  }
  return <ExtrasRow owner={item} remoteTrailers={remote} catalog={catalogRowFor(scopes, "movie")} />;
}

/** La série parente d'un épisode : ses vidéos d'avant seulement sans catalogue (celui de l'épisode couvre tout). */
function SeriesExtrasAuto({ item, scopes, currentSeason }: { item: MediaItem; scopes: CatalogScopes | null; currentSeason?: number | null }) {
  const trailers = useItemRemoteTrailers(scopes ? undefined : item);
  return <SeriesExtras item={item} seriesTrailers={trailers} scopes={scopes} currentSeason={currentSeason} />;
}

interface SeriesExtrasProps {
  item: MediaItem;
  seriesTrailers: RichTrailer[];
  scopes: CatalogScopes | null;
  /** La saison de l'épisode ouvert : sa rangée passe en tête. */
  currentSeason?: number | null;
}

function SeriesExtras({ item, seriesTrailers, scopes, currentSeason }: SeriesExtrasProps) {
  const { data: seasons } = useSeasons(item.Id);
  // Seulement les saisons qui ONT des extras — compteurs servis avec la liste,
  // ou vidéos au catalogue : aucune requête vide.
  const shown = (seasons ?? []).filter((season) => {
    const key = seasonScopeKey(season.IndexNumber);
    return seasonHasExtras(season) || (key !== null && catalogRowFor(scopes, key) !== null);
  });
  const current = currentSeason != null ? shown.find((season) => season.IndexNumber === currentSeason) : undefined;
  const seasonRow = (season: MediaItem) => {
    const key = seasonScopeKey(season.IndexNumber);
    return (
      <ExtrasRow
        key={season.Id}
        owner={season}
        title={season.Name}
        remoteTrailers={scopes ? [] : season.RemoteTrailers ?? []}
        catalog={key ? catalogRowFor(scopes, key) : null}
      />
    );
  };
  return (
    <>
      {current && seasonRow(current)}
      {/* Niveau série : ses bandes-annonces et bonus locaux, et ses vidéos en
          ligne (sans catalogue, TMDB agrège celles de toutes les saisons). */}
      <ExtrasRow owner={item} remoteTrailers={scopes ? [] : seriesTrailers} catalog={catalogRowFor(scopes, "series")} />
      {shown.filter((season) => season !== current).map(seasonRow)}
    </>
  );
}
