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
import { useRouter } from "expo-router";
import { useJellyfinClient, useTentacleConfig } from "@tentacle-tv/api-client";
import { useTranslation } from "react-i18next";

export function LoginScreen() {
  const { t } = useTranslation("auth");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const client = useJellyfinClient();
  const { storage } = useTentacleConfig();
  const router = useRouter();

  const handleLogin = async () => {
    if (!username || !password) return;
    setError(null);
    setLoading(true);

    try {
      const serverUrl = storage.getItem("tentacle_server_url");
      if (!serverUrl) {
        setError(t("auth:serverUrlNotConfigured"));
        return;
      }

      const response = await fetch(`${serverUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || t("auth:invalidCredentials"));
      }

      const data = await response.json();

      // Set the token on the JellyfinClient and persist in storage
      client.setAccessToken(data.AccessToken);
      storage.setItem("tentacle_token", data.AccessToken);
      storage.setItem("tentacle_user", JSON.stringify(data.User));

      router.replace("/(tabs)");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth:loginFailed"));
    } finally {
      setLoading(false);
    }
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
            Tentacle TV
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, textAlign: "center", marginBottom: 28 }}>
            {t("auth:signInSubtitle")}
          </Text>

          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder={t("auth:username")}
            placeholderTextColor="rgba(255,255,255,0.3)"
            autoCapitalize="none"
            autoCorrect={false}
            style={inputStyle}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder={t("auth:password")}
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
            disabled={loading}
            style={{
              marginTop: 24, backgroundColor: "#8b5cf6", borderRadius: 10,
              paddingVertical: 14, alignItems: "center",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>{t("auth:signIn")}</Text>
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
