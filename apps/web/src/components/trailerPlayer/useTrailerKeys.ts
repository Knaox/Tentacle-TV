/**
 * Le clavier du lecteur des bandes-annonces, branché sur la fenêtre tant
 * qu'il est ouvert (table pure : `trailerPlayerKeys.ts`). Pris en phase de
 * CAPTURE et arrêté là : la fiche dessous ne reçoit rien — son Échap ne
 * ferme jamais la fiche, ses flèches ne font pas défiler ses rangées. Une
 * saisie dans un champ garde ses touches.
 */

import { useEffect, useRef } from "react";
import { trailerKeyAction, type TrailerKeyAction } from "./trailerPlayerKeys";

/** Un champ de saisie — pas le curseur du volume, qui laisse le clavier au lecteur. */
const isTyping = (target: EventTarget | null) => {
  if (target instanceof HTMLInputElement) return !["range", "checkbox", "button"].includes(target.type);
  return target instanceof HTMLElement && (target.isContentEditable || /^(TEXTAREA|SELECT)$/.test(target.tagName));
};

export function useTrailerKeys(onAction: (action: TrailerKeyAction) => void, enabled = true): void {
  const latest = useRef(onAction);
  latest.current = onAction;

  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return;
      const action = trailerKeyAction(event);
      if (!action) return;
      event.preventDefault();
      event.stopPropagation();
      latest.current(action);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [enabled]);
}
