import { useEffect, useRef } from "react";
import { getClockRttMs, sampleClock, setClockSampling } from "@tentacle-tv/api-client";
import {
  TICKS_PER_SECOND, WT_CLOCK_BURST_COUNT, WT_CLOCK_BURST_SPACING_MS, WT_CLOCK_SAMPLE_MS,
  WT_PROTOCOL_VERSION,
} from "@tentacle-tv/shared";
import { useWatchTogether } from "./WatchTogetherProvider";
import type { PlayerTransportRef } from "./playerTransport";
import { cancelScheduledPlay, isGroupSessionActive, type GroupSyncSharedRefs } from "./groupSyncShared";
import { useGroupDriftLoop } from "./useGroupDriftLoop";
import { useGroupRemoteApply } from "./useGroupRemoteApply";
import { useGroupIntents } from "./useGroupIntents";
import { useGroupTick } from "./useGroupTick";
import { wtLog } from "./wtLog";

/**
 * Watch Together — moteur de synchronisation d'un player monté : la session
 * (horloge, déclaration au groupe, nettoyage), et la composition des trois
 * parties — application des états distants (useGroupRemoteApply), intents
 * locaux (useGroupIntents), correction de dérive (useGroupDriftLoop).
 */
export function useGroupSyncEngine({
  itemId,
  transportRef,
  claimStartSeconds,
}: {
  itemId: string | undefined;
  transportRef: PlayerTransportRef;
  /** Position initiale à revendiquer si CE montage lance le média pour le
   *  groupe (reprise Jellyfin du lanceur) — undefined tant qu'elle n'est pas
   *  connue : le `wt:setItem` est différé jusque-là. */
  claimStartSeconds?: number;
}) {
  const { room, send, serverNow, isInGroup, selfId } = useWatchTogether();
  const active = isGroupSessionActive(isInGroup, room, itemId);
  const onGroupItem = active && room?.itemId === itemId;

  const roomRef = useRef(room);
  roomRef.current = room;
  const serverNowRef = useRef(serverNow);
  serverNowRef.current = serverNow;
  const sendRef = useRef(send);
  sendRef.current = send;
  const selfIdRef = useRef(selfId);
  selfIdRef.current = selfId;

  const applyingUntilRef = useRef(0);
  const lastBufferingSentRef = useRef<boolean | null>(null);
  const softCorrectionSinceRef = useRef<number | null>(null);
  const currentRateRef = useRef(1);
  const pendingIntentRef = useRef<GroupSyncSharedRefs["pendingIntentRef"]["current"]>(null);
  const scheduledPlayRef = useRef<GroupSyncSharedRefs["scheduledPlayRef"]["current"]>(null);
  const playLatencyMsRef = useRef<number | null>(null);
  const seekLatencySRef = useRef<number | null>(null);
  const pendingHardSeekRef = useRef<GroupSyncSharedRefs["pendingHardSeekRef"]["current"]>(null);

  // Bundle stable des refs partagées entre les trois parties du moteur.
  const shared = useRef<GroupSyncSharedRefs>({
    roomRef, serverNowRef, selfIdRef, sendRef,
    applyingUntilRef, lastBufferingSentRef, softCorrectionSinceRef, currentRateRef,
    pendingIntentRef, scheduledPlayRef, playLatencyMsRef, seekLatencySRef, pendingHardSeekRef,
  }).current;

  // ── Session : horloge (rafale puis cadence de séance) + nettoyage au démontage ──
  useEffect(() => {
    if (!active || !itemId) return;
    wtLog("engine", "session ON", { itemId });

    // Rafale d'échantillonnage d'horloge (médiane implicite : meilleur RTT retenu),
    // puis un échantillon toutes les WT_CLOCK_SAMPLE_MS : deux horloges dérivent.
    let burst = 0;
    const burstTimer = setInterval(() => {
      sampleClock();
      if (++burst >= WT_CLOCK_BURST_COUNT) clearInterval(burstTimer);
    }, WT_CLOCK_BURST_SPACING_MS);
    setClockSampling(WT_CLOCK_SAMPLE_MS);

    return () => {
      clearInterval(burstTimer);
      setClockSampling(null);
      wtLog("engine", "session OFF — presence false + vitesse 1×", { itemId });
      // Ne JAMAIS laisser un rattrapage doux actif après un leave/démontage :
      // hors groupe, personne ne remettrait la vitesse à 1.
      if (currentRateRef.current !== 1) {
        currentRateRef.current = 1;
        transportRef.current?.setRate(1);
      }
      cancelScheduledPlay(shared);
      pendingIntentRef.current = null;
      sendRef.current({ type: "wt:presence", inPlayback: false });
      lastBufferingSentRef.current = null;
      softCorrectionSinceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, itemId]);

  // ── Déclaration : setItem filet + presence + buffering (une fois par montage) ──
  const declaredRef = useRef(false);
  useEffect(() => { declaredRef.current = false; }, [itemId]);
  useEffect(() => {
    if (!active || !itemId || declaredRef.current) return;
    const r = roomRef.current;
    const needsClaim = !!r && r.itemId !== itemId;
    // Lancement d'un média : attendre de connaître la position de reprise du
    // lanceur (item chargé) pour que le groupe démarre là où IL en était.
    if (needsClaim && claimStartSeconds === undefined) return;
    declaredRef.current = true;
    if (needsClaim) {
      // Filet générique : arriver sur un player avec un autre média = le lancer
      // pour le groupe (premier arrivé gagne, dédup serveur par fromItemId).
      wtLog("engine", "déclaration : wt:setItem (lancer ce média pour le groupe)", {
        itemId, fromItemId: r!.itemId, startS: claimStartSeconds,
      });
      sendRef.current({
        type: "wt:setItem",
        itemId,
        fromItemId: r!.itemId,
        reason: "manual",
        startPositionTicks: Math.max(0, Math.round((claimStartSeconds ?? 0) * TICKS_PER_SECOND)),
      });
    }
    const rttMs = getClockRttMs() ?? undefined;
    sendRef.current({ type: "wt:presence", inPlayback: true, itemId, protocolVersion: WT_PROTOCOL_VERSION, rttMs });
    // Départ gelé : le groupe m'attend le temps que mon player charge. MAIS si
    // le player est DÉJÀ prêt (groupe créé/rejoint pendant une lecture en
    // cours), déclarer un buffering serait un gel que RIEN ne résoudrait :
    // mediaReady ne re-flippe pas → buffering:false jamais émis → groupe gelé
    // jusqu'au timeout serveur et boucle de drift locale morte (état « cassé
    // jusqu'au hard refresh »).
    const alreadyReady = transportRef.current?.isMediaReady?.() === true;
    wtLog("engine", `déclaration : presence inPlayback + wt:buffering ${!alreadyReady}`, {
      itemId, alreadyReady, claimed: needsClaim,
    });
    sendRef.current({ type: "wt:buffering", buffering: !alreadyReady, rttMs });
    lastBufferingSentRef.current = !alreadyReady;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, itemId, claimStartSeconds]);

  // ── Application des états distants (pause/lecture, seeks, reprise planifiée) ──
  useGroupRemoteApply({ enabled: !!onGroupItem, room, transportRef, shared });

  // ── Boucle de drift ──
  useGroupDriftLoop({ enabled: !!onGroupItem, itemId, transportRef, shared });

  // ── Balise (écart, aller-retour) ──
  useGroupTick({ enabled: !!onGroupItem, transportRef, shared });

  // ── Intents locaux (observe & report, lecture demandée) ──
  const intents = useGroupIntents({ active, itemId, transportRef, shared, declaredRef });

  return { active, onGroupItem, ...intents };
}
