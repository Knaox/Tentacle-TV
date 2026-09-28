import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, CalendarSearch, Clock, Compass, Moon, RefreshCw, ServerCog, Sparkles, TriangleAlert } from "lucide-react";
import { CollectionEmpty } from "../collection/CollectionStates";
import { EmptyState } from "../ui/EmptyState";
import { useStatsFormat } from "./useStatsFormat";

const CTA =
  "inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full border border-cta-primary-border bg-cta-primary-bg px-7 text-sm font-bold text-cta-primary-fg transition-colors duration-150 hover:bg-cta-primary-bg-hover";

/**
 * Le chargement, à la forme de la page remplie : le chiffre du héros et le
 * sélecteur, les quatre tuiles, puis deux cartes de graphique — la page ne
 * saute pas quand les données arrivent.
 */
export const StatsSkeleton = memo(function StatsSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-4">
      <div className="rounded-[var(--radius-xl)] bg-[color:var(--surface-1)] p-4 ring-1 ring-line-subtle md:p-6">
        <div className="flex flex-col-reverse gap-4 md:flex-row md:justify-between">
          <div className="flex flex-col gap-3">
            <div className="skeleton-shimmer h-4 w-56 rounded-full" />
            <div className="skeleton-shimmer h-14 w-64 rounded-2xl md:h-[72px]" />
            <div className="skeleton-shimmer h-4 w-72 rounded-full" />
          </div>
          <div className="skeleton-shimmer h-9 w-72 rounded-full" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton-shimmer h-[72px] rounded-2xl" />)}
      </div>
      <div className="skeleton-shimmer h-[300px] rounded-2xl" />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="skeleton-shimmer h-[260px] rounded-2xl lg:col-span-2" />
        <div className="skeleton-shimmer h-[260px] rounded-2xl" />
      </div>
    </div>
  );
});

/** Rien vu, jamais : la page promet ce qu'elle montrera, et mène au catalogue. */
export const StatsNeverWatched = memo(function StatsNeverWatched() {
  const f = useStatsFormat();
  const navigate = useNavigate();
  return (
    <CollectionEmpty
      icon={BarChart3}
      title={f.t("emptyTitle")}
      body={f.t("emptyBody")}
      steps={[
        { icon: Clock, label: f.t("emptyStepTime") },
        { icon: Moon, label: f.t("emptyStepRhythm") },
        { icon: Sparkles, label: f.t("emptyStepTaste") },
      ]}
      primary={{ label: f.t("emptyCta"), icon: Compass, onClick: () => navigate("/") }}
    />
  );
});

/** Une période vide alors que l'historique existe : on propose de voir plus large. */
export const StatsPeriodEmpty = memo(function StatsPeriodEmpty({ onShowAll }: { onShowAll: () => void }) {
  const f = useStatsFormat();
  return (
    <EmptyState
      icon={<CalendarSearch size={26} />}
      title={f.t("periodEmptyTitle")}
      description={f.t("periodEmptyBody")}
      action={<button type="button" className={CTA} onClick={onShowAll}>{f.t("periodEmptyCta")}</button>}
    />
  );
});

/** Échec : serveur trop ancien (la route n'existe pas) ou serveur injoignable. */
export const StatsFailure = memo(function StatsFailure({ outdated, onRetry }: { outdated: boolean; onRetry: () => void }) {
  const f = useStatsFormat();
  return outdated ? (
    <EmptyState icon={<ServerCog size={26} />} title={f.t("outdatedTitle")} description={f.t("outdatedBody")} />
  ) : (
    <EmptyState
      icon={<TriangleAlert size={26} />}
      title={f.t("errorTitle")}
      description={f.t("errorBody")}
      action={
        <button type="button" className={CTA} onClick={onRetry}>
          <RefreshCw size={16} aria-hidden />
          {f.t("retry")}
        </button>
      }
    />
  );
});
