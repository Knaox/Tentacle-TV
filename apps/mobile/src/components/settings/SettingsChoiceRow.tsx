import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { spacing, typography, FONT_FAMILY, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { SegmentedChoice, type ChoiceOption } from "./SegmentedChoice";
import type { SettingsIcon } from "./SettingsRow";

interface Props {
  icon?: SettingsIcon;
  label: string;
  options: ChoiceOption[];
  value: string;
  onChange: (value: string) => void;
  last?: boolean;
}

/** En deçà, le libellé passerait sur trois lignes : le segmenté descend. */
const LABEL_MIN_WIDTH = 132;

/**
 * Un choix entre deux ou trois mots courts (langue, thème, densité) : une
 * ligne ordinaire dont le contrôle segmenté COMPACT tient à droite. Jamais un
 * pavé pleine largeur pour « Français / Anglais ». Sur un écran étroit, le
 * segmenté passe sous le libellé (retour à la ligne flex) au lieu de
 * l'écraser. Les choix longs ou expliqués passent par `SettingsOptionList`
 * ou `SettingsPickerRow`.
 */
export function SettingsChoiceRow({ icon, label, options, value, onChange, last }: Props) {
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  return (
    <View style={[st.row, !last && st.rowBordered]}>
      <View style={st.lead}>
        {icon ? <Feather name={icon} size={19} color={theme.colors.text.secondary} style={st.icon} /> : null}
        <Text style={st.label} numberOfLines={2}>{label}</Text>
      </View>
      <View style={st.control}>
        <SegmentedChoice compact options={options} value={value} onChange={onChange} accessibilityLabel={label} />
      </View>
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      minHeight: 52,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      columnGap: spacing.sm,
      rowGap: spacing.sm,
    },
    rowBordered: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border.subtle,
    },
    lead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexGrow: 1, flexBasis: LABEL_MIN_WIDTH },
    icon: { width: 22, textAlign: "center" },
    label: { ...typography.body, fontFamily: FONT_FAMILY.medium, color: t.colors.text.primary, flexShrink: 1 },
    control: { marginLeft: "auto" },
  });
