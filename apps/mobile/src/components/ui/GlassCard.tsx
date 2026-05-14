import { type ReactNode } from "react";
import { View, StyleSheet, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { spacing, BORDER, RADIUS, SHADOW_RN } from "../../theme";

interface Props {
  children: ReactNode;
  style?: ViewStyle;
  noPadding?: boolean;
}

/**
 * Vraie carte glass — superpose un BlurView (capture le contenu derrière) +
 * tint noir translucide + border subtle blanche. Design aligné sur les modals
 * iOS et les cards Netflix elevated.
 */
export function GlassCard({ children, style, noPadding }: Props) {
  return (
    <View
      style={[
        {
          borderRadius: RADIUS.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: BORDER.subtle,
          overflow: "hidden",
          backgroundColor: "rgba(20, 20, 26, 0.6)",
        },
        SHADOW_RN.elev2,
        style,
      ]}
    >
      <BlurView
        intensity={40}
        tint="dark"
        style={StyleSheet.absoluteFillObject}
      />
      <View style={noPadding ? undefined : { padding: spacing.lg }}>{children}</View>
    </View>
  );
}
