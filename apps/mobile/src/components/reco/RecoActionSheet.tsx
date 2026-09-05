import { View, Text, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSendRecoFeedback } from "@tentacle-tv/api-client";
import type { RecoRowItem } from "@tentacle-tv/api-client";
import { BottomSheet } from "@/components/ui";
import { spacing, typography, FONT_FAMILY, RADIUS, useTheme, useThemedStyles, type AppTheme } from "@/theme";

interface Props {
  /** L'item visé par l'appui long ; null = feuille fermée. */
  item: RecoRowItem | null;
  onClose: () => void;
}

/**
 * L'appui long sur une recommandation HORS bibliothèque : « Ne plus me
 * proposer » (retrait optimiste de toutes les pages en cache). Un titre en
 * bibliothèque passe par MediaActionSheet — favoris, Ma liste, vu — comme
 * les autres rangées.
 */
export function RecoActionSheet({ item, onClose }: Props) {
  const { t } = useTranslation("reco");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const feedback = useSendRecoFeedback();

  const dismissItem = () => {
    if (item) feedback.mutate({ itemKey: item.key, action: "dismissed" });
    onClose();
  };

  return (
    <BottomSheet visible={item !== null} onClose={onClose} snapPoints={[0.3, 0.3]}>
      {item && (
        <View style={st.body}>
          <Text style={st.title} numberOfLines={2}>{item.title}</Text>
          {item.year != null && <Text style={st.meta}>{item.year}</Text>}
          <Pressable onPress={dismissItem} style={st.action} accessibilityRole="button">
            <Feather name="eye-off" size={18} color={theme.colors.text.primary} />
            <Text style={st.actionLabel}>{t("dismissAction")}</Text>
          </Pressable>
        </View>
      )}
    </BottomSheet>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  body: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  title: { ...typography.subtitle, fontFamily: FONT_FAMILY.bold, color: t.colors.text.primary },
  meta: { ...typography.caption, color: t.colors.text.tertiary },
  action: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderRadius: RADIUS.lg,
    backgroundColor: t.colors.surface.s2,
  },
  actionLabel: { ...typography.body, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary },
});
