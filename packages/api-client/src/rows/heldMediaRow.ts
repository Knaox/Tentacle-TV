import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { MediaItem, UserItemData } from "@tentacle-tv/shared";
import { LIST_QUERY_PREFIXES } from "../hooks/cacheQueryKeys";
import { heldRowView, useLastSeen, useRowSnapshot } from "./heldRow";

/**
 * La rangée tenue (rows/heldRow) pour des titres Jellyfin : une carte que la
 * liste perd pendant le survol garde son ÉTAT le plus récent — celui que le
 * cache a connu pour elle, même si la rangée ne l'a jamais rendu.
 *
 * Pourquoi : « vu » dans Reprendre patche la liste, mais la liste est filtrée
 * (`dedupResumeBySeries` écarte tout titre vu) — la carte en sortait au rendu
 * même du patch, sans jamais avoir été rendue cochée. La rangée la gardait
 * donc avec sa photographie, NON vue : le bouton restait « Marquer comme vu »
 * sous le curseur (retour de Damien). Même chose pour le cœur décoché dans
 * Mes favoris : le patch et le retrait de la liste partent d'un même geste.
 *
 * Le cache, lui, voit passer chaque version : le temps du survol, la rangée
 * écoute ses mises à jour et retient le `UserData` de ses cartes, dans toutes
 * les réponses qui portent des titres (celles que les bascules patchent).
 */

const mediaKey = (item: MediaItem) => item.Id;

/** Les réponses qui portent des titres avec leur `UserData` — celles que patchent les bascules. */
const ITEM_QUERY_PREFIXES = new Set<string>(["item", ...LIST_QUERY_PREFIXES]);

const NONE: ReadonlyMap<string, MediaItem> = new Map();

function visit(value: unknown, wanted: ReadonlySet<string>, found: Map<string, UserItemData>): void {
  if (!value || typeof value !== "object") return;
  const { Id, UserData } = value as Partial<MediaItem>;
  if (typeof Id === "string" && UserData && wanted.has(Id)) found.set(Id, UserData);
}

function visitList(list: unknown, wanted: ReadonlySet<string>, found: Map<string, UserItemData>): void {
  if (Array.isArray(list)) for (const value of list) visit(value, wanted, found);
}

/**
 * Pur : le `UserData` de chaque titre voulu que porte une réponse en cache —
 * une liste, une réponse `{ Items }`, des pages, ou une fiche seule.
 */
export function cachedUserData(data: unknown, wanted: ReadonlySet<string>): Map<string, UserItemData> {
  const found = new Map<string, UserItemData>();
  if (Array.isArray(data)) {
    visitList(data, wanted, found);
  } else if (data && typeof data === "object") {
    const { Items, pages } = data as { Items?: unknown; pages?: unknown };
    if (Array.isArray(pages)) {
      for (const page of pages) visitList(Array.isArray(page) ? page : (page as { Items?: unknown } | null)?.Items, wanted, found);
    } else if (Array.isArray(Items)) {
      visitList(Items, wanted, found);
    } else {
      visit(data, wanted, found);
    }
  }
  return found;
}

function sameUserData(current: UserItemData | undefined, next: UserItemData): boolean {
  if (!current) return false;
  return (Object.keys(next) as (keyof UserItemData)[]).every((key) => current[key] === next[key]);
}

/**
 * Pur : les versions retenues, mises à jour du `UserData` que le cache vient
 * de dire. `baseOf` : la carte telle que la rangée l'a rendue en dernier (sa
 * place, son image) — seul son état change. La même Map si rien ne change.
 */
export function mergeCachedUserData(
  previous: ReadonlyMap<string, MediaItem>,
  found: ReadonlyMap<string, UserItemData>,
  baseOf: (id: string) => MediaItem | undefined,
): ReadonlyMap<string, MediaItem> {
  let next: Map<string, MediaItem> | null = null;
  for (const [id, userData] of found) {
    const base = baseOf(id);
    if (!base) continue;
    if (sameUserData((previous.get(id) ?? base).UserData, userData)) continue;
    next ??= new Map(previous);
    next.set(id, { ...base, UserData: { ...base.UserData, ...userData } });
  }
  return next ?? previous;
}

/** Les cartes à rendre d'une rangée de titres Jellyfin, tenue (`held`) ou non. */
export function useHeldMediaRowItems(items: readonly MediaItem[], held: boolean): readonly MediaItem[] {
  const qc = useQueryClient();
  const frozen = useRowSnapshot(items, held);
  const lastSeen = useLastSeen(items, held, mediaKey);
  const [fresh, setFresh] = useState(NONE);
  // État dérivé, posé pendant le rendu (cf. `useRowSnapshot`) : au lâcher, plus rien de retenu.
  if (frozen === null && fresh !== NONE) setFresh(NONE);

  // Le temps du survol seulement : une rangée à la fois, quelques cartes.
  useEffect(() => {
    if (frozen === null) return;
    const photo = new Map(frozen.map((item) => [item.Id, item]));
    const wanted = new Set(photo.keys());
    const baseOf = (id: string) => lastSeen.get(id) ?? photo.get(id);
    return qc.getQueryCache().subscribe((event) => {
      if (event.type !== "updated" || event.action.type !== "success") return;
      const prefix = event.query.queryKey[0];
      if (typeof prefix !== "string" || !ITEM_QUERY_PREFIXES.has(prefix)) return;
      const found = cachedUserData(event.query.state.data, wanted);
      if (found.size > 0) setFresh((previous) => mergeCachedUserData(previous, found, baseOf));
    });
  }, [frozen, qc, lastSeen]);

  return useMemo(() => {
    // Une carte perdue : l'état que le cache a dit en dernier, sinon sa dernière version rendue.
    const lost = { get: (key: string) => fresh.get(key) ?? lastSeen.get(key) };
    return heldRowView(items, frozen, held, mediaKey, undefined, lost);
  }, [items, frozen, held, fresh, lastSeen]);
}
