import { useCallback, useRef } from "react";
import { View, ScrollView, Text, TVFocusGuideView, type LayoutChangeEvent } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import { useTVRemote } from "../components/focus/useTVRemote";
import {
  useFeaturedItems, useResumeItems, useNextUp,
  useLibraries, useLatestItems, useWatchlist,
  useTentacleConfig, useHomeWebSocket,
  setPreferencesToken,
} from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { useTranslation } from "react-i18next";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { Sidebar } from "../components/Sidebar";
import { useSidebar } from "../context/SidebarContext";
import { TVHeroBanner } from "../components/TVHeroBanner";
import { TVMediaCard } from "../components/TVMediaCard";
import { FocusableRow } from "../components/focus/FocusableRow";
import { Focusable } from "../components/focus/Focusable";
import { SkeletonHero, SkeletonRow } from "../components/SkeletonLoader";
import { MenuIcon, SearchIcon } from "../components/icons/TVIcons";
import { Colors, Spacing, CardConfig, Typography, HeroConfig } from "../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

const SCREEN_H = require("react-native").Dimensions.get("window").height;
const HERO_H = Math.round(SCREEN_H * HeroConfig.heightRatio);

export function HomeScreen({ navigation }: Props) {
  const { t } = useTranslation("common");
  const { storage } = useTentacleConfig();
  const queryClient = useQueryClient();
  useHomeWebSocket({ token: storage.getItem("tentacle_token") });
  const { openSidebar, isVisible: sidebarOpen } = useSidebar();

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
    navigation.navigate("MediaDetail", { itemId: item.Id });
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
      navigation.reset({ index: 0, routes: [{ name: "PairCode" }] });
    } else if (screen.startsWith("Library_")) {
      const libId = screen.replace("Library_", "");
      const lib = libraries?.find((l) => l.Id === libId);
      navigation.navigate("Library", {
        libraryId: libId,
        libraryName: lib?.Name ?? "",
      });
    }
  }, [navigation, storage, libraries]);

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
    <TVMediaCard item={item} variant="portrait" />
  ), []);

  const renderLandscapeCard = useCallback((item: MediaItem) => (
    <TVMediaCard item={item} variant="landscape" />
  ), []);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bgDeep }}>
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
        {/* Top bar — overlays hero via negative margin */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            paddingHorizontal: 20,
            paddingTop: 16,
            marginBottom: -64,
            zIndex: 50,
          }}
          pointerEvents={sidebarOpen ? "none" : "auto"}
        >
          <Focusable ref={menuBtnRef} variant="button" onPress={openSidebar}>
            <View style={{
              width: 48, height: 48, borderRadius: 24,
              backgroundColor: "rgba(15, 15, 24, 0.8)",
              borderWidth: 1, borderColor: Colors.glassBorder,
              justifyContent: "center", alignItems: "center",
            }}>
              <MenuIcon size={20} color={Colors.accentPurpleLight} />
            </View>
          </Focusable>
          <Focusable variant="button" onPress={() => navigation.navigate("Search")}>
            <View style={{
              width: 48, height: 48, borderRadius: 24,
              backgroundColor: "rgba(15, 15, 24, 0.8)",
              borderWidth: 1, borderColor: Colors.glassBorder,
              justifyContent: "center", alignItems: "center",
            }}>
              <SearchIcon size={20} color={Colors.accentPurpleLight} />
            </View>
          </Focusable>
        </View>

        {/* Error state */}
        {allFailed && (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: Spacing.screenPadding }}>
            <Text style={{ color: Colors.error, ...Typography.sectionTitle, marginBottom: 12 }}>
              {t("connectionError", { defaultValue: "Connection error" })}
            </Text>
            <Text style={{ color: Colors.textMuted, ...Typography.body, textAlign: "center", marginBottom: 24 }}>
              {String(featuredQuery.error?.message || "Network request failed")}
            </Text>
            <View style={{ flexDirection: "row", gap: Spacing.buttonGap }}>
              <Focusable variant="button" onPress={() => {
                featuredQuery.refetch();
                resumeQuery.refetch();
                nextUpQuery.refetch();
                librariesQuery.refetch();
              }} hasTVPreferredFocus>
                <View style={{
                  backgroundColor: Colors.accentPurple,
                  paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12,
                }}>
                  <Text style={{ color: Colors.textPrimary, ...Typography.buttonMedium }}>
                    {t("retry", { defaultValue: "Retry" })}
                  </Text>
                </View>
              </Focusable>
              <Focusable variant="button" onPress={handleLogout}>
                <View style={{
                  backgroundColor: Colors.glassBg,
                  paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12,
                  borderWidth: 1, borderColor: Colors.glassBorder,
                }}>
                  <Text style={{ color: Colors.textSecondary, ...Typography.buttonMedium }}>
                    {t("reconnect", { defaultValue: "Re-pair" })}
                  </Text>
                </View>
              </Focusable>
            </View>
          </View>
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
              <TVHeroBanner
                items={featured}
                onPlay={navigateToPlay}
                onDetail={navigateToDetail}
                onBannerFocus={() => scrollViewRef.current?.scrollTo({ y: 0, animated: true })}
              />
            )}

            {watchlist && watchlist.length > 0 && (
              <FocusableRow
                title={t("myList")}
                data={watchlist}
                renderItem={renderPortraitCard}
                keyExtractor={(item) => item.Id}
                itemWidth={CardConfig.portrait.width}
                style={{ marginTop: Spacing.sectionGap }}
                onItemPress={navigateToDetail}
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
                itemWidth={CardConfig.landscape.width}
                style={{ marginTop: Spacing.sectionGap }}
                onItemPress={navigateToDetail}
                onLayout={(e) => rowYMap.current.set("resume", e.nativeEvent.layout.y)}
                onRowFocus={() => scrollToRow("resume")}
              />
            )}

            {nextUp && nextUp.length > 0 && (
              <FocusableRow
                title={t("nextEpisodes")}
                data={nextUp}
                renderItem={renderLandscapeCard}
                keyExtractor={(item) => item.Id}
                itemWidth={CardConfig.landscape.width}
                style={{ marginTop: Spacing.sectionGap }}
                onItemPress={navigateToDetail}
                onLayout={(e) => rowYMap.current.set("nextUp", e.nativeEvent.layout.y)}
                onRowFocus={() => scrollToRow("nextUp")}
              />
            )}

            {(libraries ?? []).map((lib) => (
              <LibraryRow
                key={lib.Id}
                libraryId={lib.Id}
                libraryName={lib.Name}
                renderCard={renderPortraitCard}
                onItemPress={navigateToDetail}
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

function LibraryRow({ libraryId, libraryName, renderCard, onItemPress, onLayout, onRowFocus }: {
  libraryId: string; libraryName: string;
  renderCard: (item: MediaItem) => React.ReactNode;
  onItemPress: (item: MediaItem) => void;
  onLayout?: (event: LayoutChangeEvent) => void;
  onRowFocus?: () => void;
}) {
  const { data } = useLatestItems(libraryId);
  const { t } = useTranslation("common");
  if (!data || data.length === 0) return null;
  return (
    <FocusableRow
      title={t("latestAdditions", { name: libraryName })}
      data={data}
      renderItem={renderCard}
      keyExtractor={(item) => item.Id}
      itemWidth={CardConfig.portrait.width}
      style={{ marginTop: Spacing.sectionGap }}
      onItemPress={onItemPress}
      onLayout={onLayout}
      onRowFocus={onRowFocus}
    />
  );
}
