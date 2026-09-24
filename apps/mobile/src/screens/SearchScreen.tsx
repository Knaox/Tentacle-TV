import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useSearchEpisodes, useTentacleSearch } from "@tentacle-tv/api-client";
import type { SearchPersonHit } from "@tentacle-tv/shared";
import { backOrHome } from "@/utils/backOrHome";
import { SubtleBackground, GlassSurface } from "@/components/ui";
import { SearchBrowse, type BrowseTarget } from "@/components/search/SearchBrowse";
import { SearchFilters, availableFilters, type SearchFilter } from "@/components/search/SearchFilters";
import { SearchHome } from "@/components/search/SearchHome";
import { SearchResults, type SearchActions } from "@/components/search/SearchResults";
import { useMobileExternalSearch } from "@/components/search/useMobileExternalSearch";
import { useRecentSearches } from "@/components/search/useRecentSearches";
import { useSearchNavigation } from "@/components/search/useSearchNavigation";
import { IS_TABLET_DEVICE, spacing, typography, FONT_FAMILY, RADIUS, useTheme, useThemedStyles, type AppTheme } from "@/theme";

/** Le serveur répond en quelques millisecondes : on attend juste la fin d'une rafale de frappe. */
const DEBOUNCE_MS = 110;

/**
 * La recherche Tentacle, sur le moteur du serveur — celle du bureau 1.22.0 :
 * des résultats à chaque lettre, les fautes corrigées, les personnes, genres
 * et studios, le meilleur résultat qui se lance d'un geste, les épisodes, et
 * ce que les extensions trouvent hors de la bibliothèque. Avant la première
 * lettre : l'historique, « Reprendre » et les genres. Filtres en pastilles ;
 * une personne, un genre ou un studio se parcourt sans quitter la recherche.
 *
 * Le clavier se range dès qu'on fait défiler ; `?q=` ouvre la recherche déjà
 * remplie (« chercher dans tout Tentacle » depuis une bibliothèque).
 */
