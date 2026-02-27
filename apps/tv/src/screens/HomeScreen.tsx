import { useCallback } from "react";
import { View, ScrollView, Text } from "react-native";
import {
  useFeaturedItems, useResumeItems, useNextUp,
  useLibraries, useLatestItems,
  useTentacleConfig, useJellyfinClient,
} from "@tentacle/api-client";
import type { MediaItem } from "@tentacle/shared";
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
import { Colors, Spacing, CardConfig, Typography } from "../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

const SCREEN_H = require("react-native").Dimensions.get("window").height;
const HERO_H = Math.round(SCREEN_H * 0.65);

export function HomeScreen({ navigation }: Props) {
  const { t } = useTranslation("common");
  const { storage } = useTentacleConfig();
  const { openSidebar } = useSidebar();
  const featuredQuery = useFeaturedItems();
  const resumeQuery = useResumeItems();
  const nextUpQuery = useNextUp();
  const librariesQuery = useLibraries();

  const featured = featuredQuery.data;
  const resume = resumeQuery.data;
  const nextUp = nextUpQuery.data;
  const libraries = librariesQuery.data;

  const allFailed = featuredQuery.isError && librariesQuery.isError;
  const isLoading = (featuredQuery.isLoading || librariesQuery.isLoading) && !featured && !libraries;

  const navigateToDetail = useCallback((item: MediaItem) => {
    navigation.navigate("MediaDetail", { itemId: item.Id });
  }, [navigation]);

  const navigateToPlay = useCallback((item: MediaItem) => {
    navigation.navigate("Player", { itemId: item.Id });
  }, [navigation]);

  const handleSidebarNav = useCallback((screen: string) => {
    if (screen === "Search") navigation.navigate("Search");
    else if (screen === "Preferences") navigation.navigate("Preferences");
    else if (screen === "About") navigation.navigate("About");
    else if (screen === "Logout") {
      storage.removeItem("tentacle_token");
      storage.removeItem("tentacle_user");
      navigation.replace("PairCode");
    }
  }, [navigation, storage]);

  const handleLogout = useCallback(() => {
    storage.removeItem("tentacle_token");
    storage.removeItem("tentacle_user");
    navigation.replace("PairCode");
  }, [storage, navigation]);

  const renderPortraitCard = useCallback((item: MediaItem) => (
    <TVMediaCard item={item} variant="portrait" />
  ), []);

  const renderLandscapeCard = useCallback((item: MediaItem) => (
    <TVMediaCard item={item} variant="landscape" />
  ), []);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bgDeep }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 60, flexGrow: 1 }}>
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
              <Focusable onPress={() => {
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
              <Focusable onPress={handleLogout}>
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
              <TVHeroBanner items={featured} onPlay={navigateToPlay} onDetail={navigateToDetail} />
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
              />
            )}

            {(libraries ?? []).map((lib) => (
              <LibraryRow
                key={lib.Id}
                libraryId={lib.Id}
                libraryName={lib.Name}
                renderCard={renderPortraitCard}
                onItemPress={navigateToDetail}
              />
            ))}
          </>
        )}
      </ScrollView>

      {/* Sidebar overlay */}
      <Sidebar onNavigate={handleSidebarNav} currentRoute="Home" />
    </View>
  );
}

function LibraryRow({ libraryId, libraryName, renderCard, onItemPress }: {
  libraryId: string; libraryName: string;
  renderCard: (item: MediaItem) => React.ReactNode;
  onItemPress: (item: MediaItem) => void;
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
    />
  );
}
