/**
 * Octave (mobile) — « Arrêter la lecture » : la lecture s'arrête, la file d'attente et le contexte se vident
 * (`OctavePlayer.clear`), le lecteur plein écran se referme, le mini-lecteur disparaît ; le moteur natif retire
 * la notification et l'écran verrouillé. Une croix dans le mini-lecteur (le congédier), un carré dans le lecteur
 * plein écran — même geste, même libellé.
 */

import { memo } from "react";
import { Pressable, StyleSheet } from "react-native";
import { Square, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { haptic } from "@/utils/haptics";
import { useOctavePlayer } from "./OctavePlayerContext";
import { closeNowPlaying } from "./nowPlayingStore";
import { useOctaveColors } from "../theme/octaveColors";

export const StopButton = memo(function StopButton({ shape }: { shape: "close" | "stop" }) {
  const { t } = useTranslation("music");
  const colors = useOctaveColors();
  const player = useOctavePlayer();
  return (
    <Pressable
      onPress={() => {
        haptic("select");
        closeNowPlaying();
        player.clear();
      }}
      hitSlop={6}
      style={({ pressed }) => [styles.button, pressed && { backgroundColor: colors.pressed }]}
      accessibilityRole="button"
      accessibilityLabel={t("player.stop")}
    >
      {shape === "close" ? <X color={colors.textSecondary} size={20} /> : <Square color={colors.textSecondary} fill={colors.textSecondary} size={16} />}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  button: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
