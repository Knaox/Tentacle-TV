import { useEffect } from "react";
import { getClockRttMs } from "@tentacle-tv/api-client";
import { TICKS_PER_SECOND, WT_TICK_INTERVAL_MS } from "@tentacle-tv/shared";
import type { PlayerTransportRef } from "./playerTransport";
import type { GroupSyncSharedRefs } from "./groupSyncShared";

/**
 * Watch Together — la balise de ce lecteur, toutes les 5 s en séance : sa
 * position, l'instant serveur où il l'a lue, son aller-retour. Le serveur en
 * tire l'écart de chaque membre (diagnostic visible dans le panneau) et le
 * délai des reprises planifiées. Rien n'en commande la salle.
 */
export function useGroupTick({
  enabled,
  transportRef,
  shared,
}: {
  enabled: boolean;
  transportRef: PlayerTransportRef;
  shared: GroupSyncSharedRefs;
}) {
  useEffect(() => {
    if (!enabled) return;
    const beacon = setInterval(() => {
      const t = transportRef.current;
      if (!t || shared.lastBufferingSentRef.current !== false) return;
      shared.sendRef.current({
        type: "wt:tick",
        positionTicks: Math.max(0, Math.round(t.getPositionSeconds() * TICKS_PER_SECOND)),
        paused: t.isPaused(),
        atServerTime: shared.serverNowRef.current(),
        rttMs: getClockRttMs() ?? undefined,
      });
    }, WT_TICK_INTERVAL_MS);
    return () => clearInterval(beacon);
  }, [enabled, transportRef, shared]);
}
