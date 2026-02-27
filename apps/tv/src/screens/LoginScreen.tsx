import { useState } from "react";
import { View, Text, TextInput, ActivityIndicator } from "react-native";
import { useTentacleConfig, useJellyfinClient } from "@tentacle-tv/api-client";
import { useTranslation } from "react-i18next";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { Focusable } from "../components/focus/Focusable";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

export function LoginScreen({ navigation }: Props) {
  const { t } = useTranslation("auth");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { storage } = useTentacleConfig();
  const jellyfinClient = useJellyfinClient();

  const handleLogin = async () => {
    if (!username || !password) return;
    setError(null);
    setLoading(true);

    const serverUrl = storage.getItem("tentacle_server_url");
    if (!serverUrl) {
      navigation.replace("PairCode");
      return;
    }

    try {
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

      // Save auth data
      jellyfinClient.setAccessToken(data.AccessToken);
      storage.setItem("tentacle_token", data.AccessToken);
      storage.setItem("tentacle_user", JSON.stringify(data.User));

      navigation.replace("Home");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth:loginFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleChangeServer = () => {
    storage.removeItem("tentacle_server_url");
    storage.removeItem("tentacle_token");
    storage.removeItem("tentacle_user");
    navigation.replace("PairCode");
  };

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0a0a0f" }}>
      <View style={{ width: 450, padding: 48, backgroundColor: "#12121a", borderRadius: 20, borderWidth: 1, borderColor: "#1e1e2e" }}>
        <Text style={{ color: "#8b5cf6", fontSize: 36, fontWeight: "800", textAlign: "center", marginBottom: 8 }}>
          Tentacle TV
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 16, textAlign: "center", marginBottom: 32 }}>
          {t("auth:connectToAccount")}
        </Text>

        <TextInput
          value={username}
          onChangeText={setUsername}
          placeholder={t("auth:username")}
          placeholderTextColor="rgba(255,255,255,0.3)"
          autoCapitalize="none"
          style={inputStyle}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder={t("auth:password")}
          placeholderTextColor="rgba(255,255,255,0.3)"
          secureTextEntry
          style={[inputStyle, { marginTop: 12 }]}
        />

        {error && (
          <View style={{ marginTop: 12, backgroundColor: "rgba(239,68,68,0.1)", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "rgba(239,68,68,0.3)" }}>
            <Text style={{ color: "#ef4444", fontSize: 14, textAlign: "center" }}>{error}</Text>
          </View>
        )}

        <View style={{ marginTop: 24 }}>
          <Focusable onPress={handleLogin} hasTVPreferredFocus>
            <View style={{
              backgroundColor: "#8b5cf6", borderRadius: 12, paddingVertical: 16,
              alignItems: "center", opacity: loading ? 0.6 : 1,
            }}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>{t("auth:signIn")}</Text>
              )}
            </View>
          </Focusable>
        </View>

        <View style={{ marginTop: 16 }}>
          <Focusable onPress={handleChangeServer}>
            <View style={{
              backgroundColor: "transparent", borderRadius: 12, paddingVertical: 12,
              alignItems: "center",
            }}>
              <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 14 }}>
                {t("auth:changeServer")}
              </Text>
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
  borderRadius: 12,
  paddingHorizontal: 20,
  paddingVertical: 16,
  color: "#fff",
  fontSize: 18,
};
