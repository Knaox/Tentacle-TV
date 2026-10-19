import { memo } from "react";
import { UIManager, View, requireNativeComponent, type HostComponent, type ViewProps } from "react-native";
import type { RoundClipProps } from "./RoundClip";

export type { RoundClipProps } from "./RoundClip";

/**
 * Le jumeau Android de `RoundClip.tsx` : la vue native `TentacleRoundClip`
 * (`render/TentacleRoundClip.kt`), rognée par son CONTOUR (`clipToOutline`).
 * Sur Android, `overflow: "hidden"` + `borderRadius` rognait en rectangle le
 * cadre et l'écran de l'ouverture du démarrage (coins carrés, 19/10). Sans la
 * vue native (un binaire d'avant) : la vue arrondie de React Native.
 */
interface NativeRoundClipProps extends ViewProps {
  cornerRadius: number;
  clip: boolean;
}

const VIEW_NAME = "TentacleRoundClip";
const NativeRoundClip: HostComponent<NativeRoundClipProps> | null =
  UIManager.getViewManagerConfig(VIEW_NAME) != null ? requireNativeComponent<NativeRoundClipProps>(VIEW_NAME) : null;

export const RoundClip = memo(function RoundClip({ style, radius, clip = true, children }: RoundClipProps) {
  if (NativeRoundClip === null) {
    return <View style={[style, clip ? { overflow: "hidden", borderRadius: radius } : { overflow: "visible", borderRadius: 0 }]}>{children}</View>;
  }
  return (
    <NativeRoundClip style={style} cornerRadius={radius} clip={clip} collapsable={false}>
      {children}
    </NativeRoundClip>
  );
});
