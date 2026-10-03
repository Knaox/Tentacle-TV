import { useContext, useId, useLayoutEffect, useRef } from "react";
import type { BackLayerKind, BackLayerSpec } from "@tentacle-tv/tv-core";
import { BackLayersContext } from "./BackScope";

/**
 * S'inscrire dans la pile du Retour de l'écran (la portée `TvosBackScope`).
 * Sans portée (Android TV), rien : le Retour y arrive par BackHandler.
 *
 * Règles d'usage (`docs/tv-navigation/retour-rail.md`) : tout ce qui se ferme
 * est une couche « menu » ; une `Modal` ajoute `onRequestClose` vers la MÊME
 * fonction ; jamais `usePreventRemove` ni d'intercepteur à soi ; une route
 * poussée recule seule.
 */

/**
 * Une couche : tant qu'elle est `active`, le prochain Retour lui revient, dans
 * l'ordre menu > surimpression > page > rail. `onBack` est relu à chaque appui.
 */
export function useBackLayer(kind: BackLayerKind, active: boolean, onBack: () => void): void {
  const layers = useContext(BackLayersContext);
  const id = useId();
  const handler = useRef(onBack);
  handler.current = onBack;
  useLayoutEffect(() => {
    layers?.set(id, { kind, active, onBack: () => handler.current() });
  }, [layers, id, kind, active]);
  useLayoutEffect(() => (layers ? () => layers.remove(id) : undefined), [layers, id]);
}

/** Ce qui change une inscription : l'identifiant, le rang, l'état, l'action. */
const signatureOf = (specs: readonly BackLayerSpec[]): string =>
  specs.map((spec) => `${spec.id}\u0000${spec.kind}\u0000${spec.active ? 1 : 0}\u0000${spec.action}`).join("\u0001");

/**
 * Les couches qu'une règle pure DÉCLARE (`BackLayerSpec`, tv-core), inscrites
 * d'un appel, dans l'ordre de la liste — à rang égal, la dernière activée
 * répond, comme `resolveBack`. `actions` associe chaque nom à sa fonction,
 * relue à chaque appui. Les identifiants sont uniques dans la liste.
 */
export function useBackLayers<A extends string>(specs: readonly BackLayerSpec<A>[], actions: Readonly<Record<A, () => void>>): void {
  const layers = useContext(BackLayersContext);
  const scope = useId();
  const latestActions = useRef(actions);
  latestActions.current = actions;
  const latestSpecs = useRef(specs);
  latestSpecs.current = specs;
  const registered = useRef<string[]>([]);
  const signature = signatureOf(specs);

  useLayoutEffect(() => {
    if (!layers) return;
    const ids: string[] = [];
    for (const spec of latestSpecs.current) {
      const id = `${scope}:${spec.id}`;
      const action = spec.action;
      ids.push(id);
      layers.set(id, { kind: spec.kind, active: spec.active, onBack: () => latestActions.current[action]() });
    }
    for (const id of registered.current) if (!ids.includes(id)) layers.remove(id);
    registered.current = ids;
  }, [layers, scope, signature]);

  useLayoutEffect(
    () => () => {
      for (const id of registered.current) layers?.remove(id);
      registered.current = [];
    },
    [layers],
  );
}
