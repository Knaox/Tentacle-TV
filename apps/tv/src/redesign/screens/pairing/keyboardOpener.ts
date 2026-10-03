import { createContext, useContext } from "react";
import type { TextInput } from "react-native";

/**
 * Ouvrir le clavier système d'un champ du jumelage : la VUE le demande, la
 * plateforme le fait — son applicateur (`platform/tvos/screens/pairing`) fournit
 * le geste natif. Sans fournisseur (le banc UI), un champ ne s'ouvre pas.
 */
export type KeyboardOpener = (input: TextInput) => void;

const KeyboardOpenerContext = createContext<KeyboardOpener | null>(null);

export const KeyboardOpenerProvider = KeyboardOpenerContext.Provider;

export function useKeyboardOpener(): KeyboardOpener | null {
  return useContext(KeyboardOpenerContext);
}
