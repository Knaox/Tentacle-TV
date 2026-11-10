import { useTranslation } from "react-i18next";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { CircleIcon } from "@phosphor-icons/react/dist/csr/Circle";
import type { UpdatePhase } from "../../lib/updateTypes";
import { Spinner } from "../ui/Spinner";
import { UpdateProgress } from "./UpdateProgress";

interface UpdateStageProps {
  phase: UpdatePhase;
  progress: number;
  indeterminate: boolean;
  visible: boolean;
}

/** Les trois étapes, dans l'ordre où elles se jouent. */
const STEPS = [
  { phase: "downloading", labelKey: "notifications:updateStepDownload" },
  { phase: "installing", labelKey: "notifications:updateStepInstall" },
  { phase: "restarting", labelKey: "notifications:updateStepRestart" },
] as const;

type StepState = "done" | "current" | "waiting";

/** Où en est une étape, d'après la phase en cours. */
export function stepState(step: (typeof STEPS)[number]["phase"], phase: UpdatePhase): StepState {
  const order = STEPS.map((entry) => entry.phase) as readonly string[];
  const at = order.indexOf(phase);
  const mine = order.indexOf(step);
  return mine < at ? "done" : mine === at ? "current" : "waiting";
}

/**
 * La mise à jour EN COURS, dite en mots : trois étapes — téléchargement, installation,
 * redémarrage —, chacune faite, en cours ou à venir, et la jauge du téléchargement. Rien ici ne
 * se clique : la pop-up est verrouillée (`UpdateDialog`), elle ne fait que dire où l'on en est.
 */
export function UpdateStage({ phase, progress, indeterminate, visible }: UpdateStageProps) {
  const { t } = useTranslation("notifications");
  const pct = Math.max(0, Math.min(100, Math.round(progress)));
  const detail = (step: (typeof STEPS)[number]["phase"], state: StepState): string => {
    if (state === "done") return t("notifications:updateStepDone");
    if (state === "waiting") return t("notifications:updateStepWaiting");
    if (step === "downloading") {
      return indeterminate ? t("notifications:downloadingByStore") : t("notifications:updatePercent", { progress: pct });
    }
    return step === "installing" ? t("notifications:updateInstalling") : t("notifications:updateRestarting");
  };

  return (
    <div className="space-y-4" data-update-phase={phase}>
      <ol className="space-y-1" aria-live="polite">
        {STEPS.map((step) => {
          const state = stepState(step.phase, phase);
          return (
            <li key={step.phase} data-state={state} aria-current={state === "current" ? "step" : undefined}
              className={`flex items-center gap-3 rounded-field px-3 py-2 ${state === "current" ? "bg-fill-subtle" : ""}`}>
              <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center" aria-hidden>
                {state === "done" && <CheckCircleIcon size={20} weight="fill" className="text-accent" />}
                {state === "current" && <Spinner size="sm" tone="neutral" paused={!visible} label="" />}
                {state === "waiting" && <CircleIcon size={18} className="text-content-quaternary" />}
              </span>
              <span className={`flex-1 text-sm font-semibold ${state === "waiting" ? "text-content-tertiary" : "text-content-primary"}`}>
                {t(step.labelKey)}
              </span>
              <span className={`num text-sm ${state === "current" ? "text-content-secondary" : "text-content-tertiary"}`}>
                {detail(step.phase, state)}
              </span>
            </li>
          );
        })}
      </ol>
      {phase === "downloading" && (
        <UpdateProgress progress={progress} indeterminate={indeterminate} visible={visible} label={t("notifications:updateProgressLabel")} />
      )}
      <p className="text-xs text-content-tertiary">{t("notifications:restartHint")}</p>
    </div>
  );
}
