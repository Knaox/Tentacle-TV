import { memo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { Reveal } from "../motion/Reveal";
import { CardFocusNote } from "./CardFocusNote";
import { CardHoldHint } from "./CardHoldHint";

/** Le pied : son écart à la légende, l'écart entre ses lignes. */
const FOOTER_MARGIN_TOP = 6;
const FOOTER_GAP = 8;

/** Ce que « Maintenir OK : plus d'options » occupe sous la légende : son écart et sa ligne (`CardHoldHint`, 26). */
export const CARD_HOLD_FOOTER_HEIGHT = FOOTER_MARGIN_TOP + 26;

/**
 * Ce qui paraît SOUS la légende d'une carte focalisée : la phrase de focus
 * (`CardFocusNote`, la raison d'une recommandation), puis l'indication de
 * l'appui maintenu (`CardHoldHint`). Ce que Lecture/Pause fait de l'aperçu,
 * c'est la zone d'aperçu qui le dit (`PreviewZoneView`).
 *
 * Posé en ABSOLU sous le bloc qui le porte — la légende, qu'il suit quand la
 * carte grandit au focus : il n'agrandit rien, la rangée ne bouge pas. Plus
 * large que la carte (`width`) : la raison y tient en deux lignes,
 * l'indication en une.
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
  footer: { position: "absolute", top: "100%", left: 0, marginTop: FOOTER_MARGIN_TOP, gap: FOOTER_GAP },
});
