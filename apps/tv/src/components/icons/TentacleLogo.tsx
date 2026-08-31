import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  Stop,
} from "react-native-svg";
import { scale } from "../../theme/responsive";
import {
  ANTENNA_ARMS,
  BACK_ARMS,
  FRONT_ARMS,
  GLASS_PATH,
  HAT_BAND_PATH,
  HAT_PATH,
  HAT_TRANSFORM,
  MANTLE_PATH,
  SHINE_PATH,
  SKULL_PATH,
  SMILE_PATH,
  SUCKERS,
  SUCKER_SHADOW,
  TUBE_PATH,
  type Arm,
} from "./tentacleArt.generated";

/** Moue : le sourire retourné, aux mêmes extrémités. */
const FROWN_PATH = "M 110 152 C 115 143, 125 143, 130 152";

/** Une larme, dessinée à l'origine puis translatée sous chaque œil. */
const TEAR_PATH =
  "M 0 0 C 2.4 4.4, 4 7.2, 4 9.6 C 4 12.6, 2.2 14.4, 0 14.4 C -2.2 14.4, -4 12.6, -4 9.6 C -4 7.2, -2.4 4.4, 0 0 Z";

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
 * Le poulpe-téléviseur coiffé du tricorne. Repère 240×240 carré, le même que
 * `brand/logo-color.svg` — la géométrie des bras vient de `tentacleArt.generated`,
 * produit par `brand/generate-svg.py`.
 *
 * Les dasharray y sont en unités RÉELLES de tracé : `pathLength` n'existe que
 * dans le rendu web de react-native-svg, et sans lui des bornes exprimées en
 * pourcentage ne veulent rien dire.
 */
export function TentacleLogo({ size = 48, raw = false, crying = false }: TentacleLogoProps) {
  const s = raw ? size : scale(size);
  return (
    <Svg width={s} height={s} viewBox="0 0 240 240" fill="none">
      <Defs>
        <LinearGradient id="tgMantle" x1="40" y1="54" x2="200" y2="186" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#A78BFA" />
          <Stop offset="0.5" stopColor="#8B5CF6" />
          <Stop offset="1" stopColor="#DB2777" />
        </LinearGradient>
        <LinearGradient id="tgArm" x1="0" y1="170" x2="0" y2="235" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#4C1D95" />
          <Stop offset="0.18" stopColor="#7C3AED" />
          <Stop offset="1" stopColor="#EC4899" />
        </LinearGradient>
        <LinearGradient id="tgArmBack" x1="0" y1="160" x2="0" y2="215" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#3B0F73" />
          <Stop offset="0.2" stopColor="#4C1D95" />
          <Stop offset="1" stopColor="#9D174D" />
        </LinearGradient>
        <LinearGradient id="tgTube" x1="0" y1="78" x2="0" y2="156" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#2E1065" />
          <Stop offset="1" stopColor="#160828" />
        </LinearGradient>
        <LinearGradient id="tgShine" x1="0" y1="54" x2="0" y2="110" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.3} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </LinearGradient>
        <LinearGradient id="tgGlass" x1="0" y1="78" x2="0" y2="130" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.22} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </LinearGradient>
        <LinearGradient id="tgHat" x1="0" y1="14" x2="0" y2="78" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#3C3450" />
          <Stop offset="1" stopColor="#15111F" />
        </LinearGradient>
        <LinearGradient id="tgBand" x1="76" y1="0" x2="164" y2="0" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#8B5CF6" />
          <Stop offset="0.5" stopColor="#A855F7" />
          <Stop offset="1" stopColor="#EC4899" />
        </LinearGradient>
      </Defs>

      <ArmGroup arms={[...ANTENNA_ARMS, ...BACK_ARMS]} stroke="url(#tgArmBack)" />
      <ArmGroup arms={FRONT_ARMS} stroke="url(#tgArm)" />

      {/* Le relief vient des ventouses, chacune posée sur son ombre : une arête
          lumineuse le long du bras le délaverait au lieu de l'arrondir. */}
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
      <G fill="#FFFFFF" opacity={0.26}>
        {SUCKERS.map((cup) => (
          <Circle key={`cup-${cup.cx}-${cup.cy}`} cx={cup.cx - 0.2} cy={cup.cy - 0.3} r={cup.r} />
        ))}
      </G>

      <Path d={MANTLE_PATH} fill="url(#tgMantle)" />
      <Path d={SHINE_PATH} fill="url(#tgShine)" />
      <Path d={TUBE_PATH} fill="url(#tgTube)" />
      <Path d={GLASS_PATH} fill="url(#tgGlass)" />

      <Ellipse cx={98} cy={117} rx={19} ry={21} fill="#FFFFFF" />
      <Ellipse cx={142} cy={117} rx={19} ry={21} fill="#FFFFFF" />
      <Circle cx={102} cy={121} r={9.5} fill="#1B0B33" />
      <Circle cx={146} cy={121} r={9.5} fill="#1B0B33" />
      <Circle cx={97.5} cy={113} r={3.8} fill="#FFFFFF" />
      <Circle cx={141.5} cy={113} r={3.8} fill="#FFFFFF" />
      <Path
        d={crying ? FROWN_PATH : SMILE_PATH}
        stroke="#F472B6"
        strokeWidth={4.6}
        strokeLinecap="round"
        fill="none"
      />
      {crying && (
        <G fill="#7DD3FC" opacity={0.9}>
          <Path d={TEAR_PATH} transform="translate(98 137)" />
          <Path d={TEAR_PATH} transform="translate(142 141)" />
        </G>
      )}
      <Ellipse cx={76} cy={146} rx={10} ry={6} fill="#F472B6" opacity={0.38} />
      <Ellipse cx={164} cy={146} rx={10} ry={6} fill="#F472B6" opacity={0.38} />

      <G transform={HAT_TRANSFORM}>
        <Path d={HAT_PATH} fill="url(#tgHat)" />
        <Path
          d={HAT_BAND_PATH}
          stroke="url(#tgBand)"
          strokeWidth={6}
          strokeLinecap="round"
          fill="none"
        />
        <Path d={SKULL_PATH} fill="#FFFFFF" />
        <Circle cx={115} cy={39} r={3.2} fill="#241145" />
        <Circle cx={125} cy={39} r={3.2} fill="#241145" />
      </G>
    </Svg>
  );
}

/**
 * Un groupe de bras. Chaque bras est le même tracé rendu une fois par palier, du
 * plus fin au plus épais — le gros recouvre les jonctions.
 *
 * `strokeLinejoin="round"` n'est pas décoratif : les tracés sont des polylignes,
 * chaque sommet est une jointure, et le `miter` par défaut projette sur un angle
 * aigu une pointe atteignant plusieurs fois l'épaisseur du trait.
 */
function ArmGroup({ arms, stroke }: { arms: readonly Arm[]; stroke: string }) {
  return (
    <G fill="none" stroke={stroke} strokeLinecap="round" strokeLinejoin="round">
      {arms.map((arm) =>
        arm.segments.map((segment) => (
          <Path
            key={`${arm.d.slice(0, 14)}-${segment.width}`}
            d={arm.d}
            strokeWidth={segment.width}
            strokeDasharray={segment.dash}
          />
        )),
      )}
    </G>
  );
}
