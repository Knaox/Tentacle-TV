import { useTranslation } from "react-i18next";
import type { SceneProps } from "../../types";
import { posterAt, useSceneMedia } from "../../sceneMedia";
import { FauxCard, FauxChip, FauxCursor, Place, SceneStage, useSceneClock } from "..";

const STEPS = [1000, 900, 2000] as const;
const GRILLE = [0, 1, 2, 3, 4, 5, 6, 7] as const;
const X = [72, 216, 360, 504] as const;
const Y = [128, 252] as const;
/** Ce qui reste après le filtre — les autres passent en retrait. */
const RETENUES = new Set([0, 2, 4, 7]);

/**
 * Ma liste, avec les filtres de la bibliothèque : on pose « Non vus », et la
 * grille se resserre — le compte suit.
 *
 * Les affiches sont vraies. Ce qui est mis en scène, c'est le geste : ces
 * pages n'avaient ni recherche, ni filtre, ni tri.
 */
export function CollectionFiltersScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation();
  const media = useSceneMedia();
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const filtre = step >= 2;
  const compte = filtre ? RETENUES.size : GRILLE.length;

  return (
    <SceneStage cycle={cycle}>
      <Place x={72} y={36}>
        <p className="text-[15px] font-semibold text-content-primary">{t("common:myList")}</p>
      </Place>

      <FauxChip x={72} y={70} label={t("common:allStatus")} selected={!filtre} size="sm" />
      <FauxChip x={168} y={70} label={t("common:unwatched")} selected={filtre} size="sm" />
      <FauxChip x={286} y={70} label={t("common:genres")} icon="filter" size="sm" />
      <FauxChip x={390} y={70} label={t("common:sortBy")} icon="filter" size="sm" />

      <Place x={504} y={72}>
        <p className="text-[11px] font-medium tabular-nums text-content-quaternary">
          {t("common:resultCount", { count: compte })}
        </p>
      </Place>

      {GRILLE.map((i) => (
        <FauxCard
          key={i}
          x={X[i % 4]}
          y={Y[Math.floor(i / 4)]}
          w={112}
          tone={i}
          poster={posterAt(media, i)}
          dimmed={filtre && !RETENUES.has(i)}
        />
      ))}

      <FauxCursor x={200} y={84} hidden={step < 1} reduced={reduced} />
    </SceneStage>
  );
}
