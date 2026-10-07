import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { createStagingPacer, initialRelease, nextRelease, renewedItems, type StagedRow } from "@tentacle-tv/tv-core";
import { RENDER } from "../render/renderProfile";

/**
 * Le montage ÉCHELONNÉ des rangées d'une page (tv-core `render/rowStaging`),
 * là où le profil de rendu le demande (`stagedRows` : Android TV). La page
 * pose `RowStageProvider` ; chaque rangée dit sa place (`useStagedRow`) et ne
 * rend que les cartes libérées : l'écran d'emblée, puis une part par image à
 * l'heure — ce qui n'est pas encore à l'écran se monte sans retenir ce qui
 * l'est ; la rangée qui prend le focus passe devant (`demand`).
 *
 * Sans le profil (Apple TV), ou sans fournisseur : tout, tout de suite.
 */

interface Entry extends StagedRow {
  set: (released: number) => void;
}

interface RowStager {
  /** Une rangée entre dans la page ; rend son entrée (la demander) et son départ. */
  register(rank: number, total: number, released: number, set: (released: number) => void): { demand(): void; leave(): void };
}

function createRowStager(): RowStager & { dispose(): void } {
  const entries = new Set<Entry>();
  const pacer = createStagingPacer();
  let frame: number | null = null;
  const schedule = () => {
    if (frame === null) frame = requestAnimationFrame(pump);
  };
  const pump = (now: number) => {
    frame = null;
    const next = nextRelease([...entries]);
    if (!next) return;
    if (pacer.frame(now)) {
      for (const entry of entries) {
        if (entry.rank !== next.rank || entry.released >= entry.total) continue;
        entry.released = next.released;
        entry.set(next.released);
        break;
      }
    }
    schedule();
  };
  return {
    register(rank, total, released, set) {
      const entry: Entry = { rank, total, released, set };
      entries.add(entry);
      schedule();
      return {
        demand() {
          if (entry.demanded) return;
          entry.demanded = true;
          schedule();
        },
        leave() {
          entries.delete(entry);
        },
      };
    },
    dispose() {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      entries.clear();
    },
  };
}

const RowStageContext = createContext<RowStager | null>(null);

/** L'échelonnement des rangées d'une page — rien là où le profil ne le demande pas. */
export function RowStageProvider({ children }: { children: ReactNode }) {
  const stager = useMemo(() => (RENDER.stagedRows ? createRowStager() : null), []);
  useEffect(() => () => stager?.dispose(), [stager]);
  return <RowStageContext.Provider value={stager}>{children}</RowStageContext.Provider>;
}

/**
 * Combien de ses `total` cartes une rangée rend (`shown`) : celles que
 * l'échelonnement a libérées (`rank` : sa place dans la page, de haut en bas).
 * Une rangée sans place, ou hors d'une page échelonnée : toutes. Ce qui est
 * libéré le reste (des cartes de plus arrivent avec les données, jamais de
 * moins). `demand` (stable) : la rangée a le focus — ce qui lui manque passe
 * devant ; sans effet hors d'une page échelonnée ou une fois tout monté.
 */
export function useStagedRow(rank: number | undefined, total: number): { shown: number; demand: () => void } {
  const stager = useContext(RowStageContext);
  const staged = stager !== null && rank !== undefined;
  const [released, setReleased] = useState(0);
  // Ce qui est à l'écran ne s'échelonne jamais : une rangée de tête dont les
  // données arrivent après la page montre sa tête tout de suite.
  const shown = staged ? Math.min(total, Math.max(released, initialRelease(rank, total))) : total;
  const current = useRef(shown);
  current.current = shown;
  const handle = useRef<{ demand(): void } | null>(null);
  const demanded = useRef(false);
  useLayoutEffect(() => {
    if (!stager || rank === undefined) return undefined;
    const registration = stager.register(rank, total, current.current, setReleased);
    handle.current = registration;
    // Une rangée qui revient (plus de cartes) garde sa demande.
    if (demanded.current) registration.demand();
    return () => {
      handle.current = null;
      registration.leave();
    };
  }, [stager, rank, total]);
  const demand = useCallback(() => {
    demanded.current = true;
    handle.current?.demand();
  }, []);
  return { shown, demand };
}

/**
 * Une rangée dont la liste change ENTIÈRE à chaque réponse (les résultats
 * d'une frappe), renouvelée par échelons (tv-core `renewedItems`) : à chaque
 * liste neuve, ce que l'échelonnement monte d'emblée à sa place (`rank`)
 * prend tout de suite le nouveau titre, le reste une part par image — et
 * garde en attendant la carte qu'il montrait (aucune vue démontée). `demand`
 * (stable) : la rangée a le focus, la suite passe devant. Hors d'une page
 * échelonnée (Apple TV) : la liste telle quelle.
 */
export function useRenewedRow<T>(rank: number | undefined, items: readonly T[]): { shown: readonly T[]; demand: () => void } {
  const stager = useContext(RowStageContext);
  const staged = stager !== null && rank !== undefined;
  const [, redraw] = useReducer((n: number) => n + 1, 0);
  // La liste en cours de renouvellement et sa part libérée : remises à zéro à
  // chaque liste neuve (identité — les listes inchangées gardent la leur).
  const generation = useRef<{ items: readonly T[] | null; released: number }>({ items: null, released: 0 });
  if (generation.current.items !== items) {
    generation.current = { items, released: staged ? initialRelease(rank, items.length) : items.length };
  }
  const previous = useRef<readonly T[]>([]);
  const shown = staged ? renewedItems(items, previous.current, generation.current.released) : items;
  useLayoutEffect(() => {
    previous.current = shown;
  });
  const handle = useRef<{ demand(): void } | null>(null);
  const demanded = useRef(false);
  useLayoutEffect(() => {
    const current = generation.current;
    if (!stager || rank === undefined || current.released >= items.length) return undefined;
    const registration = stager.register(rank, items.length, current.released, (released) => {
      if (generation.current !== current) return;
      current.released = released;
      redraw();
    });
    handle.current = registration;
    if (demanded.current) registration.demand();
    return () => {
      handle.current = null;
      registration.leave();
    };
  }, [stager, rank, items]);
  const demand = useCallback(() => {
    demanded.current = true;
    handle.current?.demand();
  }, []);
  return { shown, demand };
}
