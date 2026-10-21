/**
 * Le branchement réel de l'ordonnanceur des régions : images du navigateur,
 * mesure du DOM, pont de la coquille, observateurs du document.
 *
 * UN ordonnanceur par page, créé à la première région et seulement si le pont
 * du verre natif existe (`liquidGlassMode.ts`). Les observateurs ne sont posés
 * que tant qu'une région est inscrite : sans verre natif à l'écran, rien
 * n'écoute rien.
 */

import { nativeGlassBridge } from "../liquidGlassMode";
import { measureRegion, readRegionStyle } from "./regionGeometry";
import { createRegionScheduler, type RegionScheduler, type RegionWatch } from "./regionScheduler";

/** Évènements qui annoncent un mouvement sans changer de taille. */
const MOTION_EVENTS = ["transitionrun", "transitionend", "animationstart", "animationend"] as const;

/**
 * Les observateurs du document. Une mutation réveille la boucle (un parent
 * qui se décale, framer-motion qui écrit `transform`) ; le thème qui bascule
 * fait en plus relire rayons et teintes.
 */
function createDocumentWatch(heat: (restyle?: boolean) => void): RegionWatch {
  let resize: ResizeObserver | null = null;
  let mutations: MutationObserver | null = null;
  const onScroll = (): void => heat();
  const onMotion = (): void => heat();
  const onViewport = (): void => heat(true);

  return {
    start() {
      resize = new ResizeObserver(() => heat(true));
      mutations = new MutationObserver((records) => {
        const root = document.documentElement;
        const themed = records.some(
          (record) => record.target === root && record.attributeName === "data-theme",
        );
        heat(themed);
      });
      mutations.observe(document.documentElement, {
        subtree: true,
        childList: true,
        attributes: true,
      });
      window.addEventListener("resize", onViewport);
      document.addEventListener("scroll", onScroll, { capture: true, passive: true });
      for (const type of MOTION_EVENTS) document.addEventListener(type, onMotion, true);
    },
    stop() {
      resize?.disconnect();
      mutations?.disconnect();
      resize = null;
      mutations = null;
      window.removeEventListener("resize", onViewport);
      document.removeEventListener("scroll", onScroll, { capture: true });
      for (const type of MOTION_EVENTS) document.removeEventListener(type, onMotion, true);
    },
    observe(element) {
      resize?.observe(element);
    },
    unobserve(element) {
      resize?.unobserve(element);
    },
  };
}

let shared: RegionScheduler | null = null;

/** L'ordonnanceur de la page, ou `null` sans verre natif. */
export function sharedRegionScheduler(): RegionScheduler | null {
  if (shared !== null) return shared;
  const bridge = nativeGlassBridge();
  if (bridge === null || typeof window === "undefined") return null;

  let scheduler: RegionScheduler | null = null;
  const watch = createDocumentWatch((restyle) => scheduler?.heat(restyle));
  scheduler = createRegionScheduler({
    bridge,
    requestFrame: (callback) => window.requestAnimationFrame(callback),
    cancelFrame: (handle) => window.cancelAnimationFrame(handle),
    // La vue web entière : les barres de défilement de macOS se superposent.
    viewport: () => ({ width: window.innerWidth, height: window.innerHeight }),
    readStyle: readRegionStyle,
    measure: measureRegion,
    watch,
  });
  // La page s'en va (rechargement, navigation) : la coquille ne doit garder
  // aucun verre sans page dessus.
  window.addEventListener("pagehide", () => scheduler?.clear());
  shared = scheduler;
  return shared;
}
