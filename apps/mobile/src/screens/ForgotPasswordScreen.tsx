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
import { Feather } from "@expo/vector-icons";
import {
  CTA,
  FONT_FAMILY,
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

  const canSubmit = !!username.trim() && !loading;

  return (
    <SubtleBackground ambient>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 24,
          paddingTop: insets.top + 16,
        }}>
          <FadeIn delay={0} translateY={12} style={{ width: "100%", maxWidth: 400 }}>
            <GlassCard style={{ padding: 28 }}>
              <View style={{ alignItems: "center", marginBottom: 8 }}>
                <View style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: "rgba(139,92,246,0.15)",
                  borderWidth: 1,
                  borderColor: "rgba(139,92,246,0.35)",
                  justifyContent: "center",
                  alignItems: "center",
                  marginBottom: 12,
                }}>
                  <Feather name="key" size={26} color="#A78BFA" />
                </View>
              </View>

              <Text style={[authTitleStyle, { fontSize: 24 }]} accessibilityRole="header">
                {t("forgotPasswordTitle")}
              </Text>
              <Text style={[authSubtitleStyle, { lineHeight: 20 }]}>
                {t("forgotPasswordDescription")}
              </Text>

              {sent ? (
                <View style={{ alignItems: "center", marginTop: 8 }}>
                  <View style={{
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    backgroundColor: "rgba(16,185,129,0.15)",
                    justifyContent: "center",
                    alignItems: "center",
                    marginBottom: 16,
                  }}>
                    <Feather name="check" size={32} color={STATUS.success} />
                  </View>
                  <Text style={{
                    color: STATUS.success,
                    fontSize: 14,
                    fontFamily: FONT_FAMILY.medium,
                    textAlign: "center",
                    lineHeight: 20,
                  }}>
                    {t("forgotPasswordSuccess")}
                  </Text>
                  <Pressable
                    onPress={() => router.replace("/(auth)/login")}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      { marginTop: 24, paddingVertical: 8, minHeight: 44, justifyContent: "center" },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text style={[authLinkStyle, { fontFamily: FONT_FAMILY.semibold }]}>
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
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    autoCapitalize="none"
                    autoCorrect={false}
                    accessibilityLabel={t("username")}
                    style={authInputStyle}
                    onSubmitEditing={handleSubmit}
                  />

                  <Pressable
                    onPress={handleSubmit}
                    disabled={!canSubmit}
                    accessibilityRole="button"
                    accessibilityLabel={t("sendRequest")}
                    style={({ pressed }) => [
                      authPrimaryCtaStyle,
                      { marginTop: 22, opacity: !canSubmit ? 0.45 : (pressed ? 0.88 : 1) },
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
                      }}>
                        {t("sendRequest")}
                      </Text>
                    )}
                  </Pressable>

                  <Pressable
                    onPress={() => router.replace("/(auth)/login")}
                    accessibilityRole="link"
                    accessibilityLabel={t("signIn")}
                    style={({ pressed }) => [
                      { marginTop: 16, alignItems: "center", paddingVertical: 10, minHeight: 44, justifyContent: "center" },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text style={authLinkStyle}>{t("signIn")}</Text>
                  </Pressable>
                </>
              )}
            </GlassCard>
          </FadeIn>
        </View>
      </KeyboardAvoidingView>
    </SubtleBackground>
  );
}
