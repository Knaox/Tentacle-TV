import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";

interface ServerSetupScreenProps {
  onServerValidated: (url: string) => void;
}

export function ServerSetupScreen({ onServerValidated }: ServerSetupScreenProps) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    const trimmed = url.trim().replace(/\/+$/, "");
    if (!trimmed) return;

    setError(null);
    setLoading(true);

    try {
      const response = await fetch(`${trimmed}/api/health`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error("not ok");
      }

      onServerValidated(trimmed);
    } catch {
      setError("Serveur introuvable. V\u00e9rifiez l'URL.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#0a0a0f" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 24,
        }}
      >
        <View
          style={{
            width: "100%",
            maxWidth: 400,
            padding: 32,
            backgroundColor: "#12121a",
            borderRadius: 16,
            borderWidth: 1,
            borderColor: "#1e1e2e",
          }}
        >
          <Text
            style={{
              color: "#8b5cf6",
              fontSize: 28,
              fontWeight: "800",
              textAlign: "center",
              marginBottom: 4,
            }}
          >
            Tentacle
          </Text>
          <Text
            style={{
              color: "rgba(255,255,255,0.4)",
              fontSize: 13,
              textAlign: "center",
              marginBottom: 28,
            }}
          >
            Bienvenue sur Tentacle
          </Text>

          <TextInput
            value={url}
            onChangeText={setUrl}
            placeholder="URL de votre serveur"
            placeholderTextColor="rgba(255,255,255,0.3)"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            textContentType="URL"
            style={inputStyle}
            onSubmitEditing={handleConnect}
          />

          <Text
            style={{
              color: "rgba(255,255,255,0.25)",
              fontSize: 12,
              marginTop: 8,
            }}
          >
            Ex : https://tentacle.example.com
          </Text>

          {error && (
            <Text style={{ color: "#ef4444", fontSize: 13, marginTop: 12 }}>
              {error}
            </Text>
          )}

          <Pressable
            onPress={handleConnect}
            disabled={loading || !url.trim()}
            style={{
              marginTop: 24,
              backgroundColor: "#8b5cf6",
              borderRadius: 10,
              paddingVertical: 14,
              alignItems: "center",
              opacity: loading || !url.trim() ? 0.6 : 1,
            }}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>
                Se connecter
              </Text>
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
