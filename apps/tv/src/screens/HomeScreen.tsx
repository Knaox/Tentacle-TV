import { useCallback, useRef } from "react";
import { View, ScrollView, Text, TVFocusGuideView } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import { useTVRemote } from "../components/focus/useTVRemote";
import {
  useFeaturedItems, useResumeItems, useNextUp,
  useLibraries, useWatchlist,
  useTentacleConfig, useHomeWebSocket, useAuth,
  setPreferencesToken,
} from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { useTranslation } from "react-i18next";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { Sidebar } from "../components/Sidebar";
import { useSidebar } from "../context/SidebarContext";
import { TVHeroBillboard } from "../components/hero/TVHeroBillboard";
import { TVPosterCard } from "../components/cards/TVPosterCard";
import { TVEpisodeCard } from "../components/cards/TVEpisodeCard";
import { TV_POSTER_WIDTH, TV_EPISODE_WIDTH } from "../components/cards/cardSizes";
import { FocusableRow } from "../components/focus/FocusableRow";
import { SkeletonHero, SkeletonRow } from "../components/SkeletonLoader";
import { Colors, Spacing, HeroConfig } from "../theme/colors";
import { TVHomeTopBar } from "../components/home/TVHomeTopBar";
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
  const { changeServer } = useAuth();
  const queryClient = useQueryClient();
  useHomeWebSocket({ token: storage.getItem("tentacle_token") });
  const { openSidebar, isVisible: sidebarOpen } = useSidebar();
  const { setFocusedItem } = useAmbientFocus();

  // Invalidate volatile queries when screen regains focus (e.g. after Player)
  useFocusEffect(
    useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ["resume-items"] });
      queryClient.invalidateQueries({ queryKey: ["next-up"] });
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
    }, [queryClient])
  );

  // BACK on home screen opens sidebar (Netflix/Plex pattern)
  useTVRemote({ onBack: sidebarOpen ? undefined : openSidebar });

  const scrollViewRef = useRef<ScrollView>(null);
  const rowYMap = useRef<Map<string, number>>(new Map());
  const menuBtnRef = useRef<View>(null);

  // Restore focus to menu button after sidebar closes
  const handleSidebarClosed = useCallback(() => {
    menuBtnRef.current?.setNativeProps?.({ hasTVPreferredFocus: true });
  }, []);

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

  const handleSidebarNav = useCallback((screen: string) => {
    if (screen === "Home") return; // already on Home
    if (screen === "Search") navigation.navigate("Search");
    else if (screen === "Preferences") navigation.navigate("Preferences");
    else if (screen === "About") navigation.navigate("About");
    else if (screen === "Logout") {
      storage.removeItem("tentacle_token");
      storage.removeItem("tentacle_user");
      storage.removeItem("tentacle_jellyfin_token");
      storage.removeItem("tentacle_jellyfin_url");
      setPreferencesToken(null);
      queryClient.clear();
      navigation.reset({ index: 0, routes: [{ name: "Login" }] });
    } else if (screen === "ChangeServer") {
      changeServer.mutate(undefined, {
        onSettled: () => {
          setPreferencesToken(null);
          navigation.reset({ index: 0, routes: [{ name: "PairCode" }] });
        },
      });
    } else if (screen.startsWith("Library_")) {
      const libId = screen.replace("Library_", "");
      const lib = libraries?.find((l) => l.Id === libId);
      navigation.navigate("Library", {
        libraryId: libId,
        libraryName: lib?.Name ?? "",
      });
    }
  }, [navigation, storage, libraries, changeServer, queryClient]);

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
    <View style={{ flex: 1, backgroundColor: Colors.bgDeep }}>
      {/* Ambient backdrop — sits behind everything, fades to focused item */}
      <TVAmbientBackdrop />
      {/* @ts-ignore — TVFocusGuideView props from react-native-tvos */}
      <TVFocusGuideView trapFocusLeft style={{ flex: 1 }}>
      <ScrollView
        ref={scrollViewRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 20 }}
        overScrollMode="never"
        accessible={!sidebarOpen}
        importantForAccessibility={sidebarOpen ? "no-hide-descendants" : "auto"}
      >
        <TVHomeTopBar
          ref={menuBtnRef}
          onMenuPress={openSidebar}
          onSearchPress={() => navigation.navigate("Search")}
          disabled={sidebarOpen}
        />

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

      {/* Sidebar overlay */}
      <Sidebar onNavigate={handleSidebarNav} currentRoute="Home" onClosed={handleSidebarClosed} />
    </View>
  );
}

