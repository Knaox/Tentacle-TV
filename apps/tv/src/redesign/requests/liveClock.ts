import { useEffect, useState } from "react";
import { unstable_batchedUpdates } from "react-native";
import { LIVE_PROGRESS } from "@tentacle-tv/tv-core";

/**
 * UNE horloge, une fois par seconde, pour toutes les vues qui font avancer une
 * demande entre deux lectures — jamais une par affiche. Elle ne bat que tant
 * qu'au moins une vue l'écoute : rien qui avance à l'écran, aucun minuteur.
 * Une seconde, pas une image : le pas de la barre de Vigie sur le téléphone,
 * invisible sur un camembert (un dixième de point), et rien d'animé image par
 * image (règles « Coût GPU » de CLAUDE.md).
 */

type Listener = (now: number) => void;

const listeners = new Set<Listener>();
let timer: ReturnType<typeof setInterval> | null = null;

function tick(): void {
  const now = Date.now();
  // Ancienne architecture : sans regroupement, chaque vue rendrait à part.
  unstable_batchedUpdates(() => listeners.forEach((listener) => listener(now)));
}

function listen(listener: Listener): () => void {
  listeners.add(listener);
  if (timer === null) timer = setInterval(tick, LIVE_PROGRESS.tickMs);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

/** L'heure (ms), rafraîchie chaque seconde tant que `enabled` ; figée sinon. */
export function useLiveNow(enabled: boolean): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!enabled) return undefined;
    setNow(Date.now());
    return listen(setNow);
  }, [enabled]);
  return now;
}
