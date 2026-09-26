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
import { searchSubmitAnswer, tvSearchNotice, tvSearchSections, type TvSearchFacet } from "@tentacle-tv/tv-core";
import { TV_OVERSCAN_PT } from "@tentacle-tv/theme";
import type { RootStackParamList } from "../navigation/types";
import { TVSearchKeyboard, KEYBOARD_WIDTH } from "../components/TVSearchKeyboard";
import { TVSearchBar } from "../components/search/TVSearchBar";
import { TVSearchSuggestions, type TVSearchSuggestion } from "../components/search/TVSearchSuggestions";
import { TVSearchResults, type TVSearchResultsActions } from "../components/search/TVSearchResults";
import { TVSearchIdle } from "../components/search/TVSearchIdle";
import { useSearchSubmit } from "../components/search/useSearchSubmit";
import { SkeletonRow } from "../components/SkeletonLoader";
import { useTVRemote } from "../components/focus/useTVRemote";
import { useTVContentEntry } from "../hooks/useTVContentEntry";
import { claimTvFocus } from "../hooks/useTvFocusClaim";
import { registerSearchBar } from "../components/search/searchBarReturn";
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

  // La barre : un bouton sur tvOS, qui ouvre le clavier système ; un simple
  // affichage sur Android TV, où l'on revient donc à la première touche du
  // clavier à l'écran, juste dessous. Le rail y ramène aussi (« Rechercher »).
  const barRef = useRef<RNView | null>(null);
  const focusSearchBar = useCallback(() => {
    const target = barRef.current ?? firstKey.current;
    const cancel = claimTvFocus(target);
    const again = setTimeout(() => claimTvFocus(target), 400);
    return () => {
      cancel();
      clearTimeout(again);
    };
  }, []);
  useEffect(() => registerSearchBar(focusSearchBar), [focusSearchBar]);

  // Revenir d'une étagère — bouton Retour, touche Retour, Menu de la Siri
  // Remote, « Rechercher » au rail — rend la barre, parité LG. Les résultats
  // gardent leur dernière carte (`autoFocus`) : un appui à droite y ramène.
  //
  // À la FIN de la transition, pas au focus de l'écran : sur tvOS, le moteur
  // restaure lui-même la carte quittée une fois le fondu terminé, et une
  // réclamation partie avant était aussitôt défaite — mesuré au simulateur.
  const browsing = useRef(false);
  useEffect(() => navigation.addListener("transitionEnd", (event) => {
    if (event.data.closing || !browsing.current) return;
    browsing.current = false;
    focusSearchBar();
  }), [navigation, focusSearchBar]);
  const openBrowse = useCallback((params: RootStackParamList["SearchBrowse"]) => {
    browsing.current = true;
    navigation.navigate("SearchBrowse", params);
  }, [navigation]);

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
        openBrowse({ kind: "person", id: top.hit.id, name: top.hit.name });
      } else {
        navigation.navigate("MediaDetail", { itemId: top.hit.item.Id });
      }
    },
    onOpenPerson: (person: SearchPersonHit) => {
      remember();
      openBrowse({ kind: "person", id: person.id, name: person.name });
    },
    onOpenFacet: (facet: TvSearchFacet) => {
      remember();
      openBrowse({ kind: facet.kind, name: facet.name });
    },
  }), [navigation, remember, openBrowse]);

  const openGenre = useCallback((name: string) => openBrowse({ kind: "genre", name }), [openBrowse]);

  const idle = debounced.length === 0;
  const loading = !idle && data === undefined && search.isFetching;
  const empty = !idle && current && !search.isFetching && sections.length === 0;
  // « Rechercher » au clavier système (tvOS) : aux résultats, comme sur la LG.
  const submit = useSearchSubmit(searchSubmitAnswer({
    typed: query, debounced, current, fetching: search.isFetching, failed: search.isError, sections: sections.length,
  }), refocusKeyboard);

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
            barRef={barRef}
            width={KEYBOARD_WIDTH}
            query={query}
            completion={completion}
            onSetQuery={setQuery}
            onSystemKeyboardClosed={submit.onKeyboardClosed}
            onSubmit={submit.onSubmit}
            onBarFocus={submit.onBarFocus}
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
              <TVSearchResults
                width={resultsWidth}
                sections={sections}
                notice={notice}
                actions={actions}
                entryRef={submit.setFirstResult}
              />
            </View>
          )}
        </TVFocusGuideView>
      </View>
    </TVScreenFrame>
  );
}
