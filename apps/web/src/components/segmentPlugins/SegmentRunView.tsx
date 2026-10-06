import { memo } from "react";
import { useTranslation } from "react-i18next";
import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import type { SegmentSetupRun } from "@tentacle-tv/shared";
import { outcomeTone, RUN_STEPS, stepState, type OutcomeTone } from "./segmentRunModel";

/**
 * Un passage d'installation des greffons de passages, en mots simples : les
 * étapes pendant qu'il tourne, puis un mot par greffon, le redémarrage, les
 * réglages. Annoncé poliment aux lecteurs d'écran ; jamais la couleur seule —
 * chaque ligne porte son icône et sa phrase. Commun à l'assistant et à
 * l'administration.
 */

const OUTCOME_CLASS: Record<OutcomeTone, string> = {
  success: "text-status-success-fg",
  warning: "text-status-warning-fg",
  neutral: "text-content-tertiary",
};

function Mark({ state }: { state: "done" | "running" | "pending" | "warning" }) {
  if (state === "done") return <CircleCheck size={16} aria-hidden="true" className="shrink-0 text-status-success-fg" />;
  if (state === "warning") return <CircleAlert size={16} aria-hidden="true" className="shrink-0 text-status-warning-fg" />;
  return (
    <LoaderCircle
      size={16}
      aria-hidden="true"
      className={`shrink-0 ${state === "running" ? "text-content-secondary motion-safe:animate-spin" : "text-content-quaternary"}`}
    />
  );
}

export const SegmentRunView = memo(function SegmentRunView({ run }: { run: SegmentSetupRun }) {
  const { t } = useTranslation("segmentPlugins");

  if (run.running) {
    return (
      <ul className="space-y-2" aria-live="polite">
        {RUN_STEPS.map((step) => {
          const state = stepState(run, step);
          return (
            <li key={step} className="flex items-center gap-2 text-sm">
              <Mark state={state} />
              <span className={state === "pending" ? "text-content-tertiary" : "text-content-primary"}>{t(`phase_${step}`)}</span>
            </li>
          );
        })}
      </ul>
    );
  }

  if (run.error) {
    return (
      <p className="flex items-start gap-2 text-sm text-status-warning-fg" aria-live="polite">
        <Mark state="warning" />
        {t(`error_${run.error}`)}
      </p>
    );
  }

  return (
    <div className="space-y-3" aria-live="polite">
      <ul className="space-y-2">
        {run.plugins.map((plugin) => {
          const tone = outcomeTone(plugin.outcome);
          return (
            <li key={plugin.key} className="flex items-start gap-2 text-sm">
              <Mark state={tone === "success" ? "done" : tone === "warning" ? "warning" : "pending"} />
              <span className="min-w-0">
                <span className="font-medium text-content-primary">{t(`plugin_${plugin.key}`)}</span>
                <span className="text-content-quaternary"> — </span>
                <span className={OUTCOME_CLASS[tone]}>{t(`outcome_${plugin.outcome ?? "waiting"}`)}</span>
              </span>
            </li>
          );
        })}
      </ul>
      {run.restart ? <p className="text-xs leading-relaxed text-content-tertiary">{t(`restart_${run.restart}`)}</p> : null}
      {run.configured !== null ? (
        <p className={`text-xs leading-relaxed ${run.configured ? "text-content-tertiary" : "text-status-warning-fg"}`}>
          {t(run.configured ? "configured_true" : "configured_false")}
        </p>
      ) : null}
    </div>
  );
});
