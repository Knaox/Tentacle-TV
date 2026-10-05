import type { FocusStore } from "../focus/focusStore";

/**
 * L'entrée d'une liste en `Modal` (`useChoiceEntry`) : sur tvOS, le moteur
 * focalise de lui-même le seul élément sélectionnable — rien à réclamer (et
 * une réclamation n'y aurait aucun effet). Android TV a sa variante
 * (`choiceEntryClaim.android.ts`).
 */
export function useChoiceEntryClaim(_focus: FocusStore, _entryKey: string | null): void {}
