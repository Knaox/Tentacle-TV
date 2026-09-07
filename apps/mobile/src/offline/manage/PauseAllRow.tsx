import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { FONT_FAMILY, RADIUS, typography, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import type { OfflineEntry } from "../engineApi";
import { pauseAllTransfers, resumeAllTransfers } from "../engineApi";

interface Props {
  /** Les transferts non terminés — ceux que le geste vise. */
  entries: readonly OfflineEntry[];
}

/**
 * « Tout mettre en pause » en tête des transferts en cours — le même geste que
 * le bouton de la notification Android, pour qui a l'application sous les yeux.
 *
 * Il bascule en « Tout reprendre » quand plus rien ne tourne : reprendre ne
 * relance QUE ce que l'utilisateur avait arrêté, jamais une pause système
 * (attente du Wi-Fi), qui repart d'elle-même.
 */
export function PauseAllRow({ entries }: Props) {
  const { t } = useTranslation("offline");
  const { colors } = useTheme();
  const st = useThemedStyles(makeStyles);
  const running = entries.some((entry) => entry.status === "queued" || entry.status === "downloading");
  const paused = entries.some((entry) => entry.status === "paused");
  if (!running && !paused) return null;

  const label = running ? t("pauseAll") : t("resumeAll");
  return (
    <View style={st.row}>
      <Pressable
        onPress={() => (running ? pauseAllTransfers() : resumeAllTransfers())}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [st.button, pressed && { opacity: 0.7 }]}
      >
        <Feather name={running ? "pause" : "play"} size={14} color={colors.text.secondary} />
        <Text style={st.label}>{label}</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    row: { alignItems: "flex-start" },
    // 44 pt de haut : la cible tactile minimale.
    button: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      minHeight: 44,
      paddingHorizontal: 14,
      borderRadius: RADIUS.pill,
      backgroundColor: t.colors.fill.subtle,
      borderWidth: 1,
      borderColor: t.colors.border.subtle,
    },
    label: { ...typography.caption, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.secondary },
  });
