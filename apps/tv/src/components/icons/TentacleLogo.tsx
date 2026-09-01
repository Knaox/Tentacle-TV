import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from "react-native-svg";
import { scale } from "../../theme/responsive";
import {
  BACK_ARM_PATHS,
  CHEEKS,
  EYE_GLINTS,
  EYE_PUPILS,
  EYE_WHITES,
  FRONT_ARM_PATHS,
  HAT_BAND_PATH,
  HAT_PATH,
  HAT_TRANSFORM,
  HEAD_PATH,
  PLAY_PATH,
  SCREEN,
  SHINE_PATH,
  SKULL_PATH,
  SMILE_PATH,
  SUCKERS,
  SUCKER_SHADOW,
} from "./tentacleArt.generated";

/** Moue : le sourire retourné, aux mêmes extrémités. */
const FROWN_PATH = "M 114 100 C 117.5 95, 122.5 95, 126 100";

/** Une larme, dessinée à l'origine puis translatée sous chaque œil. */
const TEAR_PATH =
  "M 0 0 C 2.4 4.4, 4 7.2, 4 9.6 C 4 12.6, 2.2 14.4, 0 14.4 C -2.2 14.4, -4 12.6, -4 9.6 C -4 7.2, -2.4 4.4, 0 0 Z";

/** Encre du visage : pupilles et sourire, sur la peau claire du dôme. */
const INK = "#241040";

interface TentacleLogoProps {
  /** Taille pensée pour 1080p ; mise à l'échelle selon la résolution réelle du
   *  téléviseur (Android TV densités variées / tvOS) → proportion constante. */
  size?: number;
  /** Désactive la mise à l'échelle responsive (taille en px brute). */
  raw?: boolean;
  /** Bouche inversée et larmes — pour les écrans d'erreur et de déconnexion. */
  crying?: boolean;
}

/**
 * Dessin « l'Étreinte » : le poulpe perché derrière l'écran qu'il enlace, deux
 * pattes dessous, un play au centre, le tricorne sur la tête. Repère 240×240
 * carré, le même que `brand/logo-color.svg` — la géométrie vient de
 * `tentacleArt.generated`, produit par `brand/generate-svg.py`.
 *
 * Les bras sont des CONTOURS FERMÉS à remplir : le rendu en trait à paliers de
 * dasharray a disparu, et avec lui la conversion d'unités que `pathLength`
 * imposait au natif.
 */
