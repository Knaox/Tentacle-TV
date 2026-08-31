import {
  ANTENNA_PATHS,
  ANTENNA_SEGMENTS,
  ARM_SEGMENTS,
  BACK_ARM_PATHS,
  BACK_ARM_SEGMENTS,
  FRONT_ARM_PATHS,
  SUCKERS,
  type ArmSegment,
} from "./tentacleGeometry";

interface TaperedProps {
  d: string;
  segments: readonly ArmSegment[];
}

/**
 * Un bras : le même tracé rendu une fois par segment, en largeur croissante.
 * `pathLength={100}` rend les bornes du `strokeDasharray` lisibles en pourcentage
 * — sans lui il faudrait connaître la longueur réelle de chaque courbe.
 */
function TaperedArm({ d, segments }: TaperedProps) {
  return (
    <>
      {segments.map((segment) => (
        <path
          key={segment.width}
          d={d}
          pathLength={100}
          strokeWidth={segment.width}
          strokeDasharray={segment.dash}
        />
      ))}
    </>
  );
}

interface TentacleArmsProps {
  /** Dégradé des bras arrière et des antennes. */
  backFill: string;
  /** Dégradé des bras avant. */
  frontFill: string;
}

/**
 * Bras, antennes et ventouses. L'ordre de rendu porte la profondeur : les
 * antennes et les bras extérieurs d'abord, le corps viendra les couvrir, puis
 * les bras avant. Les ventouses ne se posent que sur ces derniers.
 */
export function TentacleArms({ backFill, frontFill }: TentacleArmsProps) {
  return (
    <>
      <g fill="none" stroke={backFill} strokeLinecap="round">
        <TaperedArm d={ANTENNA_PATHS.left} segments={ANTENNA_SEGMENTS} />
        <TaperedArm d={ANTENNA_PATHS.right} segments={ANTENNA_SEGMENTS} />
        {BACK_ARM_PATHS.map((d) => (
          <TaperedArm key={d} d={d} segments={BACK_ARM_SEGMENTS} />
        ))}
      </g>
      <g fill="none" stroke={frontFill} strokeLinecap="round">
        {FRONT_ARM_PATHS.map((d) => (
          <TaperedArm key={d} d={d} segments={ARM_SEGMENTS} />
        ))}
      </g>
      <g fill="#fff" opacity="0.32">
        {SUCKERS.map((cup) => (
          <circle key={`${cup.cx}-${cup.cy}`} cx={cup.cx} cy={cup.cy} r={cup.r} />
        ))}
      </g>
    </>
  );
}
