import { Keyboard, type TextInput, type TextInputProps } from "react-native";

/**
 * Android TV — les champs CACHÉS qui portent la saisie au clavier système
 * (jumelage, profils, recherche : un vrai `TextInput` invisible, derrière un
 * bouton de la refonte qui l'ouvre).
 *
 * Sur tvOS, le moteur de focus ignore une vue d'opacité nulle. Android, non :
 * le champ caché reste candidat de la recherche géométrique, et une flèche
 * (HAUT depuis le champ de la recherche, mesuré à l'émulateur) y envoyait le
 * focus — hors écran, invisible. Il est donc NON focalisable hors saisie
 * (`HIDDEN_INPUT_PROPS`), libéré le temps de l'ouvrir (`openHiddenInput`).
 *
 * Et un clavier d'Android qu'on referme (Retour, validation) laisse le focus
 * au champ — tvOS le rend au bouton qui l'a ouvert. À la fermeture
 * (`keyboardDidHide`), le champ est rendu (`blur` : sa fin de saisie suit),
 * reverrouillé, et le focus va où l'appelant le dit (`returnFocus`) ; sans
 * lui, la règle de l'écran le pose (la recherche : tv-core `searchSubmitStep`).
 */

export const HIDDEN_INPUT_PROPS: Partial<TextInputProps> = { focusable: false };

type Settable = { setNativeProps?: (props: object) => void };

export function openHiddenInput(input: TextInput, returnFocus?: () => void): void {
  (input as unknown as Settable).setNativeProps?.({ focusable: true });
  // Le prop natif d'abord, la demande de focus à l'image suivante : elle échoue sur une vue non focalisable.
  requestAnimationFrame(() => {
    input.focus();
    const subscription = Keyboard.addListener("keyboardDidHide", () => {
      subscription.remove();
      if (input.isFocused()) input.blur();
      (input as unknown as Settable).setNativeProps?.({ focusable: false });
      returnFocus?.();
    });
  });
}
