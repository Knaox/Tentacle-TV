import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { initialRelease, nextRelease, type StagedRow } from "@tentacle-tv/tv-core";
import { RENDER } from "../render/renderProfile";

/**
 * Le montage ÉCHELONNÉ des rangées d'une page (tv-core `render/rowStaging`),
 * là où le profil de rendu le demande (`stagedRows` : Android TV). La page
 * pose `RowStageProvider` ; chaque rangée dit sa place (`useStagedCount`) et
 * ne rend que les cartes libérées : l'écran d'emblée, puis une part par image
 * — ce qui n'est pas encore à l'écran se monte sans retenir ce qui l'est.
 *
 * Sans le profil (Apple TV), ou sans fournisseur : tout, tout de suite.
 */

interface Entry extends StagedRow {
  set: (released: number) => void;
}

interface RowStager {
  register(rank: number, total: number, released: number, set: (released: number) => void): () => void;
}

function createRowStager(): RowStager & { dispose(): void } {
  const entries = new Set<Entry>();
  let frame: number | null = null;
  const pump = () => {
    frame = null;
    const next = nextRelease([...entries]);
    if (!next) return;
    for (const entry of entries) {
      if (entry.rank !== next.rank || entry.released >= entry.total) continue;
      entry.released = next.released;
      entry.set(next.released);
      break;
    }
    frame = requestAnimationFrame(pump);
  };
  return {
    register(rank, total, released, set) {
      const entry: Entry = { rank, total, released, set };
      entries.add(entry);
      if (frame === null) frame = requestAnimationFrame(pump);
      return () => {
        entries.delete(entry);
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
 * Combien de ses `total` cartes une rangée rend : celles que l'échelonnement
 * a libérées (`rank` : sa place dans la page, de haut en bas). Une rangée sans
 * place, ou hors d'une page échelonnée : toutes. Ce qui est libéré le reste
 * (des cartes de plus arrivent avec les données, jamais de moins).
 */
export function useStagedCount(rank: number | undefined, total: number): number {
  const stager = useContext(RowStageContext);
  const staged = stager !== null && rank !== undefined;
  const [released, setReleased] = useState(0);
  // Ce qui est à l'écran ne s'échelonne jamais : une rangée de tête dont les
  // données arrivent après la page montre sa tête tout de suite.
  const shown = staged ? Math.min(total, Math.max(released, initialRelease(rank, total))) : total;
  const current = useRef(shown);
  current.current = shown;
  useLayoutEffect(() => {
    if (!stager || rank === undefined) return undefined;
    return stager.register(rank, total, current.current, setReleased);
  }, [stager, rank, total]);
  return shown;
}
