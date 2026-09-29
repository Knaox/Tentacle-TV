import { useCallback, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Download, Power, Settings2 } from "lucide-react";
import { useRefreshPlugins } from "@tentacle-tv/plugins-api";
import { StatusPill, type StatusTone } from "../kit";
import { ActionPill } from "../sessions/ActionPill";
import { ActionError } from "../../admin-plugins/ActionError";
import { usePluginAdmin } from "../../admin-plugins/PluginAdminContext";
import { PLUGIN_QUERY_ROOT, useInstalledPlugins, useMarketplacePlugins } from "../../admin-plugins/queries";
import { PluginSetupForm } from "./PluginSetupForm";
import { adminPathOf, mainPathOf, recommendedStatus, type RecommendedPlugin, type RecommendedStatus } from "./recommendedPlugins";

/**
 * Une extension recommandée : ce qu'elle apporte, où elle en est, et le geste
 * suivant — l'installer (le flux du catalogue, redémarrage suivi compris),
 * l'activer, la brancher (le formulaire qu'elle déclare, sinon sa page
 * d'administration), puis l'ouvrir. Rien ici ne sait ce qu'est Vigie.
 */

const PILL: Record<RecommendedStatus["kind"], { tone: StatusTone; key: string } | null> = {
  loading: null,
  "catalog-error": null,
  "not-found": null,
  missing: { tone: "neutral", key: "statusMissing" },
  disabled: { tone: "neutral", key: "statusDisabled" },
  restart: { tone: "warning", key: "statusRestart" },
  failed: { tone: "error", key: "statusFailed" },
  setup: { tone: "warning", key: "statusSetup" },
  ready: { tone: "success", key: "statusReady" },
};

const linkClass =
  "inline-flex h-9 items-center gap-1.5 rounded-full border border-line-subtle bg-fill-soft px-3.5 text-[13px] font-medium text-content-primary transition hover:border-line-strong hover:bg-fill-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus";

export function RecommendedPluginCard({ rec }: { rec: RecommendedPlugin }) {
  const { t } = useTranslation("adminRecommended");
  const { actions, locked } = usePluginAdmin();
  const installed = useInstalledPlugins();
  const catalog = useMarketplacePlugins();
  const queryClient = useQueryClient();
  const refreshPlugins = useRefreshPlugins();
  const status = recommendedStatus(rec.pluginId, { installed: installed.data, catalog: catalog.data, catalogFailed: catalog.isError });
  const name = t(`rec_${rec.pluginId}_name`, { defaultValue: status.kind === "missing" ? status.entry.name : rec.pluginId });
  const actionState = actions.states.get(rec.pluginId);
  const pill = PILL[status.kind];
  const Icon = rec.icon;

  // Branchée : la navigation, les routes et la carte suivent sans rechargement.
  const onSaved = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: PLUGIN_QUERY_ROOT });
    refreshPlugins();
  }, [queryClient, refreshPlugins]);

  let footer: ReactNode = null;
  switch (status.kind) {
    case "loading":
      footer = <div aria-hidden="true" className="skeleton-shimmer h-9 w-40 rounded-full" />;
      break;
    case "catalog-error":
      footer = <p className="text-sm text-content-tertiary">{t("catalogError")}</p>;
      break;
    case "not-found":
      footer = (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-content-tertiary">{t("notFound")}</p>
          <Link to="/admin/plugins?tab=sources" className={linkClass}>{t("showSources")}</Link>
        </div>
      );
      break;
    case "missing":
      footer = (
        <ActionPill
          tone="brand"
          icon={Download}
          label={t("install", { name })}
          busyLabel={t("installing")}
          status={actionState?.kind === "install" && actionState.status !== "done" ? actionState.status : "idle"}
          disabled={locked && actionState?.status !== "busy"}
          onClick={() => void actions.install(status.entry)}
        />
      );
      break;
    case "disabled":
      footer = (
        <ActionPill
          tone="brand"
          icon={Power}
          label={t("enable")}
          busyLabel={t("enabling")}
          status={actionState?.kind === "toggle" && actionState.status === "busy" ? "busy" : "idle"}
          disabled={locked}
          onClick={() => void actions.toggle(status.plugin)}
        />
      );
      break;
    case "restart":
      footer = <p className="text-sm text-content-tertiary">{t("restartBody")}</p>;
      break;
    case "failed":
      footer = (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-status-error-fg">{t("failedBody")}</p>
          <Link to="/admin/plugins" className={linkClass}>{t("manage")}</Link>
        </div>
      );
      break;
    case "setup": {
      const adminPath = adminPathOf(status.plugin);
      footer = status.plugin.setup ? (
        <div className="space-y-3">
          <PluginSetupForm pluginId={status.plugin.pluginId} meta={status.plugin.setup} name={name} onSaved={onSaved} />
          {adminPath && <Link to={adminPath} className="text-xs font-medium text-content-secondary underline-offset-4 hover:text-content-primary hover:underline">{t("setupOtherSettings")}</Link>}
        </div>
      ) : adminPath ? (
        // Une extension sans formulaire déclaré se règle sur sa propre page.
        <Link to={adminPath} className={linkClass}><Settings2 size={15} aria-hidden="true" />{t("configure")}</Link>
      ) : null;
      break;
    }
    case "ready": {
      const adminPath = adminPathOf(status.plugin);
      const mainPath = mainPathOf(status.plugin);
      footer = (
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 inline-flex items-center gap-1.5 text-sm text-status-success-fg"><Check size={15} aria-hidden="true" />{t("readyBody")}</span>
          {mainPath && <Link to={mainPath} className={linkClass}>{t("open", { name })}</Link>}
          {adminPath && <Link to={adminPath} className={linkClass}><Settings2 size={15} aria-hidden="true" />{t("settings")}</Link>}
        </div>
      );
      break;
    }
  }

  const compact = status.kind === "ready";
  return (
    <article aria-labelledby={`rec-${rec.pluginId}`} className="rounded-xl border border-line-subtle bg-fill-subtle p-4">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand-light)]">
          <Icon size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 id={`rec-${rec.pluginId}`} className="text-base font-semibold text-content-primary">{name}</h3>
            {pill && <StatusPill tone={pill.tone} size="sm">{t(pill.key)}</StatusPill>}
          </div>
          <p className="mt-1 text-sm leading-relaxed text-content-secondary">{t(`rec_${rec.pluginId}_pitch`)}</p>
          {!compact && (
            <>
              <ul className="mt-2 grid gap-1 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: rec.benefits }, (_, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs leading-relaxed text-content-secondary">
                    <Check size={13} aria-hidden="true" className="mt-0.5 flex-shrink-0 text-[var(--brand-light)]" />
                    {t(`rec_${rec.pluginId}_benefit${String(i + 1)}`)}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-content-tertiary">{t(`rec_${rec.pluginId}_needs`)}</p>
            </>
          )}
        </div>
      </div>
      {footer && <div className="mt-4 border-t border-line-subtle pt-4">{footer}</div>}
      {actionState?.status === "error" && <ActionError action={actionState.kind} error={actionState.error} className="mt-3" />}
    </article>
  );
}
