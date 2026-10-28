/**
 * Octave mobile — la pastille « Importé » d'une sortie importée par le compte (`imported`) : discrète, icône ET
 * mot. `overlay` : au coin d'une pochette de carte, sur un fond plein ; `inline` : dans la tête d'une page.
 */

import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { HardDriveUpload } from "lucide-react-native";
import { typography, useTheme } from "@/theme";

export function ImportedBadge({ variant }: { variant: "overlay" | "inline" }) {
  const { t } = useTranslation("musicReleases");
  const theme = useTheme();
  const overlay = variant === "overlay";
  const color = overlay ? "#fff" : theme.colors.text.secondary;
  return (
    <View
      pointerEvents="none"
      accessibilityLabel={t("badgeHint")}
      style={[styles.badge, overlay ? styles.overlay : { borderColor: theme.colors.border.subtle, borderWidth: StyleSheet.hairlineWidth }]}
    >
      <HardDriveUpload size={12} color={color} />
      <Text numberOfLines={1} style={[typography.caption, styles.text, { color }]}>
        {t("badge")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: "row", alignItems: "center", gap: 4, height: 22, borderRadius: 11, paddingHorizontal: 8, alignSelf: "flex-start" },
  overlay: { position: "absolute", top: 8, left: 8, backgroundColor: "rgba(0,0,0,0.7)" },
  text: { fontSize: 11, fontWeight: "600" },
});
