import { memo } from "react";
import { StyleSheet, Text } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { Icon } from "../icons/Icon";
import { colors, fonts } from "../theme/tokens";

/**
 * « Maintenir OK : plus d'options » — sous la légende d'une carte HORIZONTALE
 * qui a le focus (Reprendre, Prochains épisodes, Déjà vu, épisodes…). Sur ces
 * cartes, OK lit : rien ne dit sinon que maintenir OK ouvre la feuille (noter,
 * Ma liste, j'aime, vu, les infos). Le pictogramme de la télécommande, la
 * voix basse des légendes.
 *
 * Posée en ABSOLU sous le bloc qui la porte (la légende, qu'elle suit quand la
 * carte grandit) : elle n'agrandit rien, la rangée ne bouge pas. Montée au
 * focus seulement, en fondu, un temps APRÈS lui : parcourir une rangée ne fait
 * pas clignoter une ligne sous chaque carte. À la carte elle-même : quand le
 * focus descend dans le plateau, la bulle du plateau prend la parole.
 */

/** Le temps que le focus reste avant que l'indication paraisse. */
const DWELL_MS = 350;

export const CardHoldHint = memo(function CardHoldHint() {
  const { t } = useTranslation("cards");
  return (
    <Animated.View
      entering={FadeIn.delay(DWELL_MS).duration(200)}
      exiting={FadeOut.duration(120)}
      pointerEvents="none"
      style={styles.hint}
    >
      <Icon name="remote" size={22} color={colors.textTertiary} strokeWidth={1.8} />
      <Text style={styles.text} numberOfLines={1}>{t("holdForOptions")}</Text>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  hint: { position: "absolute", top: "100%", left: 0, right: 0, marginTop: 6, flexDirection: "row", alignItems: "center", gap: 8 },
  text: { ...fonts.medium, flexShrink: 1, fontSize: 22, lineHeight: 28, color: colors.textTertiary },
});
