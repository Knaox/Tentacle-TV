import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { ensureOfflineChannel } from "./notificationChannels";
import { ensureNotificationPermission } from "./pushNotifications";

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
    // Android : le canal (HIGH, pour le bandeau) se donne par le déclencheur —
    // seul, il vaut « tout de suite ».
    const channelId = Platform.OS === "android" ? await ensureOfflineChannel() : null;
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data },
      trigger: channelId ? { channelId } : null,
    });
    return true;
  } catch {
    return false;
  }
}
