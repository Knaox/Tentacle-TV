import { useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useUserId } from "@tentacle-tv/api-client";
import { setAutoDeleteAfterWatch, type OfflineEntry } from "@/offline/engineApi";
import { AutoDeleteChips, type AutoDeleteValue } from "@/offline/keep/AutoDeleteChips";
import { scheduleText } from "@/offline/manage/autoDeleteText";
import { FONT_FAMILY, spacing, typography, useThemedStyles, type AppTheme } from "@/theme";

/**
 * La suppression après visionnage d'un titre gardé, dans sa carte « Sur
 * l'appareil » : les puces de délai de la feuille « ⋯ », et l'échéance quand
 * elle court (le titre a été vu). Portée par le compte, pas par le fichier.
 */
export function OfflineAutoDeleteBlock({ entry }: { entry: OfflineEntry }) {
  const { t, i18n } = useTranslation("downloads");
  const st = useThemedStyles(makeStyles);
  const userId = useUserId();
  const value: AutoDeleteValue = entry.autoDeleteAfterWatch ? entry.autoDeleteDelayMinutes : null;
  const onChange = useCallback((next: AutoDeleteValue) => {
    if (userId !== null) setAutoDeleteAfterWatch(userId, entry.id, next !== null, next ?? 0);
  }, [userId, entry.id]);

  return (
    <View style={st.wrap}>
      <AutoDeleteChips value={value} onChange={onChange} />
      {entry.deleteScheduledAt !== null && (
        <Text style={st.schedule}>{scheduleText(entry.deleteScheduledAt, t, i18n.language)}</Text>
      )}
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    wrap: { marginTop: spacing.lg, gap: 8 },
    schedule: { ...typography.caption, fontFamily: FONT_FAMILY.medium, color: t.colors.text.tertiary },
  });
