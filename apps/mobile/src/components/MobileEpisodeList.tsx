import { useState } from "react";
import { View, Text, Pressable, FlatList } from "react-native";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import { useSeasons, useEpisodes, useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { colors } from "@/theme";

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

function EpisodeThumb({ ep, seriesId, client }: {
  ep: MediaItem; seriesId: string; client: ReturnType<typeof useJellyfinClient>;
}) {
  const hasPrimary = !!ep.ImageTags?.Primary;
  const thumbUrl = hasPrimary
    ? client.getImageUrl(ep.Id, "Primary", { width: 300, quality: 70 })
    : client.getImageUrl(seriesId, "Backdrop", { width: 300, quality: 70 });
  const [imgError, setImgError] = useState(false);

  if (imgError) {
    return (
      <View style={{ width: "100%", height: "100%", alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceElevated }}>
        <Text style={{ fontSize: 18, fontWeight: "700", color: colors.textMuted }}>
          {ep.IndexNumber != null ? `E${ep.IndexNumber}` : ep.Name?.charAt(0).toUpperCase() ?? "?"}
        </Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: thumbUrl }}
      style={{ width: "100%", height: "100%" }}
      contentFit="cover"
      onError={() => setImgError(true)}
    />
  );
}

function EpisodeItems({ seriesId, seasonId, onPlay }: {
  seriesId: string; seasonId: string; onPlay: (ep: MediaItem) => void;
}) {
  const { t } = useTranslation("common");
  const thumbW = 110;
  const thumbH = 62;
  const client = useJellyfinClient();
  const { data: episodes } = useEpisodes(seriesId, seasonId);

  if (!episodes || episodes.length === 0) return null;

  return (
    <View style={{ paddingHorizontal: 16, gap: 8 }}>
      {episodes.map((ep) => {
        const progress = ep.UserData?.PlayedPercentage;
        const isWatched = ep.UserData?.Played === true;
        const runtime = ep.RunTimeTicks ? Math.round(ep.RunTimeTicks / 600_000_000) : null;
        const epLabel = ep.IndexNumber != null
          ? `S${String(ep.ParentIndexNumber ?? 1).padStart(2, "0")}E${String(ep.IndexNumber).padStart(2, "0")} \u00b7 `
          : "";

        return (
          <Pressable key={ep.Id} onPress={() => onPlay(ep)}
            style={{ flexDirection: "row", backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 10, overflow: "hidden", minHeight: thumbH }}
          >
            <View style={{ width: thumbW, height: thumbH, alignSelf: "center", backgroundColor: colors.surfaceElevated, borderRadius: 6, overflow: "hidden" }}>
              <EpisodeThumb ep={ep} seriesId={seriesId} client={client} />
              {progress != null && progress > 0 && (
                <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, backgroundColor: "rgba(255,255,255,0.2)" }}>
                  <View style={{ height: "100%", width: `${progress}%`, backgroundColor: "#8b5cf6" }} />
                </View>
              )}
              {isWatched && (
                <View style={{
                  position: "absolute", bottom: 4, right: 4,
                  width: 18, height: 18, borderRadius: 9,
                  backgroundColor: colors.success,
                  alignItems: "center", justifyContent: "center",
                }}>
                  <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>{"\u2713"}</Text>
                </View>
              )}
            </View>
            <View style={{ flex: 1, padding: 10, justifyContent: "center" }}>
              <Text numberOfLines={1} style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>
                {epLabel}{ep.Name}
              </Text>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 2 }}>
                {runtime && <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>{t("minutesShort", { count: runtime })}</Text>}
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
