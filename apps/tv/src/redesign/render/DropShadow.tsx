import { memo } from "react";
import {
  StyleSheet,
  UIManager,
  processColor,
  requireNativeComponent,
  type ColorValue,
  type HostComponent,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from "react-native";
import { dropShadowOf, shadowExtent } from "@tentacle-tv/tv-core";
import { RENDER } from "./renderProfile";

/**
 * L'ombre portée d'une vue, sur une plateforme qui ne dessine pas ses styles
 * iOS (`shadowColor`, `shadowOpacity`, `shadowRadius`, `shadowOffset`) —
 * Android, ancienne architecture. À poser en PREMIER enfant de la vue qui
 * porte ces styles, avec ces mêmes styles (`of`) : ils restent la seule
 * source, l'Apple TV les dessine elle-même et ce composant n'y rend RIEN
 * (profil de rendu `shadows: "layer"`).
 *
 * Ailleurs (`shadows: "mask"`) : la vue native `TentacleShadowView`, qui
 * déborde de son parent de toute l'étendue du flou (ses bornes couvrent ce
 * qu'elle dessine : Android repeint juste quand elle bouge) et dessine autour
 * de lui un masque flouté une fois (voir `render/TentacleShadowView.kt`) —
 * jamais par-dessus son fond. Le
 * parent ne doit pas rogner (`overflow: "hidden"`) : sur Apple TV non plus,
 * une vue qui rogne ne projette pas d'ombre.
 *
 * `coverage` : l'opacité de ce qui projette. `CALayer` tire l'ombre de
 * l'alpha de la vue ; par défaut, celui de son fond (`backgroundColor`), 1
 * sans fond.
 */

/** Des props à plat : React ne renvoie au natif que celles qui changent. */
interface ShadowMask {
  /** La couleur telle qu'écrite : la prop native est de type « Color », React
   *  Native la convertit lui-même (une valeur déjà convertie serait refusée). */
  maskColor: ColorValue;
  maskOpacity: number;
  maskBlur: number;
  maskOffsetX: number;
  maskOffsetY: number;
  maskRadius: number;
  maskOutset: number;
  /** Le débord de la vue autour de son parent, de chaque côté. */
  maskExtent: number;
}

type NativeShadowProps = ViewProps & ShadowMask;

const VIEW_NAME = "TentacleShadowView";

const NativeShadow: HostComponent<NativeShadowProps> | null =
  RENDER.shadows === "mask" && UIManager.getViewManagerConfig(VIEW_NAME) != null
    ? requireNativeComponent<NativeShadowProps>(VIEW_NAME)
    : null;

/** L'alpha d'une couleur de style, 0 à 1 ; 1 sans couleur lisible. */
function alphaOf(color: unknown): number {
  if (color == null) return 1;
  const value = processColor(color as Parameters<typeof processColor>[0]);
  return typeof value === "number" ? ((value >>> 24) & 0xff) / 255 : 1;
}

function maskOf(of: StyleProp<ViewStyle>, coverage: number | undefined): ShadowMask | null {
  const flat = StyleSheet.flatten(of) ?? {};
  const spec = dropShadowOf(flat, coverage ?? alphaOf(flat.backgroundColor));
  if (!spec) return null;
  if (typeof processColor(spec.color) !== "number") return null;
  return {
    maskColor: spec.color,
    maskOpacity: spec.opacity,
    maskBlur: spec.blur,
    maskOffsetX: spec.offsetX,
    maskOffsetY: spec.offsetY,
    maskRadius: typeof flat.borderRadius === "number" ? flat.borderRadius : 0,
    maskOutset: typeof flat.borderWidth === "number" ? flat.borderWidth : 0,
    maskExtent: shadowExtent(spec) + (typeof flat.borderWidth === "number" ? flat.borderWidth : 0),
  };
}

export interface DropShadowProps {
  /** Les styles de la vue qui projette (au moins ses `shadow*`, son
   *  `borderRadius`, et son fond). */
  of: StyleProp<ViewStyle>;
  coverage?: number;
}

export const DropShadow = NativeShadow ? memo(function DropShadow({ of, coverage }: DropShadowProps) {
  const Shadow = NativeShadow as HostComponent<NativeShadowProps>;
  const mask = maskOf(of, coverage);
  if (!mask) return null;
  const e = -mask.maskExtent;
  return <Shadow pointerEvents="none" {...mask} style={{ position: "absolute", left: e, top: e, right: e, bottom: e }} />;
}) : NoShadow;

/** Apple TV : l'ombre est celle du système, rien à ajouter. */
function NoShadow(_: DropShadowProps): null {
  return null;
}
