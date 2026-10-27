/**
 * Les symboles propres au lecteur en verre — les autres viennent de
 * `PlayerIcons.tsx`, même trait, mêmes extrémités arrondies.
 *
 * Le saut relatif y prend la forme des lecteurs d'Apple (« reculer de 10 »,
 * « avancer de 30 ») : la flèche circulaire et son nombre, là où l'habillage
 * d'avant écrivait « -10 » / « +30 » en toutes lettres. Opaque, `currentColor`.
 *
 * Le nombre (lot lg8) : 8,6 unités en graisse 800, cerné d'un liseré NOIR à alpha
 * peint SOUS le chiffre (`paint-order`) — à 7,4 unités sans liseré, il tombait à
 * 1,8:1 sur un gris moyen quand le reste de l'icône tenait 5,7:1 (banc lg8 de C).
 */

interface SkipGlyphProps {
  seconds: number;
}

/** Cercle de 8 de rayon centré en (12, 13) ; l'ouverture est en haut, côté flèche. */
export function SkipBackGlyph({ seconds }: SkipGlyphProps) {
  return (
    <svg className="lgp-skip-glyph h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5A8 8 0 1 1 4.48 10.26" />
      <path d="M12.2 2.4L9.4 5l2.8 2.6" />
      <SkipDigits seconds={seconds} />
    </svg>
  );
}

export function SkipForwardGlyph({ seconds }: SkipGlyphProps) {
  return (
    <svg className="lgp-skip-glyph h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5A8 8 0 1 0 19.52 10.26" />
      <path d="M11.8 2.4L14.6 5l-2.8 2.6" />
      <SkipDigits seconds={seconds} />
    </svg>
  );
}

function SkipDigits({ seconds }: SkipGlyphProps) {
  return (
    <text x="12" y="16.2" textAnchor="middle" fontSize="8.6" fontWeight={800} fill="currentColor"
      stroke="rgb(0 0 0 / 0.4)" strokeWidth={0.9} paintOrder="stroke" letterSpacing="-0.2">
      {seconds}
    </text>
  );
}
