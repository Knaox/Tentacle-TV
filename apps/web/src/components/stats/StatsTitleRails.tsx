import { memo, useMemo } from "react";
import { useJellyfinClient, type JellyfinClient } from "@tentacle-tv/api-client";
import type { ViewingStats, ViewingStatsTitle } from "@tentacle-tv/shared";
import { PeopleRail } from "./PeopleRail";
import { StatsSection } from "./StatsSection";
import { TitleRail, type RailTitle } from "./TitleRail";
import { useStatsFormat } from "./useStatsFormat";

function posterOf(client: JellyfinClient, title: ViewingStatsTitle): string {
  return client.getImageUrl(title.id, "Primary", {
    height: 360,
    quality: 85,
    ...(title.primaryTag ? { tag: title.primaryTag } : {}),
  });
}

/** Vos séries — les plus regardées de la période, rang en grands chiffres. */
export const SeriesRail = memo(function SeriesRail({ stats }: { stats: ViewingStats }) {
  const f = useStatsFormat();
  const client = useJellyfinClient();
  const items: RailTitle[] = useMemo(
    () =>
      stats.topSeries.map((s) => ({
        key: s.id,
        href: `/media/${s.id}`,
        title: s.name,
        caption: [s.episodes > 0 ? f.t("seriesEpisodes", { count: s.episodes }) : null, s.seconds >= 60 ? f.duration(s.seconds) : null]
          .filter(Boolean)
          .join(" · "),
        imageUrl: posterOf(client, s),
      })),
    [stats.topSeries, f, client]
  );
  if (items.length === 0) return null;
  return (
    <StatsSection title={f.t("seriesTitle")} bare>
      <TitleRail items={items} ariaLabel={f.t("seriesTitle")} ranked />
    </StatsSection>
  );
});

/** Vos films — ceux de la période, le plus récent d'abord ; « Vu 2 fois » quand la mesure l'a vérifié. */
export const MoviesRail = memo(function MoviesRail({ stats }: { stats: ViewingStats }) {
  const f = useStatsFormat();
  const client = useJellyfinClient();
  const items: RailTitle[] = useMemo(
    () =>
      stats.movies.map((m) => ({
        key: m.id,
        href: `/media/${m.id}`,
        title: m.name,
        caption: m.lastPlayedAt ? f.t("movieSeenOn", { date: f.isoDay(m.lastPlayedAt) }) : f.duration(m.seconds),
        chip: m.viewings >= 2 ? f.t("movieViewings", { count: m.viewings }) : undefined,
        imageUrl: posterOf(client, m),
      })),
    [stats.movies, f, client]
  );
  if (items.length === 0) return null;
  return (
    <StatsSection title={f.t("moviesTitle")} bare>
      <TitleRail items={items} ariaLabel={f.t("moviesTitle")} />
    </StatsSection>
  );
});

/** Vos têtes d'affiche — les acteurs, puis la réalisation et la création. */
export const PeopleSection = memo(function PeopleSection({ stats }: { stats: ViewingStats }) {
  const f = useStatsFormat();
  const { actors, directors } = stats.people;
  if (actors.length === 0 && directors.length === 0) return null;
  return (
    <StatsSection title={f.t("peopleTitle")} hint={f.t("peopleHint")} bare>
      <div className="flex flex-col gap-5">
        {actors.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-content-secondary">{f.t("actorsTitle")}</h3>
            <PeopleRail people={actors} ariaLabel={f.t("actorsTitle")} />
          </div>
        )}
        {directors.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-content-secondary">{f.t("directorsTitle")}</h3>
            <PeopleRail people={directors} ariaLabel={f.t("directorsTitle")} />
          </div>
        )}
      </div>
    </StatsSection>
  );
});
