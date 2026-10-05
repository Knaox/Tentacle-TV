import { memo } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  UIManager,
  View,
  requireNativeComponent,
  type HostComponent,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from "react-native";
import { ACTIVITY_SPINNER, SPINNER_LAYOUT_BOX, type SpinnerSize } from "@tentacle-tv/tv-core";
import { RENDER } from "../render/renderProfile";

/**
 * L'indicateur d'activité de la refonte — celui de l'Apple TV
 * (`UIActivityIndicatorView`, ce que pose `ActivityIndicator`) partout :
 * - Apple TV (`spinner: "system"`) : `ActivityIndicator`, tel quel ;
 * - Android TV (`"drawn"`) : la vue native `TentacleSpinnerView`, son dessin
 *   relevé au pixel (tv-core `activitySpinner`) — l'indicateur d'Android est
 *   un autre motif (un arc Material), et il redessinait toute la fenêtre à
 *   chaque image.
 *
 * La mise en page est celle d'`ActivityIndicator` : un conteneur centré (le
 * `style` de l'appelant), un cadre de 36 ou 20 points que le dessin déborde
 * (64 ou 40), centré. Sur Android, la vue native prend le cadre du dessin et
 * des marges négatives le ramènent à celui de React Native : son invalidation
 * couvre tout ce qui change.
 */

interface NativeSpinnerProps extends ViewProps {
  spinnerColor: string;
  spinnerSize: SpinnerSize;
}

const VIEW_NAME = "TentacleSpinnerView";

const NativeSpinner: HostComponent<NativeSpinnerProps> | null =
  RENDER.spinner === "drawn" && UIManager.getViewManagerConfig(VIEW_NAME) != null
    ? requireNativeComponent<NativeSpinnerProps>(VIEW_NAME)
    : null;

/** Le cadre du dessin, ramené par ses marges à celui de React Native. */
const DRAWN_STYLE: Readonly<Record<SpinnerSize, ViewStyle>> = {
  large: drawnStyle("large"),
  small: drawnStyle("small"),
};

function drawnStyle(size: SpinnerSize): ViewStyle {
  const drawn = ACTIVITY_SPINNER[size].box;
  return { width: drawn, height: drawn, margin: (SPINNER_LAYOUT_BOX[size] - drawn) / 2 };
}

export interface ActivitySpinnerProps {
  /** Comme `ActivityIndicator` : `small` par défaut. */
  size?: SpinnerSize;
  color: string;
  style?: StyleProp<ViewStyle>;
}

export const ActivitySpinner = memo(function ActivitySpinner({ size = "small", color, style }: ActivitySpinnerProps) {
  if (!NativeSpinner) return <ActivityIndicator size={size} color={color} style={style} />;
  return (
    <View pointerEvents="none" style={[styles.container, style]}>
      <NativeSpinner spinnerColor={color} spinnerSize={size} style={DRAWN_STYLE[size]} />
    </View>
  );
});

const styles = StyleSheet.create({
  // Celui d'`ActivityIndicator` (React Native).
  container: { alignItems: "center", justifyContent: "center" },
});
