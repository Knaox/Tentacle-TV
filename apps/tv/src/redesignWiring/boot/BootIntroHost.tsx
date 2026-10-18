import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Dimensions } from "react-native";
import { runOnJS, useSharedValue, withTiming } from "react-native-reanimated";
import { BOOT_INTRO_ABORT, BOOT_INTRO_MAX_HOLD_MS, bootIntroOutcome } from "@tentacle-tv/tv-core/boot";
// Le dessin du logo : ses constantes GÉNÉRÉES (brand/generate-svg.py), passées à la vue.
import * as TENTACLE_ART from "../../components/icons/tentacleArt.generated";
import { bootSoundStore } from "../../lib/bootSoundSetting";
import { bootSound } from "../../platform/tvos/bootSound/bootSound";
import { BootIntroView, useIntroScene } from "../../redesign/boot/BootIntroView";
import { CLOCK, useIntroClock } from "../../redesign/boot/useIntroClock";
import { Colors } from "../../theme/colors";
import { bootIntroGate, useBootIntroReport } from "./bootIntroGate";

/** La traîne du son après l'arrivée (le bloom de l'accord, la vague) : le lecteur se libère ensuite. */
const SOUND_TAIL_MS = 5_000;

/**
 * L'OUVERTURE du démarrage, branchée (Apple TV) : elle se joue pendant que
 * l'app charge — l'app (`children`) se monte DANS l'écran du poulpe dès
 * qu'elle est prête —, attend sur le bouton lecture tant que l'accueil n'est
 * pas prêt, joue le ta-dum à l'heure de l'image (réglage « Son au
 * démarrage »), plonge, et rend l'app à l'identité. Renonce (rideau de
 * l'encre) devant un écran bloquant ou un accueil en échec (tv-core
 * `bootIntroOutcome`). La décision de la jouer est prise avant (`bootPlan`).
 */
export function BootIntroHost({ children }: { children: ReactNode }) {
  const [viewport] = useState(() => Dimensions.get("window"));
  const scene = useIntroScene(TENTACLE_ART, viewport);
  const [phase, setPhase] = useState<"playing" | "aborting" | "landed">("playing");
  const [heldSince, setHeldSince] = useState<number | null>(null);
  const [heldOut, setHeldOut] = useState(false);
  // Le rideau du renoncement : monté le temps de monter puis de redescendre, jamais au-delà.
  const [curtainShown, setCurtainShown] = useState(false);
  const curtain = useSharedValue(0);
  const soundReady = useRef<Promise<boolean> | null>(null);

  // Le son se décode pendant que le poulpe s'assemble — seulement s'il est voulu.
  if (soundReady.current === null) {
    bootSoundStore.rehydrate();
    soundReady.current = bootSoundStore.readSnapshot() ? bootSound.prepare() : Promise.resolve(false);
  }

  const land = useCallback(() => {
    setPhase((current) => (current === "playing" ? "landed" : current));
  }, []);
  const events = useMemo(
    () => ({
      onHold: () => setHeldSince(Date.now()),
      onSound: (startAt: number) => {
        void soundReady.current?.then((ready) => (ready ? bootSound.playAt(startAt) : undefined));
      },
      onDone: land,
    }),
    [land],
  );
  const clock = useIntroClock(events);

  // Au bout de l'attente maximale, on plonge quand même : l'accueil dit qu'il charge.
  useEffect(() => {
    if (heldSince === null) return undefined;
    const timer = setTimeout(() => setHeldOut(true), BOOT_INTRO_MAX_HOLD_MS);
    return () => clearTimeout(timer);
  }, [heldSince]);

  const report = useBootIntroReport();
  const outcome = bootIntroOutcome({ ...report, heldMs: heldOut ? BOOT_INTRO_MAX_HOLD_MS : 0 });

  const reveal = useCallback(() => {
    clock.landed.value = 1;
    setPhase("landed");
    curtain.value = withTiming(0, { duration: BOOT_INTRO_ABORT.revealMs }, (finished) => {
      if (finished) runOnJS(setCurtainShown)(false);
    });
  }, [clock, curtain]);

  useEffect(() => {
    if (phase !== "playing") return;
    if (outcome === "go") clock.ready.value = true;
    if (outcome !== "abort") return;
    // Renoncer : le rideau monte, l'app se pose à l'identité dessous, le rideau descend.
    clock.state.value = CLOCK.stopped;
    setPhase("aborting");
    setCurtainShown(true);
    bootSound.fadeOut(300);
    curtain.value = withTiming(1, { duration: BOOT_INTRO_ABORT.coverMs }, (finished) => {
      if (finished) runOnJS(reveal)();
    });
  }, [outcome, phase, clock, curtain, reveal]);

  // Tant qu'elle se joue, l'aperçu de la zone attend : rien ne sonne par-dessus le ta-dum.
  useEffect(() => {
    bootIntroGate.reportPlaying(phase !== "landed");
  }, [phase]);

  useEffect(() => {
    if (phase !== "landed") return undefined;
    clock.landed.value = 1;
    clock.stop();
    const timer = setTimeout(() => bootSound.dispose(), SOUND_TAIL_MS);
    return () => clearTimeout(timer);
  }, [phase, clock]);

  return (
    <BootIntroView
      art={TENTACLE_ART}
      scene={scene}
      clock={clock}
      viewport={viewport}
      landed={phase === "landed"}
      curtain={curtain}
      curtainShown={curtainShown}
      screenColor={Colors.bgDeep}
    >
      {children}
    </BootIntroView>
  );
}
