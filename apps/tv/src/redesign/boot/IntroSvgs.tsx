import { memo, type ReactNode } from "react";
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Stop } from "react-native-svg";
import { SPARKLE_PATH } from "@tentacle-tv/shared/brandIntro";
import { colors } from "../theme/tokens";
import type { LinearGradientSpec, PartBox, TentacleArt } from "./introArt";

/**
 * Les dessins des pièces de l'ouverture — chacun un `Svg` à part, rastérisé
 * UNE fois à sa taille (`width` × `height` points) : l'animation ne déplace
 * que des vues (transformation, opacité), aucun dessin ne se refait pendant
 * qu'elle joue. Tout vient des constantes générées du logo (`art`).
 */

type GradientId = keyof TentacleArt["LOGO_GRADIENTS"];

function Gradient({ id, spec }: { id: string; spec: LinearGradientSpec }) {
  return (
    <LinearGradient id={id} x1={spec.x1} y1={spec.y1} x2={spec.x2} y2={spec.y2} gradientUnits="userSpaceOnUse">
      {spec.stops.map((stop) => (
        <Stop key={stop.offset} offset={stop.offset} stopColor={stop.color} stopOpacity={stop.opacity ?? 1} />
      ))}
    </LinearGradient>
  );
}

export interface PieceProps {
  art: TentacleArt;
  box: PartBox;
  width: number;
  height: number;
}

