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
 * C'est la règle de la pile des contextes de la télécommande
 * (`remote/contexts.ts`), à ses propres rangs — et `resolveBack` la rejoue
 * par elle. La pile VIVANTE garde pourtant son propre compteur : une couche
 * qui change de rang (même identifiant) y GARDE son rang d'activation, ce
 * qu'une pile de contextes ne sait pas faire (un rang y est fixé à
 * l'inscription). Les deux sont épinglées par les mêmes tests d'ordre.
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

interface Entry extends BackLayer {
  /** Le rang d'activation : à rang égal, la plus récente répond la première. */
  seq: number;
}

const rankOf = (kind: BackLayerKind): number => BACK_LAYER_ORDER.indexOf(kind);

/** La couche qui répond, parmi des couches données — l'ordre, puis la plus récente. */
function pick(entries: ReadonlyMap<string, Entry>): BackTarget | null {
  let best: { id: string; entry: Entry } | null = null;
  for (const [id, entry] of entries) {
    if (!entry.active) continue;
    if (!best) {
      best = { id, entry };
      continue;
    }
    const rank = rankOf(entry.kind) - rankOf(best.entry.kind);
    if (rank < 0 || (rank === 0 && entry.seq > best.entry.seq)) best = { id, entry };
  }
  return best ? { id: best.id, kind: best.entry.kind } : null;
}

const sameTarget = (a: BackTarget | null, b: BackTarget | null): boolean =>
  a === b || (a !== null && b !== null && a.id === b.id && a.kind === b.kind);

export function createBackLayers(): BackLayers {
  const entries = new Map<string, Entry>();
  const listeners = new Set<() => void>();
  let seq = 0;
  let current: BackTarget | null = null;

  const refresh = () => {
    const next = pick(entries);
    if (sameTarget(next, current)) return;
    current = next;
    for (const listener of [...listeners]) listener();
  };

  return {
    set(id, layer) {
      const previous = entries.get(id);
      // Le rang ne bouge qu'à l'activation : une couche déjà active qui se met
      // à jour (un nouveau gestionnaire, un autre rang) ne repasse pas devant
      // les autres.
      const activated = layer.active && !(previous?.active ?? false);
      entries.set(id, { ...layer, seq: activated ? ++seq : previous?.seq ?? 0 });
      refresh();
    },
    remove(id) {
      if (entries.delete(id)) refresh();
    },
    target: () => current,
    back() {
      const target = pick(entries);
      if (!target) return false;
      entries.get(target.id)?.onBack();
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
