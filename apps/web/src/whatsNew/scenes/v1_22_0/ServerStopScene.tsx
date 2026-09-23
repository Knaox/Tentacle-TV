import { useTranslation } from "react-i18next";
import type { SceneProps } from "../../types";
import { posterAt, useSceneMedia } from "../../sceneMedia";
import { FauxChip, FauxCursor, Place, ScenePlayerPanel, SceneStage, useSceneClock } from "..";
import { FauxSessionCard } from "./FauxSessionCard";

const STEPS = [1000, 800, 450, 1800] as const;
const PLAYER = { x: 24, y: 76, w: 300 } as const;
/** La croix de la fenêtre, en haut à droite du lecteur. */
const CLOSE = { x: PLAYER.x + PLAYER.w - 38, y: PLAYER.y + 10 } as const;
const SERVER = { x: 352, y: 104, w: 264 } as const;

/**
 * Fermer l'application en pleine lecture : la fenêtre part, et côté serveur
 * la lecture s'arrête AUSSITÔT — au lieu de rester « en cours » cinq minutes.
 */
export function ServerStopScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation();
  const media = useSceneMedia();
  // Le film du fond du lecteur, et son affiche sur la carte : la même œuvre des deux côtés.
  const poster = posterAt(media, 0);
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const aiming = step >= 1;
  const pressed = step === 2;
  const closed = step >= 3;
  const title = media.backdrop?.title ?? poster?.title ?? t("whatsNew:sceneNowPlaying");
  return (
    <SceneStage cycle={cycle}>
      <ScenePlayerPanel x={PLAYER.x} y={PLAYER.y} w={PLAYER.w} progress={0.42} visible={!closed} scale={closed ? 0.94 : 1} />
      <FauxChip x={CLOSE.x} y={CLOSE.y} label="" icon="x" size="sm" visible={!closed} />

      <Place x={SERVER.x} y={SERVER.y - 26} w={SERVER.w}>
        <span className="block text-[12px] font-medium text-content-tertiary">{t("whatsNew:sceneOnServer")}</span>
      </Place>
      <FauxSessionCard
        x={SERVER.x}
        y={SERVER.y}
        w={SERVER.w}
        title={title}
        poster={poster}
        subtitle="Tentacle Desktop 1.22.0"
        progress={0.42}
        chip={closed ? { label: t("sessions:stopped"), tone: "neutral" } : { label: t("sessions:playing"), tone: "success" }}
      />

      <FauxCursor
        x={aiming ? CLOSE.x + 12 : 420}
        y={aiming ? CLOSE.y + 12 : 320}
        pressed={pressed}
        hidden={closed}
        reduced={reduced}
      />
    </SceneStage>
  );
}
