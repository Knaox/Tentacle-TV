import { useState, useCallback } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useTentacleConfig } from "@tentacle-tv/api-client";

import { Button } from "@/components/ui";
import { SettingsSection } from "@/components/settings";
import { PasswordField } from "@/components/settings/PasswordField";
import { spacing, typography, FONT_FAMILY, useTheme, useThemedStyles } from "@/theme";
import { SettingsScaffold } from "./SettingsScaffold";

/**
 * Sous-écran « Mot de passe » (parité web ChangePasswordSection) : change le
 * mot de passe Jellyfin du compte connecté via POST /api/auth/change-password.
 * Le backend valide le mot de passe actuel via Jellyfin (jamais la clé admin).
 * Le bouton reste celui d'un formulaire — il envoie, il ne choisit rien —
 * mais à la largeur de son libellé, sous les champs.
 */
export function PasswordScreen() {
  const { t } = useTranslation("preferences");
  return (
    <SettingsScaffold title={t("changePasswordTitle")} maxWidth={560}>
      <PasswordPane />
    </SettingsScaffold>
  );
}

export function PasswordPane() {
  const { t } = useTranslation("preferences");
  const { t: tc } = useTranslation("common");
  const { storage } = useTentacleConfig();
  const { colors } = useTheme();
  const st = useThemedStyles(makeStyles);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = useCallback(async () => {
    setError(null);
    setSuccess(false);
    if (next.length < 6) return setError(t("passwordTooShort"));
    if (next !== confirm) return setError(t("passwordMismatch"));

    const serverUrl = storage.getItem("tentacle_server_url");
    const token = storage.getItem("tentacle_token");
    if (!serverUrl || !token) return setError(t("passwordChangeError"));

    setPending(true);
    try {
      const res = await fetch(`${serverUrl}/api/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        setError(err?.message || t("passwordChangeError"));
        return;
      }
      setSuccess(true);
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch {
      setError(t("passwordChangeError"));
    } finally {
      setPending(false);
    }
  }, [current, next, confirm, storage, t]);

  const canSubmit = !!current && !!next && !!confirm && !pending;

  return (
    <SettingsSection caption={t("changePasswordDescription")}>
      <View style={st.form}>
        <PasswordField
          label={t("currentPassword")}
          value={current}
          onChangeText={setCurrent}
          show={show}
          onToggleShow={() => setShow((v) => !v)}
          toggleLabel={show ? t("hidePassword") : t("showPassword")}
          autoComplete="current-password"
        />
        <PasswordField label={t("newPassword")} value={next} onChangeText={setNext} show={show} autoComplete="new-password" />
        <PasswordField label={t("confirmNewPassword")} value={confirm} onChangeText={setConfirm} show={show} autoComplete="new-password" />

        {error ? <Text style={[st.feedback, { color: colors.status.error }]} accessibilityRole="alert">{error}</Text> : null}
        {success ? <Text style={[st.feedback, { color: colors.status.success }]}>{t("passwordChanged")}</Text> : null}

        <Button
          title={pending ? t("passwordChanging") : tc("save")}
          onPress={handleSubmit}
          disabled={!canSubmit}
          loading={pending}
          style={st.submit}
        />
      </View>
    </SettingsSection>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    form: { padding: spacing.md, gap: spacing.md },
    feedback: { ...typography.small, fontFamily: FONT_FAMILY.medium },
    submit: { alignSelf: "flex-end" },
  });
