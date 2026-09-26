import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, useWindowDimensions } from "react-native";
import { BottomSheet } from "@/components/ui";
import { spacing, typography, FONT_FAMILY, RADIUS, useThemedStyles, type AppTheme } from "@/theme";
import { SettingsOptionList, type SettingsOption } from "./SettingsOptionList";
import { SettingsRow, type SettingsIcon } from "./SettingsRow";

const SHEET_CHROME = 150;
const ROW_ESTIMATE = 58;

interface Props<V extends string> {
  icon?: SettingsIcon;
  label: string;
  options: ReadonlyArray<SettingsOption<V>>;
  value: V;
  onChange: (value: V) => void;
  /** Valeur affichée quand `value` n'est pas parmi les options (« Personnalisé »). */
  fallbackValueLabel?: string;
  last?: boolean;
}

/**
 * Un choix parmi quatre valeurs ou plus, ou aux libellés longs : la ligne
 * montre la valeur courante, la feuille liste les options à coche. Choisir
 * ferme la feuille — un geste pour ouvrir, un pour choisir.
 */
export function SettingsPickerRow<V extends string>({
  icon, label, options, value, onChange, fallbackValueLabel, last,
}: Props<V>) {
  const st = useThemedStyles(makeStyles);
  const [open, setOpen] = useState(false);
  const { height } = useWindowDimensions();
  // La feuille épouse sa liste : poignée + titre + une ligne par option.
  const fit = Math.min(0.85, Math.max(0.3, (SHEET_CHROME + options.length * ROW_ESTIMATE) / height));
  const current = options.find((option) => option.value === value);

  return (
    <>
      <SettingsRow
        icon={icon}
        label={label}
        value={current?.label ?? fallbackValueLabel}
        chevron
        last={last}
        onPress={() => setOpen(true)}
      />
      <BottomSheet visible={open} onClose={() => setOpen(false)} snapPoints={[fit, 0.9]}>
        <ScrollView contentContainerStyle={st.body} showsVerticalScrollIndicator={false}>
          <Text style={st.title} accessibilityRole="header">{label}</Text>
          <View style={st.card}>
            <SettingsOptionList
              options={options}
              value={value}
              onChange={(next) => { onChange(next); setOpen(false); }}
            />
          </View>
        </ScrollView>
      </BottomSheet>
    </>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  title: {
    ...typography.badge, fontFamily: FONT_FAMILY.bold, color: t.colors.text.tertiary,
    letterSpacing: 0.8, textTransform: "uppercase" as const,
  },
  card: {
    backgroundColor: t.colors.surface.s1, borderRadius: RADIUS.lg, overflow: "hidden" as const,
    borderWidth: StyleSheet.hairlineWidth, borderColor: t.colors.border.subtle,
  },
});
