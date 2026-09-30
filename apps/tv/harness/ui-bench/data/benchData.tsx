import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { MediaItem } from "@tentacle-tv/shared";
import { BENCH_ORIGIN } from "../control/benchRemote";
import { EMPTY_SNAPSHOT, type Snapshot, type SnapshotImageType } from "./snapshotFormat";

/**
 * Les données du banc : l'instantané servi par le relais, et de quoi y puiser.
 * Une scène s'en sert pour construire les props de sa vue ; aucune vue ne le
 * voit.
 */

export interface BenchData {
  snapshot: Snapshot;
  /** L'élément Jellyfin, tel que l'app le reçoit. */
  item: (id: string) => MediaItem | undefined;
  /** L'adresse de l'image, ou `undefined` si l'élément n'en a pas. */
  image: (id: string, type: SnapshotImageType) => string | undefined;
  /** Les éléments d'une liste de l'instantané, sans les absents. */
  list: (kind: keyof Snapshot["lists"], count?: number) => MediaItem[];
  /** Les éléments d'une liste d'identifiants quelconque. */
  items: (ids: string[] | undefined, count?: number) => MediaItem[];
}

export function createBenchData(snapshot: Snapshot): BenchData {
  const item = (id: string) => snapshot.items[id]?.item;
  const items = (ids: string[] | undefined, count?: number) =>
    (ids ?? []).map(item).filter((it): it is MediaItem => !!it).slice(0, count ?? Infinity);
  return {
    snapshot,
    item,
    image: (id, type) => {
      const file = snapshot.items[id]?.images[type];
      return file ? `${BENCH_ORIGIN}bench/snapshot/${file.split("/").map(encodeURIComponent).join("/")}` : undefined;
    },
    list: (kind, count) => items(snapshot.lists[kind], count),
    items,
  };
}

type LoadState = { status: "loading" } | { status: "ready"; data: BenchData } | { status: "missing"; data: BenchData };

const BenchDataContext = createContext<LoadState>({ status: "loading" });

/** Charge `snapshot/snapshot.json` une fois. Absent, le banc tourne quand même,
 *  sur un instantané vide : les scènes montrent alors leurs états vides. */
export function BenchDataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  useEffect(() => {
    let cancelled = false;
    fetch(`${BENCH_ORIGIN}bench/snapshot/snapshot.json`)
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        return (await res.json()) as Snapshot;
      })
      .then((snapshot) => !cancelled && setState({ status: "ready", data: createBenchData(snapshot) }))
      .catch(() => !cancelled && setState({ status: "missing", data: createBenchData(EMPTY_SNAPSHOT) }));
    return () => {
      cancelled = true;
    };
  }, []);
  return <BenchDataContext.Provider value={state}>{children}</BenchDataContext.Provider>;
}

export function useBenchLoad(): LoadState {
  return useContext(BenchDataContext);
}

/** Les données, une fois chargées (instantané vide s'il manque). */
export function useBenchData(): BenchData | null {
  const state = useBenchLoad();
  return useMemo(() => (state.status === "loading" ? null : state.data), [state]);
}
