import { useCallback, useEffect, useRef, useState } from "react";
import { TICKS_PER_SECOND, wtPositionSecondsAt, type MediaItem } from "@tentacle-tv/shared";
import { useWatchTogether } from "./WatchTogetherProvider";

/**
 * Watch Together — adaptation de la session de lecture au mode groupe :
 * - position de départ : position extrapolée du groupe si on REJOINT le média
 *   en cours ; reprise Jellyfin du lanceur si on LANCE un média (« Reprendre la
 *   lecture » reprend où il en était — figée seulement quand l'item est chargé,
 *   la reprise n'étant pas connue avant) ; injectée dans startTicks pour que le
 *   stream (transcode) démarre directement au bon endroit ;
 * - épisode suivant/précédent (bouton, touche N/P, auto-next) → `wt:setItem`
 *   au lieu d'une navigation locale : tout le monde bascule via le broadcast
 *   (hors groupe : passthrough vers les handlers d'origine).
 */
export function useGroupPlaybackHandlers({
  itemId,
  itemReady,
  resumePositionSeconds,
  nextEpisode,
  previousEpisode,
  handleNextEpisode,
  handlePreviousEpisode,
  setStartTicks,
}: {
  itemId: string | undefined;
  /** L'item Jellyfin est chargé (sa reprise éventuelle est connue). */
  itemReady: boolean;
  /** Reprise Jellyfin de CE user pour cet item (undefined = début). */
  resumePositionSeconds: number | undefined;
  nextEpisode: MediaItem | null | undefined;
  previousEpisode: MediaItem | null | undefined;
  handleNextEpisode: () => void;
  handlePreviousEpisode: () => void;
  setStartTicks: (ticks: number) => void;
}) {
  const { room, send, serverNow, isInGroup } = useWatchTogether();
  const active = isInGroup && !!itemId;

  // Position de départ figée une fois (un state ultérieur ne doit pas
  // re-déclencher un chargement du player).
  const [groupStart, setGroupStart] = useState<number | undefined>(undefined);
  useEffect(() => {
    if (groupStart !== undefined || !active || !room) return;
    if (room.itemId === itemId) {
      // Join du média en cours : position vraie du groupe.
      setGroupStart(Math.max(0, wtPositionSecondsAt(room, serverNow())));
    } else if (itemReady) {
      // Lancement d'un média pour le groupe : SA reprise (0 sinon).
      setGroupStart(Math.max(0, resumePositionSeconds ?? 0));
    }
  }, [groupStart, active, room, itemId, itemReady, resumePositionSeconds, serverNow]);

  // Injecte la position dans startTicks dès qu'elle est figée — avant le fetch
  // PlaybackInfo (déclenché par prefsReady) : un stream transcodé démarre alors
  // directement à la bonne position, sans double chargement.
  const setStartTicksRef = useRef(setStartTicks);
  setStartTicksRef.current = setStartTicks;
  useEffect(() => {
    if (active && groupStart !== undefined && groupStart > 1) {
      setStartTicksRef.current(Math.floor(groupStart * TICKS_PER_SECOND));
    }
  }, [active, groupStart]);

  const groupNextEpisode = useCallback(() => {
    if (!active || !room) return handleNextEpisode();
    if (!nextEpisode?.Id) return;
    send({ type: "wt:setItem", itemId: nextEpisode.Id, fromItemId: room.itemId, reason: "nextEp" });
  }, [active, room, nextEpisode, send, handleNextEpisode]);

  const groupPreviousEpisode = useCallback(() => {
    if (!active || !room) return handlePreviousEpisode();
    if (!previousEpisode?.Id) return;
    send({ type: "wt:setItem", itemId: previousEpisode.Id, fromItemId: room.itemId, reason: "prevEp" });
  }, [active, room, previousEpisode, send, handlePreviousEpisode]);

  return {
    groupActive: active,
    groupStartPositionSeconds: active ? groupStart : undefined,
    handleNextEpisode: active ? groupNextEpisode : handleNextEpisode,
    handlePreviousEpisode: active ? groupPreviousEpisode : handlePreviousEpisode,
  };
}
