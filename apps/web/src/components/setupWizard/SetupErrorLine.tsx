import { useTranslation } from "react-i18next";
import { CircleAlert } from "lucide-react";
import type { WizardErrorCode } from "./setupApi";

/**
 * Un refus du serveur, dit en mots : un code, jamais une trace. Annoncé aux
 * lecteurs d'écran ; l'icône double la couleur. « Réessayer » quand un nouvel
 * essai a un sens.
 */
export function SetupErrorLine({ code, onRetry }: { code: WizardErrorCode | null; onRetry?: () => void }) {
  const { t } = useTranslation("setupWizard");
  if (!code) return null;
  return (
    <div role="alert" className="flex flex-wrap items-start gap-x-3 gap-y-2 rounded-xl border border-danger-border bg-status-error-bg px-4 py-3">
      <CircleAlert size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-status-error-fg" />
      <p className="min-w-0 flex-1 text-sm leading-relaxed text-status-error-fg">{t(`error_${code}`)}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="min-h-6 text-sm font-semibold text-content-primary underline underline-offset-4 hover:opacity-80">
          {t("retry")}
        </button>
      ) : null}
    </div>
  );
}
