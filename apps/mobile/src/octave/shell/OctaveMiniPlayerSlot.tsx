/**
 * Octave (mobile) — l'EMPLACEMENT du mini-lecteur (branché par `m2` dans le
 * registre) : au-dessus de la barre d'onglets sur téléphone, en bas du contenu
 * à droite de la barre latérale sur tablette. La coquille mesure sa hauteur et
 * la publie (`useOctaveChrome().miniPlayerHeight`) : les pages s'écartent
 * d'autant. Sans lecteur branché, rien n'est rendu.
 */

import { memo } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { octaveMiniPlayer } from "../registry/octaveRegistry";
import { OCTAVE_MINI_GAP, OCTAVE_SIDEBAR_WIDTH } from "./octaveChrome";

interface Props {
  layout: "phone" | "tablet";
  tabBarHeight: number;
  onHeight: (height: number) => void;
}

export const OctaveMiniPlayerSlot = memo(function OctaveMiniPlayerSlot({ layout, tabBarHeight, onHeight }: Props) {
  const insets = useSafeAreaInsets();
  const MiniPlayer = octaveMiniPlayer;
  if (!MiniPlayer) return null;
  const onLayout = (e: LayoutChangeEvent) => onHeight(Math.round(e.nativeEvent.layout.height));
  const position =
    layout === "phone"
      ? { left: 12, right: 12, bottom: tabBarHeight + OCTAVE_MINI_GAP }
      : { left: OCTAVE_SIDEBAR_WIDTH + insets.left + 16, right: 16 + insets.right, bottom: Math.max(insets.bottom, 12) };
  return (
    <View pointerEvents="box-none" style={[styles.slot, position]} onLayout={onLayout}>
      <MiniPlayer layout={layout} />
    </View>
  );
});

const styles = StyleSheet.create({
  slot: { position: "absolute" },
});
