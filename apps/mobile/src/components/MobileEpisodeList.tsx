import { useState } from "react";
import { View, Text, Pressable, FlatList } from "react-native";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import { useSeasons, useEpisodes, useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";

interface Props {
  seriesId: string;
  onPlay: (episode: MediaItem) => void;
}

export function MobileEpisodeList({ seriesId, onPlay }: Props) {
  const { data: seasons } = useSeasons(seriesId);
  const [selectedSeason, setSelectedSeason] = useState<string | undefined>(undefined);

  const activeSeason = selectedSeason ?? seasons?.[0]?.Id;

  return (
    <View style={{ marginTop: 24 }}>
      {/* Season tabs */}
      {seasons && seasons.length > 0 && (
        <FlatList
          horizontal
          data={seasons}
          keyExtractor={(s) => s.Id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8, marginBottom: 12 }}
          renderItem={({ item: season }) => (
            <Pressable
              onPress={() => setSelectedSeason(season.Id)}
              style={{
                backgroundColor: activeSeason === season.Id ? "#8b5cf6" : "rgba(255,255,255,0.05)",
                paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
              }}
            >
              <Text style={{
                color: activeSeason === season.Id ? "#fff" : "rgba(255,255,255,0.6)",
                fontSize: 13, fontWeight: "600",
              }}>
                {season.Name}
              </Text>
            </Pressable>
          )}
        />
      )}

      {activeSeason && <EpisodeItems seriesId={seriesId} seasonId={activeSeason} onPlay={onPlay} />}
    </View>
  );
}

function EpisodeItems({ seriesId, seasonId, onPlay }: {
  seriesId: string; seasonId: string; onPlay: (ep: MediaItem) => void;
}) {
  const { t } = useTranslation("common");
  const client = useJellyfinClient();
  const { data: episodes } = useEpisodes(seriesId, seasonId);

  if (!episodes || episodes.length === 0) return null;

  return (
    <View style={{ paddingHorizontal: 16, gap: 8 }}>
      {episodes.map((ep) => {
        const thumb = client.getImageUrl(ep.Id, "Primary", { width: 300, quality: 70 });
        const progress = ep.UserData?.PlayedPercentage;
        const runtime = ep.RunTimeTicks ? Math.round(ep.RunTimeTicks / 600_000_000) : null;

        return (
          <Pressable key={ep.Id} onPress={() => onPlay(ep)}
            style={{ flexDirection: "row", backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 10, overflow: "hidden" }}
          >
            <View style={{ width: 140, height: 80, backgroundColor: "#1e1e2e" }}>
              <Image source={{ uri: thumb }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
              {progress != null && progress > 0 && (
                <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, backgroundColor: "rgba(255,255,255,0.2)" }}>
                  <View style={{ height: "100%", width: `${progress}%`, backgroundColor: "#8b5cf6" }} />
                </View>
              )}
            </View>
            <View style={{ flex: 1, padding: 10, justifyContent: "center" }}>
              <Text numberOfLines={1} style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>
                {ep.IndexNumber != null ? `${ep.IndexNumber}. ` : ""}{ep.Name}
              </Text>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 2 }}>
                {runtime && <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>{t("common:minutesShort", { count: runtime })}</Text>}
              </View>
              {ep.Overview && (
                <Text numberOfLines={2} style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 4, lineHeight: 15 }}>
                  {ep.Overview}
                </Text>
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
