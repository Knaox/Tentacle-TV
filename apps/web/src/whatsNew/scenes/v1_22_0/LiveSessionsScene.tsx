import { useTranslation } from "react-i18next";
import type { SceneProps } from "../../types";
import { posterAt, useSceneMedia } from "../../sceneMedia";
import { FauxCursor, Place, SceneStage, useSceneClock } from "..";
import { FauxSessionCard } from "./FauxSessionCard";

const STEPS = [900, 900, 700, 400, 1500] as const;
const LEFT = 24;
const W = 592;
/** Les deux lectures avancent d'un pas à l'autre : c'est la page en direct. */
const PROGRESS = [
  [0.18, 0.21, 0.24, 0.24, 0.27],
  [0.61, 0.63, 0.66, 0.66, 0.68],
] as const;
/** Le bouton « Arrêter pour tous », au bout de la ligne de la salle. */
const STOP_ALL = { x: LEFT + W - 62, y: 272 } as const;

/**
 * « Sessions en direct » (administrateurs) : qui regarde quoi, comment le média
 * arrive — lecture directe ou transcodage — et la salle Watch Together de ces
 * deux lectures, que « Arrêter pour tous » arrête d'un geste.
 */
export function LiveSessionsScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation();
  const media = useSceneMedia();
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const aiming = step >= 2;
  const pressed = step === 3;
  const stopped = step >= 4;
  const first = posterAt(media, 0);
  const second = posterAt(media, 1);
  return (
    <SceneStage cycle={cycle}>
      <Place x={LEFT} y={16} w={W}>
        <span className="block text-[15px] font-bold text-content-primary">{t("sessions:title")}</span>
      </Place>
      <FauxSessionCard
        x={LEFT}
        y={46}
        w={W}
        poster={first}
        tone={0}
        title={first?.title ?? t("whatsNew:sceneNowPlaying")}
        subtitle="Tentacle TV - Web · Chrome"
        progress={PROGRESS[0][step] ?? 0}
        chip={stopped ? { label: t("sessions:stopped"), tone: "neutral" } : { label: t("sessions:directPlay"), tone: "success" }}
      />
      <FauxSessionCard
        x={LEFT}
        y={148}
        w={W}
        poster={second}
        tone={2}
        title={second?.title ?? t("whatsNew:sceneNowPlaying")}
        subtitle="Tentacle TV - Desktop · HEVC 4K → H.264 1080p"
        progress={PROGRESS[1][step] ?? 0}
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
