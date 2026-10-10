import { useTranslation } from "react-i18next";
import type { SceneProps } from "../../types";
import { ReduceIcon } from "../../../pictureInPicture/pipIcons";
import { useSceneMedia } from "../../sceneMedia";
import { FauxCursor, FauxRow, Place, ScenePlayerPanel, SceneStage, useSceneClock } from "..";
import { FauxPip } from "./FauxPip";
import { PIP_RECT } from "./pipSceneGeometry";

/** La lecture, le pointeur sur « Lecture en incrustation », le clic, l'image qui gagne son coin, le survol. */
const STEPS = [900, 900, 350, 1300, 2100] as const;
/** Le lecteur, plein cadre, centré sur le canevas (le centre de la réduction). */
const PLAYER = { x: 40, y: 22.5, w: 560 };
const SHRINK = PIP_RECT.w / PLAYER.w;
const PIP_H = Math.round((PIP_RECT.w * 9) / 16);
/** Le déplacement du centre du lecteur jusqu'à celui du PiP. */
const MOVE = { dx: PIP_RECT.x + PIP_RECT.w / 2 - 320, dy: PIP_RECT.y + PIP_H / 2 - 180 };
/** Le bouton du lecteur, en haut à droite de l'image. */
const BUTTON = { x: PLAYER.x + PLAYER.w - 31, y: PLAYER.y + 31 };

/**
 * « Lecture en incrustation » : un clic, et l'image du lecteur se RÉDUIT
 * jusqu'au coin — la même image, sans coupure, comme dans l'app — pendant que
 * l'accueil reparaît dessous. Au survol, le vrai habillage du PiP.
 */
export function PipScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation(["common", "player"]);
  const { backdrop } = useSceneMedia();
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const small = step >= 3;
  const docked = step >= 4;

  return (
    <SceneStage cycle={cycle}>
      <FauxRow x={32} y={26} title={t("common:resumeWatching")} count={6} cardW={70} gap={12} />
      <FauxRow x={32} y={196} title={t("common:myList")} count={4} cardW={70} gap={12} offset={6} />
      {/* Le lecteur entier se réduit : transform seul, autour du centre du canevas. */}
      <Place x={0} y={0} w={640} h={360} visible={!docked} scale={small ? SHRINK : 1} dx={small ? MOVE.dx : 0} dy={small ? MOVE.dy : 0}>
        <ScenePlayerPanel x={PLAYER.x} y={PLAYER.y} w={PLAYER.w} progress={0.42} caption="1:12:40">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-black/50 text-white">
            <ReduceIcon />
          </span>
        </ScenePlayerPanel>
      </Place>
      <FauxPip
        x={PIP_RECT.x} y={PIP_RECT.y} w={PIP_RECT.w} visible={docked}
        image={backdrop?.url ?? null} title={backdrop?.title ?? ""} progress={0.42} controls={docked}
      />
      <FauxCursor
        x={docked ? PIP_RECT.x + 120 : step >= 1 ? BUTTON.x : 330}
        y={docked ? PIP_RECT.y + 70 : step >= 1 ? BUTTON.y : 250}
        pressed={step === 2} hidden={step === 3} reduced={reduced}
      />
    </SceneStage>
  );
}
