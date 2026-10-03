import type { RemoteIntent } from "./intents";
import type { IntentEvent } from "./signals";

/**
 * La résolution « intention → comportement », selon le contexte actif.
 *
 * Ce qu'une intention PRODUIT dépend de là où l'on est : `select` valide un
 * bouton à l'écran, mais Lecture/Pause demande les saisons cochées dans la
 * feuille des saisons et suspend la lecture dans le lecteur ; Retour ferme le
 * panneau ouvert avant de reculer d'une page. Les contextes s'empilent — un
 * ÉCRAN, un PANNEAU par-dessus, le LECTEUR, le CLAVIER — et la pile répond :
 *
 *     clavier > panneau > lecteur > écran
 *
 * À rang égal, le plus récemment ACTIVÉ passe devant (un panneau ouvert dans
 * un panneau se consulte avant lui) — la règle de `nav/backLayers.ts`. On
 * consulte les contextes actifs dans cet ordre ; le premier qui DÉCIDE prend
 * l'intention, les autres ne la voient pas. Un contexte qui ne décide rien
 * (`null`) la laisse passer au suivant. Personne : c'est le comportement par
 * défaut de la plateforme (le moteur de focus natif, ou UIKit pour Retour).
 *
 * Deux temps, et c'est la clé du branchement natif :
 * - `decide` est PUR : il lit l'état du contexte et rend une DÉCISION (des
 *   données), sans rien faire. On peut donc l'appeler D'AVANCE, sans geste
 *   (`resolve`) — ce que tvOS exige pour Retour, pris ou laissé à UIKit dès
 *   l'enfoncement ;
 * - `apply` applique la décision, au geste (`dispatch`). C'est la part de la
 *   plateforme : poser un focus, ouvrir un panneau, appeler le lecteur.
 *
 * Les décisions elles-mêmes (leurs types, leurs règles) vivent dans les
 * dossiers de domaine (`focus/`, `nav/`, `player/`…) ; ce module ne fait que
 * l'aiguillage. Générique sur les rangs : une pile à d'autres rangs
 * (`createRemoteContexts(["menu", "overlay", …])`) suit la même règle.
 *
 * Module pur : ni DOM, ni React Native.
 */

export type RemoteContextKind = "keyboard" | "panel" | "player" | "screen";

/** L'ordre de consultation, du dessus vers le dessous. */
export const REMOTE_CONTEXT_ORDER: readonly RemoteContextKind[] = ["keyboard", "panel", "player", "screen"];

export interface RemoteBehavior<D> {
  /** PUR : la décision de ce contexte pour cette intention, ou `null` — elle
   *  passe au contexte du dessous. Peut être appelé sans geste (`resolve`). */
  decide(intent: RemoteIntent): D | null;
  /** Applique la décision, au geste. */
  apply(decision: D, event: IntentEvent): void;
}

export interface RemoteContextSpec<K extends string, D> extends RemoteBehavior<D> {
  kind: K;
  /** Un nom pour le diagnostic et les tests (« seasonsSheet », « player »…). */
  name: string;
  /** Faux : inscrit, mais il ne reçoit rien (un écran d'arrière-plan). Vrai par défaut. */
  active?: boolean;
}

export interface RemoteContextHandle<D> {
  /** Devenu actif, il passe devant ceux de son rang. */
  setActive(active: boolean): void;
  /** Nouveaux comportements (une fermeture neuve à chaque rendu), sans changer de rang. */
  update(behavior: RemoteBehavior<D>): void;
  /** Son état a bougé, ses décisions aussi : les décisions anticipées se relisent. */
  refresh(): void;
  remove(): void;
}

export interface Resolution<K extends string = RemoteContextKind> {
  /** Le contexte qui prend l'intention. */
  name: string;
  kind: K;
  decision: unknown;
}

export interface RemoteContexts<K extends string = RemoteContextKind> {
  register<D>(spec: RemoteContextSpec<K, D>): RemoteContextHandle<D>;
  /** Qui prendrait cette intention, et sa décision — sans rien appliquer. */
  resolve(intent: RemoteIntent): Resolution<K> | null;
  /** Résout, puis applique ; `null` : aucun contexte ne l'a prise. */
  dispatch(event: IntentEvent): Resolution<K> | null;
  /** Les contextes actifs, du dessus vers le dessous. */
  stack(): Array<{ name: string; kind: K }>;
  /** Combien sont inscrits, actifs ou non. */
  size(): number;
  /** Prévenu à chaque inscription, retrait, (dés)activation ou `refresh` :
   *  de quoi relire une décision anticipée. */
  subscribe(listener: () => void): () => void;
}

interface Entry<K extends string> {
  id: number;
  kind: K;
  name: string;
  active: boolean;
  /** Le rang d'activation : à rang égal, le plus récent répond le premier. */
  seq: number;
  behavior: RemoteBehavior<unknown>;
}

export function createRemoteContexts<K extends string = RemoteContextKind>(
  order: readonly K[] = REMOTE_CONTEXT_ORDER as unknown as readonly K[],
): RemoteContexts<K> {
  const entries = new Map<number, Entry<K>>();
  const listeners = new Set<() => void>();
  let nextId = 0;
  let seq = 0;
  let ordered: Array<Entry<K>> | null = null;

  const rankOf = (kind: K): number => {
    const rank = order.indexOf(kind);
    return rank < 0 ? order.length : rank;
  };

  /** Les actifs, du dessus vers le dessous ; recalculé après chaque changement. */
  const activeStack = (): Array<Entry<K>> => {
    ordered ??= [...entries.values()]
      .filter((entry) => entry.active)
      .sort((a, b) => rankOf(a.kind) - rankOf(b.kind) || b.seq - a.seq);
    return ordered;
  };

  const changed = () => {
    ordered = null;
    for (const listener of [...listeners]) listener();
  };

  const resolve = (intent: RemoteIntent): { entry: Entry<K>; decision: unknown } | null => {
    for (const entry of activeStack()) {
      const decision = entry.behavior.decide(intent);
      if (decision !== null && decision !== undefined) return { entry, decision };
    }
    return null;
  };

  const resolution = (found: { entry: Entry<K>; decision: unknown }): Resolution<K> => ({
    name: found.entry.name,
    kind: found.entry.kind,
    decision: found.decision,
  });

  return {
    register<D>(spec: RemoteContextSpec<K, D>): RemoteContextHandle<D> {
      const active = spec.active ?? true;
      const entry: Entry<K> = {
        id: nextId++,
        kind: spec.kind,
        name: spec.name,
        active,
        seq: active ? ++seq : 0,
        behavior: { decide: spec.decide, apply: spec.apply } as RemoteBehavior<unknown>,
      };
      entries.set(entry.id, entry);
      changed();
      return {
        setActive(next) {
          if (!entries.has(entry.id) || entry.active === next) return;
          entry.active = next;
          if (next) entry.seq = ++seq;
          changed();
        },
        update(behavior) {
          entry.behavior = behavior as RemoteBehavior<unknown>;
        },
        refresh() {
          if (entries.has(entry.id)) changed();
        },
        remove() {
          if (entries.delete(entry.id)) changed();
        },
      };
    },
    resolve(intent) {
      const found = resolve(intent);
      return found ? resolution(found) : null;
    },
    dispatch(event) {
      const found = resolve(event.intent);
      if (!found) return null;
      found.entry.behavior.apply(found.decision, event);
      return resolution(found);
    },
    stack: () => activeStack().map(({ name, kind }) => ({ name, kind })),
    size: () => entries.size,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
