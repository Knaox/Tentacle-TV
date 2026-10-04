import { memo } from "react";
import { UIManager, requireNativeComponent, type HostComponent, type StyleProp, type ViewProps, type ViewStyle } from "react-native";
import { RENDER } from "../render/renderProfile";

/**
 * Une lumière radiale dessinée par la plateforme (`lights: "shader"` du
 * profil de rendu) : la vue native `TentacleGlowView` (Android, `render/`),
 * un dégradé radial d'une couleur évalué par le GPU dans l'ellipse inscrite
 * dans la vue — ni bitmap ni rastérisation quand la couleur change, tramé
 * contre l'effet d'escalier. Les mêmes arrêts que les disques SVG de l'Apple
 * TV (`AmbientBackdrop`, `Glow`).
 *
 * `null` sur Apple TV (« svg ») et sur un binaire sans la vue : le SVG reste.
 */

interface NativeGlowProps extends ViewProps {
  glowColor: string;
  glowOffsets: number[];
  glowAlphas: number[];
}

const VIEW_NAME = "TentacleGlowView";

const NativeGlow: HostComponent<NativeGlowProps> | null =
  RENDER.lights === "shader" && UIManager.getViewManagerConfig(VIEW_NAME) != null
    ? requireNativeComponent<NativeGlowProps>(VIEW_NAME)
    : null;

export interface RadialLightProps {
  color: string;
  /** Les arrêts, du cœur (0) au bord (1) : [position, opacité]. */
  stops: readonly (readonly [number, number])[];
  /** La place et la taille de l'ellipse (et son opacité). */
  style?: StyleProp<ViewStyle>;
}

function RadialLightView({ color, stops, style }: RadialLightProps) {
  const Glow = NativeGlow as HostComponent<NativeGlowProps>;
  return (
    <Glow
      pointerEvents="none"
      style={style}
      glowColor={color}
      glowOffsets={stops.map(([offset]) => offset)}
      glowAlphas={stops.map(([, alpha]) => alpha)}
    />
  );
}

/** La lumière native, ou `null` là où le SVG reste le dessin. */
export const RadialLight = NativeGlow ? memo(RadialLightView) : null;
