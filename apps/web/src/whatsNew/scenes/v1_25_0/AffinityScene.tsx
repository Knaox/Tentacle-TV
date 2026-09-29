import { useTranslation } from "react-i18next";
import type { SceneProps } from "../../types";
import { posterAt, useSceneMedia } from "../../sceneMedia";
import { FauxConfetti, FauxCursor, Place, SceneStage, sceneTween, useSceneClock } from "..";
import { FauxSwipeCard, type SwipePose } from "../v1_24_0/FauxSwipeCard";
import { FauxAffinityControls, FauxAffinityHeader, FauxAffinityMatch } from "./FauxAffinityPieces";

const STEPS = [1100, 800, 500, 700, 1400, 700, 1700] as const;
const DECK = 4;
const POSTER_OFFSET = 3;
const DECK_DROP = 24;
const MODAL = { x: 170, y: 12, w: 300, h: 336 } as const;
/** Le bouton « Regarder ensemble » de la vue du match, en px du canevas. */
const WATCH = { x: 320, y: 268 } as const;

function poseOf(index: number, step: number): SwipePose {
  if (index === 0 && step >= 2) return { kind: "gone", verdict: "like" };
  if (index === 0 && step === 1) return { kind: "drag" };
  return { kind: "stack", depth: step >= 2 ? index - 1 : index };
}

/**
 * Le mode Affinité de Watch Together : la pile commune, avec qui swipe et où
 * il en est. Vous aimez un film — Camille l'avait déjà aimé : « C'est un
 * match ! », et « Regarder ensemble » lance la lecture pour le groupe.
 */
export function AffinityScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation("whatsNew");
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const media = useSceneMedia();
  const friend = t("sceneFriend");
  const matched = step >= 4;
  const liked = posterAt(media, POSTER_OFFSET);
  const cursor = step >= 5 ? WATCH : step >= 1 ? { x: 346, y: 182 } : { x: 300, y: 170 };
  return (
    <SceneStage cycle={cycle}>
      <Place x={MODAL.x} y={MODAL.y} w={MODAL.w} h={MODAL.h}>
        <div className="h-full w-full rounded-2xl bg-[color:var(--surface-1)] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8)] ring-1 ring-line-subtle" />
      </Place>
      <Place x={MODAL.x} y={MODAL.y} w={MODAL.w} h={140} visible={matched} transition={sceneTween}>
        <div className="h-full w-full rounded-t-2xl" style={{ background: "radial-gradient(60% 75% at 50% 0%, rgba(var(--brand-rgb),0.32), transparent 72%)" }} />
      </Place>

      <FauxAffinityHeader
        x={MODAL.x + 14}
        y={MODAL.y + 12}
        w={MODAL.w - 28}
        friend={friend}
        judged={{ you: step >= 2 ? 7 : 6, friend: 9 }}
        visible={!matched}
      />
      {/* La pile descend sous l'en-tête : les cartes du kit sont posées pour « Affiner », sans en-tête de membres. */}
      <Place x={0} y={0} w={640} h={360} dy={DECK_DROP} visible={!matched} transition={sceneTween}>
        {Array.from({ length: DECK }, (_, i) => (
          <FauxSwipeCard key={i} poster={posterAt(media, POSTER_OFFSET + i)} tone={i} pose={poseOf(i, step)} />
        ))}
      </Place>
      <FauxAffinityControls x={230} y={286} visible={!matched} />

      <FauxAffinityMatch x={MODAL.x + 10} y={MODAL.y + 26} w={MODAL.w - 20} poster={liked} friend={friend} visible={matched} />
      <FauxConfetti x={320} y={100} fire={step === 4} reduced={reduced} />
      <FauxCursor x={cursor.x} y={cursor.y} pressed={step === 1 || step === 5} hidden={step === 0 || step === 3 || step === 4} reduced={reduced} />
    </SceneStage>
  );
}
