import { useCallback, useMemo } from "react";
import { View, Text, ScrollView, RefreshControl, Dimensions, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useLibraries } from "@tentacle-tv/api-client";
import type { LibraryView } from "@tentacle-tv/shared";
import { Feather } from "@expo/vector-icons";
import { SkeletonCard, FadeIn, SubtleBackground } from "@/components/ui";
import { LibraryCard } from "@/components/LibraryCard";
import { colors, spacing, typography, BRAND, FONT_FAMILY } from "@/theme";

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
  const router = useRouter();
  const { data, isLoading, refetch, isRefetching } = useLibraries();

  const cardWidth = Dimensions.get("window").width - spacing.screenPadding * 2;

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
    return Array.from({ length: 4 }).map((_, i) => (
      <View key={i} style={{ marginBottom: CARD_GAP }}>
        <SkeletonCard width={cardWidth} height={rowH} />
      </View>
    ));
  }, [cardWidth]);

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
            <Feather name="folder" size={48} color={BRAND.light} style={{ marginBottom: 16, opacity: 0.6 }} />
            <Text style={styles.emptyText}>{t("noResults")}</Text>
          </View>
        </View>
      </SubtleBackground>
    );
  }

  const countLabel = t("librarySummary", { count: data.length, items: totalCount, defaultValue: `${data.length} collections · ${totalCount} titres` });

  return (
    <SubtleBackground ambient>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={BRAND.violet}
            progressBackgroundColor={colors.surface}
          />
        }
      >
        <Header title={t("librariesTitle")} subtitle={countLabel} />

        {/* Grille cohérente — toutes les libs sont équivalentes, pas de hiérarchie arbitraire */}
        <View style={styles.listContainer}>
          {data.map((lib, index) => (
            <FadeIn key={lib.Id} delay={index * 80} translateY={16}>
              <View style={{ marginBottom: CARD_GAP }}>
                <LibraryCard library={lib} width={cardWidth} onPress={() => handlePress(lib)} />
              </View>
            </FadeIn>
          ))}
        </View>
      </ScrollView>
    </SubtleBackground>
  );
}

function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.header}>
      <Text style={styles.title} accessibilityRole="header">{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
    color: colors.textPrimary,
    letterSpacing: -0.8,
  },
  subtitle: {
    ...typography.caption,
    fontFamily: FONT_FAMILY.medium,
    color: BRAND.light,
    marginTop: 6,
    letterSpacing: 0.3,
  },
  listContainer: { paddingHorizontal: spacing.screenPadding },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 80 },
  emptyText: { ...typography.body, fontFamily: FONT_FAMILY.medium, color: colors.textMuted, textAlign: "center" },
});
