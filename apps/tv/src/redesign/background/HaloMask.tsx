import { memo } from "react";
import { StyleSheet, UIManager, processColor, requireNativeComponent, type HostComponent, type ViewProps } from "react-native";
import { RENDER } from "../render/renderProfile";

/**
 * Le halo d'une œuvre dessiné par la plateforme (`halos: "mask"` du profil de
 * rendu) : la vue native `TentacleHaloView` (Android, `render/`) — la forme
 * floutée UNE fois par géométrie, partagée par toutes les œuvres, teinte au
 * dessin par le dégradé de la marque. Le même dessin que le SVG de l'Apple
 * TV (`ArtworkHalo`), sans rien flouter quand l'œuvre change.
 *
 * `null` sur Apple TV (« svg ») et sur un binaire qui n'embarque pas la vue :
 * `ArtworkHalo` garde son SVG.
 */

interface NativeHaloProps extends ViewProps {
  haloColors: number[];
  haloBlur: number;
  haloInset: number;
  haloRadius: number;
}

const VIEW_NAME = "TentacleHaloView";

const NativeHalo: HostComponent<NativeHaloProps> | null =
  RENDER.halos === "mask" && UIManager.getViewManagerConfig(VIEW_NAME) != null
    ? requireNativeComponent<NativeHaloProps>(VIEW_NAME)
    : null;

export interface HaloMaskProps {
  /** Les trois lumières du dégradé, de gauche à droite. */
  glows: readonly string[];
  /** Le flou, l'arrondi et la place du rectangle lumineux dans la vue. */
  blur: number;
  radius: number;
  inset: number;
  opacity: number;
}

function HaloMaskView({ glows, blur, radius, inset, opacity }: HaloMaskProps) {
  const Halo = NativeHalo as HostComponent<NativeHaloProps>;
  const colors = glows.slice(0, 3).map((glow) => processColor(glow));
  if (colors.some((color) => typeof color !== "number")) return null;
  return (
    <Halo
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { opacity }]}
      haloColors={colors as number[]}
      haloBlur={blur}
      haloInset={inset}
      haloRadius={radius}
    />
  );
}

/** Le halo natif, ou `null` là où le SVG reste le dessin. */
export const HaloMask = NativeHalo ? memo(HaloMaskView) : null;
