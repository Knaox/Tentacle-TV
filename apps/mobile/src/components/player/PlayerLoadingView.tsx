import { View, ActivityIndicator, Text } from "react-native";

interface Props {
  title?: string;
}

export function PlayerLoadingView({ title }: Props) {

  return (
    <View style={{
      position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
      justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.3)",
    }}>
      <ActivityIndicator size="large" color="#8b5cf6" />
      {title && (
        <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 12 }}>
          {title}
        </Text>
      )}
    </View>
  );
}
