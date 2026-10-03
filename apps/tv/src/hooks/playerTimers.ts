import type { PlayerTimers } from "@tentacle-tv/tv-core";

/**
 * Les minuteurs du moteur JS, pour les machines du lecteur de tv-core (qui
 * n'en arment aucun d'elles-mêmes) — Apple TV et Android TV. Lus au moment de
 * l'appel : une horloge factice posée après coup (banc de traces) est bien
 * celle qui sert.
 */
export const PLAYER_TIMERS: PlayerTimers = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};
