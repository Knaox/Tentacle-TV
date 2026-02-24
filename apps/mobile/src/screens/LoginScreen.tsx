import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@tentacle/api-client";

export function LoginScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { login } = useAuth();
  const router = useRouter();

  const handleLogin = () => {
    if (!username || !password) return;
    setError(null);
    login.mutate(
      { username, password },
      {
        onSuccess: () => router.replace("/(tabs)"),
        onError: (err) => setError(err instanceof Error ? err.message : "Connexion échouée"),
      },
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#0a0a0f" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 24 }}>
        <View style={{
          width: "100%", maxWidth: 400, padding: 32,
          backgroundColor: "#12121a", borderRadius: 16,
          borderWidth: 1, borderColor: "#1e1e2e",
        }}>
          <Text style={{ color: "#8b5cf6", fontSize: 28, fontWeight: "800", textAlign: "center", marginBottom: 4 }}>
            Tentacle
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, textAlign: "center", marginBottom: 28 }}>
            Connectez-vous à votre serveur
          </Text>

          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder="Nom d'utilisateur"
            placeholderTextColor="rgba(255,255,255,0.3)"
            autoCapitalize="none"
            autoCorrect={false}
            style={inputStyle}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Mot de passe"
            placeholderTextColor="rgba(255,255,255,0.3)"
            secureTextEntry
            style={[inputStyle, { marginTop: 12 }]}
            onSubmitEditing={handleLogin}
          />

          {error && (
            <Text style={{ color: "#ef4444", fontSize: 13, marginTop: 12 }}>{error}</Text>
          )}

          <Pressable
            onPress={handleLogin}
            disabled={login.isPending}
            style={{
              marginTop: 24, backgroundColor: "#8b5cf6", borderRadius: 10,
              paddingVertical: 14, alignItems: "center",
              opacity: login.isPending ? 0.6 : 1,
            }}
          >
            {login.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>Se connecter</Text>
            )}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const inputStyle = {
  backgroundColor: "rgba(255,255,255,0.05)",
  borderWidth: 1,
  borderColor: "#1e1e2e",
  borderRadius: 10,
  paddingHorizontal: 16,
  paddingVertical: 14,
  color: "#fff",
  fontSize: 16,
};
