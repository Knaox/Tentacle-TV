import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { NOTIFICATION_PUSH_CATEGORY } from "@tentacle-tv/shared";
import {
  addKnownPresented,
  parseKnownPresented,
  presentedEntryOf,
  reconcilePresented,
  type PresentedEntry,
} from "./pushSyncRules";

/**
 * L'application des règles de `pushSyncRules` au centre de notifications du
 * système, par expo-notifications. Le relevé des notifications vues sur CE
 * téléphone vit dans AsyncStorage (lu de façon asynchrone : rien au
 * préchargement du démarrage).
 */

const KNOWN_KEY = "tentacle_push_presented";

/**
 * iOS : la catégorie des push de la cloche, avec `customDismissAction` — un
 * balayage dans le centre du système remonte à l'app comme une réponse
 * (`DISMISS_ACTION_IDENTIFIER`). Android n'a pas d'équivalent dans
 * expo-notifications : le filet (`reconcileWithSystem`) y suffit.
 */
export async function registerNotificationCategory(): Promise<void> {
  if (Platform.OS !== "ios") return;
  await Notifications.setNotificationCategoryAsync(NOTIFICATION_PUSH_CATEGORY, [], { customDismissAction: true }).catch(() => null);
}

export async function presentedEntries(): Promise<PresentedEntry[]> {
  const list = await Notifications.getPresentedNotificationsAsync().catch(() => []);
  return list.map(presentedEntryOf);
}

async function readKnown(): Promise<string[]> {
  return parseKnownPresented(await AsyncStorage.getItem(KNOWN_KEY).catch(() => null));
}

async function writeKnown(ids: readonly string[]): Promise<void> {
  await AsyncStorage.setItem(KNOWN_KEY, JSON.stringify(ids)).catch(() => undefined);
}

/** Une push reçue au premier plan : vue sur ce téléphone, même si elle n'est plus dans le centre au prochain relevé. */
export async function rememberPresented(notificationId: string): Promise<void> {
  await writeKnown(addKnownPresented(await readKnown(), notificationId));
}

/**
 * Le FILET : ce qui a quitté le centre du système depuis le dernier relevé
 * est rendu (à marquer lue), le relevé est refait.
 */
export async function reconcileWithSystem(): Promise<string[]> {
  const [known, presented] = await Promise.all([readKnown(), presentedEntries()]);
  const { readNow, nextKnown } = reconcilePresented({ known, presented });
  await writeKnown(nextKnown);
  return readNow;
}

/**
 * Retire du centre du système ce qui est lu ailleurs — et l'oublie du
 * relevé : le filet ne le « marquera » pas lu une seconde fois.
 */
export async function withdrawPresented(entries: readonly PresentedEntry[]): Promise<void> {
  if (entries.length === 0) return;
  await Promise.all(entries.map((e) => Notifications.dismissNotificationAsync(e.requestId).catch(() => undefined)));
  const gone = new Set(entries.map((e) => e.notificationId));
  await writeKnown((await readKnown()).filter((id) => !gone.has(id)));
}

/** La pastille de l'icône : le nombre de non lues du compte. */
export async function setAppBadge(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(Math.max(0, count)).catch(() => false);
}
