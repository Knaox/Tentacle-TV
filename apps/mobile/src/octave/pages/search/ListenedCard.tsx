/**
 * Octave mobile — une carte du « Déjà écouté » de la recherche vide
 * (`buildListenedCards`, la règle du bureau) : la recherche, l'album écouté
 * ensuite (toucher : sa page) et les titres (toucher : les relancer).
 */

import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { ListenedCard as Card } from "@tentacle-tv/shared/octave";
import { typography, useTheme } from "@/theme";
import { useOctaveNav } from "../env/nav";
import { usePagesPlayer } from "../env/pagesPlayer";
import { Artwork } from "../ui/Artwork";
import { playFrom } from "../env/playFrom";

export const ListenedCard = memo(function ListenedCard({ card }: { card: Card }) {
  const { t } = useTranslation("music");
  const theme = useTheme();
  const nav = useOctaveNav();
  const player = usePagesPlayer();
  const context = `search:${card.query}`;
  return (
    <View style={[styles.card, { backgroundColor: theme.colors.fill.faint, borderColor: theme.colors.border.subtle }]}>
      <Text numberOfLines={1} style={[typography.small, { color: theme.colors.text.tertiary, textTransform: "uppercase" }]}>
        {t("search.listenedFrom", { query: card.query })}
      </Text>
      {card.album ? (
        <Pressable
          onPress={() => card.album?.target && nav.albumTarget(card.album.target)}
          disabled={!card.album.target}
          accessibilityRole="button"
          accessibilityLabel={t("search.openAlbum", { title: card.album.title })}
          style={styles.line}
        >
          <Artwork url={card.album.artworkUrl} size={44} radius={6} />
          <View style={styles.text}>
            <Text numberOfLines={1} style={[typography.bodyBold, { color: theme.colors.text.primary }]}>{card.album.title}</Text>
            <Text numberOfLines={1} style={[typography.caption, { color: theme.colors.text.tertiary }]}>{card.album.artists}</Text>
          </View>
        </Pressable>
      ) : null}
      {card.tracks.map((track, i) => (
        <Pressable key={track.key} onPress={() => playFrom(player, card.tracks, i, context)} accessibilityRole="button" accessibilityLabel={t("track.play", { title: track.title })} style={styles.line}>
          {card.album ? <View style={styles.indent} /> : <Artwork url={track.artworkUrl} size={44} radius={6} />}
          <View style={styles.text}>
            <Text numberOfLines={1} style={[typography.body, { color: theme.colors.text.primary }]}>{track.title}</Text>
            <Text numberOfLines={1} style={[typography.caption, { color: theme.colors.text.tertiary }]}>{track.artists.map((a) => a.name).join(", ")}</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 6 },
  line: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 },
  indent: { width: 44 },
  text: { flex: 1, minWidth: 0, gap: 1 },
});
