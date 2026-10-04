import { type ReactNode } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { spacing, typography, FONT_FAMILY, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { ChoiceChips } from "./ChoiceChips";
import type { ChoiceOption } from "./SegmentedChoice";
import type { SettingsIcon } from "./SettingsRow";

interface Props {
  icon?: SettingsIcon;
  label: string;
  /** Ce que le réglage change, sous son nom. */
  description?: string;
  options?: ChoiceOption[];
  value?: string;
  onChange?: (value: string) => void;
  /** Un choix plus riche que des pastilles (les aperçus du thème) ; remplace `options`. */
  children?: ReactNode;
  last?: boolean;
}

/** Icône 22 + écart : les pastilles s'alignent sur le libellé, pas sur l'icône. */
const LABEL_INSET = 22 + spacing.sm;

/**
 * Un choix entre quelques valeurs courtes (langue, thème, densité, durée) :
 * le nom du réglage en tête, puis les choix DESSOUS, en pastilles alignées
 * sur lui — comme les réglages de l'Apple TV, jamais un segmenté tassé au
 * bout de la ligne. Les choix longs ou expliqués passent par
 * `SettingsOptionList` ou `SettingsPickerRow`.
 */
export function SettingsChoiceRow({ icon, label, description, options, value, onChange, children, last }: Props) {
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  return (
    <View style={[st.row, !last && st.rowBordered]}>
      <View style={st.lead}>
        {icon ? <Feather name={icon} size={19} color={theme.colors.text.secondary} style={st.icon} /> : null}
        <View style={st.texts}>
          <Text style={st.label} numberOfLines={2}>{label}</Text>
          {description ? <Text style={st.description}>{description}</Text> : null}
        </View>
      </View>
      <View style={icon ? st.controlInset : undefined}>
        {children ?? (options && value !== undefined && onChange
          ? <ChoiceChips options={options} value={value} onChange={onChange} accessibilityLabel={label} />
          : null)}
      </View>
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    row: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm + 4,
      paddingBottom: spacing.md,
      gap: spacing.sm + 2,
    },
    rowBordered: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border.subtle,
    },
    lead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 28 },
    icon: { width: 22, textAlign: "center" },
    texts: { flex: 1 },
    label: { ...typography.body, fontFamily: FONT_FAMILY.medium, color: t.colors.text.primary },
    description: { ...typography.small, color: t.colors.text.tertiary, marginTop: 2, lineHeight: 16 },
    controlInset: { marginLeft: LABEL_INSET },
  });
