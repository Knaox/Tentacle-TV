import { useEffect, useState } from "react";
import { createSkipFlash, type SkipFlashState } from "@tentacle-tv/tv-core";
import { PLAYER_TIMERS } from "./playerTimers";

/**
 * Le badge « +30 s / −10 s » d'un saut instantané, en état React : la règle
 * (cumul, effacement à 1,5 s) vit dans tv-core (`player/skipFlash.ts`).
 * L'écran d'Apple TV le rend (`SeekFlash`), celui d'Android TV aussi
 * (`TVSkipBadge`).
 */
export function useSkipFlash(): { skipFlash: SkipFlashState | null; flash: (delta: number) => void } {
  const [skipFlash, setSkipFlash] = useState<SkipFlashState | null>(null);
  const [badge] = useState(() => createSkipFlash({ onChange: setSkipFlash, timers: PLAYER_TIMERS }));
  useEffect(() => () => badge.destroy(), [badge]);
  return { skipFlash, flash: badge.flash };
}
