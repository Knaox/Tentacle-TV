import { useTranslation } from "react-i18next";
import type { SceneProps } from "../../types";
import { FauxCursor, FauxRow, SceneStage, useSceneClock } from "..";

const STEPS = [900, 900, 800, 1700] as const;
const ALL = [0, 1, 2, 3, 4, 5, 6] as const;
const NONE: readonly number[] = [];

/** Les rangées de recommandation se remplissent, puis le curseur s'attarde sur une affiche. */
export function RecoScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation();
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const hover = step >= 3;
  return (
    <SceneStage cycle={cycle}>
      <FauxRow x={32} y={20} title={t("reco:rowForYou")} count={7} cardW={56} hidden={step >= 1 ? NONE : ALL} stagger highlight={hover ? 1 : undefined} />
      <FauxRow x={32} y={132} title={t("reco:rowBecauseYouLiked", { title: "Dune" })} count={7} cardW={56} hidden={step >= 2 ? NONE : ALL} stagger tones={[3, 0, 4, 1, 5, 2, 3]} />
      <FauxRow x={32} y={244} title={t("reco:rowDiscover")} count={7} cardW={56} hidden={step >= 2 ? NONE : ALL} stagger tones={[5, 2, 3, 0, 1, 4, 5]} />
      <FauxCursor x={hover ? 128 : 540} y={hover ? 96 : 320} hidden={step < 2} reduced={reduced} />
    </SceneStage>
  );
}
