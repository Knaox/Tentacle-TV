import { createContext, useContext } from "react";
import type { TextInput, TextInputProps } from "react-native";

/**
 * Ouvrir le clavier système d'un champ du jumelage : la VUE le demande, la
 * plateforme le fait — son applicateur (`platform/textEntry`) fournit le geste
 * natif, et ce que le champ caché doit porter (`hiddenInputProps` : rien sur
 * tvOS ; non focalisable hors saisie sur Android TV). `focusKey` : la cible
 * du bouton qui l'ouvre, où le focus revient à la fermeture du clavier. Sans
 * fournisseur (le banc UI), un champ ne s'ouvre pas.
 */
export type KeyboardOpener = (input: TextInput, focusKey: string) => void;

export interface KeyboardEntry {
  open: KeyboardOpener;
  hiddenInputProps: Partial<TextInputProps>;
}

const KeyboardEntryContext = createContext<KeyboardEntry | null>(null);

export const KeyboardEntryProvider = KeyboardEntryContext.Provider;

export function useKeyboardEntry(): KeyboardEntry | null {
  return useContext(KeyboardEntryContext);
}
