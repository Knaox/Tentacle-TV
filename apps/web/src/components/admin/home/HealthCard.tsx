import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ChevronRight, Clapperboard, Database } from "lucide-react";
import { AdminSection, StatusPill, type StatusTone } from "../kit";
import { useServicesHealth } from "./overviewApi";
import type { HealthState } from "./overviewSummary";

const TONE: Record<HealthState, StatusTone> = {
  connected: "success",
  error: "error",
  not_configured: "warning",
  unknown: "neutral",
};

const LABEL_KEY: Record<HealthState, string> = {
  connected: "homeStateConnected",
  error: "homeStateError",
  not_configured: "homeStateNotConfigured",
  unknown: "homeStateUnknown",
};

/**
 * L'état du serveur en tête de la vue d'ensemble : Jellyfin et la base de
 * données, chacun avec sa puce d'état et sa version. C'est la première chose
 * qu'on vient vérifier — tout le reste en dépend.
 */
export function HealthCard({ className }: { className?: string }) {
  const { t } = useTranslation("admin");
  const { data, loading } = useServicesHealth();

  return (
    <AdminSection
      title={t("homeHealthTitle")}
      className={className}
      actions={
        <Link
          to="/admin/services"
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-content-secondary transition-colors hover:bg-fill-subtle hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
        >
          {t("homeHealthManage")}
          <ChevronRight aria-hidden="true" size={16} />
        </Link>
      }
    >
      {!loading && data === null ? (
        <p className="text-sm text-content-tertiary">{t("homeHealthUnavailable")}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <ServiceRow
            icon={<Clapperboard size={18} />}
            name={t("homeJellyfin")}
            state={data?.jellyfin.state}
            version={data?.jellyfin.version ?? null}
          />
          <ServiceRow
            icon={<Database size={18} />}
            name={t("homeDatabase")}
            state={data?.database.state}
            version={data?.database.version ?? null}
          />
        </div>
      )}
    </AdminSection>
  );
}

function ServiceRow({
  icon,
  name,
  state,
  version,
}: {
  icon: ReactNode;
  name: string;
  /** `undefined` : la sonde n'a pas encore répondu. */
  state: HealthState | undefined;
  version: string | null;
}) {
  const { t } = useTranslation("admin");
  // La puce sous le nom, pas à sa droite : la carte partage sa largeur entre
  // deux services, et une puce en bout de ligne tronquait « Base de données ».
  return (
    <div className="flex items-start gap-3 rounded-xl bg-fill-subtle px-3 py-3" aria-busy={state === undefined || undefined}>
      <span
        aria-hidden="true"
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-fill-soft text-content-secondary"
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-content-primary">{name}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          {state === undefined ? (
            <div aria-hidden="true" className="skeleton-shimmer h-6 w-24 rounded-full" />
          ) : (
            <StatusPill tone={TONE[state]} size="sm">
              {t(LABEL_KEY[state])}
            </StatusPill>
          )}
          {version ? <span className="text-xs text-content-tertiary">{t("homeVersion", { version })}</span> : null}
        </div>
      </div>
    </div>
  );
}
