import { useState } from "react";
import { View, Text, Image, ScrollView } from "react-native";
import { useSeasons, useEpisodes, useJellyfinClient } from "@tentacle/api-client";
import type { MediaItem } from "@tentacle/shared";
import { formatDuration } from "@tentacle/shared";
import { Focusable } from "./focus/Focusable";
import { CheckIcon } from "./icons/TVIcons";
import { Colors, Spacing, Typography, Radius, CardConfig } from "../theme/colors";

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
    <View>
      {/* Season pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: Spacing.screenPadding, gap: 10 }}
      >
        {(seasons ?? []).map((season) => (
          <Focusable key={season.Id} onPress={() => setSelectedSeason(season.Id)}>
            <View style={{
              paddingHorizontal: 24, paddingVertical: 12, borderRadius: Radius.pill,
              backgroundColor: season.Id === activeSeasonId
                ? Colors.accentPurple
                : "rgba(255,255,255,0.06)",
              borderWidth: 1,
              borderColor: season.Id === activeSeasonId
                ? Colors.accentPurple
                : "rgba(255,255,255,0.08)",
            }}>
              <Text style={{
                color: Colors.textPrimary, fontSize: 15,
                fontWeight: season.Id === activeSeasonId ? "700" : "500",
              }}>
                {season.Name}
              </Text>
            </View>
          </Focusable>
        ))}
      </ScrollView>

      {/* Episodes */}
      <ScrollView
        style={{ marginTop: 24, maxHeight: 500 }}
        contentContainerStyle={{ paddingHorizontal: Spacing.screenPadding, gap: 8 }}
      >
        {(episodes ?? []).map((ep) => {
          const thumb = client.getImageUrl(ep.Id, "Primary", { width: 400, quality: 80 });
          const progress = ep.UserData?.PlayedPercentage ?? 0;
          const isWatched = ep.UserData?.Played === true;
          const runtime = ep.RunTimeTicks ? formatDuration(ep.RunTimeTicks) : null;

          return (
            <Focusable key={ep.Id} onPress={() => onPlay(ep)}>
              <View style={{
                flexDirection: "row", alignItems: "center", gap: 20,
                paddingVertical: 14, paddingHorizontal: 16,
                borderRadius: Radius.small,
                backgroundColor: "rgba(255,255,255,0.02)",
              }}>
                {/* Thumbnail */}
                <View style={{
                  width: 200, height: 112,
                  borderRadius: Radius.small, overflow: "hidden",
                  backgroundColor: Colors.bgElevated,
                }}>
                  <Image
                    source={{ uri: thumb }}
                    style={{ width: 200, height: 112 }}
                    resizeMode="cover"
                  />
                  {progress > 0 && !isWatched && (
                    <View style={{
                      position: "absolute", bottom: 0, left: 0, right: 0,
                      height: CardConfig.progressBarHeight, backgroundColor: "rgba(0,0,0,0.5)",
                    }}>
                      <View style={{
                        height: CardConfig.progressBarHeight,
                        width: `${Math.min(progress, 100)}%`,
                        backgroundColor: Colors.progressOrange, borderRadius: 2,
                      }} />
                    </View>
                  )}
                  {isWatched && (
                    <View style={{
                      position: "absolute", top: 6, right: 6,
                      width: 22, height: 22, borderRadius: 11,
                      backgroundColor: Colors.success,
                      justifyContent: "center", alignItems: "center",
                    }}>
                      <CheckIcon size={12} color={Colors.textPrimary} />
                    </View>
                  )}
                </View>

                {/* Info */}
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    {ep.IndexNumber != null && (
                      <Text style={{ color: Colors.accentPurpleLight, fontSize: 14, fontWeight: "700" }}>
                        E{String(ep.IndexNumber).padStart(2, "0")}
                      </Text>
                    )}
                    <Text numberOfLines={1} style={{ color: Colors.textPrimary, fontSize: 16, fontWeight: "600", flex: 1 }}>
                      {ep.Name}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
                    {runtime && (
                      <Text style={{ color: Colors.textTertiary, ...Typography.caption }}>{runtime}</Text>
                    )}
                  </View>
                  {ep.Overview && (
                    <Text
                      numberOfLines={1}
                      style={{ color: Colors.textMuted, ...Typography.caption, marginTop: 6, lineHeight: 18 }}
                    >
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
