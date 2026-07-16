import { useCallback, useEffect, useRef, useState } from "react";
import { TICKS_PER_SECOND, wtPositionSecondsAt, type MediaItem } from "@tentacle-tv/shared";
import { useWatchTogether } from "./WatchTogetherProvider";

/**
 * Watch Together — adaptation de la session de lecture au mode groupe :
 * - position de départ : position extrapolée du groupe si on REJOINT le média
 *   en cours ; reprise Jellyfin du lanceur si on LANCE un média (« Reprendre la
 *   lecture » reprend où il en était — figée seulement quand l'item est chargé,
 *   la reprise n'étant pas connue avant) ; recalculée à CHAQUE item (la page
 *   /watch reste montée d'un épisode à l'autre) ; injectée dans startTicks pour
 *   que le stream (transcode) démarre directement au bon endroit ;
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

  // Position de départ figée une fois PAR ITEM (un state ultérieur ne doit pas
  // re-déclencher un chargement du player). Keyée par itemId : la page /watch
  // reste montée d'un épisode à l'autre (même route) — sans clé, la position du
  // premier épisode fuirait vers les suivants (démarrage à ~1/3 d'un épisode vierge).
  const [groupStart, setGroupStart] = useState<{ forItemId: string; seconds: number } | undefined>(undefined);
  useEffect(() => {
    if (!active || !room || !itemId || groupStart?.forItemId === itemId) return;
    if (room.itemId === itemId) {
      // Join du média en cours (ou item déjà broadcasté — épisode suivant) :
      // position vraie du groupe.
      setGroupStart({ forItemId: itemId, seconds: Math.max(0, wtPositionSecondsAt(room, serverNow())) });
    } else if (itemReady) {
      // Lancement d'un média pour le groupe : SA reprise (0 sinon).
      setGroupStart({ forItemId: itemId, seconds: Math.max(0, resumePositionSeconds ?? 0) });
    }
  }, [groupStart, active, room, itemId, itemReady, resumePositionSeconds, serverNow]);

  const groupStartSeconds =
    active && groupStart !== undefined && groupStart.forItemId === itemId ? groupStart.seconds : undefined;

  // Injecte la position dans startTicks dès qu'elle est figée — avant le fetch
  // PlaybackInfo (déclenché par prefsReady) : un stream transcodé démarre alors
  // directement à la bonne position, sans double chargement.
  const setStartTicksRef = useRef(setStartTicks);
  setStartTicksRef.current = setStartTicks;
  useEffect(() => {
    if (groupStartSeconds !== undefined && groupStartSeconds > 1) {
      setStartTicksRef.current(Math.floor(groupStartSeconds * TICKS_PER_SECOND));
    }
  }, [groupStartSeconds]);

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
    groupStartPositionSeconds: groupStartSeconds,
    handleNextEpisode: active ? groupNextEpisode : handleNextEpisode,
    handlePreviousEpisode: active ? groupPreviousEpisode : handlePreviousEpisode,
  };
}
