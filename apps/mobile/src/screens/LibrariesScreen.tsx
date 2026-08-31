import { useCallback, useMemo } from "react";
import { View, Text, RefreshControl, StyleSheet } from "react-native";
import Animated from "react-native-reanimated";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useLibraries } from "@tentacle-tv/api-client";
import type { LibraryView } from "@tentacle-tv/shared";
import { Feather } from "@expo/vector-icons";
import { SkeletonCard, FadeIn, SubtleBackground } from "@/components/ui";
import { LibraryCard } from "@/components/LibraryCard";
import { useHeaderHeight } from "@/components/PersistentHeader";
import { useScrollChromeHandler } from "@/components/navigation/scrollChrome";
import { spacing, typography, FONT_FAMILY, useGrid, useTheme, useThemedStyles, type AppTheme } from "@/theme";

const CARD_GAP = 18;

/**
 * Écran "Bibliothèques" — pattern Disney+ "Collections" :
 *  1. Hero featured pleine largeur pour la première lib (Ken Burns + glow violet)
 *  2. Section header "Explorer" au-dessus du reste
 *  3. Grille verticale 16:9 cards pour les autres libs avec backdrop rotate
 *
 * Ambient orbe violet renforcé. Cascade entry par card (80ms stagger).
 */
export function LibrariesScreen() {
  const { t } = useTranslation("common");
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const headerH = useHeaderHeight();
  const onScrollChrome = useScrollChromeHandler();
  const { data, isLoading, refetch, isRefetching } = useLibraries();

  // 1 colonne pleine largeur sur iPhone (inchangé), grille 2–3 colonnes 16:9 sur iPad.
  const { numColumns, itemWidth: cardWidth } = useGrid({
    phoneColumns: 1,
    targetTablet: 340,
    maxColumns: 3,
    gutter: CARD_GAP,
  });

  const handlePress = useCallback(
    (lib: LibraryView) => {
      router.push({ pathname: "/library/[libraryId]", params: { libraryId: lib.Id, libraryName: lib.Name } });
    },
    [router],
  );

  const totalCount = useMemo(() => {
    if (!data) return 0;
    return data.reduce((sum, l) => sum + (l.RecursiveItemCount ?? l.ChildCount ?? 0), 0);
  }, [data]);

  const skeletons = useMemo(() => {
    const rowH = cardWidth * (9 / 16);
    return Array.from({ length: numColumns > 1 ? numColumns * 2 : 4 }).map((_, i) => (
      <View key={i} style={{ width: cardWidth }}>
        <SkeletonCard width={cardWidth} height={rowH} />
      </View>
    ));
  }, [cardWidth, numColumns]);

  if (isLoading) {
    return (
      <SubtleBackground ambient>
        <View style={styles.container}>
          <Header title={t("librariesTitle")} subtitle={t("librariesSubtitle", { defaultValue: "" })} />
          <View style={styles.listContainer}>{skeletons}</View>
        </View>
      </SubtleBackground>
    );
  }

  if (!data || data.length === 0) {
    return (
      <SubtleBackground ambient>
        <View style={styles.container}>
          <Header title={t("librariesTitle")} />
          <View style={styles.emptyContainer}>
            <Feather name="folder" size={48} color={colors.brand.light} style={{ marginBottom: 16, opacity: 0.6 }} />
            <Text style={styles.emptyText}>{t("noResults")}</Text>
          </View>
        </View>
      </SubtleBackground>
    );
  }

  const countLabel = t("librarySummary", { count: data.length, items: totalCount, defaultValue: `${data.length} collections · ${totalCount} titres` });

  return (
    <SubtleBackground ambient>
      <Animated.ScrollView
        style={styles.container}
        onScroll={onScrollChrome}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.scrollContent, { paddingTop: headerH }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.brand.violet}
            progressBackgroundColor={colors.surface.s1}
          />
        }
      >
        <Header title={t("librariesTitle")} subtitle={countLabel} />

        {/* Grille cohérente — toutes les libs sont équivalentes, pas de hiérarchie arbitraire */}
        <View style={styles.listContainer}>
          {data.map((lib, index) => (
            <FadeIn key={lib.Id} delay={index * 80} translateY={16} style={{ width: cardWidth }}>
              <LibraryCard library={lib} width={cardWidth} onPress={() => handlePress(lib)} />
            </FadeIn>
          ))}
        </View>
      </Animated.ScrollView>
    </SubtleBackground>
  );
}

function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.header}>
      <Text style={styles.title} accessibilityRole="header">{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: spacing.xxxl + 60 },
  header: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  title: {
    fontSize: 32,
    fontFamily: FONT_FAMILY.extrabold,
    color: t.colors.text.primary,
    letterSpacing: -0.8,
  },
  subtitle: {
    ...typography.caption,
    fontFamily: FONT_FAMILY.medium,
    color: t.colors.brand.light,
    marginTop: 6,
    letterSpacing: 0.3,
  },
  listContainer: { paddingHorizontal: spacing.screenPadding, flexDirection: "row", flexWrap: "wrap", gap: CARD_GAP },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 80 },
  emptyText: { ...typography.body, fontFamily: FONT_FAMILY.medium, color: t.colors.text.tertiary, textAlign: "center" },
});
