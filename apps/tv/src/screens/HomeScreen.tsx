import { useCallback, useRef, useState } from "react";
import { View, ScrollView, TVFocusGuideView } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import { useTVRemote } from "../components/focus/useTVRemote";
import {
  useFeaturedItems, useResumeItems, useNextUp,
  useLibraries, useWatchlist,
  useTentacleConfig, useHomeWebSocket,
  setPreferencesToken,
} from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { useTranslation } from "react-i18next";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { TVShell } from "../components/nav/TVShell";
import { TVHeroBillboard } from "../components/hero/TVHeroBillboard";
import { TVPosterCard } from "../components/cards/TVPosterCard";
import { TVEpisodeCard } from "../components/cards/TVEpisodeCard";
import { TV_POSTER_WIDTH, TV_EPISODE_WIDTH } from "../components/cards/cardSizes";
import { FocusableRow } from "../components/focus/FocusableRow";
import { SkeletonHero, SkeletonRow } from "../components/SkeletonLoader";
import { Colors, Spacing, HeroConfig } from "../theme/colors";
import { TVHomeErrorState } from "../components/home/TVHomeErrorState";
import { AmbientFocusProvider, useAmbientFocus } from "../contexts/AmbientFocusContext";
import { TVAmbientBackdrop } from "../components/ambient/TVAmbientBackdrop";
import { TVLibraryRow } from "../components/rows/TVLibraryRow";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

const SCREEN_H = require("react-native").Dimensions.get("window").height;
const HERO_H = Math.round(SCREEN_H * HeroConfig.heightRatio);

export function HomeScreen(props: Props) {
  return (
    <AmbientFocusProvider>
      <HomeScreenInner {...props} />
    </AmbientFocusProvider>
  );
}

