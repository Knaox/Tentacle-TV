import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ChevronRight, RefreshCw } from "lucide-react";
import type { JellyfinCompatReport } from "@tentacle-tv/shared";
import { cls } from "../../../pages/adminUtils";
import { AdminNotice, AdminSection } from "../kit";
import { InstalledColumn, LatestColumn } from "./CompatColumns";
import { CompatFeatureTable } from "./CompatFeatureTable";
import { formatDay } from "./compatPresentation";
import { isOutdatedServer, useCompatRefresh, useJellyfinCompat } from "./jellyfinAdminApi";

/**
 * La compatibilité de Jellyfin : la version installée et la dernière publiée,
 * chacune jugée d'après le référentiel des tests de Tentacle. La vue d'ensemble
 * la montre en deux colonnes et renvoie au détail ; Services (`#compat`) y
 * ajoute le tableau fonctionnalité par fonctionnalité.
 *
 * « Revérifier » relit le référentiel publié et GitHub sans attendre qu'ils
 * vieillissent (le serveur s'en garde lui-même à une fois par demi-minute).
 */

interface Props {
  variant: "overview" | "services";
}

export function JellyfinCompatSection({ variant }: Props) {
  const { t } = useTranslation("adminJellyfin");
  const compat = useJellyfinCompat();
  const refresh = useCompatRefresh();
  const report = refresh.data ?? compat.data;
  const busy = refresh.isPending || compat.isFetching;

  return (
    <AdminSection
      id={variant === "services" ? "compat" : undefined}
      title={t("compatTitle")}
      description={t("compatDescription")}
      actions={
        report ? (
          <button type="button" onClick={() => refresh.mutate()} disabled={busy} className={cls.bs}>
            <RefreshCw size={16} aria-hidden="true" className={busy ? "motion-safe:animate-spin" : ""} />
            {busy ? t("compatRechecking") : t("compatRecheck")}
          </button>
        ) : undefined
      }
    >
      {report ? (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <InstalledColumn report={report} />
            <LatestColumn report={report} />
          </div>
          {variant === "services" && <CompatFeatureTable report={report} />}
          <Footer report={report} withDetails={variant === "overview"} />
        </div>
      ) : compat.isError ? (
        isOutdatedServer(compat.error) ? (
          <AdminNotice>{t("outdatedServer")}</AdminNotice>
        ) : (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl bg-status-error-bg px-4 py-3">
            <p className="min-w-0 flex-1 text-sm text-status-error-fg">{t("loadError")}</p>
            <button type="button" onClick={() => void compat.refetch()} className="text-sm font-semibold text-content-primary underline underline-offset-4">
              {t("retry")}
            </button>
          </div>
        )
      ) : (
        <div aria-hidden="true" className="grid gap-3 md:grid-cols-2">
          <div className="skeleton-shimmer h-36 rounded-xl" />
          <div className="skeleton-shimmer h-36 rounded-xl" />
        </div>
      )}
    </AdminSection>
  );
}

/** D'où vient le verdict : la révision du référentiel, sa date, sa source — et le détail. */
function Footer({ report, withDetails }: { report: JellyfinCompatReport; withDetails: boolean }) {
  const { t, i18n } = useTranslation("adminJellyfin");
  const manifest = report.manifest;
  const source = manifest?.source === "remote" ? t("manifestSourceRemote") : t("manifestSourceEmbedded");
  const line = !manifest || manifest.testedVersions.length === 0
    ? t("manifestEmpty")
    : manifest.generatedAt
      ? t("manifestLine", { revision: manifest.revision, date: formatDay(manifest.generatedAt, i18n.language), source })
      : t("manifestLineNoDate", { revision: manifest.revision, source });
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line-subtle pt-3">
      <p className="min-w-0 text-xs text-content-tertiary">
        {line}
        {manifest?.remoteError && <span> · {t("manifestRemoteError")}</span>}
      </p>
      {withDetails && (
        <Link
          to="/admin/services#compat"
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-content-secondary transition-colors hover:bg-fill-subtle hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
        >
          {t("compatDetails")}
          <ChevronRight size={16} aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
