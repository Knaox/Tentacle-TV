/**
 * Le regroupement des changements de verre, côté PRELOAD : un seul message
 * d'IPC par tâche JavaScript, donc par image.
 *
 * La page regroupe déjà par `requestAnimationFrame` (un `upsert` et un `remove`
 * au plus par image, contrat de `useLiquidGlassRegion`). Ce lot-ci fond les deux
 * — et tout ce qu'un autre composant aurait envoyé dans la même tâche — en UN
 * message, vidé en microtâche : aucune image de retard, aucun minuteur.
 *
 * Le dernier mot gagne, région par région : un `upsert` puis un `remove` du même
 * identifiant dans la même tâche ne laissent qu'un retrait ; l'inverse, une
 * mise à jour. Chaque région est RECOPIÉE champ par champ : rien de ce que la
 * page aurait accroché à l'objet ne traverse le canal.
 *
 * ⚠️ Importé par le preload (bundlé, bac à sable) : ne dépend que de `protocol.ts`.
 */

import type { LiquidGlassBatch, NativeGlassRegion } from "./protocol";

export interface GlassBatcher {
  setEnabled(enabled: boolean): void;
  upsert(regions: readonly NativeGlassRegion[]): void;
  remove(ids: readonly string[]): void;
}

function hasStringId(value: unknown): value is { id: string } {
  return typeof value === "object" && value !== null && typeof (value as { id?: unknown }).id === "string";
}

/** Recopie les seuls champs du protocole — le principal revalide de toute façon. */
function pick(region: NativeGlassRegion): NativeGlassRegion {
  const base = {
    id: region.id,
    x: region.x,
    y: region.y,
    width: region.width,
    height: region.height,
    radius: region.radius,
    level: region.level,
    tint: region.tint,
    interactive: region.interactive,
    z: region.z,
  };
  return {
    ...base,
    ...(region.group === undefined ? {} : { group: region.group }),
    ...(region.spacing === undefined ? {} : { spacing: region.spacing }),
    ...(region.transition === undefined ? {} : { transition: region.transition }),
  };
}

/**
 * @param send     envoie un lot (en vrai : `ipcRenderer.send`).
 * @param schedule programme le vidage (en vrai : `queueMicrotask`).
 */
export function createGlassBatcher(
  send: (batch: LiquidGlassBatch) => void,
  schedule: (flush: () => void) => void,
): GlassBatcher {
  let enabled: boolean | undefined;
  const upserts = new Map<string, NativeGlassRegion>();
  const removes = new Set<string>();
  let armed = false;

  const flush = (): void => {
    armed = false;
    if (enabled === undefined && upserts.size === 0 && removes.size === 0) return;
    const batch: LiquidGlassBatch = {
      ...(enabled === undefined ? {} : { enabled }),
      upserts: [...upserts.values()],
      removes: [...removes],
    };
    enabled = undefined;
    upserts.clear();
    removes.clear();
    send(batch);
  };

  const arm = (): void => {
    if (armed) return;
    armed = true;
    schedule(flush);
  };

  return {
    setEnabled(next) {
      enabled = next;
      arm();
    },
    upsert(regions) {
      // La page n'est pas crue sur son type : un `null` dans le tableau ne doit
      // pas faire tomber le preload, seulement être ignoré.
      for (const raw of regions as readonly unknown[]) {
        if (!hasStringId(raw)) continue;
        removes.delete(raw.id);
        upserts.set(raw.id, pick(raw as NativeGlassRegion));
      }
      arm();
    },
    remove(ids) {
      for (const id of ids as readonly unknown[]) {
        if (typeof id !== "string") continue;
        upserts.delete(id);
        removes.add(id);
      }
      arm();
    },
  };
}
