import Svg, { Path } from "react-native-svg";
import {
  BOOKMARK_PATH,
  CARD_GLYPH_STROKE,
  CARD_GLYPH_VIEWBOX,
  HEART_PATH,
  STAR_PATH,
  STAR_VIEWBOX,
  WATCHED_FILLED_PATH,
} from "@tentacle-tv/shared";

/**
 * Glyphes des marqueurs de carte au salon — les MÊMES tracés que le web et le
 * mobile (`@tentacle-tv/shared`, `cardMarkerGlyphs.ts`). Toujours pleins : la
 * TV n'affiche que des états vrais, jamais de bascule sur la carte.
 */

interface GlyphProps {
  size: number;
  color: string;
}

export function TVBookmarkGlyph({ size, color }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox={CARD_GLYPH_VIEWBOX}>
      <Path d={BOOKMARK_PATH} fill={color} stroke={color} strokeWidth={CARD_GLYPH_STROKE} strokeLinejoin="round" />
    </Svg>
  );
}

export function TVHeartGlyph({ size, color }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox={CARD_GLYPH_VIEWBOX}>
      <Path d={HEART_PATH} fill={color} stroke={color} strokeWidth={CARD_GLYPH_STROKE} strokeLinejoin="round" />
    </Svg>
  );
}

export function TVWatchedGlyph({ size, color }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox={CARD_GLYPH_VIEWBOX}>
      <Path d={WATCHED_FILLED_PATH} fill={color} fillRule="evenodd" clipRule="evenodd" />
    </Svg>
  );
}

export function TVStarGlyph({ size, color }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox={STAR_VIEWBOX}>
      <Path d={STAR_PATH} fill={color} />
    </Svg>
  );
}
