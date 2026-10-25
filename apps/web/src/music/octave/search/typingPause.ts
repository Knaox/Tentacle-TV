/**
 * Octave — la PAUSE DE FRAPPE de la barre de recherche, pour qui veut s'y abonner (la recherche préparée du
 * bureau, axe R7 : accordée par Damien, bureau seulement). Ce module ne cherche RIEN et n'affiche rien : il dit
 * qu'un texte d'au moins 3 caractères est resté tel quel 600 ms, une fois par texte. Sans abonné, rien ne se passe.
 */

import { useEffect } from "react";

export const TYPING_PAUSE_MS = 600;
export const TYPING_PAUSE_MIN_CHARS = 3;

type Listener = (text: string) => void;
const listeners = new Set<Listener>();

/** S'abonner aux pauses de frappe ; rend le désabonnement. */
export function onTypingPause(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** À appeler avec le texte de la barre à chaque rendu : la pause est signalée une fois par texte stable. */
export function useTypingPause(text: string): void {
  useEffect(() => {
    const typed = text.trim();
    if (typed.length < TYPING_PAUSE_MIN_CHARS || listeners.size === 0) return;
    const timer = setTimeout(() => {
      for (const listener of listeners) listener(typed);
    }, TYPING_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [text]);
}
