import { UIManager, requireNativeComponent, type HostComponent, type ViewProps } from "react-native";

/**
 * La désaturation NATIVE : la vue `TentacleDesaturateView` — un gris composé
 * en « saturation », ce qu'elle couvre passe en niveaux de gris, sur le GPU,
 * sans rien dessiner sur le processeur. `GreyscaleImage` la pose sur
 * l'affiche d'un titre absent ; `ArrivalArtwork` en dose l'opacité.
 *
 * - Apple TV : `ios/TentacleTV/TentacleDesaturateView.m` (`compositingFilter`).
 * - Android TV : `render/TentacleDesaturateView.kt` (`BlendMode.SATURATION`,
 *   Android 10 et plus ; avant, sa constante `supported` est fausse).
 *
 * `null` quand le binaire ne l'embarque pas, ou ne sait pas la rendre :
 * `GreyscaleImage` garde alors son filtre SVG. Lu une fois, au chargement.
 */

const VIEW_NAME = "TentacleDesaturateView";

function detect(): boolean {
  const config = UIManager.getViewManagerConfig(VIEW_NAME) as { Constants?: { supported?: unknown } } | null | undefined;
  // La vue d'Apple TV n'annonce rien : présente, elle sait rendre.
  return config != null && config.Constants?.supported !== false;
}

export const NativeDesaturate: HostComponent<ViewProps> | null = detect() ? requireNativeComponent<ViewProps>(VIEW_NAME) : null;
