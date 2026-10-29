/**
 * Octave mobile — les éléments de la page « Playlists » : « Titres likés » et une playlist (de la
 * bibliothèque ou d'une extension), en RANGÉE sur un téléphone, en CARTE sur une tablette. Toucher ouvre ;
 * l'appui maintenu et « ⋯ » ouvrent la feuille d'actions (`onMenu`, absente sans action possible).
 */

import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { Heart, MoreHorizontal } from "lucide-react-native";
import type { MusicShelfPlaylist } from "@tentacle-tv/shared/music";
import { typography } from "@/theme";
import { PressableScale, useOctaveColors } from "../../layout";
import { Artwork } from "../../pages/ui/Artwork";
import { LibraryPlaylistArtwork } from "../../pages/ui/PlaylistArtwork";
import { SharedMark } from "../members/SharedMark";

interface EntryProps {
  entry: MusicShelfPlaylist;
  /** « 12 titres » (attentes comprises) ou le nom de qui l'a composée. */
  subtitle: string | null;
  onOpen: () => void;
  onMenu?: () => void;
}

const nameOf = (e: MusicShelfPlaylist) => (e.kind === "library" ? e.playlist.name : e.playlist.title);

function EntryArt({ entry, size, radius }: { entry: MusicShelfPlaylist; size: number; radius: number }) {
  return entry.kind === "library" ? <LibraryPlaylistArtwork playlist={entry.playlist} size={size} radius={radius} /> : <Artwork url={entry.playlist.artworkUrl} size={size} radius={radius} />;
}

export const LikedRow = memo(function LikedRow({ gutter, onOpen }: { gutter: number; onOpen: () => void }) {
  const { t } = useTranslation("music");
  const colors = useOctaveColors();
  return (
    <Pressable onPress={onOpen} accessibilityRole="button" style={({ pressed }) => [styles.row, { paddingHorizontal: gutter, backgroundColor: pressed ? colors.pressed : "transparent" }]}>
      <LinearGradient colors={colors.gradient as unknown as [string, string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.likedTile}>
        <Heart size={24} color="#fff" fill="#fff" />
      </LinearGradient>
      <View style={styles.rowText}>
        <Text numberOfLines={1} style={[typography.bodyBold, { color: colors.text }]}>{t("liked.title")}</Text>
        <Text numberOfLines={1} style={[typography.caption, { color: colors.textTertiary }]}>{t("liked.kicker")}</Text>
      </View>
    </Pressable>
  );
});

export const LikedCard = memo(function LikedCard({ width, onOpen }: { width: number; onOpen: () => void }) {
  const { t } = useTranslation("music");
  const colors = useOctaveColors();
  return (
    <PressableScale onPress={onOpen} accessibilityLabel={t("liked.title")} style={{ width }}>
      <LinearGradient colors={colors.gradient as unknown as [string, string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.cardTile, { width, height: width }]}>
        <Heart size={Math.round(width * 0.3)} color="#fff" fill="#fff" />
      </LinearGradient>
      <Text numberOfLines={1} style={[typography.bodyBold, { color: colors.text, marginTop: 8 }]}>{t("liked.title")}</Text>
    </PressableScale>
  );
});

export const PlaylistEntryRow = memo(function PlaylistEntryRow({ entry, subtitle, onOpen, onMenu, gutter }: EntryProps & { gutter: number }) {
  const { t } = useTranslation("music");
  const colors = useOctaveColors();
  const name = nameOf(entry);
  return (
    <Pressable
      onPress={onOpen}
      onLongPress={onMenu}
      delayLongPress={350}
      accessibilityRole="button"
      accessibilityHint={subtitle ?? undefined}
      style={({ pressed }) => [styles.row, { paddingHorizontal: gutter, backgroundColor: pressed ? colors.pressed : "transparent" }]}
    >
      <EntryArt entry={entry} size={56} radius={8} />
      <View style={styles.rowText}>
        <Text numberOfLines={1} style={[typography.bodyBold, { color: colors.text }]}>{name}</Text>
        {subtitle ? <Text numberOfLines={1} style={[typography.caption, { color: colors.textTertiary }]}>{subtitle}</Text> : null}
      </View>
      {entry.kind === "library" ? <SharedMark playlist={entry.playlist} /> : null}
      {onMenu ? (
        <Pressable onPress={onMenu} hitSlop={8} accessibilityRole="button" accessibilityLabel={t("playlistManage.more", { name })} style={styles.more}>
          <MoreHorizontal size={20} color={colors.textSecondary} />
        </Pressable>
      ) : null}
    </Pressable>
  );
});

export const PlaylistEntryCard = memo(function PlaylistEntryCard({ entry, subtitle, onOpen, onMenu, width }: EntryProps & { width: number }) {
  const colors = useOctaveColors();
  const name = nameOf(entry);
  return (
    <PressableScale onPress={onOpen} onLongPress={onMenu} accessibilityLabel={name} style={{ width }}>
      <View>
        <EntryArt entry={entry} size={width} radius={12} />
        {entry.kind === "library" ? <SharedMark playlist={entry.playlist} overlay /> : null}
      </View>
      <Text numberOfLines={1} style={[typography.bodyBold, { color: colors.text, marginTop: 8 }]}>{name}</Text>
      {subtitle ? <Text numberOfLines={1} style={[typography.caption, { color: colors.textTertiary }]}>{subtitle}</Text> : null}
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  row: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 14 },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  likedTile: { width: 56, height: 56, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  more: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginRight: -10 },
  cardTile: { borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
