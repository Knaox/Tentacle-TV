import { useCallback, useEffect } from "react";
import { Platform } from "react-native";
import { useRootNavigationState, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  NOTIFICATION_LIVE_KEYS,
  resolveNotificationRoute,
  useRegisterPushDevice,
} from "@tentacle-tv/api-client";
import type { NotifPluginMeta, StorageAdapter } from "@tentacle-tv/api-client";
import { activePluginsQueryOptions, toNotifPluginMeta } from "@/hooks/useActivePlugins";
import { openNotificationRoute } from "@/utils/openNotificationRoute";
import {
  configureNotificationHandler,
  registerForPushToken,
  addNotificationListeners,
  getInitialNotificationTap,
  type PushTapData,
} from "@/services/pushNotifications";

/** Un tap ne doit jamais rester figé : au-delà, on part sans les plugins. */
const PLUGIN_META_TIMEOUT_MS = 3000;

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

  // Tap sur une notification → la même résolution de route que la cloche. Un
  // changement d'état de demande a besoin des métadonnées des plugins : le
  // cache s'il est chaud, sinon un fetch borné (serveur injoignable → accueil).
  // La donnée fraîche est invalidée avant d'arriver : la fiche et la cloche se
  // rechargent.
  const handleTap = useCallback(
    async (data: PushTapData) => {
      for (const queryKey of NOTIFICATION_LIVE_KEYS) {
        void queryClient.invalidateQueries({ queryKey: [...queryKey] });
      }
      const type = data?.type ?? "";
      let meta: NotifPluginMeta[] = [];
      if (type === "request_status" && serverUrl && token) {
        try {
          const plugins = await Promise.race([
            queryClient.ensureQueryData(activePluginsQueryOptions(serverUrl, token)),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("plugins timeout")), PLUGIN_META_TIMEOUT_MS),
            ),
          ]);
          meta = toNotifPluginMeta(plugins);
        } catch {
          // Repli : l'accueil.
        }
      }
      const route = resolveNotificationRoute({ type, refId: data?.refId ?? null }, "mobile", meta);
      openNotificationRoute(router, route);
    },
    [queryClient, router, serverUrl, token],
  );

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
