import { View, Text, ScrollView, Pressable, Dimensions } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useMediaItem, useSimilarItems, useJellyfinClient } from "@tentacle/api-client";
import type { MediaItem } from "@tentacle/shared";
import { MobileMediaCard } from "../components/MobileMediaCard";
import { MediaRow } from "../components/MediaRow";
import { MobileEpisodeList } from "../components/MobileEpisodeList";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface Props {
  itemId: string;
}

export function MediaDetailScreen({ itemId }: Props) {
  const router = useRouter();
  const client = useJellyfinClient();
  const { data: item } = useMediaItem(itemId);
  const { data: similar } = useSimilarItems(itemId);

  if (!item) {
    return <View style={{ flex: 1, backgroundColor: "#0a0a0f" }} />;
  }

  const backdrop = client.getImageUrl(item.Id, "Backdrop", { width: 800, quality: 70 });
  const poster = client.getImageUrl(item.Id, "Primary", { height: 400, quality: 85 });
  const isSeries = item.Type === "Series";
  const year = item.ProductionYear;
  const rating = item.CommunityRating?.toFixed(1);
  const runtime = item.RunTimeTicks ? Math.round(item.RunTimeTicks / 600_000_000) : null;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#0a0a0f" }} contentContainerStyle={{ paddingBottom: 32 }}>
      {/* Backdrop */}
      <View style={{ width: SCREEN_WIDTH, height: 260 }}>
        <Image source={{ uri: backdrop }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
        <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 120, backgroundColor: "rgba(10,10,15,0.85)" }} />
      </View>

      {/* Poster + Info */}
      <View style={{ flexDirection: "row", paddingHorizontal: 16, marginTop: -100 }}>
        <Image source={{ uri: poster }} style={{ width: 120, height: 180, borderRadius: 10, backgroundColor: "#1e1e2e" }} contentFit="cover" />
        <View style={{ flex: 1, marginLeft: 16, justifyContent: "flex-end" }}>
          <Text style={{ color: "#fff", fontSize: 20, fontWeight: "800" }}>{item.Name}</Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 4, flexWrap: "wrap", alignItems: "center" }}>
            {year && <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>{year}</Text>}
            {rating && <Text style={{ color: "#fbbf24", fontSize: 13 }}>★ {rating}</Text>}
            {runtime && <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>{runtime} min</Text>}
            {isSeries && item.ChildCount && (
              <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>{item.ChildCount} saisons</Text>
            )}
          </View>
        </View>
      </View>

      {/* Play button */}
      <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
        <Pressable
          onPress={() => router.push(`/watch/${item.Id}`)}
          style={{
            backgroundColor: "#8b5cf6", borderRadius: 10,
            paddingVertical: 14, alignItems: "center",
          }}
        >
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>
            {item.UserData?.PlaybackPositionTicks ? "Reprendre" : "Lecture"}
          </Text>
        </Pressable>
      </View>

      {/* Genres */}
      {item.Genres && item.Genres.length > 0 && (
        <View style={{ flexDirection: "row", gap: 6, marginTop: 12, paddingHorizontal: 16, flexWrap: "wrap" }}>
          {item.Genres.map((g) => (
            <View key={g} style={{ backgroundColor: "rgba(255,255,255,0.08)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
              <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }}>{g}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Overview */}
      {item.Overview && (
        <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, lineHeight: 20, marginTop: 12, paddingHorizontal: 16 }}>
          {item.Overview}
        </Text>
      )}

      {/* Episodes */}
      {isSeries && (
        <MobileEpisodeList seriesId={item.Id} onPlay={(ep) => router.push(`/watch/${ep.Id}`)} />
      )}

      {/* Similar */}
      {similar && similar.length > 0 && (
        <MediaRow
          title="Recommandations"
          data={similar}
          renderItem={(s: MediaItem) => (
            <MobileMediaCard item={s} onPress={() => router.push(`/media/${s.Id}`)} />
          )}
        />
      )}
    </ScrollView>
  );
}
