import { TextInput } from "react-native";
import { openPairingKeyboard } from "./tvos/screens/pairing";

/**
 * Les champs cachés de la saisie au clavier système — POINT D'ENTRÉE NEUTRE :
 * ce fichier est celui de l'Apple TV, `textEntry.android.ts` son jumeau aux
 * MÊMES noms.
 *
 * tvOS : le `TextInput` tel quel (le moteur de focus ignore une vue d'opacité
 * nulle), et l'ouverture est celle du jumelage (`openPairingKeyboard`) ; le
 * focus revient seul au bouton qui l'a ouvert.
 */
export const HiddenTextInput = TextInput;

export function openHiddenInput(input: TextInput, _returnFocus?: () => void): void {
  openPairingKeyboard(input);
}
