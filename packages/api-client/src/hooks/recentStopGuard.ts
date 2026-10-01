import type { QueryClient } from "@tanstack/react-query";
import type { MediaItem, UserItemData } from "@tentacle-tv/shared";
import { currentPlaybackItemId } from "../socket/sessionChannel";
import { updateItemUserDataInCache } from "./cacheUtils";
import { judgeServerUserData, projectionPatch, type StopProjection } from "./stopProjection";

/**
 * La garde des arrêts récents : une réponse du serveur PLUS ANCIENNE que notre
 * arrêt ne fait plus reculer la fiche ni les listes (cf. `stopProjection.ts`
 * pour ce que Jellyfin 12.1 fait de nos arrêts).
 *
 * - Un abonné au cache des requêtes, posé une fois par client par la règle de
 *   sortie elle-même : toute réponse du serveur qui contient le titre et date
 *   d'avant l'écriture de notre arrêt est re-patchée par la projection.
 * - LA DATE GAGNE : une réponse dont `LastPlayedDate` est postérieure à
 *   l'arrêt (une lecture commencée depuis, ici ou ailleurs) fait tomber la
 *   garde — le serveur a raison. Elle tombe aussi au bout de deux minutes, mais
 *   PAS sur un accord passager : l'écriture hors d'ordre de Jellyfin peut
 *   défaire, après coup, un arrêt qu'il montrait déjà (simulé au banc).
 * - Une seule RÉPARATION, 20 s après l'arrêt, si le serveur n'a toujours rien
 *   écrit (le cas « jamais ») : relecture, puis lecture-modification-écriture
 *   de la reprise, et seulement si, à cet instant, le désaccord tient, sa date
 *   reste antérieure à l'arrêt, et le titre n'est pas relancé sur cet appareil.
 *
 * Limite assumée : un titre absent d'une réponse (« Reprendre » au premier
 * visionnage, Jellyfin n'ayant encore rien écrit) n'y est pas inséré.
 */
export interface RecentStop extends StopProjection {
  itemId: string;
  runtimeTicks: number;
  /** L'instant de l'arrêt, horloge de l'appareil (ms). */
  stoppedAt: number;
}

/** Ce qu'il faut pour relire et réécrire une reprise — pas le client entier. */
export interface UserDataClient {
  fetch<T>(path: string, init?: RequestInit): Promise<T>;
}

const GUARD_TTL_MS = 120_000;
const REPAIR_AFTER_MS = 20_000;
const stops = new Map<string, RecentStop>();
const guardedCaches = new WeakSet<object>();

/** La copie du titre dans la réponse d'une requête : fiche, liste, pages, `{ Items }`. */
export function findUserData(data: unknown, itemId: string): Partial<UserItemData> | undefined {
  const fromItem = (value: unknown): Partial<UserItemData> | undefined => {
    const item = value as Partial<MediaItem> | null;
    return item && typeof item === "object" && item.Id === itemId ? item.UserData : undefined;
  };
  const fromList = (list: unknown): Partial<UserItemData> | undefined => {
    if (!Array.isArray(list)) return undefined;
    for (const value of list) {
      const found = fromItem(value);
      if (found) return found;
    }
    return undefined;
  };
  if (Array.isArray(data)) return fromList(data);
  if (!data || typeof data !== "object") return undefined;
  const shaped = data as { Items?: unknown; pages?: Array<{ Items?: unknown } | null> };
  if (Array.isArray(shaped.pages)) {
    for (const page of shaped.pages) {
      const found = fromList(page?.Items);
      if (found) return found;
    }
    return undefined;
  }
  return fromItem(data) ?? fromList(shaped.Items);
}

function installGuard(qc: QueryClient): void {
  const cache = qc.getQueryCache();
  if (guardedCaches.has(cache)) return;
  guardedCaches.add(cache);
  cache.subscribe((event) => {
    if (stops.size === 0 || event.type !== "updated") return;
    const action = event.action as { type: string; manual?: boolean };
    // Nos propres patchs (`setQueryData`) sont « manuels » : ils ne relancent rien.
    if (action.type !== "success" || action.manual) return;
    const now = Date.now();
    for (const stop of [...stops.values()]) {
      if (now - stop.stoppedAt > GUARD_TTL_MS) {
        stops.delete(stop.itemId);
        continue;
      }
      const found = findUserData(event.query.state.data, stop.itemId);
      if (!found) continue;
      const verdict = judgeServerUserData(stop, found);
      if (verdict === "newer") stops.delete(stop.itemId);
      else if (verdict === "older") updateItemUserDataInCache(qc, stop.itemId, () => projectionPatch(stop, stop.runtimeTicks));
    }
  });
}

async function repairStop(client: UserDataClient, userId: string, stop: RecentStop): Promise<void> {
  // Réglée entre-temps (une lecture plus récente), ou remplacée par un arrêt
  // plus récent du même titre ; titre relancé sur cet appareil.
  const settled = () => stops.get(stop.itemId) !== stop || currentPlaybackItemId() === stop.itemId;
  if (settled()) return;
  const path = `/UserItems/${stop.itemId}/UserData?userId=${encodeURIComponent(userId)}`;
  const data = await client.fetch<Record<string, unknown> & Partial<UserItemData>>(path).catch(() => null);
  if (!data || settled()) return;
  if (judgeServerUserData(stop, data) !== "older") {
    stops.delete(stop.itemId);
    return;
  }
  // L'objet ENTIER, seule la reprise changée (cf. `resumeOverPlayed.ts`).
  const body = { ...data, PlaybackPositionTicks: stop.positionTicks, ...(stop.played !== null && { Played: stop.played }) };
  const written = await client
    .fetch(path, { method: "POST", body: JSON.stringify(body) })
    .then(() => true, () => false);
  console.info(`[reprise] arrêt à ${Math.round(stop.positionTicks / 10_000_000)} s réécrit chez Jellyfin : ${written ? "fait" : "échec"}`);
}

/** Retient un arrêt à défendre — la règle de sortie l'appelle, une fois par sortie. */
export function rememberStop(qc: QueryClient, client: UserDataClient, userId: string, stop: RecentStop): void {
  stops.set(stop.itemId, stop);
  installGuard(qc);
  setTimeout(() => { void repairStop(client, userId, stop); }, REPAIR_AFTER_MS);
}

/** Tests : repart d'un registre vide. */
export function forgetRecentStops(): void {
  stops.clear();
}
