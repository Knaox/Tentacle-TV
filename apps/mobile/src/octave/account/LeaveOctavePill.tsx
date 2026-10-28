/**
 * Octave (mobile) — la BASCULE vers Tentacle TV, en haut à droite du hub « Compte » (retour de Damien, 28/10) :
 * une capsule de verre (44 pt), le glyphe des films et le mot « Tentacle TV », là où Apple Music met ses
 * actions de compte. Elle remplace la rangée « Revenir à Tentacle TV » du bas de la page : une seule porte.
 */

import { memo } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { Film } from "lucide-react-native";
import { GlassSurface } from "@/components/ui";
import { typography, useTheme } from "@/theme";
import { useLeaveOctave } from "../mode/useOctaveSwitch";

export const LeaveOctavePill = memo(function LeaveOctavePill() {
  const { t } = useTranslation("octaveShell");
  const theme = useTheme();
  const leave = useLeaveOctave();
  return (
    <Pressable
      onPress={leave}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={t("account.leave")}
      accessibilityHint={t("account.leaveHint")}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <GlassSurface tier="subtle" tint="regular" radius={22} interactive style={styles.pill}>
        <Film size={18} color={theme.colors.text.primary} strokeWidth={2.2} />
        <Text style={[typography.bodyBold, { color: theme.colors.text.primary }]} numberOfLines={1}>
          {t("account.leaveGroup")}
        </Text>
      </GlassSurface>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  pill: { minHeight: 44, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 6 },
  pressed: { opacity: 0.7 },
});
