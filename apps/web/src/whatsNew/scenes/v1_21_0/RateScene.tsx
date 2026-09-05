import { posterAt, useSceneMedia } from "../../sceneMedia";
import type { SceneProps } from "../../types";
import { FauxCard, FauxConfetti, FauxCursor, FauxStars, SceneStage, useSceneClock } from "..";

const STEPS = [800, 800, 700, 1900] as const;

/** Survoler une affiche fait paraître les vraies étoiles ; la quatrième cliquée, les confettis jaillissent. */
export function RateScene({ active, reduced }: SceneProps) {
  const media = useSceneMedia();
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const hover = step >= 1;
  const rated = step >= 2;
  return (
    <SceneStage cycle={cycle}>
      <FauxCard x={60} y={70} w={110} poster={posterAt(media, 1)} tone={5} dimmed />
      <FauxCard x={470} y={70} w={110} poster={posterAt(media, 2)} tone={3} dimmed />
      <FauxCard x={245} y={28} w={150} poster={posterAt(media, 0)} hovered={hover}>
        {/* Le voile de survol des cartes reco, avec ses étoiles en bas à gauche. */}
        <div
          className="absolute inset-0"
          style={{ opacity: hover ? 1 : 0, transition: "opacity var(--duration-base) var(--ease-out)", background: "linear-gradient(to top, rgba(0,0,0,0.92) 30%, rgba(0,0,0,0.55) 70%, transparent)" }}
        />
        <FauxStars x={10} y={195} value={rated ? 8 : 0} size="sm" tone="onMedia" visible={hover} />
      </FauxCard>
      <FauxConfetti x={311} y={231} fire={rated} reduced={reduced} />
      <FauxCursor
        x={hover ? (rated ? 311 : 320) : 560}
        y={hover ? (rated ? 231 : 140) : 330}
        pressed={step === 2}
        reduced={reduced}
      />
    </SceneStage>
  );
}
