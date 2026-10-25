/**
 * Octave — l'anticipation portée par les gestes (contrat `PrefetchIntent`) :
 * - survol ou focus tenu 120 ms → `hover` (une rafale de survols ne coûte rien) ;
 * - appui commencé (mousedown, touchstart, pointerdown) → `press` : le clic
 *   arrive dans ~100 ms, la source se prépare pendant ce temps.
 */

import { useCallback, useEffect, useRef } from "react";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import { useOctavePlayer } from "./OctavePlayerProvider";

const HOVER_DWELL_MS = 120;

export interface PrefetchHandlers {
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  onFocus: () => void;
  onBlur: () => void;
  onPointerDown: () => void;
}

export function usePrefetchHandlers(tracks: () => readonly MusicTrack[]): PrefetchHandlers {
  const player = useOctavePlayer();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressed = useRef(false);
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;

  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const arm = useCallback(() => {
    cancel();
    timer.current = setTimeout(() => player.prefetch(tracksRef.current(), "hover"), HOVER_DWELL_MS);
  }, [cancel, player]);

  useEffect(() => cancel, [cancel]);

  return {
    onPointerEnter: arm,
    onFocus: arm,
    onPointerLeave: () => {
      cancel();
      pressed.current = false;
    },
    onBlur: cancel,
    onPointerDown: () => {
      cancel();
      if (pressed.current) return;
      pressed.current = true;
      player.prefetch(tracksRef.current(), "press");
      setTimeout(() => {
        pressed.current = false;
      }, 1_000);
    },
  };
}
