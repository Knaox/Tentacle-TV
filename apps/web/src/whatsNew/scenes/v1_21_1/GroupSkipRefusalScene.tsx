import { useTranslation } from "react-i18next";
import type { SceneProps } from "../../types";
import { FauxChip, FauxCursor, Place, ScenePlayerPanel, SceneStage, useSceneClock } from "..";

const STEPS = [900, 900, 700, 500, 1700] as const;
/** Les deux lecteurs, côte à côte : l'hôte à gauche, un invité à droite. */
const HOST = { x: 24, y: 48 } as const;
const GUEST = { x: 328, y: 48 } as const;
const PANEL_W = 288;
/** La pilule et sa croix, au-dessus du bloc titre du cadre de lecture. */
const PILL_Y = 78;
const CROSS_X = 244;

/**
 * En séance, la croix de l'hôte vaut pour toute la salle : le décompte
 * s'arrête chez lui, la pilule disparaît chez tous — et seul l'hôte compte à
 * rebours, l'invité n'a que le bouton.
 */
export function GroupSkipRefusalScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation();
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const seconds = step === 0 ? 3 : 2;
  const aiming = step >= 1;
  const pressed = step === 2;
  const refused = step >= 3;
  return (
    <SceneStage cycle={cycle}>
      <ScenePlayerPanel x={HOST.x} y={HOST.y} w={PANEL_W} progress={0.06} caption={t("watchTogether:host")} />
      <ScenePlayerPanel x={GUEST.x} y={GUEST.y} w={PANEL_W} progress={0.06} caption={t("whatsNew:sceneGuest")} />

      {/* L'hôte : la pilule décompte, avec sa croix. */}
      <FauxChip
        x={HOST.x + 64}
        y={HOST.y + PILL_Y}
        variant="primary"
        label={t("player:skipIntroIn", { seconds })}
        visible={!refused}
        dy={refused ? 6 : 0}
      />
      <FauxChip x={HOST.x + CROSS_X} y={HOST.y + PILL_Y} label="" icon="x" visible={!refused} dy={refused ? 6 : 0} />

      {/* L'invité : le bouton seul, sans décompte — puis plus rien. */}
      <FauxChip
        x={GUEST.x + 96}
        y={GUEST.y + PILL_Y}
        variant="primary"
        label={t("player:skipIntro")}
        visible={!refused}
        dy={refused ? 6 : 0}
      />

      <Place x={GUEST.x} y={GUEST.y + 176} w={PANEL_W} visible={refused} dy={refused ? 0 : 6}>
        <span className="block text-center text-[12px] font-medium text-content-tertiary">
          {t("whatsNew:sceneRefusalShared")}
        </span>
      </Place>

      <FauxCursor
        x={aiming ? HOST.x + CROSS_X + 14 : 300}
        y={aiming ? HOST.y + PILL_Y + 14 : 300}
        pressed={pressed}
        reduced={reduced}
      />
    </SceneStage>
  );
}
