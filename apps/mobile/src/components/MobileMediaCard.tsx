import { View, Text, Pressable } from "react-native";
import { Image } from "expo-image";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";

interface Props {
  item: MediaItem;
  onPress: () => void;
  width?: number;
}

export function MobileMediaCard({ item, onPress, width }: Props) {
  const client = useJellyfinClient();
  const poster = client.getImageUrl(item.Id, "Primary", { width: 300, quality: 80 });
  const year = item.ProductionYear;
  const progress = item.UserData?.PlayedPercentage;

  return (
    <Pressable onPress={onPress} style={{ width }}>
      <View style={{ aspectRatio: 2 / 3, borderRadius: 10, overflow: "hidden", backgroundColor: "#1e1e2e" }}>
        <Image source={{ uri: poster }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
        {progress != null && progress > 0 && (
          <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, backgroundColor: "rgba(255,255,255,0.2)" }}>
            <View style={{ height: "100%", width: `${progress}%`, backgroundColor: "#8b5cf6" }} />
          </View>
        )}
      </View>
      <Text numberOfLines={1} style={{ color: "#fff", fontSize: 12, fontWeight: "600", marginTop: 6 }}>
        {item.Name}
      </Text>
      {year && (
        <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>{year}</Text>
      )}
    </Pressable>
  );
}
