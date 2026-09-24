import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, type FlatList } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { useLibraries } from "@tentacle-tv/api-client";
import type { LibraryView, MediaItem } from "@tentacle-tv/shared";
import { SkeletonCard, SubtleBackground } from "@/components/ui";
import { CatalogGrid } from "@/components/catalog";
import { LibraryCapsule } from "@/components/library/LibraryCapsule";
import { LIBRARY_HERO_HEIGHT, LibraryHero, collectionIcon } from "@/components/library/LibraryHero";
import { useHeaderHeight } from "@/components/PersistentHeader";
import { useScrollChromeHandler } from "@/components/navigation/scrollChrome";
import { ScopedSearchEmpty } from "@/components/search/ScopedSearchEmpty";
import { ScopedSearchField } from "@/components/search/ScopedSearchField";
import { SearchAssistPane } from "@/components/search/SearchAssistPane";
import { FONT_FAMILY, RADIUS, spacing, typography, useGrid, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { LibraryFilterBar, LibrarySheets } from "./library/LibraryFilterBar";
import { useLibraryCatalogState } from "./library/useLibraryCatalogState";

const NONE: MediaItem[] = [];
/** La bibliothèque choisie survit au changement d'onglet (le temps de la session). */
let lastLibraryId: string | null = null;

/**
 * L'onglet Bibliothèque — la capsule du bureau 1.22.0 transposée au pouce :
 * plus de page d'accueil des bibliothèques à traverser, on arrive DANS la
 * dernière ouverte, et la capsule passe de Films à Séries à Animés d'un
 * geste. L'ambiance (une image de la bibliothèque, sous l'en-tête de verre)
 * change avec elle.
 *
 * Tout défile d'un seul tenant — héros, capsule, recherche, filtres, grille —
 * et replie le chrome comme les autres onglets. La recherche est celle des
 * barres locales : complétion, suggestions, hors bibliothèque.
 */
export function LibrariesScreen() {
  const { t } = useTranslation("common");
  const { colors } = useTheme();
  const st = useThemedStyles(makeStyles);
  const { data, isLoading } = useLibraries();
  const [selectedId, setSelectedId] = useState<string | null>(lastLibraryId);
  const libraries = data ?? [];
  const current = libraries.find((lib) => lib.Id === selectedId) ?? libraries[0] ?? null;

  const select = useCallback((id: string) => {
    lastLibraryId = id;
    setSelectedId(id);
  }, []);

  if (isLoading) return <LibrariesSkeleton />;
  if (!current) {
    return (
      <SubtleBackground ambient>
        <View style={st.empty}>
          <Feather name="folder" size={48} color={colors.brand.light} style={{ opacity: 0.6 }} />
          <Text style={st.emptyText}>{t("noResults")}</Text>
        </View>
      </SubtleBackground>
    );
  }
  return <LibraryTab libraries={libraries} current={current} onSelect={select} />;
}

function LibraryTab({ libraries, current, onSelect }: {
  libraries: LibraryView[];
  current: LibraryView;
  onSelect: (id: string) => void;
}) {
  const { t } = useTranslation("common");
  const st = useThemedStyles(makeStyles);
  const router = useRouter();
  const headerH = useHeaderHeight();
  const onScrollChrome = useScrollChromeHandler();
  const listRef = useRef<FlatList<MediaItem>>(null);
  const state = useLibraryCatalogState(current.Id);
  const { assist, catalog, searching, totalCount } = state;
  const emptySearch = searching && !catalog.isLoading && totalCount === 0;

  const capsuleItems = useMemo(
    () => libraries.map((lib) => ({ id: lib.Id, label: lib.Name, icon: collectionIcon(lib.CollectionType) })),
    [libraries],
  );
  const select = useCallback((id: string) => {
    // La nouvelle bibliothèque s'ouvre en haut : garder la position d'une
    // autre grille n'aurait aucun sens.
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
    onSelect(id);
  }, [onSelect]);
  const openItem = useCallback((item: MediaItem) => router.push(`/media/${item.Id}`), [router]);

  // Le champ monte sous l'en-tête quand on y tape, comme une barre de
  // recherche iOS : le héros et la capsule s'effacent, le panneau des
  // suggestions a la place au-dessus du clavier.
  const searchRowY = useRef(0);
  useEffect(() => {
    if (!assist.focused) return;
    listRef.current?.scrollToOffset({ offset: Math.max(0, searchRowY.current - spacing.sm), animated: true });
  }, [assist.focused]);

  const header = (
    <View>
      <LibraryHero library={current} topInset={headerH} />
      <LibraryCapsule items={capsuleItems} selected={current.Id} onSelect={select} accessibilityLabel={t("librariesTitle")} />
      <View style={st.searchRow} onLayout={(e) => { searchRowY.current = e.nativeEvent.layout.y; }}>
        <ScopedSearchField
          assist={assist}
          placeholder={t("searchInLibrary", { name: current.Name })}
          count={searching && !catalog.isLoading ? totalCount : null}
          inset={false}
        />
        <FilterButton count={state.advancedActiveCount} onPress={() => state.setSheet("advanced")} />
      </View>
      {/* Pendant la frappe, les suggestions prennent la place des filtres et de la grille. */}
      {assist.open ? (
        <SearchAssistPane assist={assist} inline />
      ) : (
        <>
          {/* Le total est déjà sous le titre : le compte ne revient qu'avec un filtre. */}
          <LibraryFilterBar state={state} showCount={state.isFiltered} />
          {emptySearch && <ScopedSearchEmpty query={state.debouncedSearch} onApply={state.setSearchQuery} />}
        </>
      )}
    </View>
  );

  const hideGrid = assist.open || emptySearch;
  return (
    <SubtleBackground ambient>
      <CatalogGrid
        listRef={listRef}
        catalog={catalog}
        onItemPress={openItem}
        overrideItems={hideGrid ? NONE : state.platformActive ? state.platformFiltered : undefined}
        empty={hideGrid ? null : undefined}
        header={header}
        onScroll={onScrollChrome}
        topInset={headerH}
      />
      <LibrarySheets state={state} />
    </SubtleBackground>
  );
}

/** Les filtres avancés, à côté du champ — avec leur nombre quand il y en a. */
function FilterButton({ count, onPress }: { count: number; onPress: () => void }) {
  const { t } = useTranslation("common");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const active = count > 0;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={active ? `${t("filters")} (${count})` : t("filters")}
      style={({ pressed }) => [st.filterBtn, active && st.filterBtnActive, pressed && st.pressed]}
    >
      <Feather name="sliders" size={18} color={active ? theme.colors.brand.light : theme.colors.text.secondary} />
      {active && (
        <View style={st.badge}>
          <Text style={st.badgeText}>{count}</Text>
        </View>
      )}
    </Pressable>
  );
}

