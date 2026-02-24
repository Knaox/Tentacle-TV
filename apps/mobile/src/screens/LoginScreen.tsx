import { View, Text, TextInput, Pressable } from "react-native";
import { useState } from "react";

export function LoginScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  return (
    <View className="flex-1 items-center justify-center bg-tentacle-bg p-6">
      <Text className="mb-8 text-3xl font-bold text-white">Tentacle</Text>

      <TextInput
        placeholder="Username"
        placeholderTextColor="rgba(255,255,255,0.3)"
        value={username}
        onChangeText={setUsername}
        className="mb-4 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white"
      />

      <TextInput
        placeholder="Password"
        placeholderTextColor="rgba(255,255,255,0.3)"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        className="mb-6 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white"
      />

      <Pressable className="w-full rounded-xl bg-purple-600 py-3">
        <Text className="text-center font-semibold text-white">Sign in</Text>
      </Pressable>
    </View>
  );
}
