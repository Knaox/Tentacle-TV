import { useTranslation } from "react-i18next";
import type { WizardErrorCode } from "./setupApi";

/** Un refus du serveur, dit en mots : un code, jamais une trace. Annoncé aux lecteurs d'écran. */
export function SetupErrorLine({ code, onRetry }: { code: WizardErrorCode | null; onRetry?: () => void }) {
  const { t } = useTranslation("setupWizard");
  if (!code) return null;
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl bg-status-error-bg px-4 py-3">
      <p className="min-w-0 flex-1 text-sm leading-relaxed text-status-error-fg">{t(`error_${code}`)}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="text-sm font-semibold text-content-primary underline underline-offset-4 hover:opacity-80">
          {t("retry")}
        </button>
      ) : null}
    </div>
  );
}
