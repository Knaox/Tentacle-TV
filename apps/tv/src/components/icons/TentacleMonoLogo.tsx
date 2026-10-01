import Svg, { Circle, ClipPath, Defs, G, Mask, Path, Rect } from "react-native-svg";
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
  SKULL_PATH,
  SMILE_PATH,
} from "./tentacleArt.generated";

/** Largeur du liseré qui détache les bras avant du cadre de l'écran. */
const OUTLINE = 8;
/** Demi-épaisseur du cadre : l'intérieur de l'écran se creuse, le cadre reste. */
const FRAME_INSET = SCREEN.frameWidth / 2;

interface TentacleMonoLogoProps {
  /** Côté du carré 240 × 240 du dessin, en points (taille brute). */
  size: number;
  color: string;
}

/**
 * La mascotte en une seule masse — `brand/logo-mono.svg`, composée comme sur
 * le web (`TentacleMonoSvg`) depuis la géométrie GÉNÉRÉE
 * (`tentacleArt.generated`) : rien n'y est redessiné. Ce n'est pas la version
 * couleur passée à un filtre (elle deviendrait une tache) : chaque détail est
 * creusé au masque — l'écran devient un trou (son cadre reste, le play y
 * reste), yeux et sourire se creusent dans le dôme, les bras avant se
 * détachent du cadre par un liseré borné à l'écran.
 */
export function TentacleMonoLogo({ size, color }: TentacleMonoLogoProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 240 240">
      <Defs>
        <ClipPath id="monoArms">
          <Rect x={0} y={SCREEN.y - 4} width={240} height={240 - SCREEN.y + 4} />
        </ClipPath>
        <Mask id="monoCut" maskUnits="userSpaceOnUse" x={0} y={0} width={240} height={240}>
          <Rect width={240} height={240} fill="#fff" />
          {/* L'écran se creuse (le cadre reste plein), le play y demeure */}
          <Rect
            x={SCREEN.x + FRAME_INSET}
            y={SCREEN.y + FRAME_INSET}
            width={SCREEN.width - SCREEN.frameWidth}
            height={SCREEN.height - SCREEN.frameWidth}
            rx={SCREEN.rx - FRAME_INSET}
            fill="#000"
          />
          <Path d={PLAY_PATH} fill="#fff" stroke="#fff" strokeWidth={10} strokeLinejoin="round" />
          {/* Yeux creusés dans le dôme, pupilles rétablies en îlots */}
          {EYE_WHITES.map((eye) => (
            <Circle key={`white-${eye.cx}`} cx={eye.cx} cy={eye.cy} r={eye.r} fill="#000" />
          ))}
          {EYE_PUPILS.map((eye) => (
            <Circle key={`pupil-${eye.cx}`} cx={eye.cx} cy={eye.cy} r={eye.r} fill="#fff" />
          ))}
          <Path d={SMILE_PATH} fill="none" stroke="#000" strokeWidth={3.2} strokeLinecap="round" />
          <G transform={HAT_TRANSFORM} fill="none" stroke="#000" strokeLinecap="round">
            <Path d={HAT_BRIM_PATH} strokeWidth={9} />
            <Path d={HAT_BAND_PATH} strokeWidth={10} />
          </G>
          {/* Crâne creusé, sans ses propres yeux : à cette taille ils ne survivraient pas */}
          <Path transform={HAT_TRANSFORM} d={SKULL_PATH} fill="#000" />
          {/* Liseré des bras avant, borné à l'écran ; les bras rétablis entiers */}
          <G clipPath="url(#monoArms)">
            {FRONT_ARM_PATHS.map((d) => (
              <Path key={`outline-${d.slice(0, 24)}`} d={d} fill="none" stroke="#000" strokeWidth={OUTLINE} strokeLinejoin="round" />
            ))}
          </G>
          {FRONT_ARM_PATHS.map((d) => (
            <Path key={`front-${d.slice(0, 24)}`} d={d} fill="#fff" />
          ))}
        </Mask>
      </Defs>
      <G mask="url(#monoCut)" fill={color}>
        {BACK_ARM_PATHS.map((d) => (
          <Path key={`back-${d.slice(0, 24)}`} d={d} />
        ))}
        <Path d={HEAD_PATH} />
        <Rect x={SCREEN.x} y={SCREEN.y} width={SCREEN.width} height={SCREEN.height} rx={SCREEN.rx} />
        <Path d={HAT_PATH} transform={HAT_TRANSFORM} />
        {FRONT_ARM_PATHS.map((d) => (
          <Path key={`front-${d.slice(0, 24)}`} d={d} />
        ))}
      </G>
    </Svg>
  );
}
