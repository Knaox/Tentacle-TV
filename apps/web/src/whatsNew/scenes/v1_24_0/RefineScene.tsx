import { useTranslation } from "react-i18next";
import type { SceneProps } from "../../types";
import { posterAt, useSceneMedia } from "../../sceneMedia";
import { FauxCursor, FauxRow, Place, SceneStage, sceneTween, useSceneClock } from "..";
import { FauxRecoSwitch, FauxShortcutsLegend, FauxSwipeHeader } from "./FauxRefineChrome";
import { FauxSwipeCard, type SwipePose } from "./FauxSwipeCard";
import { CONTROL_COL, FauxSwipeControls } from "./FauxSwipeControls";

const STEPS = [900, 700, 300, 900, 800, 500, 500, 600, 1500] as const;
const SWITCH = { x: 217, y: 12 } as const;
/** Cinq cartes : trois dans la pile, deux qui arrivent quand les premières partent. */
const DECK = 5;
const POSTER_OFFSET = 6;
const COUNTS = { like: 12, superlike: 3, dislike: 5 } as const;

function poseOf(index: number, step: number, judged: number): SwipePose {
  if (index === 0 && judged >= 1) return { kind: "gone", verdict: "like" };
  if (index === 1 && judged >= 2) return { kind: "gone", verdict: "superlike" };
  if (index === 0 && step === 4) return { kind: "drag" };
  return { kind: "stack", depth: index - judged };
}

/**
 * « Affiner », une section de Recommandations : le segment passe de « Pour
 * vous » à « Affiner », la pile paraît. Une carte glissée à droite — le
 * tampon « J'aime » —, puis ↑ au clavier : coup de cœur. Les compteurs
 * suivent ; chaque verdict pèse dans ce que « Pour vous » propose.
 */
export function RefineScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation("reco");
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const media = useSceneMedia();
  const refine = step >= 2;
  const judged = step >= 7 ? 2 : step >= 5 ? 1 : 0;
  const cursor =
    step >= 5 ? { x: 560, y: 330 }
      : step === 4 ? { x: 384, y: 150 }
        : step === 3 ? { x: 320, y: 154 }
          : step >= 1 ? { x: SWITCH.x + 153, y: SWITCH.y + 18 }
            : { x: 560, y: 330 };
  return (
    <SceneStage cycle={cycle}>
      <FauxRecoSwitch x={SWITCH.x} y={SWITCH.y} refine={refine} />
      <FauxRow x={50} y={70} title={t("rowForYou")} count={6} cardW={80} gap={12} offset={POSTER_OFFSET} visible={!refine} />
      <FauxSwipeHeader visible={refine} like={COUNTS.like + (judged >= 1 ? 1 : 0)} superlike={COUNTS.superlike + (judged >= 2 ? 1 : 0)} dislike={COUNTS.dislike} />
      <Place x={0} y={0} w={640} h={360} visible={step >= 3} transition={sceneTween}>
        {Array.from({ length: DECK }, (_, i) => (
          <FauxSwipeCard key={i} poster={posterAt(media, POSTER_OFFSET + 6 + i)} tone={i} pose={poseOf(i, step, judged)} />
        ))}
      </Place>
      <FauxSwipeControls x={320 - (CONTROL_COL * 5) / 2} y={284} canUndo={judged >= 1} visible={refine} />
      <FauxShortcutsLegend visible={refine} lit={step === 6 ? "↑" : null} />
      <FauxCursor x={cursor.x} y={cursor.y} pressed={step === 2 || step === 4} hidden={step >= 5} reduced={reduced} />
    </SceneStage>
  );
}
