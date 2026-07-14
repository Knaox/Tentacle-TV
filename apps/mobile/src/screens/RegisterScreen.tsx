import { useState } from "react";
import {
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import { useTranslation } from "react-i18next";
import { TentacleLogo } from "../components/TentacleLogo";
import {
  SubtleBackground,
  GlassCard,
  FadeIn,
  makeAuthStyles,
} from "../components/auth/authStyles";
import { FONT_FAMILY, useTheme, useThemedStyles, withAlpha } from "@/theme";

export function RegisterScreen() {
  const { t } = useTranslation("auth");
  const { colors } = useTheme();
  const auth = useThemedStyles(makeAuthStyles);
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
  const canSubmit = !!inviteKey && !!username && !!password && !!confirmPassword && passwordsMatch && !loading;

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

  const monospace = Platform.OS === "ios" ? "Menlo" : "monospace";

  return (
    <SubtleBackground ambient>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 24,
            paddingTop: Math.max(insets.top, 24) + 24,
            paddingBottom: insets.bottom + 24,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <FadeIn delay={0} translateY={12} style={{ alignItems: "center", marginBottom: 16 }}>
            <TentacleLogo size={56} />
          </FadeIn>

          <FadeIn delay={80} translateY={14} style={{ width: "100%", maxWidth: 400 }}>
            <GlassCard style={{ padding: 28 }}>
              <Text style={auth.title} accessibilityRole="header">
                {t("joinTentacle")}
              </Text>
              <Text style={auth.subtitle}>
                {t("invitationOnly")}
              </Text>

              <TextInput
                value={inviteKey}
                onChangeText={setInviteKey}
                placeholder={t("inviteKey")}
                placeholderTextColor={colors.text.quaternary}
                autoCapitalize="characters"
                autoCorrect={false}
                accessibilityLabel={t("inviteKey")}
                style={[auth.input, { fontFamily: monospace, letterSpacing: 1.5 }]}
              />
              <TextInput
                value={username}
                onChangeText={setUsername}
                placeholder={t("username")}
                placeholderTextColor={colors.text.quaternary}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel={t("username")}
                style={[auth.input, { marginTop: 12 }]}
              />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder={t("password")}
                placeholderTextColor={colors.text.quaternary}
                secureTextEntry
                accessibilityLabel={t("password")}
                style={[auth.input, { marginTop: 12 }]}
              />
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder={t("confirmPassword")}
                placeholderTextColor={colors.text.quaternary}
                secureTextEntry
                accessibilityLabel={t("confirmPassword")}
                style={[
                  auth.input,
                  { marginTop: 12 },
                  confirmPassword.length > 0 && !passwordsMatch && {
                    borderColor: withAlpha(colors.status.error, 0.5, colors.danger.border),
                  },
                ]}
              />

              {confirmPassword.length > 0 && !passwordsMatch && (
                <Text style={{
                  color: colors.status.error,
                  fontSize: 12,
                  fontFamily: FONT_FAMILY.medium,
                  marginTop: 8,
                }}>
                  {t("passwordMismatch")}
                </Text>
              )}

              {error && (
                <Text style={{
                  color: colors.status.error,
                  fontSize: 13,
                  fontFamily: FONT_FAMILY.medium,
                  marginTop: 12,
                }}>{error}</Text>
              )}

              <Pressable
                onPress={handleRegister}
                disabled={!canSubmit}
                accessibilityRole="button"
                accessibilityLabel={t("createAccount")}
                style={({ pressed }) => [
                  auth.primaryCta,
                  { marginTop: 24, opacity: !canSubmit ? 0.45 : (pressed ? 0.88 : 1) },
                ]}
              >
                {loading ? (
                  <ActivityIndicator color={colors.cta.primaryFg} />
                ) : (
                  <Text style={{
                    color: colors.cta.primaryFg,
                    fontSize: 15,
                    fontFamily: FONT_FAMILY.bold,
                    letterSpacing: 0.2,
                  }}>
                    {t("createAccount")}
                  </Text>
                )}
              </Pressable>

              <Pressable
                onPress={() => router.replace("/(auth)/login")}
                accessibilityRole="link"
                accessibilityLabel={t("signIn")}
                style={({ pressed }) => [
                  { marginTop: 16, alignItems: "center", paddingVertical: 8, minHeight: 44, justifyContent: "center" },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={{
                  color: colors.text.tertiary,
                  fontSize: 13,
                  fontFamily: FONT_FAMILY.regular,
                }}>
                  {t("alreadyHaveAccount")}{" "}
                  <Text style={[auth.link, { color: colors.brand.light }]}>{t("signIn")}</Text>
                </Text>
              </Pressable>
            </GlassCard>
          </FadeIn>
        </ScrollView>
      </KeyboardAvoidingView>
    </SubtleBackground>
  );
}
