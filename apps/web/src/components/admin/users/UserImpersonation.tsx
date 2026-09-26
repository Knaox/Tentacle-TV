import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Eye } from "lucide-react";
import { startImpersonation } from "../../../lib/impersonation";
import { cls } from "../../../pages/adminUtils";
import { ConfirmDialog } from "../../ui/ConfirmDialog";
import type { AdminUser } from "./userListModel";

/**
 * « Voir en tant que » : l'admin parcourt l'app avec le jeton court d'un
 * compte (8 h, jamais admin). Refusé par le serveur pour un administrateur et
 * pour soi-même — la fiche le dit au lieu de proposer un bouton voué à
 * l'échec. La confirmation passe par `ConfirmDialog` : `window.confirm()` ne
 * s'affiche pas dans tous les webviews.
 */
export function UserImpersonation({ user, isSelf }: { user: AdminUser; isSelf: boolean }) {
  const { t } = useTranslation(["admin", "common"]);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isSelf || user.isAdministrator) {
    return (
      <p className="text-xs text-content-tertiary">
        {isSelf ? t("impersonateUnavailableSelf") : t("impersonateUnavailableAdmin")}
      </p>
    );
  }

  const start = async () => {
    setPending(true);
    setError(null);
    try {
      await startImpersonation(user.id);
      // startImpersonation recharge la page : rien après ce point.
    } catch (err) {
      setError(err instanceof Error ? err.message : t("impersonateError"));
      setPending(false);
      setConfirming(false);
    }
  };

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <p className="flex-1 text-xs leading-relaxed text-content-tertiary">{t("impersonateHint")}</p>
        <button type="button" onClick={() => setConfirming(true)} disabled={pending} className={`${cls.bbrand} shrink-0`}>
          <Eye aria-hidden className="h-4 w-4" />
          {pending ? t("impersonating") : t("impersonate")}
        </button>
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-status-error-fg">{error}</p>}
      <ConfirmDialog
        open={confirming}
        title={t("impersonateConfirmTitle", { name: user.name })}
        message={t("impersonateConfirm")}
        confirmLabel={t("impersonate")}
        cancelLabel={t("common:cancel")}
        pending={pending}
        onConfirm={() => void start()}
        onCancel={() => { if (!pending) setConfirming(false); }}
      />
    </div>
  );
}
