import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { MY_TITLES_KEY, myTitlesKeyOrigin, myTitlesQueryKey } from "@tentacle-tv/api-client";
import type { MyTitle, TitleOrigin } from "@tentacle-tv/shared";
import { MY_TITLES_REFRESH, nextArrivals, unionArrivals, type Arrival as ArrivalOf } from "@tentacle-tv/tv-core";
import type { VigieGate } from "./useVigieGate";

/**
 * Les demandes EN DIRECT (Apple TV) — la fraîcheur de Vigie sur le téléphone
 * et le bureau, sans rien de plus. Deux listes : celle du COMPTE (l'état des
 * cartes : toutes ses demandes) et celle des TV (« Mes demandes » : les
 * demandes faites depuis une TV, `origin`).
 *
 * - LE BATTEMENT (`useLiveRefresh`) : une vue qui montre des demandes — la
 *   fenêtre, l'aperçu du rail, des cartes à l'écran — s'inscrit tant qu'elle
 *   est visible, l'app au premier plan, ET qu'un de SES titres avance. Tant
 *   qu'une vue est inscrite, SA liste (`myTitlesQueryKey`) se relit dès
 *   qu'elle a 10 s (`MY_TITLES_REFRESH.liveMs`) — un seul battement par liste
 *   pour tout l'appareil, quel que soit le nombre de vues : jamais deux
 *   lectures pour la même liste. Personne d'inscrit : aucun minuteur.
 * - LES ARRIVÉES (`useArrivals`) : un titre qui sort d'une liste en avançant
 *   est arrivé ; on s'en souvient le temps de la session (`ARRIVALS_KEEP_MS`)
 *   — une carte encore à l'écran dit alors « Disponible », en pleine couleur,
 *   au lieu de retomber dans le gris. Chaque liste tient SES arrivées
 *   (`nextArrivals`, tv-core) : deux listes lues à des instants différents ne
 *   se contredisent pas, « Mes demandes » ne montre que les siennes
 *   (`useJustArrived`), et les cartes lisent leur union (`unionArrivals`).
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

/**
 * Le direct pour une vue qui MONTRE des demandes : `on` — visible, app au
 * premier plan, un de ses titres avance. `origin` : la liste qu'elle montre
 * (« tv » : « Mes demandes ») ; sans elle, celle du compte (les cartes).
 */
export function useLiveRefresh(gate: VigieGate | null, on: boolean, origin: TitleOrigin | null = null): void {
  const qc = useQueryClient();
  const provider = gate?.provider ?? null;
  const lang = gate?.lang ?? "fr";
  useEffect(() => {
    if (!on || !provider) return undefined;
    return enlist(qc, myTitlesQueryKey(provider, lang, origin));
  }, [on, qc, provider, lang, origin]);
}

/** Un titre arrivé : tel qu'il était à sa dernière lecture, et quand l'appareil l'a vu arriver. */
export type Arrival = ArrivalOf<MyTitle>;
type Arrivals = ReadonlyMap<string, Arrival>;

/** Une liste : celle du compte (`ACCOUNT`), ou celle d'une origine (« tv »). */
type Scope = TitleOrigin | typeof ACCOUNT;
const ACCOUNT = "account";
const NONE: Arrivals = new Map();

interface ArrivalStore {
  /** Les arrivées de CHAQUE liste lue (par `queryHash`), et l'origine de la liste. */
  lists: Map<string, { scope: Scope; arrivals: Arrivals }>;
  /** Leur union : un titre est arrivé dès qu'il est sorti d'une liste. */
  arrivals: Arrivals;
  /** L'union par origine (« Mes demandes » ne lit que la sienne). */
  byScope: ReadonlyMap<Scope, Arrivals>;
  listeners: Set<() => void>;
}

const stores = new WeakMap<QueryClient, ArrivalStore>();

/* Les unions, refaites à chaque changement : celle de toutes les listes, et celle de chaque origine. */
function publish(store: ArrivalStore): void {
  const lists = [...store.lists.values()];
  const scopes = new Set(lists.map((list) => list.scope));
  store.arrivals = unionArrivals(lists.map((list) => list.arrivals));
  store.byScope = new Map(
    [...scopes].map((scope) => [scope, unionArrivals(lists.filter((list) => list.scope === scope).map((list) => list.arrivals))]),
  );
  store.listeners.forEach((listener) => listener());
}

/* Une seule écoute du cache par client : chaque nouvelle lecture d'une liste se compare à la précédente. */
function arrivalStore(qc: QueryClient): ArrivalStore {
  const known = stores.get(qc);
  if (known) return known;
  const store: ArrivalStore = { lists: new Map(), arrivals: NONE, byScope: new Map(), listeners: new Set() };
  // Les listes déjà lues servent de point de départ : la première arrivée n'échappe pas.
  const last = new Map<string, MyTitle[]>();
  for (const query of qc.getQueryCache().findAll({ queryKey: [MY_TITLES_KEY] })) {
    const data = query.state.data as MyTitle[] | undefined;
    if (data) last.set(query.queryHash, data);
  }
  qc.getQueryCache().subscribe((event) => {
    const query = event.query;
    if (query.queryKey[0] !== MY_TITLES_KEY) return;
    // Une liste retirée du cache (déjumelage : toutes) n'atteste plus rien — rien d'un compte ne survit chez le suivant.
    if (event.type === "removed") {
      last.delete(query.queryHash);
      if (store.lists.delete(query.queryHash)) publish(store);
      return;
    }
    if (event.type !== "updated") return;
    const data = query.state.data as MyTitle[] | undefined;
    const before = last.get(query.queryHash);
    if (!data || data === before) return;
    last.set(query.queryHash, data);
    // Redemandé — de nouveau dans CETTE liste —, il n'en est plus arrivé ; une arrivée ancienne s'oublie.
    const prev = store.lists.get(query.queryHash)?.arrivals ?? NONE;
    const next = nextArrivals(prev, before, data, Date.now(), ARRIVALS_KEEP_MS);
    if (next === prev) return;
    store.lists.set(query.queryHash, { scope: myTitlesKeyOrigin(query.queryKey) ?? ACCOUNT, arrivals: next });
    publish(store);
  });
  stores.set(qc, store);
  return store;
}

function useArrivalStore<T>(read: (store: ArrivalStore) => T): T {
  const store = arrivalStore(useQueryClient());
  return useSyncExternalStore(
    (listener) => {
      store.listeners.add(listener);
      return () => store.listeners.delete(listener);
    },
    () => read(store),
  );
}

/** Les titres arrivés pendant la session, par clé — sortis de l'une ou l'autre liste. */
export function useArrivals(): Arrivals {
  return useArrivalStore((store) => store.arrivals);
}

/**
 * Les titres arrivés il y a moins de `holdMs` : l'aperçu du rail les garde
 * devant le temps de leur arrivée (pleine couleur, le camembert qui s'efface),
 * puis les laisse partir — un minuteur, seulement tant qu'il y en a un.
 * `origin` : sortis de cette liste seulement (« tv » : « Mes demandes ») ;
 * sans elle, de la liste du compte.
 */
export function useJustArrived(holdMs: number, origin: TitleOrigin | null = null): MyTitle[] {
  const scope: Scope = origin ?? ACCOUNT;
  const arrivals = useArrivalStore((store) => store.byScope.get(scope) ?? NONE);
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
