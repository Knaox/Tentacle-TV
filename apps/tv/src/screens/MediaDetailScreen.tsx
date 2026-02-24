import { View, Text, Image, ScrollView, Dimensions } from "react-native";
import { useMediaItem, useSimilarItems, useJellyfinClient } from "@tentacle/api-client";
import type { MediaItem } from "@tentacle/shared";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { Focusable } from "../components/focus/Focusable";
import { FocusableRow } from "../components/focus/FocusableRow";
import { TVMediaCard } from "../components/TVMediaCard";
import { TVEpisodeList } from "../components/TVEpisodeList";
import { useTVRemote } from "../components/focus/useTVRemote";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
type Props = NativeStackScreenProps<RootStackParamList, "MediaDetail">;

export function MediaDetailScreen({ route, navigation }: Props) {
  const { itemId } = route.params;
  const client = useJellyfinClient();
  const { data: item } = useMediaItem(itemId);
  const { data: similar } = useSimilarItems(itemId);

  useTVRemote({ onBack: () => navigation.goBack() });

  if (!item) return <View style={{ flex: 1, backgroundColor: "#0a0a0f" }} />;

  const backdrop = client.getImageUrl(item.Id, "Backdrop", { width: 1920, quality: 80 });
  const poster = client.getImageUrl(item.Id, "Primary", { height: 500, quality: 90 });
  const isSeries = item.Type === "Series";
  const year = item.ProductionYear;
  const rating = item.CommunityRating?.toFixed(1);
  const runtime = item.RunTimeTicks ? Math.round(item.RunTimeTicks / 600_000_000) : null;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#0a0a0f" }} contentContainerStyle={{ paddingBottom: 60 }}>
      {/* Hero backdrop */}
      <View style={{ width: SCREEN_WIDTH, height: 480 }}>
        <Image source={{ uri: backdrop }} style={{ width: "100%", height: "100%", position: "absolute" }} resizeMode="cover" />
        <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 200, backgroundColor: "rgba(10,10,15,0.8)" }} />
      </View>

      {/* Content */}
      <View style={{ flexDirection: "row", paddingHorizontal: 48, marginTop: -160 }}>
        {/* Poster */}
        <Image source={{ uri: poster }} style={{ width: 200, height: 300, borderRadius: 12, backgroundColor: "#1e1e2e" }} resizeMode="cover" />

        {/* Info */}
        <View style={{ flex: 1, marginLeft: 32, justifyContent: "flex-end" }}>
          <Text style={{ color: "#fff", fontSize: 34, fontWeight: "800" }}>{item.Name}</Text>
          <View style={{ flexDirection: "row", gap: 12, marginTop: 8, alignItems: "center" }}>
            {year && <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 16 }}>{year}</Text>}
            {rating && <Text style={{ color: "#fbbf24", fontSize: 16 }}>★ {rating}</Text>}
            {runtime && <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>{runtime} min</Text>}
            {isSeries && item.ChildCount && (
              <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>{item.ChildCount} saisons</Text>
            )}
          </View>
          {item.Genres && item.Genres.length > 0 && (
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              {item.Genres.map((g) => (
                <View key={g} style={{ backgroundColor: "rgba(255,255,255,0.08)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}>
                  <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>{g}</Text>
                </View>
              ))}
            </View>
          )}
          {item.Overview && (
            <Text numberOfLines={4} style={{ color: "rgba(255,255,255,0.7)", fontSize: 15, marginTop: 12, lineHeight: 22 }}>
              {item.Overview}
            </Text>
          )}
          {/* Play button */}
          <View style={{ flexDirection: "row", gap: 16, marginTop: 20 }}>
            <Focusable onPress={() => navigation.navigate("Player", { itemId: item.Id })} hasTVPreferredFocus>
              <View style={{ backgroundColor: "#8b5cf6", paddingHorizontal: 32, paddingVertical: 12, borderRadius: 8 }}>
                <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>
                  {item.UserData?.PlaybackPositionTicks ? "Reprendre" : "Lecture"}
                </Text>
              </View>
            </Focusable>
          </View>
        </View>
      </View>

      {/* Episodes for series */}
      {isSeries && <TVEpisodeList seriesId={item.Id} onPlay={(ep) => navigation.navigate("Player", { itemId: ep.Id })} />}

      {/* Similar items */}
      {similar && similar.length > 0 && (
        <FocusableRow
          title="Recommandations"
          data={similar}
          renderItem={(s: MediaItem) => <TVMediaCard item={s} />}
          keyExtractor={(s) => s.Id}
          itemWidth={180}
          style={{ marginTop: 32 }}
        />
      )}
    </ScrollView>
  );
}
