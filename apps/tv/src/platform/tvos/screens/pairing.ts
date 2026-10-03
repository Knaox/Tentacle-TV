import { useEffect, useState } from "react";
import type { TextInput } from "react-native";
import {
  LOGIN_ERROR_RESTORE_MS,
  PAIRING_ACTIONS_GROUP,
  PAIRING_BACK_BAR_KEY,
  PAIRING_BACK_KEY,
  PAIRING_CARD_GROUP,
  PAIRING_SIDE_GROUP,
  loginErrorReclaim,
} from "@tentacle-tv/tv-core";
import { useBackFocus } from "../../../redesignWiring/focus/backFocus";
import { AutoFocusGuide } from "../focus/focusGuides";
import type { FocusStore } from "../focus/focusStore";

/**
 * L'applicateur tvOS du JUMELAGE — les décisions sont celles de tv-core
 * (`focus/pairingFocus.ts`, `session/loginForm.ts`, `nav/screenBack.ts` ;
 * relevé JU-1 à JU-7) ; ce module ne fait que les poser : les guides de
 * l'écran, la croix Retour reverrouillée à chaque étape, l'entrée réclamée,
 * le mot de passe rendu après un refus, et le geste natif qui ouvre le clavier
 * système d'un champ.
 */

/**
 * Ouvrir le clavier système d'un champ (le `TextInput` invisible de
 * `PairingField`). Il oublie d'abord un focus périmé : un clavier qui n'a pas
 * paru laisse React Native croire le champ focalisé, et `focus()` n'y faisait
 * plus RIEN — OK sur le champ ne rouvrait plus le clavier (mesuré). Toujours
 * sur un appui : demandé pendant qu'un autre clavier se retire, il ne s'ouvre
 * pas (mesuré).
 */
export function openPairingKeyboard(field: TextInput): void {
  if (field.isFocused()) field.blur();
  field.focus();
}

/** Les guides naissent avec l'écran, avant son premier rendu : un groupe se lie dès qu'il paraît. */
export function usePairingGroups(store: FocusStore): void {
  useState(() => {
    store.bind(PAIRING_SIDE_GROUP, { container: AutoFocusGuide });
    store.bind(PAIRING_CARD_GROUP, { container: AutoFocusGuide });
    // BAS depuis le mot de passe : « Se connecter » d'abord. Laissé à la
    // géométrie, tvOS prenait le bouton le plus proche du centre du champ —
    // le recours (un `nextFocusDown` posé sur le champ n'y fait rien, mesuré).
    store.bind(PAIRING_ACTIONS_GROUP, { container: AutoFocusGuide });
  });
}

/** La croix (reverrouillée à chaque étape, `arrival`) et l'entrée, réclamée à chaque changement. */
export function usePairingFocus(store: FocusStore, { entryKey, arrival }: { entryKey: string | null; arrival: string }): void {
  useBackFocus(store, { backKey: PAIRING_BACK_KEY, barKey: PAIRING_BACK_BAR_KEY, entryKey, arrival });
  useEffect(() => (entryKey ? store.claim(entryKey) : undefined), [entryKey, store]);
}

/**
 * Un refus de connexion vide le mot de passe et lui donne le focus. Mais le
 * refus arrive souvent pendant que le clavier du mot de passe se retire, et
 * tvOS rend ENSUITE le focus au champ qui l'avait ouvert — l'identifiant —,
 * défaisant la réclamation (mesuré) : la règle dit de le rendre, une fois.
 */
export function useLoginErrorFocus(store: FocusStore, error: object | null): void {
  useEffect(() => {
    if (!error) return undefined;
    let cancelClaim: (() => void) | null = null;
    let watching = true;
    const unsubscribe = store.subscribe((focusKey, focused) => {
      if (!watching || !focused) return;
      const target = loginErrorReclaim(focusKey);
      if (!target) return;
      watching = false;
      cancelClaim = store.claim(target);
    });
    const timer = setTimeout(() => {
      watching = false;
    }, LOGIN_ERROR_RESTORE_MS);
    return () => {
      clearTimeout(timer);
      unsubscribe();
      cancelClaim?.();
    };
  }, [error, store]);
}
