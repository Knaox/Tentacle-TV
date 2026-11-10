import { useTranslation } from "react-i18next";
import { CheckCircleIcon as CircleCheck } from "@phosphor-icons/react/dist/csr/CheckCircle";
import type { StillWatchingTrialState } from "@tentacle-tv/api-client";
import { SubSetting } from "./SubSetting";

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
    <SubSetting
      title={t("stillWatchingTrialTitle")}
      hint={(
        <span role="status">
          {armed ? (
            <span className="flex items-start gap-1.5 text-content-secondary">
              <CircleCheck aria-hidden="true" size={14} weight="fill" className="mt-0.5 shrink-0 text-accent" />
              <span>{t("stillWatchingTrialArmed")}</span>
            </span>
          ) : (
            t("stillWatchingTrialHint")
          )}
        </span>
      )}
      trailing={(
        <button type="button" onClick={armed ? trial.cancel : trial.arm} className="btn btn-soft btn-sm">
          {armed ? t("stillWatchingTrialCancel") : t("stillWatchingTrialStart")}
        </button>
      )}
    />
  );
}
