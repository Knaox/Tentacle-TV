import type { TrailerFocusView } from "@tentacle-tv/tv-core";
import type { FocusStore } from "../focus/focusStore";

/**
 * Les voisins de la bande-annonce par `nextFocus*` — sur Apple TV : RIEN.
 * tvOS ne les honore pas sur cet écran (mesuré au banc, comme au jumelage :
 * posés, relus, sans effet) ; ce sont les PONTS armés selon le focus qui
 * l'emportent sur la géométrie (`trailerBridges.tsx`). Android TV a sa
 * variante (`trailerNeighbors.android.ts`).
 */
export function applyTrailerNeighbors(_store: FocusStore, _key: string, _view: TrailerFocusView, _lastTool: string | null): void {}
