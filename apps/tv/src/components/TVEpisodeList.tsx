import { useState } from "react";
import { View, Text, Image, ScrollView } from "react-native";
import { useSeasons, useEpisodes, useJellyfinClient } from "@tentacle/api-client";
import type { MediaItem } from "@tentacle/shared";
import { Focusable } from "./focus/Focusable";

interface TVEpisodeListProps {
  seriesId: string;
  onPlay: (episode: MediaItem) => void;
}

export function TVEpisodeList({ seriesId, onPlay }: TVEpisodeListProps) {
  const client = useJellyfinClient();
  const { data: seasons } = useSeasons(seriesId);
  const [selectedSeason, setSelectedSeason] = useState<string | undefined>(undefined);
  const activeSeasonId = selectedSeason ?? seasons?.[0]?.Id;
  const { data: episodes } = useEpisodes(seriesId, activeSeasonId);

  return (
    <View style={{ marginTop: 24 }}>
      {/* Season tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 48, gap: 8 }}>
        {(seasons ?? []).map((season) => (
          <Focusable key={season.Id} onPress={() => setSelectedSeason(season.Id)}>
            <View style={{
              paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8,
              backgroundColor: season.Id === activeSeasonId ? "#8b5cf6" : "rgba(255,255,255,0.08)",
            }}>
              <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>{season.Name}</Text>
            </View>
          </Focusable>
        ))}
      </ScrollView>

      {/* Episode list */}
      <ScrollView style={{ marginTop: 16, maxHeight: 400 }} contentContainerStyle={{ paddingHorizontal: 48 }}>
        {(episodes ?? []).map((ep) => {
          const thumb = client.getImageUrl(ep.Id, "Primary", { width: 300, quality: 80 });
          const progress = ep.UserData?.PlayedPercentage ?? 0;
          return (
            <Focusable key={ep.Id} onPress={() => onPlay(ep)}>
              <View style={{
                flexDirection: "row", alignItems: "center", gap: 16,
                paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#1e1e2e",
              }}>
                <View style={{ width: 160, height: 90, borderRadius: 6, overflow: "hidden", backgroundColor: "#1e1e2e" }}>
                  <Image source={{ uri: thumb }} style={{ width: 160, height: 90 }} resizeMode="cover" />
                  {progress > 0 && (
                    <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, backgroundColor: "#1e1e2e" }}>
                      <View style={{ height: 3, width: `${progress}%`, backgroundColor: "#8b5cf6" }} />
                    </View>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }} numberOfLines={1}>
                    {ep.IndexNumber != null ? `${ep.IndexNumber}. ` : ""}{ep.Name}
                  </Text>
                  {ep.Overview && (
                    <Text numberOfLines={2} style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 4, lineHeight: 18 }}>
                      {ep.Overview}
                    </Text>
                  )}
                </View>
              </View>
            </Focusable>
          );
        })}
      </ScrollView>
    </View>
  );
}
