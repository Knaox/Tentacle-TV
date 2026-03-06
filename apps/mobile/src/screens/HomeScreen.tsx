import { useCallback, useEffect } from "react";
import { ScrollView, RefreshControl, View, Text } from "react-native";
import { useRouter } from "expo-router";
import {
  useFeaturedItems, useResumeItems, useNextUp,
  useLibraries, useLatestItems, useUserId, useTentacleConfig,
} from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { useTranslation } from "react-i18next";
import { SkeletonHero, SkeletonRow, FadeIn } from "@/components/ui";
import { HeroBanner } from "@/components/HeroBanner";
import { MobileMediaCard } from "@/components/MobileMediaCard";
import { MediaRow } from "@/components/MediaRow";
import { colors, spacing, typography } from "@/theme";

export function HomeScreen() {
  const { t } = useTranslation("common");
  const { t: te } = useTranslation("errors");
  const router = useRouter();
  const userId = useUserId();
  const { storage } = useTentacleConfig();

  const featured = useFeaturedItems();
  const resume = useResumeItems();
  const nextUp = useNextUp();
  const libraries = useLibraries();

  // Debug: trace why queries might not run
  useEffect(() => {
    const rawUser = storage.getItem("tentacle_user");
    const rawToken = storage.getItem("tentacle_token");
    const rawUrl = storage.getItem("tentacle_server_url");
    console.log("[HomeScreen DEBUG]", {
      userId,
      hasToken: !!rawToken,
      hasUrl: !!rawUrl,
      hasUser: !!rawUser,
      userIdFromRaw: rawUser ? JSON.parse(rawUser)?.Id : "NO_RAW",
      featuredStatus: featured.status,
      resumeStatus: resume.status,
      featuredError: featured.error?.message,
      resumeError: resume.error?.message,
    });
  }, [userId, featured.status, resume.status, featured.error, resume.error, storage]);

  const isLoading = featured.isLoading || resume.isLoading;

  // Hero: prioritize resume items (quick resume), fallback to featured
  const heroItems = resume.data && resume.data.length > 0
    ? resume.data.slice(0, 5)
    : featured.data ?? [];

  const handleRefresh = useCallback(() => {
    featured.refetch();
    resume.refetch();
    nextUp.refetch();
    libraries.refetch();
  }, [featured, resume, nextUp, libraries]);

  const handlePress = useCallback((item: MediaItem) => {
    router.push(`/media/${item.Id}`);
  }, [router]);

  const handlePlay = useCallback((item: MediaItem) => {
    router.push(`/watch/${item.Id}`);
  }, [router]);

  const renderCard = useCallback((item: MediaItem) => (
    <MobileMediaCard item={item} onPress={() => handlePress(item)} />
  ), [handlePress]);

  // Show skeleton while truly loading (not just disabled)
  const anyFetching = featured.isFetching || resume.isFetching;
  if (isLoading || (!userId && anyFetching)) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <SkeletonHero />
        <View style={{ marginTop: spacing.xl }}><SkeletonRow /></View>
        <View style={{ marginTop: spacing.xl }}><SkeletonRow /></View>
      </View>
    );
  }

  // If userId is null, queries are disabled — show diagnostic
  if (!userId) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center", padding: 32 }}>
        <Text style={{ ...typography.subtitle, color: colors.textPrimary, marginBottom: 8 }}>
          {te("sessionNotInitialized")}
        </Text>
        <Text style={{ ...typography.caption, color: colors.textMuted, textAlign: "center" }}>
          {te("sessionNotInitializedMessage")}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={featured.isFetching && !featured.isLoading}
            onRefresh={handleRefresh}
            tintColor={colors.accent}
            progressBackgroundColor={colors.surface}
          />
        }
      >
        {/* Hero Carousel — resume items priority, fallback to featured */}
        {heroItems.length > 0 && (
          <HeroBanner items={heroItems} onPlay={handlePlay} onInfo={handlePress} />
        )}

        {/* Resume Watching (only if hero is NOT showing resume items) */}
        {resume.data && resume.data.length > 0 && heroItems !== resume.data.slice(0, 5) && (
          <FadeIn delay={100}>
            <MediaRow title={t("resumeWatching")} data={resume.data} renderItem={renderCard} />
          </FadeIn>
        )}

        {/* Next Up */}
        {nextUp.data && nextUp.data.length > 0 && (
          <FadeIn delay={200}>
            <MediaRow title={t("nextEpisodes")} data={nextUp.data} renderItem={renderCard} />
          </FadeIn>
        )}

        {/* Library rows */}
        {(libraries.data ?? []).map((lib, index) => (
          <LibraryRow
            key={lib.Id}
            libraryId={lib.Id}
            libraryName={lib.Name}
            renderCard={renderCard}
            index={index}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function LibraryRow({ libraryId, libraryName, renderCard, index }: {
  libraryId: string;
  libraryName: string;
  renderCard: (item: MediaItem) => React.ReactNode;
  index: number;
}) {
  const { t } = useTranslation("common");
  const { data } = useLatestItems(libraryId);
  if (!data || data.length === 0) return null;
  return (
    <FadeIn delay={300 + index * 100}>
      <MediaRow
        title={t("latestAdditions", { name: libraryName })}
        data={data}
        renderItem={renderCard}
      />
    </FadeIn>
  );
}
