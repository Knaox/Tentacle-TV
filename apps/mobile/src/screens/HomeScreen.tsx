import { useCallback, useMemo, useState } from "react";
import { ScrollView, RefreshControl, View, Text, FlatList, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  useFeaturedItems, useResumeItems, useNextUp,
  useLibraries, useLatestItems, useUserId,
  useWatchlist, useMySharedWatchlists, useAllSharedWatchlistItems,
  useJellyfinClient, useHomeWebSocket, useTentacleConfig,
} from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { useTranslation } from "react-i18next";
import { SkeletonHero, SkeletonRow, FadeIn, SubtleBackground, ProgressBar } from "@/components/ui";
import { HeroBanner } from "@/components/HeroBanner";
import { MobileMediaCard } from "@/components/MobileMediaCard";
import { MediaRow } from "@/components/MediaRow";
import { MediaActionSheet } from "@/components/MediaActionSheet";
import { colors, spacing, typography, BRAND, FONT_FAMILY, RADIUS, SHADOW_RN, SURFACE } from "@/theme";

/** Home — ambient orbe + HeroBanner cinematic + rangées cascade + skeleton stylé. */
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
        <Feather name="alert-circle" size={36} color={BRAND.light} style={{ marginBottom: spacing.md }} />
        <Text style={st.errTitle}>{te("sessionNotInitialized")}</Text>
        <Text style={st.errMsg}>{te("sessionNotInitializedMessage")}</Text>
      </SubtleBackground>
    );
  }

  return (
    <SubtleBackground ambient>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={featured.isFetching && !featured.isLoading}
            onRefresh={handleRefresh}
            tintColor={BRAND.violet}
            progressBackgroundColor={SURFACE.s1}
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
            sharedListIds={(sharedLists.data ?? []).map((l) => l.id)}
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
    </SubtleBackground>
  );
}

/* ── Carrousel "Ma liste" — déduplique personal + shared ────────────────── */

interface CarouselItem {
  key: string;
  jellyfinId: string;
  name: string;
  year?: number;
  played?: boolean;
  progress?: number;
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
    for (const item of personalItems) {
      if (!seen.has(item.Id)) {
        seen.add(item.Id);
        result.push({
          key: item.Id, jellyfinId: item.Id, name: item.Name, year: item.ProductionYear,
          played: item.UserData?.Played === true,
          progress: item.UserData?.PlayedPercentage ?? undefined,
        });
      }
    }
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
    const hasProgress = item.progress != null && item.progress > 0 && item.progress < 100;
    return (
      <Pressable
        onPress={() => onItemPress(item.jellyfinId)}
        onLongPress={() => onItemLongPress(item.jellyfinId)}
        style={mlst.card}
        accessibilityRole="button"
        accessibilityLabel={item.name}
      >
        <View style={mlst.posterWrap}>
          <Image source={{ uri: poster }} style={mlst.poster} contentFit="cover" transition={250} />
          {item.played && (
            <View style={mlst.watchedBadge}>
              <Feather name="check" size={11} color="#000" />
            </View>
          )}
          {hasProgress && (
            <View style={mlst.progWrap}>
              <ProgressBar progress={(item.progress ?? 0) / 100} height={3} tint={BRAND.violet} />
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
        <Pressable onPress={onSeeAll} hitSlop={10} style={mlst.seeAllBtn} accessibilityRole="button" accessibilityLabel={t("seeAll")}>
          <Text style={mlst.seeAll}>{t("seeAll")}</Text>
          <Feather name="chevron-right" size={14} color={BRAND.light} />
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

const st = StyleSheet.create({
  errTitle: { ...typography.subtitle, fontFamily: FONT_FAMILY.bold, color: colors.textPrimary, marginBottom: 8, textAlign: "center" as const },
  errMsg: { ...typography.caption, fontFamily: FONT_FAMILY.regular, color: colors.textMuted, textAlign: "center" as const, maxWidth: 320 },
});

const mlst = StyleSheet.create({
  root: { marginTop: spacing.xxl },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.screenPadding, marginBottom: 14 },
  title: { ...typography.subtitle, fontFamily: FONT_FAMILY.bold, fontSize: 18, color: colors.textPrimary, letterSpacing: -0.3 },
  seeAllBtn: { flexDirection: "row", alignItems: "center", gap: 2 },
  seeAll: { ...typography.caption, fontFamily: FONT_FAMILY.semibold, color: BRAND.light },
  list: { paddingHorizontal: spacing.screenPadding, gap: 14 },
  card: { width: 130 },
  posterWrap: { borderRadius: RADIUS.lg, overflow: "hidden", ...SHADOW_RN.elev2 },
  poster: { width: 130, aspectRatio: 2 / 3, backgroundColor: SURFACE.s2 },
  cardName: { ...typography.small, fontSize: 13, fontFamily: FONT_FAMILY.semibold, color: colors.textPrimary, marginTop: 8, letterSpacing: -0.1 },
  cardYear: { ...typography.badge, fontFamily: FONT_FAMILY.medium, color: colors.textMuted, marginTop: 2 },
  watchedBadge: { position: "absolute" as const, top: 7, right: 7, width: 22, height: 22, borderRadius: 11, backgroundColor: "#FFFFFF", alignItems: "center" as const, justifyContent: "center" as const, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.35, shadowRadius: 4, elevation: 4 }, // R11 watched unifié (cf PosterCard.tsx:90)
  progWrap: { position: "absolute" as const, bottom: 0, left: 0, right: 0, paddingHorizontal: 6, paddingBottom: 6 },
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
    <FadeIn delay={320 + index * 90}>
      <MediaRow title={t("latestAdditions", { name: libraryName })} data={data} renderItem={renderCard} />
    </FadeIn>
  );
}
