import type { SceneProps } from "../../types";
import { FauxCursor, Place, SceneStage, useSceneClock } from "..";
import { FauxHeroSources, sourceCenter } from "./FauxHeroSources";

/**
 * Réglages › Personnalisation : le bandeau principal dit ce que montre chaque
 * source ; le pointeur passe sur « Pour vous — Films », clique, la carte se
 * coche et le rappel du repli paraît ; puis « Pour vous — Séries ».
 */
const STEPS = [900, 700, 1500, 700, 1700] as const;
const TO_MOVIES = 1;
const MOVIES = 2;
const TO_SERIES = 3;
const SERIES = 4;

export function HeroSourceScene({ active, reduced }: SceneProps) {
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const value = step >= SERIES ? "recoSeries" : step >= MOVIES ? "recoMovies" : "reco";
  const target = step >= TO_SERIES ? sourceCenter("recoSeries") : step >= TO_MOVIES ? sourceCenter("recoMovies") : { x: 560, y: 330 };
  return (
    <SceneStage cycle={cycle}>
      <Place x={0} y={0} w={640} h={360} className="bg-surface-0" />
      <FauxHeroSources value={value} />
      <FauxCursor x={target.x} y={target.y} pressed={step === MOVIES || step === SERIES} hidden={step === 0} reduced={reduced} />
    </SceneStage>
  );
}
