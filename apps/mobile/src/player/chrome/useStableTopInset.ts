import { useRef } from "react";
import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { stableTopInset } from "./statusBarPlan";

/**
 * La marge sûre du haut, sans à-coup quand la barre d'état paraît ou s'en va :
 * la plus grande vue dans l'orientation courante (cf. `stableTopInset`).
 */
export function useStableTopInset(): number {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const maxByOrientation = useRef<{ portrait?: number; landscape?: number }>({});
  const key = width > height ? "landscape" : "portrait";
  const value = stableTopInset(maxByOrientation.current[key], insets.top);
  maxByOrientation.current[key] = value;
  return value;
}
