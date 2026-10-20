import { useEffect, useMemo, useState } from "react";
import { Dimensions } from "react-native";
import { INTRO_HOLD_AT, INTRO_TIMING } from "@tentacle-tv/shared/brandIntro";
import * as TENTACLE_ART from "../../../src/components/icons/tentacleArt.generated";
import { BootIntroView, useIntroClock, useIntroScene } from "@tentacle-tv/brand-intro-native";
import { TV_INTRO_PRIMITIVES } from "../../../src/redesignWiring/boot/introPrimitives";
import type { BenchData } from "../data/benchData";
import { HOME_SCENES } from "./homeScenes";
import type { BenchScene } from "./types";

/**
 * L'OUVERTURE du démarrage, étape par étape : l'horloge figée à un instant
 * (`at`), l'accueil du banc DANS l'écran du poulpe — l'assemblage, l'attente
 * sur le bouton lecture, l'appui, l'allumage, la plongée, l'arrivée. `attente`
 * fait tourner l'horloge sans que l'accueil soit jamais prêt : le bouton
 * scintille. `jouee` la joue d'une traite, l'accueil prêt d'emblée.
 */

const noop = () => {};

function IntroScene({ data, at, mode }: { data: BenchData; at: number | null; mode: "frozen" | "hold" | "play" }) {
  const [viewport] = useState(() => Dimensions.get("window"));
  const scene = useIntroScene(TENTACLE_ART, viewport);
  const events = useMemo(() => ({ onHold: noop, onSound: noop, onDone: noop }), []);
  const clock = useIntroClock(events, mode === "frozen" ? at : null);
  useEffect(() => {
    if (mode === "play") clock.ready.value = true;
  }, [mode, clock]);
  const home = HOME_SCENES[0]?.render(data) ?? null;
  return (
    <BootIntroView scene={scene} primitives={TV_INTRO_PRIMITIVES} clock={clock} viewport={viewport} landed={false} screenColor="#000000">
      {home}
    </BootIntroView>
  );
}

const STEPS: readonly [string, number, string][] = [
  ["0300", 300, "La lueur s'allume, le poulpe paraît"],
  ["0700", 700, "Les bras enlacent l'écran, le chapeau tombe"],
  ["attente-figee", INTRO_HOLD_AT, "Sur le bouton lecture (l'attente)"],
  ["1300", 1300, "Il appuie : « ta »"],
  ["1580", 1580, "L'écran s'allume sur l'accueil : « dum »"],
  ["1800", 1800, "Les bras relâchent l'écran, la plongée part"],
  ["2200", 2200, "La plongée"],
  ["2600", 2600, "L'atterrissage"],
  ["arrivee", INTRO_TIMING.end, "À l'échelle 1 : c'est l'accueil"],
];

export const INTRO_SCENES: BenchScene[] = [
  ...STEPS.map(([id, at, label]): BenchScene => ({
    id: `ouverture/${id}`,
    group: "Ouverture",
    label,
    settleMs: 2200,
    render: (data) => <IntroScene data={data} at={at} mode="frozen" />,
  })),
  { id: "ouverture/attente", group: "Ouverture", label: "L'attente qui scintille (accueil jamais prêt)", settleMs: 3000, render: (data) => <IntroScene data={data} at={null} mode="hold" /> },
  { id: "ouverture/jouee", group: "Ouverture", label: "D'une traite, l'accueil prêt", settleMs: 3600, render: (data) => <IntroScene data={data} at={null} mode="play" /> },
];
