import { useTranslation } from "react-i18next";
import { useRemoteTrailers, useSeasons } from "@tentacle-tv/api-client";
import { seasonHasExtras, type MediaItem, type RichTrailer } from "@tentacle-tv/shared";
import { MobileExtrasRow } from "./MobileExtrasRow";

/**
 * Section « Extras » (mobile) — parité desktop :
 *  - Film : bandes-annonces locales, bonus, puis vidéos distantes (Jellyfin +
 *    TMDB, triées par langue).
 *  - Série : sa rangée à elle + une rangée par saison qui a des extras.
 *  - Épisode : extras de l'épisode, puis extras de la série parente en repli.
 * Chaque rangée se masque si vide.
 */
export function MobileExtrasSection({ item, seriesItem }: { item: MediaItem; seriesItem?: MediaItem }) {
  const { i18n } = useTranslation();
  const remote = useRemoteTrailers(item, i18n.language);
  if (item.Type === "Series") return <SeriesExtras item={item} remote={remote} />;
  if (item.Type === "Episode") {
    return (
      <>
        <MobileExtrasRow owner={item} remoteTrailers={remote} />
        {seriesItem && <SeriesExtrasAuto item={seriesItem} />}
      </>
    );
  }
  return <MobileExtrasRow owner={item} remoteTrailers={remote} />;
}

function SeriesExtrasAuto({ item }: { item: MediaItem }) {
  const { i18n } = useTranslation();
  const remote = useRemoteTrailers(item, i18n.language);
  return <SeriesExtras item={item} remote={remote} />;
}

/**
 * Rangée de la série + une rangée d'extras par saison QUI EN A
 * (`seasonHasExtras` : compteurs et bandes-annonces servis avec les saisons —
 * interroger chaque saison coûtait une requête par saison à l'ouverture).
 */
function SeriesExtras({ item, remote }: { item: MediaItem; remote: RichTrailer[] }) {
  const { data: seasons } = useSeasons(item.Id);
  return (
    <>
      <MobileExtrasRow owner={item} remoteTrailers={remote} />
      {seasons?.filter(seasonHasExtras).map((s) => (
        <MobileExtrasRow key={s.Id} owner={s} title={s.Name} remoteTrailers={s.RemoteTrailers ?? []} />
      ))}
    </>
  );
}
