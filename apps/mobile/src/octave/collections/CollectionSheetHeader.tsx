/**
 * Octave mobile — la tête de la feuille d'un album, d'un artiste ou d'une playlist : sa pochette (ronde pour
 * un artiste, la jaquette composée pour une playlist de la bibliothèque), son nom, et ce qu'il est.
 */

import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { MusicShelfSubject } from "@tentacle-tv/api-client";
import { typography, useTheme } from "@/theme";
import { Artwork } from "../pages/ui/Artwork";
import { LibraryPlaylistArtwork } from "../pages/ui/PlaylistArtwork";

/** Le nom montré d'un élément (titre d'album, nom d'artiste, de playlist). */
export function subjectName(subject: MusicShelfSubject): string {
  if (subject.section === "albums") return subject.item.title;
  if (subject.section === "artists") return subject.item.name;
  return subject.item.kind === "library" ? subject.item.playlist.name : subject.item.playlist.title;
}

function subtitleOf(subject: MusicShelfSubject, t: (key: string) => string): string {
  if (subject.section === "albums") return subject.item.artists.map((a) => a.name).join(", ") || t("search.kindAlbum");
  if (subject.section === "artists") return t("search.kindArtist");
  return subject.item.kind === "external" && subject.item.playlist.owner ? subject.item.playlist.owner : t("playlist.kicker");
}

export const CollectionSheetHeader = memo(function CollectionSheetHeader({ subject }: { subject: MusicShelfSubject }) {
  const theme = useTheme();
  const { t } = useTranslation("music");
  const art =
    subject.section === "albums" ? (
      <Artwork url={subject.item.artworkUrl} size={52} radius={8} />
    ) : subject.section === "artists" ? (
      <Artwork url={subject.item.imageUrl} size={52} round kind="artist" />
    ) : subject.item.kind === "library" ? (
      <LibraryPlaylistArtwork playlist={subject.item.playlist} size={52} radius={8} />
    ) : (
      <Artwork url={subject.item.playlist.artworkUrl} size={52} radius={8} />
    );
  return (
    <View style={styles.header}>
      {art}
      <View style={styles.text}>
        <Text numberOfLines={1} style={[typography.bodyBold, { color: theme.colors.text.primary }]}>
          {subjectName(subject)}
        </Text>
        <Text numberOfLines={1} style={[typography.caption, { color: theme.colors.text.tertiary }]}>
          {subtitleOf(subject, t)}
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingBottom: 12 },
  text: { flex: 1, minWidth: 0, gap: 2 },
});
