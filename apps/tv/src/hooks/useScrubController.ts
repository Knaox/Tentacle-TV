import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { Platform } from "react-native";
import { pasDeScrub } from "@tentacle-tv/shared";
import { getSpeedTier } from "./scrubAcceleration";
import { useScrubHoldMotor } from "./useScrubHoldMotor";

/** Gap entre deux événements répétés au-delà duquel le hold est terminé */
const HOLD_RELEASE_MS = 350;
/** Délai d'INACTIVITÉ en scrub avant d'ANNULER seul (reprise à la position
 *  d'origine, AUCUN seek). Le seek ne part QUE sur confirmation explicite :
 *  OK (select) ou bouton ▶︎❙❙.
 *  Filet anti-seek accidentel : saisir la télécommande n'engage au pire qu'un
 *  scrub visuel qui se résorbe seul sans déplacer la lecture. */
const SCRUB_IDLE_CANCEL_MS = 7000;

interface HoldState {
  dir: "forward" | "backward";
  startTime: number;
}

type Ref<T> = MutableRefObject<T>;

interface ScrubControllerArgs {
  showOverlay: () => void;
  /** Masque l'OSD à l'ENTRÉE en scrub : la seule UI de scrub est le plein écran
   *  trickplay (TVScrubFullscreen) et le fond reprend le focus. */
  hideOverlay: () => void;
  currentTimeRef: Ref<number>;
  durationRef: Ref<number>;
  onSeekRef: Ref<(seconds: number) => void>;
  onScrubPauseRef: Ref<(paused: boolean) => void>;
  overlayVisibleRef: Ref<boolean>;
  panelOpenRef: Ref<boolean>;
  /** Évite que onAnyPress ré-affiche l'OSD sur les events ←/→. */
  skipAnyPressRef: Ref<boolean>;
}

/**
 * Moteur de SCRUB du lecteur (mode « Netflix ») — PARTAGÉ Android/tvOS, extrait
 * de useTVPlayerControls (budget 300 lignes). Curseur fantôme, AUCUN seek tant
 * que non confirmé, accélération par paliers pendant un maintien. Les entrées
 * (bouton ⏩ de l'OSD, ←/→, long-press, touches media rewind/FF ; gestes pan
 * côté tvOS) appellent les mêmes handlers exposés ici → comportement identique
 * partout (source unique). Le MAINTIEN ←/→ (armement + tick + réveil différé)
 * vit dans useScrubHoldMotor (budget 300 lignes).
 */
