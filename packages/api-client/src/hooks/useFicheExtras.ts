import { useMemo } from "react";
import { ficheExtrasPlan, type CatalogRow, type MediaItem, type RichTrailer } from "@tentacle-tv/shared";
import type { ExtrasOwner } from "./useItemExtras";
import { useItemTrailer, type ItemTrailerOptions } from "./useItemTrailer";
import { useRemoteTrailers } from "./useRemoteTrailers";
import { useSeasons } from "./useSeasons";

export interface FicheExtras {
  /** Les titres dont les extras LOCAUX entrent dans le carrousel. */
  owners: ExtrasOwner[];
  /** Les vidéos d'avant le catalogue (Jellyfin + TMDB) ; vide avec lui. */
  remote: RichTrailer[];
  /** Les vidéos du catalogue (lecteur complet). */
  catalog: CatalogRow | null;
  /** Le nom de la saison quand le carrousel ne montre qu'elle. */
  title?: string;
  /**
   * Le carrousel réunit plusieurs saisons : chaque tuile dit la sienne
   * (`seasonNames` pour les extras locaux, la portée pour le catalogue).
   */
  seasonNames: ReadonlyMap<string, string> | null;
}

/**
 * Le carrousel « Extras » d'une fiche — UN seul (`ficheExtrasPlan`, shared) :
 * film, série (avec toutes ses saisons), épisode (sa saison, sinon le reste).
 * Web, bureau, miroir et mobile : chaque plateforme passe sa langue et ce
 * qu'elle sait lire (`ItemTrailerOptions`) ; le catalogue ne nourrit le
 * carrousel que là où le lecteur complet le lit (Dailymotion compris).
 */
export function useFicheExtras(
  item: MediaItem,
  seriesItem: MediaItem | undefined,
  lang: string | undefined,
  platform: ItemTrailerOptions,
): FicheExtras {
  const { entries, language } = useItemTrailer(item, lang, platform);
  const catalog = platform.playable.includes("dailymotion") && entries.length > 0;
  const series = item.Type === "Series" ? item : item.Type === "Episode" ? seriesItem : undefined;
  const { data: seasons } = useSeasons(series?.Id);
  // Sans catalogue : les vidéos d'avant du titre porteur (la série d'un épisode).
  const legacy = useRemoteTrailers(catalog ? undefined : series ?? item, lang);
  return useMemo(() => {
    const plan = ficheExtrasPlan({
      type: item.Type, seasonNumber: item.ParentIndexNumber, seasons: seasons ?? [], entries, language, catalog,
    });
    const owners: ExtrasOwner[] = [item, ...(plan.withSeries && series ? [series] : []), ...plan.seasons];
    const seasonRemote = plan.seasons.flatMap((season) => season.RemoteTrailers ?? []);
    const remote = catalog
      ? []
      : plan.seasonOnly ? seasonRemote : [...(item.Type === "Episode" && !plan.withSeries ? [] : legacy), ...seasonRemote];
    const mixed = !plan.seasonOnly && (item.Type === "Series" || item.Type === "Episode");
    const seasonNames = mixed ? new Map(plan.seasons.map((season) => [season.Id, season.Name ?? ""])) : null;
    return { owners, remote, catalog: plan.catalog, title: plan.seasonOnly?.Name ?? undefined, seasonNames };
  }, [item, series, seasons, entries, language, catalog, legacy]);
}
