import { View, Text, Image } from "react-native";
import { useJellyfinClient } from "@tentacle/api-client";
import type { MediaItem } from "@tentacle/shared";

interface TVMediaCardProps {
  item: MediaItem;
  width?: number;
}

export function TVMediaCard({ item, width = 180 }: TVMediaCardProps) {
  const client = useJellyfinClient();
  const poster = client.getImageUrl(item.Id, "Primary", { height: 400, quality: 85 });
  const progress = item.UserData?.PlayedPercentage;

  return (
    <View style={{ width, backgroundColor: "#12121a", borderRadius: 10, overflow: "hidden" }}>
      <Image
        source={{ uri: poster }}
        style={{ width, height: width * 1.5, backgroundColor: "#1e1e2e" }}
        resizeMode="cover"
      />
      {progress != null && progress > 0 && (
        <View style={{ height: 3, backgroundColor: "#1e1e2e" }}>
          <View style={{ height: 3, width: `${progress}%`, backgroundColor: "#8b5cf6" }} />
        </View>
      )}
      <View style={{ padding: 8 }}>
        <Text numberOfLines={1} style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>
          {item.Name}
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 2 }}>
          {item.ProductionYear ?? ""} {item.Type === "Movie" ? "Film" : item.Type === "Series" ? "Série" : ""}
        </Text>
      </View>
    </View>
  );
}
