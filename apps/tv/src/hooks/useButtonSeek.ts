import { useCallback, useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { DeviceEventEmitter, Platform } from "react-native";
import { osdFocusedKeyRef } from "../components/player/focus/osdFocusBus";
import { BUTTON_SEEK_BASE, buttonSeekRate, buttonSeekTier } from "./scrubAcceleration";

type Ref<T> = MutableRefObject<T>;

/** Après la dernière interaction FF/RW (fin de maintien ou tap), le seek est
 *  confirmé automatiquement passé ce délai (modèle Netflix) : l'utilisateur
 *  peut enchaîner des taps/maintiens pour ajuster, la lecture reprend seule. */
const CONFIRM_AFTER_RELEASE_MS = 1000;

/**
 * Boutons OSD avance/recul rapide, modèle MAINTIEN : curseur fantôme qui avance
 * de plus en plus vite tant que le bouton est tenu (rampe), figé au relâchement,
 * seek + reprise CONFIRM_AFTER_RELEASE_MS après la dernière interaction (OK sur
 * play/pause confirme plus tôt, BACK annule).
 *
 * Canaux d'entrée :
 *  - **Android : événements NATIFS `tntCenterHold`** (MainActivity) — un
 *    maintien OK peut arriver du système en paires down/up en rafale (clavier
 *    d'émulateur ~500 paires/s, CEC) : la Pressability et les TVEvents JS se
 *    drainent alors avec des secondes de retard. Le coalesceur natif (thread
 *    UI, zéro backlog) n'émet que « start » (premier down) et « end » (plus de
 *    down depuis 200 ms) + le timestamp du dernier down — la position seekée
 *    est recalée dessus. Les press JS du Pressable sont ignorés sur Android.
 *  - **tvOS : press classiques** (onPressIn/onPressOut, fiables là-bas).
 */
export function useButtonSeek({
  durationRef, startScrubbing, nudgeScrub, confirmScrub, clearIdleCancel,
  scrubbingRef, scrubViaButtonRef, setScrubViaButton, setSpeedLabel,
}: {
  durationRef: Ref<number>;
  startScrubbing: (dir?: "forward" | "backward") => void;
  nudgeScrub: (deltaSeconds: number) => void;
  confirmScrub: () => void;
  clearIdleCancel: () => void;
  scrubbingRef: Ref<boolean>;
  scrubViaButtonRef: Ref<boolean>;
  setScrubViaButton: Dispatch<SetStateAction<boolean>>;
  setSpeedLabel: Dispatch<SetStateAction<string | null>>;
}) {
  const loopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdRef = useRef<{ sign: 1 | -1; start: number } | null>(null);
  const confirmSoonRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Échantillons {t, cumul} de l'avance pendant le hold — permet de retrancher
  // ce qui a été avancé APRÈS le dernier down réel (fenêtre de coalescing).
  const cumulRef = useRef(0);
  const samplesRef = useRef<Array<{ t: number; c: number }>>([]);

  const stopLoop = useCallback(() => {
    if (loopRef.current) { clearInterval(loopRef.current); loopRef.current = null; }
  }, []);
  const clearConfirmSoon = useCallback(() => {
    if (confirmSoonRef.current) { clearTimeout(confirmSoonRef.current); confirmSoonRef.current = null; }
  }, []);
  useEffect(() => () => { stopLoop(); clearConfirmSoon(); }, [stopLoop, clearConfirmSoon]);

  const armConfirmSoon = useCallback(() => {
    clearConfirmSoon();
    confirmSoonRef.current = setTimeout(() => {
      confirmSoonRef.current = null;
      if (__DEV__) console.log("[SCRUB] confirm (release timeout)");
      confirmScrub(); // no-op si le scrub a été confirmé/annulé entre-temps
    }, CONFIRM_AFTER_RELEASE_MS);
  }, [clearConfirmSoon, confirmScrub]);

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

  /** Début de maintien / tap (idempotent sur le sens ; un sens opposé pendant
   *  un hold redémarre la rampe dans l'autre direction). */
  const beginHold = useCallback((sign: 1 | -1) => {
    clearConfirmSoon();
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
    nudgeScrub(sign * BUTTON_SEEK_BASE);           // saut de base immédiat (tap = petit saut)
    setSpeedLabel(`${sign > 0 ? "▶▶" : "◀◀"} 1x`);
    cumulRef.current = 0;
    samplesRef.current = [];
    holdRef.current = { sign, start: Date.now() };
    runLoop(sign, holdRef.current.start);
  }, [clearConfirmSoon, clearIdleCancel, startScrubbing, nudgeScrub, runLoop, stopLoop, scrubbingRef, scrubViaButtonRef, setScrubViaButton, setSpeedLabel]);

  /** Fin de maintien : fige le fantôme (recalé sur le dernier down réel si
   *  fourni), libère le verrou bouton, arme la confirmation différée. */
  const endHold = useCallback((lastDownAt?: number) => {
    if (!holdRef.current) return;
    stopLoop();
    holdRef.current = null;
    if (lastDownAt) {
      // Retranche l'avance postérieure au dernier down réel (fenêtre de
      // coalescing natif) → la position figée est celle du relâchement.
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
    // Le scrub reste OUVERT (fantôme figé) : OK/▶︎❙❙ confirment, BACK annule,
    // sinon confirmation automatique différée.
    scrubViaButtonRef.current = false; setScrubViaButton(false);
    armConfirmSoon();
  }, [stopLoop, nudgeScrub, armConfirmSoon, scrubViaButtonRef, setScrubViaButton]);

  // Android : canal natif coalescé (cf. MainActivity.kt).
  useEffect(() => {
    if (Platform.OS === "ios") return;
    const sub = DeviceEventEmitter.addListener(
      "tntCenterHold",
      (e: { phase: "start" | "end"; lastDownAt: number }) => {
        if (e.phase === "start") {
          const k = osdFocusedKeyRef.current;
          if (k === "fastforward") beginHold(1);
          else if (k === "rewind") beginHold(-1);
          return;
        }
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
