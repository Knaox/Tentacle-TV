import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useServerReachable } from "../hooks/useServerReachable";

/**
 * Message affiché quand une page n'a RIEN pu charger alors que le serveur
 * répond. Sans lui, une page dont toutes les requêtes échouent se contentait de
 * masquer ses rangées : l'utilisateur voyait un écran vide, sans savoir s'il
 * n'avait aucun contenu ou si quelque chose s'était cassé.
 *
 * Silencieux quand l'application se sait hors ligne : `OfflineBanner` parle
 * déjà, et deux messages concurrents sur le même incident sèment le doute.
 */
export function ContentErrorState({ onRetry }: { onRetry?: () => void }) {
  const { t } = useTranslation("common");
  const queryClient = useQueryClient();
  const { isReachable } = useServerReachable();
  const [retrying, setRetrying] = useState(false);

  const handleRetry = useCallback(() => {
    setRetrying(true);
    const done = () => setRetrying(false);
    if (onRetry) {
      onRetry();
      done();
      return;
    }
    void queryClient.refetchQueries({ type: "active" }).finally(done);
  }, [onRetry, queryClient]);

  if (!isReachable) return null;

  return (
    <div className="row-gutter flex flex-col items-center py-20 text-center" role="status">
      <h2 className="text-lg font-semibold text-content-primary">
        {t("common:contentErrorTitle")}
      </h2>
      <p className="mt-2 max-w-md text-sm text-content-tertiary">
        {t("common:contentErrorMessage")}
      </p>
      <button
        type="button"
        onClick={handleRetry}
        disabled={retrying}
        className="mt-6 inline-flex h-10 items-center justify-center rounded-lg border border-line-subtle bg-fill-subtle px-5 text-sm font-semibold text-content-primary transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
      >
        {t("common:retry")}
      </button>
    </div>
  );
}