export function useScrubController({
  showOverlay, hideOverlay, currentTimeRef, durationRef, onSeekRef, onScrubPauseRef,
  overlayVisibleRef, panelOpenRef, skipAnyPressRef,
}: ScrubControllerArgs) {
  const [scrubbing, setScrubbing] = useState(false);
  const scrubbingRef = useRef(false);
  const [scrubPosition, setScrubPosition] = useState(0);
  const scrubPositionRef = useRef(0);

  const [speedLabel, setSpeedLabel] = useState<string | null>(null);
  // Fin du dernier scrub (confirm OU cancel) : un OK génère À LA FOIS l'event TV
  // global « select » et le press du Pressable focusé (même key-up, ordre
  // indéterminé) — ce timestamp permet d'absorber le jumeau arrivé en second.
  const scrubEndedAtRef = useRef(0);
  // Dernier event touche media FF/RW : pendant un MAINTIEN, certaines
  // télécommandes intercalent des échos select/playPause entre les répétitions —
  // un vrai OK de confirmation n'arrive qu'après le relâchement.
  const lastMediaKeyAtRef = useRef(0);
  const holdRef = useRef<HoldState | null>(null);
  const releaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Timer d'annulation sur inactivité (cf. armIdleCancel / endShuttleGesture).
  const idleCancelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Arrêt des moteurs de maintien (rempli après useScrubHoldMotor — confirm/
  // cancel sont déclarés avant lui dans la chaîne de dépendances).
  const stopMotorsRef = useRef<() => void>(() => {});
  const clearIdleCancel = useCallback(() => {
    if (idleCancelTimerRef.current) { clearTimeout(idleCancelTimerRef.current); idleCancelTimerRef.current = null; }
  }, []);
  useEffect(() => () => clearIdleCancel(), [clearIdleCancel]);

  const endHold = useCallback(() => {
    if (releaseTimerRef.current) { clearTimeout(releaseTimerRef.current); releaseTimerRef.current = null; }
    holdRef.current = null;
    setSpeedLabel(null);
  }, []);
  useEffect(() => () => endHold(), [endHold]);

  // confirm/cancel déclarés AVANT les mouvements : armIdleCancel (annulation sur
  // inactivité) en dépend, et chaque avance du fantôme réarme ce timer.
  // Les DEUX stoppent les moteurs de maintien : si le key-up n'arrive jamais
  // (long-press ANNULÉ par tvOS → aucun keyAction), le tick mourait ici au
  // plus tard au lieu d'avancer le curseur pour toujours.
  const confirmScrub = useCallback(() => {
    if (__DEV__) console.log(`[SCRUB] confirmScrub (scrubbing=${scrubbingRef.current})`);
    clearIdleCancel();
    stopMotorsRef.current();
    if (!scrubbingRef.current) return;
    scrubEndedAtRef.current = Date.now();
    scrubbingRef.current = false;
    setScrubbing(false);
    endHold();
    // Base des skips ±10/30 synchronisée AVANT le seek : sans ça, un +30 immédiat
    // après la confirmation repartait de la position PRÉ-scrub (currentTimeRef n'est
    // sinon rafraîchi qu'au prochain progress accepté).
    currentTimeRef.current = scrubPositionRef.current;
    onSeekRef.current(scrubPositionRef.current);
    onScrubPauseRef.current(false);
    showOverlay();
  }, [endHold, clearIdleCancel, showOverlay, onSeekRef, onScrubPauseRef, currentTimeRef]);

  const cancelScrub = useCallback(() => {
    clearIdleCancel();
    stopMotorsRef.current();
    if (!scrubbingRef.current) return;
    scrubEndedAtRef.current = Date.now();
    scrubbingRef.current = false;
    setScrubbing(false);
    endHold();
    onScrubPauseRef.current(false);
    showOverlay();
  }, [endHold, clearIdleCancel, showOverlay, onScrubPauseRef]);

  /** (Ré)arme l'annulation sur inactivité : SCRUB_IDLE_CANCEL_MS sans nouvelle
   *  avance ni confirmation → cancelScrub (reprise SANS seek). Appelé à chaque
   *  mouvement du fantôme et au lever du doigt/bouton. */
  const armIdleCancel = useCallback(() => {
    clearIdleCancel();
    idleCancelTimerRef.current = setTimeout(() => {
      idleCancelTimerRef.current = null;
      cancelScrub();
    }, SCRUB_IDLE_CANCEL_MS);
  }, [clearIdleCancel, cancelScrub]);

  const moveScrub = useCallback((dir: "forward" | "backward") => {
    // Hold = mêmes events répétés → accélération par paliers.
    const now = Date.now();
    if (holdRef.current && holdRef.current.dir === dir) {
      const speed = getSpeedTier(holdRef.current.startTime);
      if (speed > 1) setSpeedLabel(`${dir === "forward" ? ">>" : "<<"}${speed}x`);
    } else {
      holdRef.current = { dir, startTime: now };
      setSpeedLabel(null);
    }
    if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current);
    releaseTimerRef.current = setTimeout(endHold, HOLD_RELEASE_MS);

    const speed = getSpeedTier(holdRef.current.startTime);
    // Pas PROPORTIONNEL à la durée (pasDeScrub, partagé webOS) : même vitesse
    // RELATIVE de barre sur un épisode de 3 min et un film de 50.
    const delta = (dir === "forward" ? 1 : -1) * pasDeScrub(durationRef.current) * speed;
    const dur = durationRef.current || 0;
    const next = Math.max(0, dur > 0 ? Math.min(scrubPositionRef.current + delta, dur) : scrubPositionRef.current + delta);
    scrubPositionRef.current = next;
    setScrubPosition(next);
    armIdleCancel();
  }, [endHold, durationRef, armIdleCancel]);

  /** Appui SIMPLE ←/→ en scrub : UN pas de base (pasDeScrub — proportionnel à
   *  la durée du média), SANS accélération — la montée 2x/4x/8x est réservée au
   *  MAINTIEN (tick du hold motor, temps réel). Avant : chaque appui passait
   *  par moveScrub → des appuis rapprochés héritaient du palier (« tout à x8 »). */
  const stepScrub = useCallback((dir: "forward" | "backward") => {
    endHold();
    const delta = (dir === "forward" ? 1 : -1) * pasDeScrub(durationRef.current);
    const dur = durationRef.current || 0;
    const next = Math.max(0, dur > 0 ? Math.min(scrubPositionRef.current + delta, dur) : scrubPositionRef.current + delta);
    scrubPositionRef.current = next;
    setScrubPosition(next);
    armIdleCancel();
  }, [endHold, durationRef, armIdleCancel]);

  // Entrée réelle en scrub (anti-jumeau) : un OK sur le bouton ⏩ émet AUSSI
  // l'event TV global « select » (même key-up, ordre indéterminé sur tvOS) — sans
  // cette fenêtre, le jumeau confirmerait le scrub à l'instant de son ouverture.
  const scrubStartedAtRef = useRef(0);

  const startScrubbing = useCallback((dir?: "forward" | "backward") => {
    // Déjà en scrub (ex. shuttle tvOS : doigt levé puis reposé) → NE PAS
    // réinitialiser la position fantôme. Évite le saut au point de lecture live
    // à la reprise du geste.
    if (scrubbingRef.current) { armIdleCancel(); return; }
    scrubStartedAtRef.current = Date.now();
    scrubbingRef.current = true;
    setScrubbing(true);
    scrubPositionRef.current = currentTimeRef.current;
    setScrubPosition(currentTimeRef.current);
    onScrubPauseRef.current(true);
    // L'OSD se MASQUE pendant le scrub : TVScrubFullscreen est la seule UI, le
    // fond redevient focusable et capte OK/←/→ sans navigation entre boutons.
    hideOverlay();
    armIdleCancel();
    if (dir) moveScrub(dir);
  }, [hideOverlay, moveScrub, currentTimeRef, onScrubPauseRef, armIdleCancel]);

  // Avance CONTINUE de la position fantôme (modèle shuttle tvOS) : delta signé en
  // secondes, clamp [0, durée]. N'utilise PAS les paliers de maintien (réservés au
  // D-pad Android) — la vitesse est calculée par l'adaptateur de gestes.
  const nudgeScrub = useCallback((deltaSeconds: number) => {
    armIdleCancel(); // nouvelle avance → repousse l'annulation sur inactivité
    const dur = durationRef.current || 0;
    const next = Math.max(0, dur > 0
      ? Math.min(scrubPositionRef.current + deltaSeconds, dur)
      : scrubPositionRef.current + deltaSeconds);
    scrubPositionRef.current = next;
    setScrubPosition(next);
  }, [durationRef, armIdleCancel]);

  // Shuttle tvOS : le doigt se lève (geste pan « Ended »). Le scrub RESTE
  // ouvert : OK / ▶︎❙❙ VALIDENT le seek, BACK annule, et l'inactivité
  // (armIdleCancel) annule seule SANS seek — saisir la télécommande ne déplace
  // plus jamais la lecture. (Avant : auto-validation du seek 800 ms après le
  // lever du doigt → seeks accidentels.)
  const endShuttleGesture = useCallback(() => {
    endHold();
    if (!scrubbingRef.current) return;
    armIdleCancel();
  }, [endHold, armIdleCancel]);

  // --- Maintien ←/→ : armement + tick JS + réveil différé (useScrubHoldMotor). ---
  const hold = useScrubHoldMotor({
    scrubbingRef, panelOpenRef, overlayVisibleRef, holdRef,
    startScrubbing, moveScrub, showOverlay, armIdleCancel, endHold,
  });
  stopMotorsRef.current = hold.stopAll;

  const handleDpadDirection = useCallback((dir: "forward" | "backward") => {
    if (panelOpenRef.current) return; // panneau ouvert → D-pad au panneau
    skipAnyPressRef.current = true;
    // Android agit au key-DOWN → armer la détection de maintien AUTONOME
    // (down sans key-up = hold) : le signal long-press natif n'est pas fiable
    // sur émulateur/certaines manettes. Gardes ré-évaluées au déclenchement.
    if (Platform.OS === "android") hold.armHoldFromDown(dir);
    if (scrubbingRef.current) {
      // Hold en cours (ou key-up résiduel) : avance pilotée par le tick JS —
      // les events directionnels seraient des doublons parasites.
      if (hold.isHoldTicking()) return;
      stepScrub(dir);
      return;
    }
    // OSD caché → 1er appui : afficher l'OSD. Android : réveil DIFFÉRÉ au
    // key-up — l'afficher au key-down rendait l'OSD visible AVANT le signal
    // long-press et bloquait l'avance rapide au MAINTIEN. tvOS : ←/→ n'arrive
    // qu'au key-up → le réveil est déjà « au relâchement ».
    if (Platform.OS === "android") hold.requestDeferredWake();
    else showOverlay();
  }, [showOverlay, stepScrub, panelOpenRef, skipAnyPressRef, hold]);

  // Touches rewind/fast-forward dédiées : scrub direct, même OSD visible.
  const handleMediaSeekKey = useCallback((dir: "forward" | "backward") => {
    if (panelOpenRef.current) return;
    skipAnyPressRef.current = true;
    lastMediaKeyAtRef.current = Date.now();
    if (scrubbingRef.current) { moveScrub(dir); return; }
    startScrubbing(dir);
  }, [moveScrub, startScrubbing, panelOpenRef, skipAnyPressRef]);

  return {
    scrubbing, scrubPosition, speedLabel, scrubbingRef,
    scrubEndedAtRef, scrubStartedAtRef, lastMediaKeyAtRef,
    moveScrub, nudgeScrub, setSpeedLabel, startScrubbing, confirmScrub, cancelScrub, endHold, endShuttleGesture,
    handleDpadDirection,
    handleLongDirection: hold.handleLongDirection,
    onHoldRelease: hold.onHoldRelease,
    handleMediaSeekKey,
  };
}
