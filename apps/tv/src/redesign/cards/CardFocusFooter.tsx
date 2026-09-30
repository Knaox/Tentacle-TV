import { memo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { Reveal } from "../motion/Reveal";
import { CardFocusNote, FOCUS_NOTE_DWELL_MS } from "./CardFocusNote";
import { CardHoldHint, HOLD_HINT_DWELL_MS } from "./CardHoldHint";

/**
 * Ce qui paraît SOUS la légende d'une carte focalisée : la phrase de focus
 * (`CardFocusNote`, la raison d'une recommandation), puis l'indication de
 * l'appui maintenu (`CardHoldHint`).
 *
 * Posé en ABSOLU sous le bloc qui le porte — la légende, qu'il suit quand la
 * carte grandit : il n'agrandit rien, la rangée ne bouge pas. Plus large que
 * la carte (`width`) : la raison y tient en deux lignes, l'indication en une.
 *
 * Chaque ligne paraît en fondu, un temps APRÈS le focus, et s'en va en fondu
 * plus bref (`motion/Reveal`) : rien n'est monté au repos, ni pendant qu'un
 * focus balaie la rangée sans s'arrêter.
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
      <Reveal shown={note !== undefined} delayMs={FOCUS_NOTE_DWELL_MS}>
        {lastNote.current ? <CardFocusNote text={lastNote.current} /> : null}
      </Reveal>
      <Reveal shown={hold} delayMs={HOLD_HINT_DWELL_MS}>
        <CardHoldHint />
      </Reveal>
    </View>
  );
});

const styles = StyleSheet.create({
  footer: { position: "absolute", top: "100%", left: 0, marginTop: 6, gap: 8 },
});
