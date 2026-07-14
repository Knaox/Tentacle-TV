import { View, ActivityIndicator, Text } from "react-native";
import { PLAYER } from "@/theme";

interface Props {
  title?: string;
}

export function PlayerLoadingView({ title }: Props) {

  return (
    <View style={{
      position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
      justifyContent: "center", alignItems: "center", backgroundColor: PLAYER.scrimSoft,
    }}>
      <ActivityIndicator size="large" color={PLAYER.accent} />
      {title && (
        <Text style={{ color: PLAYER.textTertiary, fontSize: 13, marginTop: 12 }}>
          {title}
        </Text>
      )}
    </View>
  );
}
