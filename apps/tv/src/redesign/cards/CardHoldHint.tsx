import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Icon } from "../icons/Icon";
import { colors, fonts } from "../theme/tokens";

/**
 * « Maintenir OK : plus d'options » — sous la légende de TOUTE carte qui a le
 * focus et s'ouvre par l'appui maintenu. Sur Apple TV, aucune action ne se
 * fait sur la carte : c'est le seul moyen d'apprendre que le grand panneau
 * existe (noter, Ma liste, j'aime, vu, les infos). Le pictogramme de la
 * télécommande, la voix basse des légendes.
 *
 * Le contenu seul : c'est `CardFocusFooter` qui le montre, au focus, un temps
 * APRÈS lui (`HOLD_HINT_DWELL_MS`) — parcourir une rangée ne fait pas
 * clignoter une ligne sous chaque carte —, sous la phrase de focus quand la
 * carte en a une.
 */

/** Le temps que le focus reste avant que l'indication paraisse. */
export const HOLD_HINT_DWELL_MS = 350;

export const CardHoldHint = memo(function CardHoldHint() {
  const { t } = useTranslation("cards");
  return (
    <View style={styles.hint}>
      <Icon name="remote" size={22} color={colors.textTertiary} strokeWidth={1.8} />
      <Text style={styles.text} numberOfLines={1}>{t("holdForOptions")}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  hint: { flexDirection: "row", alignItems: "center", gap: 8 },
  text: { ...fonts.medium, flexShrink: 1, fontSize: 22, lineHeight: 26, color: colors.textTertiary },
});
