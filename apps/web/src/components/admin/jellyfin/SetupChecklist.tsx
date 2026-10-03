import { useTranslation } from "react-i18next";
import { ExternalLink } from "lucide-react";
import { AdminNotice, AdminSection } from "../kit";
import { INSTALLED_FAILURE_KEY } from "./compatPresentation";
import { isOutdatedServer, useJellyfinSetup } from "./jellyfinAdminApi";
import { SetupRows } from "./SetupRows";
import { setupProgress } from "./setupPresentation";

/**
 * Les réglages de Jellyfin qui rendent Tentacle complet, chacun avec l'état
 * RÉEL du serveur connecté et son remède : un clic quand l'API de Jellyfin le
 * permet sans risque, sinon la bonne page de son tableau de bord.
 *
 * La liste COMPLÈTE vit dans Services (`#jellyfin-setup`) — ce qui est fait
 * et ses gestes de suite (générer, relancer) compris. La vue d'ensemble n'en
 * montre que ce qui reste à faire, dans la recommandation « Jellyfin ».
 * Jellyfin n'est jamais redémarré d'ici.
 */
export const JELLYFIN_SETUP_ANCHOR = "jellyfin-setup";

export function SetupChecklist() {
  const { t } = useTranslation("adminJellyfin");
  const setup = useJellyfinSetup();

  const report = setup.data;
  const progress = report && !report.error ? setupProgress(report.checks) : null;
  const dashboardHome = report?.dashboardUrl ? `${report.dashboardUrl}/web/#/dashboard` : null;

  return (
    <AdminSection
      id={JELLYFIN_SETUP_ANCHOR}
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
          <SetupRows report={report} checks={report.checks} />
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
