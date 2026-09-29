import { useCallback, useMemo, useRef, type ComponentProps } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import { useTranslation } from "react-i18next";
import { useItemExtras, useRemoteTrailers, useSeasons, type ExtrasOwner } from "@tentacle-tv/api-client";
import {
  buildExtraEntries,
  seasonHasExtras,
  sortTrailersByLang,
  type ExtraEntry,
  type MediaItem,
  type RichTrailer,
} from "@tentacle-tv/shared";
import { TVExtrasRow } from "./TVExtrasRow";
import { Spacing } from "../../theme/colors";

interface TVExtrasSectionProps {
  item: MediaItem;
  /** La série d'un épisode : ses extras suivent ceux de l'épisode, comme sur le web. */
  parentSeries?: MediaItem;
  onOpen: (entry: ExtraEntry) => void;
  /** Une rangée prend le focus : son ordonnée DANS LA PAGE, pour l'y ancrer. */
  onFocusY: (y: number) => void;
  /** HAUT depuis la première rangée affichée → ce focusable (Lecture). */
  firstNextFocusUp?: number;
}

const NO_TRAILERS: RichTrailer[] = [];

/** Les tuiles d'une rangée : extras locaux du titre, puis vidéos distantes triées par langue. */
function useExtraEntries(owner: ExtrasOwner | undefined, remote: RichTrailer[]): ExtraEntry[] {
  const { t, i18n } = useTranslation("common");
  const { local } = useItemExtras(owner);
  return useMemo(
    () => (owner ? buildExtraEntries(t, local, sortTrailersByLang(remote, i18n.language)) : []),
    [owner, t, local, remote, i18n.language],
  );
}

/**
 * Les extras de la fiche TV — même découpage que le web et le mobile : la
 * rangée du titre (bandes-annonces locales, bonus, vidéos distantes), celle de
 * sa série pour un épisode, puis une rangée par saison qui EN A (compteurs de
 * la liste des saisons : aucune requête vide). Jusqu'ici la TV ne montrait que
 * les vidéos YouTube du titre : ni bande-annonce locale, ni bonus.
 *
 * Seule la PREMIÈRE rangée affichée renvoie HAUT vers Lecture : l'ancrage de
 * page sort les actions de l'écran ; depuis les suivantes, HAUT reste la
 * rangée du dessus, que la géométrie trouve.
 */
export function TVExtrasSection({ item, parentSeries, onOpen, onFocusY, firstNextFocusUp }: TVExtrasSectionProps) {
  const { t, i18n } = useTranslation("common");
  const isEpisode = item.Type === "Episode";
  const seriesOfEpisode = isEpisode ? parentSeries : undefined;
  const series = item.Type === "Series" ? item : seriesOfEpisode;

  const itemRemote = useRemoteTrailers(item, i18n.language);
  const itemEntries = useExtraEntries(item, itemRemote);
  const seriesRemote = useRemoteTrailers(seriesOfEpisode, i18n.language);
  const seriesEntries = useExtraEntries(seriesOfEpisode, seriesOfEpisode ? seriesRemote : NO_TRAILERS);
  const { data: seasons } = useSeasons(series?.Id);
  const withExtras = useMemo(() => seasons?.filter(seasonHasExtras) ?? [], [seasons]);

  const sectionY = useRef(0);
  const rowY = useRef(new Map<string, number>());
  const onRowLayout = useCallback((key: string) => (e: LayoutChangeEvent) => {
    rowY.current.set(key, e.nativeEvent.layout.y);
  }, []);
  const onRowFocus = useCallback((key: string) => () => {
    onFocusY(sectionY.current + (rowY.current.get(key) ?? 0));
  }, [onFocusY]);

  const first = itemEntries.length > 0 ? "item" : seriesEntries.length > 0 ? "series" : withExtras[0]?.Id;
  const rowProps = (key: string) => ({
    onSelect: onOpen,
    style: { marginTop: Spacing.sectionGap },
    onLayout: onRowLayout(key),
    onRowFocus: onRowFocus(key),
    tilesNextFocusUp: first === key ? firstNextFocusUp : undefined,
  });

  return (
    <View onLayout={(e) => { sectionY.current = e.nativeEvent.layout.y; }}>
      <TVExtrasRow title={t("extras")} entries={itemEntries} {...rowProps("item")} />
      {seriesOfEpisode && (
        <TVExtrasRow title={`${t("extras")} — ${seriesOfEpisode.Name}`} entries={seriesEntries} {...rowProps("series")} />
      )}
      {withExtras.map((season) => (
        <TVSeasonExtrasRow key={season.Id} season={season} title={`${t("extras")} — ${season.Name}`} rowProps={rowProps(season.Id)} />
      ))}
    </View>
  );
}

function TVSeasonExtrasRow({ season, title, rowProps }: {
  season: MediaItem;
  title: string;
  rowProps: Omit<ComponentProps<typeof TVExtrasRow>, "entries" | "title">;
}) {
  const entries = useExtraEntries(season, season.RemoteTrailers ?? NO_TRAILERS);
  return <TVExtrasRow title={title} entries={entries} {...rowProps} />;
}
