/**
 * L'ordonnanceur des régions de verre natif : il garde la coquille au courant
 * de ce que la page montre, au plus UNE fois par image.
 *
 * Ce qui le réveille (`heat`) : une taille qui change, un défilement, une
 * transition ou une animation qui démarre, une mutation du DOM (framer-motion
 * écrit ses transformations dans `style`), le thème qui bascule. Réveillé, il
 * mesure toutes les régions à chaque image, n'envoie que ce qui a CHANGÉ — un
 * `upsert` et un `remove` au plus —, et se rendort après quelques images sans
 * changement. Au repos, aucune image demandée, aucun message : ce qui ne bouge
 * pas ne coûte rien (CLAUDE.md, « Coût GPU »).
 *
 * Indépendant du DOM par ses dépendances (images, mesure, pont, observateurs),
 * donc testé hors navigateur. Le branchement réel vit dans `regionRuntime.ts`.
 */

import type { LiquidGlassBridge, NativeGlassRegion } from "../../desktop/types";
import { sameRegion, type RegionSpec, type RegionStyle, type Viewport } from "./regionGeometry";

/** Les observateurs du document, posés tant qu'au moins une région existe. */
export interface RegionWatch {
  start(): void;
  stop(): void;
  observe(element: Element): void;
  unobserve(element: Element): void;
}

export interface RegionSchedulerDeps {
  bridge: Pick<LiquidGlassBridge, "upsert" | "remove">;
  requestFrame(callback: () => void): number;
  cancelFrame(handle: number): void;
  viewport(): Viewport;
  readStyle(element: Element, spec: RegionSpec): RegionStyle;
  measure(
    id: string,
    element: Element,
    spec: RegionSpec,
    style: RegionStyle,
    viewport: Viewport,
  ): NativeGlassRegion | null;
  watch: RegionWatch;
  /** Images sans changement avant de se rendormir. */
  idleFrames?: number;
}

export interface RegionScheduler {
  register(id: string, element: Element, spec: RegionSpec): void;
  update(id: string, spec: RegionSpec): void;
  unregister(id: string): void;
  /** Réveille la boucle ; `restyle` fait relire rayons et teintes. */
  heat(restyle?: boolean): void;
  /** Retire tout de la coquille, tout de suite (page quittée). */
  clear(): void;
  /** Nombre de régions inscrites. */
  readonly size: number;
}

/** Six images (~100 ms) sans changement : la fin d'un défilement inertiel en fait partie. */
export const REGION_IDLE_FRAMES = 6;

interface Entry {
  id: string;
  element: Element;
  spec: RegionSpec;
  style: RegionStyle | null;
  sent: NativeGlassRegion | null;
}

export function createRegionScheduler(deps: RegionSchedulerDeps): RegionScheduler {
  const entries = new Map<string, Entry>();
  const pendingRemovals = new Set<string>();
  const idleFrames = deps.idleFrames ?? REGION_IDLE_FRAMES;
  let handle: number | null = null;
  let idle = 0;
  let watching = false;

  /** Le pont peut lever (coquille rechargée) : la page n'en souffre jamais. */
  const call = (send: () => void): void => {
    try {
      send();
    } catch {
      /* La coquille rattrapera à la prochaine image : rien à faire ici. */
    }
  };

  const schedule = (): void => {
    if (handle === null) handle = deps.requestFrame(frame);
  };

  function frame(): void {
    handle = null;
    const viewport = deps.viewport();
    const upserts: NativeGlassRegion[] = [];
    const removals = [...pendingRemovals];
    pendingRemovals.clear();

    for (const entry of entries.values()) {
      if (entry.style === null) entry.style = deps.readStyle(entry.element, entry.spec);
      const next = deps.measure(entry.id, entry.element, entry.spec, entry.style, viewport);
      if (next === null) {
        if (entry.sent !== null) {
          removals.push(entry.id);
          entry.sent = null;
        }
        continue;
      }
      if (entry.sent === null || !sameRegion(entry.sent, next)) {
        upserts.push(next);
        entry.sent = next;
      }
    }

    if (upserts.length > 0) call(() => deps.bridge.upsert(upserts));
    if (removals.length > 0) call(() => deps.bridge.remove(removals));

    idle = upserts.length + removals.length > 0 ? 0 : idle + 1;
    if (entries.size > 0 && idle < idleFrames) schedule();
  }

  const heat = (restyle = false): void => {
    if (restyle) for (const entry of entries.values()) entry.style = null;
    idle = 0;
    if (entries.size > 0 || pendingRemovals.size > 0) schedule();
  };

  const startWatching = (): void => {
    if (watching) return;
    watching = true;
    deps.watch.start();
  };

  const stopWatchingIfEmpty = (): void => {
    if (!watching || entries.size > 0) return;
    watching = false;
    deps.watch.stop();
  };

  return {
    register(id, element, spec) {
      const previous = entries.get(id);
      if (previous !== undefined && previous.element !== element) {
        deps.watch.unobserve(previous.element);
      }
      pendingRemovals.delete(id);
      entries.set(id, { id, element, spec, style: null, sent: previous?.sent ?? null });
      startWatching();
      deps.watch.observe(element);
      heat();
    },

    update(id, spec) {
      const entry = entries.get(id);
      if (entry === undefined) return;
      entry.spec = spec;
      entry.style = null;
      heat();
    },

    unregister(id) {
      const entry = entries.get(id);
      if (entry === undefined) return;
      entries.delete(id);
      deps.watch.unobserve(entry.element);
      if (entry.sent !== null) pendingRemovals.add(id);
      stopWatchingIfEmpty();
      heat();
    },

    heat,

    clear() {
      const ids = [...pendingRemovals];
      pendingRemovals.clear();
      for (const entry of entries.values()) {
        if (entry.sent !== null) ids.push(entry.id);
        entry.sent = null;
      }
      if (handle !== null) {
        deps.cancelFrame(handle);
        handle = null;
      }
      if (ids.length > 0) call(() => deps.bridge.remove(ids));
    },

    get size() {
      return entries.size;
    },
  };
}
