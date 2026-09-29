import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ExternalLink } from "lucide-react";
import type { SetupActionId } from "@tentacle-tv/shared";
import { useToast } from "../../../contexts/ToastContext";
import { AdminNotice, AdminSection } from "../kit";
import { INSTALLED_FAILURE_KEY } from "./compatPresentation";
import { JellyfinAdminError, isOutdatedServer, useJellyfinSetup, useSetupApply } from "./jellyfinAdminApi";
import { SetupCheckRow } from "./SetupCheckRow";
import { applyErrorKey, languageChoice, setupProgress } from "./setupPresentation";

/**
 * Les réglages de Jellyfin qui rendent Tentacle complet, chacun avec l'état
 * RÉEL du serveur connecté et son remède : un clic quand l'API de Jellyfin le
 * permet sans risque, sinon la bonne page de son tableau de bord.
 *
 * Un geste à la fois — le serveur le refuse de toute façon (« busy ») — et
 * l'état relu arrive avec la réponse : la ligne passe à « Fait » sans
 * rechargement. Jellyfin n'est jamais redémarré d'ici.
 */
export function SetupChecklist() {
  const { t, i18n } = useTranslation("adminJellyfin");
  const { show } = useToast();
  const setup = useJellyfinSetup();
  const apply = useSetupApply();
  const [running, setRunning] = useState<SetupActionId | null>(null);
  const [failed, setFailed] = useState<SetupActionId | null>(null);
  const language = useMemo(
    () => languageChoice(i18n.language, typeof navigator === "undefined" ? "" : navigator.language ?? ""),
    [i18n.language],
  );

  const onApply = useCallback(async (action: SetupActionId) => {
    setRunning(action);
    setFailed(null);
    try {
      await apply.mutateAsync({
        action,
        ...(action === "setMetadataLanguage" ? { language: language.language, country: language.country } : {}),
      });
      show("success", t("applied"));
    } catch (error) {
      setFailed(action);
      show("error", t(applyErrorKey(error instanceof JellyfinAdminError ? error.code : null)));
    } finally {
      setRunning(null);
    }
  }, [apply, language, show, t]);

  const report = setup.data;
  const progress = report && !report.error ? setupProgress(report.checks) : null;
  const dashboardHome = report?.dashboardUrl ? `${report.dashboardUrl}/web/#/dashboard` : null;

  return (
    <AdminSection
      title={t("setupTitle")}
      description={t("setupDescription")}
      actions={progress && progress.total > 0 ? <Progress done={progress.done} total={progress.total} /> : undefined}
      flush
    >
      {report && !report.error ? (
        <>
          {report.restartPending && (
            <div className="px-5 pt-4">
              <AdminNotice
                tone="warning"
                title={t("restartPendingTitle")}
                action={dashboardHome ? <ExternalAction href={dashboardHome}>{t("openDashboard")}</ExternalAction> : undefined}
              >
                {t("restartPendingBody")}
              </AdminNotice>
            </div>
          )}
          <ul className="divide-y divide-line-subtle">
            {report.checks.map((check) => (
              <SetupCheckRow
                key={check.id}
                check={check}
                dashboardUrl={report.dashboardUrl}
                language={language}
                running={running}
                failed={failed}
                onApply={(action) => void onApply(action)}
              />
            ))}
          </ul>
        </>
      ) : (
        <div className="p-5">
          {report?.error ? (
            <AdminNotice tone={report.error === "not-configured" ? "info" : "error"}>{t(INSTALLED_FAILURE_KEY[report.error])}</AdminNotice>
          ) : setup.isError ? (
            isOutdatedServer(setup.error) ? (
              <AdminNotice>{t("outdatedServer")}</AdminNotice>
            ) : (
              <AdminNotice tone="error" action={<RetryButton onRetry={() => void setup.refetch()} />}>{t("loadError")}</AdminNotice>
            )
          ) : (
            <div aria-hidden="true" className="space-y-3">
              {[0, 1, 2].map((i) => <div key={i} className="skeleton-shimmer h-16 rounded-xl" />)}
            </div>
          )}
        </div>
      )}
    </AdminSection>
  );
}

/** « 4 sur 6 faits », et la barre qui le montre. */
function Progress({ done, total }: { done: number; total: number }) {
  const { t } = useTranslation("adminJellyfin");
  const ratio = total === 0 ? 1 : done / total;
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium tabular-nums text-content-secondary">
        {done === total ? t("setupAllDone") : t("setupProgress", { done, total })}
      </span>
      <div
        role="progressbar"
        aria-label={t("setupProgressLabel")}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        className="h-1.5 w-24 overflow-hidden rounded-full bg-fill-soft"
      >
        {/* Une largeur posée, jamais animée : la barre ne repeint rien. */}
        <div className={`h-full rounded-full ${done === total ? "bg-status-success" : "bg-[var(--brand)]"}`} style={{ width: `${String(Math.round(ratio * 100))}%` }} />
      </div>
    </div>
  );
}

function ExternalAction({ href, children }: { href: string; children: string }) {
  const { t } = useTranslation("adminJellyfin");
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-sm font-semibold text-content-primary underline underline-offset-4 hover:opacity-80"
    >
      {children}
      <ExternalLink size={14} aria-hidden="true" />
      <span className="sr-only"> {t("opensNewTab")}</span>
    </a>
  );
}

function RetryButton({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation("adminJellyfin");
  return (
    <button type="button" onClick={onRetry} className="text-sm font-semibold text-content-primary underline underline-offset-4 hover:opacity-80">
      {t("retry")}
    </button>
  );
}
