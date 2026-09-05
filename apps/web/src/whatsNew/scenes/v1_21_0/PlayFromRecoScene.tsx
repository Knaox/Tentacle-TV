import { useTranslation } from "react-i18next";
import type { SceneProps } from "../../types";
import { FauxCard, FauxChip, FauxCursor, FauxRow, SceneStage, useSceneClock } from "..";

const STEPS = [800, 900, 700, 1700] as const;

/** Survoler une carte reco fait paraître Lecture et ses badges ; un clic, et le lecteur reprend. */
export function PlayFromRecoScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation();
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const hover = step >= 1;
  const playing = step >= 3;
  return (
    <SceneStage cycle={cycle}>
      <FauxRow x={32} y={30} title={t("reco:rowForYou")} count={5} cardW={80} highlight={hover ? 1 : undefined} tones={[3, 0, 5, 1, 4]} />
      <FauxChip x={131} y={92} label={t("common:play")} icon="play" variant="primary" visible={hover} dy={hover ? 0 : 6} />
      <FauxChip x={129} y={128} label="4K · HDR" size="sm" selected visible={hover} dy={hover ? 0 : 6} />
      <FauxChip x={120} y={150} label="VF · VOSTFR" size="sm" visible={hover} dy={hover ? 0 : 6} />
      <FauxCard variant="panel" x={32} y={196} w={270} tone={0} progress={0.42} visible={playing} dy={playing ? 0 : 12} />
      <FauxChip x={48} y={210} label={t("whatsNew:sceneResume")} icon="play" size="sm" visible={playing} />
      <FauxCursor
        x={step === 1 ? 172 : step >= 2 ? 160 : 540}
        y={step === 1 ? 118 : step >= 2 ? 105 : 320}
        pressed={step === 2}
        hidden={playing}
        reduced={reduced}
      />
    </SceneStage>
  );
}
