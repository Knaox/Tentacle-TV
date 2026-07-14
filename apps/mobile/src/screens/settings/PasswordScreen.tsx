import { useState, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useTentacleConfig } from "@tentacle-tv/api-client";

import { SubtleBackground, GlassCard, IconButton, Button } from "@/components/ui";
import { PasswordField } from "@/components/settings/PasswordField";
import {
  spacing,
  typography,
  FONT_FAMILY,
  useContentPadding,
  useTheme,
  useThemedStyles,
  type AppTheme,
} from "@/theme";

/**
 * Sous-écran « Mot de passe » (parité web ChangePasswordSection) : change le
 * mot de passe Jellyfin du compte connecté via POST /api/auth/change-password.
 * Le backend valide le mot de passe actuel via Jellyfin (jamais la clé admin).
 */
export function PasswordScreen() {
  const { t } = useTranslation("preferences");
  const { t: tc } = useTranslation("common");
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const contentPadding = useContentPadding(560);
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
    <SubtleBackground>
      <View style={{ flex: 1, paddingTop: Math.max(insets.top, 24) + 8 }}>
        <View style={[st.header, { paddingHorizontal: spacing.screenPadding }]}>
          <IconButton icon="←" onPress={() => router.back()} accessibilityLabel={tc("back")} />
          <Text style={st.headerTitle}>{t("changePasswordTitle")}</Text>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: contentPadding, paddingBottom: insets.bottom + spacing.xl }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <GlassCard style={st.card}>
            <Text style={st.description}>{t("changePasswordDescription")}</Text>

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
              fullWidth
              style={st.submit}
            />
          </GlassCard>
        </ScrollView>
      </View>
    </SubtleBackground>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      marginBottom: spacing.lg,
    },
    headerTitle: { ...typography.title, color: t.colors.text.primary, flex: 1 },
    card: { gap: spacing.md },
    description: {
      ...typography.small,
      fontFamily: FONT_FAMILY.regular,
      color: t.colors.text.tertiary,
      lineHeight: 18,
    },
    feedback: { ...typography.small, fontFamily: FONT_FAMILY.medium },
    submit: { marginTop: spacing.xs },
  });
