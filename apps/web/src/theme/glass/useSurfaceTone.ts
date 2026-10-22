/**
 * `useSurfaceTone(element, enabled)` — le ton TENU d'une grande surface
 * (régime `surface`, lot lg2) : mesuré à l'ouverture sur la couronne autour
 * d'elle (`surfaceTone.ts`, `surfaceToneProbe.ts`), puis TENU — ni au
 * défilement, ni au survol, ni par la minuterie lente. Remesuré seulement si
 * le thème ou le matériau du système change sous la surface ouverte
 * (`surfaceToneEpoch`) ; une nouvelle ouverture (nouvel élément) mesure de
 * nouveau.
 *
 * Avant la mesure, et sans échantillonneur : le ton du thème. Sous « Réduire
 * la transparence » ou « Contraste accru », le verre devient un aplat du
 * thème (`physics.css`) : le ton est celui du thème, sans mesure.
 */

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";

import { getScheme, subscribe as subscribeScheme } from "../colorScheme";
import { getGlassAccessibility, subscribeGlassAccessibility, type GlassMaterial } from "./accessibility";
import type { BackdropTone } from "./backdropTone";
import { surfaceProbeRect, surfaceToneMeasured } from "./surfaceTone";
import { SURFACE_TONE_REMEASURE_DELAY_MS, startSurfaceToneProbe, surfaceToneEpoch } from "./surfaceToneProbe";
import { sharedScheduler } from "./useBackdropTone";

const getMaterial = (): GlassMaterial => getGlassAccessibility().material;

export function useSurfaceTone(element: HTMLElement | null, enabled: boolean): BackdropTone {
  const scheme = useSyncExternalStore(subscribeScheme, getScheme, getScheme);
  const material = useSyncExternalStore(subscribeGlassAccessibility, getMaterial, getMaterial);
  const themeTone: BackdropTone = scheme === "light" ? "light" : "dark";
  const [held, setHeld] = useState<BackdropTone | null>(null);
  const id = useId();
  /** L'élément déjà mesuré : la même surface, remesurée, attend que la page se repeigne. */
  const measured = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // Le ton d'avant n'a plus cours : celui du thème, jusqu'à la mesure.
    setHeld(null);
    if (!enabled || element === null || !surfaceToneMeasured(material)) return undefined;
    const scheduler = sharedScheduler();
    if (scheduler === null) return undefined;
    const delay = measured.current === element ? SURFACE_TONE_REMEASURE_DELAY_MS : 0;
    measured.current = element;
    return startSurfaceToneProbe(
      `${id}:${surfaceToneEpoch(scheme, material)}`,
      scheme === "light" ? "light" : "dark",
      {
        scheduler,
        rectOf: (side) => surfaceProbeRect(element.getBoundingClientRect(), side, { width: innerWidth, height: innerHeight }),
        setTimer: (callback, ms) => window.setTimeout(callback, ms),
        clearTimer: (handle) => window.clearTimeout(handle as number),
      },
      setHeld,
      delay,
    );
  }, [element, enabled, id, scheme, material]);

  return held ?? themeTone;
}
