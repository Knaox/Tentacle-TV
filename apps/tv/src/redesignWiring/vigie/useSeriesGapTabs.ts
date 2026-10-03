import { useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useIsFocused } from "@react-navigation/native";
import { useJellyfinClient, useMyTitles, useSeasons, useTitleGaps } from "@tentacle-tv/api-client";
import { MY_TITLE_STATE_KEYS, seriesTitleKey, type MediaItem, type TitleKey } from "@tentacle-tv/shared";
import { gapTabPress, isAdvancing, seasonTitle } from "@tentacle-tv/tv-core";
import type { MissingSeasonTabModel } from "../../redesign/screens/detail/detailTypes";
import { showNotice } from "../overlays/transientNotice";
import { arrivalOf, type ArrivalReading } from "./arrivalModels";
import { useLiveRefresh } from "./liveRequests";
import { useAppActive } from "./useAppActive";
import type { TitleRequests } from "./useTitleRequests";

/**
 * Les saisons MANQUANTES d'une série, sur sa fiche (garde Vigie ouverte) : au
 * bout de la bande des saisons, un onglet GRISÉ par saison que l'extension
 * connaît et que la bibliothèque n'a pas (`titles.gaps`) — un « + » quand
 * elle se demande, une horloge quand elle l'est déjà.
 *
 * OK sur un « + » DEMANDE cette saison, sans feuille (`requestSeasons`, avec
 * l'origine de la TV) : l'onglet prend aussitôt son état — « En attente » et
 * son camembert, ceux de la demande du compte qui le couvre (`useMyTitles`,
 * toutes ses demandes), en direct tant qu'elle avance — et le focus reste
 * sur lui. OK sur une saison déjà demandée : son état, et l'invite à la
 * suivre sur le téléphone.
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
  const { titles: mine, updatedAt } = useMyTitles(gate?.provider ?? null, gate?.lang ?? "fr", { enabled: open });
  const own = key ? mine?.find((title) => title.key === key) : undefined;
  const screenFocused = useIsFocused();
  const appActive = useAppActive();
  const visible = open && screenFocused && appActive;
  useLiveRefresh(gate, visible && own !== undefined && isAdvancing(own.state));
  const reading = useMemo<ArrivalReading>(() => ({ at: updatedAt, live: visible }), [updatedAt, visible]);

  const missing = useMemo<MissingSeasonTabModel[] | undefined>(() => {
    const list = key && gaps ? gaps.get(key) : undefined;
    if (!list || !seasons) return undefined;
    // Toute saison qui a déjà son onglet — même sans fichier — n'en a pas un second.
    const tabs = new Set(seasons.map((season) => season.IndexNumber).filter((n): n is number => typeof n === "number"));
    const out = list
      .filter((season) => !tabs.has(season.number))
      .map((season): MissingSeasonTabModel => {
        const covered = own !== undefined && (own.seasons === null || own.seasons.includes(season.number));
        const ownLabel = own ? t(MY_TITLE_STATE_KEYS[own.state]) : "";
        return {
          number: season.number,
          label: seasonTitle(t, season.number, season.name),
          requestable: season.requestable && !covered,
          status: covered ? ownLabel : season.requestable ? t("requests:seasonToRequest") : season.badge?.label ?? "",
          ...(covered && own ? { request: { arrival: arrivalOf(own, reading), label: ownLabel } } : {}),
        };
      });
    return out.length > 0 ? out : undefined;
  }, [key, gaps, seasons, own, reading, t]);

  const latest = useRef(missing);
  latest.current = missing;
  const requestSeasons = requests?.requestSeasons;
  const onRequestSeason = useCallback((number: number) => {
    const tab = latest.current?.find((season) => season.number === number);
    if (!tab || !requestSeasons || !series || !key) return;
    if (gapTabPress(tab) === "noticeState") {
      showNotice({ kind: "info", title: tab.status || t("requests:statePending"), text: t("requests:followOnPhone") });
      return;
    }
    // L'affiche de la bibliothèque : celle que montrent aussitôt les demandes du compte.
    const tag = series.ImageTags?.Primary;
    const imageUrl = tag ? client.getImageUrl(series.Id, "Primary", { width: 342, quality: 85, tag }) : null;
    requestSeasons({ key, title: series.Name ?? "", year: series.ProductionYear ?? null, imageUrl }, [number]);
  }, [requestSeasons, series, key, client, t]);

  return { missing, onRequestSeason };
}
