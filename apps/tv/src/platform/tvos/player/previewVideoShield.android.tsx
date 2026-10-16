import type { ReactNode } from "react";
import { UIManager, View, requireNativeComponent, type HostComponent, type StyleProp, type ViewProps, type ViewStyle } from "react-native";

/**
 * L'enveloppe de la vidéo d'aperçu, sur Android TV : une vue dont aucun
 * descendant ne prend le focus (`TentacleFocusBlock`, `focus/TentacleFocusBlock.kt`).
 * Le contrôleur d'ExoPlayer réclamait le focus pour son bouton Lecture : il
 * quittait la carte au premier plan de l'aperçu et retombait sur le héros.
 * Un binaire qui ne l'embarque pas : une `View`, comme avant.
 */
const VIEW_NAME = "TentacleFocusBlock";

const NativeFocusBlock: HostComponent<ViewProps> | null =
  UIManager.getViewManagerConfig(VIEW_NAME) != null ? requireNativeComponent<ViewProps>(VIEW_NAME) : null;

export function PreviewVideoShield({ style, children }: { style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const Shield = NativeFocusBlock ?? View;
  return (
    <Shield collapsable={false} pointerEvents="none" style={style}>
      {children}
    </Shield>
  );
}
