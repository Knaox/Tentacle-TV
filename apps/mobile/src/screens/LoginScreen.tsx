import { useState, useEffect, useRef } from "react";
import { View, Text, TextInput, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useJellyfinClient, useTentacleConfig } from "@tentacle-tv/api-client";
import { useTranslation } from "react-i18next";
import { TentacleLogo } from "../components/TentacleLogo";
import { isSessionExpired, setSessionExpired } from "../auth/sessionState";
import { storeCredentials, attemptReAuth, loginIdentity } from "../auth/credentialManager";
import { SubtleBackground } from "../components/auth/authStyles";
import { AuthScreenFrame } from "../components/auth/AuthScreenFrame";
import { AuthTextField } from "../components/auth/AuthTextField";
import { AuthLink, AuthNotice, AuthPrimaryButton } from "../components/auth/AuthControls";
import { FONT_FAMILY, useTheme } from "@/theme";

export function LoginScreen() {
  const { t } = useTranslation("auth");
  const { colors } = useTheme();
  const passwordRef = useRef<TextInput>(null);
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
          const reAuth = await attemptReAuth(storage, serverUrl, loginIdentity(client));
          if (!cancelled && reAuth) {
            client.setAccessToken(reAuth.AccessToken);
            if (reAuth.DeviceId) client.adoptJellyfinDeviceId(reAuth.DeviceId);
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

      // L'identité d'appareil PART AVEC le login (même contrat que le web,
      // useAuth) : le token Jellyfin est frappé sous ce triplet, qui doit être
      // celui de nos en-têtes MediaBrowser — cf. loginIdentity.
      const response = await fetch(`${serverUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, ...loginIdentity(client) }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || t("invalidCredentials"));
      }

      const data = await response.json();
      client.setAccessToken(data.AccessToken);
      // L'identifiant d'appareil réellement présenté à Jellyfin : on l'adopte
      // pour nos propres en-têtes (le backend le dérive de la graine).
      if (data.DeviceId) client.adoptJellyfinDeviceId(data.DeviceId);
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

  // Le serveur visé, lu (jamais écrit) : on sait à QUI on donne son mot de passe.
  const serverHost = hostOf(storage.getItem("tentacle_server_url"));

  if (reconnecting) {
    return (
      <SubtleBackground ambient>
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
          accessibilityLiveRegion="polite"
        >
          <TentacleLogo size={96} />
          <ActivityIndicator color={colors.brand.violet} style={{ marginTop: 28 }} size="large" />
          <Text style={{
            color: colors.brand.light,
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
    <AuthScreenFrame
      title={t("signInTitle")}
      subtitle={t("signInSubtitle")}
      showLanguage
      footer={
        <>
          <AuthLink prefix={t("noAccount")} label={t("createAccount")} onPress={() => router.push("/(auth)/register")} />
          <AuthLink prefix={serverHost ?? undefined} label={t("changeServer")} onPress={() => router.replace("/server-setup")} />
        </>
      }
    >
      <AuthTextField
        label={t("username")}
        icon="user"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        textContentType="username"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <View style={{ marginTop: 16 }}>
        <AuthTextField
          ref={passwordRef}
          label={t("password")}
          icon="lock"
          password
          value={password}
          onChangeText={setPassword}
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={handleLogin}
        />
      </View>
      <View style={{ alignItems: "flex-end", marginTop: 4, marginRight: -8 }}>
        <AuthLink label={t("forgotPassword")} onPress={() => router.push("/(auth)/forgot-password")} />
      </View>

      {error && <AuthNotice tone="error" style={{ marginTop: 8 }}>{error}</AuthNotice>}

      <AuthPrimaryButton
        label={t("signIn")}
        loadingLabel={t("signingIn")}
        loading={loading}
        disabled={!username || !password}
        onPress={handleLogin}
        style={{ marginTop: 16 }}
      />
    </AuthScreenFrame>
  );
}

function hostOf(url: string | null): string | null {
  if (!url) return null;
  const match = /^[a-z]+:\/\/([^/?#]+)/i.exec(url);
  return match ? match[1] : url;
}
