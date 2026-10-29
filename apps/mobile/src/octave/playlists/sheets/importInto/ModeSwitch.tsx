/**
 * Octave mobile — le choix de ce qu'on importe (« Lien ou liste », « Un album », « Fichiers ») : un contrôle
 * segmenté (onglets annoncés comme tels). Une seule voie offerte : rien n'est rendu.
 */

import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { typography, useTheme } from "@/theme";
import { haptic } from "@/utils/haptics";

export type ImportMode = "link" | "album" | "files";

export const ModeSwitch = memo(function ModeSwitch({ modes, value, onChange }: { modes: readonly ImportMode[]; value: ImportMode; onChange: (mode: ImportMode) => void }) {
  const { t } = useTranslation("musicImport");
  const theme = useTheme();
  if (modes.length < 2) return null;
  return (
    <View accessibilityRole="tablist" accessibilityLabel={t("mode.label")} style={[styles.row, { backgroundColor: theme.colors.fill.subtle, borderColor: theme.colors.border.subtle }]}>
      {modes.map((mode) => {
        const selected = mode === value;
        return (
          <Pressable
            key={mode}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => {
              if (selected) return;
              haptic("select");
              onChange(mode);
            }}
            style={[styles.tab, selected && { backgroundColor: theme.colors.fill.soft }]}
          >
            <Text numberOfLines={1} style={[typography.caption, styles.label, { color: selected ? theme.colors.text.primary : theme.colors.text.tertiary }]}>
              {t(`mode.${mode}`)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: "row", borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, padding: 3 },
  label: { fontWeight: "600" },
  tab: { flex: 1, minHeight: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
});
