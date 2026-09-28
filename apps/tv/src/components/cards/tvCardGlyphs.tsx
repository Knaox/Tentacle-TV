import Svg, { Circle, Path } from "react-native-svg";
import {
  BOOKMARK_PATH,
  CARD_GLYPH_STROKE,
  CARD_GLYPH_VIEWBOX,
  HEART_PATH,
  STAR_PATH,
  STAR_VIEWBOX,
  WATCHED_CHECK_PATH,
  WATCHED_FILLED_PATH,
  type CardToggleKind,
} from "@tentacle-tv/shared";

/**
 * Glyphes des marqueurs de carte au salon — les MÊMES tracés que le web et le
 * mobile (`@tentacle-tv/shared`, `cardMarkerGlyphs.ts`).
 *
 * Pleins sur la carte, qui n'affiche que des états vrais. Au trait dans la
 * feuille d'actions (`TVCardActionSheet`), où ils disent l'état d'une
 * bascule : plein = c'est fait, trait = pas encore — la grammaire du plateau
 * de survol du web.
 */

interface GlyphProps {
  size: number;
  color: string;
  /** Faux : au trait (bascule éteinte). Défaut : plein. */
  filled?: boolean;
}

export function TVBookmarkGlyph({ size, color, filled = true }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox={CARD_GLYPH_VIEWBOX}>
      <Path
        d={BOOKMARK_PATH}
        fill={filled ? color : "none"}
        stroke={color}
        strokeWidth={CARD_GLYPH_STROKE}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function TVHeartGlyph({ size, color, filled = true }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox={CARD_GLYPH_VIEWBOX}>
      <Path
        d={HEART_PATH}
        fill={filled ? color : "none"}
        stroke={color}
        strokeWidth={CARD_GLYPH_STROKE}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function TVWatchedGlyph({ size, color, filled = true }: GlyphProps) {
  if (!filled) {
    // Au trait : un cercle et la coche — les deux pièces du tracé partagé.
    return (
      <Svg width={size} height={size} viewBox={CARD_GLYPH_VIEWBOX} fill="none">
        <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={CARD_GLYPH_STROKE} />
        <Path
          d={WATCHED_CHECK_PATH}
          stroke={color}
          strokeWidth={CARD_GLYPH_STROKE}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox={CARD_GLYPH_VIEWBOX}>
      <Path d={WATCHED_FILLED_PATH} fill={color} fillRule="evenodd" clipRule="evenodd" />
    </Svg>
  );
}

/** Le glyphe d'une bascule — celui de la pastille d'états du repos. */
export function TVToggleGlyph({ kind, ...props }: GlyphProps & { kind: CardToggleKind }) {
  if (kind === "watchlist") return <TVBookmarkGlyph {...props} />;
  if (kind === "favorite") return <TVHeartGlyph {...props} />;
  return <TVWatchedGlyph {...props} />;
}

export function TVStarGlyph({ size, color }: Omit<GlyphProps, "filled">) {
  return (
    <Svg width={size} height={size} viewBox={STAR_VIEWBOX}>
      <Path d={STAR_PATH} fill={color} />
    </Svg>
  );
}
