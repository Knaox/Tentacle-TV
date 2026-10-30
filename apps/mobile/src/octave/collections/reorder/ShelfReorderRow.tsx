/**
 * Octave mobile — une rangée du mode « Réordonner » d'une rubrique de la bibliothèque : la pochette, le nom,
 * et la poignée (44 pt, la seule zone qui glisse). Le mouvement est celui de la case qui la porte
 * (`ReorderList`). Au lecteur d'écran, la poignée offre « Monter » et « Descendre » : le glisser a toujours
 * son équivalent.
 */

import { memo, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { GripVertical } from "lucide-react-native";
import { typography, useTheme } from "@/theme";
import type { ReorderSlot } from "../../reorder/ReorderList";

export const SHELF_REORDER_ROW_HEIGHT = 64;

interface Props {
  name: string;
  subtitle: string | null;
  art: ReactNode;
  gutter: number;
  slot: ReorderSlot;
}

export const ShelfReorderRow = memo(function ShelfReorderRow({ name, subtitle, art, gutter, slot }: Props) {
  const { t } = useTranslation("musicFavorites");
  const theme = useTheme();
  const { handle, onStep, lifted } = slot;
  return (
    <View style={[styles.row, { paddingLeft: gutter }]}>
      {art}
      <View style={styles.text}>
        <Text numberOfLines={1} style={[typography.bodyBold, { color: theme.colors.text.primary }]}>
          {name}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={[typography.caption, { color: theme.colors.text.tertiary }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View
        {...handle}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={t("reorder.handle", { name })}
        accessibilityActions={[
          { name: "increment", label: t("reorder.moveUp", { name }) },
          { name: "decrement", label: t("reorder.moveDown", { name }) },
        ]}
        onAccessibilityAction={(e) => onStep(e.nativeEvent.actionName === "increment" ? -1 : 1)}
        style={[styles.handle, { marginRight: gutter - 10 }]}
      >
        <GripVertical size={20} color={lifted ? theme.colors.brand.accentLight : theme.colors.text.tertiary} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  row: { height: SHELF_REORDER_ROW_HEIGHT, flexDirection: "row", alignItems: "center", gap: 14 },
  text: { flex: 1, minWidth: 0, gap: 2 },
  handle: { width: 44, height: SHELF_REORDER_ROW_HEIGHT, alignItems: "center", justifyContent: "center" },
});
