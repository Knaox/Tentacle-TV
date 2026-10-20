import { useEffect, useRef, type MutableRefObject } from "react";
import { getClockRttMs } from "../../socket/clockSync";
import { getSocketStatus, onSocketStatus } from "../../socket/tentacleSocket";
import { TICKS_PER_SECOND } from "@tentacle-tv/shared";
import type { PlayerTransportRef } from "../playerPort";
import { isSettledOn, type GroupSyncSharedRefs } from "./groupSyncRefs";
import { wtLog } from "../wtLog";

/**
 * Watch Together — la reconnexion d'un lecteur en séance : ce qui a pu se
 * perdre pendant la coupure. `sendSocketMessage` jette les messages tant que le
 * socket est fermé ; un « prêt » perdu gèlerait la salle jusqu'au balayage. À
 * chaque réouverture, le lecteur redit où il en est (le fournisseur ne
 * redemande, lui, que l'état). Sorti de `useGroupIntents` (plafond des 300 lignes).
 */
export function useGroupReconnect({
  active,
  shared,
  transportRef,
  declaredRef,
  sendPresence,
  posTicks,
}: {
  active: boolean;
  shared: GroupSyncSharedRefs;
  transportRef: PlayerTransportRef;
  declaredRef: MutableRefObject<boolean>;
  sendPresence: () => void;
  posTicks: () => number;
}): void {
  const wasOpenRef = useRef(getSocketStatus() === "open");
  useEffect(() => {
    if (!active) return;
    return onSocketStatus((status) => {
      const open = status === "open";
      const reopened = open && !wasOpenRef.current;
      wasOpenRef.current = open;
      if (!reopened || !declaredRef.current) return;
      wtLog("engine", "reconnexion : re-déclaration presence + buffering");
      sendPresence();
      const last = shared.lastBufferingSentRef.current;
      if (last === null) return;
      // Posé sur la cible d'une barrière : le « prêt » a pu se perdre pendant la
      // coupure — il repart AVEC l'identifiant (sans lui, le serveur n'y lit
      // qu'une fin de chargement, pas un « posé »).
      const r = shared.roomRef.current;
      const t = transportRef.current;
      const barrierId = last === false && r?.barrierId !== undefined && t
        && isSettledOn(t, r.positionTicks / TICKS_PER_SECOND) ? r.barrierId : undefined;
      // En plein chargement, aucune position : celle d'un lecteur qui n'a rien
      // lu ramènerait la salle en arrière (`wtBufferingFreezeSeconds`).
      shared.sendRef.current({
        type: "wt:buffering", buffering: last, rttMs: getClockRttMs() ?? undefined,
        ...(last ? {} : { positionTicks: posTicks() }), ...(barrierId !== undefined ? { barrierId } : {}),
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, sendPresence, posTicks]);
}
