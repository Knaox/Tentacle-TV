import { useCallback, useEffect, useRef } from "react";
import type { View } from "react-native";
import { SEARCH_SUBMIT_WAIT_MS, type SearchSubmitAnswer } from "@tentacle-tv/tv-core";
import { claimTvFocus } from "../../hooks/useTvFocusClaim";
import { useTVRemote } from "../focus/useTVRemote";

/** Filet : le clavier est parti sans que la barre ait signalé le focus rendu. */
const KEYBOARD_GONE_MS = 800;

/** Une fermeture qui suit une validation de si près en est la suite, pas un Menu. */
const CLOSE_AFTER_SUBMIT_MS = 1000;

/**
 * « Rechercher » au clavier système de l'Apple TV mène aux résultats.
 *
 * tvOS referme son clavier plein écran à la validation — webOS, lui, le
 * gardait —, mais il rendait le focus à la BARRE : les résultats étaient là,
 * derrière, et il fallait encore aller les chercher. La règle est celle de la
 * LG (`searchSubmitAnswer`, tv-core) : au premier résultat si la réponse à ce
 * qui est tapé est affichée ; celle qui arrive peu après y mène encore, tant
 * qu'aucune touche n'a été pressée depuis. Sinon le focus reste à la barre.
 *
 * **Le moment compte.** Une réclamation posée pendant que le clavier se retire
 * est perdue : tvOS rend ensuite le focus à ce qui l'avait avant de le
 * présenter. On attend donc que la barre l'ait repris — le signe que le
 * clavier est bel et bien parti —, avec un minuteur pour le cas où ce signe
 * ne viendrait pas.
 *
 * Android TV n'a pas de clavier système ici (sa barre n'est qu'un affichage) :
 * rien n'y appelle `onSubmit`, le crochet y reste inerte.
 */
export function useSearchSubmit(answer: SearchSubmitAnswer, onKeyboardClosed: () => void) {
  const first = useRef<View | null>(null);
  /** La validation en cours : son heure, et si le clavier est parti. */
  const submitted = useRef<{ since: number; gone: boolean } | null>(null);
  const answerRef = useRef(answer);
  answerRef.current = answer;
  const cancelClaim = useRef<() => void>(() => {});
  const goneTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const land = useCallback(() => {
    const pending = submitted.current;
    if (!pending?.gone) return;
    const late = Date.now() - pending.since > SEARCH_SUBMIT_WAIT_MS;
    if (answerRef.current === "pending" && !late) return;
    submitted.current = null;
    if (answerRef.current !== "results" || late || !first.current) return;
    cancelClaim.current();
    cancelClaim.current = claimTvFocus(first.current);
  }, []);

  const keyboardGone = useCallback(() => {
    const pending = submitted.current;
    if (!pending || pending.gone) return;
    clearTimeout(goneTimer.current);
    pending.gone = true;
    land();
  }, [land]);

  const lastSubmit = useRef(0);
  const onSubmit = useCallback(() => {
    lastSubmit.current = Date.now();
    submitted.current = { since: lastSubmit.current, gone: false };
  }, []);

  // Validation ou Menu : seul Menu garde le comportement d'avant. L'heure de
  // la validation, et non son état : la barre peut avoir repris le focus — et
  // la réclamation être partie — avant que la fermeture ne soit annoncée.
  const onClosed = useCallback(() => {
    const pending = submitted.current;
    if (!pending) {
      if (Date.now() - lastSubmit.current > CLOSE_AFTER_SUBMIT_MS) onKeyboardClosed();
      return;
    }
    if (pending.gone) return;
    clearTimeout(goneTimer.current);
    goneTimer.current = setTimeout(keyboardGone, KEYBOARD_GONE_MS);
  }, [onKeyboardClosed, keyboardGone]);

  useEffect(() => {
    land();
  }, [answer, land]);

  // Une touche pressée après le départ du clavier : l'utilisateur a pris la main.
  useTVRemote({
    onAnyPress: () => {
      if (submitted.current?.gone) submitted.current = null;
    },
  });

  useEffect(() => () => {
    clearTimeout(goneTimer.current);
    cancelClaim.current();
  }, []);

  const setFirstResult = useCallback((node: View | null) => {
    first.current = node;
  }, []);

  return { onSubmit, onKeyboardClosed: onClosed, onBarFocus: keyboardGone, setFirstResult };
}
