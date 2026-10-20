import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  useGroupIntroSkip, useGroupSkipCountdown, useGroupSyncEngine, useWatchTogetherOrIdle, type TranscodeSeek,
} from "@tentacle-tv/api-client";
import { isBarrierParticipant } from "@tentacle-tv/shared";
import type { GroupOverlayInput } from "@/hooks/usePlaybackOverlayMobile";
import type { PlayerSessionCore } from "@/hooks/usePlayerPlayback";
import type { MobileGroupStart } from "./useMobileGroupStart";
import { useMobileWtTransport } from "./useMobileWtTransport";
import { benchRaw, installBenchProbe } from "./benchProbe";
import { useWtPlayerChrome } from "./useWtPlayerChrome";

/**
 * Le lecteur mobile en séance Watch Together — le SEUL point de contact
 * entre l'écran du lecteur et la séance partagée (api-client), pour que
 * `PlayerScreen` n'en porte que quelques lignes. Hors séance, tout est
 * transparent : les gestes rendus sont ceux de l'écran, tels quels.
 *
 * - le port lecteur (`useMobileWtTransport`) donné au moteur de synchro ;
 * - la position de départ du groupe vient de `useMobileGroupStart`, appelé
 *   plus tôt (avant la négociation du flux) ;
 * - les gestes : la lecture est DEMANDÉE à la salle (`requestPlay` : tous
 *   repartent au même instant), un saut est annoncé, l'épisode suivant ou
 *   précédent part pour tout le groupe (`wt:setItem`) ;
 * - un rechargement du flux (qualité, piste, reprise d'arrière-plan) se
 *   déclare comme une attente : le groupe ne repart pas sans ce lecteur ;
 * - l'arbitre de lecture reçoit le décompte de saut COMMUN et les refus.
 */
