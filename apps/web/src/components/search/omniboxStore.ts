/**
 * L'OMNIBOX — la recherche de toute l'application — s'ouvre d'un seul endroit.
 *
 * Un état global plutôt qu'un état de composant : la barre de navigation, le
 * raccourci ⌘K, la page de résultats et le mobile l'ouvrent tous, et elle est
 * montée UNE fois (`OmniboxHost`), au-dessus des pages avec ou sans barre —
 * la fiche d'un film n'a pas de navigation, mais ⌘K doit y chercher aussi.
 *
 * `seed` : ce que la barre contient à l'ouverture (une recherche récente
 * relancée, la requête de la page de résultats).
 */

import { useEffect, useSyncExternalStore } from "react";

interface OmniboxState {
  open: boolean;
  seed: string;
}

let state: OmniboxState = { open: false, seed: "" };
const listeners = new Set<() => void>();

function emit(next: OmniboxState): void {
  state = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function openOmnibox(seed = ""): void {
  emit({ open: true, seed });
}

export function closeOmnibox(): void {
  if (state.open) emit({ open: false, seed: "" });
}

export function useOmnibox(): OmniboxState {
  return useSyncExternalStore(subscribe, () => state);
}

/** Un champ où l'on tape : « / » y reste un caractère. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";
}

/**
 * ⌘K / Ctrl+K partout, « / » hors d'un champ. La touche est comparée en
 * minuscule : avec la majuscule verrouillée, `e.key` vaut « K » — le
 * raccourci d'avant ne répondait plus.
 */
export function useOmniboxShortcuts(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey) return;
      const key = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && key === "k") {
        e.preventDefault();
        openOmnibox();
        return;
      }
      if (key === "/" && !e.metaKey && !e.ctrlKey && !isTypingTarget(e.target)) {
        e.preventDefault();
        openOmnibox();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}
