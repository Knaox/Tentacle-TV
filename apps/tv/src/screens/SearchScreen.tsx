import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Text, TVFocusGuideView, View, useWindowDimensions } from "react-native";
import type { View as RNView } from "react-native";
import { useTranslation } from "react-i18next";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSearchDiscover, useSearchEpisodes, useTentacleSearch } from "@tentacle-tv/api-client";
import {
  completionFor, foldForSearch, inlineCompletion, suggestionsFrom,
  type SearchPersonHit, type SearchTopHit,
} from "@tentacle-tv/shared";
import { tvSearchNotice, tvSearchSections, type TvSearchFacet } from "@tentacle-tv/tv-core";
import { TV_OVERSCAN_PT } from "@tentacle-tv/theme";
import type { RootStackParamList } from "../navigation/types";
import { TVSearchKeyboard, KEYBOARD_WIDTH } from "../components/TVSearchKeyboard";
import { TVSearchBar } from "../components/search/TVSearchBar";
import { TVSearchSuggestions, type TVSearchSuggestion } from "../components/search/TVSearchSuggestions";
import { TVSearchResults, type TVSearchResultsActions } from "../components/search/TVSearchResults";
import { TVSearchIdle } from "../components/search/TVSearchIdle";
import { SkeletonRow } from "../components/SkeletonLoader";
import { useTVRemote } from "../components/focus/useTVRemote";
import { useTVContentEntry } from "../hooks/useTVContentEntry";
import { TVScreenFrame } from "../components/nav/TVScreenFrame";
import { RAIL_COLLAPSED } from "../components/nav/TVSideRail";
import { pushRecentSearch, readRecentSearches } from "../storage/recentSearches";
import { Colors, Typography } from "../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "Search">;

/** La colonne de saisie : clavier, et une marge avant les résultats. */
const LEFT_COLUMN = KEYBOARD_WIDTH + 40;
/** Le moteur répond en quelques millisecondes : on n'attend que la frappe. */
const DEBOUNCE_MS = 150;
const RESULTS_LIMIT = 12;

/**
 * La recherche des téléviseurs natifs, sur le moteur de Tentacle.
 *
 * À gauche la saisie — barre (complétion grisée du meilleur résultat), clavier,
 * suggestions qu'un appui reprend ; à droite les résultats en rangées, dans
 * l'ordre commun aux trois téléviseurs (`tvSearchSections`, tv-core). La
 * bibliothèque seule : rien d'extérieur n'est interrogé ici.
 */
