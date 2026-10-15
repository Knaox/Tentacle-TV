import { useTranslation } from "react-i18next";
import { CircleCheck } from "lucide-react";
import type { StillWatchingTrialState } from "@tentacle-tv/api-client";

interface StillWatchingTrialRowProps {
  trial: StillWatchingTrialState;
}

/**
 * « Voir la question maintenant » — sous les deux durées de « Vous regardez
 * encore ? » (`StillWatchingSetting`) : un essai armé UNE fois, pour la
 * prochaine lecture (`useStillWatchingTrial`, api-client). La question y paraît
 * après vingt secondes sans geste ; le reste est le vrai comportement.
 *
 * Armé, l'explication devient l'état — annoncé (`role="status"`) et marqué
 * d'une coche, pas seulement d'une couleur — et le bouton propose de renoncer.
 * Un bouton secondaire : la carte n'a pas d'action principale.
 */
export function StillWatchingTrialRow({ trial }: StillWatchingTrialRowProps) {
  const { t } = useTranslation("preferences");
  const { armed } = trial;

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-content-primary">{t("stillWatchingTrialTitle")}</p>
        <p role="status" className="mt-1 text-xs leading-relaxed text-content-tertiary">
          {armed ? (
            <span className="flex items-start gap-1.5 text-content-secondary">
              <CircleCheck aria-hidden="true" size={14} strokeWidth={2.2} className="mt-px shrink-0 text-[var(--brand-light)]" />
              <span>{t("stillWatchingTrialArmed")}</span>
            </span>
          ) : (
            t("stillWatchingTrialHint")
          )}
        </p>
      </div>
      <button
        type="button"
        onClick={armed ? trial.cancel : trial.arm}
        className="min-h-11 shrink-0 cursor-pointer rounded-lg border border-line-subtle px-4 text-sm font-medium text-content-secondary transition-colors hover:border-line-strong hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-tentacle-surface"
      >
        {armed ? t("stillWatchingTrialCancel") : t("stillWatchingTrialStart")}
      </button>
    </div>
  );
}
