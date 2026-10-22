/**
 * `useBackdropTone(element, enabled)` — le ton (`dark` | `light`) de ce qui
 * est sous la surface, pour la polarité de ses glyphes (`data-lg-tone`).
 *
 * Mesuré par la coquille (`liquidGlass.sample`, si elle l'offre) ; sinon, le
 * ton du thème. Un seul ordonnanceur pour toute la page (`backdropTone.ts`),
 * réveillé par : le montage, la taille, la FIN d'un défilement, le
 * redimensionnement, l'entrée du survol, le thème, et une minuterie lente
 * (le contenu change sous une surface immobile : le diaporama de l'accueil
 * sous la barre). Rien à chaque image ; rien quand la fenêtre est cachée.
 */

import { useEffect, useId, useState, useSyncExternalStore } from "react";

import { getScheme, subscribe as subscribeScheme } from "../colorScheme";
import { nativeGlassBridge } from "../liquidGlassMode";
import {
  createToneScheduler,
  type BackdropTone,
  type ToneSampler,
  type ToneScheduler,
} from "./backdropTone";

/** Défilement « fini » : aucun évènement depuis ce délai. */
const SCROLL_SETTLE_MS = 160;
/** Relecture lente, tant qu'une surface adaptative est à l'écran. */
const SLOW_REFRESH_MS = 2000;

/** L'échantillonneur de la coquille (`liquidGlass.sample`), s'il l'offre. */
function readSampler(): ToneSampler | null {
  const bridge = nativeGlassBridge();
  if (bridge === null || typeof bridge.sample !== "function") return null;
  return (rects) => bridge.sample?.(rects) ?? Promise.resolve([]);
}

let shared: ToneScheduler | null | undefined;

/** L'ordonnanceur de la page (surfaces ET bandes), ou `null` sans échantillonneur. */
export function sharedScheduler(): ToneScheduler | null {
  if (shared !== undefined) return shared;
  const sampler = typeof window === "undefined" ? null : readSampler();
  if (sampler === null) {
    shared = null;
    return null;
  }
  const scheduler = createToneScheduler({
    sampler,
    now: () => performance.now(),
    setTimer: (callback, ms) => window.setTimeout(callback, ms),
    clearTimer: (handle) => window.clearTimeout(handle as number),
  });
  let settle: number | undefined;
  const settled = (): void => {
    window.clearTimeout(settle);
    settle = window.setTimeout(() => scheduler.request(), SCROLL_SETTLE_MS);
  };
  document.addEventListener("scroll", settled, { capture: true, passive: true });
  window.addEventListener("resize", settled);
  subscribeScheme(() => scheduler.request());
  window.setInterval(() => {
    if (scheduler.size > 0 && document.visibilityState === "visible") scheduler.request();
  }, SLOW_REFRESH_MS);
  shared = scheduler;
  return scheduler;
}

/** Le ton par défaut : celui du thème (une page sombre a un dessous sombre). */
const themeTone = (): BackdropTone => (getScheme() === "light" ? "light" : "dark");

/**
 * `fallback` : le ton tant qu'aucune mesure n'est revenue — celui du thème par
 * défaut. Un verre posé sur la VIDÉO (le lecteur) n'a pas le thème dessous : il
 * part de `dark`.
 * `under: "window"` : mesurer la vidéo SEULE sous l'élément, la page exclue —
 * ses propres glyphes ne pèsent alors rien (`NativeGlassSampleRect`).
 */
export function useBackdropTone(
  element: HTMLElement | null,
  enabled: boolean,
  options: { fallback?: BackdropTone; under?: "window" } = {},
): BackdropTone {
  const scheme = useSyncExternalStore(subscribeScheme, getScheme, getScheme);
  const fallback: BackdropTone = options.fallback ?? (scheme === "light" ? "light" : "dark");
  const initial = options.fallback;
  const under = options.under;
  const [measured, setMeasured] = useState<BackdropTone | null>(null);
  const id = useId();

  useEffect(() => {
    const scheduler = enabled && element !== null ? sharedScheduler() : null;
    if (scheduler === null || element === null) {
      setMeasured(null);
      return undefined;
    }
    scheduler.watch(
      id,
      () => {
        const r = element.getBoundingClientRect();
        const visible = r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
        if (!visible) return null;
        return under === undefined
          ? { x: r.x, y: r.y, width: r.width, height: r.height }
          : { x: r.x, y: r.y, width: r.width, height: r.height, under };
      },
      initial ?? themeTone(),
      setMeasured,
    );
    const resize = new ResizeObserver(() => scheduler.request());
    resize.observe(element);
    const hover = (): void => scheduler.request();
    element.addEventListener("pointerenter", hover);
    return () => {
      scheduler.unwatch(id);
      resize.disconnect();
      element.removeEventListener("pointerenter", hover);
    };
  }, [element, enabled, id, initial, under]);

  return measured ?? fallback;
}

/** La page sait-elle mesurer ce qui est sous le verre ? (labo, bancs) */
export function backdropToneMeasured(): boolean {
  return sharedScheduler() !== null;
}
