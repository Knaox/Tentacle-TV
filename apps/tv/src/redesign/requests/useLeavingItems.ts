import { useEffect, useRef, useState } from "react";
import type { RequestItemModel } from "./requestTypes";

/**
 * Ce que la liste RAND, sortie comprise : une demande disparue des données
 * (arrivée, donc plus en cours) reste à sa place `leavingMs`, le temps de
 * s'effacer, puis s'en va ; une demande apparue après la première lecture est
 * `fresh` (elle entre en fondu). Purement visuel : les données, elles, ont
 * déjà changé.
 */

export interface RenderedItem {
  item: RequestItemModel;
  leaving: boolean;
  fresh: boolean;
}

export function useLeavingItems(items: RequestItemModel[] | null, leavingMs: number): RenderedItem[] {
  const [leaving, setLeaving] = useState<Map<string, { item: RequestItemModel; at: number }>>(() => new Map());
  const previous = useRef<RequestItemModel[] | null>(null);
  const initial = useRef<Set<string> | null>(null);
  if (items && initial.current === null) initial.current = new Set(items.map((i) => i.key));

  useEffect(() => {
    const before = previous.current;
    previous.current = items;
    if (!before || !items) return;
    const now = new Set(items.map((i) => i.key));
    const gone = before.filter((i) => !now.has(i.key));
    setLeaving((current) => {
      const next = new Map([...current].filter(([key]) => !now.has(key)));
      gone.forEach((item) => next.set(item.key, { item, at: before.indexOf(item) }));
      return next.size === current.size && gone.length === 0 ? current : next;
    });
  }, [items]);

  useEffect(() => {
    if (leaving.size === 0) return undefined;
    const timer = setTimeout(() => setLeaving(new Map()), leavingMs);
    return () => clearTimeout(timer);
  }, [leaving, leavingMs]);

  if (!items) return [];
  const out: RenderedItem[] = items.map((item) => ({ item, leaving: false, fresh: !initial.current?.has(item.key) }));
  // Chaque sortante reprend sa place d'avant, au plus près.
  [...leaving.values()]
    .sort((a, b) => a.at - b.at)
    .forEach(({ item, at }) => out.splice(Math.min(at, out.length), 0, { item, leaving: true, fresh: false }));
  return out;
}
