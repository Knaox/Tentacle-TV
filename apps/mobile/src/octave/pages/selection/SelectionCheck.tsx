/** Octave mobile — la case d'une rangée en sélection : un rond vide, ou plein à la couleur de marque avec sa coche. */

import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { Check } from "lucide-react-native";
import { useTheme } from "@/theme";

export const SelectionCheck = memo(function SelectionCheck({ selected }: { selected: boolean }) {
  const theme = useTheme();
  return (
    <View style={[styles.circle, selected ? { backgroundColor: theme.colors.brand.accent, borderColor: theme.colors.brand.accent } : { borderColor: theme.colors.text.tertiary }]}>
      {selected ? <Check size={14} strokeWidth={3} color="#FFFFFF" /> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  circle: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
});
