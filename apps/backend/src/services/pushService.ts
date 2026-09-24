import { Expo, type ExpoPushMessage, type ExpoPushTicket } from "expo-server-sdk";
import { getPrisma, hasPrisma } from "./db";

// Service générique d'envoi de push via Expo Push Service. Le serveur n'envoie
// qu'à l'ExpoPushToken ; Expo relaie vers APNs (iOS) / FCM (Android). On ne
// dépend d'aucune fonctionnalité applicative précise ici : « envoie ce message
// aux appareils de ces utilisateurs ». Le ciblage/gating vit chez l'appelant.

const expo = new Expo();

/**
 * `TENTACLE_PUSH=off` coupe l'envoi, et lui seul. Un backend de vérification
 * partage la base des vrais appareils : sans ce coupe-circuit, son simple
 * démarrage leur poussait « N nouveautés » (diff de bibliothèque au boot).
 * Les appelants ne voient qu'un envoi à zéro appareil ; rien n'est purgé.
 */
function pushDisabled(): boolean {
  return process.env.TENTACLE_PUSH === "off";
}

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface SendResult {
  /** Nombre d'appareils ayant accepté le message (ticket « ok »). */
  sent: number;
  /** Nombre de tokens purgés (forme invalide ou DeviceNotRegistered). */
  invalid: number;
  /** Vrai quand l'envoi a été coupé parce que le serveur tourne en dev. */
  suppressed?: boolean;
}

export interface SendOptions {
  /** Passe outre la coupure du dev : réservé au geste explicite d'un admin
   *  (bouton « notification de test »), jamais à un envoi automatique. */
  allowInDev?: boolean;
}

/**
 * Livraison réelle ? En production, oui. En dev, NON par défaut : le backend de
 * dev lit le même Jellyfin que la prod, et chaque ajout à la bibliothèque
 * partait vers les vrais téléphones inscrits dans la base locale.
 * `TENTACLE_DEV_PUSH=1` rouvre l'envoi en dev — c'est ce que fait le banc de
 * bout en bout, qui pointe `EXPO_BASE_URL` (lu par expo-server-sdk) vers un
 * faux Expo.
 */
export function isPushDeliveryEnabled(): boolean {
  return process.env.NODE_ENV === "production" || process.env.TENTACLE_DEV_PUSH === "1";
}

/** Envoie une push à tous les appareils d'un utilisateur. */
export function sendToUser(
  jellyfinUserId: string,
  payload: PushPayload,
  options?: SendOptions,
): Promise<SendResult> {
  return sendToUsers([jellyfinUserId], payload, options);
}

/** Envoie le même message à tous les appareils de plusieurs utilisateurs. */
export async function sendToUsers(
  jellyfinUserIds: string[],
  payload: PushPayload,
  options?: SendOptions,
): Promise<SendResult> {
  if (!hasPrisma() || jellyfinUserIds.length === 0) return { sent: 0, invalid: 0 };
  const prisma = getPrisma();

  const devices = await prisma.pushDevice.findMany({
    where: { jellyfinUserId: { in: jellyfinUserIds } },
  });
  if (devices.length === 0) return { sent: 0, invalid: 0 };
  if (pushDisabled()) {
    console.log(`[Push] coupé (TENTACLE_PUSH=off) : « ${payload.title} » retenu pour ${devices.length} appareil(s)`);
    return { sent: 0, invalid: 0 };
  }

  if (!isPushDeliveryEnabled() && !options?.allowInDev) {
    console.log(`[Push] dev : envoi coupé — « ${payload.title} » (${devices.length} appareil(s))`);
    return { sent: 0, invalid: 0, suppressed: true };
  }

  // Tokens de forme invalide → à purger d'emblée.
  const invalidTokens = new Set<string>(
    devices.filter((d) => !Expo.isExpoPushToken(d.expoPushToken)).map((d) => d.expoPushToken),
  );

  const messages: ExpoPushMessage[] = devices
    .filter((d) => Expo.isExpoPushToken(d.expoPushToken))
    .map((d) => ({
      to: d.expoPushToken,
      sound: "default",
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
      channelId: "default",
    }));

  let sent = 0;
  const chunks = expo.chunkPushNotifications(messages);
  let cursor = 0; // index global dans `messages` (les chunks sont contigus et ordonnés)
  for (const chunk of chunks) {
    let tickets: ExpoPushTicket[] = [];
    try {
      tickets = await expo.sendPushNotificationsAsync(chunk);
    } catch (err) {
      console.error("[Push] Envoi d'un chunk échoué:", err);
      cursor += chunk.length;
      continue;
    }
    tickets.forEach((ticket, i) => {
      const token = messages[cursor + i]?.to as string | undefined;
      if (ticket.status === "ok") {
        sent += 1;
      } else if (ticket.status === "error" && token && ticket.details?.error === "DeviceNotRegistered") {
        invalidTokens.add(token);
      }
    });
    cursor += chunk.length;
  }

  // Purge des tokens morts. (La vérification des receipts Expo — DeviceNotRegistered
  // arrivant en différé — est une amélioration future ; les tickets suffisent en v1.)
  if (invalidTokens.size > 0) {
    await prisma.pushDevice
      .deleteMany({ where: { expoPushToken: { in: [...invalidTokens] } } })
      .catch((err) => console.error("[Push] Purge tokens échouée:", err));
  }

  return { sent, invalid: invalidTokens.size };
}
