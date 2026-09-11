import { useTranslation } from "react-i18next";
import type { SceneProps } from "../../types";
import { posterAt, useSceneMedia } from "../../sceneMedia";
import { FauxCard, Place, SceneStage, useSceneClock } from "..";

const STEPS = [1100, 2100] as const;
const CARTES = [0, 1, 2, 3] as const;
const X = [72, 216, 360, 504] as const;
const LOT = 1;

/**
 * La rangée « Derniers ajouts » d'une bibliothèque de séries : la deuxième
 * tuile est un LOT, et elle reçoit sa note au second pas.
 *
 * Les affiches et les notes sont vraies (`sceneMedia`) ; la seule chose mise en
 * scène, c'est le moment où la note paraît — puisque c'est exactement ce que le
 * correctif a changé : un lot n'en avait aucune.
 */
export function SeriesRatingScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation();
  const media = useSceneMedia();
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const notee = step >= 1;

  return (
    <SceneStage cycle={cycle}>
      <Place x={72} y={44}>
        <p className="text-[15px] font-semibold text-content-primary">
          {t("common:latestAdditions", { name: t("common:seriesFilter") })}
        </p>
      </Place>

      {CARTES.map((i) => {
        const poster = posterAt(media, i);
        const estLot = i === LOT;
        return (
          <FauxCard
            key={i}
            x={X[i]}
            y={80}
            w={128}
            tone={i}
            showTitle
            // Le lot n'a de note qu'au second pas. Les autres gardent la leur :
            // ce sont des titres entiers, ils en ont toujours eu une.
            poster={
              poster && estLot && !notee ? { ...poster, rating: null } : poster
            }
          >
            {estLot && (
              <span
                className="absolute right-1.5 top-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cta-brand-fg"
                style={{
                  background: "linear-gradient(135deg, var(--brand), var(--brand-accent))",
                }}
              >
                +6
              </span>
            )}
          </FauxCard>
        );
      })}
    </SceneStage>
  );
}
