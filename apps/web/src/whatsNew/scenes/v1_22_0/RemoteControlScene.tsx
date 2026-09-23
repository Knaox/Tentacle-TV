import { useTranslation } from "react-i18next";
import type { SceneProps } from "../../types";
import { posterAt, useSceneMedia } from "../../sceneMedia";
import { FauxChip, FauxCursor, Place, ScenePlayerPanel, SceneStage, useSceneClock } from "..";
import { FauxSessionCard } from "./FauxSessionCard";

const STEPS = [900, 700, 400, 1700] as const;
const CARD = { x: 24, y: 112, w: 276 } as const;
const PLAYER = { x: 320, y: 88, w: 296 } as const;
/** Le bouton Pause de la carte : premier bouton de la rangée d'actions, sous l'état. */
const PAUSE = { x: CARD.x + 90, y: CARD.y + 100 } as const;

/**
 * Le tableau de bord met en pause : la commande part de la carte de session
 * et le lecteur de l'appareil s'arrête sur l'image — la carte le dit aussitôt.
 */
export function RemoteControlScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation();
  const media = useSceneMedia();
  // Le film du fond du lecteur, et son affiche sur la carte : la même œuvre des deux côtés.
  const poster = posterAt(media, 0);
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const aiming = step >= 1;
  const pressed = step === 2;
  const paused = step >= 3;
  const title = media.backdrop?.title ?? poster?.title ?? t("whatsNew:sceneNowPlaying");
  return (
    <SceneStage cycle={cycle}>
      <Place x={CARD.x} y={CARD.y - 26} w={CARD.w}>
        <span className="block text-[12px] font-medium text-content-tertiary">{t("whatsNew:sceneDashboard")}</span>
      </Place>
      <FauxSessionCard
        x={CARD.x}
        y={CARD.y}
        w={CARD.w}
        title={title}
        poster={poster}
        subtitle="Tentacle TV - Desktop"
        progress={0.35}
        chip={paused ? { label: t("sessions:paused"), tone: "neutral" } : { label: t("sessions:playing"), tone: "success" }}
        actions={[
          { label: paused ? t("sessions:resume") : t("sessions:pause"), highlighted: aiming && !paused },
          { label: t("sessions:stop"), danger: true },
        ]}
      />

      <ScenePlayerPanel x={PLAYER.x} y={PLAYER.y} w={PLAYER.w} progress={0.35} caption="Tentacle TV - Desktop" />
      <FauxChip
        x={PLAYER.x + PLAYER.w / 2 - 40}
        y={PLAYER.y + 52}
        label={t("sessions:paused")}
        variant="primary"
        visible={paused}
        scale={paused ? 1 : 0.9}
      />

      <FauxCursor x={aiming ? PAUSE.x : 260} y={aiming ? PAUSE.y : 330} pressed={pressed} reduced={reduced} />
    </SceneStage>
  );
}
