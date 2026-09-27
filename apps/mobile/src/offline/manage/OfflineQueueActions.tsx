import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { FONT_FAMILY, RADIUS, typography, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import type { OfflineEntry } from "../engineApi";
import { pauseAllTransfers, resumeAllTransfers, resumeTransfer } from "../engineApi";

interface Props {
  /** Les transferts non terminés — ceux que les gestes visent. */
  entries: readonly OfflineEntry[];
}

/**
 * Les gestes sur toute la file, dans la carte de synthèse :
 *
 * - « Tout mettre en pause » — le même geste que le bouton de la notification
 *   Android, pour qui a l'application sous les yeux. Il bascule en « Tout
 *   reprendre » quand plus rien ne tourne : reprendre ne relance QUE ce que
 *   l'utilisateur avait arrêté, jamais une pause système (attente du Wi-Fi),
 *   qui repart d'elle-même.
 * - « Tout réessayer » quand des transferts ont échoué : sans lui, il fallait
 *   ouvrir la feuille de chaque ligne.
 */
export function OfflineQueueActions({ entries }: Props) {
  const { t } = useTranslation("offline");
  const st = useThemedStyles(makeStyles);
  const running = entries.some((entry) => entry.status === "queued" || entry.status === "downloading");
  const paused = entries.some((entry) => entry.status === "paused");
  const failed = entries.filter((entry) => entry.status === "error");
  if (!running && !paused && failed.length === 0) return null;

  return (
    <View style={st.row}>
      {(running || paused) && (
        <QueueChip
          icon={running ? "pause" : "play"}
          label={running ? t("pauseAll") : t("resumeAll")}
          onPress={() => (running ? pauseAllTransfers() : resumeAllTransfers())}
        />
      )}
      {failed.length > 0 && (
        <QueueChip icon="rotate-cw" label={t("retryAll")} onPress={() => failed.forEach((entry) => resumeTransfer(entry.id))} />
      )}
    </View>
  );
}

function QueueChip({ icon, label, onPress }: { icon: keyof typeof Feather.glyphMap; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  const st = useThemedStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [st.button, pressed && st.pressed]}
    >
      <Feather name={icon} size={14} color={colors.text.secondary} />
      <Text style={st.label}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
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
    pressed: { opacity: 0.7 },
    label: { ...typography.caption, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.secondary },
  });
