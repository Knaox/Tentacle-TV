import { useCallback, useEffect, useRef } from "react";
import type { RefObject } from "react";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useWatchStopInvalidation } from "@tentacle-tv/api-client";
import { TICKS_PER_SECOND } from "@tentacle-tv/shared";
import type { EngineLoadData, EngineProgressData, PlayerEngineHandle } from "@/player/engine/types";
import { backOrHome } from "@/utils/backOrHome";
import type { PlayerSessionCore } from "./usePlayerPlayback";

/**
 * Gestionnaires du lecteur mobile : chargement, progression, fin, erreur,
 * déplacement, navigation d'épisode, sortie d'écran — et, au démontage, le
 * rangement de sortie partagé avec le web (arrêt de session, Ma liste, hubs).
 *
 * Extraits de `PlayerScreen`, qui dépassait la limite de 300 lignes par
 * fichier. Ils ne connaissent pas le moteur : ils parlent à `engineRef`, la
 * poignée commune des deux surfaces.
 */
export interface PlayerHandlersOptions {
  itemId: string;
  pb: PlayerSessionCore;
  engineRef: RefObject<PlayerEngineHandle | null>;
  paused: boolean;
  /** Refs de cycle de vie portés par l'écran, repris tels quels. */
  resumeApplied: { current: boolean };
  retryCount: { current: number };
  retryingRef: { current: boolean };
  hasEverPlayed: { current: boolean };
  setCurrentTime: (v: number) => void;
  setBufferedTime: (v: number) => void;
  setIsBuffering: (v: boolean) => void;
  setVideoReady: (v: boolean) => void;
  setPlayerError: (v: string | null) => void;
  /** Le détail brut de la dernière erreur, pour le panneau « Détails ». */
  setPlayerDetail?: (v: string | null) => void;
  /**
   * Une lecture DIRECTE a échoué : l'écran peut basculer sur l'autre moteur
   * (vrai) au lieu de demander un transcodage. Sinon, ou en cas de second
   * échec, la relance transcodée existante prend le relais.
   */
  onDirectPlayFailed?: () => boolean;
  /** Le flux est arrivé au bout — l'écran le donne à l'arbitre, qui décide. */
  onEnded: () => void;
}

