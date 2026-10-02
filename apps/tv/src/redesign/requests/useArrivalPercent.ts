import { useEffect, useRef } from "react";
import { isProjectable, projectedPercent, steadyPercent } from "@tentacle-tv/tv-core";
import type { ArrivalModel } from "./arrivalTypes";
import { useLiveNow } from "./liveClock";

/**
 * L'avancement d'un titre en route À L'INSTANT — la règle de la barre de Vigie
 * (`liveProgress`, tv-core) : la dernière lecture, projetée d'une seconde à
 * l'autre sur le temps restant annoncé, plafonnée à 99,5 %, sans jamais
 * reculer sauf vraie chute. Ne bat que si la vue est visible (`live`), le
 * titre en route, et la lecture accompagnée d'un temps restant ; sinon, la
 * lecture telle quelle. `null` hors de la route, ou s'il ne se sait pas.
 *
 * Un seul appel par carte ou par ligne : le camembert et le pour cent écrit
 * disent ainsi la même chose à la même seconde.
 */
export function useArrivalPercent(arrival: ArrivalModel): number | null {
  const base = arrival.state === "arriving" ? arrival.percent : null;
  const moving = arrival.live && arrival.state === "arriving" && isProjectable(arrival);
  const now = useLiveNow(moving);
  const next = moving ? projectedPercent(arrival, now) : base;
  const shown = useRef<number | null>(null);
  const value = steadyPercent(shown.current, next, base);
  useEffect(() => {
    shown.current = value;
  }, [value]);
  return value;
}
