import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Dimensions } from "react-native";
import { BOOT_INTRO_MAX_HOLD_MS, bootIntroOutcome, bootSoundLeads } from "@tentacle-tv/tv-core/boot";
// Le dessin du logo : ses constantes GÉNÉRÉES (brand/generate-svg.py), passées à la vue.
import * as TENTACLE_ART from "../../components/icons/tentacleArt.generated";
import { readBootSoundSetting } from "../../lib/bootSoundSetting";
import { bootSound } from "../../platform/tvos/bootSound/bootSound";
import { BootIntroView, useIntroScene } from "../../redesign/boot/BootIntroView";
import { useIntroClock } from "../../redesign/boot/useIntroClock";
import { Colors } from "../../theme/colors";
import { bootIntroGate, useBootIntroReport } from "./bootIntroGate";

/** La traîne du son après l'arrivée (le bloom de l'accord, la vague) : le lecteur se libère ensuite. */
const SOUND_TAIL_MS = 5_000;

/**
 * L'OUVERTURE du démarrage, branchée (Apple TV, Android TV) : elle part d'elle-même dès le
 * montage — aucun geste attendu — et se joue pendant que l'app charge : l'app
 * (`children`) se monte DANS l'écran du poulpe dès qu'elle est prête ;
 * l'ouverture attend sur le bouton lecture tant que le PREMIER écran, quel
 * qu'il soit, n'est pas prêt (tv-core `bootIntroOutcome`), joue le ta-dum à
 * l'heure de l'image (réglage « Son au démarrage »), plonge dans cet écran et
 * rend l'app à l'identité. Elle ne renonce jamais : un écran hors ligne, en
 * échec ou bloqué est celui sur lequel l'écran du poulpe s'allume. La décision
 * de la jouer — une fois par processus — est prise avant (`bootPlan`).
 */
export function BootIntroHost({ children }: { children: ReactNode }) {
  const [viewport] = useState(() => Dimensions.get("window"));
  const scene = useIntroScene(TENTACLE_ART, viewport);
  const [landed, setLanded] = useState(false);
  const [heldSince, setHeldSince] = useState<number | null>(null);
  const [heldOut, setHeldOut] = useState(false);
  const soundReady = useRef<Promise<{ ready: boolean; outputLeadMs: number | null }> | null>(null);

  // Le son se décode pendant que le poulpe s'assemble — seulement s'il est voulu (réglage relu).
  if (soundReady.current === null) {
    soundReady.current = readBootSoundSetting().then((wanted) =>
      wanted ? bootSound.prepare() : { ready: false, outputLeadMs: null },
    );
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

  // La sortie mesurée (Android TV) : le son se demande assez tôt pour ne rien perdre de son début.
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
    heldMs: heldOut ? BOOT_INTRO_MAX_HOLD_MS : 0,
  });
  useEffect(() => {
    if (!landed && outcome === "go") clock.ready.value = true;
  }, [outcome, landed, clock]);

  // Tant qu'elle se joue, l'aperçu de la zone attend : rien ne sonne par-dessus le ta-dum.
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

  return (
    <BootIntroView art={TENTACLE_ART} scene={scene} clock={clock} viewport={viewport} landed={landed} screenColor={Colors.bgDeep}>
      {children}
    </BootIntroView>
  );
}
