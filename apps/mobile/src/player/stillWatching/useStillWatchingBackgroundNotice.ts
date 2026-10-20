import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import * as Notifications from "expo-notifications";
import { useTranslation } from "react-i18next";
import { hasNotificationPermission } from "@/services/pushNotifications";
import { STILL_WATCHING_NOTICE_TYPE, stillWatchingNotice, type StillWatchingNotice } from "./backgroundNotice";

/**
 * La notification de « Vous regardez encore ? » quand l'app n'est pas vue
 * (`backgroundNotice.ts`) : « Vous regardez encore ? » à la question, « Lecture
 * en pause » à la pause, retirée dès que l'app revient ou qu'on répond. Jamais
 * une demande de permission en pleine lecture : sans permission, rien.
 */
export function useStillWatchingBackgroundNotice(phase: "none" | "asking" | "paused", countdownMs: number): void {
  const { t } = useTranslation("player");
  const [appState, setAppState] = useState<string>(AppState.currentState);
  const posted = useRef<string | null>(null);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", setAppState);
    return () => subscription.remove();
  }, []);

  const notice: StillWatchingNotice = stillWatchingNotice(phase, appState);
  useEffect(() => {
    let cancelled = false;
    const previous = posted.current;
    posted.current = null;
    if (previous) void Notifications.dismissNotificationAsync(previous).catch(() => {});
    if (!notice) return;
    void (async () => {
      if (!(await hasNotificationPermission().catch(() => false)) || cancelled) return;
      const id = await Notifications.scheduleNotificationAsync({
        content: notice === "ask"
          ? { title: t("stillWatching.title"), body: t("stillWatching.countdown", { count: Math.round(countdownMs / 1000) }), data: { type: STILL_WATCHING_NOTICE_TYPE } }
          : { title: t("stillWatching.pausedTitle"), body: t("stillWatching.pausedBody"), data: { type: STILL_WATCHING_NOTICE_TYPE } },
        trigger: null,
      }).catch(() => null);
      if (cancelled && id) void Notifications.dismissNotificationAsync(id).catch(() => {});
      else posted.current = id;
    })();
    return () => {
      cancelled = true;
    };
  }, [notice, t, countdownMs]);

  // Le lecteur se ferme : la notification part avec lui.
  useEffect(() => () => {
    if (posted.current) void Notifications.dismissNotificationAsync(posted.current).catch(() => {});
  }, []);
}
