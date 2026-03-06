import { type ReactNode } from "react";
import { View, type ViewStyle } from "react-native";
import { colors, spacing } from "../../theme";

interface Props {
  children: ReactNode;
  style?: ViewStyle;
  noPadding?: boolean;
}

export function GlassCard({ children, style, noPadding }: Props) {
  return (
    <View style={[{
      borderRadius: spacing.cardRadius,
      borderWidth: 1,
      borderColor: colors.borderAccent,
      backgroundColor: colors.glass,
      overflow: "hidden",
    }, style]}>
      <View style={noPadding ? undefined : { padding: spacing.lg }}>
        {children}
      </View>
    </View>
  );
}
