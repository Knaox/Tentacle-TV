import { useId, type CSSProperties } from "react";
import {
  BACK_ARM_PATHS,
  EYE_PUPILS,
  EYE_WHITES,
  FRONT_ARM_PATHS,
  HAT_BAND_PATH,
  HAT_BRIM_PATH,
  HAT_PATH,
  HAT_TRANSFORM,
  HEAD_PATH,
  PLAY_PATH,
  SCREEN,
  SMILE_PATH,
  SKULL_PATH,
} from "./tentacleGeometry";

interface TentacleMonoSvgProps {
  size: number;
  style?: CSSProperties;
}

/** Largeur du liseré qui détache les bras avant du cadre de l'écran. */
const OUTLINE = 8;

/** Demi-épaisseur du cadre : l'intérieur de l'écran se creuse, le cadre reste. */
const FRAME_INSET = SCREEN.frameWidth / 2;

/**
 * La mascotte en une seule couleur — `currentColor`, donc pilotable par la
 * couleur héritée : blanche dans un conteneur de marque, sombre sur fond clair.
 *
 * Ce n'est PAS la version couleur passée à un filtre. `brightness(0) invert(1)`
 * aplatirait écran, yeux et corps dans la même valeur : la mascotte deviendrait
 * une tache. Ici chaque détail est creusé au masque : l'écran devient un trou
 * (son cadre reste plein, le play y reste plein), yeux et sourire se creusent
 * dans le dôme, et les bras avant reçoivent un liseré — borné à l'écran par un
 * clip : plus haut, le bras longe la tête et doit fusionner avec elle.
 */
export function TentacleMonoSvg({ size, style }: TentacleMonoSvgProps) {
  const unique = useId().replace(/[^a-zA-Z0-9-]/g, "");
  const maskId = `tg-mono-${unique}`;
  const clipId = `tg-mono-clip-${unique}`;

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
        <clipPath id={clipId}>
          <rect x="0" y={SCREEN.y - 4} width="240" height={240 - SCREEN.y + 4} />
        </clipPath>
        <mask id={maskId}>
          <rect width="240" height="240" fill="#fff" />

          {/* L'écran se creuse (le cadre reste plein), le play y demeure */}
          <rect
            x={SCREEN.x + FRAME_INSET}
            y={SCREEN.y + FRAME_INSET}
            width={SCREEN.width - SCREEN.frameWidth}
            height={SCREEN.height - SCREEN.frameWidth}
            rx={SCREEN.rx - FRAME_INSET}
            fill="#000"
          />
          <path d={PLAY_PATH} fill="#fff" stroke="#fff" strokeWidth="10" strokeLinejoin="round" />

          {/* Yeux creusés dans le dôme, pupilles rétablies en îlots */}
          {EYE_WHITES.map((eye) => (
            <circle key={`white-${eye.cx}`} cx={eye.cx} cy={eye.cy} r={eye.r} fill="#000" />
          ))}
          {EYE_PUPILS.map((eye) => (
            <circle key={`pupil-${eye.cx}`} cx={eye.cx} cy={eye.cy} r={eye.r} fill="#fff" />
          ))}
          <path
            d={SMILE_PATH}
            fill="none"
            stroke="#000"
            strokeWidth="3.2"
            strokeLinecap="round"
          />

          <g transform={HAT_TRANSFORM} fill="none" stroke="#000" strokeLinecap="round">
            <path d={HAT_BRIM_PATH} strokeWidth="9" />
            <path d={HAT_BAND_PATH} strokeWidth="10" />
          </g>
          {/* Crâne creusé, sans ses propres yeux : sous 2 px ils ne survivraient pas */}
          <path transform={HAT_TRANSFORM} d={SKULL_PATH} fill="#000" />

          {/* Liseré des bras avant, borné à l'écran ; les bras rétablis entiers */}
          <g clipPath={`url(#${clipId})`}>
            {FRONT_ARM_PATHS.map((d) => (
              <path
                key={`outline-${d.slice(0, 24)}`}
                d={d}
                fill="none"
                stroke="#000"
                strokeWidth={OUTLINE}
                strokeLinejoin="round"
              />
            ))}
          </g>
          {FRONT_ARM_PATHS.map((d) => (
            <path key={`front-${d.slice(0, 24)}`} d={d} fill="#fff" />
          ))}
        </mask>
      </defs>

      <g mask={`url(#${maskId})`} fill="currentColor">
        {BACK_ARM_PATHS.map((d) => (
          <path key={`back-${d.slice(0, 24)}`} d={d} />
        ))}
        <path d={HEAD_PATH} />
        <rect
          x={SCREEN.x}
          y={SCREEN.y}
          width={SCREEN.width}
          height={SCREEN.height}
          rx={SCREEN.rx}
        />
        <path d={HAT_PATH} transform={HAT_TRANSFORM} />
        {FRONT_ARM_PATHS.map((d) => (
          <path key={`front-${d.slice(0, 24)}`} d={d} />
        ))}
      </g>
    </svg>
  );
}
