import { useTranslation } from "react-i18next";
import type { SceneProps } from "../../types";
import { MessageBannerCard } from "../../../components/session/SessionMessageHost";
import { FauxCursor, Place, ScenePlayerPanel, SceneStage, useSceneClock } from "..";

const STEPS = [800, 1800, 700, 400, 1200] as const;
const PLAYER = { x: 112, y: 84, w: 416 } as const;
/** Le bandeau, posé en haut du lecteur — là où l'app le pose, au-dessus de tout. */
const BANNER = { x: 152, y: 34, w: 336 } as const;
/** Sa croix : le bouton de 44 px, à droite du bandeau. */
const CROSS = { x: BANNER.x + BANNER.w - 30, y: BANNER.y + 22 } as const;

/**
 * Un message de l'administrateur arrive en pleine lecture : le VRAI bandeau
 * (`MessageBannerCard`), qui reste jusqu'à ce qu'on le ferme.
 */
export function AdminMessageScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation();
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const shown = step >= 1 && step <= 3;
  const aiming = step >= 2;
  const pressed = step === 3;
  return (
    <SceneStage cycle={cycle}>
      <ScenePlayerPanel x={PLAYER.x} y={PLAYER.y} w={PLAYER.w} progress={0.63} />
      <Place x={BANNER.x} y={BANNER.y} w={BANNER.w} visible={shown} dy={shown ? 0 : -10}>
        <MessageBannerCard header={t("whatsNew:sceneMessageHeader")} text={t("whatsNew:sceneMessageText")} />
      </Place>
      <FauxCursor
        x={aiming ? CROSS.x : 470}
        y={aiming ? CROSS.y : 330}
        pressed={pressed}
        hidden={step === 4}
        reduced={reduced}
      />
    </SceneStage>
  );
}
