import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { MY_TITLES_KEY, myTitlesQueryKey } from "@tentacle-tv/api-client";
import type { MyTitle } from "@tentacle-tv/shared";
import { MY_TITLES_REFRESH, arrivedBetween } from "@tentacle-tv/tv-core";
import type { VigieGate } from "./useVigieGate";

/**
 * Les demandes EN DIRECT (Apple TV) — la fraîcheur de Vigie sur le téléphone
 * et le bureau, sans rien de plus :
 *
 * - LE BATTEMENT (`useLiveRefresh`) : une vue qui montre des demandes — la
 *   fenêtre, l'aperçu du rail, des cartes à l'écran — s'inscrit tant qu'elle
 *   est visible, l'app au premier plan, ET qu'un de SES titres avance. Tant
 *   qu'une vue est inscrite, la liste partagée (`myTitlesQueryKey`) se relit
 *   dès qu'elle a 10 s (`MY_TITLES_REFRESH.liveMs`) — un seul battement pour
 *   tout l'appareil, quel que soit le nombre de vues : jamais deux lectures
 *   pour la même liste. Personne d'inscrit : aucun minuteur.
 * - LES ARRIVÉES (`useArrivals`) : un titre qui sort de la liste en avançant
 *   est arrivé (`arrivedBetween`, tv-core) ; on s'en souvient le temps de la
 *   session (`ARRIVALS_KEEP_MS`) — une carte encore à l'écran dit alors
 *   « Disponible », en pleine couleur, au lieu de retomber dans le gris.
 */

/** Le battement regarde si la liste est due à ce rythme (sans rien lire tant qu'elle ne l'est pas). */
const CHECK_MS = 2000;
/** Ce qu'on se souvient d'une arrivée. */
const ARRIVALS_KEEP_MS = 30 * 60_000;

interface Beat {
  count: number;
  timer: ReturnType<typeof setInterval>;
}

const beats = new Map<string, Beat>();

function enlist(qc: QueryClient, key: readonly unknown[]): () => void {
  const id = JSON.stringify(key);
  let beat = beats.get(id);
  if (!beat) {
    const timer = setInterval(() => {
      const state = qc.getQueryState(key);
      if (!state || state.fetchStatus === "fetching") return;
      if (Date.now() - state.dataUpdatedAt < MY_TITLES_REFRESH.liveMs - CHECK_MS / 2) return;
      // Sans annuler une lecture en cours : une seule à la fois.
      void qc.refetchQueries({ queryKey: key, exact: true }, { cancelRefetch: false });
    }, CHECK_MS);
    beat = { count: 0, timer };
    beats.set(id, beat);
  }
  beat.count += 1;
  return () => {
    const current = beats.get(id);
    if (!current) return;
    current.count -= 1;
    if (current.count > 0) return;
    clearInterval(current.timer);
    beats.delete(id);
  };
}

/** Le direct pour une vue qui MONTRE des demandes : `on` — visible, app au premier plan, un de ses titres avance. */
export function useLiveRefresh(gate: VigieGate | null, on: boolean): void {
  const qc = useQueryClient();
  const provider = gate?.provider ?? null;
  const lang = gate?.lang ?? "fr";
  useEffect(() => {
    if (!on || !provider) return undefined;
    return enlist(qc, myTitlesQueryKey(provider, lang));
  }, [on, qc, provider, lang]);
}

export interface Arrival {
  /** Le titre tel qu'il était à sa dernière lecture. */
  title: MyTitle;
  /** Quand l'appareil a vu qu'il était arrivé (ms). */
  at: number;
}

interface ArrivalStore {
  arrivals: ReadonlyMap<string, Arrival>;
  listeners: Set<() => void>;
}

const stores = new WeakMap<QueryClient, ArrivalStore>();

/* Une seule écoute du cache par client : chaque nouvelle liste se compare à la précédente. */
function arrivalStore(qc: QueryClient): ArrivalStore {
  const known = stores.get(qc);
  if (known) return known;
  const store: ArrivalStore = { arrivals: new Map(), listeners: new Set() };
  // Les listes déjà lues servent de point de départ : la première arrivée n'échappe pas.
  const last = new Map<string, MyTitle[]>();
  for (const query of qc.getQueryCache().findAll({ queryKey: [MY_TITLES_KEY] })) {
    const data = query.state.data as MyTitle[] | undefined;
    if (data) last.set(query.queryHash, data);
  }
  const publish = (next: Map<string, Arrival>) => {
    store.arrivals = next;
    store.listeners.forEach((listener) => listener());
  };
  qc.getQueryCache().subscribe((event) => {
    const query = event.query;
    if (query.queryKey[0] !== MY_TITLES_KEY) return;
    // Le cache vidé (déjumelage) : rien d'un compte ne survit chez le suivant.
    if (event.type === "removed") {
      last.delete(query.queryHash);
      if (store.arrivals.size > 0) publish(new Map());
      return;
    }
    if (event.type !== "updated") return;
    const data = query.state.data as MyTitle[] | undefined;
    const before = last.get(query.queryHash);
    if (!data || data === before) return;
    last.set(query.queryHash, data);
    const now = Date.now();
    const next = new Map(store.arrivals);
    for (const title of arrivedBetween(before, data)) next.set(title.key, { title, at: now });
    // Redemandé, il n'est plus arrivé ; et une arrivée ancienne s'oublie.
    for (const title of data) next.delete(title.key);
    for (const [key, arrival] of next) if (now - arrival.at > ARRIVALS_KEEP_MS) next.delete(key);
    const same = next.size === store.arrivals.size && [...next.keys()].every((key) => store.arrivals.get(key) === next.get(key));
    if (!same) publish(next);
  });
  stores.set(qc, store);
  return store;
}

/** Les titres arrivés pendant la session, par clé. */
export function useArrivals(): ReadonlyMap<string, Arrival> {
  const store = arrivalStore(useQueryClient());
  return useSyncExternalStore(
    (listener) => {
      store.listeners.add(listener);
      return () => store.listeners.delete(listener);
    },
    () => store.arrivals,
  );
}

/**
 * Les titres arrivés il y a moins de `holdMs` : l'aperçu du rail les garde
 * devant le temps de leur arrivée (pleine couleur, le camembert qui s'efface),
 * puis les laisse partir — un minuteur, seulement tant qu'il y en a un.
 */
export function useJustArrived(holdMs: number): MyTitle[] {
  const arrivals = useArrivals();
  const [now, setNow] = useState(Date.now);
  const fresh = useMemo(() => [...arrivals.values()].filter((arrival) => now - arrival.at < holdMs), [arrivals, now, holdMs]);
  const soonest = fresh.length > 0 ? Math.min(...fresh.map((arrival) => arrival.at + holdMs)) : null;
  useEffect(() => {
    if (soonest === null) return undefined;
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, soonest - Date.now()) + 16);
    return () => clearTimeout(timer);
  }, [soonest]);
  return useMemo(() => fresh.map((arrival) => arrival.title), [fresh]);
}
