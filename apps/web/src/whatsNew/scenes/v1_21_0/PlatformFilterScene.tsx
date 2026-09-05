import { useTranslation } from "react-i18next";
import type { SceneProps } from "../../types";
import { FauxChip, FauxCursor, FauxRow, SceneStage, useSceneClock } from "..";

const STEPS = [800, 700, 1300, 1600] as const;
const FILTERED = [1, 3, 5] as const;
const NONE: readonly number[] = [];

/** Une puce de plateforme cliquée : les titres absents du service s'effacent, les autres se resserrent. */
export function PlatformFilterScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation();
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const selected = step >= 2;
  return (
    <SceneStage cycle={cycle}>
      <FauxChip x={32} y={28} label="Netflix" logo="N" logoTone={2} selected={selected} />
      <FauxChip x={128} y={28} label="Disney+" logo="D" logoTone={1} />
      <FauxChip x={228} y={28} label="Prime Video" logo="P" logoTone={4} />
      <FauxChip x={352} y={28} label="Crunchyroll" logo="C" logoTone={0} />
      <FauxRow x={32} y={96} title={t("reco:rowForYou")} count={7} cardW={60} hidden={selected ? FILTERED : NONE} tones={[2, 3, 2, 5, 2, 1, 2]} />
      <FauxChip x={118} y={92} label="Netflix" logo="N" logoTone={2} icon="x" size="sm" selected visible={step >= 3} dy={step >= 3 ? 0 : 6} />
      <FauxRow x={32} y={236} title={t("reco:rowDiscover")} count={7} cardW={60} hidden={selected ? FILTERED : NONE} tones={[2, 0, 2, 4, 2, 3, 2]} />
      <FauxCursor x={step >= 1 && step < 3 ? 74 : step >= 3 ? 320 : 540} y={step >= 1 && step < 3 ? 42 : 320} pressed={step === 2} reduced={reduced} />
    </SceneStage>
  );
}
