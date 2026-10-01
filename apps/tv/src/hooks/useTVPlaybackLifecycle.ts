import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWatchStopInvalidation } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { useTVPlaybackPresence } from "./useTVPlaybackPresence";
import { useTVPlaybackMarker } from "./useTVPlaybackMarker";
import type { RestartOptions, RestartOutcome } from "./streamRestart";

/**
 * Centralise les effets lifecycle du PlayerScreen TV :
 *  - rangement de sortie au démontage (règle partagée `useWatchStopInvalidation`)
 *  - présence de l'app (`useTVPlaybackPresence`) : pause et position à
 *    l'inactivité, arrêt à la sortie, reprise au retour
 *  - marqueur de la relance à froid (`useTVPlaybackMarker`)
 *  - helpers `leavePlayer` et `handleFinished`
 *
 * Les refs `pausedStateRef` et `reportSeekRef` sont fournies par le caller pour
 * que l'écouteur de présence reste stable ([] deps) sans capter de closures.
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
  /** Met la lecture en pause quand l'app n'est plus regardée (inactive ou quittée). */
  onBackground?: () => void;
  /** Appelé au RETOUR au premier plan (re-signalé à 0,4/1,5/3 s — après une VRAIE
   *  suspension la scène UIKit se réattache lentement, un seul tir part trop tôt) :
   *  tvOS PERD le focus natif au passage en arrière-plan — sans re-signal, plus
   *  aucun bouton n'est focalisé au retour (l'OSD de pause étant déjà visible,
   *  aucune transition ne re-déclenche le refocus) → les appuis OK tombent dans
   *  le vide et la lecture est impossible à relancer. Doit être idempotent. */
  onForeground?: () => void;
  /** La relance du flux (`usePlayerStreamPipeline`) — au retour, si le flux local est mort. */
  restartStream: (opts?: RestartOptions) => Promise<RestartOutcome>;
  /** URL du flux LOCAL en cours (PrismCore), sinon null. */
  localStreamUrl: string | null;
}) {
  const {
    itemId, item, navigation, reportStop, stopPromiseRef, positionRef,
    pausedStateRef, reportSeekRef, reportStartRef, onBackground, onForeground,
  } = args;
  const seriesId = item?.SeriesId;
  const queryClient = useQueryClient();
  const runStopInvalidation = useWatchStopInvalidation();

  // Garde anti-double sortie : BACK pressé pendant l'await de reportStop (ou
  // fin d'épisode + BACK simultanés) déclenchait deux goBack() → warning
  // « GO_BACK not handled by any navigator ».
  const exitingRef = useRef(false);

  // Les deux sorties explicites postent l'arrêt, avec la position finale, et
  // naviguent AUSSITÔT : l'arrêt est noté dans la file persistée avant tout
  // envoi (api-client, `playbackOutbox`) et part en arrière-plan — attendu, il
  // retenait le Retour jusqu'à ~3 min quand le serveur se taisait. Sa promesse
  // est mémorisée (`stopPromiseRef`) et le cleanup de démontage y enchaîne le
  // rangement. Rien à invalider ici : le doubler annulait et relançait les
  // mêmes requêtes que la règle partagée.
  const leavePlayer = useCallback(() => {
    if (exitingRef.current) return;
    exitingRef.current = true;
    void reportStop();
    navigation.goBack();
  }, [reportStop, navigation]);

  const handleFinished = useCallback(() => {
    if (exitingRef.current) return;
    exitingRef.current = true;
    void reportStop();
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

  useTVPlaybackMarker(itemId);
  useTVPlaybackPresence({
    positionRef, pausedStateRef, reportSeekRef, reportStartRef, reportStopRef,
    onPause: onBackground, onFocusPlay: onForeground,
    restartStream: args.restartStream, localStreamUrl: args.localStreamUrl,
  });

  return { leavePlayer, handleFinished };
}
