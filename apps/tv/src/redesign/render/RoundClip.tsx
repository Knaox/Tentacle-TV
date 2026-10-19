import { memo, type ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

export interface RoundClipProps {
  style?: StyleProp<ViewStyle>;
  /** L'arrondi des coins (points). */
  radius: number;
  /** Faux : plus aucun rognage — le contenu déborde librement. */
  clip?: boolean;
  children?: ReactNode;
}

/**
 * Une vue qui rogne son contenu en rectangle arrondi. Apple TV : la vue
 * arrondie de React Native (`overflow: "hidden"`, Core Animation découpe
 * tout). Android : `RoundClip.android.tsx` — le rognage arrondi de React Native
 * n'y tient pas (coins carrés), une vue native se rogne par son contour.
 */
export const RoundClip = memo(function RoundClip({ style, radius, clip = true, children }: RoundClipProps) {
  return <View style={[style, clip ? { overflow: "hidden", borderRadius: radius } : { overflow: "visible", borderRadius: 0 }]}>{children}</View>;
});
