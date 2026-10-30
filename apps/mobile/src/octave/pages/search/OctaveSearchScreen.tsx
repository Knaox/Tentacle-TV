/**
 * Octave mobile — la RECHERCHE, le moteur du bureau : pendant la frappe, des
 * suggestions instantanées (bibliothèque, extension, récentes) ; la validation
 * (clavier, suggestion choisie) lance la recherche complète, dont les résultats
 * arrivent D'UN COUP (`useRevealedResults` : bibliothèque + catalogue Sillon,
 * pochettes déjà prêtes), la précédente restant affichée en attendant. Avant
 * la frappe : ambiances, consultés récemment, déjà écouté, recherches récentes.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, ScrollView, View, type TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { SearchX } from "lucide-react-native";
import {
  useKindResults, useOctaveSearchHistory, useOctaveSuggestions, useOwnedLists, useRevealedResults, useSharedLinkSearch,
} from "@tentacle-tv/api-client";
import { isEmptyLayout, layoutSearch, recentQueriesOf } from "@tentacle-tv/shared/octave";
import { useOfflineMode } from "../../../offline/useOfflineMode";
import { OctavePagesHost } from "../actions/OctavePagesHost";
import { useMobileArtworkPreloader } from "../env/artworkPreload";
import { useDeviceStore, useOctavePagesProvider } from "../env/pagesEnv";
import { EmptyState, TrackRowsSkeleton } from "../ui/ViewStates";
import { usePageMetrics } from "../ui/pageStyle";
import { FilterChips } from "./FilterChips";
import { MoodResults } from "./MoodResults";
import { OfflineSearchResults } from "./OfflineSearchResults";
import { SearchAllView } from "./SearchAllView";
import { SearchBar } from "./SearchBar";
import { SearchHome } from "./SearchHome";
import { SearchKindList } from "./SearchKindList";
import { SharedLinkStatus } from "./SharedLinkStatus";
import { SuggestionList } from "./SuggestionList";
import { useSearchRoute } from "./useSearchRoute";
import { AlbumWarmupProvider, useAlbumWarmupPage } from "../env/albumWarmupScope";

export function OctaveSearchScreen() {
  const { t, i18n } = useTranslation("music");
  const insets = useSafeAreaInsets();
  const provider = useOctavePagesProvider();
  const store = useDeviceStore();
  const preloadArtwork = useMobileArtworkPreloader();
  const { gutter, sectionGap, bottomInset } = usePageMetrics();
  const { query, filter, submit: route, clear: clearRoute, setFilter } = useSearchRoute();
  const input = useRef<TextInput>(null);
  const warm = useAlbumWarmupPage();
  // Sans réseau : la recherche se fait dans la musique gardée sur l'appareil.
  const offline = useOfflineMode();
  const [draft, setDraft] = useState(query);
  const [typing, setTyping] = useState(false);
  // Une recherche validée ailleurs (retour arrière, lien) reprend la barre.
  useEffect(() => setDraft(query), [query]);

  // L'historique : celui du compte quand le serveur le garde (le même que le bureau), sinon celui de l'appareil.
  const history = useOctaveSearchHistory(store);
  const recents = useMemo(() => recentQueriesOf(history.history), [history.history]);
  const { rememberQuery: remember, forgetQuery: forget } = history;
  const { suggestions } = useOctaveSuggestions(provider, typing ? draft : "", recents);
  // Un lien Shazam (collé, ou arrivé par la feuille de partage) : on cherche son titre, jamais le lien.
  const goShared = useCallback((text: string) => {
    setTyping(false);
    setDraft(text);
    route(text);
  }, [route]);
  const shared = useSharedLinkSearch({ query, draft, go: goShared, remember });
  const searched = shared.isLink ? "" : query;
  const results = useRevealedResults(provider, searched, { language: i18n.language, externalDefault: t("search.externalDefault"), preloadArtwork });
  const owned = useOwnedLists(results.external);
  const data = results.library?.data ?? null;
  const shownQuery = results.library?.query ?? "";
  const layout = useMemo(() => layoutSearch(data, owned.lists), [data, owned.lists]);
  const kind = useKindResults(provider, shownQuery, filter, results.external, preloadArtwork);
  const ownedKind = useOwnedLists(kind.lists);

  const submit = useCallback(
    (text: string) => {
      Keyboard.dismiss();
      setTyping(false);
      setDraft(text);
      remember(text);
      route(text);
    },
    [remember, route],
  );
  const clear = useCallback(() => {
    setDraft("");
    setTyping(true);
    if (query) clearRoute();
    input.current?.focus();
  }, [clearRoute, query]);
  const change = useCallback((text: string) => {
    setDraft(text);
    setTyping(true);
  }, []);

  const bottom = bottomInset;
  const showSuggestions = typing && draft.trim() !== "" && draft !== query;
  const nothing = !!results.library && isEmptyLayout(layout) && !results.externalPending && (results.external?.complete ?? true);
  const bar = (
    <View style={{ paddingHorizontal: gutter, paddingTop: insets.top + 8, paddingBottom: 8 }}>
      <SearchBar ref={input} value={draft} onChange={change} onSubmit={submit} onClear={clear} onFocus={() => setTyping(true)} preparing={(!offline && results.preparing) || shared.pending} />
    </View>
  );
  const filters = !nothing && results.library ? <FilterChips value={filter} onChange={setFilter} gutter={gutter} /> : null;

  let body: React.ReactNode;
  if (showSuggestions) {
    body = (
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingBottom: bottom }}>
        <SuggestionList suggestions={suggestions} onPick={submit} onFill={change} onForget={forget} gutter={gutter} />
      </ScrollView>
    );
  } else if (shared.isLink) {
    body = <SharedLinkStatus failed={shared.failed} gutter={gutter} />;
  } else if (!query.trim()) {
    body = (
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingTop: 8, paddingBottom: bottom }} {...warm.scroll}>
        <SearchHome recents={recents} history={history} onSearch={submit} />
      </ScrollView>
    );
  } else if (offline) {
    body = (
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingTop: 8, paddingBottom: bottom }}>
        <OfflineSearchResults query={query} gutter={gutter} />
      </ScrollView>
    );
  } else if (filter !== "all" && results.library) {
    body = (
      <SearchKindList
        query={shownQuery}
        filter={filter}
        library={data}
        external={ownedKind.lists}
        albumOwnership={ownedKind.albumOwnership}
        pending={kind.pending || results.externalPending}
        header={<View style={{ paddingVertical: 8 }}>{filters}</View>}
        bottom={bottom}
      />
    );
  } else {
    body = (
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingTop: 8, paddingBottom: bottom, gap: sectionGap }} {...warm.scroll}>
        <MoodResults query={query} />
        {filters}
        {!results.library ? <TrackRowsSkeleton count={8} gutter={gutter} /> : null}
        {nothing ? <EmptyState icon={SearchX} title={t("search.nothingFound", { query: shownQuery })} hint={t("search.nothingFoundHint")} /> : null}
        {!nothing && results.library ? <SearchAllView query={shownQuery} layout={layout} albumOwnership={owned.albumOwnership} externalPending={results.externalPending} onFilter={setFilter} /> : null}
      </ScrollView>
    );
  }

  return (
    <AlbumWarmupProvider scope={warm.scope}>
      <View style={{ flex: 1 }}>
        {bar}
        <View style={{ flex: 1 }}>{body}</View>
        <OctavePagesHost />
      </View>
    </AlbumWarmupProvider>
  );
}
