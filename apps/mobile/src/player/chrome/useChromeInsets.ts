import { Platform, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TABLET_MIN_WIDTH } from "@/theme";
import { chromeInsets, type SafeInsets } from "./chromeInsets";
import { useStableTopInset } from "./useStableTopInset";

/** Les marges des commandes du lecteur pour l'appareil et l'orientation du moment (`chromeInsets`). */
export function useChromeInsets(): SafeInsets {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const stableTop = useStableTopInset();
  return chromeInsets({
    os: Platform.OS,
    isTablet: Math.min(width, height) >= TABLET_MIN_WIDTH,
    landscape: width > height,
    insets,
    stableTop,
  });
}
