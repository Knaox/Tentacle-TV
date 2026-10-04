import { Platform, UIManager, requireNativeComponent, type HostComponent, type ViewProps } from "react-native";

/**
 * La section NATIVE des téléviseurs : la vue `TentacleFocusSection`
 * (Apple TV : `ios/TentacleTV/TentacleFocusSection.m` ; Android TV :
 * `android/app/src/main/java/com/tentacletv/focus/TentacleFocusSection.kt`,
 * aux mêmes props), que `FocusSection` — et lui seul — monte.
 *
 * Présente quand l'app tourne sur un téléviseur et que son binaire embarque la
 * vue (un binaire plus ancien ne l'a pas) ; sinon `null`, et `FocusSection` rend
 * une `View` : la page garde le défilement de la plateforme, sans règle de
 * voisinage. Lu une fois, au chargement.
 */

export interface NativeFocusSectionProps extends ViewProps {
  revealMode: "none" | "nearest" | "anchor" | "start";
  revealMargin?: number;
  revealTop?: number;
  revealResponse: number;
  revealDamping: number;
  lineList?: boolean;
}

const VIEW_NAME = "TentacleFocusSection";

function detectNativeSection(): boolean {
  if (!Platform.isTV) return false;
  return UIManager.getViewManagerConfig(VIEW_NAME) != null;
}

/** La vue native, ou `null` hors d'un téléviseur (ou d'un binaire qui l'embarque). */
export const NativeFocusSection: HostComponent<NativeFocusSectionProps> | null = detectNativeSection()
  ? requireNativeComponent<NativeFocusSectionProps>(VIEW_NAME)
  : null;
