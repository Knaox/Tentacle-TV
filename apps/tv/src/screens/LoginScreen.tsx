import { useState } from "react";
import { View, Text, TextInput, ActivityIndicator } from "react-native";
import { useAuth } from "@tentacle/api-client";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { Focusable } from "../components/focus/Focusable";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

export function LoginScreen({ navigation }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { login } = useAuth();

  const handleLogin = () => {
    if (!username || !password) return;
    setError(null);
    login.mutate(
      { username, password },
      {
        onSuccess: () => navigation.replace("Home"),
        onError: (err) => setError(err instanceof Error ? err.message : "Connexion échouée"),
      }
    );
  };

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0a0a0f" }}>
      <View style={{ width: 400, padding: 40, backgroundColor: "#12121a", borderRadius: 16, borderWidth: 1, borderColor: "#1e1e2e" }}>
        <Text style={{ color: "#8b5cf6", fontSize: 32, fontWeight: "800", textAlign: "center", marginBottom: 8 }}>
          Tentacle
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, textAlign: "center", marginBottom: 32 }}>
          Connectez-vous à votre serveur
        </Text>

        <TextInput
          value={username}
          onChangeText={setUsername}
          placeholder="Nom d'utilisateur"
          placeholderTextColor="rgba(255,255,255,0.3)"
          autoCapitalize="none"
          style={inputStyle}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Mot de passe"
          placeholderTextColor="rgba(255,255,255,0.3)"
          secureTextEntry
          style={[inputStyle, { marginTop: 12 }]}
        />

        {error && <Text style={{ color: "#ef4444", fontSize: 13, marginTop: 12 }}>{error}</Text>}

        <View style={{ marginTop: 24 }}>
          <Focusable onPress={handleLogin} hasTVPreferredFocus>
            <View style={{
              backgroundColor: "#8b5cf6", borderRadius: 10, paddingVertical: 14,
              alignItems: "center", opacity: login.isPending ? 0.6 : 1,
            }}>
              {login.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>Se connecter</Text>
              )}
            </View>
          </Focusable>
        </View>
      </View>
    </View>
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
