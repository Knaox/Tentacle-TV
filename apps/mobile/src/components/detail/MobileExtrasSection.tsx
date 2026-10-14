import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useItemExtras, useItemTrailer, useRemoteTrailers, useSeasons } from "@tentacle-tv/api-client";
import {
  catalogEntriesByScope, catalogRowFor, seasonHasExtras, seasonScopeKey,
  type CatalogScopes, type MediaItem, type RichTrailer,
} from "@tentacle-tv/shared";
import { MOBILE_TRAILER_PLATFORM } from "@/trailers/trailerPlatform";
import { MobileExtrasCarousel, type ExtrasCatalogOwner, type ExtrasSegmentProps } from "./MobileExtrasCarousel";

type Segment = ExtrasSegmentProps & { key: string };

/**
 * Section « Extras » (mobile) : UN carrousel par fiche, jamais des rangées
 * empilées (décision de Damien, 2026-10-14).
 *  - Film : ses bandes-annonces locales, bonus, puis vidéos en ligne.
 *  - Série : les siens, puis ceux de chaque saison qui en a, dans l'ordre —
 *    réunis, le nom de la saison devant chaque tuile.
 *  - Épisode : les extras de SA saison s'il y en a ; sinon les autres (les
 *    siens, ceux de la série, ceux des autres saisons).
 * Avec le catalogue du serveur (`trailers.catalog`), ses vidéos nourrissent
 * chaque source portée par portée (`catalogExtras`, shared) — AlloCiné
 * compris — et s'ouvrent dans l'écran des bandes-annonces sur le catalogue de
 * la fiche. Sans lui, les vidéos YouTube d'avant. Rien à montrer : rien.
 */
export function MobileExtrasSection({ item, seriesItem }: { item: MediaItem; seriesItem?: MediaItem }) {
  const { i18n } = useTranslation();
  const { entries, language } = useItemTrailer(item, i18n.language, MOBILE_TRAILER_PLATFORM);
  const scopes = useMemo(() => (entries.length > 0 ? catalogEntriesByScope(entries, language) : null), [entries, language]);
  const remote = useRemoteTrailers(scopes ? undefined : item, i18n.language);
  const { local } = useItemExtras(item);
  // Le catalogue que l'écran rejouera : celui de la fiche ouverte (la même requête, déjà en cache).
  const fiche: ExtrasCatalogOwner = { itemId: item.Id, itemType: item.Type };
  const own: Segment = {
    key: item.Id,
    owner: item,
    remoteTrailers: scopes ? [] : remote,
    catalog: catalogRowFor(scopes, item.Type === "Movie" ? "movie" : "series"),
    fiche,
  };
  const ownHasExtras = local.length > 0 || own.remoteTrailers.length > 0 || !!own.catalog;

  if (item.Type === "Series") return <SeriesExtras series={item} own={ownHasExtras ? own : null} scopes={scopes} fiche={fiche} />;
  if (item.Type === "Episode" && seriesItem) {
    // Les extras d'un épisode lui-même sont rares : ils vont avec les « autres ».
    const episode: Segment = { key: item.Id, owner: item, remoteTrailers: scopes ? [] : remote, fiche };
    return (
      <SeriesExtras
        series={seriesItem}
        own={null}
        scopes={scopes}
        fiche={fiche}
        currentSeason={item.ParentIndexNumber ?? null}
        episode={local.length > 0 || episode.remoteTrailers.length > 0 ? episode : null}
      />
    );
  }
  return <MobileExtrasCarousel segments={ownHasExtras ? [own] : []} />;
}

interface SeriesProps {
  series: MediaItem;
  /** Les extras de la fiche série elle-même, quand elle en a. */
  own: Segment | null;
  scopes: CatalogScopes | null;
  fiche: ExtrasCatalogOwner;
  /** La fiche est un épisode de cette saison. */
  currentSeason?: number | null;
  /** Les extras de l'épisode lui-même, quand il en a. */
  episode?: Segment | null;
}

/**
 * Le carrousel d'une série (ou d'un épisode) : les saisons QUI ONT des
 * extras (`seasonHasExtras` : compteurs et bandes-annonces servis avec les
 * saisons — interroger chaque saison coûtait une requête par saison), ou que
 * le catalogue garnit.
 */
function SeriesExtras({ series, own, scopes, fiche, currentSeason, episode = null }: SeriesProps) {
  const { i18n } = useTranslation();
  const { data: seasons } = useSeasons(series.Id);
  const forEpisode = currentSeason !== undefined;
  // Les vidéos de la série, demandées depuis un épisode (la fiche série les a déjà).
  const seriesRemote = useRemoteTrailers(forEpisode && !scopes ? series : undefined, i18n.language);
  const { local: seriesLocal } = useItemExtras(forEpisode ? series : undefined);

  const shown = (seasons ?? []).filter((s) => {
    const key = seasonScopeKey(s.IndexNumber);
    return seasonHasExtras(s) || (key !== null && catalogRowFor(scopes, key) !== null);
  });
  const segmentOf = (s: MediaItem, labelled: boolean): Segment => {
    const key = seasonScopeKey(s.IndexNumber);
    return {
      key: s.Id,
      owner: s,
      remoteTrailers: scopes ? [] : (s.RemoteTrailers as RichTrailer[] | undefined) ?? [],
      catalog: key ? catalogRowFor(scopes, key) : null,
      fiche,
      label: labelled ? s.Name : undefined,
    };
  };

  if (!forEpisode) {
    return <MobileExtrasCarousel segments={[...(own ? [own] : []), ...shown.map((s) => segmentOf(s, true))]} />;
  }
  // Un épisode : sa saison seule, si elle a des extras ; sinon les autres.
  const current = currentSeason != null ? shown.find((s) => s.IndexNumber === currentSeason) : undefined;
  if (current) return <MobileExtrasCarousel segments={[segmentOf(current, false)]} />;
  const seriesSegment: Segment = {
    key: series.Id,
    owner: series,
    remoteTrailers: scopes ? [] : seriesRemote,
    catalog: catalogRowFor(scopes, "series"),
    fiche,
  };
  const seriesHas = seriesLocal.length > 0 || seriesSegment.remoteTrailers.length > 0 || !!seriesSegment.catalog;
  return (
    <MobileExtrasCarousel
      segments={[...(episode ? [episode] : []), ...(seriesHas ? [seriesSegment] : []), ...shown.map((s) => segmentOf(s, true))]}
    />
  );
}
