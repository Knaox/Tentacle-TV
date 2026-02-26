import { useCallback } from "react";
import { View, ScrollView } from "react-native";
import {
  useFeaturedItems, useResumeItems, useNextUp,
  useLibraries, useLatestItems,
} from "@tentacle/api-client";
import type { MediaItem } from "@tentacle/shared";
import { useTranslation } from "react-i18next";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { Sidebar } from "../components/Sidebar";
import { TVHeroBanner } from "../components/TVHeroBanner";
import { TVMediaCard } from "../components/TVMediaCard";
import { FocusableRow } from "../components/focus/FocusableRow";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export function HomeScreen({ navigation }: Props) {
  const { t } = useTranslation("common");
  const { data: featured } = useFeaturedItems();
  const { data: resume } = useResumeItems();
  const { data: nextUp } = useNextUp();
  const { data: libraries } = useLibraries();

  const navigateToDetail = useCallback((item: MediaItem) => {
    navigation.navigate("MediaDetail", { itemId: item.Id });
  }, [navigation]);

  const navigateToPlay = useCallback((item: MediaItem) => {
    navigation.navigate("Player", { itemId: item.Id });
  }, [navigation]);

  const handleSidebarNav = useCallback((screen: string) => {
    if (screen === "Search") navigation.navigate("Search");
  }, [navigation]);

  const renderCard = useCallback((item: MediaItem) => (
    <TVMediaCard item={item} />
  ), []);

  return (
    <View style={{ flex: 1, flexDirection: "row", backgroundColor: "#0a0a0f" }}>
      <Sidebar onNavigate={handleSidebarNav} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 48 }}>
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
