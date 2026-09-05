import { useTranslation } from "react-i18next";
import type { SceneProps } from "../../types";
import { FauxCursor, FauxRow, SceneStage, useSceneClock } from "..";

const STEPS = [900, 900, 800, 1700] as const;

/** Les rangées de recommandation se remplissent, puis le curseur s'attarde sur une affiche. */
export function RecoScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation();
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const hover = step >= 3;
  return (
    <SceneStage cycle={cycle}>
      <FauxRow x={32} y={14} title={t("reco:rowForYou")} count={7} cardW={54} revealed={step >= 1} stagger highlight={hover ? 1 : undefined} />
      <FauxRow x={32} y={128} title={t("reco:rowBecauseYouLiked", { title: "Dune" })} count={7} cardW={54} revealed={step >= 2} stagger tones={[3, 0, 4, 1, 5, 2, 3]} />
      <FauxRow x={32} y={242} title={t("reco:rowDiscover")} count={7} cardW={54} revealed={step >= 2} stagger tones={[5, 2, 3, 0, 1, 4, 5]} />
      <FauxCursor x={hover ? 126 : 540} y={hover ? 88 : 320} hidden={step < 2} reduced={reduced} />
    </SceneStage>
  );
}
