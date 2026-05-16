import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useJellyfinClient, useUserId } from "@tentacle-tv/api-client";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { setPlayingMedia } from "../auth/playbackGuard";

/**
 * Centralise les effets lifecycle du PlayerScreen TV :
 *  - playbackGuard (empêche logout intempestif)
 *  - invalidations queryClient au démontage
 *  - écoute AppState (pause + rapport position en arrière-plan)
 *  - helpers `invalidateAndGoBack` et `handleFinished`
 *
 * Les refs `pausedStateRef` et `reportSeekRef` sont fournies par le caller pour
 * que le listener AppState reste stable ([] deps) sans capter de closures.
 */
export function useTVPlaybackLifecycle(args: {
  itemId: string;
  seriesId?: string;
  navigation: NativeStackNavigationProp<RootStackParamList, "Player">;
  reportStop: () => Promise<void> | void;
  positionRef: React.MutableRefObject<number>;
  pausedStateRef: React.MutableRefObject<boolean>;
  reportSeekRef: React.MutableRefObject<(pos: number, paused: boolean) => void>;
  /** Appelé lors d'un passage en arrière-plan pour mettre en pause. */
  onBackground?: () => void;
}) {
  const { itemId, seriesId, navigation, reportStop, positionRef, pausedStateRef, reportSeekRef, onBackground } = args;
  const onBackgroundRef = useRef(onBackground);
  onBackgroundRef.current = onBackground;
  const queryClient = useQueryClient();
  const client = useJellyfinClient();
  const userId = useUserId();

  useEffect(() => {
    setPlayingMedia(true);
    return () => { setPlayingMedia(false); };
  }, []);

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["item", itemId] });
    queryClient.invalidateQueries({ queryKey: ["resume-items"] });
    queryClient.invalidateQueries({ queryKey: ["latest-items"] });
    queryClient.invalidateQueries({ queryKey: ["next-up"] });
    queryClient.invalidateQueries({ queryKey: ["watchlist"] });
  }, [queryClient, itemId]);

  const invalidateAndGoBack = useCallback(async () => {
    await reportStop();
    client.fetch(`/Users/${userId}/Items/${itemId}/Rating`, { method: "DELETE" }).catch(() => {});
    invalidateAll();
    navigation.goBack();
  }, [reportStop, invalidateAll, navigation, client, userId, itemId]);

  const handleFinished = useCallback(async () => {
    await reportStop();
    client.fetch(`/Users/${userId}/Items/${itemId}/Rating`, { method: "DELETE" }).catch(() => {});
    invalidateAll();
    if (seriesId) navigation.replace("MediaDetail", { itemId: seriesId });
    else navigation.goBack();
  }, [reportStop, invalidateAll, navigation, client, userId, itemId, seriesId]);

  // Unmount cleanup
  const reportStopRef = useRef(reportStop);
  reportStopRef.current = reportStop;
  useEffect(() => () => {
    reportStopRef.current();
    queryClient.invalidateQueries({ queryKey: ["item", itemId] });
    queryClient.invalidateQueries({ queryKey: ["resume-items"] });
    queryClient.invalidateQueries({ queryKey: ["latest-items"] });
    queryClient.invalidateQueries({ queryKey: ["next-up"] });
    queryClient.invalidateQueries({ queryKey: ["watchlist"] });
  }, [queryClient, itemId]);

  // AppState : pause + sauvegarde progression en arrière-plan.
  // reportSeek (Progress) plutôt que reportStop pour garder startedRef vivant.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background" || state === "inactive") {
        onBackgroundRef.current?.();
        reportSeekRef.current(positionRef.current, true);
      } else if (state === "active") {
        reportSeekRef.current(positionRef.current, pausedStateRef.current);
      }
    });
    return () => sub.remove();
  }, [positionRef, pausedStateRef, reportSeekRef]);

  return { invalidateAndGoBack, handleFinished };
}
