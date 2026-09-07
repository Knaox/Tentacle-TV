import { useCallback, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { BottomSheet } from "@/components/ui";
import { spacing, typography, FONT_FAMILY, useThemedStyles, type AppTheme } from "@/theme";
import { removeOfflineEntry, setAutoDeleteAfterWatch } from "../engineApi";
import { AutoDeleteChips, type AutoDeleteValue } from "../keep/AutoDeleteChips";

/**
 * Les gestes groupés du mode sélection, EN SÉRIE et non en parallèle : chaque
 * appel écrit dans la même base et le moteur diffuse un changement à chacun —
 * vingt-quatre écritures concurrentes feraient vingt-quatre invalidations.
 */
export function useBulkOfflineActions(userId: string | null, selection: ReadonlySet<number>, onDone: () => void) {
  const { t } = useTranslation("offline");
  const [busy, setBusy] = useState(false);

  const removeSelected = useCallback(() => {
    if (userId === null || selection.size === 0) return;
    Alert.alert(t("bulkRemoveConfirmTitle", { count: selection.size }), t("bulkRemoveConfirmMessage"), [
      { text: t("cancel", { defaultValue: "" }) || "Annuler", style: "cancel" },
      {
        text: t("bulkRemove", { count: selection.size }),
        style: "destructive",
        onPress: () => {
          setBusy(true);
          void (async () => {
            for (const fileId of selection) await removeOfflineEntry(userId, fileId);
          })().finally(() => {
            setBusy(false);
            onDone();
          });
        },
      },
    ]);
  }, [userId, selection, t, onDone]);

  const applyAutoDelete = useCallback((value: AutoDeleteValue) => {
    if (userId === null) return;
    for (const fileId of selection) setAutoDeleteAfterWatch(userId, fileId, value !== null, value ?? 0);
    onDone();
  }, [userId, selection, onDone]);

  return { busy, removeSelected, applyAutoDelete };
}

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  onApply: (value: AutoDeleteValue) => void;
}

/** « Auto-suppression de la sélection » : les mêmes puces, appliquées à toutes les lignes cochées. */
export function BulkAutoDeleteSheet({ visible, onClose, onApply }: SheetProps) {
  const { t } = useTranslation("downloads");
  const st = useThemedStyles(makeStyles);
  return (
    <BottomSheet visible={visible} onClose={onClose} snapPoints={[0.32, 0.5]}>
      <View style={st.body}>
        <Text style={st.title}>{t("bulkAutoDelete")}</Text>
        <AutoDeleteChips value={null} onChange={(value) => { onApply(value); onClose(); }} compact />
      </View>
    </BottomSheet>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
    title: { ...typography.subtitle, fontFamily: FONT_FAMILY.bold, color: t.colors.text.primary },
  });
