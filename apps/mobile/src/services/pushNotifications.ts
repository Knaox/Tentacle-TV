import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";

// Côté client Expo : permissions, obtention de l'ExpoPushToken, handler
// d'affichage au premier plan, et écoute des taps. Aucune logique métier ici.

/** Affiche les notifs même app au premier plan (bannière + son + badge). */
export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * Demande la permission (si besoin) et renvoie l'ExpoPushToken.
 * Renvoie null si : simulateur, permission refusée, ou projectId manquant.
 */
export async function registerForPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null; // le simulateur iOS ne reçoit pas de push

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Général",
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (existing !== "granted") {
    // iOS ne redemande pas si déjà « denied » — l'écran de réglages gère ce cas.
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== "granted") return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!projectId) return null;

  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch (err) {
    console.warn("[Push] getExpoPushTokenAsync échoué:", err);
    return null;
  }
}

export interface PushTapData {
  type?: string;
  refId?: string;
}

/** True si l'appareil a déjà accordé la permission de notifications. */
export async function hasNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === "granted";
}

/**
 * Garantit la permission OS : la demande si « undetermined », renvoie l'état
 * final accordé/refusé. À distinguer de l'obtention du token (qui peut échouer
 * pour des raisons techniques — APNs, entitlement — SANS que la permission soit
 * refusée). Le seul « refus » légitime pour renvoyer l'utilisateur aux Réglages.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status === "granted") return true;
  // iOS : si déjà refusé, requestPermissionsAsync renvoie « denied » sans dialog.
  const { status: next } = await Notifications.requestPermissionsAsync();
  return next === "granted";
}

/** Écoute les taps sur notification ; appelle onTap avec les data. Renvoie un cleanup. */
export function addNotificationListeners(onTap: (data: PushTapData) => void): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = (response.notification.request.content.data ?? {}) as PushTapData;
    onTap(data);
  });
  return () => sub.remove();
}
