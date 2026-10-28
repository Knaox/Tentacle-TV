/**
 * Octave (mobile) — un album ou une playlist gardés en entier, sur l'étagère de
 * « Sur cet appareil » : la pochette (locale), le titre, le nombre de titres.
 * Toucher l'ouvre DANS la vue (sa page d'origine demande le serveur).
 */

import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import type { DeviceCollection } from "@tentacle-tv/offline-core/music";
import { PressableScale } from "../layout/PressableScale";
import { useOctaveColors } from "../theme/octaveColors";

interface Props {
  collection: DeviceCollection;
  width: number;
  onOpen: (key: string) => void;
}

export const DeviceCollectionCard = memo(function DeviceCollectionCard({ collection, width, onOpen }: Props) {
  const colors = useOctaveColors();
  const { t } = useTranslation("music");
  const caption = collection.subtitle ?? t("count.tracks", { count: collection.tracks.length });
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={`${collection.title}, ${caption}`} onPress={() => onOpen(collection.key)} style={{ width, gap: 8 }}>
      <View style={[styles.art, { width, height: width, backgroundColor: colors.raised }]}>
        {collection.artworkUrl ? (
          <Image source={{ uri: collection.artworkUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} />
        ) : (
          <Feather name={collection.kind === "album" ? "disc" : "list"} size={width / 4} color={colors.textTertiary} />
        )}
      </View>
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
