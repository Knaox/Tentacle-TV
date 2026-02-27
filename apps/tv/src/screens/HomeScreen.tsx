import { useCallback } from "react";
import { View, ScrollView, Text, ActivityIndicator } from "react-native";
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
import { TVHeroBanner } from "../components/TVHeroBanner";
import { TVMediaCard } from "../components/TVMediaCard";
import { FocusableRow } from "../components/focus/FocusableRow";
import { Focusable } from "../components/focus/Focusable";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export function HomeScreen({ navigation }: Props) {
  const { t } = useTranslation("common");
  const { storage } = useTentacleConfig();
  const client = useJellyfinClient();
  const featuredQuery = useFeaturedItems();
  const resumeQuery = useResumeItems();
  const nextUpQuery = useNextUp();
  const librariesQuery = useLibraries();

  const featured = featuredQuery.data;
  const resume = resumeQuery.data;
  const nextUp = nextUpQuery.data;
  const libraries = librariesQuery.data;

  // Check if all queries failed (connection issue)
  const allFailed =
    featuredQuery.isError && librariesQuery.isError;

  // Loading state: queries are fetching and we have no data yet
  const isLoading =
    (featuredQuery.isLoading || librariesQuery.isLoading) &&
    !featured && !libraries;

  const navigateToDetail = useCallback((item: MediaItem) => {
    navigation.navigate("MediaDetail", { itemId: item.Id });
  }, [navigation]);

  const navigateToPlay = useCallback((item: MediaItem) => {
    navigation.navigate("Player", { itemId: item.Id });
  }, [navigation]);

  const handleSidebarNav = useCallback((screen: string) => {
    if (screen === "Search") navigation.navigate("Search");
  }, [navigation]);

  const handleLogout = useCallback(() => {
    storage.removeItem("tentacle_token");
    storage.removeItem("tentacle_user");
    navigation.replace("PairCode");
  }, [storage, navigation]);

  const renderCard = useCallback((item: MediaItem) => (
    <TVMediaCard item={item} />
  ), []);

  return (
    <View style={{ flex: 1, flexDirection: "row", backgroundColor: "#0a0a0f" }}>
      <Sidebar onNavigate={handleSidebarNav} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 48, flexGrow: 1 }}>
        {/* Connection error state */}
        {allFailed && (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 48 }}>
            <Text style={{ color: "#ef4444", fontSize: 22, fontWeight: "700", marginBottom: 12 }}>
              {t("common:connectionError", { defaultValue: "Connection error" })}
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 15, textAlign: "center", marginBottom: 8 }}>
              {String(featuredQuery.error?.message || "Network request failed")}
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, textAlign: "center", marginBottom: 24 }}>
              {client.getBaseUrl()}
            </Text>
            <View style={{ flexDirection: "row", gap: 16 }}>
              <Focusable onPress={() => {
                featuredQuery.refetch();
                resumeQuery.refetch();
                nextUpQuery.refetch();
                librariesQuery.refetch();
              }} hasTVPreferredFocus>
                <View style={{ backgroundColor: "#8b5cf6", paddingHorizontal: 28, paddingVertical: 14, borderRadius: 10 }}>
                  <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>
                    {t("common:retry", { defaultValue: "Retry" })}
                  </Text>
                </View>
              </Focusable>
              <Focusable onPress={handleLogout}>
                <View style={{ backgroundColor: "rgba(255,255,255,0.1)", paddingHorizontal: 28, paddingVertical: 14, borderRadius: 10 }}>
                  <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 16, fontWeight: "600" }}>
                    {t("common:reconnect", { defaultValue: "Re-pair" })}
                  </Text>
                </View>
              </Focusable>
            </View>
          </View>
        )}

        {!allFailed && isLoading && (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 48 }}>
            <ActivityIndicator size="large" color="#8b5cf6" />
            <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 16, marginTop: 16 }}>
              {t("common:loading", { defaultValue: "Loading..." })}
            </Text>
          </View>
        )}

        {!allFailed && !isLoading && (
          <>
            {featured && featured.length > 0 && (
              <TVHeroBanner items={featured} onPlay={navigateToPlay} onDetail={navigateToDetail} />
            )}
            {resume && resume.length > 0 && (
              <FocusableRow
                title={t("common:resumeWatching")}
                data={resume}
                renderItem={renderCard}
                keyExtractor={(item) => item.Id}
                itemWidth={180}
                style={{ marginTop: 24 }}
              />
            )}
            {nextUp && nextUp.length > 0 && (
              <FocusableRow
                title={t("common:nextEpisodes")}
                data={nextUp}
                renderItem={renderCard}
                keyExtractor={(item) => item.Id}
                itemWidth={180}
                style={{ marginTop: 24 }}
              />
            )}
            {(libraries ?? []).map((lib) => (
              <LibraryRow key={lib.Id} libraryId={lib.Id} libraryName={lib.Name} renderCard={renderCard} />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function LibraryRow({ libraryId, libraryName, renderCard }: {
  libraryId: string; libraryName: string; renderCard: (item: MediaItem) => React.ReactNode;
}) {
  const { data } = useLatestItems(libraryId);
  const { t } = useTranslation("common");
  if (!data || data.length === 0) return null;
  return (
    <FocusableRow
      title={t("common:latestAdditions", { name: libraryName })}
      data={data}
      renderItem={renderCard}
      keyExtractor={(item) => item.Id}
      itemWidth={180}
      style={{ marginTop: 24 }}
    />
  );
}
