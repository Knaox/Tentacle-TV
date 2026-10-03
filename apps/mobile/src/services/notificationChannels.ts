import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { i18n } from "@tentacle-tv/shared";

/**
 * Les canaux Android des notifications.
 *
 * Le bandeau en haut de l'écran (heads-up) exige l'importance HIGH, et une app
 * ne relève JAMAIS l'importance d'un canal déjà créé : seul l'utilisateur le
 * peut. Les canaux d'avant (« default » des push, « offline »), créés en
 * DEFAULT, ne posaient la notification que dans la liste : ils sont supprimés,
 * et le hors ligne passe sur un canal neuf.
 *
 * Les push du serveur ne nomment plus de canal (backend, `pushService.ts`) :
 * expo-notifications les pose alors sur son canal de repli, qu'il crée en HIGH
 * et que nomme la ressource Android `expo_notifications_fallback_channel_name`
 * (« Général »). Une ancienne version de l'app fait de même ; un ancien
 * serveur qui vise encore « default », supprimé ici, retombe sur ce même canal
 * (`BaseNotificationBuilder` d'expo-notifications : canal absent → repli).
 */
export const OFFLINE_CHANNEL_ID = "offline-alerts";

const RETIRED_CHANNEL_IDS = ["default", "offline"] as const;

let retired: Promise<void> | null = null;

/** Supprime les canaux d'avant, une fois par lancement. Ne lève jamais. */
export function retireLegacyChannels(): Promise<void> {
  if (Platform.OS !== "android") return Promise.resolve();
  retired ??= Promise.all(
    RETIRED_CHANNEL_IDS.map((id) => Notifications.deleteNotificationChannelAsync(id).catch(() => undefined)),
  ).then(() => undefined);
  return retired;
}

/** Le canal des notifications du hors ligne, en HIGH ; son nom suit la langue. */
export async function ensureOfflineChannel(): Promise<string> {
  await retireLegacyChannels();
  await Notifications.setNotificationChannelAsync(OFFLINE_CHANNEL_ID, {
    name: i18n.t("offline:tabOnDevice"),
    importance: Notifications.AndroidImportance.HIGH,
  });
  return OFFLINE_CHANNEL_ID;
}
