import { useSeasons } from "@tentacle-tv/api-client";
import { seasonHasExtras, type MediaItem } from "@tentacle-tv/shared";
import { ExtrasRow } from "./ExtrasRow";
import { useItemRemoteTrailers } from "../../hooks/useItemRemoteTrailers";
import type { RichTrailer } from "./trailerLang";

/**
 * Section « Extras » de la page détail.
 *
 *  - Film/épisode : une rangée pour les special features de l'item.
 *  - Série : les extras ne sont PAS attachés à la série (piège Swiftfin :
 *    SpecialFeatures(seriesId) renvoie vide) mais au niveau SAISON. On itère
 *    donc les saisons, une rangée par saison.
 *
 * Chaque rangée se masque d'elle-même si elle n'a aucun extra.
 */
export function ExtrasSection({ item, seriesItem }: { item: MediaItem; seriesItem?: MediaItem }) {
  // Trailers distants fusionnés Jellyfin + TMDB (toutes saisons + teasers), triés langue.
  const remote = useItemRemoteTrailers(item);
  if (item.Type === "Series") return <SeriesExtrasAuto item={item} />;
  // Épisode : sa propre rangée (trailer/special features de l'épisode si dispo,
  // se masque sinon) PUIS les extras de la série parente en repli.
  if (item.Type === "Episode") {
    return (
      <>
        <ExtrasRow itemId={item.Id} remoteTrailers={remote} />
        {seriesItem && <SeriesExtrasAuto item={seriesItem} />}
      </>
    );
  }
  return <ExtrasRow itemId={item.Id} remoteTrailers={remote} />;
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
      {/* Niveau série : trailers/teasers complets (TMDB agrège les BA de toutes
          les saisons au niveau show ; les special features sont vides au niveau
          seriesId — piège Swiftfin). */}
      <ExtrasRow itemId={item.Id} remoteTrailers={seriesTrailers} />
      {/* Niveau saison : seulement les saisons qui ONT des extras. */}
      {seasons?.filter(seasonHasExtras).map((season) => (
        <ExtrasRow key={season.Id} itemId={season.Id} title={season.Name} remoteTrailers={season.RemoteTrailers ?? []} />
      ))}
    </>
  );
}
