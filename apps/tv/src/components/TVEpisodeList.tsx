import { useState, useRef } from "react";
import { View, Text, Image, ScrollView } from "react-native";
import { useSeasons, useEpisodes, useSeriesWatchState, useJellyfinClient } from "@tentacle-tv/api-client";
import { useTranslation } from "react-i18next";
import type { MediaItem } from "@tentacle-tv/shared";
import { formatDuration } from "@tentacle-tv/shared";
import { Focusable } from "./focus/Focusable";
import { CheckIcon } from "./icons/TVIcons";
import { useTVScrollToFocused } from "../hooks/useTVScrollToFocused";
import { Colors, Spacing, Typography, Fonts, Radius, CardConfig } from "../theme/colors";

interface TVEpisodeListProps {
  seriesId: string;
  onPlay: (episode: MediaItem) => void;
}

const EPISODE_ROW_HEIGHT = 148; // paddingVertical 14*2 + thumbnail 112 + gap 8

export function TVEpisodeList({ seriesId, onPlay }: TVEpisodeListProps) {
  const client = useJellyfinClient();
  const { t } = useTranslation("common");
  const { data: seasons } = useSeasons(seriesId);
  // Épisode « courant » (à reprendre / prochain) — surligné comme sur le web,
  // et sa saison est présélectionnée.
  const { data: watchState } = useSeriesWatchState(seriesId);
  const currentEp = watchState && watchState.type !== "completed" ? watchState.episode : undefined;
  const [selectedSeason, setSelectedSeason] = useState<string | undefined>(undefined);
  const activeSeasonId = selectedSeason ?? currentEp?.SeasonId ?? seasons?.[0]?.Id;
  const { data: episodes } = useEpisodes(seriesId, activeSeasonId);
  const episodeScrollRef = useRef<ScrollView>(null);
  const { makeOnFocus } = useTVScrollToFocused(episodeScrollRef, 60);

  return (
    <View>
      {/* Season pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: Spacing.screenPadding, gap: 10 }}
      >
        {(seasons ?? []).map((season) => {
          const active = season.Id === activeSeasonId;
          return (
            <Focusable key={season.Id} variant="button" focusRadius={Radius.pill} onPress={() => setSelectedSeason(season.Id)}>
              <View style={{
                paddingHorizontal: 24, paddingVertical: 12, borderRadius: Radius.pill,
                backgroundColor: active ? "rgba(139, 92, 246, 0.18)" : Colors.ctaGhostBg,
                borderWidth: 1,
                borderColor: active ? "rgba(139, 92, 246, 0.45)" : Colors.glassBorder,
              }}>
                <Text style={{
                  color: active ? Colors.accentPurpleLight : Colors.textSecondary,
                  fontSize: 15,
                  fontFamily: active ? Fonts.bold : Fonts.medium,
                }}>
                  {season.Name}
                </Text>
              </View>
            </Focusable>
          );
        })}
      </ScrollView>

      {/* Episodes */}
      <ScrollView
        ref={episodeScrollRef}
        style={{ marginTop: 24, maxHeight: 500 }}
        contentContainerStyle={{ paddingHorizontal: Spacing.screenPadding, gap: 8 }}
      >
        {(episodes ?? []).map((ep, epIndex) => {
          const thumb = client.getImageUrl(ep.Id, "Primary", { width: 400, quality: 80 });
          const progress = ep.UserData?.PlayedPercentage ?? 0;
          const isWatched = ep.UserData?.Played === true;
          const runtime = ep.RunTimeTicks ? formatDuration(ep.RunTimeTicks) : null;
          // Épisode courant (à reprendre / prochain) — surligné comme le web
          const isCurrent = currentEp?.Id === ep.Id;

          return (
            <Focusable key={ep.Id} variant="row" onPress={() => onPlay(ep)} onFocus={makeOnFocus(epIndex, EPISODE_ROW_HEIGHT)}>
              <View style={{
                flexDirection: "row", alignItems: "center", gap: 20,
                paddingVertical: 14, paddingHorizontal: 16,
                borderRadius: Radius.card,
                backgroundColor: isCurrent ? "rgba(139, 92, 246, 0.14)" : "rgba(255,255,255,0.04)",
                borderWidth: isCurrent ? 1 : 0,
                borderColor: isCurrent ? "rgba(139, 92, 246, 0.45)" : "transparent",
              }}>
                {/* Thumbnail */}
                <View style={{
                  width: 200, aspectRatio: 16 / 9,
                  borderRadius: Radius.small, overflow: "hidden",
                  backgroundColor: Colors.bgElevated,
                }}>
                  <Image
                    source={{ uri: thumb }}
                    style={{ width: "100%", height: "100%" }}
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
                        backgroundColor: Colors.accentPurple, borderRadius: 2,
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
                      <View style={{
                        backgroundColor: "rgba(139, 92, 246, 0.15)",
                        paddingHorizontal: 8, paddingVertical: 3,
                        borderRadius: 4, borderWidth: 1,
                        borderColor: "rgba(139, 92, 246, 0.25)",
                      }}>
                        <Text style={{ color: Colors.textSecondary, fontSize: 13, fontWeight: "700" }}>
                          E{String(ep.IndexNumber).padStart(2, "0")}
                        </Text>
                      </View>
                    )}
                    <Text
                      numberOfLines={1}
                      style={{
                        color: isCurrent ? Colors.accentPurpleLight : Colors.textPrimary,
                        fontSize: 16,
                        fontFamily: isCurrent ? Fonts.bold : Fonts.semibold,
                        flex: 1,
                      }}
                    >
                      {ep.Name}
                    </Text>
                    {isCurrent && (
                      <View style={{
                        backgroundColor: Colors.accentPurple,
                        paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4,
                      }}>
                        <Text style={{ color: "#fff", fontSize: 11, fontFamily: Fonts.bold }}>
                          {(currentEp?.UserData?.PlaybackPositionTicks ?? 0) > 0
                            ? t("resume", { defaultValue: "Reprendre" })
                            : t("nextEpisode", { defaultValue: "À suivre" })}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
                    {runtime && (
                      <Text style={{ color: Colors.textTertiary, ...Typography.caption }}>{runtime}</Text>
                    )}
                  </View>
                  {ep.Overview && (
                    <Text
                      numberOfLines={2}
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