export function SearchScreen() {
  const { t } = useTranslation("search");
  const { colors } = useTheme();
  const st = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string }>();
  const inputRef = useRef<TextInput>(null);
  const [query, setQuery] = useState(typeof params.q === "string" ? params.q : "");
  const [debounced, setDebounced] = useState(query.trim());
  const [filter, setFilter] = useState<SearchFilter>("all");
  const [browse, setBrowse] = useState<BrowseTarget | null>(null);
  const recents = useRecentSearches();
  const nav = useSearchNavigation();

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(timer);
  }, []);

  const searching = debounced.length > 0 && browse === null;
  const search = useTentacleSearch(debounced, { limit: filter === "all" ? 10 : 48, enabled: searching });
  const episodes = useSearchEpisodes(debounced, { limit: filter === "episodes" ? 30 : 8, enabled: searching });
  const external = useMobileExternalSearch(debounced, { limit: 10, enabled: searching });
  const episodeList = useMemo(() => episodes.data?.episodes ?? [], [episodes.data]);
  const filters = useMemo(() => availableFilters(search.data, episodeList.length), [search.data, episodeList.length]);

  // Un filtre qui n'a plus rien à montrer (nouvelle requête) retombe sur « Tout ».
  useEffect(() => {
    if (filter !== "all" && !filters.some((f) => f.key === filter)) setFilter("all");
  }, [filters, filter]);

  // Retour matériel (Android) : il sort d'abord du parcours.
  useEffect(() => {
    if (browse === null) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => { setBrowse(null); return true; });
    return () => sub.remove();
  }, [browse]);

  // Ouvrir un résultat, c'est retenir la requête qui y a mené.
  const { push: pushRecent } = recents;
  const remember = useCallback(() => pushRecent(query), [pushRecent, query]);
  const actions = useMemo<SearchActions>(() => ({
    openItem: (id) => { remember(); nav.openItem(id); },
    playItem: (id) => { remember(); nav.playItem(id); },
    openPerson: (person: SearchPersonHit) => { remember(); setBrowse({ kind: "person", id: person.id, person }); },
    openFacet: (kind, name) => { remember(); setBrowse({ kind, name }); },
    openExternalItem: (provider, item) => { remember(); nav.openExternalItem(provider, item); },
    openExternal: (provider, href) => { remember(); nav.openExternal(provider, href); },
  }), [remember, nav]);

  const pick = useCallback((value: string) => {
    setQuery(value);
    setDebounced(value.trim());
    setFilter("all");
    setBrowse(null);
  }, []);

  // Sur iPhone, la recherche est une FEUILLE (sous la barre d'état) : la
  // marge de l'encoche n'y ferait qu'un grand vide. Plein écran ailleurs.
  const sheet = Platform.OS === "ios" && !IS_TABLET_DEVICE;
  const headerTop = sheet ? spacing.lg : Math.max(insets.top, 24) + spacing.md;

  return (
    <SubtleBackground ambient>
      <View style={[st.headerWrap, { paddingTop: headerTop }]}>
        <GlassSurface intensity={28} radius={0} bordered={false} style={StyleSheet.absoluteFillObject} />
        <View style={st.headerRow}>
          <View style={st.searchWrap}>
            <Feather name="search" size={16} color={colors.text.tertiary} />
            <TextInput
              ref={inputRef}
              value={query}
              onChangeText={(value) => { setQuery(value); setBrowse(null); }}
              onSubmitEditing={() => pushRecent(query)}
              placeholder={t("placeholder")}
              placeholderTextColor={colors.text.quaternary}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel={t("dialog")}
              style={st.input}
              returnKeyType="search"
            />
            {search.isFetching && searching && <ActivityIndicator size="small" color={colors.text.tertiary} />}
            {query.length > 0 && (
              <Pressable onPress={() => pick("")} hitSlop={10} accessibilityRole="button" accessibilityLabel={t("clear")} style={st.clearBtn}>
                <Feather name="x" size={14} color={colors.text.tertiary} />
              </Pressable>
            )}
          </View>
          <Pressable onPress={() => backOrHome(router)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t("cancel")} style={st.cancelBtn}>
            <Text style={st.cancelTxt}>{t("cancel")}</Text>
          </Pressable>
        </View>
        {searching && <SearchFilters options={filters} active={filter} onChange={setFilter} />}
      </View>

      <ScrollView
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}
      >
        {browse !== null ? (
          <SearchBrowse target={browse} onBack={() => setBrowse(null)} onOpen={actions.openItem} />
        ) : debounced.length === 0 ? (
          <SearchHome
            recent={recents.recent}
            onPick={pick}
            onRemove={recents.remove}
            onClear={recents.clear}
            onGenre={(name) => setBrowse({ kind: "genre", name })}
            onOpen={nav.openItem}
          />
        ) : (
          <SearchResults
            query={debounced}
            response={search.data}
            episodes={episodeList}
            external={external}
            filter={filter}
            onFilter={setFilter}
            onRetry={pick}
            actions={actions}
          />
        )}
      </ScrollView>
    </SubtleBackground>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  headerWrap: { paddingBottom: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.border.subtle },
  headerRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: spacing.sm, paddingHorizontal: spacing.screenPadding, width: "100%" as const, maxWidth: 860, alignSelf: "center" as const },
  searchWrap: {
    flex: 1, flexDirection: "row" as const, alignItems: "center" as const, gap: spacing.sm,
    backgroundColor: t.colors.fill.soft, borderWidth: 1, borderColor: t.colors.border.subtle,
    borderRadius: RADIUS.lg, paddingHorizontal: spacing.md, height: 46,
  },
  input: {
    flex: 1, ...typography.body, fontFamily: FONT_FAMILY.regular,
    color: t.colors.text.primary, paddingVertical: 0, letterSpacing: -0.1,
  },
  clearBtn: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: t.colors.fill.medium,
    alignItems: "center" as const, justifyContent: "center" as const,
  },
  cancelBtn: { paddingHorizontal: 4, paddingVertical: 8 },
  cancelTxt: { ...typography.body, fontFamily: FONT_FAMILY.semibold, color: t.colors.brand.light, letterSpacing: 0.1 },
});
