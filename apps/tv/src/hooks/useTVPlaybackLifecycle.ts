import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useWatchStopInvalidation } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { setPlayingMedia } from "../auth/playbackGuard";

/**
 * Centralise les effets lifecycle du PlayerScreen TV :
 *  - playbackGuard (empêche logout intempestif)
 *  - rangement de sortie au démontage (règle partagée `useWatchStopInvalidation`)
 *  - écoute AppState (pause + rapport position en arrière-plan)
 *  - helpers `leavePlayer` et `handleFinished`
 *
 * Les refs `pausedStateRef` et `reportSeekRef` sont fournies par le caller pour
 * que le listener AppState reste stable ([] deps) sans capter de closures.
 */
export function useTVPlaybackLifecycle(args: {
  itemId: string;
  /** L'item lu : type, série parente et durée — ce que la règle partagée demande. */
  item?: MediaItem;
  navigation: NativeStackNavigationProp<RootStackParamList, "Player">;
  reportStop: () => Promise<void> | void;
  /** Promesse du DERNIER `/Sessions/Playing/Stopped` réel (cf. usePlaybackReporting). */
  stopPromiseRef: React.MutableRefObject<Promise<void>>;
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
  const {
    itemId, item, navigation, reportStop, stopPromiseRef, positionRef,
    pausedStateRef, reportSeekRef, reportStartRef, onBackground, onForeground,
  } = args;
  const seriesId = item?.SeriesId;
  const onBackgroundRef = useRef(onBackground);
  onBackgroundRef.current = onBackground;
  const onForegroundRef = useRef(onForeground);
  onForegroundRef.current = onForeground;
  const queryClient = useQueryClient();
  const runStopInvalidation = useWatchStopInvalidation();

  useEffect(() => {
    setPlayingMedia(true);
    return () => { setPlayingMedia(false); };
  }, []);

  // Garde anti-double sortie : BACK pressé pendant l'await de reportStop (ou
  // fin d'épisode + BACK simultanés) déclenchait deux goBack() → warning
  // « GO_BACK not handled by any navigator ».
  const exitingRef = useRef(false);

  // Les deux sorties explicites postent l'arrêt AVANT de naviguer, avec la
  // position finale ; sa promesse est mémorisée (`stopPromiseRef`) et le
  // cleanup de démontage, juste derrière la navigation, y enchaîne le
  // rangement. Rien à invalider ici : le doubler annulait et relançait les
  // mêmes requêtes que la règle partagée.
  const leavePlayer = useCallback(async () => {
    if (exitingRef.current) return;
    exitingRef.current = true;
    await reportStop();
    navigation.goBack();
  }, [reportStop, navigation]);

  const handleFinished = useCallback(async () => {
    if (exitingRef.current) return;
    exitingRef.current = true;
    await reportStop();
    if (seriesId) navigation.replace("MediaDetail", { itemId: seriesId });
    else navigation.goBack();
  }, [reportStop, navigation, seriesId]);

  // Démontage : le rangement de sortie, par la règle partagée avec le web, le
  // bureau et le mobile (`useWatchStopInvalidation`) — Ma liste n'est évaluée
  // qu'après un arrêt réel au-delà de la moitié, un film n'en sort que marqué
  // `Played`, une série n'en sort qu'entièrement vue. C'est le seul point que
  // TOUTES les sorties traversent : Retour (OSD, BackHandler Android, Menu tvOS
  // qui dépile nativement sans passer par `leavePlayer`), fin de lecture,
  // épisode suivant (`navigation.replace` remonte l'écran sous une nouvelle
  // clé).
  // Lectures SYNCHRONES, par refs : `item` change à chaque mise à jour de
  // UserData et ne doit pas relancer l'effet.
  const reportStopRef = useRef(reportStop);
  reportStopRef.current = reportStop;
  const itemRef = useRef(item);
  itemRef.current = item;
  const runStopRef = useRef(runStopInvalidation);
  runStopRef.current = runStopInvalidation;
  useEffect(() => () => {
    const snap = itemRef.current;
    const stopPositionSeconds = positionRef.current;
    // Sans effet si l'arrêt est déjà parti (sorties explicites ci-dessus,
    // cleanup de usePlaybackReporting passé avant) ; sinon c'est lui qui le
    // poste. `stopPromiseRef` porte dans tous les cas le dernier Stopped réel :
    // on enchaîne dessus, pour que Jellyfin ait écrit `Played` avant de décider.
    void reportStopRef.current();
    const run = () => runStopRef.current({
      itemId, seriesId: snap?.SeriesId, itemType: snap?.Type,
      stopPositionSeconds, runtimeTicks: snap?.RunTimeTicks,
    });
    stopPromiseRef.current.then(run, run);
    // Hors de la règle partagée : « Ajouts récents » (badge vu).
    queryClient.invalidateQueries({ queryKey: ["latest-items"] });
  }, [itemId, stopPromiseRef, positionRef, queryClient]);

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

  return { leavePlayer, handleFinished };
}
