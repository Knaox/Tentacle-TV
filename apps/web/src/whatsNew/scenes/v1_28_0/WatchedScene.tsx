import { useTranslation } from "react-i18next";
import type { SceneProps } from "../../types";
import { posterAt, useSceneMedia } from "../../sceneMedia";
import { FauxCursor, Place, SceneStage, useSceneClock } from "..";
import { FauxMarkedCard } from "../v1_24_0/FauxMarkedCard";

/** Le survol, le clic sur « Vu », la coche qui reste sous le curseur, la souris qui part, la carte qui s'en va. */
const STEPS = [800, 900, 400, 1300, 900, 1700] as const;
/** La largeur où le plateau de survol tient entier (comme la scène des cartes de la 1.24.0). */
const CARD_W = 110;
const PITCH = 124;
const COUNT = 5;
const ROW = { x: (640 - (COUNT * CARD_W + (COUNT - 1) * (PITCH - CARD_W))) / 2, y: 62 };
const CARDS_Y = ROW.y + 28;
const PICK = 2;
const PICK_X = ROW.x + PICK * PITCH;
/** « Vu », dernier bouton du plateau de survol, au pied de l'affiche. */
const WATCHED = { x: PICK_X + CARD_W - 18, y: CARDS_Y + Math.round(CARD_W * 1.5) - 19 };

/**
 * « Vu » se coche SOUS le curseur : la coche paraît au clic, la carte reste à
 * sa place tant que la souris est sur la rangée — et ne s'en va, les autres
 * refermant le trou, qu'une fois le pointeur parti. Les vraies pièces de la
 * carte (pastille d'états, coque de survol, plateau).
 */
export function WatchedScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation(["common"]);
  const media = useSceneMedia();
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const hovered = step >= 1 && step <= 3;
  const watched = step >= 2;
  const gone = step >= 5;

  return (
    <SceneStage cycle={cycle}>
      <Place x={ROW.x} y={ROW.y} w={COUNT * PITCH}>
        <span className="text-[15px] font-semibold leading-none tracking-tight text-content-primary">{t("common:resumeWatching")}</span>
      </Place>
      {Array.from({ length: COUNT }, (_, i) => {
        const poster = posterAt(media, i);
        return (
          <Place key={i} x={ROW.x + i * PITCH} y={CARDS_Y} w={CARD_W} visible={!(gone && i === PICK)} dx={gone && i > PICK ? -PITCH : 0} scale={gone && i === PICK ? 0.92 : 1}>
            <FauxMarkedCard
              x={0} y={0} w={CARD_W} poster={poster} tone={i}
              userScore={null} statuses={i === PICK && watched ? ["watched"] : []}
              hovered={i === PICK && hovered} hoverable={i === PICK}
            />
          </Place>
        );
      })}
      <FauxCursor
        x={step === 0 ? 470 : step >= 4 ? WATCHED.x + 30 : WATCHED.x}
        y={step === 0 ? 330 : step >= 4 ? 336 : WATCHED.y}
        pressed={step === 2} reduced={reduced}
      />
    </SceneStage>
  );
}
