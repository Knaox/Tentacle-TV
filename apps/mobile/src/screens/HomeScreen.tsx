import { useCallback } from "react";
import { ScrollView, View, Text, Pressable } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import {
  useFeaturedItems, useResumeItems, useNextUp,
  useLibraries, useLatestItems, useJellyfinClient,
} from "@tentacle/api-client";
import type { MediaItem } from "@tentacle/shared";
import { useTranslation } from "react-i18next";
import { MobileMediaCard } from "../components/MobileMediaCard";
import { MediaRow } from "../components/MediaRow";

export function HomeScreen() {
  const { t } = useTranslation("common");
  const router = useRouter();
  const { data: featured } = useFeaturedItems();
  const { data: resume } = useResumeItems();
  const { data: nextUp } = useNextUp();
  const { data: libraries } = useLibraries();

  const handlePress = useCallback((item: MediaItem) => {
    router.push(`/media/${item.Id}`);
  }, [router]);

  const renderCard = useCallback((item: MediaItem) => (
    <MobileMediaCard item={item} onPress={() => handlePress(item)} />
  ), [handlePress]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#0a0a0f" }} contentContainerStyle={{ paddingBottom: 24 }}>
      {featured && featured.length > 0 && (
        <MobileHero item={featured[0]} onPress={() => handlePress(featured[0])} />
      )}
      {resume && resume.length > 0 && (
        <MediaRow title={t("common:resumeWatching")} data={resume} renderItem={renderCard} />
      )}
      {nextUp && nextUp.length > 0 && (
        <MediaRow title={t("common:nextEpisodes")} data={nextUp} renderItem={renderCard} />
      )}
      {(libraries ?? []).map((lib) => (
        <LibraryRow key={lib.Id} libraryId={lib.Id} libraryName={lib.Name} renderCard={renderCard} />
      ))}
    </ScrollView>
  );
}

function MobileHero({ item, onPress }: { item: MediaItem; onPress: () => void }) {
  const client = useJellyfinClient();
  const backdrop = client.getImageUrl(item.Id, "Backdrop", { width: 800, quality: 70 });

  return (
    <Pressable onPress={onPress} style={{ height: 220, marginBottom: 16 }}>
      <Image source={{ uri: backdrop }} style={{ width: "100%", height: "100%", position: "absolute" }} contentFit="cover" />
      <View style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        paddingHorizontal: 16, paddingBottom: 16, paddingTop: 40,
      }}>
        <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, top: 0, backgroundColor: "rgba(10,10,15,0.7)" }} />
        <Text style={{ color: "#fff", fontSize: 22, fontWeight: "800", position: "relative" }}>{item.Name}</Text>
        {item.Overview && (
          <Text numberOfLines={2} style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, marginTop: 4, position: "relative" }}>
            {item.Overview}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

function LibraryRow({ libraryId, libraryName, renderCard }: {
  libraryId: string; libraryName: string; renderCard: (item: MediaItem) => React.ReactNode;
}) {
  const { data } = useLatestItems(libraryId);
  if (!data || data.length === 0) return null;
  const { t } = useTranslation("common");
  return <MediaRow title={t("common:latestAdditions", { name: libraryName })} data={data} renderItem={renderCard} />;
}
