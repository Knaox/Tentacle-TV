/**
 * La préparation À L'INTENTION : le pointeur (ou le focus) reste 300 ms sur
 * le bouton « Bande-annonce », et le serveur prépare la vidéo — extraction,
 * maître, premières listes (`/prepare`) — pendant qu'on hésite : le départ
 * est immédiat. Jamais au simple affichage de la fiche : ouvrir une fiche ne
 * coûte aucune extraction. Une fois par vidéo et par montage.
 */

import { useCallback, useEffect, useRef } from "react";
import { prepareTrailerPlayback } from "@tentacle-tv/api-client";
import { trailerItemKey, type RelayedTrailerPlayback } from "@tentacle-tv/shared";

const INTENT_MS = 300;

export interface TrailerIntentHandlers {
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  onFocus: () => void;
  onBlur: () => void;
}

export function useTrailerIntent(playback: RelayedTrailerPlayback | null): TrailerIntentHandlers {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const prepared = useRef(new Set<string>());
  const latest = useRef(playback);
  latest.current = playback;
  useEffect(() => () => clearTimeout(timer.current), []);

  const arm = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const target = latest.current;
      if (!target) return;
      const key = trailerItemKey(target);
      if (prepared.current.has(key)) return;
      prepared.current.add(key);
      prepareTrailerPlayback(target);
    }, INTENT_MS);
  }, []);
  const disarm = useCallback(() => clearTimeout(timer.current), []);

  return { onPointerEnter: arm, onPointerLeave: disarm, onFocus: arm, onBlur: disarm };
}
