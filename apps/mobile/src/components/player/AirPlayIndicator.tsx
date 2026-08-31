import { memo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { PLAYER } from "@/theme";

/**
 * Voile plein écran pendant une diffusion AirPlay — la vidéo joue ailleurs,
 * l'écran du téléphone ne montre plus que le rappel. Extrait de PlayerScreen
 * pour tenir la règle des 300 lignes.
 */
export const AirPlayIndicator = memo(function AirPlayIndicator() {
  const { t } = useTranslation("player");
  return (
    <View style={styles.overlay}>
      <Feather name="airplay" size={48} color={PLAYER.textTertiary} />
      <Text style={styles.text}>{t("airplayActive")}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: PLAYER.scrimStrong,
    gap: 16,
  },
  text: {
    color: PLAYER.textTertiary,
    fontSize: 16,
    fontWeight: "600",
  },
});
