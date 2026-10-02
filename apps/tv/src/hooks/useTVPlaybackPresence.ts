import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { presenceOf, presenceStep, type AppPresence } from "@tentacle-tv/tv-core/playback";
import { prismServing, prismStatus } from "../utils/prismCoreStart";
import { plog } from "../utils/playerDiag";
import type { RestartOptions, RestartOutcome } from "./streamRestart";

/** Re-signal du focus au retour : après une VRAIE suspension, la scène UIKit se
 *  réattache lentement — un seul tir part trop tôt. */
const FOCUS_RETRIES_MS = [400, 1500, 3000];

/** Le flux LOCAL en cours (PrismCore) : son URL et sa session. */
export interface LocalStream {
  url: string;
  gen: number;
}

/**
 * Le lecteur face à la présence de l'app (AppState), selon la règle partagée
 * `presenceStep` (tv-core) : pause et position à l'inactivité, arrêt à la
 * sortie, focus sur Lecture au retour — et, après une vraie absence, la
 * session rouverte et le flux local contrôlé : s'il ne répond plus, il est
 * relancé PENDANT la pause, avant que l'appui sur Lecture ne bute dessus.
 *
 * Le contrôle lit les DEUX moitiés de PrismCore : son serveur de bouclage (la
 * playlist répond-elle ?) et son producteur (`prismStatus`). Une playlist VOD
 * planifiée est servie même producteur mort — la source lâchée pendant
 * l'absence : AVPlayer redemanderait alors ses segments sans fin, sans erreur,
 * et toute recherche viserait un segment que plus rien ne fabrique.
 *
 * Les refs gardent l'écouteur stable (deps figées) sans capter de closures.
 */
export function useTVPlaybackPresence(args: {
  positionRef: React.MutableRefObject<number>;
  pausedStateRef: React.MutableRefObject<boolean>;
  reportSeekRef: React.MutableRefObject<(pos: number, paused: boolean) => void>;
  /** Rouvre la session Jellyfin au retour (POST /Sessions/Playing). */
  reportStartRef: React.MutableRefObject<(pos?: number) => void>;
  reportStopRef: React.MutableRefObject<() => Promise<void> | void>;
  /** Met la lecture en pause (l'app n'est plus regardée). */
  onPause?: () => void;
  /** Rend le focus à Lecture. Idempotent : appelé plusieurs fois au retour. */
  onFocusPlay?: () => void;
  restartStream: (opts?: RestartOptions) => Promise<RestartOutcome>;
  /** Le flux LOCAL en cours (PrismCore), sinon null. */
  localStream: LocalStream | null;
}): void {
  const { positionRef, pausedStateRef, reportSeekRef, reportStartRef, reportStopRef } = args;
  const onPauseRef = useRef(args.onPause);
  onPauseRef.current = args.onPause;
  const onFocusPlayRef = useRef(args.onFocusPlay);
  onFocusPlayRef.current = args.onFocusPlay;
  const restartRef = useRef(args.restartStream);
  restartRef.current = args.restartStream;
  const localRef = useRef(args.localStream);
  localRef.current = args.localStream;

  useEffect(() => {
    let presence: AppPresence = presenceOf(AppState.currentState) ?? "active";

    const checkLocalStream = async () => {
      const local = localRef.current;
      if (!local) return;
      const alive = await prismServing(local.url);
      // `null` : le pont ne répond pas — on ne relance pas sur une inconnue.
      const status = alive ? await prismStatus(local.gen) : null;
      const producerDead = !!status && (status.failed || !status.known);
      plog("presence", `retour : flux local ${!alive ? "MORT → relance" : producerDead ? `producteur mort (${status?.code ?? "session close"}) → relance` : "vivant"}`);
      if ((!alive || producerDead) && localRef.current?.url === local.url) void restartRef.current({ reason: "resume" });
    };

    const sub = AppState.addEventListener("change", (state) => {
      const next = presenceOf(state);
      if (!next) return;
      const step = presenceStep(presence, next);
      plog("presence", `${presence} → ${next}`);
      presence = next;
      if (step.pause) onPauseRef.current?.();
      if (step.report === "position") reportSeekRef.current(positionRef.current, true);
      else if (step.report === "stop") void reportStopRef.current();
      else if (step.report === "reopen") {
        reportStartRef.current(positionRef.current);
        reportSeekRef.current(positionRef.current, pausedStateRef.current);
      }
      if (step.focusPlay) for (const ms of FOCUS_RETRIES_MS) setTimeout(() => onFocusPlayRef.current?.(), ms);
      if (step.checkStream) void checkLocalStream();
    });
    return () => sub.remove();
  }, [positionRef, pausedStateRef, reportSeekRef, reportStartRef, reportStopRef]);
}
