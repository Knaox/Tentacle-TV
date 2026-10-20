import { parseNotificationState, parseNotificationTarget, type NotificationState, type NotificationTarget } from "./notificationTarget";

/**
 * Une ligne de `notifications` telle que les clients la reçoivent : la cible
 * et l'état LUS (validés) — une colonne qu'un émetteur aurait mal remplie
 * devient `null`, et la notification garde son comportement d'avant.
 */
export interface NotificationRow {
  id: string;
  jellyfinUserId: string;
  type: string;
  title: string;
  body: string | null;
  refId: string | null;
  target?: string | null;
  state?: string | null;
  read: boolean;
  createdAt: Date;
}

export interface NotificationDto extends Omit<NotificationRow, "target" | "state" | "createdAt"> {
  target: NotificationTarget | null;
  state: NotificationState | null;
  createdAt: string;
}

export function toNotificationDto(row: NotificationRow): NotificationDto {
  return {
    id: row.id,
    jellyfinUserId: row.jellyfinUserId,
    type: row.type,
    title: row.title,
    body: row.body,
    refId: row.refId,
    target: parseNotificationTarget(row.target ?? null),
    state: parseNotificationState(row.state ?? null),
    read: row.read,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Ce qu'un push emporte pour mener au bon endroit : le type et la référence
 * (comportement d'avant), plus la cible si l'émetteur en a posé une, et
 * l'identifiant de la ligne (`notificationId`, capacité
 * `notifications.pushSync`) — le téléphone marque lue la notification
 * balayée dans son centre, et retire du centre celle lue ailleurs.
 */
export function pushTapData(row: Pick<NotificationRow, "type" | "refId" | "target"> & { id?: string }): Record<string, unknown> {
  const target = parseNotificationTarget(row.target ?? null);
  return {
    type: row.type,
    refId: row.refId ?? undefined,
    ...(row.id ? { notificationId: row.id } : {}),
    ...(target ? { target } : {}),
  };
}
