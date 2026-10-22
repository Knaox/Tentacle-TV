/**
 * `useSurfaceTone(element, enabled)` — le ton TENU d'une grande surface
 * (régime `surface`, lot lg2) : mesuré une fois à l'ouverture sur la couronne
 * autour d'elle (`surfaceTone.ts`), puis plus jamais relu — ni au défilement,
 * ni au survol, ni par la minuterie lente. Une nouvelle ouverture (nouvel
 * élément) mesure de nouveau.
 *
 * Avant la mesure, et sans échantillonneur : le ton du thème. Sous « Réduire
 * la transparence » ou « Contraste accru », le verre devient un aplat du
 * thème (`physics.css`) : le ton est celui du thème, sans mesure.
 */

import { useEffect, useId, useState, useSyncExternalStore } from "react";

import { getScheme, subscribe as subscribeScheme } from "../colorScheme";
import { getGlassAccessibility } from "./accessibility";
import type { BackdropTone } from "./backdropTone";
import { heldSurfaceTone, PROBE_SIDES, surfaceProbeRect, surfaceToneMeasured } from "./surfaceTone";
import { sharedScheduler } from "./useBackdropTone";

/** Sans réponse de la coquille passé ce délai : le ton du thème reste. */
const GIVE_UP_MS = 1500;

export function useSurfaceTone(element: HTMLElement | null, enabled: boolean): BackdropTone {
  const scheme = useSyncExternalStore(subscribeScheme, getScheme, getScheme);
  const themeTone: BackdropTone = scheme === "light" ? "light" : "dark";
  const [held, setHeld] = useState<BackdropTone | null>(null);
  const id = useId();

  useEffect(() => {
    setHeld(null);
    if (!enabled || element === null || !surfaceToneMeasured(getGlassAccessibility().material)) return undefined;
    const scheduler = sharedScheduler();
    if (scheduler === null) return undefined;

    const assumed: BackdropTone = getScheme() === "light" ? "light" : "dark";
    const ids = PROBE_SIDES.map((side) => `${id}:${side}`);
    const luminances: number[] = [];
    let settle: number | undefined;
    let done = false;
    const finish = (): void => {
      if (done) return;
      done = true;
      for (const probe of ids) scheduler.unwatch(probe);
      window.clearTimeout(giveUp);
      if (luminances.length > 0) setHeld(heldSurfaceTone(assumed, luminances));
    };
    // Tout le lot de la couronne revient d'un coup : on conclut juste après.
    const collect = (value: number): void => {
      luminances.push(value);
      window.clearTimeout(settle);
      settle = window.setTimeout(finish, 0);
    };
    PROBE_SIDES.forEach((side, index) => {
      scheduler.observe(
        ids[index]!,
        () => surfaceProbeRect(element.getBoundingClientRect(), side, { width: innerWidth, height: innerHeight }),
        collect,
      );
    });
    const giveUp = window.setTimeout(finish, GIVE_UP_MS);
    return () => {
      done = true;
      window.clearTimeout(settle);
      window.clearTimeout(giveUp);
      for (const probe of ids) scheduler.unwatch(probe);
    };
  }, [element, enabled, id]);

  return held ?? themeTone;
}
