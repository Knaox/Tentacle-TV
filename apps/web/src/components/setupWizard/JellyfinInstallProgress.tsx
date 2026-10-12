import { useTranslation } from "react-i18next";
import { LoaderCircle } from "lucide-react";
import type { InstallProgress, InstallStage } from "./localJellyfinModel";

const STAGE_TITLE: Readonly<Record<InstallStage, string>> = {
  download: "installStageDownloadTitle",
  installer: "installStageInstallerTitle",
  start: "installStageStartTitle",
};

const STAGE_LEAD: Readonly<Record<InstallStage, string>> = {
  download: "installStageDownloadLead",
  installer: "installStageInstallerLead",
  start: "installStageStartLead",
};

/** Le dégradé de marque, comme les autres barres de l'assistant. */
const BAR_STYLE = { background: "linear-gradient(90deg, var(--brand), var(--brand-accent))" } as const;

/**
 * L'ÉTAT de l'installation guidée de Jellyfin, dans le panneau de droite :
 * une phrase en grand qui dit ce qui se passe et ce qu'on attend de
 * l'administrateur, et la progression du téléchargement. Les trois étapes et
 * les consignes (l'accord de Windows, une fenêtre cachée, une fermeture trop
 * tôt) sont à gauche (`JellyfinInstallSteps`) : la droite garde l'état.
 */
export function JellyfinInstallProgress({ progress }: { progress: InstallProgress }) {
  const { t } = useTranslation("setupWizard");
  const { stage } = progress;
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <LoaderCircle size={22} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--brand-light)] motion-safe:animate-spin" />
        <div className="space-y-1">
          <p className="text-base font-semibold text-content-primary">{t(STAGE_TITLE[stage])}</p>
          <p>{t(STAGE_LEAD[stage])}</p>
        </div>
      </div>

      {stage === "download" ? (
        <div className="space-y-1.5">
          <p className="text-xs text-content-tertiary">{t(progress.message.key, progress.message.values)}</p>
          {progress.percent !== null ? (
            <div
              role="progressbar"
              aria-label={t("installDownloadProgress")}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress.percent}
              className="h-1.5 overflow-hidden rounded-full bg-fill-subtle"
            >
              <div className="h-full origin-left rounded-full transition-transform duration-500" style={{ ...BAR_STYLE, transform: `scaleX(${progress.percent / 100})` }} />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
