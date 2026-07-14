import { Expo, type ExpoPushMessage, type ExpoPushTicket } from "expo-server-sdk";
import { getPrisma, hasPrisma } from "./db";

// Service générique d'envoi de push via Expo Push Service. Le serveur n'envoie
// qu'à l'ExpoPushToken ; Expo relaie vers APNs (iOS) / FCM (Android). On ne
// dépend d'aucune fonctionnalité applicative précise ici : « envoie ce message
// aux appareils de ces utilisateurs ». Le ciblage/gating vit chez l'appelant.

const expo = new Expo();

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
}

/** Envoie une push à tous les appareils d'un utilisateur. */
export function sendToUser(jellyfinUserId: string, payload: PushPayload): Promise<SendResult> {
  return sendToUsers([jellyfinUserId], payload);
}

/** Envoie le même message à tous les appareils de plusieurs utilisateurs. */
export async function sendToUsers(
  jellyfinUserIds: string[],
  payload: PushPayload,
): Promise<SendResult> {
  if (!hasPrisma() || jellyfinUserIds.length === 0) return { sent: 0, invalid: 0 };
  const prisma = getPrisma();

  const devices = await prisma.pushDevice.findMany({
    where: { jellyfinUserId: { in: jellyfinUserIds } },
  });
  if (devices.length === 0) return { sent: 0, invalid: 0 };

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
