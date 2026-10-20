import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BOOT_INTRO_MAX_HOLD_MS,
  BOOT_SOUND_BRIDGE_MARGIN_MS,
  BOOT_SOUND_PREPARE_MAX_MS,
  bootIntroOutcome,
  bootSoundLeads,
  introFrameReport,
  type IntroFrameReport,
} from "@tentacle-tv/shared/brandIntro";
import { bootIntroGate, useBootIntroReport } from "./bootIntroGate";
import { bootSound } from "./bootSound";
import { useIntroClock, type IntroClockControl, type IntroWallTrace } from "./useIntroClock";

/** La traîne du son après l'arrivée (le bloom de l'accord, la vague) : le lecteur se libère ensuite. */
const SOUND_TAIL_MS = 5_000;

type SoundPrepared = { ready: boolean; outputLeadMs: number | null };
const NO_SOUND: SoundPrepared = { ready: false, outputLeadMs: null };

/** La préparation, ou rien si elle tarde au-delà de `BOOT_SOUND_PREPARE_MAX_MS` (shared). */
function withinPrepareLimit(prepared: Promise<SoundPrepared>): Promise<SoundPrepared> {
  const late = new Promise<SoundPrepared>((resolve) => setTimeout(() => resolve(NO_SOUND), BOOT_SOUND_PREPARE_MAX_MS));
  return Promise.race([prepared, late]);
}

export interface BootIntroRunOptions {
  /** Le « ta-dum » est voulu (réglage d'appareil) : relu au départ, il peut arriver un peu après. */
  soundWanted: Promise<boolean>;
  /** Les écrans qui disent eux-mêmes quand ils sont prêts (défaut : ceux de la TV). */
  selfReporting?: readonly string[];
  /** À l'arrivée : le bilan des images de l'ouverture (shared `introFrameReport`). */
  onFrameReport?: (report: IntroFrameReport, trace: IntroWallTrace) => void;
  /** Rester sur l'encre tant que l'app démarre (mobile : `bootIntroGate.reportAppReady`, shared `introStart`). */
  waitForApp?: boolean;
  /**
   * Le temps que la demande du son met à joindre le natif (shared `bootSoundLeads`) :
   * la TV garde `BOOT_SOUND_BRIDGE_MARGIN_MS`, le mobile prend `BOOT_SOUND_MOBILE_BRIDGE_MARGIN_MS`.
   */
  soundBridgeMarginMs?: number;
  /**
   * N'appuyer sur lecture qu'une fois le son préparé (au plus `BOOT_SOUND_PREPARE_MAX_MS`) :
   * sinon il serait demandé avant que sa sortie soit mesurée, avec une avance trop courte (mobile).
   */
  waitForSound?: boolean;
}

export interface BootIntroRun {
  clock: IntroClockControl;
  /** Arrivée : l'app est à l'identité, le décor s'est retiré. */
  landed: boolean;
}

/**
 * Le DÉROULÉ de l'ouverture, le même sur la TV et le mobile : elle part
 * d'elle-même dès le montage — aucun geste attendu —, attend sur le bouton
 * lecture tant que le PREMIER écran, quel qu'il soit, n'est pas prêt (shared
 * `bootIntroOutcome`, au plus 8 s), joue le ta-dum à l'heure de l'image, plonge
 * dans cet écran et rend l'app à l'identité. Elle ne renonce jamais : un écran
 * hors ligne, en échec ou bloqué est celui sur lequel l'écran du poulpe
 * s'allume. Le son se décode pendant que le poulpe s'assemble, seulement s'il
 * est voulu ; la sortie mesurée (Android) dit quand le demander.
 */
export function useBootIntroRun({
  soundWanted,
  selfReporting,
  onFrameReport,
  waitForApp = false,
  soundBridgeMarginMs = BOOT_SOUND_BRIDGE_MARGIN_MS,
  waitForSound = false,
}: BootIntroRunOptions): BootIntroRun {
  const [landed, setLanded] = useState(false);
  // Sans attente du son (la TV), il est réglé d'emblée : l'ouverture ne l'attend jamais.
  const [soundSettled, setSoundSettled] = useState(!waitForSound);
  const [heldSince, setHeldSince] = useState<number | null>(null);
  const [heldOut, setHeldOut] = useState(false);
  // Lu à l'arrivée seulement : sa dernière valeur, sans rejouer l'effet.
  const frameReportRef = useRef(onFrameReport);
  frameReportRef.current = onFrameReport;
  const soundReady = useRef<Promise<SoundPrepared> | null>(null);

  if (soundReady.current === null) {
    const prepared = soundWanted.then((wanted) => (wanted ? bootSound.prepare() : NO_SOUND));
    soundReady.current = waitForSound ? withinPrepareLimit(prepared) : prepared;
  }

  const land = useCallback(() => setLanded(true), []);
  const events = useMemo(
    () => ({
      onHold: () => setHeldSince(Date.now()),
      onSound: (startAt: number) => {
        void soundReady.current?.then(({ ready }) => (ready ? bootSound.playAt(startAt) : undefined));
      },
      onDone: land,
    }),
    [land],
  );
  const clock = useIntroClock(events, null, { waitForApp });

  useEffect(() => {
    void soundReady.current?.then(({ ready, outputLeadMs }) => {
      if (ready) {
        const leads = bootSoundLeads(outputLeadMs, soundBridgeMarginMs);
        clock.requestAt.value = leads.requestAt;
        clock.releaseDelay.value = leads.releaseDelayMs;
      }
      // Les avances posées AVANT que l'appui ne soit permis : le son se demande à temps.
      setSoundSettled(true);
    });
  }, [clock, soundBridgeMarginMs]);

  // Au bout de l'attente maximale, on plonge quand même : l'écran dit qu'il charge.
  useEffect(() => {
    if (heldSince === null) return undefined;
    const timer = setTimeout(() => setHeldOut(true), BOOT_INTRO_MAX_HOLD_MS);
    return () => clearTimeout(timer);
  }, [heldSince]);

  const report = useBootIntroReport();
  useEffect(() => {
    if (report.appReady) clock.appReady.value = true;
  }, [report.appReady, clock]);
  const outcome = bootIntroOutcome({
    route: report.route,
    screen: report.route === null ? null : report.screens[report.route] ?? null,
    blocked: report.blocked,
    pending: report.pending,
    heldMs: heldOut ? BOOT_INTRO_MAX_HOLD_MS : 0,
    ...(selfReporting ? { selfReporting } : {}),
  });
  useEffect(() => {
    if (!landed && soundSettled && outcome === "go") clock.ready.value = true;
  }, [outcome, landed, soundSettled, clock]);

  // Tant qu'elle se joue, rien ne sonne ni ne s'ouvre par-dessus (aperçus, modales du lancement).
  useEffect(() => {
    bootIntroGate.reportPlaying(!landed);
  }, [landed]);

  useEffect(() => {
    if (!landed) return undefined;
    clock.landed.value = 1;
    clock.stop();
    // Le bilan des images (images perdues, pire écart, par phase) : à qui le demande (le banc).
    frameReportRef.current?.(introFrameReport(clock.frameLog.value), clock.wallTrace.value);
    const timer = setTimeout(() => bootSound.dispose(), SOUND_TAIL_MS);
    return () => clearTimeout(timer);
  }, [landed, clock]);

  return { clock, landed };
}
