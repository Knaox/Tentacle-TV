import type { MutableRefObject } from "react";
import type { RemuxInfo } from "./useTVRemuxInfo";

export interface TVEndFallbackArgs {
  /** Actif uniquement sur le remux local tvOS (les onEnd direct play/transcode sont fiables). */
  isLocalRemux: boolean;
  paused: boolean;
  jellyfinDuration?: number;
  positionRef: MutableRefObject<number>;
  infoRef: MutableRefObject<RemuxInfo | null>;
  reloadHoldRef: MutableRefObject<boolean>;
  softReloadRef: MutableRefObject<boolean>;
  endedRef: MutableRefObject<boolean>;
  /** handleEnd (via ref stable) : route vers auto-play eof ou retour fiche. */
  onEndRef: MutableRefObject<() => void>;
}

/**
 * Filet de détection de FIN — variante Android/défaut : NO-OP. Les lecteurs natifs
 * Android (ExoPlayer/MPV) et les flux Jellyfin (direct play, transcode) émettent un
 * onEnd fiable. Le détecteur de stagnation ne concerne que le remux local tvOS
 * (AVPlayer + playlist EVENT : bug connu de durée indéfinie après ENDLIST → onEnd
 * peut ne JAMAIS arriver). Cf. useTVEndFallback.ios.ts (résolution Metro).
 */
export function useTVEndFallback(_args: TVEndFallbackArgs): void {}