export function SearchScreen({ navigation }: Props) {
  const { t } = useTranslation(["search", "nav"]);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [recents, setRecents] = useState<string[]>(() => readRecentSearches());
  const { width: windowW } = useWindowDimensions();
  const resultsWidth = windowW - RAIL_COLLAPSED - TV_OVERSCAN_PT.x - LEFT_COLUMN;

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const search = useTentacleSearch(debounced, { limit: RESULTS_LIMIT });
  const episodes = useSearchEpisodes(debounced, { limit: RESULTS_LIMIT });
  const discover = useSearchDiscover(true);
  const data = search.data;
  // La réponse affichée peut être celle d'une frappe précédente (données
  // gardées pendant la requête suivante) : elle reste lisible, atténuée.
  const current = data !== undefined && foldForSearch(data.query) === foldForSearch(debounced);

  const sections = useMemo(
    () => tvSearchSections(data, episodes.data?.episodes ?? []),
    [data, episodes.data],
  );
  const notice = useMemo(() => tvSearchNotice(data), [data]);

  // La complétion suit la saisie brute ; les suggestions, la réponse du moteur.
  const model = useMemo(() => suggestionsFrom(query, data, { correction: false }), [query, data]);
  const completion = query.trim() ? completionFor(query, model) : null;
  const suggestions = useMemo<TVSearchSuggestion[]>(() => {
    if (!query.trim()) return [];
    const list: TVSearchSuggestion[] = [];
    if (completion) {
      const names = model.lead !== null
        ? [model.lead]
        : [...model.best.map((h) => h.item.Name), ...model.people.map((p) => p.name)];
      const full = names.find((name) => inlineCompletion(query, name) !== null);
      if (full) list.push({ query: full, kind: "complete" });
    }
    for (const q of model.queries) list.push({ query: q, kind: "query" });
    return list.slice(0, 5);
  }, [query, completion, model]);

  useTVRemote({ onBack: () => navigation.goBack() });

  // Sélection « Rechercher » au rail → focus sur la 1ʳᵉ touche du clavier.
  const contentEntry = useTVContentEntry();
  const firstKey = useRef<RNView | null>(null);
  const setEntry = useCallback((node: RNView | null) => {
    firstKey.current = node;
    contentEntry(node);
  }, [contentEntry]);
  const refocusKeyboard = useCallback(() => {
    // tvOS : seule une re-saisie false→true de la préférence agit (react-native-tvos #849).
    const node = firstKey.current as { setNativeProps?: (p: object) => void } | null;
    node?.setNativeProps?.({ hasTVPreferredFocus: false });
    setTimeout(() => node?.setNativeProps?.({ hasTVPreferredFocus: true }), 50);
  }, []);

  const onKeyPress = useCallback((key: string) => setQuery((q) => q + key), []);
  const onDelete = useCallback(() => setQuery((q) => q.slice(0, -1)), []);
  const onClear = useCallback(() => setQuery(""), []);

  // Mémorisée à la SÉLECTION d'un résultat, pas à la frappe (parité LG) : une
  // requête abandonnée en route n'a rien donné, la ressortir serait un mauvais conseil.
  const remember = useCallback(() => {
    if (debounced.length >= 2) setRecents(pushRecentSearch(debounced));
  }, [debounced]);

  const actions = useMemo<TVSearchResultsActions>(() => ({
    onOpenItem: (itemId: string) => {
      remember();
      navigation.navigate("MediaDetail", { itemId });
    },
    onOpenTop: (top: SearchTopHit) => {
      remember();
      if (top.kind === "person") {
        navigation.navigate("SearchBrowse", { kind: "person", id: top.hit.id, name: top.hit.name });
      } else {
        navigation.navigate("MediaDetail", { itemId: top.hit.item.Id });
      }
    },
    onOpenPerson: (person: SearchPersonHit) => {
      remember();
      navigation.navigate("SearchBrowse", { kind: "person", id: person.id, name: person.name });
    },
    onOpenFacet: (facet: TvSearchFacet) => {
      remember();
      navigation.navigate("SearchBrowse", { kind: facet.kind, name: facet.name });
    },
  }), [navigation, remember]);

  const openGenre = useCallback((name: string) => {
    navigation.navigate("SearchBrowse", { kind: "genre", name });
  }, [navigation]);

  const idle = debounced.length === 0;
  const loading = !idle && data === undefined && search.isFetching;
  const empty = !idle && current && !search.isFetching && sections.length === 0;

  return (
    <TVScreenFrame>
      <View style={{ flex: 1, flexDirection: "row", backgroundColor: Colors.bgDeep }}>
        {/* autoFocus : revenir des résultats rend la DERNIÈRE touche utilisée,
            pas la première — on continue d'écrire là où on s'était arrêté. */}
        <TVFocusGuideView autoFocus style={{ width: LEFT_COLUMN, paddingTop: 8 }}>
          <Text style={{ color: Colors.textPrimary, ...Typography.sectionTitle, marginBottom: 16 }}>
            {t("nav:search")}
          </Text>
          <TVSearchBar
            width={KEYBOARD_WIDTH}
            query={query}
            completion={completion}
            onSetQuery={setQuery}
            onSystemKeyboardClosed={refocusKeyboard}
          />
          <View style={{ height: 16 }} />
          <TVSearchKeyboard
            entryRef={setEntry}
            onKeyPress={onKeyPress}
            onDelete={onDelete}
            onClear={onClear}
            onVoiceResult={setQuery}
          />
          <TVSearchSuggestions width={KEYBOARD_WIDTH} suggestions={suggestions} onPick={setQuery} />
        </TVFocusGuideView>

        {/* autoFocus : entrer dans les résultats depuis le clavier mène au
            PREMIER résultat (le meilleur), puis au dernier visité — jamais à la
            carte que la géométrie trouve en face de la touche quittée. */}
        <TVFocusGuideView autoFocus style={{ width: resultsWidth }}>
          {idle || empty ? (
            <TVSearchIdle
              mode={idle ? "idle" : "empty"}
              query={debounced}
              recents={recents}
              genres={discover.data?.genres ?? []}
              onPickQuery={setQuery}
              onOpenGenre={openGenre}
            />
          ) : loading ? (
            <View style={{ paddingTop: 24 }}>
              <SkeletonRow />
              <SkeletonRow />
            </View>
          ) : (
            <View style={{ flex: 1, opacity: current ? 1 : 0.55 }}>
              <TVSearchResults width={resultsWidth} sections={sections} notice={notice} actions={actions} />
            </View>
          )}
        </TVFocusGuideView>
      </View>
    </TVScreenFrame>
  );
}
