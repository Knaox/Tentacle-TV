import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useItemTrailer, useRemoteTrailers, useSeasons, type ExtrasOwner } from "@tentacle-tv/api-client";
import { ficheExtrasPlan, type CatalogRow, type MediaItem, type RichTrailer } from "@tentacle-tv/shared";
import { MOBILE_TRAILER_PLATFORM } from "@/trailers/trailerPlatform";

export interface MobileFicheExtras {
  /** Les titres dont les extras LOCAUX entrent dans le carrousel. */
  owners: ExtrasOwner[];
  /** Les vidéos d'avant le catalogue (Jellyfin + TMDB) ; vide avec lui. */
  remote: RichTrailer[];
  /** Les vidéos du catalogue, lues dans l'écran des bandes-annonces. */
  catalog: CatalogRow | null;
  /** Le nom de la saison quand le carrousel ne montre qu'elle. */
  title?: string;
  /** Le carrousel réunit plusieurs saisons : chaque tuile dit la sienne. */
  seasonNames: ReadonlyMap<string, string> | null;
}

/**
 * Le carrousel « Extras » d'une fiche du mobile — UN seul, selon la règle
 * partagée (`ficheExtrasPlan`) : film, série (avec toutes ses saisons),
 * épisode (sa saison, sinon le reste). Le même assemblage que le web
 * (`useFicheExtras`), avec ce que le mobile sait lire (`MOBILE_TRAILER_PLATFORM`).
 */
export function useMobileFicheExtras(item: MediaItem, seriesItem?: MediaItem): MobileFicheExtras {
  const { i18n } = useTranslation();
  const { entries, language } = useItemTrailer(item, i18n.language, MOBILE_TRAILER_PLATFORM);
  const catalog = entries.length > 0;
  const series = item.Type === "Series" ? item : item.Type === "Episode" ? seriesItem : undefined;
  const { data: seasons } = useSeasons(series?.Id);
  // Sans catalogue : les vidéos d'avant du titre porteur (la série d'un épisode).
  const legacy = useRemoteTrailers(catalog ? undefined : series ?? item, i18n.language);
  return useMemo(() => {
    const plan = ficheExtrasPlan({
      type: item.Type, seasonNumber: item.ParentIndexNumber, seasons: seasons ?? [], entries, language, catalog,
    });
    const owners: ExtrasOwner[] = [item, ...(plan.withSeries && series ? [series] : []), ...plan.seasons];
    const seasonRemote = plan.seasons.flatMap((season) => (season.RemoteTrailers as RichTrailer[] | undefined) ?? []);
    const remote = catalog
      ? []
      : plan.seasonOnly ? seasonRemote : [...(item.Type === "Episode" && !plan.withSeries ? [] : legacy), ...seasonRemote];
    const mixed = !plan.seasonOnly && (item.Type === "Series" || item.Type === "Episode");
    const seasonNames = mixed ? new Map(plan.seasons.map((season) => [season.Id, season.Name ?? ""])) : null;
    return { owners, remote, catalog: plan.catalog, title: plan.seasonOnly?.Name ?? undefined, seasonNames };
  }, [item, series, seasons, entries, language, catalog, legacy]);
}
