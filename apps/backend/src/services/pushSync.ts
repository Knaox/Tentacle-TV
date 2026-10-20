import { getPrisma } from "./db";
import { NOTIFICATION_PUSH_CATEGORY } from "../notifications/notificationTarget";

/**
 * Ce qu'une push d'une notification de la cloche emporte pour que le
 * téléphone reste d'accord avec le serveur (capacité `notifications.pushSync`) :
 * la catégorie qui fait d'un balayage dans le centre du système une lecture,
 * et la pastille de l'icône — le nombre de non lues du compte au moment de
 * l'envoi. Un compte lu une fois par passage du worker (`cache`).
 */
export interface PushSyncFields {
  badge: number;
  categoryId: string;
}

export function createPushSyncFields(): (jellyfinUserId: string) => Promise<PushSyncFields> {
  const unreadByUser = new Map<string, Promise<number>>();
  return (jellyfinUserId) => {
    let unread = unreadByUser.get(jellyfinUserId);
    if (!unread) {
      unread = getPrisma().notification.count({ where: { jellyfinUserId, read: false } }).catch(() => 0);
      unreadByUser.set(jellyfinUserId, unread);
    }
    return unread.then((badge) => ({ badge, categoryId: NOTIFICATION_PUSH_CATEGORY }));
  };
}
