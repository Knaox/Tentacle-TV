import type { ReactNode } from "react";
import { View, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

interface Props {
  children: ReactNode;
  style?: ViewStyle;
}

export function SubtleBackground({ children, style }: Props) {
  return (
    <View style={[{ flex: 1 }, style]}>
      <LinearGradient
        colors={["#0a0a0f", "#0c0c16"]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />
      {children}
    </View>
  );
}
