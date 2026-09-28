import { useCallback, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, type FlatList } from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { useLibraries } from "@tentacle-tv/api-client";
import type { LibraryView, MediaItem } from "@tentacle-tv/shared";
import { SkeletonCard, SubtleBackground } from "@/components/ui";
import { LibraryCapsule } from "@/components/library/LibraryCapsule";
import { LibraryCatalogView } from "@/components/library/LibraryCatalogView";
import { LIBRARY_HERO_HEIGHT, collectionIcon } from "@/components/library/LibraryHero";
import { useHeaderHeight } from "@/components/PersistentHeader";
import { useGlassTabBarHeight } from "@/components/navigation/GlassTabBar";
import { useScrollChromeHandler } from "@/components/navigation/scrollChrome";
import { FONT_FAMILY, RADIUS, spacing, typography, useGrid, useTheme, useThemedStyles, type AppTheme } from "@/theme";

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
          <Text style={st.emptyText} accessibilityRole="header">{t("library:noLibraries")}</Text>
          <Text style={st.emptyHint}>{t("library:noLibrariesHint")}</Text>
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
  const headerH = useHeaderHeight();
  const tabBarH = useGlassTabBarHeight();
  const onScrollChrome = useScrollChromeHandler();
  const listRef = useRef<FlatList<MediaItem>>(null);

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

  return (
    <SubtleBackground ambient>
      <LibraryCatalogView
        library={current}
        capsule={<LibraryCapsule items={capsuleItems} selected={current.Id} onSelect={select} accessibilityLabel={t("librariesTitle")} />}
        topInset={headerH}
        bottomInset={tabBarH}
        onScroll={onScrollChrome}
        listRef={listRef}
      />
    </SubtleBackground>
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
  empty: { flex: 1, justifyContent: "center", alignItems: "center", gap: 16 },
  emptyText: { ...typography.body, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary, textAlign: "center" },
  emptyHint: { ...typography.caption, color: t.colors.text.tertiary, textAlign: "center", maxWidth: 300, marginTop: -8 },
  skeletonTitle: { width: 180, height: 40, borderRadius: RADIUS.md, backgroundColor: t.colors.fill.subtle, marginBottom: spacing.lg },
  skeletonCapsule: { height: 48, borderRadius: RADIUS.pill, marginHorizontal: spacing.screenPadding, backgroundColor: t.colors.fill.subtle, marginBottom: spacing.lg },
  skeletonGrid: { flexDirection: "row", flexWrap: "wrap" },
});
