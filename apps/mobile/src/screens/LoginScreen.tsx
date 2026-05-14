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
import {
  BORDER,
  BRAND,
  CTA,
  FONT_FAMILY,
  RADIUS,
  STATUS,
  SubtleBackground,
  GlassCard,
  FadeIn,
  authInputStyle,
  authLinkStyle,
  authPrimaryCtaStyle,
  authSubtitleStyle,
  authTitleStyle,
} from "../components/auth/authStyles";

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
          client.setAccessToken(storedToken);
          setSessionExpired(false);
          router.replace("/(tabs)");
        } else {
          const reAuth = await attemptReAuth(storage, serverUrl);
          if (!cancelled && reAuth) {
            client.setAccessToken(reAuth.AccessToken);
            storage.setItem("tentacle_token", reAuth.AccessToken);
            storage.setItem("tentacle_user", JSON.stringify(reAuth.User));
            setSessionExpired(false);
            router.replace("/(tabs)");
            return;
          }
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
      <SubtleBackground ambient>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <TentacleLogo size={96} />
          <ActivityIndicator color={BRAND.violet} style={{ marginTop: 28 }} size="large" />
          <Text style={{
            color: BRAND.light,
            fontSize: 14,
            fontFamily: FONT_FAMILY.medium,
            letterSpacing: 0.3,
            marginTop: 14,
          }}>
            {t("reconnecting")}
          </Text>
        </View>
      </SubtleBackground>
    );
  }

  return (
    <SubtleBackground ambient>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 24, paddingTop: insets.top + 16 }}>
          <FadeIn delay={0} translateY={12} style={{ alignItems: "center", marginBottom: 20 }}>
            <TentacleLogo size={64} />
          </FadeIn>

          <FadeIn delay={80} translateY={14} style={{ width: "100%", maxWidth: 400 }}>
            <GlassCard style={{ padding: 28 }}>
              <Text
                style={authTitleStyle}
                accessibilityRole="header"
              >
                Tentacle TV
              </Text>
              <Text style={authSubtitleStyle}>
                {t("signInSubtitle")}
              </Text>

              <TextInput
                value={username}
                onChangeText={setUsername}
                placeholder={t("username")}
                placeholderTextColor="rgba(255,255,255,0.35)"
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel={t("username")}
                style={authInputStyle}
              />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder={t("password")}
                placeholderTextColor="rgba(255,255,255,0.35)"
                secureTextEntry
                accessibilityLabel={t("password")}
                style={[authInputStyle, { marginTop: 12 }]}
                onSubmitEditing={handleLogin}
              />

              {error && (
                <Text style={{
                  color: STATUS.error,
                  fontSize: 13,
                  fontFamily: FONT_FAMILY.medium,
                  marginTop: 12,
                }}>{error}</Text>
              )}

              <Pressable
                onPress={handleLogin}
                disabled={loading || !username || !password}
                accessibilityRole="button"
                accessibilityLabel={t("signIn")}
                style={({ pressed }) => [
                  authPrimaryCtaStyle,
                  { marginTop: 24, opacity: (loading || !username || !password) ? 0.55 : (pressed ? 0.88 : 1) },
                ]}
              >
                {loading ? (
                  <ActivityIndicator color={CTA.primaryFg} />
                ) : (
                  <Text style={{
                    color: CTA.primaryFg,
                    fontSize: 15,
                    fontFamily: FONT_FAMILY.bold,
                    letterSpacing: 0.2,
                  }}>{t("signIn")}</Text>
                )}
              </Pressable>

              <Pressable
                onPress={() => router.push("/(auth)/forgot-password")}
                accessibilityRole="link"
                accessibilityLabel={t("forgotPassword")}
                style={({ pressed }) => [
                  { marginTop: 16, alignItems: "center", paddingVertical: 8, minHeight: 44, justifyContent: "center" },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={authLinkStyle}>{t("forgotPassword")}</Text>
              </Pressable>

              <Pressable
                onPress={() => router.push("/(auth)/register")}
                accessibilityRole="link"
                accessibilityLabel={t("createAccount")}
                style={({ pressed }) => [
                  { marginTop: 4, alignItems: "center", paddingVertical: 8, minHeight: 44, justifyContent: "center" },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={{
                  color: "rgba(255,255,255,0.55)",
                  fontSize: 13,
                  fontFamily: FONT_FAMILY.regular,
                }}>
                  {t("noAccount")}{" "}
                  <Text style={authLinkStyle}>{t("createAccount")}</Text>
                </Text>
              </Pressable>

              <View style={{
                marginTop: 12,
                paddingTop: 12,
                borderTopWidth: 1,
                borderTopColor: BORDER.subtle,
              }}>
                <Pressable
                  onPress={() => router.replace("/server-setup")}
                  accessibilityRole="link"
                  accessibilityLabel={t("changeServer")}
                  style={({ pressed }) => [
                    { alignItems: "center", paddingVertical: 8, minHeight: 44, justifyContent: "center", borderRadius: RADIUS.md },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={{
                    color: "rgba(255,255,255,0.5)",
                    fontSize: 12,
                    fontFamily: FONT_FAMILY.medium,
                    letterSpacing: 0.3,
                  }}>{t("changeServer")}</Text>
                </Pressable>
              </View>
            </GlassCard>
          </FadeIn>
        </View>
      </KeyboardAvoidingView>
    </SubtleBackground>
  );
}
