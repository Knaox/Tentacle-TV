import { createContext, useContext, type ComponentType, type Ref } from "react";
import type { TextInput, TextInputProps } from "react-native";

/**
 * Ouvrir le clavier système d'un champ du jumelage : la VUE le demande, la
 * plateforme le fait — son applicateur (`platform/textEntry`) fournit le geste
 * natif, et le champ caché lui-même (`Input` : le `TextInput` tel quel sur
 * tvOS ; verrouillé hors saisie sur Android TV, où une vue invisible reste
 * candidate du focus). `focusKey` : la cible
 * du bouton qui l'ouvre, où le focus revient à la fermeture du clavier. Sans
 * fournisseur (le banc UI), un champ ne s'ouvre pas.
 */
export type KeyboardOpener = (input: TextInput, focusKey: string) => void;

export interface KeyboardEntry {
  open: KeyboardOpener;
  Input: ComponentType<TextInputProps & { ref?: Ref<TextInput> }>;
}

const KeyboardEntryContext = createContext<KeyboardEntry | null>(null);

export const KeyboardEntryProvider = KeyboardEntryContext.Provider;

export function useKeyboardEntry(): KeyboardEntry | null {
  return useContext(KeyboardEntryContext);
}
