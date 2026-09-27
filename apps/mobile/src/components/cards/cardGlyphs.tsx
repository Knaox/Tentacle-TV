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
} from "@tentacle-tv/shared";

/**
 * Glyphes des cartes — les MÊMES tracés que le web et la TV
 * (`@tentacle-tv/shared`, `cardMarkerGlyphs.ts`), posés dans
 * `react-native-svg`. Pleins quand l'état est vrai, au trait sinon.
 */

interface GlyphProps {
  size?: number;
  color: string;
  filled?: boolean;
}

export function BookmarkGlyph({ size = 12, color, filled = false }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox={CARD_GLYPH_VIEWBOX}>
      <Path
        d={BOOKMARK_PATH}
        fill={filled ? color : "none"}
        stroke={color}
        strokeWidth={CARD_GLYPH_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function HeartGlyph({ size = 12, color, filled = false }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox={CARD_GLYPH_VIEWBOX}>
      <Path
        d={HEART_PATH}
        fill={filled ? color : "none"}
        stroke={color}
        strokeWidth={CARD_GLYPH_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function WatchedGlyph({ size = 12, color, filled = false }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox={CARD_GLYPH_VIEWBOX}>
      {filled ? (
        <Path d={WATCHED_FILLED_PATH} fill={color} fillRule="evenodd" clipRule="evenodd" />
      ) : (
        <>
          <Circle cx={12} cy={12} r={9} fill="none" stroke={color} strokeWidth={CARD_GLYPH_STROKE} />
          <Path
            d={WATCHED_CHECK_PATH}
            fill="none"
            stroke={color}
            strokeWidth={CARD_GLYPH_STROKE}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
    </Svg>
  );
}

export function StarGlyph({ size = 10, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox={STAR_VIEWBOX}>
      <Path d={STAR_PATH} fill={color} />
    </Svg>
  );
}
