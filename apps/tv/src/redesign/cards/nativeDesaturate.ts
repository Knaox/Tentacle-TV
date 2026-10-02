import { Platform, UIManager, requireNativeComponent, type HostComponent, type ViewProps } from "react-native";

/**
 * La désaturation NATIVE d'Apple TV : la vue `TentacleDesaturateView`
 * (`ios/TentacleTV/TentacleDesaturateView.m`), un gris composé en
 * « saturation » — ce qu'elle couvre passe en niveaux de gris, sur le GPU,
 * sans rien dessiner sur le processeur. `GreyscaleImage` — et lui seul — la
 * pose sur l'affiche d'un titre absent.
 *
 * `null` quand le binaire ne l'embarque pas (Android TV, une build d'avant) :
 * `GreyscaleImage` garde alors son filtre SVG. Lu une fois, au chargement.
 */

const VIEW_NAME = "TentacleDesaturateView";

function detect(): boolean {
  if (Platform.OS !== "ios" || !Platform.isTV) return false;
  return UIManager.getViewManagerConfig(VIEW_NAME) != null;
}

export const NativeDesaturate: HostComponent<ViewProps> | null = detect() ? requireNativeComponent<ViewProps>(VIEW_NAME) : null;
