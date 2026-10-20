import type { QueryClient } from "@tanstack/react-query";
import type { AppNotification } from "../hooks/useNotifications";

/**
 * Les gestes de la cloche se voient AVANT la réponse du serveur : la ligne
 * passe lue (ou disparaît), la pastille baisse — dans TOUTES les listes en
 * cache sous `["notifications"]`, quelle que soit leur forme : la liste simple
 * (`AppNotification[]`, la cloche du web et du bureau) ou les pages du centre
 * du mobile (`{ pages: [{ items }] }`). Les compteurs de non lues
 * (`["notifications", "unread-count", …]`) baissent du nombre d'identifiants
 * DISTINCTS passés lus. Un échec rend l'instantané pris avant le geste.
 * Une seule écriture pour le web et le mobile — jamais une copie.
 */

export const NOTIFICATIONS_KEY = ["notifications"] as const;
export const UNREAD_COUNT_KEY = ["notifications", "unread-count"] as const;

/** Une page du centre paginé : ses notifications et le curseur de la suivante. */
export interface NotificationPage {
  items: AppNotification[];
  next: string | null;
}

interface PagedData {
  pages: NotificationPage[];
  pageParams: unknown[];
}

type ListData = AppNotification[] | PagedData;
type Snapshot = Array<[readonly unknown[], unknown]>;

function isPaged(data: unknown): data is PagedData {
  return !!data && typeof data === "object" && Array.isArray((data as PagedData).pages)
    && (data as PagedData).pages.every((p) => !!p && Array.isArray((p as NotificationPage).items));
}

function isList(data: unknown): data is ListData {
  return Array.isArray(data) || isPaged(data);
}

/** Toutes les notifications d'une liste en cache, quelle que soit sa forme. */
export function notificationsOf(data: unknown): AppNotification[] {
  if (Array.isArray(data)) return data as AppNotification[];
  if (isPaged(data)) return data.pages.flatMap((p) => p.items);
  return [];
}

function mapList(data: ListData, fn: (items: AppNotification[]) => AppNotification[]): ListData {
  if (Array.isArray(data)) return fn(data);
  return { ...data, pages: data.pages.map((p) => ({ ...p, items: fn(p.items) })) };
}

export interface NotificationPatch {
  /** Celles qui passent lues. */
  read?: (n: AppNotification) => boolean;
  /** Celles qui disparaissent. */
  remove?: (n: AppNotification) => boolean;
}

/**
 * Applique le geste à une liste en cache et dit quelles NON LUES il touche
 * (lues ou retirées) — pur, testé seul.
 */
export function patchNotificationList(data: ListData, patch: NotificationPatch): { data: ListData; unreadTouched: string[] } {
  const touched = new Set<string>();
  const next = mapList(data, (items) => items.flatMap((n) => {
    if (patch.remove?.(n)) {
      if (!n.read) touched.add(n.id);
      return [];
    }
    if (!n.read && patch.read?.(n)) {
      touched.add(n.id);
      return [{ ...n, read: true }];
    }
    return [n];
  }));
  return { data: next, unreadTouched: [...touched] };
}

/**
 * Le geste dans tout le cache : requêtes en vol annulées (une réponse d'avant
 * le geste n'écrase pas l'optimiste), listes patchées, compteurs baissés. Rend
 * l'instantané à restaurer en cas d'échec. `allRead` : le compteur passe à
 * zéro (« Tout marquer comme lu » — même ce qui n'est pas encore chargé).
 */
export async function applyNotificationPatch(
  qc: QueryClient,
  patch: NotificationPatch & { allRead?: boolean; allRemoved?: boolean },
): Promise<Snapshot> {
  await qc.cancelQueries({ queryKey: NOTIFICATIONS_KEY });
  const snapshot: Snapshot = qc.getQueriesData({ queryKey: NOTIFICATIONS_KEY });
  const touched = new Set<string>();
  for (const [key, data] of snapshot) {
    if (!isList(data)) continue;
    const result = patchNotificationList(data, patch);
    for (const id of result.unreadTouched) touched.add(id);
    qc.setQueryData(key, result.data);
  }
  for (const [key, data] of qc.getQueriesData<{ count: number }>({ queryKey: UNREAD_COUNT_KEY })) {
    if (!data || typeof data.count !== "number") continue;
    const count = patch.allRead || patch.allRemoved ? 0 : Math.max(0, data.count - touched.size);
    qc.setQueryData(key, { count });
  }
  return snapshot;
}

export function restoreNotificationSnapshot(qc: QueryClient, snapshot: Snapshot): void {
  for (const [key, data] of snapshot) qc.setQueryData(key, data);
}

/** La clé des gestes de la cloche (`mutationKey`) : ils se savent les uns les autres. */
export const NOTIFICATION_MUTATION_KEY = ["notifications"] as const;

/**
 * Après le geste (réussi ou non) : tout se relit, au nom du serveur — mais
 * seulement après le DERNIER geste en cours. Deux lignes glissées coup sur
 * coup : la relecture qui suit la première, partie avant que le serveur ait
 * reçu la seconde, rallumait celle-ci une fraction de seconde.
 */
export function settleNotifications(qc: QueryClient): void {
  if (qc.isMutating({ mutationKey: NOTIFICATION_MUTATION_KEY }) > 1) return;
  void qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
}
