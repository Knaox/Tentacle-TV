/**
 * Octave (mobile) — les FILTRES du mode, à la Apple Music dans le style de
 * Tentacle : la puce (choisie = fond rose discret, texte rose lisible, liseré ;
 * sinon un remplissage neutre), et le bouton « Trier » (glyphe + tri en cours)
 * qui ouvre la feuille des tris. Une seule grammaire pour la bibliothèque, la
 * recherche et les listes de titres. 36 pt de haut, 44 pt de cible.
 */

import { memo } from "react";
import { Pressable, StyleSheet, Text, type AccessibilityRole } from "react-native";
import { ArrowDownUp, ChevronDown } from "lucide-react-native";
import { typography, useTheme } from "@/theme";
import { haptic } from "@/utils/haptics";
import { useOctaveColors } from "../theme/octaveColors";

const HIT = { top: 4, bottom: 4, left: 2, right: 2 } as const;

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** `tab` dans une rangée d'onglets, `radio` dans un groupe de filtres. */
  role?: Extract<AccessibilityRole, "tab" | "radio">;
}

export const OctaveChip = memo(function OctaveChip({ label, selected, onPress, role = "radio" }: ChipProps) {
  const theme = useTheme();
  const colors = useOctaveColors();
  return (
    <Pressable
      onPress={() => {
        if (selected) return;
        haptic("select");
        onPress();
      }}
      hitSlop={HIT}
      accessibilityRole={role}
      accessibilityState={role === "tab" ? { selected } : { checked: selected }}
      style={({ pressed }) => [
        styles.chip,
        selected
          ? { backgroundColor: colors.accentSoft, borderColor: colors.accentText }
          : { backgroundColor: pressed ? theme.colors.fill.soft : theme.colors.fill.subtle, borderColor: "transparent" },
      ]}
    >
      <Text style={[typography.caption, styles.label, { color: selected ? colors.accentText : theme.colors.text.primary }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
});

interface SortProps {
  /** Le tri en cours, en mots (« Ajout récent »). */
  label: string;
  /** Ce que dit un lecteur d'écran (« Trier : Ajout récent »). */
  accessibilityLabel: string;
  onPress: () => void;
}

export const OctaveSortButton = memo(function OctaveSortButton({ label, accessibilityLabel, onPress }: SortProps) {
  const theme = useTheme();
  const colors = useOctaveColors();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={HIT}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.chip, styles.sort, { backgroundColor: pressed ? theme.colors.fill.soft : theme.colors.fill.subtle }]}
    >
      <ArrowDownUp size={15} color={colors.accentText} />
      <Text style={[typography.caption, styles.label, { color: theme.colors.text.primary }]} numberOfLines={1}>
        {label}
      </Text>
      <ChevronDown size={14} color={theme.colors.text.tertiary} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  chip: { minHeight: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: "transparent", justifyContent: "center" },
  label: { fontWeight: "600" },
  sort: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12 },
});
