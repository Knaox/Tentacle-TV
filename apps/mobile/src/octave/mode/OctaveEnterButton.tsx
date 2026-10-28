/**
 * Octave (mobile) — l'entrée dans le mode musique, dans l'en-tête de Tentacle :
 * seulement si le serveur déclare `music.library` ET que ce compte a une
 * bibliothèque musique et le droit « Accès à Octave » (`useOctaveAvailability`).
 * Serveur d'avant, compte sans musique : rien, aucune erreur.
 */

import { memo } from "react";
import { Pressable, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { Music2 } from "lucide-react-native";
import { useOctaveAvailability } from "@tentacle-tv/api-client";
import { useTheme } from "@/theme";
import { useEnterOctave } from "./useOctaveSwitch";

export const OctaveEnterButton = memo(function OctaveEnterButton() {
  const { t } = useTranslation("octaveShell");
  const { colors } = useTheme();
  const { available } = useOctaveAvailability();
  const enter = useEnterOctave();
  if (!available) return null;
  return (
    <Pressable
      onPress={enter}
      hitSlop={12}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={t("mobile.enter")}
      accessibilityHint={t("mobile.enterHint")}
    >
      <Music2 size={21} color={colors.text.primary} strokeWidth={2} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  button: { minWidth: 32, minHeight: 32, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.6 },
});
