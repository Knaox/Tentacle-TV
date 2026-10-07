import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { createStagingPacer, headRelease, initialRelease, nextRelease, renewedItems, ROW_STAGING, type StagedRow, type StagingTails } from "@tentacle-tv/tv-core";
import { mountProfile } from "../render/mountProfile";
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
 *
 * Le profil de MONTAGE (`mountProfile`, mode Lite) borne ce qui vit hors de
 * l'écran : les queues ne se montent qu'à la demande (`rowTails`), et une
 * rangée remise au début revient à sa tête (`retire`).
 */

interface Entry extends StagedRow {
  set: (released: number) => void;
}

interface RowRegistration {
  /** La rangée a le focus : ce qui lui manque passe devant. */
  demand(): void;
  /** La rangée est sortie de l'écran, remise au début : elle revient à sa tête. */
  retire(): void;
  leave(): void;
}

interface RowStager {
  /** Une rangée entre dans la page ; rend son entrée (la demander, la retirer) et son départ. */
  register(rank: number, total: number, head: number, released: number, set: (released: number) => void): RowRegistration;
}

function createRowStager(tails: StagingTails): RowStager & { dispose(): void } {
  const entries = new Set<Entry>();
  const pacer = createStagingPacer();
  let frame: number | null = null;
  const schedule = () => {
    if (frame === null) frame = requestAnimationFrame(pump);
  };
  const pump = (now: number) => {
    frame = null;
    const next = nextRelease([...entries], tails);
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
    register(rank, total, head, released, set) {
      const entry: Entry = { rank, total, head, released, set };
      entries.add(entry);
      schedule();
      return {
        demand() {
          if (entry.demanded) return;
          entry.demanded = true;
          schedule();
        },
        retire() {
          entry.demanded = false;
          const kept = headRelease(entry.total, entry.head);
          if (entry.released <= kept) return;
          entry.released = kept;
          entry.set(kept);
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

/** L'échelonnement des rangées d'une page — rien là où le profil ne le
 *  demande pas, ni quand la page ne le veut pas (`enabled`). */
export function RowStageProvider({ enabled = true, children }: { enabled?: boolean; children: ReactNode }) {
  const stager = useMemo(() => (RENDER.stagedRows && enabled ? createRowStager(mountProfile().rowTails) : null), [enabled]);
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
 * `head` : sa tête, quand elle n'est pas `ROW_STAGING.headCards` (mode Lite).
 * `retire` (stable) : la rangée, sortie de l'écran, est remise au début —
 * avec `retireOffscreenRows` (mode Lite), elle revient à sa tête.
 */
export function useStagedRow(
  rank: number | undefined,
  total: number,
  head: number = ROW_STAGING.headCards,
): { shown: number; demand: () => void; retire: () => void } {
  const stager = useContext(RowStageContext);
  const staged = stager !== null && rank !== undefined;
  const [released, setReleased] = useState(0);
  // Ce qui est à l'écran ne s'échelonne jamais : une rangée de tête dont les
  // données arrivent après la page montre sa tête tout de suite.
  const shown = staged ? Math.min(total, Math.max(released, initialRelease(rank, total, head))) : total;
  const current = useRef(shown);
  current.current = shown;
  const handle = useRef<RowRegistration | null>(null);
  const demanded = useRef(false);
  useLayoutEffect(() => {
    if (!stager || rank === undefined) return undefined;
    const registration = stager.register(rank, total, head, current.current, setReleased);
    handle.current = registration;
    // Une rangée qui revient (plus de cartes) garde sa demande.
    if (demanded.current) registration.demand();
    return () => {
      handle.current = null;
      registration.leave();
    };
  }, [stager, rank, total, head]);
  const demand = useCallback(() => {
    demanded.current = true;
    handle.current?.demand();
  }, []);
  const retire = useCallback(() => {
    if (!mountProfile().retireOffscreenRows) return;
    demanded.current = false;
    handle.current?.retire();
  }, []);
  return { shown, demand, retire };
}

/**
 * Une rangée dont la liste change ENTIÈRE à chaque réponse (les résultats
 * d'une frappe), renouvelée par échelons (tv-core `renewedItems`) : à chaque
 * liste neuve, ce que l'échelonnement monte d'emblée à sa place (`rank`, au
 * plus `head` cartes : ce que la piste montre) prend tout de suite le nouveau
 * titre, la tête des rangées suivantes une part par image ; la QUEUE (au-delà
 * de la tête, hors de l'écran) attend que la rangée soit parcourue (`demand`,
 * stable : le focus y entre) — une frappe ne pose que ce qui peut se voir.
 * En attendant, chaque place garde la carte qu'elle montrait (aucune vue
 * démontée). Hors d'une page échelonnée (Apple TV) : la liste telle quelle.
 */
export function useRenewedRow<T>(rank: number | undefined, items: readonly T[], head?: number): { shown: readonly T[]; demand: () => void } {
  const stager = useContext(RowStageContext);
  const staged = stager !== null && rank !== undefined;
  const [, redraw] = useReducer((n: number) => n + 1, 0);
  // La liste en cours de renouvellement, sa part libérée et sa demande :
  // remises à zéro à chaque liste neuve (identité — une liste inchangée garde
  // la sienne).
  const generation = useRef<{ items: readonly T[] | null; released: number; demanded: boolean }>({ items: null, released: 0, demanded: false });
  const previous = useRef<readonly T[]>([]);
  if (generation.current.items !== items) {
    // Une rangée qui ne montrait rien (les premiers résultats) se remplit par
    // parts dès la première image : ses cartes ne s'ajoutent pas au montage
    // de ce qui l'entoure (le meilleur résultat, la page qui change).
    const initial = !staged ? items.length : previous.current.length === 0 ? 0 : initialRelease(rank, items.length);
    generation.current = { items, released: staged && head !== undefined && initial > 0 ? Math.min(initial, head) : initial, demanded: false };
  }
  const current = generation.current;
  // Ce que l'échelonnement pose : la tête, puis tout une fois la rangée parcourue.
  const limit = current.demanded ? items.length : Math.min(items.length, head ?? ROW_STAGING.headCards);
  const shown = staged ? renewedItems(items, previous.current, current.released) : items;
  useLayoutEffect(() => {
    previous.current = shown;
  });
  useLayoutEffect(() => {
    if (!stager || rank === undefined || current.released >= limit) return undefined;
    // Sa tête est sa limite : ce que l'échelonnement pose de lui-même.
    const registration = stager.register(rank, limit, limit, current.released, (released) => {
      if (generation.current !== current) return;
      current.released = released;
      redraw();
    });
    if (current.demanded) registration.demand();
    return () => registration.leave();
  }, [stager, rank, current, limit]);
  const demand = useCallback(() => {
    const now = generation.current;
    if (now.demanded) return;
    now.demanded = true;
    redraw();
  }, []);
  return { shown, demand };
}
