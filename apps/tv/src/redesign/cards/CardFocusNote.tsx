import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Icon } from "../icons/Icon";
import { colors, fonts } from "../theme/tokens";

/**
 * La phrase du focus d'une affiche (`card.focusNote`) — la raison d'une
 * recommandation (« Parce que vous avez aimé … »), sous la légende de la carte
 * qui a le focus.
 *
 * Placée par `CardFocusFooter`, en absolu sous la légende, avec l'indication
 * de l'appui maintenu dessous : elle n'agrandit rien, la rangée ne bouge pas —
 * c'est elle qui garde la place dessous (`CARD_NOTE_SPACE`). Plus large que
 * l'affiche, alignée sur sa légende : deux lignes y disent une raison entière.
 * Le contenu seul : `CardFocusFooter` la montre au focus, un temps APRÈS lui
 * (`FOCUS_NOTE_DWELL_MS`) — parcourir une rangée ne fait pas clignoter une
 * phrase sous chaque carte.
 */

/** Le temps que le focus reste avant que la phrase paraisse. */
export const FOCUS_NOTE_DWELL_MS = 250;

/** La place qu'une rangée garde en plus, dessous, quand ses cartes ont une
 *  phrase de focus (deux lignes sous la légende). */
export const CARD_NOTE_SPACE = 76;

export const CardFocusNote = memo(function CardFocusNote({ text }: { text: string }) {
  return (
    <View style={styles.note}>
      <Icon name="sparkles" size={20} color={colors.accentLight} />
      <Text style={styles.text} numberOfLines={2}>{text}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  note: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  text: { ...fonts.semibold, flexShrink: 1, fontSize: 22, lineHeight: 28, color: colors.text },
});
