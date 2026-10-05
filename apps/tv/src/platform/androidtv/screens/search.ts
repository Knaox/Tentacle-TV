import { useCallback, useMemo, useRef } from "react";
import { useSpeechRecognition } from "../../../hooks/useSpeechRecognition";
import type { SearchDictation } from "../../shared/screens/searchDictation";

/**
 * L'applicateur Android TV de la RECHERCHE — le même écran que l'Apple TV, la
 * même règle (tv-core `search/` : le champ, la validation, la barre rendue au
 * retour d'une étagère, que l'applicateur commun déroule). Deux choses
 * changent, la SAISIE seulement :
 *
 * - le champ ouvre le clavier système d'Android (Gboard, clavier Leanback),
 *   comme il ouvre celui de tvOS, par le champ caché de la plateforme
 *   (`HiddenTextInput`) : verrouillé hors saisie, et rendu à la fermeture du
 *   clavier — sa fin de saisie (`onEndEditing`) suit, et la
 *   règle commune rend le focus au clavier de l'écran
 *   (`SEARCH_KEYBOARD_CLOSED_KEY`), ou au premier résultat après une
 *   validation — comme sur Apple TV ;
 * - la dictée est celle de l'APP, par la touche micro du clavier à l'écran
 *   (`useSpeechRecognition`, le module natif `VoiceRecognition`) — tvOS
 *   refuse le micro aux apps, Android le permet : la phrase reconnue remplace
 *   la saisie, comme une suggestion choisie.
 */

export { useSearchGroups, useSearchKeyboard } from "../../tvos/screens/search";

export type { SearchDictation };

/** La dictée de l'app : la touche micro, qui écoute ou s'arrête ; la phrase reconnue devient la saisie. */
export function useSearchDictation(onResult: (text: string) => void): SearchDictation {
  const latest = useRef(onResult);
  latest.current = onResult;
  const speech = useSpeechRecognition({ onResult: (text) => latest.current(text) });
  const { isListening, isPending, isAvailable, startListening, stopListening } = speech;
  const listening = isListening || isPending;
  const onMic = useCallback(() => (listening ? stopListening() : startListening()), [listening, startListening, stopListening]);
  // Le micro n'existe pas sur cet appareil : le clavier système garde la saisie, et sa propre dictée.
  return useMemo(
    (): SearchDictation => (isAvailable ? { dictation: "systemAndKey", listening, onMic } : { dictation: "system" }),
    [isAvailable, listening, onMic],
  );
}
