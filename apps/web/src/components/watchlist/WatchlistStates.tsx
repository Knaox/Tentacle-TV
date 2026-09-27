import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Bookmark, Compass, Search } from "lucide-react";
import type { WatchStageFilter } from "@tentacle-tv/api-client";
import type { WatchlistView } from "./useWatchlistPage";

/**
 * Liste VIDE — pas filtrée à zéro, vide. Elle dit ce que la page promet et
 * donne deux chemins pour la remplir, au lieu d'une phrase grise au milieu
 * du vide.
 */
export const WatchlistEmpty = memo(function WatchlistEmpty() {
  const { t } = useTranslation("watchlist");
  const { t: tc } = useTranslation("common");
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center px-6 pb-24 pt-20 text-center md:pt-28">
      <div className="relative mb-6">
        <span
          aria-hidden
          className="absolute inset-0 -m-6 rounded-full opacity-60 blur-2xl"
          style={{ background: "radial-gradient(circle, rgba(var(--brand-rgb),0.45), transparent 70%)" }}
        />
        <span
          className="relative flex h-20 w-20 items-center justify-center rounded-3xl text-white shadow-lg"
          style={{ background: "linear-gradient(135deg, var(--brand), var(--brand-accent))" }}
        >
          <Bookmark size={34} aria-hidden />
        </span>
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-content-primary md:text-3xl">{tc("emptyWatchlist")}</h1>
      <p className="mt-3 max-w-md text-[15px] leading-relaxed text-content-tertiary">{t("emptyBody")}</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="flex h-11 cursor-pointer items-center gap-2 rounded-full border border-cta-primary-border bg-cta-primary-bg px-6 text-sm font-bold text-cta-primary-fg transition-transform duration-150 hover:scale-[1.03] active:scale-[0.97] motion-reduce:hover:scale-100"
        >
          <Compass size={17} aria-hidden /> {t("emptyExplore")}
        </button>
        <button
          type="button"
          onClick={() => navigate("/search")}
          className="flex h-11 cursor-pointer items-center gap-2 rounded-full border border-line-subtle bg-fill-subtle px-6 text-sm font-semibold text-content-secondary transition-colors duration-150 hover:bg-fill-soft hover:text-content-primary"
        >
          <Search size={17} aria-hidden /> {t("emptySearch")}
        </button>
      </div>
    </div>
  );
});

const STAGE_EMPTY: Record<Exclude<WatchStageFilter, "all">, string> = {
  new: "stageEmptyNew",
  inProgress: "stageEmptyInProgress",
  watched: "stageEmptyWatched",
};

/** Une étape sans titre : on le dit, et on rend tout d'un geste. */
export const WatchlistStageEmpty = memo(function WatchlistStageEmpty({
  stage, onShowAll,
}: {
  stage: Exclude<WatchStageFilter, "all">;
  onShowAll: () => void;
}) {
  const { t } = useTranslation("watchlist");
  return (
    <div className="flex flex-col items-center py-24 text-center">
      <p className="text-base text-content-tertiary">{t(STAGE_EMPTY[stage])}</p>
      <button
        type="button"
        onClick={onShowAll}
        className="mt-4 h-10 cursor-pointer rounded-full bg-fill-subtle px-5 text-sm font-semibold text-content-secondary transition-colors duration-150 hover:bg-fill-soft hover:text-content-primary"
      >
        {t("showAll")}
      </button>
    </div>
  );
});

/**
 * Squelette à la forme de la vue choisie — la page ne saute pas quand les
 * titres arrivent. Le miroitement est celui du reste de l'app.
 */
export const WatchlistSkeleton = memo(function WatchlistSkeleton({ view }: { view: WatchlistView }) {
  const { t } = useTranslation("watchlist");
  return (
    <div role="status" aria-label={t("loading")} className="px-4 pt-6 md:px-8">
      <div className="mb-6 flex gap-2">
        {[88, 110, 96].map((w) => (
          <div key={w} className="skeleton-shimmer h-9 rounded-full" style={{ width: w }} />
        ))}
      </div>
      {view === "list" ? (
        <div className="flex flex-col gap-2.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton-shimmer h-[118px] rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
          {Array.from({ length: 18 }).map((_, i) => (
            <div key={i} className="skeleton-shimmer aspect-[2/3] rounded-[var(--radius-lg)]" />
          ))}
        </div>
      )}
    </div>
  );
});
