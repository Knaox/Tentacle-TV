import { memo } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Animated from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import { useTranslation } from "react-i18next";
import { useFicheTrailerHint } from "@tentacle-tv/api-client";
import { trailerGuideHref, type MediaItem } from "@tentacle-tv/shared";
import { FONT_FAMILY, spacing, useTheme } from "@/theme";

interface Props {
  item: MediaItem;
  /** Lecture est posée juste au-dessus : 12 d'écart ; seule, 20 comme elle. */
  belowPlay: boolean;
  /** L'entrée de la rangée d'actions (même cadence que Lecture). */
  animStyle?: StyleProp<ViewStyle>;
}

/**
 * « Vous ne voyez pas les bandes-annonces ? » — à la place de la pilule
 * « Bande-annonce » quand le titre n'en a AUCUNE et que le serveur est mal
 * réglé (`useFicheTrailerHint`) : une ligne de texte centrée sous « Lecture »,
 * qui ouvre le guide, et une croix pour ne plus jamais la voir — suivie six
 * secondes d'un « Annuler ». Masqué pour de bon, c'est pour tous les appareils
 * du compte. Cibles de 44 points.
 */
export const DetailTrailerHint = memo(function DetailTrailerHint({ item, belowPlay, animStyle }: Props) {
  const { t, i18n } = useTranslation("trailerHelp");
  const router = useRouter();
  const { colors } = useTheme();
  const { phase, hide, undo } = useFicheTrailerHint(item, i18n.language);
  if (phase === "none") return null;

  return (
    <Animated.View style={[{ marginTop: belowPlay ? spacing.sm : spacing.lg, alignItems: "center" }, animStyle]}>
      {phase === "hint" ? (
        <View style={st.row}>
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push(trailerGuideHref() as Href)}
            style={({ pressed }) => [st.link, pressed && st.pressed]}
          >
            <Feather name="help-circle" size={15} color={colors.text.secondary} />
            <Text style={[st.label, { color: colors.text.secondary, textDecorationColor: colors.border.strong }]}>
              {t("hintLink")}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("hintHide")}
            onPress={hide}
            style={({ pressed }) => [st.close, pressed && st.pressed]}
          >
            <Feather name="x" size={16} color={colors.text.tertiary} />
          </Pressable>
        </View>
      ) : (
        <View style={st.row} accessibilityLiveRegion="polite">
          <Text style={[st.confirm, { color: colors.text.secondary }]}>{t("hintHidden")}</Text>
          <Pressable accessibilityRole="button" onPress={undo} style={({ pressed }) => [st.undo, pressed && st.pressed]}>
            <Text style={[st.undoLabel, { color: colors.text.primary }]}>{t("hintUndo")}</Text>
          </Pressable>
        </View>
      )}
    </Animated.View>
  );
});

const st = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", maxWidth: 420 },
  link: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 4 },
  label: { fontSize: 13, fontFamily: FONT_FAMILY.medium, textDecorationLine: "underline" },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.6 },
  confirm: { fontSize: 13, lineHeight: 19, fontFamily: FONT_FAMILY.regular, textAlign: "center", paddingHorizontal: 8 },
  undo: { minHeight: 44, justifyContent: "center", paddingHorizontal: 6 },
  undoLabel: { fontSize: 13, fontFamily: FONT_FAMILY.semibold, textDecorationLine: "underline" },
});
