import { useInfiniteQuery, useQuery, type InfiniteData } from "@tanstack/react-query";
import {
  useNotificationMutation,
  useServerCapability,
  useTentacleConfig,
  useUserId,
  type AppNotification,
  type NotificationPage,
} from "@tentacle-tv/api-client";

/** L'en-tête qui annonce la page suivante (capacité `notifications.paging`). */
const NEXT_HEADER = "X-Notifications-Next";
/** Une page du centre : ce qu'un écran de téléphone montre, et un peu plus. */
export const CENTER_PAGE_SIZE = 20;

/**
 * Le serveur et le compte en session, relus à chaque rendu. Le compte entre
 * dans CHAQUE clé : la cloche d'un autre profil (bascule de la Famille) ne
 * peut jamais s'afficher, même le temps d'une relecture.
 */
function useNotifAuth() {
  const { storage } = useTentacleConfig();
  const serverUrl = storage.getItem("tentacle_server_url") ?? "";
  const token = storage.getItem("tentacle_token") ?? "";
  const account = useUserId() ?? "";
  return { serverUrl, token, account, enabled: !!token };
}

async function request(auth: { serverUrl: string; token: string }, path: string, init?: RequestInit): Promise<Response> {
  const headers: Record<string, string> = { Authorization: `Bearer ${auth.token}`, ...(init?.headers as Record<string, string>) };
  if (init?.body) headers["Content-Type"] = "application/json";
  const res = await fetch(`${auth.serverUrl}/api/notifications${path}`, { ...init, headers });
  if (!res.ok) throw new Error(`${res.status}`);
  return res;
}

async function requestJson<T>(auth: { serverUrl: string; token: string }, path: string, init?: RequestInit): Promise<T> {
  return (await request(auth, path, init)).json() as Promise<T>;
}

/** Les dernières notifications (la synchro du centre du système, la lecture d'avance de la cloche). */
export function useNotificationsMobile(limit = 20) {
  const auth = useNotifAuth();
  return useQuery({
    queryKey: ["notifications", "list", auth.account, limit],
    queryFn: () => requestJson<AppNotification[]>(auth, `/?limit=${limit}`),
    enabled: auth.enabled,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

/**
 * Le centre, page par page : toutes les notifications du compte en défilant.
 * Un serveur sans `notifications.paging` : la première page seulement, comme
 * avant. Lu d'avance (le centre s'ouvre sur sa liste), relevé toutes les 30 s
 * seulement centre ouvert (`active`) ; fermé, le centre se ramène à sa
 * première page (`trimNotificationPages`) : un évènement du socket n'en relit
 * qu'une.
 */
export function useNotificationPagesMobile(active: boolean) {
  const auth = useNotifAuth();
  const paging = useServerCapability("notifications.paging");
  return useInfiniteQuery({
    queryKey: ["notifications", "pages", auth.account],
    queryFn: async ({ pageParam }): Promise<NotificationPage> => {
      const cursor = pageParam ? `&before=${encodeURIComponent(pageParam)}` : "";
      const res = await request(auth, `/?limit=${CENTER_PAGE_SIZE}${cursor}`);
      const items = (await res.json()) as AppNotification[];
      return { items, next: paging ? res.headers.get(NEXT_HEADER) : null };
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next ?? undefined,
    enabled: auth.enabled,
    staleTime: 15_000,
    refetchInterval: active ? 30_000 : false,
  });
}

/** Centre refermé : il ne garde que sa première page. */
export function trimNotificationPages(data: InfiniteData<NotificationPage, string | null> | undefined) {
  if (!data || data.pages.length <= 1) return data;
  return { pages: data.pages.slice(0, 1), pageParams: data.pageParams.slice(0, 1) };
}

export function useUnreadCountMobile() {
  const auth = useNotifAuth();
  return useQuery({
    queryKey: ["notifications", "unread-count", auth.account],
    queryFn: () => requestJson<{ count: number }>(auth, "/unread-count"),
    enabled: auth.enabled,
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
}

// Les gestes : le cache optimiste partagé avec le web (api-client), les requêtes du mobile.

export function useMarkAllReadMobile() {
  const auth = useNotifAuth();
  return useNotificationMutation<void>(
    () => requestJson(auth, "/read-all", { method: "POST" }),
    () => ({ read: () => true, allRead: true }),
  );
}

export function useMarkReadMobile() {
  const auth = useNotifAuth();
  return useNotificationMutation<string>(
    (id) => requestJson(auth, `/${encodeURIComponent(id)}/read`, { method: "POST" }),
    (id) => ({ read: (n) => n.id === id }),
  );
}

export function useDeleteNotificationMobile() {
  const auth = useNotifAuth();
  return useNotificationMutation<string>(
    (id) => requestJson(auth, `/${encodeURIComponent(id)}`, { method: "DELETE" }),
    (id) => ({ remove: (n) => n.id === id }),
  );
}

/** Le serveur prend cent identifiants par appel : une sélection plus longue part en plusieurs. */
const BATCH_MAX = 100;

export function useDeleteNotificationsMobile() {
  const auth = useNotifAuth();
  return useNotificationMutation<string[]>(
    (ids) => Promise.all(
      Array.from({ length: Math.ceil(ids.length / BATCH_MAX) }, (_, i) => ids.slice(i * BATCH_MAX, (i + 1) * BATCH_MAX))
        .map((chunk) => requestJson(auth, "/batch", { method: "DELETE", body: JSON.stringify({ ids: chunk }) })),
    ),
    (ids) => { const set = new Set(ids); return { remove: (n) => set.has(n.id) }; },
  );
}

export function useDeleteAllNotificationsMobile() {
  const auth = useNotifAuth();
  return useNotificationMutation<void>(
    () => requestJson(auth, "/all", { method: "DELETE" }),
    () => ({ remove: () => true, allRemoved: true }),
  );
}
