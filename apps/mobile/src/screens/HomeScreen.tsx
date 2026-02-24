import { View, Text, ScrollView } from "react-native";

export function HomeScreen() {
  return (
    <ScrollView className="flex-1 bg-tentacle-bg">
      <View className="p-6">
        <Text className="text-3xl font-bold text-white">Tentacle</Text>
        <Text className="mt-2 text-white/50">Your media, everywhere.</Text>
      </View>
    </ScrollView>
  );
}
