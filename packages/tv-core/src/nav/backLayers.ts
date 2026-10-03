import { createRemoteContexts, type RemoteContextHandle } from "../remote/contexts";
import type { RemoteIntent } from "../remote/intents";

/**
 * La touche RETOUR d'une télévision, en couches — module pur : ni React, ni
 * plateforme ; les tests n'ont besoin de rien d'autre.
 *
 * Une couche, c'est ce qui a quelque chose à faire quand on appuie sur
 * Retour : un menu à fermer, la surimpression du lecteur à masquer, la page
 * (reculer, ou ouvrir le rail), le rail lui-même. La règle est UNE, pour
 * toutes les pages : on consulte les couches ACTIVES dans l'ordre
 *
 *     menu > surimpression > page > rail
 *
 * et la première répond ; à rang égal, la plus récemment activée (un menu
 * ouvert dans un panneau se ferme avant lui). Aucune couche active : la
 * plateforme reprend la main — une page poussée recule ; sinon, sur Apple TV,
 * c'est la SORTIE de l'application, que seul UIKit sait faire (la règle
 * d'Apple : Menu finit par quitter). Voir `backResolve.ts`.
 *
 * Cette règle est celle de la pile des contextes de la télécommande
 * (`remote/contexts.ts`) : la pile du Retour EN EST UNE, à ses propres rangs,
 * où chaque couche active décide l'intention `retour`. Une seule copie de la
 * règle « rang, puis le plus récemment activé ».
 *
 * Une couche se DÉCLARE active d'avance, au lieu de dire « pris / pas pris »
 * au moment de l'appui : sur Apple TV, l'application doit savoir AVANT
 * l'appui si elle le prendra — un appui pris ne peut plus être rendu à UIKit
 * pour qu'il quitte.
 */

export type BackLayerKind = "menu" | "overlay" | "page" | "rail";

/** L'ordre de consultation : un menu passe avant la surimpression, qui passe avant la page… */
export const BACK_LAYER_ORDER: readonly BackLayerKind[] = ["menu", "overlay", "page", "rail"];

export interface BackLayer {
  kind: BackLayerKind;
  /** Elle prend le prochain Retour (déclaré d'avance). */
  active: boolean;
  onBack: () => void;
}

export interface BackTarget {
  id: string;
  kind: BackLayerKind;
}

export interface BackLayers {
  /** Inscrit ou met à jour une couche. Devenue active, elle passe devant celles de son rang. */
  set(id: string, layer: BackLayer): void;
  remove(id: string): void;
  /** La couche qui recevra le prochain Retour, ou null : la plateforme le traite. */
  target(): BackTarget | null;
  /** Retour : la couche visée répond. Faux si aucune ne l'a pris. */
  back(): boolean;
  /** Prévenu quand la cible change — la plateforme dit alors si elle prend l'appui. */
  subscribe(listener: () => void): () => void;
}

/** L'intention que la pile résout. */
export const BACK_INTENT: RemoteIntent = { type: "retour" };

interface Slot {
  kind: BackLayerKind;
  /** La couche telle qu'inscrite en dernier : son gestionnaire est relu à l'appui. */
  layer: BackLayer;
  handle: RemoteContextHandle<string>;
}

const sameTarget = (a: BackTarget | null, b: BackTarget | null): boolean =>
  a === b || (a !== null && b !== null && a.id === b.id && a.kind === b.kind);

export function createBackLayers(): BackLayers {
  const stack = createRemoteContexts<BackLayerKind>(BACK_LAYER_ORDER);
  const slots = new Map<string, Slot>();
  const listeners = new Set<() => void>();
  let current: BackTarget | null = null;

  const pick = (): BackTarget | null => {
    const found = stack.resolve(BACK_INTENT);
    return found ? { id: found.decision as string, kind: found.kind } : null;
  };

  const refresh = () => {
    const next = pick();
    if (sameTarget(next, current)) return;
    current = next;
    for (const listener of [...listeners]) listener();
  };

  const register = (id: string, layer: BackLayer): Slot => {
    const slot = { kind: layer.kind, layer } as Slot;
    slot.handle = stack.register<string>({
      kind: layer.kind,
      name: id,
      active: layer.active,
      // Une couche active prend Retour, sous son identifiant.
      decide: (intent) => (intent.type === "retour" ? id : null),
      apply: () => slot.layer.onBack(),
    });
    return slot;
  };

  return {
    set(id, layer) {
      const previous = slots.get(id);
      if (previous && previous.kind === layer.kind) {
        // Le rang ne bouge qu'à l'activation : une couche déjà active qui se met
        // à jour (un nouveau gestionnaire) ne repasse pas devant les autres.
        previous.layer = layer;
        previous.handle.setActive(layer.active);
      } else {
        previous?.handle.remove();
        slots.set(id, register(id, layer));
      }
      refresh();
    },
    remove(id) {
      const slot = slots.get(id);
      if (!slot) return;
      slots.delete(id);
      slot.handle.remove();
      refresh();
    },
    target: () => current,
    back() {
      const target = pick();
      if (!target) return false;
      slots.get(target.id)?.layer.onBack();
      return true;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/**
 * Retour sur une page du RAIL — l'accueil, les bibliothèques, la recherche,
 * les réglages… (décidé le 2026-10-01, Apple TV) :
 *
 * 1. le focus dans la page : le rail s'ouvre, sur l'entrée de la page ;
 * 2. le rail ouvert : le focus va sur l'entrée Réglages — sans changer de
 *    page, sans quitter ;
 * 3. déjà sur Réglages : la sortie, rendue à la plateforme.
 *
 * Une page POUSSÉE qui montre le rail (l'étagère d'une personne) n'en relève
 * pas : Retour y recule d'une page, rail ouvert ou non.
 */
export type RailBackStep = "openRail" | "toSettings" | "exit";

export function railBackStep(state: { railFocused: boolean; onSettings: boolean }): RailBackStep {
  if (!state.railFocused) return "openRail";
  return state.onSettings ? "exit" : "toSettings";
}
