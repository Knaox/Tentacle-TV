import { memo, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { Reveal } from "../motion/Reveal";
import { CardFocusNote } from "./CardFocusNote";
import { CardHoldHint } from "./CardHoldHint";
import { CardPreviewHint } from "./CardPreviewHint";

/** Le pied : son écart à la légende, l'écart entre ses lignes, et leurs hauteurs
 *  (`CardFocusNote` : deux lignes de 28 au plus ; `CardHoldHint`, `CardPreviewHint` : 26). */
const FOOTER_MARGIN_TOP = 6;
const FOOTER_GAP = 8;
const NOTE_HEIGHT = 2 * 28;
const HINT_HEIGHT = 26;

/**
 * La hauteur du pied quand ses lignes sont là : pendant l'aperçu, la rangée
 * lui fait cette place sous la légende (`CardShell` `expansion.room`) — il
 * reste visible, à l'écart de la rangée du dessous.
 */
export function cardFocusFooterHeight(lines: { note: boolean; hold: boolean; preview: boolean }): number {
  const heights = [lines.note ? NOTE_HEIGHT : 0, lines.hold ? HINT_HEIGHT : 0, lines.preview ? HINT_HEIGHT : 0].filter((h) => h > 0);
  if (heights.length === 0) return 0;
  return FOOTER_MARGIN_TOP + heights.reduce((sum, h) => sum + h, 0) + FOOTER_GAP * (heights.length - 1);
}

/**
 * Ce qui paraît SOUS la légende d'une carte focalisée : la phrase de focus
 * (`CardFocusNote`, la raison d'une recommandation), puis l'indication de
 * l'appui maintenu (`CardHoldHint`), et, tant que l'aperçu joue, ce que
 * Lecture/Pause en fait (`CardPreviewHint`).
 *
 * Posé en ABSOLU sous le bloc qui le porte — la légende, qu'il suit quand la
 * carte grandit : il n'agrandit rien, la rangée ne bouge pas. Plus large que
 * la carte (`width`) : la raison y tient en deux lignes, l'indication en une.
 * Pendant l'aperçu seulement, la rangée qui grandit lui fait sa place
 * (`cardFocusFooterHeight`) : sans elle, il tombait au bord de l'écran, collé
 * au titre de la rangée du dessous.
 *
 * Chaque ligne paraît AU FOCUS, sans attendre, en un fondu bref, et s'en va
 * en fondu plus bref encore (`motion/Reveal`, tv-core `focus/focusReveal`) :
 * rien n'est monté au repos ; seule la carte focalisée porte ses lignes.
 */
export const CardFocusFooter = memo(function CardFocusFooter({
  note,
  hold,
  preview = null,
  width,
  previewWidth,
}: {
  note?: string;
  /** La carte s'ouvre par l'appui maintenu : le dire. */
  hold: boolean;
  /** L'aperçu joue sous le focus : la pause et le son, pour dire Lecture/Pause (port `CardPreview.remote`). */
  preview?: { paused: boolean; muted: boolean } | null;
  width: number;
  /** La largeur de la ligne Lecture/Pause : celle de la grande carte — sous une affiche, le pied
   *  (1,6 × la carte) la tronquait. */
  previewWidth?: number;
}) {
  // La phrase reste écrite le temps de sa sortie : `note` retombe avec le focus.
  const lastNote = useRef(note);
  if (note) lastNote.current = note;
  const previewStyle = useMemo(() => (previewWidth !== undefined && previewWidth > width ? { width: previewWidth } : undefined), [previewWidth, width]);
  return (
    <View pointerEvents="none" style={[styles.footer, { width }]}>
      <Reveal shown={note !== undefined}>
        {lastNote.current ? <CardFocusNote text={lastNote.current} /> : null}
      </Reveal>
      <Reveal shown={hold}>
        <CardHoldHint />
      </Reveal>
      <Reveal shown={preview !== null} style={previewStyle}>
        {preview ? <CardPreviewHint paused={preview.paused} muted={preview.muted} /> : null}
      </Reveal>
    </View>
  );
});

const styles = StyleSheet.create({
  footer: { position: "absolute", top: "100%", left: 0, marginTop: FOOTER_MARGIN_TOP, gap: FOOTER_GAP },
});
