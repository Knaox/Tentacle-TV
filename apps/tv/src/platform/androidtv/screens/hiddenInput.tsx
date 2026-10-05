import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import { Keyboard, NativeModules, StyleSheet, TextInput, View, findNodeHandle, type TextInputProps } from "react-native";

/**
 * Android TV — le champ CACHÉ qui porte la saisie au clavier système
 * (jumelage, profils, recherche : un vrai `TextInput` invisible, derrière un
 * bouton de la refonte qui l'ouvre).
 *
 * Sur tvOS, le moteur de focus ignore une vue d'opacité nulle. Android, non :
 * le champ restait candidat de la recherche géométrique — HAUT depuis le champ
 * de la recherche y envoyait le focus, hors écran (mesuré à l'émulateur). Et
 * `focusable={false}` n'y peut rien : seul `ReactViewManager` connaît cette
 * prop, pas celui du `TextInput`. Le champ vit donc dans une vue VERROUILLÉE
 * (`tvFocusable={false}` : `FOCUS_BLOCK_DESCENDANTS`), qui bloque aussi le
 * `focus()` programmé : elle est déverrouillée le temps de l'ouvrir (la
 * demande part à l'image suivante, une fois le prop natif posé), et
 * reverrouillée quand le champ perd le focus.
 *
 * Et hors mode tactile (une télécommande), react-native-tvos ne MONTRE pas le
 * clavier sur un `focus()` venu du JS — il le cache, et attend un OK sur le
 * champ lui-même : le module natif `TextEntry.showKeyboard` le montre, une
 * fois le champ focalisé.
 *
 * Un clavier d'Android qu'on referme (Retour, validation) laisse le focus au
 * champ — tvOS le rend au bouton qui l'a ouvert : à sa fermeture
 * (`keyboardDidHide`), le champ est rendu (`blur`, sa fin de saisie suit).
 *
 * L'appelant le manie comme un `TextInput` : `focus()`, `blur()`, `isFocused()`.
 */

type Settable = { setNativeProps?: (props: object) => void };

const textEntry = NativeModules.TextEntry as { showKeyboard?: (tag: number) => void } | undefined;

/** Le verrou natif d'Android (`ReactViewManager.setTvFocusable`), absent des types de React Native. */
const LOCKED_SHELL = { tvFocusable: false } as object;

export const HiddenTextInput = forwardRef<TextInput, TextInputProps>(function HiddenTextInput({ style, onBlur, ...props }, ref) {
  const shell = useRef<View>(null);
  const input = useRef<TextInput>(null);
  const lock = useCallback((locked: boolean) => (shell.current as unknown as Settable | null)?.setNativeProps?.({ tvFocusable: !locked }), []);

  useImperativeHandle(
    ref,
    () =>
      ({
        focus: () => {
          lock(false);
          requestAnimationFrame(() => {
            const field = input.current;
            if (!field) return;
            field.focus();
            const tag = findNodeHandle(field);
            if (tag !== null) textEntry?.showKeyboard?.(tag);
          });
        },
        blur: () => input.current?.blur(),
        isFocused: () => input.current?.isFocused() ?? false,
        clear: () => input.current?.clear(),
      }) as unknown as TextInput,
    [lock],
  );

  useEffect(() => {
    const subscription = Keyboard.addListener("keyboardDidHide", () => {
      if (input.current?.isFocused()) input.current.blur();
    });
    return () => subscription.remove();
  }, []);

  return (
    <View ref={shell} {...LOCKED_SHELL} style={style}>
      <TextInput
        ref={input}
        {...props}
        onBlur={(event) => {
          lock(true);
          onBlur?.(event);
        }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
});

/** Ouvrir le champ, puis, à la fermeture du clavier, rendre le focus où l'appelant le dit. */
export function openHiddenInput(input: TextInput, returnFocus?: () => void): void {
  input.focus();
  if (!returnFocus) return;
  const subscription = Keyboard.addListener("keyboardDidHide", () => {
    subscription.remove();
    returnFocus();
  });
}
