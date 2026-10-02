import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useJellyfinClient, useSeasons, useTitleGaps } from "@tentacle-tv/api-client";
import { seriesTitleKey, type MediaItem, type TitleKey } from "@tentacle-tv/shared";
import { seasonTitle } from "@tentacle-tv/tv-core";
import type { MissingSeasonTabModel } from "../../redesign/screens/detail/detailTypes";
import type { TitleRequests } from "./useTitleRequests";

/**
 * Les saisons MANQUANTES d'une série, sur sa fiche (garde Vigie ouverte) : au
 * bout de la bande des saisons, un onglet GRISÉ par saison que l'extension
 * connaît et que la bibliothèque n'a pas (`titles.gaps`) — un « + » quand
 * elle se demande, une horloge quand elle l'est déjà. OK ouvre la feuille des
 * saisons sur elle, déjà cochée.
 *
 * Une question pour la fiche, et rien pour une série complète : l'extension
 * répond de sa mémoire. Les saisons de la bibliothèque sont celles de la bande
 * (`useSeasons`, même clé, aucune requête de plus) ; tant qu'elles ne sont pas
 * lues, aucun onglet grisé — jamais une saison qu'on a, offerte un instant.
 */

export interface SeriesGapTabs {
  /** Les onglets grisés ; absent : rien à demander (ou garde fermée). */
  missing: MissingSeasonTabModel[] | undefined;
  /** OK sur un onglet grisé. */
  onRequestSeason: (number: number) => void;
}

const NO_KEYS: TitleKey[] = [];

export function useSeriesGapTabs(requests: TitleRequests | null, item: MediaItem | undefined): SeriesGapTabs {
  const { t } = useTranslation();
  const client = useJellyfinClient();
  const gate = requests?.gate ?? null;
  const series = item?.Type === "Series" ? item : undefined;
  const key = series ? seriesTitleKey(series) : null;
  const keys = useMemo(() => (key ? [key] : NO_KEYS), [key]);
  const open = gate !== null && gate.provider.seasonsPath !== null && key !== null;
  const gaps = useTitleGaps(gate?.provider ?? null, keys, gate?.lang ?? "fr", { enabled: open });
  const { data: seasons } = useSeasons(open ? series?.Id : undefined);

  const missing = useMemo<MissingSeasonTabModel[] | undefined>(() => {
    const list = key && gaps ? gaps.get(key) : undefined;
    if (!list || !seasons) return undefined;
    // Toute saison qui a déjà son onglet — même sans fichier — n'en a pas un second.
    const tabs = new Set(seasons.map((season) => season.IndexNumber).filter((n): n is number => typeof n === "number"));
    const out = list
      .filter((season) => !tabs.has(season.number))
      .map((season) => ({
        number: season.number,
        label: seasonTitle(t, season.number, season.name),
        requestable: season.requestable,
        status: season.requestable ? t("requests:seasonToRequest") : season.badge?.label ?? "",
      }));
    return out.length > 0 ? out : undefined;
  }, [key, gaps, seasons, t]);

  const openSeasons = requests?.openSeasons;
  const onRequestSeason = useCallback((number: number) => {
    if (!openSeasons || !series || !key) return;
    // L'affiche de la bibliothèque : celle que montrent aussitôt les demandes du compte.
    const tag = series.ImageTags?.Primary;
    const imageUrl = tag ? client.getImageUrl(series.Id, "Primary", { width: 342, quality: 85, tag }) : null;
    openSeasons(
      { key, title: series.Name ?? "", year: series.ProductionYear ?? null, imageUrl },
      { seriesId: series.Id, focus: number },
    );
  }, [openSeasons, series, key, client]);

  return { missing, onRequestSeason };
}
