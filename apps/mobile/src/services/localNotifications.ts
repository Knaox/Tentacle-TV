import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { i18n } from "@tentacle-tv/shared";
import { ensureNotificationPermission } from "./pushNotifications";

/** Le canal Android des notifications locales du hors ligne. */
const CHANNEL_ID = "offline";

export interface LocalNotificationData {
  [key: string]: unknown;
  type: "offline_ready" | "offline_disk_full";
}

/**
 * Présente une notification LOCALE, tout de suite — « Prêt hors ligne »,
 * « Espace insuffisant ». Demande la permission si elle ne l'a jamais été ;
 * refusée, ne fait rien. Best-effort : ne lève jamais.
 */
export async function presentLocalNotification(title: string, body: string, data: LocalNotificationData): Promise<boolean> {
  try {
    if (!(await ensureNotificationPermission())) return false;
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: i18n.t("offline:tabOnDevice"),
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data },
      // Android : le canal se donne par le déclencheur — seul, il vaut « tout de suite ».
      trigger: Platform.OS === "android" ? { channelId: CHANNEL_ID } : null,
    });
    return true;
  } catch {
    return false;
  }
}
