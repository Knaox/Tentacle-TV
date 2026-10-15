import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import {
  startupHolder,
  startupWindowMayShow,
  strongestStartupState,
  type StartupStates,
  type StartupWindow,
  type StartupWindowState,
} from "./startupOrder";

/**
 * Le magasin des fenêtres du démarrage : chaque porte y PUBLIE son état
 * (`usePublishStartupWindow`) et y LIT si c'est son tour (`useStartupMayShow`),
 * d'après la règle pure (`startupOrder.ts`). Un magasin de module : les portes
 * vivent dans des branches qui ne se connaissent pas — les recouvrements
 * d'`App`, la coquille (l'affiche de la Famille, « Changer de profil »), le
 * rideau monté à la racine —, et la porte de « Qui regarde ? » publie AVANT
 * que l'application ne soit montée.
 *
 * Hors de `profiles/` exprès : le client LG compile `StartupOverlays`, pas ce
 * dossier (`EXCLUDED_WEB_DIRECTORIES`). Sur la dalle, personne ne publie la
 * première fenêtre : elle vaut `done`.
 */

export interface StartupSnapshot {
  states: StartupStates;
  /** Une session, et pas sur le lecteur (`StartupOverlays`). */
  ready: boolean;
}

interface Published {
  target: StartupWindow;
  state: StartupWindowState;
}

const sources = new Map<string, Published>();
let ready = false;
let snapshot: StartupSnapshot = { states: {}, ready };
const listeners = new Set<() => void>();

function rebuild(): void {
  const grouped = new Map<StartupWindow, StartupWindowState[]>();
  for (const { target, state } of sources.values()) grouped.set(target, [...(grouped.get(target) ?? []), state]);
  const states: StartupStates = {};
  for (const [target, list] of grouped) states[target] = strongestStartupState(list);
  snapshot = { states, ready };
  listeners.forEach((listener) => listener());
}

/**
 * L'état d'une SOURCE (une porte) de `target` ; null la retire. Une fenêtre a
 * plusieurs sources quand plusieurs portes la portent (le profil : l'attente de
 * l'ouverture, « Changer de profil », le rideau) — la plus contraignante vaut.
 */
export function publishStartupWindow(source: string, target: StartupWindow, state: StartupWindowState | null): void {
  const current = sources.get(source);
  if (state === null) {
    if (!current) return;
    sources.delete(source);
  } else {
    if (current?.target === target && current.state === state) return;
    sources.set(source, { target, state });
  }
  rebuild();
}

export function setStartupReady(next: boolean): void {
  if (next === ready) return;
  ready = next;
  rebuild();
}

export function readStartupSnapshot(): StartupSnapshot {
  return snapshot;
}

export function subscribeStartup(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Pour les tests : aucune source, pas de session. */
export function resetStartupWindows(): void {
  sources.clear();
  ready = false;
  rebuild();
}

/**
 * Le fondu de sortie d'une fenêtre (`Modal` : 150 ms) : la suivante n'entre
 * qu'une fois la précédente partie — sans lui, les deux se croisaient à l'écran.
 */
export const STARTUP_EXIT_GRACE_MS = 200;

/**
 * Publier l'état d'une porte tant qu'elle est montée — en effet de MISE EN
 * PAGE : avant la peinture, et avant toute réponse réseau ou minuterie qui
 * ferait paraître une autre fenêtre. Une fenêtre qui se ferme garde sa place
 * le temps de son fondu (`STARTUP_EXIT_GRACE_MS`). Démontée, elle se retire.
 */
export function usePublishStartupWindow(source: string, target: StartupWindow, state: StartupWindowState): void {
  const published = useRef<StartupWindowState | null>(null);
  useLayoutEffect(() => {
    const publish = () => {
      published.current = state;
      publishStartupWindow(source, target, state);
    };
    if (published.current !== "open" || state === "open") {
      publish();
      return;
    }
    const timer = setTimeout(publish, STARTUP_EXIT_GRACE_MS);
    return () => clearTimeout(timer);
  }, [source, target, state]);
  useLayoutEffect(() => () => {
    published.current = null;
    publishStartupWindow(source, target, null);
  }, [source, target]);
}

/** Est-ce le tour de `target` ? */
export function useStartupMayShow(target: StartupWindow): boolean {
  const current = useSyncExternalStore(subscribeStartup, readStartupSnapshot, readStartupSnapshot);
  return startupWindowMayShow(target, current.states, current.ready);
}

/** Publier l'état de `target` ET savoir si c'est son tour — le cas d'une porte seule. */
export function useStartupTurn(target: StartupWindow, state: StartupWindowState, source: string = target): boolean {
  usePublishStartupWindow(source, target, state);
  return useStartupMayShow(target);
}

/** Diagnostic (porte du débogage du web) : l'état des fenêtres et celle qui tient le démarrage. */
export function describeStartup(): StartupSnapshot & { holder: StartupWindow | null } {
  return { ...snapshot, holder: startupHolder(snapshot.states) };
}
