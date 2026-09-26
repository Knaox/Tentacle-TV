import { memo } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, RotateCw } from "lucide-react";
import { cls } from "../../../pages/adminUtils";

interface MetadataLoadErrorProps {
  onRetry: () => void;
  retrying: boolean;
}

/** La lecture a échoué : on le dit, et on offre de réessayer — sans cela,
 *  l'admin restait devant une page vide sans savoir pourquoi. */
export const MetadataLoadError = memo(function MetadataLoadError({ onRetry, retrying }: MetadataLoadErrorProps) {
  const { t } = useTranslation("adminMetadata");
  return (
    <div role="alert" className="flex flex-col items-start gap-4 rounded-xl border border-danger-border bg-danger-surface p-6 sm:flex-row sm:items-center">
      <AlertTriangle aria-hidden size={22} className="shrink-0 text-status-error-fg" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-content-primary">{t("loadError")}</p>
        <p className="mt-1 text-sm text-content-tertiary">{t("loadErrorHint")}</p>
      </div>
      <button type="button" onClick={onRetry} disabled={retrying} className={cls.bs}>
        <RotateCw aria-hidden size={16} className={retrying ? "animate-spin" : undefined} />
        {t("retry")}
      </button>
    </div>
  );
});
