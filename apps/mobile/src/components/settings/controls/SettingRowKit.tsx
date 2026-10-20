import { type ReactNode } from "react";
import { View, Text, StyleSheet } from "react-native";
import { spacing, typography, useThemedStyles, type AppTheme } from "@/theme";
import { BrandSwitch } from "../BrandSwitch";
import type { SettingScope } from "../ScopeBadge";
import { SegmentedChoice, type ChoiceOption } from "../SegmentedChoice";
import { SettingsChoiceRow } from "../SettingsChoiceRow";
import { SettingsRow, type SettingsIcon } from "../SettingsRow";

interface SegmentedProps {
  icon: SettingsIcon;
  label: string;
  scope: SettingScope | null;
  options: ChoiceOption[];
  value: string;
  onChange: (value: string) => void;
  /** La phrase de l'option CHOISIE, sous le segmenté : on lit ce qu'elle fait sans liste à dérouler. */
  hint?: string;
  last?: boolean;
}

/**
 * Un choix parmi deux à quatre valeurs courtes : le nom (et sa pastille de
 * portée) en tête, le segmenté de marque dessous, pleine largeur, puis la
 * phrase de l'option retenue. Remplace les listes à coche des anciens écrans,
 * où chaque option prenait une ligne entière.
 */
export function SegmentedSettingRow({ icon, label, scope, options, value, onChange, hint, last }: SegmentedProps) {
  const st = useThemedStyles(makeStyles);
  return (
    <SettingsChoiceRow icon={icon} label={label} scope={scope ?? undefined} last={last}>
      <View style={st.segment}>
        <SegmentedChoice options={options} value={value} onChange={onChange} accessibilityLabel={label} />
        {hint ? <Text style={st.hint}>{hint}</Text> : null}
      </View>
    </SettingsChoiceRow>
  );
}

interface SwitchProps {
  icon: SettingsIcon;
  label: string;
  description?: string;
  scope: SettingScope | null;
  value: boolean;
  onChange: (value: boolean) => void;
  last?: boolean;
}

/** Un oui / non : la ligne de réglage et son interrupteur de marque. */
export function SwitchSettingRow({ icon, label, description, scope, value, onChange, last }: SwitchProps) {
  return (
    <SettingsRow
      icon={icon}
      label={label}
      description={description}
      scope={scope ?? undefined}
      last={last}
      trailing={<BrandSwitch value={value} onValueChange={onChange} accessibilityLabel={label} />}
    />
  );
}

interface BlockProps {
  icon: SettingsIcon;
  label: string;
  description?: string;
  scope: SettingScope | null;
  children: ReactNode;
  last?: boolean;
}

/** Un réglage dont le contrôle est un bloc (curseur) : le nom en tête, le bloc dessous. */
export function BlockSettingRow({ icon, label, description, scope, children, last }: BlockProps) {
  return (
    <SettingsChoiceRow icon={icon} label={label} description={description} scope={scope ?? undefined} last={last}>
      {children}
    </SettingsChoiceRow>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    segment: { gap: spacing.sm },
    hint: { ...typography.small, fontWeight: "400", color: t.colors.text.tertiary, lineHeight: 16 },
  });
