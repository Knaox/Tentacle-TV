/**
 * Octave (mobile) — la feuille d'une collection GARDÉE : combien de titres sont
 * sur l'appareil, puis « Garder les titres qui manquent », « Réessayer », et
 * — séparé, rouge — « Retirer … de cet appareil ». Le retrait n'est jamais au
 * premier toucher du bouton : il passe toujours par cette feuille.
 */

import { memo, type ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useOctaveColors } from "../theme/octaveColors";
import { useTheme } from "@/theme";

export interface SheetAction {
  key: string;
  label: string;
  icon: ComponentProps<typeof Feather>["name"];
  destructive?: boolean;
  onPress: () => void;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  title: string;
  caption: string;
  actions: readonly SheetAction[];
}

export const KeptActionsSheet = memo(function KeptActionsSheet({ visible, onClose, title, caption, actions }: Props) {
  const colors = useOctaveColors();
  const { colors: theme } = useTheme();
  const header = (
    <View style={styles.header}>
      <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>{title}</Text>
      <Text style={[styles.caption, { color: colors.textSecondary }]}>{caption}</Text>
    </View>
  );
  return (
    <BottomSheet visible={visible} onClose={onClose} snapPoints={[0.36, 0.36]} header={header}>
      {actions.map((action, index) => {
        const tone = action.destructive ? theme.statusPairs.error.fg : colors.text;
        // Le geste dangereux est séparé des autres par un filet (jamais collé à « Garder »).
        const separated = action.destructive && index > 0;
        return (
          <Pressable
            key={action.key}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            onPress={() => {
              onClose();
              action.onPress();
            }}
            style={({ pressed }) => [
              styles.row,
              separated && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, marginTop: 8 },
              pressed && { backgroundColor: colors.pressed },
            ]}
          >
            <Feather name={action.icon} size={20} color={tone} />
            <Text style={[styles.label, { color: tone }]}>{action.label}</Text>
          </Pressable>
        );
      })}
    </BottomSheet>
  );
});

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 8, gap: 2 },
  title: { fontSize: 17, fontWeight: "700" },
  caption: { fontSize: 14 },
  row: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, borderRadius: 12 },
  label: { fontSize: 16, fontWeight: "500" },
});
