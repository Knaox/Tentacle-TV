import { useState } from "react";
import { findNodeHandle, type View } from "react-native";
import type { FocusBinder, FocusBinding } from "../../redesign/focus/focusBinding";
import { claimTvFocus } from "../../hooks/useTvFocusClaim";

/**
 * Le magasin de focus d'un écran refondu — la moitié « app » du port du focus
 * (`redesign/focus/focusBinding.tsx`).
 *
 * Les vues de la refonte ne connaissent que leurs clés (`hero:primary`,
 * `nav:Home`, `resume:3`…). Le magasin répond, clé par clé, par une liaison
 * STABLE : la référence du nœud natif et l'observation du focus. Il sait donc
 * à tout instant quel nœud porte quelle clé, laquelle a le focus et laquelle
 * l'avait en dernier — de quoi poser l'entrée d'un écran, rendre le focus au
 * retour, viser un guide ou une destination, sans qu'une vue le sache.
 *
 * Un magasin par écran (`useFocusStore`) : la pile garde plusieurs écrans
 * montés, et leurs clés se ressemblent.
 */

export type FocusListener = (focusKey: string, focused: boolean) => void;

/** Ce que l'intégration peut ajouter à une clé : props natives, garde anti-clic
 *  fantôme, conteneur d'un groupe (`FocusGroup`). */
export type FocusExtras = Pick<FocusBinding, "native" | "phantomPressGuard" | "container">;

export interface FocusStore {
  /** Le `bind` du port — stable pour la vie du magasin. */
  readonly binder: FocusBinder;
  /** Le nœud natif monté sous cette clé, ou null. */
  node(focusKey: string): View | null;
  /** Son numéro natif (`findNodeHandle`) : `nextFocus*`, destinations d'un guide. */
  handle(focusKey: string): number | null;
  /**
   * Ajoute des props natives, la garde ou un conteneur à une clé (`null` :
   * les retire).
   * Lu au RENDU de la cible : à poser avant qu'elle se monte. Pour agir sur une
   * cible déjà montée, `claim` — ou `setNativeProps` sur `node(key)`.
   */
  bind(focusKey: string, extras: FocusExtras | null): void;
  /**
   * Réclame le focus pour la clé ; rend l'annulation. Une cible pas encore
   * montée est visée dès son montage. Le nœud est relu à chaque étape, jamais
   * capturé : une cible démontée en route ne reçoit rien.
   */
  claim(focusKey: string): () => void;
  /** La clé qui porte le focus natif, ou null. */
  focusedKey(): string | null;
  /** La dernière clé focalisée — elle reste après la perte du focus. */
  lastFocusedKey(): string | null;
  /** Prise et perte du focus, clé par clé. Rend le désabonnement. */
  subscribe(listener: FocusListener): () => void;
}

type Settable = { setNativeProps?: (props: object) => void };

export function createFocusStore(): FocusStore {
  const nodes = new Map<string, View>();
  const extras = new Map<string, FocusExtras>();
  const bindings = new Map<string, FocusBinding>();
  const listeners = new Set<FocusListener>();
  /** Réclamations en attente du montage de leur cible. */
  const pending = new Map<string, Set<() => void>>();
  let current: string | null = null;
  let last: string | null = null;

  const attach = (key: string, node: View | null) => {
    if (!node) {
      nodes.delete(key);
      return;
    }
    nodes.set(key, node);
    const waiting = pending.get(key);
    if (waiting) {
      pending.delete(key);
      for (const run of waiting) run();
    }
  };

  const changed = (key: string, focused: boolean) => {
    if (focused) {
      current = key;
      last = key;
    } else if (current === key) {
      current = null;
    }
    for (const listener of [...listeners]) listener(key, focused);
  };

  const binder: FocusBinder = (key) => {
    let binding = bindings.get(key);
    if (!binding) {
      binding = {
        ...extras.get(key),
        ref: (node: View | null) => attach(key, node),
        onFocus: () => changed(key, true),
        onBlur: () => changed(key, false),
      };
      bindings.set(key, binding);
    }
    return binding;
  };

  const claim = (key: string): (() => void) => {
    // Le nœud relu à chaque écriture : `claimTvFocus` étale les siennes sur
    // une centaine de millisecondes, pendant lesquelles la cible peut partir.
    const live: Settable = { setNativeProps: (props) => (nodes.get(key) as Settable | undefined)?.setNativeProps?.(props) };
    if (nodes.has(key)) return claimTvFocus(live);
    let cancelNative: (() => void) | null = null;
    let cancelled = false;
    const run = () => {
      if (!cancelled) cancelNative = claimTvFocus(live);
    };
    const waiting = pending.get(key) ?? new Set();
    waiting.add(run);
    pending.set(key, waiting);
    return () => {
      cancelled = true;
      pending.get(key)?.delete(run);
      cancelNative?.();
    };
  };

  return {
    binder,
    node: (key) => nodes.get(key) ?? null,
    handle: (key) => {
      const node = nodes.get(key);
      return node ? findNodeHandle(node) : null;
    },
    bind: (key, value) => {
      if (value) extras.set(key, value);
      else extras.delete(key);
      bindings.delete(key); // la prochaine lecture reconstruit la liaison
    },
    claim,
    focusedKey: () => current,
    lastFocusedKey: () => last,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** Le magasin d'un écran, créé une fois pour sa vie. */
export function useFocusStore(): FocusStore {
  const [store] = useState(createFocusStore);
  return store;
}
