/**
 * Octave mobile — le BILAN d'un import de playlist, la même règle que le bureau (`importReport`, shared) : « X sur N
 * titres », les parts non vides (bibliothèque, vos imports, en cloud), puis chaque titre non importé avec son motif
 * (liste fermée, en mots : jamais un message brut). Au-delà de cinq, la liste se replie sous le bilan.
 */

import { memo, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import type { ImportSummary } from "@tentacle-tv/api-client";
import { importReport, type ImportReportPart } from "@tentacle-tv/shared/octave";
import { typography, useTheme } from "@/theme";

const PART_ICON: Record<ImportReportPart, keyof typeof Feather.glyphMap> = { library: "music", imported: "folder", cloud: "cloud" };

export const ImportReportView = memo(function ImportReportView({ summary }: { summary: ImportSummary }) {
  const { t } = useTranslation("musicImport");
  const theme = useTheme();
  const report = useMemo(() => importReport(summary), [summary]);
  const [open, setOpen] = useState(false);
  const listed = !report.folded || open;
  const secondary = theme.colors.text.secondary;
  const tertiary = theme.colors.text.tertiary;
  return (
    <View style={styles.block}>
      <Text accessibilityLiveRegion="polite" style={[typography.bodyBold, styles.tabular, { color: theme.colors.text.primary }]}>
        {t("report.kept", { kept: report.kept, count: report.total })}
      </Text>
      {report.parts.map(({ part, count }) => (
        <View key={part} style={styles.line}>
          <Feather name={PART_ICON[part]} size={16} color={secondary} />
          <Text style={[typography.body, { color: secondary }]}>{t(`report.part.${part}`, { count })}</Text>
        </View>
      ))}
      {report.missing.length > 0 ? (
        <View style={styles.line}>
          <Feather name="slash" size={16} color={tertiary} />
          <Text style={[typography.body, { color: tertiary }]}>{t("report.skipped", { count: report.missing.length })}</Text>
        </View>
      ) : null}
      {summary.truncated ? <Text style={[typography.small, { color: tertiary }]}>{t("truncated")}</Text> : null}
      {report.folded ? (
        <Pressable
          onPress={() => setOpen((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}
        >
          <Feather name={open ? "chevron-up" : "chevron-down"} size={16} color={secondary} />
          <Text style={[typography.bodyBold, { color: secondary }]}>{t(open ? "report.hide" : "report.show")}</Text>
        </Pressable>
      ) : null}
      {listed && report.missing.length > 0 ? (
        <View style={[styles.list, { backgroundColor: theme.colors.fill.subtle }]}>
          {report.missing.map((track) => (
            <View key={track.index} style={styles.row} accessible accessibilityLabel={`${track.title}, ${t(`report.reason.${track.reason}`)}`}>
              <Text style={[typography.caption, styles.rank, { color: tertiary }]}>{track.index + 1}</Text>
              <View style={styles.flex}>
                <Text numberOfLines={1} style={[typography.body, { color: theme.colors.text.primary }]}>
                  {track.title}
                  {track.artists.length > 0 ? <Text style={{ color: tertiary }}>{` · ${track.artists.join(", ")}`}</Text> : null}
                </Text>
                <Text style={[typography.caption, { color: tertiary }]}>{t(`report.reason.${track.reason}`)}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  block: { gap: 8 },
  tabular: { fontVariant: ["tabular-nums"] },
  line: { flexDirection: "row", alignItems: "center", gap: 10 },
  toggle: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, alignSelf: "flex-start" },
  pressed: { opacity: 0.6 },
  list: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  row: { flexDirection: "row", gap: 10, paddingVertical: 6 },
  rank: { width: 28, textAlign: "right", fontVariant: ["tabular-nums"] },
  flex: { flex: 1, minWidth: 0 },
});
