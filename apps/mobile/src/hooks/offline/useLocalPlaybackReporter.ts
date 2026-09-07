import { useCallback, useEffect, useRef } from "react";
import { useTentacleConfig, type PlaybackReporter } from "@tentacle-tv/api-client";
import { localPlaybackState } from "@tentacle-tv/offline-core";
import { purgeDue, restartLocalPlayback, savePlaybackState, type OfflineLocalSource } from "@/offline/engineApi";
import { syncPlaybackState } from "@/offline/resync";
import { useConnectivity } from "@/offline/useConnectivity";
import { useServerUrl } from "@/providers/ServerUrlContext";

const SAVE_INTERVAL_MS = 10_000;

interface Options {
  userId: string | null;
  itemId: string;
  localSource: OfflineLocalSource;
  /** Position courante en secondes (ref partagée avec le lecteur). */
  positionRef: { current: number };
  durationSeconds: number;
  /** Seuil du « vu » = MaxResumePct de Jellyfin (repli 90). */
  maxResumePct: number;
}

/**
 * Le rapporteur d'une lecture LOCALE — rien ne part pendant la lecture :
 * toutes les 10 s la position et l'état « vu » vont en SQLite, doublés dans
 * la file de resynchronisation ; à l'arrêt (idempotent), l'écriture finale
 * puis, en ligne, la synchronisation de ce titre ; « supprimer après visionnage »
 * purge tout de suite si le seuil est atteint. Un titre déjà vu qu'on
 * relance repart à neuf localement.
 */
export function useLocalPlaybackReporter({ userId, itemId, localSource, positionRef, durationSeconds, maxResumePct }: Options): PlaybackReporter {
  const { serverUrl } = useServerUrl();
  const { storage } = useTentacleConfig();
  const { state } = useConnectivity();
  const onlineRef = useRef(true);
  onlineRef.current = state === "online" || state === "checking";
  const durationRef = useRef(durationSeconds);
  durationRef.current = durationSeconds;
  const thresholdRef = useRef(maxResumePct);
  thresholdRef.current = maxResumePct;
  const stoppedRef = useRef(false);
  const lastStopPromiseRef = useRef<Promise<void>>(Promise.resolve());

  const snapshot = useCallback(
    () => localPlaybackState(positionRef.current, durationRef.current, thresholdRef.current),
    [positionRef],
  );

  const persist = useCallback(() => {
    if (userId === null) return;
    const { ticks, played } = snapshot();
    if (ticks <= 0 && !played) return;
    try {
      savePlaybackState(userId, itemId, ticks, played, true);
    } catch {
      // La base locale répondra au prochain tour.
    }
  }, [userId, itemId, snapshot]);

  useEffect(() => {
    if (userId === null) return;
    stoppedRef.current = false;
    // Déjà vu : on repart à neuf, l'échéance de suppression est levée.
    if (localSource.played) restartLocalPlayback(userId, itemId);
    const interval = setInterval(persist, SAVE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [userId, itemId, localSource.played, persist]);

  const reportStop = useCallback((): Promise<void> => {
    if (stoppedRef.current || userId === null) return lastStopPromiseRef.current;
    stoppedRef.current = true;
    const { ticks, played } = snapshot();
    if (ticks > 0 || played) persist();
    const token = storage.getItem("tentacle_token");
    const done = (async () => {
      // Ce titre seul : son rapport part, et l'état serveur (vu ailleurs
      // entre-temps ?) revient — le seul échange réseau d'une lecture locale.
      if (onlineRef.current && serverUrl && token) await syncPlaybackState(serverUrl, token, userId, "pending");
      // L'échéance a été posée par l'écriture finale ; la purge immédiate
      // couvre le délai « immédiatement » (titre exempté de la garde de lecture).
      if (localSource.autoDeleteAfterWatch && played) purgeDue(itemId);
    })().catch(() => undefined);
    lastStopPromiseRef.current = done;
    return done;
  }, [userId, itemId, snapshot, persist, storage, serverUrl, localSource.autoDeleteAfterWatch]);

  const noop = useCallback(() => undefined, []);
  return { reportStart: noop, updatePosition: noop, reportSeek: noop, reportStop, lastStopPromiseRef };
}
