/**
 * Les symboles propres au lecteur en verre — les autres viennent de
 * `PlayerIcons.tsx`, même trait, mêmes extrémités arrondies.
 *
 * Le saut relatif y prend la forme des lecteurs d'Apple (« reculer de 10 »,
 * « avancer de 30 ») : la flèche circulaire et son nombre, là où l'habillage
 * d'avant écrivait « -10 » / « +30 » en toutes lettres. Opaque, `currentColor`.
 */

interface SkipGlyphProps {
  seconds: number;
}

/** Cercle de 8 de rayon centré en (12, 13) ; l'ouverture est en haut, côté flèche. */
export function SkipBackGlyph({ seconds }: SkipGlyphProps) {
  return (
    <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5A8 8 0 1 1 4.48 10.26" />
      <path d="M12.2 2.4L9.4 5l2.8 2.6" />
      <text x="12" y="16" textAnchor="middle" fontSize="7.4" fontWeight={700} fill="currentColor" stroke="none">{seconds}</text>
    </svg>
  );
}

export function SkipForwardGlyph({ seconds }: SkipGlyphProps) {
  return (
    <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5A8 8 0 1 0 19.52 10.26" />
      <path d="M11.8 2.4L14.6 5l-2.8 2.6" />
      <text x="12" y="16" textAnchor="middle" fontSize="7.4" fontWeight={700} fill="currentColor" stroke="none">{seconds}</text>
    </svg>
  );
}
