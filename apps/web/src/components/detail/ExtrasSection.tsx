import { useSeasons } from "@tentacle-tv/api-client";
import { seasonHasExtras, type MediaItem } from "@tentacle-tv/shared";
import { ExtrasRow } from "./ExtrasRow";
import { useItemRemoteTrailers } from "../../hooks/useItemRemoteTrailers";
import type { RichTrailer } from "./trailerLang";

/**
 * Section « Extras » de la page détail.
 *
 *  - Film/épisode : une rangée pour ses bandes-annonces locales, ses bonus et
 *    ses trailers distants.
 *  - Série : sa rangée à elle, puis une rangée par saison QUI A des extras —
 *    bonus, bandes-annonces locales (`Season 02/trailers/`) ou distantes.
 *
 * Chaque rangée se masque d'elle-même si elle n'a aucun extra.
 */
export function ExtrasSection({ item, seriesItem }: { item: MediaItem; seriesItem?: MediaItem }) {
  // Trailers distants fusionnés Jellyfin + TMDB (toutes saisons + teasers), triés langue.
  const remote = useItemRemoteTrailers(item);
  if (item.Type === "Series") return <SeriesExtras item={item} seriesTrailers={remote} />;
  // Épisode : sa propre rangée (se masque sans extras) PUIS les extras de la
  // série parente en repli.
  if (item.Type === "Episode") {
    return (
      <>
        <ExtrasRow owner={item} remoteTrailers={remote} />
        {seriesItem && <SeriesExtrasAuto item={seriesItem} />}
      </>
    );
  }
  return <ExtrasRow owner={item} remoteTrailers={remote} />;
}

/** Calcule les trailers distants de la série puis délègue à SeriesExtras. */
function SeriesExtrasAuto({ item }: { item: MediaItem }) {
  const trailers = useItemRemoteTrailers(item);
  return <SeriesExtras item={item} seriesTrailers={trailers} />;
}

function SeriesExtras({ item, seriesTrailers }: { item: MediaItem; seriesTrailers: RichTrailer[] }) {
  const { data: seasons } = useSeasons(item.Id);
  return (
    <>
      {/* Niveau série : ses bandes-annonces et bonus locaux, et les
          trailers/teasers complets (TMDB agrège les BA de toutes les saisons
          au niveau show). */}
      <ExtrasRow owner={item} remoteTrailers={seriesTrailers} />
      {/* Niveau saison : seulement les saisons qui ONT des extras — leurs
          compteurs, servis avec la liste, évitent toute requête vide. */}
      {seasons?.filter(seasonHasExtras).map((season) => (
        <ExtrasRow key={season.Id} owner={season} title={season.Name} remoteTrailers={season.RemoteTrailers ?? []} />
      ))}
    </>
  );
}
