import { memo } from "react";
import Svg, { Circle, Path } from "react-native-svg";
import {
  BOOKMARK_PATH,
  CARD_GLYPH_STROKE,
  CARD_GLYPH_VIEWBOX,
  HEART_PATH,
  WATCHED_CHECK_PATH,
  WATCHED_FILLED_PATH,
  type CardStatusKind,
} from "@tentacle-tv/shared";

/**
 * Le glyphe d'un état de carte — Ma liste, favori, vu —, tracé du modèle
 * partagé (`cardMarkerGlyphs`) : PLEIN quand l'état est posé, au trait sinon.
 * La pastille du repos, le plateau du focus et la feuille le dessinent ici et
 * nulle part ailleurs : l'état qu'on voyait se retrouve, dans la même forme,
 * là où on le bascule.
 */
export const ToggleGlyph = memo(function ToggleGlyph({
  kind,
  active,
  color,
  size,
}: {
  kind: CardStatusKind;
  active: boolean;
  color: string;
  size: number;
}) {
  const stroke = { fill: "none", stroke: color, strokeWidth: CARD_GLYPH_STROKE, strokeLinejoin: "round" as const };
  return (
    <Svg width={size} height={size} viewBox={CARD_GLYPH_VIEWBOX}>
      {kind === "watched" ? (
        active ? (
          // Un disque à la coche ÉVIDÉE : sans `evenodd`, la coche se remplit
          // et il ne reste qu'un rond.
          <Path d={WATCHED_FILLED_PATH} fill={color} fillRule="evenodd" />
        ) : (
          <>
            <Circle cx={12} cy={12} r={9} {...stroke} />
            <Path d={WATCHED_CHECK_PATH} {...stroke} strokeLinecap="round" />
          </>
        )
      ) : (
        <Path d={kind === "watchlist" ? BOOKMARK_PATH : HEART_PATH} {...(active ? { fill: color } : stroke)} />
      )}
    </Svg>
  );
});
