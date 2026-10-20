import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BOOT_INTRO_MAX_HOLD_MS, bootIntroOutcome, bootSoundLeads } from "@tentacle-tv/shared/brandIntro";
import { bootIntroGate, useBootIntroReport } from "./bootIntroGate";
import { bootSound } from "./bootSound";
import { useIntroClock, type IntroClockControl } from "./useIntroClock";

/** La traîne du son après l'arrivée (le bloom de l'accord, la vague) : le lecteur se libère ensuite. */
const SOUND_TAIL_MS = 5_000;

export interface BootIntroRunOptions {
  /** Le « ta-dum » est voulu (réglage d'appareil) : relu au départ, il peut arriver un peu après. */
  soundWanted: Promise<boolean>;
  /** Les écrans qui disent eux-mêmes quand ils sont prêts (défaut : ceux de la TV). */
  selfReporting?: readonly string[];
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
export function useBootIntroRun({ soundWanted, selfReporting }: BootIntroRunOptions): BootIntroRun {
  const [landed, setLanded] = useState(false);
  const [heldSince, setHeldSince] = useState<number | null>(null);
  const [heldOut, setHeldOut] = useState(false);
  const soundReady = useRef<Promise<{ ready: boolean; outputLeadMs: number | null }> | null>(null);

  if (soundReady.current === null) {
    soundReady.current = soundWanted.then((wanted) => (wanted ? bootSound.prepare() : { ready: false, outputLeadMs: null }));
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
  const clock = useIntroClock(events);

  useEffect(() => {
    void soundReady.current?.then(({ ready, outputLeadMs }) => {
      if (!ready) return;
      const leads = bootSoundLeads(outputLeadMs);
      clock.requestAt.value = leads.requestAt;
      clock.releaseDelay.value = leads.releaseDelayMs;
    });
  }, [clock]);

  // Au bout de l'attente maximale, on plonge quand même : l'écran dit qu'il charge.
  useEffect(() => {
    if (heldSince === null) return undefined;
    const timer = setTimeout(() => setHeldOut(true), BOOT_INTRO_MAX_HOLD_MS);
    return () => clearTimeout(timer);
  }, [heldSince]);

  const report = useBootIntroReport();
  const outcome = bootIntroOutcome({
    route: report.route,
    screen: report.route === null ? null : report.screens[report.route] ?? null,
    blocked: report.blocked,
    pending: report.pending,
    heldMs: heldOut ? BOOT_INTRO_MAX_HOLD_MS : 0,
    ...(selfReporting ? { selfReporting } : {}),
  });
  useEffect(() => {
    if (!landed && outcome === "go") clock.ready.value = true;
  }, [outcome, landed, clock]);

  // Tant qu'elle se joue, rien ne sonne ni ne s'ouvre par-dessus (aperçus, modales du lancement).
  useEffect(() => {
    bootIntroGate.reportPlaying(!landed);
  }, [landed]);

  useEffect(() => {
    if (!landed) return undefined;
    clock.landed.value = 1;
    clock.stop();
    const timer = setTimeout(() => bootSound.dispose(), SOUND_TAIL_MS);
    return () => clearTimeout(timer);
  }, [landed, clock]);

  return { clock, landed };
}
