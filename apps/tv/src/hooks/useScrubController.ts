import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { Platform } from "react-native";
import { createScrubMachine, IDLE_CANCEL_MS } from "@tentacle-tv/tv-core";
import { useScrubHoldMotor } from "./useScrubHoldMotor";

type Dir = "forward" | "backward";
type Ref<T> = MutableRefObject<T>;

const signOf = (dir: Dir): 1 | -1 => (dir === "forward" ? 1 : -1);

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
 * L'ADAPTATEUR du scrub — la MACHINE (curseur fantôme, pas proportionnel,
 * paliers, annulation à 7 s d'inactivité, aucun seek avant confirmation) vit
 * dans `creerMachineScrub` (tv-core), la même que la LG. Ne restent ici que :
 *
 *  - le miroir React (états `scrubbing`/`scrubPosition`/`speedLabel`) ;
 *  - l'orchestration de l'OSD (masqué à l'entrée, réaffiché à la sortie) ;
 *  - l'absorption des événements JUMEAUX (un OK émet à la fois l'event TV
 *    global et le press du bouton focusé) et des échos de touches média ;
 *  - les points d'entrée par plateforme (D-pad, long-press, touches média) ;
 *  - la TRAPPE DE SORTIE du geste pan tvOS — voir `nudgeScrub`.
 *
 * **La trappe pan.** Le shuttle tvOS avance par deltas CONTINUS ; la machine
 * ne connaît que des pas discrets, et son API ne sera pas étendue pour un seul
 * adaptateur. La position AFFICHÉE fait donc foi : les pas de la machine s'y
 * appliquent en DELTAS (continuité même après un pan), le pan s'y applique
 * directement, et la confirmation seek TOUJOURS sur l'affichage. La machine
 * garde son propre compte interne — il ne sert qu'à borner ses pas.
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

  // Fin du dernier scrub (confirm OU cancel) : absorbe le press jumeau d'un OK.
  const scrubEndedAtRef = useRef(0);
  // Entrée réelle en scrub : absorbe le « select » jumeau du bouton ⏩.
  const scrubStartedAtRef = useRef(0);
  // Dernier event touche media FF/RW : absorbe les échos select/playPause.
  const lastMediaKeyAtRef = useRef(0);

  // Arrêt des moteurs de maintien (rempli après useScrubHoldMotor).
  const stopMotorsRef = useRef<() => void>(() => {});

  // Dernière position CONNUE de la machine — sert à appliquer ses pas en
  // deltas sur l'affichage (trappe pan).
  const machineLastRef = useRef(0);

  const clampDisplay = useCallback((value: number) => {
    const duration = durationRef.current || 0;
    if (!(duration > 0)) return Math.max(0, value);
    return Math.min(Math.max(0, value), duration);
  }, [durationRef]);

  const setDisplay = useCallback((value: number) => {
    scrubPositionRef.current = value;
    setScrubPosition(value);
  }, []);

  // La veille d'inactivité du PAN : la machine arme la sienne à chaque pas,
  // mais un pan n'est pas un pas — même durée, même issue (annulation sans
  // seek), armée ici.
  const panIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearPanIdle = useCallback(() => {
    if (panIdleTimerRef.current) { clearTimeout(panIdleTimerRef.current); panIdleTimerRef.current = null; }
  }, []);
  useEffect(() => () => clearPanIdle(), [clearPanIdle]);

  const machine = useMemo(() => createScrubMachine({
    readPosition: () => currentTimeRef.current,
    readDuration: () => durationRef.current || 0,
    onEnter: (position) => {
      scrubStartedAtRef.current = Date.now();
      scrubbingRef.current = true;
      setScrubbing(true);
      machineLastRef.current = position;
      setDisplay(position);
      // L'OSD se MASQUE pendant le scrub : TVScrubFullscreen est la seule UI,
      // le fond redevient focusable et capte OK/←/→ sans navigation.
      hideOverlay();
    },
    onChange: (position) => {
      const delta = position - machineLastRef.current;
      machineLastRef.current = position;
      setDisplay(clampDisplay(scrubPositionRef.current + delta));
    },
    onPause: (pause) => onScrubPauseRef.current(pause),
    onSeek: () => {
      // La position AFFICHÉE fait foi (elle intègre le pan tvOS). Base des
      // skips ±10/30 synchronisée AVANT le seek : un +30 immédiat après la
      // confirmation ne doit pas repartir de la position pré-scrub.
      currentTimeRef.current = scrubPositionRef.current;
      onSeekRef.current(scrubPositionRef.current);
    },
    onExit: () => {
      clearPanIdle();
      stopMotorsRef.current();
      scrubEndedAtRef.current = Date.now();
      scrubbingRef.current = false;
      setScrubbing(false);
      setSpeedLabel(null);
      showOverlay();
    },
    // Machine unique : toutes les entrées passent par des refs stables.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);
  useEffect(() => () => machine.destroy(), [machine]);

  const armPanIdle = useCallback(() => {
    clearPanIdle();
    panIdleTimerRef.current = setTimeout(() => {
      panIdleTimerRef.current = null;
      machine.cancel();
    }, IDLE_CANCEL_MS);
  }, [clearPanIdle, machine]);

  const startScrubbing = useCallback((dir?: Dir) => {
    // Déjà en scrub (ex. shuttle tvOS : doigt levé puis reposé) → NE PAS
    // réinitialiser la position fantôme ; on repousse juste l'annulation.
    if (machine.isActive()) { armPanIdle(); return; }
    machine.enter();
    if (dir) machine.step(signOf(dir), 1);
  }, [machine, armPanIdle]);

  /** Un pas SEC (appui simple ←/→ ou touche média isolée) : palier 1, jamais
   *  d'accélération — elle est réservée au MAINTIEN (tic du moteur). */
  const stepScrub = useCallback((dir: Dir) => {
    setSpeedLabel(null);
    machine.step(signOf(dir), 1);
  }, [machine]);

  /** Un tic de MAINTIEN : le moteur fournit le palier (1 par seconde). */
  const tickScrub = useCallback((dir: Dir, tier: number) => {
    machine.step(signOf(dir), tier);
    setSpeedLabel(tier > 1 ? `${dir === "forward" ? ">>" : "<<"}${tier}x` : null);
  }, [machine]);

  const confirmScrub = useCallback(() => {
    if (__DEV__) console.log(`[SCRUB] confirmScrub (scrubbing=${scrubbingRef.current})`);
    clearPanIdle();
    stopMotorsRef.current();
    machine.confirm();
  }, [machine, clearPanIdle]);

  const cancelScrub = useCallback(() => {
    clearPanIdle();
    stopMotorsRef.current();
    machine.cancel();
  }, [machine, clearPanIdle]);

  // Avance CONTINUE de la position fantôme (shuttle tvOS) : delta signé en
  // secondes — la TRAPPE, hors machine (cf. doc d'en-tête).
  const nudgeScrub = useCallback((deltaSeconds: number) => {
    armPanIdle();
    setDisplay(clampDisplay(scrubPositionRef.current + deltaSeconds));
  }, [armPanIdle, clampDisplay, setDisplay]);

  // Shuttle tvOS : le doigt se lève. Le scrub RESTE ouvert : OK/▶︎❙❙ valident,
  // BACK annule, l'inactivité annule seule SANS seek.
  const endShuttleGesture = useCallback(() => {
    if (!scrubbingRef.current) return;
    setSpeedLabel(null);
    armPanIdle();
  }, [armPanIdle]);

  // --- Maintien ←/→ et touches média : l'adaptateur du moteur tv-core. ---
  const hold = useScrubHoldMotor({
    scrubbingRef, panelOpenRef, overlayVisibleRef,
    stepScrub, tickScrub, showOverlay,
    onHoldEnd: () => setSpeedLabel(null),
  });
  stopMotorsRef.current = hold.stopAll;

  const handleDpadDirection = useCallback((dir: Dir) => {
    if (panelOpenRef.current) return; // panneau ouvert → D-pad au panneau
    skipAnyPressRef.current = true;
    // Android agit au key-DOWN → armer la détection de maintien AUTONOME.
    if (Platform.OS === "android") hold.armHoldFromDown(dir);
    if (scrubbingRef.current) {
      // Hold en cours (ou key-up résiduel) : l'avance appartient au tic —
      // les events directionnels seraient des doublons parasites.
      if (hold.isHoldTicking()) return;
      stepScrub(dir);
      return;
    }
    // OSD caché → 1er appui : afficher l'OSD. Android : réveil DIFFÉRÉ au
    // key-up — l'afficher au key-down bloquait l'avance rapide au maintien.
    if (Platform.OS === "android") hold.requestDeferredWake();
    else showOverlay();
  }, [showOverlay, stepScrub, panelOpenRef, skipAnyPressRef, hold]);

  // Touches rewind/fast-forward dédiées : scrub direct, même OSD visible.
  // En scrub, la MACHINE départage appui isolé (pas sec) et cadence de
  // répétition (tic accéléré) — c'était un accéléromètre maison avant.
  const handleMediaSeekKey = useCallback((dir: Dir) => {
    if (panelOpenRef.current) return;
    skipAnyPressRef.current = true;
    lastMediaKeyAtRef.current = Date.now();
    if (scrubbingRef.current) { hold.mediaPulse(dir); return; }
    startScrubbing(dir);
  }, [startScrubbing, panelOpenRef, skipAnyPressRef, hold]);

  return {
    scrubbing, scrubPosition, speedLabel, scrubbingRef,
    scrubEndedAtRef, scrubStartedAtRef, lastMediaKeyAtRef,
    nudgeScrub, setSpeedLabel, startScrubbing, confirmScrub, cancelScrub, endShuttleGesture,
    handleDpadDirection,
    handleLongDirection: hold.handleLongDirection,
    onHoldRelease: hold.onHoldRelease,
    handleMediaSeekKey,
  };
}
