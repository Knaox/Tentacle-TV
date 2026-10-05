import { View } from "react-native";
import type { MenuPressInterceptorProps } from "./menuPressInterceptorTypes";

/**
 * Android TV : une simple `View`. Le Retour y arrive au JS par BackHandler
 * (`platform/androidtv/back/`) — rien à intercepter. Le pendant `MenuPressInterceptor.ios.tsx` est résolu pour
 * l'Apple TV, où UIKit garde le bouton Menu pour lui.
 */
export function MenuPressInterceptor({ enabled: _enabled, onMenuPress: _onMenuPress, ...viewProps }: MenuPressInterceptorProps) {
  return <View {...viewProps} />;
}
