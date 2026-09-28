import { useTranslation } from "react-i18next";
import type { SceneProps } from "../../types";
import { posterAt, useSceneMedia } from "../../sceneMedia";
import { ArrowLeftIcon } from "../../../components/media/MediaDetailIcons";
import { FauxCard, FauxCursor, FauxRow, Place, SceneStage, sceneTween, useSceneClock } from "..";
import { FauxDetailBackdrop, FauxStageButton } from "./FauxDetailStage";

const STEPS = [900, 600, 300, 700, 300, 600, 300, 700, 300, 1600] as const;
const HOME = { x: 40, y: 90, cardW: 84, gap: 12, first: 1 } as const;
const SIMILAR = { x: 28, y: 232, w: 62, gap: 10, count: 5, spread: 6 } as const;
/** Les trois fiches de la chaîne : le titre ouvert depuis l'accueil, puis deux similaires. */
const CHAIN = [HOME.first, HOME.first + SIMILAR.spread, HOME.first + SIMILAR.spread * 2 + 1] as const;

function similarCenter(index: number) {
  return { x: SIMILAR.x + index * (SIMILAR.w + SIMILAR.gap) + SIMILAR.w / 2, y: SIMILAR.y + 46 };
}

/** Une fiche de la chaîne, ramenée à l'essentiel : décor, titre, « Titres similaires ». */
function ChainFiche({ posterIndex, visible }: { posterIndex: number; visible: boolean }) {
  const { t } = useTranslation("common");
  const media = useSceneMedia();
  const poster = posterAt(media, posterIndex);
  return (
    <Place x={0} y={0} w={640} h={360} visible={visible} transition={sceneTween} className="overflow-hidden bg-surface-0">
      <div className="absolute inset-x-0 top-0 h-[210px]"><FauxDetailBackdrop url={poster?.backdropUrl ?? null} /></div>
      <FauxStageButton x={18} y={16} label={t("back")} icon={<ArrowLeftIcon />} />
      <p className="absolute left-7 top-[150px] max-w-[420px] truncate text-[24px] font-bold tracking-tight text-on-media-primary">{poster?.title ?? " "}</p>
      <p className="absolute left-7 top-[210px] text-[12px] font-semibold text-content-primary">{t("similarTitles")}</p>
      {Array.from({ length: SIMILAR.count }, (_, i) => (
        <FauxCard key={i} x={SIMILAR.x + i * (SIMILAR.w + SIMILAR.gap)} y={SIMILAR.y} w={SIMILAR.w}
          poster={posterAt(media, posterIndex + SIMILAR.spread + i)} tone={posterIndex + i} />
      ))}
    </Place>
  );
}

/**
 * Une chaîne de fiches : depuis l'accueil, un film, puis un titre similaire,
 * puis un autre. Chaque fiche ouverte depuis une fiche REMPLACE la précédente
 * dans l'historique : un seul « Retour » ramène à l'accueil, à sa place.
 */
export function DetailChainScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation("common");
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const page = step >= 8 ? -1 : step >= 6 ? 2 : step >= 4 ? 1 : step >= 2 ? 0 : -1;
  const cursor = step >= 7 ? { x: 50, y: 30 }
    : step >= 5 ? similarCenter(1)
      : step >= 3 ? similarCenter(0)
        : step >= 1 ? { x: HOME.x + (HOME.cardW + HOME.gap) * HOME.first + HOME.cardW / 2, y: HOME.y + 28 + 63 }
          : { x: 560, y: 330 };
  return (
    <SceneStage cycle={cycle}>
      <FauxRow x={HOME.x} y={HOME.y} title={t("resumeWatching")} count={6} cardW={HOME.cardW} gap={HOME.gap} showTitles
        highlight={step === 1 || step === 2 ? HOME.first : undefined} />
      {CHAIN.map((posterIndex, i) => <ChainFiche key={i} posterIndex={posterIndex} visible={page === i} />)}
      <FauxCursor x={cursor.x} y={cursor.y} pressed={step === 2 || step === 4 || step === 6 || step === 8} hidden={step >= 9} reduced={reduced} />
    </SceneStage>
  );
}
