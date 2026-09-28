import {
  BOOKMARK_PATH,
  CARD_GLYPH_STROKE,
  CARD_GLYPH_VIEWBOX,
  HEART_PATH,
  KEPT_OFFLINE_PATH,
  STAR_PATH,
  STAR_VIEWBOX,
  WATCHED_CHECK_PATH,
  WATCHED_FILLED_PATH,
} from "@tentacle-tv/shared";

/**
 * Les glyphes des cartes — marqueurs d'état au repos, bascules au survol.
 *
 * Les TRACÉS vivent dans `@tentacle-tv/shared` (`cardMarkerGlyphs.ts`), communs
 * au web, au mobile et à la TV ; ce fichier ne fait que les poser dans un
 * `<svg>`. Pleins quand l'état est vrai, au trait sinon : un signet reconnu au
 * repos se retrouve tel quel sous le curseur — c'est ce qui dit « c'est ici
 * qu'on l'enlève ».
 */

interface GlyphProps {
  className?: string;
  filled?: boolean;
}

const STROKE = {
  stroke: "currentColor",
  strokeWidth: CARD_GLYPH_STROKE,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export function BookmarkGlyph({ className = "h-3.5 w-3.5", filled = false }: GlyphProps) {
  return (
    <svg className={className} viewBox={CARD_GLYPH_VIEWBOX} aria-hidden {...STROKE} fill={filled ? "currentColor" : "none"}>
      <path d={BOOKMARK_PATH} />
    </svg>
  );
}

export function HeartGlyph({ className = "h-3.5 w-3.5", filled = false }: GlyphProps) {
  return (
    <svg className={className} viewBox={CARD_GLYPH_VIEWBOX} aria-hidden {...STROKE} fill={filled ? "currentColor" : "none"}>
      <path d={HEART_PATH} />
    </svg>
  );
}

/** Coche « vu ». Pleine : disque plein, coche évidée — lisible à 12 px. */
export function WatchedGlyph({ className = "h-3.5 w-3.5", filled = false }: GlyphProps) {
  if (filled) {
    return (
      <svg className={className} viewBox={CARD_GLYPH_VIEWBOX} aria-hidden fill="currentColor">
        <path fillRule="evenodd" clipRule="evenodd" d={WATCHED_FILLED_PATH} />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox={CARD_GLYPH_VIEWBOX} aria-hidden fill="none" {...STROKE}>
      <circle cx="12" cy="12" r="9" />
      <path d={WATCHED_CHECK_PATH} />
    </svg>
  );
}

/**
 * « Sur cet appareil » : disque plein, flèche évidée — jamais une coche, qui
 * voisine dans la même pastille et dirait « vu ». La couleur (le vert de
 * « prêt ») vient de l'appelant.
 */
export function KeptGlyph({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox={CARD_GLYPH_VIEWBOX} aria-hidden fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd" d={KEPT_OFFLINE_PATH} />
    </svg>
  );
}

export function StarGlyph({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg className={className} viewBox={STAR_VIEWBOX} aria-hidden fill="currentColor">
      <path d={STAR_PATH} />
    </svg>
  );
}

export function PlayGlyph({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox={CARD_GLYPH_VIEWBOX} aria-hidden fill="currentColor">
      <path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l10.9-6.86a1 1 0 0 0 0-1.7L9.52 4.29A1 1 0 0 0 8 5.14z" />
    </svg>
  );
}
