import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import type { ExternalSearchState } from "@tentacle-tv/api-client";
import {
  foldForSearch,
  type ExternalSearchItem,
  type SearchItemHit,
  type SearchMediaItem,
  type SearchPersonHit,
  type SearchProvider,
  type SearchResponse,
} from "@tentacle-tv/shared";
import { MobileMediaCard } from "@/components/MobileMediaCard";
import { FONT_FAMILY, RADIUS, spacing, useGrid, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { EpisodeList } from "./SearchEpisodes";
import { ExternalSections } from "./SearchExternal";
import type { SearchFilter } from "./SearchFilters";
import { FacetChips, PeopleRail } from "./SearchPeople";
import { PosterRail, Section, asMediaItem } from "./SearchSection";
import { TopResultCard } from "./TopResultCard";

export interface SearchActions {
  openItem: (id: string) => void;
  playItem: (id: string) => void;
  openPerson: (person: SearchPersonHit) => void;
  openFacet: (kind: "genre" | "studio", name: string) => void;
  openExternalItem: (provider: SearchProvider, item: ExternalSearchItem) => void;
  openExternal: (provider: SearchProvider, href: string) => void;
}

interface Props {
  query: string;
  response: SearchResponse | undefined;
  episodes: SearchMediaItem[];
  external: ExternalSearchState;
  filter: SearchFilter;
  onFilter: (filter: SearchFilter) => void;
  /** Relancer avec la bonne orthographe proposée. */
  onRetry: (query: string) => void;
  actions: SearchActions;
}

const PREVIEW = 10;

/**
 * Les résultats — ce que le moteur du serveur répond à chaque lettre. « Tout »
 * : le meilleur résultat, puis un aperçu de chaque catégorie en rail (« Tout
 * voir » ouvre le filtre), les personnes, les épisodes, les genres et studios,
 * et ce que les extensions trouvent hors de la bibliothèque. Un filtre : la
 * catégorie entière, en grille. Une faute corrigée se dit ; rien trouvé
 * propose la bonne orthographe au lieu d'une impasse.
 */
export const SearchResults = memo(function SearchResults({ query, response, episodes, external, filter, onFilter, onRetry, actions }: Props) {
  const { t } = useTranslation("search");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const { itemWidth, gutter, padding } = useGrid({ phoneColumns: 3, gutter: 12 });

  const r = response;
  const noLibrary = !!r && r.top === null && r.movies.length === 0 && r.series.length === 0
    && r.collections.length === 0 && r.people.length === 0 && episodes.length === 0;
  // Une correction qui ne change rien une fois pliée n'est pas une correction.
  const correction = r?.correction && foldForSearch(r.correction) !== foldForSearch(query) ? r.correction : null;

  const grid = (hits: SearchItemHit[]) => (
    <View style={[st.grid, { paddingHorizontal: padding, gap: gutter }]}>
      {hits.map((hit) => (
        <View key={hit.item.Id} style={{ width: itemWidth }}>
          <MobileMediaCard item={asMediaItem(hit.item)} width={itemWidth} onPress={() => actions.openItem(hit.item.Id)} />
        </View>
      ))}
    </View>
  );

  return (
    <View style={st.root}>
      {r && !r.ready && <Notice icon="loader" text={t("indexing")} />}
      {correction && !noLibrary && (
        <Notice icon="edit-3" text={`${t("resultsFor")} « ${correction} »`} />
      )}
      {r?.partial && !noLibrary && <Notice icon="info" text={t("partial")} />}

      {noLibrary && (
        <View style={st.empty}>
          <Text style={st.emptyTitle}>{t("noResults", { query })}</Text>
          <Text style={st.emptyHint}>{t("noResultsHint")}</Text>
          {correction && (
            <Pressable onPress={() => onRetry(correction)} accessibilityRole="button" style={({ pressed }) => [st.retry, pressed && st.pressed]}>
              <Feather name="corner-down-right" size={15} color={theme.colors.brand.light} />
              <Text style={st.retryTxt}>{`${t("resultsFor")} « ${correction} »`}</Text>
            </Pressable>
          )}
        </View>
      )}

      {r && filter === "all" && (
        <>
          {r.top && <TopResultCard top={r.top} onOpen={actions.openItem} onPlay={actions.playItem} onPerson={actions.openPerson} />}
          {r.movies.length > 0 && (
            <Section title={t("movies")} count={r.totals.movies} onSeeAll={r.totals.movies > PREVIEW ? () => onFilter("movies") : undefined}>
              <PosterRail hits={r.movies.slice(0, PREVIEW)} onOpen={actions.openItem} />
            </Section>
          )}
          {r.series.length > 0 && (
            <Section title={t("series")} count={r.totals.series} onSeeAll={r.totals.series > PREVIEW ? () => onFilter("series") : undefined}>
              <PosterRail hits={r.series.slice(0, PREVIEW)} onOpen={actions.openItem} />
            </Section>
          )}
          {r.people.length > 0 && (
            <Section title={t("people")} count={r.totals.people}>
              <PeopleRail people={r.people} onOpen={actions.openPerson} />
            </Section>
          )}
          {episodes.length > 0 && (
            <Section title={t("episodes")} onSeeAll={episodes.length > 4 ? () => onFilter("episodes") : undefined}>
              <EpisodeList episodes={episodes.slice(0, 4)} onOpen={actions.openItem} />
            </Section>
          )}
          {r.collections.length > 0 && (
            <Section title={t("collections")} count={r.totals.collections}>
              <PosterRail hits={r.collections.slice(0, PREVIEW)} onOpen={actions.openItem} />
            </Section>
          )}
          {(r.genres.length > 0 || r.studios.length > 0) && (
            <Section title={t("facets")}>
              <FacetChips genres={r.genres} studios={r.studios} onOpen={actions.openFacet} />
            </Section>
          )}
        </>
      )}

      {r && filter === "movies" && <Section title={t("movies")} count={r.totals.movies}>{grid(r.movies)}</Section>}
      {r && filter === "series" && <Section title={t("series")} count={r.totals.series}>{grid(r.series)}</Section>}
      {r && filter === "collections" && <Section title={t("collections")} count={r.totals.collections}>{grid(r.collections)}</Section>}
      {r && filter === "people" && (
        <Section title={t("people")} count={r.totals.people}>
          <PeopleRail people={r.people} onOpen={actions.openPerson} />
        </Section>
      )}
      {filter === "episodes" && <Section title={t("episodes")}><EpisodeList episodes={episodes} onOpen={actions.openItem} /></Section>}

      {(filter === "all" || noLibrary) && external.results.length > 0 && (
        <ExternalSections results={external.results} onOpen={actions.openExternalItem} onSeeAll={actions.openExternal} />
      )}
      {(filter === "all" || noLibrary) && external.pending && external.results.length === 0 && (
        <Notice icon="globe" text={t("externalSearching")} />
      )}
    </View>
  );
});

/** Une ligne d'information discrète, au-dessus des résultats. */
function Notice({ icon, text }: { icon: "loader" | "edit-3" | "info" | "globe"; text: string }) {
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  return (
    <View style={st.notice} accessibilityRole="text">
      <Feather name={icon} size={14} color={theme.colors.text.tertiary} />
      <Text style={st.noticeTxt}>{text}</Text>
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    root: { paddingBottom: spacing.xl },
    grid: { flexDirection: "row" as const, flexWrap: "wrap" as const },
    notice: { flexDirection: "row" as const, alignItems: "center" as const, gap: 8, paddingHorizontal: spacing.screenPadding, marginTop: spacing.md },
    noticeTxt: { flex: 1, fontSize: 13, fontFamily: FONT_FAMILY.medium, color: t.colors.text.tertiary },
    empty: { paddingHorizontal: spacing.screenPadding, paddingTop: spacing.xl, alignItems: "flex-start" as const, gap: 6 },
    emptyTitle: { fontSize: 18, fontFamily: FONT_FAMILY.bold, color: t.colors.text.primary },
    emptyHint: { fontSize: 14, lineHeight: 20, fontFamily: FONT_FAMILY.regular, color: t.colors.text.tertiary },
    retry: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 8,
      marginTop: spacing.sm,
      minHeight: 40,
      paddingHorizontal: 14,
      borderRadius: RADIUS.pill,
      backgroundColor: t.colors.brand.soft,
      borderWidth: 1,
      borderColor: t.colors.brand.glow,
    },
    retryTxt: { fontSize: 14, fontFamily: FONT_FAMILY.semibold, color: t.colors.brand.light },
    pressed: { opacity: 0.7 },
  });
