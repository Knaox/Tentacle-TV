import { View, type ViewStyle } from "react-native";

import { useTheme } from "../../theme";

interface Props {
  style?: ViewStyle;
  /** "subtle" (default) = border.subtle, "strong" = border.strong. */
  intensity?: "subtle" | "strong";
}

/**
 * Séparateur horizontal très discret — `subtle` pour la majorité des cas,
 * `strong` pour distinguer des sections lourdes.
 */
export function Divider({ style, intensity = "subtle" }: Props) {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          height: 1,
          backgroundColor:
            intensity === "strong" ? theme.colors.border.strong : theme.colors.border.subtle,
          marginVertical: 12,
        },
        style,
      ]}
    />
  );
}
