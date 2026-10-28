/**
 * Octave (mobile) — un album ou une playlist gardés en entier, sur l'étagère de
 * « Sur cet appareil » : la pochette (locale) — pour une playlist, la MÊME jaquette
 * qu'en ligne et que le bureau (`keptCollectionCover`, mosaïque du jour sur les
 * titres gardés, pochettes du disque) —, le titre, le nombre de titres.
 * Toucher l'ouvre DANS la vue (sa page d'origine demande le serveur).
 */

import { memo, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import type { KeptMusicTrack } from "@tentacle-tv/offline-core";
import { keptCollectionCover, type DeviceCollection } from "@tentacle-tv/offline-core/music";
import { PlaylistArtwork } from "../pages/ui/PlaylistArtwork";
import { PressableScale } from "../layout/PressableScale";
import { useOctaveColors } from "../theme/octaveColors";

interface Props {
  collection: DeviceCollection;
  width: number;
  kept: readonly KeptMusicTrack[];
  offline: boolean;
  onOpen: (key: string) => void;
}

export const DeviceCollectionCard = memo(function DeviceCollectionCard({ collection, width, kept, offline, onOpen }: Props) {
  const colors = useOctaveColors();
  const { t } = useTranslation("music");
  // Le jour se relit avec la collection : la jaquette ne change pas sous les yeux.
  const urls = useMemo(() => keptCollectionCover(collection, kept, { now: Date.now(), remote: !offline }), [collection, kept, offline]);
  const caption = collection.subtitle ?? t("count.tracks", { count: collection.tracks.length });
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={`${collection.title}, ${caption}`} onPress={() => onOpen(collection.key)} style={{ width, gap: 8 }}>
      {urls.length > 0 ? (
        <PlaylistArtwork urls={urls} size={width} radius={12} />
      ) : (
        <View style={[styles.art, { width, height: width, backgroundColor: colors.raised }]}>
          <Feather name={collection.kind === "album" ? "disc" : "list"} size={width / 4} color={colors.textTertiary} />
        </View>
      )}
      <View>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{collection.title}</Text>
        <Text style={[styles.caption, { color: colors.textTertiary }]} numberOfLines={1}>{caption}</Text>
      </View>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  art: { borderRadius: 12, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  title: { fontSize: 15, fontWeight: "600" },
  caption: { fontSize: 13 },
});