function LibrariesSkeleton() {
  const st = useThemedStyles(makeStyles);
  const headerH = useHeaderHeight();
  const { itemWidth, numColumns, gutter, padding } = useGrid({ phoneColumns: 3 });
  return (
    <SubtleBackground ambient>
      <View style={{ paddingTop: headerH + LIBRARY_HERO_HEIGHT - 80 }}>
        <View style={[st.skeletonTitle, { marginHorizontal: spacing.screenPadding }]} />
        <View style={st.skeletonCapsule} />
        <View style={[st.skeletonGrid, { paddingHorizontal: padding, gap: gutter }]}>
          {Array.from({ length: numColumns * 2 }, (_, i) => (
            <SkeletonCard key={i} width={itemWidth} height={itemWidth * 1.5} />
          ))}
        </View>
      </View>
    </SubtleBackground>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.screenPadding,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: t.colors.border.strong,
    backgroundColor: t.colors.surface.s2,
  },
  filterBtnActive: { borderColor: t.colors.border.focus, backgroundColor: t.colors.brand.soft },
  pressed: { opacity: 0.75, transform: [{ scale: 0.96 }] },
  badge: {
    position: "absolute",
    top: -3,
    right: -3,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.brand.violet,
  },
  badgeText: { color: t.colors.cta.brandFg, fontSize: 10, fontFamily: FONT_FAMILY.extrabold },
  empty: { flex: 1, justifyContent: "center", alignItems: "center", gap: 16 },
  emptyText: { ...typography.body, fontFamily: FONT_FAMILY.medium, color: t.colors.text.tertiary, textAlign: "center" },
  skeletonTitle: { width: 180, height: 40, borderRadius: RADIUS.md, backgroundColor: t.colors.fill.subtle, marginBottom: spacing.lg },
  skeletonCapsule: { height: 48, borderRadius: RADIUS.pill, marginHorizontal: spacing.screenPadding, backgroundColor: t.colors.fill.subtle, marginBottom: spacing.lg },
  skeletonGrid: { flexDirection: "row", flexWrap: "wrap" },
});
