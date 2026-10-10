import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { SceneProps } from "../../types";
import { posterAt, useSceneMedia } from "../../sceneMedia";
import { FauxChip, FauxCursor, FauxRow, SceneStage, useSceneClock } from "..";
import { FauxPip } from "./FauxPip";
import { PIP_RECT } from "./pipSceneGeometry";

/** Le PiP qui joue, le survol d'une carte, « Lecture », le chargement DANS le PiP, la nouvelle image. */
const STEPS = [1000, 900, 400, 1700, 2000] as const;
const ROW = { x: 32, y: 26, cardW: 70, gap: 12 };
/** La carte choisie, et le haut de son affiche (sous le titre de la rangée). */
const PICK = 2;
const CARD = { x: ROW.x + PICK * (ROW.cardW + ROW.gap), y: ROW.y + 28 };
const CARD_H = Math.round(ROW.cardW * 1.5);
/** La pastille « Lecture » du survol, au milieu de l'affiche (la note reste lisible au pied). */
const PLAY = { x: CARD.x + 4, y: CARD.y + CARD_H / 2 - 11 };

/**
 * Une autre lecture lancée pendant le PiP s'y JOUE — la page parcourue ne
 * bouge pas —, et son chargement s'y voit : la vraie vue de chargement du
 * PiP, l'affiche de ce qui arrive et la barre de la marque, puis l'image.
 * Jamais le noir d'un lecteur entre deux fichiers.
 */
export function PipLaunchScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation(["common"]);
  const media = useSceneMedia();
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const picked = posterAt(media, PICK);
  const hovering = step >= 1 && step <= 2;
  const launched = step >= 3;
  // La barre de chargement tourne : jamais pendant une pause de la scène.
  const spinning = step === 3 && active && !reduced;
  const loading = useMemo(() => (spinning ? { posterUrl: picked?.url, title: picked?.title } : null), [spinning, picked]);

  return (
    <SceneStage cycle={cycle}>
      <FauxRow x={ROW.x} y={ROW.y} title={t("common:resumeWatching")} count={6} cardW={ROW.cardW} gap={ROW.gap} highlight={hovering ? PICK : undefined} />
      <FauxRow x={32} y={196} title={t("common:myList")} count={4} cardW={70} gap={12} offset={6} />
      <FauxChip x={PLAY.x} y={PLAY.y} label={t("common:play")} icon="play" variant="primary" size="sm" visible={hovering} dy={hovering ? 0 : 6} />
      <FauxPip
        x={PIP_RECT.x} y={PIP_RECT.y} w={PIP_RECT.w}
        image={launched ? picked?.backdropUrl ?? picked?.url ?? null : media.backdrop?.url ?? null}
        title={launched ? picked?.title ?? "" : media.backdrop?.title ?? ""}
        progress={launched ? 0.02 : 0.42} loading={loading}
      />
      <FauxCursor
        x={step >= 1 ? PLAY.x + 30 : 420} y={step >= 1 ? PLAY.y + 12 : 300}
        pressed={step === 2} hidden={step >= 3} reduced={reduced}
      />
    </SceneStage>
  );
}
