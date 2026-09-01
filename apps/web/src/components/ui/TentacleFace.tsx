import {
  CHEEKS,
  EYE_GLINTS,
  EYE_PUPILS,
  EYE_WHITES,
  HEAD_PATH,
  PLAY_PATH,
  SCREEN,
  SHINE_PATH,
  SMILE_PATH,
} from "./tentacleGeometry";

/** Moue : le sourire retourné, aux mêmes extrémités. */
const FROWN_PATH = "M 114 100 C 117.5 95, 122.5 95, 126 100";

/** Une larme, dessinée à l'origine puis translatée sous chaque œil. */
const TEAR_PATH =
  "M 0 0 C 2.4 4.4, 4 7.2, 4 9.6 C 4 12.6, 2.2 14.4, 0 14.4 C -2.2 14.4, -4 12.6, -4 9.6 C -4 7.2, -2.4 4.4, 0 0 Z";

interface TentacleFaceProps {
  headFill: string;
  shineFill: string;
  screenFill: string;
  frameFill: string;
  playFill: string;
  /** Bouche inversée et larmes — pour les écrans d'erreur et hors-ligne. */
  crying?: boolean;
}

/**
 * Tête, écran enlacé, visage et play. Le visage vit sur le DÔME, au-dessus de
 * l'écran — le poulpe regarde par-dessus le cadre. L'iris passe par
 * `--octopus-iris`, que les presets de thème redéfinissent — le jeton existait
 * avant cette refonte, il est conservé pour ne pas invalider les thèmes déjà
 * écrits par les administrateurs.
 */
export function TentacleFace({
  headFill,
  shineFill,
  screenFill,
  frameFill,
  playFill,
  crying = false,
}: TentacleFaceProps) {
  return (
    <>
      <path d={HEAD_PATH} fill={headFill} />
      <path d={SHINE_PATH} fill={shineFill} />

      <rect
        x={SCREEN.x}
        y={SCREEN.y}
        width={SCREEN.width}
        height={SCREEN.height}
        rx={SCREEN.rx}
        fill={screenFill}
      />
      <rect
        x={SCREEN.x}
        y={SCREEN.y}
        width={SCREEN.width}
        height={SCREEN.height}
        rx={SCREEN.rx}
        fill="none"
        stroke={frameFill}
        strokeWidth={SCREEN.frameWidth}
      />

      {EYE_WHITES.map((eye) => (
        <circle key={`white-${eye.cx}`} cx={eye.cx} cy={eye.cy} r={eye.r} fill="#fff" />
      ))}
      {EYE_PUPILS.map((eye) => (
        <circle
          key={`pupil-${eye.cx}`}
          cx={eye.cx}
          cy={eye.cy}
          r={eye.r}
          fill="var(--octopus-iris, #241040)"
        />
      ))}
      {EYE_GLINTS.map((eye) => (
        <circle key={`glint-${eye.cx}`} cx={eye.cx} cy={eye.cy} r={eye.r} fill="#fff" />
      ))}
      {CHEEKS.map((cheek) => (
        <ellipse
          key={`cheek-${cheek.cx}`}
          cx={cheek.cx}
          cy={cheek.cy}
          rx={cheek.rx}
          ry={cheek.ry}
          fill="var(--brand-accent-deep)"
          opacity="0.5"
        />
      ))}

      <path
        d={crying ? FROWN_PATH : SMILE_PATH}
        fill="none"
        stroke="var(--octopus-iris, #241040)"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      {crying && (
        <g fill="#7DD3FC" opacity="0.9">
          <path d={TEAR_PATH} transform="translate(99 100)" />
          <path d={TEAR_PATH} transform="translate(141 104)" />
        </g>
      )}

      <path
        d={PLAY_PATH}
        fill={playFill}
        stroke={playFill}
        strokeWidth="10"
        strokeLinejoin="round"
      />
    </>
  );
}
