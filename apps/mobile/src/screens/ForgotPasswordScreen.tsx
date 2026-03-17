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

export function ForgotPasswordScreen() {
  const { t } = useTranslation("auth");
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { storage } = useTentacleConfig();

  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!username.trim() || loading) return;
    setLoading(true);

    try {
      const serverUrl = storage.getItem("tentacle_server_url");
      if (!serverUrl) return;

      await fetch(`${serverUrl}/api/auth/password-reset-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim() }),
      });

      setSent(true);
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
          <Text style={{
            color: "#8b5cf6", fontSize: 24, fontWeight: "800",
            textAlign: "center", marginBottom: 8,
          }}>
            {t("forgotPasswordTitle")}
          </Text>
          <Text style={{
            color: "rgba(255,255,255,0.4)", fontSize: 13,
            textAlign: "center", marginBottom: 28, lineHeight: 20,
          }}>
            {t("forgotPasswordDescription")}
          </Text>

          {sent ? (
            <View style={{ alignItems: "center" }}>
              <Text style={{ color: "#22c55e", fontSize: 14, textAlign: "center", lineHeight: 20 }}>
                {t("forgotPasswordSuccess")}
              </Text>
              <Pressable
                onPress={() => router.replace("/(auth)/login")}
                accessibilityRole="button"
                style={{ marginTop: 24, paddingVertical: 8 }}
              >
                <Text style={{ color: "#8b5cf6", fontSize: 14, fontWeight: "600" }}>
                  {t("signIn")}
                </Text>
              </Pressable>
            </View>
          ) : (
            <>
              <TextInput
                value={username}
                onChangeText={setUsername}
                placeholder={t("username")}
                placeholderTextColor="rgba(255,255,255,0.3)"
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel={t("username")}
                style={inputStyle}
                onSubmitEditing={handleSubmit}
              />

              <Pressable
                onPress={handleSubmit}
                disabled={loading || !username.trim()}
                accessibilityRole="button"
                accessibilityLabel={t("sendRequest")}
                style={{
                  marginTop: 24, backgroundColor: "#8b5cf6", borderRadius: 10,
                  paddingVertical: 14, alignItems: "center",
                  opacity: loading || !username.trim() ? 0.4 : 1,
                }}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>
                    {t("sendRequest")}
                  </Text>
                )}
              </Pressable>

              <Pressable
                onPress={() => router.replace("/(auth)/login")}
                accessibilityRole="button"
                style={{ marginTop: 16, alignItems: "center", paddingVertical: 8 }}
              >
                <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
                  {t("signIn")}
                </Text>
              </Pressable>
            </>
          )}
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