function HomeScreenInner({ navigation }: Props) {
  const { t } = useTranslation("common");
  const { storage } = useTentacleConfig();
  const queryClient = useQueryClient();
  useHomeWebSocket({ token: storage.getItem("tentacle_token") });
  const { setFocusedItem } = useAmbientFocus();
  const [railFocusSignal, setRailFocusSignal] = useState(0);

  // Invalidate volatile queries when screen regains focus (e.g. after Player)
  useFocusEffect(
    useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ["resume-items"] });
      queryClient.invalidateQueries({ queryKey: ["next-up"] });
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
    }, [queryClient])
  );

  // BACK sur l'accueil → focus sur le rail (pattern tvOS/Netflix)
  useTVRemote({ onBack: () => setRailFocusSignal((s) => s + 1) });

  const scrollViewRef = useRef<ScrollView>(null);
  const rowYMap = useRef<Map<string, number>>(new Map());

  const scrollToRow = useCallback((key: string) => {
    const y = rowYMap.current.get(key);
    if (y != null) {
      scrollViewRef.current?.scrollTo({ y: Math.max(0, y - 80), animated: true });
    }
  }, []);

  const featuredQuery = useFeaturedItems();
  const resumeQuery = useResumeItems();
  const nextUpQuery = useNextUp();
  const librariesQuery = useLibraries();
  const watchlistQuery = useWatchlist();

  const featured = featuredQuery.data;
  const resume = resumeQuery.data;
  const nextUp = nextUpQuery.data;
  const libraries = librariesQuery.data;
  const watchlist = watchlistQuery.data;

  const allFailed = featuredQuery.isError && librariesQuery.isError;
  const isLoading = (featuredQuery.isLoading || librariesQuery.isLoading) && !featured && !libraries;

  const navigateToDetail = useCallback((item: MediaItem) => {
    const detailId = item.Type === "Episode" && item.SeriesId ? item.SeriesId : item.Id;
    navigation.navigate("MediaDetail", { itemId: detailId });
  }, [navigation]);

  const navigateToPlay = useCallback((item: MediaItem) => {
    navigation.navigate("Player", { itemId: item.Id });
  }, [navigation]);

  const handleLogout = useCallback(() => {
    storage.removeItem("tentacle_token");
    storage.removeItem("tentacle_user");
    storage.removeItem("tentacle_jellyfin_token");
    storage.removeItem("tentacle_jellyfin_url");
    setPreferencesToken(null);
    queryClient.clear();
    navigation.reset({ index: 0, routes: [{ name: "PairCode" }] });
  }, [storage, navigation, queryClient]);

  const renderPortraitCard = useCallback((item: MediaItem) => (
    <TVPosterCard item={item} />
  ), []);

  const renderLandscapeCard = useCallback((item: MediaItem) => (
    <TVEpisodeCard item={item} />
  ), []);

  return (
    <TVShell currentRoute="Home" railFocusSignal={railFocusSignal}>
      {/* Ambient backdrop — sits behind everything, fades to focused item */}
      <TVAmbientBackdrop />
      {/* @ts-ignore — TVFocusGuideView props from react-native-tvos */}
      <TVFocusGuideView style={{ flex: 1 }}>
      <ScrollView
        ref={scrollViewRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 20 }}
        overScrollMode="never"
      >
        {allFailed && (
          <TVHomeErrorState
            errorMessage={featuredQuery.error?.message}
            onRetry={() => {
              featuredQuery.refetch();
              resumeQuery.refetch();
              nextUpQuery.refetch();
              librariesQuery.refetch();
            }}
            onLogout={handleLogout}
          />
        )}

        {/* Loading skeleton */}
        {!allFailed && isLoading && (
          <>
            <SkeletonHero height={HERO_H} />
            <SkeletonRow landscape />
            <SkeletonRow />
          </>
        )}

        {/* Content */}
        {!allFailed && !isLoading && (
          <>
            {featured && featured.length > 0 && (
              <TVHeroBillboard
                items={featured}
                onPlay={navigateToPlay}
                onDetail={navigateToDetail}
                onBannerFocus={() => scrollViewRef.current?.scrollTo({ y: 0, animated: true })}
                onItemChange={setFocusedItem}
              />
            )}

            {resume && resume.length > 0 && (
              <FocusableRow
                title={t("resumeWatching")}
                data={resume}
                renderItem={renderLandscapeCard}
                keyExtractor={(item) => item.Id}
                itemWidth={TV_EPISODE_WIDTH.md}
                style={{ marginTop: Spacing.sectionGap }}
                onItemPress={navigateToPlay}
                onItemFocus={(item) => setFocusedItem(item)}
                onLayout={(e) => rowYMap.current.set("resume", e.nativeEvent.layout.y)}
                onRowFocus={() => scrollToRow("resume")}
              />
            )}

            {nextUp && nextUp.length > 0 && (
              <FocusableRow
                title={t("nextEpisodes")}
                data={nextUp}
                renderItem={renderPortraitCard}
                keyExtractor={(item) => item.Id}
                itemWidth={TV_POSTER_WIDTH.md}
                style={{ marginTop: Spacing.sectionGap }}
                onItemPress={navigateToDetail}
                onItemFocus={(item) => setFocusedItem(item)}
                onLayout={(e) => rowYMap.current.set("nextUp", e.nativeEvent.layout.y)}
                onRowFocus={() => scrollToRow("nextUp")}
              />
            )}

            {watchlist && watchlist.length > 0 && (
              <FocusableRow
                title={t("myList")}
                data={watchlist}
                renderItem={renderPortraitCard}
                keyExtractor={(item) => item.Id}
                itemWidth={TV_POSTER_WIDTH.md}
                style={{ marginTop: Spacing.sectionGap }}
                onItemPress={navigateToDetail}
                onItemFocus={(item) => setFocusedItem(item)}
                onLayout={(e) => rowYMap.current.set("watchlist", e.nativeEvent.layout.y)}
                onRowFocus={() => scrollToRow("watchlist")}
              />
            )}

            {(libraries ?? []).map((lib) => (
              <TVLibraryRow
                key={lib.Id}
                libraryId={lib.Id}
                libraryName={lib.Name}
                renderCard={renderPortraitCard}
                onItemPress={navigateToDetail}
                onItemFocus={(item) => setFocusedItem(item)}
                onLayout={(e) => rowYMap.current.set(`lib_${lib.Id}`, e.nativeEvent.layout.y)}
                onRowFocus={() => scrollToRow(`lib_${lib.Id}`)}
              />
            ))}
          </>
        )}
      </ScrollView>
      </TVFocusGuideView>
    </TVShell>
  );
}
