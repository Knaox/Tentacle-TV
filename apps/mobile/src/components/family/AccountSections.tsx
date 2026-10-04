import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { SettingsRow, SettingsSection } from "@/components/settings";
import { spacing, typography, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { DissolveSheet } from "./DissolveSheet";
import { makeFamilyRowStyles } from "./familyRowStyles";
import { OwnPinSheet } from "./PinSheet";

/** Mon code PIN : poser, changer, retirer — il protège mon profil sur les TV
 *  de mes familles (et « Gérer les profils » sur celles de la mienne). */
export function MyPinSection({ hasPin }: { hasPin: boolean }) {
  const { t } = useTranslation("familyWeb");
  const theme = useTheme();
  const row = useThemedStyles(makeFamilyRowStyles);
  const [open, setOpen] = useState(false);
  const action = hasPin ? t("myPin.change") : t("myPin.set");
  return (
    <>
      <SettingsSection title={t("myPin.title")} caption={t("myPin.hint")}>
        <View style={row.row}>
          <Feather name={hasPin ? "lock" : "unlock"} size={19} color={hasPin ? theme.colors.brand.violet : theme.colors.text.secondary} />
          <Text style={[row.title, row.body]}>{hasPin ? t("myPin.on") : t("myPin.off")}</Text>
          <Pressable
            onPress={() => setOpen(true)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`${action} — ${t("myPin.title")}`}
            style={({ pressed }) => [row.pill, pressed && row.dim]}
          >
            <Text style={row.actionText}>{action}</Text>
          </Pressable>
        </View>
      </SettingsSection>
      {open ? <OwnPinSheet hasPin={hasPin} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

/**
 * Dissoudre ma famille, à part, en bas de page : la feuille exige une case
 * cochée avant le bouton (`DissolveSheet`).
 */
export function DissolveSection() {
  const { t } = useTranslation("familyWeb");
  const [open, setOpen] = useState(false);
  return (
    <>
      <SettingsSection title={t("danger.title")}>
        <SettingsRow
          icon="alert-triangle"
          label={t("danger.dissolve")}
          description={t("danger.dissolveHint")}
          destructive
          chevron
          last
          onPress={() => setOpen(true)}
        />
      </SettingsSection>
      {open ? <DissolveSheet onClose={() => setOpen(false)} /> : null}
    </>
  );
}

/** Un encart d'information : ce qui change ce que la page permet, et pourquoi. */
export function FamilyNotice({ text }: { text: string }) {
  const theme = useTheme();
  const st = useThemedStyles(makeNoticeStyles);
  return (
    <View style={st.notice} accessible accessibilityRole="text">
      <Feather name="info" size={16} color={theme.colors.text.tertiary} style={st.icon} />
      <Text style={st.text}>{text}</Text>
    </View>
  );
}

const makeNoticeStyles = (t: AppTheme) =>
  StyleSheet.create({
    notice: {
      flexDirection: "row",
      gap: spacing.sm,
      padding: spacing.md,
      marginBottom: spacing.lg,
      borderRadius: 12,
      backgroundColor: t.colors.fill.subtle,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border.subtle,
    },
    icon: { marginTop: 2 },
    text: { ...typography.small, color: t.colors.text.secondary, flex: 1, lineHeight: 18 },
  });
