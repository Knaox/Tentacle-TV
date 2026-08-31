import { Fragment, useId, type CSSProperties } from "react";
import {
  ANTENNA_PATHS,
  ANTENNA_SEGMENTS,
  ARM_SEGMENTS,
  BACK_ARM_PATHS,
  BACK_ARM_SEGMENTS,
  FRONT_ARM_PATHS,
  HAT_BAND_PATH,
  HAT_BRIM_PATH,
  HAT_PATH,
  HAT_TRANSFORM_MONO,
  MANTLE_PATH,
  SKULL_PATH,
  TUBE_PATH,
  type ArmSegment,
} from "./tentacleGeometry";

interface TentacleMonoSvgProps {
  size: number;
  style?: CSSProperties;
}

/** Largeur du liseré qui détache un bras avant de ses voisins. */
const OUTLINE = 8;

function armPaths(d: string, segments: readonly ArmSegment[], extra = 0, stroke?: string) {
  return segments.map((segment) => (
    <path
      key={`${stroke ?? "body"}-${segment.width}`}
      d={d}
      pathLength={100}
      strokeWidth={segment.width + extra}
      strokeDasharray={segment.dash}
      stroke={stroke}
    />
  ));
}

/**
 * La mascotte en une seule couleur — `currentColor`, donc pilotable par la
 * couleur héritée : blanche dans un conteneur de marque, sombre sur fond clair.
 *
 * Ce n'est PAS la version couleur passée à un filtre. `brightness(0) invert(1)`
 * aplatirait tube, yeux et corps dans la même valeur : la mascotte deviendrait
 * une tache. Ici chaque détail est creusé au masque, et chaque bras avant reçoit
 * un liseré — sans lui les cinq bras fusionnent en une masse informe.
 */
export function TentacleMonoSvg({ size, style }: TentacleMonoSvgProps) {
  const unique = useId().replace(/[^a-zA-Z0-9-]/g, "");
  const maskId = `tg-mono-${unique}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 240 240"
      width={size}
      height={size}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <mask id={maskId}>
          <rect width="240" height="240" fill="#fff" />

          {/* Détachement des bras avant : liseré creusé, puis le bras rétabli.
              Traités du plus lointain au plus proche — l'ordre des découpes porte
              ici la profondeur que le dégradé donne à la version couleur. */}
          <g fill="none" strokeLinecap="round" strokeLinejoin="round">
            {FRONT_ARM_PATHS.map((d) => (
              <Fragment key={d}>
                {armPaths(d, ARM_SEGMENTS, OUTLINE, "#000")}
                {armPaths(d, ARM_SEGMENTS, 0, "#fff")}
              </Fragment>
            ))}
          </g>

          {/* Le tube est creusé ; les yeux y reviennent en îlots, leurs pupilles s'y recreusent */}
          <path d={TUBE_PATH} fill="#000" />
          <ellipse cx="98" cy="116" rx="20" ry="22" fill="#fff" />
          <ellipse cx="142" cy="116" rx="20" ry="22" fill="#fff" />
          <circle cx="101" cy="120" r="11" fill="#000" />
          <circle cx="145" cy="120" r="11" fill="#000" />

          <g transform={HAT_TRANSFORM_MONO} fill="none" stroke="#000" strokeLinecap="round">
            <path d={HAT_BRIM_PATH} strokeWidth="9" />
            <path d={HAT_BAND_PATH} strokeWidth="10" />
          </g>
          {/* Crâne creusé, sans ses propres yeux : sous 2 px ils ne survivraient pas */}
          <path transform={HAT_TRANSFORM_MONO} d={SKULL_PATH} fill="#000" />
        </mask>
      </defs>

      <g mask={`url(#${maskId})`} fill="currentColor">
        <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
          {ANTENNA_PATHS.map((d) => (
            <Fragment key={d}>{armPaths(d, ANTENNA_SEGMENTS)}</Fragment>
          ))}
          {BACK_ARM_PATHS.map((d) => (
            <Fragment key={d}>{armPaths(d, BACK_ARM_SEGMENTS)}</Fragment>
          ))}
          {FRONT_ARM_PATHS.map((d) => (
            <Fragment key={d}>{armPaths(d, ARM_SEGMENTS)}</Fragment>
          ))}
        </g>
        <path d={MANTLE_PATH} />
        <path d={HAT_PATH} transform={HAT_TRANSFORM_MONO} />
      </g>
    </svg>
  );
}
