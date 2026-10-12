import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import type { SetupStep } from "@tentacle-tv/shared";
import { LanguageToggle } from "../auth/LanguageToggle";
import { TentacleLogo } from "../ui/TentacleLogo";
import { phaseOf, phaseState, WIZARD_PHASES } from "./wizardPhases";

interface WizardHeaderProps {
  step: SetupStep;
  /** Position (1-indexée) et nombre d'écrans du parcours. */
  position: number;
  total: number;
  /** Le nombre d'écrans n'est pas encore connu (accueil, avant de savoir si le code sera demandé). */
  hideProgress?: boolean;
}

/**
 * La dernière avancée montrée : chaque écran remonte son cadre, la barre
 * repart donc de là où l'écran précédent l'avait laissée et glisse jusqu'à la
 * sienne — on VOIT que l'on avance.
 */
let lastScale = 0;

/**
 * L'en-tête de l'assistant : la marque, les cinq grandes étapes (faites, en
 * cours, à venir — dites en toutes lettres, jamais par la couleur seule), la
 * langue, et sous lui la progression écran par écran. La barre se remplit par
 * `scaleX` (transform seul : rien n'est repeint) ; aucun flou, rien n'est
 * derrière.
 */
export function WizardHeader({ step, position, total, hideProgress }: WizardHeaderProps) {
  const { t } = useTranslation("setupWizard");
  const target = hideProgress ? 0 : position / total;
  const [scale, setScale] = useState(lastScale);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setScale(target));
    lastScale = target;
    return () => cancelAnimationFrame(frame);
  }, [target]);
  const progressLabel = hideProgress ? undefined : t("progress", { n: position, total });

  return (
    <header className="shrink-0">
      <div className="mx-auto flex h-16 w-full max-w-[92rem] items-center gap-4 px-4 sm:px-6 lg:px-10">
        <div className="flex min-w-0 items-center gap-3">
          <TentacleLogo size="sm" />
          <span className="hidden text-sm font-bold tracking-tight text-content-primary sm:inline">Tentacle</span>
          <span aria-hidden="true" className="hidden h-4 w-px bg-line-subtle sm:inline-block" />
          <span className="hidden truncate text-sm text-content-tertiary sm:inline">{t("frameLabel")}</span>
        </div>

        <ol aria-label={t("phasesLabel")} className="mx-auto hidden items-center gap-1 lg:flex">
          {WIZARD_PHASES.map((phase, index) => {
            const state = phaseState(phase, step);
            const label = t(`phase_${phase}`);
            return (
              <li key={phase} aria-current={state === "current" ? "step" : undefined} className="flex items-center gap-1">
                {index > 0 ? <span aria-hidden="true" className={`h-px w-6 xl:w-10 ${state === "upcoming" ? "bg-line-subtle" : "bg-[var(--brand)]"}`} /> : null}
                <span
                  className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold ${
                    state === "current"
                      ? "bg-[var(--brand-soft)] text-content-primary ring-1 ring-[rgba(var(--brand-rgb),0.45)]"
                      : state === "done"
                        ? "text-content-secondary"
                        : "text-content-quaternary"
                  }`}
                >
                  {state === "done" ? (
                    <Check size={14} aria-hidden="true" className="text-[var(--brand-light)]" />
                  ) : (
                    <span aria-hidden="true" className="tabular-nums">{index + 1}</span>
                  )}
                  {state === "done" ? <span className="sr-only">{t("phaseDone", { phase: label })}</span> : null}
                  <span aria-hidden={state === "done" || undefined}>{label}</span>
                </span>
              </li>
            );
          })}
        </ol>

        <p className="ml-auto truncate text-xs font-medium text-content-tertiary lg:hidden">
          <span className="text-content-primary">{t(`phase_${phaseOf(step)}`)}</span>
          {progressLabel ? <span className="tabular-nums"> · {position}/{total}</span> : null}
        </p>

        <div className="shrink-0 lg:ml-0">
          <LanguageToggle />
        </div>
      </div>
      <div
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={hideProgress ? undefined : position}
        aria-label={progressLabel}
        className="h-0.5 w-full overflow-hidden bg-fill-soft"
      >
        <div
          className="h-full origin-left transition-transform duration-500 ease-out motion-reduce:transition-none"
          style={{ transform: `scaleX(${scale})`, background: "linear-gradient(90deg, var(--brand), var(--brand-accent))" }}
        />
      </div>
    </header>
  );
}
