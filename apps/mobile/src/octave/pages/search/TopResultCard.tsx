/**
 * Octave mobile — le MEILLEUR RÉSULTAT en grande carte (celui que l'extension
 * désigne, remplacé par son jumeau de bibliothèque : `layoutSearch`) : sa
 * pochette, son nom, sa nature ; toucher ouvre sa page (un titre : le lit), le
 * bouton Lecture lit les titres d'à côté depuis le début.
 */

import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { rememberAlbumPreview, type TopResult } from "@tentacle-tv/shared/octave";
import { entityTarget } from "@tentacle-tv/shared/octave/mode";
import { GlassSurface, PressableCard } from "@/components/ui";
import { typography, useTheme } from "@/theme";
import { useOctaveNav } from "../env/nav";
import { Artwork } from "../ui/Artwork";
import { OctavePlayButton } from "../../layout/OctavePlayButton";

function describe(top: TopResult): { title: string; art: string | null; round: boolean; kind: string; by: string | null } {
  switch (top.kind) {
    case "track":
      return { title: top.track.title, art: top.track.artworkUrl, round: false, kind: "search.kindTrack", by: top.track.artists.map((a) => a.name).join(", ") };
    case "album":
      return { title: top.album.title, art: top.album.artworkUrl, round: false, kind: "search.kindAlbum", by: top.album.artists.map((a) => a.name).join(", ") };
    case "artist":
      return { title: top.artist.name, art: top.artist.imageUrl, round: true, kind: "search.kindArtist", by: null };
    default:
      return { title: top.playlist.title, art: top.playlist.artworkUrl, round: false, kind: "search.kindPlaylist", by: top.playlist.owner };
  }
}

export const TopResultCard = memo(function TopResultCard({ top, onPlay }: { top: TopResult; onPlay: () => void }) {
  const { t } = useTranslation("music");
  const theme = useTheme();
  const nav = useOctaveNav();
  const d = describe(top);
  const open = () => {
    if (top.kind === "track") return onPlay();
    if (top.kind === "album") {
      const target = entityTarget(top.album);
      if (target && !top.album.jellyfinId) rememberAlbumPreview(target, top.album);
      return nav.album(top.album);
    }
    if (top.kind === "artist") return nav.artist(top.artist);
    nav.externalPlaylist(top.playlist.key);
  };
  return (
    <PressableCard onPress={open} accessibilityRole="button" accessibilityLabel={`${t("search.topResult")} : ${d.title}`}>
      <GlassSurface tier="subtle" tint="regular" radius={18} style={styles.card}>
        <Artwork url={d.art} size={96} round={d.round} radius={12} kind={top.kind === "artist" ? "artist" : "album"} />
        <View style={styles.text}>
          <Text style={[typography.small, { color: theme.colors.text.tertiary, textTransform: "uppercase" }]}>{t("search.topResult")}</Text>
          <Text numberOfLines={2} style={[typography.title, { color: theme.colors.text.primary }]}>{d.title}</Text>
          <Text numberOfLines={1} style={[typography.caption, { color: theme.colors.text.secondary }]}>{[t(d.kind), d.by].filter(Boolean).join(" · ")}</Text>
        </View>
        <OctavePlayButton round={48} label={t("search.playTop", { title: d.title })} onPress={onPlay} />
      </GlassSurface>
    </PressableCard>
  );
});

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 16, padding: 14 },
  text: { flex: 1, minWidth: 0, gap: 4 },
});
