import { memo } from "react";
import { Link } from "react-router-dom";
import { Bookmark, ChevronRight } from "lucide-react";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { ViewingStatsTaste } from "@tentacle-tv/shared";
import { CardImage } from "../cards/CardImage";
import { useStatsFormat } from "./useStatsFormat";

const TMDB_POSTER = "https://image.tmdb.org/t/p/w154";

/**
 * « À voir » — les titres seulement dans Ma liste, ni vus ni aimés : un
 * POTENTIEL, pas un avis. Une tuile discrète, à part de tout le reste : le
 * compte, quelques affiches, le chemin vers Ma liste. Aucun pourcentage — ces
 * titres ne pèsent sur aucune statistique de la page, et la tuile le dit.
 */
export const PotentialTile = memo(function PotentialTile({ taste }: { taste: ViewingStatsTaste }) {
  const f = useStatsFormat();
  const client = useJellyfinClient();
  const potential = taste.potential;
  if (!potential || potential.count === 0) return null;
  const posters = potential.titles
    .map((p) => ({
      key: p.key,
      url: p.jellyfinId
        ? client.getImageUrl(p.jellyfinId, "Primary", { height: 150, quality: 80 })
        : p.posterPath ? `${TMDB_POSTER}${p.posterPath}` : null,
    }))
    .filter((p): p is { key: string; url: string } => p.url !== null);

  return (
    <section
      aria-label={f.t("potentialTitle")}
      className="flex flex-col gap-4 rounded-2xl bg-fill-faint px-5 py-4 ring-1 ring-line-subtle sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-fill-soft text-content-secondary">
          <Bookmark size={17} />
        </span>
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-content-primary">{f.t("potentialTitle")}</h2>
          <p className="mt-0.5 text-[13px] leading-snug text-content-secondary">{f.t("potentialBody", { count: potential.count })}</p>
          <p className="mt-0.5 text-xs leading-snug text-content-tertiary">{f.t("potentialNote")}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-4 pl-12 sm:pl-0">
        {posters.length > 0 && (
          <span aria-hidden className="flex">
            {posters.map((p, i) => (
              <span
                key={p.key}
                className={`relative block aspect-[2/3] w-9 overflow-hidden rounded-md bg-fill-soft ring-2 ring-[color:var(--surface-0)] ${i > 0 ? "-ml-2.5" : ""}`}
              >
                <CardImage src={p.url} alt="" className="h-full w-full object-cover" zoom={false} />
              </span>
            ))}
          </span>
        )}
        <Link
          to="/watchlist"
          className="inline-flex h-9 cursor-pointer items-center gap-1 rounded-full bg-[color:var(--surface-2)] pl-4 pr-3 text-sm font-semibold text-content-secondary ring-1 ring-line-strong transition-colors duration-150 hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
        >
          {f.t("potentialCta")}
          <ChevronRight size={16} aria-hidden />
        </Link>
      </div>
    </section>
  );
});
