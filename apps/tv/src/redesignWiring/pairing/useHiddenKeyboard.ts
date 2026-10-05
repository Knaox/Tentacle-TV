import { useMemo } from "react";
import { HiddenTextInput, openHiddenInput } from "../../platform/textEntry";
import type { FocusStore } from "../../platform/tvos/focus/focusStore";
import type { KeyboardEntry } from "../../redesign/screens/pairing/keyboardOpener";

/**
 * Le clavier système des champs du jumelage et des profils : l'ouverture et
 * le champ caché que la plateforme fournit (`platform/textEntry`),
 * et, à la fermeture du clavier, le focus rendu au bouton du champ — tvOS le
 * fait seul, Android TV sur demande.
 */
export function useHiddenKeyboard(store: FocusStore): KeyboardEntry {
  return useMemo(
    () => ({
      open: (input, focusKey) =>
        openHiddenInput(input, () => {
          store.claim(focusKey);
        }),
      Input: HiddenTextInput,
    }),
    [store],
  );
}
