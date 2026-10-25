/**
 * Octave — ‹ › : revenir à la page d'avant, ou avancer, DANS Octave.
 *
 * Le bureau n'a pas de bouton « Précédent » de navigateur : sans eux, un
 * album ouvert depuis un artiste était une impasse. L'historique est celui du
 * routeur ; on retient seulement où il en était à l'entrée du mode (`base`) et
 * jusqu'où il est allé (`max`) : revenir ne sort jamais d'Octave (le quitter
 * est le geste de la bascule), avancer s'éteint après une nouvelle page.
 */

import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useNavigationType, type NavigationType } from "react-router-dom";

/** Le type d'une navigation, en clair (les valeurs de l'énumération du routeur). */
export type HistoryMove = `${NavigationType}`;

export interface HistoryRange {
  base: number;
  at: number;
  max: number;
}

/** La place de l'entrée courante dans l'historique (posée par le routeur). */
function historyIndex(): number {
  const state: unknown = window.history.state;
  if (state && typeof state === "object" && "idx" in state && typeof state.idx === "number") return state.idx;
  return 0;
}

/** La règle, pure : où l'on est après une navigation de ce type. */
export function nextHistoryRange(range: HistoryRange, at: number, type: HistoryMove): HistoryRange {
  const base = Math.min(range.base, at);
  // Une page NOUVELLE efface ce qu'il y avait « devant » ; un retour ou un
  // remplacement le garde.
  const max = type === "PUSH" ? at : Math.max(range.max, at);
  return { base, at, max };
}

export function useOctaveHistory() {
  const location = useLocation();
  const type = useNavigationType();
  const navigate = useNavigate();
  const [range, setRange] = useState<HistoryRange>(() => {
    const at = historyIndex();
    return { base: at, at, max: at };
  });

  useEffect(() => {
    setRange((r) => nextHistoryRange(r, historyIndex(), type));
  }, [location.key, type]);

  const back = useCallback(() => navigate(-1), [navigate]);
  const forward = useCallback(() => navigate(1), [navigate]);
  return { canBack: range.at > range.base, canForward: range.at < range.max, back, forward };
}
