import { useEffect } from "react";
import type { FocusStore } from "../../tvos/focus/focusStore";

/**
 * Android TV — l'entrée d'une liste en `Modal` (`useChoiceEntry`) RÉCLAMÉE.
 * La `Modal` y est une fenêtre à part (un `Dialog`) qui prend le focus de la
 * fenêtre avant que la liste ne soit rendue : aucun élément n'y est focalisé
 * à l'ouverture, et le premier appui focalisait le premier choix venu. Sur
 * Apple TV, le moteur focalise d'emblée le seul élément sélectionnable :
 * l'entrée — on la réclame donc, dès qu'elle est montée.
 */
export function useChoiceEntryClaim(focus: FocusStore, entryKey: string | null): void {
  useEffect(() => (entryKey ? focus.claim(entryKey) : undefined), [focus, entryKey]);
}
