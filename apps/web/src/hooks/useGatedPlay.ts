import { useCallback, useRef } from "react";

/**
 * La lecture, filtrée par la séance Watch Together.
 *
 * Hors séance, chaque geste va droit au lecteur. En séance, une LECTURE
 * demandée alors que le lecteur est en pause passe d'abord par `onRequestPlay`
 * (le moteur de sync) : s'il la prend en charge, le lecteur ne bouge pas —
 * la salle repartira à un instant commun. La pause, elle, reste immédiate.
 * `onRequestPlay` rend faux dès que le chemin natif reste le bon (hors
 * séance, salle déjà en lecture, socket fermé…) : rien ne change alors.
 *
 * Les arguments sont lus au moment du geste : les rappels rendus sont stables.
 */
export function useGatedPlay({
  rawToggle,
  rawPlay,
  isPaused,
  onRequestPlay,
}: {
  rawToggle: () => void;
  rawPlay: () => void;
  isPaused: () => boolean;
  onRequestPlay?: () => boolean;
}): { toggle: () => void; play: () => void } {
  const latest = useRef({ rawToggle, rawPlay, isPaused, onRequestPlay });
  latest.current = { rawToggle, rawPlay, isPaused, onRequestPlay };

  const toggle = useCallback(() => {
    const { rawToggle: t, isPaused: p, onRequestPlay: request } = latest.current;
    if (p() && request?.()) return;
    t();
  }, []);

  const play = useCallback(() => {
    const { rawPlay: r, isPaused: p, onRequestPlay: request } = latest.current;
    if (p() && request?.()) return;
    r();
  }, []);

  return { toggle, play };
}
