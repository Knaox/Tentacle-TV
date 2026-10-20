import { createContext, memo, useContext, useMemo, type ComponentType, type ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

/**
 * Les deux primitives natives que la scène emprunte à l'app qui la monte :
 * chaque app a la sienne (la TV `react-native-linear-gradient` et sa vue
 * native de découpe d'Android, le mobile `expo-linear-gradient`). La scène ne
 * dépend d'aucune : l'app les lui passe (`BootIntroView` › `primitives`).
 */
export interface IntroGradientProps {
  style?: StyleProp<ViewStyle>;
  colors: string[];
  locations: number[];
  start: { x: number; y: number };
  end: { x: number; y: number };
}

export interface IntroRoundClipProps {
  style?: StyleProp<ViewStyle>;
  /** L'arrondi des coins (points). */
  radius: number;
  /** Faux : plus aucun rognage — le contenu déborde librement. */
  clip?: boolean;
  children?: ReactNode;
}

export interface IntroPrimitives {
  LinearGradient: ComponentType<IntroGradientProps>;
  /** Absente : la vue arrondie de React Native (iOS, tvOS, Android en nouvelle architecture). */
  RoundClip?: ComponentType<IntroRoundClipProps>;
}

/**
 * La découpe arrondie de React Native : Core Animation sur iOS et tvOS, le
 * contour arrondi de la nouvelle architecture sur Android. L'ancienne
 * architecture d'Android rognait en rectangle (l'Android TV passe sa vue
 * native `TentacleRoundClip`).
 */
export const ViewRoundClip = memo(function ViewRoundClip({ style, radius, clip = true, children }: IntroRoundClipProps) {
  return <View style={[style, clip ? { overflow: "hidden", borderRadius: radius } : { overflow: "visible", borderRadius: 0 }]}>{children}</View>;
});

const PrimitivesContext = createContext<Required<IntroPrimitives> | null>(null);

export function IntroPrimitivesProvider({ primitives, children }: { primitives: IntroPrimitives; children: ReactNode }) {
  const { LinearGradient, RoundClip = ViewRoundClip } = primitives;
  const value = useMemo(() => ({ LinearGradient, RoundClip }), [LinearGradient, RoundClip]);
  return <PrimitivesContext.Provider value={value}>{children}</PrimitivesContext.Provider>;
}

export function useIntroPrimitives(): Required<IntroPrimitives> {
  const value = useContext(PrimitivesContext);
  if (value === null) throw new Error("L'ouverture se monte sous BootIntroView (primitives absentes).");
  return value;
}
