import { View, type ViewStyle } from "react-native";
import { colors } from "../../theme";

interface Props {
  style?: ViewStyle;
}

export function Divider({ style }: Props) {
  return (
    <View style={[{
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 12,
    }, style]} />
  );
}
