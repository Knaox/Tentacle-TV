import { useCallback, useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { DeviceEventEmitter, Platform } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { osdFocusedKeyRef } from "../components/player/focus/osdFocusBus";
import { BUTTON_SEEK_BASE, buttonSeekRate, buttonSeekTier } from "./scrubAcceleration";

type Ref<T> = MutableRefObject<T>;

/**
 * Boutons OSD avance/recul rapide, modèle MAINTIEN : curseur fantôme qui avance
 * de plus en plus vite tant que le bouton est tenu (rampe), FIGÉ au relâchement.
 * AUCUNE confirmation automatique : OK (ou ▶︎❙❙) valide le seek, BACK annule,
 * et l'inactivité annule seule SANS seek (armIdleCancel du scrub controller,
 * réarmé par chaque nudge). Re-maintenir continue d'avancer.
 *
 * Canaux d'entrée :
 *  - **Android : événements NATIFS `tntCenterHold`** (MainActivity) — le
 *    coalesceur n'émet « start » qu'au maintien ENGAGÉ (répétition matérielle,
 *    pluie de paires down/up ou long-press timeout) et « end » 200 ms après le
 *    dernier événement, en CONSOMMANT les événements center intermédiaires : le
 *    bridge ne voit jamais de backlog → l'arrêt de la boucle est immédiat, même
 *    en enchaînant les maintiens. Les press JS du Pressable sont ignorés ici
 *    (le tap court passe par onPress → skip immédiat, cf. TVPlayerOverlay).
 *  - **tvOS : press classiques** (onPressIn/onPressOut, fiables là-bas).
 */
export function useButtonSeek({
  durationRef, startScrubbing, nudgeScrub, clearIdleCancel,
  scrubbingRef, scrubViaButtonRef, setScrubViaButton, setSpeedLabel,
}: {
  durationRef: Ref<number>;
  startScrubbing: (dir?: "forward" | "backward") => void;
  nudgeScrub: (deltaSeconds: number) => void;
  clearIdleCancel: () => void;
  scrubbingRef: Ref<boolean>;
  scrubViaButtonRef: Ref<boolean>;
  setScrubViaButton: Dispatch<SetStateAction<boolean>>;
  setSpeedLabel: Dispatch<SetStateAction<string | null>>;
}) {
  const loopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdRef = useRef<{ sign: 1 | -1; start: number } | null>(null);
  // Échantillons {t, cumul} de l'avance pendant le hold — permet de retrancher
  // ce qui a été avancé APRÈS le relâchement réel (fenêtre de coalescing).
  const cumulRef = useRef(0);
  const samplesRef = useRef<Array<{ t: number; c: number }>>([]);

  // Écrans d'arrière-plan (native-stack les garde montés) : le canal natif est
  // global — seul l'écran lecteur focalisé doit y réagir (parité useTVRemote).
  const isFocused = useIsFocused();
  const focusedRef = useRef(isFocused);
  focusedRef.current = isFocused;

  const stopLoop = useCallback(() => {
    if (loopRef.current) { clearInterval(loopRef.current); loopRef.current = null; }
  }, []);
  useEffect(() => () => stopLoop(), [stopLoop]);

  const runLoop = useCallback((sign: 1 | -1, start: number) => {
    let last = Date.now();
    loopRef.current = setInterval(() => {
      const now = Date.now();
      const dt = (now - last) / 1000;
      last = now;
      const held = (now - start) / 1000;
      const rate = buttonSeekRate(held, durationRef.current);
      if (rate > 0) {
        const delta = sign * rate * dt;
        nudgeScrub(delta);
        cumulRef.current += delta;
        setSpeedLabel(`${sign > 0 ? "▶▶" : "◀◀"} ${buttonSeekTier(held)}x`);
      }
      samplesRef.current.push({ t: now, c: cumulRef.current });
      if (samplesRef.current.length > 64) samplesRef.current.shift();
    }, 33);
  }, [durationRef, nudgeScrub, setSpeedLabel]);

  /** Début de maintien (idempotent sur le sens ; un sens opposé pendant
   *  un hold redémarre la rampe dans l'autre direction). */
  const beginHold = useCallback((sign: 1 | -1) => {
    if (holdRef.current) {
      if (holdRef.current.sign !== sign) {
        stopLoop();
        holdRef.current = { sign, start: Date.now() };
        runLoop(sign, holdRef.current.start);
      }
      return;
    }
    if (__DEV__) console.log(`[SCRUB] beginHold ${sign > 0 ? "fwd" : "back"}`);
    clearIdleCancel();
    scrubViaButtonRef.current = true; setScrubViaButton(true);
    if (!scrubbingRef.current) startScrubbing();   // ghost-scrub (pause), sans dir → pas de moveScrub
    nudgeScrub(sign * BUTTON_SEEK_BASE);           // saut de base immédiat
    setSpeedLabel(`${sign > 0 ? "▶▶" : "◀◀"} 1x`);
    cumulRef.current = 0;
    samplesRef.current = [];
    holdRef.current = { sign, start: Date.now() };
    runLoop(sign, holdRef.current.start);
  }, [clearIdleCancel, startScrubbing, nudgeScrub, runLoop, stopLoop, scrubbingRef, scrubViaButtonRef, setScrubViaButton, setSpeedLabel]);

  /** Fin de maintien : fige le fantôme (recalé sur le relâchement réel si
   *  fourni) et libère le verrou bouton. AUCUNE confirmation : le scrub reste
   *  OUVERT — OK/▶︎❙❙ valident le seek, BACK annule, l'inactivité annule seule
   *  (le timer d'idle-cancel a été réarmé par le dernier nudge). */
  const endHold = useCallback((lastDownAt?: number) => {
    stopLoop(); // inconditionnel : aucune désynchro ne doit laisser la boucle tourner
    if (!holdRef.current) return;
    holdRef.current = null;
    if (lastDownAt) {
      // Retranche l'avance postérieure au relâchement réel (fenêtre de
      // coalescing natif, 200 ms + retard éventuel) → la position figée est
      // celle du relâchement.
      const samples = samplesRef.current;
      let atDown = 0;
      for (let i = samples.length - 1; i >= 0; i--) {
        if (samples[i].t <= lastDownAt) { atDown = samples[i].c; break; }
      }
      const overshoot = cumulRef.current - atDown;
      if (__DEV__) console.log(`[SCRUB] endHold rollback=${overshoot.toFixed(1)}s`);
      if (overshoot !== 0) { nudgeScrub(-overshoot); cumulRef.current = atDown; }
    } else if (__DEV__) {
      console.log("[SCRUB] endHold");
    }
    setSpeedLabel(null); // le fantôme est figé, la vitesse n'a plus de sens
    scrubViaButtonRef.current = false; setScrubViaButton(false);
  }, [stopLoop, nudgeScrub, scrubViaButtonRef, setScrubViaButton, setSpeedLabel]);

  // Android : canal natif coalescé (cf. MainActivity.kt).
  useEffect(() => {
    if (Platform.OS === "ios") return;
    const sub = DeviceEventEmitter.addListener(
      "tntCenterHold",
      (e: { phase: "start" | "end"; lastDownAt: number }) => {
        if (e.phase === "start") {
          // Garde d'écran sur le START uniquement (parité useTVRemote) : un
          // écran lecteur resté monté en arrière-plan ne démarre pas de hold.
          if (!focusedRef.current) return;
          const k = osdFocusedKeyRef.current;
          if (k === "fastforward") beginHold(1);
          else if (k === "rewind") beginHold(-1);
          return;
        }
        // END : TOUJOURS traité (stopLoop idempotent) — l'ignorer pendant une
        // perte de focus laisserait la boucle 33 ms avancer indéfiniment.
        endHold(e.lastDownAt);
      },
    );
    return () => sub.remove();
  }, [beginHold, endHold]);

  // Press JS du Pressable : seul canal sur tvOS ; ignorés sur Android (le
  // canal natif est temps réel, les press peuvent se drainer en retard).
  const startButtonSeek = useCallback((dir: "forward" | "backward") => {
    if (Platform.OS !== "ios") return;
    beginHold(dir === "forward" ? 1 : -1);
  }, [beginHold]);

  const stopButtonSeek = useCallback(() => {
    if (Platform.OS !== "ios") return;
    endHold();
  }, [endHold]);

  return { startButtonSeek, stopButtonSeek };
}
