import type { ViewProps } from "react-native";

/**
 * Props communes aux deux variantes, résolues par plateforme :
 * `MenuPressInterceptor.ios.tsx` (Apple TV, vue native qui prend le bouton
 * Menu) et `MenuPressInterceptor.tsx` (Android TV, une simple `View` — le
 * Retour y arrive au JS par BackHandler, d'où qu'il parte).
 */
export interface MenuPressInterceptorProps extends ViewProps {
  /**
   * Prendre les appuis Menu partis du sous-arbre. Faux, UIKit les reçoit comme
   * avant — et à la racine, il quitte l'application : la règle tvOS, que seul
   * UIKit sait appliquer.
   */
  enabled: boolean;
  /** Menu relâché, le focus dans le sous-arbre et `enabled` vrai. */
  onMenuPress: () => void;
}
