import { useEffect, useRef, useState } from "react";
import { createTouchScrub } from "@tentacle-tv/tv-core";
import { usePanGesture, useRemoteIntents } from "../platform/tvos/input";
import { PLAYER_TIMERS } from "./playerTimers";
import type { ScrubGestureHandlers } from "./scrubGestureTypes";

export type { ScrubGestureHandlers, ScrubDir } from "./scrubGestureTypes";

/**
 * Le défilement au pavé tactile — variante **Apple TV (tvOS)** : le glisser
 * (`drag`, l'entrée unique) va à l'interprète de tv-core
 * (`player/touchScrub.ts` : régimes, seuils, gains, silence), qui décide ;
 * ici, seulement la prise du pan (`usePanGesture`, au compteur : la vue
 * racine n'en a qu'un) et l'abonnement. Android TV n'a pas de pavé
 * (`useScrubGestures.ts`).
 */
export function useScrubGestures({
  enabled, readTouchMode, readLastPressAt, onTouchStart, onStartScrub, onNudgeScrub, onEndScrub, onWake, durationRef,
}: ScrubGestureHandlers): void {
  // Callbacks à jour sans recréer l'interprète.
  const cbRef = useRef({ readTouchMode, readLastPressAt, onTouchStart, onStartScrub, onNudgeScrub, onEndScrub, onWake });
  cbRef.current = { readTouchMode, readLastPressAt, onTouchStart, onStartScrub, onNudgeScrub, onEndScrub, onWake };
  usePanGesture(enabled);

  const [touch] = useState(() => createTouchScrub({
    readTouchMode: () => cbRef.current.readTouchMode(),
    onTouchStart: () => cbRef.current.onTouchStart(),
    onStartScrub: () => cbRef.current.onStartScrub(),
    onNudgeScrub: (delta) => cbRef.current.onNudgeScrub(delta),
    onEndScrub: () => cbRef.current.onEndScrub(),
    onWake: () => cbRef.current.onWake(),
    readDuration: () => durationRef.current,
    readLastPressAt: () => cbRef.current.readLastPressAt(),
  }, PLAYER_TIMERS));

  // Coupé (panneau ouvert, démontage) : le geste en cours n'a plus de suite.
  useEffect(() => {
    if (!enabled) touch.reset();
  }, [enabled, touch]);
  useEffect(() => () => touch.destroy(), [touch]);

  useRemoteIntents((event) => {
    const intent = event.intent;
    if (intent.type === "drag") touch.drag(intent.phase, intent.x, intent.y, intent.vx);
  }, enabled);
}
