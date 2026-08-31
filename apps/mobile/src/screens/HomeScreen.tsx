import { useCallback, useState } from "react";
import { ScrollView, RefreshControl, View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  useFeaturedItems, useResumeItems, useNextUp,
  useLibraries, useLatestItems, useUserId,
  useWatchlist,
  useHomeWebSocket, useTentacleConfig,
} from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { useTranslation } from "react-i18next";
import { SkeletonHero, SkeletonRow, FadeIn, SubtleBackground } from "@/components/ui";
import { HeroBanner } from "@/components/HeroBanner";
import { useHeaderHeight } from "@/components/PersistentHeader";
import { MobileMediaCard } from "@/components/MobileMediaCard";
import { MediaRow } from "@/components/MediaRow";
import { MyListRow } from "@/components/MyListRow";
import { MediaActionSheet } from "@/components/MediaActionSheet";
import { spacing, typography, FONT_FAMILY, useTheme, useThemedStyles, type AppTheme } from "@/theme";

/** Home — ambient orbe + HeroBanner cinematic + rangées cascade + skeleton stylé. */
export function HomeScreen() {
  const { t } = useTranslation("common");
  const { t: te } = useTranslation("errors");
  const theme = useTheme();
  const st = useThemedStyles(makeErrStyles);
  const router = useRouter();
  const headerH = useHeaderHeight();
  const userId = useUserId();
  const { storage } = useTentacleConfig();
  useHomeWebSocket({ token: storage.getItem("tentacle_token") });

  const featured = useFeaturedItems();
  const resume = useResumeItems();
  const nextUp = useNextUp();
  const libraries = useLibraries();
  const watchlist = useWatchlist();

  const [longPressItemId, setLongPressItemId] = useState<string | null>(null);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);

  const isLoading = featured.isLoading || resume.isLoading;

  // Hero priorité : resume → featured
  const heroItems = resume.data && resume.data.length > 0
    ? resume.data.slice(0, 5)
    : featured.data ?? [];

  const resumeRowItems = resume.data ?? [];
  const nextUpRowItems = nextUp.data ?? [];

  const handleRefresh = useCallback(() => {
    featured.refetch();
    resume.refetch();
    nextUp.refetch();
    libraries.refetch();
  }, [featured, resume, nextUp, libraries]);

  const handlePress = useCallback((item: MediaItem) => { router.push(`/media/${item.Id}`); }, [router]);
  const handlePlay = useCallback((item: MediaItem) => { router.push(`/watch/${item.Id}`); }, [router]);
  const handleLongPress = useCallback((item: MediaItem) => {
    setLongPressItemId(item.Id);
    setActionSheetVisible(true);
  }, []);

  const renderCard = useCallback((item: MediaItem) => (
    <MobileMediaCard item={item} onPress={() => handlePress(item)} onLongPress={() => handleLongPress(item)} />
  ), [handlePress, handleLongPress]);

  const anyFetching = featured.isFetching || resume.isFetching;
  if (isLoading || (!userId && anyFetching)) {
    return (
      <SubtleBackground ambient>
        <SkeletonHero />
        <View style={{ marginTop: spacing.xl }}><SkeletonRow /></View>
        <View style={{ marginTop: spacing.xl }}><SkeletonRow /></View>
        <View style={{ marginTop: spacing.xl }}><SkeletonRow /></View>
      </SubtleBackground>
    );
  }

  if (!userId) {
    return (
      <SubtleBackground ambient style={{ justifyContent: "center", alignItems: "center", padding: 32 }}>
        <Feather name="alert-circle" size={36} color={theme.colors.brand.light} style={{ marginBottom: spacing.md }} />
        <Text style={st.errTitle}>{te("sessionNotInitialized")}</Text>
        <Text style={st.errMsg}>{te("sessionNotInitializedMessage")}</Text>
      </SubtleBackground>
    );
  }

  return (
    <SubtleBackground ambient>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: headerH, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={featured.isFetching && !featured.isLoading}
            onRefresh={handleRefresh}
            tintColor={theme.colors.brand.violet}
            progressBackgroundColor={theme.colors.surface.s1}
          />
        }
      >
        {/* Hero Carousel */}
        {heroItems.length > 0 && (
          <HeroBanner items={heroItems} onPlay={handlePlay} onInfo={handlePress} />
        )}

        {/* Reprendre la lecture — strict parité avec le desktop (hero inclus). */}
        {resumeRowItems.length > 0 && (
          <FadeIn delay={100}>
            <MediaRow title={t("resumeWatching")} data={resumeRowItems} renderItem={renderCard} />
          </FadeIn>
        )}

        {/* Prochains épisodes — row séparée comme sur le desktop. */}
        {nextUpRowItems.length > 0 && (
          <FadeIn delay={170}>
            <MediaRow title={t("nextEpisodes")} data={nextUpRowItems} renderItem={renderCard} />
          </FadeIn>
        )}

        {/* Ma liste */}
        <FadeIn delay={240}>
          <MyListRow
            personalItems={watchlist.data ?? []}
            onSeeAll={() => router.push("/watchlist")}
            onItemPress={(jellyfinId) => router.push(`/media/${jellyfinId}`)}
            onItemLongPress={(jellyfinId) => { setLongPressItemId(jellyfinId); setActionSheetVisible(true); }}
          />
        </FadeIn>

        {/* Library rows */}
        {(libraries.data ?? []).map((lib, index) => (
          <LibraryRow
            key={lib.Id}
            libraryId={lib.Id}
            libraryName={lib.Name}
            collectionType={lib.CollectionType}
            renderCard={renderCard}
            index={index}
          />
        ))}
      </ScrollView>

      {longPressItemId && (
        <MediaActionSheet
          visible={actionSheetVisible}
          itemId={longPressItemId}
          onClose={() => setActionSheetVisible(false)}
        />
      )}
    </SubtleBackground>
  );
}

const makeErrStyles = (t: AppTheme) => StyleSheet.create({
  errTitle: { ...typography.subtitle, fontFamily: FONT_FAMILY.bold, color: t.colors.text.primary, marginBottom: 8, textAlign: "center" as const },
  errMsg: { ...typography.caption, fontFamily: FONT_FAMILY.regular, color: t.colors.text.tertiary, textAlign: "center" as const, maxWidth: 320 },
});

function LibraryRow({ libraryId, libraryName, collectionType, renderCard, index }: {
  libraryId: string;
  libraryName: string;
  collectionType?: string;
  renderCard: (item: MediaItem) => React.ReactNode;
  index: number;
}) {
  const { t } = useTranslation("common");
  // collectionType active le regroupement en collection des bibliothèques
  // séries (runs d'épisodes → tuile série + badge "+N") — parité desktop.
  const { data } = useLatestItems(libraryId, { collectionType });
  if (!data || data.length === 0) return null;
  return (
    <FadeIn delay={320 + index * 90}>
      <MediaRow title={t("latestAdditions", { name: libraryName })} data={data} renderItem={renderCard} />
    </FadeIn>
  );
}
