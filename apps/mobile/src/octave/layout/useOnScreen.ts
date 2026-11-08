/**
 * Octave (mobile) — le crochet de `onScreen.ts` : ce qui vit SOUS le lecteur plein écran (les pages, le
 * mini-lecteur) se voit-il ? App au premier plan, page regardée (`useOctavePageFocused`), lecteur plein écran
 * fermé. Ce qui vit DANS le lecteur plein écran ne lit que `useAppActive` (il n'existe qu'ouvert).
 */

import { useAppActive } from "../player/ambient/useAppActive";
import { useNowPlayingOpen } from "../player/nowPlayingStore";
import { shownBeneathPlayer } from "./onScreen";
import { useOctavePageFocused } from "./pageFocus";

export function useShownBeneathPlayer(): boolean {
  const appActive = useAppActive();
  const pageFocused = useOctavePageFocused();
  const playerOpen = useNowPlayingOpen();
  return shownBeneathPlayer({ appActive, pageFocused, playerOpen });
}
