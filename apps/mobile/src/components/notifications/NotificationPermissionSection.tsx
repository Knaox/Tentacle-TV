import { useCallback, useEffect, useState } from "react";
import { AppState, Linking, Platform } from "react-native";
import { useTranslation } from "react-i18next";
import { useRegisterPushDevice } from "@tentacle-tv/api-client";
import { SettingsRow, SettingsSection } from "@/components/settings";
import {
  ensureNotificationPermission,
  getNotificationPermissionState,
  registerForPushToken,
  type NotificationPermissionState,
} from "@/services/pushNotifications";

/**
 * « Cet appareil » : l'autorisation du SYSTÈME, la seule chose des
 * notifications qui ne suit pas le compte. Relue au retour au premier plan
 * (l'utilisateur revient des Réglages du système). Pas encore demandée : un
 * appui la demande puis enregistre l'appareil ; refusée : un appui ouvre les
 * Réglages du système, seul endroit où elle se rend.
 */
export function NotificationPermissionSection() {
  const { t } = useTranslation("notifications");
  const [state, setState] = useState<NotificationPermissionState | null>(null);
  const register = useRegisterPushDevice();

  const refresh = useCallback(() => {
    void getNotificationPermissionState().then(setState).catch(() => setState(null));
  }, []);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener("change", (next) => { if (next === "active") refresh(); });
    return () => sub.remove();
  }, [refresh]);

  const onPress = useCallback(() => {
    if (state === "denied") {
      void Linking.openSettings();
      return;
    }
    void (async () => {
      const granted = await ensureNotificationPermission();
      refresh();
      if (!granted) return;
      const token = await registerForPushToken();
      if (token) register.mutate({ token, platform: Platform.OS === "android" ? "android" : "ios" });
    })();
  }, [state, refresh, register]);

  if (!state) return null;
  const description = state === "granted" ? t("devicePermissionOn") : state === "denied" ? t("devicePermissionOff") : t("devicePermissionAsk");

  return (
    <SettingsSection title={t("deviceSectionTitle")}>
      <SettingsRow
        icon={state === "granted" ? "bell" : "bell-off"}
        label={t("devicePermissionTitle")}
        description={description}
        scope="device"
        value={state === "granted" ? undefined : state === "denied" ? t("enableInSettings") : t("devicePermissionAllow")}
        onPress={state === "granted" ? undefined : onPress}
        last
      />
    </SettingsSection>
  );
}
