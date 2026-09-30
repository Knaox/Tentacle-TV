import { memo } from "react";
import Svg, { Circle, Path } from "react-native-svg";
import {
  BOOKMARK_PATH,
  CARD_GLYPH_STROKE,
  CARD_GLYPH_VIEWBOX,
  HEART_PATH,
  WATCHED_CHECK_PATH,
  WATCHED_FILLED_PATH,
} from "@tentacle-tv/shared";
import { Icon, type IconName } from "../../icons/Icon";
import type { SheetActionKind } from "./sheetTypes";

/**
 * Le glyphe d'une action. Les bascules reprennent les tracés de la pastille
 * des cartes (`cardMarkerGlyphs`) — au trait tant que l'état n'est pas posé,
 * pleins quand il l'est : la feuille dit l'état dans la même forme que la
 * carte qu'elle recouvre.
 */

const ICON_OF: Record<Exclude<SheetActionKind, "watchlist" | "favorite" | "watched">, IconName> = {
  play: "play",
  request: "plus",
  details: "info",
  dismiss: "eyeOff",
  offline: "layers",
  providersAll: "filterOff",
};

export const SheetGlyph = memo(function SheetGlyph({
  kind,
  active = false,
  color,
  size = 30,
}: {
  kind: SheetActionKind;
  active?: boolean;
  color: string;
  size?: number;
}) {
  if (kind !== "watchlist" && kind !== "favorite" && kind !== "watched") {
    return <Icon name={ICON_OF[kind]} size={size} color={color} strokeWidth={2.2} />;
  }
  const stroke = { fill: "none", stroke: color, strokeWidth: CARD_GLYPH_STROKE, strokeLinejoin: "round" as const };
  return (
    <Svg width={size} height={size} viewBox={CARD_GLYPH_VIEWBOX}>
      {kind === "watched" ? (
        active ? (
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
