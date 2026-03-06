import { useCallback, useMemo } from "react";
import { View, Text, ScrollView, RefreshControl, Dimensions, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useLibraries } from "@tentacle-tv/api-client";
import type { LibraryView } from "@tentacle-tv/shared";
import { SkeletonCard, FadeIn, SubtleBackground } from "@/components/ui";
import { LibraryCard } from "@/components/LibraryCard";
import { colors, spacing, typography } from "@/theme";

const CARD_GAP = 16;

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

  const skeletons = useMemo(() => {
    const h = cardWidth * (9 / 16);
    return Array.from({ length: 3 }).map((_, i) => (
      <View key={i} style={{ marginBottom: CARD_GAP }}>
        <SkeletonCard width={cardWidth} height={h} />
      </View>
    ));
  }, [cardWidth]);

  if (isLoading) {
    return (
      <SubtleBackground>
        <View style={[styles.container]}>
          <Text style={[typography.title, styles.title]}>{t("librariesTitle")}</Text>
          <View style={styles.listContainer}>{skeletons}</View>
        </View>
      </SubtleBackground>
    );
  }

  if (!data || data.length === 0) {
    return (
      <SubtleBackground>
        <View style={[styles.container]}>
          <Text style={[typography.title, styles.title]}>{t("librariesTitle")}</Text>
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{t("noResults")}</Text>
          </View>
        </View>
      </SubtleBackground>
    );
  }

  return (
    <SubtleBackground>
      <ScrollView
        style={[styles.container]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />
        }
      >
        <Text style={[typography.title, styles.title]}>{t("librariesTitle")}</Text>

        <View style={styles.listContainer}>
          {data.map((lib, index) => (
            <FadeIn key={lib.Id} delay={index * 80}>
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: spacing.xxl },
  title: {
    color: colors.textPrimary,
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  listContainer: { paddingHorizontal: spacing.screenPadding },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { ...typography.body, color: colors.textMuted },
});
