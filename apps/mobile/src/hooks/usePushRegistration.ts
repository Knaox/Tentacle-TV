import { useEffect } from "react";
import { Platform } from "react-native";
import { useRouter } from "expo-router";
import { useRegisterPushDevice } from "@tentacle-tv/api-client";
import type { StorageAdapter } from "@tentacle-tv/api-client";
import {
  configureNotificationHandler,
  registerForPushToken,
  addNotificationListeners,
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
  const router = useRouter();

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

  // Tap sur une notification → navigation contextuelle.
  useEffect(() => {
    return addNotificationListeners((data) => {
      if (data?.type === "library_added" || data?.type === "request_status") {
        router.push("/(tabs)");
      }
    });
  }, [router]);

  return null;
}
