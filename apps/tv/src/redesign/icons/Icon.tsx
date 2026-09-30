import { memo } from "react";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { ICONS, type IconName, type IconShape } from "./iconPaths";

export type { IconName } from "./iconPaths";

/** Un pictogramme de la refonte, à la couleur et à la taille voulues. */
export const Icon = memo(function Icon({
  name,
  size = 28,
  color,
  strokeWidth = 2,
}: {
  name: IconName;
  size?: number;
  color: string;
  strokeWidth?: number;
}) {
  const shape: IconShape = ICONS[name];
  const paint = shape.filled
    ? { fill: color, stroke: "none" }
    : { fill: "none", stroke: color, strokeWidth, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {shape.paths?.map((d) => <Path key={d} d={d} {...paint} />)}
      {shape.circles?.map(([cx, cy, r]) => <Circle key={`${cx}-${cy}-${r}`} cx={cx} cy={cy} r={r} {...paint} />)}
      {shape.rects?.map(([x, y, w, h, rx]) => <Rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} rx={rx} {...paint} />)}
    </Svg>
  );
});