/** Un morceau du repère du logo (`box`), dessiné à `width` × `height` points. */
function Piece({ art, box, width, height, gradients, children }: PieceProps & { gradients: readonly GradientId[]; children: ReactNode }) {
  return (
    <Svg width={width} height={height} viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`}>
      <Defs>
        {gradients.map((id) => (
          <Gradient key={id} id={id} spec={art.LOGO_GRADIENTS[id]} />
        ))}
      </Defs>
      {children}
    </Svg>
  );
}

export const ArmSvg = memo(function ArmSvg(props: PieceProps & { d: string; suckers?: readonly { cx: number; cy: number; r: number }[] }) {
  const { art, d, suckers } = props;
  return (
    <Piece {...props} gradients={["gA"]}>
      <Path d={d} fill="url(#gA)" />
      {suckers ? (
        <G fill={art.LOGO_COLORS.sucker} opacity={art.LOGO_COLORS.suckerOpacity}>
          {suckers.map((cup) => (
            <Circle key={`${cup.cx}-${cup.cy}`} cx={cup.cx} cy={cup.cy} r={cup.r} />
          ))}
        </G>
      ) : null}
    </Piece>
  );
});

export const HeadSvg = memo(function HeadSvg(props: PieceProps) {
  return (
    <Piece {...props} gradients={["gHd", "gS"]}>
      <Path d={props.art.HEAD_PATH} fill="url(#gHd)" />
      <Path d={props.art.SHINE_PATH} fill="url(#gS)" />
    </Piece>
  );
});

/** Les joues et le sourire ; avec `eyes`, les yeux aussi (la plaque nette de la plongée). */
export const FaceSvg = memo(function FaceSvg(props: PieceProps & { eyes?: boolean; hat?: boolean }) {
  const { art } = props;
  return (
    <Piece {...props} gradients={props.hat ? ["gH", "gV"] : []}>
      {props.eyes ? <EyeShapes art={art} /> : null}
      {art.CHEEKS.map((cheek) => (
        <Ellipse key={cheek.cx} cx={cheek.cx} cy={cheek.cy} rx={cheek.rx} ry={cheek.ry} fill={art.LOGO_COLORS.cheek} opacity={art.LOGO_COLORS.cheekOpacity} />
      ))}
      <Path d={art.SMILE_PATH} stroke={art.LOGO_INK} strokeWidth={3.2} strokeLinecap="round" fill="none" />
      {props.hat ? <HatShapes art={art} /> : null}
    </Piece>
  );
});

function EyeShapes({ art, only }: { art: TentacleArt; only?: number }) {
  const pick = <T,>(items: readonly T[]) => (only === undefined ? items : items.slice(only, only + 1));
  return (
    <>
      {pick(art.EYE_WHITES).map((eye) => <Circle key={`w${eye.cx}`} cx={eye.cx} cy={eye.cy} r={eye.r} fill="#FFFFFF" />)}
      {pick(art.EYE_PUPILS).map((eye) => <Circle key={`p${eye.cx}`} cx={eye.cx} cy={eye.cy} r={eye.r} fill={art.LOGO_INK} />)}
      {pick(art.EYE_GLINTS).map((eye) => <Circle key={`g${eye.cx}`} cx={eye.cx} cy={eye.cy} r={eye.r} fill="#FFFFFF" />)}
    </>
  );
}

export const EyeSvg = memo(function EyeSvg(props: PieceProps & { index: number }) {
  return (
    <Piece {...props} gradients={[]}>
      <EyeShapes art={props.art} only={props.index} />
    </Piece>
  );
});

function HatShapes({ art }: { art: TentacleArt }) {
  return (
    <G transform={art.HAT_TRANSFORM}>
      <Path d={art.HAT_PATH} fill="url(#gH)" />
      <Path d={art.HAT_BAND_PATH} stroke="url(#gV)" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d={art.SKULL_PATH} fill={art.LOGO_COLORS.skull} />
      <G fill={art.LOGO_COLORS.skullEyes}>
        <Circle cx={115} cy={39} r={3.2} />
        <Circle cx={125} cy={39} r={3.2} />
      </G>
    </G>
  );
}

export const HatSvg = memo(function HatSvg(props: PieceProps) {
  return (
    <Piece {...props} gradients={["gH", "gV"]}>
      <HatShapes art={props.art} />
    </Piece>
  );
});

export const PlaySvg = memo(function PlaySvg(props: PieceProps) {
  return (
    <Piece {...props} gradients={["gP"]}>
      <Path d={props.art.PLAY_PATH} fill="url(#gP)" stroke="url(#gP)" strokeWidth={10} strokeLinejoin="round" />
    </Piece>
  );
});

/** L'onde : un cercle de rayon 26 autour du bouton, au trait du dégradé de lecture. */
export const RingSvg = memo(function RingSvg(props: PieceProps & { cx: number; cy: number }) {
  return (
    <Piece {...props} gradients={["gP"]}>
      <Circle cx={props.cx} cy={props.cy} r={26} fill="none" stroke="url(#gP)" strokeWidth={2.5} />
    </Piece>
  );
});

/** Une lumière ronde et douce (la lueur de la nuit, l'éclair de l'allumage) : un dégradé radial seul, net à toute échelle. */
export const SoftDiscSvg = memo(function SoftDiscSvg({ size, stops }: { size: number; stops: readonly [number, string, number][] }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 2 2">
      <Defs>
        <RadialGradient id="disc" cx={1} cy={1} r={1} gradientUnits="userSpaceOnUse">
          {stops.map(([offset, color, opacity]) => (
            <Stop key={offset} offset={offset} stopColor={color} stopOpacity={opacity} />
          ))}
        </RadialGradient>
      </Defs>
      <Circle cx={1} cy={1} r={1} fill="url(#disc)" />
    </Svg>
  );
});

/** La nuit : rose au cœur, violet de marque autour, puis rien. */
export const GLOW_STOPS: readonly [number, string, number][] = [
  [0, colors.accent, 0.3],
  [0.45, colors.accentDeep, 0.13],
  [1, colors.accentDeep, 0],
];

/** L'éclair : blanc, rose clair, rose qui s'éteint. */
export const FLASH_STOPS: readonly [number, string, number][] = [
  [0, "#FFFFFF", 1],
  [0.35, colors.accentLight, 0.7],
  [1, colors.accent, 0],
];

/** Une étincelle (repère de l'étoile, rayon 1) : sa lueur et l'étoile, blanche ou rose clair. */
export const SparkleSvg = memo(function SparkleSvg({ size, pink }: { size: number; pink: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="-1.9 -1.9 3.8 3.8">
      <Defs>
        <RadialGradient id="spark" cx={0} cy={0} r={1.9} gradientUnits="userSpaceOnUse">
          <Stop offset={0} stopColor="#FFFFFF" stopOpacity={0.55} />
          <Stop offset={0.4} stopColor={colors.accentLight} stopOpacity={0.28} />
          <Stop offset={1} stopColor={colors.accentLight} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle r={1.9} fill="url(#spark)" />
      <Path d={SPARKLE_PATH} fill={pink ? colors.accentLight : "#FFFFFF"} />
    </Svg>
  );
});
