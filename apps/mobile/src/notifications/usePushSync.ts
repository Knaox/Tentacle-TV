import { useEffect } from "react";
import { AppState } from "react-native";
import * as Notifications from "expo-notifications";
import { useServerCapability } from "@tentacle-tv/api-client";
import { useMarkReadMobile, useNotificationsMobile, useUnreadCountMobile } from "@/hooks/useNotificationsMobile";
import {
  presentedEntries,
  reconcileWithSystem,
  registerNotificationCategory,
  rememberPresented,
  setAppBadge,
  withdrawPresented,
} from "./pushSync";
import { presentedEntryOf, presentedToWithdraw } from "./pushSyncRules";

/**
 * Le téléphone d'accord avec le serveur, dans les deux sens (capacité
 * `notifications.pushSync` : les push portent leur identifiant) :
 * - balayée dans le centre du système = lue : le filet, à chaque retour de
 *   l'app (iOS remonte aussi le balayage lui-même, `DISMISS_ACTION_IDENTIFIER`) ;
 * - lue dans l'app ou sur un autre appareil = retirée du centre de CE
 *   téléphone, dès que la liste du serveur le dit.
 * La pastille de l'icône suit le nombre de non lues (purement local : sans
 * la capacité aussi).
 */
export function usePushSync(signedIn: boolean): void {
  const enabled = useServerCapability("notifications.pushSync") && signedIn;
  const markRead = useMarkReadMobile();
  const { data: list } = useNotificationsMobile();
  const { data: unread } = useUnreadCountMobile();
  const mark = markRead.mutate;

  useEffect(() => {
    if (!enabled) return;
    void registerNotificationCategory();
    const reconcile = () => {
      void reconcileWithSystem().then((ids) => { for (const id of ids) mark(id); });
    };
    reconcile();
    const appState = AppState.addEventListener("change", (state) => { if (state === "active") reconcile(); });
    // Reçue au premier plan : vue ici, même si elle quitte le centre avant le prochain relevé.
    const received = Notifications.addNotificationReceivedListener((n) => {
      const { notificationId } = presentedEntryOf(n);
      if (notificationId) void rememberPresented(notificationId);
    });
    return () => {
      appState.remove();
      received.remove();
    };
  }, [enabled, mark]);

  const unreadCount = unread?.count;
  useEffect(() => {
    if (!enabled) return;
    void presentedEntries().then((presented) =>
      withdrawPresented(presentedToWithdraw({ presented, serverList: list, unreadCount })));
  }, [enabled, list, unreadCount]);

  useEffect(() => {
    if (signedIn && unreadCount !== undefined) void setAppBadge(unreadCount);
  }, [signedIn, unreadCount]);
}
