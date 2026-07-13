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
  /** Ré-arme une session Jellyfin au retour au premier plan (POST /Sessions/Playing). */
  reportStartRef: React.MutableRefObject<(pos?: number) => void>;
  /** Appelé lors d'un passage en arrière-plan pour mettre en pause. */
  onBackground?: () => void;
  /** Appelé au RETOUR au premier plan (re-signalé à 0,4/1,5/3 s — après une VRAIE
   *  suspension la scène UIKit se réattache lentement, un seul tir part trop tôt) :
   *  tvOS PERD le focus natif au passage en arrière-plan — sans re-signal, plus
   *  aucun bouton n'est focalisé au retour (l'OSD de pause étant déjà visible,
   *  aucune transition ne re-déclenche le refocus) → les appuis OK tombent dans
   *  le vide et la lecture est impossible à relancer. Doit être idempotent. */
  onForeground?: () => void;
}) {
  const { itemId, seriesId, navigation, reportStop, positionRef, pausedStateRef, reportSeekRef, reportStartRef, onBackground, onForeground } = args;
  const onBackgroundRef = useRef(onBackground);
  onBackgroundRef.current = onBackground;
  const onForegroundRef = useRef(onForeground);
  onForegroundRef.current = onForeground;
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
    // État de visionnage de la fiche série : bouton Reprendre (watch state),
    // progress/badges de la liste d'épisodes — sinon la position vue pendant
    // la lecture n'apparaît pas au retour (cache 60s).
    if (seriesId) {
      queryClient.invalidateQueries({ queryKey: ["series-watch-state", seriesId] });
      queryClient.invalidateQueries({ queryKey: ["episodes", seriesId] });
    }
  }, [queryClient, itemId, seriesId]);

  // Garde anti-double sortie : BACK pressé pendant l'await de reportStop (ou
  // fin d'épisode + BACK simultanés) déclenchait deux goBack() → warning
  // « GO_BACK not handled by any navigator ».
  const exitingRef = useRef(false);

  const invalidateAndGoBack = useCallback(async () => {
    if (exitingRef.current) return;
    exitingRef.current = true;
    await reportStop();
    client.fetch(`/Users/${userId}/Items/${itemId}/Rating`, { method: "DELETE" }).catch(() => {});
    invalidateAll();
    navigation.goBack();
  }, [reportStop, invalidateAll, navigation, client, userId, itemId]);

  const handleFinished = useCallback(async () => {
    if (exitingRef.current) return;
    exitingRef.current = true;
    await reportStop();
    client.fetch(`/Users/${userId}/Items/${itemId}/Rating`, { method: "DELETE" }).catch(() => {});
    invalidateAll();
    if (seriesId) navigation.replace("MediaDetail", { itemId: seriesId });
    else navigation.goBack();
  }, [reportStop, invalidateAll, navigation, client, userId, itemId, seriesId]);

  // Unmount cleanup
  const reportStopRef = useRef(reportStop);
  reportStopRef.current = reportStop;
  const invalidateAllRef = useRef(invalidateAll);
  invalidateAllRef.current = invalidateAll;
  useEffect(() => () => {
    reportStopRef.current();
    invalidateAllRef.current();
  }, []);

  // AppState : sortie via bouton Home de la télécommande (l'app passe en
  // arrière-plan sans BACK). On COMMITTE la position avec un vrai Stopped — un
  // simple Progress laisse une session « playing » zombie côté Jellyfin et, si
  // Android gèle/tue le process en arrière-plan, la position de reprise n'est
  // jamais finalisée. Au retour, on ré-arme une session pour que la reprise de
  // lecture continue à remonter la progression (onLoad ne refire pas).
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background" || state === "inactive") {
        onBackgroundRef.current?.();
        void reportStopRef.current();
      } else if (state === "active") {
        reportStartRef.current(positionRef.current);
        reportSeekRef.current(positionRef.current, pausedStateRef.current);
        [400, 1500, 3000].forEach((d) => setTimeout(() => onForegroundRef.current?.(), d));
      }
    });
    return () => sub.remove();
  }, [positionRef, pausedStateRef, reportSeekRef, reportStartRef]);

  return { invalidateAndGoBack, handleFinished };
}