export function useMobileGroupPlayback({
  itemId, start, pb, paused, setPaused, buffering, videoReady, seek, handleNextEpisode, handlePrevEpisode, failed, cancelAutoNext,
}: {
  itemId: string;
  start: MobileGroupStart;
  pb: PlayerSessionCore;
  paused: boolean;
  setPaused: (paused: boolean) => void;
  buffering: boolean;
  videoReady: boolean;
  /** Le saut de l'écran (`usePlayerSeekGate`) : un seul redémarrage pendant un transcodage. */
  seek: TranscodeSeek;
  handleNextEpisode: () => void;
  handlePrevEpisode: () => void;
  /** Le lecteur montre un échec : le groupe ne l'attend plus (« ne peut pas lire »). */
  failed: boolean;
  cancelAutoNext?: () => void;
}) {
  const { group } = start;
  start.episodes.current = { next: handleNextEpisode, previous: handlePrevEpisode };

  // Les signaux vers le moteur passent par une ref : le moteur a besoin du
  // port, le port a besoin du moteur.
  const syncRef = useRef<ReturnType<typeof useGroupSyncEngine> | null>(null);
  const { room, selfId } = useWatchTogetherOrIdle();
  const transport = useMobileWtTransport({
    active: group.groupActive,
    barrier: isBarrierParticipant(room, selfId),
    commands: { setPaused, seek: seek.seekTo, cancelAutoNext },
    paused, buffering, videoReady,
    streamOffset: pb.streamOffset,
    signals: {
      notifyBuffering: (b) => syncRef.current?.notifyBuffering(b),
      notifyPlayState: (p, opts) => syncRef.current?.notifyPlayState(p, opts),
    },
  });
  const sync = useGroupSyncEngine({
    itemId, transportRef: transport.transportRef, claimStartSeconds: group.groupStartPositionSeconds,
  });
  syncRef.current = sync;
  const active = sync.active;

  // Le refus d'un passage voyage avec le groupe (la croix d'un autre vaut pour moi).
  useGroupIntroSkip(sync.notifySkipIntroDismiss);
  // « Tous prêts » : aucun saut de passage tant que la salle attend un membre.
  const { groupSkip, onSkipPropose, skipHeld } = useGroupSkipCountdown(itemId);

  // Rechargement du flux : le groupe m'attend, gelé à la position VISÉE.
  const firstStream = useRef(true);
  useEffect(() => {
    if (!pb.streamUrl) return;
    if (firstStream.current) { firstStream.current = false; return; }
    if (active) sync.notifyBuffering(true, pb.positionRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pb.streamUrl, pb.fetchNonce]);

  // Un échec affiché : ce membre ne peut pas lire, la salle ne l'attend plus.
  useEffect(() => { if (failed && active) sync.notifyFatalError(); }, [failed, active]); // eslint-disable-line react-hooks/exhaustive-deps

  const setPausedIntent = useCallback((next: boolean) => {
    // La lecture en séance est demandée à la salle, qui planifie la reprise.
    if (!next && active && sync.requestPlay()) return;
    setPaused(next);
  }, [active, sync, setPaused]);

  const seekTo = useCallback((seconds: number) => {
    seek.seekTo(seconds);
    if (active) sync.notifySeek(seconds, { explicit: true });
  }, [active, seek, sync]);

  const seekBy = useCallback((delta: number) => {
    if (!active) { seek.seekBy(delta); return; }
    const duration = pb.jellyfinDuration || 0;
    const from = seek.target ?? pb.positionRef.current;
    const target = Math.max(0, duration > 0 ? Math.min(from + delta, duration) : from + delta);
    seekTo(target);
  }, [active, seek, seekTo, pb.jellyfinDuration, pb.positionRef]);

  // En séance, aucun saut de passage avant « tous prêts » — et pas davantage
  // tant que la salle n'est pas encore sur CE titre (lancement pour le groupe).
  const overlay = useMemo<GroupOverlayInput | undefined>(() => (active ? {
    groupSession: true,
    groupSkip,
    groupSkipHeld: !sync.onGroupItem || skipHeld,
    onSkipPropose,
    onSegmentDismissNotify: sync.notifySkipIntroDismiss,
    onNextDismissNotify: sync.notifyAutoNextDismiss,
  } : undefined), [active, sync.onGroupItem, groupSkip, skipHeld, onSkipPropose, sync.notifySkipIntroDismiss, sync.notifyAutoNextDismiss]);

  // Sonde du banc (développement seulement) : lecture de la position, gestes du lecteur.
  const probeRef = useRef({ paused, videoReady, rate: transport.rate, setPausedIntent, seekBy });
  probeRef.current = { paused, videoReady, rate: transport.rate, setPausedIntent, seekBy };
  useEffect(() => installBenchProbe({
    sample: () => ({
      pos: transport.transportRef.current?.getPositionSeconds() ?? null,
      raw: { ...benchRaw },
      paused: probeRef.current.paused,
      rate: probeRef.current.rate,
      ready: probeRef.current.videoReady,
      route: `/watch/${itemId}`,
    }),
    action: (kind, value) => {
      if (kind === "seekBy") probeRef.current.seekBy(value ?? 0);
      else probeRef.current.setPausedIntent(kind === "pause");
    },
  }), [itemId, transport.transportRef]);

  const chrome = useWtPlayerChrome(itemId);
  return {
    active,
    /** Vitesse de lecture à poser sur la surface (rattrapage doux). */
    rate: transport.rate,
    wrapProgress: transport.wrapProgress,
    /** À poser sur la surface (`onSeekComplete`) : un saut en pause s'y voit atterrir. */
    onSeekComplete: transport.onSeekComplete,
    setPaused: setPausedIntent,
    onPlayPause: () => setPausedIntent(!paused),
    seekTo,
    seekBy,
    handleNextEpisode: group.handleNextEpisode,
    handlePrevEpisode: group.handlePreviousEpisode,
    overlay,
    /** L'habillage du lecteur en séance (bouton, panneau, couches sur la vidéo). */
    chrome,
  };
}
