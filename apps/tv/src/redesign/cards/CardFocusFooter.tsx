import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { CardFocusNote } from "./CardFocusNote";
import { CardHoldHint } from "./CardHoldHint";

/**
 * Ce qui paraît SOUS la légende d'une carte focalisée : la phrase de focus
 * (`CardFocusNote`, la raison d'une recommandation), puis l'indication de
 * l'appui maintenu (`CardHoldHint`).
 *
 * Posé en ABSOLU sous le bloc qui le porte — la légende, qu'il suit quand la
 * carte grandit : il n'agrandit rien, la rangée ne bouge pas. Plus large que
 * la carte (`width`) : la raison y tient en deux lignes, l'indication en une.
 */
export const CardFocusFooter = memo(function CardFocusFooter({
  note,
  hold,
  width,
}: {
  note?: string;
  /** La carte s'ouvre par l'appui maintenu : le dire. */
  hold: boolean;
  width: number;
}) {
  // Toujours monté, vide au repos : ses deux lignes partent chacune en fondu.
  return (
    <View pointerEvents="none" style={[styles.footer, { width }]}>
      {note ? <CardFocusNote text={note} /> : null}
      {hold ? <CardHoldHint /> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  footer: { position: "absolute", top: "100%", left: 0, marginTop: 6, gap: 8 },
});
