/**
 * Les symboles propres au lecteur en verre — les autres viennent de
 * `PlayerIcons.tsx`, même trait, mêmes extrémités arrondies.
 *
 * Le saut relatif y prend la forme des lecteurs d'Apple (« reculer de 10 »,
 * « avancer de 30 ») : la flèche circulaire et son nombre. Le dessin est celui de
 * l'habillage de la page (`chrome/skipGlyphs.tsx`, refonte de nov. 2026 : les deux
 * habillages portent le même pictogramme) ; ici il porte en plus la classe du
 * verre (`lgp-skip-glyph`), que ses feuilles savent teinter.
 */

import { SkipBackGlyph as BackGlyph, SkipForwardGlyph as ForwardGlyph } from "../chrome/skipGlyphs";

interface SkipGlyphProps {
  seconds: number;
}

const GLASS = "lgp-skip-glyph h-6 w-6 text-white";

export function SkipBackGlyph({ seconds }: SkipGlyphProps) {
  return <BackGlyph seconds={seconds} className={GLASS} />;
}

export function SkipForwardGlyph({ seconds }: SkipGlyphProps) {
  return <ForwardGlyph seconds={seconds} className={GLASS} />;
}
