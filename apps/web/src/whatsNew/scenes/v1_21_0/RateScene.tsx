import { useTranslation } from "react-i18next";
import type { SceneProps } from "../../types";
import { FauxCard, FauxChip, FauxConfetti, FauxCursor, FauxStars, SceneStage, useSceneClock } from "..";

const STEPS = [800, 800, 700, 1900] as const;

/** Survoler une affiche fait paraître les étoiles ; la quatrième cliquée, les confettis jaillissent. */
export function RateScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation();
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const hover = step >= 1;
  const rated = step >= 2;
  return (
    <SceneStage cycle={cycle}>
      <FauxCard x={200} y={40} w={150} tone={0} label="Dune" lifted={hover}>
        <FauxStars x={24} y={150} value={rated ? 4 : 0} visible={hover} />
      </FauxCard>
      <FauxCard x={400} y={70} w={110} tone={3} dimmed />
      <FauxCard x={60} y={70} w={110} tone={5} dimmed />
      <FauxConfetti x={296} y={199} fire={rated} reduced={reduced} />
      <FauxChip
        x={222}
        y={290}
        label={`${t("reco:yourRating")} · ${t("reco:ratingValue", { score: 8 })}`}
        icon="check"
        selected
        visible={step >= 3}
        dy={step >= 3 ? 0 : 8}
      />
      <FauxCursor x={hover ? (rated ? 296 : 275) : 520} y={hover ? (rated ? 199 : 120) : 300} pressed={step === 2} reduced={reduced} />
    </SceneStage>
  );
}
