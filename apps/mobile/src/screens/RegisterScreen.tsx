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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import { useTranslation } from "react-i18next";
import { TentacleLogo } from "../components/TentacleLogo";

export function RegisterScreen() {
  const { t } = useTranslation("auth");
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { storage } = useTentacleConfig();

  const [inviteKey, setInviteKey] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordsMatch = password === confirmPassword;
  const canSubmit = inviteKey && username && password && confirmPassword && passwordsMatch && !loading;

  const handleRegister = async () => {
    if (!canSubmit) return;
    setError(null);
    setLoading(true);

    try {
      const serverUrl = storage.getItem("tentacle_server_url");
      if (!serverUrl) {
        setError(t("serverUrlNotConfigured"));
        return;
      }

      const res = await fetch(`${serverUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteKey, username, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || t("registrationFailed"));
      }

      router.replace("/(auth)/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("registrationFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#0a0a0f" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={{
        flex: 1, justifyContent: "center", alignItems: "center",
        paddingHorizontal: 24, paddingTop: insets.top + 16,
      }}>
        <View style={{
          width: "100%", maxWidth: 400, padding: 32,
          backgroundColor: "#12121a", borderRadius: 16,
          borderWidth: 1, borderColor: "#1e1e2e",
        }}>
          <View style={{ alignItems: "center", marginBottom: 8 }}>
            <TentacleLogo size={80} />
          </View>
          <Text style={{ color: "#8b5cf6", fontSize: 28, fontWeight: "800", textAlign: "center", marginBottom: 4 }}>
            {t("joinTentacle")}
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, textAlign: "center", marginBottom: 28 }}>
            {t("invitationOnly")}
          </Text>

          <TextInput
            value={inviteKey}
            onChangeText={setInviteKey}
            placeholder={t("inviteKey")}
            placeholderTextColor="rgba(255,255,255,0.3)"
            autoCapitalize="none"
            autoCorrect={false}
            style={[inputStyle, { fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" }]}
          />
          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder={t("username")}
            placeholderTextColor="rgba(255,255,255,0.3)"
            autoCapitalize="none"
            autoCorrect={false}
            style={[inputStyle, { marginTop: 12 }]}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder={t("password")}
            placeholderTextColor="rgba(255,255,255,0.3)"
            secureTextEntry
            style={[inputStyle, { marginTop: 12 }]}
          />
          <TextInput
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder={t("confirmPassword")}
            placeholderTextColor="rgba(255,255,255,0.3)"
            secureTextEntry
            style={[inputStyle, { marginTop: 12 }]}
          />

          {confirmPassword.length > 0 && !passwordsMatch && (
            <Text style={{ color: "#ef4444", fontSize: 13, marginTop: 8 }}>
              {t("passwordMismatch")}
            </Text>
          )}

          {error && (
            <Text style={{ color: "#ef4444", fontSize: 13, marginTop: 12 }}>{error}</Text>
          )}

          <Pressable
            onPress={handleRegister}
            disabled={!canSubmit}
            accessibilityRole="button"
            accessibilityLabel={t("createAccount")}
            style={{
              marginTop: 24, backgroundColor: "#8b5cf6", borderRadius: 10,
              paddingVertical: 14, alignItems: "center",
              opacity: canSubmit ? 1 : 0.4,
            }}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>
                {t("createAccount")}
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => router.replace("/(auth)/login")}
            accessibilityRole="button"
            style={{ marginTop: 16, alignItems: "center", paddingVertical: 8 }}
          >
            <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
              {t("alreadyHaveAccount")}{" "}
              <Text style={{ color: "#8b5cf6" }}>{t("signIn")}</Text>
            </Text>
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
