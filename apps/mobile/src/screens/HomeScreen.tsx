import { useCallback, useMemo, useState } from "react";
import { ScrollView, RefreshControl, View, Text, FlatList, Pressable, StyleSheet, Image } from "react-native";
import { useRouter } from "expo-router";
import {
  useFeaturedItems, useResumeItems, useNextUp,
  useLibraries, useLatestItems, useUserId,
  useWatchlist, useMySharedWatchlists, useAllSharedWatchlistItems,
  useJellyfinClient,
  useHomeWebSocket, useTentacleConfig,
} from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { useTranslation } from "react-i18next";
import { SkeletonHero, SkeletonRow, FadeIn } from "@/components/ui";
import { HeroBanner } from "@/components/HeroBanner";
import { MobileMediaCard } from "@/components/MobileMediaCard";
import { MediaRow } from "@/components/MediaRow";
import { MediaActionSheet } from "@/components/MediaActionSheet";
import { colors, spacing, typography } from "@/theme";

export function HomeScreen() {
  const { t } = useTranslation("common");
  const { t: te } = useTranslation("errors");
  const router = useRouter();
  const userId = useUserId();
  const { storage } = useTentacleConfig();
  useHomeWebSocket({ token: storage.getItem("tentacle_token") });

  const featured = useFeaturedItems();
  const resume = useResumeItems();
  const nextUp = useNextUp();
  const libraries = useLibraries();
  const watchlist = useWatchlist();
  const sharedLists = useMySharedWatchlists();

  const [longPressItemId, setLongPressItemId] = useState<string | null>(null);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);

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

  const handleLongPress = useCallback((item: MediaItem) => {
    setLongPressItemId(item.Id);
    setActionSheetVisible(true);
  }, []);

  const renderCard = useCallback((item: MediaItem) => (
    <MobileMediaCard item={item} onPress={() => handlePress(item)} onLongPress={() => handleLongPress(item)} />
  ), [handlePress, handleLongPress]);

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

        {/* À regarder */}
        <FadeIn delay={250}>
          <MyListRow
            personalItems={watchlist.data ?? []}
            sharedListIds={(sharedLists.data ?? []).map(l => l.id)}
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
    </View>
  );
}

/* ── Carrousel "À regarder" ────────────────────────── */

interface CarouselItem {
  key: string;
  jellyfinId: string;
  name: string;
  year?: number;
  played?: boolean;
}

function MyListRow({ personalItems, sharedListIds, onSeeAll, onItemPress, onItemLongPress }: {
  personalItems: MediaItem[];
  sharedListIds: string[];
  onSeeAll: () => void;
  onItemPress: (jellyfinId: string) => void;
  onItemLongPress: (jellyfinId: string) => void;
}) {
  const { t } = useTranslation("common");
  const client = useJellyfinClient();
  const sharedQueries = useAllSharedWatchlistItems(sharedListIds);

  const merged = useMemo<CarouselItem[]>(() => {
    const seen = new Set<string>();
    const result: CarouselItem[] = [];

    // Personal items first
    for (const item of personalItems) {
      if (!seen.has(item.Id)) {
        seen.add(item.Id);
        result.push({ key: item.Id, jellyfinId: item.Id, name: item.Name, year: item.ProductionYear, played: item.UserData?.Played === true });
      }
    }

    // Then shared items (deduplicated)
    for (const q of sharedQueries) {
      if (!q.data) continue;
      for (const item of q.data) {
        if (!seen.has(item.jellyfinItemId)) {
          seen.add(item.jellyfinItemId);
          result.push({ key: item.jellyfinItemId, jellyfinId: item.jellyfinItemId, name: item.name, year: item.year });
        }
      }
    }

    return result;
  }, [personalItems, sharedQueries]);

  if (merged.length === 0) return null;

  const renderItem = ({ item }: { item: CarouselItem }) => {
    const poster = client.getImageUrl(item.jellyfinId, "Primary", { width: 300, quality: 80 });
    return (
      <Pressable
        onPress={() => onItemPress(item.jellyfinId)}
        onLongPress={() => onItemLongPress(item.jellyfinId)}
        style={mlst.card}
      >
        <View style={{ borderRadius: 10, overflow: "hidden" }}>
          <Image source={{ uri: poster }} style={mlst.poster} />
          {item.played && (
            <View style={mlst.watchedBadge}>
              <Text style={mlst.watchedCheck}>{"\u2713"}</Text>
            </View>
          )}
        </View>
        <Text numberOfLines={1} style={mlst.cardName}>{item.name}</Text>
        {item.year ? <Text style={mlst.cardYear}>{item.year}</Text> : null}
      </Pressable>
    );
  };

  return (
    <View style={mlst.root}>
      <View style={mlst.header}>
        <Text style={mlst.title}>{t("toWatch")}</Text>
        <Pressable onPress={onSeeAll} hitSlop={8}>
          <Text style={mlst.seeAll}>{t("seeAll")} {"\u203A"}</Text>
        </Pressable>
      </View>
      <FlatList
        horizontal
        data={merged}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={mlst.list}
        decelerationRate="fast"
      />
    </View>
  );
}

const mlst = StyleSheet.create({
  root: { marginTop: spacing.xl },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.screenPadding, marginBottom: spacing.md },
  title: { ...typography.subtitle, color: colors.textPrimary },
  seeAll: { ...typography.caption, color: colors.accent },
  list: { paddingHorizontal: spacing.screenPadding, gap: 12 },
  card: { width: 130 },
  poster: { width: 130, aspectRatio: 2 / 3, borderRadius: 10, backgroundColor: colors.surfaceElevated },
  cardName: { ...typography.small, color: colors.textPrimary, fontWeight: "600", marginTop: 6 },
  cardYear: { ...typography.badge, color: colors.textMuted, marginTop: 2 },
  watchedBadge: { position: "absolute" as const, top: 6, right: 6, width: 20, height: 20, borderRadius: 10, backgroundColor: "#8B5CF6", alignItems: "center" as const, justifyContent: "center" as const },
  watchedCheck: { color: "#fff", fontSize: 12, fontWeight: "800" as const },
});

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
