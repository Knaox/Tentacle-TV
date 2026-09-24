import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { formatEpisodeCode, type SearchMediaItem } from "@tentacle-tv/shared";
import { FONT_FAMILY, RADIUS, spacing, useThemedStyles, type AppTheme } from "@/theme";

/**
 * Les épisodes qui répondent, en liste : la vignette de l'épisode (sinon
 * l'affiche de la série), la série, le code et le titre. Demandés à part au
 * serveur — ils n'ont jamais retardé le reste.
 */
export const EpisodeList = memo(function EpisodeList({ episodes, onOpen }: {
  episodes: SearchMediaItem[];
  onOpen: (id: string) => void;
}) {
  const client = useJellyfinClient();
  const st = useThemedStyles(makeStyles);
  return (
    <View style={st.list}>
      {episodes.map((episode) => {
        const thumb = episode.ImageTags?.Primary
          ? client.getImageUrl(episode.Id, "Primary", { width: 320, quality: 80 })
          : episode.SeriesId && episode.SeriesPrimaryImageTag
            ? client.getImageUrl(episode.SeriesId, "Primary", { height: 200, quality: 80 })
            : null;
        const code = formatEpisodeCode(episode.ParentIndexNumber, episode.IndexNumber, { style: "padded" });
        const progress = episode.UserData?.PlayedPercentage ?? 0;
        return (
          <Pressable
            key={episode.Id}
            onPress={() => onOpen(episode.Id)}
            accessibilityRole="button"
            accessibilityLabel={`${episode.SeriesName ?? ""} ${code} ${episode.Name}`}
            style={({ pressed }) => [st.row, pressed && st.pressed]}
          >
            <View style={st.thumb}>
              {thumb && <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} accessible={false} />}
              {progress > 0 && progress < 100 && (
                <View style={st.track}><View style={[st.bar, { width: `${progress}%` }]} /></View>
              )}
            </View>
            <View style={st.text}>
              <Text style={st.series} numberOfLines={1}>{episode.SeriesName}</Text>
              <Text style={st.name} numberOfLines={2}>{`${code} · ${episode.Name}`}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    list: { paddingHorizontal: spacing.screenPadding, gap: 4 },
    row: { flexDirection: "row" as const, alignItems: "center" as const, gap: 12, minHeight: 72, paddingVertical: 4 },
    pressed: { opacity: 0.7 },
    thumb: {
      width: 112,
      height: 63,
      borderRadius: RADIUS.md,
      overflow: "hidden" as const,
      backgroundColor: t.colors.surface.s2,
    },
    track: { position: "absolute" as const, left: 0, right: 0, bottom: 0, height: 3, backgroundColor: "rgba(0,0,0,0.5)" },
    bar: { height: 3, backgroundColor: t.colors.brand.violet },
    text: { flex: 1, gap: 2 },
    series: { fontSize: 14, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary },
    name: { fontSize: 13, lineHeight: 17, fontFamily: FONT_FAMILY.regular, color: t.colors.text.secondary },
  });
