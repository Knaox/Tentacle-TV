import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useLeaveFamily } from "@tentacle-tv/api-client";
import { SettingsRow, SettingsSection } from "@/components/settings";
import { useFamilyText } from "@/family/useFamilyText";
import { showToast } from "@/notices/toastStore";
import { haptic } from "@/utils/haptics";
import { spacing, typography, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { DissolveSheet } from "./DissolveSheet";
import { makeFamilyRowStyles } from "./familyRowStyles";
import { OwnPinSheet } from "./PinSheet";

/** Mon code PIN : poser, changer, retirer — il protège mon profil sur les TV
 *  de la famille, et « Gérer les profils » sur les miennes. */
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

/**
 * Quitter la famille (un MEMBRE : le propriétaire, lui, dissout) — à tout
 * moment, confirmé : son profil disparaît aussitôt des TV de la famille, et
 * les autres profils des siennes.
 */
export function LeaveSection({ familyId, ownerName }: { familyId: string; ownerName: string }) {
  const { t } = useTranslation(["familyWeb", "familyMobile"]);
  const { errorText } = useFamilyText();
  const leave = useLeaveFamily();
  const confirm = () => {
    Alert.alert(t("familyWeb:confirm.leaveTitle", { owner: ownerName }), t("familyWeb:confirm.leaveBody"), [
      { text: t("familyWeb:cancel"), style: "cancel" },
      {
        text: t("familyWeb:confirm.leaveAction"),
        style: "destructive",
        onPress: () => {
          haptic("destructive");
          leave.mutate(familyId, { onError: (failure) => showToast({ title: errorText(failure) }) });
        },
      },
    ]);
  };
  return (
    <SettingsSection>
      <SettingsRow icon="log-out" label={t("familyMobile:leaveRow")} destructive last disabled={leave.isPending} onPress={confirm} />
    </SettingsSection>
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
