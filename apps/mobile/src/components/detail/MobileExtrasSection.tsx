import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useItemTrailer, useRemoteTrailers, useSeasons } from "@tentacle-tv/api-client";
import {
  catalogEntriesByScope, catalogRowFor, seasonHasExtras, seasonScopeKey,
  type CatalogScopes, type MediaItem, type RichTrailer,
} from "@tentacle-tv/shared";
import { MOBILE_TRAILER_PLATFORM } from "@/trailers/trailerPlatform";
import { MobileExtrasRow, type ExtrasCatalogOwner } from "./MobileExtrasRow";

/**
 * Section « Extras » (mobile) — parité desktop et miroir :
 *  - Film : bandes-annonces locales, bonus, puis vidéos en ligne.
 *  - Série : sa rangée à elle + une rangée par saison qui a des extras.
 *  - Épisode : extras de l'épisode, puis ceux de SA saison, de la série et
 *    des autres saisons.
 * Avec le catalogue du serveur (`trailers.catalog`), ses vidéos nourrissent
 * les rangées, portée par portée (`catalogExtras`, shared) — AlloCiné compris
 * —, et s'ouvrent dans l'écran des bandes-annonces sur le catalogue de la
 * fiche. Sans lui, les vidéos YouTube d'avant. Chaque rangée se masque si vide.
 */
export function MobileExtrasSection({ item, seriesItem }: { item: MediaItem; seriesItem?: MediaItem }) {
  const { i18n } = useTranslation();
  const { entries, language } = useItemTrailer(item, i18n.language, MOBILE_TRAILER_PLATFORM);
  const scopes = useMemo(() => (entries.length > 0 ? catalogEntriesByScope(entries, language) : null), [entries, language]);
  const remote = useRemoteTrailers(scopes ? undefined : item, i18n.language);
  // Le catalogue que l'écran rejouera : celui de la fiche ouverte (la même requête, déjà en cache).
  const fiche: ExtrasCatalogOwner = { itemId: item.Id, itemType: item.Type };
  if (item.Type === "Series") return <SeriesExtras item={item} remote={remote} scopes={scopes} fiche={fiche} />;
  if (item.Type === "Episode") {
    return (
      <>
        <MobileExtrasRow owner={item} remoteTrailers={scopes ? [] : remote} />
        {seriesItem && <SeriesExtrasAuto item={seriesItem} scopes={scopes} fiche={fiche} currentSeason={item.ParentIndexNumber} />}
      </>
    );
  }
  return <MobileExtrasRow owner={item} remoteTrailers={remote} catalog={catalogRowFor(scopes, "movie")} fiche={fiche} />;
}

interface SeriesProps {
  item: MediaItem;
  scopes: CatalogScopes | null;
  fiche: ExtrasCatalogOwner;
  currentSeason?: number | null;
}

function SeriesExtrasAuto(props: SeriesProps) {
  const { i18n } = useTranslation();
  const remote = useRemoteTrailers(props.scopes ? undefined : props.item, i18n.language);
  return <SeriesExtras {...props} remote={remote} />;
}

/**
 * Rangée de la série + une rangée d'extras par saison QUI EN A
 * (`seasonHasExtras` : compteurs et bandes-annonces servis avec les saisons —
 * interroger chaque saison coûtait une requête par saison à l'ouverture), ou
 * que le catalogue garnit. La saison de l'épisode ouvert passe en tête.
 */
function SeriesExtras({ item, remote, scopes, fiche, currentSeason }: SeriesProps & { remote: RichTrailer[] }) {
  const { data: seasons } = useSeasons(item.Id);
  const shown = (seasons ?? []).filter((s) => {
    const key = seasonScopeKey(s.IndexNumber);
    return seasonHasExtras(s) || (key !== null && catalogRowFor(scopes, key) !== null);
  });
  const current = currentSeason != null ? shown.find((s) => s.IndexNumber === currentSeason) : undefined;
  const seasonRow = (s: MediaItem) => {
    const key = seasonScopeKey(s.IndexNumber);
    return (
      <MobileExtrasRow
        key={s.Id}
        owner={s}
        title={s.Name}
        remoteTrailers={scopes ? [] : s.RemoteTrailers ?? []}
        catalog={key ? catalogRowFor(scopes, key) : null}
        fiche={fiche}
      />
    );
  };
  return (
    <>
      {current && seasonRow(current)}
      <MobileExtrasRow owner={item} remoteTrailers={scopes ? [] : remote} catalog={catalogRowFor(scopes, "series")} fiche={fiche} />
      {shown.filter((s) => s !== current).map(seasonRow)}
    </>
  );
}
