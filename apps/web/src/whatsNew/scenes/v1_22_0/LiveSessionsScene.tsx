import { useTranslation } from "react-i18next";
import type { SceneProps } from "../../types";
import { posterAt, useSceneMedia } from "../../sceneMedia";
import { FauxCursor, Place, SceneStage, useSceneClock } from "..";
import { FauxSessionCard } from "./FauxSessionCard";

const STEPS = [900, 900, 700, 400, 1500] as const;
const LEFT = 24;
const W = 592;
/**
 * Une salle lit UN fichier, au même instant pour tous : les deux membres
 * avancent ensemble, d'un pas à l'autre — c'est la page en direct. Ce qui les
 * distingue, c'est l'appareil, et la façon dont le média lui arrive.
 */
const PROGRESS = [0.42, 0.44, 0.46, 0.46, 0.47] as const;
/** Le bouton « Arrêter pour tous », au bout de la ligne de la salle. */
const STOP_ALL = { x: LEFT + W - 62, y: 272 } as const;

/**
 * « Sessions en direct » (administrateurs) : une salle Watch Together, ses deux
 * membres sur la MÊME œuvre, qui transcode et qui lit en direct — et
 * « Arrêter pour tous », qui arrête la salle d'un geste.
 */
export function LiveSessionsScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation();
  const media = useSceneMedia();
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const aiming = step >= 2;
  const pressed = step === 3;
  const stopped = step >= 4;
  const work = posterAt(media, 0);
  const title = work?.title ?? t("whatsNew:sceneNowPlaying");
  const progress = PROGRESS[step] ?? 0;
  return (
    <SceneStage cycle={cycle}>
      <Place x={LEFT} y={16} w={W}>
        <span className="block text-[15px] font-bold text-content-primary">{t("sessions:title")}</span>
      </Place>
      <FauxSessionCard
        x={LEFT}
        y={46}
        w={W}
        poster={work}
        tone={0}
        title={title}
        subtitle="Tentacle TV - Web · Chrome"
        progress={progress}
        chip={stopped ? { label: t("sessions:stopped"), tone: "neutral" } : { label: t("sessions:directPlay"), tone: "success" }}
      />
      <FauxSessionCard
        x={LEFT}
        y={148}
        w={W}
        poster={work}
        tone={0}
        title={title}
        subtitle="Tentacle TV - Desktop · HEVC 4K → H.264 1080p"
        progress={progress}
        chip={stopped ? { label: t("sessions:stopped"), tone: "neutral" } : { label: t("sessions:transcode"), tone: "warning" }}
      />
      <Place x={LEFT} y={250} w={W}>
        <div className="flex items-center gap-3 rounded-xl border border-line-subtle bg-surface-1 px-3 py-2">
          <span className="text-[12px] font-semibold text-content-primary">{t("sessions:sectionGroups")}</span>
          <span className="text-[11px] text-content-tertiary">{t("sessions:groupOf", { count: 2 })}</span>
          <span className="ml-auto inline-flex rounded-md border border-[var(--status-error)]/30 bg-[var(--status-error-bg)] px-2.5 py-1 text-[11px] font-semibold text-[var(--status-error-fg)]">
            {t("sessions:stopAll")}
          </span>
        </div>
      </Place>
      <FauxCursor x={aiming ? STOP_ALL.x : 560} y={aiming ? STOP_ALL.y : 340} pressed={pressed} reduced={reduced} />
    </SceneStage>
  );
}
