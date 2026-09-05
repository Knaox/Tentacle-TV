import { useTranslation } from "react-i18next";
import { useSceneMedia } from "../../sceneMedia";
import type { SceneProps } from "../../types";
import { FauxCursor, FauxRow, SceneStage, useSceneClock } from "..";

const STEPS = [800, 900, 900, 1700] as const;

/** Les rangées de recommandation se remplissent de vraies affiches, puis le curseur s'attarde sur l'une d'elles. */
export function RecoScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation();
  const media = useSceneMedia();
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const hover = step >= 3;
  // La graine de la rangée « Parce que vous avez aimé » : le titre le plus court
  // des premières affiches — un titre à rallonge mangerait la rangée.
  const seed = media.posters.slice(0, 6).map((p) => p.title).sort((a, b) => a.length - b.length)[0] ?? "Dune";
  return (
    <SceneStage cycle={cycle}>
      <FauxRow x={52} y={6} title={t("reco:rowForYou")} count={7} cardW={68} showTitles revealed={step >= 1} stagger highlight={hover ? 1 : undefined} />
      <FauxRow x={52} y={184} title={t("reco:rowBecauseYouLiked", { title: seed })} count={7} cardW={68} showTitles offset={7} revealed={step >= 2} stagger />
      <FauxCursor x={hover ? 164 : 560} y={hover ? 90 : 330} hidden={step < 2} reduced={reduced} />
    </SceneStage>
  );
}
