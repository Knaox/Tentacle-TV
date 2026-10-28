/**
 * Octave (mobile) — la tête de « Sur cet appareil » : combien, quelle place, la
 * place LIBRE ; hors ligne, ce qui est disponible (jamais un voile) ; en ligne, la
 * tenue à jour des playlists gardées (le réglage d'appareil d'Octave, allumé par défaut).
 */

import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { SwitchRow } from "../settings/view/SwitchRow";
import { octaveAutoSync } from "../settings/octaveSettings";
import { useOctaveColors } from "../theme/octaveColors";

interface Props {
  summary: string | null;
  free: string | null;
  offline: boolean;
  /** Le compte peut garder : la tenue à jour a un sens. */
  canKeep: boolean;
}

export const DeviceSummary = memo(function DeviceSummary({ summary, free, offline, canKeep }: Props) {
  const colors = useOctaveColors();
  const { t } = useTranslation("musicOffline");
  const autoSync = octaveAutoSync.use();
  return (
    <View style={styles.wrap}>
      {summary !== null && <Text style={[styles.summary, { color: colors.textSecondary }]}>{summary}</Text>}
      {free !== null && <Text style={[styles.free, { color: colors.textTertiary }]}>{t("view.free", { size: free })}</Text>}
      {offline && (
        <View accessibilityRole="text" style={[styles.hint, { backgroundColor: colors.pressed }]}>
          <Feather name="wifi-off" size={16} color={colors.textSecondary} />
          <Text style={[styles.hintText, { color: colors.textSecondary }]}>{t("view.offlineHint")}</Text>
        </View>
      )}
      {!offline && canKeep && (
        <View style={styles.setting}>
          <SwitchRow icon="refresh-cw" label={t("autosync.label")} description={t("autosync.hint")} value={autoSync} onChange={octaveAutoSync.set} last />
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: 6, marginBottom: 20 },
  summary: { fontSize: 15, fontVariant: ["tabular-nums"] },
  free: { fontSize: 13, fontVariant: ["tabular-nums"] },
  hint: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginTop: 8 },
  hintText: { flex: 1, fontSize: 14, lineHeight: 20 },
  setting: { marginTop: 8 },
});
