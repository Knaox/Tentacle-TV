import { View, type ViewStyle } from "react-native";
import { BORDER } from "../../theme";

interface Props {
  style?: ViewStyle;
  /** "subtle" (default) = white/8, "strong" = white/16. */
  intensity?: "subtle" | "strong";
}

/**
 * Séparateur horizontal très discret — `subtle` (white/8) pour la majorité
 * des cas, `strong` (white/16) pour distinguer des sections lourdes.
 */
export function Divider({ style, intensity = "subtle" }: Props) {
  return (
    <View
      style={[
        {
          height: 1,
          backgroundColor: intensity === "strong" ? BORDER.strong : BORDER.subtle,
          marginVertical: 12,
        },
        style,
      ]}
    />
  );
}
