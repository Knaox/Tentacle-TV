import { useCallback, useEffect, useState } from "react";
import type { DebugAction, DebugStatus } from "./debugActionTypes";

/** Rythme de relève des états : assez vif pour suivre une bascule, assez lent pour ne rien coûter. */
const STATUS_REFRESH_MS = 700;

/**
 * L'état de chaque action (allumée, sa valeur, ou pourquoi elle ne peut pas agir), relevé tant
 * que `active` — l'onglet des actions à l'écran. Une action dont le relevé lève est dite
 * indisponible : le menu ne se tait jamais sur ce qu'il n'a pas pu lire.
 */
export function useDebugStatuses(actions: readonly DebugAction[], active: boolean): { statuses: ReadonlyMap<string, DebugStatus>; refresh: () => void } {
  const [statuses, setStatuses] = useState<ReadonlyMap<string, DebugStatus>>(() => new Map());

  const refresh = useCallback(() => {
    void Promise.all(actions.map(async (action): Promise<[string, DebugStatus]> => {
      if (!action.status) return [action.id, {}];
      try {
        return [action.id, await action.status()];
      } catch (error) {
        return [action.id, { unavailable: `état illisible : ${error instanceof Error ? error.message : String(error)}` }];
      }
    })).then((entries) => setStatuses(new Map(entries)));
  }, [actions]);

  useEffect(() => {
    if (!active) return undefined;
    refresh();
    const timer = setInterval(refresh, STATUS_REFRESH_MS);
    return () => clearInterval(timer);
  }, [active, refresh]);

  return { statuses, refresh };
}
