import { useTranslation } from "react-i18next";
import { CircleNotchIcon as LoaderCircle } from "@phosphor-icons/react/dist/csr/CircleNotch";
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
        <LoaderCircle size={22} aria-hidden="true" className="mt-0.5 shrink-0 text-accent motion-safe:animate-spin" />
        <div className="space-y-1">
          <p className="text-base font-semibold text-content-primary">{t(STAGE_TITLE[stage])}</p>
          <p>{t(STAGE_LEAD[stage])}</p>
        </div>
      </div>

      {stage === "download" ? (
        <div className="space-y-1.5">
          <p className="num text-xs text-content-tertiary">{t(progress.message.key, progress.message.values)}</p>
          {progress.percent !== null ? (
            <div
              role="progressbar"
              aria-label={t("installDownloadProgress")}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress.percent}
              className="gauge h-1.5 rounded-full"
            >
              <i className="transition-transform duration-sheet-in ease-out" style={{ transform: `scaleX(${progress.percent / 100})` }} />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
