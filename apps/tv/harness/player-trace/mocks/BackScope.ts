// Simulacre de redesignWiring/back/BackScope : la MÊME pile vivante que la
// portée (`createBackLayers`, tv-core), sans l'intercepteur natif. Menu au banc
// = `__back.press()` : ce que fait `onMenuPress` de la portée (une couche
// répond, sinon la page poussée recule).
import { useId, useLayoutEffect, useRef } from "react";
import { createBackLayers, type BackLayerKind } from "@tentacle-tv/tv-core";

export const __back = {
  layers: createBackLayers(),
  pushed: true,
  onPop: null as null | (() => void),
  press(): void {
    if (this.layers.back()) return;
    if (this.pushed) this.onPop?.();
  },
  reset(): void {
    this.layers = createBackLayers();
  },
};

export function useBackLayer(kind: BackLayerKind, active: boolean, onBack: () => void): void {
  const id = useId();
  const handler = useRef(onBack);
  handler.current = onBack;
  const layers = __back.layers;
  useLayoutEffect(() => {
    layers.set(id, { kind, active, onBack: () => handler.current() });
  }, [layers, id, kind, active]);
  useLayoutEffect(() => () => layers.remove(id), [layers, id]);
}

interface Spec { id: string; kind: BackLayerKind; active: boolean; action: string }

/** L'API de T4 (§ 16) : les couches d'une règle pure, dans l'ordre de la liste. */
export function useBackLayers(specs: readonly Spec[], actions: Readonly<Record<string, () => void>>): void {
  const prefix = useId();
  const latest = useRef(actions);
  latest.current = actions;
  const layers = __back.layers;
  const key = specs.map((s) => `${s.id}:${s.kind}:${s.active ? 1 : 0}:${s.action}`).join("|");
  useLayoutEffect(() => {
    for (const s of specs) {
      layers.set(`${prefix}${s.id}`, { kind: s.kind, active: s.active, onBack: () => latest.current[s.action]?.() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers, prefix, key]);
  const ids = specs.map((s) => s.id).join("|");
  useLayoutEffect(() => {
    const owned = ids.split("|");
    return () => { for (const id of owned) layers.remove(`${prefix}${id}`); };
  }, [layers, prefix, ids]);
}
