import { useTranslation } from "react-i18next";
import { RotateCw } from "lucide-react";
import type { SceneProps } from "../../types";
import { PlaybackSpinner } from "../../../components/player/PlaybackSpinner";
import { FauxCursor, Place, ScenePlayerPanel, SceneStage, useSceneClock } from "..";

/** La lecture, deux « +30 s » rapides, l'attente dite, la reprise au passage visé. */
const STEPS = [1300, 700, 900, 1900, 1800] as const;
const PANEL = { x: 90, y: 30, w: 460 };
const PANEL_H = Math.round(PANEL.w * (9 / 16));
/** Le bouton « +30 s », à l'écart de l'indicateur et de sa phrase (centrés). */
const SKIP = { x: PANEL.x + PANEL.w / 2 + 110, y: PANEL.y + PANEL_H / 2 - 50 };
const START = 0.3;
/** Une minute plus loin, sur un épisode de 25 minutes. */
const TARGET = 0.34;

/**
 * Sauter pendant une vidéo CONVERTIE par le serveur : l'attente se voit dès
 * l'appui (l'indicateur du lecteur), deux « +30 s » rapides se cumulent en
 * un seul saut — une seule conversion relancée —, et si le serveur prend son
 * temps, le lecteur le dit (« Le serveur prépare la vidéo à ce passage… »).
 * Sur la vraie image du titre du bandeau.
 */
export function TranscodeSeekScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation(["player", "whatsNew"]);
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const waiting = step >= 1 && step <= 3;
  const presses = step === 1 ? 1 : step >= 2 && step <= 3 ? 2 : 0;

  return (
    <SceneStage cycle={cycle}>
      <ScenePlayerPanel x={PANEL.x} y={PANEL.y} w={PANEL.w} progress={step === 4 ? TARGET : START} />
      <Place x={PANEL.x} y={PANEL.y} w={PANEL.w} h={PANEL_H} visible={waiting}>
        <div className="relative h-full w-full scale-75">
          <PlaybackSpinner hint={step === 3 ? t("player:seekPreparing") : undefined} />
        </div>
      </Place>
      <Place x={SKIP.x - 22} y={SKIP.y - 22} w={44} h={44}>
        <span className="relative grid h-11 w-11 place-items-center rounded-full bg-black/45 text-white">
          <RotateCw size={22} aria-hidden="true" />
          <span className="absolute text-[8px] font-bold">30</span>
        </span>
      </Place>
      <Place x={SKIP.x + 30} y={SKIP.y - 12} w={70} visible={presses > 0} dy={presses > 0 ? 0 : 6}>
        <span className="rounded-full bg-black/70 px-2.5 py-1 text-[12px] font-semibold tabular-nums text-white">
          +{presses * 30} s
        </span>
      </Place>
      <FauxCursor x={SKIP.x} y={SKIP.y} pressed={step === 1 || step === 2} hidden={step === 0 || step === 4} reduced={reduced} />
    </SceneStage>
  );
}
