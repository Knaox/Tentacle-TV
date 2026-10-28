/**
 * Octave mobile — les notes d'un album, au pied de sa page : sa description
 * Jellyfin (mentions, licence, source), découpée par la règle partagée
 * (`useAlbumNotes`, la même que le bureau), les liens ouvrables. Rien sans
 * description.
 */

import { memo } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useAlbumNotes } from "@tentacle-tv/api-client";
import type { MusicAlbum } from "@tentacle-tv/shared/music";
import { typography, useTheme } from "@/theme";
import { accentTextOf } from "../ui/pageStyle";

export const AlbumNotes = memo(function AlbumNotes({ album, gutter }: { album: Pick<MusicAlbum, "description">; gutter: number }) {
  const { t } = useTranslation("music");
  const theme = useTheme();
  const lines = useAlbumNotes(album);
  if (lines.length === 0) return null;
  return (
    <View style={[styles.wrap, { paddingHorizontal: gutter }]}>
      <Text accessibilityRole="header" style={[typography.bodyBold, { color: theme.colors.text.primary }]}>
        {t("album.notes")}
      </Text>
      {lines.map((line, i) => (
        <Text key={i} style={[typography.caption, { color: theme.colors.text.secondary, lineHeight: 19 }]}>
          {line.map((segment, j) =>
            segment.kind === "link" ? (
              <Text key={j} accessibilityRole="link" onPress={() => void Linking.openURL(segment.url).catch(() => undefined)} style={{ color: accentTextOf(theme), textDecorationLine: "underline" }}>
                {segment.text}
              </Text>
            ) : (
              segment.text
            ),
          )}
        </Text>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({ wrap: { gap: 6, paddingTop: 24 } });
