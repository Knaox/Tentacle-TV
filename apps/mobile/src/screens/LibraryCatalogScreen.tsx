import { useState, useCallback } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { backOrHome } from "@/utils/backOrHome";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import type { MediaItem } from "@tentacle-tv/shared";
import { SubtleBackground } from "@/components/ui";
import { CatalogGrid } from "@/components/catalog";
import { ScopedSearchEmpty } from "@/components/search/ScopedSearchEmpty";
import { ScopedSearchField } from "@/components/search/ScopedSearchField";
import { SearchAssistPane } from "@/components/search/SearchAssistPane";
import { spacing, typography, FONT_FAMILY, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { LibraryFilterBar, LibrarySheets } from "./library/LibraryFilterBar";
import { useLibraryCatalogState } from "./library/useLibraryCatalogState";

interface Props { libraryId: string; libraryName?: string }

/**
 * Une bibliothèque, ouverte depuis ailleurs (accueil, lien) — en-tête avec
 * retour, titre, recherche et filtres ; pastilles de filtre ; grille infinie.
 * Son état et ses filtres sont ceux de l'onglet Bibliothèque
 * (`useLibraryCatalogState`) : les deux se comportent à l'identique.
 */
export function LibraryCatalogScreen({ libraryId, libraryName }: Props) {
  const { t } = useTranslation("common");
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const state = useLibraryCatalogState(libraryId);
  const { assist, catalog, searching, totalCount } = state;
  const [searchVisible, setSearchVisible] = useState(false);

  const handleItemPress = useCallback((item: MediaItem) => router.push(`/media/${item.Id}`), [router]);
  // Replier la barre, c'est aussi lever le filtre — jamais une grille filtrée en douce.
  const toggleSearch = () => {
    if (searchVisible) state.setSearchQuery("");
    setSearchVisible(!searchVisible);
  };

  return (
    <SubtleBackground ambient>
      <View style={[styles.container, { paddingTop: Math.max(insets.top, 24) }]}>
        <View style={styles.header}>
          <Pressable onPress={() => backOrHome(router)} hitSlop={12} style={styles.backBtn} accessibilityRole="button" accessibilityLabel={t("back")}>
            <Feather name="chevron-left" size={26} color={colors.text.primary} />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>{libraryName ?? ""}</Text>
          <View style={styles.headerActions}>
            <Pressable onPress={toggleSearch} hitSlop={12} accessibilityRole="button" accessibilityLabel={t("search")}>
              <Feather name="search" size={20} color={searchVisible ? colors.brand.violet : colors.text.secondary} />
            </Pressable>
            <Pressable onPress={() => state.setSheet("filters")} hitSlop={12} style={{ marginLeft: spacing.md }} accessibilityRole="button" accessibilityLabel={t("filters")}>
              <View>
                <Feather name="sliders" size={20} color={state.filterCount > 0 ? colors.brand.violet : colors.text.secondary} />
                {state.filterCount > 0 && (
                  <View style={styles.headerBadge}>
                    <Text style={styles.headerBadgeText}>{state.filterCount}</Text>
                  </View>
                )}
              </View>
            </Pressable>
          </View>
        </View>

        {searchVisible && (
          <View style={styles.searchContainer}>
            <ScopedSearchField
              assist={assist}
              placeholder={t("searchInLibrary", { name: libraryName ?? "" })}
              count={searching && !catalog.isLoading ? totalCount : null}
              autoFocus
            />
          </View>
        )}

        {/* Pendant la frappe, les suggestions prennent la place de la page. */}
        {assist.open ? (
          <SearchAssistPane assist={assist} />
        ) : (
          <>
            <LibraryFilterBar state={state} />
            {/* Rien trouvé : la bonne orthographe, toute la recherche, et ce que
                les extensions trouvent ailleurs — jamais une grille vide. */}
            {searching && !catalog.isLoading && totalCount === 0 ? (
              <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
                <ScopedSearchEmpty query={state.debouncedSearch} onApply={state.setSearchQuery} />
              </ScrollView>
            ) : (
              <CatalogGrid
                catalog={catalog}
                onItemPress={handleItemPress}
                overrideItems={state.platformActive ? state.platformFiltered : undefined}
              />
            )}
          </>
        )}

        <LibrarySheets state={state} />
      </View>
    </SubtleBackground>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.screenPadding, paddingVertical: spacing.sm, gap: 4 },
  backBtn: { marginRight: spacing.xs, padding: 4 },
  headerTitle: { ...typography.title, fontFamily: FONT_FAMILY.extrabold, fontSize: 22, letterSpacing: -0.4, color: t.colors.text.primary, flex: 1 },
  headerActions: { flexDirection: "row", alignItems: "center" },
  searchContainer: { marginBottom: spacing.sm },
  headerBadge: { position: "absolute" as const, top: -4, right: -6, width: 15, height: 15, borderRadius: 8, backgroundColor: t.colors.brand.violet, alignItems: "center" as const, justifyContent: "center" as const },
  headerBadgeText: { color: t.colors.cta.brandFg, fontSize: 9, fontFamily: FONT_FAMILY.extrabold },
});
