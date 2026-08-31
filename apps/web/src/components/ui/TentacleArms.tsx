import { Fragment } from "react";
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

/** Décalage de l'ombre sous une ventouse, et son grossissement. */
const SHADOW_OFFSET = { x: 0.7, y: 0.9, scale: 1.18 };

export interface TaperedProps {
  d: string;
  segments: readonly ArmSegment[];
}

/**
 * Un bras : le même tracé rendu une fois par palier, en largeur croissante.
 * `pathLength={100}` rend les bornes du `strokeDasharray` lisibles en pourcentage
 * — sans lui il faudrait connaître la longueur réelle de chaque spirale.
 */
export function TaperedArm({ d, segments }: TaperedProps) {
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
 * Les huit bras — deux dressés en antennes, six en dessous — et leurs ventouses.
 *
 * Ce sont les ventouses qui portent le relief, chacune posée sur son ombre. Une
 * arête lumineuse décalée le long du bras avait été essayée : elle délave le
 * bras au lieu de l'arrondir. L'opacité vit sur le GROUPE et non sur chaque
 * cercle, sinon les recouvrements la cumulent.
 */
export function TentacleArms({ backFill, frontFill }: TentacleArmsProps) {
  return (
    <>
      <g fill="none" stroke={backFill} strokeLinecap="round" strokeLinejoin="round">
        {ANTENNA_PATHS.map((d) => (
          <Fragment key={d}>
            <TaperedArm d={d} segments={ANTENNA_SEGMENTS} />
          </Fragment>
        ))}
        {BACK_ARM_PATHS.map((d) => (
          <Fragment key={d}>
            <TaperedArm d={d} segments={BACK_ARM_SEGMENTS} />
          </Fragment>
        ))}
      </g>
      <g fill="none" stroke={frontFill} strokeLinecap="round" strokeLinejoin="round">
        {FRONT_ARM_PATHS.map((d) => (
          <Fragment key={d}>
            <TaperedArm d={d} segments={ARM_SEGMENTS} />
          </Fragment>
        ))}
      </g>
      <g fill="#1B0B33" opacity="0.22">
        {SUCKERS.map((cup) => (
          <circle
            key={`shadow-${cup.cx}-${cup.cy}`}
            cx={cup.cx + SHADOW_OFFSET.x}
            cy={cup.cy + SHADOW_OFFSET.y}
            r={cup.r * SHADOW_OFFSET.scale}
          />
        ))}
      </g>
      <g fill="#fff" opacity="0.26">
        {SUCKERS.map((cup) => (
          <circle key={`cup-${cup.cx}-${cup.cy}`} cx={cup.cx - 0.2} cy={cup.cy - 0.3} r={cup.r} />
        ))}
      </g>
    </>
  );
}
