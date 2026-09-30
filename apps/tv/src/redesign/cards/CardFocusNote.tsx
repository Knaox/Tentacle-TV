import { memo } from "react";
import { StyleSheet, Text } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { Icon } from "../icons/Icon";
import { colors, fonts } from "../theme/tokens";

/**
 * La phrase du focus d'une affiche (`card.focusNote`) — la raison d'une
 * recommandation (« Parce que vous avez aimé … »), sous la légende de la carte
 * qui a le focus.
 *
 * Posée en ABSOLU sous le bloc qui la porte (la légende, qu'elle suit quand la
 * carte grandit), comme l'indication de l'appui long : elle n'agrandit rien,
 * la rangée ne bouge pas — c'est elle qui garde la place dessous
 * (`CARD_NOTE_SPACE`). Plus large que l'affiche, alignée sur sa légende : deux
 * lignes y disent une raison entière. Montée au focus seulement, un temps
 * APRÈS lui : parcourir une rangée ne fait pas clignoter une phrase sous
 * chaque carte.
 */

/** Le temps que le focus reste avant que la phrase paraisse. */
const DWELL_MS = 250;

/** La place qu'une rangée garde en plus, dessous, quand ses cartes ont une
 *  phrase de focus (deux lignes sous la légende). */
export const CARD_NOTE_SPACE = 76;

export const CardFocusNote = memo(function CardFocusNote({ text, width }: { text: string; width: number }) {
  return (
    <Animated.View
      entering={FadeIn.delay(DWELL_MS).duration(200)}
      exiting={FadeOut.duration(120)}
      pointerEvents="none"
      style={[styles.note, { width }]}
    >
      <Icon name="sparkles" size={20} color={colors.accentLight} />
      <Text style={styles.text} numberOfLines={2}>{text}</Text>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  note: { position: "absolute", top: "100%", left: 0, marginTop: 8, flexDirection: "row", alignItems: "flex-start", gap: 8 },
  text: { ...fonts.semibold, flexShrink: 1, fontSize: 22, lineHeight: 28, color: colors.text },
});
