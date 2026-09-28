import { useRef, useState } from "react";
import { View, type TextInput } from "react-native";
import { useRouter } from "expo-router";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import { useTranslation } from "react-i18next";
import { AuthScreenFrame } from "../components/auth/AuthScreenFrame";
import { AuthTextField } from "../components/auth/AuthTextField";
import { AuthLink, AuthNotice, AuthPrimaryButton } from "../components/auth/AuthControls";

export function RegisterScreen() {
  const { t } = useTranslation("auth");
  const router = useRouter();
  const { storage } = useTentacleConfig();

  const [inviteKey, setInviteKey] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmTouched, setConfirmTouched] = useState(false);
  const usernameRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

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

  // L'écart ne s'affiche qu'une fois la confirmation quittée, ou dès qu'elle
  // est aussi longue que le mot de passe : pas de rouge à chaque frappe.
  const showMismatch = confirmPassword.length > 0 && !passwordsMatch
    && (confirmTouched || confirmPassword.length >= password.length);
  const backToLogin = () => router.replace("/(auth)/login");

  return (
    <AuthScreenFrame
      title={t("joinTentacle")}
      subtitle={t("invitationOnly")}
      onBack={backToLogin}
      logoSize={56}
      footer={<AuthLink prefix={t("alreadyHaveAccount")} label={t("signIn")} onPress={backToLogin} />}
    >
      <AuthTextField
        label={t("inviteKey")}
        icon="key"
        monospace
        hint={t("inviteKeyHint")}
        value={inviteKey}
        onChangeText={setInviteKey}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => usernameRef.current?.focus()}
      />
      <View style={{ marginTop: 16 }}>
        <AuthTextField
          ref={usernameRef}
          label={t("username")}
          icon="user"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username-new"
          textContentType="username"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
      </View>
      <View style={{ marginTop: 16 }}>
        <AuthTextField
          ref={passwordRef}
          label={t("password")}
          icon="lock"
          password
          value={password}
          onChangeText={setPassword}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => confirmRef.current?.focus()}
        />
      </View>
      <View style={{ marginTop: 16 }}>
        <AuthTextField
          ref={confirmRef}
          label={t("confirmPassword")}
          icon="lock"
          password
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          onBlur={() => setConfirmTouched(true)}
          error={showMismatch ? t("passwordMismatch") : null}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={handleRegister}
        />
      </View>

      {error && <AuthNotice tone="error" style={{ marginTop: 16 }}>{error}</AuthNotice>}

      <AuthPrimaryButton
        label={t("createAccount")}
        loadingLabel={t("creatingAccount")}
        loading={loading}
        disabled={!canSubmit && !loading}
        onPress={handleRegister}
        style={{ marginTop: 22 }}
      />
    </AuthScreenFrame>
  );
}
