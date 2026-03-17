import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useJellyfinClient, useTentacleConfig } from "@tentacle-tv/api-client";
import { useTranslation } from "react-i18next";
import { TentacleLogo } from "../components/TentacleLogo";
import { isSessionExpired, setSessionExpired } from "../auth/sessionState";
import { storeCredentials, attemptReAuth } from "../auth/credentialManager";

export function LoginScreen() {
  const { t } = useTranslation("auth");
  const insets = useSafeAreaInsets();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const client = useJellyfinClient();
  const { storage } = useTentacleConfig();
  const router = useRouter();

  // Auto-reconnect: if we have a stored token (session expired in-memory),
  // try to validate it before showing the login form.
  useEffect(() => {
    if (!isSessionExpired()) return;
    const storedToken = storage.getItem("tentacle_token");
    if (!storedToken) return;

    let cancelled = false;
    setReconnecting(true);

    const serverUrl = storage.getItem("tentacle_server_url");
    if (!serverUrl) { setReconnecting(false); return; }

    fetch(`${serverUrl}/api/jellyfin/Users/Me`, {
      headers: { "X-Emby-Token": storedToken },
    })
      .then(async (res) => {
        if (cancelled) return;
        if (res.ok) {
          // Token still valid — restore session
          client.setAccessToken(storedToken);
          setSessionExpired(false);
          router.replace("/(tabs)");
        } else {
          // Token expired — try re-auth via stored credentials
          const reAuth = await attemptReAuth(storage, serverUrl);
          if (!cancelled && reAuth) {
            client.setAccessToken(reAuth.AccessToken);
            storage.setItem("tentacle_token", reAuth.AccessToken);
            storage.setItem("tentacle_user", JSON.stringify(reAuth.User));
            setSessionExpired(false);
            router.replace("/(tabs)");
            return;
          }
          // Re-auth failed — show login form
          storage.removeItem("tentacle_token");
          storage.removeItem("tentacle_user");
          setSessionExpired(false);
          setReconnecting(false);
        }
      })
      .catch(() => {
        if (!cancelled) setReconnecting(false);
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = async () => {
    if (!username || !password) return;
    setError(null);
    setLoading(true);

    try {
      const serverUrl = storage.getItem("tentacle_server_url");
      if (!serverUrl) {
        setError(t("serverUrlNotConfigured"));
        return;
      }

      const response = await fetch(`${serverUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || t("invalidCredentials"));
      }

      const data = await response.json();

      // Set the token on the JellyfinClient and persist in storage
      client.setAccessToken(data.AccessToken);
      storage.setItem("tentacle_token", data.AccessToken);
      storage.setItem("tentacle_user", JSON.stringify(data.User));
      storeCredentials(storage, username, password);
      setSessionExpired(false);

      router.replace("/(tabs)");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("loginFailed"));
    } finally {
      setLoading(false);
    }
  };

  if (reconnecting) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0a0a0f", justifyContent: "center", alignItems: "center" }}>
        <TentacleLogo size={80} />
        <ActivityIndicator color="#8b5cf6" style={{ marginTop: 24 }} size="large" />
        <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginTop: 12 }}>
          {t("reconnecting")}
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#0a0a0f" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 24, paddingTop: insets.top + 16 }}>
        <View style={{
          width: "100%", maxWidth: 400, padding: 32,
          backgroundColor: "#12121a", borderRadius: 16,
          borderWidth: 1, borderColor: "#1e1e2e",
        }}>
          <View style={{ alignItems: "center", marginBottom: 8 }}>
            <TentacleLogo size={80} />
          </View>
          <Text style={{ color: "#8b5cf6", fontSize: 28, fontWeight: "800", textAlign: "center", marginBottom: 4 }}>
            Tentacle TV
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, textAlign: "center", marginBottom: 28 }}>
            {t("signInSubtitle")}
          </Text>

          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder={t("username")}
            placeholderTextColor="rgba(255,255,255,0.3)"
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel={t("username")}
            style={inputStyle}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder={t("password")}
            placeholderTextColor="rgba(255,255,255,0.3)"
            secureTextEntry
            accessibilityLabel={t("password")}
            style={[inputStyle, { marginTop: 12 }]}
            onSubmitEditing={handleLogin}
          />

          {error && (
            <Text style={{ color: "#ef4444", fontSize: 13, marginTop: 12 }}>{error}</Text>
          )}

          <Pressable
            onPress={handleLogin}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={t("signIn")}
            style={{
              marginTop: 24, backgroundColor: "#8b5cf6", borderRadius: 10,
              paddingVertical: 14, alignItems: "center",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>{t("signIn")}</Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => router.push("/(auth)/forgot-password")}
            accessibilityRole="button"
            style={{ marginTop: 12, alignItems: "center", paddingVertical: 8 }}
          >
            <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>{t("forgotPassword")}</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push("/(auth)/register")}
            accessibilityRole="button"
            style={{ marginTop: 8, alignItems: "center", paddingVertical: 8 }}
          >
            <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
              {t("noAccount")}{" "}
              <Text style={{ color: "#8b5cf6" }}>{t("createAccount")}</Text>
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.replace("/server-setup")}
            accessibilityRole="button"
            accessibilityLabel={t("changeServer")}
            style={{ marginTop: 8, alignItems: "center", paddingVertical: 8 }}
          >
            <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>{t("changeServer")}</Text>
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
