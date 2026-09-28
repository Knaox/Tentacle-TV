import { memo, useMemo } from "react";
import { Link } from "react-router-dom";
import { Film } from "lucide-react";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { isLovedTitle, moviesRankMode, titleReasons, type ViewingStats, type ViewingStatsTitle } from "@tentacle-tv/shared";
import { CardImage } from "../cards/CardImage";
import { ReasonChips, reasonChips } from "./ReasonChips";
import { StatsSection } from "./StatsSection";
import { posterOf } from "./StatsTitleRails";
import { TitleRail, type RailTitle } from "./TitleRail";
import { useStatsFormat, type StatsFormat } from "./useStatsFormat";

/** « Vu 2 fois · 3 h 40 » — combien de fois, puis le temps passé. */
function movieCaption(f: StatsFormat, m: ViewingStatsTitle): string {
  return [m.viewings > 0 ? f.t("viewings", { count: m.viewings }) : null, m.seconds >= 60 ? f.duration(m.seconds) : null]
    .filter(Boolean)
    .join(" · ");
}

/** Le film préféré, mis en avant : l'affiche, le titre, combien de fois, et pourquoi. */
const FavoriteMovie = memo(function FavoriteMovie({ movie }: { movie: ViewingStatsTitle }) {
  const f = useStatsFormat();
  const client = useJellyfinClient();
  const chips = reasonChips(f, titleReasons(movie));
  const caption = [movie.year ? String(movie.year) : null, movieCaption(f, movie)].filter(Boolean).join(" · ");
  return (
    <Link
      to={`/media/${movie.id}`}
      aria-label={[f.t("favoriteMovie"), movie.name, caption, ...chips.map((c) => c.ariaLabel ?? c.label)].join(", ")}
      className="group mb-4 flex max-w-xl cursor-pointer gap-4 rounded-2xl bg-[color:var(--surface-1)] p-3 pr-5 ring-1 ring-line-subtle outline-none transition-colors duration-150 hover:bg-[color:var(--surface-2)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
    >
      <span className="relative aspect-[2/3] w-[84px] shrink-0 overflow-hidden rounded-xl bg-fill-soft sm:w-[96px]">
        <CardImage
          src={posterOf(client, movie, 300)}
          alt=""
          className="h-full w-full object-cover"
          fallback={<span className="flex h-full w-full items-center justify-center text-content-disabled"><Film size={24} aria-hidden /></span>}
        />
      </span>
      <span className="flex min-w-0 flex-col justify-center">
        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--brand-light)]">{f.t("favoriteMovie")}</span>
        <span className="mt-1 line-clamp-2 text-xl font-bold leading-tight text-content-primary">{movie.name}</span>
        {caption && <span className="mt-1 text-sm tabular-nums text-content-secondary">{caption}</span>}
        {chips.length > 0 && <ReasonChips chips={chips} className="mt-2.5" />}
      </span>
    </Link>
  );
});

/**
 * Vos films préférés — un vrai classement, aux critères dits en clair sous
 * le titre : votre note, vos coups de cœur et favoris, puis vos
 * revisionnages ; le temps passé départage (le calcul est côté serveur,
 * `movieRanking.ts`). Chaque film dit combien de fois il a été vu. Le
 * premier est mis en avant s'il a gagné sa place ; sans aucun avis, la page
 * le dit et classe au temps. Un serveur plus ancien trie par date : la page
 * le dit aussi, sans rang.
 */
export const MoviesSection = memo(function MoviesSection({ stats }: { stats: ViewingStats }) {
  const f = useStatsFormat();
  const client = useJellyfinClient();
  const mode = moviesRankMode(stats);
  const featured = mode === "preference" && stats.movies[0] && isLovedTitle(stats.movies[0]) ? stats.movies[0] : null;
  const items: RailTitle[] = useMemo(
    () =>
      (featured ? stats.movies.slice(1) : stats.movies).map((m) => ({
        key: m.id,
        href: `/media/${m.id}`,
        title: m.name,
        caption: mode === "recent" && m.lastPlayedAt ? f.t("movieSeenOn", { date: f.isoDay(m.lastPlayedAt) }) : movieCaption(f, m),
        chips: reasonChips(f, titleReasons(m)),
        imageUrl: posterOf(client, m),
      })),
    [stats.movies, featured, mode, f, client]
  );
  if (stats.movies.length === 0) return null;
  return (
    <StatsSection title={f.t(mode === "preference" ? "moviesFavoritesTitle" : "moviesTitle")} hint={f.t(`moviesHint_${mode}`)} bare>
      {featured && <FavoriteMovie movie={featured} />}
      {items.length > 0 && (
        <TitleRail items={items} ariaLabel={f.t("moviesTitle")} firstRank={mode === "recent" ? undefined : featured ? 2 : 1} />
      )}
    </StatsSection>
  );
});
