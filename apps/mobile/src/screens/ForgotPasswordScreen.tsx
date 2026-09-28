import { useState } from "react";
import { Text } from "react-native";
import { useRouter } from "expo-router";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import { useTranslation } from "react-i18next";
import { AuthScreenFrame } from "../components/auth/AuthScreenFrame";
import { AuthTextField } from "../components/auth/AuthTextField";
import { AuthLink, AuthNotice, AuthPrimaryButton } from "../components/auth/AuthControls";
import { FONT_FAMILY, useTheme } from "@/theme";

export function ForgotPasswordScreen() {
  const { t } = useTranslation("auth");
  const { colors } = useTheme();
  const router = useRouter();
  const { storage } = useTentacleConfig();

  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  // Seul l'échec RÉSEAU est nouveau : il laissait le bouton revenir sans un mot.
  const [failed, setFailed] = useState(false);

  const handleSubmit = async () => {
    if (!username.trim() || loading) return;
    setLoading(true);
    setFailed(false);

    try {
      const serverUrl = storage.getItem("tentacle_server_url");
      if (!serverUrl) return;

      await fetch(`${serverUrl}/api/auth/password-reset-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim() }),
      });

      setSent(true);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = !!username.trim() && !loading;
  const backToLogin = () => router.replace("/(auth)/login");

  if (sent) {
    return (
      <AuthScreenFrame title={t("forgotPasswordSentTitle")} onBack={backToLogin} logoSize={56}>
        <AuthNotice tone="success">
          <Text style={{ color: colors.statusPairs.success.fg, fontSize: 14, lineHeight: 20, fontFamily: FONT_FAMILY.medium }}>
            {t("forgotPasswordSuccess")}
          </Text>
        </AuthNotice>
        <AuthPrimaryButton label={t("backToSignIn")} onPress={backToLogin} style={{ marginTop: 20 }} />
      </AuthScreenFrame>
    );
  }

  return (
    <AuthScreenFrame
      title={t("forgotPasswordTitle")}
      subtitle={t("forgotPasswordDescription")}
      onBack={backToLogin}
      logoSize={56}
      footer={<AuthLink label={t("backToSignIn")} onPress={backToLogin} />}
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
        returnKeyType="send"
        onSubmitEditing={handleSubmit}
        autoFocus
      />

      {failed && <AuthNotice tone="error" style={{ marginTop: 16 }}>{t("requestFailed")}</AuthNotice>}

      <AuthPrimaryButton
        label={t("sendRequest")}
        loadingLabel={t("common:sending")}
        loading={loading}
        disabled={!canSubmit && !loading}
        onPress={handleSubmit}
        style={{ marginTop: 22 }}
      />
    </AuthScreenFrame>
  );
}
