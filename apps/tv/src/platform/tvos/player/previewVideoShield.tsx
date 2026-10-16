import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";

/**
 * L'enveloppe de la vidéo d'aperçu, sur Apple TV : rien — AVPlayer n'a aucun
 * contrôle qui réclame le focus. Jumeau Android : `previewVideoShield.android.tsx`,
 * aux MÊMES noms.
 */
export function PreviewVideoShield({ children }: { style?: StyleProp<ViewStyle>; children: ReactNode }) {
  return <>{children}</>;
}
