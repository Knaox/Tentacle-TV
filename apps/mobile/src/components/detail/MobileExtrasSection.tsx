import { useSeasons } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { MobileExtrasRow } from "./MobileExtrasRow";

interface RemoteTrailer { Url: string; Name?: string }

/**
 * Section « Extras » (mobile) — parité desktop :
 *  - Film : special features + bandes-annonces de l'item.
 *  - Série : trailers série + une rangée par saison.
 *  - Épisode : extras de l'épisode, puis extras de la série parente en repli.
 * Chaque rangée se masque si vide.
 */
export function MobileExtrasSection({ item, seriesItem }: { item: MediaItem; seriesItem?: MediaItem }) {
  if (item.Type === "Series") return <SeriesExtras item={item} />;
  if (item.Type === "Episode") {
    return (
      <>
        <MobileExtrasRow itemId={item.Id} remoteTrailers={item.RemoteTrailers as RemoteTrailer[] | undefined} />
        {seriesItem && <SeriesExtras item={seriesItem} />}
      </>
    );
  }
  return <MobileExtrasRow itemId={item.Id} remoteTrailers={item.RemoteTrailers as RemoteTrailer[] | undefined} />;
}

/** Trailers au niveau série + une rangée d'extras par saison (RemoteTrailers déjà fournis par useSeasons). */
function SeriesExtras({ item }: { item: MediaItem }) {
  const { data: seasons } = useSeasons(item.Id);
  return (
    <>
      <MobileExtrasRow itemId={item.Id} remoteTrailers={item.RemoteTrailers as RemoteTrailer[] | undefined} />
      {seasons?.map((s) => (
        <MobileExtrasRow
          key={s.Id}
          itemId={s.Id}
          title={s.Name}
          remoteTrailers={s.RemoteTrailers as RemoteTrailer[] | undefined}
        />
      ))}
    </>
  );
}
