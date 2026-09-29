import { memo } from "react";
import { Linking, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import Animated from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useItemTrailer } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { FONT_FAMILY, RADIUS, spacing, useTheme } from "@/theme";

interface Props {
  item: MediaItem;
  /** Lecture est posée juste au-dessus : 12 d'écart ; seule, 20 comme elle. */
  belowPlay: boolean;
  /** L'entrée de la rangée d'actions (même cadence que Lecture). */
  animStyle?: StyleProp<ViewStyle>;
}

/**
 * La bande-annonce de la fiche, sous « Lecture » — une pilule SECONDAIRE de
 * même largeur (420 au plus), 48 de haut, en verre neutre : une seule action
 * en couleur par fiche, et le libellé entier plutôt qu'un cinquième rond où
 * « Bande-annonce » ne tiendrait pas sur un téléphone de 375.
 *
 * Même règle que toutes les plateformes (`useItemTrailer`) : la bande-annonce
 * LOCALE dans le lecteur de l'app ; sinon la distante, confiée au système —
 * l'app YouTube si elle est là, le navigateur sinon, jamais une page web
 * embarquée ; et pas de bouton quand il n'y en a aucune. La flèche dit qu'on
 * quitte l'app.
 */
export const DetailTrailerButton = memo(function DetailTrailerButton({ item, belowPlay, animStyle }: Props) {
  const { t, i18n } = useTranslation("common");
  const router = useRouter();
  const { colors } = useTheme();
  const { target, visible } = useItemTrailer(item, i18n.language);
  if (!visible) return null;
  const external = target?.kind === "remote";

  const open = () => {
    if (!target) return;
    if (target.kind === "local") router.push(`/watch/${target.itemId}`);
    else Linking.openURL(target.trailer.Url).catch(() => {});
  };

  return (
    <Animated.View style={[{ marginTop: belowPlay ? spacing.md : spacing.xl, alignItems: "center" }, animStyle]}>
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={t("watchTrailer")}
        accessibilityHint={external ? t("trailerOpensYoutube") : undefined}
        style={({ pressed }) => [
          st.pill,
          { backgroundColor: colors.fill.subtle, borderColor: colors.border.subtle },
          pressed && { opacity: 0.7 },
        ]}
      >
        <Feather name="film" size={18} color={colors.text.primary} />
        <Text numberOfLines={1} style={[st.label, { color: colors.text.primary }]}>{t("trailer")}</Text>
        {external && <Feather name="arrow-up-right" size={16} color={colors.text.secondary} />}
      </Pressable>
    </Animated.View>
  );
});

const st = StyleSheet.create({
  pill: {
    width: "100%",
    maxWidth: 420,
    height: 48,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 20,
  },
  label: { fontSize: 15, fontFamily: FONT_FAMILY.semibold, letterSpacing: 0.2, flexShrink: 1 },
});
