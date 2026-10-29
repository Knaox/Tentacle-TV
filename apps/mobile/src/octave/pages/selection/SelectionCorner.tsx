/**
 * Octave mobile — le coin haut-droit d'une page de titres (album) : « Sélectionner » / « Terminé ». Verre de
 * Tentacle, comme la barre des listes (`BarButtons`). Rien sans au moins deux titres.
 */

import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import { GlassTextButton } from "../../playlists/screens/BarButtons";

interface Props {
  tracks: readonly MusicTrack[];
  gutter: number;
  selecting: boolean;
  onStart: () => void;
  onDone: () => void;
}

export function SelectionCorner({ tracks, gutter, selecting, onStart, onDone }: Props) {
  const { t } = useTranslation("music");
  const insets = useSafeAreaInsets();
  if (tracks.length < 2) return null;
  return (
    <View style={[styles.corner, { top: insets.top + 4, right: gutter - 4 }]}>
      <GlassTextButton label={t(selecting ? "selection.done" : "selection.start")} strong={selecting} onPress={selecting ? onDone : onStart} />
    </View>
  );
}

const styles = StyleSheet.create({
  corner: { position: "absolute", zIndex: 11, flexDirection: "row", alignItems: "center", gap: 8 },
});
