import { useTranslation } from "react-i18next";
import { Check, LoaderCircle } from "lucide-react";
import { INSTALL_STAGES, stageStatus, type InstallProgress, type InstallStage } from "./localJellyfinModel";

const STEP_LABEL: Readonly<Record<InstallStage, string>> = {
  download: "installStepDownload",
  installer: "installStepInstaller",
  start: "installStepStart",
};

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

function StepIcon({ status }: { status: "done" | "active" | "pending" }) {
  if (status === "done") return <Check size={16} aria-hidden="true" className="text-status-success-fg" />;
  if (status === "active") return <LoaderCircle size={16} aria-hidden="true" className="text-[var(--brand-light)] motion-safe:animate-spin" />;
  return <span aria-hidden="true" className="block size-2.5 rounded-full border border-line-strong" />;
}

/**
 * L'installation guidée de Jellyfin, impossible à manquer : une phrase en
 * grand qui dit ce qui se passe et ce qu'on attend de l'administrateur, les
 * trois étapes (faites, en cours, à venir), la progression du téléchargement,
 * et — pendant que l'installateur est ouvert — ce qui bloque d'habitude
 * (l'accord de Windows, une fenêtre cachée, une fermeture trop tôt).
 *
 * Un état d'attente, dans le panneau du Jellyfin de ce PC : la mise en page de
 * l'écran reste celle de l'assistant (`WizardFrame`).
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

      <ol className="space-y-2" aria-label={t("installStepsLabel")}>
        {INSTALL_STAGES.map((step) => {
          const status = stageStatus(stage, step);
          return (
            <li key={step} className="flex items-center gap-3" aria-current={status === "active" ? "step" : undefined}>
              <span className="flex size-5 shrink-0 items-center justify-center">
                <StepIcon status={status} />
              </span>
              <span className={status === "pending" ? "text-content-tertiary" : status === "active" ? "font-semibold text-content-primary" : ""}>
                {t(STEP_LABEL[step])}
                {status === "pending" ? null : <span className="sr-only"> — {t(status === "done" ? "installStepDone" : "installStepActive")}</span>}
              </span>
            </li>
          );
        })}
      </ol>

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

      {stage === "installer" ? (
        <ul className="list-disc space-y-1 pl-5 marker:text-[var(--brand-light)]">
          <li>{t("installTipConsent")}</li>
          <li className="text-content-primary">{t("installAdvice")}</li>
          <li>{t("installTipHidden")}</li>
          <li>{t("installTipClosed")}</li>
        </ul>
      ) : null}
    </div>
  );
}
