import type { FocusStore } from "../../tvos/focus/focusStore";

/**
 * Android TV — une Modal (un `Dialog`) retirée rend le focus à ce qui
 * l'avait, dans la fenêtre de l'activité, SANS événement de focus : la
 * reprise annoncée de l'Apple TV ne part jamais. On réclame donc `key` d'office,
 * à l'image suivante — une fois le retrait de la Modal parti au natif.
 */
export function claimAfterModalExit(focus: FocusStore, key: string | null): void {
  if (!key) return;
  requestAnimationFrame(() => focus.claim(key));
}
