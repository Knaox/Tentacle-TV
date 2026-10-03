import { createRemoteContexts } from "../remote/contexts";
import { BACK_INTENT, BACK_LAYER_ORDER, type BackLayerKind } from "./backLayers";

/**
 * Ce que fait RETOUR, décidé en PUR — sans React ni plateforme.
 *
 * Deux usages :
 * - une règle de domaine (le lecteur, un panneau, un écran) DÉCLARE ses
 *   couches — `BackLayerSpec`, l'action est un NOM — et se teste par
 *   `resolveBack`, sans rien monter ;
 * - la portée de la plateforme décide d'avance si elle prend l'appui
 *   (`takesBack` : sur Apple TV, `MenuPressInterceptor.enabled`), puis ce
 *   qu'elle en fait au geste (`backOutcome`).
 *
 * Trois issues, dans cet ordre : une COUCHE active répond (la règle de
 * `backLayers.ts` : menu > surimpression > page > rail, puis la plus
 * récemment activée) ; sinon une page POUSSÉE recule (`pop`) ; sinon la
 * plateforme garde l'appui — sur Apple TV, UIKit QUITTE l'application
 * (`exit`).
 */

/** Une couche déclarée par une règle pure. */
export interface BackLayerSpec<A extends string = string> {
  id: string;
  kind: BackLayerKind;
  active: boolean;
  /** Ce que fait la couche, nommé ; la plateforme y associe sa fonction. */
  action: A;
}

export type BackResolution<A extends string = string> =
  | { kind: "layer"; id: string; action: A }
  | { kind: "pop" }
  | { kind: "exit" };

export type BackOutcome = BackResolution["kind"];

/**
 * La résolution d'un Retour sur des couches déclarées. Une liste n'a pas
 * d'histoire : à rang égal, la DERNIÈRE de la liste répond — l'ordre de la
 * liste vaut l'ordre d'activation (c'est l'ordre dans lequel la portée les
 * inscrit, `useBackLayers`).
 */
export function resolveBack<A extends string>(specs: readonly BackLayerSpec<A>[], context: { pushed: boolean }): BackResolution<A> {
  const stack = createRemoteContexts<BackLayerKind>(BACK_LAYER_ORDER);
  for (const spec of specs) {
    stack.register<BackLayerSpec<A>>({
      kind: spec.kind,
      name: spec.id,
      active: spec.active,
      decide: (intent) => (intent.type === "retour" ? spec : null),
      apply: () => undefined,
    });
  }
  const found = stack.resolve(BACK_INTENT);
  if (found) {
    const spec = found.decision as BackLayerSpec<A>;
    return { kind: "layer", id: spec.id, action: spec.action };
  }
  return context.pushed ? { kind: "pop" } : { kind: "exit" };
}

/** L'issue d'un Retour, connaissant seulement s'il y a une couche active et si la page est poussée. */
export function backOutcome(state: { layered: boolean; pushed: boolean }): BackOutcome {
  if (state.layered) return "layer";
  return state.pushed ? "pop" : "exit";
}

/**
 * La plateforme doit-elle PRENDRE l'appui, d'avance ? Oui, sauf quand il
 * revient à la plateforme elle-même (la sortie) : sur Apple TV, un appui pris
 * ne peut plus être rendu à UIKit pour qu'il quitte.
 */
export function takesBack(state: { layered: boolean; pushed: boolean }): boolean {
  return backOutcome(state) !== "exit";
}
