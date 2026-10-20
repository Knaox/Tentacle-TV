import { useCallback, useEffect, useRef } from "react";
import { WT_READY_PLACEMENT_TOLERANCE_S, wtPositionSecondsAt, wtReadyMisplaced, type WtRoomStateDto } from "@tentacle-tv/shared";
import type { PlayerTransportRef } from "../playerPort";
import { armEcho, type GroupSyncSharedRefs } from "./groupSyncRefs";
import { wtLog } from "../wtLog";

/** Sondage du lecteur pendant qu'il se pose. */
const PLACEMENT_POLL_MS = 150;
/** Au-delà, il se dit prêt là où il est (un saut qui n'atterrit pas ne retient pas la salle). */
const PLACEMENT_TIMEOUT_MS = 10_000;
/** Deux essais par chargement, pas plus. */
const PLACEMENT_ATTEMPTS = 2;

/**
 * Watch Together — « prêt » seulement une fois posé à sa position de départ
 * (banc mobile du 21/10 : un Android, prêt à 0 s quand la salle l'attendait à
 * 276 s, la faisait repartir, jouait depuis 0, sautait, et la regelait 9 s).
 *
 * Un « prêt » LOIN de la salle qui m'attend (`wtReadyMisplaced`) est retenu :
 * le lecteur se met en pause et se pose à la position de la salle, puis
 * `retry` redit « prêt ». Borné : deux essais, dix secondes chacun — ensuite il
 * se dit prêt là où il est, et la reprise commune le recale. Le sondage ne
 * dépend d'aucun nouveau signal du lecteur (le web n'en redonne pas forcément).
 */
export function useReadyPlacement(shared: GroupSyncSharedRefs, transportRef: PlayerTransportRef, itemId: string | undefined) {
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const attemptsRef = useRef(0);
  const stop = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  };
  // Un autre titre (la page de lecture reste montée d'un épisode à l'autre) : tout repart.
  useEffect(() => {
    attemptsRef.current = 0;
    return stop;
  }, [itemId]);

  /** Vrai : le « prêt » attend que le lecteur soit posé (`retry` le redira). */
  const holdUntilPlaced = useCallback((room: WtRoomStateDto, retry: () => void): boolean => {
    if (pollRef.current) return true;
    const t = transportRef.current;
    const now = shared.serverNowRef.current();
    if (!t || attemptsRef.current >= PLACEMENT_ATTEMPTS) return false;
    if (!wtReadyMisplaced(room, now, t.getPositionSeconds(), shared.selfIdRef.current)) return false;
    attemptsRef.current += 1;
    const target = wtPositionSecondsAt(room, now);
    wtLog("engine", "prêt loin de la salle qui m'attend → pause et calage avant de le dire", {
      posS: t.getPositionSeconds().toFixed(1), targetS: target.toFixed(1), attempt: attemptsRef.current,
    });
    armEcho(shared);
    if (!t.isPaused()) t.pause();
    t.seekTo(target);
    const startedAt = Date.now();
    pollRef.current = setInterval(() => {
      const player = transportRef.current;
      const placed = !!player && !player.isSeeking?.()
        && Math.abs(player.getPositionSeconds() - target) <= WT_READY_PLACEMENT_TOLERANCE_S;
      if (!placed && Date.now() - startedAt < PLACEMENT_TIMEOUT_MS) return;
      stop();
      retry();
    }, PLACEMENT_POLL_MS);
    return true;
  }, [shared, transportRef]);

  /** Un nouveau chargement (titre, « je cale ») : les essais repartent de zéro. */
  const reset = useCallback(() => {
    stop();
    attemptsRef.current = 0;
  }, []);

  return { holdUntilPlaced, reset };
}
