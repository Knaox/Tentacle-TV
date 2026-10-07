import { memo } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, CircleHelp, ExternalLink } from "lucide-react";
import { SETUP_HELP, setupDocUrl, setupHelpTopic, type SetupStep } from "@tentacle-tv/shared";

/**
 * « Besoin d'aide ? » au pied de chaque écran : replié d'office (un
 * `<details>` natif — clavier et lecteurs d'écran sans rien de plus),
 * quelques questions-réponses courtes, puis la page du site qui en dit plus,
 * dans la langue de l'interface.
 */
export const SetupHelp = memo(function SetupHelp({ step, noLibraries }: { step: SetupStep; noLibraries: boolean }) {
  const { t, i18n } = useTranslation("setupWizard");
  const ids = SETUP_HELP[step];
  return (
    <details className="group mt-8 rounded-xl border border-line-subtle bg-fill-faint" data-testid="setup-help">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl px-4 text-sm font-semibold text-content-secondary hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus [&::-webkit-details-marker]:hidden">
        <CircleHelp size={16} aria-hidden="true" className="text-content-tertiary" />
        <span className="flex-1">{t("helpToggle")}</span>
        <ChevronDown size={16} aria-hidden="true" className="text-content-tertiary transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" />
      </summary>
      <div className="space-y-4 px-4 pb-4 pt-1">
        <dl className="space-y-3">
          {ids.map((id) => (
            <div key={id}>
              <dt className="text-sm font-semibold text-content-primary">{t(`help_${step}_${id}_q`)}</dt>
              <dd className="mt-0.5 text-sm leading-relaxed text-content-secondary">{t(`help_${step}_${id}_a`)}</dd>
            </div>
          ))}
        </dl>
        <a
          href={setupDocUrl(setupHelpTopic(step, noLibraries), i18n.language ?? "en")}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-content-secondary underline underline-offset-4 hover:text-content-primary"
        >
          {t("helpDoc")}
          <ExternalLink size={14} aria-hidden="true" />
        </a>
      </div>
    </details>
  );
});