export function TentacleLogo({ size = 48, raw = false, crying = false }: TentacleLogoProps) {
  const s = raw ? size : scale(size);
  return (
    <Svg width={s} height={s} viewBox="0 0 240 240" fill="none">
      <Defs>
        <LinearGradient id="tgHead" x1="0" y1="26" x2="0" y2="140" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#C4B5FD" />
          <Stop offset="0.5" stopColor="#A855F7" />
          <Stop offset="1" stopColor="#D946EF" />
        </LinearGradient>
        <LinearGradient id="tgShine" x1="0" y1="34" x2="0" y2="86" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.28} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </LinearGradient>
        <LinearGradient id="tgScreen" x1="0" y1="104" x2="0" y2="196" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#341054" />
          <Stop offset="1" stopColor="#190933" />
        </LinearGradient>
        <LinearGradient id="tgFrame" x1="46" y1="26" x2="196" y2="214" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#A78BFA" />
          <Stop offset="0.42" stopColor="#D946EF" />
          <Stop offset="1" stopColor="#EC4899" />
        </LinearGradient>
        <LinearGradient id="tgArm" x1="0" y1="118" x2="0" y2="230" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#9333EA" />
          <Stop offset="0.4" stopColor="#D946EF" />
          <Stop offset="1" stopColor="#EC4899" />
        </LinearGradient>
        <LinearGradient id="tgPlay" x1="114" y1="134" x2="142" y2="166" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#F0ABFC" />
          <Stop offset="1" stopColor="#EC4899" />
        </LinearGradient>
        <LinearGradient id="tgHat" x1="0" y1="14" x2="0" y2="78" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#3C3450" />
          <Stop offset="1" stopColor="#15111F" />
        </LinearGradient>
      </Defs>

      {/* Pattes arrière : sous la tête et l'écran */}
      <G fill="url(#tgArm)">
        {BACK_ARM_PATHS.map((d) => (
          <Path key={d.slice(0, 24)} d={d} />
        ))}
      </G>

      <Path d={HEAD_PATH} fill="url(#tgHead)" />
      <Path d={SHINE_PATH} fill="url(#tgShine)" />
      <Rect
        x={SCREEN.x}
        y={SCREEN.y}
        width={SCREEN.width}
        height={SCREEN.height}
        rx={SCREEN.rx}
        fill="url(#tgScreen)"
      />
      <Rect
        x={SCREEN.x}
        y={SCREEN.y}
        width={SCREEN.width}
        height={SCREEN.height}
        rx={SCREEN.rx}
        fill="none"
        stroke="url(#tgFrame)"
        strokeWidth={SCREEN.frameWidth}
      />

      {EYE_WHITES.map((eye) => (
        <Circle key={`white-${eye.cx}`} cx={eye.cx} cy={eye.cy} r={eye.r} fill="#FFFFFF" />
      ))}
      {EYE_PUPILS.map((eye) => (
        <Circle key={`pupil-${eye.cx}`} cx={eye.cx} cy={eye.cy} r={eye.r} fill={INK} />
      ))}
      {EYE_GLINTS.map((eye) => (
        <Circle key={`glint-${eye.cx}`} cx={eye.cx} cy={eye.cy} r={eye.r} fill="#FFFFFF" />
      ))}
      {CHEEKS.map((cheek) => (
        <Ellipse
          key={`cheek-${cheek.cx}`}
          cx={cheek.cx}
          cy={cheek.cy}
          rx={cheek.rx}
          ry={cheek.ry}
          fill="#DB2777"
          opacity={0.5}
        />
      ))}
      <Path
        d={crying ? FROWN_PATH : SMILE_PATH}
        stroke={INK}
        strokeWidth={3.2}
        strokeLinecap="round"
        fill="none"
      />
      {crying && (
        <G fill="#7DD3FC" opacity={0.9}>
          <Path d={TEAR_PATH} transform="translate(99 100)" />
          <Path d={TEAR_PATH} transform="translate(141 104)" />
        </G>
      )}

      <Path
        d={PLAY_PATH}
        fill="url(#tgPlay)"
        stroke="url(#tgPlay)"
        strokeWidth={10}
        strokeLinejoin="round"
      />

      <G transform={HAT_TRANSFORM}>
        <Path d={HAT_PATH} fill="url(#tgHat)" />
        <Path
          d={HAT_BAND_PATH}
          stroke="url(#tgFrame)"
          strokeWidth={6}
          strokeLinecap="round"
          fill="none"
        />
        <Path d={SKULL_PATH} fill="#F5F0FF" />
        <Circle cx={115} cy={39} r={3.2} fill="#241145" />
        <Circle cx={125} cy={39} r={3.2} fill="#241145" />
      </G>

      {/* Bras avant : ils enlacent l'écran PAR-DESSUS, ventouses ombrées */}
      <G fill="url(#tgArm)">
        {FRONT_ARM_PATHS.map((d) => (
          <Path key={d.slice(0, 24)} d={d} />
        ))}
      </G>
      <G fill="#1B0B33" opacity={0.22}>
        {SUCKERS.map((cup) => (
          <Circle
            key={`shadow-${cup.cx}-${cup.cy}`}
            cx={cup.cx + SUCKER_SHADOW.x}
            cy={cup.cy + SUCKER_SHADOW.y}
            r={cup.r * SUCKER_SHADOW.scale}
          />
        ))}
      </G>
      <G fill="#FBCFE8" opacity={0.8}>
        {SUCKERS.map((cup) => (
          <Circle key={`cup-${cup.cx}-${cup.cy}`} cx={cup.cx - 0.2} cy={cup.cy - 0.3} r={cup.r} />
        ))}
      </G>
    </Svg>
  );
}
