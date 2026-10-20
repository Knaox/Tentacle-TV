import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { retireLegacyChannels } from "./notificationChannels";
import { holdStartupOverlay } from "@/startup/startupOverlays";

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
 * La demande au système, déclarée comme recouvrement de démarrage le temps de
 * sa réponse : rien d'autre ne s'ouvre pendant que sa fenêtre est à l'écran.
 */
async function requestPermission(): Promise<Notifications.NotificationPermissionsStatus> {
  const release = holdStartupOverlay("permission");
  try {
    return await Notifications.requestPermissionsAsync();
  } finally {
    release();
  }
}

/**
 * Demande la permission (si besoin) et renvoie l'ExpoPushToken.
 * Renvoie null si : simulateur, permission refusée, ou projectId manquant.
 */
export async function registerForPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null; // le simulateur iOS ne reçoit pas de push

  // Android : aucun canal à créer pour les push — elles prennent le canal de
  // repli d'expo-notifications, en HIGH (`notificationChannels.ts`).
  await retireLegacyChannels();

  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (existing !== "granted") {
    // iOS ne redemande pas si déjà « denied » — l'écran de réglages gère ce cas.
    status = (await requestPermission()).status;
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
  /** La cible posée par l'émetteur (contrat shared `notificationTarget`) — lue, jamais crue. */
  target?: unknown;
  /** L'identifiant de la notification sur le serveur (capacité `notifications.pushSync`). */
  notificationId?: string;
  /** Le geste du système : toucher (défaut) ou balayage (iOS, catégorie à `customDismissAction`). */
  actionIdentifier?: string;
  /** Notification locale « Prêt à regarder hors ligne » d'un seul titre : lequel. */
  itemId?: unknown;
}

function tapDataOf(response: Notifications.NotificationResponse): PushTapData {
  const data = (response.notification.request.content.data ?? {}) as PushTapData;
  return { ...data, actionIdentifier: response.actionIdentifier };
}

/**
 * L'état de la permission sur CET appareil : accordée, refusée (seuls les
 * Réglages du système la rendent), ou pas encore demandée.
 */
export type NotificationPermissionState = "granted" | "denied" | "undetermined";

export async function getNotificationPermissionState(): Promise<NotificationPermissionState> {
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  if (status === "granted") return "granted";
  // Un refus qui peut encore se redemander (Android) vaut « pas encore » : la
  // demande du système reviendra. Sinon, seuls les Réglages la rendent.
  return status === "denied" && !canAskAgain ? "denied" : "undetermined";
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
  const { status: next } = await requestPermission();
  return next === "granted";
}

/** Écoute les réponses (toucher, balayage iOS) ; appelle onTap avec les data et le geste. Renvoie un cleanup. */
export function addNotificationListeners(onTap: (data: PushTapData) => void): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    onTap(tapDataOf(response));
  });
  return () => sub.remove();
}

let lastInitialResponseId: string | null = null;

/**
 * La notification qui a LANCÉ l'app (démarrage à froid) : le listener
 * ci-dessus n'existe pas encore quand l'utilisateur tape, expo-notifications
 * la garde en mémoire. Sur Android elle est rejouée à chaque démarrage tant
 * qu'elle n'est pas effacée — d'où l'effacement, doublé d'un garde par
 * identifiant au cas où l'effacement ne serait pas honoré.
 */
export async function getInitialNotificationTap(): Promise<PushTapData | null> {
  const response = await Notifications.getLastNotificationResponseAsync();
  if (!response) return null;
  const id = response.notification.request.identifier;
  if (id && id === lastInitialResponseId) return null;
  lastInitialResponseId = id;
  await Notifications.clearLastNotificationResponseAsync().catch(() => {});
  return tapDataOf(response);
}