export function usePlayerHandlers({
  itemId, pb, engineRef, paused,
  resumeApplied, retryCount, retryingRef, hasEverPlayed,
  setCurrentTime, setBufferedTime, setIsBuffering, setVideoReady, setPlayerError, setPlayerDetail,
  onDirectPlayFailed, onEnded,
}: PlayerHandlersOptions) {
  const { t } = useTranslation("player");
  const router = useRouter();
  const queryClient = useQueryClient();
  const runStopInvalidation = useWatchStopInvalidation();

  // Sortie du lecteur : la navigation, rien d'autre. Le rangement — arrêt de
  // session, Ma liste, hubs de l'accueil — vit dans le cleanup de démontage, en
  // bas de ce hook : le seul point que TOUTES les sorties traversent, bouton
  // Retour matériel d'Android compris, qui dépile la route sans passer ici.
  const leavePlayer = useCallback(() => {
    backOrHome(router);
  }, [router]);

  const handleLoad = useCallback((_data: EngineLoadData) => {
    setIsBuffering(false);
    setVideoReady(true);
    hasEverPlayed.current = true;

    // First load: resume from metadata; subsequent loads (track change): use current position
    const targetPosition = resumeApplied.current
      ? pb.positionRef.current
      : (pb.item?.UserData?.PlaybackPositionTicks ?? 0) / TICKS_PER_SECOND;
    resumeApplied.current = true;

    if (targetPosition > 0) {
      if (pb.isDirectPlay) {
        // Direct play: seek absolute (startPosition should already have positioned,
        // but seek as backup)
        engineRef.current?.seek(targetPosition);
      } else {
        // Transcode: HLS stream starts at streamOffset,
        // so seek to (target - streamOffset) within the stream
        const seekInStream = targetPosition - pb.streamOffset;
        if (seekInStream > 1) {
          engineRef.current?.seek(seekInStream);
        }
      }
    }

    pb.reporting.reportStart(targetPosition);
  }, [pb.item, pb.reporting, pb.isDirectPlay, pb.streamOffset, pb.positionRef]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleProgress = useCallback((data: EngineProgressData) => {
    const raw = Math.max(0, data.currentTime);
    const pos = raw + pb.streamOffset;
    setCurrentTime(pos);
    setBufferedTime(data.playableDuration > 0 ? data.playableDuration + pb.streamOffset : 0);
    pb.positionRef.current = pos;
    pb.reporting.updatePosition(pos, paused);
  }, [paused, pb.reporting, pb.streamOffset, pb.positionRef]); // eslint-disable-line react-hooks/exhaustive-deps

  // La fin du flux ne quitte plus l'écran : elle est ANNONCÉE à l'arbitre, qui
  // affiche l'écran de fin quand il y a une suite, et demande la sortie
  // (`onEndOfPlayback` → `leavePlayer`) quand il n'y en a pas. Sortir
  // ici privait le mobile de l'écran de fin que les autres surfaces ont.
  const handleEnd = useCallback(() => {
    onEnded();
  }, [onEnded]);

  /**
   * Un échec de lecture, dans l'ordre : l'autre moteur si une lecture directe a
   * échoué et qu'il est plausible, puis le transcodage (chemin de repli
   * existant), puis l'écran d'erreur. Le motif est journalisé et gardé pour
   * « Détails ».
   */
  const handleError = useCallback((e: unknown) => {
    // Guard against duplicate onError from ExoPlayer or race with retryingRef
    if (retryingRef.current) return;
    const errorDetail = e && typeof e === "object" ? JSON.stringify(e) : String(e);
    setPlayerDetail?.(errorDetail);
    const budget = onDirectPlayFailed ? 2 : 1;
    if (retryCount.current < budget) {
      retryCount.current++;
      retryingRef.current = true;
      if (pb.isDirectPlay && onDirectPlayFailed?.()) {
        console.log("[Tentacle:Player] onError — lecture directe en échec, bascule sur l'autre moteur", errorDetail);
        return;
      }
      // First error = expected on emulators / unsupported codecs → auto-retry with transcode
      console.log("[Tentacle:Player] onError — retrying with transcode fallback", errorDetail);
      pb.retry();
    } else {
      // All retries exhausted — show error screen
      console.error("[Tentacle:Player] onError — all retries exhausted", errorDetail);
      setPlayerError(t("playbackError"));
    }
  }, [pb, t, onDirectPlayFailed]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSeek = useCallback((seconds: number) => {
    const dur = pb.jellyfinDuration || 0;
    const clamped = Math.max(0, dur > 0 ? Math.min(seconds, dur) : seconds);
    const offset = pb.streamOffset;
    engineRef.current?.seek(Math.max(0, clamped - offset));
    pb.reporting.reportSeek(clamped, paused);
  }, [pb.jellyfinDuration, pb.streamOffset, paused, pb.reporting]); // eslint-disable-line react-hooks/exhaustive-deps

  // Épisode précédent/suivant : l'arrêt part maintenant, avec la position
  // finale, et sa promesse est mémorisée — le cleanup de l'écran remplacé
  // (`router.replace` en remonte un, sous une nouvelle clé de route) enchaîne
  // le rangement dessus. Rien à invalider ici.
  const handleNextEpisode = useCallback(() => {
    const next = pb.episodeNav.nextEpisode;
    if (!next) return;
    pb.reporting.reportStop();
    router.replace(`/watch/${next.Id}`);
  }, [pb.episodeNav.nextEpisode, pb.reporting, router]);

  const handlePrevEpisode = useCallback(() => {
    const prev = pb.episodeNav.previousEpisode;
    if (!prev) return;
    pb.reporting.reportStop();
    router.replace(`/watch/${prev.Id}`);
  }, [pb.episodeNav.previousEpisode, pb.reporting, router]);

  // Rangement de SORTIE, au démontage — la règle partagée avec le web et le
  // bureau (`useWatchStopInvalidation`) : Ma liste n'est évaluée qu'après un
  // arrêt réel au-delà de la moitié, un film n'en sort que marqué `Played`, une
  // série n'en sort qu'entièrement vue. Toutes les sorties passent ici, Retour
  // matériel Android compris. `router.replace` REMONTE l'écran (nouvelle clé
  // de route) : le cleanup de l'ancienne instance voit SON item et SA position.
  // Snapshots par refs, lus MAINTENANT : `pb` est un objet neuf à chaque rendu.
  const itemRef = useRef(pb.item);
  itemRef.current = pb.item;
  const reportingRef = useRef(pb.reporting);
  reportingRef.current = pb.reporting;
  const runStopRef = useRef(runStopInvalidation);
  runStopRef.current = runStopInvalidation;
  const invalidateRef = useRef(pb.invalidateOnStop);
  invalidateRef.current = pb.invalidateOnStop;
  const positionRef = pb.positionRef;

  useEffect(() => () => {
    const snap = itemRef.current;
    const stopPositionSeconds = positionRef.current;
    const reporting = reportingRef.current;
    // Sans effet si la session est déjà arrêtée (cleanup de usePlaybackReporting
    // passé avant — même composant, ordre de déclaration — ou `reportStop()` de
    // l'épisode suivant) ; sinon c'est ici que part le Stopped. Dans tous les cas
    // `lastStopPromiseRef` porte le DERNIER Stopped réel : on enchaîne dessus.
    void reporting.reportStop();
    // Hors ligne (lecture locale, serveur injoignable), le rangement partagé
    // n'a rien à invalider : il attendrait des requêtes qui ne partiront pas.
    if (!invalidateRef.current()) return;
    const run = () => runStopRef.current({
      itemId, seriesId: snap?.SeriesId, itemType: snap?.Type,
      stopPositionSeconds, runtimeTicks: snap?.RunTimeTicks,
    });
    reporting.lastStopPromiseRef.current.then(run, run);
    // Hors de la règle partagée : « Ajouts récents » (badge vu). `["item"]`, les
    // hubs et la fiche série sont invalidés par elle — ne pas doubler. Sous la
    // garde, comme le reste : hors ligne, rien à invalider.
    queryClient.invalidateQueries({ queryKey: ["latest-items"] });
  }, [itemId, queryClient, positionRef]);

  return {
    handleLoad, handleProgress, handleEnd, handleError, handleSeek,
    leavePlayer, handleNextEpisode, handlePrevEpisode,
  };
}
