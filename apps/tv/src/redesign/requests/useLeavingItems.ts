import { useEffect, useRef, useState } from "react";
import { isAdvancing } from "@tentacle-tv/tv-core";
import type { RequestItemModel } from "./requestTypes";

/**
 * Ce que la liste REND, sortie comprise : une demande disparue des données
 * reste à sa place le temps de partir, puis s'en va ; une demande apparue
 * après la première lecture est `fresh` (elle entre en fondu). Purement
 * visuel : les données, elles, ont déjà changé.
 *
 * Disparue en AVANÇANT (en route, ou en train d'entrer dans la bibliothèque),
 * elle est arrivée (`arrivedBetween`, tv-core) : elle reste d'abord
 * `arrivedMs` dans l'état « arrivée » — toute sa couleur, son camembert qui
 * s'efface, « Disponible » —, puis s'efface en `leavingMs`. Disparue d'« en
 * attente » ou de « bloquée » (refusée, retirée) : elle s'efface tout de suite,
 * sans fête.
 */

export interface RenderedItem {
  item: RequestItemModel;
  leaving: boolean;
  fresh: boolean;
}

interface Gone {
  item: RequestItemModel;
  /** Sa place d'avant. */
  at: number;
  phase: "arrived" | "leaving";
  /** La fin de la phase (ms). */
  until: number;
}

/** La demande, telle qu'elle se montre une fois arrivée. */
function asArrived(item: RequestItemModel): RequestItemModel {
  return { ...item, arrival: { ...item.arrival, state: "arrived", percent: null, etaSeconds: null }, stateLabel: item.arrivedLabel };
}

export function useLeavingItems(
  items: RequestItemModel[] | null,
  { leavingMs, arrivedMs }: { leavingMs: number; arrivedMs: number },
): RenderedItem[] {
  const [gone, setGone] = useState<Map<string, Gone>>(() => new Map());
  const previous = useRef<RequestItemModel[] | null>(null);
  const initial = useRef<Set<string> | null>(null);
  if (items && initial.current === null) initial.current = new Set(items.map((i) => i.key));

  useEffect(() => {
    const before = previous.current;
    previous.current = items;
    if (!before || !items) return;
    const now = new Set(items.map((i) => i.key));
    const left = before.filter((i) => !now.has(i.key));
    const t = Date.now();
    setGone((current) => {
      // Revenue dans les données : elle n'est plus partie.
      const next = new Map([...current].filter(([key]) => !now.has(key)));
      for (const item of left) {
        const at = before.indexOf(item);
        next.set(
          item.key,
          isAdvancing(item.arrival.state)
            ? { item: asArrived(item), at, phase: "arrived", until: t + arrivedMs }
            : { item, at, phase: "leaving", until: t + leavingMs },
        );
      }
      return next.size === current.size && left.length === 0 ? current : next;
    });
  }, [items, arrivedMs, leavingMs]);

  // Une phase finie : l'arrivée cède à la sortie, la sortie au départ.
  useEffect(() => {
    if (gone.size === 0) return undefined;
    const soonest = Math.min(...[...gone.values()].map((g) => g.until));
    const timer = setTimeout(() => {
      const t = Date.now();
      setGone((current) => {
        const next = new Map<string, Gone>();
        current.forEach((g, key) => {
          if (g.until > t) next.set(key, g);
          else if (g.phase === "arrived") next.set(key, { ...g, phase: "leaving", until: t + leavingMs });
        });
        return next;
      });
    }, Math.max(0, soonest - Date.now()));
    return () => clearTimeout(timer);
  }, [gone, leavingMs]);

  if (!items) return [];
  const out: RenderedItem[] = items.map((item) => ({ item, leaving: false, fresh: !initial.current?.has(item.key) }));
  // Chaque partante reprend sa place d'avant, au plus près.
  [...gone.values()]
    .sort((a, b) => a.at - b.at)
    .forEach(({ item, at, phase }) => out.splice(Math.min(at, out.length), 0, { item, leaving: phase === "leaving", fresh: false }));
  return out;
}
