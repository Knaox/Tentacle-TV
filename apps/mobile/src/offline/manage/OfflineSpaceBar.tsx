import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useDiskInfo } from "@/hooks/offline/useOfflineList";
import { RADIUS, typography, useThemedStyles, type AppTheme } from "@/theme";
import { formatBytes } from "../formatBytes";

/** La jauge occupé / libre de l'écran de gestion et des réglages. */
export function OfflineSpaceBar() {
  const { t } = useTranslation("downloads");
  const { t: to } = useTranslation("offline");
  const st = useThemedStyles(makeStyles);
  const { data } = useDiskInfo();
  if (!data) return null;
  const total = data.usedBytes + data.freeBytes;
  const ratio = total > 0 ? Math.min(1, data.usedBytes / total) : 0;
  return (
    <View style={st.wrap} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(ratio * 100) }}>
      <View style={st.track}>
        <View style={[st.fill, { width: `${Math.max(ratio * 100, data.usedBytes > 0 ? 1 : 0)}%` }]} />
      </View>
      <View style={st.labels}>
        <Text style={st.label}>{to("spaceUsed", { size: formatBytes(data.usedBytes) })}</Text>
        <Text style={st.label}>{t("freeSpace", { size: formatBytes(data.freeBytes) })}</Text>
      </View>
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    wrap: { gap: 8 },
    track: { height: 6, borderRadius: RADIUS.pill, backgroundColor: t.colors.fill.subtle, overflow: "hidden" },
    fill: { height: "100%", borderRadius: RADIUS.pill, backgroundColor: t.colors.brand.violet },
    labels: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
    label: { ...typography.caption, color: t.colors.text.tertiary },
  });
