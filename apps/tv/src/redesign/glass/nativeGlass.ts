import { Platform, UIManager, requireNativeComponent, type HostComponent, type ViewProps } from "react-native";
import type { GlassTone } from "./GlassSurface";

/**
 * Le verre NATIF de tvOS 26 : la vue `TentacleGlassView`
 * (`ios/TentacleTV/TentacleGlassView.m`), un `UIGlassEffect` que
 * `GlassSurface` — et lui seul — monte en couche de fond, sous ses enfants.
 *
 * Présent quand trois conditions tiennent : l'app tourne sur Apple TV, son
 * binaire embarque la vue (un binaire plus ancien ne l'a pas), et le système
 * sait rendre le verre (constante `supported` : tvOS 26 et plus). Sinon —
 * Android TV, tvOS 17 et 18 — `NativeGlassView` vaut `null` et `GlassSurface`
 * garde sa simulation. Lu une fois, au chargement : rien de tout cela ne
 * change pendant que l'app tourne.
 */

export interface NativeGlassProps extends ViewProps {
  radius: number;
  tone: GlassTone;
}

const VIEW_NAME = "TentacleGlassView";

function detectNativeGlass(): boolean {
  if (Platform.OS !== "ios" || !Platform.isTV) return false;
  const config = UIManager.getViewManagerConfig(VIEW_NAME) as { Constants?: { supported?: unknown } } | null | undefined;
  return config?.Constants?.supported === true;
}

/** Vrai quand le système rend le verre natif. */
export const NATIVE_GLASS_SUPPORTED: boolean = detectNativeGlass();

/** La vue native, ou `null` quand le système ne sait pas la rendre. */
export const NativeGlassView: HostComponent<NativeGlassProps> | null = NATIVE_GLASS_SUPPORTED
  ? requireNativeComponent<NativeGlassProps>(VIEW_NAME)
  : null;
