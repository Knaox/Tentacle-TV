import { useTranslation } from "react-i18next";
import { Check, LoaderCircle } from "lucide-react";
import { INSTALL_STAGES, stageStatus, type InstallStage } from "./localJellyfinModel";

const STEP_LABEL: Readonly<Record<InstallStage, string>> = {
  download: "installStepDownload",
  installer: "installStepInstaller",
  start: "installStepStart",
};

function StepIcon({ status }: { status: "done" | "active" | "pending" }) {
  if (status === "done") return <Check size={16} aria-hidden="true" className="text-status-success-fg" />;
  if (status === "active") return <LoaderCircle size={16} aria-hidden="true" className="text-[var(--brand-light)] motion-safe:animate-spin" />;
  return <span aria-hidden="true" className="block size-2.5 rounded-full border border-line-strong" />;
}

/**
 * Les trois étapes de l'installation guidée, dans la colonne de GAUCHE de
 * l'écran Jellyfin : avant de commencer (`stage` nul : toutes à venir, avec le
 * conseil « Installation simple »), puis faites, en cours, à venir. Pendant que
 * l'installateur est ouvert, ce qui bloque d'habitude : l'accord de Windows,
 * une fenêtre cachée, une fermeture trop tôt.
 */
export function JellyfinInstallSteps({ stage }: { stage: InstallStage | null }) {
  const { t } = useTranslation("setupWizard");
  return (
    <div className="space-y-4" data-testid="jellyfin-install-steps">
      <div className="space-y-1">
        <p className="font-semibold text-content-primary">{t("jfInstallStepsTitle")}</p>
        {stage === null ? <p>{t("jfInstallStepsLead")}</p> : null}
      </div>
      <ol className="space-y-2.5 rounded-xl border border-line-subtle bg-fill-faint p-4" aria-label={t("installStepsLabel")}>
        {INSTALL_STAGES.map((step) => {
          const status = stage === null ? "pending" : stageStatus(stage, step);
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
      {stage === "installer" ? (
        <ul className="list-disc space-y-1.5 pl-5 marker:text-[var(--brand-light)]">
          <li>{t("installTipConsent")}</li>
          <li className="text-content-primary">{t("installAdvice")}</li>
          <li>{t("installTipHidden")}</li>
          <li>{t("installTipClosed")}</li>
        </ul>
      ) : stage === null ? (
        <p className="text-content-primary">{t("installAdvice")}</p>
      ) : null}
    </div>
  );
}
