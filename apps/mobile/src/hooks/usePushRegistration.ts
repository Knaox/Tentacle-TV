import { useCallback, useEffect } from "react";
import { Platform } from "react-native";
import { useRootNavigationState } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { NOTIFICATION_LIVE_KEYS, useRegisterPushDevice } from "@tentacle-tv/api-client";
import type { StorageAdapter } from "@tentacle-tv/api-client";
import { useOpenNotification } from "@/notifications/useOpenNotification";
import { usePushSync } from "@/notifications/usePushSync";
import { DISMISS_ACTION_IDENTIFIER } from "@/notifications/pushSyncRules";
import { useMarkReadMobile } from "@/hooks/useNotificationsMobile";
import {
  configureNotificationHandler,
  registerForPushToken,
  addNotificationListeners,
  getInitialNotificationTap,
  type PushTapData,
} from "@/services/pushNotifications";

// Composant sans rendu, monté sous les providers. Après login (token + serverUrl
// présents), configure le handler et enregistre l'ExpoPushToken auprès du
// backend. L'enregistrement est INCONDITIONNEL dès que la permission est
// accordée — ce sont les préférences serveur qui décident de l'envoi réel, donc
// pas besoin de ré-enregistrer quand l'utilisateur bascule un toggle.
export function PushRegistrationSync({
  storage,
  serverUrl,
}: {
  storage: StorageAdapter;
  serverUrl: string | null;
}) {
  const token = storage.getItem("tentacle_token");
  const register = useRegisterPushDevice();
  const queryClient = useQueryClient();
  // expo-router refuse de naviguer avant le montage de la racine : le tap de
  // démarrage à froid attend qu'elle existe.
  const navReady = !!useRootNavigationState()?.key;

  useEffect(() => {
    if (!serverUrl || !token) return;
    let cancelled = false;
    void (async () => {
      configureNotificationHandler();
      const pushToken = await registerForPushToken();
      if (!cancelled && pushToken) {
        register.mutate({
          token: pushToken,
          platform: Platform.OS === "android" ? "android" : "ios",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
    // register est stable (mutation) — on ne réagit qu'au token/serverUrl.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverUrl, token]);

  // Tap sur une notification → la MÊME ouverture que la cloche
  // (`useOpenNotification`). La donnée fraîche est invalidée avant d'arriver :
  // la fiche et la cloche se rechargent.
  const open = useOpenNotification();
  const markRead = useMarkReadMobile().mutate;
  const handleTap = useCallback(
    async (data: PushTapData) => {
      // Touchée ou balayée : lue partout (capacité `notifications.pushSync`).
      if (data?.notificationId) markRead(data.notificationId);
      // Balayée (iOS) : rien à ouvrir.
      if (data?.actionIdentifier === DISMISS_ACTION_IDENTIFIER) return;
      for (const queryKey of NOTIFICATION_LIVE_KEYS) {
        void queryClient.invalidateQueries({ queryKey: [...queryKey] });
      }
      await open({ type: data?.type, refId: data?.refId ?? null, target: data?.target }, "push");
    },
    [queryClient, open, markRead],
  );

  // Le centre du système et le serveur d'accord (balayée = lue, lue ailleurs = retirée, pastille).
  usePushSync(!!serverUrl && !!token);

  useEffect(() => addNotificationListeners(handleTap), [handleTap]);

  // Démarrage à froid : la notification qui a lancé l'app.
  useEffect(() => {
    if (!serverUrl || !token || !navReady) return;
    let cancelled = false;
    void getInitialNotificationTap().then((data) => {
      if (!cancelled && data) handleTap(data);
    });
    return () => {
      cancelled = true;
    };
  }, [serverUrl, token, navReady, handleTap]);

  return null;
}
