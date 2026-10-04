import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useDissolveFamily } from "@tentacle-tv/api-client";
import { Button } from "@/components/ui";
import { useFamilyText } from "@/family/useFamilyText";
import { showToast } from "@/notices/toastStore";
import { RADIUS, spacing, typography, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { haptic } from "@/utils/haptics";
import { FamilySheet } from "./FamilySheet";
import { makeFamilyFormStyles } from "./familyFormStyles";

/**
 * Dissoudre ma famille : les membres en sortent, les invités sont supprimés
 * de Jellyfin avec leur lecture. Une case à cocher avant le bouton — le geste
 * est définitif, il ne part pas sur un appui de trop. Le serveur exige de son
 * côté le mot « dissolve » dans le corps.
 */
export function DissolveSheet({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation("familyWeb");
  const theme = useTheme();
  const form = useThemedStyles(makeFamilyFormStyles);
  const st = useThemedStyles(makeStyles);
  const { errorText } = useFamilyText();
  const dissolve = useDissolveFamily();
  const [understood, setUnderstood] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = () => {
    setError(null);
    haptic("destructive");
    dissolve.mutate(undefined, {
      onSuccess: () => {
        showToast({ title: t("danger.dissolved") });
        onClose();
      },
      onError: (failure) => setError(errorText(failure)),
    });
  };

  return (
    <FamilySheet title={t("confirm.dissolveTitle")} closeLabel={t("cancel")} onClose={onClose}>
      <Text style={form.lead}>{t("confirm.dissolveBody")}</Text>
      <Pressable
        onPress={() => setUnderstood((value) => !value)}
        disabled={dissolve.isPending}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: understood, disabled: dissolve.isPending }}
        style={st.check}
      >
        <Feather name={understood ? "check-square" : "square"} size={22} color={theme.colors.status.error} />
        <Text style={st.checkText}>{t("confirm.dissolveCheck")}</Text>
      </Pressable>
      {error ? <Text style={form.error} accessibilityRole="alert" accessibilityLiveRegion="polite">{error}</Text> : null}
      <View style={st.action}>
        <Button
          title={t("confirm.dissolveAction")}
          variant="danger"
          fullWidth
          disabled={!understood}
          loading={dissolve.isPending}
          onPress={confirm}
        />
      </View>
    </FamilySheet>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    check: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.sm + 2,
      padding: spacing.md,
      minHeight: 56,
      borderRadius: RADIUS.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.danger.border,
      backgroundColor: t.colors.danger.surface,
    },
    checkText: { ...typography.body, color: t.colors.text.primary, flex: 1, lineHeight: 21 },
    action: { marginTop: spacing.xl },
  });
