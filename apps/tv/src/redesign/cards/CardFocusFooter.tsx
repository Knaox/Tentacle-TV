import { memo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { Reveal } from "../motion/Reveal";
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
 *
 * Chaque ligne paraît AU FOCUS, sans attendre, en un fondu bref, et s'en va
 * en fondu plus bref encore (`motion/Reveal`, tv-core `focus/focusReveal`) :
 * rien n'est monté au repos ; seule la carte focalisée porte ses lignes.
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
  // La phrase reste écrite le temps de sa sortie : `note` retombe avec le focus.
  const lastNote = useRef(note);
  if (note) lastNote.current = note;
  return (
    <View pointerEvents="none" style={[styles.footer, { width }]}>
      <Reveal shown={note !== undefined}>
        {lastNote.current ? <CardFocusNote text={lastNote.current} /> : null}
      </Reveal>
      <Reveal shown={hold}>
        <CardHoldHint />
      </Reveal>
    </View>
  );
});

const styles = StyleSheet.create({
  footer: { position: "absolute", top: "100%", left: 0, marginTop: 6, gap: 8 },
});
