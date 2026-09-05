import { useCallback } from "react";
import { Text, Switch, Pressable, Alert, Linking, Platform, ActivityIndicator, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import {
  usePushPreferences,
  useSetPushPreferences,
  useSendTestPush,
  useRegisterPushDevice,
  PUSH_PREF_DEFAULTS,
  type PushPreferences,
} from "@tentacle-tv/api-client";

import { SettingsScaffold } from "./SettingsScaffold";
import { SettingsSection, SettingsRow } from "@/components/settings";
import { useActivePlugins } from "@/hooks/useActivePlugins";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { ensureNotificationPermission, registerForPushToken } from "@/services/pushNotifications";
import { spacing, typography, FONT_FAMILY, useTheme, useThemedStyles, type AppTheme } from "@/theme";

/**
 * Sous-écran « Notifications » : les préférences push. Ajouts bibliothèque et
 * Seer sont opt-in ; « Tickets de support » est ACTIVÉE par défaut (même
 * table de défauts que le serveur, PUSH_PREF_DEFAULTS — un serveur ancien qui
 * ne renvoie pas la clé n'éteint pas le réglage). Le toggle Seer n'apparaît
 * que si le plugin `seer` est actif. Un bouton envoie une notif de test pour
 * valider la chaîne bout-en-bout sur l'appareil.
 */
export function NotificationsScreen() {
  const { t } = useTranslation("notifications");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);

  const { data: prefs } = usePushPreferences();
  const setPrefs = useSetPushPreferences();
  const testPush = useSendTestPush();
  const register = useRegisterPushDevice();
  const { data: plugins } = useActivePlugins();
  const seerActive = !!plugins?.some((p) => p.pluginId === "seer");

  // Bouton de test : outil de diagnostic DEV uniquement (invisible en prod,
  // même pour les admins — l'endpoint backend refuse aussi) et réservé aux
  // admins en dev.
  const isAdmin = useIsAdmin();
  const showTestButton = __DEV__ && isAdmin;

  const toggle = useCallback(
    (key: keyof PushPreferences, next: boolean) => {
      setPrefs.mutate({ [key]: next } as Partial<PushPreferences>, {
        onError: (err) => Alert.alert(t("title"), `⚠️ ${String((err as Error)?.message ?? err)}`),
      });
      if (!next) return;
      // Activer : d'abord la permission OS (SEUL motif légitime de renvoi aux
      // Réglages), puis best-effort l'enregistrement du token. Un échec technique
      // du token (APNs, réseau) ne doit PAS afficher « désactivées dans les
      // réglages » alors que la permission est bien accordée.
      void (async () => {
        const granted = await ensureNotificationPermission();
        if (!granted) {
          Alert.alert(t("permissionDeniedTitle"), t("permissionDeniedBody"), [
            { text: t("cancel") },
            { text: t("enableInSettings"), onPress: () => void Linking.openSettings() },
          ]);
          return;
        }
        const token = await registerForPushToken();
        if (token) {
          register.mutate({ token, platform: Platform.OS === "android" ? "android" : "ios" });
        }
      })();
    },
    [setPrefs, register, t],
  );

  const onTest = useCallback(() => {
    testPush.mutate(undefined, {
      onSuccess: (res) =>
        Alert.alert(t("title"), res.sent === 0 ? t("testNoDevice") : t("testSent")),
      onError: () => Alert.alert(t("title"), t("testNoDevice")),
    });
  }, [testPush, t]);

  const labels: Record<keyof PushPreferences, string> = {
    libraryAdded: t("libraryAddedTitle"),
    seerAvailable: t("seerAvailableTitle"),
    tickets: t("ticketsTitle"),
  };
  const renderSwitch = (key: keyof PushPreferences) => (
    <Switch
      value={prefs?.[key] ?? PUSH_PREF_DEFAULTS[key]}
      onValueChange={(next) => toggle(key, next)}
      trackColor={{ false: theme.colors.fill.medium, true: theme.colors.brand.violet }}
      thumbColor={theme.colors.cta.brandFg}
      ios_backgroundColor={theme.colors.fill.medium}
      accessibilityLabel={labels[key]}
    />
  );

  return (
    <SettingsScaffold title={t("title")}>
      <SettingsSection title={t("pushSectionTitle")}>
        <SettingsRow
          icon="film"
          label={t("libraryAddedTitle")}
          description={t("libraryAddedDesc")}
          trailing={renderSwitch("libraryAdded")}
        />
        {seerActive ? (
          <SettingsRow
            icon="download-cloud"
            label={t("seerAvailableTitle")}
            description={t("seerAvailableDesc")}
            trailing={renderSwitch("seerAvailable")}
          />
        ) : null}
        <SettingsRow
          icon="life-buoy"
          label={t("ticketsTitle")}
          description={t("ticketsDesc")}
          trailing={renderSwitch("tickets")}
          last
        />
      </SettingsSection>

      {showTestButton ? (
        <>
          <Pressable
            onPress={onTest}
            disabled={testPush.isPending}
            style={({ pressed }) => [st.testBtn, pressed && st.testBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel={t("testButton")}
          >
            {testPush.isPending ? (
              <ActivityIndicator color={theme.colors.cta.brandFg} />
            ) : (
              <Text style={st.testBtnLabel}>{t("testButton")}</Text>
            )}
          </Pressable>

          <Text style={st.hint}>{t("testHint")}</Text>
        </>
      ) : null}
    </SettingsScaffold>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    testBtn: {
      marginTop: spacing.lg,
      minHeight: 50,
      borderRadius: spacing.cardRadius,
      backgroundColor: t.colors.brand.violet,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.lg,
    },
    testBtnPressed: { opacity: 0.85 },
    testBtnLabel: {
      ...typography.body,
      fontFamily: FONT_FAMILY.semibold,
      color: t.colors.cta.brandFg,
    },
    hint: {
      ...typography.small,
      color: t.colors.text.tertiary,
      textAlign: "center",
      marginTop: spacing.md,
      paddingHorizontal: spacing.md,
    },
  });
